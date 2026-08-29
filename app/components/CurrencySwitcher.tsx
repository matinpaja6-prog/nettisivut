"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCurrency } from "./CurrencyProvider";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/currency";
import { useLanguage, type Locale } from "@/lib/i18n";

const currencyLabels: Record<SupportedCurrency, string> = {
  EUR: "€ EUR",
  SEK: "kr SEK",
  NOK: "kr NOK"
};

const currencyText: Record<Locale, { show: string; change: string; select: string }> = {
  fi: { show: "Näytettävä valuutta", change: "Vaihda hintojen valuuttaa", select: "Valitse valuutta" },
  en: { show: "Display currency", change: "Change price currency", select: "Select currency" },
  sv: { show: "Visningsvaluta", change: "Ändra prisvaluta", select: "Välj valuta" },
  no: { show: "Visningsvaluta", change: "Endre prisvaluta", select: "Velg valuta" },
};

export default function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  const { locale } = useLanguage();
  const text = currencyText[locale];
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function pickCurrency(nextCurrency: SupportedCurrency) {
    setCurrency(nextCurrency);
    setOpen(false);
  }

  return (
    <div className={`utility-currency-picker${open ? " is-open" : ""}`} ref={pickerRef}>
      <button
        type="button"
        className="currency-switcher"
        title={text.change}
        aria-label={text.show}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{currencyLabels[currency]}</span>
        <ChevronDown className="utility-control-chevron" size={13} aria-hidden="true" />
      </button>
      {open ? (
        <div className="utility-compact-menu utility-currency-menu" role="listbox" aria-label={text.select}>
          {SUPPORTED_CURRENCIES.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={currency === option}
              className={currency === option ? "is-active" : ""}
              key={option}
              onClick={() => pickCurrency(option)}
            >
              <span>{currencyLabels[option]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
