"use client";

import { Check, ChevronDown, Monitor, MoonStar, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  applyUserTheme,
  readUserSettings,
  saveUserSettings,
  USER_SETTINGS_EVENT,
  type UserSettings,
  type UserTheme,
} from "@/lib/user-settings";
import { useLanguage, type Locale } from "@/lib/i18n";

const themeText: Record<Locale, { theme: string; change: string; select: string; dark: string; light: string; system: string }> = {
  fi: { theme: "Väriteema", change: "Vaihda väriteemaa", select: "Valitse väriteema", dark: "Tumma", light: "Vaalea", system: "Järjestelmä" },
  en: { theme: "Colour theme", change: "Change colour theme", select: "Select colour theme", dark: "Dark", light: "Light", system: "System" },
  sv: { theme: "Färgtema", change: "Ändra färgtema", select: "Välj färgtema", dark: "Mörkt", light: "Ljust", system: "System" },
  no: { theme: "Fargetema", change: "Endre fargetema", select: "Velg fargetema", dark: "Mørkt", light: "Lyst", system: "System" },
};

export default function ThemeSwitcher() {
  const { locale } = useLanguage();
  const text = themeText[locale];
  const [theme, setTheme] = useState<UserTheme>("dark");
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(readUserSettings().theme);
    const syncTheme = (event: Event) => {
      const settings = (event as CustomEvent<UserSettings>).detail;
      setTheme(settings?.theme ?? readUserSettings().theme);
    };
    window.addEventListener(USER_SETTINGS_EVENT, syncTheme);
    return () => window.removeEventListener(USER_SETTINGS_EVENT, syncTheme);
  }, []);

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

  function changeTheme(nextTheme: UserTheme) {
    setTheme(nextTheme);
    applyUserTheme(nextTheme);
    saveUserSettings({ ...readUserSettings(), theme: nextTheme });
    setOpen(false);
  }

  const themeOptions: Array<{ value: UserTheme; label: string }> = [
    { value: "dark", label: text.dark },
    { value: "light", label: text.light },
    { value: "system", label: text.system }
  ];

  const currentLabel = themeOptions.find((option) => option.value === theme)?.label ?? text.dark;
  const ThemeIcon = theme === "light" ? Sun : theme === "system" ? Monitor : MoonStar;

  return (
    <div className={`utility-theme-picker${open ? " is-open" : ""}`} ref={pickerRef}>
      <button
        type="button"
        className="utility-theme-switcher"
        title={text.change}
        aria-label={text.theme}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ThemeIcon size={14} aria-hidden="true" />
        <span>{currentLabel}</span>
        <ChevronDown className="utility-control-chevron" size={13} aria-hidden="true" />
      </button>
      {open ? (
        <div className="utility-compact-menu utility-theme-menu" role="listbox" aria-label={text.select}>
          {themeOptions.map((option) => {
            const OptionIcon = option.value === "light" ? Sun : option.value === "system" ? Monitor : MoonStar;
            return (
              <button
                type="button"
                role="option"
                aria-selected={theme === option.value}
                className={theme === option.value ? "is-active" : ""}
                key={option.value}
                onClick={() => changeTheme(option.value)}
              >
                <OptionIcon size={15} aria-hidden="true" />
                <span>{option.label}</span>
                {theme === option.value ? <Check size={14} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
