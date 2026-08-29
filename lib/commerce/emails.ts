import "server-only";

import { sendAuthEmail } from "@/lib/auth-email-sender";
import {
  createReceiptPdf,
  receiptPdfFilename,
  type ReceiptCustomerDelivery,
} from "@/lib/commerce/receipt-pdf";
import type { Company, Order, OrderItem } from "@/lib/commerce/types";
import { createReturnInstructionsPdf, normalizeReturnPolicy, returnLanguageForCountry, returnPdfFilename, type ReturnPolicy } from "@/lib/commerce/returns";
import { displayedVatRate, MARGIN_SCHEME_LABEL, SHIPPING_VAT_RATE, usesMarginScheme, vatFromGrossCents } from "@/lib/commerce/vat";
import { absoluteSiteUrl } from "@/lib/site-url";
import {
  localizeCommerceEmail,
  resolveBuyerOrderEmailLocale,
  resolveRecipientEmailLocale
} from "@/lib/commerce/email-localization";
import { emailLocaleTag, type EmailLocale } from "@/lib/email-template";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function neutralCommerceEmailHtml(html: string) {
  return html
    .replace('<div style="', '<div style="overflow-wrap:anywhere;word-break:normal;')
    .replaceAll("#ff7417", "#315f7e")
    .replaceAll("#ff7a1a", "#315f7e")
    .replaceAll("#c65008", "#315f7e")
    .replaceAll("#d95d09", "#315f7e")
    .replaceAll("#fff7ef", "#f6f8fa")
    .replaceAll("#fff6ee", "#f6f8fa")
    .replaceAll("#ffd0ab", "#d7dfe5")
    .replaceAll("#ffc48f", "#d7dfe5");
}

function money(cents: number, locale: EmailLocale = "fi") {
  return new Intl.NumberFormat(emailLocaleTag(locale), { style: "currency", currency: "EUR" }).format(cents / 100);
}

function shippingVatNote(locale: EmailLocale = "fi") {
  return locale === "en" ? "incl. VAT 25.5%" : locale === "sv" ? "inkl. moms 25,5 %" : locale === "no" ? "inkl. MVA 25,5 %" : "sis. ALV 25,5 %";
}

function shippingPriceText(order: Pick<Order, "shipping_method" | "shipping_price_cents">, locale: EmailLocale = "fi") {
  const vatNote = order.shipping_method !== "pickup" && order.shipping_price_cents > 0
    ? ` (${shippingVatNote(locale)})`
    : "";
  return `${money(order.shipping_price_cents, locale)}${vatNote}`;
}

function shippingVatHtml(order: Pick<Order, "shipping_method" | "shipping_price_cents">, locale: EmailLocale = "fi") {
  if (order.shipping_method === "pickup" || order.shipping_price_cents <= 0) return "";
  return `<small style="display:block;margin-top:2px;color:#667085;font-size:10px;font-weight:600">${shippingVatNote(locale)}</small>`;
}

function shippingVatCents(order: Pick<Order, "shipping_method" | "shipping_price_cents">) {
  return order.shipping_method !== "pickup"
    ? vatFromGrossCents(order.shipping_price_cents, SHIPPING_VAT_RATE)
    : 0;
}

function totalVatCents(order: Pick<Order, "shipping_method" | "shipping_price_cents">, items: OrderItem[]) {
  return items.reduce((sum, item) => sum + item.vat_cents, 0) + shippingVatCents(order);
}

const combinedCheckoutCopy = {
  fi: {
    subject: (number: string) => `Tilausvahvistus ${number}`,
    eyebrow: "TILAUSVAHVISTUS",
    hello: (name: string) => `Hei ${name},`,
    confirmed: "Kiitos tilauksestasi. Maksu on vahvistettu.",
    processing: (multiple: boolean) => `Kiitos tilauksestasi. Maksu on vahvistettu ja tilauksesi on välitetty ${multiple ? "myyjille" : "myyjälle"} käsiteltäväksi.`,
    attachment: (multiple: boolean) => multiple ? "PDF-kuitit ovat tämän viestin liitteenä." : "PDF-kuitti on tämän viestin liitteenä."
  },
  en: {
    subject: (number: string) => `Order confirmation ${number}`,
    eyebrow: "ORDER CONFIRMATION",
    hello: (name: string) => `Hello ${name},`,
    confirmed: "Thank you for your order. Your payment is confirmed.",
    processing: (multiple: boolean) => `Thank you for your order. Your payment is confirmed and the order has been sent to ${multiple ? "the sellers" : "the seller"} for processing.`,
    attachment: (multiple: boolean) => multiple ? "The PDF receipts are attached to this email." : "The PDF receipt is attached to this email."
  },
  sv: {
    subject: (number: string) => `Orderbekräftelse ${number}`,
    eyebrow: "ORDERBEKRÄFTELSE",
    hello: (name: string) => `Hej ${name},`,
    confirmed: "Tack för din beställning. Betalningen är bekräftad.",
    processing: (multiple: boolean) => `Tack för din beställning. Betalningen är bekräftad och beställningen har skickats till ${multiple ? "säljarna" : "säljaren"} för behandling.`,
    attachment: (multiple: boolean) => multiple ? "PDF-kvittona bifogas till detta meddelande." : "PDF-kvittot bifogas till detta meddelande."
  },
  no: {
    subject: (number: string) => `Ordrebekreftelse ${number}`,
    eyebrow: "ORDREBEKREFTELSE",
    hello: (name: string) => `Hei ${name},`,
    confirmed: "Takk for bestillingen. Betalingen er bekreftet.",
    processing: (multiple: boolean) => `Takk for bestillingen. Betalingen er bekreftet, og ordren er sendt til ${multiple ? "selgerne" : "selgeren"} for behandling.`,
    attachment: (multiple: boolean) => multiple ? "PDF-kvitteringene er vedlagt denne e-posten." : "PDF-kvitteringen er vedlagt denne e-posten."
  }
} as const;

type CustomerDeliveryDetails = ReceiptCustomerDelivery;

function countryName(country: string | null | undefined, locale: EmailLocale) {
  const code = country?.trim().toUpperCase();
  const countries = {
    fi: { FI: "Suomi", SE: "Ruotsi", NO: "Norja" },
    en: { FI: "Finland", SE: "Sweden", NO: "Norway" },
    sv: { FI: "Finland", SE: "Sverige", NO: "Norge" },
    no: { FI: "Finland", SE: "Sverige", NO: "Norge" }
  } as const;
  if (code === "FI" || code === "SE" || code === "NO") return countries[locale][code];
  return code ?? "";
}

function customerAddress(details: CustomerDeliveryDetails | undefined, locale: EmailLocale) {
  const missing = {
    fi: "Osoitetta ei ole tallennettu tähän tilaukseen.",
    en: "No address was saved for this order.",
    sv: "Ingen adress har sparats för beställningen.",
    no: "Ingen adresse ble lagret for bestillingen."
  }[locale];
  if (!details) return missing;
  const locality = [details.postalCode?.trim(), details.city?.trim()].filter(Boolean).join(" ");
  return [details.address?.trim(), locality, countryName(details.country, locale)].filter(Boolean).join("\n")
    || missing;
}

function isCompanyBuyer(order: Order) {
  return order.buyer_type === "company" || Boolean(order.buyer_company_name || order.buyer_business_id);
}

function buyerCompanyText(order: Order) {
  if (!isCompanyBuyer(order)) return "";
  return [
    "OSTAJAYRITYS",
    `Yritys: ${order.buyer_company_name || "Ei ilmoitettu"}`,
    `Y-tunnus: ${order.buyer_business_id || "Ei ilmoitettu"}`,
    order.buyer_vat_id ? `ALV-tunniste: ${order.buyer_vat_id}` : "",
    order.buyer_company_address ? `Yrityksen osoite: ${order.buyer_company_address}` : "",
    `Yhteyshenkilö: ${order.buyer_company_contact_person || order.customer_name}`,
    `Sähköposti: ${order.buyer_company_email || order.customer_email}`,
    `Puhelin: ${order.buyer_company_phone || order.customer_phone || "Ei ilmoitettu"}`,
    order.buyer_company_website ? `Verkkosivu: ${order.buyer_company_website}` : "",
  ].filter(Boolean).join("\n");
}

function buyerCompanyHtml(order: Order) {
  if (!isCompanyBuyer(order)) return "";
  const rows = [
    ["Yritys", order.buyer_company_name || "Ei ilmoitettu"],
    ["Y-tunnus", order.buyer_business_id || "Ei ilmoitettu"],
    ["ALV-tunniste", order.buyer_vat_id],
    ["Yrityksen osoite", order.buyer_company_address],
    ["Yhteyshenkilö", order.buyer_company_contact_person || order.customer_name],
    ["Sähköposti", order.buyer_company_email || order.customer_email],
    ["Puhelin", order.buyer_company_phone || order.customer_phone || "Ei ilmoitettu"],
    ["Verkkosivu", order.buyer_company_website],
  ].filter(([, value]) => Boolean(value));
  return `<h2 style="margin:22px 0 10px;font-size:18px">Ostajayrityksen tiedot</h2><table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:22px;background:#f7f9fb;border-radius:12px">${rows.map(([label, value]) => `<tr><td style="padding:9px 13px;color:#64748b;width:150px">${escapeHtml(label)}</td><td style="padding:9px 13px;font-weight:600">${escapeHtml(value)}</td></tr>`).join("")}</table>`;
}

function itemText(items: OrderItem[], locale: EmailLocale = "fi") {
  return items.map((item) =>
    `${item.product_name} - ${item.quantity} x ${money(item.unit_price_cents, locale)} = ${money(item.line_total_cents, locale)}${usesMarginScheme(item.vat_rate) ? ` (${MARGIN_SCHEME_LABEL})` : ` (ALV ${displayedVatRate(item.vat_rate)} %, ${money(item.vat_cents, locale)})`}`
  ).join("\n");
}

function stackedItemRows(items: OrderItem[], locale: EmailLocale = "fi") {
  return items.map((item) => `<tr><td style="padding:14px 0;border-bottom:1px solid #e5eaf0"><strong style="display:block;color:#172433;font-size:14px;line-height:1.45">${escapeHtml(item.product_name)}</strong>${usesMarginScheme(item.vat_rate) ? `<small style="display:block;margin-top:4px;color:#d95d09;font-weight:700">${MARGIN_SCHEME_LABEL}</small>` : ""}<table role="presentation" style="width:100%;margin-top:9px;border-collapse:collapse;font-size:12px;color:#667085"><tr><td>${item.quantity} kpl × ${money(item.unit_price_cents, locale)}</td><td style="text-align:right;color:#172433;font-weight:800">${money(item.line_total_cents, locale)}</td></tr></table></td></tr>`).join("");
}

function deliveryText(order: Order, items: OrderItem[]) {
  if (order.shipping_method === "posti") {
    return `Posti: ${order.pickup_point_name ?? "noutopiste"}, ${order.pickup_point_address ?? ""}`.trim();
  }
  const pickups = items.map((item) =>
    `${item.product_name}: ${item.pickup_address_snapshot ?? "osoite sovitaan myyjän kanssa"}${item.pickup_instructions_snapshot ? ` – ${item.pickup_instructions_snapshot}` : ""}`
  );
  return `Nouto\n${pickups.join("\n")}`;
}

function pickupMessageForOrder(order: Order, company?: Company, fallbackLanguage = "en") {
  const returnLanguage = returnLanguageForCountry(order.customer_country, fallbackLanguage);
  const snapshot = order.return_policy_snapshot as ReturnPolicy | null | undefined;
  const translatedPickup = snapshot?.translations?.[returnLanguage]?.pickup_instructions?.trim();
  return order.shipping_method === "pickup" ? translatedPickup || company?.pickup_email_message?.trim() || "" : "";
}

function deliveryTextWithCompanyMessage(order: Order, items: OrderItem[], company?: Company, fallbackLanguage = "en") {
  const delivery = deliveryText(order, items);
  const companyMessage = pickupMessageForOrder(order, company, fallbackLanguage);
  return companyMessage
    ? `${delivery}\n\nYrityksen nouto-ohjeet\n${companyMessage}`
    : delivery;
}

async function sendAutomaticPickupInstructions(order: Order, items: OrderItem[], company: Company, locale: EmailLocale) {
  if (order.shipping_method !== "pickup") return;
  const pickupLocale = returnLanguageForCountry(order.customer_country, locale);
  const instructions = pickupMessageForOrder(order, company, pickupLocale);
  if (!instructions) return;
  const pickupDetails = deliveryText(order, items);
  const content = localizeCommerceEmail(pickupLocale, {
    subject: `Nouto-ohjeet tilaukselle ${order.order_number}`,
    text: [
      `Hei ${order.customer_name},`,
      "Tässä ovat maksetun tilauksesi nouto-ohjeet.",
      `Tilaus: ${order.order_number}`,
      `Myyjä: ${company.name}`,
      "",
      pickupDetails,
      "",
      "Yrityksen nouto-ohjeet",
      instructions
    ].join("\n"),
    html: neutralCommerceEmailHtml(`<div style="margin:0;padding:28px 12px;background:#edf2f5;font-family:Arial,Helvetica,sans-serif;color:#172433"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #d8e1e7;border-radius:18px;overflow:hidden"><div style="padding:25px 28px;background:#eaf2ff"><div style="color:#c65008;font-size:10px;font-weight:800;letter-spacing:1.5px">NOUTO-OHJEET</div><h1 style="margin:18px 0 7px;font-size:27px">Hei ${escapeHtml(order.customer_name)},</h1><p style="margin:0;color:#52677a;line-height:1.6">Tässä ovat maksetun tilauksesi nouto-ohjeet.</p></div><div style="padding:25px 28px"><p style="margin:0 0 16px"><strong>Tilaus ${escapeHtml(order.order_number)}</strong><br>${escapeHtml(company.name)}</p><div style="padding:16px;border:1px solid #ffd0ab;border-radius:12px;background:#fff7ef;line-height:1.65">${escapeHtml(pickupDetails).replace(/\n/g, "<br>")}</div><div style="margin-top:14px;padding:16px;border:1px solid #cbd8e3;border-radius:12px;background:#f3f6f8;line-height:1.65"><strong style="display:block;margin-bottom:6px">Yrityksen nouto-ohjeet</strong>${escapeHtml(instructions).replace(/\n/g, "<br>")}</div></div></div></div>`)
  });
  await sendAuthEmail({
    to: order.customer_email,
    ...content,
    replyTo: company.email,
    branding: "neutral",
    idempotencyKey: `order-${order.id}-automatic-pickup-instructions-v1`
  });
}

async function returnInstructionsAttachment(order: Order, items: OrderItem[], company: Company, kind: "confirmation" | "shipping", language = "en") {
  let sourcePolicy = order.return_policy_snapshot as ReturnPolicy | null | undefined;
  if (!sourcePolicy) {
    const { data, error } = await getSupabaseAdmin()
      .from("company_return_policies")
      .select("*")
      .eq("company_id", company.id)
      .maybeSingle<ReturnPolicy>();
    if (error && !new Set(["42P01", "PGRST205"]).has(error.code ?? "")) throw error;
    sourcePolicy = data ?? null;
  }
  if (!sourcePolicy) return null;
  const policy = normalizeReturnPolicy(sourcePolicy, company);
  if (!policy.enabled || !policy.automatic_pdf || (kind === "confirmation" ? !policy.attach_to_confirmation : !policy.attach_to_shipping)) return null;
  return { filename: returnPdfFilename(order.order_number), content: await createReturnInstructionsPdf({ order, items, company, policy, language }), contentType: "application/pdf" };
}

export async function sendPaidOrderEmails(input: {
  order: Order;
  items: OrderItem[];
  company: Company;
  receiptNumber: string;
  sendBuyer?: boolean;
  sendSeller?: boolean;
  customerDelivery?: CustomerDeliveryDetails;
}) {
  const { order, items, company, receiptNumber, sendBuyer = true, sendSeller = true, customerDelivery } = input;
  const [buyerLocale, sellerLocale] = await Promise.all([
    resolveBuyerOrderEmailLocale(order.customer_user_id, order.customer_country, order.customer_locale),
    resolveRecipientEmailLocale(company.owner_user_id, company.country)
  ]);
  const delivery = deliveryTextWithCompanyMessage(order, items, company, buyerLocale);
  const buyerAddress = customerAddress(customerDelivery, buyerLocale);
  const sellerBuyerAddress = customerAddress(customerDelivery, sellerLocale);
  const deliveryMethod = order.shipping_method === "posti" ? "Posti - toimitus noutopisteeseen" : "Nouto yritykseltä";
  const discountTotal = order.discount_cents ?? 0;
  const totalVat = totalVatCents(order, items);
  const showVat = totalVat > 0;
  const productTotalBeforeDiscounts = Math.max(0, order.total_cents - order.shipping_price_cents + discountTotal);
  const buyerSubject = `Tilausvahvistus ${order.order_number}`;
  const [buyerReceiptPdf, sellerReceiptPdf] = await Promise.all([
    createReceiptPdf({ order, items, company, receiptNumber, customerDelivery, locale: buyerLocale }),
    buyerLocale === sellerLocale
      ? Promise.resolve<Buffer | null>(null)
      : createReceiptPdf({ order, items, company, receiptNumber, customerDelivery, locale: sellerLocale })
  ]);
  const buyerReceiptAttachment = {
    filename: receiptPdfFilename(receiptNumber, buyerLocale),
    content: buyerReceiptPdf,
    contentType: "application/pdf",
  };
  const sellerReceiptAttachment = {
    filename: receiptPdfFilename(receiptNumber, sellerLocale),
    content: sellerReceiptPdf ?? buyerReceiptPdf,
    contentType: "application/pdf",
  };
  const [buyerReturnAttachment, sellerReturnAttachment] = await Promise.all([
    returnInstructionsAttachment(order, items, company, "confirmation", returnLanguageForCountry(order.customer_country, buyerLocale)),
    buyerLocale === sellerLocale
      ? Promise.resolve(null)
      : returnInstructionsAttachment(order, items, company, "confirmation", returnLanguageForCountry(company.country, sellerLocale))
  ]);
  const buyerAttachments = buyerReturnAttachment ? [buyerReceiptAttachment, buyerReturnAttachment] : [buyerReceiptAttachment];
  const sellerAttachments = (sellerReturnAttachment ?? buyerReturnAttachment)
    ? [sellerReceiptAttachment, (sellerReturnAttachment ?? buyerReturnAttachment)!]
    : [sellerReceiptAttachment];
  const receiptIntro = `Kuitti ${receiptNumber}\nTilaus ${order.order_number}\nMaksupäivä ${order.paid_at ? new Date(order.paid_at).toLocaleString(emailLocaleTag(buyerLocale)) : ""}`;
  const buyerText = [
    `Hei ${order.customer_name},`,
    "Olemme vastaanottaneet tilauksesi ja maksu on vahvistettu.",
    "Virallinen myyjäkohtainen kuitti on tämän viestin PDF-liitteenä.",
    receiptIntro,
    `Myyjä: ${order.seller_name_snapshot}`,
    `Y-tunnus: ${order.seller_business_id_snapshot}`,
    order.seller_vat_id_snapshot ? `ALV-tunniste: ${order.seller_vat_id_snapshot}` : "",
    `Myyjän osoite: ${order.seller_address_snapshot}`,
    "",
    buyerCompanyText(order),
    "",
    itemText(items, buyerLocale),
    "",
    showVat ? `Veroton summa: ${money(Math.max(0, order.total_cents - totalVat), buyerLocale)}` : "",
    showVat ? `ALV yhteensä: ${money(totalVat, buyerLocale)}` : "",
    `Toimitus: ${shippingPriceText(order, buyerLocale)}`,
    `Loppusumma: ${money(order.total_cents, buyerLocale)}`,
    "Maksunvälittäjä: Stripe",
    "",
    delivery,
    "",
    "Tuotteen myyjä ja kuitin antaja on yllä mainittu yritys.",
    "Stripe toimii maksunvälittäjänä. Maskines toimii markkinapaikkana ja välittää tämän sähköpostin."
  ].filter(Boolean).join("\n");
  const buyerHtml = `
    <div style="margin:0;padding:32px 12px;background:#edf2f5;font-family:Arial,Helvetica,sans-serif;color:#172433">
      <div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #d8e1e7;border-radius:20px;overflow:hidden;box-shadow:0 14px 38px rgba(8,36,58,.10)">
        <div style="padding:28px 32px;background:#eaf2ff;color:#172433">
          <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
            <td><div style="font-size:10px;font-weight:800;letter-spacing:1.5px;color:#c65008">TILAUSVAHVISTUS</div></td>
            <td style="text-align:right"><span style="display:inline-block;padding:8px 12px;border:1px solid #c7d4e3;border-radius:999px;color:#52677a;font-size:12px">${escapeHtml(order.order_number)}</span></td>
          </tr></table>
          <h1 style="margin:28px 0 8px;font-size:30px;line-height:1.15;color:#172433">Hei ${escapeHtml(order.customer_name)},</h1>
          <p style="margin:0;color:#52677a;font-size:15px;line-height:1.6">Kiitos tilauksestasi. Maksu on vahvistettu ja tilauksesi on välitetty myyjälle käsiteltäväksi.</p>
        </div>
        <div style="padding:28px 32px">
          <table role="presentation" style="width:100%;margin:0 0 24px;border-collapse:separate;border-spacing:0;background:#effaf2;border:1px solid #bfe5ca;border-radius:14px"><tr>
            <td style="padding:16px"><div style="font-size:12px;font-weight:800;letter-spacing:.6px;color:#16833e">✓ MAKSU VAHVISTETTU</div><div style="margin-top:4px;color:#466356;font-size:13px">Maksunvälittäjä Stripe</div></td>
          </tr></table>

          <table role="presentation" style="width:100%;margin-bottom:24px;border-collapse:separate;border-spacing:0;border:1px solid #dbe3e8;border-radius:14px;overflow:hidden"><tr>
            <td style="padding:17px 18px;width:50%;vertical-align:top;border-right:1px solid #e3e9ed"><div style="margin-bottom:8px;font-size:10px;font-weight:800;letter-spacing:1px;color:#d95d09">MYYJÄ JA KUITIN ANTAJA</div><strong style="display:block;margin-bottom:6px;font-size:16px">${escapeHtml(order.seller_name_snapshot)}</strong><span style="font-size:13px;line-height:1.55;color:#5f6d78">Y-tunnus ${escapeHtml(order.seller_business_id_snapshot)}${order.seller_vat_id_snapshot ? `<br>ALV ${escapeHtml(order.seller_vat_id_snapshot)}` : ""}<br>${escapeHtml(order.seller_address_snapshot)}</span></td>
            <td style="padding:17px 18px;vertical-align:top"><div style="margin-bottom:8px;font-size:10px;font-weight:800;letter-spacing:1px;color:#d95d09">KUITTI</div><strong style="display:block;margin-bottom:6px;font-size:16px">${escapeHtml(receiptNumber)}</strong><span style="font-size:13px;line-height:1.55;color:#5f6d78">PDF-liite on mukana tässä viestissä.<br>Vastaa viestiin ottaaksesi yhteyttä myyjään.</span></td>
          </tr></table>
          ${buyerCompanyHtml(order)}

          <h2 style="margin:0 0 12px;font-size:18px">Tilatut tuotteet</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
            <tbody>${stackedItemRows(items, buyerLocale)}</tbody>
          </table>

          <div style="margin-bottom:16px;padding:15px 16px;background:#fff6ee;border:1px solid #ffd0ab;border-radius:12px"><div style="margin-bottom:7px;font-size:10px;font-weight:800;letter-spacing:1px;color:#c65008">TOIMITUSTIEDOT</div><div style="font-size:13px;line-height:1.55;color:#3f4d58">${escapeHtml(delivery).replace(/\n/g, "<br>")}</div></div>
          <table role="presentation" style="width:100%;margin-bottom:24px;border-collapse:separate;border-spacing:0;padding:12px 16px;border:1px solid #dbe3ea;border-radius:12px;font-size:13px"><tr><td style="padding:5px 0;color:#667085">Tuotteet</td><td style="padding:5px 0;text-align:right;font-weight:700">${money(Math.max(0, order.total_cents - order.shipping_price_cents), buyerLocale)}</td></tr><tr><td style="padding:5px 0;color:#667085">Toimitusmaksu${shippingVatHtml(order, buyerLocale)}</td><td style="padding:5px 0;text-align:right;font-weight:700">${money(order.shipping_price_cents, buyerLocale)}</td></tr>${showVat ? `<tr><td style="padding:5px 0;color:#667085">Sisältyvä ALV</td><td style="padding:5px 0;text-align:right;font-weight:700">${money(totalVat, buyerLocale)}</td></tr>` : ""}<tr><td style="padding:13px 0 4px;border-top:1px solid #dbe3e8;font-size:16px;font-weight:900">Maksettu yhteensä</td><td style="padding:13px 0 4px;border-top:1px solid #dbe3e8;text-align:right;font-size:20px;font-weight:900">${money(order.total_cents, buyerLocale)}</td></tr></table>

          <div style="padding:16px 18px;border-radius:12px;background:#f3f6f8;color:#5f6d78;font-size:12px;line-height:1.6">Tuotteen myyjä ja kuitin antaja on yllä mainittu yritys. Stripe toimii maksunvälittäjänä. Maskines toimii markkinapaikkana ja välittää tämän sähköpostin.</div>
        </div>
      </div>
    </div>`;

  const sellerText = [
    `Hei ${company.name},`,
    "Olet saanut uuden maksetun tilauksen.",
    `Tilausnumero: ${order.order_number}`,
    `Maksun tila: Maksettu`,
    `Kuitti: ${receiptNumber} (PDF-liitteenä)`,
    `Tilausaika: ${order.paid_at ? new Date(order.paid_at).toLocaleString(emailLocaleTag(sellerLocale)) : new Date(order.created_at).toLocaleString(emailLocaleTag(sellerLocale))}`,
    "",
    "OSTAJAN TIEDOT",
    `Ostajatyyppi: ${isCompanyBuyer(order) ? "Yritys" : "Yksityinen"}`,
    `Nimi: ${order.customer_name}`,
    `Sähköposti: ${order.customer_email}`,
    `Puhelin: ${order.customer_phone || "Ei ilmoitettu"}`,
    `Osoite:\n${sellerBuyerAddress}`,
    "",
    buyerCompanyText(order),
    "",
    "TUOTTEET",
    itemText(items, sellerLocale),
    "",
    `Tuotteet ennen alennuksia: ${money(productTotalBeforeDiscounts, sellerLocale)}`,
    discountTotal > 0 ? `Alennukset: −${money(discountTotal, sellerLocale)}` : "",
    `Toimitusmaksu: ${shippingPriceText(order, sellerLocale)}`,
    `Maksettu yhteensä: ${money(order.total_cents, sellerLocale)}`,
    "",
    "TOIMITUS",
    `Toimitustapa: ${deliveryMethod}`,
    delivery,
    "",
    `Hallintapaneeli: ${absoluteSiteUrl("/yritys")}`
  ].filter(Boolean).join("\n");

  const sellerHtml = `
    <div style="margin:0;padding:28px 14px;background:#f2f5f7;font-family:Arial,sans-serif;color:#142033">
      <div style="max-width:760px;margin:auto;background:#ffffff;border:1px solid #dbe3ea;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(20,32,51,.08)">
        <div style="padding:24px 28px;background:#eaf2ff;color:#172433">
          <div style="font-size:10px;font-weight:800;letter-spacing:1.6px;color:#c65008">UUSI MAKSETTU TILAUS</div>
          <h1 style="margin:20px 0 8px;font-size:28px;line-height:1.2">Hei ${escapeHtml(company.name)},</h1>
          <p style="margin:0;color:#52677a;line-height:1.55">Olet saanut uuden maksetun tilauksen. Tilaus ${escapeHtml(order.order_number)} · ${escapeHtml(order.paid_at ? new Date(order.paid_at).toLocaleString(emailLocaleTag(sellerLocale)) : new Date(order.created_at).toLocaleString(emailLocaleTag(sellerLocale)))}</p>
        </div>

        <div style="padding:24px 28px">
          <div style="margin-bottom:14px;padding:13px 16px;border:1px solid #bfe5ca;border-radius:12px;background:#effaf2;color:#167239;font-weight:700">✓ Maksu on vahvistettu</div>
          <div style="margin-bottom:22px;padding:13px 16px;border:1px solid #cbd8e3;border-radius:12px;background:#f3f6f8"><strong>PDF-kuitti ${escapeHtml(receiptNumber)}</strong> on tämän viestin liitteenä.</div>

          <h2 style="margin:0 0 12px;font-size:18px">Ostajan tiedot</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f7f9fb;border-radius:12px">
            <tr><td style="padding:10px 14px;color:#64748b;width:150px">Ostajatyyppi</td><td style="padding:10px 14px;font-weight:700">${isCompanyBuyer(order) ? "Yritys" : "Yksityinen"}</td></tr>
            <tr><td style="padding:10px 14px;color:#64748b;width:150px">Nimi</td><td style="padding:10px 14px;font-weight:700">${escapeHtml(order.customer_name)}</td></tr>
            <tr><td style="padding:10px 14px;color:#64748b">Sähköposti</td><td style="padding:10px 14px"><a href="mailto:${escapeHtml(order.customer_email)}" style="color:#d95d09">${escapeHtml(order.customer_email)}</a></td></tr>
            <tr><td style="padding:10px 14px;color:#64748b">Puhelin</td><td style="padding:10px 14px">${escapeHtml(order.customer_phone || "Ei ilmoitettu")}</td></tr>
            <tr><td style="padding:10px 14px;color:#64748b;vertical-align:top">Osoite</td><td style="padding:10px 14px;line-height:1.5">${escapeHtml(sellerBuyerAddress).replace(/\n/g, "<br>")}</td></tr>
          </table>
          ${buyerCompanyHtml(order)}

          <h2 style="margin:0 0 12px;font-size:18px">Tilatut tuotteet</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:22px">
            <tbody>${stackedItemRows(items, sellerLocale)}</tbody>
          </table>

          <table role="presentation" style="width:100%;margin-bottom:24px;border-collapse:separate;border-spacing:0;padding:12px 16px;border:1px solid #dbe3ea;border-radius:12px">
            <tr><td style="padding:6px 0;color:#64748b">${discountTotal > 0 ? "Tuotteet ennen alennuksia" : "Tuotteet"}</td><td style="padding:6px 0;text-align:right;font-weight:700">${money(productTotalBeforeDiscounts, sellerLocale)}</td></tr>
            ${discountTotal > 0 ? `<tr><td style="padding:6px 0;color:#64748b">Alennukset</td><td style="padding:6px 0;text-align:right;color:#16833e;font-weight:700">−${money(discountTotal, sellerLocale)}</td></tr>` : ""}
            <tr><td style="padding:6px 0;color:#64748b">Toimitusmaksu${shippingVatHtml(order, sellerLocale)}</td><td style="padding:6px 0;text-align:right;font-weight:700">${money(order.shipping_price_cents, sellerLocale)}</td></tr>
            <tr><td style="padding:14px 0 5px;border-top:1px solid #dbe3ea;font-size:17px;font-weight:800">Maksettu yhteensä</td><td style="padding:14px 0 5px;border-top:1px solid #dbe3ea;text-align:right;font-size:20px;font-weight:900">${money(order.total_cents, sellerLocale)}</td></tr>
          </table>

          <h2 style="margin:0 0 10px;font-size:18px">Toimitustiedot</h2>
          <div style="padding:16px;border:1px solid #ffd0ab;border-radius:12px;background:#fff7ef;line-height:1.55">
            <strong style="display:block;margin-bottom:5px;color:#c65008">${escapeHtml(deliveryMethod)}</strong>
            ${escapeHtml(delivery).replace(/\n/g, "<br>")}
          </div>

          <div style="margin-top:26px;text-align:center">
            <a href="${absoluteSiteUrl("/yritys")}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#ff7417;color:#ffffff;text-decoration:none;font-weight:800">Avaa tilaus hallintapaneelissa</a>
          </div>
        </div>
      </div>
    </div>`;

  const localizedBuyer = localizeCommerceEmail(buyerLocale, { subject: buyerSubject, text: buyerText, html: neutralCommerceEmailHtml(buyerHtml) });
  const localizedSeller = localizeCommerceEmail(sellerLocale, {
    subject: `Uusi maksettu tilaus ${order.order_number}`,
    text: sellerText,
    html: neutralCommerceEmailHtml(sellerHtml)
  });
  const buyerResult = sendBuyer
    ? await Promise.allSettled([sendAuthEmail({
      to: order.customer_email,
      ...localizedBuyer,
      replyTo: company.email,
      attachments: buyerAttachments,
      branding: "neutral",
      idempotencyKey: `order-${order.id}-buyer-${receiptNumber}-v3`,
    })])
    : [];
  const sellerResult = sendSeller
    ? await Promise.allSettled([sendAuthEmail({
      to: company.email,
      ...localizedSeller,
      replyTo: order.customer_email,
      attachments: sellerAttachments,
      branding: "neutral",
      idempotencyKey: `order-${order.id}-seller-${receiptNumber}-v3`,
    })])
    : [];
  const results = [...buyerResult, ...sellerResult];
  if (sendBuyer && order.shipping_method === "pickup") {
    try { await sendAutomaticPickupInstructions(order, items, company, buyerLocale); }
    catch (error) { results.push({ status: "rejected", reason: error } as PromiseRejectedResult); }
  }

  return {
    buyerSent: sendBuyer && buyerResult[0]?.status === "fulfilled",
    sellerSent: sendSeller && sellerResult[0]?.status === "fulfilled",
    errors: results.flatMap((result) => result.status === "rejected" ? [String(result.reason)] : [])
  };
}

export async function sendCombinedCheckoutEmail(input: {
  checkoutNumber: string;
  customerEmail: string;
  customerLocale?: EmailLocale | null;
  customerDelivery?: CustomerDeliveryDetails;
  orders: Array<{ order: Order; items: OrderItem[]; company: Company; receiptNumber: string }>;
}) {
  const buyerLocale = await resolveBuyerOrderEmailLocale(
    input.orders[0]?.order.customer_user_id,
    input.orders[0]?.order.customer_country,
    input.customerLocale ?? input.orders[0]?.order.customer_locale
  );
  const total = input.orders.reduce((sum, entry) => sum + entry.order.total_cents, 0);
  const buyerCompany = input.orders[0]?.order;
  const buyerName = buyerCompany?.customer_name?.trim() || "asiakas";
  const multipleSellers = input.orders.length > 1;
  const copy = combinedCheckoutCopy[buyerLocale];
  const buyerCompanyTextBlock = buyerCompany ? buyerCompanyText(buyerCompany) : "";
  const buyerCompanyHtmlBlock = buyerCompany ? buyerCompanyHtml(buyerCompany) : "";
  const attachments = (await Promise.all(input.orders.map(async ({ order, items, company, receiptNumber }) => {
    const receipt = { filename: receiptPdfFilename(receiptNumber, buyerLocale), content: await createReceiptPdf({ order, items, company, receiptNumber, customerDelivery: input.customerDelivery, locale: buyerLocale }), contentType: "application/pdf" };
    const returns = await returnInstructionsAttachment(order, items, company, "confirmation", returnLanguageForCountry(order.customer_country, buyerLocale));
    return returns ? [receipt, returns] : [receipt];
  }))).flat();
  const sectionsText = input.orders.map(({ order, items, company, receiptNumber }) => [
    `${order.seller_name_snapshot} · ${order.order_number}`,
    `Kuitti: ${receiptNumber} (PDF-liitteenä)`,
    `Y-tunnus: ${order.seller_business_id_snapshot}`,
    order.seller_vat_id_snapshot ? `ALV-tunniste: ${order.seller_vat_id_snapshot}` : "",
    `Myyjän osoite: ${order.seller_address_snapshot}`,
    itemText(items, buyerLocale),
    order.discount_cents ? `Alennukset: −${money(order.discount_cents, buyerLocale)}` : "",
    `Toimitus: ${shippingPriceText(order, buyerLocale)}`,
    `Yhteensä: ${money(order.total_cents, buyerLocale)}`,
    deliveryTextWithCompanyMessage(order, items, company, buyerLocale)
  ].filter(Boolean).join("\n")).join("\n\n--------------------\n\n");
  const sectionsHtml = input.orders.map(({ order, items, company, receiptNumber }) => {
    const discount = order.discount_cents ?? 0;
    const productsBeforeDiscount = Math.max(0, order.total_cents - order.shipping_price_cents + discount);
    const productRows = stackedItemRows(items, buyerLocale);
    return `<section style="margin:22px 0;border:1px solid #dbe3ea;border-radius:14px;overflow:hidden">
      <div style="padding:17px 18px;background:#f3f6f8"><h2 style="margin:0 0 6px;font-size:18px">${escapeHtml(order.seller_name_snapshot)}</h2><div style="font-size:12px;line-height:1.6;color:#667085">Y-tunnus ${escapeHtml(order.seller_business_id_snapshot)}<br>Tilaus ${escapeHtml(order.order_number)} · PDF-kuitti ${escapeHtml(receiptNumber)}</div></div>
      <div style="padding:6px 18px 20px"><table role="presentation" style="width:100%;border-collapse:collapse"><tbody>${productRows}</tbody></table>
        <div style="margin-top:18px;padding:14px 15px;border:1px solid #ffd0ab;border-radius:11px;background:#fff7ef;font-size:12px;line-height:1.55"><strong style="display:block;margin-bottom:5px;color:#c65008">Toimitustiedot</strong>${escapeHtml(deliveryTextWithCompanyMessage(order, items, company, buyerLocale)).replace(/\n/g, "<br>")}</div>
        <table role="presentation" style="width:100%;margin-top:16px;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:5px 0;color:#667085">${discount > 0 ? "Tuotteet ennen alennuksia" : "Tuotteet"}</td><td style="padding:5px 0;text-align:right;font-weight:700">${money(productsBeforeDiscount, buyerLocale)}</td></tr>
          ${discount > 0 ? `<tr><td style="padding:5px 0;color:#667085">Alennukset</td><td style="padding:5px 0;text-align:right;color:#16833e;font-weight:700">−${money(discount, buyerLocale)}</td></tr>` : ""}
          <tr><td style="padding:5px 0;color:#667085">Toimitusmaksu${shippingVatHtml(order, buyerLocale)}</td><td style="padding:5px 0;text-align:right;font-weight:700">${money(order.shipping_price_cents, buyerLocale)}</td></tr>
          <tr><td style="padding:13px 0 4px;border-top:1px solid #dbe3ea;font-size:15px;font-weight:800">${multipleSellers ? "Myyjän osuus" : "Maksettu yhteensä"}</td><td style="padding:13px 0 4px;border-top:1px solid #dbe3ea;text-align:right;font-size:19px;font-weight:900">${money(order.total_cents, buyerLocale)}</td></tr>
        </table>
      </div>
    </section>`;
  }).join("");
  const checkoutTotalText = multipleSellers ? `\nMaksettu yhteensä: ${money(total, buyerLocale)}` : "";
  const checkoutTotalHtml = multipleSellers ? `<table role="presentation" style="width:100%;margin-top:20px;border-collapse:collapse"><tr><td style="font-size:15px;font-weight:800">Maksettu yhteensä</td><td style="text-align:right;font-size:24px;font-weight:900">${money(total, buyerLocale)}</td></tr></table>` : "";
  const localized = localizeCommerceEmail(buyerLocale, {
    subject: copy.subject(input.checkoutNumber),
    text: [copy.hello(buyerName), "", copy.confirmed, `Tilaus ${input.checkoutNumber}`, copy.attachment(multipleSellers), "", buyerCompanyTextBlock, buyerCompanyTextBlock ? "" : "", sectionsText, checkoutTotalText, "", "Stripe toimii maksunvälittäjänä. Maskines toimii markkinapaikkana ja välittää tämän sähköpostin."].filter((value, index, values) => value !== "" || values[index - 1] !== "").join("\n"),
    html: neutralCommerceEmailHtml(`<div style="margin:0;padding:24px 10px;background:#edf2f5;font-family:Arial,Helvetica,sans-serif;color:#172433"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #d8e1e7;border-radius:18px;overflow:hidden"><div style="padding:26px 28px;background:#eaf2ff;color:#172433"><div style="color:#c65008;font-size:10px;font-weight:800;letter-spacing:1.6px">${copy.eyebrow}</div><h1 style="margin:22px 0 8px;font-size:28px;line-height:1.2">${escapeHtml(copy.hello(buyerName))}</h1><p style="margin:0;color:#52677a;font-size:14px;line-height:1.6">${escapeHtml(copy.processing(multipleSellers))}</p><p style="margin:12px 0 0;color:#52677a;font-size:12px">${escapeHtml(input.checkoutNumber)} · ${escapeHtml(copy.attachment(multipleSellers))}</p></div><div style="padding:24px 28px">${buyerCompanyHtmlBlock}${sectionsHtml}${checkoutTotalHtml}<div style="margin-top:22px;padding:14px;border-radius:10px;background:#f3f6f8;color:#667085;font-size:11px;line-height:1.6">Stripe toimii maksunvälittäjänä. Maskines toimii markkinapaikkana ja välittää tämän sähköpostin.</div></div></div></div>`)
  });
  await sendAuthEmail({
    to: input.customerEmail,
    ...localized,
    replyTo: input.orders.length === 1 ? input.orders[0].company.email : undefined,
    attachments,
    branding: "neutral",
    idempotencyKey: `checkout-${input.checkoutNumber}-buyer-receipts-v3`,
  });
  await Promise.all(input.orders
    .filter(({ order }) => order.shipping_method === "pickup")
    .map(({ order, items, company }) => sendAutomaticPickupInstructions(order, items, company, buyerLocale)));
}

export async function sendFulfillmentUpdateEmail(input: {
  order: Order;
  items: OrderItem[];
  company: Company;
  kind: "shipped" | "ready_for_pickup";
}) {
  const { order, items, company, kind } = input;
  const locale = await resolveBuyerOrderEmailLocale(
    order.customer_user_id,
    order.customer_country,
    order.customer_locale
  );
  const returnAttachment = await returnInstructionsAttachment(order, items, company, "shipping", returnLanguageForCountry(order.customer_country, locale));
  const trackingUrl = order.posti_tracking_url || (order.posti_tracking_code
    ? `https://www.posti.fi/fi/seuranta#/lahetys/${encodeURIComponent(order.posti_tracking_code)}`
    : null);
  const isShipped = kind === "shipped";
  const subject = isShipped
    ? `Tilauksesi ${order.order_number} on lähetetty`
    : `Tilauksesi ${order.order_number} on valmis noudettavaksi`;
  const delivery = deliveryTextWithCompanyMessage(order, items, company);
  const deliveryDetails = deliveryText(order, items);
  const companyPickupMessage = !isShipped ? company.pickup_email_message?.trim() : "";
  const text = isShipped
    ? [
        `Tilauksesi ${order.order_number} on lähetetty.`,
        `Myyjä: ${order.seller_name_snapshot || company.name}`,
        order.posti_tracking_code ? `Seurantakoodi: ${order.posti_tracking_code}` : "",
        trackingUrl ? `Seuraa lähetystä: ${trackingUrl}` : "",
        "",
        delivery,
        "",
        "Saat Postilta erillisen saapumisilmoituksen, kun lähetys on noudettavissa."
      ].filter(Boolean).join("\n")
    : [
        `Tilauksesi ${order.order_number} on valmis noudettavaksi.`,
        `Myyjä: ${order.seller_name_snapshot || company.name}`,
        "",
        delivery,
        "",
        "Ota tarvittaessa yhteyttä myyjään ennen noutoa."
      ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#181818">
    <h1 style="font-size:24px">${escapeHtml(subject)}</h1>
    <p><strong>Tilaus:</strong> ${escapeHtml(order.order_number)}<br><strong>Myyjä:</strong> ${escapeHtml(order.seller_name_snapshot || company.name)}</p>
    ${isShipped && order.posti_tracking_code ? `<p><strong>Seurantakoodi:</strong> ${escapeHtml(order.posti_tracking_code)}</p>` : ""}
    ${isShipped && trackingUrl ? `<p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#ff7a1a;color:#fff;text-decoration:none;font-weight:bold">Seuraa lähetystä</a></p>` : ""}
    <p><strong>Toimitustiedot:</strong><br>${escapeHtml(deliveryDetails).replace(/\n/g, "<br>")}</p>
    ${companyPickupMessage ? `<div style="margin:18px 0;padding:16px;border:1px solid #ffc48f;border-radius:12px;background:#fff7ef"><strong style="color:#d95d09">Yrityksen nouto-ohjeet</strong><p style="margin:7px 0 0;white-space:pre-wrap">${escapeHtml(companyPickupMessage)}</p></div>` : ""}
    <p style="color:#555">${isShipped ? "Saat Postilta erillisen saapumisilmoituksen, kun lähetys on noudettavissa." : "Ota tarvittaessa yhteyttä myyjään ennen noutoa."}</p>
  </div>`;

  await sendAuthEmail({
    to: order.customer_email,
    ...localizeCommerceEmail(locale, { subject, text, html: neutralCommerceEmailHtml(html) }),
    replyTo: company.email,
    attachments: returnAttachment ? [returnAttachment] : undefined,
    branding: "neutral"
  });
}
