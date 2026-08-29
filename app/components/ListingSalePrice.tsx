import { getListingSalePricing, type Listing } from "@/lib/listings";
import { useCurrency } from "./CurrencyProvider";
import { isSupportedCurrency } from "@/lib/currency";

import styles from "./ListingSalePrice.module.css";

type ListingSalePriceProps = {
  listing: Pick<Listing, "price" | "translations">;
  className?: string;
  detail?: boolean;
  hideBadge?: boolean;
};

export default function ListingSalePrice({ listing, className = "", detail = false, hideBadge = false }: ListingSalePriceProps) {
  const pricing = getListingSalePricing(listing);
  const { currency, formatAmount, formatFromEur } = useCurrency();
  const sourceCurrency = isSupportedCurrency(listing.translations?._meta?.listing_currency)
    ? listing.translations?._meta?.listing_currency
    : "EUR";
  const originalAmount = Number(listing.translations?._meta?.listing_original_price);
  const hasExactOriginalAmount = Number.isFinite(originalAmount) && originalAmount > 0 && sourceCurrency === currency;
  const formattedOriginal = hasExactOriginalAmount
    ? formatAmount(originalAmount, currency)
    : formatFromEur(pricing.originalPrice);
  const formattedCurrent = pricing.onSale
    ? formatFromEur(pricing.currentPrice)
    : formattedOriginal;

  return (
    <p className={`${styles.price}${detail ? ` ${styles.detail}` : ""}${className ? ` ${className}` : ""}`}>
      {pricing.onSale && !hideBadge && <span className={styles.badge}>ALE −{pricing.discountPercent} %</span>}
      <strong>{formattedCurrent}</strong>
      {pricing.onSale && <>{" "}<del>{formattedOriginal}</del></>}
    </p>
  );
}
