"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  FALLBACK_CURRENCY_RATES,
  convertFromEur,
  convertToEur,
  defaultCurrencyForLocale,
  formatCurrencyAmount,
  isSupportedCurrency,
  type CurrencyRates,
  type SupportedCurrency
} from "@/lib/currency";

const CURRENCY_STORAGE_KEY = "maskines-display-currency-v1";

type CurrencyContextValue = {
  currency: SupportedCurrency;
  rates: CurrencyRates;
  setCurrency: (currency: SupportedCurrency) => void;
  formatAmount: (amount: number, targetCurrency?: SupportedCurrency) => string;
  formatFromEur: (amountEur: number) => string;
  fromEur: (amountEur: number, targetCurrency?: SupportedCurrency) => number;
  toEur: (amount: number, sourceCurrency?: SupportedCurrency) => number;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export default function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>("EUR");
  const [rates, setRates] = useState<CurrencyRates>(FALLBACK_CURRENCY_RATES);
  const [locale, setLocale] = useState("fi");

  useEffect(() => {
    const activeLocale = document.documentElement.lang || localStorage.getItem("locale") || "fi";
    const storedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);
    setLocale(activeLocale);
    setCurrencyState(isSupportedCurrency(storedCurrency) ? storedCurrency : defaultCurrencyForLocale(activeLocale));

    void fetch("/api/exchange-rates", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Kurssien lataus epäonnistui.")))
      .then((body: { rates?: Partial<CurrencyRates> }) => {
        setRates({
          EUR: 1,
          SEK: Number(body.rates?.SEK) || FALLBACK_CURRENCY_RATES.SEK,
          NOK: Number(body.rates?.NOK) || FALLBACK_CURRENCY_RATES.NOK
        });
      })
      .catch(() => setRates(FALLBACK_CURRENCY_RATES));

    const handleLocaleChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<string>).detail;
      setLocale(nextLocale || document.documentElement.lang || "en");
    };
    window.addEventListener("localechange", handleLocaleChange);
    return () => window.removeEventListener("localechange", handleLocaleChange);
  }, []);

  const setCurrency = useCallback((nextCurrency: SupportedCurrency) => {
    setCurrencyState(nextCurrency);
    localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency);
  }, []);

  const value = useMemo<CurrencyContextValue>(() => ({
    currency,
    rates,
    setCurrency,
    formatAmount: (amount, targetCurrency = currency) => formatCurrencyAmount(amount, targetCurrency, locale),
    formatFromEur: (amountEur) => formatCurrencyAmount(convertFromEur(amountEur, currency, rates), currency, locale),
    fromEur: (amountEur, targetCurrency = currency) => convertFromEur(amountEur, targetCurrency, rates),
    toEur: (amount, sourceCurrency = currency) => convertToEur(amount, sourceCurrency, rates)
  }), [currency, locale, rates, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used inside CurrencyProvider");
  return context;
}
