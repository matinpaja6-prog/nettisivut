import type {
  Company,
  Product,
  ProductDraft,
  ShippingPriceStrategy
} from "@/lib/commerce/types";

export const PUBLISH_BLOCKED_MESSAGE =
  "Et voi julkaista tuotteita vielä. Yritysprofiilisi pitää olla vahvistettu ja Stripe-maksujen pitää olla käytössä.";

export function isStripeReady(company: Partial<Company> | null | undefined) {
  return Boolean(
    company?.stripe_account_id &&
    company.stripe_details_submitted === true &&
    company.stripe_charges_enabled === true &&
    company.stripe_payouts_enabled === true
  );
}

export function canPublishProduct(company: Partial<Company> | null | undefined) {
  return company?.verification_status === "approved" && isStripeReady(company);
}

export function companyProfileErrors(input: Partial<Company>) {
  const required: Array<[keyof Company, string]> = [
    ["name", "Yrityksen nimi puuttuu."],
    ["business_id", "Y-tunnus puuttuu."],
    ["address_line", "Katuosoite puuttuu."],
    ["postal_code", "Postinumero puuttuu."],
    ["city", "Kaupunki puuttuu."],
    ["country", "Maa puuttuu."],
    ["email", "Yrityksen sähköposti puuttuu."],
    ["phone", "Puhelinnumero puuttuu."],
    ["contact_person", "Vastuuhenkilön nimi puuttuu."],
    ["description", "Yrityksen kuvaus puuttuu."]
  ];

  return required
    .filter(([key]) => !String(input[key] ?? "").trim())
    .map(([, message]) => message);
}

export function productPublicationErrors(
  product: Partial<Product | ProductDraft>,
  company?: Partial<Company> | null
) {
  const errors: string[] = [];

  if (company && !canPublishProduct(company)) errors.push(PUBLISH_BLOCKED_MESSAGE);
  if (!String(product.name ?? "").trim()) errors.push("Tuotteen nimi puuttuu.");
  if (!Number.isInteger(product.price_cents) || Number(product.price_cents) <= 0) {
    errors.push("Tuotteella pitää olla hinta ennen julkaisua.");
  }
  if (!Number.isInteger(product.stock_quantity) || Number(product.stock_quantity) <= 0) {
    errors.push("Tuotteella pitää olla varastosaldo ennen julkaisua.");
  }
  if (!product.pickup_available && !product.shipping_available) {
    errors.push("Valitse tuotteelle vähintään yksi toimitustapa.");
  }
  if (product.shipping_available) {
    if (!product.posti_enabled) errors.push("Valitse kuljetusyhtiöksi Posti.");
    const finlandShipping = product.shipping_price_fi_cents ?? product.shipping_price_cents;
    const swedenShipping = product.shipping_price_se_cents ?? finlandShipping;
    const norwayShipping = product.shipping_price_no_cents ?? finlandShipping;
    if (finlandShipping === null || finlandShipping === undefined) {
      errors.push("Suomen postituksen hinta puuttuu.");
    }
    if (swedenShipping === null || swedenShipping === undefined) {
      errors.push("Ruotsin postituksen hinta puuttuu.");
    }
    if (norwayShipping === null || norwayShipping === undefined) {
      errors.push("Norjan postituksen hinta puuttuu.");
    }
    if (!positiveNumber(product.max_shipping_quantity)) {
      errors.push("Maksimimäärä yhdessä lähetyksessä puuttuu.");
    }
  }

  return Array.from(new Set(errors));
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

export function productSupportsPickup(product: Pick<Product, "pickup_available">) {
  return product.pickup_available === true;
}

export function productSupportsPosti(
  product: Pick<Product, "shipping_available" | "posti_enabled">
) {
  return product.shipping_available === true && product.posti_enabled === true;
}

export function calculateProductShippingPrice(
  product: Pick<
    Product,
    | "shipping_price_cents"
    | "shipping_price_fi_cents"
    | "shipping_price_se_cents"
    | "shipping_price_no_cents"
    | "shipping_notes"
    | "max_shipping_quantity"
  >,
  quantity: number,
  destinationCountry = "FI"
) {
  const parcels = Math.ceil(quantity / Math.max(1, product.max_shipping_quantity || 1));
  return productShippingPriceForCountry(product, destinationCountry) * parcels;
}

export function productShippingPriceForCountry(
  product: Pick<Product, "shipping_price_cents" | "shipping_price_fi_cents" | "shipping_price_se_cents" | "shipping_price_no_cents" | "shipping_notes">,
  destinationCountry = "FI"
) {
  const country = String(destinationCountry || "FI").trim().toUpperCase();
  const finlandPrice = product.shipping_price_fi_cents ?? product.shipping_price_cents ?? 0;
  const markerNorwayPrice = Number(product.shipping_notes?.match(/\[\[maskines:no_shipping_cents=(\d+)\]\]/)?.[1]);
  const countryPrice = country === "SE"
    ? product.shipping_price_se_cents ?? finlandPrice
    : country === "NO"
      ? product.shipping_price_no_cents ?? (Number.isFinite(markerNorwayPrice) ? markerNorwayPrice : finlandPrice)
      : finlandPrice;
  return Math.max(0, countryPrice);
}

export function calculateCartShippingPrice(
  lines: Array<{ product: Product; quantity: number }>,
  strategy: ShippingPriceStrategy,
  destinationCountry = "FI"
) {
  const prices = lines.map(({ product, quantity }) =>
    calculateProductShippingPrice(product, quantity, destinationCountry)
  );
  if (prices.length === 0) return 0;
  return strategy === "sum"
    ? prices.reduce((sum, price) => sum + price, 0)
    : Math.max(...prices);
}

export function formatPickupAddress(company: Partial<Company>) {
  return [company.address_line, `${company.postal_code ?? ""} ${company.city ?? ""}`.trim(), company.country]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function commerceStatusMessage(company: Partial<Company> | null) {
  if (!company) return "Täytä yritysprofiili ennen myynnin aloittamista.";
  if (company.verification_status === "pending") {
    return "Yritysprofiilisi odottaa Maskinesin vahvistusta.";
  }
  if (company.verification_status === "rejected") {
    return "Yritysprofiilia ei hyväksytty. Tarkista tiedot ja lähetä uudelleen.";
  }
  if (company.verification_status === "suspended") {
    return "Yrityksesi myynti on keskeytetty. Ota yhteyttä Maskinesin ylläpitoon.";
  }
  if (!company.stripe_account_id) {
    return "Yhdistä Stripe-maksut ennen tuotteiden julkaisua.";
  }
  if (!isStripeReady(company)) {
    return "Stripe tarvitsee lisätietoja ennen kuin voit vastaanottaa maksuja.";
  }
  if (company.verification_status === "approved") {
    return "Yrityksesi on vahvistettu ja voit julkaista tuotteita myyntiin.";
  }
  return "Täytä yritysprofiili ennen myynnin aloittamista.";
}
