import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

type AdminActionBody =
  | { action: "authorize-sensitive"; sensitiveAction?: SensitiveAdminAction }
  | { action: "ban-user"; userId?: string; reason?: string | null; approvalToken?: string }
  | { action: "unban-user"; userId?: string }
  | { action: "ban-ip"; ip?: string; reason?: string | null; approvalToken?: string }
  | { action: "unban-ip"; ip?: string }
  | { action: "delete-listing"; listingId?: string; reason?: string | null; approvalToken?: string }
  | { action: "delete-user"; userId?: string; approvalToken?: string }
  | { action: "list-profiles"; query?: string; limit?: number; offset?: number }
  | { action: "activity-feed"; cursor?: string | null; limit?: number }
  | { action: "presence-summary" }
  | { action: "presence-page"; limit?: number; offset?: number }
  | { action: "list-banned-ips" };

type SensitiveAdminAction = "ban-user" | "ban-ip" | "delete-listing" | "delete-user";

type AdminActivityKind =
  | "account"
  | "listing"
  | "sale"
  | "conversation"
  | "message"
  | "review"
  | "search-alert"
  | "visit"
  | "admin";

type AdminActivityEvent = {
  id: string;
  kind: AdminActivityKind;
  occurred_at: string;
  title: string;
  detail: string;
  actor_id: string | null;
  actor_name: string | null;
  ip: string | null;
  ip_source: "event" | "profile" | null;
};

type ActivityCursor = {
  at: string;
  key: string;
};

const ADMIN_ACTIVITY_DEFAULT_LIMIT = 40;
const ADMIN_ACTIVITY_MAX_LIMIT = 60;
const ADMIN_ACTIVITY_SOURCE_MULTIPLIER = 3;
const ADMIN_PRESENCE_DEFAULT_LIMIT = 60;
const ADMIN_PRESENCE_MAX_LIMIT = 100;
const ADMIN_PRESENCE_MAX_OFFSET = 50_000;
const ONLINE_WINDOW_MS = 65_000;
const ONLINE_FUTURE_TOLERANCE_MS = 10_000;

const SENSITIVE_ADMIN_ACTIONS = new Set<SensitiveAdminAction>([
  "ban-user",
  "ban-ip",
  "delete-listing",
  "delete-user"
]);

function hashApprovalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getRecentTotpTimestamp(claims: Record<string, unknown> | undefined, maxAgeSeconds = 90) {
  const amr = Array.isArray(claims?.amr) ? claims.amr : [];
  const newestTotp = amr.reduce((newest, entry) => {
    if (!entry || typeof entry !== "object") return newest;
    const value = entry as { method?: unknown; timestamp?: unknown };
    if (value.method !== "totp" || typeof value.timestamp !== "number") return newest;
    return Math.max(newest, value.timestamp);
  }, 0);

  const ageSeconds = Math.floor(Date.now() / 1000) - newestTotp;
  return newestTotp > 0 && ageSeconds >= -10 && ageSeconds <= maxAgeSeconds
    ? newestTotp
    : null;
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" && token ? token : null;
}

function getClient(key: string) {
  return createClient(supabaseUrl!, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(Math.trunc(parsed), maximum));
}

function normalizeAdminText(value: unknown, maximumLength = 180) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function normalizeIpAddress(value: unknown) {
  const candidate = normalizeAdminText(value, 80)
    .replace(/^\[|\]$/g, "")
    .replace(/^::ffff:/i, "");
  return isIP(candidate) ? candidate : null;
}

function safeActivityPath(value: unknown) {
  const raw = normalizeAdminText(value, 500);
  if (!raw) return "/";

  try {
    return new URL(raw, "https://maskines.com").pathname.slice(0, 180) || "/";
  } catch {
    return raw.startsWith("/") ? raw.slice(0, 180) : "/";
  }
}

function classifyUserAgent(value: unknown) {
  const userAgent = String(value ?? "").toLowerCase();
  if (!userAgent) return "Tuntematon laite";
  if (/bot|crawler|spider|preview/.test(userAgent)) return "Botti";
  if (/ipad|tablet/.test(userAgent)) return "Tabletti";
  if (/mobile|iphone|android/.test(userAgent)) return "Puhelin";
  return "Tietokone";
}

function normalizeIsoTimestamp(value: unknown) {
  const raw = String(value ?? "");
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function parseActivityCursor(value: unknown): ActivityCursor | null {
  if (typeof value !== "string" || !value || value.length > 500) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Partial<ActivityCursor>;
    const at = normalizeIsoTimestamp(parsed.at);
    const key = normalizeAdminText(parsed.key, 180);
    return at && key ? { at, key } : null;
  } catch {
    return null;
  }
}

function createActivityCursor(event: AdminActivityEvent) {
  return Buffer.from(
    JSON.stringify({ at: event.occurred_at, key: event.id } satisfies ActivityCursor),
    "utf8"
  ).toString("base64url");
}

function isProfileOnline(
  onlineValue: unknown,
  lastSeenValue: unknown,
  now = Date.now()
) {
  const lastSeen = Date.parse(String(lastSeenValue ?? ""));
  return (
    Boolean(onlineValue) &&
    Number.isFinite(lastSeen) &&
    lastSeen >= now - ONLINE_WINDOW_MS &&
    lastSeen <= now + ONLINE_FUTURE_TOLERANCE_MS
  );
}

function activityEvent(
  kind: AdminActivityKind,
  rowId: unknown,
  occurredAt: unknown,
  title: string,
  detail: string,
  actorId?: unknown,
  actorName?: unknown,
  ip?: unknown,
  ipSource?: "event" | "profile"
): AdminActivityEvent | null {
  const timestamp = normalizeIsoTimestamp(occurredAt);
  const idPart = normalizeAdminText(rowId, 100);
  if (!timestamp || !idPart) return null;

  return {
    id: `${kind}:${idPart}`,
    kind,
    occurred_at: timestamp,
    title: normalizeAdminText(title, 120),
    detail: normalizeAdminText(detail, 220),
    actor_id: actorId ? normalizeAdminText(actorId, 100) : null,
    actor_name: actorName ? normalizeAdminText(actorName, 120) : null,
    ip: normalizeIpAddress(ip),
    ip_source: normalizeIpAddress(ip) && ipSource ? ipSource : null
  };
}

function displayNameFromProfile(row: Record<string, unknown>) {
  return (
    normalizeAdminText(row.company_name, 120) ||
    normalizeAdminText(row.full_name, 120) ||
    [row.first_name, row.last_name]
      .map((value) => normalizeAdminText(value, 80))
      .filter(Boolean)
      .join(" ") ||
    normalizeAdminText(row.email, 120) ||
    "Tuntematon käyttäjä"
  );
}

function storageObjectFromPublicUrl(value: string, ownerId?: string | null) {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return null;

  try {
    const url = new URL(value);
    if (!supabaseUrl || url.origin !== new URL(supabaseUrl).origin) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex = parts.findIndex((part, index) =>
      part === "object" &&
      parts[index - 2] === "storage" &&
      parts[index - 1] === "v1"
    );

    if (objectIndex === -1) return null;

    const visibility = parts[objectIndex + 1];
    if (visibility !== "public" && visibility !== "sign") return null;

    const bucket = parts[objectIndex + 2];
    const path = parts
      .slice(objectIndex + 3)
      .map((part) => decodeURIComponent(part))
      .join("/");

    if (bucket !== "listing-images" || !path) return null;
    if (ownerId && path.split("/")[0] !== ownerId) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

async function deleteListingImages(admin: ReturnType<typeof getClient>, listing: {
  seller_id?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
} | null) {
  const urls = Array.from(new Set([
    listing?.image_url,
    ...(Array.isArray(listing?.image_urls) ? listing.image_urls : [])
  ].filter((value): value is string => Boolean(value))));

  const byBucket = new Map<string, string[]>();
  for (const url of urls) {
    const object = storageObjectFromPublicUrl(url, listing?.seller_id);
    if (!object) continue;
    byBucket.set(object.bucket, [...(byBucket.get(object.bucket) ?? []), object.path]);
  }

  for (const [bucket, paths] of byBucket) {
    if (paths.length) {
      await admin.storage.from(bucket).remove(paths);
    }
  }
}

async function requireAdmin(request: Request) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      error: NextResponse.json(
        { error: "Supabase admin -asetukset puuttuvat." },
        { status: 500 }
      )
    };
  }

  const token = getBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: "Kirjautuminen puuttuu." }, { status: 401 })
    };
  }

  const authClient = getClient(anonKey);
  const [{ data: userData, error: userError }, { data: claimsData, error: claimsError }] = await Promise.all([
    authClient.auth.getUser(token),
    authClient.auth.getClaims(token)
  ]);
  const userId = userData.user?.id;
  const claims = claimsData?.claims;
  const claimUserId = typeof claims?.sub === "string" ? claims.sub : null;
  const assuranceLevel = typeof claims?.aal === "string" ? claims.aal : null;
  const sessionId = typeof claims?.session_id === "string" ? claims.session_id : null;

  if (userError || claimsError || !userId || claimUserId !== userId) {
    return {
      error: NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 })
    };
  }

  if (userData.user?.email?.trim().toLowerCase() !== "matinpaja6@gmail.com") {
    return {
      error: NextResponse.json({ error: "Tällä käyttäjällä ei ole admin-oikeutta." }, { status: 403 })
    };
  }

  if (assuranceLevel !== "aal2" || !sessionId) {
    return {
      error: NextResponse.json(
        { error: "Admin-toiminto vaatii Authenticator-vahvistuksen." },
        { status: 403 }
      )
    };
  }

  const admin = getClient(serviceRoleKey);
  const { data: adminRows, error: adminError } = await admin
    .from("admin_users")
    .select("user_id,active_session_id")
    .eq("user_id", userId)
    .limit(1);

  if (adminError) {
    return {
      error: NextResponse.json(
        { error: "Adminin MFA-tietokantapäivitys puuttuu tai tarkistus epäonnistui." },
        { status: 503 }
      )
    };
  }

  if (!adminRows?.length || adminRows[0].active_session_id !== sessionId) {
    return {
      error: NextResponse.json(
        { error: "Admin-istunto ei ole aktiivinen. Vahvista kirjautuminen uudelleen." },
        { status: 403 }
      )
    };
  }

  return {
    admin,
    userId,
    sessionId,
    claims: claims as Record<string, unknown>
  };
}

async function createSensitiveApproval(
  admin: ReturnType<typeof getClient>,
  userId: string,
  sessionId: string,
  action: SensitiveAdminAction,
  totpVerifiedAt: number
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  const { error } = await admin
    .from("admin_action_approvals")
    .insert({
      admin_user_id: userId,
      session_id: sessionId,
      action,
      token_hash: hashApprovalToken(token),
      totp_verified_at: totpVerifiedAt,
      expires_at: expiresAt
    });

  if (error?.code === "23505") {
    throw new Error("Tämä Authenticator-vahvistus on jo käytetty. Anna uusi koodi.");
  }
  if (error) throw error;

  void admin
    .from("admin_action_approvals")
    .delete()
    .lt("expires_at", new Date().toISOString());

  return token;
}

async function consumeSensitiveApproval(
  admin: ReturnType<typeof getClient>,
  userId: string,
  sessionId: string,
  action: SensitiveAdminAction,
  token: string | undefined
) {
  if (!token) return false;

  const { data, error } = await admin
    .from("admin_action_approvals")
    .update({ used_at: new Date().toISOString() })
    .eq("admin_user_id", userId)
    .eq("session_id", sessionId)
    .eq("action", action)
    .eq("token_hash", hashApprovalToken(token))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return Boolean(data?.id);
}

function normalizeProfile(row: Record<string, unknown>) {
  const fullName =
    String(row.full_name ?? "").trim() ||
    String(row.name ?? "").trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
    String(row.company_name ?? "").trim() ||
    null;

  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    full_name: fullName,
    first_name: row.first_name ? String(row.first_name) : null,
    last_name: row.last_name ? String(row.last_name) : null,
    phone: row.phone ? String(row.phone) : null,
    phone_verified_at: row.phone_verified_at ? String(row.phone_verified_at) : null,
    phone_verification_count: Number(row.phone_verification_count ?? 0),
    is_banned: Boolean(row.is_banned),
    banned_reason: row.banned_reason ? String(row.banned_reason) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    last_ip: row.last_ip ? String(row.last_ip) : null,
    last_seen_ip: row.last_seen_ip ? String(row.last_seen_ip) : null,
    ip_count: Number(row.ip_count ?? 0),
    extra_phone_verifications: Number(row.extra_phone_verifications ?? 0),
    is_admin: false,
    account_type: row.account_type ? String(row.account_type) : null,
    company_name: row.company_name ? String(row.company_name) : null,
    business_id: row.business_id ? String(row.business_id) : null,
    company_verified_at: row.company_verified_at ? String(row.company_verified_at) : null,
    company_verification_requested_at: row.company_verification_requested_at ? String(row.company_verification_requested_at) : null,
    address: row.address ? String(row.address) : null,
    postal_code: row.postal_code ? String(row.postal_code) : null,
    city: row.city ? String(row.city) : null,
    country: row.country ? String(row.country) : null,
    public_id: row.public_id ? String(row.public_id) : null,
    username: row.username ? String(row.username) : null,
    bio: row.bio ? String(row.bio) : null,
    public_address: row.public_address ? String(row.public_address) : null,
    billing_email: row.billing_email ? String(row.billing_email) : null,
    company_website: row.company_website ? String(row.company_website) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
    online: Boolean(row.online),
    last_seen: row.last_seen ? String(row.last_seen) : null
  };
}

async function readActivitySource(
  admin: ReturnType<typeof getClient>,
  table: string,
  columns: string,
  timestampColumn: string,
  before: string,
  limit: number
) {
  const { data, error } = await admin
    .from(table)
    .select(columns)
    .lte(timestampColumn, before)
    .order(timestampColumn, { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  return {
    rows: error
      ? []
      : ((data ?? []) as unknown as Record<string, unknown>[]),
    failed: Boolean(error)
  };
}

async function loadAdminActivityFeed(
  admin: ReturnType<typeof getClient>,
  cursor: ActivityCursor | null,
  pageLimit: number
) {
  const before = cursor?.at ?? new Date().toISOString();
  const sourceLimit = pageLimit * ADMIN_ACTIVITY_SOURCE_MULTIPLIER;

  const [
    profiles,
    listings,
    sales,
    conversations,
    messages,
    reviews,
    searchAlerts,
    visits,
    adminDeletes
  ] = await Promise.all([
    readActivitySource(
      admin,
      "profiles",
      "id,email,full_name,first_name,last_name,company_name,last_ip,last_seen_ip,created_at",
      "created_at",
      before,
      sourceLimit
    ),
    readActivitySource(
      admin,
      "listings",
      "id,title,seller_id,seller_name,created_at",
      "created_at",
      before,
      sourceLimit
    ),
    readActivitySource(
      admin,
      "sold_listings",
      "id,title,seller_id,buyer_id,sold_price,sold_at",
      "sold_at",
      before,
      sourceLimit
    ),
    readActivitySource(
      admin,
      "conversations",
      "id,buyer_id,seller_id,listing_title,created_at",
      "created_at",
      before,
      sourceLimit
    ),
    readActivitySource(
      admin,
      "messages",
      "id,conversation_id,sender_id,receiver_id,created_at",
      "created_at",
      before,
      sourceLimit
    ),
    readActivitySource(
      admin,
      "seller_reviews",
      "id,seller_id,reviewer_id,reviewer_name,rating,created_at",
      "created_at",
      before,
      sourceLimit
    ),
    readActivitySource(
      admin,
      "search_alerts",
      "id,user_id,label,created_at",
      "created_at",
      before,
      sourceLimit
    ),
    readActivitySource(
      admin,
      "site_visits",
      "id,path,user_agent,ip,created_at",
      "created_at",
      before,
      sourceLimit
    ),
    readActivitySource(
      admin,
      "deleted_listings_log",
      "id,listing_id,deleted_by,deleted_at",
      "deleted_at",
      before,
      sourceLimit
    )
  ]);

  const candidates = [
    ...profiles.rows.map((row) =>
      activityEvent(
        "account",
        row.id,
        row.created_at,
        "Uusi käyttäjä rekisteröityi",
        normalizeAdminText(row.email, 140) || displayNameFromProfile(row),
        row.id,
        displayNameFromProfile(row),
        row.last_ip ?? row.last_seen_ip,
        "profile"
      )
    ),
    ...listings.rows.map((row) =>
      activityEvent(
        "listing",
        row.id,
        row.created_at,
        "Uusi ilmoitus julkaistiin",
        normalizeAdminText(row.title, 180) || "Nimetön ilmoitus",
        row.seller_id,
        row.seller_name
      )
    ),
    ...sales.rows.map((row) =>
      activityEvent(
        "sale",
        row.id,
        row.sold_at,
        "Ilmoitus merkittiin myydyksi",
        [
          normalizeAdminText(row.title, 150) || "Nimetön ilmoitus",
          Number.isFinite(Number(row.sold_price))
            ? `${Number(row.sold_price).toLocaleString("fi-FI")} €`
            : ""
        ].filter(Boolean).join(" · "),
        row.seller_id
      )
    ),
    ...conversations.rows.map((row) =>
      activityEvent(
        "conversation",
        row.id,
        row.created_at,
        "Uusi keskustelu aloitettiin",
        normalizeAdminText(row.listing_title, 180) || `Keskustelu ${String(row.id ?? "").slice(0, 8)}`,
        row.buyer_id
      )
    ),
    ...messages.rows.map((row) =>
      activityEvent(
        "message",
        row.id,
        row.created_at,
        "Uusi viesti lähetettiin",
        `Keskustelu ${String(row.conversation_id ?? "").slice(0, 8)} · viestin sisältöä ei näytetä`,
        row.sender_id
      )
    ),
    ...reviews.rows.map((row) =>
      activityEvent(
        "review",
        row.id,
        row.created_at,
        "Uusi arvostelu annettiin",
        `${clampInteger(row.rating, 0, 0, 5)}/5`,
        row.reviewer_id,
        row.reviewer_name
      )
    ),
    ...searchAlerts.rows.map((row) =>
      activityEvent(
        "search-alert",
        row.id,
        row.created_at,
        "Uusi hakuvahti luotiin",
        normalizeAdminText(row.label, 180) || "Nimetön hakuvahti",
        row.user_id
      )
    ),
    ...visits.rows.map((row) =>
      activityEvent(
        "visit",
        row.id,
        row.created_at,
        "Sivulla vierailtiin",
        `${safeActivityPath(row.path)} · ${classifyUserAgent(row.user_agent)}`,
        undefined,
        undefined,
        row.ip,
        "event"
      )
    ),
    ...adminDeletes.rows.map((row) =>
      activityEvent(
        "admin",
        row.id,
        row.deleted_at,
        "Admin poisti ilmoituksen",
        [
          row.listing_id
            ? `Ilmoitus ${String(row.listing_id).slice(0, 8)}`
            : "Tuntematon ilmoitus"
        ].filter(Boolean).join(" · "),
        row.deleted_by
      )
    )
  ]
    .filter((event): event is AdminActivityEvent => Boolean(event))
    .sort((left, right) => {
      const timeDifference =
        Date.parse(right.occurred_at) - Date.parse(left.occurred_at);
      return timeDifference || right.id.localeCompare(left.id);
    })
    .filter((event) => {
      if (!cursor) return true;
      if (event.occurred_at < cursor.at) return true;
      return event.occurred_at === cursor.at && event.id < cursor.key;
    });

  const page = candidates.slice(0, pageLimit);
  const actorIds = Array.from(
    new Set(
      page
        .map((event) => event.actor_id)
        .filter((value): value is string => Boolean(value))
    )
  );
  const profileNames = new Map<string, string>();
  const profileIps = new Map<string, string>();

  if (actorIds.length) {
    const { data } = await admin
      .from("profiles")
      .select("id,email,full_name,first_name,last_name,company_name,last_ip,last_seen_ip")
      .in("id", actorIds);

    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const profileId = String(row.id);
      profileNames.set(profileId, displayNameFromProfile(row));
      const profileIp = normalizeIpAddress(row.last_ip ?? row.last_seen_ip);
      if (profileIp) profileIps.set(profileId, profileIp);
    }
  }

  const enrichedPage = page.map((event) => {
    const profileIp = event.actor_id
      ? profileIps.get(event.actor_id) ?? null
      : null;

    return {
      ...event,
      actor_name:
        event.actor_name ||
        (event.actor_id ? profileNames.get(event.actor_id) ?? null : null),
      ip: event.ip || profileIp,
      ip_source: event.ip
        ? event.ip_source
        : profileIp
          ? "profile" as const
          : null
    };
  });
  const lastEvent = enrichedPage.at(-1);

  return {
    events: enrichedPage,
    nextCursor:
      candidates.length > pageLimit && lastEvent
        ? createActivityCursor(lastEvent)
        : null,
    hasMore: candidates.length > pageLimit,
    partial: [
      profiles,
      listings,
      sales,
      conversations,
      messages,
      reviews,
      searchAlerts,
      visits,
      adminDeletes
    ].some((source) => source.failed)
  };
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json().catch(() => ({})) as AdminActionBody;
    const { admin, userId, sessionId, claims } = guard;

    if (body.action === "authorize-sensitive") {
      if (!body.sensitiveAction || !SENSITIVE_ADMIN_ACTIONS.has(body.sensitiveAction)) {
        return NextResponse.json({ error: "Virheellinen suojattu toiminto." }, { status: 400 });
      }

      const totpVerifiedAt = getRecentTotpTimestamp(claims);
      if (!totpVerifiedAt) {
        return NextResponse.json(
          { error: "Anna uusi Authenticator-koodi ennen toimintoa." },
          { status: 403 }
        );
      }

      const approvalToken = await createSensitiveApproval(
        admin,
        userId,
        sessionId,
        body.sensitiveAction,
        totpVerifiedAt
      );
      return NextResponse.json({ approvalToken, expiresIn: 120 });
    }

    if (SENSITIVE_ADMIN_ACTIONS.has(body.action as SensitiveAdminAction)) {
      const allowed = await consumeSensitiveApproval(
        admin,
        userId,
        sessionId,
        body.action as SensitiveAdminAction,
        "approvalToken" in body ? body.approvalToken : undefined
      );

      if (!allowed) {
        return NextResponse.json(
          { error: "Authenticator-vahvistus puuttuu, vanheni tai on jo käytetty." },
          { status: 403 }
        );
      }
    }

    if (body.action === "activity-feed") {
      const cursor = body.cursor ? parseActivityCursor(body.cursor) : null;
      if (body.cursor && !cursor) {
        return NextResponse.json(
          { error: "Virheellinen tapahtumalokin jatkotunniste." },
          { status: 400 }
        );
      }

      const limit = clampInteger(
        body.limit,
        ADMIN_ACTIVITY_DEFAULT_LIMIT,
        1,
        ADMIN_ACTIVITY_MAX_LIMIT
      );
      const data = await loadAdminActivityFeed(admin, cursor, limit);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "private, no-store, max-age=0" }
      });
    }

    if (body.action === "presence-summary") {
      const now = Date.now();
      const cutoff = new Date(now - ONLINE_WINDOW_MS).toISOString();
      const futureLimit = new Date(now + ONLINE_FUTURE_TOLERANCE_MS).toISOString();
      const [totalResult, onlineResult] = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("online", true)
          .gte("last_seen", cutoff)
          .lte("last_seen", futureLimit)
      ]);

      if (totalResult.error || onlineResult.error) {
        throw totalResult.error ?? onlineResult.error;
      }

      return NextResponse.json(
        {
          onlineCount: onlineResult.count ?? 0,
          totalRegistered: totalResult.count ?? 0,
          onlineWindowSeconds: Math.round(ONLINE_WINDOW_MS / 1000),
          updatedAt: new Date(now).toISOString()
        },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    if (body.action === "presence-page") {
      const limit = clampInteger(
        body.limit,
        ADMIN_PRESENCE_DEFAULT_LIMIT,
        1,
        ADMIN_PRESENCE_MAX_LIMIT
      );
      const offset = clampInteger(
        body.offset,
        0,
        0,
        ADMIN_PRESENCE_MAX_OFFSET
      );
      const { data, count, error } = await admin
        .from("profiles")
        .select(
          "id,email,full_name,first_name,last_name,company_name,account_type,online,last_seen,created_at",
          { count: "exact" }
        )
        .order("last_seen", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const now = Date.now();
      const users = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id ?? ""),
        email: normalizeAdminText(row.email, 160),
        displayName: displayNameFromProfile(row),
        accountType: normalizeAdminText(row.account_type, 40) || "private",
        online: isProfileOnline(row.online, row.last_seen, now),
        lastSeen: normalizeIsoTimestamp(row.last_seen),
        createdAt: normalizeIsoTimestamp(row.created_at)
      }));
      const total = count ?? offset + users.length;
      const nextOffset = offset + users.length;

      return NextResponse.json(
        {
          users,
          total,
          nextOffset: nextOffset < total ? nextOffset : null,
          hasMore: nextOffset < total
        },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    if (body.action === "ban-user") {
      if (!body.userId) {
        return NextResponse.json({ error: "Käyttäjä puuttuu." }, { status: 400 });
      }

      const { data: protectedAdmin } = await admin
        .from("admin_users")
        .select("user_id")
        .eq("user_id", body.userId)
        .maybeSingle<{ user_id: string }>();
      if (protectedAdmin?.user_id) {
        return NextResponse.json(
          { error: "Admin-käyttäjää ei voi bannata tästä paneelista." },
          { status: 403 }
        );
      }

      const { error } = await admin
        .from("profiles")
        .update({
          is_banned: true,
          banned_reason: body.reason ?? null
        })
        .eq("id", body.userId);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "unban-user") {
      if (!body.userId) {
        return NextResponse.json({ error: "Käyttäjä puuttuu." }, { status: 400 });
      }

      const { error } = await admin
        .from("profiles")
        .update({
          is_banned: false,
          banned_reason: null
        })
        .eq("id", body.userId);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "ban-ip") {
      const ip = normalizeIpAddress(body.ip);
      if (!ip) {
        return NextResponse.json({ error: "Virheellinen IP-osoite." }, { status: 400 });
      }

      const { data: storedBan, error } = await admin
        .from("banned_ips")
        .upsert({
          ip,
          reason: body.reason ?? null,
          banned_by: userId,
          banned_at: new Date().toISOString()
        }, { onConflict: "ip" })
        .select("ip")
        .maybeSingle<{ ip: string }>();

      if (error) throw error;
      if (normalizeIpAddress(storedBan?.ip) !== ip) {
        throw new Error("IP-bannin tallennuksen varmistus epäonnistui.");
      }
      return NextResponse.json({ ok: true, ip });
    }

    if (body.action === "unban-ip") {
      const ip = normalizeIpAddress(body.ip);
      if (!ip) {
        return NextResponse.json({ error: "Virheellinen IP-osoite." }, { status: 400 });
      }

      const { error } = await admin
        .from("banned_ips")
        .delete()
        .eq("ip", ip);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "list-banned-ips") {
      const { data, error } = await admin
        .from("banned_ips")
        .select("ip, reason, banned_at, banned_by")
        .order("banned_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ data: data ?? [] });
    }

    if (body.action === "list-profiles") {
      const limit = Math.max(1, Math.min(Number(body.limit ?? 300), 300));
      const offset = Math.max(0, Number(body.offset ?? 0));
      const search = (body.query ?? "").trim().toLowerCase();

      const { data: adminRows } = await admin
        .from("admin_users")
        .select("user_id");
      const adminIds = new Set((adminRows ?? []).map((row) => String(row.user_id)));

      const { data, error } = await admin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const rows = (data ?? [])
        .map((row) => {
          const profile = normalizeProfile(row as Record<string, unknown>);
          return { ...profile, is_admin: adminIds.has(profile.id) };
        })
        .filter((profile) => {
          if (!search) return true;
          return [
            profile.email,
            profile.full_name,
            profile.first_name,
            profile.last_name,
            profile.phone,
            profile.company_name,
            profile.business_id,
            profile.last_ip,
            profile.last_seen_ip,
            profile.city,
            profile.public_id
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search);
        });

      return NextResponse.json({ data: rows });
    }

    if (body.action === "delete-user") {
      if (!body.userId) {
        return NextResponse.json({ error: "Käyttäjä puuttuu." }, { status: 400 });
      }
      if (body.userId === userId) {
        return NextResponse.json({ error: "Et voi poistaa omaa admin-tiliäsi." }, { status: 400 });
      }

      const { data: protectedAdmin } = await admin
        .from("admin_users")
        .select("user_id")
        .eq("user_id", body.userId)
        .maybeSingle<{ user_id: string }>();
      if (protectedAdmin?.user_id) {
        return NextResponse.json({ error: "Toista admin-käyttäjää ei voi poistaa tästä paneelista." }, { status: 403 });
      }

      const { error } = await admin.auth.admin.deleteUser(body.userId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete-listing") {
      if (!body.listingId) {
        return NextResponse.json({ error: "Ilmoitus puuttuu." }, { status: 400 });
      }

      const { data: listing, error: listingError } = await admin
        .from("listings")
        .select("seller_id,image_url,image_urls")
        .eq("id", body.listingId)
        .maybeSingle<{
          seller_id: string;
          image_url: string | null;
          image_urls: string[] | null;
        }>();

      if (listingError) throw listingError;

      let logResult = await admin
        .from("deleted_listings_log")
        .insert({
          listing_id: body.listingId,
          deleted_by: userId,
          reason: body.reason ?? null
        });

      if (
        logResult.error?.code === "42703" &&
        logResult.error.message.includes("reason")
      ) {
        logResult = await admin
          .from("deleted_listings_log")
          .insert({
            listing_id: body.listingId,
            deleted_by: userId
          });
      }

      if (logResult.error) throw logResult.error;

      const { error } = await admin
        .from("listings")
        .delete()
        .eq("id", body.listingId);

      if (error) throw error;

      await deleteListingImages(admin, listing ?? null);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Tuntematon admin-toiminto." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin-toiminto epäonnistui." },
      { status: 500 }
    );
  }
}
