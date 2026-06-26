import { NextResponse } from "next/server";
import { cleanUserText } from "@/lib/text-input";

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  acceptedTerms?: unknown;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: Request) {
  let payload: ContactPayload;

  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Tarkista lomakkeen tiedot ja yritä uudelleen." }, { status: 400 });
  }

  const name = cleanUserText(payload.name, 120);
  const email = cleanUserText(payload.email, 180).toLowerCase();
  const subject = cleanUserText(payload.subject, 160);
  const message = cleanUserText(payload.message, 4000);
  const acceptedTerms = payload.acceptedTerms === true;

  if (!name || !email || !subject || !message || !acceptedTerms) {
    return NextResponse.json({ error: "Täytä kaikki kentät ja hyväksy käyttöehdot." }, { status: 400 });
  }

  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Sähköpostiosoite ei näytä oikealta." }, { status: 400 });
  }

  if (message.length < 10) {
    return NextResponse.json({ error: "Kirjoita viestiin vähintään 10 merkkiä." }, { status: 400 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL || "info@maskines.com";
  const fromEmail =
    process.env.CONTACT_FROM_EMAIL ||
    process.env.ALERT_FROM_EMAIL ||
    "Maskines <noreply@maskines.com>";

  if (!resendApiKey) {
    return NextResponse.json({ error: "Sähköpostilähetystä ei ole vielä asetettu palvelimelle." }, { status: 500 });
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: `Maskines yhteydenotto: ${subject}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;padding:28px;background:#f5f7fb;color:#101827;">
          <div style="background:#ffffff;border:1px solid #dfe7f2;border-radius:14px;overflow:hidden;">
            <div style="background:#07111d;padding:22px 26px;">
              <h1 style="color:#ffffff;font-size:22px;line-height:1.25;margin:0;">Uusi yhteydenotto</h1>
            </div>
            <div style="padding:26px;">
              <p style="margin:0 0 14px;"><strong>Nimi:</strong> ${safeName}</p>
              <p style="margin:0 0 14px;"><strong>Sähköposti:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
              <p style="margin:0 0 22px;"><strong>Otsikko:</strong> ${safeSubject}</p>
              <div style="background:#f8fafc;border:1px solid #e4ebf5;border-radius:12px;padding:18px;line-height:1.6;">
                ${safeMessage}
              </div>
              <p style="color:#64748b;font-size:13px;line-height:1.5;margin:22px 0 0;">
                Vastaa tähän sähköpostiin, niin vastaus lähtee osoitteeseen ${safeEmail}.
              </p>
            </div>
          </div>
        </div>
      `,
      text: [
        "Uusi yhteydenotto Maskinesista",
        "",
        `Nimi: ${name}`,
        `Sähköposti: ${email}`,
        `Otsikko: ${subject}`,
        "",
        message,
        "",
        `Vastaa tähän sähköpostiin, niin vastaus lähtee osoitteeseen ${email}.`
      ].join("\n")
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Viestin lähetys epäonnistui. Yritä hetken päästä uudelleen." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
