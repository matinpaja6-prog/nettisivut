import type { Company } from "@/lib/commerce/types";
import { isFeeEstimateMethod } from "@/lib/commerce/fees";

export const COMPANY_MODERN_COLUMNS = [
  "fee_pricing_strategy",
  "fee_estimate_method",
  "default_vat_rate",
  "banner_image_url",
  "social_share_image_url",
  "storefront_headline",
  "storefront_categories",
  "storefront_promo_enabled",
  "storefront_promo_title",
  "storefront_promo_subtitle",
  "storefront_promo_image_url",
  "storefront_promo_background_color",
  "free_shipping_threshold_cents",
  "default_shipping_price_fi_cents",
  "default_shipping_price_se_cents",
  "default_shipping_price_no_cents",
  "shipping_countries",
  "posti_enabled",
  "pickup_email_message"
] as const;

export function cleanStorefrontCategories(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .map((item) => String(item ?? "").replace(/\s+/g, " ").trim().slice(0, 80))
    .filter(Boolean)))
    .slice(0, 6);
}

export function companyRecord(value: Record<string, unknown>) {
  return {
    ...value,
    shipping_price_strategy: value.shipping_price_strategy === "sum" ? "sum" : "max",
    fee_pricing_strategy: value.fee_pricing_strategy === "include" ? "include" : "deduct",
    fee_estimate_method: isFeeEstimateMethod(value.fee_estimate_method)
      ? value.fee_estimate_method
      : "card_standard",
    default_vat_rate: [-2, 0, 10, 14, 24, 25.5].includes(Number(value.default_vat_rate))
      ? Number(value.default_vat_rate)
      : -2,
    stripe_requirements_due: Array.isArray(value.stripe_requirements_due)
      ? value.stripe_requirements_due
      : [],
    banner_image_url: typeof value.banner_image_url === "string" ? value.banner_image_url : null,
    social_share_image_url: typeof value.social_share_image_url === "string" ? value.social_share_image_url : null,
    storefront_headline: typeof value.storefront_headline === "string" ? value.storefront_headline : "",
    storefront_categories: cleanStorefrontCategories(value.storefront_categories),
    storefront_promo_enabled: value.storefront_promo_enabled === true,
    storefront_promo_title: typeof value.storefront_promo_title === "string" ? value.storefront_promo_title : "",
    storefront_promo_subtitle: typeof value.storefront_promo_subtitle === "string" ? value.storefront_promo_subtitle : "",
    storefront_promo_image_url: typeof value.storefront_promo_image_url === "string" ? value.storefront_promo_image_url : null,
    storefront_promo_background_color: /^#[0-9a-f]{6}$/i.test(String(value.storefront_promo_background_color ?? ""))
      ? String(value.storefront_promo_background_color)
      : "#ff6500",
    free_shipping_threshold_cents: Number.isInteger(value.free_shipping_threshold_cents)
      ? Number(value.free_shipping_threshold_cents)
      : null,
    default_shipping_price_fi_cents: Number.isInteger(value.default_shipping_price_fi_cents)
      ? Number(value.default_shipping_price_fi_cents)
      : null,
    default_shipping_price_se_cents: Number.isInteger(value.default_shipping_price_se_cents)
      ? Number(value.default_shipping_price_se_cents)
      : null,
    default_shipping_price_no_cents: Number.isInteger(value.default_shipping_price_no_cents) ? Number(value.default_shipping_price_no_cents) : null,
    shipping_countries: Array.isArray(value.shipping_countries)
      ? value.shipping_countries.map((country) => String(country).toUpperCase()).filter((country) => ["FI", "SE", "NO"].includes(country))
      : ["FI"],
    posti_enabled: value.posti_enabled !== false,
    pickup_email_message: typeof value.pickup_email_message === "string"
      ? value.pickup_email_message
      : ""
  } as Company;
}

export function isMissingCompanyColumn(error: unknown) {
  const record = error as { code?: string; message?: string } | null;
  return record?.code === "42703"
    || record?.code === "PGRST204"
    || /column .* does not exist|could not find the .* column .* schema cache/i.test(record?.message ?? "");
}
