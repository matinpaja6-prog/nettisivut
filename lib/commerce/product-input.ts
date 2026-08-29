import "server-only";

import {
  integer,
  normalizeMultiline,
  normalizeText,
  nullableInteger,
  nullableNumber,
  optionalText
} from "@/lib/commerce/server";
import { grossUpCommercePrice } from "@/lib/commerce/fees";
import type { Company } from "@/lib/commerce/types";
import { VAT_RATE_OPTIONS, ZERO_VAT_RATE } from "@/lib/commerce/vat";

const NORWAY_SHIPPING_MARKER = /\[\[maskines:no_shipping_cents=\d+\]\]/g;

function shippingNotesWithNorwayPrice(value: unknown, norwayPrice: number | null) {
  const visibleNotes = (optionalText(value, 1500) ?? "").replace(NORWAY_SHIPPING_MARKER, "").trim();
  const marker = norwayPrice == null ? "" : `[[maskines:no_shipping_cents=${norwayPrice}]]`;
  return [visibleNotes, marker].filter(Boolean).join("\n") || null;
}

function imageUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .map((url) => String(url ?? "").trim())
    .filter((url) => {
      try {
        return new URL(url).protocol === "https:";
      } catch {
        return false;
      }
    })))
    .slice(0, 12);
}

export function cleanProductBody(
  body: Record<string, unknown>,
  company?: Pick<Company, "fee_pricing_strategy" | "fee_estimate_method" | "default_shipping_price_fi_cents" | "default_shipping_price_se_cents" | "default_shipping_price_no_cents">
) {
  const submittedVatRate = nullableNumber(body.vat_rate, ZERO_VAT_RATE, 100);
  const vatRate = submittedVatRate != null && VAT_RATE_OPTIONS.some((option) => option.value === submittedVatRate)
    ? submittedVatRate
    : ZERO_VAT_RATE;
  const pickupAvailable = body.pickup_available === true;
  const shippingAvailable = body.shipping_available === true;
  const submittedPrice = integer(body.price_cents, 0, 100_000_000);
  const submittedTarget = nullableInteger(body.seller_target_price_cents, 0, 100_000_000);
  const includeFees = company?.fee_pricing_strategy === "include";
  const sellerTarget = includeFees ? (submittedTarget ?? submittedPrice) : null;
  const publicPrice = includeFees && company
    ? grossUpCommercePrice(sellerTarget ?? 0, company.fee_estimate_method)
    : submittedPrice;
  const legacyShippingPrice = nullableInteger(body.shipping_price_cents, 0, 1_000_000);
  const shippingPriceFi = nullableInteger(body.shipping_price_fi_cents, 0, 1_000_000)
    ?? legacyShippingPrice
    ?? company?.default_shipping_price_fi_cents
    ?? null;
  const shippingPriceSe = nullableInteger(body.shipping_price_se_cents, 0, 1_000_000)
    ?? company?.default_shipping_price_se_cents
    ?? shippingPriceFi;
  const shippingPriceNo = nullableInteger(body.shipping_price_no_cents, 0, 1_000_000)
    ?? company?.default_shipping_price_no_cents
    ?? shippingPriceFi;
  return {
    name: normalizeText(body.name, 180),
    description: normalizeMultiline(body.description, 8000),
    storefront_category: optionalText(body.storefront_category, 80),
    price_cents: publicPrice,
    seller_target_price_cents: sellerTarget,
    vat_rate: vatRate,
    stock_quantity: integer(body.stock_quantity, 0, 1_000_000),
    active: body.active === true,
    image_urls: imageUrls(body.image_urls),
    pickup_available: pickupAvailable,
    pickup_address_override: pickupAvailable ? optionalText(body.pickup_address_override, 500) : null,
    pickup_instructions: pickupAvailable ? optionalText(body.pickup_instructions, 1500) : null,
    shipping_available: shippingAvailable,
    posti_enabled: shippingAvailable && body.posti_enabled !== false,
    shipping_price_cents: shippingAvailable ? shippingPriceFi : null,
    shipping_price_fi_cents: shippingAvailable ? shippingPriceFi : null,
    shipping_price_se_cents: shippingAvailable ? shippingPriceSe : null,
    shipping_price_no_cents: shippingAvailable ? shippingPriceNo : null,
    // Ilmainen toimitus määritetään vain yritystasolla.
    free_shipping_threshold_cents: null,
    weight_grams: shippingAvailable ? nullableInteger(body.weight_grams, 1, 1_000_000) : null,
    package_length_cm: shippingAvailable ? nullableNumber(body.package_length_cm, 0.01, 1000) : null,
    package_width_cm: shippingAvailable ? nullableNumber(body.package_width_cm, 0.01, 1000) : null,
    package_height_cm: shippingAvailable ? nullableNumber(body.package_height_cm, 0.01, 1000) : null,
    max_shipping_quantity: shippingAvailable ? integer(body.max_shipping_quantity, 1, 10000) : 1,
    shipping_notes: shippingAvailable ? shippingNotesWithNorwayPrice(body.shipping_notes, shippingPriceNo) : null
  };
}
