"use client";

import { FormEvent, MouseEvent as ReactMouseEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageLoadingFallback from "@/app/components/PageLoadingFallback";
import TurnstileWidget from "@/app/components/TurnstileWidget";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Globe2, LockKeyhole, Mail, ShieldCheck, UsersRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useLanguage, type Locale } from "@/lib/i18n";
import { canonicalPathFromLocalized, pagePath, profileRootPath } from "@/lib/routes";
import {
  getSafeAuthSession,
  getSafeAuthUser,
  getProfile,
  isProfileCompleted,
  isSupabaseConfigured,
  resetPassword,
  sendLoginOtpWithEmail,
  sendRegistrationOtpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  supabase,
  updatePassword,
  upsertProfileFromApi,
  verifyLoginOtpWithEmail,
  verifyRegistrationOtpWithEmail,
  type UserProfile
} from "@/lib/supabase";

const GOOGLE_AUTH_INTENT_STORAGE_KEY = "pending_google_auth_intent";
const PROFILE_COMPLETION_DRAFT_STORAGE_KEY = "profile_completion_draft_v1";
const REGISTRATION_PIN_COOLDOWN_STORAGE_KEY = "registration_pin_sent_at_v1";
const REGISTRATION_PIN_COOLDOWN_MS = 65_000;
const AUTH_SUBMIT_AUTO_UNLOCK_MS = 15_000;
const GOOGLE_AUTH_CALLBACK_PATH = "/auth";
const ADMIN_MFA_FRIENDLY_NAME = "Maskines Admin";
type AuthMode = "login" | "register";
type LoginMfaMode = "totp" | "email" | null;

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

function replaceAuthModeUrl(authPagePath: string, mode: AuthMode) {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", `${authPagePath}?mode=${mode}`);
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
  country: "FI"
};

const countryOptions = [
  "FI",
  "SE",
  "NO",
  "EE"
];

const defaultCountryByLocale: Record<Locale, string> = {
  fi: "FI",
  en: "FI",
  sv: "SE",
  no: "NO"
};

const countryNameByLocale: Record<Locale, Record<string, string>> = {
  fi: {
    FI: "Suomi", SE: "Ruotsi", NO: "Norja", EE: "Viro", DK: "Tanska",
    AL: "Albania", AD: "Andorra", AM: "Armenia", AT: "Itävalta", AZ: "AzerbaidÅ¾an", BY: "Valko-Venäjä",
    BE: "Belgia", BA: "Bosnia ja Hertsegovina", BG: "Bulgaria", HR: "Kroatia", CY: "Kypros",
    CZ: "TÅ¡ekki", FR: "Ranska", GE: "Georgia", DE: "Saksa", GI: "Gibraltar", GR: "Kreikka",
    HU: "Unkari", IS: "Islanti", IE: "Irlanti", IT: "Italia", XK: "Kosovo",
    LV: "Latvia", LI: "Liechtenstein", LT: "Liettua", LU: "Luxemburg", MT: "Malta",
    MD: "Moldova", MC: "Monaco", ME: "Montenegro", NL: "Alankomaat", MK: "Pohjois-Makedonia",
    PL: "Puola", PT: "Portugali", RO: "Romania", RU: "Venäjä", SM: "San Marino", RS: "Serbia",
    SK: "Slovakia", SI: "Slovenia", ES: "Espanja", CH: "Sveitsi", TR: "Turkki",
    UA: "Ukraina", GB: "Iso-Britannia", VA: "Vatikaani", FO: "Färsaaret",
    da: "Tanska", sv: "Ruotsi"
  },
  en: { FI: "Finland", SE: "Sweden", NO: "Norway", EE: "Estonia", DK: "Denmark", DE: "Germany", da: "Denmark", sv: "Sweden" },
  sv: { FI: "Finland", SE: "Sverige", NO: "Norge", EE: "Estland", DK: "Danmark", DE: "Tyskland", da: "Danmark", sv: "Sverige" },
  no: { FI: "Finland", SE: "Sverige", NO: "Norge", EE: "Estland", DK: "Danmark", DE: "Tyskland", da: "Danmark", sv: "Sverige", no: "Norge", ee: "Estland" },
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
};

function getCountryName(locale: Locale, country: string) {
  return countryNameByLocale[locale][country] ?? countryNameByLocale.fi[country] ?? country;
}

const countryValueByFinnishName: Record<string, string> = {
  Suomi: "FI",
  Ruotsi: "SE",
  Norja: "NO",
  Viro: "EE"
};

type AuthFormState = typeof emptyAuthForm;

type ProfileCompletionDraft = {
  form?: Partial<AuthFormState>;
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

function normalizeAuthErrorMessage(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("captcha_token not found") ||
    lower.includes("captcha token not found") ||
    lower.includes("captcha protection")
  ) {
    return "Bottitarkistus puuttui tai vanheni. Päivitä sivu ja tee tarkistus uudelleen.";
  }

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

function clearHandledRecoveryTokenFromUrl() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const hasRecoveryToken =
    url.hash.includes("type=recovery") ||
    url.searchParams.get("recovery") === "1";

  if (!hasRecoveryToken) return;

  url.searchParams.set("recovery", "1");
  url.hash = "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
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
  const profilePagePath = profileRootPath(locale);
  const termsPagePath = pagePath("terms", locale);
  const privacyPagePath = pagePath("privacy", locale);
  const authRedirectPath = getSafeAuthRedirectPath(searchParams.get("next"));
  const [authMode, setAuthMode] = useState<AuthMode>(() => getAuthModeFromSearchParams(searchParams));
  const sellLoginPrompt =
    authMode === "login" && searchParams.get("reason") === "sell"
      ? "Kirjaudu sisään jatkaaksesi ilmoituksen luontia."
      : "";
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(() => {
    if (searchParams.get("recovery") === "1") return true;
    return typeof window !== "undefined" && window.location.hash.includes("type=recovery");
  });
  const [form, setForm] = useState(() => ({
    ...emptyAuthForm
  }));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showAuthPasswords, setShowAuthPasswords] = useState(false);
  const [status, setStatus] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authCaptchaToken, setAuthCaptchaToken] = useState("");
  const [authCaptchaResetKey, setAuthCaptchaResetKey] = useState(0);
  const authSubmitInFlightRef = useRef(false);
  const automaticProfileSaveInFlightRef = useRef(false);
  const authRedirectStartedRef = useRef(false);
  const mfaCheckPendingRef = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLookupDone, setProfileLookupDone] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [registrationPinPending, setRegistrationPinPending] = useState(false);
  const [registrationPinEmail, setRegistrationPinEmail] = useState("");
  const [registrationPin, setRegistrationPin] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loginMfaMode, setLoginMfaMode] = useState<LoginMfaMode>(null);
  const [loginMfaFactorId, setLoginMfaFactorId] = useState("");
  const [loginMfaEmail, setLoginMfaEmail] = useState("");
  const [loginMfaCode, setLoginMfaCode] = useState("");
  const [loginMfaEmailChallenge, setLoginMfaEmailChallenge] = useState("");
  const [loginMfaStatus, setLoginMfaStatus] = useState("");
  const [loginMfaSubmitting, setLoginMfaSubmitting] = useState(false);
  const [loginMfaRecovery, setLoginMfaRecovery] = useState(false);

  function resetAuthCaptcha() {
    setAuthCaptchaToken("");
    setAuthCaptchaResetKey((value) => value + 1);
  }

  function redirectAfterSuccessfulAuth() {
    if (authRedirectStartedRef.current) return;

    authRedirectStartedRef.current = true;
    router.replace(authRedirectPath);

    // A client-side transition can occasionally remain pending after Supabase
    // has updated the session. Do not leave an authenticated user stranded on
    // the headerless auth loading surface if that happens.
    window.setTimeout(() => {
      const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
      const currentAuthPath = authPagePath.replace(/\/$/, "") || "/";

      if (currentPath === currentAuthPath) {
        window.location.replace(authRedirectPath);
      }
    }, 2000);
  }

  async function prepareSecondFactor(targetUser: User) {
    if (!supabase) return false;
    mfaCheckPendingRef.current = true;

    try {
      const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] =
        await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors()
        ]);

      if (assuranceError || factorsError) {
        throw assuranceError ?? factorsError;
      }

      // Admin-paneelin Authenticator on erillinen suoja. Sitä ei koskaan
      // kysytä tavallisessa sivustolle kirjautumisessa.
      const totpFactor = factors?.totp?.find(
        (factor) => factor.friendly_name !== ADMIN_MFA_FRIENDLY_NAME
      );
      if (assurance?.currentLevel === "aal1" && assurance?.nextLevel === "aal2" && totpFactor) {
        setLoginMfaFactorId(totpFactor.id);
        setLoginMfaEmail(targetUser.email ?? "");
        setLoginMfaCode("");
        setLoginMfaStatus("");
        setLoginMfaMode("totp");
        return true;
      }

      if (
        assurance?.currentLevel !== "aal2" &&
        targetUser.user_metadata?.email_mfa_enabled === true &&
        targetUser.email
      ) {
        const targetEmail = targetUser.email;
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Kirjautuminen ei ole enää voimassa.");
        const { data, error } = await sendLoginOtpWithEmail(targetEmail, locale, accessToken);
        if (error) throw error;
        setLoginMfaEmailChallenge(data?.challenge ?? "");
        await signOut();

        setLoginMfaFactorId("");
        setLoginMfaEmail(targetEmail);
        setLoginMfaCode("");
        setLoginMfaStatus(`Lähetimme kuusinumeroisen koodin osoitteeseen ${targetEmail}.`);
        setLoginMfaMode("email");
        return true;
      }

      return false;
    } finally {
      mfaCheckPendingRef.current = false;
    }
  }

  async function submitLoginMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || loginMfaSubmitting) return;
    if (!/^\d{6}$/.test(loginMfaCode)) {
      setLoginMfaStatus("Anna kuusinumeroinen vahvistuskoodi.");
      return;
    }

    setLoginMfaSubmitting(true);
    setLoginMfaStatus("Vahvistetaan koodia...");
    try {
      if (loginMfaMode === "totp") {
        if (!loginMfaFactorId) throw new Error("Authenticator-laitetta ei löytynyt.");
        const { error } = await supabase.auth.mfa.challengeAndVerify({
          factorId: loginMfaFactorId,
          code: loginMfaCode
        });
        if (error) throw error;
      } else if (loginMfaMode === "email") {
        const { data, error } = await verifyLoginOtpWithEmail(loginMfaEmail, loginMfaCode);
        if (error) throw error;

        if (loginMfaRecovery) {
          const accessToken = data?.session?.access_token;
          if (!accessToken) throw new Error("Sähköpostivahvistus ei luonut voimassa olevaa istuntoa.");
          const response = await fetch("/api/auth/mfa/recovery", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ action: "complete" })
          });
          const result = (await response.json().catch(() => ({}))) as { error?: string };
          if (!response.ok) throw new Error(result.error || "Authenticatorin palautus epäonnistui.");

          await signOut();
          setLoginMfaMode(null);
          setLoginMfaRecovery(false);
          setLoginMfaCode("");
          setLoginMfaEmailChallenge("");
          setLoginMfaStatus("");
          setStatus("Authenticator poistettiin turvallisesti. Kirjaudu nyt uudelleen. Voit lisätä uuden Oma profiili -sivulla.");
          return;
        }
      } else {
        throw new Error("Vahvistustapaa ei löytynyt.");
      }

      setLoginMfaMode(null);
      setLoginMfaCode("");
      setLoginMfaEmailChallenge("");
      setLoginMfaStatus("");
      setStatus(t.authLoginSuccess);
      redirectAfterSuccessfulAuth();
    } catch (error) {
      setLoginMfaStatus(normalizeAuthErrorMessage(getErrorMessage(error)));
    } finally {
      setLoginMfaSubmitting(false);
    }
  }

  async function beginAuthenticatorRecovery() {
    if (!supabase || !loginMfaEmail || loginMfaSubmitting) return;
    setLoginMfaSubmitting(true);
    setLoginMfaStatus("Valmistellaan turvallista palautusta...");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Kirjautuminen ei ole enää voimassa. Kirjaudu uudelleen.");

      const response = await fetch("/api/auth/mfa/recovery", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "start" })
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Palautusta ei voitu aloittaa.");

      const { data: emailData, error } = await sendLoginOtpWithEmail(loginMfaEmail, locale, accessToken);
      if (error) throw error;
      setLoginMfaEmailChallenge(emailData?.challenge ?? "");
      await signOut();

      setLoginMfaRecovery(true);
      setLoginMfaMode("email");
      setLoginMfaCode("");
      setLoginMfaStatus(`Lähetimme palautuskoodin osoitteeseen ${loginMfaEmail}.`);
    } catch (error) {
      setLoginMfaStatus(normalizeAuthErrorMessage(getErrorMessage(error)));
    } finally {
      setLoginMfaSubmitting(false);
    }
  }

  async function resendLoginEmailCode() {
    if (!loginMfaEmail || loginMfaSubmitting) return;
    setLoginMfaSubmitting(true);
    const { data, error } = await sendLoginOtpWithEmail(
      loginMfaEmail,
      locale,
      undefined,
      loginMfaEmailChallenge
    );
    if (data?.challenge) setLoginMfaEmailChallenge(data.challenge);
    setLoginMfaSubmitting(false);
    setLoginMfaStatus(
      error
        ? normalizeAuthErrorMessage(getErrorMessage(error))
        : `Uusi koodi lähetettiin osoitteeseen ${loginMfaEmail}.`
    );
  }

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
    setForm((current) => ({
      ...current,
      country: defaultCountryByLocale[locale]
    }));
  }, [locale]);

  useEffect(() => {
    if (!supabase) return;

    withTimeout(
      supabase.auth.getSession(),
      7000,
      "Istunnon tarkistus kesti liian kauan."
    )
      .then(async ({ data }) => {
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
          ).then(async ({ data: profileData }) => {
            if (!profileData) {
              clearGoogleAuthIntent();
              setProfile(null);
              setAuthMode("register");
              setUser(sessionUser);
              setEmailPending(false);
              setStatus(t.authGoogleVerifiedCompleteProfile);
              replaceAuthModeUrl(authPagePath, "register");
              return;
            }

            if (await prepareSecondFactor(sessionUser)) {
              clearGoogleAuthIntent();
              setUser(null);
              return;
            }

            clearGoogleAuthIntent();
            replaceAuthModeUrl(authPagePath, "login");
            setUser(sessionUser);
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
          replaceAuthModeUrl(authPagePath, "register");
        }

        if (
          typeof window !== "undefined" &&
          (searchParams.get("recovery") === "1" ||
            window.location.hash.includes("type=recovery"))
        ) {
          clearHandledRecoveryTokenFromUrl();
          setUser(sessionUser);
          setRecoveryMode(true);
          setResetModalOpen(false);
          return;
        }

        if (await prepareSecondFactor(sessionUser)) {
          setUser(null);
          return;
        }

        setUser(sessionUser);
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
        ).then(async ({ data: profileData }) => {
          if (!profileData) {
            clearGoogleAuthIntent();
            setProfile(null);
            setAuthMode("register");
            setUser(nextUser);
            setEmailPending(false);
            setStatus(t.authGoogleVerifiedCompleteProfile);
            replaceAuthModeUrl(authPagePath, "register");
            return;
          }

          if (await prepareSecondFactor(nextUser)) {
            clearGoogleAuthIntent();
            setUser(null);
            return;
          }

          clearGoogleAuthIntent();
          replaceAuthModeUrl(authPagePath, "login");
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
        replaceAuthModeUrl(authPagePath, "register");
      }

      setUser(nextUser);
      setProfile(null);

      if (event === "PASSWORD_RECOVERY") {
        clearHandledRecoveryTokenFromUrl();
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
    // A recovery link creates a temporary Supabase session. Do not treat that
    // session as a normal login or the profile redirect hides the password form.
    if (!user || recoveryMode || loginMfaMode || mfaCheckPendingRef.current) {
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
          redirectAfterSuccessfulAuth();
          return;
        }

        if (!isProfileCompleted(data)) {
          setAuthMode("register");
          const metadata = user.user_metadata ?? {};
          const fullName = String(metadata.full_name ?? metadata.name ?? "").trim();
          const [firstName = "", ...lastNameParts] = fullName.split(" ");
          const email = user.email ?? "";
          const storedCountry = String(data?.country || metadata.country || "").trim();

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
              return countryOptions.includes(normalizedCountry) ? normalizedCountry : defaultCountryByLocale[locale];
            })()
          }));
          if (metadata.privacy_accepted === "true") {
            setPrivacyAccepted(true);
          }
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setProfileLookupDone(true));
  }, [recoveryMode, user]);

  async function saveProfile(targetUser: User) {
    try {
    const email = targetUser.email ?? form.email;
    const selectedCountry = countryNameByLocale.fi[form.country] ?? form.country;

    if (!privacyAccepted) {
      setStatus(t.authPrivacyRequired);
      return;
    }

    if (
      !selectedCountry ||
      (form.account_type === "private" && (!form.first_name || !form.last_name)) ||
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
          phone: "",
          address: "",
          postal_code: "",
          city: "",
          country: selectedCountry
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
    setStatus(t.authProfileSavedMsg);
    setAuthSubmitting(false);
    router.push(form.account_type === "company" ? `${profilePagePath}#yritys` : "/");
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

    const selectedCountry = countryNameByLocale.fi[form.country] ?? form.country;
    const hasAllRequiredFields = Boolean(
      privacyAccepted && selectedCountry &&
      (form.account_type === "private"
        ? form.first_name && form.last_name
        : form.company_name && form.business_id)
    );

    if (!hasAllRequiredFields) return;

    automaticProfileSaveInFlightRef.current = true;
    void saveProfile(user).finally(() => {
      automaticProfileSaveInFlightRef.current = false;
    });
  }, [form, privacyAccepted, profile, profileLookupDone, user]);

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
    await saveProfile(freshUser);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authSubmitInFlightRef.current) return;
    authSubmitInFlightRef.current = true;

    try {
    if (authMode === "register" && form.password.length < 8) {
      setStatus(t.authPasswordTooShort);
      return;
    }

    if (!isSupabaseConfigured) {
      setStatus("Supabase keys missing from .env.local");
      return;
    }

    if (authMode === "login" && !authCaptchaToken) {
      setStatus("Tee bottitarkistus ennen jatkamista.");
      return;
    }

    setAuthSubmitting(true);

    if (authMode === "login") {
      setStatus("Tarkistetaan tiliä...");
      mfaCheckPendingRef.current = true;
      const { data, error } =
        await withTimeout(
          signInWithEmail(form.email, form.password, authCaptchaToken),
          4500,
          "Kirjautuminen kesti liian kauan."
        );

      resetAuthCaptcha();
      if (error) {
        mfaCheckPendingRef.current = false;
        setStatus(getErrorMessage(error));
        setAuthSubmitting(false);
        return;
      }

      if (data?.user) {
        const requiresSecondFactor = await prepareSecondFactor(data.user);
        if (requiresSecondFactor) {
          setAuthSubmitting(false);
          setStatus("");
          return;
        }

        const profileResult =
          await withTimeout(
            getProfile(data.user.id),
            8000,
            "Profiilin lataus kesti liian kauan."
          );

        if (isProfileCompleted(profileResult.data)) {
          setStatus(t.authLoginSuccess);
          setAuthSubmitting(false);
          redirectAfterSuccessfulAuth();
          return;
        }

        setUser(data.user);
        setStatus(t.authCompleteProfileMsg);
      }
      setAuthSubmitting(false);
      return;
    }

    const selectedCountry = countryNameByLocale.fi[form.country] ?? form.country;
    if (!privacyAccepted) {
      setStatus(t.authPrivacyRequired);
      setAuthSubmitting(false);
      return;
    }
    if (
      !selectedCountry ||
      (form.account_type === "private" && (!form.first_name || !form.last_name)) ||
      (form.account_type === "company" && (!form.company_name || !form.business_id))
    ) {
      setStatus(form.account_type === "company" ? t.authCompanyFieldsRequired : t.authPersonalFieldsRequired);
      setAuthSubmitting(false);
      return;
    }

    // Google has already verified this OAuth user's email. Complete the same
    // registration form without sending a second email PIN.
    if (user) {
      setStatus("Tallennetaan Gmail-tilin tiedot...");
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

      await saveProfile(user);
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
            first_name: form.account_type === "private" ? form.first_name : "",
            last_name: form.account_type === "private" ? form.last_name : "",
            company_name: form.company_name,
            business_id: form.business_id,
            company_website: form.company_website,
            billing_email: form.billing_email,
            phone: form.phone,
            address: form.address,
            postal_code: form.postal_code,
            city: form.city,
            country: selectedCountry
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

      const selectedCountry = countryNameByLocale.fi[form.country] ?? form.country;

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
    if (newPassword.length < 8) {
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
        signInWithGoogle(authMode, GOOGLE_AUTH_CALLBACK_PATH),
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
  const showProfileRegistrationForm = Boolean(
    user && profileLookupDone && needsProfile
  );
  const showAuthLoading = Boolean(
    user &&
    !recoveryMode &&
    !loginMfaMode &&
    !registrationPinPending &&
    !emailPending &&
    !showProfileRegistrationForm
  );
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
  const nextAuthMode: AuthMode = authMode === "login" ? "register" : "login";
  function persistProfileCompletionDraft() {
    if (typeof window === "undefined") return;

    const draft: ProfileCompletionDraft = {
      form: getProfileCompletionDraftForm(form),
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
    resetAuthCaptcha();

    if (typeof window === "undefined") return;

    replaceAuthModeUrl(authPagePath, mode);
  }

  async function switchToLogin() {
    setStatus("");
    setAuthSubmitting(true);
    clearGoogleAuthIntent();

    try {
      if (user) {
        await signOut();
        setUser(null);
        setProfile(null);
        setProfileLookupDone(false);
      }
    } finally {
      setAuthSubmitting(false);
      switchAuthMode("login");
    }
  }

  function returnToHome() {
    router.push("/");
  }

  function handleAuthBackgroundClick(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target;
    if (
      !(target instanceof Element) ||
      target.closest(".auth-card, .auth-modal, .auth-mobile-back-home")
    ) {
      return;
    }

    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    const isDismissableLogin =
      authMode === "login" &&
      !user &&
      !recoveryMode &&
      !registrationPinPending &&
      !emailPending &&
      !resetModalOpen;

    if (isMobile && isDismissableLogin) {
      returnToHome();
    }
  }

  return (
    <main className={`auth-page simple-auth-page${showAuthLoading ? " auth-loading-page" : ""}`} onClick={handleAuthBackgroundClick}>
      <section className="simple-auth auth-centered">
        {!showAuthLoading && (
          <button
            type="button"
            className="auth-mobile-back-home"
            aria-label="Takaisin etusivulle"
            onClick={returnToHome}
          >
            <ArrowLeft size={26} aria-hidden="true" />
            <span>Takaisin etusivulle</span>
          </button>
        )}
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
                minLength={8}
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
                minLength={8}
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
        ) : loginMfaMode ? (
          <form
            className="auth-card simple-card profile-completion-card email-confirm-card login-mfa-card"
            onSubmit={submitLoginMfa}
          >
            <div className="email-confirm-icon" aria-hidden="true">
              {loginMfaMode === "totp" ? <ShieldCheck size={28} /> : <Mail size={28} />}
            </div>
            <div className="profile-completion-head">
              <span className="eyebrow">Kaksivaiheinen tunnistus</span>
              <h1>Vahvista kirjautuminen</h1>
              <p>
                {loginMfaMode === "totp"
                  ? "Anna Authenticator-sovelluksen näyttämä kuusinumeroinen koodi."
                  : loginMfaRecovery
                    ? `Anna osoitteeseen ${loginMfaEmail} lähetetty palautuskoodi. Authenticator poistetaan vasta onnistuneen vahvistuksen jälkeen.`
                    : `Anna osoitteeseen ${loginMfaEmail} lähetetty kuusinumeroinen koodi.`}
              </p>
            </div>
            <label className="registration-pin-label login-mfa-code-label">
              Vahvistuskoodi
              <input
                autoFocus
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={loginMfaCode}
                onChange={(event) => setLoginMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
              />
            </label>
            <button type="submit" disabled={loginMfaSubmitting || loginMfaCode.length !== 6}>
              <ShieldCheck size={18} />
              {loginMfaSubmitting ? "Vahvistetaan..." : "Vahvista ja kirjaudu"}
            </button>
            {loginMfaMode === "email" && (
              <button
                className="secondary-button"
                type="button"
                disabled={loginMfaSubmitting}
                onClick={() => void resendLoginEmailCode()}
              >
                <Mail size={16} /> Lähetä uusi koodi
              </button>
            )}
            {loginMfaMode === "totp" && (
              <button
                className="secondary-button login-mfa-recovery-button"
                type="button"
                disabled={loginMfaSubmitting}
                onClick={() => void beginAuthenticatorRecovery()}
              >
                <Mail size={16} /> Authenticator ei käytettävissä?
              </button>
            )}
            <button
              className="secondary-button"
              type="button"
              disabled={loginMfaSubmitting}
              onClick={() => {
                void signOut();
                setLoginMfaMode(null);
                setLoginMfaRecovery(false);
                setLoginMfaCode("");
                setLoginMfaEmailChallenge("");
                setLoginMfaStatus("");
              }}
            >
              <ArrowLeft size={16} /> Peruuta
            </button>
            {loginMfaStatus && <span className="form-note registration-pin-status">{loginMfaStatus}</span>}
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
        ) : (!user || showProfileRegistrationForm) ? (
          <form className={`auth-card simple-card${authMode === "register" ? " registration-inline-card profile-finalize-card" : ""}`} onSubmit={handleSubmit}>
            <div className="auth-maskines-brand" aria-label="Maskines Marketplace">
              <img src="/maskines-share-logo.png" alt="" aria-hidden="true" />
              <div>
                <strong>MASKINES</strong>
                <span>MARKETPLACE</span>
              </div>
            </div>
            <div className="auth-form-head">
              <h1>{authMode === "login" ? "Tervetuloa takaisin" : "Luo Maskines-tili"}</h1>
              {sellLoginPrompt && <p>{sellLoginPrompt}</p>}
              {!sellLoginPrompt && authMode === "login" && <p>Kirjaudu sisään käyttääksesi tiliäsi</p>}
              {authMode === "register" && <p>Rekisteröidy ja aloita kaupankäynti</p>}
            </div>

            {authMode === "register" && (
              <div className="register-account-switch" role="group" aria-label={t.authAccountType}>
                <button
                  type="button"
                  className={form.account_type === "private" ? "active" : ""}
                  aria-pressed={form.account_type === "private"}
                  onClick={() => setForm({ ...form, account_type: "private" })}
                >
                  Yksityinen
                </button>
                <button
                  type="button"
                  className={form.account_type === "company" ? "active" : ""}
                  aria-pressed={form.account_type === "company"}
                  onClick={() => setForm({ ...form, account_type: "company" })}
                >
                  Yritys
                </button>
              </div>
            )}

            <label>
              {t.email}
              <span className="auth-input-with-icon">
                <Mail size={17} aria-hidden="true" />
                <input
                  required
                  type="email"
                  readOnly={Boolean(user)}
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
              <span className="auth-input-with-icon auth-password-input">
                <LockKeyhole size={17} aria-hidden="true" />
                <input required minLength={authMode === "register" ? 8 : 6} autoComplete={authMode === "login" ? "current-password" : "new-password"} type={showAuthPasswords ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={authMode === "register" ? t.authPasswordMinPlaceholder : t.password} />
                <button type="button" className="auth-password-eye" aria-label={showAuthPasswords ? "Piilota salasana" : "Näytä salasana"} aria-pressed={showAuthPasswords} onClick={() => setShowAuthPasswords((shown) => !shown)}>
                  {showAuthPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
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
            </div>
            {authMode === "register" && form.password.length > 0 && (
              <div className={`auth-password-strength strength-${registrationPasswordStrength}`} aria-live="polite">
                <span className="auth-password-strength-track"><span /></span>
                <span className="auth-password-match"><Check size={13} /> {registrationPasswordStrengthLabel}</span>
              </div>
            )}

            {authMode === "register" && (
              <div className="registration-fields register-details-grid register-essential-fields">
                {form.account_type === "private" && (
                  <>
                    <label>
                      {t.authFirstName}
                      <input required autoComplete="given-name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
                    </label>
                    <label>
                      {t.authLastName}
                      <input required autoComplete="family-name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
                    </label>
                  </>
                )}
                {form.account_type === "company" && (
                  <>
                    <label>
                      {t.authCompanyName}
                      <input required autoComplete="organization" value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} />
                    </label>
                    <label>
                      {t.authBusinessId}
                      <input
                        required
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={form.business_id}
                        onChange={(event) => setForm({ ...form, business_id: event.target.value.replace(/\D/g, "") })}
                        placeholder="12345678"
                      />
                    </label>
                  </>
                )}
                <label className="register-country-field">
                  {t.authCountry}
                  <select required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })}>
                    {countryOptions.map((country) => <option key={country} value={country}>{countryNameByLocale[locale][country]}</option>)}
                  </select>
                </label>
              </div>
            )}

            {authMode === "register" && (
              <>
                <div className="privacy-checkbox-row register-privacy-row">
                  <input id="register-privacy-accept" type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
                  <label htmlFor="register-privacy-accept" className="privacy-checkbox-label">
                    Olen lukenut ja hyväksyn{" "}
                    <Link href={termsPagePath} target="_blank" rel="noopener noreferrer">
                      käyttöehdot
                    </Link>{" "}
                    ja{" "}
                    <Link href={privacyPagePath} target="_blank" rel="noopener noreferrer">
                      tietosuojaselosteen
                    </Link>
                  </label>
                </div>
              </>
            )}

            {authMode === "login" ? (
              <TurnstileWidget
                action="login"
                onToken={setAuthCaptchaToken}
                resetKey={authCaptchaResetKey}
              />
            ) : null}
            <button
              type="submit"
              disabled={authSubmitting || (authMode === "login" && !authCaptchaToken)}
            >
              {authMode === "register" ? <Check size={18} /> : null}
              {authSubmitting ? "Hetki..." : primaryAuthActionLabel}
              {!authSubmitting && <ArrowRight className="auth-submit-arrow" size={20} aria-hidden="true" />}
            </button>
            {!user && (
              <>
            <div className="auth-divider">
              <span>tai jatka</span>
            </div>
            <div className="auth-social-row">
              <button
                className="google-button auth-social-button"
                type="button"
                onClick={handleGoogleLogin}
                aria-label={t.continueWithGoogle}
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className="gmail-logo-img"
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 48'%3E%3Cpath fill='%234285f4' d='M4 8h10v32H4z'/%3E%3Cpath fill='%2334a853' d='M50 8h10v32H50z'/%3E%3Cpath fill='%23fbbc04' d='M50 8 32 24 14 8v12l18 16 18-16z'/%3E%3Cpath fill='%23ea4335' d='M4 8c0-3 3.6-5 6.2-3L32 22 53.8 5C56.4 3 60 5 60 8v6L32 36 4 14z'/%3E%3C/svg%3E"
                />
                <span>{t.continueWithGoogle}</span>
              </button>
            </div>
              </>
            )}
            <p className="auth-mode-switch">
              {authMode === "login" ? "Eikö sinulla ole tiliä?" : "Onko sinulla tili?"}{" "}
              <button
                type="button"
                disabled={authSubmitting}
                onClick={() => {
                  if (authMode === "register") {
                    void switchToLogin();
                    return;
                  }
                  switchAuthMode(nextAuthMode);
                }}
              >
                {authMode === "login" ? t.register : t.login}
              </button>
            </p>
            <div className="auth-benefits" aria-label="Maskines-palvelun edut">
              <div><ShieldCheck aria-hidden="true" /><span><strong>Turvallinen</strong><small>Tietosi on suojattu</small></span></div>
              <div><Globe2 aria-hidden="true" /><span><strong>Laaja valikoima</strong><small>Osta ja myy helposti</small></span></div>
              <div><UsersRound aria-hidden="true" /><span><strong>Kasvava yhteisö</strong><small>Liity käyttäjiimme</small></span></div>
            </div>
            {status ? <span className="form-note">{status}</span> : null}
          </form>
        ) : (
          <div className="auth-loading" role="status" aria-live="polite" aria-label="Ladataan sivua">
            <span className="auth-loading-spinner" aria-hidden="true" />
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
    <Suspense fallback={<PageLoadingFallback />}>
      <AuthPageContent />
    </Suspense>
  );
}
