"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Check, ChevronDown, Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { BirthDateField } from "@/app/components/BirthDateField";
import { goBackOrFallback } from "@/lib/go-back";
import { useLanguage, type Locale } from "@/lib/i18n";
import { sanitizePhoneDigits, sanitizePhoneInput } from "@/lib/phone-input";
import { pagePath } from "@/lib/routes";
import {
  awardReferralPoints,
  getSafeAuthSession,
  getSafeAuthUser,
  getProfile,
  getReferrerIdByCode,
  isProfileCompleted,
  isSupabaseConfigured,
  resetPassword,
  sendRegistrationOtpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  supabase,
  updatePassword,
  upsertProfileFromApi,
  verifyRegistrationOtpWithEmail,
  type UserProfile
} from "@/lib/supabase";

const REFERRAL_STORAGE_KEY = "pending_referral_code";
const ACCOUNT_TYPE_STORAGE_KEY = "pending_account_type";
const GOOGLE_AUTH_INTENT_STORAGE_KEY = "pending_google_auth_intent";
const PROFILE_COMPLETION_DRAFT_STORAGE_KEY = "profile_completion_draft_v1";
const REGISTRATION_PIN_COOLDOWN_STORAGE_KEY = "registration_pin_sent_at_v1";
const REGISTRATION_PIN_COOLDOWN_MS = 65_000;
const AUTH_SUBMIT_AUTO_UNLOCK_MS = 15_000;
type AuthMode = "login" | "register";

type GooglePlace = {
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  name?: string;
  website?: string;
};

type GoogleAutocomplete = {
  addListener: (eventName: "place_changed", handler: () => void) => void;
  getPlace: () => GooglePlace;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          options: Record<string, unknown>
        ) => GoogleAutocomplete;
      };
    };
  };
};

async function checkPhoneBeforeRegistration(phone: string): Promise<{
  available: boolean;
  reason?: "in_use" | "reserved";
  error?: string;
}> {
  const response = await fetch("/api/profiles/check-phone", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ phone })
  });

  const payload =
    await response.json().catch(() => ({})) as {
      available?: boolean;
      reason?: "in_use" | "reserved";
      error?: string;
    };

  if (!response.ok) {
    return {
      available: false,
      error: payload.error || "Puhelinnumeron tarkistus epäonnistui."
    };
  }

  return {
    available: Boolean(payload.available),
    reason: payload.reason
  };
}

async function sendRegistrationPin(
  email: string,
  metadata?: Record<string, string>,
  emailRedirectTo?: string
): Promise<{
  sent: boolean;
  error?: string;
}> {
  const { error } =
    await sendRegistrationOtpWithEmail(
      email,
      metadata,
      emailRedirectTo
    );

  if (error) {
    return {
      sent: false,
      error: getErrorMessage(error)
    };
  }

  return {
    sent: true
  };
}

async function verifyRegistrationPin(input: {
  email: string;
  pin: string;
}): Promise<{
  verified: boolean;
  user?: User;
  error?: string;
}> {
  const { data, error } =
    await verifyRegistrationOtpWithEmail(
      input.email,
      input.pin
    );

  if (error) {
    return {
      verified: false,
      error: getErrorMessage(error)
    };
  }

  return {
    verified: Boolean(data?.user),
    user: data?.user ?? undefined
  };
}

function rememberAccountType(type: "private" | "company") {
  try {
    localStorage.setItem(ACCOUNT_TYPE_STORAGE_KEY, type);
  } catch {}
}

function getPendingGoogleAuthIntent(): AuthMode | null {
  if (typeof window === "undefined") return null;

  try {
    const fromUrl = new URLSearchParams(window.location.search).get("oauth");
    if (fromUrl === "login" || fromUrl === "register") return fromUrl;

    const stored = sessionStorage.getItem(GOOGLE_AUTH_INTENT_STORAGE_KEY);
    return stored === "login" || stored === "register" ? stored : null;
  } catch {
    return null;
  }
}

function rememberGoogleAuthIntent(intent: AuthMode) {
  try {
    sessionStorage.setItem(GOOGLE_AUTH_INTENT_STORAGE_KEY, intent);
  } catch {}
}

function clearGoogleAuthIntent() {
  try {
    sessionStorage.removeItem(GOOGLE_AUTH_INTENT_STORAGE_KEY);
  } catch {}
}

function getAuthModeFromSearchParams(searchParams: URLSearchParams | ReadonlyURLSearchParamsLike): AuthMode {
  return searchParams.get("mode") === "register" ? "register" : "login";
}

function getSafeAuthRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";

  return value;
}

type ReadonlyURLSearchParamsLike = {
  get: (name: string) => string | null;
};

const emptyAuthForm = {
  email: "",
  password: "",
  account_type: "private" as "private" | "company",
  first_name: "",
  last_name: "",
  company_name: "",
  business_id: "",
  company_role: "",
  company_website: "",
  billing_email: "",
  phone: "",
  address: "",
  postal_code: "",
  city: "",
  country: "Suomi",
  birth_date: ""
};

const phoneDialingOptions = [
  { country: "FI", code: "+358", flag: "🇫🇮" },
  { country: "SE", code: "+46", flag: "🇸🇪" },
  { country: "NO", code: "+47", flag: "🇳🇴" },
  { country: "DK", code: "+45", flag: "🇩🇰" },
  { country: "EE", code: "+372", flag: "🇪🇪" },
  { country: "PL", code: "+48", flag: "🇵🇱" },
  { country: "LV", code: "+371", flag: "🇱🇻" },
  { country: "DE", code: "+49", flag: "🇩🇪" },
  { country: "LT", code: "+370", flag: "🇱🇹" }
];

const countryOptions = [
  "FI",
  "SE",
  "NO",
  "DK",
  "EE",
  "DE",
  "OTHER"
];

const OTHER_COUNTRY_VALUE = "OTHER";

const countryNameByLocale: Record<Locale, Record<string, string>> = {
  fi: {
    FI: "Suomi", SE: "Ruotsi", NO: "Norja", DK: "Tanska", EE: "Viro",
    AL: "Albania", AD: "Andorra", AM: "Armenia", AT: "Itävalta", AZ: "Azerbaidžan", BY: "Valko-Venäjä",
    BE: "Belgia", BA: "Bosnia ja Hertsegovina", BG: "Bulgaria", HR: "Kroatia", CY: "Kypros",
    CZ: "Tšekki", FR: "Ranska", GE: "Georgia", DE: "Saksa", GI: "Gibraltar", GR: "Kreikka",
    HU: "Unkari", IS: "Islanti", IE: "Irlanti", IT: "Italia", XK: "Kosovo",
    LV: "Latvia", LI: "Liechtenstein", LT: "Liettua", LU: "Luxemburg", MT: "Malta",
    MD: "Moldova", MC: "Monaco", ME: "Montenegro", NL: "Alankomaat", MK: "Pohjois-Makedonia",
    PL: "Puola", PT: "Portugali", RO: "Romania", RU: "Venäjä", SM: "San Marino", RS: "Serbia",
    SK: "Slovakia", SI: "Slovenia", ES: "Espanja", CH: "Sveitsi", TR: "Turkki",
    UA: "Ukraina", GB: "Iso-Britannia", VA: "Vatikaani", FO: "Färsaaret",
    OTHER: "Muu", da: "Tanska", sv: "Ruotsi", no: "Norja", ee: "Viro"
  },
  en: { FI: "Finland", SE: "Sweden", NO: "Norway", DK: "Denmark", EE: "Estonia", DE: "Germany", OTHER: "Other", da: "Denmark", sv: "Sweden", no: "Norway", ee: "Estonia" },
  sv: { FI: "Finland", SE: "Sverige", NO: "Norge", DK: "Danmark", EE: "Estland", DE: "Tyskland", OTHER: "Annat", da: "Danmark", sv: "Sverige", no: "Norge", ee: "Estland" },
  no: { FI: "Finland", SE: "Sverige", NO: "Norge", DK: "Danmark", EE: "Estland", DE: "Tyskland", OTHER: "Annet", da: "Danmark", sv: "Sverige", no: "Norge", ee: "Estland" },
  et: { FI: "Soome", SE: "Rootsi", NO: "Norra", DK: "Taani", EE: "Eesti", DE: "Saksamaa", OTHER: "Muu", da: "Taani", sv: "Rootsi", no: "Norra", ee: "Eesti" }
};

const registrationPinText: Record<Locale, {
  eyebrow: string;
  title: string;
  sent: string;
  instruction: string;
  label: string;
  submitting: string;
  confirm: string;
  resend: string;
  edit: string;
}> = {
  fi: { eyebrow: "Vahvista sähköposti", title: "Syötä vahvistuskoodi", sent: "Lähetimme 6-numeroisen koodin osoitteeseen", instruction: "Syötä koodi alle viimeistelläksesi rekisteröitymisen.", label: "Vahvistuskoodi", submitting: "Vahvistetaan...", confirm: "Vahvista ja luo tili", resend: "Lähetä uusi koodi", edit: "Muokkaa tietoja" },
  en: { eyebrow: "Verify your email", title: "Enter verification code", sent: "We sent a 6-digit code to", instruction: "Enter the code below to finish your registration.", label: "Verification code", submitting: "Verifying...", confirm: "Verify and create account", resend: "Send a new code", edit: "Edit details" },
  sv: { eyebrow: "Bekräfta din e-post", title: "Ange bekräftelsekoden", sent: "Vi skickade en sexsiffrig kod till", instruction: "Ange koden nedan för att slutföra registreringen.", label: "Bekräftelsekod", submitting: "Bekräftar...", confirm: "Bekräfta och skapa konto", resend: "Skicka en ny kod", edit: "Redigera uppgifter" },
  no: { eyebrow: "Bekreft e-posten din", title: "Skriv inn bekreftelseskoden", sent: "Vi sendte en sekssifret kode til", instruction: "Skriv inn koden nedenfor for å fullføre registreringen.", label: "Bekreftelseskode", submitting: "Bekrefter...", confirm: "Bekreft og opprett konto", resend: "Send en ny kode", edit: "Rediger opplysninger" },
  et: { eyebrow: "Kinnita oma e-post", title: "Sisesta kinnituskood", sent: "Saatsime kuuekohalise koodi aadressile", instruction: "Registreerimise lõpetamiseks sisesta kood allolevasse välja.", label: "Kinnituskood", submitting: "Kinnitamine...", confirm: "Kinnita ja loo konto", resend: "Saada uus kood", edit: "Muuda andmeid" }
};

function getCountryName(locale: Locale, country: string) {
  return countryNameByLocale[locale][country] ?? countryNameByLocale.fi[country] ?? country;
}

const countryValueByFinnishName: Record<string, string> = {
  Suomi: "FI",
  Ruotsi: "SE",
  Norja: "NO",
  Tanska: "DK",
  Viro: "EE",
  Saksa: "DE",
  Muu: OTHER_COUNTRY_VALUE
};

function compactPhone(value: string) {
  const cleaned = sanitizePhoneInput(value);

  if (cleaned.startsWith("00")) {
    return `+${cleaned.slice(2)}`;
  }

  return cleaned;
}

function getPhoneParts(value: string) {
  const compact =
    compactPhone(value);

  const matchedOption =
    phoneDialingOptions.find((option) => compact.startsWith(option.code));

  const code =
    matchedOption?.code ?? "+358";

  if (matchedOption) {
    return {
      code,
      national: compact.slice(code.length)
    };
  }

  return {
    code,
    national: compact.replace(/^\+/, "")
  };
}

function buildPhoneNumber(code: string, national: string) {
  const digits =
    national.replace(/\D/g, "");

  if (!digits) return "";

  const withoutLocalZero =
    digits.startsWith("0") ? digits.slice(1) : digits;

  return `${code}${withoutLocalZero}`;
}

type AuthFormState = typeof emptyAuthForm;

type ProfileCompletionDraft = {
  customCountry?: string;
  form?: Partial<AuthFormState>;
  phoneDialingCode?: string;
  privacyAccepted?: boolean;
  scrollY?: number;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function readRegistrationPinCooldown(email: string) {
  if (typeof window === "undefined") return 0;

  try {
    const raw = sessionStorage.getItem(REGISTRATION_PIN_COOLDOWN_STORAGE_KEY);
    if (!raw) return 0;

    const parsed = JSON.parse(raw) as {
      email?: string;
      sentAt?: number;
    };

    if (normalizeEmail(parsed.email ?? "") !== normalizeEmail(email)) {
      return 0;
    }

    const sentAt = Number(parsed.sentAt ?? 0);
    const remaining = REGISTRATION_PIN_COOLDOWN_MS - (Date.now() - sentAt);

    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

function rememberRegistrationPinSent(email: string) {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(
      REGISTRATION_PIN_COOLDOWN_STORAGE_KEY,
      JSON.stringify({
        email: normalizeEmail(email),
        sentAt: Date.now()
      })
    );
  } catch {}
}

function formatCooldownSeconds(milliseconds: number) {
  return Math.max(1, Math.ceil(milliseconds / 1000));
}

function isRegistrationPinAlreadySentMessage(message: string | undefined) {
  const lower = (message ?? "").toLowerCase();

  return (
    lower.includes("pin-koodi on jo lähetetty") ||
    lower.includes("vahvistussähköposteja") ||
    lower.includes("too many requests") ||
    lower.includes("over_email_send_rate_limit")
  );
}

function getProfileCompletionDraftForm(form: AuthFormState): Partial<AuthFormState> {
  return {
    account_type: form.account_type,
    address: form.address,
    billing_email: form.billing_email,
    birth_date: form.birth_date,
    business_id: form.business_id,
    city: form.city,
    company_name: form.company_name,
    company_role: form.company_role,
    company_website: form.company_website,
    country: form.country,
    email: form.email,
    first_name: form.first_name,
    last_name: form.last_name,
    phone: form.phone,
    postal_code: form.postal_code
  };
}

function getGoogleAddressPart(place: GooglePlace, type: string, short = false) {
  const part = place.address_components?.find((component) =>
    component.types.includes(type)
  );
  return short ? part?.short_name ?? "" : part?.long_name ?? "";
}

function getStreetAddressFromGooglePlace(place: GooglePlace) {
  const route = getGoogleAddressPart(place, "route");
  const streetNumber = getGoogleAddressPart(place, "street_number");
  const streetAddress = [route, streetNumber].filter(Boolean).join(" ");
  return streetAddress || place.formatted_address || "";
}

function getCountryValueFromGooglePlace(place: GooglePlace) {
  const countryCode = getGoogleAddressPart(place, "country", true).toUpperCase();
  const supportedCountries: Record<string, string> = {
    DK: "DK",
    DE: "DE",
    EE: "EE",
    FI: "FI",
    NO: "NO",
    SE: "SE"
  };
  return supportedCountries[countryCode] ?? "";
}

function normalizeAuthErrorMessage(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("email not confirmed") ||
    lower.includes("user not found")
  ) {
    return "Tätä sähköpostia ei ole rekisteröity. Rekisteröidy ensin tai tarkista salasana.";
  }

  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "Tällä sähköpostilla on jo tili. Kirjaudu sisään.";
  }

  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("over_email_send_rate_limit")
  ) {
    return "PIN-koodi on jo lähetetty. Tarkista sähköpostisi tai odota hetki ennen uuden koodin pyytämistä.";
  }

  return message;
}

function getErrorMessage(error: unknown) {
  if (!error) return "Tuntematon virhe.";
  if (error instanceof Error) return normalizeAuthErrorMessage(error.message);
  if (typeof error === "string") return normalizeAuthErrorMessage(error);
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return normalizeAuthErrorMessage(error.message);
  }
  return "Toiminto epäonnistui.";
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "Supabase ei vastannut ajoissa. Kokeile uudelleen."
) {
  let timeoutId: number | undefined;

  const timeoutPromise =
    new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);
    });

  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });
}

async function getFreshAuthUser(fallbackUser?: User | null): Promise<User | null> {
  const [session, currentUser] =
    await Promise.all([
      getSafeAuthSession().catch(() => null),
      getSafeAuthUser().catch(() => null)
    ]);

  return currentUser ?? session?.user ?? fallbackUser ?? null;
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useLanguage();
  const pinText = registrationPinText[locale];
  const authPagePath = pagePath("auth", locale);
  const authRedirectPath = getSafeAuthRedirectPath(searchParams.get("next"));
  const [authMode, setAuthMode] = useState<AuthMode>(() => getAuthModeFromSearchParams(searchParams));
  const sellLoginPrompt =
    authMode === "login" && searchParams.get("reason") === "sell"
      ? "Kirjaudu sisään jatkaaksesi ilmoituksen luontia."
      : "";
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [form, setForm] = useState(() => ({
    ...emptyAuthForm
  }));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationPasswordConfirm, setRegistrationPasswordConfirm] = useState("");
  const [showAuthPasswords, setShowAuthPasswords] = useState(false);
  const [status, setStatus] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const authSubmitInFlightRef = useRef(false);
  const automaticProfileSaveInFlightRef = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLookupDone, setProfileLookupDone] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [registrationPinPending, setRegistrationPinPending] = useState(false);
  const [registrationPinEmail, setRegistrationPinEmail] = useState("");
  const [registrationPin, setRegistrationPin] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [phoneDialingCode, setPhoneDialingCode] = useState("+358");
  const [phoneCodeMenuOpen, setPhoneCodeMenuOpen] = useState(false);
  const [customCountry, setCustomCountry] = useState("");
  const companyAddressInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!authSubmitting) return;

    const timeoutId = window.setTimeout(() => {
      authSubmitInFlightRef.current = false;
      setAuthSubmitting(false);
      setStatus((currentStatus) =>
        currentStatus ||
        "Yhteys kesti liian kauan. Painike vapautettiin, voit yrittää uudelleen."
      );
    }, AUTH_SUBMIT_AUTO_UNLOCK_MS);

    return () => window.clearTimeout(timeoutId);
  }, [authSubmitting]);

  // Capture ?ref=CODE from URL once
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        localStorage.setItem(REFERRAL_STORAGE_KEY, ref.trim().toLowerCase());
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawDraft = sessionStorage.getItem(PROFILE_COMPLETION_DRAFT_STORAGE_KEY);
      if (!rawDraft) return;

      const draft = JSON.parse(rawDraft) as ProfileCompletionDraft;
      const draftForm =
        draft.form && typeof draft.form === "object"
          ? draft.form
          : null;

      if (draftForm) {
        setForm((current) => ({
          ...current,
          ...draftForm,
          account_type:
            draftForm.account_type === "company" || draftForm.account_type === "private"
              ? draftForm.account_type
              : current.account_type,
          country:
            typeof draftForm.country === "string" && countryOptions.includes(draftForm.country)
              ? draftForm.country
              : current.country
        }));
      }

      if (typeof draft.customCountry === "string") {
        setCustomCountry(draft.customCountry);
      }

      if (
        typeof draft.phoneDialingCode === "string" &&
        phoneDialingOptions.some((option) => option.code === draft.phoneDialingCode)
      ) {
        setPhoneDialingCode(draft.phoneDialingCode);
      }

      if (typeof draft.privacyAccepted === "boolean") {
        setPrivacyAccepted(draft.privacyAccepted);
      }

      if (typeof draft.scrollY === "number" && Number.isFinite(draft.scrollY)) {
        window.setTimeout(() => {
          window.scrollTo({ top: draft.scrollY, behavior: "instant" });
        }, 0);
      }
    } catch {
      sessionStorage.removeItem(PROFILE_COMPLETION_DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    setAuthMode(getAuthModeFromSearchParams(searchParams));
    setStatus("");
  }, [searchParams]);

  useEffect(() => {
    if (form.account_type !== "company") return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    const setupAutocomplete = () => {
      const addressInput = companyAddressInputRef.current;
      const Autocomplete =
        (window as GoogleMapsWindow).google?.maps?.places?.Autocomplete;

      if (!addressInput || !Autocomplete || cancelled) return;

      const autocomplete = new Autocomplete(addressInput, {
        componentRestrictions: { country: ["dk", "de", "ee", "fi", "no", "se"] },
        fields: [
          "address_components",
          "formatted_address",
          "formatted_phone_number",
          "international_phone_number",
          "name",
          "website"
        ],
        types: ["establishment", "geocode"]
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const address = getStreetAddressFromGooglePlace(place);
        const postalCode = getGoogleAddressPart(place, "postal_code");
        const city =
          getGoogleAddressPart(place, "postal_town") ||
          getGoogleAddressPart(place, "locality") ||
          getGoogleAddressPart(place, "administrative_area_level_3");
        const country = getCountryValueFromGooglePlace(place);
        const phone =
          place.international_phone_number ||
          place.formatted_phone_number ||
          "";

        setForm((current) => ({
          ...current,
          address: address || current.address,
          city: city || current.city,
          company_name: current.company_name || place.name || "",
          company_website: current.company_website || place.website || "",
          country: country || current.country,
          phone: current.phone || phone,
          postal_code: postalCode || current.postal_code
        }));
      });
    };

    if ((window as GoogleMapsWindow).google?.maps?.places?.Autocomplete) {
      setupAutocomplete();
      return () => {
        cancelled = true;
      };
    }

    const scriptId = "google-places-autocomplete";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", setupAutocomplete, { once: true });
      return () => {
        cancelled = true;
        existingScript.removeEventListener("load", setupAutocomplete);
      };
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `/api/google-maps-script?language=${encodeURIComponent(locale)}`;
    script.addEventListener("load", setupAutocomplete, { once: true });
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", setupAutocomplete);
    };
  }, [form.account_type, locale]);

  // Try to award referral points when a logged-in user lands here with pending code
  async function tryClaimReferral(userId: string) {
    if (typeof window === "undefined") return;
    let code: string | null = null;
    try {
      code = localStorage.getItem(REFERRAL_STORAGE_KEY);
    } catch {}
    console.log("[Referral] Checking pending code:", code);
    if (!code) return;

    const referrerId = await getReferrerIdByCode(code);
    console.log("[Referral] Resolved referrer id for code", code, "â†’", referrerId);

    if (!referrerId) {
      console.warn("[Referral] No user found for code", code, "â€” SQL may not be set up.");
      try { localStorage.removeItem(REFERRAL_STORAGE_KEY); } catch {}
      return;
    }
    if (referrerId === userId) {
      console.warn("[Referral] Self-referral blocked.");
      try { localStorage.removeItem(REFERRAL_STORAGE_KEY); } catch {}
      return;
    }
    const result = await awardReferralPoints(referrerId, userId, 100);
    console.log("[Referral] Award result:", result);
    try { localStorage.removeItem(REFERRAL_STORAGE_KEY); } catch {}
    if (result.success) {
      setStatus(t.authReferralSuccess);
    } else if (result.error === "already_referred") {
      console.log("[Referral] User already has a referrer.");
    } else {
      console.error("[Referral] Failed to award points:", result.error);
    }
  }

  useEffect(() => {
    if (!supabase) return;

    withTimeout(
      supabase.auth.getSession(),
      7000,
      "Istunnon tarkistus kesti liian kauan."
    )
      .then(({ data }) => {
        const sessionUser = data.session?.user ?? null;

        if (!sessionUser) {
          setUser(null);
          return;
        }

        const googleIntent = getPendingGoogleAuthIntent();

        if (googleIntent === "login") {
          void withTimeout(
            getProfile(sessionUser.id),
            8000,
            "Profiilin tarkistus kesti liian kauan."
          ).then(({ data: profileData }) => {
            if (!profileData) {
              clearGoogleAuthIntent();
              setUser(null);
              setProfile(null);
              setStatus("Tätä Gmail-tiliä ei ole rekisteröity. Rekisteröidy ensin.");
              window.history.replaceState(null, "", `${authPagePath}?mode=login`);
              void signOut();
              return;
            }

            clearGoogleAuthIntent();
            setUser(sessionUser);
            void tryClaimReferral(sessionUser.id);
          }).catch(() => {
            clearGoogleAuthIntent();
            setUser(null);
            setStatus("Gmail-tilin tarkistus epäonnistui. Yritä uudelleen.");
            void signOut();
          });
          return;
        }

        if (googleIntent === "register") {
          clearGoogleAuthIntent();
          setAuthMode("register");
          window.history.replaceState(null, "", `${authPagePath}?mode=register`);
        }

        setUser(sessionUser);
        if (sessionUser) {
          void tryClaimReferral(sessionUser.id);
        }
        if (
          typeof window !== "undefined" &&
          window.location.hash.includes("type=recovery")
        ) {
          setRecoveryMode(true);
          setResetModalOpen(false);
        }
      })
      .catch(() => setUser(null));

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      const googleIntent = getPendingGoogleAuthIntent();

      if (event === "SIGNED_IN" && nextUser && googleIntent === "login") {
        void withTimeout(
          getProfile(nextUser.id),
          8000,
          "Profiilin tarkistus kesti liian kauan."
        ).then(({ data: profileData }) => {
          if (!profileData) {
            clearGoogleAuthIntent();
            setUser(null);
            setProfile(null);
            setStatus("Tätä Gmail-tiliä ei ole rekisteröity. Rekisteröidy ensin.");
            window.history.replaceState(null, "", `${authPagePath}?mode=login`);
            void signOut();
            return;
          }

          clearGoogleAuthIntent();
          setUser(nextUser);
          setStatus("");
        }).catch(() => {
          clearGoogleAuthIntent();
          setUser(null);
          setStatus("Gmail-tilin tarkistus epäonnistui. Yritä uudelleen.");
          void signOut();
        });
        return;
      }

      if (event === "SIGNED_IN" && nextUser && googleIntent === "register") {
        clearGoogleAuthIntent();
        setAuthMode("register");
        window.history.replaceState(null, "", `${authPagePath}?mode=register`);
      }

      setUser(nextUser);
      setProfile(null);

      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setResetModalOpen(false);
        setStatus("");
      }

      if (event === "SIGNED_IN" && session?.user) {
        setEmailPending(false);
        setStatus("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileLookupDone(false);
      return;
    }

    setProfileLookupDone(false);

    const metadata = user.user_metadata ?? {};
    const metadataType =
      metadata.account_type === "company"
        ? "company"
        : metadata.account_type === "private"
        ? "private"
        : null;

    if (metadataType) {
      setForm((current) => ({
        ...current,
        account_type: metadataType
      }));
    }

    withTimeout(
      getProfile(user.id),
      7000,
      "Profiilin lataus kesti liian kauan."
    )
      .then(({ data }) => {
        if (isProfileCompleted(data)) {
          setProfile(data);
          router.replace(authRedirectPath);
          return;
        }

        if (!isProfileCompleted(data)) {
          const metadata = user.user_metadata ?? {};
          const fullName = String(metadata.full_name ?? metadata.name ?? "").trim();
          const [firstName = "", ...lastNameParts] = fullName.split(" ");
          const email = user.email ?? "";
          const storedCountry = String(data?.country || metadata.country || "").trim();

          if (storedCountry && !countryOptions.includes(storedCountry)) {
            setCustomCountry(storedCountry);
          }

          setForm((current) => ({
            ...current,
            email: current.email || email,
            first_name: current.first_name || data?.first_name || String(metadata.first_name ?? firstName),
            last_name: current.last_name || data?.last_name || String(metadata.last_name ?? lastNameParts.join(" ")),
            account_type:
              data?.account_type ||
              (metadata.account_type === "company" ? "company" : metadata.account_type === "private" ? "private" : current.account_type),
            company_name: current.company_name || data?.company_name || "",
            business_id: current.business_id || data?.business_id || "",
            company_role: current.company_role || data?.company_role || "",
            company_website: current.company_website || data?.company_website || "",
            billing_email: current.billing_email || data?.billing_email || "",
            phone: current.phone || data?.phone || String(metadata.phone ?? ""),
            address: current.address || data?.address || String(metadata.address ?? ""),
            postal_code: current.postal_code || data?.postal_code || String(metadata.postal_code ?? ""),
            city: current.city || data?.city || String(metadata.city ?? ""),
            country: (() => {
              const nextCountry = current.country !== emptyAuthForm.country ? current.country : storedCountry || emptyAuthForm.country;
              const normalizedCountry = countryValueByFinnishName[nextCountry] ?? nextCountry;
              return countryOptions.includes(normalizedCountry) ? normalizedCountry : OTHER_COUNTRY_VALUE;
            })(),
            birth_date: current.birth_date || data?.birth_date || String(metadata.birth_date ?? "")
          }));
          if (metadata.privacy_accepted === "true") {
            setPrivacyAccepted(true);
          }
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setProfileLookupDone(true));
  }, [user]);

  async function saveProfile(targetUser: User) {
    try {
    const email = targetUser.email ?? form.email;
    const selectedCountry =
      form.country === OTHER_COUNTRY_VALUE
        ? customCountry.trim()
        : countryNameByLocale.fi[form.country] ?? form.country;

    if (!privacyAccepted) {
      setStatus(t.authPrivacyRequired);
      return;
    }

    if (
      !form.phone ||
      !form.address ||
      !form.postal_code ||
      !form.city ||
      !selectedCountry ||
      (form.account_type === "private" && (!form.first_name || !form.last_name || !form.birth_date)) ||
      (form.account_type === "company" && (!form.company_name || !form.business_id))
    ) {
      setStatus(
        form.account_type === "company"
          ? t.authCompanyFieldsRequired
          : t.authPersonalFieldsRequired
      );
      return;
    }

    const { data, error } =
      await withTimeout(
        upsertProfileFromApi({
          id: targetUser.id,
          account_type: form.account_type,
          first_name: form.account_type === "private" ? form.first_name : "",
          last_name: form.account_type === "private" ? form.last_name : "",
          company_name: form.account_type === "company" ? form.company_name : null,
          business_id: form.account_type === "company" ? form.business_id : null,
          company_website: form.account_type === "company" ? form.company_website : null,
          billing_email: form.account_type === "company" ? (form.billing_email || email) : null,
          email,
          phone: form.phone,
          address: form.address,
          postal_code: form.postal_code,
          city: form.city,
          country: selectedCountry,
          birth_date: form.account_type === "private" ? form.birth_date : null
        }),
        25000,
        "Profiilin tallennus kesti liian kauan."
      );

    if (error) {
      const msg = getErrorMessage(error);
      if (msg.includes("phone_reserved_until_3_months")) {
        setStatus("Tämä puhelinnumero on varattu poistetulle tilille 3 kuukaudeksi.");
      } else if (msg.includes("profiles_phone_unique") || msg.includes("unique constraint")) {
        setStatus(t.authPhoneUnique);
      } else {
        setStatus(msg);
      }
      return;
    }

    setProfile(data);
    try {
      sessionStorage.removeItem(PROFILE_COMPLETION_DRAFT_STORAGE_KEY);
    } catch {}
    // Final chance to claim referral (covers email-confirmation signups
    // where the session arrived after the initial useEffect)
    await tryClaimReferral(targetUser.id);
    setStatus(t.authProfileSavedMsg);
    setAuthSubmitting(false);
    router.push(form.account_type === "company" ? "/profile#yritys" : "/");
    } catch (error) {
      setAuthSubmitting(false);
      setStatus(getErrorMessage(error));
    }
  }

  useEffect(() => {
    if (
      !user ||
      !profileLookupDone ||
      isProfileCompleted(profile) ||
      automaticProfileSaveInFlightRef.current
    ) return;

    const metadata = user.user_metadata ?? {};
    let hasRegistrationDraft = metadata.registration_form_complete === "true";
    try {
      hasRegistrationDraft ||= Boolean(sessionStorage.getItem(PROFILE_COMPLETION_DRAFT_STORAGE_KEY));
    } catch {}

    if (!hasRegistrationDraft) return;

    const selectedCountry = form.country === OTHER_COUNTRY_VALUE
      ? customCountry.trim()
      : countryNameByLocale.fi[form.country] ?? form.country;
    const hasAllRequiredFields = Boolean(
      privacyAccepted && form.phone && form.address && form.postal_code && form.city && selectedCountry &&
      (form.account_type === "private"
        ? form.first_name && form.last_name && form.birth_date
        : form.company_name && form.business_id)
    );

    if (!hasAllRequiredFields) return;

    automaticProfileSaveInFlightRef.current = true;
    void saveProfile(user).finally(() => {
      automaticProfileSaveInFlightRef.current = false;
    });
  }, [customCountry, form, privacyAccepted, profile, profileLookupDone, user]);

  useEffect(() => {
    if (!user || !profileLookupDone || isProfileCompleted(profile)) return;

    const metadata = user.user_metadata ?? {};
    let hasRegistrationDraft = metadata.registration_form_complete === "true";
    try {
      hasRegistrationDraft ||= Boolean(sessionStorage.getItem(PROFILE_COMPLETION_DRAFT_STORAGE_KEY));
    } catch {}

    if (!hasRegistrationDraft) {
      router.replace("/profile");
    }
  }, [profile, profileLookupDone, router, user]);

  async function createAccountAfterRegistrationPin(
    selectedCountry: string,
    targetUser: User
  ) {
    persistProfileCompletionDraft();

    setStatus("Viimeistellään rekisteröintiä...");

    const existingProfileResult =
      await withTimeout(
        getProfile(targetUser.id),
        8000,
        "Profiilin tarkistus kesti liian kauan."
      );

    if (isProfileCompleted(existingProfileResult.data)) {
      await signOut();
      setUser(null);
      setRegistrationPinPending(false);
      setRegistrationPin("");
      setRegistrationPinEmail("");
      setStatus("Tämä sähköposti on jo rekisteröity. Kirjaudu sisään.");
      setAuthMode("login");
      setAuthSubmitting(false);
      return;
    }

    const freshUser =
      await withTimeout(
        getFreshAuthUser(targetUser),
        5000,
        "Käyttäjän lataus kesti liian kauan."
      );

    if (!freshUser) {
      setStatus("Koodi hyväksyttiin, mutta käyttäjää ei saatu ladattua. Päivitä sivu ja kirjaudu sisään.");
      setAuthSubmitting(false);
      return;
    }

    const passwordResult =
      await withTimeout(
        updatePassword(form.password),
        10000,
        "Salasanan tallennus kesti liian kauan."
      );

    if (passwordResult.error) {
      setStatus(getErrorMessage(passwordResult.error));
      setAuthSubmitting(false);
      return;
    }

    setRegistrationPinPending(false);
    setRegistrationPin("");
    setRegistrationPinEmail("");
    setUser(freshUser);
    void tryClaimReferral(freshUser.id);
    await saveProfile(freshUser);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authSubmitInFlightRef.current) return;
    authSubmitInFlightRef.current = true;

    try {
    if (!isSupabaseConfigured) {
      setStatus("Supabase keys missing from .env.local");
      return;
    }

    setAuthSubmitting(true);

    if (authMode === "login") {
      setStatus("Tarkistetaan tiliä...");
      const { data, error } =
        await withTimeout(
          signInWithEmail(form.email, form.password),
          4500,
          "Kirjautuminen kesti liian kauan."
        );

      if (error) {
        setStatus(getErrorMessage(error));
        setAuthSubmitting(false);
        return;
      }

      if (data?.user) {
        const profileResult =
          await withTimeout(
            getProfile(data.user.id),
            8000,
            "Profiilin lataus kesti liian kauan."
          );

        if (isProfileCompleted(profileResult.data)) {
          setStatus(t.authLoginSuccess);
          setAuthSubmitting(false);
          router.push(authRedirectPath);
          return;
        }

        setUser(data.user);
        setStatus(t.authCompleteProfileMsg);
      }
      setAuthSubmitting(false);
      return;
    }

    const selectedCountry = form.country === OTHER_COUNTRY_VALUE
      ? customCountry.trim()
      : countryNameByLocale.fi[form.country] ?? form.country;

    if (form.password !== registrationPasswordConfirm) {
      setStatus("Salasanat eivät täsmää. Kirjoita sama salasana molempiin kenttiin.");
      setAuthSubmitting(false);
      return;
    }
    if (!privacyAccepted) {
      setStatus(t.authPrivacyRequired);
      setAuthSubmitting(false);
      return;
    }
    if (
      !form.phone || !form.address || !form.postal_code || !form.city || !selectedCountry ||
      (form.account_type === "private" && (!form.first_name || !form.last_name || !form.birth_date)) ||
      (form.account_type === "company" && (!form.company_name || !form.business_id))
    ) {
      setStatus(form.account_type === "company" ? t.authCompanyFieldsRequired : t.authPersonalFieldsRequired);
      setAuthSubmitting(false);
      return;
    }

    setStatus("Tarkistetaan puhelinnumeroa...");
    const phoneCheck =
      await withTimeout(
        checkPhoneBeforeRegistration(form.phone),
        8000,
        "Puhelinnumeron tarkistus kesti liian kauan."
      );

    if (!phoneCheck.available) {
      if (phoneCheck.reason === "reserved") {
        setStatus("Tämä puhelinnumero on varattu poistetulle tilille 3 kuukaudeksi.");
      } else if (phoneCheck.reason === "in_use") {
        setStatus(t.authPhoneUnique);
      } else {
        setStatus(phoneCheck.error || "Puhelinnumeron tarkistus epäonnistui.");
      }
      setAuthSubmitting(false);
      return;
    }

    const pinCooldownMs = readRegistrationPinCooldown(form.email);
    if (pinCooldownMs > 0) {
      setRegistrationPinEmail(form.email);
      setRegistrationPin("");
      setRegistrationPinPending(true);
      setStatus(`PIN-koodi on jo lähetetty. Tarkista sähköpostisi tai odota ${formatCooldownSeconds(pinCooldownMs)} sekuntia ennen uuden koodin pyytämistä.`);
      setAuthSubmitting(false);
      return;
    }

    setStatus("Lähetetään PIN-koodi sähköpostiin...");
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}${authPagePath}`
        : undefined;
    const pinResult =
      await withTimeout(
        sendRegistrationPin(
          form.email,
          {
            registration_form_complete: "true",
            locale,
            privacy_accepted: privacyAccepted ? "true" : "false",
            account_type: form.account_type,
            first_name: form.first_name,
            last_name: form.last_name,
            company_name: form.company_name,
            business_id: form.business_id,
            company_website: form.company_website,
            billing_email: form.billing_email,
            phone: form.phone,
            address: form.address,
            postal_code: form.postal_code,
            city: form.city,
            country: selectedCountry,
            birth_date: form.birth_date
          },
          redirectTo
        ),
        10000,
        "PIN-koodin lähetys kesti liian kauan."
      );

    if (!pinResult.sent) {
      if (isRegistrationPinAlreadySentMessage(pinResult.error)) {
        rememberRegistrationPinSent(form.email);
        setRegistrationPinEmail(form.email);
        setRegistrationPin("");
        setRegistrationPinPending(true);
        setStatus(pinResult.error || "PIN-koodi on jo lähetetty. Tarkista sähköpostisi.");
      } else {
        setStatus(pinResult.error || "PIN-koodin lähetys epäonnistui.");
      }
      setAuthSubmitting(false);
      return;
    }

    rememberRegistrationPinSent(form.email);
    setRegistrationPinEmail(form.email);
    setRegistrationPin("");
    setRegistrationPinPending(true);
    setStatus(`Lähetimme PIN-koodin osoitteeseen ${form.email}.`);
    setAuthSubmitting(false);
    } catch (error) {
      setAuthSubmitting(false);
      setStatus(getErrorMessage(error));
    } finally {
      authSubmitInFlightRef.current = false;
    }
  }

  async function handleRegistrationPinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authSubmitInFlightRef.current) return;
    authSubmitInFlightRef.current = true;

    try {
      setAuthSubmitting(true);
      setStatus("Tarkistetaan PIN-koodia...");

      const result =
        await withTimeout(
          verifyRegistrationPin({
            email: registrationPinEmail,
            pin: registrationPin
          }),
          8000,
          "PIN-koodin tarkistus kesti liian kauan."
        );

      if (!result.verified || !result.user) {
        setStatus(result.error || "PIN-koodi on väärä.");
        setAuthSubmitting(false);
        return;
      }

      const selectedCountry = form.country === OTHER_COUNTRY_VALUE
        ? customCountry.trim()
        : countryNameByLocale.fi[form.country] ?? form.country;

      await createAccountAfterRegistrationPin(selectedCountry, result.user);
    } catch (error) {
      setAuthSubmitting(false);
      setStatus(getErrorMessage(error));
    } finally {
      authSubmitInFlightRef.current = false;
    }
  }

  async function resendRegistrationPin() {
    try {
      setAuthSubmitting(true);
      const targetEmail = registrationPinEmail || form.email;
      const pinCooldownMs = readRegistrationPinCooldown(targetEmail);
      if (pinCooldownMs > 0) {
        setStatus(`PIN-koodi on jo lähetetty. Odota ${formatCooldownSeconds(pinCooldownMs)} sekuntia ennen uuden koodin pyytämistä.`);
        setAuthSubmitting(false);
        return;
      }

      setStatus("Lähetetään uusi PIN-koodi...");
      const pinResult =
        await withTimeout(
          sendRegistrationPin(targetEmail, { locale }),
          10000,
          "PIN-koodin lähetys kesti liian kauan."
        );

      if (!pinResult.sent) {
        if (isRegistrationPinAlreadySentMessage(pinResult.error)) {
          rememberRegistrationPinSent(targetEmail);
          setRegistrationPinEmail(targetEmail);
          setRegistrationPin("");
          setRegistrationPinPending(true);
          setStatus(pinResult.error || "PIN-koodi on jo lähetetty. Tarkista sähköpostisi.");
        } else {
          setStatus(pinResult.error || "PIN-koodin lähetys epäonnistui.");
        }
        setAuthSubmitting(false);
        return;
      }

      rememberRegistrationPinSent(targetEmail);
      setRegistrationPin("");
      setStatus(`Uusi PIN-koodi lähetettiin osoitteeseen ${targetEmail}.`);
      setAuthSubmitting(false);
    } catch (error) {
      setAuthSubmitting(false);
      setStatus(getErrorMessage(error));
    }
  }

  async function handlePasswordReset() {
    try {
    if (!resetEmail) {
      setResetStatus(t.authEnterEmailFirst);
      return;
    }

    setResetStatus(t.authSendingResetLink);
    const { error } =
      await withTimeout(
        resetPassword(resetEmail, locale),
        10000,
        "Palautuslinkin lähetys kesti liian kauan."
      );

    if (error) {
      setResetStatus(getErrorMessage(error));
      return;
    }

    setResetStatus(t.authResetLinkSent);
    } catch (error) {
      setResetStatus(getErrorMessage(error));
    }
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
    if (newPassword.length < 6) {
      setStatus(t.authPasswordTooShort);
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus(t.authPasswordsMismatch);
      return;
    }

    setStatus(t.authSavingPassword);

    const { error } =
      await withTimeout(
        updatePassword(newPassword),
        10000,
        "Salasanan tallennus kesti liian kauan."
      );

    if (error) {
      setStatus(getErrorMessage(error));
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setRecoveryMode(false);
    setStatus(t.authPasswordChanged);
    router.push("/");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleSignOut() {
    setUser(null);
    setProfile(null);
    setRecoveryMode(false);
    setResetModalOpen(false);
    setStatus("");
    try {
      sessionStorage.removeItem("home_return_state_v1");
      sessionStorage.removeItem("home_return_pending_v1");
      sessionStorage.removeItem(PROFILE_COMPLETION_DRAFT_STORAGE_KEY);
    } catch {}
    try {
      await signOut();
    } finally {
      router.replace("/");
    }
  }

  async function handleGoogleLogin() {
    try {
    setStatus("");
    rememberGoogleAuthIntent(authMode);
    const { error } =
      await withTimeout(
        signInWithGoogle(authMode, authPagePath),
        10000,
        "Google-kirjautuminen kesti liian kauan."
      );
    if (error) {
      clearGoogleAuthIntent();
      setStatus(getErrorMessage(error));
    }
    } catch (error) {
      clearGoogleAuthIntent();
      setStatus(getErrorMessage(error));
    }
  }

  const needsProfile = Boolean(user && !isProfileCompleted(profile));
  const metadataAccountType =
    user?.user_metadata?.account_type === "company" ||
    user?.user_metadata?.account_type === "private"
      ? user.user_metadata.account_type
      : null;
  const lockedAccountType =
    metadataAccountType;
  const phoneParts =
    form.phone
      ? getPhoneParts(form.phone)
      : {
          code: phoneDialingCode,
          national: ""
        };
  const currentPhoneDialingOption =
    phoneDialingOptions.find((option) => option.code === phoneParts.code) ??
    phoneDialingOptions.find((option) => option.code === phoneDialingCode) ??
    phoneDialingOptions[0];
  const primaryAuthActionLabel =
    authMode === "register"
      ? "Rekisteröidy"
      : t.login;
  const registrationPasswordStrengthScore = [
    form.password.length >= 8,
    form.password.length >= 12,
    /[a-zåäö]/.test(form.password) && /[A-ZÅÄÖ]/.test(form.password),
    /\d/.test(form.password),
    /[^A-Za-zÅÄÖåäö0-9]/.test(form.password)
  ].filter(Boolean).length;
  const registrationPasswordStrength =
    registrationPasswordStrengthScore >= 4
      ? "strong"
      : registrationPasswordStrengthScore >= 2
        ? "medium"
        : "weak";
  const registrationPasswordStrengthLabel =
    registrationPasswordStrength === "strong"
      ? "Vahva salasana"
      : registrationPasswordStrength === "medium"
        ? "Keskitasoinen salasana"
        : "Heikko salasana";
  const registrationPasswordsMatch =
    registrationPasswordConfirm.length > 0 &&
    form.password === registrationPasswordConfirm;
  const nextAuthMode: AuthMode = authMode === "login" ? "register" : "login";
  const showBackHome =
    !user && !emailPending;
  const profilePrivacyHref =
    "/privacy";

  function persistProfileCompletionDraft() {
    if (typeof window === "undefined") return;

    const draft: ProfileCompletionDraft = {
      customCountry,
      form: getProfileCompletionDraftForm(form),
      phoneDialingCode: phoneParts.code,
      privacyAccepted,
      scrollY: window.scrollY
    };

    try {
      sessionStorage.setItem(PROFILE_COMPLETION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setStatus("");
    setAuthSubmitting(false);

    if (typeof window === "undefined") return;

    window.history.replaceState(null, "", `${authPagePath}?mode=${mode}`);
  }

  return (
    <main className="auth-page simple-auth-page">
      {showBackHome && (
        <button
          type="button"
          className="auth-back-home"
          onClick={() => goBackOrFallback(router)}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
      )}
      <section className="simple-auth auth-centered">
        {recoveryMode ? (
          <form
            className="auth-card simple-card password-reset-card"
            onSubmit={handleUpdatePassword}
          >
            <div className="password-reset-head">
              <span className="eyebrow">{t.authPasswordChangeTitle}</span>
              <h1>{t.authNewPassword}</h1>
              <p>
                {t.authNewPasswordDesc}
              </p>
            </div>

            <label>
              {t.authNewPasswordLabel}
              <input
                required
                minLength={6}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={t.authPasswordMinPlaceholder}
              />
            </label>

            <label>
              {t.authConfirmPasswordLabel}
              <input
                required
                minLength={6}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t.authRepeatPasswordPlaceholder}
              />
            </label>

            <button type="submit">
              <LockKeyhole size={18} />
              {t.authSavePassword}
            </button>

            <span className="form-note">{status}</span>
          </form>
        ) : registrationPinPending ? (
          <form
            className="auth-card simple-card profile-completion-card email-confirm-card registration-pin-card"
            onSubmit={handleRegistrationPinSubmit}
          >
            <div className="email-confirm-icon" aria-hidden="true">
              <Mail size={28} />
            </div>
            <div className="profile-completion-head">
              <span className="eyebrow">{pinText.eyebrow}</span>
              <h1>{pinText.title}</h1>
            </div>
            <div className="profile-alert">
              <Mail size={20} />
              <span>
                {pinText.sent} <strong>{registrationPinEmail}</strong>.
                <small>{pinText.instruction}</small>
              </span>
            </div>
            <label>
              {pinText.label}
              <input
                required
                autoFocus
                autoComplete="one-time-code"
                enterKeyHint="done"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={registrationPin}
                onChange={(event) => setRegistrationPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
              />
            </label>
            <button type="submit" disabled={authSubmitting || registrationPin.length !== 6}>
              <Check size={18} />
              {authSubmitting ? pinText.submitting : pinText.confirm}
            </button>
            <div className="registration-pin-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={authSubmitting}
                onClick={() => void resendRegistrationPin()}
              >
                <Mail size={16} />
                {pinText.resend}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={authSubmitting}
                onClick={() => {
                  setRegistrationPinPending(false);
                  setRegistrationPin("");
                  setStatus("");
                }}
              >
                <ArrowLeft size={16} />
                {pinText.edit}
              </button>
            </div>
            {status && <span className="form-note registration-pin-status">{status}</span>}
          </form>
        ) : emailPending ? (
          <div className="auth-card simple-card profile-completion-card email-confirm-card">
            <div className="email-confirm-icon" aria-hidden="true">
              <Mail size={28} />
            </div>
            <div className="profile-completion-head">
              <span className="eyebrow">{t.authAccountCreated}</span>
              <h1>{t.authConfirmEmailTitle}</h1>
            </div>
            <div className="profile-alert">
              <Mail size={20} />
              <span>
                {t.authEmailSentTo} <strong>{pendingEmail}</strong>.
                {t.authEmailClickLink}
              </span>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => { setEmailPending(false); setAuthMode("login"); }}
            >
              {t.authLoginExisting}
            </button>
          </div>
        ) : !user ? (
          <form className={`auth-card simple-card${authMode === "register" ? " registration-inline-card profile-finalize-card" : ""}`} onSubmit={handleSubmit}>
            <div className="auth-form-head">
              <h1>{authMode === "login" ? "Kirjaudu sisään" : t.register}</h1>
              {sellLoginPrompt && <p>{sellLoginPrompt}</p>}
              {authMode === "register" && <p>Luo tili ja aloita palvelun käyttö</p>}
            </div>

            <label>
              {t.email}
              <span className={authMode === "register" ? "auth-input-with-icon" : undefined}>
                {authMode === "register" && <Mail size={17} aria-hidden="true" />}
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => {
                    setForm({ ...form, email: event.target.value });
                    setResetEmail(event.target.value);
                  }}
                  placeholder="nimi@gmail.com"
                />
              </span>
            </label>
            <div className={authMode === "register" ? "auth-password-pair" : undefined}>
            <label className="auth-password-label">
              <span className="auth-label-row">
                <span>{t.password}</span>
              </span>
              <span className={authMode === "register" ? "auth-input-with-icon auth-password-input" : undefined}>
                {authMode === "register" && <LockKeyhole size={17} aria-hidden="true" />}
                <input required minLength={6} type={showAuthPasswords ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={t.authPasswordMinPlaceholder} />
                {authMode === "register" && (
                  <button type="button" className="auth-password-eye" aria-label={showAuthPasswords ? "Piilota salasanat" : "Näytä salasanat"} aria-pressed={showAuthPasswords} onClick={() => setShowAuthPasswords((shown) => !shown)}>
                    {showAuthPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                )}
              </span>
              {authMode === "login" && (
                <button
                  className="auth-forgot-inline"
                  type="button"
                  onClick={() => {
                    setResetEmail(form.email);
                    setResetStatus("");
                    setResetModalOpen(true);
                  }}
                >
                  {t.forgotPassword}
                </button>
              )}
            </label>
            {authMode === "register" && (
              <label className="auth-password-label">
                <span className="auth-label-row"><span>Salasana uudelleen</span></span>
                <span className={`auth-input-with-icon auth-confirm-password-input${registrationPasswordsMatch ? " passwords-match" : ""}`}>
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input required minLength={6} type={showAuthPasswords ? "text" : "password"} value={registrationPasswordConfirm} onChange={(event) => setRegistrationPasswordConfirm(event.target.value)} placeholder="Kirjoita salasana uudelleen" />
                  <button type="button" className="auth-password-eye" aria-label={showAuthPasswords ? "Piilota salasanat" : "Näytä salasanat"} aria-pressed={showAuthPasswords} onClick={() => setShowAuthPasswords((shown) => !shown)}>
                    {showAuthPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            )}
            </div>
            {authMode === "register" && form.password.length > 0 && (
              <div className={`auth-password-strength strength-${registrationPasswordStrength}`} aria-live="polite">
                <span className="auth-password-strength-track"><span /></span>
                <span className="auth-password-match"><Check size={13} /> {registrationPasswordStrengthLabel}</span>
              </div>
            )}
            {authMode === "register" && registrationPasswordConfirm.length > 0 && !registrationPasswordsMatch && (
              <div className="auth-password-mismatch" role="alert">
                <X size={14} /> Salasanat eivät ole samat
              </div>
            )}

            {authMode === "register" && (
              <>
                <div className="account-type-picker register-account-type" aria-label={t.authAccountType}>
                  <button type="button" className={form.account_type === "private" ? "account-type-card active" : "account-type-card"} onClick={() => setForm({ ...form, account_type: "private" })}>
                    <UserRound size={22} /><span className="account-type-copy"><strong>{t.authPrivateSellerLabel}</strong><span>Myy omia tavaroitasi</span></span><span className="account-type-check"><Check size={14} /></span>
                  </button>
                  <button type="button" className={form.account_type === "company" ? "account-type-card active" : "account-type-card"} onClick={() => setForm({ ...form, account_type: "company" })}>
                    <Building2 size={22} /><span className="account-type-copy"><strong>{t.authCompanyLabel}</strong><span>Myy yrityksesi nimissä</span></span><span className="account-type-check"><Check size={14} /></span>
                  </button>
                </div>
                <div className="registration-fields register-details-grid">
                  {form.account_type === "private" ? <>
                    <label>{t.authFirstName}<input required autoComplete="given-name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
                    <label>{t.authLastName}<input required autoComplete="family-name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
                    <BirthDateField required value={form.birth_date} onChange={(value) => setForm({ ...form, birth_date: value })} />
                  </> : <>
                    <label>{t.authCompanyName}<input required autoComplete="organization" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></label>
                    <label>{t.authBusinessId}<input required value={form.business_id} onChange={(e) => setForm({ ...form, business_id: e.target.value })} /></label>
                    <label>{t.authCompanyWebsite}<input autoComplete="url" value={form.company_website} onChange={(e) => setForm({ ...form, company_website: e.target.value })} placeholder="https://yritys.fi" /></label>
                  </>}
                  <label>
                    {form.account_type === "company" ? t.authCompanyPhone : t.authPhone}
                    <div className="phone-field-row phone-field-row-polished register-phone-field">
                      <div
                        className={`phone-code-select-wrap${phoneCodeMenuOpen ? " is-open" : ""}`}
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) setPhoneCodeMenuOpen(false);
                        }}
                      >
                        <button
                          type="button"
                          className="phone-code-selected"
                          aria-label="Valitse maan suuntanumero"
                          aria-haspopup="listbox"
                          aria-expanded={phoneCodeMenuOpen}
                          onClick={() => setPhoneCodeMenuOpen((open) => !open)}
                        >
                          <img className="phone-code-flag-img" src={`https://flagcdn.com/24x18/${currentPhoneDialingOption.country.toLowerCase()}.png`} alt="" aria-hidden="true" />
                          <span>{phoneParts.code}</span>
                          <ChevronDown size={14} aria-hidden="true" />
                        </button>
                        {phoneCodeMenuOpen && (
                          <div className="phone-code-menu" role="listbox" aria-label="Maan suuntanumero">
                            {phoneDialingOptions.map((option) => (
                              <button
                                key={`${option.country}-${option.code}`}
                                type="button"
                                className={`phone-code-option${option.code === phoneParts.code ? " is-selected" : ""}`}
                                role="option"
                                aria-selected={option.code === phoneParts.code}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setPhoneCodeMenuOpen(false);
                                  setPhoneDialingCode(option.code);
                                  setForm({ ...form, phone: buildPhoneNumber(option.code, phoneParts.national) });
                                  event.currentTarget.blur();
                                }}
                              >
                                <img className="phone-code-flag-img" src={`https://flagcdn.com/24x18/${option.country.toLowerCase()}.png`} alt="" aria-hidden="true" />
                                <strong>{option.code}</strong>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        value={phoneParts.national}
                        onChange={(event) => setForm({ ...form, phone: buildPhoneNumber(phoneParts.code, sanitizePhoneDigits(event.target.value)) })}
                        placeholder="401234567"
                      />
                    </div>
                  </label>
                  <label className="register-address-wide">{form.account_type === "company" ? t.authCompanyAddress : t.authAddress}<input required autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
                  <label>{t.authPostalCode}<input required autoComplete="postal-code" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></label>
                  <label>{t.authCity}<input required autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
                  <label>{t.authCountry}<select required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>{countryOptions.map((country) => <option key={country} value={country}>{countryNameByLocale[locale][country]}</option>)}</select></label>
                </div>
                <div className="privacy-checkbox-row register-privacy-row">
                  <input id="register-privacy-accept" type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
                  <label htmlFor="register-privacy-accept" className="privacy-checkbox-label">{t.authPrivacyAcceptText} <Link href={profilePrivacyHref} target="_blank">{t.authPrivacyLink}</Link></label>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={authSubmitting || (authMode === "register" && !registrationPasswordsMatch)}
              title={authMode === "register" && !registrationPasswordsMatch ? "Kirjoita sama salasana molempiin kenttiin" : undefined}
            >
              {authMode === "register" ? <Check size={18} /> : <LockKeyhole size={18} />}
              {authSubmitting ? "Hetki..." : primaryAuthActionLabel}
            </button>
            <div className="auth-divider">
              <span>Tai jatka</span>
            </div>
            <div className="auth-social-row">
              <button
                className="google-button auth-social-button"
                type="button"
                onClick={handleGoogleLogin}
                aria-label={t.continueWithGmail}
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className="gmail-logo-img"
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 48'%3E%3Cpath fill='%234285f4' d='M4 8h10v32H4z'/%3E%3Cpath fill='%2334a853' d='M50 8h10v32H50z'/%3E%3Cpath fill='%23fbbc04' d='M50 8 32 24 14 8v12l18 16 18-16z'/%3E%3Cpath fill='%23ea4335' d='M4 8c0-3 3.6-5 6.2-3L32 22 53.8 5C56.4 3 60 5 60 8v6L32 36 4 14z'/%3E%3C/svg%3E"
                />
                <span>Gmail</span>
              </button>
            </div>
            <p className="auth-mode-switch">
              {authMode === "login" ? "Eikö sinulla ole tiliä?" : "Onko sinulla tili?"}{" "}
              <button
                type="button"
                onClick={() => switchAuthMode(nextAuthMode)}
              >
                {authMode === "login" ? t.register : t.login}
              </button>
            </p>
            {status ? <span className="form-note">{status}</span> : null}
          </form>
        ) : !profileLookupDone ? null : false ? (
          <form className={`auth-card simple-card profile-completion-card profile-finalize-card profile-type-${form.account_type} ${needsProfile ? "" : "profile-ready-card"}`} onSubmit={(event) => {
            event.preventDefault();
            saveProfile(user!);
          }}>
            <div className="profile-completion-head">
              <div className="profile-completion-topline">
                <span className="eyebrow">{t.authProfileCompletionTitle}</span>
              </div>
              <h1>{t.authCompleteDetailsTitle}</h1>
            </div>
            <div className="profile-alert">
              <Check size={20} />
              <span>
                {needsProfile
                  ? t.authCompleteBeforeAccess
                  : t.authProfileReady}
              </span>
            </div>
            {needsProfile ? (
              <>
                {lockedAccountType ? (
                  <div className="account-type-locked">
                    <span>{t.authAccountType}</span>
                    <strong>
                      {lockedAccountType === "company" ? t.authCompanyLabel : t.authPrivateSellerLabel}
                    </strong>
                    <p>
                      {lockedAccountType === "company"
                        ? t.authCompleteCompanyDetails
                        : t.authCompletePersonalProfile}
                    </p>
                  </div>
                ) : (
                  <div className="account-type-picker" aria-label={t.authAccountType}>
                    <button
                      type="button"
                      aria-pressed={form.account_type === "private"}
                      className={form.account_type === "private" ? "account-type-card active" : "account-type-card"}
                      onClick={() => {
                        rememberAccountType("private");
                        setForm({ ...form, account_type: "private" });
                      }}
                    >
                      <span className="account-type-icon" aria-hidden="true">
                        <UserRound size={28} />
                      </span>
                      <span className="account-type-copy">
                        <strong>{t.authPrivateSellerLabel}</strong>
                        <span>{t.authPrivateSellerDesc}</span>
                      </span>
                      <span className="account-type-check"><Check size={15} /></span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={form.account_type === "company"}
                      className={form.account_type === "company" ? "account-type-card active" : "account-type-card"}
                      onClick={() => {
                        rememberAccountType("company");
                        setForm({ ...form, account_type: "company" });
                      }}
                    >
                      <span className="account-type-icon" aria-hidden="true">
                        <Building2 size={28} />
                      </span>
                      <span className="account-type-copy">
                        <strong>{t.authCompanyLabel}</strong>
                        <span>{t.authCompanyDesc2}</span>
                      </span>
                      <span className="account-type-check"><Check size={15} /></span>
                    </button>
                  </div>
                )}

                <div
                  className="registration-fields"
                  onPointerDownCapture={(event) => {
                    const target = event.target as HTMLElement | null;
                    if (!target?.closest(".phone-code-select-wrap")) {
                      setPhoneCodeMenuOpen(false);
                    }
                  }}
                  onFocusCapture={(event) => {
                    const target = event.target as HTMLElement | null;
                    if (!target?.closest(".phone-code-select-wrap")) {
                      setPhoneCodeMenuOpen(false);
                    }
                  }}
                >
                  {form.account_type === "company" && (
                    <>
                      <label>
                        {t.authCompanyName}
                        <input
                          required
                          autoComplete="organization"
                          name="organization"
                          value={form.company_name}
                          onChange={(event) => setForm({ ...form, company_name: event.target.value })}
                          placeholder="esim. Maskines Varaosat Oy"
                        />
                      </label>
                      <label>
                        {t.authBusinessId}
                        <input
                          required
                          autoComplete="off"
                          name="business-id"
                          value={form.business_id}
                          onChange={(event) => setForm({ ...form, business_id: event.target.value })}
                          placeholder="1234567-8"
                        />
                      </label>
                    </>
                  )}
                  {form.account_type === "private" && (
                    <>
                      <label>
                        {t.authFirstName}
                        <input
                          required
                          autoComplete="given-name"
                          name="given-name"
                          value={form.first_name}
                          onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                        />
                      </label>
                      <label>
                        {t.authLastName}
                        <input
                          required
                          autoComplete="family-name"
                          name="family-name"
                          value={form.last_name}
                          onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                        />
                      </label>
                    </>
                  )}
                  {form.account_type === "company" && (
                    <label>
                      {t.authBillingEmail}
                      <input
                        type="email"
                        autoComplete="email"
                        name="billing-email"
                        value={form.billing_email}
                        onChange={(event) => setForm({ ...form, billing_email: event.target.value })}
                        placeholder={form.email || "laskutus@yritys.fi"}
                      />
                    </label>
                  )}
                  <label>
                    {form.account_type === "company" ? t.authCompanyPhone : t.authPhone}
                    <div className="phone-field-row phone-field-row-polished">
                      <div
                        className={`phone-code-select-wrap${phoneCodeMenuOpen ? " is-open" : ""}`}
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) {
                            setPhoneCodeMenuOpen(false);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="phone-code-selected"
                          aria-label="Valitse suuntanumero"
                          aria-haspopup="listbox"
                          aria-expanded={phoneCodeMenuOpen}
                          onClick={() => setPhoneCodeMenuOpen((open) => !open)}
                        >
                          <span className="phone-code-flag">{currentPhoneDialingOption.flag}</span>
                          <span className="phone-code-country">{currentPhoneDialingOption.country}</span>
                          <span>{phoneParts.code}</span>
                          <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
                        </button>
                        <input type="hidden" name="tel-country-code" value={phoneParts.code} />
                        {phoneCodeMenuOpen && (
                          <div className="phone-code-menu" role="listbox" aria-label="Suuntanumero">
                          {phoneDialingOptions.map((option) => (
                            <button
                              key={`${option.country}-${option.code}`}
                              type="button"
                              className={`phone-code-option${option.code === phoneParts.code ? " is-selected" : ""}`}
                              role="option"
                              aria-selected={option.code === phoneParts.code}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setPhoneDialingCode(option.code);
                                setForm({
                                  ...form,
                                  phone: buildPhoneNumber(option.code, phoneParts.national)
                                });
                                setPhoneCodeMenuOpen(false);
                              }}
                            >
                              <span className="phone-code-flag">{option.flag}</span>
                              <span className="phone-code-country">{option.country}</span>
                              <strong>{option.code}</strong>
                              <span className="phone-code-name">{getCountryName(locale, option.country)}</span>
                            </button>
                          ))}
                          </div>
                        )}
                      </div>
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        pattern="[0-9]*"
                        autoComplete="tel-national"
                        name="tel-national"
                        value={phoneParts.national}
                        onChange={(event) => {
                          setPhoneDialingCode(phoneParts.code);
                          setForm({
                            ...form,
                            phone: buildPhoneNumber(phoneParts.code, sanitizePhoneDigits(event.target.value))
                          });
                        }}
                        placeholder="401234567"
                      />
                    </div>
                  </label>
                  {form.account_type === "private" ? (
                    <BirthDateField
                      required
                      value={form.birth_date}
                      onChange={(value) => setForm({ ...form, birth_date: value })}
                    />
                  ) : (
                    <label>
                      {t.authCompanyWebsite}
                      <input
                        autoComplete="url"
                        name="url"
                        value={form.company_website}
                        onChange={(event) => setForm({ ...form, company_website: event.target.value })}
                        placeholder="https://yritys.fi"
                      />
                    </label>
                  )}
                  <label>
                    {form.account_type === "company" ? t.authCompanyAddress : t.authAddress}
                    <input
                      required
                      ref={companyAddressInputRef}
                      autoComplete="street-address"
                      name="street-address"
                      value={form.address}
                      onChange={(event) => setForm({ ...form, address: event.target.value })}
                    />
                  </label>
                  <label>
                    {t.authPostalCode}
                    <input
                      required
                      autoComplete="postal-code"
                      name="postal-code"
                      value={form.postal_code}
                      onChange={(event) => setForm({ ...form, postal_code: event.target.value })}
                    />
                  </label>
                  <label>
                    {t.authCity}
                    <input
                      required
                      autoComplete="address-level2"
                      name="address-level2"
                      value={form.city}
                      onChange={(event) => setForm({ ...form, city: event.target.value })}
                    />
                  </label>
                  <label>
                    {t.authCountry}
                    <select
                      required
                      autoComplete="country-name"
                      name="country-name"
                      value={form.country}
                      onChange={(event) => {
                        const nextCountry = event.target.value;
                        setForm({ ...form, country: nextCountry });
                        if (nextCountry !== OTHER_COUNTRY_VALUE) {
                          setCustomCountry("");
                        }
                      }}
                    >
                      {countryOptions.map((country) => (
                        <option key={country} value={country}>
                          {countryNameByLocale[locale][country]}
                        </option>
                      ))}
                    </select>
                    {form.country === OTHER_COUNTRY_VALUE && (
                      <input
                        required
                        className="custom-country-input"
                        value={customCountry}
                        onChange={(event) => setCustomCountry(event.target.value)}
                        placeholder={
                          locale === "fi" ? "Kirjoita maa" :
                          locale === "sv" ? "Skriv land" :
                          locale === "no" ? "Skriv land" :
                          locale === "et" ? "Kirjuta riik" :
                          "Enter country"
                        }
                      />
                    )}
                  </label>
                </div>
                <div className="privacy-checkbox-row">
                  <input
                    id="privacy-accept"
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={e => setPrivacyAccepted(e.target.checked)}
                  />
                  <label htmlFor="privacy-accept" className="privacy-checkbox-label">
                    {t.authPrivacyAcceptText}{" "}
                    <Link
                      href={profilePrivacyHref}
                      className="privacy-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => {
                        event.stopPropagation();
                        persistProfileCompletionDraft();
                      }}
                    >
                      {t.authPrivacyLink}
                    </Link>
                  </label>
                </div>
                <button type="submit" disabled={!privacyAccepted}>
                  <Check size={18} />
                  {t.authSaveAndProceed}
                </button>
              </>
            ) : (
              <Link className="primary-action" href="/">
                {t.authGoToPlatform}
              </Link>
            )}
            <button className="secondary-button" type="button" onClick={handleSignOut}>
              {t.signOut}
            </button>
            <span className="form-note">{status}</span>
          </form>
        ) : (
          <div className="auth-card simple-card email-confirm-card">
            <div className="profile-completion-head">
              <span className="eyebrow">Hetki...</span>
              <h1>Viimeistellään rekisteröintiä</h1>
            </div>
            {status && status !== t.authCreatingUser && status !== t.authProfileSavedMsg && (
              <span className="form-note">{status}</span>
            )}
          </div>
        )}
      </section>

      {resetModalOpen && (
        <div
          className="auth-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-reset-title"
        >
          <form
            className="auth-modal"
            onSubmit={(event) => {
              event.preventDefault();
              handlePasswordReset();
            }}
          >
            <button
              className="auth-modal-close"
              type="button"
              aria-label={t.authCloseModal}
              onClick={() => setResetModalOpen(false)}
            >
              <X size={18} />
            </button>

            <div className="password-reset-head">
              <span className="eyebrow">{t.authPasswordResetTitle}</span>
              <h2 id="password-reset-title">{t.authSendResetLinkTitle}</h2>
              <p>
                {t.authResetEmailDesc}
              </p>
            </div>

            <label>
              {t.email}
              <input
                required
                autoFocus
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                placeholder="nimi@gmail.com"
              />
            </label>

            <button type="submit">
              <Mail size={18} />
              {t.authSendResetLinkBtn}
            </button>

            <span className="form-note">{resetStatus}</span>
          </form>
        </div>
      )}
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
