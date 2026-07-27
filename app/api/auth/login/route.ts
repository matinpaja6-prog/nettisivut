import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyTurnstile } from "@/lib/turnstile-server";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
  captchaToken?: unknown;
};

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

function hashIdentifier(type: "email" | "ip", value: string) {
  const serverSecret =
    process.env.LOGIN_RATE_LIMIT_SECRET ||
    process.env.TURNSTILE_SECRET_KEY;
  if (!serverSecret) throw new Error("Login rate-limit secret is missing.");
  return createHash("sha256")
    .update(`${serverSecret}:${type}:${value}`)
    .digest("hex");
}

export async function POST(request: Request) {
  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: "Kirjautumistiedot ovat virheelliset." }, { status: 400 });
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!email || email.length > 180 || password.length < 6 || password.length > 256) {
    return NextResponse.json({ error: "Sähköposti tai salasana on virheellinen." }, { status: 400 });
  }

  let admin: ReturnType<typeof getSupabaseAdmin>;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Kirjautumissuojauksen asetukset puuttuvat." }, { status: 500 });
  }

  let emailIdentifier: string;
  let ipIdentifier = "";
  try {
    emailIdentifier = hashIdentifier("email", email);
    const clientIp = getClientIp(request);
    ipIdentifier = clientIp ? hashIdentifier("ip", clientIp) : "";
  } catch {
    return NextResponse.json({ error: "Kirjautumissuojauksen salausavain puuttuu." }, { status: 500 });
  }
  const identifiers = [emailIdentifier, ipIdentifier].filter(Boolean);
  const limitChecks = await Promise.all(
    identifiers.map((identifier) =>
      admin.rpc("is_login_rate_limited", { identifier })
    )
  );
  if (limitChecks.some(({ error }) => error)) {
    return NextResponse.json(
      { error: "Kirjautumissuojaus pitää asentaa Supabasen SQL Editorissa." },
      { status: 503 }
    );
  }
  if (limitChecks.some(({ data }) => data === true)) {
    return NextResponse.json(
      { error: "Liian monta kirjautumisyritystä. Odota 15 minuuttia ja yritä uudelleen." },
      { status: 429 }
    );
  }

  const turnstile = await verifyTurnstile(request, payload.captchaToken, "login");
  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.error }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Kirjautumispalvelun asetukset puuttuvat." }, { status: 500 });
  }

  const auth = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    const rateLimited =
      error?.status === 429 ||
      error?.message.toLowerCase().includes("maximum number of password") ||
      error?.message.toLowerCase().includes("too many");
    const failureResults = await Promise.all([
      admin.rpc("record_login_failure", {
        identifier: emailIdentifier,
        maximum_attempts: 5
      }),
      ...(ipIdentifier
        ? [admin.rpc("record_login_failure", {
            identifier: ipIdentifier,
            maximum_attempts: 20
          })]
        : [])
    ]);
    const customLimitReached = failureResults.some(({ data }) => data === true);
    return NextResponse.json(
      {
        error: rateLimited || customLimitReached
          ? "Liian monta kirjautumisyritystä. Odota 15 minuuttia ja yritä uudelleen."
          : "Sähköposti tai salasana on virheellinen."
      },
      { status: rateLimited || customLimitReached ? 429 : 401 }
    );
  }

  await admin.rpc("clear_login_failures", { identifier: emailIdentifier });

  return NextResponse.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token
  });
}
