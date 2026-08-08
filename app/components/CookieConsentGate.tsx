"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronRight,
  Cookie,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  COOKIE_CONSENT_EVENT,
  readCookieConsent,
  readCookieConsentSettings,
  saveCookieConsent,
  type CookieConsentChoice,
  type CookieConsentSettings
} from "@/lib/cookie-consent";
import { canonicalPathFromLocalized, pagePath } from "@/lib/routes";
import { isLocale, type SupportedLocale } from "@/lib/i18n";

type ConsentCopy = {
  eyebrow: string;
  title: string;
  description: string;
  essential: string;
  acceptAll: string;
  save: string;
  necessaryTitle: string;
  necessaryText: string;
  alwaysOn: string;
  analyticsTitle: string;
  analyticsText: string;
  personalizationTitle: string;
  personalizationText: string;
  policy: string;
  privacy: string;
};

const fiCopy: ConsentCopy = {
  eyebrow: "Evästeasetukset",
  title: "Valitse evästeet",
  description: "Maskines käyttää välttämättömiä evästeitä kirjautumiseen, turvallisuuteen ja palvelun toimintaan. Voit myös sallia analytiikka- ja personointievästeet, jotka auttavat meitä kehittämään palvelua.",
  essential: "Vain välttämättömät",
  acceptAll: "Hyväksy kaikki",
  save: "Tallenna valinnat",
  necessaryTitle: "Välttämättömät",
  necessaryText: "Tarpeelliset kirjautumiseen, turvallisuuteen ja palvelun toimintaan.",
  alwaysOn: "Aina käytössä",
  analyticsTitle: "Analytiikka",
  analyticsText: "Auttaa meitä ymmärtämään, miten palvelua käytetään.",
  personalizationTitle: "Personointi",
  personalizationText: "Mahdollistaa yksilöllisen käyttökokemuksen ja suositukset.",
  policy: "Evästekäytäntö",
  privacy: "Tietosuojaseloste"
};

const copy: Record<string, ConsentCopy> = {
  fi: fiCopy,
  en: {
    eyebrow: "Cookie settings",
    title: "Choose cookies",
    description: "Maskines uses essential cookies for login, security and core service functionality. You can also allow analytics and personalisation cookies, which help us improve the service.",
    essential: "Essential only",
    acceptAll: "Accept all",
    save: "Save choices",
    necessaryTitle: "Essential",
    necessaryText: "Required for login, security and core service functionality.",
    alwaysOn: "Always on",
    analyticsTitle: "Analytics",
    analyticsText: "Helps us understand how the service is used.",
    personalizationTitle: "Personalisation",
    personalizationText: "Enables a personalised experience and recommendations.",
    policy: "Cookie policy",
    privacy: "Privacy notice"
  },
  sv: {
    eyebrow: "Cookieinställningar",
    title: "Välj cookies",
    description: "Maskines använder nödvändiga cookies för inloggning, säkerhet och tjänstens grundfunktioner. Du kan också tillåta cookies för analys och anpassning, som hjälper oss att förbättra tjänsten.",
    essential: "Endast nödvändiga",
    acceptAll: "Godkänn alla",
    save: "Spara val",
    necessaryTitle: "Nödvändiga",
    necessaryText: "Krävs för inloggning, säkerhet och tjänstens grundfunktioner.",
    alwaysOn: "Alltid aktiva",
    analyticsTitle: "Analys",
    analyticsText: "Hjälper oss att förstå hur tjänsten används.",
    personalizationTitle: "Anpassning",
    personalizationText: "Möjliggör en individuell upplevelse och rekommendationer.",
    policy: "Cookiepolicy",
    privacy: "Integritetspolicy"
  },
  no: {
    eyebrow: "Innstillinger for informasjonskapsler",
    title: "Velg informasjonskapsler",
    description: "Maskines bruker nødvendige informasjonskapsler for innlogging, sikkerhet og grunnleggende tjenestefunksjoner. Du kan også tillate informasjonskapsler for analyse og tilpasning, som hjelper oss med å forbedre tjenesten.",
    essential: "Kun nødvendige",
    acceptAll: "Godta alle",
    save: "Lagre valg",
    necessaryTitle: "Nødvendige",
    necessaryText: "Kreves for innlogging, sikkerhet og grunnleggende tjenestefunksjoner.",
    alwaysOn: "Alltid aktiv",
    analyticsTitle: "Analyse",
    analyticsText: "Hjelper oss å forstå hvordan tjenesten brukes.",
    personalizationTitle: "Tilpasning",
    personalizationText: "Gir en personlig opplevelse og anbefalinger.",
    policy: "Retningslinjer for informasjonskapsler",
    privacy: "Personvern"
  }
};

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      className={`cookie-switch${checked ? " cookie-switch-on" : ""}`}
      aria-checked={checked}
      aria-label={label}
      role="switch"
      onClick={onChange}
    >
      <span />
    </button>
  );
}

export default function CookieConsentGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [choice, setChoice] = useState<CookieConsentChoice | null>(null);
  const [checked, setChecked] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);
  const [locale, setLocale] = useState<SupportedLocale>("fi");
  const [settings, setSettings] = useState<CookieConsentSettings>({ analytics: false, personalization: false });
  const canonicalPathname = canonicalPathFromLocalized(pathname || "/");
  const isPolicyPage = canonicalPathname === "/cookies" || canonicalPathname === "/privacy";
  const isBlocked = checked && languageReady && !choice && !isPolicyPage;

  useEffect(() => {
    const documentLocale = document.documentElement.lang;
    setLocale(isLocale(documentLocale) ? documentLocale : "fi");
    setLanguageReady(document.documentElement.getAttribute("data-visitor-language-ready") === "true");
    setChoice(readCookieConsent());
    setSettings(readCookieConsentSettings());
    setChecked(true);

    const handleConsentChange = () => {
      setChoice(readCookieConsent());
      setSettings(readCookieConsentSettings());
    };

    const handleLocaleChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<SupportedLocale>).detail;
      setLocale(isLocale(nextLocale) ? nextLocale : "fi");
    };

    const handleLanguageReady = () => {
      const nextLocale = document.documentElement.lang;
      setLocale(isLocale(nextLocale) ? nextLocale : "fi");
      setLanguageReady(true);
    };

    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    window.addEventListener("localechange", handleLocaleChange);
    window.addEventListener("visitorlanguageready", handleLanguageReady);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
      window.removeEventListener("localechange", handleLocaleChange);
      window.removeEventListener("visitorlanguageready", handleLanguageReady);
    };
  }, []);

  useEffect(() => {
    if (!isBlocked) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isBlocked]);

  const selectChoice = (nextChoice: CookieConsentChoice, nextSettings?: CookieConsentSettings) => {
    saveCookieConsent(nextChoice, nextSettings);
    setChoice(nextChoice);
  };

  const saveSettings = () => {
    const nextChoice = settings.analytics && settings.personalization
      ? "all"
      : !settings.analytics && !settings.personalization
        ? "essential"
        : "custom";
    selectChoice(nextChoice, settings);
  };

  const text = copy[locale] ?? copy.fi;

  return (
    <>
      <div className={isBlocked ? "cookie-consent-site cookie-consent-site-blocked" : "cookie-consent-site"}>
        {children}
      </div>
      {isBlocked ? (
        <div className="cookie-consent-backdrop" role="presentation">
          <section className="cookie-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
            <div className="cookie-consent-topline">
              <span className="cookie-consent-eyebrow">{text.eyebrow}</span>
              <button type="button" className="cookie-consent-close" aria-label={text.essential} onClick={() => selectChoice("essential")}>
                <X aria-hidden="true" />
              </button>
            </div>
            <h2 id="cookie-consent-title">{text.title}</h2>
            <p id="cookie-consent-description" className="cookie-consent-description">{text.description}</p>

            <div className="cookie-consent-settings">
              <div className="cookie-consent-setting">
                <ShieldCheck className="cookie-consent-setting-icon" aria-hidden="true" />
                <div className="cookie-consent-setting-copy"><strong>{text.necessaryTitle}</strong><p>{text.necessaryText}</p></div>
                <div className="cookie-consent-always"><span>{text.alwaysOn}</span><LockKeyhole aria-hidden="true" /></div>
              </div>
              <div className="cookie-consent-setting">
                <BarChart3 className="cookie-consent-setting-icon" aria-hidden="true" />
                <div className="cookie-consent-setting-copy"><strong>{text.analyticsTitle}</strong><p>{text.analyticsText}</p></div>
                <Toggle checked={settings.analytics} label={text.analyticsTitle} onChange={() => setSettings((current) => ({ ...current, analytics: !current.analytics }))} />
              </div>
              <div className="cookie-consent-setting">
                <UserRound className="cookie-consent-setting-icon" aria-hidden="true" />
                <div className="cookie-consent-setting-copy"><strong>{text.personalizationTitle}</strong><p>{text.personalizationText}</p></div>
                <Toggle checked={settings.personalization} label={text.personalizationTitle} onChange={() => setSettings((current) => ({ ...current, personalization: !current.personalization }))} />
              </div>
            </div>

            <div className="cookie-consent-actions">
              <button type="button" className="cookie-consent-accept" onClick={() => selectChoice("all", { analytics: true, personalization: true })} autoFocus>{text.acceptAll}</button>
              <button type="button" className="cookie-consent-essential" onClick={() => selectChoice("essential", { analytics: false, personalization: false })}>{text.essential}</button>
            </div>
            <button type="button" className="cookie-consent-save" onClick={saveSettings}>{text.save}</button>

            <div className="cookie-consent-links">
              <Cookie className="cookie-consent-cookie-icon" aria-hidden="true" />
              <Link href={pagePath("cookies", locale)}>{text.policy}<ChevronRight aria-hidden="true" /></Link>
              <span className="cookie-consent-link-divider" aria-hidden="true" />
              <Link href={pagePath("privacy", locale)}>{text.privacy}<ChevronRight aria-hidden="true" /></Link>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
