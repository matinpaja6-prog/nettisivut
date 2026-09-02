"use client";

import { Bell, Check, Globe2, Mail, Palette, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { languageOptions, useLanguage, type Locale, type SupportedLocale } from "@/lib/i18n";
import { getSafeAuthUser, supabase } from "@/lib/supabase";
import {
  applyUserTheme,
  defaultUserSettings,
  readUserSettings,
  saveUserSettings,
  type UserSettings
} from "@/lib/user-settings";
import styles from "./settings.module.css";

const languageFlags: Record<SupportedLocale, { flag: "fi" | "gb" | "se" | "no" }> = {
  fi: { flag: "fi" },
  en: { flag: "gb" },
  sv: { flag: "se" },
  no: { flag: "no" }
};

const themeOptions = [
  { labels: { fi: "Tumma", en: "Dark", sv: "Mörkt", no: "Mørkt" }, value: "dark", swatch: "#0b1118" },
  { labels: { fi: "Vaalea", en: "Light", sv: "Ljust", no: "Lyst" }, value: "light", swatch: "#f0f2f3" },
  { labels: { fi: "Järjestelmän mukaan", en: "Use system setting", sv: "Enligt systemet", no: "Følg systemet" }, value: "system", swatch: "linear-gradient(135deg, #0b1118 0 50%, #f0f2f3 50% 100%)" }
] satisfies Array<{ labels: Record<Locale, string>; value: UserSettings["theme"]; swatch: string }>;


const copy = {
  fi: {
    title: "Asetukset",
    subtitle: "Hallitse tiliäsi, ilmoituksiasi ja kauppapaikan asetuksia.",
    languageTitle: "Kieli ja alue",
    languageDesc: "Kieli, valuutta ja alue vaikuttavat kauppapaikan sisältöön, hinnoitteluun ja saatavuuteen.",
    notificationsTitle: "Ilmoitukset",
    notificationsDesc: "Säädä viesti- ja hakuvahti-ilmoituksia.",
    notificationsMain: "Ilmoitukset käytössä",
    notificationsMainDesc: "Näytä ilmoitusmerkit ja salli selaimen ilmoitukset.",
    messageEmail: "Uusien viestien sähköpostit",
    messageEmailDesc: "Lähetä sähköposti, kun saat viestin etkä ole paikalla.",
    searchEmail: "Hakuvahtien sähköpostit",
    searchEmailDesc: "Lähetä sähköposti, kun uusi ilmoitus vastaa hakuvahtiasi.",
    loginForEmail: "Kirjaudu sisään muuttaaksesi sähköpostiasetuksia.",
    emailSaveError: "Sähköpostiasetuksen tallennus epäonnistui.",
    sound: "Ilmoitusääni",
    soundDesc: "Toista lyhyt ääni uudesta viestistä.",
    browserPermission: "Salli selaimen ilmoitukset",
    browserPermissionGranted: "Selaimen ilmoitukset sallittu",
    browserPermissionDenied: "Selaimen ilmoitukset estetty selaimessa",
    backgroundTitle: "Teema",
    backgroundDesc: "Valitse tumma tai vaalea teema. Oranssi säilyy korostevärinä.",
    saved: "Tallennettu",
    allSaved: "Kaikki muutokset tallennettu",
    saveSettings: "Tallenna asetukset",
    emailChannel: "Sähköposti",
    browserChannel: "Selain",
    instructions: "Ohjeet"
  },
  en: {
    title: "Page Settings",
    subtitle: "Choose language, notification behavior and the site theme for this device.",
    languageTitle: "Language and region",
    languageDesc: "Language, currency and region affect marketplace content, pricing and availability.",
    notificationsTitle: "Notifications",
    notificationsDesc: "Adjust message and search alert notifications.",
    notificationsMain: "Notifications enabled",
    notificationsMainDesc: "Show badges and allow browser notifications.",
    messageEmail: "New message emails",
    messageEmailDesc: "Send an email when you receive a message while you are away.",
    searchEmail: "Search alert emails",
    searchEmailDesc: "Send an email when a new listing matches your saved search.",
    loginForEmail: "Sign in to change email settings.",
    emailSaveError: "Could not save the email setting.",
    sound: "Notification sound",
    soundDesc: "Play a short sound for new messages.",
    browserPermission: "Allow browser notifications",
    browserPermissionGranted: "Browser notifications allowed",
    browserPermissionDenied: "Browser notifications blocked in browser",
    backgroundTitle: "Theme",
    backgroundDesc: "Choose the dark or light theme. Orange remains the accent color.",
    saved: "Saved",
    allSaved: "All changes saved",
    saveSettings: "Save settings",
    emailChannel: "Email",
    browserChannel: "Browser",
    instructions: "Instructions"
  },
  sv: {
    title: "Sidinställningar",
    subtitle: "Välj språk, aviseringar och sidans bakgrundsfärg för den här enheten.",
    languageTitle: "Språk och region",
    languageDesc: "Språk, valuta och region påverkar innehåll, priser och tillgänglighet.",
    notificationsTitle: "Aviseringar",
    notificationsDesc: "Justera meddelande- och sökbevakningsaviseringar.",
    notificationsMain: "Aviseringar aktiverade",
    notificationsMainDesc: "Visa aviseringsmärken och tillåt webbläsaraviseringar.",
    messageEmail: "E-post om nya meddelanden",
    messageEmailDesc: "Skicka e-post när du får ett meddelande och inte är online.",
    searchEmail: "E-post från sökbevakningar",
    searchEmailDesc: "Skicka e-post när en ny annons matchar din sökbevakning.",
    loginForEmail: "Logga in för att ändra e-postinställningarna.",
    emailSaveError: "Det gick inte att spara e-postinställningen.",
    sound: "Aviseringsljud",
    soundDesc: "Spela upp ett kort ljud för nya meddelanden.",
    browserPermission: "Tillåt webbläsaraviseringar",
    browserPermissionGranted: "Webbläsaraviseringar tillåtna",
    browserPermissionDenied: "Webbläsaraviseringar blockerade i webbläsaren",
    backgroundTitle: "Tema",
    backgroundDesc: "Välj mörkt eller ljust tema. Orange förblir accentfärgen.",
    saved: "Sparat",
    allSaved: "Alla ändringar har sparats",
    saveSettings: "Spara inställningar",
    emailChannel: "E-post",
    browserChannel: "Webbläsare",
    instructions: "Instruktioner"
  },
  no: {
    title: "Sideinnstillinger",
    subtitle: "Velg språk, varsler og sidens bakgrunnsfarge for denne enheten.",
    languageTitle: "Språk og region",
    languageDesc: "Språk, valuta og region påvirker innhold, priser og tilgjengelighet.",
    notificationsTitle: "Varsler",
    notificationsDesc: "Juster meldings- og søkevarsler.",
    notificationsMain: "Varsler aktivert",
    notificationsMainDesc: "Vis varselmerker og tillat nettleservarsler.",
    messageEmail: "E-post om nye meldinger",
    messageEmailDesc: "Send e-post når du får en melding og ikke er pålogget.",
    searchEmail: "E-post fra søkevarsler",
    searchEmailDesc: "Send e-post når en ny annonse samsvarer med søkevarselet.",
    loginForEmail: "Logg inn for å endre e-postinnstillingene.",
    emailSaveError: "Kunne ikke lagre e-postinnstillingen.",
    sound: "Varslingslyd",
    soundDesc: "Spill av en kort lyd for nye meldinger.",
    browserPermission: "Tillat nettleservarsler",
    browserPermissionGranted: "Nettleservarsler er tillatt",
    browserPermissionDenied: "Nettleservarsler er blokkert i nettleseren",
    backgroundTitle: "Tema",
    backgroundDesc: "Velg mørkt eller lyst tema. Oransje forblir aksentfargen.",
    saved: "Lagret",
    allSaved: "Alle endringer er lagret",
    saveSettings: "Lagre innstillinger",
    emailChannel: "E-post",
    browserChannel: "Nettleser",
    instructions: "Instruksjoner"
  },
} satisfies Record<Locale, Record<string, string>>;

function CountryFlag({ country }: { country: "fi" | "gb" | "se" | "no" }) {
  if (country === "gb") {
    return (
      <svg viewBox="0 0 60 42" aria-hidden="true">
        <rect width="60" height="42" fill="#214b9b" />
        <path d="M0 0 60 42M60 0 0 42" stroke="#fff" strokeWidth="10" />
        <path d="M0 0 60 42M60 0 0 42" stroke="#e43145" strokeWidth="5" />
        <path d="M30 0v42M0 21h60" stroke="#fff" strokeWidth="13" />
        <path d="M30 0v42M0 21h60" stroke="#e43145" strokeWidth="7" />
      </svg>
    );
  }

  const colors = {
    fi: { background: "#fff", cross: "#174a9c" },
    se: { background: "#1372b8", cross: "#ffcc26" },
    no: { background: "#e53242", cross: "#fff", inset: "#183f8b" }
  }[country];

  return (
    <svg viewBox="0 0 60 42" aria-hidden="true">
      <rect width="60" height="42" fill={colors.background} />
      <path d="M19 0v42M0 21h60" stroke={colors.cross} strokeWidth={country === "no" ? 12 : 10} />
      {country === "no" && "inset" in colors ? <path d="M19 0v42M0 21h60" stroke={colors.inset} strokeWidth="6" /> : null}
    </svg>
  );
}

export default function SettingsPage() {
  const { locale, activeLocale, setLocale } = useLanguage();
  const text = copy[locale];
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
  const [, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [savedAt, setSavedAt] = useState(0);
  const [messageEmailEnabled, setMessageEmailEnabled] = useState(true);
  const [searchEmailEnabled, setSearchEmailEnabled] = useState(true);
  const [emailSettingsAvailable, setEmailSettingsAvailable] = useState(false);
  const [emailSettingSaving, setEmailSettingSaving] = useState<"message" | "search" | "">("");
  const [emailSettingError, setEmailSettingError] = useState("");
  const [activeSection, setActiveSection] = useState("settings-language");

  useEffect(() => {
    const stored = readUserSettings();
    setSettings(stored);
    applyUserTheme(stored.theme);
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const sectionIds = ["settings-language", "settings-notifications", "settings-background"];
    const sections = sectionIds
      .map((sectionId) => document.getElementById(sectionId))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!("IntersectionObserver" in window) || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleSection) setActiveSection(visibleSection.target.id);
      },
      { rootMargin: "-18% 0px -58%", threshold: [0.05, 0.25, 0.5] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    void getSafeAuthUser().then((user) => {
      if (!active || !user) return;
      setMessageEmailEnabled(
        user.user_metadata?.message_email_notifications !== false
      );
      setSearchEmailEnabled(
        user.user_metadata?.search_alert_email_notifications !== false
      );
      setEmailSettingsAvailable(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const savedText = useMemo(() => {
    if (!savedAt) return "";
    return text.saved;
  }, [savedAt, text.saved]);

  function persist(next: UserSettings) {
    setSettings(next);
    saveUserSettings(next);
    applyUserTheme(next.theme);
    setSavedAt(Date.now());
  }

  function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    persist({ ...settings, [key]: value });
  }

  function pickLanguage(nextLocale: SupportedLocale) {
    setLocale(nextLocale);
    setSavedAt(Date.now());
    if (supabase) {
      const client = supabase;
      void client.auth.updateUser({ data: { locale: nextLocale } }).then(({ data }) => {
        const userId = data.user?.id;
        if (userId) {
          void client.from("profiles").update({ preferred_locale: nextLocale }).eq("id", userId);
        }
      });
    }
  }

  async function updateEmailSetting(
    type: "message" | "search",
    enabled: boolean
  ) {
    if (!supabase || !emailSettingsAvailable || emailSettingSaving) return;

    setEmailSettingError("");
    setEmailSettingSaving(type);
    const key = type === "message"
      ? "message_email_notifications"
      : "search_alert_email_notifications";
    const { error } = await supabase.auth.updateUser({
      data: {
        [key]: enabled
      }
    });
    setEmailSettingSaving("");

    if (error) {
      setEmailSettingError(text.emailSaveError);
      return;
    }

    if (type === "message") {
      setMessageEmailEnabled(enabled);
    } else {
      setSearchEmailEnabled(enabled);
    }
    setSavedAt(Date.now());
  }

  function updateTheme(value: UserSettings["theme"]) {
    setSettings((current) => {
      const next = { ...current, theme: value };
      saveUserSettings(next);
      applyUserTheme(value);
      setSavedAt(Date.now());
      return next;
    });
  }

  async function requestBrowserPermission() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      updateSetting("notificationsEnabled", true);
    }
  }

  function openSection(sectionId: string) {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className={`${styles.settingsPage} settings-page-responsive`} data-no-auto-translate>
      <div className={styles.settingsShell}>
        <header className={styles.settingsHead}>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </header>

        <nav className={styles.mobileSectionNav} aria-label={text.title}>
          <button
            type="button"
            className={activeSection === "settings-language" ? styles.mobileSectionNavActive : ""}
            aria-current={activeSection === "settings-language" ? "location" : undefined}
            onClick={() => openSection("settings-language")}
          >
            <Globe2 size={20} />
            <span>{text.languageTitle}</span>
          </button>
          <button
            type="button"
            className={activeSection === "settings-notifications" ? styles.mobileSectionNavActive : ""}
            aria-current={activeSection === "settings-notifications" ? "location" : undefined}
            onClick={() => openSection("settings-notifications")}
          >
            <Bell size={20} />
            <span>{text.notificationsTitle}</span>
          </button>
          <button
            type="button"
            className={activeSection === "settings-background" ? styles.mobileSectionNavActive : ""}
            aria-current={activeSection === "settings-background" ? "location" : undefined}
            onClick={() => openSection("settings-background")}
          >
            <Palette size={20} />
            <span>{text.backgroundTitle}</span>
          </button>
        </nav>

        <div className={styles.settingsGrid}>
          <section id="settings-language" className={styles.settingsPanel}>
            <div className={styles.panelTitle}>
              <span className={styles.panelIcon}><Globe2 size={19} /></span>
              <div>
                <h2>{text.languageTitle}</h2>
                <p>{text.languageDesc}</p>
              </div>
            </div>
            <div className={styles.languageList}>
              {languageOptions.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  className={`${styles.choiceButton} ${language.code === activeLocale ? styles.choiceButtonActive : ""}`}
                  onClick={() => pickLanguage(language.code)}
                >
                  <span className={styles.languageFlag}>
                    <CountryFlag country={languageFlags[language.code].flag} />
                  </span>
                  <span className={styles.languageLabel}>{language.label}</span>
                  {language.code === activeLocale ? <Check className={styles.languageCheck} size={16} /> : null}
                </button>
              ))}
            </div>
          </section>

          <section id="settings-background" className={styles.settingsPanel}>
            <div className={styles.panelTitle}>
              <span className={styles.panelIcon}><Palette size={19} /></span>
              <div>
                <h2>{text.backgroundTitle}</h2>
                <p>{text.backgroundDesc}</p>
              </div>
            </div>
            <div className={styles.presetList}>
              {themeOptions.map((themeOption) => (
                <button
                  key={themeOption.value}
                  type="button"
                  className={`${styles.choiceButton} ${themeOption.value === settings.theme ? styles.choiceButtonActive : ""}`}
                  aria-pressed={themeOption.value === settings.theme}
                  onClick={() => updateTheme(themeOption.value)}
                >
                  <span className={styles.themePreview} data-theme-preview={themeOption.value} aria-hidden="true">
                    <i /><i /><i />
                  </span>
                  <strong>{themeOption.labels[locale]}</strong>
                  {themeOption.value === settings.theme ? <Check className={styles.presetCheck} size={17} /> : null}
                </button>
              ))}
            </div>
          </section>

          <section id="settings-notifications" className={styles.settingsPanel}>
            <div className={styles.panelTitle}>
              <span className={styles.panelIcon}><Bell size={19} /></span>
              <div>
                <h2>{text.notificationsTitle}</h2>
                <p>{text.notificationsDesc}</p>
              </div>
            </div>
            <div className={styles.notificationHeader} aria-hidden="true">
              <span />
              <span><Mail size={14} />{text.emailChannel}</span>
              <span><Bell size={14} />{text.browserChannel}</span>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.rowIcon}><Mail size={16} /></span>
              <div>
                <strong>{text.messageEmail}</strong>
                <small>
                  {emailSettingsAvailable
                    ? text.messageEmailDesc
                    : text.loginForEmail}
                </small>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${messageEmailEnabled ? styles.toggleOn : ""}`}
                aria-pressed={messageEmailEnabled}
                aria-label={text.messageEmail}
                disabled={!emailSettingsAvailable || Boolean(emailSettingSaving)}
                onClick={() => updateEmailSetting("message", !messageEmailEnabled)}
              >
                <span />
              </button>
              <button
                type="button"
                className={`${styles.toggle} ${settings.notificationsEnabled ? styles.toggleOn : ""}`}
                aria-pressed={settings.notificationsEnabled}
                aria-label={`${text.messageEmail} – ${text.browserChannel}`}
                onClick={() => settings.notificationsEnabled ? updateSetting("notificationsEnabled", false) : void requestBrowserPermission()}
              >
                <span />
              </button>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.rowIcon}><Bell size={16} /></span>
              <div>
                <strong>{text.searchEmail}</strong>
                <small>
                  {emailSettingsAvailable
                    ? text.searchEmailDesc
                    : text.loginForEmail}
                </small>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${searchEmailEnabled ? styles.toggleOn : ""}`}
                aria-pressed={searchEmailEnabled}
                aria-label={text.searchEmail}
                disabled={!emailSettingsAvailable || Boolean(emailSettingSaving)}
                onClick={() => updateEmailSetting("search", !searchEmailEnabled)}
              >
                <span />
              </button>
              <button
                type="button"
                className={`${styles.toggle} ${settings.notificationsEnabled ? styles.toggleOn : ""}`}
                aria-pressed={settings.notificationsEnabled}
                aria-label={`${text.searchEmail} – ${text.browserChannel}`}
                onClick={() => settings.notificationsEnabled ? updateSetting("notificationsEnabled", false) : void requestBrowserPermission()}
              >
                <span />
              </button>
            </div>
            {emailSettingError ? (
              <p className={styles.settingError}>{emailSettingError}</p>
            ) : null}
            <div className={styles.settingsRow}>
              <span className={styles.rowIcon}><Mail size={16} /></span>
              <div>
                <strong>{text.notificationsMain}</strong>
                <small>{text.notificationsMainDesc}</small>
              </div>
              <span className={styles.channelUnavailable}>—</span>
              <button
                type="button"
                className={`${styles.toggle} ${settings.notificationsEnabled ? styles.toggleOn : ""}`}
                aria-pressed={settings.notificationsEnabled}
                aria-label={text.notificationsMain}
                onClick={() => updateSetting("notificationsEnabled", !settings.notificationsEnabled)}
              >
                <span />
              </button>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.rowIcon}><Volume2 size={16} /></span>
              <div>
                <strong>{text.sound}</strong>
                <small>{text.soundDesc}</small>
              </div>
              <span className={styles.channelUnavailable}>—</span>
              <button
                type="button"
                className={`${styles.toggle} ${settings.notificationSoundEnabled ? styles.toggleOn : ""}`}
                aria-pressed={settings.notificationSoundEnabled}
                aria-label={text.sound}
                onClick={() => updateSetting("notificationSoundEnabled", !settings.notificationSoundEnabled)}
              >
                <span />
              </button>
            </div>
          </section>
        </div>

        <div className={styles.saveBar}>
          <div className={styles.savedNote}><Check size={16} />{savedText || text.allSaved}</div>
          <button type="button" onClick={() => persist(settings)}>{text.saveSettings}</button>
        </div>
      </div>
    </main>
  );
}
