import { NextResponse } from "next/server";
import { sendGmailMessage } from "@/lib/gmail";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SupportedLocale = "fi" | "en" | "sv" | "no";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function normalizeLocale(value: unknown): SupportedLocale {
  return value === "en" || value === "sv" || value === "no" ? value : "fi";
}

function emailCopy(locale: SupportedLocale, code: string) {
  const copy = {
    fi: {
      subject: "Maskines – salasanan vaihtokoodi",
      title: "Vaihda salasanasi",
      body: "Syötä tämä vahvistuskoodi Maskines-palvelussa jatkaaksesi salasanan vaihtoa.",
      expiry: "Koodi vanhenee pian. Jos et pyytänyt salasanan vaihtoa, voit jättää viestin huomiotta."
    },
    en: {
      subject: "Maskines – password change code",
      title: "Change your password",
      body: "Enter this verification code in Maskines to continue changing your password.",
      expiry: "The code expires soon. If you did not request a password change, you can ignore this message."
    },
    sv: {
      subject: "Maskines – kod för lösenordsbyte",
      title: "Byt ditt lösenord",
      body: "Ange den här verifieringskoden i Maskines för att fortsätta byta lösenord.",
      expiry: "Koden upphör snart att gälla. Om du inte begärde ett lösenordsbyte kan du ignorera meddelandet."
    },
    no: {
      subject: "Maskines – kode for passordbytte",
      title: "Bytt passordet ditt",
      body: "Skriv inn denne bekreftelseskoden i Maskines for å fortsette passordbyttet.",
      expiry: "Koden utløper snart. Hvis du ikke ba om passordbytte, kan du se bort fra denne meldingen."
    }
  }[locale];

  return {
    subject: copy.subject,
    text: `${copy.title}\n\n${copy.body}\n\n${code}\n\n${copy.expiry}`,
    html: `
      <div style="margin:0;padding:32px 14px;background:#eef2f6;font-family:Arial,sans-serif;color:#10243e;">
        <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #dbe4ee;border-radius:20px;background:#ffffff;box-shadow:0 18px 45px rgba(10,35,66,.12);">
          <div style="padding:28px;text-align:center;background:#071c31;border-bottom:5px solid #ff7817;color:#ffffff;font-size:28px;font-weight:800;">maskines</div>
          <div style="padding:34px 28px;text-align:center;">
            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;">${copy.title}</h1>
            <p style="margin:0 auto 24px;max-width:430px;color:#607189;font-size:15px;line-height:1.6;">${copy.body}</p>
            <div style="display:inline-block;padding:17px 23px;border:2px solid #ffb77e;border-radius:12px;background:#fff8f2;color:#10243e;font-size:32px;font-weight:900;letter-spacing:8px;">${code}</div>
            <p style="margin:22px auto 0;max-width:430px;color:#8796a9;font-size:12px;line-height:1.6;">${copy.expiry}</p>
          </div>
        </div>
      </div>
    `
  };
}

async function sendRecoveryEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const hasGmailCredentials = Boolean(
    process.env.GMAIL_SERVICE_ACCOUNT_JSON_BASE64 ||
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
  );

  if (hasGmailCredentials) {
    await sendGmailMessage(input);
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("Sähköpostipalvelun tunnukset puuttuvat.");
  }

  const from =
    process.env.ACCOUNT_EMAIL_FROM?.trim() ||
    "Maskines <noreply@maskines.com>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  if (!response.ok) {
    throw new Error(`Resend-lähetys epäonnistui: ${await response.text()}`);
  }
}

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Kirjautuminen ei ole voimassa." }, { status: 401 });
  }

  let locale: SupportedLocale = "fi";
  try {
    const payload = await request.json() as { locale?: unknown };
    locale = normalizeLocale(payload.locale);
  } catch {
    locale = "fi";
  }

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

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: user.email
    });
    const code = data?.properties?.email_otp;

    if (error || !code) {
      console.error("Password recovery code generation failed:", error);
      return NextResponse.json(
        { error: "Vahvistuskoodia ei voitu luoda. Yritä uudelleen." },
        { status: 503 }
      );
    }

    await sendRecoveryEmail({
      to: user.email,
      ...emailCopy(locale, code)
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password recovery email failed:", error);
    return NextResponse.json(
      { error: "Vahvistuskoodin lähettäminen epäonnistui. Yritä uudelleen." },
      { status: 503 }
    );
  }
}
