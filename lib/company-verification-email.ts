import "server-only";

import type Stripe from "stripe";

import { sendAuthEmail } from "@/lib/auth-email-sender";
import { COMPANY_VERIFICATION_PRICE_CENTS } from "@/lib/company-verification-payment";
import { getStripe } from "@/lib/stripe";
import { emailLocaleTag, type EmailLocale } from "@/lib/email-template";
import { resolveRecipientEmailLocale } from "@/lib/commerce/email-localization";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function receiptNumber(session: Stripe.Checkout.Session) {
  const date = new Date(session.created * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  return `MV-${date}-${session.id.slice(-8).toUpperCase()}`;
}

const receiptText: Record<EmailLocale, {
  subject: string;
  paymentConfirmation: string;
  paid: string;
  thanks: string;
  intro: string;
  receipt: string;
  company: string;
  companyFallback: string;
  paymentDate: string;
  totalPaid: string;
  openStripeReceipt: string;
  stripeReceiptPrefix: string;
  stripeReceiptUnavailable: string;
  service: string;
  verificationService: string;
  businessId: string;
  paymentStatus: string;
  disclaimer: string;
}> = {
  fi: {
    subject: "Kuitti yritysvahvistuksesta", paymentConfirmation: "MAKSUN VAHVISTUS", paid: "MAKSETTU", thanks: "Kiitos maksustasi", intro: "Yritysvahvistuksesi on vastaanotettu ja yritystietojen tarkistus voi alkaa.", receipt: "Kuitti", company: "Yritys", companyFallback: "Yritys", paymentDate: "Maksupäivä", totalPaid: "Maksettu yhteensä", openStripeReceipt: "Avaa Stripen kuitti", stripeReceiptPrefix: "Stripen kuitti", stripeReceiptUnavailable: "Stripen kuittilinkki on saatavilla Maskinesin asiakaspalvelusta.", service: "Palvelu", verificationService: "Maskines yritysvahvistus", businessId: "Y-tunnus", paymentStatus: "Maksun tila", disclaimer: "Maksu kattaa yritystietojen tarkistuksen eikä takaa hyväksyntää. Saat erillisen ilmoituksen, kun tarkistus on valmis."
  },
  en: {
    subject: "Company verification receipt", paymentConfirmation: "PAYMENT CONFIRMATION", paid: "PAID", thanks: "Thank you for your payment", intro: "Your company verification request has been received and the review can now begin.", receipt: "Receipt", company: "Company", companyFallback: "Company", paymentDate: "Payment date", totalPaid: "Total paid", openStripeReceipt: "Open Stripe receipt", stripeReceiptPrefix: "Stripe receipt", stripeReceiptUnavailable: "The Stripe receipt link is available from Maskines customer support.", service: "Service", verificationService: "Maskines company verification", businessId: "Business ID", paymentStatus: "Payment status", disclaimer: "The payment covers review of the company details and does not guarantee approval. You will receive a separate notification when the review is complete."
  },
  sv: {
    subject: "Kvitto för företagsverifiering", paymentConfirmation: "BETALNINGSBEKRÄFTELSE", paid: "BETALD", thanks: "Tack för din betalning", intro: "Din begäran om företagsverifiering har tagits emot och granskningen kan börja.", receipt: "Kvitto", company: "Företag", companyFallback: "Företag", paymentDate: "Betalningsdatum", totalPaid: "Totalt betalt", openStripeReceipt: "Öppna Stripe-kvittot", stripeReceiptPrefix: "Stripe-kvitto", stripeReceiptUnavailable: "Länken till Stripe-kvittot fås från Maskines kundtjänst.", service: "Tjänst", verificationService: "Maskines företagsverifiering", businessId: "Organisationsnummer", paymentStatus: "Betalningsstatus", disclaimer: "Betalningen täcker granskningen av företagsuppgifterna och garanterar inte godkännande. Du får ett separat meddelande när granskningen är klar."
  },
  no: {
    subject: "Kvittering for bedriftsverifisering", paymentConfirmation: "BETALINGSBEKREFTELSE", paid: "BETALT", thanks: "Takk for betalingen", intro: "Forespørselen om bedriftsverifisering er mottatt, og kontrollen kan begynne.", receipt: "Kvittering", company: "Bedrift", companyFallback: "Bedrift", paymentDate: "Betalingsdato", totalPaid: "Totalt betalt", openStripeReceipt: "Åpne Stripe-kvitteringen", stripeReceiptPrefix: "Stripe-kvittering", stripeReceiptUnavailable: "Lenken til Stripe-kvitteringen er tilgjengelig fra Maskines kundestøtte.", service: "Tjeneste", verificationService: "Maskines bedriftsverifisering", businessId: "Organisasjonsnummer", paymentStatus: "Betalingsstatus", disclaimer: "Betalingen dekker kontroll av bedriftsopplysningene og garanterer ikke godkjenning. Du får et eget varsel når kontrollen er ferdig."
  }
};

export async function sendCompanyVerificationReceipt(
  session: Stripe.Checkout.Session,
  fallbackEmail?: string | null
) {
  if (session.livemode) return { sent: false, handledBy: "stripe" as const };
  if (session.metadata?.maskines_receipt_sent === "true") {
    return { sent: false, handledBy: "maskines" as const };
  }

  const to = session.customer_details?.email || session.customer_email || fallbackEmail || "";
  if (!to) throw new Error("Kuitin vastaanottajan sähköpostiosoite puuttuu.");

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  const paymentIntent = paymentIntentId
    ? await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] })
    : null;
  const charge = paymentIntent?.latest_charge && typeof paymentIntent.latest_charge !== "string"
    ? paymentIntent.latest_charge
    : null;
  const stripeReceiptUrl = charge?.receipt_url ?? "";
  const paidAt = new Date((charge?.created ?? session.created) * 1000);
  const locale = await resolveRecipientEmailLocale(
    session.metadata?.user_id,
    null,
    session.metadata?.locale
  );
  const copy = receiptText[locale];
  const paidAtLabel = new Intl.DateTimeFormat(emailLocaleTag(locale), {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Helsinki"
  }).format(paidAt);
  const amount = new Intl.NumberFormat(emailLocaleTag(locale), {
    style: "currency",
    currency: "EUR"
  }).format(COMPANY_VERIFICATION_PRICE_CENTS / 100);
  const number = receiptNumber(session);
  const companyName = session.metadata?.company_name || copy.companyFallback;
  const businessId = session.metadata?.business_id || "–";
  const receiptLinkText = stripeReceiptUrl
    ? `${copy.stripeReceiptPrefix}: ${stripeReceiptUrl}`
    : copy.stripeReceiptUnavailable;

  const localized = {
    subject: `${copy.subject} ${number}`,
    text: [
      `${copy.thanks}!`,
      "",
      `${copy.receipt}: ${number}`,
      `${copy.paymentDate}: ${paidAtLabel}`,
      `${copy.service}: ${copy.verificationService}`,
      `${copy.company}: ${companyName}`,
      `${copy.businessId}: ${businessId}`,
      `${copy.totalPaid}: ${amount}`,
      `${copy.paymentStatus}: ${copy.paid}`,
      "",
      receiptLinkText,
      "",
      copy.disclaimer
    ].join("\n"),
    html: `<!doctype html><html lang="${locale}"><body style="margin:0;background:#edf2f6;font-family:Arial,Helvetica,sans-serif;color:#172433"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #dce5eb;border-radius:20px;overflow:hidden"><tr><td class="email-brand-header" align="center" bgcolor="#202124" style="padding:25px 30px;background:#202124;border-bottom:4px solid #22a957;color:#ffffff"><img src="cid:maskines-email-brand" width="320" height="80" alt="Maskines" style="display:block;width:100%;max-width:320px;height:auto;margin:0 auto;border:0"><div style="margin-top:13px;color:#72d697;font-size:11px;font-weight:800;letter-spacing:2px">${copy.paymentConfirmation}</div></td></tr><tr><td style="padding:32px 30px"><div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#eaf8ef;color:#167c3d;font-size:12px;font-weight:800">✓ ${copy.paid}</div><h1 style="margin:18px 0 7px;font-size:27px">${copy.thanks}</h1><p style="margin:0 0 24px;color:#647687;line-height:1.6">${copy.intro}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f7f9fa;border:1px solid #e0e7ec;border-radius:14px"><tr><td style="padding:16px;color:#667784">${copy.receipt}</td><td align="right" style="padding:16px;font-weight:800">${escapeHtml(number)}</td></tr><tr><td style="padding:0 16px 16px;color:#667784">${copy.company}</td><td align="right" style="padding:0 16px 16px;font-weight:700">${escapeHtml(companyName)}<br><span style="font-size:12px;color:#7c8b95">${escapeHtml(businessId)}</span></td></tr><tr><td style="padding:0 16px 16px;color:#667784">${copy.paymentDate}</td><td align="right" style="padding:0 16px 16px">${escapeHtml(paidAtLabel)}</td></tr><tr><td style="padding:16px;border-top:1px solid #e0e7ec;font-weight:800">${copy.totalPaid}</td><td align="right" style="padding:16px;border-top:1px solid #e0e7ec;color:#167c3d;font-size:22px;font-weight:900">${escapeHtml(amount)}</td></tr></table>${stripeReceiptUrl ? `<p style="margin:24px 0 0;text-align:center"><a href="${escapeHtml(stripeReceiptUrl)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#ff7414;color:#fff;text-decoration:none;font-weight:800">${copy.openStripeReceipt}</a></p>` : ""}<p style="margin:25px 0 0;color:#7b8a95;font-size:12px;line-height:1.6">${copy.disclaimer}</p></td></tr><tr><td align="center" style="padding:18px;background:#f7f9fa;border-top:1px solid #e1e8ed;color:#8997a1;font-size:11px">© Maskines Marketplace</td></tr></table></td></tr></table></body></html>`
  };
  await sendAuthEmail({
    to,
    idempotencyKey: `company-verification-receipt/${session.id}`,
    ...localized
  });

  try {
    await getStripe().checkout.sessions.update(session.id, {
      metadata: { maskines_receipt_sent: "true" }
    });
  } catch (error) {
    console.error("Company verification receipt marker failed", error);
  }

  return { sent: true, handledBy: "maskines" as const };
}
