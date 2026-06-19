"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Globe2, ShieldCheck } from "lucide-react";
import { applyLocale, isLocale, type Locale } from "@/lib/i18n";

const LANGUAGES: Array<{ code: Locale; country: string; flag: string; language: string }> = [
  { code: "fi", country: "Suomi", flag: "fi", language: "Finnish" },
  { code: "en", country: "English", flag: "gb", language: "English" },
  { code: "sv", country: "Sverige", flag: "se", language: "Swedish" },
  { code: "no", country: "Norge", flag: "no", language: "Norwegian" },
  { code: "et", country: "Eesti", flag: "ee", language: "Estonian" }
];

const STORAGE_PREFIX = "visitor-language:";
const RETURN_PATH_KEY = "visitor-language-return-path";
const FORCE_PROMPT_PARAM = "languagePrompt";

type VisitorLanguageResponse = {
  fingerprint?: string;
  selectedLocale?: unknown;
};

function CountryFlag({ country }: { country: string }) {
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

  if (!colors) return null;

  return (
    <svg viewBox="0 0 60 42" aria-hidden="true">
      <rect width="60" height="42" fill={colors.background} />
      <path d="M19 0v42M0 21h60" stroke={colors.cross} strokeWidth={country === "no" ? 12 : 10} />
      {country === "no" ? <path d="M19 0v42M0 21h60" stroke={colors.inset} strokeWidth="6" /> : null}
    </svg>
  );
}

export default function VisitorLanguageGate() {
  const [fingerprint, setFingerprint] = useState("");
  const [open, setOpen] = useState(false);

  function rememberOnServer(locale: Locale) {
    void fetch("/api/visitor-language", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ locale })
    }).catch(() => {
      // Local storage still keeps the selection if the server-side cache is unavailable.
    });
  }

  useEffect(() => {
    let cancelled = false;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    const params = new URLSearchParams(window.location.search);
    const forcePromptOnce = params.get(FORCE_PROMPT_PARAM) === "1";

    fetch("/api/visitor-language", { cache: "no-store" })
      .then((response) => response.json() as Promise<VisitorLanguageResponse>)
      .then(({ fingerprint: nextFingerprint, selectedLocale }) => {
        if (cancelled || !nextFingerprint) return;

        setFingerprint(nextFingerprint);
        if (forcePromptOnce) {
          localStorage.removeItem(`${STORAGE_PREFIX}${nextFingerprint}`);
          params.delete(FORCE_PROMPT_PARAM);
          const nextSearch = params.toString();
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
          );
          openTimer = setTimeout(() => {
            if (!cancelled) setOpen(true);
          }, 450);
          return;
        }

        if (isLocale(selectedLocale)) {
          localStorage.setItem(`${STORAGE_PREFIX}${nextFingerprint}`, selectedLocale);
          applyLocale(selectedLocale);
          return;
        }

        const rememberedLocale = localStorage.getItem(`${STORAGE_PREFIX}${nextFingerprint}`);
        if (isLocale(rememberedLocale)) {
          rememberOnServer(rememberedLocale);
          applyLocale(rememberedLocale);
          return;
        }

        if (window.location.pathname !== "/") {
          sessionStorage.setItem(
            RETURN_PATH_KEY,
            `${window.location.pathname}${window.location.search}${window.location.hash}`
          );
          window.location.replace("/");
          return;
        }

        openTimer = setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, 450);
      })
      .catch(() => {
        // If IP detection is unavailable, the normal language switcher remains usable.
      });

    return () => {
      cancelled = true;
      if (openTimer) clearTimeout(openTimer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overflowX = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.overflowX = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overflowX = previousBodyOverflowX;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, [open]);

  useEffect(() => {
    if (!fingerprint) return;

    function rememberCurrentLocale(event: Event) {
      const nextLocale = (event as CustomEvent<Locale>).detail;
      if (isLocale(nextLocale)) {
        localStorage.setItem(`${STORAGE_PREFIX}${fingerprint}`, nextLocale);
        rememberOnServer(nextLocale);
      }
    }

    window.addEventListener("localechange", rememberCurrentLocale);
    return () => window.removeEventListener("localechange", rememberCurrentLocale);
  }, [fingerprint]);

  function selectLanguage(locale: Locale) {
    if (!fingerprint) return;

    localStorage.setItem(`${STORAGE_PREFIX}${fingerprint}`, locale);
    rememberOnServer(locale);
    applyLocale(locale);
    setOpen(false);

    const returnPath = sessionStorage.getItem(RETURN_PATH_KEY);
    if (returnPath && returnPath !== "/") {
      sessionStorage.removeItem(RETURN_PATH_KEY);
      window.location.replace(returnPath);
    }
  }

  if (!open) return null;

  return (
    <div className="visitor-language-backdrop">
      <section
        className="visitor-language-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visitor-language-title"
      >
        <div className="visitor-language-globe" aria-hidden="true">
          <Globe2 size={38} strokeWidth={1.8} />
        </div>
        <span className="visitor-language-eyebrow">Welcome to Maskines</span>
        <h2 id="visitor-language-title">Select your region &amp; language</h2>
        <p>Choose your country and preferred language to continue.</p>

        <div className="visitor-language-grid">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => selectLanguage(language.code)}
            >
              <span className="visitor-language-flag">
                <CountryFlag country={language.flag} />
              </span>
              <span className="visitor-language-copy">
                <strong>{language.country}</strong>
                <span>{language.language}</span>
              </span>
              <ArrowRight className="visitor-language-arrow" size={24} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="visitor-language-security">
          <ShieldCheck size={28} strokeWidth={1.7} aria-hidden="true" />
          <span>
            <strong>Your selection is remembered securely.</strong>
            <small>You can change the language later from the site menu.</small>
          </span>
        </div>
      </section>
    </div>
  );
}
