import PDFDocument from "pdfkit";
import type { Company, Order, OrderItem } from "@/lib/commerce/types";

export const RETURN_LANGUAGES = ["fi", "en", "sv", "no"] as const;
export type ReturnLanguage = typeof RETURN_LANGUAGES[number];
export type ReturnTranslation = { instructions: string; conditions: string; exclusions: string; packing: string; pickup_instructions: string };
export type ReturnPolicy = {
  company_id: string; enabled: boolean; return_window_days: number; recipient_name: string; company_name: string;
  address_line: string; postal_code: string; city: string; country: string; email: string; phone: string;
  shipping_method: string; shipping_payer: "customer" | "seller"; return_identifier: string; customer_service: string;
  translations: Record<string, ReturnTranslation>; automatic_pdf: boolean; attach_to_confirmation: boolean;
  attach_to_shipping: boolean; customer_download: boolean; updated_at?: string;
};

const RETURN_PDF_LABELS: Record<ReturnLanguage, { title: string; instructions: string; conditions: string; packing: string; exclusions: string; sellerCompany: string; order: string; returnBy: string; verifiedBusiness: string; products: string; reason: string; register: string; registerInstructions: string; pdfCreated: string; dateLocale: string }> = {
  fi: { title: "14 päivän palautusoikeus", instructions: "14 päivän palautusoikeus", conditions: "Palautuksen ehdot", packing: "Pakkausohjeet", exclusions: "Tuotteet, joita ei voi palauttaa", sellerCompany: "Myyjäyritys", order: "Tilaus", returnBy: "Palauta viimeistään", verifiedBusiness: "Vahvistettu yritys", products: "Tilauksen tuotteet", reason: "Palautuksen syy", register: "Rekisteröi palautus", registerInstructions: "Avaa tilauksesi Maskinesissa, valitse Pyydä palautusta ja seuraa ohjeita. Säilytä lähetystunnus, kunnes palautus on käsitelty.", pdfCreated: "PDF luotu", dateLocale: "fi-FI" },
  en: { title: "14-day right of return", instructions: "14-day right of return", conditions: "Return conditions", packing: "Packing instructions", exclusions: "Items excluded from returns", sellerCompany: "Seller company", order: "Order", returnBy: "Return by", verifiedBusiness: "Verified business", products: "Products in this order", reason: "Reason for return", register: "Register the return", registerInstructions: "Open your order in Maskines, choose Request return and follow the instructions. Keep the tracking receipt until the return has been processed.", pdfCreated: "PDF created", dateLocale: "en-GB" },
  sv: { title: "14 dagars returrätt", instructions: "14 dagars returrätt", conditions: "Returvillkor", packing: "Förpackningsanvisningar", exclusions: "Produkter som inte kan returneras", sellerCompany: "Säljarföretag", order: "Beställning", returnBy: "Returnera senast", verifiedBusiness: "Verifierat företag", products: "Produkter i beställningen", reason: "Orsak till retur", register: "Registrera returen", registerInstructions: "Öppna din beställning i Maskines, välj Begär retur och följ anvisningarna. Spara försändelsekvittot tills returen har behandlats.", pdfCreated: "PDF skapad", dateLocale: "sv-SE" },
  no: { title: "14 dagers angrerett", instructions: "14 dagers angrerett", conditions: "Returvilkår", packing: "Pakkeinstruksjoner", exclusions: "Produkter som ikke kan returneres", sellerCompany: "Selgerbedrift", order: "Bestilling", returnBy: "Returner senest", verifiedBusiness: "Verifisert bedrift", products: "Produkter i bestillingen", reason: "Årsak til retur", register: "Registrer returen", registerInstructions: "Åpne bestillingen din i Maskines, velg Be om retur og følg instruksjonene. Ta vare på innleveringskvitteringen til returen er behandlet.", pdfCreated: "PDF opprettet", dateLocale: "nb-NO" }
};
const RETURN_PDF_META_LABELS: Record<ReturnLanguage, { businessId: string; email: string; phone: string; shipping: string; shippingMethod: string; shippingPayer: string; customer: string; seller: string; identifier: string; customerService: string }> = {
  fi: { businessId: "Y-tunnus", email: "Sähköposti", phone: "Puhelin", shipping: "Palautuksen toimitus", shippingMethod: "Toimitustapa", shippingPayer: "Palautuskulut maksaa", customer: "Asiakas", seller: "Myyjä", identifier: "Palautustunnus tai sopimusnumero", customerService: "Asiakaspalvelu" },
  en: { businessId: "Business ID", email: "Email", phone: "Phone", shipping: "Return shipment", shippingMethod: "Shipping method", shippingPayer: "Return shipping paid by", customer: "Customer", seller: "Seller", identifier: "Return or agreement number", customerService: "Customer service" },
  sv: { businessId: "FO-nummer", email: "E-post", phone: "Telefon", shipping: "Returleverans", shippingMethod: "Leveranssätt", shippingPayer: "Returfrakten betalas av", customer: "Kunden", seller: "Säljaren", identifier: "Retur- eller avtalsnummer", customerService: "Kundtjänst" },
  no: { businessId: "Organisasjonsnummer", email: "E-post", phone: "Telefon", shipping: "Returforsendelse", shippingMethod: "Forsendelsesmåte", shippingPayer: "Returfrakten betales av", customer: "Kunden", seller: "Selgeren", identifier: "Retur- eller avtalenummer", customerService: "Kundeservice" }
};

export function returnLanguageForCountry(country: string | null | undefined, fallback: string = "en"): ReturnLanguage {
  const countryLanguage: Record<string, ReturnLanguage> = { FI: "fi", SE: "sv", NO: "no" };
  if (RETURN_LANGUAGES.includes(fallback as ReturnLanguage)) return fallback as ReturnLanguage;
  return countryLanguage[String(country ?? "").trim().toUpperCase()] ?? "en";
}

const blankTranslation = (): ReturnTranslation => ({ instructions: "", conditions: "", exclusions: "", packing: "", pickup_instructions: "" });
export function defaultReturnPolicy(company: Company): ReturnPolicy {
  return { company_id: company.id, enabled: true, return_window_days: 14, recipient_name: company.contact_person,
    company_name: company.name, address_line: company.address_line, postal_code: company.postal_code, city: company.city,
    country: company.country || "FI", email: company.email, phone: company.phone, shipping_method: "Seurattava paketti",
    shipping_payer: "customer", return_identifier: "", customer_service: company.email,
    translations: Object.fromEntries(RETURN_LANGUAGES.map((language) => [language, blankTranslation()])), automatic_pdf: true,
    attach_to_confirmation: true, attach_to_shipping: true, customer_download: true };
}

export function normalizeReturnPolicy(value: Partial<ReturnPolicy>, company: Company): ReturnPolicy {
  const base = defaultReturnPolicy(company); const text = (v: unknown, max = 4000) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
  const translations = Object.fromEntries(RETURN_LANGUAGES.map((language) => { const source = value.translations?.[language] ?? blankTranslation(); return [language, { instructions: text(source.instructions), conditions: text(source.conditions), exclusions: text(source.exclusions), packing: text(source.packing), pickup_instructions: text(source.pickup_instructions, 1800) }]; }));
  return {
    company_id: company.id,
    enabled: value.enabled ?? base.enabled,
    return_window_days: Math.min(365, Math.max(1, Math.trunc(Number(value.return_window_days) || 14))),
    recipient_name: text(value.recipient_name, 160),
    // The seller name is authoritative company data. Never persist a client supplied
    // alias here, so previews, snapshots and generated PDFs all identify the seller.
    company_name: text(company.name, 160),
    address_line: text(value.address_line, 200),
    postal_code: text(value.postal_code, 30),
    city: text(value.city, 100),
    country: text(value.country, 2).toUpperCase() || "FI",
    email: text(value.email, 180).toLowerCase(),
    phone: text(value.phone, 50),
    shipping_method: text(value.shipping_method, 300),
    shipping_payer: value.shipping_payer === "seller" ? "seller" : "customer",
    return_identifier: text(value.return_identifier, 120),
    customer_service: text(value.customer_service, 500),
    translations,
    automatic_pdf: value.automatic_pdf ?? base.automatic_pdf,
    attach_to_confirmation: value.attach_to_confirmation ?? base.attach_to_confirmation,
    attach_to_shipping: value.attach_to_shipping ?? base.attach_to_shipping,
    customer_download: value.customer_download ?? base.customer_download,
    ...(value.updated_at ? { updated_at: text(value.updated_at, 80) } : {}),
  };
}

function safe(value: string) { return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 70) || "order"; }
export function returnPdfFilename(orderNumber: string) { return `maskines-return-${safe(orderNumber)}.pdf`; }
export async function createReturnInstructionsPdf(input: { order: Order; items: OrderItem[]; company: Company; policy: ReturnPolicy; language?: string }) {
  const { order, items, company, policy } = input; const language: ReturnLanguage = RETURN_LANGUAGES.includes(input.language as ReturnLanguage) ? input.language as ReturnLanguage : "fi";
  const preferred = policy.translations[language] || blankTranslation();
  const textFor = (field: keyof Pick<ReturnTranslation, "instructions" | "conditions" | "packing" | "exclusions">) =>
    preferred[field]?.trim() || RETURN_LANGUAGES.map((candidate) => policy.translations[candidate]?.[field]?.trim()).find(Boolean) || "";
  const labels = RETURN_PDF_LABELS[language];
  const metaLabels = RETURN_PDF_META_LABELS[language];
  const created = new Date(); const deadline = new Date(order.paid_at || order.created_at); deadline.setDate(deadline.getDate() + policy.return_window_days);
  const doc = new PDFDocument({ size: "A4", margins: { top: 42, left: 48, right: 48, bottom: 48 }, info: { Title: `${labels.title} ${order.order_number}`, Author: company.name, Creator: "Maskines" } });
  const chunks: Buffer[] = []; doc.on("data", (chunk: Buffer) => chunks.push(chunk)); const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#0a2940").text(company.name);
  doc.rect(48, 75, 82, 4).fill("#ff6500");
  doc.moveDown(1.4).fontSize(18).fillColor("#0a2940").text(labels.title);
  doc.moveDown(.5).font("Helvetica").fontSize(10).fillColor("#526575").text(`${labels.order} ${order.order_number}  •  ${created.toLocaleDateString(labels.dateLocale)}  •  ${labels.returnBy} ${deadline.toLocaleDateString(labels.dateLocale)}`);
  if (company.verification_status === "approved") doc.moveDown(1.5).font("Helvetica-Bold").fontSize(11).fillColor("#0a2940").text(`✓ ${labels.verifiedBusiness}`);
  const contactLines = [
    policy.recipient_name,
    policy.address_line,
    [policy.postal_code, policy.city].filter(Boolean).join(" "),
    policy.country,
    company.business_id ? `${metaLabels.businessId}: ${company.business_id}` : "",
    policy.email ? `${metaLabels.email}: ${policy.email}` : "",
    policy.phone ? `${metaLabels.phone}: ${policy.phone}` : ""
  ].filter(Boolean);
  doc.font("Helvetica").fontSize(9).fillColor("#526575").text(contactLines.join("\n"));
  const section = (title: string, body: string) => { if (!body) return; doc.moveDown(1.2).font("Helvetica-Bold").fontSize(11).fillColor("#0a2940").text(title); doc.moveDown(.25).font("Helvetica").fontSize(9.5).fillColor("#263d4d").text(body, { lineGap: 2 }); };
  section(labels.instructions, textFor("instructions")); section(labels.conditions, textFor("conditions")); section(labels.packing, textFor("packing")); section(labels.exclusions, textFor("exclusions"));
  const shippingLines = [
    policy.shipping_method ? `${metaLabels.shippingMethod}: ${policy.shipping_method}` : "",
    `${metaLabels.shippingPayer}: ${policy.shipping_payer === "seller" ? metaLabels.seller : metaLabels.customer}`,
    policy.return_identifier ? `${metaLabels.identifier}: ${policy.return_identifier}` : "",
    policy.customer_service ? `${metaLabels.customerService}: ${policy.customer_service}` : ""
  ].filter(Boolean);
  section(metaLabels.shipping, shippingLines.join("\n"));
  doc.moveDown(1.2).font("Helvetica-Bold").fontSize(11).fillColor("#0a2940").text(labels.products); items.forEach((item) => doc.font("Helvetica").fontSize(9.5).fillColor("#263d4d").text(`• ${item.product_name} × ${item.quantity}`));
  section(labels.reason, "__________________________________________________________________\n__________________________________________________________________");
  section(labels.register, labels.registerInstructions);
  doc.moveDown(1).font("Helvetica").fontSize(8).fillColor("#71818c").text(`${metaLabels.customerService}: ${policy.customer_service || policy.email}  •  ${labels.pdfCreated} ${created.toLocaleString(labels.dateLocale)}`);
  doc.end(); return done;
}
