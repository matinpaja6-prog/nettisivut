"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Ban,
  Check,
  ChevronRight,
  Cookie,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sun,
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
import {
  applyUserTheme,
  readUserSettings,
  saveUserSettings,
  type UserTheme
} from "@/lib/user-settings";

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
  appearanceTitle: string;
  appearanceText: string;
  darkTheme: string;
  lightTheme: string;
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
  appearanceTitle: "Sivun teema",
  appearanceText: "Valitse sivustolle tumma tai vaalea ulkoasu.",
  darkTheme: "Tumma",
  lightTheme: "Vaalea",
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
    appearanceTitle: "Site theme",
    appearanceText: "Choose a dark or light appearance for the site.",
    darkTheme: "Dark",
    lightTheme: "Light",
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
    appearanceTitle: "Webbplatsens tema",
    appearanceText: "Välj ett mörkt eller ljust utseende för webbplatsen.",
    darkTheme: "Mörkt",
    lightTheme: "Ljust",
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
    appearanceTitle: "Nettstedets tema",
    appearanceText: "Velg mørkt eller lyst utseende for nettstedet.",
    darkTheme: "Mørkt",
    lightTheme: "Lyst",
    policy: "Retningslinjer for informasjonskapsler",
    privacy: "Personvern"
  }
};

const COOKIE_INFO_COPY: Record<SupportedLocale, {
  basics: string;
  summaryTitle: string;
  settings: string;
  back: string;
  acceptEssential: string;
  rejectAll: string;
}> = {
  fi: {
    basics: "Ev\u00e4steet ovat pieni\u00e4 selaimeen tallennettavia tietoja. V\u00e4ltt\u00e4m\u00e4tt\u00f6m\u00e4t ev\u00e4steet pit\u00e4v\u00e4t kirjautumisen, turvallisuuden ja sivuston perustoiminnot k\u00e4yt\u00f6ss\u00e4. Valinnaisia ev\u00e4steit\u00e4 k\u00e4ytet\u00e4\u00e4n analytiikkaan ja sis\u00e4ll\u00f6n personointiin.",
    summaryTitle: "K\u00e4yt\u00e4mme ev\u00e4steit\u00e4",
    settings: "Asetukset",
    back: "Takaisin",
    acceptEssential: "Hyv\u00e4ksy v\u00e4ltt\u00e4m\u00e4tt\u00f6m\u00e4t ev\u00e4steet",
    rejectAll: "Hylk\u00e4\u00e4 kaikki"
  },
  en: {
    basics: "Cookies are small pieces of information stored in your browser. Essential cookies keep login, security and core site features working. Optional cookies are used for analytics and content personalisation.",
    summaryTitle: "We use cookies",
    settings: "Settings",
    back: "Back",
    acceptEssential: "Accept essential cookies",
    rejectAll: "Reject all"
  },
  sv: {
    basics: "Cookies \u00e4r sm\u00e5 informationsfiler som sparas i webbl\u00e4saren. N\u00f6dv\u00e4ndiga cookies h\u00e5ller inloggning, s\u00e4kerhet och webbplatsens grundfunktioner ig\u00e5ng. Valfria cookies anv\u00e4nds f\u00f6r analys och anpassning av inneh\u00e5ll.",
    summaryTitle: "Vi anv\u00e4nder cookies",
    settings: "Inst\u00e4llningar",
    back: "Tillbaka",
    acceptEssential: "Godk\u00e4nn n\u00f6dv\u00e4ndiga cookies",
    rejectAll: "Avvisa alla"
  },
  no: {
    basics: "Informasjonskapsler er sm\u00e5 mengder informasjon som lagres i nettleseren. N\u00f8dvendige informasjonskapsler holder innlogging, sikkerhet og grunnleggende funksjoner i gang. Valgfrie informasjonskapsler brukes til analyse og tilpasning av innhold.",
    summaryTitle: "Vi bruker informasjonskapsler",
    settings: "Innstillinger",
    back: "Tilbake",
    acceptEssential: "Godta n\u00f8dvendige informasjonskapsler",
    rejectAll: "Avvis alle"
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

function ThemeChoice({
  text,
  theme,
  onChange
}: {
  text: ConsentCopy;
  theme: UserTheme;
  onChange: (theme: UserTheme) => void;
}) {
  return (
    <div className="cookie-consent-appearance" role="group" aria-labelledby="cookie-consent-appearance-title">
      <div className="cookie-consent-appearance-copy">
        <strong id="cookie-consent-appearance-title">{text.appearanceTitle}</strong>
        <p>{text.appearanceText}</p>
      </div>
      <div className="cookie-consent-theme-options">
        <button
          type="button"
          className={theme === "dark" ? "is-active" : ""}
          aria-pressed={theme === "dark"}
          onClick={() => onChange("dark")}
        >
          <Moon aria-hidden="true" />
          <span>{text.darkTheme}</span>
        </button>
        <button
          type="button"
          className={theme === "light" ? "is-active" : ""}
          aria-pressed={theme === "light"}
          onClick={() => onChange("light")}
        >
          <Sun aria-hidden="true" />
          <span>{text.lightTheme}</span>
        </button>
      </div>
    </div>
  );
}

export default function CookieConsentGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [choice, setChoice] = useState<CookieConsentChoice | null>(null);
  const [checked, setChecked] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);
  const [locale, setLocale] = useState<SupportedLocale>("fi");
  const [theme, setTheme] = useState<UserTheme>("dark");
  const [panel, setPanel] = useState<"summary" | "settings">("summary");
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
    setTheme(readUserSettings().theme);
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

  const selectTheme = (nextTheme: UserTheme) => {
    const currentSettings = readUserSettings();
    const nextSettings = { ...currentSettings, theme: nextTheme };
    setTheme(nextTheme);
    applyUserTheme(nextTheme);
    saveUserSettings(nextSettings);
  };

  const text = copy[locale] ?? copy.fi;
  const infoText = COOKIE_INFO_COPY[locale];

  return (
    <>
      <div className={isBlocked ? "cookie-consent-site cookie-consent-site-blocked" : "cookie-consent-site"}>
        {children}
      </div>
      {isBlocked ? (
        <div className="cookie-consent-backdrop" role="presentation">
          <section
            className="cookie-consent-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-consent-title"
            aria-describedby="cookie-consent-description"
            data-no-auto-translate
          >
            <div className="cookie-consent-topline">
              <span className="cookie-consent-eyebrow">{panel === "summary" ? "Maskines" : text.eyebrow}</span>
              <button type="button" className="cookie-consent-close" aria-label={text.essential} onClick={() => selectChoice("essential")}>
                <X aria-hidden="true" />
              </button>
            </div>
            {panel === "summary" ? (
              <>
                <h2 id="cookie-consent-title">{infoText.summaryTitle}</h2>
                <p id="cookie-consent-description" className="cookie-consent-description">{infoText.basics}</p>

                <ThemeChoice text={text} theme={theme} onChange={selectTheme} />

                <div className="cookie-consent-actions cookie-consent-summary-actions">
                  <button type="button" className="cookie-consent-accept" onClick={() => selectChoice("all")} autoFocus>{text.acceptAll}</button>
                  <button type="button" className="cookie-consent-essential" onClick={() => selectChoice("essential")}>{infoText.acceptEssential}</button>
                </div>
                <button type="button" className="cookie-consent-save" onClick={() => setPanel("settings")}>{infoText.settings}</button>

                <div className="cookie-consent-links">
                  <Cookie className="cookie-consent-cookie-icon" aria-hidden="true" />
                  <Link href={pagePath("cookies", locale)}>{text.policy}<ChevronRight aria-hidden="true" /></Link>
                  <span className="cookie-consent-link-divider" aria-hidden="true" />
                  <Link href={pagePath("privacy", locale)}>{text.privacy}<ChevronRight aria-hidden="true" /></Link>
                </div>
              </>
            ) : (
              <>
                <h2 id="cookie-consent-title">{text.title}</h2>
                <p id="cookie-consent-description" className="cookie-consent-description">{text.description}</p>

                <ThemeChoice text={text} theme={theme} onChange={selectTheme} />

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

                <div className="cookie-consent-settings-footer">
                  <div className="cookie-consent-actions cookie-consent-settings-actions">
                    <button type="button" className="cookie-consent-accept" onClick={saveSettings}>
                      <Check aria-hidden="true" />
                      <span>{text.save}</span>
                    </button>
                  </div>
                  <div className="cookie-consent-secondary-actions">
                    <button type="button" className="cookie-consent-back" onClick={() => setPanel("summary")}>
                      <ArrowLeft aria-hidden="true" />
                      <span>{infoText.back}</span>
                    </button>
                    <button type="button" className="cookie-consent-reject" onClick={() => selectChoice("essential")}>
                      <Ban aria-hidden="true" />
                      <span>{infoText.rejectAll}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
