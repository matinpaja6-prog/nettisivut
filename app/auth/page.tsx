"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole, Mail, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { BirthDateField } from "@/app/components/BirthDateField";
import { applyLocale, useLanguage, type Locale } from "@/lib/i18n";
import {
  awardReferralPoints,
  getProfile,
  getReferrerIdByCode,
  isProfileCompleted,
  isSupabaseConfigured,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  supabase,
  updatePassword,
  upsertProfile,
  type UserProfile
} from "@/lib/supabase";

const REFERRAL_STORAGE_KEY = "pending_referral_code";
const ACCOUNT_TYPE_STORAGE_KEY = "pending_account_type";

function getStoredAccountType(): "private" | "company" {
  if (typeof window === "undefined") return "private";

  try {
    return getStoredAccountTypeSelection() === "company"
      ? "company"
      : "private";
  } catch {
    return "private";
  }
}

function getStoredAccountTypeSelection(): "private" | "company" | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(ACCOUNT_TYPE_STORAGE_KEY);
    return stored === "company" || stored === "private" ? stored : null;
  } catch {
    return null;
  }
}

function rememberAccountType(type: "private" | "company") {
  try {
    localStorage.setItem(ACCOUNT_TYPE_STORAGE_KEY, type);
  } catch {}
}

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
  { country: "ee", code: "+372" },
  { country: "sv", code: "+46" },
  { country: "fi", code: "+358" },
  { country: "no", code: "+47" },
  { country: "da", code: "+45" }
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
  fi: { FI: "Suomi", SE: "Ruotsi", NO: "Norja", DK: "Tanska", EE: "Viro", DE: "Saksa", OTHER: "Muu", da: "Tanska", sv: "Ruotsi", no: "Norja", ee: "Viro" },
  en: { FI: "Finland", SE: "Sweden", NO: "Norway", DK: "Denmark", EE: "Estonia", DE: "Germany", OTHER: "Other", da: "Denmark", sv: "Sweden", no: "Norway", ee: "Estonia" },
  sv: { FI: "Finland", SE: "Sverige", NO: "Norge", DK: "Danmark", EE: "Estland", DE: "Tyskland", OTHER: "Annat", da: "Danmark", sv: "Sverige", no: "Norge", ee: "Estland" },
  no: { FI: "Finland", SE: "Sverige", NO: "Norge", DK: "Danmark", EE: "Estland", DE: "Tyskland", OTHER: "Annet", da: "Danmark", sv: "Sverige", no: "Norge", ee: "Estland" },
  et: { FI: "Soome", SE: "Rootsi", NO: "Norra", DK: "Taani", EE: "Eesti", DE: "Saksamaa", OTHER: "Muu", da: "Taani", sv: "Rootsi", no: "Norra", ee: "Eesti" }
};

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
  const cleaned =
    value.replace(/[^\d+]/g, "");

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

function getErrorMessage(error: unknown) {
  if (!error) return "Tuntematon virhe.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
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

export default function AuthPage() {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [form, setForm] = useState(() => ({
    ...emptyAuthForm,
    account_type: getStoredAccountType()
  }));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLookupDone, setProfileLookupDone] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [phoneDialingCode, setPhoneDialingCode] = useState("+358");
  const [customCountry, setCustomCountry] = useState("");

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
    console.log("[Referral] Resolved referrer id for code", code, "→", referrerId);

    if (!referrerId) {
      console.warn("[Referral] No user found for code", code, "— SQL may not be set up.");
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
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          void tryClaimReferral(data.session.user.id);
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
      setUser(session?.user ?? null);
      setProfile(null);

      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setResetModalOpen(false);
        setStatus(t.authPasswordRecovery);
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
        : getStoredAccountType();

    setForm((current) => ({
      ...current,
      account_type: metadataType
    }));

    withTimeout(
      getProfile(user.id),
      7000,
      "Profiilin lataus kesti liian kauan."
    )
      .then(({ data }) => {
        if (isProfileCompleted(data)) {
          setProfile(data);
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
        upsertProfile({
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
        10000,
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
    // Final chance to claim referral (covers email-confirmation signups
    // where the session arrived after the initial useEffect)
    await tryClaimReferral(targetUser.id);
    setStatus(t.authProfileSavedMsg);
    router.push(form.account_type === "company" ? "/profile#yritys" : "/");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
    if (!isSupabaseConfigured) {
      setStatus("Supabase keys missing from .env.local");
      return;
    }

    if (authMode === "login") {
      setStatus(t.authLoggingIn);
      const { data, error } =
        await withTimeout(
          signInWithEmail(form.email, form.password),
          10000,
          "Kirjautuminen kesti liian kauan."
        );

      if (error) {
        setStatus(getErrorMessage(error));
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
          router.push("/");
          return;
        }

        setUser(data.user);
        setStatus(t.authCompleteProfileMsg);
      }
      return;
    }

    setStatus(t.authCreatingUser);
    rememberAccountType(form.account_type);
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth`
        : undefined;
    const { data, error } =
      await withTimeout(
        signUpWithEmail(
          form.email,
          form.password,
          { account_type: form.account_type },
          redirectTo
        ),
        10000,
        "Tunnuksen luonti kesti liian kauan."
      );

    if (error) {
      setStatus(getErrorMessage(error));
      return;
    }

    if (data?.user && data.session) {
      setForm((current) => ({
        ...current,
        account_type: form.account_type
      }));
      setUser(data.user);
      void tryClaimReferral(data.user.id);
      setStatus(t.authAccountCreatedMsg);
      return;
    }

    if (data?.user && !data.session) {
      setPendingEmail(form.email);
      setEmailPending(true);
      setStatus("");
      return;
    }

    setStatus(t.authAccountCreatedEmailMsg);
    } catch (error) {
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
        resetPassword(resetEmail),
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

  function handleSignOut() {
    setUser(null);
    setProfile(null);
    setRecoveryMode(false);
    setResetModalOpen(false);
    setStatus("");
    void signOut().finally(() => {
      router.refresh();
    });
    router.push("/");
  }

  async function handleGoogleLogin() {
    try {
    setStatus(t.authOpeningGmail);
    const { error } =
      await withTimeout(
        signInWithGoogle(),
        10000,
        "Google-kirjautuminen kesti liian kauan."
      );
    if (error) setStatus(getErrorMessage(error));
    } catch (error) {
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
    metadataAccountType ?? getStoredAccountTypeSelection();
  const phoneParts =
    form.phone
      ? getPhoneParts(form.phone)
      : {
          code: phoneDialingCode,
          national: ""
        };

  return (
    <main className="auth-page simple-auth-page">
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
          <form className="auth-card simple-card" onSubmit={handleSubmit}>
            <div className="auth-tabs" aria-label="Kirjautumistapa">
              <button
                className={authMode === "login" ? "active" : ""}
                type="button"
                onClick={() => {
                  setAuthMode("login");
                }}
              >
                {t.login}
              </button>
              <button
                className={authMode === "register" ? "active" : ""}
                type="button"
                onClick={() => {
                  setAuthMode("register");
                }}
              >
                {t.register}
              </button>
            </div>

            {authMode === "register" && (
              <div className="pre-register-choice">
                <span>{t.authRegisterTo}</span>
                <div className="account-type-picker compact" aria-label={t.authAccountType}>
                  <button
                    type="button"
                    className={form.account_type === "private" ? "account-type-card active" : "account-type-card"}
                    onClick={() => {
                      rememberAccountType("private");
                      setForm({ ...form, account_type: "private" });
                    }}
                  >
                    <strong>{t.authPrivatePersonTitle}</strong>
                    <span>{t.authPrivatePersonDesc}</span>
                  </button>
                  <button
                    type="button"
                    className={form.account_type === "company" ? "account-type-card active" : "account-type-card"}
                    onClick={() => {
                      rememberAccountType("company");
                      setForm({ ...form, account_type: "company" });
                    }}
                  >
                    <strong>{t.authCompanyTitle}</strong>
                    <span>{t.authCompanyDesc}</span>
                  </button>
                </div>
              </div>
            )}

            <label>
              {t.email}
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
            </label>
            <label>
              {t.password}
              <input
                required
                minLength={6}
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder={t.authPasswordMinPlaceholder}
              />
            </label>

            <button type="submit">
              <LockKeyhole size={18} />
              {authMode === "login" ? t.login : t.register}
            </button>
            <button className="google-button" type="button" onClick={handleGoogleLogin}>
              <Mail size={18} />
              {t.continueWithGmail}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setResetEmail(form.email);
                setResetStatus("");
                setResetModalOpen(true);
              }}
            >
              {t.forgotPassword}
            </button>
            <span className="form-note">{status}</span>
          </form>
        ) : !profileLookupDone ? (
          <div className="auth-card simple-card profile-completion-card">
            <div className="profile-completion-head">
              <span className="eyebrow">{t.authProfileCompletionTitle}</span>
              <h1>{t.authLoadingFormTitle}</h1>
            </div>
            <div className="profile-alert">
              <Check size={20} />
              <span>{t.authFetchingAccountType}</span>
            </div>
          </div>
        ) : (
          <form className={`auth-card simple-card profile-completion-card profile-finalize-card ${needsProfile ? "" : "profile-ready-card"}`} onSubmit={(event) => {
            event.preventDefault();
            saveProfile(user);
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
                      className={form.account_type === "private" ? "account-type-card active" : "account-type-card"}
                      onClick={() => {
                        rememberAccountType("private");
                        setForm({ ...form, account_type: "private" });
                      }}
                    >
                      <strong>{t.authPrivateSellerLabel}</strong>
                      <span>{t.authPrivateSellerDesc}</span>
                    </button>
                    <button
                      type="button"
                      className={form.account_type === "company" ? "account-type-card active" : "account-type-card"}
                      onClick={() => {
                        rememberAccountType("company");
                        setForm({ ...form, account_type: "company" });
                      }}
                    >
                      <strong>{t.authCompanyLabel}</strong>
                      <span>{t.authCompanyDesc2}</span>
                    </button>
                  </div>
                )}

                <div className="registration-fields">
                  {form.account_type === "company" && (
                    <>
                      <label>
                        {t.authCompanyName}
                        <input
                          required
                          value={form.company_name}
                          onChange={(event) => setForm({ ...form, company_name: event.target.value })}
                          placeholder="esim. Arctic Varaosat Oy"
                        />
                      </label>
                      <label>
                        {t.authBusinessId}
                        <input
                          required
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
                          value={form.first_name}
                          onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                        />
                      </label>
                      <label>
                        {t.authLastName}
                        <input
                          required
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
                        value={form.billing_email}
                        onChange={(event) => setForm({ ...form, billing_email: event.target.value })}
                        placeholder={form.email || "laskutus@yritys.fi"}
                      />
                    </label>
                  )}
                  <label>
                    {form.account_type === "company" ? t.authCompanyPhone : t.authPhone}
                    <div className="phone-field-row">
                      <select
                        aria-label="Suuntanumero"
                        value={phoneParts.code}
                        onChange={(event) => {
                          setPhoneDialingCode(event.target.value);
                          setForm({
                            ...form,
                            phone: buildPhoneNumber(event.target.value, phoneParts.national)
                          });
                        }}
                      >
                        {phoneDialingOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.code}
                          </option>
                        ))}
                      </select>
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        value={phoneParts.national}
                        onChange={(event) => {
                          setPhoneDialingCode(phoneParts.code);
                          setForm({
                            ...form,
                            phone: buildPhoneNumber(phoneParts.code, event.target.value)
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
                      value={form.address}
                      onChange={(event) => setForm({ ...form, address: event.target.value })}
                    />
                  </label>
                  <label>
                    {t.authPostalCode}
                    <input
                      required
                      value={form.postal_code}
                      onChange={(event) => setForm({ ...form, postal_code: event.target.value })}
                    />
                  </label>
                  <label>
                    {t.authCity}
                    <input
                      required
                      value={form.city}
                      onChange={(event) => setForm({ ...form, city: event.target.value })}
                    />
                  </label>
                  <label>
                    {t.authCountry}
                    <select
                      required
                      value={form.country}
                      onChange={(event) => {
                        const nextCountry = event.target.value;
                        setForm({ ...form, country: nextCountry });
                        if (nextCountry !== OTHER_COUNTRY_VALUE) {
                          setCustomCountry("");
                        }
                        const localeByCountry: Record<string, Locale> = {
                          FI: "fi",
                          SE: "sv",
                          NO: "no",
                          EE: "et",
                          DK: "en",
                          DE: "en",
                          OTHER: "en"
                        };
                        const nextLocale = localeByCountry[nextCountry];
                        if (nextLocale) applyLocale(nextLocale);
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
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="privacy-link">
                      {t.authPrivacyLink}
                    </a>
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
