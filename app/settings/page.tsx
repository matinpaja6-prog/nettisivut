"use client";

import { Bell, Check, ExternalLink, Languages, Mail, Palette, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { languageOptions, useLanguage, type Locale } from "@/lib/i18n";
import { translateLocalizedPath } from "@/lib/routes";
import {
  applyUserBackgroundColor,
  defaultUserSettings,
  readUserSettings,
  saveUserSettings,
  type UserSettings
} from "@/lib/user-settings";
import styles from "./settings.module.css";

const languageFlags: Record<Locale, { flag: "fi" | "gb" | "se" | "no" | "ee" }> = {
  fi: { flag: "fi" },
  en: { flag: "gb" },
  sv: { flag: "se" },
  no: { flag: "no" },
  et: { flag: "ee" }
};

const backgroundPresets = [
  { labels: { fi: "Nykyinen tumma", en: "Current dark" }, value: "#0b1118" },
  { labels: { fi: "Tummansininen", en: "Deep blue" }, value: "#102033" },
  { labels: { fi: "Grafiitti", en: "Graphite" }, value: "#151a22" },
  { labels: { fi: "Jääsininen", en: "Ice blue" }, value: "#c8d8e8" }
];

const copy = {
  fi: {
    title: "Sivuasetukset",
    subtitle: "Valitse kieli, ilmoitusten toiminta ja sivun pohjaväri tälle laitteelle.",
    languageTitle: "Kieli",
    languageDesc: "Käytetään sivuston teksteissä ja reiteissä.",
    notificationsTitle: "Ilmoitukset",
    notificationsDesc: "Säädä viesti- ja hakuvahti-ilmoituksia.",
    notificationsMain: "Ilmoitukset käytössä",
    notificationsMainDesc: "Näytä ilmoitusmerkit ja salli selaimen ilmoitukset.",
    sound: "Ilmoitusääni",
    soundDesc: "Toista lyhyt ääni uudesta viestistä.",
    browserPermission: "Salli selaimen ilmoitukset",
    browserPermissionGranted: "Selaimen ilmoitukset sallittu",
    browserPermissionDenied: "Selaimen ilmoitukset estetty selaimessa",
    backgroundTitle: "Sivun pohjaväri",
    backgroundDesc: "Valitse koko sivuston taustaväri itsellesi.",
    saved: "Tallennettu"
  },
  en: {
    title: "Page Settings",
    subtitle: "Choose language, notification behavior and the page background color for this device.",
    languageTitle: "Language",
    languageDesc: "Used for site text and localized routes.",
    notificationsTitle: "Notifications",
    notificationsDesc: "Adjust message and search alert notifications.",
    notificationsMain: "Notifications enabled",
    notificationsMainDesc: "Show badges and allow browser notifications.",
    sound: "Notification sound",
    soundDesc: "Play a short sound for new messages.",
    browserPermission: "Allow browser notifications",
    browserPermissionGranted: "Browser notifications allowed",
    browserPermissionDenied: "Browser notifications blocked in browser",
    backgroundTitle: "Page background",
    backgroundDesc: "Choose the site background color for yourself.",
    saved: "Saved"
  }
};

function CountryFlag({ country }: { country: "fi" | "gb" | "se" | "no" | "ee" }) {
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

  if (country === "ee") {
    return (
      <svg viewBox="0 0 60 42" aria-hidden="true">
        <path fill="#3486dd" d="M0 0h60v14H0z" />
        <path fill="#111820" d="M0 14h60v14H0z" />
        <path fill="#fff" d="M0 28h60v14H0z" />
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
      {country === "no" ? <path d="M19 0v42M0 21h60" stroke={colors.inset} strokeWidth="6" /> : null}
    </svg>
  );
}

export default function SettingsPage() {
  const { locale, setLocale } = useLanguage();
  const text = copy[locale === "fi" ? "fi" : "en"];
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    const stored = readUserSettings();
    setSettings(stored);
    applyUserBackgroundColor(stored.backgroundColor);
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const savedText = useMemo(() => {
    if (!savedAt) return "";
    return text.saved;
  }, [savedAt, text.saved]);

  function persist(next: UserSettings) {
    setSettings(next);
    saveUserSettings(next);
    applyUserBackgroundColor(next.backgroundColor);
    setSavedAt(Date.now());
  }

  function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    persist({ ...settings, [key]: value });
  }

  function pickLanguage(nextLocale: Locale) {
    setLocale(nextLocale);
    const url = new URL(window.location.href);
    url.searchParams.delete("lang");
    url.pathname = translateLocalizedPath(url.pathname, nextLocale);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setSavedAt(Date.now());
  }

  function updateBackground(value: string) {
    setSettings((current) => {
      const next = { ...current, backgroundColor: value };
      saveUserSettings(next);
      applyUserBackgroundColor(value);
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

  return (
    <main className={styles.settingsPage}>
      <div className={styles.settingsShell}>
        <header className={styles.settingsHead}>
          <h1>
            {locale === "fi" ? (
              <>Sivu<span>asetukset</span></>
            ) : (
              text.title
            )}
          </h1>
          <p>{text.subtitle}</p>
        </header>

        <div className={styles.settingsGrid}>
          <section className={styles.settingsPanel}>
            <div className={styles.panelTitle}>
              <span className={styles.panelIcon}><Languages size={19} /></span>
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
                  className={`${styles.choiceButton} ${language.code === locale ? styles.choiceButtonActive : ""}`}
                  onClick={() => pickLanguage(language.code)}
                >
                  <span className={styles.languageFlag}>
                    <CountryFlag country={languageFlags[language.code].flag} />
                  </span>
                  <span className={styles.languageLabel}>{language.label}</span>
                  {language.code === locale ? <Check className={styles.languageCheck} size={16} /> : null}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.settingsPanel}>
            <div className={styles.panelTitle}>
              <span className={styles.panelIcon}><Bell size={19} /></span>
              <div>
                <h2>{text.notificationsTitle}</h2>
                <p>{text.notificationsDesc}</p>
              </div>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.rowIcon}><Mail size={16} /></span>
              <div>
                <strong>{text.notificationsMain}</strong>
                <small>{text.notificationsMainDesc}</small>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${settings.notificationsEnabled ? styles.toggleOn : ""}`}
                aria-pressed={settings.notificationsEnabled}
                onClick={() => updateSetting("notificationsEnabled", !settings.notificationsEnabled)}
              >
                <span />
              </button>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.rowIcon}><Mail size={16} /></span>
              <div>
                <strong>{text.sound}</strong>
                <small>{text.soundDesc}</small>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${settings.notificationSoundEnabled ? styles.toggleOn : ""}`}
                aria-pressed={settings.notificationSoundEnabled}
                onClick={() => updateSetting("notificationSoundEnabled", !settings.notificationSoundEnabled)}
              >
                <span />
              </button>
            </div>
            <button type="button" className={styles.permissionButton} onClick={requestBrowserPermission}>
              <Volume2 size={16} />
              <span>
                {permission === "granted"
                  ? text.browserPermissionGranted
                  : permission === "denied"
                    ? text.browserPermissionDenied
                    : text.browserPermission}
              </span>
              <small>Ohjeet <ExternalLink size={13} /></small>
            </button>
          </section>

          <section className={styles.settingsPanel}>
            <div className={styles.panelTitle}>
              <span className={styles.panelIcon}><Palette size={19} /></span>
              <div>
                <h2>{text.backgroundTitle}</h2>
                <p>{text.backgroundDesc}</p>
              </div>
            </div>
            <div className={styles.presetList}>
              {backgroundPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`${styles.choiceButton} ${preset.value.toLowerCase() === settings.backgroundColor.toLowerCase() ? styles.choiceButtonActive : ""}`}
                  aria-pressed={preset.value.toLowerCase() === settings.backgroundColor.toLowerCase()}
                  onClick={() => updateBackground(preset.value)}
                >
                  <span className={styles.swatch} style={{ background: preset.value }} />
                  <strong>{preset.labels[locale === "fi" ? "fi" : "en"]}</strong>
                  {preset.value.toLowerCase() === settings.backgroundColor.toLowerCase() ? <Check className={styles.presetCheck} size={17} /> : null}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.savedNote}>{savedText}</div>
      </div>
    </main>
  );
}
