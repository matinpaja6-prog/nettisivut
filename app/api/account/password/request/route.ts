import { NextResponse } from "next/server";
import { createAuthEmail, normalizeAuthEmailLocale } from "@/lib/auth-email";
import { sendAuthEmail } from "@/lib/auth-email-sender";
import {
  claimAuthEmailCooldown,
  releaseAuthEmailCooldown,
  type AuthEmailCooldownLease
} from "@/lib/auth-email-rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function getBearerToken(request: Request) {
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

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 });
  }

  let locale = normalizeAuthEmailLocale(undefined);
  let cooldownLease: AuthEmailCooldownLease | undefined;
  try {
    const payload = await request.json() as { locale?: unknown };
    locale = normalizeAuthEmailLocale(payload.locale);
  } catch {}

  try {
    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    const user = userData.user;

    if (userError || !user?.email || !user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Kirjautuminen tai sähköposti ei ole vahvistettu." },
        { status: 401 }
      );
    }

    const cooldown = claimAuthEmailCooldown(user.email);
    if (!cooldown.allowed) {
      return NextResponse.json(
        {
          error: cooldownMessage(locale, cooldown.retryAfterSeconds),
          retryAfter: cooldown.retryAfterSeconds
        },
        { status: 429, headers: { "Retry-After": String(cooldown.retryAfterSeconds) } }
      );
    }
    cooldownLease = cooldown.lease;

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: user.email
    });
    const code = data?.properties?.email_otp;
    if (error || !code) {
      releaseAuthEmailCooldown(cooldownLease);
      console.error("Password recovery code generation failed:", error);
      return NextResponse.json(
        { error: "Vahvistuskoodia ei voitu luoda. Yritä uudelleen." },
        { status: 503 }
      );
    }

    await sendAuthEmail({
      to: user.email,
      ...createAuthEmail({ kind: "password-change", locale, code })
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    releaseAuthEmailCooldown(cooldownLease);
    console.error("Password recovery email failed:", error);
    return NextResponse.json(
      { error: "Vahvistuskoodin lähettäminen epäonnistui. Yritä uudelleen." },
      { status: 503 }
    );
  }
}
