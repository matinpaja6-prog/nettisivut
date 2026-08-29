import "server-only";

import { sendGmailMessage } from "@/lib/gmail";
import { prepareMaskinesEmailBrand, withMaskinesEmailTheme } from "@/lib/email-brand";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
    contentId?: string;
  }>;
  idempotencyKey?: string;
  branding?: "maskines" | "neutral";
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

  const brandedEmail = input.branding === "neutral"
    ? { html: withMaskinesEmailTheme(input.html), attachments: [] }
    : await prepareMaskinesEmailBrand(input.html);
  const attachments = [
    ...(input.attachments ?? []).filter(
      (attachment) => !brandedEmail.attachments.some((brand) => attachment.contentId === brand.contentId)
    ),
    ...brandedEmail.attachments
  ];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {})
    },
    body: JSON.stringify({
      from: "Maskines <info@maskines.com>",
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: brandedEmail.html,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      ...(input.headers ? { headers: input.headers } : {}),
      attachments: attachments.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.isBuffer(attachment.content)
            ? attachment.content.toString("base64")
            : Buffer.from(attachment.content, "utf8").toString("base64"),
          content_type: attachment.contentType || "application/octet-stream",
          ...(attachment.contentId ? { content_id: attachment.contentId } : {})
        }))
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Resend-lähetys epäonnistui: ${await response.text()}`);
  }
}
