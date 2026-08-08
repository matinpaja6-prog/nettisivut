import "server-only";

import { sendGmailMessage } from "@/lib/gmail";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendAuthEmail(input: EmailMessage) {
  const hasGmailCredentials = Boolean(
    process.env.GMAIL_SERVICE_ACCOUNT_JSON_BASE64 ||
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
  );

  if (hasGmailCredentials) {
    await sendGmailMessage(input);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Sähköpostipalvelun tunnukset puuttuvat.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.ACCOUNT_EMAIL_FROM?.trim() || "Maskines <noreply@maskines.com>",
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Resend-lähetys epäonnistui: ${await response.text()}`);
  }
}
