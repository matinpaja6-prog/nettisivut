import PDFDocument from "pdfkit";

import type { Company, Order, OrderItem } from "@/lib/commerce/types";
import { emailLocaleTag, type EmailLocale } from "@/lib/email-template";

const SHIPPING_VAT_RATE = 25.5;
function usesMarginScheme(vatRate: number | string | null | undefined) { return Number(vatRate) === 0; }
function displayedVatRate(vatRate: number | string | null | undefined) { return Number(vatRate) === -2 ? 0 : Number(vatRate) || 0; }
function vatFromGrossCents(grossCents: number, rate: number) { return rate > 0 && grossCents > 0 ? grossCents - Math.round(grossCents / (1 + rate / 100)) : 0; }

export type ReceiptCustomerDelivery = { address?: string | null; postalCode?: string | null; city?: string | null; country?: string | null };
type ReceiptPdfInput = { order: Order; items: OrderItem[]; company: Company; receiptNumber: string; customerDelivery?: ReceiptCustomerDelivery; issuedAt?: string | Date | null; locale?: EmailLocale };

const C = { ink: "#1d2a33", muted: "#5f6b73", line: "#d5dadd", band: "#e9edef", orange: "#50697b" };

const receiptPdfText = {
  fi: { filename: "kuitti", title: "Kuitti", sellerReceipt: "MYYJÄYRITYKSEN KUITTI", receipt: "KUITTI", receiptNumber: "Kuitin numero", order: "Tilaus", date: "Päivämäärä", customer: "ASIAKAS", businessId: "Y-tunnus", product: "Tuote", quantity: "Määrä", price: "Hinta", netPrice: "Veroton hinta", vat: "ALV", total: "Yhteensä", notItemized: "Ei eritellä", marginAbbr: "Marg.", deliveryMethod: "Toimitustapa", parcel: "Postipaketti", pickup: "Nouto myyjältä", paymentMethod: "Maksutapa", stripePayment: "Stripe-maksu", stripeProcessor: "Stripe toimii maksunvälittäjänä", marginScheme: "Marginaalivero - Käytetyt tavarat", taxNotItemized: "Veron määrää ei eritellä kuitilla.", vatTotal: "ALV yhteensä", detailedNetShare: "ALV-eritelty veroton osuus", netTotal: "Veroton yhteensä", shippingCosts: "Toimituskulut", paymentSurcharge: "Maksutapalisä", products: "Tuotteet", shippingVatNote: "sis. ALV 25,5 %", footer: "Stripe toimii maksunvälittäjänä. Maskines välittää kuitin.", countries: { FI: "Suomi", SE: "Ruotsi", NO: "Norja" } },
  en: { filename: "receipt", title: "Receipt", sellerReceipt: "SELLER RECEIPT", receipt: "RECEIPT", receiptNumber: "Receipt number", order: "Order", date: "Date", customer: "CUSTOMER", businessId: "Business ID", product: "Product", quantity: "Quantity", price: "Price", netPrice: "Net price", vat: "VAT", total: "Total", notItemized: "Not itemized", marginAbbr: "Margin", deliveryMethod: "Delivery method", parcel: "Parcel delivery", pickup: "Pickup from seller", paymentMethod: "Payment method", stripePayment: "Stripe payment", stripeProcessor: "Stripe processes the payment", marginScheme: "Margin scheme - Second-hand goods", taxNotItemized: "Tax is not itemized on the receipt.", vatTotal: "Total VAT", detailedNetShare: "Itemized net share", netTotal: "Total net amount", shippingCosts: "Delivery costs", paymentSurcharge: "Payment surcharge", products: "Products", shippingVatNote: "incl. VAT 25.5%", footer: "Stripe processes the payment. Maskines delivers the receipt.", countries: { FI: "Finland", SE: "Sweden", NO: "Norway" } },
  sv: { filename: "kvitto", title: "Kvitto", sellerReceipt: "SÄLJARFÖRETAGETS KVITTO", receipt: "KVITTO", receiptNumber: "Kvittonummer", order: "Beställning", date: "Datum", customer: "KUND", businessId: "Organisationsnummer", product: "Produkt", quantity: "Antal", price: "Pris", netPrice: "Pris exkl. moms", vat: "Moms", total: "Totalt", notItemized: "Specificeras inte", marginAbbr: "Marg.", deliveryMethod: "Leveranssätt", parcel: "Postpaket", pickup: "Hämtning hos säljaren", paymentMethod: "Betalningssätt", stripePayment: "Stripe-betalning", stripeProcessor: "Stripe förmedlar betalningen", marginScheme: "Vinstmarginalbeskattning - Begagnade varor", taxNotItemized: "Skattebeloppet specificeras inte på kvittot.", vatTotal: "Moms totalt", detailedNetShare: "Specificerad andel exkl. moms", netTotal: "Totalt exkl. moms", shippingCosts: "Leveranskostnader", paymentSurcharge: "Betalningsavgift", products: "Produkter", shippingVatNote: "inkl. moms 25,5 %", footer: "Stripe förmedlar betalningen. Maskines levererar kvittot.", countries: { FI: "Finland", SE: "Sverige", NO: "Norge" } },
  no: { filename: "kvittering", title: "Kvittering", sellerReceipt: "SELGERBEDRIFTENS KVITTERING", receipt: "KVITTERING", receiptNumber: "Kvitteringsnummer", order: "Ordre", date: "Dato", customer: "KUNDE", businessId: "Organisasjonsnummer", product: "Produkt", quantity: "Antall", price: "Pris", netPrice: "Pris ekskl. MVA", vat: "MVA", total: "Totalt", notItemized: "Ikke spesifisert", marginAbbr: "Avanse", deliveryMethod: "Leveringsmåte", parcel: "Postpakke", pickup: "Henting hos selger", paymentMethod: "Betalingsmåte", stripePayment: "Stripe-betaling", stripeProcessor: "Stripe behandler betalingen", marginScheme: "Avanseordning - Brukte varer", taxNotItemized: "Avgiftsbeløpet spesifiseres ikke på kvitteringen.", vatTotal: "MVA totalt", detailedNetShare: "Spesifisert nettoandel", netTotal: "Totalt ekskl. MVA", shippingCosts: "Leveringskostnader", paymentSurcharge: "Betalingstillegg", products: "Produkter", shippingVatNote: "inkl. MVA 25,5 %", footer: "Stripe behandler betalingen. Maskines leverer kvitteringen.", countries: { FI: "Finland", SE: "Sverige", NO: "Norge" } }
} satisfies Record<EmailLocale, Record<string, unknown>>;

function euro(cents: number, locale: EmailLocale) { return new Intl.NumberFormat(emailLocaleTag(locale), { style: "currency", currency: "EUR" }).format(cents / 100); }
function dateTime(value: string | Date | null | undefined, locale: EmailLocale) { return new Intl.DateTimeFormat(emailLocaleTag(locale), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value ? new Date(value) : new Date()); }
function countryName(country: string | null | undefined, locale: EmailLocale) { const code = country?.trim().toUpperCase() as "FI" | "SE" | "NO" | undefined; return code ? receiptPdfText[locale].countries[code] ?? code : ""; }
function nonEmpty(values: Array<string | null | undefined>) { return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)); }
function safeFilenamePart(value: string) { return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "kuitti"; }
export function receiptPdfFilename(receiptNumber: string, locale: EmailLocale = "fi") { return `${receiptPdfText[locale].filename}-${safeFilenamePart(receiptNumber)}.pdf`; }

export async function createReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
  const { order, items, company, receiptNumber, customerDelivery } = input;
  const locale = input.locale ?? "fi";
  const copy = receiptPdfText[locale];
  const doc = new PDFDocument({ size: "A4", margins: { top: 34, right: 34, bottom: 54, left: 34 }, bufferPages: true, info: { Title: `${copy.title} ${receiptNumber}`, Author: order.seller_name_snapshot || company.name, Subject: `${copy.order} ${order.order_number}`, Creator: "Maskines" } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width;
  const width = pageWidth - doc.page.margins.left - doc.page.margins.right;
  const right = left + width;
  const marginItems = items.filter((item) => usesMarginScheme(item.vat_rate));
  const normalItems = items.filter((item) => !usesMarginScheme(item.vat_rate));
  const shippingVat = order.shipping_method !== "pickup" ? vatFromGrossCents(order.shipping_price_cents, SHIPPING_VAT_RATE) : 0;

  function band(y: number, label = "") { doc.rect(left, y, width, 20).fill(C.band); if (label) doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.ink).text(label, left + 6, y + 6, { lineBreak: false }); }
  function metaRow(label: string, value: string, y: number) { doc.font("Helvetica").fontSize(8.3).fillColor(C.muted).text(label, right - 176, y, { width: 88, lineBreak: false }); doc.font("Helvetica-Bold").fillColor(C.ink).text(value, right - 88, y, { width: 88, align: "right", lineBreak: false }); }
  function pageFooter(pageIndex: number, pageCount: number) {
    const footerY = doc.page.height - doc.page.margins.bottom - 17;
    doc.moveTo(left, footerY - 9).lineTo(right, footerY - 9).strokeColor(C.line).stroke();
    doc.font("Helvetica-Bold").fontSize(7.8).fillColor(C.ink).text(order.seller_name_snapshot || company.name, left, footerY, { width: 145, lineBreak: false });
    doc.font("Helvetica").fontSize(7.3).fillColor(C.muted).text(company.email || "", left + 150, footerY, { width: 145, lineBreak: false });
    doc.text(`${copy.businessId} ${order.seller_business_id_snapshot || company.business_id}`, left + 300, footerY, { width: 125, lineBreak: false });
    doc.text(`${pageIndex + 1}/${pageCount}`, right - 30, footerY, { width: 30, align: "right", lineBreak: false });
    const address = nonEmpty([company.address_line, [company.postal_code, company.city].filter(Boolean).join(" "), countryName(company.country, locale)]).join(", ");
    doc.fontSize(6.8).text(`${address}  |  ${copy.footer}`, left, footerY + 13, { width: width - 40, height: 9, lineBreak: false });
  }

  doc.font("Helvetica-Bold").fontSize(25).fillColor(C.ink).text(order.seller_name_snapshot || company.name, left, 42, { width: 320, lineBreak: false, ellipsis: true });
  doc.rect(left, 76, 78, 4).fill(C.orange);
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.muted).text(copy.sellerReceipt, left, 88, { characterSpacing: 1.1, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(15).fillColor(C.ink).text(copy.receipt, right - 176, 43, { width: 176, lineBreak: false });
  metaRow(copy.receiptNumber, receiptNumber, 68);
  metaRow(copy.order, order.order_number, 83);
  metaRow(copy.date, dateTime(order.paid_at || input.issuedAt || order.created_at, locale), 98);

  const buyerAddress = nonEmpty([order.buyer_company_address || customerDelivery?.address, order.buyer_company_address ? null : [customerDelivery?.postalCode, customerDelivery?.city].filter(Boolean).join(" "), order.buyer_company_address ? null : countryName(customerDelivery?.country, locale)]);
  const buyer = nonEmpty([order.buyer_company_name || order.customer_name, order.buyer_business_id ? `${copy.businessId}: ${order.buyer_business_id}` : null, ...buyerAddress, "", order.buyer_company_email || order.customer_email, order.buyer_company_phone || order.customer_phone]);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.ink).text(copy.customer, left, 132, { lineBreak: false });
  doc.font("Helvetica").fontSize(8.5).fillColor(C.ink).text(buyer.join("\n"), left, 148, { width: 235, lineGap: 1.3 });

  let y = 238;
  const columns = [
    { title: copy.product, x: left, w: 225, align: "left" as const },
    { title: copy.quantity, x: left + 225, w: 44, align: "right" as const },
    { title: copy.price, x: left + 269, w: 68, align: "right" as const },
    { title: copy.netPrice, x: left + 337, w: 73, align: "right" as const },
    { title: copy.vat, x: left + 410, w: 55, align: "right" as const },
    { title: copy.total, x: left + 465, w: width - 465, align: "right" as const },
  ];
  function productHeader() { band(y); for (const column of columns) doc.font("Helvetica-Bold").fontSize(7.3).fillColor(C.ink).text(column.title, column.x + 5, y + 6, { width: column.w - 10, align: column.align, lineBreak: false }); y += 26; }
  productHeader();

  for (const item of items) {
    const margin = usesMarginScheme(item.vat_rate);
    const detail = margin ? copy.marginScheme : item.product_description_snapshot;
    doc.font("Helvetica-Bold").fontSize(8.5);
    const titleHeight = doc.heightOfString(item.product_name, { width: columns[0].w - 12 });
    doc.font("Helvetica").fontSize(7);
    const detailHeight = detail ? doc.heightOfString(detail, { width: columns[0].w - 12 }) : 0;
    const rowHeight = Math.max(38, titleHeight + detailHeight + 15);
    if (y + rowHeight > doc.page.height - 205) { doc.addPage(); y = 44; productHeader(); }
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.ink).text(item.product_name, columns[0].x + 5, y + 5, { width: columns[0].w - 12 });
    if (detail) doc.font("Helvetica").fontSize(7).fillColor(margin ? C.orange : C.muted).text(detail, columns[0].x + 5, y + 8 + titleHeight, { width: columns[0].w - 12, height: detailHeight + 3, ellipsis: true });
    const lineNet = margin ? null : Math.max(0, item.line_total_cents - item.vat_cents);
    const values = [String(item.quantity), euro(item.unit_price_cents, locale), lineNet == null ? copy.notItemized : euro(lineNet, locale), margin ? copy.marginAbbr : `${displayedVatRate(item.vat_rate).toLocaleString(emailLocaleTag(locale))} %`, euro(item.line_total_cents, locale)];
    values.forEach((value, index) => doc.font(index === 4 ? "Helvetica-Bold" : "Helvetica").fontSize(index === 2 && margin ? 6.6 : 8).fillColor(C.ink).text(value, columns[index + 1].x + 5, y + 10, { width: columns[index + 1].w - 10, align: "right", lineBreak: false }));
    y += rowHeight;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(C.line).stroke();
    y += 5;
  }

  band(y, copy.deliveryMethod);
  doc.font("Helvetica-Bold").fontSize(7.3).fillColor(C.ink).text(copy.netPrice, left + 337, y + 6, { width: 73, align: "right", lineBreak: false });
  doc.text(copy.vat, left + 410, y + 6, { width: 55, align: "right", lineBreak: false });
  doc.text(copy.total, left + 465, y + 6, { width: width - 465, align: "right", lineBreak: false });
  y += 27;
  const deliveryName = order.shipping_method === "posti" && order.shipping_price_cents > 0 ? `${copy.parcel} (${copy.shippingVatNote})` : order.shipping_method === "posti" ? copy.parcel : copy.pickup;
  const deliveryDetails = order.shipping_method !== "pickup" ? nonEmpty([order.pickup_point_name, order.pickup_point_address]).join("\n") : nonEmpty(items.map((item) => item.pickup_address_snapshot)).join("\n");
  doc.font("Helvetica-Bold").fontSize(8.7).fillColor(C.ink).text(deliveryName, left + 5, y, { lineBreak: false });
  doc.font("Helvetica").fontSize(7.2).fillColor(C.muted).text(deliveryDetails, left + 5, y + 13, { width: 260, height: 26, ellipsis: true });
  doc.fontSize(8).fillColor(C.ink).text(euro(Math.max(0, order.shipping_price_cents - shippingVat), locale), left + 342, y + 9, { width: 68, align: "right", lineBreak: false });
  doc.text(shippingVat > 0 ? euro(shippingVat, locale) : "-", left + 415, y + 9, { width: 50, align: "right", lineBreak: false });
  doc.font("Helvetica-Bold").text(euro(order.shipping_price_cents, locale), left + 470, y + 9, { width: width - 470, align: "right", lineBreak: false });
  y += 50;

  band(y, copy.paymentMethod);
  y += 27;
  doc.font("Helvetica-Bold").fontSize(8.7).fillColor(C.ink).text(copy.stripePayment, left + 5, y, { lineBreak: false });
  doc.font("Helvetica").fontSize(7.2).fillColor(C.muted).text(copy.stripeProcessor, left + 5, y + 13, { lineBreak: false });
  doc.fontSize(8).fillColor(C.ink).text(euro(0, locale), left + 342, y + 8, { width: 68, align: "right", lineBreak: false });
  doc.text(euro(0, locale), left + 415, y + 8, { width: 50, align: "right", lineBreak: false });
  doc.font("Helvetica-Bold").text(euro(0, locale), left + 470, y + 8, { width: width - 470, align: "right", lineBreak: false });
  y += 48;

  if (marginItems.length) { doc.font("Helvetica-Bold").fontSize(8).fillColor(C.orange).text(copy.marginScheme, left + 5, y, { width: 245, lineBreak: false }); doc.font("Helvetica").fontSize(7).fillColor(C.muted).text(copy.taxNotItemized, left + 5, y + 13, { width: 245, lineBreak: false }); }
  if (normalItems.length || shippingVat > 0) { const normalVat = normalItems.reduce((sum, item) => sum + item.vat_cents, 0) + shippingVat; const normalGross = normalItems.reduce((sum, item) => sum + item.line_total_cents, 0) + order.shipping_price_cents; doc.font("Helvetica").fontSize(8).fillColor(C.ink).text(`${copy.vatTotal}: ${euro(normalVat, locale)}`, left + 5, y + (marginItems.length ? 31 : 0), { width: 245, lineBreak: false }); doc.text(`${marginItems.length ? copy.detailedNetShare : copy.netTotal}: ${euro(Math.max(0, normalGross - normalVat), locale)}`, left + 5, y + (marginItems.length ? 45 : 14), { width: 245, lineBreak: false }); }
  const totalsX = right - 238;
  const shippingTotalLabel = order.shipping_method !== "pickup" && order.shipping_price_cents > 0 ? `${copy.shippingCosts} (${copy.shippingVatNote})` : copy.shippingCosts;
  const totalRows: Array<[string, string, boolean?]> = [[copy.products, euro(items.reduce((sum, item) => sum + item.line_total_cents, 0), locale)], [shippingTotalLabel, euro(order.shipping_price_cents, locale)], [copy.paymentSurcharge, euro(0, locale)], [copy.total, euro(order.total_cents, locale), true]];
  totalRows.forEach(([label, value, strong], index) => { const rowY = y + index * 17; doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 11 : 8.5).fillColor(C.ink).text(label, totalsX, rowY, { width: 126, lineBreak: false }); doc.text(value, totalsX + 126, rowY, { width: 112, align: "right", lineBreak: false }); });

  const pages = doc.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) { doc.switchToPage(index); pageFooter(index, pages.count); }
  doc.end();
  return done;
}
