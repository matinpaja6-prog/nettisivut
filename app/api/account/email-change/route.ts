import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAuthEmail, normalizeAuthEmailLocale } from "@/lib/auth-email";
import { claimAuthEmailCooldown, releaseAuthEmailCooldown } from "@/lib/auth-email-rate-limit";
import { sendAuthEmail } from "@/lib/auth-email-sender";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type EmailChangePayload = {
  action?: unknown;
  email?: unknown;
  code?: unknown;
  challenge?: unknown;
  locale?: unknown;
};

const CHALLENGE_SECONDS = 15 * 60;

function challengeSecret() {
  const secret =
    process.env.AUTH_EMAIL_CHALLENGE_SECRET ||
    process.env.LOGIN_RATE_LIMIT_SECRET ||
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Email change challenge secret is missing.");
  return secret;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function hashCode(code: string, userId: string, email: string) {
  return createHmac("sha256", challengeSecret())
    .update(`${userId}:${email}:${code}`)
    .digest("base64url");
}

function createChallenge(userId: string, email: string, code: string) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    email,
    codeHash: hashCode(code, userId, email),
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_SECONDS
  })).toString("base64url");
  const signature = createHmac("sha256", challengeSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readChallenge(challenge: string) {
  const [payload, suppliedSignature] = challenge.split(".");
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = createHmac("sha256", challengeSecret()).update(payload).digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      email?: unknown;
      codeHash?: unknown;
      exp?: unknown;
    };
    if (
      typeof value.userId !== "string" ||
      typeof value.email !== "string" ||
      typeof value.codeHash !== "string" ||
      typeof value.exp !== "number" ||
      value.exp < Math.floor(Date.now() / 1000)
    ) return null;
    return value as { userId: string; email: string; codeHash: string; exp: number };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let payload: EmailChangePayload;
  try {
    payload = await request.json() as EmailChangePayload;
  } catch {
    return NextResponse.json({ error: "Pyyntö on virheellinen." }, { status: 400 });
  }

  const token = bearerToken(request);
  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = token
    ? await admin.auth.getUser(token)
    : { data: { user: null }, error: null };
  const user = authData.user;
  if (authError || !user) {
    return NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 });
  }

  const action = payload.action === "verify" ? "verify" : "request";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 180) {
    return NextResponse.json({ error: "Anna kelvollinen sähköpostiosoite." }, { status: 400 });
  }
  if (user.email?.toLowerCase() === email) {
    return NextResponse.json({ error: "Uusi sähköpostiosoite on sama kuin nykyinen." }, { status: 400 });
  }

  if (action === "request") {
    const locale = normalizeAuthEmailLocale(payload.locale);
    const userCooldown = claimAuthEmailCooldown(`email-change-${user.id}@maskines.internal`);
    if (!userCooldown.allowed) {
      return NextResponse.json(
        { error: `Uuden koodin voi lähettää kerran minuutissa. Odota vielä ${userCooldown.retryAfterSeconds} sekuntia.` },
        { status: 429, headers: { "Retry-After": String(userCooldown.retryAfterSeconds) } }
      );
    }
    const cooldown = claimAuthEmailCooldown(email);
    if (!cooldown.allowed) {
      releaseAuthEmailCooldown(userCooldown.lease);
      return NextResponse.json(
        { error: `Uuden koodin voi lähettää kerran minuutissa. Odota vielä ${cooldown.retryAfterSeconds} sekuntia.` },
        { status: 429, headers: { "Retry-After": String(cooldown.retryAfterSeconds) } }
      );
    }

    try {
      const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      await sendAuthEmail({ to: email, ...createAuthEmail({ kind: "email-change", locale, code }) });
      return NextResponse.json({ ok: true, challenge: createChallenge(user.id, email, code) });
    } catch (error) {
      releaseAuthEmailCooldown(cooldown.lease);
      releaseAuthEmailCooldown(userCooldown.lease);
      console.error("Email change code delivery failed:", error);
      return NextResponse.json({ error: "Vahvistuskoodin lähettäminen epäonnistui." }, { status: 503 });
    }
  }

  const challenge = typeof payload.challenge === "string" ? readChallenge(payload.challenge) : null;
  const code = typeof payload.code === "string" ? payload.code.replace(/\D/g, "").slice(0, 6) : "";
  if (!challenge || challenge.userId !== user.id || challenge.email !== email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Vahvistuskoodi on virheellinen tai vanhentunut." }, { status: 400 });
  }

  const suppliedHash = Buffer.from(hashCode(code, user.id, email));
  const expectedHash = Buffer.from(challenge.codeHash);
  if (suppliedHash.length !== expectedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) {
    return NextResponse.json({ error: "Vahvistuskoodi on virheellinen tai vanhentunut." }, { status: 400 });
  }

  const oldEmail = user.email ?? "";
  const { error: updateAuthError } = await admin.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true
  });
  if (updateAuthError) {
    return NextResponse.json({ error: "Sähköpostiosoite on jo käytössä tai sitä ei voitu vaihtaa." }, { status: 409 });
  }

  const { error: updateProfileError } = await admin.from("profiles").update({ email }).eq("id", user.id);
  if (updateProfileError) {
    if (oldEmail) {
      await admin.auth.admin.updateUserById(user.id, { email: oldEmail, email_confirm: true });
    }
    console.error("Profile email synchronization failed:", updateProfileError);
    return NextResponse.json({ error: "Sähköpostin tallentaminen epäonnistui." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email });
}
