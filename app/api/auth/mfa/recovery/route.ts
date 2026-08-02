import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const RECOVERY_COOKIE = "maskines_mfa_recovery";
const RECOVERY_MAX_AGE_SECONDS = 10 * 60;

type RecoveryAction = "start" | "complete";
type RecoveryIntent = {
  userId: string;
  email: string;
  expiresAt: number;
  nonce: string;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function getRecoverySecret() {
  const secret =
    process.env.MFA_RECOVERY_SECRET ||
    process.env.LOGIN_RATE_LIMIT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("MFA recovery secret is missing.");
  return secret;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getAmrMethods(token: string) {
  const payload = decodeJwtPayload(token);
  if (!payload || !Array.isArray(payload.amr)) return [];
  return payload.amr
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const method = (entry as { method?: unknown }).method;
      return typeof method === "string" ? method.toLowerCase() : "";
    })
    .filter(Boolean);
}

function createIntentToken(intent: RecoveryIntent) {
  const encoded = Buffer.from(JSON.stringify(intent)).toString("base64url");
  const signature = createHmac("sha256", getRecoverySecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function readIntentToken(token: string): RecoveryIntent | null {
  try {
    const [encoded, suppliedSignature] = token.split(".");
    if (!encoded || !suppliedSignature) return null;
    const expectedSignature = createHmac("sha256", getRecoverySecret()).update(encoded).digest("base64url");
    const supplied = Buffer.from(suppliedSignature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

    const intent = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as RecoveryIntent;
    if (
      !intent ||
      typeof intent.userId !== "string" ||
      typeof intent.email !== "string" ||
      typeof intent.expiresAt !== "number" ||
      intent.expiresAt < Date.now()
    ) {
      return null;
    }
    return intent;
  } catch {
    return null;
  }
}

function clearRecoveryCookie(response: NextResponse) {
  response.cookies.set(RECOVERY_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/mfa/recovery",
    maxAge: 0
  });
}

export async function POST(request: NextRequest) {
  let action: RecoveryAction | null = null;
  try {
    const payload = (await request.json()) as { action?: unknown };
    action = payload.action === "start" || payload.action === "complete" ? payload.action : null;
  } catch {
    action = null;
  }

  if (!action) {
    return NextResponse.json({ error: "Palautuspyyntö on virheellinen." }, { status: 400 });
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 });
  }

  let admin: ReturnType<typeof getSupabaseAdmin>;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Palautuspalvelun asetukset puuttuvat." }, { status: 500 });
  }

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  const user = userData.user;
  if (userError || !user || !user.email || !user.email_confirmed_at) {
    return NextResponse.json({ error: "Kirjautuminen tai sähköposti ei ole vahvistettu." }, { status: 401 });
  }

  const methods = getAmrMethods(accessToken);
  const { data: factorData, error: factorError } = await admin.auth.admin.mfa.listFactors({
    userId: user.id
  });
  if (factorError) {
    return NextResponse.json({ error: "Authenticator-tietoja ei voitu tarkistaa." }, { status: 503 });
  }
  const verifiedTotpFactors = factorData.factors.filter(
    (factor) =>
      factor.factor_type === "totp" &&
      factor.status === "verified" &&
      factor.friendly_name !== "Maskines Admin"
  );

  if (action === "start") {
    const hasFirstFactor = methods.some((method) => method !== "otp" && method !== "totp");
    if (!hasFirstFactor) {
      return NextResponse.json({ error: "Anna ensin tilisi salasana." }, { status: 403 });
    }
    if (verifiedTotpFactors.length === 0) {
      return NextResponse.json({ error: "Tilillä ei ole aktiivista Authenticatoria." }, { status: 409 });
    }

    const intent = createIntentToken({
      userId: user.id,
      email: user.email.toLowerCase(),
      expiresAt: Date.now() + RECOVERY_MAX_AGE_SECONDS * 1000,
      nonce: randomUUID()
    });
    const response = NextResponse.json({ ok: true, email: user.email });
    response.cookies.set(RECOVERY_COOKIE, intent, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth/mfa/recovery",
      maxAge: RECOVERY_MAX_AGE_SECONDS
    });
    return response;
  }

  const intent = readIntentToken(request.cookies.get(RECOVERY_COOKIE)?.value ?? "");
  const hasEmailOtp = methods.includes("otp");
  if (
    !intent ||
    !hasEmailOtp ||
    intent.userId !== user.id ||
    intent.email !== user.email.toLowerCase()
  ) {
    const response = NextResponse.json(
      { error: "Palautus on vanhentunut. Aloita uudelleen salasanalla." },
      { status: 403 }
    );
    clearRecoveryCookie(response);
    return response;
  }

  if (verifiedTotpFactors.length === 0) {
    const response = NextResponse.json({ error: "Authenticator on jo poistettu." }, { status: 409 });
    clearRecoveryCookie(response);
    return response;
  }

  for (const factor of verifiedTotpFactors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id });
    if (error) {
      return NextResponse.json({ error: "Authenticatorin poistaminen epäonnistui." }, { status: 503 });
    }
  }

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      email_mfa_enabled: false
    }
  });

  const response = NextResponse.json({ ok: true, removedFactors: verifiedTotpFactors.length });
  clearRecoveryCookie(response);
  return response;
}
