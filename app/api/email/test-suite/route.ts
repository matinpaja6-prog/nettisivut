import { NextResponse } from "next/server";

import { sendAuthEmail } from "@/lib/auth-email-sender";
import { createAuthEmail, type AuthEmailKind } from "@/lib/auth-email";
import { companyVerificationDecisionEmail } from "@/lib/company-verification-decision-email";
import { commerceEmailTestPreviews } from "@/lib/email-test-previews";
import type { EmailLocale } from "@/lib/email-template";
import { newMessageEmail, searchAlertEmail } from "@/lib/notification-emails";
import { pagePath, profileRootPath } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_RECIPIENT = "spinscasino0@gmail.com";
const locales: EmailLocale[] = ["fi", "en", "sv", "no"];

function allowed(request: Request) {
  const configuredSecret = process.env.EMAIL_LIFECYCLE_SECRET?.trim();
  if (configuredSecret && request.headers.get("authorization") === `Bearer ${configuredSecret}`) return true;
  const host = new URL(request.url).hostname;
  return process.env.NODE_ENV === "development" && (host === "localhost" || host === "127.0.0.1") &&
    request.headers.get("x-maskines-email-test") === "local-preview";
}

export async function POST(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => ({})) as { scope?: unknown };
  const scope = payload.scope === "commerce" ? payload.scope : "all";

  const authKinds: AuthEmailKind[] = ["registration", "login", "password-reset", "password-change", "email-change"];
  const messages: Array<{ label: string; email: { subject: string; text: string; html: string; branding?: "maskines" | "neutral" } }> = [];

  for (const locale of locales) {
    for (const kind of authKinds) {
      messages.push({
        label: `auth-${kind}-${locale}`,
        email: createAuthEmail({
          kind,
          locale,
          code: kind === "password-reset" ? undefined : "482913",
          actionUrl: kind === "password-reset" ? absoluteSiteUrl(`${pagePath("auth", locale)}?recovery=test`) : undefined
        })
      });
    }

    messages.push({
      label: `search-alert-${locale}`,
      email: searchAlertEmail({
        locale,
        alertLabel: "Arctic Cat",
        listingTitle: "Original variator – Arctic Cat",
        price: 249,
        listingUrl: absoluteSiteUrl("/listing/test"),
        settingsUrl: absoluteSiteUrl(pagePath("settings", locale))
      })
    });
    messages.push({
      label: `new-message-${locale}`,
      email: newMessageEmail({
        locale,
        senderName: "Maskines Seller",
        listingTitle: "Ski-Doo parts",
        conversationUrl: absoluteSiteUrl(pagePath("messages", locale)),
        settingsUrl: absoluteSiteUrl(pagePath("settings", locale))
      })
    });
    for (const decision of ["approved", "rejected"] as const) {
      messages.push({
        label: `company-${decision}-${locale}`,
        email: companyVerificationDecisionEmail({
          locale,
          decision,
          companyName: "Arctic Parts Oy",
          profileUrl: absoluteSiteUrl(profileRootPath(locale)),
          reason: decision === "rejected" ? "The company registration number could not be matched with the submitted company name." : undefined
        })
      });
    }
    messages.push(...commerceEmailTestPreviews(locale));
  }

  const selectedMessages = scope === "commerce"
    ? messages.filter((message) => message.label.startsWith("commerce-"))
    : messages;
  const sent: string[] = [];
  const failed: Array<{ label: string; error: string }> = [];
  const runId = Date.now();
  for (const [index, message] of selectedMessages.entries()) {
    try {
      await sendAuthEmail({
        to: TEST_RECIPIENT,
        ...message.email,
        subject: `[MASKINES TEST ${index + 1}/${selectedMessages.length}] ${message.email.subject}`,
        idempotencyKey: `email-preview-suite/${runId}/${message.label}`
      });
      sent.push(message.label);
    } catch (error) {
      failed.push({ label: message.label, error: error instanceof Error ? error.message : String(error) });
    }
    if (index < selectedMessages.length - 1) await new Promise((resolve) => setTimeout(resolve, 600));
  }

  return NextResponse.json(
    { ok: failed.length === 0, to: TEST_RECIPIENT, scope, total: selectedMessages.length, sent, failed },
    { status: failed.length === 0 ? 200 : 207 }
  );
}
