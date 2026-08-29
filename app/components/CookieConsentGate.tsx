"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronDown, Cookie, Globe2, LockKeyhole, Monitor, Moon, Palette, ShieldCheck, Sun, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { COOKIE_CONSENT_EVENT, readCookieConsent, readCookieConsentSettings, saveCookieConsent, type CookieConsentChoice, type CookieConsentSettings } from "@/lib/cookie-consent";
import { applyLocale, isLocale, type SupportedLocale } from "@/lib/i18n";
import { canonicalPathFromLocalized, pagePath } from "@/lib/routes";
import { applyUserTheme, readUserSettings, saveUserSettings, type UserTheme } from "@/lib/user-settings";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/currency";
import { buildCountryFlagInfo } from "@/lib/country-flags";
import { useCurrency } from "./CurrencyProvider";
import MaskinesWordmark from "./MaskinesWordmark";

type WelcomeCopy = {
  welcome: string; intro: string; serviceTitle: string; serviceIntro: string;
  language: string; currency: string; theme: string;
  dark: string; light: string; system: string; cookies: string; cookiesIntro: string;
  necessary: string; necessaryText: string; analytics: string; analyticsText: string;
  save: string; essential: string; close: string; policy: string; privacy: string;
};

const WELCOME_COPY: Record<SupportedLocale, WelcomeCopy> = {
  en: {
    welcome: "Welcome to Maskines", intro: "Choose your preferences before continuing to the marketplace.",
    serviceTitle: "What can you do on Maskines?",
    serviceIntro: "Buy and sell spare parts, vehicles and riding gear, and find enthusiasts and businesses across the Nordics.",
    language: "Language", currency: "Currency", theme: "Theme", dark: "Dark", light: "Light", system: "System",
    cookies: "Cookies", cookiesIntro: "Choose which cookies you allow.", necessary: "Essential cookies",
    necessaryText: "Required for the site to work.", analytics: "Analytics and personalisation",
    analyticsText: "Helps us improve the service and recommendations.", save: "Save and continue",
    essential: "Essential only", close: "Continue with essential cookies", policy: "Cookie policy", privacy: "Privacy notice"
  },
  fi: {
    welcome: "Tervetuloa Maskinesiin", intro: "Valitse asetukset ennen kuin jatkat markkinapaikalle.",
    serviceTitle: "Mitä Maskinesissa voi tehdä?",
    serviceIntro: "Maskinesissa voit ostaa ja myydä varaosia, ajoneuvoja ja ajovarusteita sekä löytää harrastajia ja alan yrityksiä eri puolilta Pohjoismaita.",
    language: "Kieli", currency: "Valuutta", theme: "Teema", dark: "Tumma", light: "Vaalea", system: "Järjestelmä",
    cookies: "Evästeet", cookiesIntro: "Valitse, mitä evästeitä sallit.", necessary: "Välttämättömät evästeet",
    necessaryText: "Tarvitaan sivuston toimintaan.", analytics: "Analytiikka ja personointi",
    analyticsText: "Auttaa meitä kehittämään palvelua ja suosituksia.", save: "Tallenna ja jatka",
    essential: "Vain välttämättömät", close: "Jatka välttämättömillä evästeillä", policy: "Evästekäytäntö", privacy: "Tietosuojaseloste"
  },
  sv: {
    welcome: "Välkommen till Maskines", intro: "Välj dina inställningar innan du fortsätter till marknadsplatsen.",
    serviceTitle: "Vad kan du göra på Maskines?",
    serviceIntro: "Köp och sälj reservdelar, fordon och körutrustning, och hitta entusiaster och företag i hela Norden.",
    language: "Språk", currency: "Valuta", theme: "Tema", dark: "Mörkt", light: "Ljust", system: "System",
    cookies: "Cookies", cookiesIntro: "Välj vilka cookies du tillåter.", necessary: "Nödvändiga cookies",
    necessaryText: "Krävs för att webbplatsen ska fungera.", analytics: "Analys och anpassning",
    analyticsText: "Hjälper oss att förbättra tjänsten och rekommendationerna.", save: "Spara och fortsätt",
    essential: "Endast nödvändiga", close: "Fortsätt med nödvändiga cookies", policy: "Cookiepolicy", privacy: "Integritetspolicy"
  },
  no: {
    welcome: "Velkommen til Maskines", intro: "Velg innstillingene dine før du fortsetter til markedsplassen.",
    serviceTitle: "Hva kan du gjøre på Maskines?",
    serviceIntro: "Kjøp og selg reservedeler, kjøretøy og kjøreutstyr, og finn entusiaster og bedrifter i hele Norden.",
    language: "Språk", currency: "Valuta", theme: "Tema", dark: "Mørkt", light: "Lyst", system: "System",
    cookies: "Informasjonskapsler", cookiesIntro: "Velg hvilke informasjonskapsler du tillater.", necessary: "Nødvendige informasjonskapsler",
    necessaryText: "Kreves for at nettstedet skal fungere.", analytics: "Analyse og tilpasning",
    analyticsText: "Hjelper oss å forbedre tjenesten og anbefalingene.", save: "Lagre og fortsett",
    essential: "Kun nødvendige", close: "Fortsett med nødvendige informasjonskapsler",
    policy: "Retningslinjer for informasjonskapsler", privacy: "Personvern"
  }
};

const LANGUAGE_OPTIONS: Array<{ value: SupportedLocale; label: string }> = [
  { value: "en", label: "English" }, { value: "fi", label: "Suomi" },
  { value: "sv", label: "Svenska" }, { value: "no", label: "Norsk" }
];

const CURRENCY_LABELS: Record<SupportedCurrency, string> = { EUR: "EUR (€)", SEK: "SEK (kr)", NOK: "NOK (kr)" };

function ConsentToggle({ checked, label, locked = false, onChange }: { checked: boolean; label: string; locked?: boolean; onChange?: () => void }) {
  return <button type="button" className={`welcome-consent-switch${checked ? " is-on" : ""}${locked ? " is-locked" : ""}`} aria-checked={checked} aria-label={label} disabled={locked} onClick={onChange} role="switch"><span /></button>;
}

function LanguageFlag({ locale }: { locale: SupportedLocale }) {
  const countryCode = locale === "en" ? "GB" : locale === "fi" ? "FI" : locale === "sv" ? "SE" : "NO";
  const flag = buildCountryFlagInfo(countryCode);
  return flag ? <img className="welcome-language-flag" src={flag.src} alt="" aria-hidden="true" /> : null;
}

export default function CookieConsentGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currency, setCurrency } = useCurrency();
  const [choice, setChoice] = useState<CookieConsentChoice | null>(null);
  const [checked, setChecked] = useState(false);
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [theme, setTheme] = useState<UserTheme>("dark");
  const [optionalCookies, setOptionalCookies] = useState(false);
  const canonicalPathname = canonicalPathFromLocalized(pathname || "/");
  const isPolicyPage = canonicalPathname === "/cookies" || canonicalPathname === "/privacy";
  const isBlocked = checked && !choice && !isPolicyPage;
  const text = WELCOME_COPY[locale];

  useEffect(() => {
    const storedChoice = readCookieConsent();
    const documentLocale = document.documentElement.lang;
    const nextLocale = storedChoice && isLocale(documentLocale) ? documentLocale : "en";
    const storedSettings = readCookieConsentSettings();
    setLocale(nextLocale);
    setChoice(storedChoice);
    setOptionalCookies(storedSettings.analytics && storedSettings.personalization);
    const userSettings = readUserSettings();
    setTheme(userSettings.theme);
    applyUserTheme(userSettings.theme);
    setChecked(true);
    if (!storedChoice) applyLocale("en");
    const handleConsentChange = () => setChoice(readCookieConsent());
    const handleLocaleChange = (event: Event) => {
      const next = (event as CustomEvent<SupportedLocale>).detail;
      if (isLocale(next)) setLocale(next);
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    window.addEventListener("localechange", handleLocaleChange);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
      window.removeEventListener("localechange", handleLocaleChange);
    };
  }, []);

  useEffect(() => {
    if (!isBlocked) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isBlocked]);

  function chooseLocale(nextLocale: SupportedLocale) { setLocale(nextLocale); setLanguageMenuOpen(false); applyLocale(nextLocale); }
  function chooseTheme(nextTheme: UserTheme) {
    setTheme(nextTheme); applyUserTheme(nextTheme); saveUserSettings({ ...readUserSettings(), theme: nextTheme });
  }
  function finish(nextChoice: CookieConsentChoice, nextSettings: CookieConsentSettings) {
    saveCookieConsent(nextChoice, nextSettings); setChoice(nextChoice);
  }
  function saveAndContinue() {
    const settings = { analytics: optionalCookies, personalization: optionalCookies };
    finish(optionalCookies ? "all" : "essential", settings);
  }
  function useEssentialOnly() { finish("essential", { analytics: false, personalization: false }); }

  return (
    <>
      <div className={isBlocked ? "cookie-consent-site cookie-consent-site-blocked" : "cookie-consent-site"}>{children}</div>
      {isBlocked ? (
        <div className="welcome-consent-backdrop" role="presentation">
          <section className="welcome-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-consent-title" aria-describedby="welcome-consent-description" data-no-auto-translate>
            <div className="welcome-consent-brand-row">
              <span className="welcome-consent-brand" aria-label="Maskines">
                <span className="welcome-consent-brand-mark" aria-hidden="true">
                  <img className="welcome-consent-brand-mark-light" src="/maskines-brand-mark-clean-v4.png" alt="" />
                  <img className="welcome-consent-brand-mark-dark" src="/maskines-brand-mark-dark-clean-v4.png" alt="" />
                </span>
                <MaskinesWordmark className="welcome-consent-wordmark" />
              </span>
              <button type="button" className="welcome-consent-close" aria-label={text.close} onClick={useEssentialOnly}><X aria-hidden="true" /></button>
            </div>

            <header className="welcome-consent-heading">
              <h2 id="welcome-consent-title">{text.welcome}</h2>
              <p id="welcome-consent-description">{text.intro}</p>
            </header>

            <section className="welcome-consent-service-intro" aria-labelledby="welcome-consent-service-title">
              <strong id="welcome-consent-service-title">{text.serviceTitle}</strong>
              <p>{text.serviceIntro}</p>
            </section>

            <div className="welcome-consent-preferences">
              <div className="welcome-consent-field">
                <span><Globe2 aria-hidden="true" /><strong>{text.language}</strong></span>
                <div className={`welcome-language-picker${languageMenuOpen ? " is-open" : ""}`}>
                  <button type="button" className="welcome-language-trigger" aria-expanded={languageMenuOpen} aria-haspopup="listbox" onClick={() => setLanguageMenuOpen((open) => !open)}>
                    <span><LanguageFlag locale={locale} />{LANGUAGE_OPTIONS.find((option) => option.value === locale)?.label}</span><ChevronDown aria-hidden="true" />
                  </button>
                  {languageMenuOpen ? <div className="welcome-language-menu" role="listbox" aria-label={text.language}>{LANGUAGE_OPTIONS.map((option) => <button key={option.value} type="button" className={locale === option.value ? "is-selected" : ""} role="option" aria-selected={locale === option.value} onClick={() => chooseLocale(option.value)}><LanguageFlag locale={option.value} /><span>{option.label}</span></button>)}</div> : null}
                </div>
              </div>

              <label className="welcome-consent-field">
                <span><span className="welcome-consent-currency-icon" aria-hidden="true">€</span><strong>{text.currency}</strong></span>
                <span className="welcome-consent-select-wrap"><select value={currency} onChange={(event) => setCurrency(event.target.value as SupportedCurrency)}>{SUPPORTED_CURRENCIES.map((option) => <option key={option} value={option}>{CURRENCY_LABELS[option]}</option>)}</select><ChevronDown aria-hidden="true" /></span>
              </label>

              <div className="welcome-consent-theme" role="group" aria-labelledby="welcome-consent-theme-label">
                <span className="welcome-consent-section-label"><Palette aria-hidden="true" /><strong id="welcome-consent-theme-label">{text.theme}</strong></span>
                <div className="welcome-consent-theme-options">
                  {([{ value: "dark" as const, label: text.dark, icon: Moon }, { value: "light" as const, label: text.light, icon: Sun }, { value: "system" as const, label: text.system, icon: Monitor }]).map((option) => {
                    const Icon = option.icon;
                    return <button key={option.value} type="button" className={theme === option.value ? "is-active" : ""} aria-pressed={theme === option.value} onClick={() => chooseTheme(option.value)}><Icon aria-hidden="true" /><span>{option.label}</span></button>;
                  })}
                </div>
              </div>
            </div>

            <section className="welcome-consent-cookie-section" aria-labelledby="welcome-consent-cookie-title">
              <div className="welcome-consent-cookie-title"><Cookie aria-hidden="true" /><div><h3 id="welcome-consent-cookie-title">{text.cookies}</h3><p>{text.cookiesIntro}</p></div></div>
              <div className="welcome-consent-cookie-card"><ShieldCheck aria-hidden="true" /><div><strong>{text.necessary}</strong><p>{text.necessaryText}</p></div><span className="welcome-consent-lock"><LockKeyhole aria-hidden="true" /></span><ConsentToggle checked label={text.necessary} locked /></div>
              <div className="welcome-consent-cookie-card"><BarChart3 aria-hidden="true" /><div><strong>{text.analytics}</strong><p>{text.analyticsText}</p></div><ConsentToggle checked={optionalCookies} label={text.analytics} onChange={() => setOptionalCookies((current) => !current)} /></div>
            </section>

            <div className="welcome-consent-actions"><button type="button" className="welcome-consent-save" onClick={saveAndContinue}>{text.save}</button><button type="button" className="welcome-consent-essential" onClick={useEssentialOnly}>{text.essential}</button></div>
            <footer className="welcome-consent-links"><Link href={pagePath("cookies", locale)}>{text.policy}</Link><span aria-hidden="true" /><Link href={pagePath("privacy", locale)}>{text.privacy}</Link></footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
