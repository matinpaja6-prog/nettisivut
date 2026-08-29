export const SUPPORTED_CURRENCIES = ["EUR", "SEK", "NOK"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type CurrencyRates = Record<SupportedCurrency, number>;

export const FALLBACK_CURRENCY_RATES: CurrencyRates = {
  EUR: 1,
  SEK: 10.75,
  NOK: 11.35
};

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === "string" && SUPPORTED_CURRENCIES.includes(value as SupportedCurrency);
}

export function defaultCurrencyForLocale(locale: string | null | undefined): SupportedCurrency {
  if (locale === "sv") return "SEK";
  if (locale === "no") return "NOK";
  return "EUR";
}

export function convertFromEur(amountEur: number, currency: SupportedCurrency, rates: CurrencyRates) {
  return amountEur * (rates[currency] || 1);
}

export function convertToEur(amount: number, currency: SupportedCurrency, rates: CurrencyRates) {
  return amount / (rates[currency] || 1);
}

export function formatCurrencyAmount(amount: number, currency: SupportedCurrency, locale = "fi") {
  const language = locale === "sv" ? "sv-SE" : locale === "no" ? "nb-NO" : "fi-FI";
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "EUR" ? 2 : 0
  }).format(amount);
}
