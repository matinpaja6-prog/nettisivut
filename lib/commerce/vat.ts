export const MARGIN_SCHEME_VAT_RATE = 0;
export const ZERO_VAT_RATE = -2;
export const MARGIN_SCHEME_LABEL = "Marginaalivero - Käytetyt tavarat";
export const SHIPPING_VAT_RATE = 25.5;

export function vatFromGrossCents(grossCents: number, rate: number) {
  if (rate <= 0 || grossCents <= 0) return 0;
  return grossCents - Math.round(grossCents / (1 + rate / 100));
}

export const VAT_RATE_OPTIONS = [
  { value: ZERO_VAT_RATE, label: "ALV 0 %" },
  { value: 25.5, label: "ALV 25,5 %" },
  { value: 24, label: "ALV 24 %" },
  { value: 14, label: "ALV 14 %" },
  { value: 10, label: "ALV 10 %" },
  { value: MARGIN_SCHEME_VAT_RATE, label: MARGIN_SCHEME_LABEL },
] as const;

export function usesMarginScheme(vatRate: number | string | null | undefined) {
  return Number(vatRate) === MARGIN_SCHEME_VAT_RATE;
}

export function displayedVatRate(vatRate: number | string | null | undefined) {
  return Number(vatRate) === ZERO_VAT_RATE ? 0 : Number(vatRate) || 0;
}

export function receiptVatLabel(vatRate: number | string | null | undefined) {
  return usesMarginScheme(vatRate)
    ? MARGIN_SCHEME_LABEL
    : `ALV ${displayedVatRate(vatRate).toLocaleString("fi-FI")} %`;
}
