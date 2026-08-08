export const COOKIE_CONSENT_STORAGE_KEY = "maskines-cookie-consent-v2";
export const COOKIE_CONSENT_COOKIE = "maskines_cookie_consent_v2";
export const COOKIE_CONSENT_EVENT = "maskines:cookie-consent-changed";

export type CookieConsentChoice = "all" | "essential" | "custom";

export type CookieConsentSettings = {
  analytics: boolean;
  personalization: boolean;
};

type StoredCookieConsent = {
  choice: CookieConsentChoice;
  settings: CookieConsentSettings;
  acceptedAt: string;
  version: 2;
};

const ESSENTIAL_SETTINGS: CookieConsentSettings = {
  analytics: false,
  personalization: false
};

function isCookieConsentChoice(value: unknown): value is CookieConsentChoice {
  return value === "all" || value === "essential" || value === "custom";
}

function isCookieConsentSettings(value: unknown): value is CookieConsentSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<CookieConsentSettings>;
  return typeof settings.analytics === "boolean" && typeof settings.personalization === "boolean";
}

function settingsForChoice(choice: CookieConsentChoice): CookieConsentSettings {
  if (choice === "all") return { analytics: true, personalization: true };
  return { ...ESSENTIAL_SETTINGS };
}

function readStoredConsent(): StoredCookieConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredCookieConsent>;
    if (
      stored.version === 2 &&
      isCookieConsentChoice(stored.choice) &&
      isCookieConsentSettings(stored.settings)
    ) {
      return stored as StoredCookieConsent;
    }
  } catch {
    // Fall back to the consent cookie when local storage is unavailable.
  }

  return null;
}

export function readCookieConsent(): CookieConsentChoice | null {
  if (typeof window === "undefined") return null;

  const stored = readStoredConsent();
  if (stored) return stored.choice;

  const cookieValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE}=`))
    ?.split("=")[1];

  return isCookieConsentChoice(cookieValue) ? cookieValue : null;
}

export function readCookieConsentSettings(): CookieConsentSettings {
  const stored = readStoredConsent();
  if (stored) return stored.settings;

  const choice = readCookieConsent();
  return choice ? settingsForChoice(choice) : { ...ESSENTIAL_SETTINGS };
}

export function saveCookieConsent(
  choice: CookieConsentChoice,
  requestedSettings?: CookieConsentSettings
) {
  const settings = requestedSettings ?? settingsForChoice(choice);
  const stored: StoredCookieConsent = {
    choice,
    settings,
    acceptedAt: new Date().toISOString(),
    version: 2
  };

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The consent cookie still persists the broad choice when storage is blocked.
  }

  document.cookie = `${COOKIE_CONSENT_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT));
}
