import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAuthEmail, normalizeAuthEmailLocale } from "@/lib/auth-email";
import {
  claimAuthEmailCooldown,
  releaseAuthEmailCooldown,
  type AuthEmailCooldownLease
} from "@/lib/auth-email-rate-limit";
import { sendAuthEmail } from "@/lib/auth-email-sender";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RequestKind = "registration" | "login" | "password-reset";

type RequestPayload = {
  kind?: unknown;
  email?: unknown;
  locale?: unknown;
  metadata?: unknown;
  redirectTo?: unknown;
  challenge?: unknown;
};

const CHALLENGE_LIFETIME_SECONDS = 15 * 60;

function emailChallengeSecret() {
  const secret =
    process.env.AUTH_EMAIL_CHALLENGE_SECRET ||
    process.env.LOGIN_RATE_LIMIT_SECRET ||
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Auth email challenge secret is missing.");
  return secret;
}

function createChallenge(email: string) {
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_LIFETIME_SECONDS
  })).toString("base64url");
  const signature = createHmac("sha256", emailChallengeSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function emailFromChallenge(challenge: string) {
  const [payload, suppliedSignature] = challenge.split(".");
  if (!payload || !suppliedSignature) return "";
  const expectedSignature = createHmac("sha256", emailChallengeSecret()).update(payload).digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return "";

  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
      exp?: unknown;
    };
    return typeof value.email === "string" &&
      typeof value.exp === "number" &&
      value.exp >= Math.floor(Date.now() / 1000)
      ? value.email
      : "";
  } catch {
    return "";
  }
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 30)
      .filter(([key, item]) => /^[a-z0-9_]{1,50}$/i.test(key) && typeof item === "string")
      .map(([key, item]) => [key, (item as string).slice(0, 500)])
  );
}

function safeRedirectTo(request: Request, value: unknown) {
  if (typeof value !== "string" || value.length > 500) return undefined;
  try {
    const redirect = new URL(value);
    const requestOrigin = new URL(request.url).origin;
    const allowedOrigins = new Set([
      requestOrigin,
      "https://maskines.com",
      "https://www.maskines.com"
    ]);
    return allowedOrigins.has(redirect.origin) ? redirect.toString() : undefined;
  } catch {
    return undefined;
  }
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function cooldownMessage(locale: ReturnType<typeof normalizeAuthEmailLocale>, seconds: number) {
  return {
    fi: `Uuden sähköpostin voi lähettää kerran minuutissa. Odota vielä ${seconds} sekuntia.`,
    en: `A new email can be sent once per minute. Wait another ${seconds} seconds.`,
    sv: `Ett nytt e-postmeddelande kan skickas en gång per minut. Vänta ${seconds} sekunder till.`,
    no: `En ny e-post kan sendes én gang per minutt. Vent ${seconds} sekunder til.`
  }[locale];
}

function cooldownResponse(locale: ReturnType<typeof normalizeAuthEmailLocale>, seconds: number) {
  return NextResponse.json(
    { error: cooldownMessage(locale, seconds), retryAfter: seconds },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );
}

export async function POST(request: Request) {
  let payload: RequestPayload;
  try {
    payload = await request.json() as RequestPayload;
  } catch {
    return NextResponse.json({ error: "Pyyntö on virheellinen." }, { status: 400 });
  }

  const kind = payload.kind as RequestKind;
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!(["registration", "login", "password-reset"] as RequestKind[]).includes(kind) ||
      !/^\S+@\S+\.\S+$/.test(email) || email.length > 180) {
    return NextResponse.json({ error: "Sähköpostiosoite tai viestityyppi on virheellinen." }, { status: 400 });
  }

  const locale = normalizeAuthEmailLocale(payload.locale);
  const admin = getSupabaseAdmin();
  let cooldownLease: AuthEmailCooldownLease | undefined;

  try {
    if (kind === "login") {
      const challenge = typeof payload.challenge === "string" ? payload.challenge : "";
      const challengeEmail = challenge ? emailFromChallenge(challenge) : "";

      if (challengeEmail !== email) {
        const token = bearerToken(request);
        const { data, error } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: null };
        if (error || !data.user?.email || data.user.email.toLowerCase() !== email || !data.user.email_confirmed_at) {
          return NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 });
        }
      }

      const cooldown = claimAuthEmailCooldown(email);
      if (!cooldown.allowed) return cooldownResponse(locale, cooldown.retryAfterSeconds);
      cooldownLease = cooldown.lease;

      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const code = data?.properties?.email_otp;
      if (error || !code) throw error ?? new Error("Login code generation failed.");
      await sendAuthEmail({ to: email, ...createAuthEmail({ kind, locale, code }) });
      return NextResponse.json({ ok: true, challenge: createChallenge(email) });
    }

    if (kind === "registration") {
      const cooldown = claimAuthEmailCooldown(email);
      if (!cooldown.allowed) return cooldownResponse(locale, cooldown.retryAfterSeconds);
      cooldownLease = cooldown.lease;
      const metadata = safeMetadata(payload.metadata);
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          data: metadata,
          ...(safeRedirectTo(request, payload.redirectTo) ? { redirectTo: safeRedirectTo(request, payload.redirectTo) } : {})
        }
      });
      const code = data?.properties?.email_otp;
      if (error || !code) throw error ?? new Error("Registration code generation failed.");
      if (data.user.email_confirmed_at) {
        releaseAuthEmailCooldown(cooldownLease);
        return NextResponse.json({ error: "Tällä sähköpostiosoitteella on jo käyttäjätili." }, { status: 409 });
      }
      await sendAuthEmail({ to: email, ...createAuthEmail({ kind, locale, code }) });
      return NextResponse.json({ ok: true });
    }

    const cooldown = claimAuthEmailCooldown(email);
    if (!cooldown.allowed) return cooldownResponse(locale, cooldown.retryAfterSeconds);
    cooldownLease = cooldown.lease;
    const redirectTo = safeRedirectTo(request, payload.redirectTo);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      ...(redirectTo ? { options: { redirectTo } } : {})
    });

    // Password recovery must not reveal whether an address has an account.
    if (!error && data?.properties?.action_link) {
      await sendAuthEmail({
        to: email,
        ...createAuthEmail({
          kind,
          locale,
          actionUrl: data.properties.action_link
        })
      });
    } else if (error) {
      console.warn("Password reset link was not generated:", error.message);
      releaseAuthEmailCooldown(cooldownLease);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    releaseAuthEmailCooldown(cooldownLease);
    console.error(`Auth email request failed (${kind}):`, error);
    return NextResponse.json(
      { error: "Sähköpostin lähettäminen epäonnistui. Yritä hetken kuluttua uudelleen." },
      { status: 503 }
    );
  }
}
