import type { CompanyDiscountCode, Product } from "@/lib/commerce/types";

export function normalizedDiscountCode(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase().slice(0, 40);
}

export function activeSalePrice(product: Product, at = new Date()) {
  const sale = product.sale_price_cents;
  if (sale == null || sale < 0 || sale >= product.price_cents) return product.price_cents;
  if (product.sale_starts_at && new Date(product.sale_starts_at) > at) return product.price_cents;
  if (product.sale_ends_at && new Date(product.sale_ends_at) < at) return product.price_cents;
  return sale;
}

export function activeSaleDiscountPercent(product: Product, at = new Date()) {
  const sale = activeSalePrice(product, at);
  if (sale >= product.price_cents || product.price_cents <= 0) return 0;
  return Math.max(1, Math.round((1 - sale / product.price_cents) * 100));
}

export function discountCodeUsable(code: CompanyDiscountCode, subtotalCents: number, at = new Date()) {
  if (!code.active || subtotalCents < code.minimum_order_cents) return false;
  if (code.maximum_uses != null && code.used_count >= code.maximum_uses) return false;
  if (code.starts_at && new Date(code.starts_at) > at) return false;
  if (code.expires_at && new Date(code.expires_at) < at) return false;
  return true;
}

export function discountCodeAmount(code: CompanyDiscountCode, subtotalCents: number) {
  if (!discountCodeUsable(code, subtotalCents)) return 0;
  const amount = code.discount_type === "percent"
    ? Math.round(subtotalCents * Math.min(code.discount_value, 10000) / 10000)
    : code.discount_value;
  return Math.max(0, Math.min(subtotalCents, amount));
}

export function hasFreeShipping(thresholdCents: number | null | undefined, productTotalAfterDiscounts: number) {
  return thresholdCents != null && thresholdCents > 0 && productTotalAfterDiscounts >= thresholdCents;
}
