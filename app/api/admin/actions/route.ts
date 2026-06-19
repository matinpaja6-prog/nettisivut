import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

type AdminActionBody =
  | { action: "ban-user"; userId?: string; reason?: string | null }
  | { action: "unban-user"; userId?: string }
  | { action: "ban-ip"; ip?: string; reason?: string | null }
  | { action: "unban-ip"; ip?: string }
  | { action: "delete-listing"; listingId?: string; reason?: string | null }
  | { action: "list-profiles"; query?: string; limit?: number; offset?: number }
  | { action: "list-banned-ips" }
  | { action: "list-listing-feedback" };

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

function storageObjectFromPublicUrl(value: string) {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return null;

  try {
    const url = new URL(value);
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

    return bucket && path ? { bucket, path } : null;
  } catch {
    return null;
  }
}

async function deleteListingImages(admin: ReturnType<typeof getClient>, listing: {
  image_url?: string | null;
  image_urls?: string[] | null;
} | null) {
  const urls = Array.from(new Set([
    listing?.image_url,
    ...(Array.isArray(listing?.image_urls) ? listing.image_urls : [])
  ].filter((value): value is string => Boolean(value))));

  const byBucket = new Map<string, string[]>();
  for (const url of urls) {
    const object = storageObjectFromPublicUrl(url);
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
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const userId = userData.user?.id;

  if (userError || !userId) {
    return {
      error: NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 })
    };
  }

  const admin = getClient(serviceRoleKey);
  const { data: adminRows, error: adminError } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1);

  if (adminError || !adminRows?.length) {
    return {
      error: NextResponse.json({ error: "Vain admin saa tehdä tämän." }, { status: 403 })
    };
  }

  return { admin, userId };
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
    points: Number(row.points ?? 0),
    created_at: row.created_at ? String(row.created_at) : null,
    last_ip: row.last_ip ? String(row.last_ip) : null,
    last_seen_ip: row.last_seen_ip ? String(row.last_seen_ip) : null,
    ip_count: Number(row.ip_count ?? 0),
    extra_phone_verifications: Number(row.extra_phone_verifications ?? 0),
    extra_listing_slots: Number(row.extra_listing_slots ?? 0),
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
    birth_date: row.birth_date ? String(row.birth_date) : null,
    public_id: row.public_id ? String(row.public_id) : null,
    username: row.username ? String(row.username) : null,
    bio: row.bio ? String(row.bio) : null,
    public_address: row.public_address ? String(row.public_address) : null,
    billing_email: row.billing_email ? String(row.billing_email) : null,
    company_website: row.company_website ? String(row.company_website) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null
  };
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json().catch(() => ({})) as AdminActionBody;
    const { admin, userId } = guard;

    if (body.action === "ban-user") {
      if (!body.userId) {
        return NextResponse.json({ error: "Käyttäjä puuttuu." }, { status: 400 });
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
      const ip = body.ip?.trim();
      if (!ip) {
        return NextResponse.json({ error: "IP-osoite puuttuu." }, { status: 400 });
      }

      const { error } = await admin
        .from("banned_ips")
        .upsert({
          ip,
          reason: body.reason ?? null,
          banned_by: userId,
          banned_at: new Date().toISOString()
        }, { onConflict: "ip" });

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "unban-ip") {
      const ip = body.ip?.trim();
      if (!ip) {
        return NextResponse.json({ error: "IP-osoite puuttuu." }, { status: 400 });
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

    if (body.action === "list-listing-feedback") {
      const { data, error } = await admin
        .from("listing_creation_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const feedbackRows = data ?? [];
      const userIds = Array.from(new Set(feedbackRows.map((row) => String(row.user_id)).filter(Boolean)));
      const listingIds = Array.from(new Set(feedbackRows.map((row) => String(row.listing_id ?? "")).filter(Boolean)));

      const { data: profiles } = userIds.length
        ? await admin
            .from("profiles")
            .select("id,email,full_name,name,first_name,last_name,company_name")
            .in("id", userIds)
        : { data: [] };

      const { data: listings } = listingIds.length
        ? await admin
            .from("listings")
            .select("id,title")
            .in("id", listingIds)
        : { data: [] };

      const profileById = new Map(
        (profiles ?? []).map((profile) => {
          const name =
            String(profile.full_name ?? "").trim() ||
            String(profile.name ?? "").trim() ||
            [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
            String(profile.company_name ?? "").trim() ||
            null;

          return [
            String(profile.id),
            {
              name,
              email: profile.email ? String(profile.email) : null
            }
          ];
        })
      );
      const listingById = new Map((listings ?? []).map((listing) => [String(listing.id), String(listing.title ?? "")]));

      return NextResponse.json({
        data: feedbackRows.map((row) => {
          const profile = profileById.get(String(row.user_id));
          const listingId = row.listing_id ? String(row.listing_id) : "";

          return {
            ...row,
            user_name: profile?.name ?? null,
            user_email: profile?.email ?? null,
            listing_title: listingId ? listingById.get(listingId) ?? null : null
          };
        })
      });
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

    if (body.action === "delete-listing") {
      if (!body.listingId) {
        return NextResponse.json({ error: "Ilmoitus puuttuu." }, { status: 400 });
      }

      const { data: listing, error: listingError } = await admin
        .from("listings")
        .select("image_url,image_urls")
        .eq("id", body.listingId)
        .maybeSingle<{ image_url: string | null; image_urls: string[] | null }>();

      if (listingError) throw listingError;

      const logResult = await admin
        .from("deleted_listings_log")
        .insert({
          listing_id: body.listingId,
          deleted_by: userId,
          reason: body.reason ?? null
        });
      void logResult;

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
