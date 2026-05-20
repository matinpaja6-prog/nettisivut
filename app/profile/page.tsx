"use client";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "firebase/auth";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  ExternalLink,
  Globe,
  Hash,
  Home,
  Lock,
  LockKeyhole,
  Phone,
  Plus,
  Trash2,
  Users
} from "lucide-react";

import type { User } from "@supabase/supabase-js";

import {
  createCompanySeller,
  deleteCompanySeller,
  getCompanySellers,
  getProfile,
  supabase,
  updateCompanySeller,
  updateEditableProfile,
  uploadAvatar,
  type CompanySeller,
  type UserProfile
} from "@/lib/supabase";

function getErrorMessage(error: unknown) {

  if (!error) return "Tuntematon virhe.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Toiminto epäonnistui.";

}

function getFirebasePhoneErrorMessage(error: unknown) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : null;

  const message =
    getErrorMessage(error);

  const tag =
    code ? ` [${code}]` : "";

  const combined =
    (code ?? "") + " " + message;

  if (
    combined.includes("too-many-requests") ||
    combined.includes("TOO_MANY_ATTEMPTS_TRY_LATER")
  ) {
    return `Liian monta vahvistusyritystä. Odota hetki ennen uutta koodia.${tag}`;
  }

  if (combined.includes("invalid-phone-number")) {
    return `Puhelinnumeron muoto ei kelpaa. Käytä muotoa +358401234567.${tag}`;
  }

  if (combined.includes("invalid-app-credential")) {
    return `Firebase ei hyväksynyt reCAPTCHA-vahvistusta. Päivitä sivu ja kokeile uudelleen.${tag}`;
  }

  if (combined.includes("unauthorized-domain")) {
    return `Verkkotunnus ei ole sallittu Firebase-konsolissa. Lisää se: Firebase Console → Authentication → Settings → Authorized domains.${tag}`;
  }

  if (combined.includes("captcha-check-failed")) {
    return `reCAPTCHA-tarkistus epäonnistui. Päivitä sivu ja kokeile uudelleen.${tag}`;
  }

  if (combined.includes("quota-exceeded")) {
    return `SMS-kiintiö on täynnä. Kokeile myöhemmin tai käytä testinumeroa.${tag}`;
  }

  if (combined.includes("missing-phone-number")) {
    return `Puhelinnumero puuttuu.${tag}`;
  }

  if (combined.includes("user-disabled")) {
    return `Tili on poistettu käytöstä.${tag}`;
  }

  return message + tag;
}

function getPhoneDatabaseErrorMessage(error: unknown) {
  const msg =
    getErrorMessage(error);

  if (msg.includes("phone_reserved_until_3_months")) {
    return "Tämä puhelinnumero on varattu poistetulle tilille 3 kuukaudeksi.";
  }

  if (
    msg.includes("profiles_phone_unique") ||
    msg.includes("unique constraint")
  ) {
    return "Tämä puhelinnumero on jo käytössä toisella tilillä.";
  }

  return msg;
}

function formatBirthDate(value: string | null | undefined) {

  if (!value) return "";

  const date =
    new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "fi-FI",
    {
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  ).format(date);

}

function normalizePhoneNumber(value: string) {
  const compact =
    value
      .trim()
      .replace(/[\s().-]/g, "");

  if (!compact) return "";
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `+358${compact.slice(1)}`;

  return `+358${compact}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const profileText = {
    privateDetails: {
      fi: "Yksityiset tiedot",
      en: "Private details",
      sv: "Privata uppgifter",
      no: "Private opplysninger",
      et: "Privaatsed andmed"
    }[locale],
    accountHelp: {
      fi: "Näitä käytetään tilin hallintaan.",
      en: "These are used for account management.",
      sv: "Dessa används för kontohantering.",
      no: "Disse brukes til kontoadministrasjon.",
      et: "Neid kasutatakse konto haldamiseks."
    }[locale],
    firstName: { fi: "Etunimi", en: "First name", sv: "Förnamn", no: "Fornavn", et: "Eesnimi" }[locale],
    lastName: { fi: "Sukunimi", en: "Last name", sv: "Efternamn", no: "Etternavn", et: "Perekonnanimi" }[locale],
    phone: { fi: "Puhelinnumero", en: "Phone number", sv: "Telefonnummer", no: "Telefonnummer", et: "Telefoninumber" }[locale],
    address: { fi: "Osoite", en: "Address", sv: "Adress", no: "Adresse", et: "Aadress" }[locale],
    postalCode: { fi: "Postinumero", en: "Postal code", sv: "Postnummer", no: "Postnummer", et: "Postiindeks" }[locale],
    birthDate: { fi: "Syntymäaika", en: "Date of birth", sv: "Födelsedatum", no: "Fødselsdato", et: "Sünnikuupäev" }[locale],
    publicProfile: { fi: "Julkinen myyjäprofiili", en: "Public seller profile", sv: "Offentlig säljarprofil", no: "Offentlig selgerprofil", et: "Avalik müüja profiil" }[locale],
    publicHelp: {
      fi: "Julkisesti näytetään nimi, ID, kaupunki, maa ja oma esittely.",
      en: "Name, ID, city, country and your intro are shown publicly.",
      sv: "Namn, ID, stad, land och din presentation visas offentligt.",
      no: "Navn, ID, by, land og introduksjonen din vises offentlig.",
      et: "Avalikult kuvatakse nimi, ID, linn, riik ja sinu tutvustus."
    }[locale],
    publicName: { fi: "Julkinen nimi", en: "Public name", sv: "Offentligt namn", no: "Offentlig navn", et: "Avalik nimi" }[locale],
    publicBio: {
      fi: "Tietoa myyjästä",
      en: "About seller",
      sv: "Om säljaren",
      no: "Om selgeren",
      et: "Müüja info"
    }[locale],
    publicBioPlaceholder: {
      fi: "Kerro lyhyesti itsestäsi, kokemuksesta, yrityksestä tai miten toimit ostajien kanssa.",
      en: "Briefly tell buyers about yourself, your experience, company or how you work with buyers.",
      sv: "Berätta kort om dig själv, erfarenhet, företag eller hur du arbetar med köpare.",
      no: "Fortell kort om deg selv, erfaring, bedrift eller hvordan du jobber med kjøpere.",
      et: "Kirjelda lühidalt ennast, kogemust, ettevõtet või kuidas ostjatega suhtled."
    }[locale],
    noId: { fi: "Ei ID:tä", en: "No ID", sv: "Inget ID", no: "Ingen ID", et: "ID puudub" }[locale],
    city: { fi: "Kaupunki", en: "City", sv: "Stad", no: "By", et: "Linn" }[locale],
    country: { fi: "Maa", en: "Country", sv: "Land", no: "Land", et: "Riik" }[locale],
    saveChanges: { fi: "Tallenna muutokset", en: "Save changes", sv: "Spara ändringar", no: "Lagre endringer", et: "Salvesta muudatused" }[locale],
    personalDetails: {
      fi: "Henkilökohtaiset tiedot",
      en: "Personal details",
      sv: "Personliga uppgifter",
      no: "Personlige opplysninger",
      et: "Isiklikud andmed"
    }[locale],
    lockedAfterRegistration: {
      fi: "Nimi ja puhelinnumero lukitaan rekisteröinnin jälkeen.",
      en: "Name and phone number are locked after registration.",
      sv: "Namn och telefonnummer låses efter registrering.",
      no: "Navn og telefonnummer låses etter registrering.",
      et: "Nimi ja telefoninumber lukustatakse pärast registreerimist."
    }[locale],
    companyAccount: {
      fi: "Yritystili",
      en: "Company account",
      sv: "Företagskonto",
      no: "Bedriftskonto",
      et: "Ettevõtte konto"
    }[locale],
    companyDetails: {
      fi: "Yrityksen tiedot",
      en: "Company details",
      sv: "Företagsuppgifter",
      no: "Bedriftsopplysninger",
      et: "Ettevõtte andmed"
    }[locale],
    companyDetailsHelp: {
      fi: "Nämä näkyvät yritysprofiilissa ja helpottavat ostajan luottamusta.",
      en: "These appear on the company profile and help buyers trust you.",
      sv: "Dessa visas i företagsprofilen och hjälper köparen att känna förtroende.",
      no: "Dette vises på bedriftsprofilen og hjelper kjøperen med å stole på deg.",
      et: "Need kuvatakse ettevõtte profiilis ja aitavad ostjal sind usaldada."
    }[locale],
    companyName: {
      fi: "Yrityksen nimi",
      en: "Company name",
      sv: "Företagsnamn",
      no: "Bedriftsnavn",
      et: "Ettevõtte nimi"
    }[locale],
    businessId: {
      fi: "Y-tunnus",
      en: "Business ID",
      sv: "Organisationsnummer",
      no: "Organisasjonsnummer",
      et: "Registrikood"
    }[locale],
    billingEmail: {
      fi: "Laskutussähköposti",
      en: "Billing email",
      sv: "Faktura-e-post",
      no: "Faktura-e-post",
      et: "Arve e-post"
    }[locale],
    companyPhone: {
      fi: "Yrityksen puhelinnumero",
      en: "Company phone number",
      sv: "Företagets telefonnummer",
      no: "Bedriftens telefonnummer",
      et: "Ettevõtte telefoninumber"
    }[locale],
    website: {
      fi: "Verkkosivu",
      en: "Website",
      sv: "Webbplats",
      no: "Nettside",
      et: "Veebisait"
    }[locale],
    noNumber: {
      fi: "Ei numeroa",
      en: "No number",
      sv: "Inget nummer",
      no: "Ingen nummer",
      et: "Numbrit pole"
    }[locale],
    locked: {
      fi: "Lukittu",
      en: "Locked",
      sv: "Låst",
      no: "Låst",
      et: "Lukustatud"
    }[locale],
    verified: {
      fi: "Vahvistettu",
      en: "Verified",
      sv: "Bekräftat",
      no: "Bekreftet",
      et: "Kinnitatud"
    }[locale],
    unverified: {
      fi: "Ei vahvistettu",
      en: "Not verified",
      sv: "Ej bekräftat",
      no: "Ikke bekreftet",
      et: "Kinnitamata"
    }[locale],
    verify: {
      fi: "Vahvista",
      en: "Verify",
      sv: "Bekräfta",
      no: "Bekreft",
      et: "Kinnita"
    }[locale],
    change: {
      fi: "Vaihda",
      en: "Change",
      sv: "Byt",
      no: "Endre",
      et: "Muuda"
    }[locale],
    companyPhoneVerifiedHelp: {
      fi: "Yrityksen numero on vahvistettu. Tätä käytetään yrityksen luottamustietona.",
      en: "The company number is verified. It is used as a trust signal for the company.",
      sv: "Företagets nummer är bekräftat. Det används som förtroendesignal för företaget.",
      no: "Bedriftens nummer er bekreftet. Det brukes som et tillitssignal for bedriften.",
      et: "Ettevõtte number on kinnitatud. Seda kasutatakse ettevõtte usaldusmärgina."
    }[locale],
    companyPhoneUnverifiedHelp: {
      fi: "Vahvista yrityksen numero ennen ilmoitusten julkaisua.",
      en: "Verify the company number before publishing listings.",
      sv: "Bekräfta företagets nummer innan du publicerar annonser.",
      no: "Bekreft bedriftens nummer før du publiserer annonser.",
      et: "Kinnita ettevõtte number enne kuulutuste avaldamist."
    }[locale],
    companySellersTitle: {
      fi: "Yrityksen myyjät",
      en: "Company sellers",
      sv: "Företagets säljare",
      no: "Bedriftens selgere",
      et: "Ettevõtte müüjad"
    }[locale],
    companySellersHelp: {
      fi: "Lisää enintään 8 myyjää. Ilmoituksen luonnissa valitaan kuka näkyy myyjänä ostajalle.",
      en: "Add up to 8 sellers. When creating a listing, you choose who appears as the seller to the buyer.",
      sv: "Lägg till upp till 8 säljare. När du skapar en annons väljer du vem som visas som säljare för köparen.",
      no: "Legg til opptil 8 selgere. Når du oppretter en annonse, velger du hvem som vises som selger for kjøperen.",
      et: "Lisa kuni 8 müüjat. Kuulutuse loomisel valid, kes ostjale müüjana kuvatakse."
    }[locale],
    sellers: {
      fi: "Myyjät",
      en: "Sellers",
      sv: "Säljare",
      no: "Selgere",
      et: "Müüjad"
    }[locale],
    sellerName: {
      fi: "Myyjän nimi",
      en: "Seller name",
      sv: "Säljarens namn",
      no: "Selgerens navn",
      et: "Müüja nimi"
    }[locale],
    phoneNumber: {
      fi: "Puhelinnumero",
      en: "Phone number",
      sv: "Telefonnummer",
      no: "Telefonnummer",
      et: "Telefoninumber"
    }[locale],
    noCompanySellers: {
      fi: "Ei myyjiä vielä. Lisää ensimmäinen myyjä tähän.",
      en: "No sellers yet. Add the first seller here.",
      sv: "Inga säljare ännu. Lägg till den första säljaren här.",
      no: "Ingen selgere ennå. Legg til den første selgeren her.",
      et: "Müüjaid pole veel. Lisa esimene müüja siia."
    }[locale],
    addSeller: {
      fi: "Lisää myyjä",
      en: "Add seller",
      sv: "Lägg till säljare",
      no: "Legg til selger",
      et: "Lisa müüja"
    }[locale],
    save: {
      fi: "Tallenna",
      en: "Save",
      sv: "Spara",
      no: "Lagre",
      et: "Salvesta"
    }[locale],
    cancel: {
      fi: "Peruuta",
      en: "Cancel",
      sv: "Avbryt",
      no: "Avbryt",
      et: "Tühista"
    }[locale],
    edit: {
      fi: "Muokkaa",
      en: "Edit",
      sv: "Redigera",
      no: "Rediger",
      et: "Muuda"
    }[locale],
    deleteAccount: {
      fi: "Tilin poistaminen",
      en: "Delete account",
      sv: "Ta bort konto",
      no: "Slett konto",
      et: "Kustuta konto"
    }[locale],
    companySellerInfoTitle: {
      fi: "Yritystilin myyjät",
      en: "Company account sellers",
      sv: "Företagskontots säljare",
      no: "Bedriftskontoens selgere",
      et: "Ettevõtte konto müüjad"
    }[locale],
    companySellerInfoBody: {
      fi: "Lisää henkilöt profiilin Myyjät-osiossa. Valittu myyjä näkyy ilmoituksessa nimellä ja puhelinnumerolla.",
      en: "Add people in the Sellers section. The selected seller appears in the listing with name and phone number.",
      sv: "Lägg till personer i avsnittet Säljare. Den valda säljaren visas i annonsen med namn och telefonnummer.",
      no: "Legg til personer i Selgere-delen. Valgt selger vises i annonsen med navn og telefonnummer.",
      et: "Lisa inimesed jaotises Müüjad. Valitud müüja kuvatakse kuulutuses nime ja telefoninumbriga."
    }[locale],
    loginToViewProfile: {
      fi: "Kirjaudu sisään nähdäksesi profiilisi.",
      en: "Log in to view your profile.",
      sv: "Logga in för att se din profil.",
      no: "Logg inn for å se profilen din.",
      et: "Profiili vaatamiseks logi sisse."
    }[locale],
    profileNotCompleted: {
      fi: "Profiilia ei ole vielä täytetty.",
      en: "The profile has not been completed yet.",
      sv: "Profilen har inte fyllts i ännu.",
      no: "Profilen er ikke fylt ut ennå.",
      et: "Profiil pole veel täidetud."
    }[locale],
    completeProfile: {
      fi: "Täytä profiili",
      en: "Complete profile",
      sv: "Fyll i profil",
      no: "Fullfør profil",
      et: "Täida profiil"
    }[locale],
    phoneLockedHelp: {
      fi: "Puhelinnumero on vahvistettu kaksi kertaa eikä sitä voi enää vaihtaa.",
      en: "The phone number has been verified twice and can no longer be changed.",
      sv: "Telefonnumret har bekräftats två gånger och kan inte längre ändras.",
      no: "Telefonnummeret er bekreftet to ganger og kan ikke lenger endres.",
      et: "Telefoninumber on kinnitatud kaks korda ja seda ei saa enam muuta."
    }[locale],
    phoneAttemptsSingular: {
      fi: "Voit vahvistaa puhelinnumeron vielä 1 kerran.",
      en: "You can verify the phone number 1 more time.",
      sv: "Du kan bekräfta telefonnumret 1 gång till.",
      no: "Du kan bekrefte telefonnummeret 1 gang til.",
      et: "Saad telefoninumbrit veel 1 kord kinnitada."
    }[locale],
    phoneAttemptsPlural: {
      fi: "Voit vahvistaa puhelinnumeron vielä {count} kertaa.",
      en: "You can verify the phone number {count} more times.",
      sv: "Du kan bekräfta telefonnumret {count} gånger till.",
      no: "Du kan bekrefte telefonnummeret {count} ganger til.",
      et: "Saad telefoninumbrit veel {count} korda kinnitada."
    }[locale],
    changeProfileImage: {
      fi: "Vaihda profiilikuva",
      en: "Change profile image",
      sv: "Byt profilbild",
      no: "Endre profilbilde",
      et: "Muuda profiilipilti"
    }[locale]
  };

  const [user, setUser] =
    useState<User | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);
  const phoneVerificationCount =
    profile?.phone_verification_count ?? 0;
  const phoneChangeLocked =
    phoneVerificationCount >= 2;
  const phoneCanVerify =
    phoneVerificationCount < 2;
  const phoneAttemptsLeft =
    Math.max(0, 2 - phoneVerificationCount);
  const visibleProfileId =
    profile?.public_id || (user?.id ? `ID ${user.id.slice(0, 8)}` : "");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarCropPreview, setAvatarCropPreview] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1.12);
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarDragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneStatus, setPhoneStatus] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [companySellers, setCompanySellers] =
    useState<CompanySeller[]>([]);
  const [sellerDraft, setSellerDraft] =
    useState({ name: "", phone: "" });
  const [sellerStatus, setSellerStatus] =
    useState("");
  const [editingSellerId, setEditingSellerId] =
    useState("");
  const [sellerEditDraft, setSellerEditDraft] =
    useState({ name: "", phone: "" });
  const [phoneVerificationTarget, setPhoneVerificationTarget] =
    useState<"profile" | "seller">("profile");
  const [verifyingSellerId, setVerifyingSellerId] =
    useState("");
  const [phoneCooldownEndsAt, setPhoneCooldownEndsAt] =
    useState<number | null>(null);
  const [phoneCooldownSeconds, setPhoneCooldownSeconds] =
    useState(0);
  const confirmationRef =
    useRef<ConfirmationResult | null>(null);
  const recaptchaRef =
    useRef<RecaptchaVerifier | null>(null);
  const recaptchaWidgetIdRef =
    useRef<number | null>(null); // unused with invisible reCAPTCHA
  const phoneSendingRef =
    useRef(false);
  const recaptchaHostRef =
    useRef<HTMLDivElement | null>(null);
  const phoneInputRef =
    useRef<HTMLInputElement | null>(null);
  const [deleteStatus, setDeleteStatus] =
    useState("");
  const [deleteLoading, setDeleteLoading] =
    useState(false);
  const [deleteModalOpen, setDeleteModalOpen] =
    useState(false);

  useEffect(() => {
    return () => {
      if (avatarCropPreview) URL.revokeObjectURL(avatarCropPreview);
    };
  }, [avatarCropPreview]);

  useEffect(() => {

    if (!supabase) return;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        setUser(null);
      });

  }, []);

  useEffect(() => {
    if (user && profileLoaded && profile === null) {
      router.replace("/auth");
    }
  }, [user, profileLoaded, profile, router]);

  useEffect(() => () => {
    try { recaptchaRef.current?.clear(); } catch { /* DOM may already be unmounted */ }
    recaptchaRef.current = null;
    recaptchaWidgetIdRef.current = null;
    try {
      if (recaptchaHostRef.current) recaptchaHostRef.current.innerHTML = "";
    } catch { /* ignore */ }
    phoneSendingRef.current = false;
  }, []);

  useEffect(() => {
    if (!phoneCooldownEndsAt) {
      setPhoneCooldownSeconds(0);
      return;
    }

    const cooldownEndsAt =
      phoneCooldownEndsAt;

    function updateCooldown() {
      const nextSeconds =
        Math.max(
          0,
          Math.ceil((cooldownEndsAt - Date.now()) / 1000)
        );

      setPhoneCooldownSeconds(nextSeconds);

      if (nextSeconds <= 0) {
        setPhoneCooldownEndsAt(null);
      }
    }

    updateCooldown();
    const interval =
      window.setInterval(updateCooldown, 1000);

    return () => window.clearInterval(interval);
  }, [phoneCooldownEndsAt]);

  useEffect(() => {

    if (!user) return;

    getProfile(user.id)
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setAvatarUrl(data.avatar_url ?? null);
          if (data.account_type === "company") {
            getCompanySellers(data.id)
              .then(({ data: sellers }) => setCompanySellers(sellers ?? []))
              .catch(() => setCompanySellers([]));
          } else {
            setCompanySellers([]);
          }
        }
        if (data?.phone) setPhoneDraft(data.phone);
        setProfileLoaded(true);
      })
      .catch(() => {
        setProfile(null);
        setProfileLoaded(true);
      });

  }, [user]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !profile) return;
    setStatus(t.saving);
    const { data, error } = await updateEditableProfile(user.id, {
      address: profile.address,
      postal_code: profile.postal_code,
      city: profile.city,
      country: profile.country,
      company_name: profile.company_name,
      business_id: profile.business_id,
      company_website: profile.company_website,
      billing_email: profile.billing_email,
      bio: profile.bio
    });
    if (error) { setStatus(getErrorMessage(error)); return; }
    setProfile(data);
    setStatus(t.saved);
    setTimeout(() => setStatus(""), 3000);
  }

  async function handleAddCompanySeller() {
    if (!profile || profile.account_type !== "company") return;
    if (companySellers.length >= 8) {
      setSellerStatus("Yrityksellä voi olla enintään 8 myyjää.");
      return;
    }
    if (!sellerDraft.name.trim() || !sellerDraft.phone.trim()) {
      setSellerStatus("Lisää myyjän nimi ja puhelinnumero.");
      return;
    }

    setSellerStatus("Tallennetaan myyjää...");
    const { data, error } =
      await createCompanySeller(profile.id, sellerDraft);
    if (error || !data) {
      setSellerStatus(getPhoneDatabaseErrorMessage(error));
      return;
    }
    setCompanySellers((current) => [...current, data]);
    setSellerDraft({ name: "", phone: "" });
    setSellerStatus("Myyjä lisätty.");
    setTimeout(() => setSellerStatus(""), 2500);
  }

  async function handleDeleteCompanySeller(sellerId: string) {
    if (!profile || profile.account_type !== "company") return;
    setSellerStatus("Poistetaan myyjää...");
    const { error } =
      await deleteCompanySeller(sellerId, profile.id);
    if (error) {
      setSellerStatus(getErrorMessage(error));
      return;
    }
    setCompanySellers((current) => current.filter((seller) => seller.id !== sellerId));
    setSellerStatus("Myyjä poistettu.");
    setTimeout(() => setSellerStatus(""), 2500);
  }

  function startSellerEdit(seller: CompanySeller) {
    setEditingSellerId(seller.id);
    setSellerEditDraft({
      name: seller.name,
      phone: seller.phone
    });
    setSellerStatus("");
  }

  async function saveSellerEdit(seller: CompanySeller) {
    if (!profile || profile.account_type !== "company") return;
    const editCount = seller.edit_count ?? 0;
    if (editCount >= 5) {
      setSellerStatus("Tätä myyjäpaikkaa on muokattu jo 5 kertaa.");
      return;
    }
    if (!sellerEditDraft.name.trim() || !sellerEditDraft.phone.trim()) {
      setSellerStatus("Lisää myyjän nimi ja puhelinnumero.");
      return;
    }

    setSellerStatus("Tallennetaan myyjää...");
    const { data, error } =
      await updateCompanySeller(seller.id, profile.id, {
        name: sellerEditDraft.name,
        phone: normalizePhoneNumber(sellerEditDraft.phone),
        edit_count: editCount + 1,
        phone_verified_at: seller.phone_verified_at ?? null
      });

    if (error || !data) {
      setSellerStatus(getPhoneDatabaseErrorMessage(error));
      return;
    }

    setCompanySellers((current) =>
      current.map((item) => item.id === seller.id ? data : item)
    );
    setEditingSellerId("");
    setSellerStatus("Myyjä tallennettu.");
    setTimeout(() => setSellerStatus(""), 2500);
  }

  function startPhoneEdit() {
    if (!profile) return;
    setPhoneVerificationTarget("profile");
    setVerifyingSellerId("");
    if (phoneChangeLocked) {
      setPhoneStatus("Puhelinnumero on lukittu kahden vahvistuksen jälkeen.");
      return;
    }
    setPhoneDraft(profile.phone ?? "");
    setPhoneCode("");
    setPhoneStatus("");
    setPhoneCodeSent(false);
    setPhoneEditing(true);
  }

  async function startPhoneVerification() {
    setPhoneVerificationTarget("profile");
    setVerifyingSellerId("");
    if (phoneChangeLocked) {
      setPhoneStatus("Puhelinnumero on lukittu kahden vahvistuksen jälkeen.");
      return;
    }

    if (!profile?.phone) {
      startPhoneEdit();
      return;
    }

    setPhoneDraft(profile.phone);
    setPhoneCode("");
    setPhoneStatus("");
    setPhoneCodeSent(false);
    setPhoneEditing(true);

    window.setTimeout(() => {
      void sendPhoneCode(profile.phone);
    }, 0);
  }

  function cancelPhoneEdit() {
    try { recaptchaRef.current?.clear(); } catch { /* ignore */ }
    recaptchaRef.current = null;
    recaptchaWidgetIdRef.current = null;
    try { if (recaptchaHostRef.current) recaptchaHostRef.current.innerHTML = ""; } catch { /* ignore */ }
    phoneSendingRef.current = false;
    setPhoneDraft(profile?.phone ?? "");
    setPhoneCode("");
    setPhoneStatus("");
    setPhoneCodeSent(false);
    setPhoneEditing(false);
  }

  async function sendPhoneCode(
    phoneOverride?: string,
    target: "profile" | "seller" = phoneVerificationTarget
  ) {
    if (phoneSendingRef.current) return;
    if (target === "profile" && phoneChangeLocked) {
      setPhoneStatus("Puhelinnumero on lukittu kahden vahvistuksen jälkeen.");
      return;
    }
    if (phoneCooldownEndsAt && phoneCooldownEndsAt > Date.now()) {
      setPhoneStatus(
        `Odota ${phoneCooldownSeconds || Math.ceil((phoneCooldownEndsAt - Date.now()) / 1000)} s ennen uutta koodia.`
      );
      return;
    }
    phoneSendingRef.current = true;
    setPhoneStatus("Valmistellaan vahvistusta...");

    if (!supabase || !user || !profile) {
      setPhoneStatus("Kirjaudu sisään ennen vahvistusta.");
      phoneSendingRef.current = false;
      return;
    }

    const firebaseAuth =
      getFirebaseAuth();

    if (!isFirebaseConfigured || !firebaseAuth) {
      setPhoneStatus("Lisää Firebase-asetukset .env.local-tiedostoon.");
      phoneSendingRef.current = false;
      return;
    }

    const nextPhone =
      normalizePhoneNumber(
        phoneOverride ||
        phoneInputRef.current?.value ||
        phoneDraft
      );

    if (!nextPhone) {
      setPhoneStatus("Kirjoita puhelinnumero.");
      phoneSendingRef.current = false;
      return;
    }

    setPhoneDraft(nextPhone);

    setPhoneSaving(true);
    setPhoneStatus("Lähetetään vahvistuskoodia...");

    try {
      const recaptchaHost =
        recaptchaHostRef.current;

      if (!recaptchaHost) {
        throw new Error(
          "Vahvistuselementtiä ei löytynyt. Päivitä sivu ja kokeile uudelleen."
        );
      }

      recaptchaRef.current?.clear();
      recaptchaHost.innerHTML = "";

      const recaptchaContainer = document.createElement("div");
      recaptchaHost.appendChild(recaptchaContainer);

      recaptchaRef.current =
        new RecaptchaVerifier(
          firebaseAuth,
          recaptchaContainer,
          {
            size: "normal"
          }
        );

      confirmationRef.current =
        await signInWithPhoneNumber(
          firebaseAuth,
          nextPhone,
          recaptchaRef.current
        );
    } catch (error) {
      try { recaptchaRef.current?.clear(); } catch { /* ignore */ }
      recaptchaRef.current = null;
      recaptchaWidgetIdRef.current = null;
      try { if (recaptchaHostRef.current) recaptchaHostRef.current.innerHTML = ""; } catch { /* ignore */ }
      const errorMessage =
        getFirebasePhoneErrorMessage(error);
      setPhoneStatus(errorMessage);
      if (
        errorMessage.includes("Liian monta vahvistusyritystä")
      ) {
        setPhoneCooldownEndsAt(Date.now() + 15 * 60 * 1000);
      }
      setPhoneSaving(false);
      phoneSendingRef.current = false;
      return;
    }

    if (target === "profile") {
      const { error: pendingError } =
        await supabase
          .from("profiles")
          .update({
            pending_phone: nextPhone
          })
          .eq("id", user.id);

      if (pendingError) {
        setPhoneStatus(getErrorMessage(pendingError));
        setPhoneSaving(false);
        phoneSendingRef.current = false;
        return;
      }
    }

    setPhoneCodeSent(true);
    setPhoneStatus("Koodi lähetetty. Syötä SMS-koodi alle.");
    setPhoneSaving(false);
    phoneSendingRef.current = false;
  }

  function handleSendPhoneCode() {
    if (phoneCooldownSeconds > 0) {
      setPhoneStatus(
        `Odota ${phoneCooldownSeconds} s ennen uutta koodia.`
      );
      return;
    }
    setPhoneStatus("Aloitetaan koodin lähetys...");
    void sendPhoneCode();
  }

  function handleStartPhoneVerification() {
    setPhoneStatus("");
    void startPhoneVerification();
  }

  async function verifyPhoneCode() {
    if (!supabase || !user) return;

    if (phoneVerificationTarget === "profile" && phoneChangeLocked) {
      setPhoneStatus("Puhelinnumero on lukittu kahden vahvistuksen jälkeen.");
      return;
    }

    const nextPhone =
      normalizePhoneNumber(phoneDraft);

    if (!phoneCode.trim()) {
      setPhoneStatus("Syötä vahvistuskoodi.");
      return;
    }

    setPhoneSaving(true);
    setPhoneStatus("Vahvistetaan numeroa...");

    try {
      await confirmationRef.current?.confirm(
        phoneCode.trim()
      );
    } catch (error) {
      setPhoneStatus(getErrorMessage(error));
      setPhoneSaving(false);
      return;
    }

    if (phoneVerificationTarget === "seller") {
      const seller =
        companySellers.find((item) => item.id === verifyingSellerId);

      if (!profile || !seller) {
        setPhoneStatus("Myyjää ei löytynyt.");
        setPhoneSaving(false);
        return;
      }

      const { data, error } =
        await updateCompanySeller(seller.id, profile.id, {
          name: seller.name,
          phone: nextPhone,
          edit_count: seller.edit_count ?? 0,
          phone_verified_at: new Date().toISOString()
        });

      if (error || !data) {
        setPhoneStatus(getErrorMessage(error));
        setPhoneSaving(false);
        return;
      }

      setCompanySellers((current) =>
        current.map((item) => item.id === seller.id ? data : item)
      );
      confirmationRef.current = null;
      setPhoneEditing(false);
      setPhoneCodeSent(false);
      setPhoneCode("");
      setPhoneStatus("Myyjän puhelinnumero vahvistettu.");
      setPhoneSaving(false);
      return;
    }

    const { data, error } =
      await supabase
        .from("profiles")
        .update({
          phone: nextPhone,
          pending_phone: null,
          phone_verified_at:
            new Date().toISOString(),
          phone_verification_count:
            phoneVerificationCount + 1
        })
        .eq("id", user.id)
        .select()
        .single<UserProfile>();

    if (error) {
      setPhoneStatus(getPhoneDatabaseErrorMessage(error));
      setPhoneSaving(false);
      return;
    }

    setProfile(data);
    confirmationRef.current = null;
    setPhoneEditing(false);
    setPhoneCodeSent(false);
    setPhoneCode("");
    setPhoneStatus("Puhelinnumero vahvistettu.");
    setPhoneSaving(false);
  }

  async function getCurrentAccessToken() {
    if (!supabase) return null;

    const { data } =
      await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }

  function openDeleteModal() {
    setDeleteModalOpen(true);
    setDeleteStatus("");
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setDeleteStatus("");
  }

  async function confirmAccountDeletion() {
    if (!profile || !supabase) return;

    const confirmed =
      window.confirm(
        "Oletko varma? Tili poistetaan pysyvästi ja tilin puhelinnumero varataan 3 kuukaudeksi."
      );

    if (!confirmed) return;

    setDeleteLoading(true);
    setDeleteStatus("Poistetaan tiliä...");

    try {
      const token =
        await getCurrentAccessToken();

      if (!token) {
        setDeleteStatus("Kirjaudu sisään ennen tilin poistamista.");
        setDeleteLoading(false);
        return;
      }

      const response =
        await fetch("/api/account/delete/confirm", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

      const result =
        (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };

      if (!response.ok || !result.ok) {
        setDeleteStatus(result.error ?? "Tilin poisto epäonnistui.");
        setDeleteLoading(false);
        return;
      }

      try {
        sessionStorage.removeItem("home_return_state_v1");
        sessionStorage.removeItem("home_return_pending_v1");
      } catch {}
      await supabase.auth.signOut();
      router.replace("/");
    } catch (error) {
      setDeleteStatus(getErrorMessage(error));
      setDeleteLoading(false);
    }
  }

  function resetAvatarCrop() {
    if (avatarCropPreview) URL.revokeObjectURL(avatarCropPreview);
    setAvatarCropFile(null);
    setAvatarCropPreview(null);
    setAvatarZoom(1.12);
    setAvatarOffset({ x: 0, y: 0 });
    avatarDragRef.current = null;
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { setStatus(t.selectImageFile); return; }
    if (file.size > 4 * 1024 * 1024) { setStatus(t.imageTooLarge); return; }
    if (avatarCropPreview) URL.revokeObjectURL(avatarCropPreview);
    setAvatarCropFile(file);
    setAvatarCropPreview(URL.createObjectURL(file));
    setAvatarZoom(1.12);
    setAvatarOffset({ x: 0, y: 0 });
    setStatus("");
  }

  function startAvatarDrag(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    avatarDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: avatarOffset.x,
      oy: avatarOffset.y
    };
  }

  function moveAvatarDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = avatarDragRef.current;
    if (!drag) return;
    const nextX = Math.max(-90, Math.min(90, drag.ox + event.clientX - drag.x));
    const nextY = Math.max(-90, Math.min(90, drag.oy + event.clientY - drag.y));
    setAvatarOffset({ x: nextX, y: nextY });
  }

  function endAvatarDrag(event: PointerEvent<HTMLDivElement>) {
    if (avatarDragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    avatarDragRef.current = null;
  }

  async function createCroppedAvatarFile(file: File) {
    const imageUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(t.imageUploadFailed));
        img.src = imageUrl;
      });

      const outputSize = 640;
      const previewSize = 260;
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(t.imageUploadFailed);

      ctx.fillStyle = "#071827";
      ctx.fillRect(0, 0, outputSize, outputSize);
      const coverScale = Math.max(outputSize / image.naturalWidth, outputSize / image.naturalHeight) * avatarZoom;
      const drawWidth = image.naturalWidth * coverScale;
      const drawHeight = image.naturalHeight * coverScale;
      const offsetScale = outputSize / previewSize;
      const dx = (outputSize - drawWidth) / 2 + avatarOffset.x * offsetScale;
      const dy = (outputSize - drawHeight) / 2 + avatarOffset.y * offsetScale;
      ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );
      if (!blob) throw new Error(t.imageUploadFailed);
      return new File([blob], "avatar.jpg", { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  async function saveCroppedAvatar() {
    if (!avatarCropFile || !user) return;
    setAvatarUploading(true);
    setStatus("");
    const croppedFile = await createCroppedAvatarFile(avatarCropFile).catch((error) => {
      setStatus(getErrorMessage(error));
      return null;
    });
    if (!croppedFile) {
      setAvatarUploading(false);
      return;
    }
    const { url, error } = await uploadAvatar(user.id, croppedFile);
    setAvatarUploading(false);
    if (error) { setStatus(t.imageUploadFailed); return; }
    if (url) {
      setAvatarUrl(url + "?t=" + Date.now());
      setStatus(t.avatarUpdated);
      resetAvatarCrop();
      setTimeout(() => setStatus(""), 3000);
    }
  }

  async function handleRemoveAvatar(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (!user || !supabase) return;

    setAvatarUploading(true);
    setStatus("");

    const { error } =
      await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

    setAvatarUploading(false);

    if (error) {
      setStatus(getErrorMessage(error));
      return;
    }

    setAvatarUrl(null);
    setProfile((current) =>
      current ? { ...current, avatar_url: null } : current
    );

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }

    setStatus("Profiilikuva poistettu.");
    setTimeout(() => setStatus(""), 3000);
  }

  const profileDisplayName =
    profile
      ? (
          profile.company_name ||
          profile.full_name ||
          profile.name ||
          `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
        )
      : "";

  const profileInitial =
    profileDisplayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <main className="pf-page">

      <header className="pf-topbar">
        <Link className="pf-back" href="/">
          <ArrowLeft size={16} />
          {t.garageHome}
        </Link>
        <Link href="/" className="pf-brand" aria-label="Arctic Parts">
          <span className="pf-brand-icon">AP</span>
          <span className="pf-brand-text">
            <strong>Arctic</strong>
            <em>Parts</em>
          </span>
        </Link>
        <div className="pf-topbar-right">
          <Link href="/sell" className="pf-topbar-cta">
            <span>+ {t.createListing}</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="pf-layout">

        {/* Left sidebar nav */}
        <aside className="pf-sidebar">
          <div className="pf-user-card">
            <div
              className={`pf-avatar pf-avatar-upload${avatarUploading ? " pf-avatar-loading" : ""}`}
              onClick={() => avatarInputRef.current?.click()}
              title={profileText.changeProfileImage}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && avatarInputRef.current?.click()}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" />
                : <span className="profile-avatar-initial">{profileInitial}</span>
              }
              {avatarUrl && (
                <button
                  type="button"
                  className="pf-avatar-remove"
                  onClick={handleRemoveAvatar}
                  aria-label="Poista profiilikuva"
                  title="Poista profiilikuva"
                >
                  ×
                </button>
              )}
              <div className="pf-avatar-overlay">
                {avatarUploading ? "…" : <Camera size={14} />}
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
            <div>
              <div className="pf-user-name">
                {profile
                  ? (profile.full_name || `${profile.first_name} ${profile.last_name}`.trim())
                  : "—"}
              </div>
              {visibleProfileId && (
                <div className="pf-user-id">
                  {visibleProfileId}
                </div>
              )}
              {profile?.account_type === "company" && (
                <div className="pf-company-badge">{profileText.companyAccount}</div>
              )}
            </div>
          </div>
          <nav className="pf-nav">
            <a href="#tiedot" className="pf-nav-item pf-nav-active">
              <Lock size={15} />
              {profileText.privateDetails}
            </a>
            {profile?.account_type === "company" && (
              <a href="#yritys" className="pf-nav-item">
                <Home size={15} />
                {profileText.companyDetails}
              </a>
            )}
            {profile?.account_type === "company" && (
              <a href="#myyjat" className="pf-nav-item">
                <Users size={15} />
                {profileText.sellers}
              </a>
            )}
            <Link
              href={user ? `/seller/${user.id}` : "/"}
              className="pf-nav-item"
              target="_blank"
            >
              <Globe size={15} />
              {profileText.publicProfile}
              <ExternalLink size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />
            </Link>
            {profile && (
              <button
                type="button"
                className="pf-nav-item pf-nav-danger pf-nav-button"
                onClick={openDeleteModal}
              >
                <Trash2 size={15} />
                {profileText.deleteAccount}
              </button>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <div className="pf-content">

          {!user && (
            <div className="pf-login-prompt">
              <LockKeyhole size={22} />
              <span>{profileText.loginToViewProfile}</span>
              <Link href="/auth">{t.login}</Link>
            </div>
          )}

          {user && !profile && (
            <div className="pf-login-prompt">
              <LockKeyhole size={22} />
              <span>{profileText.profileNotCompleted}</span>
              <Link href="/auth">{profileText.completeProfile}</Link>
            </div>
          )}

          {profile && (
            <form className="pf-form" onSubmit={handleSubmit}>

              {/* Section: Private */}
              <section className="pf-section" id="tiedot">
                <div className="pf-section-head">
                  <Lock size={17} />
                  <div>
                    <h2>{profileText.privateDetails}</h2>
                    <p>{profileText.accountHelp}</p>
                  </div>
                </div>
                <div className="pf-fields">
                  {profile.account_type === "private" && (
                    <>
                      <div className="pf-field">
                        <label>{profileText.firstName}</label>
                        <div className="pf-locked">
                          <input disabled value={profile.first_name} />
                          <Lock size={13} className="pf-lock-icon" />
                        </div>
                      </div>
                      <div className="pf-field">
                        <label>{profileText.lastName}</label>
                        <div className="pf-locked">
                          <input disabled value={profile.last_name} />
                          <Lock size={13} className="pf-lock-icon" />
                        </div>
                      </div>
                    </>
                  )}
                  {profile.account_type === "company" && (
                    <div className="pf-field pf-field-wide">
                      <label>{profileText.companySellerInfoTitle}</label>
                      <div className="pf-readonly-value">
                        <Users size={16} />
                        <span>{profileText.companySellerInfoBody}</span>
                      </div>
                    </div>
                  )}
                  {profile.account_type === "private" && (
                    <div className="pf-field">
                      <label>{profileText.phone}</label>
                      <div className="pf-phone-row">
                        <div className="pf-phone-card">
                          <span className="pf-phone-number">
                            {profile.phone || profileText.noNumber}
                          </span>
                          <small
                            className={
                              phoneChangeLocked
                                ? "pf-locked-badge"
                                : profile.phone_verified_at
                                ? "pf-verified"
                                : "pf-unverified"
                            }
                          >
                            {phoneChangeLocked
                              ? profileText.locked
                              : profile.phone_verified_at
                              ? profileText.verified
                              : profileText.unverified}
                          </small>
                        </div>
                        <div className="pf-phone-actions">
                          {!profile.phone_verified_at && phoneCanVerify && (
                            <button
                              type="button"
                              className="pf-inline-btn verify"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              handleStartPhoneVerification();
                            }}
                          >
                              {profileText.verify}
                            </button>
                          )}
                          <button
                            type="button"
                            className="pf-inline-btn"
                            disabled={phoneChangeLocked}
                            onClick={startPhoneEdit}
                          >
                            {phoneChangeLocked ? profileText.locked : profileText.change}
                          </button>
                        </div>
                      </div>
                      <span className="pf-phone-help">
                        {phoneChangeLocked
                          ? profileText.phoneLockedHelp
                          : phoneAttemptsLeft === 1
                          ? profileText.phoneAttemptsSingular
                          : profileText.phoneAttemptsPlural.replace("{count}", String(phoneAttemptsLeft))}
                      </span>
                    </div>
                  )}
                  <div className="pf-field">
                    <label>{t.email}</label>
                    <div className="pf-locked">
                      <input disabled type="email" value={profile.email} />
                      <Lock size={13} className="pf-lock-icon" />
                    </div>
                  </div>
                  {profile.account_type === "private" && (
                    <div className="pf-field">
                      <label>{profileText.birthDate}</label>
                      <div className="pf-readonly-value">
                        <CalendarDays size={16} />
                        <span>{formatBirthDate(profile.birth_date)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {profile.account_type === "company" && (
                <section className="pf-section pf-company-section" id="yritys">
                  <div className="pf-section-head">
                    <Home size={17} />
                    <div>
                      <h2>{profileText.companyDetails}</h2>
                      <p>{profileText.companyDetailsHelp}</p>
                    </div>
                  </div>
                  <div className="pf-fields">
                    <div className="pf-field">
                      <label>{profileText.companyName}</label>
                      <input
                        disabled={Boolean(profile.company_name)}
                        value={profile.company_name ?? ""}
                        onChange={e => setProfile({ ...profile, company_name: e.target.value })}
                      />
                    </div>
                    <div className="pf-field">
                      <label>{profileText.businessId}</label>
                      <input
                        disabled={Boolean(profile.business_id)}
                        value={profile.business_id ?? ""}
                        onChange={e => setProfile({ ...profile, business_id: e.target.value })}
                      />
                    </div>
                    <div className="pf-field">
                      <label>{profileText.billingEmail}</label>
                      <input
                        type="email"
                        value={profile.billing_email ?? ""}
                        onChange={e => setProfile({ ...profile, billing_email: e.target.value })}
                      />
                    </div>
                    <div className="pf-field">
                      <label>{profileText.companyPhone}</label>
                      <div className="pf-phone-row">
                        <div className="pf-phone-card">
                          <span className="pf-phone-number">
                            {profile.phone || profileText.noNumber}
                          </span>
                          <small
                            className={
                              phoneChangeLocked
                                ? "pf-locked-badge"
                                : profile.phone_verified_at
                                ? "pf-verified"
                                : "pf-unverified"
                            }
                          >
                            {phoneChangeLocked
                              ? profileText.locked
                              : profile.phone_verified_at
                              ? profileText.verified
                              : profileText.unverified}
                          </small>
                        </div>
                        <div className="pf-phone-actions">
                          {!profile.phone_verified_at && phoneCanVerify && (
                            <button
                              type="button"
                              className="pf-inline-btn verify"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              handleStartPhoneVerification();
                            }}
                          >
                              {profileText.verify}
                            </button>
                          )}
                          <button
                            type="button"
                            className="pf-inline-btn"
                            disabled={phoneChangeLocked}
                            onClick={startPhoneEdit}
                          >
                            {phoneChangeLocked ? profileText.locked : profileText.change}
                          </button>
                        </div>
                      </div>
                      <span className="pf-phone-help">
                        {profile.phone_verified_at
                          ? profileText.companyPhoneVerifiedHelp
                          : profileText.companyPhoneUnverifiedHelp}
                      </span>
                    </div>
                    <div className="pf-field pf-field-wide">
                      <label>{profileText.website}</label>
                      <div className="pf-website-input">
                        <span aria-hidden="true">https://</span>
                        <input
                          value={profile.company_website ?? ""}
                          onChange={e => setProfile({ ...profile, company_website: e.target.value })}
                          placeholder="yritys.fi"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {profile.account_type === "company" && (
                <section className="pf-section pf-company-sellers-section" id="myyjat">
                  <div className="pf-section-head">
                    <Users size={17} />
                    <div>
                      <h2>{profileText.companySellersTitle}</h2>
                      <p>{profileText.companySellersHelp}</p>
                    </div>
                    <span className="company-seller-limit">
                      {companySellers.length} / 8
                    </span>
                  </div>

                  <div className="company-seller-list">
                    {companySellers.map((seller) => (
                      <div className="company-seller-card" key={seller.id}>
                        <div className="company-seller-avatar">
                          {seller.name.slice(0, 1).toUpperCase()}
                        </div>
                        {editingSellerId === seller.id ? (
                          <div className="company-seller-edit">
                            <input
                              value={sellerEditDraft.name}
                              onChange={(event) => setSellerEditDraft({ ...sellerEditDraft, name: event.target.value })}
                              placeholder={profileText.sellerName}
                            />
                            <input
                              value={sellerEditDraft.phone}
                              onChange={(event) => setSellerEditDraft({ ...sellerEditDraft, phone: event.target.value })}
                              placeholder="+358401234567"
                            />
                          </div>
                        ) : (
                          <div>
                            <strong>{seller.name}</strong>
                            <span><Phone size={13} /> {seller.phone}</span>
                          </div>
                        )}
                        <div className="company-seller-actions">
                          {editingSellerId === seller.id ? (
                            <>
                              <button type="button" className="company-seller-small-btn" onClick={() => saveSellerEdit(seller)}>
                                {profileText.save}
                              </button>
                              <button type="button" className="company-seller-small-btn muted" onClick={() => setEditingSellerId("")}>
                                {profileText.cancel}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="company-seller-small-btn"
                                disabled={(seller.edit_count ?? 0) >= 5}
                                onClick={() => startSellerEdit(seller)}
                              >
                                {profileText.edit} {seller.edit_count ?? 0}/5
                              </button>
                              <button
                                type="button"
                                className="company-seller-delete"
                                onClick={() => handleDeleteCompanySeller(seller.id)}
                                aria-label={`Poista ${seller.name}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {companySellers.length === 0 && (
                      <div className="company-seller-empty">
                        {profileText.noCompanySellers}
                      </div>
                    )}
                  </div>

                  <div className="company-seller-add">
                    <div className="company-seller-add-head">
                      <strong>{profileText.addSeller}</strong>
                      <span>{companySellers.length} / 8</span>
                    </div>
                    <div className="company-seller-add-fields">
                      <label>
                        {profileText.sellerName}
                        <input
                          value={sellerDraft.name}
                          disabled={companySellers.length >= 8}
                          onChange={(event) => setSellerDraft({ ...sellerDraft, name: event.target.value })}
                          placeholder="esim. Pertti"
                        />
                      </label>
                      <label>
                        {profileText.phoneNumber}
                        <input
                          value={sellerDraft.phone}
                          disabled={companySellers.length >= 8}
                          onChange={(event) => setSellerDraft({ ...sellerDraft, phone: event.target.value })}
                          placeholder="+358401234567"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="company-seller-add-btn"
                      disabled={companySellers.length >= 8}
                      onClick={handleAddCompanySeller}
                    >
                      <Plus size={16} />
                      {profileText.addSeller}
                    </button>
                  </div>

                  <div className="company-seller-footer">
                    <span>{companySellers.length} / 8 {profileText.sellers.toLocaleLowerCase(locale)}</span>
                    {sellerStatus && <strong>{sellerStatus}</strong>}
                  </div>
                </section>
              )}

              {/* Section: Public */}
              <section className="pf-section" id="julkinen">
                <div className="pf-section-head">
                  <Globe size={17} />
                  <div>
                    <h2>{profileText.publicProfile}</h2>
                    <p>{profileText.publicHelp}</p>
                  </div>
                </div>
                <div className="pf-fields">
                  <div className="pf-field">
                    <label>{profileText.publicName}</label>
                    <div className="pf-locked">
                      <input disabled value={
                        profile.account_type === "company"
                          ? profile.company_name || profile.full_name || ""
                          : profile.full_name ?? `${profile.first_name} ${profile.last_name}`.trim()
                      } />
                      <Lock size={13} className="pf-lock-icon" />
                    </div>
                  </div>
                  <div className="pf-field">
                    <label>UID</label>
                    <div className="pf-readonly-value">
                      <Hash size={16} />
                      <span>{profile.public_id || profileText.noId}</span>
                    </div>
                  </div>
                  <div className="pf-field pf-field-wide">
                    <label>{profileText.publicBio}</label>
                    <textarea
                      value={profile.bio ?? ""}
                      maxLength={600}
                      rows={5}
                      onChange={e => setProfile({ ...profile, bio: e.target.value })}
                      placeholder={profileText.publicBioPlaceholder}
                    />
                    <span className="pf-phone-help">
                      {(profile.bio ?? "").length}/600
                    </span>
                  </div>
                </div>
              </section>

              {/* Section: Address */}
              <section className="pf-section" id="osoite">
                <div className="pf-section-head">
                  <Home size={17} />
                  <div>
                    <h2>Osoitetiedot</h2>
                    <p>Nämä tiedot voidaan muokata.</p>
                  </div>
                </div>
                <div className="pf-fields">
                  <div className="pf-field pf-field-wide">
                    <label>{profileText.address}</label>
                    <input
                      value={profile.address ?? ""}
                      onChange={e => setProfile({ ...profile, address: e.target.value })}
                    />
                  </div>
                  <div className="pf-field">
                    <label>{profileText.postalCode}</label>
                    <input
                      value={profile.postal_code ?? ""}
                      onChange={e => setProfile({ ...profile, postal_code: e.target.value })}
                    />
                  </div>
                  <div className="pf-field">
                    <label>{profileText.city}</label>
                    <input
                      value={profile.city ?? ""}
                      onChange={e => setProfile({ ...profile, city: e.target.value })}
                    />
                  </div>
                  <div className="pf-field">
                    <label>{profileText.country}</label>
                    <input
                      value={profile.country ?? ""}
                      onChange={e => setProfile({ ...profile, country: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              {/* Save bar */}
              <div className="pf-save-bar">
                <button type="submit" className="pf-save-btn">
                  <Check size={16} />
                  {profileText.saveChanges}
                </button>
                {status && <span className="pf-status">{status}</span>}
              </div>

            </form>
          )}
        </div>
      </div>

      {phoneEditing && (
        <div
          className="pf-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !phoneSaving) {
              cancelPhoneEdit();
            }
          }}
        >
          <div
            className="pf-phone-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="phone-verification-title"
          >
            <button
              type="button"
              className="pf-modal-close"
              disabled={phoneSaving}
              onClick={cancelPhoneEdit}
              aria-label="Sulje"
            >
              ×
            </button>
            <div className="pf-modal-icon">
              <Lock size={22} />
            </div>
            <h2 id="phone-verification-title">
              {phoneVerificationTarget === "seller"
                ? "Vahvista myyjän puhelin"
                : "Vahvista puhelinnumero"}
            </h2>
            <p>
              {phoneVerificationTarget === "seller"
                ? "Lähetämme SMS-koodin myyjän numeroon. Ilmoituksissa myyjän numero näkyy vahvistettuna vasta koodin jälkeen."
                : "Lähetämme SMS-koodin tähän numeroon. Numero lukitaan tilille vasta kun koodi on vahvistettu."}
            </p>
            {phoneVerificationTarget === "profile" && (
              <span className="pf-modal-note">
                {phoneAttemptsLeft === 1
                  ? "Tämä on viimeinen sallittu puhelinnumeron vaihto."
                  : `Vahvistuksia jäljellä: ${phoneAttemptsLeft}.`}
              </span>
            )}
            <div className="pf-phone-edit">
              <input
                ref={phoneInputRef}
                value={phoneDraft}
                onChange={(event) =>
                  setPhoneDraft(event.target.value)
                }
                placeholder="+358401234567"
              />
              {!phoneCodeSent ? (
                <button
                  type="button"
                  className="pf-inline-btn"
                  disabled={
                    phoneSaving ||
                    phoneCooldownSeconds > 0
                  }
                  onPointerDown={(event) => {
                    event.preventDefault();
                    handleSendPhoneCode();
                  }}
                >
                  {phoneCooldownSeconds > 0
                    ? `Odota ${phoneCooldownSeconds} s`
                    : "Lähetä koodi"}
                </button>
              ) : (
                <>
                  <input
                    value={phoneCode}
                    onChange={(event) =>
                      setPhoneCode(event.target.value)
                    }
                    placeholder="SMS-koodi"
                  />
                  <button
                    type="button"
                    className="pf-inline-btn"
                    disabled={phoneSaving}
                    onClick={verifyPhoneCode}
                  >
                    Vahvista
                  </button>
                </>
              )}
              <button
                type="button"
                className="pf-inline-btn secondary"
                disabled={phoneSaving}
                onClick={cancelPhoneEdit}
              >
                Peruuta
              </button>
              <div className="pf-recaptcha-slot" ref={recaptchaHostRef} />
            </div>
            {phoneStatus && (
              <span className="pf-phone-status">
                {phoneStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {deleteModalOpen && profile && (
        <div
          className="pf-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteModal();
            }
          }}
        >
          <div
            className="pf-phone-modal pf-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <button
              type="button"
              className="pf-modal-close"
              disabled={deleteLoading}
              onClick={closeDeleteModal}
              aria-label="Sulje"
            >
              ×
            </button>
            <div className="pf-delete-modal-icon">
              <Trash2 size={22} />
            </div>
            <h2 id="delete-account-title">
              Tilin poistaminen
            </h2>
            <p>
              Tämä poistaa tilin pysyvästi. Kysymme vielä viimeisen varmistuksen
              ennen kuin poisto tehdään.
            </p>
            <span className="pf-delete-email">
              {profile.email}
            </span>
            <div className="pf-delete-modal-actions">
              <button
                type="button"
                className="pf-delete-btn"
                disabled={deleteLoading}
                onClick={confirmAccountDeletion}
              >
                Poista tili
              </button>
              <button
                type="button"
                className="pf-inline-btn secondary"
                disabled={deleteLoading}
                onClick={closeDeleteModal}
              >
                Peruuta
              </button>
            </div>
            <span className="pf-modal-note pf-delete-note">
              Jos tilillä on puhelinnumero, sitä ei voi liittää uuteen tiliin 3 kuukauteen poiston jälkeen.
            </span>
            {deleteStatus && (
              <span className="pf-phone-status">
                {deleteStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {avatarCropPreview && (
        <div
          className="pf-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Muokkaa profiilikuvaa"
        >
          <div className="pf-phone-modal pf-avatar-crop-modal">
            <button
              type="button"
              className="pf-modal-close"
              onClick={resetAvatarCrop}
              disabled={avatarUploading}
              aria-label="Sulje"
            >
              ×
            </button>
            <h2>Muokkaa profiilikuvaa</h2>
            <p>Zoomaa ja raahaa kuva sopivaan kohtaan.</p>
            <div
              className="pf-avatar-crop-frame"
              onPointerDown={startAvatarDrag}
              onPointerMove={moveAvatarDrag}
              onPointerUp={endAvatarDrag}
              onPointerCancel={endAvatarDrag}
            >
              <img
                src={avatarCropPreview}
                alt=""
                draggable={false}
                style={{
                  transform: `translate(calc(-50% + ${avatarOffset.x}px), calc(-50% + ${avatarOffset.y}px)) scale(${avatarZoom})`
                }}
              />
            </div>
            <label className="pf-avatar-zoom">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.01"
                value={avatarZoom}
                onChange={(event) => setAvatarZoom(Number(event.target.value))}
              />
            </label>
            <div className="pf-avatar-crop-actions">
              <button
                type="button"
                className="pf-inline-btn secondary"
                onClick={resetAvatarCrop}
                disabled={avatarUploading}
              >
                Peruuta
              </button>
              <button
                type="button"
                className="pf-inline-btn verify"
                onClick={saveCroppedAvatar}
                disabled={avatarUploading}
              >
                {avatarUploading ? "Tallennetaan..." : "Tallenna kuva"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pf-page { min-height: 100vh; background: #f8fafc; }

        .pf-topbar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 0 32px;
          height: 60px;
          background: white;
          border-bottom: 1px solid #e8edf5;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .pf-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 15px;
          color: #0f172a;
          text-decoration: none;
          margin-right: auto;
        }
        .pf-brand-mark {
          width: 30px;
          height: 30px;
          background: #ff8a24;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .pf-back {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-decoration: none;
        }
        .pf-back:hover { color: #0f172a; }

        .pf-layout {
          max-width: 1180px;
          margin: 0 auto;
          padding: 40px 40px;
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 32px;
          align-items: start;
        }

        /* Sidebar */
        .pf-sidebar {
          position: static;
          top: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pf-user-card {
          background: white;
          border: 1px solid #e8edf5;
          border-radius: 16px;
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 2px 8px rgba(15,23,42,0.05);
        }
        .pf-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }
        .pf-avatar-upload {
          position: relative;
          cursor: pointer;
          overflow: visible;
        }
        .pf-avatar > img,
        .pf-avatar > .profile-avatar-initial {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }
        .pf-avatar > img {
          object-fit: cover;
          display: block;
        }
        .pf-avatar-remove {
          position: absolute;
          top: -7px;
          right: -7px;
          z-index: 3;
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.94);
          border-radius: 999px;
          background: linear-gradient(135deg, #ff9a24, #ff6b16);
          color: #ffffff;
          display: grid;
          place-items: center;
          font-size: 13px;
          font-weight: 950;
          line-height: 1;
          box-shadow: 0 8px 18px rgba(255, 122, 26, 0.32), 0 0 0 2px rgba(8, 20, 34, 0.95);
          cursor: pointer;
        }
        .pf-avatar-remove:hover {
          background: linear-gradient(135deg, #ffad42, #ff7a1a);
          border-color: #ffffff;
          color: #ffffff;
          transform: scale(1.05);
        }
        .pf-avatar-overlay {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.15s;
          color: #fff;
        }
        .pf-avatar-upload:hover .pf-avatar-overlay,
        .pf-avatar-loading .pf-avatar-overlay {
          opacity: 1;
        }
        .pf-avatar-crop-modal {
          max-width: 420px;
          text-align: center;
        }
        .pf-avatar-crop-frame {
          width: 260px;
          height: 260px;
          margin: 18px auto 16px;
          border-radius: 50%;
          border: 3px solid #ff7a1a;
          background: #071827;
          box-shadow: 0 18px 42px rgba(0, 8, 22, 0.28), 0 0 0 999px rgba(0, 0, 0, 0.03) inset;
          cursor: grab;
          overflow: hidden;
          position: relative;
          touch-action: none;
          user-select: none;
        }
        .pf-avatar-crop-frame:active {
          cursor: grabbing;
        }
        .pf-avatar-crop-frame img {
          height: 100%;
          left: 50%;
          object-fit: cover;
          pointer-events: none;
          position: absolute;
          top: 50%;
          transform-origin: center;
          width: 100%;
        }
        .pf-avatar-zoom {
          display: grid;
          gap: 8px;
          margin: 0 0 16px;
          text-align: left;
        }
        .pf-avatar-zoom span {
          color: #0f172a;
          font-size: 13px;
          font-weight: 850;
        }
        .pf-avatar-zoom input {
          accent-color: #ff7a1a;
          width: 100%;
        }
        .pf-avatar-crop-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .pf-user-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        }
        .pf-user-id {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
          margin-top: 2px;
        }
        .pf-nav {
          background: white;
          border: 1px solid #e8edf5;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15,23,42,0.05);
        }
        .pf-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          text-decoration: none;
          border-left: 3px solid transparent;
          transition: background 0.12s, color 0.12s;
        }
        .pf-nav-item:hover { background: #f8fafc; color: #0f172a; }
        .pf-nav-active { border-left-color: #ff7a1a; color: #ff8a24; background: rgba(255, 122, 26, 0.14); }
        .pf-nav-button {
          border-bottom: 0;
          border-right: 0;
          border-top: 0;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          width: 100%;
        }
        .pf-nav-danger {
          color: #b91c1c;
        }
        .pf-nav-danger:hover {
          background: #fff1f2;
          color: #991b1b;
        }
        .pf-nav-item svg:last-child { flex-shrink: 0; }

        /* Content */
        .pf-content { display: flex; flex-direction: column; gap: 20px; }

        .pf-login-prompt {
          background: white;
          border: 1px solid #e8edf5;
          border-radius: 16px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #64748b;
          text-align: center;
        }
        .pf-login-prompt a {
          background: #ff8a24;
          color: white;
          padding: 8px 20px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 14px;
        }

        /* Form */
        .pf-form { display: flex; flex-direction: column; gap: 20px; }

        .pf-section {
          background: white;
          border: 1px solid #e8edf5;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15,23,42,0.04);
        }
        .pf-section-head {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 22px 28px;
          border-bottom: 1px solid #f1f5f9;
          color: #475569;
        }
        .pf-section-head h2 {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 3px;
        }
        .pf-section-head p {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .pf-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }
        .pf-field {
          padding: 20px 28px;
          border-bottom: 1px solid #f1f5f9;
          border-right: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .pf-field:nth-child(even) { border-right: none; }
        .pf-field-wide {
          grid-column: 1 / -1;
          border-right: none;
        }
        .pf-field label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #94a3b8;
        }
        .pf-field input {
          height: 44px;
          border: 1.5px solid #e2e8f0;
          border-radius: 11px;
          padding: 0 14px;
          font-size: 14px;
          font-weight: 500;
          color: #0f172a;
          background: #f8fafc;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          width: 100%;
        }
        .pf-field input:focus {
          border-color: #ff7a1a;
          background: white;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .pf-locked { position: relative; }
        .pf-locked input { padding-right: 36px; }
        .pf-lock-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #cbd5e1;
          pointer-events: none;
        }
        .pf-locked input:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
          border-color: #e2e8f0;
        }
        .pf-readonly-value {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 44px;
          padding: 0 14px;
          background: #f1f5f9;
          border: 1.5px solid #e2e8f0;
          border-radius: 11px;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
        }

        .pf-phone-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          max-width: 340px;
        }

        .pf-phone-card {
          align-items: center;
          background:
            linear-gradient(135deg, #f8fafc, #eef4ff);
          border: 1.5px solid #dbe7fb;
          border-radius: 14px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
          display: flex;
          gap: 10px;
          justify-content: space-between;
          min-height: 46px;
          padding: 0 12px 0 14px;
        }

        .pf-phone-number {
          color: #0f172a;
          flex: 1;
          font-size: 14px;
          font-weight: 800;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pf-verified,
        .pf-unverified,
        .pf-locked-badge {
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          padding: 5px 9px;
          white-space: nowrap;
        }

        .pf-verified {
          background: #16a34a;
          color: #ffffff;
        }

        .pf-unverified {
          background: #dc2626;
          color: #ffffff;
        }

        .pf-locked-badge {
          background: #eef2ff;
          color: #3730a3;
        }

        .pf-phone-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .pf-phone-help {
          color: #64748b;
          display: block;
          font-size: 12px;
          font-weight: 850;
          margin-top: 8px;
        }

        .pf-phone-edit {
          display: grid;
          gap: 9px;
          grid-template-columns: minmax(0, 1fr) auto auto;
        }

        .pf-phone-edit input:first-child {
          grid-column: 1 / -1;
        }

        .pf-inline-btn {
          align-items: center;
          background: linear-gradient(135deg, #2563eb, #ff8a24);
          border: 0;
          border-radius: 12px;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.24);
          color: white;
          cursor: pointer;
          display: inline-flex;
          font-size: 13px;
          font-weight: 950;
          justify-content: center;
          min-height: 44px;
          padding: 0 15px;
          white-space: nowrap;
        }

        .pf-inline-btn.verify {
          background: linear-gradient(135deg, #16a34a, #15803d);
          box-shadow: 0 10px 24px rgba(22, 163, 74, 0.22);
        }

        .pf-inline-btn.secondary {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          box-shadow: none;
          color: #0f172a;
        }

        .pf-inline-btn:disabled {
          cursor: default;
          opacity: 0.55;
        }

        .pf-phone-status {
          color: #475569;
          font-size: 12px;
          font-weight: 800;
          margin-top: 7px;
        }

        .pf-modal-backdrop {
          align-items: center;
          background: rgba(15, 23, 42, 0.46);
          backdrop-filter: blur(10px);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 22px;
          position: fixed;
          z-index: 1000;
        }

        .pf-phone-modal {
          background: white;
          border: 1px solid #dbe7fb;
          border-radius: 22px;
          box-shadow: 0 30px 80px rgba(15, 23, 42, 0.26);
          max-width: 520px;
          padding: 28px;
          position: relative;
          width: min(100%, 520px);
        }

        .pf-modal-close {
          align-items: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          color: #0f172a;
          cursor: pointer;
          display: inline-flex;
          font-size: 26px;
          height: 40px;
          justify-content: center;
          line-height: 1;
          position: absolute;
          right: 18px;
          top: 18px;
          width: 40px;
        }

        .pf-modal-close:disabled {
          cursor: default;
          opacity: 0.55;
        }

        .pf-modal-icon {
          align-items: center;
          background: #e8f0ff;
          border-radius: 18px;
          color: #ff8a24;
          display: inline-flex;
          height: 58px;
          justify-content: center;
          margin-bottom: 16px;
          width: 58px;
        }

        .pf-phone-modal h2 {
          color: #0f172a;
          font-size: 26px;
          line-height: 1.05;
          margin: 0 48px 10px 0;
        }

        .pf-phone-modal p {
          color: #475569;
          font-size: 14px;
          font-weight: 750;
          line-height: 1.5;
          margin: 0 0 18px;
        }

        .pf-modal-note {
          background: rgba(255, 122, 26, 0.14);
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          color: #ff8a24;
          display: block;
          font-size: 12px;
          font-weight: 950;
          margin: -6px 0 14px;
          padding: 9px 11px;
        }

        .pf-phone-modal .pf-phone-edit {
          grid-template-columns: minmax(0, 1fr) auto auto;
        }

        .pf-phone-modal .pf-phone-status {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          display: block;
          margin-top: 12px;
          padding: 10px 12px;
        }

        .pf-recaptcha-slot {
          grid-column: 1 / -1;
          min-height: 0;
        }

        .pf-delete-btn {
          align-items: center;
          background: linear-gradient(135deg, #e11d48, #be123c);
          border: 0;
          border-radius: 12px;
          box-shadow: 0 14px 28px rgba(225, 29, 72, 0.22);
          color: white;
          cursor: pointer;
          display: inline-flex;
          font-size: 13px;
          font-weight: 950;
          justify-content: center;
          min-height: 44px;
          padding: 0 16px;
        }

        .pf-delete-btn:disabled {
          cursor: default;
          opacity: 0.55;
        }

        .pf-delete-modal {
          max-width: 460px;
        }

        .pf-delete-modal-icon {
          align-items: center;
          background: #fff1f2;
          border: 1px solid #fecdd3;
          border-radius: 18px;
          color: #be123c;
          display: inline-flex;
          height: 58px;
          justify-content: center;
          margin-bottom: 16px;
          width: 58px;
        }

        .pf-delete-email {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          color: #475569;
          display: block;
          font-size: 12px;
          font-weight: 950;
          margin: -6px 0 14px;
          padding: 10px 12px;
        }

        .pf-delete-code-row {
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .pf-delete-code-row input {
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          color: #0f172a;
          font-size: 16px;
          font-weight: 900;
          height: 44px;
          letter-spacing: 0.12em;
          outline: none;
          padding: 0 14px;
          width: 100%;
        }

        .pf-delete-code-row input:focus {
          background: white;
          border-color: #fb7185;
          box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.12);
        }

        .pf-delete-modal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }

        .pf-delete-note {
          background: #fff7ed;
          border-color: #fed7aa;
          color: #9a3412;
          margin: 14px 0 0;
        }

        /* Save bar */
        .pf-save-bar {
          background: white;
          border: 1px solid #e8edf5;
          border-radius: 16px;
          padding: 18px 28px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 2px 8px rgba(15,23,42,0.04);
        }
        .pf-save-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 42px;
          padding: 0 22px;
          background: #ff8a24;
          color: white;
          border: none;
          border-radius: 11px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }
        .pf-save-btn:hover { background: #e65c00; }
        .pf-status {
          font-size: 13px;
          color: #22c55e;
          font-weight: 600;
        }

        @media (max-width: 860px) {
          .pf-layout { grid-template-columns: 1fr; padding: 24px 20px; }
          .pf-sidebar { position: static; flex-direction: row; flex-wrap: wrap; }
          .pf-user-card { flex: 1; min-width: 200px; }
          .pf-nav { flex: 2; min-width: 260px; }
        }
        @media (max-width: 560px) {
          .pf-fields { grid-template-columns: 1fr; }
          .pf-field { border-right: none; }
          .pf-field:nth-child(even) { border-right: none; }
          .pf-sidebar { flex-direction: column; }
          .pf-phone-row {
            align-items: stretch;
            grid-template-columns: 1fr;
            max-width: none;
            width: 100%;
          }
          .pf-phone-card {
            align-items: flex-start;
            display: grid;
            gap: 8px;
            grid-template-columns: 1fr;
            justify-items: start;
            min-height: 58px;
            padding: 10px 12px;
          }
          .pf-phone-number {
            font-size: 13px;
            width: 100%;
          }
          .pf-phone-actions {
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
          }
          .pf-phone-actions .pf-inline-btn {
            width: 100%;
          }
          .pf-delete-code-row { grid-template-columns: 1fr; }
          .pf-delete-modal-actions > * { width: 100%; }
        }
      `}</style>

    </main>
  );

}
