"use client";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage, type Locale } from "@/lib/i18n";
import { sanitizePhoneInput } from "@/lib/phone-input";
import { pagePath, profilePath } from "@/lib/routes";

import {
  ArrowRight,
  Building2,
  Camera,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Hash,
  Home,
  Info,
  Lock,
  LockKeyhole,
  LogOut,
  Mail,
  Map,
  MapPin,
  Phone,
  Plus,
  QrCode,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserCircle,
  Users
} from "lucide-react";

import type { User } from "@supabase/supabase-js";
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";

import {
  createCompanySeller,
  deleteCompanySeller,
  dispatchProfileAvatarChanged,
  getCompanySellers,
  getProfile,
  requestPasswordChangeCode,
  supabase,
  updatePassword,
  updateProfileAvatar,
  updateCompanySeller,
  updateEditableProfile,
  uploadAvatar,
  verifyPasswordResetOtp,
  type CompanySeller,
  type UserProfile
} from "@/lib/supabase";

type GooglePlace = {
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  formatted_address?: string;
};

type MfaSetupStep = "choose" | "totp" | null;
type PasswordChangeStep = "code" | "password" | null;

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
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

const addressCountryOptions = [
  { code: "FI", value: "Suomi" },
  { code: "SE", value: "Ruotsi" },
  { code: "DK", value: "Tanska" },
  { code: "DE", value: "Saksa" }
];

const addressCountryLabels: Record<Locale, Record<string, string>> = {
  fi: { Suomi: "Suomi", Ruotsi: "Ruotsi", Tanska: "Tanska", Saksa: "Saksa" },
  en: { Suomi: "Finland", Ruotsi: "Sweden", Tanska: "Denmark", Saksa: "Germany" },
  sv: { Suomi: "Finland", Ruotsi: "Sverige", Tanska: "Danmark", Saksa: "Tyskland" },
  no: { Suomi: "Finland", Ruotsi: "Sverige", Norja: "Norge", Tanska: "Danmark", Viro: "Estland", Saksa: "Tyskland" },
};

const addressCountryAliases: Record<string, string> = {
  da: "Tanska",
  de: "Saksa",
  denmark: "Tanska",
  dk: "Tanska",
  fi: "Suomi",
  finland: "Suomi",
  germany: "Saksa",
  ruotsi: "Ruotsi",
  saksa: "Saksa",
  se: "Ruotsi",
  soome: "Suomi",
  suomi: "Suomi",
  sverige: "Ruotsi",
  sweden: "Ruotsi",
  tanska: "Tanska",
};

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

function normalizeAddressCountry(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "Suomi";
  return addressCountryAliases[trimmed.toLocaleLowerCase("fi-FI")] ?? trimmed;
}

function getCountryCodeForAddress(value: string | null | undefined) {
  const normalized = normalizeAddressCountry(value);
  return addressCountryOptions.find((country) => country.value === normalized)?.code.toLowerCase();
}

function getCountryValueFromGooglePlace(place: GooglePlace) {
  const countryCode = getGoogleAddressPart(place, "country", true).toUpperCase();
  return addressCountryOptions.find((country) => country.code === countryCode)?.value ?? "";
}

function getAddressCountryLabel(locale: Locale, value: string) {
  return addressCountryLabels[locale]?.[value] ?? addressCountryLabels.fi[value] ?? value;
}

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

function formatWebsiteHref(value: string | null | undefined) {
  const trimmed =
    value?.trim();

  if (!trimmed) return null;

  const href =
    /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

  try {
    return new URL(href).toString();
  } catch {
    return null;
  }
}

function formatProfileUpdatedAt(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fi-FI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getPhoneChangeUnlockDate(value: string | null | undefined) {
  if (!value) return null;

  const changedAt = new Date(value);
  if (Number.isNaN(changedAt.getTime())) return null;

  const unlockDate = new Date(changedAt);
  unlockDate.setMonth(unlockDate.getMonth() + 2);

  return unlockDate;
}

function formatPhoneChangeUnlockDate(value: Date) {
  return new Intl.DateTimeFormat("fi-FI", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(value);
}

function normalizePhoneNumber(value: string) {
  const compact = sanitizePhoneInput(value.trim());

  if (!compact) return "";
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `+358${compact.slice(1)}`;

  return `+358${compact}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const authPagePath = pagePath("auth", locale);
  const profileText = {
    privateDetails: {
      fi: "Henkilökohtaiset tiedot",
      en: "Private details",
      sv: "Privata uppgifter",
      no: "Private opplysninger",
    }[locale],
    accountHelp: {
      fi: "Katso ja hallitse henkilökohtaisia tietojasi.",
      en: "These are used for account management.",
      sv: "Dessa används för kontohantering.",
      no: "Disse brukes til kontoadministrasjon.",
    }[locale],
    firstName: { fi: "Etunimi", en: "First name", sv: "Förnamn",
      no: "Fornavn",
    }[locale],
    lastName: { fi: "Sukunimi", en: "Last name", sv: "Efternamn",
      no: "Etternavn",
    }[locale],
    phone: { fi: "Puhelinnumero", en: "Phone number", sv: "Telefonnummer",
      no: "Telefonnummer",
    }[locale],
    address: { fi: "Osoite", en: "Address", sv: "Adress",
      no: "Adresse",
    }[locale],
    postalCode: { fi: "Postinumero", en: "Postal code", sv: "Postnummer",
      no: "Postnummer",
    }[locale],
    publicProfile: { fi: "Julkinen profiili", en: "Public seller profile", sv: "Offentlig säljarprofil",
      no: "Offentlig selgerprofil",
    }[locale],
    profileDetails: { fi: "Profiilin tiedot", en: "Profile details", sv: "Profiluppgifter",
      no: "Profildetaljer",
    }[locale],
    addressDetails: { fi: "Osoitetiedot", en: "Address details", sv: "Adressuppgifter",
      no: "Adresseopplysninger",
    }[locale],
    publicHelp: {
      fi: "Nämä tiedot näkyvät muille Marketplace-käyttäjille.",
      en: "Name, ID, exact address and your intro are shown publicly.",
      sv: "Namn, ID, exakt adress och din presentation visas offentligt.",
      no: "Navn, ID, nøyaktig adresse og introduksjonen din vises offentlig.",
    }[locale],
    publicVisibilityNote: {
      fi: "Julkiset tiedot näkyvät kaikille Marketplace-käyttäjille.",
      en: "Public details are visible to all Marketplace users.",
      sv: "Offentliga uppgifter visas för alla Marketplace-användare.",
      no: "Offentlige opplysninger vises for alle Marketplace-brukere.",
    }[locale],
    moreInfo: {
      fi: "Lisätietoja",
      en: "More info",
      sv: "Mer information",
      no: "Mer informasjon",
    }[locale],
    publicName: { fi: "Näyttönimi", en: "Public name", sv: "Offentligt namn",
      no: "Offentlig navn",
    }[locale],
    publicBio: {
      fi: "Tietoa minusta",
      en: "About seller",
      sv: "Om säljaren",
      no: "Om selgeren",
    }[locale],
    publicBioPlaceholder: {
      fi: "Kerro lyhyesti itsestäsi, kokemuksesta, yrityksestä tai miten toimit ostajien kanssa.",
      en: "Briefly tell buyers about yourself, your experience, company or how you work with buyers.",
      sv: "Berätta kort om dig själv, erfarenhet, företag eller hur du arbetar med köpare.",
      no: "Fortell kort om deg selv, erfaring, bedrift eller hvordan du jobber med kjøpere.",
    }[locale],
    publicAddress: {
      fi: "Yrityksen osoite",
      en: "Public exact address",
      sv: "Offentlig exakt adress",
      no: "Offentlig nøyaktig adresse",
    }[locale],
    publicAddressPlaceholder: {
      fi: "Esim. Varaosatie 4, 71800 Siilinjärvi",
      en: "E.g. Spare Parts Road 4, 71800 Siilinjarvi",
      sv: "T.ex. Reservdelsvägen 4, 71800 Siilinjärvi",
      no: "F.eks. Deleveien 4, 71800 Siilinjärvi",
    }[locale],
    noId: { fi: "Ei ID:tä", en: "No ID", sv: "Inget ID",
      no: "Ingen ID",
    }[locale],
    city: { fi: "Kaupunki", en: "City", sv: "Stad",
      no: "By",
    }[locale],
    country: { fi: "Maa", en: "Country", sv: "Land",
      no: "Land",
    }[locale],
    saveChanges: { fi: "Tallenna muutokset", en: "Save changes", sv: "Spara ändringar",
      no: "Lagre endringer",
    }[locale],
    personalDetails: {
      fi: "Henkilökohtaiset tiedot",
      en: "Personal details",
      sv: "Personliga uppgifter",
      no: "Personlige opplysninger",
    }[locale],
    lockedAfterRegistration: {
      fi: "Nimi ja puhelinnumero lukitaan rekisteröinnin jälkeen.",
      en: "Name and phone number are locked after registration.",
      sv: "Namn och telefonnummer låses efter registrering.",
      no: "Navn og telefonnummer låses etter registrering.",
    }[locale],
    companyAccount: {
      fi: "Yritystili",
      en: "Company account",
      sv: "Företagskonto",
      no: "Bedriftskonto",
    }[locale],
    companyDetails: {
      fi: "Yrityksen tiedot",
      en: "Company details",
      sv: "Företagsuppgifter",
      no: "Bedriftsopplysninger",
    }[locale],
    companyDetailsHelp: {
      fi: "Nämä näkyvät yritysprofiilissa ja helpottavat ostajan luottamusta.",
      en: "These appear on the company profile and help buyers trust you.",
      sv: "Dessa visas i företagsprofilen och hjälper köparen att känna förtroende.",
      no: "Dette vises på bedriftsprofilen og hjelper kjøperen med å stole på deg.",
    }[locale],
    companyName: {
      fi: "Yrityksen nimi",
      en: "Company name",
      sv: "Företagsnamn",
      no: "Bedriftsnavn",
    }[locale],
    businessId: {
      fi: "Y-tunnus",
      en: "Business ID",
      sv: "Organisationsnummer",
      no: "Organisasjonsnummer",
    }[locale],
    billingEmail: {
      fi: "Laskutussähköposti",
      en: "Billing email",
      sv: "Faktura-e-post",
      no: "Faktura-e-post",
    }[locale],
    companyPhone: {
      fi: "Yrityksen puhelinnumero",
      en: "Company phone number",
      sv: "Företagets telefonnummer",
      no: "Bedriftens telefonnummer",
    }[locale],
    website: {
      fi: "Verkkosivu",
      en: "Website",
      sv: "Webbplats",
      no: "Nettside",
    }[locale],
    noNumber: {
      fi: "Ei numeroa",
      en: "No number",
      sv: "Inget nummer",
      no: "Ingen nummer",
    }[locale],
    locked: {
      fi: "Lukittu",
      en: "Locked",
      sv: "Låst",
      no: "Låst",
    }[locale],
    verified: {
      fi: "Vahvistettu",
      en: "Verified",
      sv: "Bekräftat",
      no: "Bekreftet",
    }[locale],
    unverified: {
      fi: "Ei vahvistettu",
      en: "Not verified",
      sv: "Ej bekräftat",
      no: "Ikke bekreftet",
    }[locale],
    verify: {
      fi: "Vahvista",
      en: "Verify",
      sv: "Bekräfta",
      no: "Bekreft",
    }[locale],
    change: {
      fi: "Vaihda",
      en: "Change",
      sv: "Byt",
      no: "Endre",
    }[locale],
    add: {
      fi: "Lisää",
      en: "Add",
      sv: "Lägg till",
      no: "Legg til",
    }[locale],
    companyPhoneVerifiedHelp: {
      fi: "Yrityksen numero on vahvistettu. Tätä käytetään yrityksen luottamustietona.",
      en: "The company number is verified. It is used as a trust signal for the company.",
      sv: "Företagets nummer är bekräftat. Det används som förtroendesignal för företaget.",
      no: "Bedriftens nummer er bekreftet. Det brukes som et tillitssignal for bedriften.",
    }[locale],
    companyPhoneUnverifiedHelp: {
      fi: "Yrityksen numeroa ei tarvitse vahvistaa ilmoitusten julkaisua varten.",
      en: "The company number does not need to be verified for publishing listings.",
      sv: "Företagets nummer behöver inte bekräftas för att publicera annonser.",
      no: "Bedriftens nummer trenger ikke å bekreftes for å publisere annonser.",
    }[locale],
    companySellersTitle: {
      fi: "Yrityksen myyjät",
      en: "Company sellers",
      sv: "Företagets säljare",
      no: "Bedriftens selgere",
    }[locale],
    companySellersHelp: {
      fi: "Lisää halutessasi yritykselle myyjiä. Ilmoitus voidaan julkaista myös yrityksen omilla tiedoilla.",
      en: "Optionally add company sellers. Listings can also be published with the company details.",
      sv: "Lägg till företagets säljare vid behov. Annonser kan också publiceras med företagets uppgifter.",
      no: "Legg til bedriftens selgere ved behov. Annonser kan også publiseres med bedriftens opplysninger.",
    }[locale],
    sellers: {
      fi: "Myyjät",
      en: "Sellers",
      sv: "Säljare",
      no: "Selgere",
    }[locale],
    sellerName: {
      fi: "Myyjän nimi",
      en: "Seller name",
      sv: "Säljarens namn",
      no: "Selgerens navn",
    }[locale],
    phoneNumber: {
      fi: "Puhelinnumero",
      en: "Phone number",
      sv: "Telefonnummer",
      no: "Telefonnummer",
    }[locale],
    noCompanySellers: {
      fi: "Ei erillisiä myyjiä vielä. Ilmoituksissa käytetään yrityksen tietoja.",
      en: "No separate sellers yet. Listings use the company details.",
      sv: "Inga separata säljare ännu. Annonser använder företagets uppgifter.",
      no: "Ingen egne selgere ennå. Annonser bruker bedriftens opplysninger.",
    }[locale],
    addSeller: {
      fi: "Lisää myyjä",
      en: "Add seller",
      sv: "Lägg till säljare",
      no: "Legg til selger",
    }[locale],
    save: {
      fi: "Tallenna",
      en: "Save",
      sv: "Spara",
      no: "Lagre",
    }[locale],
    cancel: {
      fi: "Peruuta",
      en: "Cancel",
      sv: "Avbryt",
      no: "Avbryt",
    }[locale],
    close: {
      fi: "Sulje",
      en: "Close",
      sv: "Stäng",
      no: "Lukk",
    }[locale],
    addPhoto: {
      fi: "Lisää kuva",
      en: "Add photo",
      sv: "Lägg till bild",
      no: "Legg til bilde",
    }[locale],
    remove: {
      fi: "Poista",
      en: "Remove",
      sv: "Ta bort",
      no: "Fjern",
    }[locale],
    editProfilePhoto: {
      fi: "Muokkaa profiilikuvaa",
      en: "Edit profile photo",
      sv: "Redigera profilbild",
      no: "Rediger profilbilde",
    }[locale],
    avatarCropHelp: {
      fi: "Zoomaa ja raahaa kuva sopivaan kohtaan.",
      en: "Zoom and drag the photo into position.",
      sv: "Zooma och dra bilden till rätt läge.",
      no: "Zoom og dra bildet til riktig posisjon.",
    }[locale],
    saving: {
      fi: "Tallennetaan...",
      en: "Saving...",
      sv: "Sparar...",
      no: "Lagrer...",
    }[locale],
    savePhoto: {
      fi: "Tallenna kuva",
      en: "Save photo",
      sv: "Spara bild",
      no: "Lagre bilde",
    }[locale],
    edit: {
      fi: "Muokkaa",
      en: "Edit",
      sv: "Redigera",
      no: "Rediger",
    }[locale],
    deleteAccount: {
      fi: "Tilin poistaminen",
      en: "Delete account",
      sv: "Ta bort konto",
      no: "Slett konto",
    }[locale],
    accountSecurity: {
      fi: "Tilin turvallisuus",
      en: "Account security",
      sv: "Kontosäkerhet",
      no: "Kontosikkerhet",
    }[locale],
    passwordHelp: {
      fi: "Vahvista salasanan vaihto sähköpostiisi lähetettävällä koodilla.",
      en: "Confirm the password change with a code sent to your email.",
      sv: "Bekräfta lösenordsbytet med en kod som skickas till din e-post.",
      no: "Bekreft passordbyttet med en kode som sendes til e-posten din.",
    }[locale],
    passwordEmail: {
      fi: "Tilin sähköposti",
      en: "Account email",
      sv: "Kontots e-post",
      no: "Kontoens e-post",
    }[locale],
    sendPasswordLink: {
      fi: "Vaihda salasana",
      en: "Change password",
      sv: "Byt lösenord",
      no: "Bytt passord",
    }[locale],
    passwordLinkSent: {
      fi: "Vahvistuskoodi lähetettiin sähköpostiisi.",
      en: "A verification code was sent to your email.",
      sv: "En verifieringskod har skickats till din e-post.",
      no: "En bekreftelseskode er sendt til e-posten din.",
    }[locale],
    passwordLinkSending: {
      fi: "Lähetetään koodia...",
      en: "Sending code...",
      sv: "Skickar kod...",
      no: "Sender kode...",
    }[locale],
    companySellerInfoTitle: {
      fi: "Yritystilin myyjät",
      en: "Company account sellers",
      sv: "Företagskontots säljare",
      no: "Bedriftskontoens selgere",
    }[locale],
    companySellerInfoBody: {
      fi: "Lisää henkilöt profiilin Myyjät-osiossa. Valittu myyjä näkyy ilmoituksessa nimellä ja puhelinnumerolla.",
      en: "Add people in the Sellers section. The selected seller appears in the listing with name and phone number.",
      sv: "Lägg till personer i avsnittet Säljare. Den valda säljaren visas i annonsen med namn och telefonnummer.",
      no: "Legg til personer i Selgere-delen. Valgt selger vises i annonsen med navn og telefonnummer.",
    }[locale],
    loginToViewProfile: {
      fi: "Kirjaudu sisään nähdäksesi profiilisi.",
      en: "Log in to view your profile.",
      sv: "Logga in för att se din profil.",
      no: "Logg inn for å se profilen din.",
    }[locale],
    profileNotCompleted: {
      fi: "Profiilia ei ole vielä täytetty.",
      en: "The profile has not been completed yet.",
      sv: "Profilen har inte fyllts i ännu.",
      no: "Profilen er ikke fylt ut ennå.",
    }[locale],
    completeProfile: {
      fi: "Täytä profiili",
      en: "Complete profile",
      sv: "Fyll i profil",
      no: "Fullfør profil",
    }[locale],
    phoneLockedHelp: {
      fi: "Puhelinnumero on vahvistettu kaksi kertaa eikä sitä voi enää vaihtaa.",
      en: "The phone number has been verified twice and can no longer be changed.",
      sv: "Telefonnumret har bekräftats två gånger och kan inte längre ändras.",
      no: "Telefonnummeret er bekreftet to ganger og kan ikke lenger endres.",
    }[locale],
    phoneAttemptsSingular: {
      fi: "Voit vahvistaa puhelinnumeron vielä 1 kerran.",
      en: "You can verify the phone number 1 more time.",
      sv: "Du kan bekräfta telefonnumret 1 gång till.",
      no: "Du kan bekrefte telefonnummeret 1 gang til.",
    }[locale],
    phoneAttemptsPlural: {
      fi: "Voit vahvistaa puhelinnumeron vielä {count} kertaa.",
      en: "You can verify the phone number {count} more times.",
      sv: "Du kan bekräfta telefonnumret {count} gånger till.",
      no: "Du kan bekrefte telefonnummeret {count} ganger til.",
    }[locale],
    changeProfileImage: {
      fi: "Vaihda profiilikuva",
      en: "Change profile image",
      sv: "Byt profilbild",
      no: "Endre profilbilde",
    }[locale]
  };

  const [user, setUser] =
    useState<User | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [listingProfileNotice, setListingProfileNotice] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSending, setPasswordSending] = useState(false);
  const [passwordChangeStep, setPasswordChangeStep] = useState<PasswordChangeStep>(null);
  const [passwordCode, setPasswordCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [mfaSetupStep, setMfaSetupStep] = useState<MfaSetupStep>(null);
  const [mfaMethod, setMfaMethod] = useState<"totp" | "email" | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaEnrollment, setMfaEnrollment] = useState<TotpEnrollment | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaStatus, setMfaStatus] = useState("");
  const [mfaSaving, setMfaSaving] = useState(false);
  const [companyVerifyModalOpen, setCompanyVerifyModalOpen] = useState(false);
  const [companyVerifySaving, setCompanyVerifySaving] = useState(false);
  const [companyVerifyStatus, setCompanyVerifyStatus] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarCropPreview, setAvatarCropPreview] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1.12);
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarDragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const profileLoadGenerationRef = useRef(0);
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneStatus, setPhoneStatus] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [companySellers, setCompanySellers] =
    useState<CompanySeller[]>([]);
  const [sellerDraft, setSellerDraft] =
    useState({ name: "", phone: "" });
  const [sellerAddOpen, setSellerAddOpen] =
    useState(false);
  const [sellerStatus, setSellerStatus] =
    useState("");
  const [editingSellerId, setEditingSellerId] =
    useState("");
  const [sellerEditDraft, setSellerEditDraft] =
    useState({ name: "", phone: "" });
  const phoneInputRef =
    useRef<HTMLInputElement | null>(null);
  const addressInputRef =
    useRef<HTMLInputElement | null>(null);
  const [deleteStatus, setDeleteStatus] =
    useState("");
  const [deleteLoading, setDeleteLoading] =
    useState(false);
  const [deleteModalOpen, setDeleteModalOpen] =
    useState(false);
  const [deleteFinalConfirm, setDeleteFinalConfirm] =
    useState(false);
  const phoneUnlockDate =
    getPhoneChangeUnlockDate(profile?.phone_last_changed_at);
  const phoneChangeLocked = false;
  const phoneChangeLockText =
    phoneUnlockDate
      ? `Puhelinnumeron voi vaihtaa seuraavan kerran ${formatPhoneChangeUnlockDate(phoneUnlockDate)}.`
      : "";
  const hasPhoneNumber = Boolean(profile?.phone?.trim());
  const phoneActionLabel = hasPhoneNumber ? profileText.change : profileText.add;
  const phoneActionTitle = hasPhoneNumber ? "Vaihda puhelinnumero" : "Lisää puhelinnumero";

  useEffect(() => {
    return () => {
      if (avatarCropPreview) URL.revokeObjectURL(avatarCropPreview);
    };
  }, [avatarCropPreview]);

  useEffect(() => {

    try {
      const notice = sessionStorage.getItem("maskines_listing_profile_notice") ?? "";
      if (notice) {
        setListingProfileNotice(notice);
        sessionStorage.removeItem("maskines_listing_profile_notice");
      }
    } catch {}

  }, []);

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
      router.replace(authPagePath);
    }
  }, [authPagePath, user, profileLoaded, profile, router]);

  useEffect(() => {

    if (!user) return;

    const loadGeneration = ++profileLoadGenerationRef.current;

    const cacheKey = `profile:${user.id}`;
    const cached = readCachedResource<UserProfile>(cacheKey);
    if (cached) {
      setProfile(cached);
      setAvatarUrl(cached.avatar_url ?? null);
      if (cached.phone) setPhoneDraft(cached.phone);
      setProfileLoaded(true);
    }

    getProfile(user.id)
      .then(({ data }) => {
        if (loadGeneration !== profileLoadGenerationRef.current) return;
        if (data) {
          setProfile(data);
          writeCachedResource(cacheKey, data);
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
        if (loadGeneration !== profileLoadGenerationRef.current) return;
        setProfile(null);
        setProfileLoaded(true);
      });

  }, [user]);

  useEffect(() => {
    if (!user || !supabase) return;

    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active || error) return;
      const verifiedTotp = data?.totp?.find(
        (factor) => factor.friendly_name !== "Maskines Admin"
      );
      if (verifiedTotp) {
        setMfaFactorId(verifiedTotp.id);
        setMfaMethod("totp");
        return;
      }
      setMfaFactorId("");
      setMfaMethod(user.user_metadata?.email_mfa_enabled === true ? "email" : null);
    });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!profile) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    const setupAutocomplete = () => {
      const addressInput = addressInputRef.current;
      const Autocomplete =
        (window as GoogleMapsWindow).google?.maps?.places?.Autocomplete;

      if (!addressInput || !Autocomplete || cancelled) return;

      const selectedCountryCode =
        getCountryCodeForAddress(profile.country);

      const autocomplete = new Autocomplete(addressInput, {
        componentRestrictions: {
          country: selectedCountryCode
            ? [selectedCountryCode]
            : addressCountryOptions.map((country) => country.code.toLowerCase())
        },
        fields: ["address_components", "formatted_address"],
        types: ["address"]
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

        setProfile((current) => current
          ? {
              ...current,
              address: address || current.address,
              city: city || current.city,
              country: country || current.country,
              postal_code: postalCode || current.postal_code
            }
          : current
        );
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
  }, [locale, profile?.country]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !profile) return;
    setStatus(t.saving);
    const { data, error } = await updateEditableProfile(user.id, {
      account_type: profile.account_type ?? "private",
      address: profile.address,
      postal_code: profile.postal_code,
      city: profile.city,
      country: profile.country,
      company_name: profile.company_name,
      business_id: profile.business_id,
      company_website: profile.company_website,
      public_address: profile.public_address,
      billing_email: profile.billing_email,
      bio: profile.bio
    });
    if (error) { setStatus(getErrorMessage(error)); return; }
    setProfile(data);
    if (data) {
      writeCachedResource(`profile:${user.id}`, data);
    }
    if (data?.account_type === "company") {
      getCompanySellers(data.id)
        .then(({ data: sellers }) => setCompanySellers(sellers ?? []))
        .catch(() => setCompanySellers([]));
    } else {
      setCompanySellers([]);
    }
    setStatus(t.saved);
    setTimeout(() => setStatus(""), 3000);
  }

  async function handlePasswordReset() {
    if (passwordSending) return;

    const passwordEmail = user?.email?.trim() || profile?.email?.trim();
    if (!passwordEmail) {
      setPasswordStatus("Tililtä puuttuu sähköpostiosoite. Kirjaudu uudelleen ja yritä sitten uudelleen.");
      return;
    }

    setPasswordChangeStep("code");
    setPasswordCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setPasswordSending(true);
    setPasswordStatus("Lähetetään vahvistuskoodia...");

    try {
      const { error } = await Promise.race([
        requestPasswordChangeCode(locale),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("Vahvistuskoodin lähetys kesti liian kauan. Yritä uudelleen.")),
            10000
          );
        })
      ]);

      if (error) {
        setPasswordStatus(getErrorMessage(error));
        return;
      }

      setPasswordStatus("Syötä sähköpostiisi lähetetty kuusinumeroinen koodi.");
    } catch (error) {
      setPasswordStatus(getErrorMessage(error));
    } finally {
      setPasswordSending(false);
    }
  }

  function closePasswordChange() {
    if (passwordSending) return;
    setPasswordChangeStep(null);
    setPasswordCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setPasswordStatus("");
  }

  async function verifyPasswordCode() {
    if (passwordSending || passwordCode.length !== 6) return;

    const passwordEmail = user?.email?.trim() || profile?.email?.trim();
    if (!passwordEmail) return;

    setPasswordSending(true);
    setPasswordStatus("Vahvistetaan koodia...");
    const { error } = await verifyPasswordResetOtp(passwordEmail, passwordCode);
    setPasswordSending(false);

    if (error) {
      setPasswordStatus("Koodi on virheellinen tai vanhentunut. Tarkista koodi ja yritä uudelleen.");
      return;
    }

    setPasswordStatus("");
    setPasswordChangeStep("password");
  }

  async function saveNewPassword() {
    if (passwordSending) return;

    if (newPassword.length < 8) {
      setPasswordStatus("Salasanassa pitää olla vähintään 8 merkkiä.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordStatus("Salasanat eivät ole samat.");
      return;
    }

    setPasswordSending(true);
    setPasswordStatus("Tallennetaan uutta salasanaa...");
    const { error } = await updatePassword(newPassword);
    setPasswordSending(false);

    if (error) {
      setPasswordStatus(getErrorMessage(error));
      return;
    }

    setPasswordChangeStep(null);
    setPasswordCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setPasswordStatus("Salasana vaihdettiin onnistuneesti.");
    window.setTimeout(() => setPasswordStatus(""), 4000);
  }

  async function beginTotpEnrollment() {
    if (!supabase || !user || mfaSaving) return;
    setMfaSaving(true);
    setMfaStatus("");

    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const verifiedTotp = factors?.totp?.find(
        (factor) => factor.friendly_name !== "Maskines Admin"
      );
      if (verifiedTotp) {
        setMfaFactorId(verifiedTotp.id);
        setMfaMethod("totp");
        setMfaSetupStep(null);
        return;
      }

      const unfinished = (factors?.all ?? []).filter(
        (factor) =>
          factor.factor_type === "totp" &&
          factor.status === "unverified" &&
          factor.friendly_name !== "Maskines Admin"
      );
      for (const factor of unfinished) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Maskines Marketplace"
      });
      if (error) throw error;

      setMfaEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret
      });
      setMfaCode("");
      setMfaSetupStep("totp");
    } catch (error) {
      setMfaStatus(getErrorMessage(error));
    } finally {
      setMfaSaving(false);
    }
  }

  async function verifyTotpEnrollment() {
    if (!supabase || !mfaEnrollment || mfaSaving) return;
    if (!/^\d{6}$/.test(mfaCode)) {
      setMfaStatus("Anna Authenticator-sovelluksen kuusinumeroinen koodi.");
      return;
    }

    setMfaSaving(true);
    setMfaStatus("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaEnrollment.factorId,
        code: mfaCode
      });
      if (error) throw error;

      const { data: updated, error: metadataError } = await supabase.auth.updateUser({
        data: { email_mfa_enabled: false }
      });
      if (metadataError) throw metadataError;

      setUser(updated.user);
      setMfaFactorId(mfaEnrollment.factorId);
      setMfaMethod("totp");
      setMfaEnrollment(null);
      setMfaCode("");
      setMfaSetupStep(null);
      setMfaStatus("Authenticator otettiin käyttöön.");
    } catch (error) {
      setMfaStatus(getErrorMessage(error));
    } finally {
      setMfaSaving(false);
    }
  }

  async function enableEmailMfa() {
    if (!supabase || mfaSaving) return;
    setMfaSaving(true);
    setMfaStatus("");
    try {
      if (mfaFactorId) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
        if (unenrollError) throw unenrollError;
      }
      const { data, error } = await supabase.auth.updateUser({
        data: { email_mfa_enabled: true }
      });
      if (error) throw error;

      setUser(data.user);
      setMfaFactorId("");
      setMfaEnrollment(null);
      setMfaMethod("email");
      setMfaSetupStep(null);
      setMfaStatus("Sähköpostikoodi otettiin käyttöön.");
    } catch (error) {
      setMfaStatus(getErrorMessage(error));
    } finally {
      setMfaSaving(false);
    }
  }

  async function disableMfa() {
    if (!supabase || mfaSaving) return;
    setMfaSaving(true);
    setMfaStatus("");
    try {
      if (mfaFactorId) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
        if (unenrollError) throw unenrollError;
      }
      const { data, error } = await supabase.auth.updateUser({
        data: { email_mfa_enabled: false }
      });
      if (error) throw error;

      setUser(data.user);
      setMfaFactorId("");
      setMfaEnrollment(null);
      setMfaMethod(null);
      setMfaSetupStep(null);
      setMfaStatus("Kaksivaiheinen tunnistus poistettiin käytöstä.");
    } catch (error) {
      setMfaStatus(getErrorMessage(error));
    } finally {
      setMfaSaving(false);
    }
  }

  async function closeMfaSetup() {
    if (supabase && mfaEnrollment && mfaMethod !== "totp") {
      await supabase.auth.mfa.unenroll({ factorId: mfaEnrollment.factorId });
    }
    setMfaEnrollment(null);
    setMfaCode("");
    setMfaStatus("");
    setMfaSetupStep(null);
  }

  async function requestCompanyVerification() {
    if (!supabase || !user || !profile || profile.account_type !== "company") return;
    if (profile.company_verified_at || companyVerifySaving) return;

    setCompanyVerifySaving(true);
    setCompanyVerifyStatus("Lähetetään pyyntöä...");

    const requestedAt = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ company_verification_requested_at: requestedAt })
      .eq("id", user.id);

    if (error) {
      setCompanyVerifyStatus(getErrorMessage(error));
      setCompanyVerifySaving(false);
      return;
    }

    const { data } = await getProfile(user.id);
    if (data) {
      setProfile(data);
      writeCachedResource(`profile:${user.id}`, data);
    }
    setCompanyVerifyStatus("Vahvistuspyyntö lähetetty. Käsittelyaika on yleensä 0-2 päivää.");
    setCompanyVerifySaving(false);
    window.setTimeout(() => {
      setCompanyVerifyModalOpen(false);
      setCompanyVerifyStatus("");
    }, 1800);
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
      await createCompanySeller(profile.id, {
        ...sellerDraft,
        phone: normalizePhoneNumber(sellerDraft.phone)
      });
    if (error || !data) {
      setSellerStatus(getPhoneDatabaseErrorMessage(error));
      return;
    }
    setCompanySellers((current) => [...current, data]);
    setSellerDraft({ name: "", phone: "" });
    setSellerAddOpen(false);
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
    if (phoneChangeLocked) {
      setPhoneStatus(phoneChangeLockText);
      return;
    }
    setPhoneDraft(profile.phone ?? "");
    setPhoneStatus("");
    setPhoneEditing(true);
  }

  async function saveProfilePhone() {
    if (!supabase || !user || !profile) return;

    const nextPhone = normalizePhoneNumber(phoneDraft);
    if (!nextPhone) {
      setPhoneStatus("Syota puhelinnumero.");
      return;
    }
    if (nextPhone === normalizePhoneNumber(profile.phone ?? "")) {
      setPhoneEditing(false);
      setPhoneStatus("");
      return;
    }
    if (phoneChangeLocked) {
      setPhoneStatus(phoneChangeLockText);
      return;
    }

    setPhoneSaving(true);
    setPhoneStatus("Tallennetaan numeroa...");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setPhoneStatus("Kirjautuminen ei ole voimassa. Kirjaudu uudelleen.");
      setPhoneSaving(false);
      return;
    }

    const response = await fetch("/api/profiles/phone", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ phone: nextPhone })
    }).catch(() => null);

    if (!response) {
      setPhoneStatus("Verkkovirhe. Tarkista yhteys ja yritä uudelleen.");
      setPhoneSaving(false);
      return;
    }

    const result = await response.json().catch(() => ({})) as {
      data?: UserProfile;
      error?: string;
    };
    const updatedProfile = result.data ?? null;

    if (!response.ok || !updatedProfile) {
      setPhoneStatus(result.error || "Puhelinnumeron tallennus epäonnistui.");
      setPhoneSaving(false);
      return;
    }

    setProfile(updatedProfile);
    writeCachedResource(`profile:${user.id}`, updatedProfile);
    setPhoneEditing(false);
    setPhoneStatus("");
    setPhoneSaving(false);
  }

  function cancelPhoneEdit() {
    setPhoneDraft(profile?.phone ?? "");
    setPhoneStatus("");
    setPhoneEditing(false);
  }

  async function getCurrentAccessToken() {
    if (!supabase) return null;

    const { data } =
      await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }

  function openDeleteModal() {
    setDeleteModalOpen(true);
    setDeleteFinalConfirm(false);
    setDeleteStatus("");
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setDeleteFinalConfirm(false);
    setDeleteStatus("");
  }

  async function confirmAccountDeletion() {
    if (!profile || !supabase) return;

    if (!deleteFinalConfirm) {
      setDeleteFinalConfirm(true);
      setDeleteStatus("");
      return;
    }

    const confirmed =
      Boolean(
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
    // Do not let an older profile request overwrite this avatar mutation.
    profileLoadGenerationRef.current += 1;
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
    if (error) {
      setStatus(getErrorMessage(error) || t.imageUploadFailed);
      return;
    }
    if (url) {
      const renderedAvatarUrl = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
      setAvatarUrl(renderedAvatarUrl);
      if (profile) {
        const nextProfile = { ...profile, avatar_url: url };
        setProfile(nextProfile);
        writeCachedResource(`profile:${user.id}`, nextProfile);
      }
      setStatus(t.avatarUpdated);
      resetAvatarCrop();
      setTimeout(() => setStatus(""), 3000);
    }
  }

  async function handleRemoveAvatar(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (!user || !supabase) return;

    // Invalidate any profile response that started before the removal.
    profileLoadGenerationRef.current += 1;

    setAvatarUploading(true);
    setStatus("");

    const { error } = await updateProfileAvatar(null);

    setAvatarUploading(false);

    if (error) {
      setStatus(getErrorMessage(error));
      return;
    }

    setAvatarUrl(null);
    if (profile) {
      const nextProfile = { ...profile, avatar_url: null };
      setProfile(nextProfile);
      writeCachedResource(`profile:${user.id}`, nextProfile);
    }
    dispatchProfileAvatarChanged(user.id, null);

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

  const companyWebsiteHref =
    formatWebsiteHref(profile?.company_website);

  const profileCompletionItems = profile
    ? [
        { label: "Sähköposti lisätty", complete: Boolean(profile.email) },
        { label: "Puhelinnumero lisätty", complete: Boolean(profile.phone) },
        { label: "Profiilikuva lisätty", complete: Boolean(avatarUrl) },
        { label: "Julkinen esittely täytetty", complete: Boolean(profile.bio?.trim()) },
        { label: "Osoitetiedot lisätty", complete: Boolean(profile.address && profile.postal_code && profile.city) },
        ...(profile.account_type === "company"
          ? [
              { label: "Yrityksen nimi lisätty", complete: Boolean(profile.company_name) },
              { label: "Y-tunnus lisätty", complete: Boolean(profile.business_id) },
              { label: "Laskutussähköposti lisätty", complete: Boolean(profile.billing_email) },
              { label: "Verkkosivu lisätty", complete: Boolean(profile.company_website) },
            ]
          : [
              { label: "Nimitiedot lisätty", complete: Boolean(profile.first_name && profile.last_name) },
            ]),
      ]
    : [];

  const profileCompletion = profileCompletionItems.length
    ? Math.round(
        (profileCompletionItems.filter((item) => item.complete).length /
          profileCompletionItems.length) *
          100
      )
    : 0;

  return (
    <main className="pf-page">

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
                  ? (profile.company_name || profile.full_name || `${profile.first_name} ${profile.last_name}`.trim())
                  : "—"}
              </div>
              {profile && (
                <div className="pf-company-badge">
                  {profile.account_type === "company" ? profileText.companyAccount : "Käyttäjä"}
                </div>
              )}
              <div className="pf-avatar-actions">
                <button
                  type="button"
                  className="pf-avatar-action"
                  disabled={avatarUploading}
                  onClick={(event) => {
                    event.stopPropagation();
                    avatarInputRef.current?.click();
                  }}
                >
                  <Camera size={13} />
                  {avatarUrl ? profileText.editProfilePhoto : profileText.addPhoto}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    className="pf-avatar-action danger"
                    disabled={avatarUploading}
                    onClick={handleRemoveAvatar}
                  >
                    {profileText.remove}
                  </button>
                )}
              </div>
            </div>
            <div className="pf-sidebar-progress">
              <div>
                <span>Profiilin täyttöaste</span>
                <strong>{profileCompletion}%</strong>
              </div>
              <span className="pf-sidebar-progress-track">
                <span style={{ width: `${profileCompletion}%` }} />
              </span>
            </div>
          </div>
          <nav className="pf-nav">
            <a href={profile?.account_type === "company" ? "#yritys" : "#tiedot"} className="pf-nav-item pf-nav-active">
              <Building2 size={19} />
              {profile?.account_type === "company" ? profileText.companyDetails : profileText.profileDetails}
            </a>
            {profile?.account_type === "company" && (
              <a href="#myyjat" className="pf-nav-item">
                <Users size={19} />
                {profileText.companySellersTitle}
              </a>
            )}
            <Link
              href={user ? profilePath(user.id, profile?.company_name || profile?.full_name || `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(), locale) : "/"}
              className="pf-nav-item"
              target="_blank"
            >
              <Globe size={19} />
              {profileText.publicProfile}
              <ExternalLink size={13} className="pf-nav-external" />
            </Link>
            <a href="#osoite" className="pf-nav-item">
              <Home size={19} />
              {profileText.addressDetails}
            </a>
            <a href="#tilin-turvallisuus" className="pf-nav-item">
              <ShieldCheck size={19} />
              {profileText.accountSecurity}
            </a>
            {profile && (
              <button
                type="button"
                className="pf-nav-item pf-nav-danger pf-nav-button"
                onClick={openDeleteModal}
              >
                <Trash2 size={19} />
                Poista tili
              </button>
            )}
            {user && (
              <button
                type="button"
                className="pf-nav-item pf-nav-button pf-logout-button"
                onClick={async () => {
                  await supabase?.auth.signOut({ scope: "local" });
                  router.replace("/");
                }}
              >
                <LogOut size={19} />
                Kirjaudu ulos
              </button>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <div className="pf-content">
          {listingProfileNotice && (
            <div className="pf-login-prompt" role="alert">
              <Info size={22} />
              <span>{listingProfileNotice}</span>
            </div>
          )}
          {profile && (
            <div className="pf-profile-heading">
              <h1>
                {profile.account_type === "company"
                  ? "Yritysprofiili"
                  : "Yksityisprofiili"}
              </h1>
            </div>
          )}

          {!user && (
            <div className="pf-login-prompt">
              <LockKeyhole size={22} />
              <span>{profileText.loginToViewProfile}</span>
              <Link href={authPagePath}>{t.login}</Link>
            </div>
          )}

          {user && !profile && (
            <div className="pf-login-prompt">
              <LockKeyhole size={22} />
              <span>{profileText.profileNotCompleted}</span>
              <Link href={authPagePath}>{profileText.completeProfile}</Link>
            </div>
          )}

          {profile && (
            <form className="pf-form" onSubmit={handleSubmit}>

              {/* Section: Private */}
              {profile.account_type === "private" && (
              <section className="pf-section pf-info-card pf-aligned-section" id="tiedot">
                <div className="pf-info-card-head">
                  <div className="pf-info-title">
                    <span className="pf-info-title-icon">
                      <Lock size={18} />
                    </span>
                    <div>
                      <h2>{profileText.privateDetails}</h2>
                      <p>{profileText.accountHelp}</p>
                    </div>
                  </div>
                </div>
                <div className="pf-info-rows pf-card-body">
                  {profile.account_type === "private" && (
                    <>
                      <div className="pf-info-row">
                        <span className="pf-info-row-icon">
                          <UserCircle size={20} />
                        </span>
                        <span className="pf-info-label">{profileText.firstName}</span>
                        <div className="pf-info-value">
                          <input disabled value={profile.first_name} />
                        </div>
                      </div>
                      <div className="pf-info-row">
                        <span className="pf-info-row-icon">
                          <UserCircle size={20} />
                        </span>
                        <span className="pf-info-label">{profileText.lastName}</span>
                        <div className="pf-info-value">
                          <input disabled value={profile.last_name} />
                        </div>
                      </div>
                    </>
                  )}
                  {profile.account_type === "private" && (
                    <div className="pf-info-row pf-phone-info-row">
                      <span className="pf-info-row-icon">
                        <Phone size={19} />
                      </span>
                      <span className="pf-info-label">{profileText.phone}</span>
                      <div className="pf-info-value pf-info-phone-value">
                      <div className="pf-phone-row">
                        <div className="pf-phone-card">
                          <span className="pf-phone-number">
                            {profile.phone || profileText.noNumber}
                          </span>
                        </div>
                        <div className="pf-phone-actions">
                          <button
                            type="button"
                            className="pf-inline-btn pf-phone-change-btn"
                            disabled={phoneChangeLocked}
                            onClick={startPhoneEdit}
                            title={phoneChangeLocked ? phoneChangeLockText : phoneActionTitle}
                          >
                            {phoneActionLabel}
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
              )}

              {profile.account_type === "company" && (
                <section className="pf-section pf-company-section pf-info-card pf-aligned-section" id="yritys">
                  <div className="pf-info-card-head">
                    <div className="pf-info-title">
                      <span className="pf-info-title-icon">
                        <Building2 size={18} />
                      </span>
                      <div>
                        <h2>{profileText.companyDetails}</h2>
                        <p>{profileText.companyDetailsHelp}</p>
                      </div>
                    </div>
                  </div>
                  <div className="pf-info-rows pf-card-body">
                    <div className="pf-info-row pf-phone-info-row">
                      <span className="pf-info-row-icon">
                        <UserCircle size={20} />
                      </span>
                      <span className="pf-info-label">{profileText.companyName}</span>
                      <div className="pf-info-value">
                      <input
                        disabled={Boolean(profile.company_name)}
                        value={profile.company_name ?? ""}
                        onChange={e => setProfile({ ...profile, company_name: e.target.value })}
                      />
                      </div>
                    </div>
                    <div className="pf-info-row">
                      <span className="pf-info-row-icon">
                        <FileText size={19} />
                      </span>
                      <span className="pf-info-label">{profileText.businessId}</span>
                      <div className="pf-info-value">
                      <input
                        disabled={Boolean(profile.business_id)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={profile.business_id ?? ""}
                        onChange={e => setProfile({ ...profile, business_id: e.target.value.replace(/\D/g, "") })}
                      />
                      </div>
                    </div>
                    <div className="pf-info-row">
                      <span className="pf-info-row-icon">
                        <Mail size={19} />
                      </span>
                      <span className="pf-info-label">{profileText.billingEmail}</span>
                      <div className="pf-info-value">
                      <input
                        type="email"
                        value={profile.billing_email ?? ""}
                        onChange={e => setProfile({ ...profile, billing_email: e.target.value })}
                      />
                      </div>
                    </div>
                    <div className="pf-info-row">
                      <span className="pf-info-row-icon">
                        <Phone size={19} />
                      </span>
                      <span className="pf-info-label">{profileText.companyPhone}</span>
                      <div className="pf-info-value pf-info-phone-value">
                      <div className="pf-phone-row">
                        <div className="pf-phone-card">
                          <span className="pf-phone-number">
                            {profile.phone || profileText.noNumber}
                          </span>
                        </div>
                        <div className="pf-phone-actions">
                          <button
                            type="button"
                            className="pf-inline-btn pf-phone-change-btn"
                            disabled={phoneChangeLocked}
                            onClick={startPhoneEdit}
                            title={phoneChangeLocked ? phoneChangeLockText : phoneActionTitle}
                          >
                            {phoneActionLabel}
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                    <div className="pf-info-row">
                      <span className="pf-info-row-icon">
                        <Globe size={19} />
                      </span>
                      <span className="pf-info-label">{profileText.website}</span>
                      <div className="pf-info-value pf-info-website-value">
                        <input
                          value={profile.company_website ?? ""}
                          onChange={e => setProfile({ ...profile, company_website: e.target.value })}
                          placeholder="https://yritys.fi"
                        />
                        {companyWebsiteHref && (
                          <a
                            aria-label={`${profileText.website}: ${companyWebsiteHref}`}
                            className="pf-website-link"
                            href={companyWebsiteHref}
                            rel="noopener noreferrer"
                            target="_blank"
                            title={companyWebsiteHref}
                          >
                            <ExternalLink size={13} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {profile.account_type === "company" && (
                <section className="pf-section pf-company-sellers-section pf-aligned-section" id="myyjat">
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

                  <div className="company-seller-list pf-card-body">
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
                              type="tel"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={sellerEditDraft.phone}
                              onChange={(event) => setSellerEditDraft({ ...sellerEditDraft, phone: sanitizePhoneInput(event.target.value) })}
                              placeholder="358401234567"
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

                  <div className={`company-seller-add pf-card-body${sellerAddOpen ? " is-open" : ""}`}>
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
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={sellerDraft.phone}
                          disabled={companySellers.length >= 8}
                          onChange={(event) => setSellerDraft({ ...sellerDraft, phone: sanitizePhoneInput(event.target.value) })}
                          placeholder="358401234567"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="company-seller-add-btn"
                      disabled={companySellers.length >= 8}
                      onClick={() => {
                        if (!sellerAddOpen) {
                          setSellerAddOpen(true);
                          return;
                        }
                        handleAddCompanySeller();
                      }}
                    >
                      <Plus size={16} />
                      {profileText.addSeller}
                    </button>
                  </div>

                  <div className="company-seller-footer pf-card-body">
                    <span>{companySellers.length} / 8 {profileText.sellers.toLocaleLowerCase(locale)}</span>
                    {sellerStatus && <strong>{sellerStatus}</strong>}
                  </div>
                </section>
              )}

              {/* Section: Public */}
              <section className="pf-section pf-public-profile-section pf-aligned-section" id="julkinen-profiili">
                <div className="pf-section-head">
                  <Globe size={17} />
                  <div>
                    <h2>{profileText.publicProfile}</h2>
                    <p>{profileText.publicHelp}</p>
                  </div>
                </div>
                <div className="pf-fields pf-public-fields pf-card-body">
                  <div className="pf-field pf-public-name-field">
                    <span className="pf-field-icon">
                      <UserCircle size={16} />
                    </span>
                    <label>{profileText.publicName}</label>
                    <div className="pf-locked">
                      <input disabled value={
                        (
                          profile.account_type === "company"
                            ? profile.company_name || profile.full_name || ""
                            : profile.full_name ?? `${profile.first_name} ${profile.last_name}`.trim()
                        ) || "Ei asetettu"
                      } />
                      <Lock size={13} className="pf-lock-icon" />
                    </div>
                  </div>
                  <div className="pf-field pf-public-id-field">
                    <span className="pf-field-icon">
                      <Hash size={16} />
                    </span>
                    <label>UID</label>
                    <div className="pf-readonly-value">
                      <Hash size={16} />
                      <span>{profile.public_id || profileText.noId}</span>
                    </div>
                  </div>
                  {profile.account_type === "company" && (
                    <div className="pf-field pf-field-wide pf-public-address-field">
                      <span className="pf-field-icon">
                        <MapPin size={16} />
                      </span>
                      <label>{profileText.publicAddress}</label>
                      <input
                        value={profile.public_address ?? ""}
                        onChange={e => setProfile({ ...profile, public_address: e.target.value })}
                        placeholder={profileText.publicAddressPlaceholder}
                      />
                    </div>
                  )}
                  <div className="pf-field pf-field-wide pf-public-bio-field">
                    <span className="pf-field-icon">
                      <Info size={16} />
                    </span>
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
                <div className="pf-public-note">
                  <ShieldCheck size={20} />
                  <span>{profileText.publicVisibilityNote}</span>
                  <Link href={user ? profilePath(user.id, profile?.company_name || profile?.full_name || `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(), locale) : "/"} className="pf-public-note-link">
                    {profileText.moreInfo}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </section>

              {/* Section: Address */}
              <section className="pf-section pf-aligned-section" id="osoite">
                <div className="pf-section-head">
                  <Home size={17} />
                  <div>
                    <h2>Osoitetiedot</h2>
                    <p>Hallitse osoitetietojasi.</p>
                  </div>
                </div>
                <div className="pf-info-rows pf-address-rows pf-card-body">
                  <div className="pf-info-row">
                    <span className="pf-info-row-icon">
                      <Map size={16} />
                    </span>
                    <span className="pf-info-label">{profileText.address}</span>
                    <div className="pf-info-value">
                      <input
                        ref={addressInputRef}
                        autoComplete="street-address"
                        name="street-address"
                        value={profile.address ?? ""}
                        onChange={e => setProfile({ ...profile, address: e.target.value })}
                        placeholder="Aloita kirjoittamalla osoite"
                      />
                    </div>
                  </div>
                  <div className="pf-info-row">
                    <span className="pf-info-row-icon">
                      <Hash size={16} />
                    </span>
                    <span className="pf-info-label">{profileText.postalCode}</span>
                    <div className="pf-info-value">
                      <input
                        autoComplete="postal-code"
                        name="postal-code"
                        value={profile.postal_code ?? ""}
                        onChange={e => setProfile({ ...profile, postal_code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="pf-info-row">
                    <span className="pf-info-row-icon">
                      <Building2 size={16} />
                    </span>
                    <span className="pf-info-label">{profileText.city}</span>
                    <div className="pf-info-value">
                      <input
                        autoComplete="address-level2"
                        name="address-level2"
                        value={profile.city ?? ""}
                        onChange={e => setProfile({ ...profile, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="pf-info-row pf-country-info-row">
                    <span className="pf-info-row-icon">
                      <Globe size={16} />
                    </span>
                    <span className="pf-info-label">{profileText.country}</span>
                    <div className="pf-info-value">
                      <input
                        className="pf-country-input"
                        autoComplete="country-name"
                        name="country-name"
                        value={profile.country ?? ""}
                        onChange={(event) => setProfile({ ...profile, country: event.target.value })}
                        placeholder={profileText.country}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="pf-section pf-security-section pf-aligned-section" id="tilin-turvallisuus">
                <div className="pf-section-head">
                  <ShieldCheck size={17} />
                  <div>
                    <h2>{profileText.accountSecurity}</h2>
                    <p>{profileText.passwordHelp}</p>
                  </div>
                </div>
                <div className="pf-info-rows pf-card-body">
                  <div className="pf-info-row">
                    <span className="pf-info-row-icon">
                      <Mail size={16} />
                    </span>
                    <span className="pf-info-label">{profileText.passwordEmail}</span>
                    <div className="pf-info-value">
                      <span>{profile.email}</span>
                    </div>
                  </div>
                  <div className="pf-info-row pf-security-action-row">
                    <span className="pf-info-row-icon">
                      <LockKeyhole size={16} />
                    </span>
                    <span className="pf-info-label">{profileText.sendPasswordLink}</span>
                    <div className="pf-info-value pf-security-action-value">
                      <button
                        type="button"
                        className="pf-inline-btn verify pf-password-reset-btn"
                        disabled={passwordSending}
                        onClick={handlePasswordReset}
                      >
                        {passwordSending ? profileText.passwordLinkSending : profileText.sendPasswordLink}
                      </button>
                      {passwordStatus && (
                        <span className="pf-security-status" role="status" aria-live="polite">
                          {passwordStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pf-info-row pf-security-action-row pf-mfa-row">
                    <span className="pf-info-row-icon">
                      <KeyRound size={16} />
                    </span>
                    <span className="pf-info-label">Kaksivaiheinen tunnistus</span>
                    <div className="pf-info-value pf-security-action-value pf-mfa-value">
                      <span className={`pf-mfa-state${mfaMethod ? " is-enabled" : ""}`}>
                        {mfaMethod === "totp"
                          ? "Authenticator käytössä"
                          : mfaMethod === "email"
                            ? "Sähköpostikoodi käytössä"
                            : "Ei käytössä"}
                      </span>
                      <button
                        type="button"
                        className="pf-inline-btn verify pf-mfa-manage-btn"
                        onClick={() => {
                          setMfaStatus("");
                          setMfaSetupStep("choose");
                        }}
                      >
                        {mfaMethod ? "Hallitse" : "Ota käyttöön"}
                      </button>
                    </div>
                  </div>
                  {profile.account_type === "company" && (
                    <div className="pf-info-row pf-security-action-row pf-company-verify-row">
                      <span className="pf-info-row-icon">
                        <ShieldCheck size={16} />
                      </span>
                      <span className="pf-info-label">Yrityksen vahvistus</span>
                      <div className="pf-info-value pf-security-action-value">
                        {profile.company_verified_at ? (
                          <span className="pf-company-verify-ok">Vahvistettu yritys</span>
                        ) : profile.company_verification_requested_at ? (
                          <span className="pf-company-verify-pending">Odottaa käsittelyä</span>
                        ) : (
                          <button
                            type="button"
                            className="pf-inline-btn verify pf-company-verify-btn"
                            onClick={() => {
                              setCompanyVerifyStatus("");
                              setCompanyVerifyModalOpen(true);
                            }}
                          >
                            Vahvista yritys
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Save bar */}
              <div className="pf-save-bar">
                <button type="submit" className="pf-save-btn">
                  <Check size={16} />
                  {profileText.saveChanges}
                </button>
                {profile.updated_at && (
                  <span className="pf-last-updated">
                    Viimeksi päivitetty {formatProfileUpdatedAt(profile.updated_at)}
                  </span>
                )}
                {status && <span className="pf-status">{status}</span>}
              </div>

            </form>
          )}
        </div>

      </div>

      {companyVerifyModalOpen && profile?.account_type === "company" && (
        <div
          className="pf-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !companyVerifySaving) {
              setCompanyVerifyModalOpen(false);
              setCompanyVerifyStatus("");
            }
          }}
        >
          <div
            className="pf-phone-modal pf-company-verify-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-verify-title"
          >
            <button
              type="button"
              className="pf-modal-close"
              disabled={companyVerifySaving}
              onClick={() => {
                setCompanyVerifyModalOpen(false);
                setCompanyVerifyStatus("");
              }}
            >
              ×
            </button>
            <div className="pf-modal-icon">
              <ShieldCheck size={23} />
            </div>
            <h2 id="company-verify-title">Vahvista yritystili</h2>
            <p>
              Lähetä yrityksesi tiedot tarkistettavaksi. Käsittelyaika on yleensä
              0-2 päivää. Kun admin hyväksyy pyynnön, profiilissasi näkyy vihreä
              Vahvistettu yritys -merkintä.
            </p>
            <div className="pf-company-verify-summary">
              <span>{profile.company_name || "Yritys"}</span>
              <strong>{profile.business_id || "Y-tunnus puuttuu"}</strong>
            </div>
            <div className="pf-phone-actions pf-company-verify-actions">
              <button
                type="button"
                className="pf-inline-btn secondary"
                disabled={companyVerifySaving}
                onClick={() => {
                  setCompanyVerifyModalOpen(false);
                  setCompanyVerifyStatus("");
                }}
              >
                Peruuta
              </button>
              <button
                type="button"
                className="pf-inline-btn verify"
                disabled={companyVerifySaving || !profile.business_id}
                onClick={requestCompanyVerification}
              >
                {companyVerifySaving ? "Lähetetään..." : "Lähetä pyyntö"}
              </button>
            </div>
            {companyVerifyStatus && (
              <span className="pf-modal-note">{companyVerifyStatus}</span>
            )}
          </div>
        </div>
      )}

      {passwordChangeStep && (
        <div
          className="pf-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePasswordChange();
          }}
        >
          <div
            className="pf-phone-modal pf-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-change-title"
          >
            <button
              type="button"
              className="pf-modal-close"
              disabled={passwordSending}
              onClick={closePasswordChange}
              aria-label="Sulje"
            >
              ×
            </button>
            <div className="pf-modal-icon">
              {passwordChangeStep === "code" ? <Mail size={23} /> : <LockKeyhole size={23} />}
            </div>

            {passwordChangeStep === "code" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyPasswordCode();
                }}
              >
                <h2 id="password-change-title">Syötä sähköpostiin lähetetty koodi</h2>
                <p>
                  Lähetimme kuusinumeroisen vahvistuskoodin osoitteeseen <strong>{user?.email || profile?.email}</strong>.
                </p>
                <label className="pf-password-field">
                  <span>Vahvistuskoodi</span>
                  <input
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={passwordCode}
                    onChange={(event) => setPasswordCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                  />
                </label>
                <div className="pf-password-actions">
                  <button type="button" className="pf-inline-btn secondary" onClick={() => void handlePasswordReset()} disabled={passwordSending}>
                    Lähetä uusi koodi
                  </button>
                  <button type="submit" className="pf-inline-btn verify" disabled={passwordSending || passwordCode.length !== 6}>
                    {passwordSending ? "Vahvistetaan..." : "Jatka"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveNewPassword();
                }}
              >
                <h2 id="password-change-title">Kirjoita uusi salasana</h2>
                <p>Kirjoita uusi salasana kaksi kertaa. Salasanassa pitää olla vähintään 8 merkkiä.</p>
                <label className="pf-password-field">
                  <span>Uusi salasana</span>
                  <div className="pf-password-input-wrap">
                    <input
                      autoFocus
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="pf-password-visibility"
                      onClick={() => setShowNewPassword((visible) => !visible)}
                      aria-label={showNewPassword ? "Piilota uusi salasana" : "Näytä uusi salasana"}
                      aria-pressed={showNewPassword}
                    >
                      {showNewPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </label>
                <label className="pf-password-field">
                  <span>Uusi salasana uudelleen</span>
                  <div className="pf-password-input-wrap">
                    <input
                      type={showConfirmNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      className="pf-password-visibility"
                      onClick={() => setShowConfirmNewPassword((visible) => !visible)}
                      aria-label={showConfirmNewPassword ? "Piilota uusi salasana uudelleen" : "Näytä uusi salasana uudelleen"}
                      aria-pressed={showConfirmNewPassword}
                    >
                      {showConfirmNewPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </label>
                <div className="pf-password-actions">
                  <button type="button" className="pf-inline-btn secondary" onClick={closePasswordChange} disabled={passwordSending}>
                    Peruuta
                  </button>
                  <button type="submit" className="pf-inline-btn verify" disabled={passwordSending || newPassword.length < 8 || confirmNewPassword.length < 8}>
                    {passwordSending ? "Tallennetaan..." : "Tallenna salasana"}
                  </button>
                </div>
              </form>
            )}

            {passwordStatus && <span className="pf-phone-status" role="status">{passwordStatus}</span>}
          </div>
        </div>
      )}

      {mfaSetupStep && (
        <div
          className="pf-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !mfaSaving) {
              void closeMfaSetup();
            }
          }}
        >
          <div
            className="pf-phone-modal pf-mfa-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mfa-setup-title"
          >
            <button
              type="button"
              className="pf-modal-close"
              disabled={mfaSaving}
              onClick={() => void closeMfaSetup()}
              aria-label="Sulje"
            >
              ×
            </button>

            {mfaSetupStep === "choose" ? (
              <>
                <div className="pf-modal-icon"><ShieldCheck size={23} /></div>
                <h2 id="mfa-setup-title">Kaksivaiheinen tunnistus</h2>
                <p>
                  Valitse kirjautumisen toinen vahvistustapa. Toiminto on vapaaehtoinen
                  ja sen voi poistaa käytöstä milloin tahansa.
                </p>
                <div className="pf-mfa-options">
                  <button type="button" onClick={() => void beginTotpEnrollment()} disabled={mfaSaving}>
                    <span className="pf-mfa-option-icon"><QrCode size={25} /></span>
                    <span>
                      <strong>Authenticator-sovellus</strong>
                      <small>Skannaa QR-koodi Google Authenticatorilla tai vastaavalla sovelluksella.</small>
                    </span>
                    <ArrowRight className="pf-mfa-option-arrow" size={18} />
                  </button>
                  <button type="button" onClick={() => void enableEmailMfa()} disabled={mfaSaving}>
                    <span className="pf-mfa-option-icon"><Mail size={25} /></span>
                    <span>
                      <strong>Sähköpostikoodi</strong>
                      <small>Saat kuusinumeroisen koodin sähköpostiisi jokaisella kirjautumiskerralla.</small>
                    </span>
                    <ArrowRight className="pf-mfa-option-arrow" size={18} />
                  </button>
                </div>
                {mfaMethod && (
                  <button
                    type="button"
                    className="pf-mfa-disable"
                    onClick={() => void disableMfa()}
                    disabled={mfaSaving}
                  >
                    Poista kaksivaiheinen tunnistus käytöstä
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="pf-modal-icon"><QrCode size={23} /></div>
                <h2 id="mfa-setup-title">Yhdistä Authenticator</h2>
                <p>Skannaa QR-koodi ja anna sovelluksen näyttämä kuusinumeroinen koodi.</p>
                {mfaEnrollment && (
                  <>
                    <div className="pf-mfa-qr">
                      <img src={mfaEnrollment.qrCode} alt="Authenticator QR-koodi" />
                    </div>
                    <div className="pf-mfa-secret">
                      <span>Manuaalinen avain</span>
                      <code>{mfaEnrollment.secret}</code>
                    </div>
                    <label className="pf-mfa-code-field">
                      <span>Vahvistuskoodi</span>
                      <input
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={6}
                        pattern="[0-9]*"
                        value={mfaCode}
                        onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                      />
                    </label>
                    <div className="pf-avatar-crop-actions">
                      <button type="button" className="pf-inline-btn secondary" onClick={() => void closeMfaSetup()} disabled={mfaSaving}>
                        Peruuta
                      </button>
                      <button type="button" className="pf-inline-btn verify" onClick={() => void verifyTotpEnrollment()} disabled={mfaSaving || mfaCode.length !== 6}>
                        {mfaSaving ? "Vahvistetaan..." : "Vahvista ja ota käyttöön"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {mfaStatus && <span className="pf-phone-status">{mfaStatus}</span>}
          </div>
        </div>
      )}

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
              <Phone size={22} />
            </div>
            <h2 id="phone-verification-title">
              {hasPhoneNumber ? "Vaihda puhelinnumero" : "Lisää puhelinnumero"}
            </h2>
            <p>
              Puhelinnumero tallennetaan profiiliisi ilman SMS-vahvistusta.
            </p>
            <div className="pf-phone-edit">
              <input
                ref={phoneInputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={phoneDraft}
                onChange={(event) =>
                  setPhoneDraft(sanitizePhoneInput(event.target.value))
                }
                placeholder="358401234567"
              />
              <button
                type="button"
                className="pf-inline-btn"
                disabled={phoneSaving}
                onClick={saveProfilePhone}
              >
                Tallenna
              </button>
              <button
                type="button"
                className="pf-inline-btn secondary"
                disabled={phoneSaving}
                onClick={cancelPhoneEdit}
              >
                Peruuta
              </button>
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
            className={`pf-phone-modal pf-delete-modal${deleteFinalConfirm ? " pf-delete-modal-final" : ""}`}
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
              {deleteFinalConfirm ? "Poistetaanko tili pysyvästi?" : "Tilin poistaminen"}
            </h2>
            <p>
              Tämä poistaa tilin pysyvästi. Kysymme vielä viimeisen varmistuksen
              ennen kuin poisto tehdään.
            </p>
            {deleteFinalConfirm && (
              <p className="pf-delete-final-copy">
                Tätä toimintoa ei voi perua. Tilisi, profiilisi ja kirjautumisoikeutesi poistetaan.
              </p>
            )}
            <span className="pf-delete-email">
              {profile.email}
            </span>
            {deleteFinalConfirm && (
              <div className="pf-delete-warning-list">
                <span>Puhelinnumero varataan 3 kuukaudeksi.</span>
                <span>Poiston jälkeen tiliä ei voi palauttaa.</span>
              </div>
            )}
            <div className="pf-delete-modal-actions">
              <button
                type="button"
                className="pf-delete-btn"
                disabled={deleteLoading}
                onClick={confirmAccountDeletion}
              >
                {deleteLoading
                  ? "Poistetaan..."
                  : deleteFinalConfirm
                    ? "Kyllä, poista pysyvästi"
                    : "Jatka poistoon"}
              </button>
              <button
                type="button"
                className="pf-inline-btn secondary"
                disabled={deleteLoading}
                onClick={() => {
                  if (deleteFinalConfirm) {
                    setDeleteFinalConfirm(false);
                    setDeleteStatus("");
                    return;
                  }
                  closeDeleteModal();
                }}
              >
                {deleteFinalConfirm ? "Takaisin" : "Peruuta"}
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
          aria-label={profileText.editProfilePhoto}
        >
          <div className="pf-phone-modal pf-avatar-crop-modal">
            <button
              type="button"
              className="pf-modal-close"
              onClick={resetAvatarCrop}
              disabled={avatarUploading}
              aria-label={profileText.close}
            >
              ×
            </button>
            <h2>{profileText.editProfilePhoto}</h2>
            <p>{profileText.avatarCropHelp}</p>
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
                {profileText.cancel}
              </button>
              <button
                type="button"
                className="pf-inline-btn verify"
                onClick={saveCroppedAvatar}
                disabled={avatarUploading}
              >
                {avatarUploading ? profileText.saving : profileText.savePhoto}
              </button>
            </div>
            {status && (
              <p className="pf-phone-status" role="status" aria-live="polite">
                {status}
              </p>
            )}
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

        .pf-password-modal {
          max-width: 500px;
        }

        .pf-password-field {
          display: grid;
          gap: 7px;
          margin: 0 0 14px;
        }

        .pf-password-field > span {
          color: #334155;
          font-size: 12px;
          font-weight: 850;
        }

        .pf-password-field input {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          color: #0f172a;
          font: inherit;
          min-height: 48px;
          padding: 0 13px;
          width: 100%;
        }

        .pf-password-input-wrap {
          position: relative;
        }

        .pf-password-input-wrap input {
          padding-right: 48px;
        }

        .pf-password-visibility {
          align-items: center;
          background: transparent;
          border: 0;
          color: #64748b;
          cursor: pointer;
          display: flex;
          height: 40px;
          justify-content: center;
          padding: 0;
          position: absolute;
          right: 5px;
          top: 50%;
          transform: translateY(-50%);
          width: 40px;
        }

        .pf-password-visibility:hover,
        .pf-password-visibility:focus-visible {
          color: #ff8a24;
          outline: none;
        }

        .pf-password-field input:focus {
          border-color: #ff8a24;
          box-shadow: 0 0 0 3px rgba(255, 138, 36, 0.16);
          outline: none;
        }

        .pf-password-modal form:first-of-type .pf-password-field input {
          font-size: 23px;
          font-weight: 950;
          letter-spacing: 0.28em;
          text-align: center;
        }

        .pf-password-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 18px;
        }

        @media (max-width: 520px) {
          .pf-password-actions {
            align-items: stretch;
            flex-direction: column-reverse;
          }

          .pf-password-actions .pf-inline-btn {
            width: 100%;
          }
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

        /* Final image-matched profile layout. Kept inside the page style so it wins last. */
        .pf-page {
          background: #112027 !important;
          color: #ffffff !important;
          overflow-x: hidden !important;
          padding: 10px 0 28px !important;
        }

        .pf-page,
        .pf-page * {
          box-sizing: border-box !important;
        }

        .pf-layout {
          display: block !important;
          margin: 0 auto !important;
          max-width: 1220px !important;
          padding: 0 14px !important;
          width: 100% !important;
        }

        .pf-sidebar,
        .pf-profile-heading,
        .pf-public-note,
        .pf-phone-help,
        .pf-lock-icon,
        .pf-readonly-value > svg {
          display: none !important;
        }

        .pf-content {
          margin: 0 !important;
          max-width: none !important;
          padding: 0 !important;
          width: 100% !important;
        }

        .pf-form {
          display: grid !important;
          gap: 14px !important;
          grid-template-columns: 1fr !important;
          width: 100% !important;
        }

        .pf-form > :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-save-bar) {
          grid-column: 1 / -1 !important;
          width: 100% !important;
        }

        .pf-section,
        .pf-info-card,
        .pf-public-profile-section {
          background:
            radial-gradient(760px 260px at 12% 0%, rgba(31, 124, 195, 0.14), transparent 72%),
            linear-gradient(180deg, rgba(5, 27, 49, 0.99), rgba(3, 18, 33, 0.99)) !important;
          border: 1px solid rgba(67, 139, 198, 0.58) !important;
          border-radius: 7px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
          overflow: hidden !important;
          padding: 0 !important;
        }

        .pf-info-card-head,
        .pf-section-head {
          align-items: center !important;
          border: 0 !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 56px minmax(0, 1fr) auto !important;
          min-height: 100px !important;
          padding: 18px 24px 10px !important;
        }

        .pf-info-title {
          align-items: center !important;
          display: grid !important;
          gap: 16px !important;
          grid-column: 1 / 3 !important;
          grid-template-columns: 56px minmax(0, 1fr) !important;
          min-width: 0 !important;
        }

        .pf-info-title-icon,
        .pf-section-head > svg {
          align-items: center !important;
          background: rgba(255, 122, 26, 0.07) !important;
          border: 1px solid rgba(255, 138, 31, 0.7) !important;
          border-radius: 16px !important;
          color: #ff8a1f !important;
          display: inline-flex !important;
          height: 62px !important;
          justify-content: center !important;
          padding: 15px !important;
          width: 62px !important;
        }

        #julkinen-profiili .pf-section-head > svg {
          background: rgba(37, 160, 255, 0.12) !important;
          border-color: rgba(70, 184, 255, 0.72) !important;
          color: #38b9ff !important;
        }

        .pf-info-card-head h2,
        .pf-section-head h2 {
          color: #ffffff !important;
          font-size: 22px !important;
          font-weight: 950 !important;
          line-height: 1.08 !important;
          margin: 0 0 6px !important;
          overflow-wrap: anywhere !important;
        }

        .pf-info-card-head p,
        .pf-section-head p {
          color: rgba(216, 232, 244, 0.7) !important;
          font-size: 13px !important;
          font-weight: 800 !important;
          line-height: 1.25 !important;
          margin: 0 !important;
          overflow-wrap: anywhere !important;
        }

        .pf-info-edit-btn,
        .pf-manage-btn {
          align-items: center !important;
          background: rgba(4, 17, 31, 0.72) !important;
          border: 1px solid rgba(105, 156, 200, 0.42) !important;
          border-radius: 7px !important;
          box-shadow: none !important;
          color: #ffffff !important;
          display: inline-flex !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          gap: 9px !important;
          grid-column: 3 !important;
          justify-content: center !important;
          justify-self: end !important;
          min-height: 46px !important;
          min-width: 136px !important;
          padding: 0 18px !important;
          white-space: nowrap !important;
        }

        .pf-info-edit-btn svg,
        .pf-manage-btn svg {
          color: #ff8a1f !important;
          height: 16px !important;
          width: 16px !important;
        }

        .pf-info-rows,
        #julkinen-profiili .pf-public-fields,
        #osoite .pf-fields {
          background: rgba(2, 15, 29, 0.36) !important;
          border: 1px solid rgba(96, 148, 192, 0.28) !important;
          border-radius: 7px !important;
          display: grid !important;
          gap: 0 !important;
          grid-template-columns: 1fr !important;
          margin: 0 24px 22px !important;
          overflow: hidden !important;
          padding: 14px 16px !important;
        }

        .pf-info-row,
        #julkinen-profiili .pf-field,
        #julkinen-profiili .pf-field.pf-field-wide,
        #osoite .pf-field,
        #osoite .pf-field:last-child {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(96, 148, 192, 0.2) !important;
          display: grid !important;
          gap: 18px !important;
          grid-column: 1 / -1 !important;
          grid-template-columns: 48px minmax(170px, 0.24fr) minmax(0, 1fr) !important;
          min-height: 64px !important;
          min-width: 0 !important;
          padding: 8px 0 !important;
          width: 100% !important;
        }

        .pf-info-row:last-child,
        #julkinen-profiili .pf-field:last-child,
        #osoite .pf-field:last-child {
          border-bottom: 0 !important;
        }

        #julkinen-profiili .pf-field::before,
        #osoite .pf-field::before {
          content: none !important;
          display: none !important;
        }

        .pf-info-row-icon,
        .pf-field-icon {
          align-items: center !important;
          align-self: center !important;
          background: rgba(33, 88, 130, 0.5) !important;
          border: 1px solid rgba(120, 158, 195, 0.28) !important;
          border-radius: 8px !important;
          color: rgba(215, 233, 247, 0.9) !important;
          display: inline-flex !important;
          grid-column: 1 !important;
          height: 42px !important;
          justify-content: center !important;
          min-width: 42px !important;
          width: 42px !important;
        }

        .pf-info-row-icon svg,
        .pf-field-icon svg {
          height: 20px !important;
          width: 20px !important;
        }

        .pf-info-label,
        .pf-field label {
          color: rgba(207, 222, 235, 0.76) !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          grid-column: 2 !important;
          line-height: 1.2 !important;
          min-width: 0 !important;
          overflow-wrap: anywhere !important;
        }

        .pf-info-value,
        #julkinen-profiili .pf-locked,
        #julkinen-profiili .pf-readonly-value,
        #julkinen-profiili input,
        #julkinen-profiili textarea,
        #osoite :is(input, select) {
          grid-column: 3 !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        .pf-info-value :is(input, select),
        .pf-info-value :is(input, select):disabled,
        .pf-info-value > span,
        .pf-phone-number,
        #julkinen-profiili .pf-locked input,
        #julkinen-profiili .pf-locked input:disabled,
        #julkinen-profiili .pf-readonly-value,
        #julkinen-profiili .pf-readonly-value span,
        #julkinen-profiili input,
        #julkinen-profiili textarea,
        #osoite :is(input, select) {
          background: rgba(9, 30, 52, 0.88) !important;
          border: 1px solid rgba(91, 141, 184, 0.36) !important;
          border-radius: 6px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
          color: #ffffff !important;
          display: block !important;
          font-size: 16px !important;
          font-weight: 850 !important;
          line-height: 1.25 !important;
          min-height: 48px !important;
          min-width: 0 !important;
          overflow: hidden !important;
          padding: 12px 16px !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          width: 100% !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        #julkinen-profiili .pf-readonly-value {
          align-items: center !important;
          display: flex !important;
        }

        .pf-country-input {
          background: rgba(9, 30, 52, 0.88) !important;
          border: 1px solid rgba(126, 197, 240, 0.42) !important;
          border-radius: 6px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 10px 24px rgba(0, 7, 18, 0.16) !important;
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          height: 42px !important;
          line-height: 1 !important;
          padding: 0 12px !important;
          width: min(100%, 260px) !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .pf-country-input:focus {
          border-color: rgba(255, 138, 34, 0.86) !important;
          box-shadow:
            0 0 0 3px rgba(255, 138, 34, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
          outline: none !important;
        }

        @media (max-width: 760px) {
          .pf-country-input {
            height: 40px !important;
            font-size: 14px !important;
            width: 100% !important;
          }
        }

        #julkinen-profiili textarea {
          height: 48px !important;
          min-height: 48px !important;
          resize: vertical !important;
          white-space: normal !important;
        }

        .pf-phone-row {
          align-items: center !important;
          display: grid !important;
          gap: 10px !important;
          grid-template-columns: minmax(0, 1fr) auto minmax(210px, 0.35fr) !important;
          width: 100% !important;
        }

        .pf-phone-card {
          display: contents !important;
        }

        .pf-verified,
        .pf-unverified,
        .pf-locked-badge {
          align-self: center !important;
          border-radius: 6px !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          min-height: 32px !important;
          padding: 8px 12px !important;
          white-space: nowrap !important;
        }

        .pf-phone-actions {
          display: grid !important;
          gap: 8px !important;
          grid-auto-flow: column !important;
          grid-auto-columns: minmax(180px, 1fr) !important;
          min-width: 0 !important;
        }

        .pf-inline-btn {
          min-height: 40px !important;
        }

        .pf-save-bar {
          align-items: center !important;
          background:
            radial-gradient(500px 180px at 10% 0%, rgba(31, 124, 195, 0.13), transparent 72%),
            rgba(6, 25, 43, 0.88) !important;
          border: 1px solid rgba(82, 139, 190, 0.5) !important;
          border-radius: 7px !important;
          box-shadow: none !important;
          display: flex !important;
          flex-direction: row !important;
          gap: 22px !important;
          min-height: 82px !important;
          padding: 18px 22px !important;
        }

        .pf-save-btn {
          background: linear-gradient(180deg, #ff9f2e, #ff7418) !important;
          border: 1px solid rgba(255, 210, 165, 0.62) !important;
          border-radius: 7px !important;
          box-shadow: 0 16px 30px rgba(255, 120, 24, 0.24) !important;
          color: #ffffff !important;
          min-height: 52px !important;
          min-width: 240px !important;
          width: auto !important;
        }

        .pf-last-updated {
          color: rgba(207, 222, 235, 0.72) !important;
          font-size: 13px !important;
          font-weight: 800 !important;
        }

        @media (max-width: 760px) {
          .pf-page {
            padding-top: 0 !important;
          }

          .pf-layout {
            padding: 0 10px 24px !important;
          }

          .pf-info-card-head,
          .pf-section-head {
            grid-template-columns: 50px minmax(0, 1fr) !important;
            min-height: 0 !important;
            padding: 16px 14px 10px !important;
          }

          .pf-info-title {
            grid-column: 1 / -1 !important;
            grid-template-columns: 50px minmax(0, 1fr) !important;
          }

          .pf-info-title-icon,
          .pf-section-head > svg {
            border-radius: 13px !important;
            height: 50px !important;
            padding: 12px !important;
            width: 50px !important;
          }

          .pf-info-card-head h2,
          .pf-section-head h2 {
            font-size: 18px !important;
          }

          .pf-info-edit-btn,
          .pf-manage-btn {
            grid-column: 1 / -1 !important;
            justify-self: stretch !important;
            width: 100% !important;
          }

          .pf-info-rows,
          #julkinen-profiili .pf-public-fields,
          #osoite .pf-fields {
            margin: 0 12px 12px !important;
            padding: 10px !important;
          }

          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite .pf-field,
          #osoite .pf-field:last-child {
            gap: 8px 12px !important;
            grid-template-columns: 42px minmax(0, 1fr) !important;
            min-height: 0 !important;
            padding: 10px 0 !important;
          }

          .pf-info-value,
          #julkinen-profiili .pf-locked,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite :is(input, select) {
            grid-column: 1 / -1 !important;
          }

          .pf-phone-row,
          .pf-phone-actions {
            grid-auto-flow: row !important;
            grid-template-columns: 1fr !important;
          }

          .pf-save-bar {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .pf-save-btn {
            min-width: 0 !important;
            width: 100% !important;
          }
        }

        /* Address card hard fix: never use the old multi-column address grid. */
        #osoite.pf-section .pf-fields {
          align-content: stretch !important;
          align-items: stretch !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 0 !important;
          grid-template-columns: none !important;
          width: auto !important;
        }

        #osoite.pf-section .pf-fields > .pf-field,
        #osoite.pf-section .pf-fields > .pf-field:last-child {
          align-items: center !important;
          border-bottom: 1px solid rgba(96, 148, 192, 0.2) !important;
          display: grid !important;
          flex: 0 0 auto !important;
          gap: 18px !important;
          grid-column: auto !important;
          grid-template-columns: 48px minmax(170px, 0.24fr) minmax(0, 1fr) !important;
          max-width: none !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        #osoite.pf-section .pf-fields > .pf-field:last-child {
          border-bottom: 0 !important;
        }

        #osoite.pf-section .pf-field > .pf-field-icon {
          grid-column: 1 !important;
        }

        #osoite.pf-section .pf-field > label {
          grid-column: 2 !important;
        }

        #osoite.pf-section .pf-field > input {
          grid-column: 3 !important;
          max-width: none !important;
          overflow: visible !important;
          text-overflow: clip !important;
          width: 100% !important;
        }

        @media (max-width: 760px) {
          #osoite.pf-section .pf-fields > .pf-field,
          #osoite.pf-section .pf-fields > .pf-field:last-child {
            gap: 8px 12px !important;
            grid-template-columns: 42px minmax(0, 1fr) !important;
          }

          #osoite.pf-section .pf-field > input {
            grid-column: 1 / -1 !important;
          }
        }

        /* Screenshot parity: values are row text, not separate input boxes. */
        .pf-layout {
          margin: 20px auto 0 !important;
          max-width: none !important;
          padding: 0 !important;
          width: min(1350px, calc(100vw - 60px)) !important;
        }

        .pf-form {
          gap: 18px !important;
        }

        .pf-section,
        .pf-info-card,
        .pf-public-profile-section {
          border-color: rgba(67, 139, 198, 0.56) !important;
          border-radius: 8px !important;
        }

        .pf-info-card-head,
        .pf-section-head {
          gap: 18px !important;
          grid-template-columns: 62px minmax(0, 1fr) auto !important;
          min-height: 92px !important;
          padding: 18px 22px 10px !important;
        }

        .pf-info-title {
          gap: 18px !important;
          grid-template-columns: 62px minmax(0, 1fr) !important;
        }

        .pf-info-title-icon,
        .pf-section-head > svg {
          border-radius: 16px !important;
          height: 58px !important;
          padding: 14px !important;
          width: 58px !important;
        }

        .pf-info-card-head h2,
        .pf-section-head h2 {
          font-size: 19px !important;
          letter-spacing: 0 !important;
          line-height: 1.08 !important;
          margin-bottom: 7px !important;
        }

        .pf-info-card-head p,
        .pf-section-head p {
          font-size: 12px !important;
          line-height: 1.25 !important;
        }

        .pf-info-edit-btn,
        .pf-manage-btn {
          border-radius: 7px !important;
          font-size: 13px !important;
          min-height: 43px !important;
          min-width: 126px !important;
          padding: 0 18px !important;
        }

        .pf-info-rows,
        #julkinen-profiili .pf-public-fields,
        #osoite.pf-section .pf-fields {
          background: rgba(2, 15, 29, 0.22) !important;
          border-color: rgba(96, 148, 192, 0.3) !important;
          border-radius: 7px !important;
          margin: 0 22px 21px !important;
          overflow: hidden !important;
          padding: 0 !important;
        }

        .pf-info-row,
        #julkinen-profiili .pf-field,
        #julkinen-profiili .pf-field.pf-field-wide,
        #osoite.pf-section .pf-fields > .pf-field,
        #osoite.pf-section .pf-fields > .pf-field:last-child {
          border-bottom: 1px solid rgba(96, 148, 192, 0.23) !important;
          gap: 20px !important;
          grid-template-columns: 52px minmax(220px, 310px) minmax(0, 1fr) !important;
          min-height: 55px !important;
          padding: 0 11px !important;
        }

        .pf-info-row:last-child,
        #julkinen-profiili .pf-field:last-child,
        #osoite.pf-section .pf-fields > .pf-field:last-child {
          border-bottom: 0 !important;
        }

        .pf-info-row-icon,
        .pf-field-icon {
          border-radius: 8px !important;
          height: 42px !important;
          min-width: 42px !important;
          width: 42px !important;
        }

        .pf-info-label,
        .pf-field label {
          font-size: 13px !important;
          line-height: 1.2 !important;
        }

        .pf-info-value,
        #julkinen-profiili .pf-locked,
        #julkinen-profiili .pf-readonly-value,
        #julkinen-profiili input,
        #julkinen-profiili textarea,
        #osoite.pf-section .pf-field > input {
          align-items: center !important;
          display: flex !important;
          grid-column: 3 !important;
          min-height: 0 !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        .pf-info-value :is(input, select),
        .pf-info-value :is(input, select):disabled,
        .pf-info-value > span,
        .pf-phone-number,
        #julkinen-profiili .pf-locked input,
        #julkinen-profiili .pf-locked input:disabled,
        #julkinen-profiili .pf-readonly-value,
        #julkinen-profiili .pf-readonly-value span,
        #julkinen-profiili input,
        #julkinen-profiili textarea,
        #osoite.pf-section .pf-field > input {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: #ffffff !important;
          display: block !important;
          font-size: 15px !important;
          font-weight: 950 !important;
          line-height: 1.25 !important;
          min-height: 0 !important;
          outline: none !important;
          overflow: hidden !important;
          padding: 0 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          width: 100% !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        #julkinen-profiili textarea {
          height: 22px !important;
          min-height: 22px !important;
          resize: none !important;
          white-space: nowrap !important;
        }

        #julkinen-profiili input:focus,
        #julkinen-profiili textarea:focus,
        #osoite.pf-section .pf-field > input:focus {
          background: rgba(9, 30, 52, 0.72) !important;
          border: 1px solid rgba(91, 141, 184, 0.38) !important;
          border-radius: 5px !important;
          margin: -8px -10px !important;
          padding: 8px 10px !important;
        }

        .pf-info-phone-value {
          display: block !important;
        }

        .pf-phone-row {
          align-items: center !important;
          display: grid !important;
          gap: 12px !important;
          grid-template-columns: max-content max-content minmax(270px, 0.38fr) !important;
          width: 100% !important;
        }

        .pf-phone-number {
          width: auto !important;
        }

        .pf-verified,
        .pf-unverified,
        .pf-locked-badge {
          align-items: center !important;
          display: inline-flex !important;
          font-size: 11px !important;
          min-height: 28px !important;
          padding: 6px 12px !important;
        }

        .pf-phone-actions {
          display: grid !important;
          gap: 8px !important;
          grid-auto-flow: column !important;
          grid-auto-columns: minmax(270px, 1fr) !important;
        }

        .pf-inline-btn {
          min-height: 30px !important;
        }

        .pf-save-bar {
          min-height: 72px !important;
          padding: 12px 21px !important;
        }

        .pf-save-btn {
          min-height: 46px !important;
          min-width: 210px !important;
        }

        @media (max-width: 760px) {
          .pf-layout {
            margin-top: 10px !important;
            width: calc(100vw - 20px) !important;
          }

          .pf-info-card-head,
          .pf-section-head {
            grid-template-columns: 50px minmax(0, 1fr) !important;
            min-height: 0 !important;
          }

          .pf-info-title {
            grid-template-columns: 50px minmax(0, 1fr) !important;
          }

          .pf-info-rows,
          #julkinen-profiili .pf-public-fields,
          #osoite.pf-section .pf-fields {
            margin: 0 12px 12px !important;
          }

          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite.pf-section .pf-fields > .pf-field,
          #osoite.pf-section .pf-fields > .pf-field:last-child {
            grid-template-columns: 42px minmax(0, 1fr) !important;
            min-height: 0 !important;
            padding: 10px !important;
          }

          .pf-info-value,
          #julkinen-profiili .pf-locked,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite.pf-section .pf-field > input {
            grid-column: 1 / -1 !important;
          }

          .pf-phone-row,
          .pf-phone-actions {
            grid-auto-flow: row !important;
            grid-template-columns: 1fr !important;
          }
        }

        /* Runtime-final profile view: this wins after the client-side style tag mounts. */
        .pf-page {
          background:
            radial-gradient(980px 460px at 62% 0%, rgba(20, 93, 147, 0.16), transparent 68%),
            linear-gradient(180deg, #06131f 0%, #071522 48%, #07131d 100%) !important;
          color: #f4f8fc !important;
          min-height: 100dvh !important;
          overflow-x: hidden !important;
          padding: 0 !important;
        }

        .pf-page .pf-layout {
          box-sizing: border-box !important;
          align-items: start !important;
          display: grid !important;
          gap: 18px !important;
          grid-template-columns: 260px minmax(0, 1fr) !important;
          margin: 0 auto !important;
          max-width: none !important;
          padding: 20px 30px 28px !important;
          width: min(100%, 1460px) !important;
        }

        .pf-page .pf-profile-heading,
        .pf-page .pf-public-note,
        .pf-page .pf-phone-help,
        .pf-page .pf-lock-icon,
        .pf-page .pf-readonly-value > svg {
          display: none !important;
        }

        .pf-page .pf-sidebar {
          align-self: start !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 14px !important;
          min-width: 0 !important;
          position: sticky !important;
          top: 18px !important;
          width: 100% !important;
        }

        .pf-page .pf-user-card,
        .pf-page .pf-nav {
          background:
            radial-gradient(360px 160px at 10% 0%, rgba(33, 125, 197, 0.16), transparent 72%),
            rgba(5, 28, 51, 0.96) !important;
          border: 1px solid rgba(61, 133, 193, 0.72) !important;
          border-radius: 8px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }

        .pf-page .pf-user-card {
          align-items: center !important;
          display: flex !important;
          flex: 0 0 auto !important;
          gap: 12px !important;
          min-width: 0 !important;
          padding: 15px !important;
          width: 100% !important;
        }

        .pf-page .pf-user-card > div:not(.pf-avatar) {
          flex: 1 1 auto !important;
          min-width: 0 !important;
        }

        .pf-page .pf-avatar {
          align-items: center !important;
          background:
            radial-gradient(circle at 30% 20%, rgba(88, 199, 255, 0.55), transparent 45%),
            linear-gradient(135deg, rgba(15, 75, 123, 0.98), rgba(3, 18, 33, 0.98)) !important;
          border: 1px solid rgba(70, 184, 255, 0.62) !important;
          border-radius: 999px !important;
          color: #ffffff !important;
          display: flex !important;
          flex: 0 0 auto !important;
          height: 58px !important;
          justify-content: center !important;
          overflow: visible !important;
          position: relative !important;
          width: 58px !important;
        }

        .pf-page .pf-avatar > img,
        .pf-page .pf-avatar > .profile-avatar-initial {
          border-radius: 999px !important;
          height: 100% !important;
          width: 100% !important;
        }

        .pf-page .pf-avatar > img {
          display: block !important;
          object-fit: cover !important;
          overflow: hidden !important;
        }

        .pf-page .pf-avatar > .profile-avatar-initial {
          align-items: center !important;
          display: flex !important;
          font-size: 21px !important;
          font-weight: 950 !important;
          justify-content: center !important;
        }

        .pf-page .pf-avatar-overlay {
          align-items: center !important;
          background: rgba(0, 0, 0, 0.5) !important;
          border-radius: 999px !important;
          color: #ffffff !important;
          display: flex !important;
          inset: 0 !important;
          justify-content: center !important;
          opacity: 0 !important;
          position: absolute !important;
          transition: opacity 0.15s ease !important;
        }

        .pf-page .pf-avatar-upload:hover .pf-avatar-overlay,
        .pf-page .pf-avatar-loading .pf-avatar-overlay {
          opacity: 1 !important;
        }

        .pf-page .pf-avatar-remove {
          align-items: center !important;
          background: linear-gradient(135deg, #ff9a24, #ff6b16) !important;
          border: 2px solid rgba(255, 255, 255, 0.94) !important;
          border-radius: 999px !important;
          box-shadow: 0 8px 18px rgba(255, 122, 26, 0.32), 0 0 0 2px rgba(8, 20, 34, 0.95) !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: flex !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          height: 20px !important;
          justify-content: center !important;
          line-height: 1 !important;
          padding: 0 !important;
          position: absolute !important;
          right: -7px !important;
          top: -7px !important;
          width: 20px !important;
          z-index: 3 !important;
        }

        .pf-page .pf-user-name {
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 950 !important;
          line-height: 1.2 !important;
          max-width: 150px !important;
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .pf-page .pf-company-badge {
          color: rgba(216, 232, 244, 0.72) !important;
          font-size: 11px !important;
          font-weight: 850 !important;
          margin-top: 4px !important;
        }

        .pf-page .pf-nav {
          display: grid !important;
          flex: 0 0 auto !important;
          width: 100% !important;
        }

        .pf-page .pf-nav-item {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(96, 148, 192, 0.2) !important;
          border-left: 3px solid transparent !important;
          box-sizing: border-box !important;
          color: rgba(207, 222, 235, 0.78) !important;
          display: flex !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          gap: 10px !important;
          min-height: 48px !important;
          padding: 0 14px !important;
          text-align: left !important;
          text-decoration: none !important;
          width: 100% !important;
        }

        .pf-page .pf-nav-item:last-child {
          border-bottom: 0 !important;
        }

        .pf-page .pf-nav-item:hover,
        .pf-page .pf-nav-active {
          background: rgba(255, 122, 26, 0.1) !important;
          border-left-color: #ff8a1f !important;
          color: #ffffff !important;
        }

        .pf-page .pf-nav-item svg {
          color: currentColor !important;
          flex: 0 0 auto !important;
        }

        .pf-page .pf-nav-external {
          margin-left: auto !important;
          opacity: 0.72 !important;
        }

        .pf-page .pf-nav-danger {
          color: #ffb39f !important;
        }

        .pf-page .pf-nav-danger:hover {
          background: rgba(239, 68, 68, 0.12) !important;
          border-left-color: #ff7a66 !important;
          color: #ffd0c6 !important;
        }

        .pf-page .pf-content {
          margin: 0 !important;
          max-width: none !important;
          min-width: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }

        .pf-page .pf-form,
        .pf-page .pf-form:has(.pf-company-sellers-section) {
          align-items: stretch !important;
          display: grid !important;
          gap: 18px !important;
          grid-template-columns: 1fr !important;
          width: 100% !important;
        }

        .pf-page :is(#tiedot, #yritys, #julkinen-profiili, #osoite, .pf-company-sellers-section, .pf-save-bar) {
          grid-column: 1 / -1 !important;
          width: 100% !important;
        }

        .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section) {
          background:
            radial-gradient(760px 280px at 8% 0%, rgba(33, 125, 197, 0.16), transparent 74%),
            linear-gradient(180deg, rgba(5, 28, 51, 0.98), rgba(3, 18, 33, 0.99)) !important;
          border: 1px solid rgba(61, 133, 193, 0.78) !important;
          border-radius: 8px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }

        .pf-page :is(.pf-info-card-head, .pf-section-head) {
          align-items: center !important;
          border: 0 !important;
          display: grid !important;
          gap: 20px !important;
          grid-template-columns: 58px minmax(0, 1fr) auto !important;
          min-height: 91px !important;
          padding: 18px 22px 10px !important;
        }

        .pf-page .pf-info-title {
          align-items: center !important;
          display: grid !important;
          gap: 20px !important;
          grid-column: 1 / 3 !important;
          grid-template-columns: 58px minmax(0, 1fr) !important;
          min-width: 0 !important;
        }

        .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          align-items: center !important;
          background: rgba(255, 122, 26, 0.07) !important;
          border: 1px solid rgba(255, 138, 31, 0.76) !important;
          border-radius: 18px !important;
          box-sizing: border-box !important;
          color: #ff8a1f !important;
          display: inline-flex !important;
          height: 58px !important;
          justify-content: center !important;
          padding: 14px !important;
          width: 58px !important;
        }

        .pf-page #julkinen-profiili .pf-section-head > svg {
          background: rgba(37, 160, 255, 0.12) !important;
          border-color: rgba(70, 184, 255, 0.76) !important;
          color: #38b9ff !important;
        }

        .pf-page :is(.pf-info-card-head h2, .pf-section-head h2) {
          color: #ffffff !important;
          font-size: 20px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          line-height: 1.08 !important;
          margin: 0 0 7px !important;
          overflow-wrap: anywhere !important;
        }

        .pf-page :is(.pf-info-card-head p, .pf-section-head p) {
          color: rgba(216, 232, 244, 0.72) !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          line-height: 1.25 !important;
          margin: 0 !important;
          overflow-wrap: anywhere !important;
        }

        .pf-page :is(.pf-info-edit-btn, .pf-manage-btn) {
          align-items: center !important;
          background: rgba(4, 17, 31, 0.72) !important;
          border: 1px solid rgba(105, 156, 200, 0.44) !important;
          border-radius: 7px !important;
          color: #ffffff !important;
          display: inline-flex !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          gap: 8px !important;
          grid-column: 3 !important;
          justify-content: center !important;
          justify-self: end !important;
          min-height: 43px !important;
          min-width: 126px !important;
          padding: 0 18px !important;
          white-space: nowrap !important;
        }

        .pf-page :is(.pf-info-edit-btn, .pf-manage-btn) svg {
          color: #ff8a1f !important;
          height: 15px !important;
          width: 15px !important;
        }

        .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-fields) {
          background: rgba(2, 15, 29, 0.24) !important;
          border: 1px solid rgba(96, 148, 192, 0.32) !important;
          border-radius: 7px !important;
          display: grid !important;
          gap: 0 !important;
          grid-template-columns: 1fr !important;
          margin: 0 22px 21px !important;
          overflow: hidden !important;
          padding: 0 !important;
        }

        .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide, #osoite .pf-field, #osoite .pf-field:last-child) {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(96, 148, 192, 0.24) !important;
          display: grid !important;
          gap: 20px !important;
          grid-column: 1 / -1 !important;
          grid-template-columns: 52px minmax(220px, 310px) minmax(0, 1fr) !important;
          min-height: 56px !important;
          min-width: 0 !important;
          padding: 0 11px !important;
          width: 100% !important;
        }

        .pf-page :is(.pf-info-row:last-child, #julkinen-profiili .pf-field:last-child, #osoite .pf-field:last-child) {
          border-bottom: 0 !important;
        }

        .pf-page #julkinen-profiili .pf-field::before,
        .pf-page #osoite .pf-field::before {
          content: none !important;
          display: none !important;
        }

        .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          align-items: center !important;
          align-self: center !important;
          background: rgba(33, 88, 130, 0.5) !important;
          border: 1px solid rgba(120, 158, 195, 0.28) !important;
          border-radius: 8px !important;
          box-sizing: border-box !important;
          color: rgba(215, 233, 247, 0.9) !important;
          display: inline-flex !important;
          grid-column: 1 !important;
          height: 42px !important;
          justify-content: center !important;
          min-width: 42px !important;
          width: 42px !important;
        }

        .pf-page :is(.pf-info-row-icon, .pf-field-icon) svg {
          height: 20px !important;
          width: 20px !important;
        }

        .pf-page :is(.pf-info-label, .pf-field label) {
          color: rgba(207, 222, 235, 0.76) !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          grid-column: 2 !important;
          letter-spacing: 0 !important;
          line-height: 1.2 !important;
          min-width: 0 !important;
          overflow-wrap: anywhere !important;
          text-transform: none !important;
        }

        .pf-page :is(.pf-info-value, #julkinen-profiili .pf-locked, #julkinen-profiili .pf-readonly-value, #julkinen-profiili input, #julkinen-profiili textarea, #osoite input, #osoite select) {
          align-items: center !important;
          display: flex !important;
          grid-column: 3 !important;
          min-height: 0 !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        .pf-page :is(
          .pf-info-value :is(input, select),
          .pf-info-value :is(input, select):disabled,
          .pf-info-value > span,
          .pf-phone-number,
          #julkinen-profiili .pf-locked input,
          #julkinen-profiili .pf-locked input:disabled,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili .pf-readonly-value span,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite :is(input, select)
        ) {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          box-sizing: border-box !important;
          color: #ffffff !important;
          display: block !important;
          font-size: 15px !important;
          font-weight: 950 !important;
          line-height: 1.25 !important;
          min-height: 0 !important;
          min-width: 0 !important;
          opacity: 1 !important;
          outline: none !important;
          overflow: hidden !important;
          padding: 0 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          width: 100% !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .pf-page #julkinen-profiili textarea {
          height: 22px !important;
          min-height: 22px !important;
          resize: none !important;
          white-space: nowrap !important;
        }

        .pf-page :is(#julkinen-profiili input:focus, #julkinen-profiili textarea:focus, #osoite input:focus, #osoite select:focus, .pf-info-value input:focus, .pf-info-value select:focus) {
          background: rgba(9, 30, 52, 0.74) !important;
          border: 1px solid rgba(91, 141, 184, 0.42) !important;
          border-radius: 5px !important;
          margin: -8px -10px !important;
          padding: 8px 10px !important;
        }

        .pf-page .pf-info-phone-value {
          display: block !important;
        }

        .pf-page .pf-phone-row {
          align-items: center !important;
          display: grid !important;
          gap: 12px !important;
          grid-template-columns: max-content max-content minmax(270px, 0.38fr) !important;
          width: 100% !important;
        }

        .pf-page .pf-phone-card {
          display: contents !important;
        }

        .pf-page .pf-phone-number {
          width: auto !important;
        }

        .pf-page :is(.pf-verified, .pf-unverified, .pf-locked-badge) {
          align-items: center !important;
          align-self: center !important;
          border-radius: 6px !important;
          display: inline-flex !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          justify-content: center !important;
          min-height: 28px !important;
          padding: 6px 12px !important;
          white-space: nowrap !important;
        }

        .pf-page .pf-verified {
          background: rgba(34, 197, 94, 0.18) !important;
          border: 1px solid rgba(34, 197, 94, 0.44) !important;
          color: #4ade80 !important;
        }

        .pf-page .pf-unverified,
        .pf-page .pf-locked-badge {
          background: rgba(255, 122, 26, 0.1) !important;
          border: 1px solid rgba(255, 122, 26, 0.44) !important;
          color: #ffd2a1 !important;
        }

        .pf-page .pf-phone-actions {
          display: grid !important;
          gap: 8px !important;
          grid-auto-flow: column !important;
          grid-auto-columns: minmax(270px, 1fr) !important;
          min-width: 0 !important;
        }

        .pf-page .pf-inline-btn {
          background: rgba(4, 17, 31, 0.72) !important;
          border: 1px solid rgba(105, 156, 200, 0.44) !important;
          border-radius: 6px !important;
          color: #ffffff !important;
          font-size: 12px !important;
          font-weight: 950 !important;
          min-height: 30px !important;
        }

        .pf-page .pf-inline-btn.verify {
          background: linear-gradient(135deg, #ff9a24, #ff7418) !important;
          border-color: rgba(255, 213, 166, 0.48) !important;
        }

        .pf-page .pf-save-bar {
          align-items: center !important;
          background:
            radial-gradient(500px 180px at 10% 0%, rgba(31, 124, 195, 0.13), transparent 72%),
            rgba(6, 25, 43, 0.88) !important;
          border: 1px solid rgba(82, 139, 190, 0.56) !important;
          border-radius: 7px !important;
          box-shadow: none !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: row !important;
          gap: 22px !important;
          min-height: 72px !important;
          padding: 12px 21px !important;
        }

        .pf-page .pf-save-btn {
          background: linear-gradient(180deg, #ff9f2e, #ff7418) !important;
          border: 1px solid rgba(255, 210, 165, 0.62) !important;
          border-radius: 7px !important;
          box-shadow: 0 16px 30px rgba(255, 120, 24, 0.24) !important;
          color: #ffffff !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          min-height: 46px !important;
          min-width: 210px !important;
          padding: 0 22px !important;
          width: auto !important;
        }

        .pf-page .pf-last-updated,
        .pf-page .pf-status {
          color: rgba(207, 222, 235, 0.72) !important;
          font-size: 13px !important;
          font-weight: 800 !important;
        }

        @media (max-width: 760px) {
          .pf-page .pf-layout {
            gap: 14px !important;
            grid-template-columns: 1fr !important;
            padding: 10px 10px 24px !important;
            width: 100% !important;
          }

          .pf-page .pf-sidebar {
            height: auto !important;
            min-height: 0 !important;
            position: static !important;
          }

          .pf-page .pf-user-card,
          .pf-page .pf-nav {
            flex: 0 0 auto !important;
            height: auto !important;
            min-height: 0 !important;
          }

          .pf-page .pf-user-card {
            min-height: 82px !important;
            padding: 12px !important;
          }

          .pf-page .pf-nav {
            grid-template-columns: 1fr !important;
          }

          .pf-page .pf-nav-item {
            height: auto !important;
            min-height: 52px !important;
          }

          .pf-page :is(.pf-info-card-head, .pf-section-head) {
            grid-template-columns: 50px minmax(0, 1fr) !important;
            min-height: 0 !important;
            padding: 16px 14px 10px !important;
          }

          .pf-page .pf-info-title {
            grid-column: 1 / -1 !important;
            grid-template-columns: 50px minmax(0, 1fr) !important;
          }

          .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
            border-radius: 13px !important;
            height: 50px !important;
            padding: 12px !important;
            width: 50px !important;
          }

          .pf-page :is(.pf-info-edit-btn, .pf-manage-btn) {
            grid-column: 1 / -1 !important;
            justify-self: stretch !important;
            width: 100% !important;
          }

          .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-fields) {
            margin: 0 12px 12px !important;
          }

          .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide, #osoite .pf-field, #osoite .pf-field:last-child) {
            gap: 8px 12px !important;
            grid-template-columns: 42px minmax(0, 1fr) !important;
            min-height: 0 !important;
            padding: 10px !important;
          }

          .pf-page :is(.pf-info-value, #julkinen-profiili .pf-locked, #julkinen-profiili .pf-readonly-value, #julkinen-profiili input, #julkinen-profiili textarea, #osoite input, #osoite select) {
            grid-column: 1 / -1 !important;
          }

          .pf-page .pf-phone-row,
          .pf-page .pf-phone-actions {
            grid-auto-flow: row !important;
            grid-template-columns: 1fr !important;
          }

          .pf-page .pf-save-bar {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .pf-page .pf-save-btn {
            min-width: 0 !important;
            width: 100% !important;
          }
        }

        /* Final own-profile alignment: no header action buttons, equal section titles, values closer left. */
        .pf-page :is(.pf-info-edit-btn, .pf-manage-btn) {
          display: none !important;
        }

        .pf-page :is(.pf-info-card-head, .pf-section-head) {
          gap: 14px !important;
          grid-template-columns: 48px minmax(0, 1fr) auto !important;
          min-height: 74px !important;
          padding: 14px 18px 10px !important;
        }

        .pf-page .pf-info-title {
          gap: 14px !important;
          grid-column: 1 / 3 !important;
          grid-template-columns: 48px minmax(0, 1fr) !important;
        }

        .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          border-radius: 12px !important;
          height: 48px !important;
          padding: 12px !important;
          width: 48px !important;
        }

        .pf-page :is(.pf-info-title > div, .pf-section-head > div) {
          justify-self: start !important;
          text-align: left !important;
        }

        .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-info-rows, #osoite .pf-address-rows) {
          margin: 0 18px 16px !important;
        }

        .pf-page :is(
          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite .pf-info-row,
          #osoite .pf-field,
          #osoite .pf-field:last-child
        ) {
          gap: 20px !important;
          grid-template-columns: 52px minmax(220px, 310px) minmax(0, 1fr) !important;
          padding: 0 8px !important;
        }

        .pf-page :is(.pf-info-label, .pf-field label) {
          justify-self: start !important;
          text-align: left !important;
        }

        .pf-page :is(
          .pf-info-value,
          #julkinen-profiili .pf-locked,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite .pf-info-value,
          #osoite :is(input, select)
        ) {
          justify-content: flex-start !important;
          justify-self: start !important;
          text-align: left !important;
        }

        .pf-page :is(
          .pf-info-value :is(input, select),
          .pf-info-value :is(input, select):disabled,
          .pf-info-value > span,
          .pf-phone-number,
          #julkinen-profiili .pf-locked input,
          #julkinen-profiili .pf-locked input:disabled,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili .pf-readonly-value span,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite :is(input, select)
        ) {
          text-align: left !important;
        }

        @media (max-width: 720px) {
          .pf-page :is(.pf-info-card-head, .pf-section-head) {
            grid-template-columns: 44px minmax(0, 1fr) !important;
            padding: 14px 12px 10px !important;
          }

          .pf-page .pf-info-title {
            grid-column: 1 / -1 !important;
            grid-template-columns: 44px minmax(0, 1fr) !important;
          }

          .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
            height: 44px !important;
            width: 44px !important;
          }

          .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-info-rows, #osoite .pf-address-rows) {
            margin: 0 12px 12px !important;
          }

          .pf-page :is(
            .pf-info-row,
            #julkinen-profiili .pf-field,
            #julkinen-profiili .pf-field.pf-field-wide,
            #osoite .pf-info-row,
            #osoite .pf-field,
            #osoite .pf-field:last-child
          ) {
            grid-template-columns: 36px minmax(0, 1fr) !important;
          }
        }

        .pf-page #julkinen-profiili .pf-public-fields > .pf-field,
        .pf-page #julkinen-profiili .pf-public-fields > .pf-field.pf-field-wide,
        .pf-page #osoite .pf-address-rows > .pf-info-row,
        .pf-page #yritys .pf-info-rows > .pf-info-row,
        .pf-page #tiedot .pf-info-rows > .pf-info-row {
          column-gap: 20px !important;
          grid-template-columns: 52px minmax(220px, 310px) minmax(0, 1fr) !important;
        }

        .pf-page #julkinen-profiili :is(.pf-locked, .pf-readonly-value, input, textarea),
        .pf-page #osoite .pf-info-value,
        .pf-page #yritys .pf-info-value,
        .pf-page #tiedot .pf-info-value {
          grid-column: 3 !important;
          justify-self: stretch !important;
          text-align: left !important;
        }

        .pf-page #julkinen-profiili .pf-public-name-field > .pf-locked,
        .pf-page #julkinen-profiili .pf-public-id-field > .pf-readonly-value,
        .pf-page #julkinen-profiili .pf-public-address-field > input,
        .pf-page #julkinen-profiili .pf-public-bio-field > textarea,
        .pf-page #osoite .pf-info-row > .pf-info-value,
        .pf-page #yritys .pf-info-row > .pf-info-value,
        .pf-page #tiedot .pf-info-row > .pf-info-value {
          grid-column: 3 !important;
          margin-left: 0 !important;
        }

        .pf-page #julkinen-profiili :is(.pf-locked input, .pf-locked input:disabled, .pf-readonly-value, .pf-readonly-value span, input, textarea),
        .pf-page #osoite .pf-info-value :is(input, select, span),
        .pf-page #yritys .pf-info-value :is(input, span),
        .pf-page #tiedot .pf-info-value :is(input, span) {
          padding-left: 0 !important;
          text-align: left !important;
        }

        /* Final profile polish: shared topbar, cleaner avatar, no status dots, left-aligned row values. */
        html body:has(.pf-page) header.universal-app-topbar {
          display: flex !important;
        }

        html body:has(.pf-page) nextjs-portal {
          display: none !important;
        }

        html body .pf-page .pf-sidebar-language {
          display: none !important;
        }

        html body .pf-page .pf-layout {
          gap: 24px !important;
          grid-template-columns: 260px minmax(0, 1fr) !important;
          max-width: 1520px !important;
        }

        html body .pf-page .pf-sidebar {
          grid-template-rows: auto auto 1fr !important;
        }

        html body .pf-page .pf-sidebar::before {
          content: none !important;
          display: none !important;
        }

        html body .pf-page .pf-user-card {
          grid-template-columns: 68px minmax(0, 1fr) !important;
          min-height: 112px !important;
          padding: 16px 12px 18px !important;
        }

        html body .pf-page .pf-avatar,
        html body .pf-page .pf-avatar-upload {
          background:
            radial-gradient(48px 38px at 50% 26%, rgba(95, 207, 255, 0.26), transparent 72%),
            linear-gradient(145deg, rgba(10, 50, 80, 0.98), rgba(2, 16, 30, 0.98)) !important;
          border: 2px solid rgba(96, 190, 235, 0.74) !important;
          box-shadow:
            0 0 0 3px rgba(5, 20, 35, 0.96),
            0 14px 24px rgba(0, 8, 20, 0.3) !important;
          height: 66px !important;
          overflow: hidden !important;
          width: 66px !important;
        }

        html body .pf-page .pf-avatar::before,
        html body .pf-page .pf-avatar::after,
        html body .pf-page .pf-avatar-overlay::before {
          content: none !important;
          display: none !important;
        }

        html body .pf-page .profile-avatar-initial {
          background:
            radial-gradient(circle at 50% 30%, rgba(95, 207, 255, 0.3), transparent 66%),
            linear-gradient(145deg, #0d3658, #061724) !important;
          color: #effaff !important;
        }

        html body .pf-page .pf-avatar-overlay {
          background: rgba(0, 0, 0, 0.5) !important;
          border: 0 !important;
          border-radius: 999px !important;
          bottom: auto !important;
          color: #ffffff !important;
          height: auto !important;
          inset: 0 !important;
          opacity: 0 !important;
          right: auto !important;
          width: auto !important;
        }

        html body .pf-page .pf-avatar-overlay svg {
          display: block !important;
        }

        html body .pf-page .pf-avatar-upload:hover .pf-avatar-overlay,
        html body .pf-page .pf-avatar-loading .pf-avatar-overlay {
          opacity: 1 !important;
        }

        html body .pf-page .pf-avatar-remove {
          display: none !important;
        }

        html body .pf-page .pf-avatar-actions {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          margin-top: 2px !important;
        }

        html body .pf-page .pf-avatar-action {
          align-items: center !important;
          background: rgba(4, 18, 33, 0.72) !important;
          border: 1px solid rgba(105, 156, 200, 0.46) !important;
          border-radius: 6px !important;
          color: #eef8ff !important;
          cursor: pointer !important;
          display: inline-flex !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          gap: 5px !important;
          min-height: 26px !important;
          padding: 0 9px !important;
        }

        html body .pf-page .pf-avatar-action:hover {
          border-color: rgba(123, 196, 244, 0.68) !important;
          color: #ffffff !important;
        }

        html body .pf-page .pf-avatar-action.danger {
          border-color: rgba(255, 123, 93, 0.48) !important;
          color: #ffc9bd !important;
        }

        html body .pf-page .pf-avatar-action:disabled {
          cursor: not-allowed !important;
          opacity: 0.62 !important;
        }

        html body .pf-page .pf-company-sellers-section .company-seller-empty {
          background: rgba(3, 16, 29, 0.34) !important;
          border: 1px solid rgba(107, 154, 195, 0.24) !important;
          border-radius: 7px !important;
          color: rgba(226, 236, 247, 0.86) !important;
          display: flex !important;
          gap: 0 !important;
          min-height: 44px !important;
          padding: 0 14px !important;
        }

        html body .pf-page .pf-company-sellers-section .company-seller-empty::before {
          content: none !important;
          display: none !important;
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          gap: 12px !important;
          grid-template-columns: 44px minmax(0, 1fr) auto !important;
          min-height: 68px !important;
          padding: 14px 16px 10px !important;
        }

        html body .pf-page .pf-info-title {
          gap: 12px !important;
          grid-template-columns: 44px minmax(0, 1fr) !important;
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          border-radius: 11px !important;
          height: 44px !important;
          padding: 10px !important;
          width: 44px !important;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-info-rows, #osoite .pf-address-rows) {
          margin: 0 16px 14px !important;
        }

        html body .pf-page :is(
          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite .pf-info-row,
          #osoite .pf-field,
          #osoite .pf-field:last-child
        ) {
          gap: 12px !important;
          grid-template-columns: 42px 150px minmax(0, 1fr) !important;
          padding: 0 10px !important;
        }

        html body .pf-page :is(.pf-info-label, .pf-field label) {
          grid-column: 2 !important;
          justify-self: start !important;
          text-align: left !important;
        }

        html body .pf-page .pf-info-row > .pf-info-value,
        html body .pf-page #julkinen-profiili .pf-field > :is(.pf-locked, .pf-readonly-value, input, textarea),
        html body .pf-page #osoite .pf-info-row > .pf-info-value,
        html body .pf-page #yritys .pf-info-row > .pf-info-value,
        html body .pf-page #tiedot .pf-info-row > .pf-info-value {
          grid-column: 3 !important;
          justify-content: flex-start !important;
          justify-self: stretch !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
          text-align: left !important;
        }

        html body .pf-page :is(
          .pf-info-value :is(input, select),
          .pf-info-value :is(input, select):disabled,
          .pf-info-value > span,
          .pf-phone-number,
          #julkinen-profiili .pf-locked input,
          #julkinen-profiili .pf-locked input:disabled,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili .pf-readonly-value span,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite :is(input, select)
        ) {
          padding-left: 0 !important;
          text-align: left !important;
        }

        @media (max-width: 720px) {
          html body .pf-page .pf-layout {
            gap: 14px !important;
            grid-template-columns: 1fr !important;
          }

          html body .pf-page :is(
            .pf-info-row,
            #julkinen-profiili .pf-field,
            #julkinen-profiili .pf-field.pf-field-wide,
            #osoite .pf-info-row,
            #osoite .pf-field,
            #osoite .pf-field:last-child
          ) {
            grid-template-columns: 36px minmax(0, 1fr) !important;
          }

          html body .pf-page .pf-info-row > .pf-info-value,
          html body .pf-page #julkinen-profiili .pf-field > :is(.pf-locked, .pf-readonly-value, input, textarea),
          html body .pf-page #osoite .pf-info-row > .pf-info-value,
          html body .pf-page #yritys .pf-info-row > .pf-info-value,
          html body .pf-page #tiedot .pf-info-row > .pf-info-value {
            grid-column: 1 / -1 !important;
          }
        }

        /* Final alignment pass: symmetric cards, tighter text columns and clean account sidebar. */
        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          grid-template-columns: 52px minmax(0, 1fr) auto !important;
          gap: 16px !important;
          min-height: 82px !important;
          padding: 16px 20px 12px !important;
        }

        html body .pf-page .pf-info-title {
          grid-template-columns: 52px minmax(0, 1fr) !important;
          gap: 16px !important;
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          border-radius: 12px !important;
          height: 52px !important;
          padding: 12px !important;
          width: 52px !important;
        }

        html body .pf-page :is(.pf-info-card-head h2, .pf-section-head h2) {
          margin-bottom: 5px !important;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-fields, #osoite .pf-info-rows, #osoite .pf-address-rows) {
          margin: 0 20px 20px !important;
          width: calc(100% - 40px) !important;
        }

        html body .pf-page :is(
          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite .pf-info-row,
          #osoite .pf-field,
          #osoite .pf-field:last-child
        ) {
          gap: 16px !important;
          grid-template-columns: 44px 150px minmax(0, 1fr) !important;
          padding: 0 10px !important;
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          height: 36px !important;
          min-width: 36px !important;
          width: 36px !important;
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) svg {
          height: 17px !important;
          width: 17px !important;
        }

        html body .pf-page :is(.pf-info-label, .pf-field label) {
          justify-self: start !important;
          max-width: 150px !important;
          text-align: left !important;
        }

        html body .pf-page .pf-security-action-value {
          align-items: center !important;
          display: flex !important;
          gap: 12px !important;
        }

        html body .pf-page .pf-password-reset-btn {
          min-width: 150px !important;
        }

        html body .pf-page .pf-security-status {
          color: rgba(207, 222, 235, 0.72) !important;
          font-size: 12px !important;
          font-weight: 850 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        html body .pf-page .pf-avatar-actions,
        html body .pf-page .pf-avatar-actions::before,
        html body .pf-page .pf-company-badge,
        html body .pf-page .pf-company-badge::before {
          border: 0 !important;
          box-shadow: none !important;
          text-decoration: none !important;
        }

        html body .pf-page .pf-avatar-actions {
          padding-top: 0 !important;
        }

        html body .pf-page .company-seller-list,
        html body .pf-page .company-seller-add,
        html body .pf-page .company-seller-footer {
          margin-left: 20px !important;
          margin-right: 20px !important;
          width: calc(100% - 40px) !important;
        }

        html body .pf-page .company-seller-empty {
          justify-content: flex-start !important;
          padding-left: 14px !important;
          text-align: left !important;
        }

        html body .pf-page #osoite .pf-section-head {
          align-items: center !important;
          gap: 16px !important;
          grid-template-columns: 52px minmax(0, 1fr) auto !important;
          justify-content: start !important;
          padding-left: 20px !important;
          padding-right: 20px !important;
          text-align: left !important;
        }

        html body .pf-page #osoite .pf-section-head > svg {
          grid-column: 1 !important;
          justify-self: start !important;
          margin: 0 !important;
        }

        html body .pf-page #osoite .pf-section-head > div {
          grid-column: 2 !important;
          justify-self: start !important;
          margin: 0 !important;
          text-align: left !important;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) .pf-section-head {
          align-items: center !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 52px minmax(0, 1fr) auto !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: 34px !important;
          padding-right: 20px !important;
          text-align: left !important;
          transform: none !important;
          width: 100% !important;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) .pf-section-head > svg {
          grid-column: 1 !important;
          justify-self: start !important;
          margin: 0 !important;
          transform: none !important;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) .pf-section-head > div {
          grid-column: 2 !important;
          justify-self: start !important;
          margin: 0 !important;
          text-align: left !important;
          transform: none !important;
        }

        html body .pf-page :is(#julkinen-profiili .pf-public-fields, #osoite .pf-info-rows, #osoite .pf-address-rows, #tilin-turvallisuus .pf-info-rows) {
          margin-left: 24px !important;
          margin-right: 24px !important;
          width: calc(100% - 48px) !important;
        }

        html body .pf-page :is(#julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide, #osoite .pf-info-row, #tilin-turvallisuus .pf-info-row) {
          gap: 16px !important;
          grid-template-columns: 44px 150px minmax(0, 1fr) !important;
          padding-left: 10px !important;
          padding-right: 10px !important;
        }

        html body .pf-page :is(#osoite .pf-info-row > .pf-info-value, #tilin-turvallisuus .pf-info-row > .pf-info-value) {
          grid-column: 3 !important;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-section-head, .pf-info-rows, .pf-public-fields, .company-seller-list, .company-seller-add, .company-seller-footer) {
          margin-left: 24px !important;
          margin-right: 24px !important;
          width: calc(100% - 48px) !important;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > .pf-section-head {
          margin-bottom: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        html body .pf-page #osoite > .pf-info-rows.pf-address-rows,
        html body .pf-page #osoite > .pf-address-rows,
        html body .pf-page #tilin-turvallisuus > .pf-info-rows,
        html body .pf-page .pf-company-sellers-section > .company-seller-list,
        html body .pf-page .pf-company-sellers-section > .company-seller-add {
          margin-left: 24px !important;
          margin-right: 24px !important;
          max-width: none !important;
          transform: none !important;
          width: calc(100% - 48px) !important;
        }

        html body .pf-page #julkinen-profiili > .pf-fields.pf-public-fields {
          margin-left: 0 !important;
          margin-right: 24px !important;
          max-width: none !important;
          transform: none !important;
          width: calc(100% - 24px) !important;
        }

        html body .pf-page :is(#yritys, #tiedot, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
          align-items: center !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 52px minmax(0, 1fr) auto !important;
          margin: 0 !important;
          padding: 20px 42px 16px !important;
          text-align: left !important;
          transform: none !important;
          width: 100% !important;
        }

        html body .pf-page :is(#yritys, #tiedot) > .pf-info-card-head > .pf-info-title {
          display: grid !important;
          gap: 16px !important;
          grid-column: 1 / 3 !important;
          grid-template-columns: 52px minmax(0, 1fr) !important;
          margin: 0 !important;
          transform: none !important;
        }

        html body .pf-page :is(#yritys, #tiedot) > .pf-info-card-head .pf-info-title-icon,
        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > .pf-section-head > svg {
          grid-column: 1 !important;
          height: 52px !important;
          justify-self: start !important;
          margin: 0 !important;
          min-width: 52px !important;
          transform: none !important;
          width: 52px !important;
        }

        html body .pf-page :is(#yritys, #tiedot) > .pf-info-card-head .pf-info-title > div,
        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > .pf-section-head > div {
          grid-column: 2 !important;
          justify-self: start !important;
          margin: 0 !important;
          min-width: 0 !important;
          text-align: left !important;
          transform: none !important;
        }

        html body .pf-page :is(
          #yritys > .pf-info-rows,
          #tiedot > .pf-info-rows,
          .pf-company-sellers-section > .company-seller-list,
          .pf-company-sellers-section > .company-seller-add,
          #julkinen-profiili > .pf-fields.pf-public-fields,
          #julkinen-profiili > .pf-public-fields,
          #osoite > .pf-info-rows,
          #osoite > .pf-address-rows,
          #tilin-turvallisuus > .pf-info-rows
        ) {
          margin: 0 42px 20px !important;
          max-width: none !important;
          transform: none !important;
          width: calc(100% - 84px) !important;
        }

        html body .pf-page :is(.pf-company-sellers-section > .company-seller-list, .pf-company-sellers-section > .company-seller-add) > * {
          margin-left: 0 !important;
          margin-right: 0 !important;
          width: 100% !important;
        }

        html body .pf-page :is(#yritys, #tiedot, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
          margin-left: 66px !important;
          margin-right: 66px !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          width: calc(100% - 132px) !important;
        }

        html body .pf-page :is(
          #yritys > .pf-info-rows,
          #tiedot > .pf-info-rows,
          .pf-company-sellers-section > .company-seller-list,
          .pf-company-sellers-section > .company-seller-add,
          #julkinen-profiili > .pf-fields.pf-public-fields,
          #julkinen-profiili > .pf-public-fields,
          #osoite > .pf-info-rows,
          #osoite > .pf-address-rows,
          #tilin-turvallisuus > .pf-info-rows
        ) {
          margin-left: 66px !important;
          margin-right: 66px !important;
          width: calc(100% - 132px) !important;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) {
          --pf-card-inset: 66px;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 20px var(--pf-card-inset) 16px !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-rows, .pf-public-fields, .pf-fields.pf-public-fields, .pf-address-rows, .company-seller-list, .company-seller-add) {
          box-sizing: border-box !important;
          margin: 0 var(--pf-card-inset) 20px !important;
          max-width: none !important;
          transform: none !important;
          width: auto !important;
        }

        html body .pf-page .pf-company-sellers-section > .company-seller-list > *,
        html body .pf-page .pf-company-sellers-section > .company-seller-add {
          box-sizing: border-box !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-rows, .pf-public-fields, .pf-fields.pf-public-fields, .pf-address-rows, .company-seller-list, .company-seller-add) {
          box-sizing: border-box !important;
          margin: 0 90px 20px !important;
          max-width: none !important;
          transform: none !important;
          width: calc(100% - 180px) !important;
        }

        html body .pf-page .pf-company-sellers-section > .company-seller-list > *,
        html body .pf-page .pf-company-sellers-section > .company-seller-add {
          box-sizing: border-box !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 20px 90px 16px !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot) > .pf-info-card-head > .pf-info-title,
        html body .pf-page .pf-form > :is(#myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > .pf-section-head {
          align-items: center !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 52px minmax(0, 1fr) auto !important;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-rows, .pf-public-fields, .pf-fields.pf-public-fields, .pf-address-rows, .company-seller-list, .company-seller-add) {
          box-sizing: border-box !important;
          margin: 0 90px 20px !important;
          max-width: none !important;
          transform: none !important;
          width: calc(100% - 180px) !important;
        }

        html body .pf-page .pf-company-verify-ok {
          color: #4ade80 !important;
          -webkit-text-fill-color: #4ade80 !important;
          font-weight: 950 !important;
        }

        html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-company-verify-ok,
        html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-info-value > span.pf-company-verify-ok {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: #4ade80 !important;
          -webkit-text-fill-color: #4ade80 !important;
          padding: 0 !important;
          text-shadow: none !important;
        }

        html body .pf-page .pf-company-verify-pending {
          color: #fbbf24 !important;
          font-weight: 950 !important;
        }

        html body .pf-page .pf-company-verify-btn {
          min-width: 150px !important;
        }

        html body .pf-page .pf-company-verify-modal {
          max-width: min(430px, calc(100vw - 28px)) !important;
        }

        html body .pf-page .pf-company-verify-summary {
          background: rgba(5, 24, 42, 0.64) !important;
          border: 1px solid rgba(77, 184, 238, 0.24) !important;
          border-radius: 12px !important;
          display: grid !important;
          gap: 5px !important;
          margin: 12px 0 4px !important;
          padding: 12px 14px !important;
          text-align: left !important;
        }

        html body .pf-page .pf-company-verify-summary span {
          color: #f7fbff !important;
          font-weight: 950 !important;
        }

        html body .pf-page .pf-company-verify-summary strong {
          color: #7dd3fc !important;
          font-size: 0.86rem !important;
        }

        html body .pf-page .pf-company-verify-actions {
          display: flex !important;
          gap: 10px !important;
          justify-content: center !important;
          margin-top: 14px !important;
        }

        @media (min-width: 761px) {
          html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-row {
            align-items: center !important;
            display: grid !important;
            gap: 12px !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-actions {
            justify-content: flex-end !important;
            width: auto !important;
          }

          html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-change-btn {
            height: 34px !important;
            min-height: 34px !important;
            min-width: 116px !important;
            padding: 0 18px !important;
            width: auto !important;
          }

          html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-info-value,
          html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-info-value > .pf-company-verify-ok {
            background: none !important;
            background-color: transparent !important;
            background-image: none !important;
            border: 0 !important;
            box-shadow: none !important;
            filter: none !important;
            outline: 0 !important;
            text-shadow: none !important;
          }
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) {
          --pf-profile-inset: 72px;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > :is(.pf-info-card-head, .pf-section-head) {
          align-items: center !important;
          box-sizing: border-box !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 52px minmax(0, 1fr) auto !important;
          margin: 0 !important;
          padding: 20px var(--pf-profile-inset) 16px !important;
          text-align: left !important;
          transform: none !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head > .pf-info-title {
          align-items: center !important;
          display: grid !important;
          gap: 16px !important;
          grid-column: 1 / 3 !important;
          grid-template-columns: 52px minmax(0, 1fr) !important;
          margin: 0 !important;
          transform: none !important;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head .pf-info-title-icon,
        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-section-head > svg {
          grid-column: 1 !important;
          height: 52px !important;
          justify-self: start !important;
          margin: 0 !important;
          min-width: 52px !important;
          transform: none !important;
          width: 52px !important;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head .pf-info-title > div,
        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-section-head > div {
          grid-column: 2 !important;
          justify-self: start !important;
          margin: 0 !important;
          min-width: 0 !important;
          text-align: left !important;
          transform: none !important;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-card-body {
          box-sizing: border-box !important;
          margin: 0 var(--pf-profile-inset) 20px !important;
          max-width: none !important;
          transform: none !important;
          width: calc(100% - (var(--pf-profile-inset) * 2)) !important;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-card-body > :is(.pf-info-row, .pf-field) {
          box-sizing: border-box !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 44px 180px minmax(0, 1fr) !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          max-width: none !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-card-body > :is(.company-seller-card, .company-seller-empty) {
          box-sizing: border-box !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          max-width: none !important;
          width: 100% !important;
        }

        @media (max-width: 760px) {
          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) {
            --pf-profile-inset: 14px;
          }

          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > :is(.pf-info-card-head, .pf-section-head) {
            gap: 12px !important;
            grid-template-columns: 44px minmax(0, 1fr) auto !important;
            padding-top: 14px !important;
          }

          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head > .pf-info-title {
            gap: 12px !important;
            grid-template-columns: 44px minmax(0, 1fr) !important;
          }

          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head .pf-info-title-icon,
          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-section-head > svg {
            height: 44px !important;
            min-width: 44px !important;
            width: 44px !important;
          }

          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-card-body > :is(.pf-info-row, .pf-field) {
            grid-template-columns: 44px minmax(92px, 0.35fr) minmax(0, 1fr) !important;
          }
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page .pf-form > #yritys.pf-aligned-section,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section,
        html body .pf-page .pf-form > #osoite.pf-aligned-section,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section {
          --pf-hard-inset: 48px;
          box-sizing: border-box !important;
          padding: 0 !important;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head {
          align-items: center !important;
          box-sizing: border-box !important;
          border-bottom: 0 !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 52px minmax(0, 1fr) auto !important;
          left: auto !important;
          margin: 0 !important;
          max-width: none !important;
          padding: 20px var(--pf-hard-inset) 16px !important;
          right: auto !important;
          text-align: left !important;
          transform: none !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head > .pf-info-title,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head > .pf-info-title {
          align-items: center !important;
          box-sizing: border-box !important;
          display: grid !important;
          gap: 16px !important;
          grid-column: 1 / 3 !important;
          grid-template-columns: 52px minmax(0, 1fr) !important;
          margin: 0 !important;
          max-width: none !important;
          padding: 0 !important;
          transform: none !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head .pf-info-title-icon,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head .pf-info-title-icon,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head > svg,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head > svg,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head > svg,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head > svg {
          grid-column: 1 !important;
          height: 52px !important;
          justify-self: start !important;
          margin: 0 !important;
          min-width: 52px !important;
          transform: none !important;
          width: 52px !important;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head .pf-info-title > div,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head .pf-info-title > div,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head > div,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head > div,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head > div,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head > div {
          grid-column: 2 !important;
          justify-self: start !important;
          margin: 0 !important;
          min-width: 0 !important;
          text-align: left !important;
          transform: none !important;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body {
          box-sizing: border-box !important;
          display: grid !important;
          left: auto !important;
          margin: 0 var(--pf-hard-inset) 20px !important;
          max-width: none !important;
          padding: 0 !important;
          right: auto !important;
          transform: none !important;
          width: auto !important;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body > .pf-info-row,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body > .pf-info-row,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body > .pf-info-row,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body > .pf-info-row {
          box-sizing: border-box !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 44px 150px minmax(0, 1fr) !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          max-width: none !important;
          padding-left: 10px !important;
          padding-right: 10px !important;
          transform: none !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-card-body > .company-seller-card,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-card-body > .company-seller-empty {
          box-sizing: border-box !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          max-width: none !important;
          transform: none !important;
          width: 100% !important;
        }

        @media (max-width: 760px) {
          html body .pf-page .pf-form > #yritys.pf-aligned-section,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section,
          html body .pf-page .pf-form > #osoite.pf-aligned-section,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section {
            --pf-hard-inset: 14px;
            border-radius: 8px !important;
            overflow: hidden !important;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head {
            align-items: start !important;
            gap: 12px !important;
            grid-template-columns: 48px minmax(0, 1fr) !important;
            min-height: 0 !important;
            padding: 20px var(--pf-hard-inset) 14px !important;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head > .pf-info-title,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head > .pf-info-title {
            gap: 12px !important;
            grid-column: 1 / -1 !important;
            grid-template-columns: 48px minmax(0, 1fr) !important;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head .pf-info-title-icon,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head .pf-info-title-icon,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head > svg,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head > svg,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head > svg,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head > svg {
            height: 44px !important;
            min-width: 44px !important;
            padding: 8px !important;
            width: 44px !important;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head .pf-info-title > div,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head .pf-info-title > div,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head > div,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head > div,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head > div,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head > div {
            grid-column: 2 !important;
            min-width: 0 !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section :is(h2, p, label, span, strong, small) {
            max-width: 100% !important;
            min-width: 0 !important;
            overflow-wrap: anywhere !important;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body {
            display: grid !important;
            gap: 10px !important;
            grid-column: 1 / -1 !important;
            justify-self: stretch !important;
            margin: 0 var(--pf-hard-inset) 18px !important;
            max-width: none !important;
            min-width: 0 !important;
            width: auto !important;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body > .pf-info-row {
            align-items: start !important;
            background: rgba(4, 18, 32, 0.42) !important;
            border: 1px solid rgba(95, 143, 179, 0.22) !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            display: grid !important;
            gap: 6px 10px !important;
            grid-template-columns: 34px minmax(0, 1fr) !important;
            justify-self: stretch !important;
            min-height: 0 !important;
            min-width: 0 !important;
            padding: 10px !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field-icon {
            grid-column: 1 !important;
            grid-row: 1 / span 2 !important;
            height: 30px !important;
            justify-self: start !important;
            width: 30px !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field label {
            align-self: center !important;
            grid-column: 2 !important;
            grid-row: 1 !important;
            line-height: 1.2 !important;
            margin: 0 !important;
            white-space: normal !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(.pf-locked, .pf-readonly-value, input, textarea) {
            grid-column: 2 !important;
            grid-row: 2 !important;
            min-width: 0 !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body > .pf-info-row {
            max-width: none !important;
            width: 100% !important;
          }

          @media (max-width: 380px) {
            html body .pf-page .pf-form > #yritys.pf-aligned-section,
            html body .pf-page .pf-form > #tiedot.pf-aligned-section,
            html body .pf-page .pf-form > #myyjat.pf-aligned-section,
            html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section,
            html body .pf-page .pf-form > #osoite.pf-aligned-section,
            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section {
              --pf-hard-inset: 10px;
            }

            html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body > .pf-info-row,
            html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body > .pf-info-row,
            html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field,
            html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body > .pf-info-row,
            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body > .pf-info-row {
              grid-template-columns: 32px minmax(0, 1fr) !important;
              padding: 10px 12px !important;
            }
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value :is(input, span),
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(input, textarea, .pf-readonly-value span) {
            min-width: 0 !important;
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
            word-break: break-word !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field {
            min-width: 0 !important;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section,
          html body .pf-page .pf-form > #osoite.pf-aligned-section,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section {
            overflow: visible !important;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body {
            left: auto !important;
            margin: 0 14px 18px !important;
            max-width: none !important;
            position: relative !important;
            transform: none !important;
            width: calc(100% - 28px) !important;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body > .pf-info-row {
            align-items: center !important;
            gap: 8px !important;
            grid-template-columns: 30px minmax(70px, 0.38fr) minmax(0, 1fr) !important;
            min-height: 58px !important;
            padding: 8px 10px !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field-icon {
            grid-column: 1 !important;
            grid-row: 1 !important;
            height: 28px !important;
            width: 28px !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field label {
            grid-column: 2 !important;
            grid-row: 1 !important;
            line-height: 1.05 !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(.pf-locked, .pf-readonly-value, input, textarea) {
            grid-column: 3 !important;
            grid-row: 1 !important;
          }

          html body .pf-page .pf-company-sellers-section > .company-seller-list > *,
          html body .pf-page .pf-company-sellers-section > .company-seller-add {
            margin-inline: 0 !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section {
            display: block !important;
            max-width: none !important;
            min-width: 0 !important;
            overflow: hidden !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot).pf-aligned-section > .pf-info-card-head,
          html body .pf-page .pf-form > :is(#julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-section-head {
            box-sizing: border-box !important;
            margin: 0 !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body {
            box-sizing: border-box !important;
            display: grid !important;
            gap: 10px !important;
            grid-template-columns: minmax(0, 1fr) !important;
            left: auto !important;
            margin: 0 12px 18px !important;
            max-width: none !important;
            min-width: 0 !important;
            padding: 0 !important;
            position: static !important;
            right: auto !important;
            transform: none !important;
            width: calc(100% - 24px) !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field {
            align-items: center !important;
            box-sizing: border-box !important;
            display: grid !important;
            gap: 8px 10px !important;
            grid-template-columns: 32px minmax(0, 1fr) !important;
            grid-template-rows: auto auto !important;
            justify-self: stretch !important;
            margin: 0 !important;
            max-width: none !important;
            min-height: 0 !important;
            min-width: 0 !important;
            padding: 10px 12px !important;
            transform: none !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field-icon {
            grid-column: 1 !important;
            grid-row: 1 / span 2 !important;
            height: 30px !important;
            width: 30px !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field label {
            grid-column: 2 !important;
            grid-row: 1 !important;
            min-width: 0 !important;
            white-space: normal !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(.pf-locked, .pf-readonly-value, input, textarea) {
            display: block !important;
            grid-column: 2 !important;
            grid-row: 2 !important;
            min-width: 0 !important;
            overflow-wrap: anywhere !important;
            text-align: left !important;
            white-space: normal !important;
            width: 100% !important;
            word-break: normal !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body {
            margin: 0 18px 18px !important;
            max-width: none !important;
            width: calc(100% - 36px) !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field {
            border-radius: 8px !important;
            grid-template-columns: 42px minmax(0, 1fr) !important;
            grid-template-rows: auto auto !important;
            min-height: 76px !important;
            padding: 14px 16px !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field-icon {
            grid-column: 1 !important;
            grid-row: 1 / span 2 !important;
            height: 38px !important;
            width: 38px !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field label {
            grid-column: 2 !important;
            grid-row: 1 !important;
            line-height: 1.15 !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(.pf-locked, .pf-readonly-value, input, textarea) {
            grid-column: 2 !important;
            grid-row: 2 !important;
            line-height: 1.18 !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row {
            grid-template-columns: 42px minmax(0, 1fr) auto !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-info-label {
            grid-column: 2 !important;
            grid-row: 1 / span 2 !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-info-value {
            grid-column: 3 !important;
            grid-row: 1 / span 2 !important;
            justify-self: end !important;
            width: auto !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-inline-btn {
            max-width: 100% !important;
            min-width: 0 !important;
            white-space: nowrap !important;
            width: auto !important;
          }

          @media (max-width: 380px) {
            html body .pf-page .pf-form > :is(#yritys, #tiedot, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body {
              margin-left: 12px !important;
              margin-right: 12px !important;
              width: calc(100% - 24px) !important;
            }

            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row {
              grid-template-columns: 38px minmax(0, 1fr) !important;
              min-height: 88px !important;
            }

            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-info-label {
              grid-column: 2 !important;
              grid-row: 1 !important;
              line-height: 1.15 !important;
              overflow-wrap: normal !important;
              word-break: normal !important;
            }

            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-info-value {
              grid-column: 2 !important;
              grid-row: 2 !important;
              justify-self: stretch !important;
              width: 100% !important;
            }

            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-inline-btn {
              width: 100% !important;
            }
          }

          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-rows.pf-card-body,
          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-rows.pf-card-body,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-info-rows.pf-address-rows.pf-card-body,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-info-rows.pf-card-body {
            align-self: stretch !important;
            box-sizing: border-box !important;
            display: grid !important;
            inline-size: calc(100% - 24px) !important;
            justify-self: stretch !important;
            margin: 0 12px 18px !important;
            max-inline-size: none !important;
            max-width: none !important;
            min-inline-size: calc(100% - 24px) !important;
            min-width: calc(100% - 24px) !important;
            padding: 0 !important;
            width: calc(100% - 24px) !important;
          }

          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-rows.pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-rows.pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-field,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-info-rows.pf-address-rows.pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-info-rows.pf-card-body > .pf-info-row {
            box-sizing: border-box !important;
            inline-size: 100% !important;
            max-inline-size: none !important;
            max-width: none !important;
            min-inline-size: 100% !important;
            min-width: 100% !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-public-name-field {
            min-height: 48px !important;
            padding-bottom: 4px !important;
            padding-top: 4px !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-public-bio-field {
            min-height: 118px !important;
            padding-bottom: 14px !important;
            padding-top: 14px !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-public-bio-field textarea {
            min-height: 72px !important;
          }

          html body .pf-page #osoite .pf-address-rows,
          html body .pf-page #osoite .pf-country-info-row,
          html body .pf-page #osoite .pf-country-info-row .pf-info-value {
            overflow: visible !important;
          }

          html body .pf-page #osoite .pf-country-info-row {
            align-items: start !important;
            isolation: isolate !important;
            position: relative !important;
            z-index: 30 !important;
          }

          html body .pf-page #osoite .pf-country-info-row .pf-info-value {
            align-self: start !important;
            display: block !important;
          }

          @media (max-width: 640px) {
            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section {
              --pf-card-inset: 14px !important;
              border-radius: 12px !important;
              min-height: 0 !important;
              padding-bottom: 18px !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .pf-section-head {
              align-items: start !important;
              gap: 12px !important;
              grid-template-columns: 44px minmax(0, 1fr) !important;
              padding: 18px var(--pf-card-inset) 14px !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .pf-section-head > svg {
              height: 44px !important;
              min-width: 44px !important;
              padding: 10px !important;
              width: 44px !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .pf-section-head h2 {
              font-size: 20px !important;
              line-height: 1.05 !important;
              white-space: normal !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .pf-section-head p {
              font-size: 12px !important;
              line-height: 1.32 !important;
              max-width: none !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > :is(.company-seller-list, .company-seller-add) {
              box-sizing: border-box !important;
              inline-size: calc(100% - (var(--pf-card-inset) * 2)) !important;
              justify-self: stretch !important;
              margin: 0 var(--pf-card-inset) 12px !important;
              max-width: none !important;
              max-inline-size: none !important;
              min-width: 0 !important;
              min-inline-size: 0 !important;
              place-self: stretch !important;
              transform: none !important;
              width: calc(100% - (var(--pf-card-inset) * 2)) !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .company-seller-list {
              display: grid !important;
              gap: 10px !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .company-seller-list > *,
            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .company-seller-add {
              box-sizing: border-box !important;
              inline-size: 100% !important;
              justify-self: stretch !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
              max-width: none !important;
              max-inline-size: none !important;
              min-width: 0 !important;
              min-inline-size: 0 !important;
              place-self: stretch !important;
              transform: none !important;
              width: 100% !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-empty {
              align-items: flex-start !important;
              align-self: stretch !important;
              box-sizing: border-box !important;
              flex: 1 1 auto !important;
              inline-size: 100% !important;
              justify-content: flex-start !important;
              line-height: 1.3 !important;
              max-width: none !important;
              max-inline-size: none !important;
              min-height: 0 !important;
              min-width: 0 !important;
              min-inline-size: 0 !important;
              padding: 14px !important;
              place-self: stretch !important;
              text-align: left !important;
              width: 100% !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add {
              border-radius: 10px !important;
              box-sizing: border-box !important;
              inline-size: 100% !important;
              margin-top: 10px !important;
              max-width: none !important;
              max-inline-size: none !important;
              min-width: 0 !important;
              min-inline-size: 0 !important;
              place-self: stretch !important;
              transform: none !important;
              width: 100% !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add-btn {
              align-self: stretch !important;
              box-sizing: border-box !important;
              min-height: 56px !important;
              justify-content: center !important;
              max-width: none !important;
              min-width: 0 !important;
              padding: 0 14px !important;
              white-space: normal !important;
              width: 100% !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add-fields {
              display: grid !important;
              gap: 12px !important;
              padding: 14px !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add:not(.is-open) .company-seller-add-fields {
              display: none !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add-fields label {
              display: grid !important;
              gap: 7px !important;
              min-width: 0 !important;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add-fields input {
              width: 100% !important;
            }
          }

          html body .pf-page .pf-form .pf-phone-change-btn {
            background: linear-gradient(180deg, rgba(18, 50, 76, 0.96), rgba(7, 25, 43, 0.96)) !important;
            border: 1px solid rgba(96, 160, 210, 0.48) !important;
            border-radius: 8px !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.08),
              0 10px 20px rgba(0, 0, 0, 0.16) !important;
            color: #ffffff !important;
            flex: 0 0 auto !important;
            justify-self: center !important;
            min-height: 34px !important;
            min-width: 104px !important;
            padding: 0 16px !important;
            width: auto !important;
          }

          html body .pf-page .pf-form .pf-info-phone-value .pf-phone-actions {
            align-self: center !important;
            justify-content: center !important;
            margin-inline: auto !important;
            width: auto !important;
          }

          html body .pf-page .pf-form .pf-phone-change-btn:hover:not(:disabled) {
            border-color: rgba(255, 141, 37, 0.78) !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 0 0 2px rgba(255, 122, 24, 0.14),
              0 12px 24px rgba(255, 122, 24, 0.16) !important;
          }

          html body .pf-page .pf-form .pf-phone-change-btn:disabled {
            cursor: not-allowed !important;
            opacity: 0.48 !important;
          }

          @media (max-width: 760px) {
            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row {
              grid-template-columns: 36px minmax(0, 1fr) !important;
              min-height: 76px !important;
              padding: 7px 12px 6px !important;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-info-row-icon {
              height: 34px !important;
              width: 34px !important;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-info-label {
              align-self: center !important;
              grid-column: 2 !important;
              justify-self: start !important;
              line-height: 1.05 !important;
              margin: 0 !important;
              text-align: left !important;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-info-phone-value {
              grid-column: 1 / -1 !important;
              margin-top: 0 !important;
              min-height: 28px !important;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-row {
              align-items: center !important;
              display: grid !important;
              gap: 8px !important;
              grid-template-columns: minmax(0, 1fr) auto !important;
              min-height: 28px !important;
              width: 100% !important;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-card {
              background: transparent !important;
              border: 0 !important;
              box-shadow: none !important;
              display: flex !important;
              min-height: 28px !important;
              padding: 0 !important;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-number {
              font-size: 13px !important;
              line-height: 1.1 !important;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-actions {
              align-items: center !important;
              align-self: center !important;
              display: flex !important;
              justify-content: flex-end !important;
              margin-inline: 0 !important;
              transform: translateY(-4px) !important;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-change-btn {
              height: 26px !important;
              min-height: 26px !important;
              min-width: 72px !important;
              padding: 0 10px !important;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) {
              min-height: 82px !important;
              padding-bottom: 6px !important;
              padding-top: 7px !important;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-info-row-icon {
              height: 34px !important;
              width: 34px !important;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-info-label {
              justify-self: start !important;
              line-height: 1.05 !important;
              margin-bottom: 0 !important;
              text-align: left !important;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-info-phone-value {
              margin-top: 2px !important;
              min-height: 28px !important;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-row {
              align-items: center !important;
              display: grid !important;
              gap: 8px !important;
              grid-template-columns: minmax(0, 1fr) auto !important;
              min-height: 28px !important;
              width: 100% !important;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-card {
              background: transparent !important;
              border: 0 !important;
              box-shadow: none !important;
              display: flex !important;
              min-height: 28px !important;
              padding: 0 !important;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-number {
              font-size: 13px !important;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-actions {
              align-items: center !important;
              align-self: center !important;
              display: flex !important;
              justify-content: flex-end !important;
              margin-inline: 0 !important;
              transform: translateY(-5px) !important;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-change-btn {
              height: 26px !important;
              min-height: 26px !important;
              min-width: 72px !important;
              padding: 0 10px !important;
            }
          }

          html body .pf-modal-backdrop:has(.pf-delete-modal) {
            align-items: flex-start !important;
            padding: calc(var(--topbar-h, 58px) + env(safe-area-inset-top, 0px) + 72px) 20px 28px !important;
            overflow-y: auto !important;
          }

          html body .pf-phone-modal.pf-delete-modal {
            margin: 0 auto 28px !important;
            max-height: none !important;
            width: min(100%, 420px) !important;
          }

          html body .pf-phone-modal.pf-delete-modal .pf-modal-close {
            right: 16px !important;
            top: 16px !important;
          }

          html body .pf-page #osoite,
          html body .pf-page #osoite > .pf-address-rows,
          html body .pf-page #osoite .pf-country-info-row,
          html body .pf-page #osoite .pf-country-info-row > .pf-info-value {
            overflow: visible !important;
          }

          html body .pf-page .pf-nav-item,
          html body .pf-page .pf-nav-item * {
            min-width: 0 !important;
            overflow-wrap: normal !important;
            text-wrap: nowrap !important;
            white-space: nowrap !important;
            word-break: keep-all !important;
          }

          html body .pf-page .pf-nav-item {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          @media (max-width: 1180px) {
            html body .pf-page .pf-layout {
              align-items: stretch !important;
              display: grid !important;
              gap: 16px !important;
              grid-template-columns: 1fr !important;
              padding: 16px 18px 28px !important;
              width: min(100%, 980px) !important;
            }

            html body .pf-page .pf-sidebar {
              display: grid !important;
              gap: 12px !important;
              grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr) !important;
              position: static !important;
              top: auto !important;
              width: 100% !important;
            }

            html body .pf-page .pf-user-card {
              min-width: 0 !important;
              width: 100% !important;
            }

            html body .pf-page .pf-user-name {
              max-width: none !important;
            }

            html body .pf-page .pf-nav {
              align-self: stretch !important;
              display: grid !important;
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              overflow: hidden !important;
              width: 100% !important;
            }

            html body .pf-page .pf-nav-item {
              border-bottom: 1px solid rgba(96, 148, 192, 0.2) !important;
              border-left: 0 !important;
              border-top: 3px solid transparent !important;
              font-size: 12px !important;
              justify-content: flex-start !important;
              min-height: 48px !important;
              padding: 0 12px !important;
            }

            html body .pf-page .pf-nav-active,
            html body .pf-page .pf-nav-item:hover {
              border-left-color: transparent !important;
              border-top-color: #ff8a1f !important;
            }
          }

          @media (max-width: 820px) {
            html body .pf-page .pf-layout {
              padding: 12px 10px 24px !important;
              width: 100% !important;
            }

            html body .pf-page .pf-sidebar {
              grid-template-columns: 1fr !important;
            }

            html body .pf-page .pf-nav {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            html body .pf-page .pf-nav-item {
              min-height: 46px !important;
            }
          }

          @media (max-width: 520px) {
            html body .pf-page .pf-nav {
              grid-template-columns: 1fr !important;
            }

            html body .pf-page .pf-nav-item {
              border-top: 0 !important;
              border-left: 3px solid transparent !important;
              font-size: 13px !important;
              min-height: 50px !important;
            }

            html body .pf-page .pf-nav-active,
            html body .pf-page .pf-nav-item:hover {
              border-left-color: #ff8a1f !important;
              border-top-color: transparent !important;
            }
          }

          @media (max-width: 640px) {
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-list.pf-card-body,
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-add.pf-card-body {
              box-sizing: border-box !important;
              display: grid !important;
              inline-size: calc(100% - 28px) !important;
              justify-self: stretch !important;
              margin: 0 14px 12px !important;
              max-inline-size: none !important;
              max-width: none !important;
              min-inline-size: 0 !important;
              min-width: 0 !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
              place-self: stretch !important;
              transform: none !important;
              width: calc(100% - 28px) !important;
            }

            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-list.pf-card-body > .company-seller-empty,
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-list.pf-card-body > .company-seller-card,
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-add.pf-card-body > .company-seller-add-btn,
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-add.pf-card-body > .company-seller-add-fields {
              box-sizing: border-box !important;
              inline-size: 100% !important;
              justify-self: stretch !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
              max-inline-size: none !important;
              max-width: none !important;
              min-inline-size: 0 !important;
              min-width: 0 !important;
              place-self: stretch !important;
              transform: none !important;
              width: 100% !important;
            }

            html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-info-value > .pf-company-verify-ok {
              background: transparent !important;
              border: 0 !important;
              box-shadow: none !important;
              color: #4ade80 !important;
              -webkit-text-fill-color: #4ade80 !important;
              padding: 0 !important;
            }
          }
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page {
          background:
            radial-gradient(900px 540px at 8% 18%, rgba(17, 82, 125, 0.17), transparent 68%),
            radial-gradient(720px 440px at 94% 12%, rgba(255, 122, 24, 0.055), transparent 72%),
            linear-gradient(180deg, #07111b 0%, #081521 48%, #06101a 100%) !important;
          color: #eef6fc !important;
          min-height: calc(100vh - 72px) !important;
          padding: 28px 22px 54px !important;
        }

        html body .pf-page .pf-layout {
          align-items: start !important;
          display: grid !important;
          gap: 18px !important;
          grid-template-areas: "sidebar content insights" !important;
          grid-template-columns: 248px minmax(520px, 1fr) 282px !important;
          margin: 0 auto !important;
          max-width: 1480px !important;
          padding: 0 !important;
          width: 100% !important;
        }

        html body .pf-page .pf-sidebar {
          align-self: start !important;
          background: linear-gradient(180deg, rgba(10, 27, 42, 0.97), rgba(5, 18, 30, 0.98)) !important;
          border: 1px solid rgba(113, 153, 184, 0.18) !important;
          border-radius: 13px !important;
          box-shadow: 0 22px 60px rgba(0, 6, 13, 0.24) !important;
          display: block !important;
          grid-area: sidebar !important;
          min-height: 0 !important;
          overflow: hidden !important;
          position: sticky !important;
          top: 90px !important;
        }

        html body .pf-page .pf-user-card {
          align-items: center !important;
          background:
            radial-gradient(190px 110px at 0% 0%, rgba(255, 123, 25, 0.17), transparent 72%),
            rgba(7, 24, 38, 0.72) !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(113, 153, 184, 0.18) !important;
          border-radius: 0 !important;
          display: grid !important;
          gap: 13px !important;
          grid-template-columns: 68px minmax(0, 1fr) !important;
          min-height: 116px !important;
          padding: 18px !important;
        }

        html body .pf-page .pf-avatar,
        html body .pf-page .pf-avatar-upload {
          background: #10283b !important;
          border: 2px solid rgba(255, 139, 39, 0.88) !important;
          border-radius: 50% !important;
          box-shadow: 0 0 0 4px rgba(255, 128, 27, 0.08) !important;
          height: 64px !important;
          min-height: 64px !important;
          width: 64px !important;
        }

        html body .pf-page .pf-avatar-overlay {
          background: #ff7a1a !important;
          border: 2px solid #0a1927 !important;
          border-radius: 50% !important;
          bottom: -2px !important;
          color: #fff !important;
          display: flex !important;
          height: 24px !important;
          opacity: 1 !important;
          right: -2px !important;
          top: auto !important;
          width: 24px !important;
        }

        html body .pf-page .pf-user-name {
          color: #fff !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          line-height: 1.25 !important;
          margin: 0 !important;
        }

        html body .pf-page .pf-company-badge {
          background: transparent !important;
          border: 0 !important;
          color: #91a6b8 !important;
          font-size: 11px !important;
          font-weight: 750 !important;
          margin: 3px 0 0 !important;
          padding: 0 !important;
        }

        html body .pf-page .pf-avatar-actions {
          display: flex !important;
          gap: 7px !important;
          margin-top: 7px !important;
        }

        html body .pf-page .pf-avatar-action {
          background: transparent !important;
          border: 0 !important;
          color: #ff9b45 !important;
          font-size: 10px !important;
          font-weight: 850 !important;
          gap: 4px !important;
          padding: 0 !important;
        }

        html body .pf-page .pf-nav {
          display: grid !important;
          grid-template-columns: 1fr !important;
          width: 100% !important;
        }

        html body .pf-page .pf-nav-item {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(113, 153, 184, 0.11) !important;
          border-left: 3px solid transparent !important;
          border-radius: 0 !important;
          color: #acbac7 !important;
          display: grid !important;
          font-size: 13px !important;
          font-weight: 850 !important;
          gap: 12px !important;
          grid-template-columns: 22px minmax(0, 1fr) auto !important;
          height: 58px !important;
          min-height: 58px !important;
          padding: 0 15px !important;
          text-align: left !important;
        }

        html body .pf-page .pf-nav-item:hover,
        html body .pf-page .pf-nav-active {
          background:
            radial-gradient(180px 80px at 30% 50%, rgba(255, 126, 25, 0.13), transparent 76%),
            rgba(13, 36, 55, 0.72) !important;
          border-left-color: #ff7a1a !important;
          border-top-color: transparent !important;
          color: #fff !important;
          padding-left: 15px !important;
        }

        html body .pf-page .pf-nav-active svg,
        html body .pf-page .pf-nav-item:hover > svg:first-child {
          color: #ff8b29 !important;
        }

        html body .pf-page .pf-content {
          grid-area: content !important;
          min-width: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form {
          display: grid !important;
          gap: 14px !important;
          grid-template-columns: minmax(0, 1fr) !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > :is(section, .pf-save-bar) {
          grid-column: 1 !important;
          width: 100% !important;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section) {
          background:
            radial-gradient(680px 220px at 8% 0%, rgba(38, 102, 148, 0.11), transparent 72%),
            linear-gradient(180deg, rgba(11, 28, 42, 0.97), rgba(7, 21, 34, 0.99)) !important;
          border: 1px solid rgba(101, 145, 179, 0.2) !important;
          border-radius: 12px !important;
          box-shadow: 0 18px 48px rgba(0, 6, 14, 0.18) !important;
          overflow: hidden !important;
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          border: 0 !important;
          display: grid !important;
          gap: 13px !important;
          grid-template-columns: 42px minmax(0, 1fr) auto !important;
          min-height: 72px !important;
          padding: 14px 18px 10px !important;
        }

        html body .pf-page .pf-info-title {
          gap: 13px !important;
          grid-template-columns: 42px minmax(0, 1fr) !important;
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          color: #ff891f !important;
          height: 42px !important;
          padding: 9px !important;
          width: 42px !important;
        }

        html body .pf-page :is(.pf-info-card-head h2, .pf-section-head h2) {
          color: #f6f9fc !important;
          font-size: 17px !important;
          font-weight: 900 !important;
        }

        html body .pf-page :is(.pf-info-card-head p, .pf-section-head p) {
          color: #8294a4 !important;
          font-size: 12px !important;
          font-weight: 650 !important;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          margin: 0 !important;
          padding: 0 18px 17px !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide) {
          background: rgba(3, 15, 25, 0.34) !important;
          border: 1px solid rgba(112, 151, 181, 0.14) !important;
          border-bottom: 1px solid rgba(112, 151, 181, 0.14) !important;
          border-radius: 7px !important;
          margin-top: 7px !important;
          min-height: 48px !important;
          padding: 6px 10px !important;
        }

        html body .pf-page .pf-save-bar {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          justify-content: flex-start !important;
          padding: 8px 0 0 !important;
        }

        html body .pf-page .pf-save-btn {
          background: linear-gradient(135deg, #ff961f, #f26a0b) !important;
          border: 1px solid rgba(255, 193, 131, 0.45) !important;
          border-radius: 8px !important;
          box-shadow: 0 14px 30px rgba(238, 99, 5, 0.2) !important;
          min-height: 45px !important;
        }

        html body .pf-page .pf-insights {
          align-self: start !important;
          display: grid !important;
          gap: 14px !important;
          grid-area: insights !important;
          min-width: 0 !important;
          position: sticky !important;
          top: 90px !important;
        }

        html body .pf-page .pf-insight-card {
          background:
            radial-gradient(260px 150px at 10% 0%, rgba(28, 94, 139, 0.13), transparent 72%),
            linear-gradient(180deg, rgba(11, 28, 42, 0.98), rgba(7, 21, 34, 0.99)) !important;
          border: 1px solid rgba(101, 145, 179, 0.2) !important;
          border-radius: 12px !important;
          box-shadow: 0 18px 48px rgba(0, 6, 14, 0.18) !important;
          overflow: hidden !important;
          padding: 17px !important;
        }

        html body .pf-page .pf-insight-heading {
          align-items: center !important;
          display: grid !important;
          gap: 10px !important;
          grid-template-columns: 35px minmax(0, 1fr) !important;
        }

        html body .pf-page .pf-insight-icon {
          align-items: center !important;
          background: rgba(255, 126, 25, 0.08) !important;
          border: 1px solid rgba(255, 137, 31, 0.42) !important;
          border-radius: 9px !important;
          color: #ff8a1f !important;
          display: inline-flex !important;
          height: 35px !important;
          justify-content: center !important;
          width: 35px !important;
        }

        html body .pf-page .pf-insight-heading h2 {
          color: #f7fafc !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          margin: 0 !important;
        }

        html body .pf-page .pf-insight-heading p {
          color: #8193a3 !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          margin: 2px 0 0 !important;
        }

        html body .pf-page .pf-trust-score {
          align-items: center !important;
          display: flex !important;
          flex-direction: column !important;
          padding: 21px 0 14px !important;
          text-align: center !important;
        }

        html body .pf-page .pf-trust-emblem {
          align-items: center !important;
          background:
            radial-gradient(circle at 50% 36%, #ffbb61, #ef6d11 62%, #6d2705 100%) !important;
          border: 1px solid rgba(255, 208, 153, 0.7) !important;
          border-radius: 50% 50% 44% 44% !important;
          box-shadow: 0 0 28px rgba(255, 120, 22, 0.28) !important;
          color: #fff !important;
          display: flex !important;
          height: 62px !important;
          justify-content: center !important;
          margin-bottom: 10px !important;
          width: 62px !important;
        }

        html body .pf-page .pf-trust-score strong {
          color: #fff !important;
          font-size: 19px !important;
          font-weight: 950 !important;
        }

        html body .pf-page .pf-trust-score > span {
          color: #c6d2dc !important;
          font-size: 11px !important;
          font-weight: 750 !important;
          margin-top: 2px !important;
        }

        html body .pf-page .pf-progress-track {
          background: rgba(106, 137, 160, 0.17) !important;
          border-radius: 999px !important;
          height: 6px !important;
          overflow: hidden !important;
          width: 100% !important;
        }

        html body .pf-page .pf-progress-track > span {
          background: linear-gradient(90deg, #ff8d1c, #ffb13b) !important;
          border-radius: inherit !important;
          display: block !important;
          height: 100% !important;
        }

        html body .pf-page .pf-insight-list {
          border-top: 1px solid rgba(110, 148, 177, 0.14) !important;
          display: grid !important;
          gap: 0 !important;
          margin-top: 15px !important;
          padding-top: 8px !important;
        }

        html body .pf-page .pf-insight-list > div {
          align-items: center !important;
          color: #8193a2 !important;
          display: flex !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          gap: 8px !important;
          justify-content: space-between !important;
          min-height: 30px !important;
        }

        html body .pf-page .pf-insight-list > div.is-complete {
          color: #c3d1dc !important;
        }

        html body .pf-page .pf-insight-list > div.is-complete svg {
          color: #32d16d !important;
        }

        html body .pf-page .pf-insight-dot {
          border: 1px solid #587083 !important;
          border-radius: 50% !important;
          height: 13px !important;
          width: 13px !important;
        }

        html body .pf-page .pf-insight-action {
          align-items: center !important;
          background: transparent !important;
          border: 1px solid #f47816 !important;
          border-radius: 7px !important;
          color: #ff8b25 !important;
          display: flex !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          gap: 7px !important;
          justify-content: center !important;
          margin-top: 12px !important;
          min-height: 39px !important;
          width: 100% !important;
        }

        html body .pf-page .pf-completion-overview {
          align-items: center !important;
          display: grid !important;
          gap: 13px !important;
          grid-template-columns: 70px minmax(0, 1fr) !important;
          padding: 20px 0 8px !important;
        }

        html body .pf-page .pf-completion-ring {
          align-items: center !important;
          background: conic-gradient(#ff8b1f var(--profile-progress), rgba(101, 137, 164, 0.18) 0) !important;
          border-radius: 50% !important;
          display: flex !important;
          height: 68px !important;
          justify-content: center !important;
          position: relative !important;
          width: 68px !important;
        }

        html body .pf-page .pf-completion-ring::before {
          background: #0a1a29 !important;
          border-radius: 50% !important;
          content: "" !important;
          inset: 8px !important;
          position: absolute !important;
        }

        html body .pf-page .pf-completion-ring span {
          color: #fff !important;
          font-size: 15px !important;
          font-weight: 950 !important;
          position: relative !important;
        }

        html body .pf-page .pf-completion-overview > div:last-child {
          display: grid !important;
          gap: 3px !important;
        }

        html body .pf-page .pf-completion-overview strong {
          color: #eef5fb !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }

        html body .pf-page .pf-completion-overview > div:last-child span {
          color: #8193a3 !important;
          font-size: 10px !important;
          line-height: 1.35 !important;
        }

        html body .pf-page .pf-completion-list {
          max-height: 228px !important;
          overflow-y: auto !important;
          padding-right: 3px !important;
        }

        html body .pf-page .pf-avatar-crop-modal {
          background: linear-gradient(180deg, #0c2234, #071725) !important;
          border: 1px solid rgba(255, 139, 36, 0.38) !important;
          border-radius: 14px !important;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.58) !important;
        }

        html body .pf-page .pf-avatar-crop-frame {
          border: 2px solid #ff8420 !important;
          box-shadow: 0 0 0 6px rgba(255, 126, 26, 0.08) !important;
        }

        @media (max-width: 1250px) {
          html body .pf-page .pf-layout {
            grid-template-areas:
              "sidebar content"
              "insights insights" !important;
            grid-template-columns: 230px minmax(0, 1fr) !important;
          }

          html body .pf-page .pf-insights {
            display: grid !important;
            grid-area: insights !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            position: static !important;
          }
        }

        @media (max-width: 900px) {
          html body .pf-page {
            padding: 14px 10px 34px !important;
          }

          html body .pf-page .pf-layout {
            grid-template-areas:
              "sidebar"
              "content"
              "insights" !important;
            grid-template-columns: 1fr !important;
          }

          html body .pf-page .pf-sidebar {
            position: static !important;
          }

          html body .pf-page .pf-nav {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          html body .pf-page .pf-nav-item {
            border: 1px solid rgba(113, 153, 184, 0.12) !important;
            border-left: 3px solid transparent !important;
          }

          html body .pf-page .pf-nav-active,
          html body .pf-page .pf-nav-item:hover {
            border-left-color: #ff7a1a !important;
            border-top-color: rgba(113, 153, 184, 0.12) !important;
          }
        }

        @media (max-width: 620px) {
          html body .pf-page .pf-insights,
          html body .pf-page .pf-nav {
            grid-template-columns: 1fr !important;
          }

          html body .pf-page .pf-user-card {
            grid-template-columns: 64px minmax(0, 1fr) !important;
          }

          html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
            grid-template-columns: 38px minmax(0, 1fr) !important;
            padding: 13px !important;
          }

          html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
            padding: 0 12px 12px !important;
          }
        }
      `}</style>

      <style jsx global>{`
        /* Neutral graphite visual theme. Scoped to the profile page so the topbar stays untouched. */
        html body .pf-page {
          --pf-orange: #ff7a18;
          --pf-orange-light: #ffad45;
          --pf-ink: #101113;
          --pf-panel: #1b1c1f;
          --pf-panel-deep: #121316;
          --pf-line: rgba(255, 255, 255, 0.1);
          --pf-muted: #a5a7ab;
          background:
            linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px),
            radial-gradient(760px 520px at 8% 9%, rgba(255, 255, 255, 0.045), transparent 70%),
            radial-gradient(680px 480px at 88% 24%, rgba(153, 161, 172, 0.035), transparent 72%),
            linear-gradient(145deg, #141518 0%, #0b0c0e 52%, #151619 100%) !important;
          background-size: 42px 42px, 42px 42px, auto, auto, auto !important;
          color: #f7f4f0 !important;
        }

        html body .pf-page .pf-sidebar,
        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section),
        html body .pf-page .pf-insight-card {
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 46%),
            linear-gradient(180deg, rgba(31, 32, 35, 0.98), rgba(17, 18, 20, 0.99)) !important;
          border: 1px solid rgba(255, 255, 255, 0.105) !important;
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.045) !important;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section) {
          border-radius: 16px !important;
          overflow: hidden !important;
          position: relative !important;
          transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease !important;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section)::before {
          background: linear-gradient(90deg, var(--pf-orange), rgba(255, 174, 75, 0.68), transparent 80%) !important;
          content: "" !important;
          height: 2px !important;
          left: 0 !important;
          opacity: 0.75 !important;
          position: absolute !important;
          right: 0 !important;
          top: 0 !important;
          z-index: 2 !important;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section):hover {
          border-color: rgba(255, 130, 34, 0.3) !important;
          box-shadow:
            0 27px 74px rgba(0, 0, 0, 0.34),
            0 0 0 1px rgba(255, 126, 26, 0.035),
            inset 0 1px 0 rgba(255, 255, 255, 0.055) !important;
        }

        html body .pf-page .pf-sidebar {
          border-radius: 16px !important;
        }

        html body .pf-page .pf-user-card {
          align-items: center !important;
          background:
            radial-gradient(180px 120px at 12% 8%, rgba(255, 137, 37, 0.22), transparent 74%),
            linear-gradient(135deg, rgba(45, 38, 31, 0.96), rgba(17, 16, 15, 0.98)) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.105) !important;
          gap: 16px !important;
          grid-template-columns: 78px minmax(0, 1fr) !important;
          min-height: 136px !important;
          overflow: hidden !important;
          padding: 20px 17px !important;
          position: relative !important;
        }

        html body .pf-page .pf-user-card::after {
          border: 1px solid rgba(255, 139, 47, 0.13) !important;
          border-radius: 50% !important;
          content: "" !important;
          height: 130px !important;
          pointer-events: none !important;
          position: absolute !important;
          right: -70px !important;
          top: -72px !important;
          width: 130px !important;
        }

        html body .pf-page .pf-avatar,
        html body .pf-page .pf-avatar-upload {
          background: linear-gradient(145deg, #30271f, #12110f) !important;
          border: 2px solid #ff8a27 !important;
          box-shadow:
            0 0 0 5px rgba(255, 122, 24, 0.1),
            0 12px 28px rgba(0, 0, 0, 0.34) !important;
          height: 72px !important;
          min-height: 72px !important;
          width: 72px !important;
        }

        html body .pf-page .pf-avatar-overlay {
          background: linear-gradient(145deg, #ffad45, #f06408) !important;
          border-color: #171411 !important;
          box-shadow: 0 5px 12px rgba(0, 0, 0, 0.34) !important;
          height: 27px !important;
          width: 27px !important;
        }

        html body .pf-page .pf-user-name {
          color: #fafafa !important;
          font-size: 16px !important;
          letter-spacing: -0.01em !important;
        }

        html body .pf-page .pf-company-badge {
          color: #b8afa6 !important;
          font-size: 11px !important;
        }

        html body .pf-page .pf-avatar-actions {
          align-items: center !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          position: relative !important;
          z-index: 1 !important;
        }

        html body .pf-page .pf-avatar-action {
          background: rgba(255, 255, 255, 0.055) !important;
          border: 1px solid rgba(255, 255, 255, 0.11) !important;
          border-radius: 6px !important;
          color: #fff4e8 !important;
          min-height: 25px !important;
          padding: 0 8px !important;
        }

        html body .pf-page .pf-avatar-action:hover {
          background: rgba(255, 122, 24, 0.13) !important;
          border-color: rgba(255, 137, 41, 0.42) !important;
          color: #ffaf57 !important;
        }

        html body .pf-page .pf-avatar-action.danger {
          background: rgba(255, 68, 68, 0.07) !important;
          border-color: rgba(255, 92, 92, 0.24) !important;
          color: #ff9a90 !important;
        }

        html body .pf-page .pf-nav-item {
          border-bottom-color: rgba(255, 255, 255, 0.075) !important;
          color: #aaa49d !important;
          min-height: 62px !important;
          transition: background 160ms ease, color 160ms ease !important;
        }

        html body .pf-page .pf-nav-item > svg:first-child {
          color: #77736f !important;
          filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.25)) !important;
        }

        html body .pf-page .pf-nav-item:hover,
        html body .pf-page .pf-nav-active {
          background:
            linear-gradient(90deg, rgba(255, 119, 16, 0.22), rgba(255, 135, 31, 0.055) 72%, transparent) !important;
          border-left-color: #ff7a18 !important;
          color: #fff9f2 !important;
        }

        html body .pf-page .pf-nav-active::after {
          background: #ff8a28 !important;
          border-radius: 999px !important;
          box-shadow: 0 0 14px rgba(255, 123, 25, 0.58) !important;
          content: "" !important;
          height: 26px !important;
          justify-self: end !important;
          width: 3px !important;
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          background:
            linear-gradient(90deg, rgba(255, 122, 24, 0.055), transparent 44%) !important;
          min-height: 82px !important;
          padding: 17px 20px 12px !important;
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          background: linear-gradient(145deg, rgba(255, 154, 54, 0.2), rgba(255, 102, 8, 0.07)) !important;
          border: 1px solid rgba(255, 139, 40, 0.36) !important;
          border-radius: 12px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 8px 20px rgba(0, 0, 0, 0.2) !important;
          color: #ff952f !important;
        }

        html body .pf-page #julkinen-profiili .pf-section-head > svg {
          background: linear-gradient(145deg, rgba(255, 183, 76, 0.2), rgba(255, 114, 13, 0.06)) !important;
          border-color: rgba(255, 166, 65, 0.36) !important;
          color: #ffb04e !important;
        }

        html body .pf-page :is(.pf-info-card-head h2, .pf-section-head h2) {
          color: #fffaf4 !important;
          font-size: 18px !important;
          letter-spacing: -0.015em !important;
        }

        html body .pf-page :is(.pf-info-card-head p, .pf-section-head p) {
          color: #9fa2a7 !important;
          font-weight: 650 !important;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
          padding: 0 20px 20px !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide) {
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0.008)) !important;
          border-color: rgba(255, 255, 255, 0.085) !important;
          border-bottom-color: rgba(255, 255, 255, 0.085) !important;
          border-radius: 9px !important;
          min-height: 52px !important;
          transition: background 160ms ease, border-color 160ms ease !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover {
          background: linear-gradient(90deg, rgba(255, 127, 28, 0.065), rgba(255, 255, 255, 0.014)) !important;
          border-color: rgba(255, 145, 52, 0.2) !important;
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          background: linear-gradient(145deg, #303237, #1c1d20) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          color: #d2d4d8 !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover :is(.pf-info-row-icon, .pf-field-icon) {
          background: linear-gradient(145deg, rgba(255, 141, 43, 0.22), rgba(255, 91, 5, 0.08)) !important;
          border-color: rgba(255, 145, 52, 0.3) !important;
          color: #ffad56 !important;
        }

        html body .pf-page :is(.pf-info-label, .pf-field label) {
          color: #a4a7ac !important;
        }

        html body .pf-page :is(
          .pf-info-value input,
          .pf-info-value input:disabled,
          .pf-info-value > span,
          .pf-phone-number,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite input
        ) {
          color: #fafafa !important;
          -webkit-text-fill-color: #fafafa !important;
        }

        html body .pf-page :is(
          .pf-info-value input:not(:disabled):focus,
          #julkinen-profiili input:focus,
          #julkinen-profiili textarea:focus,
          #osoite input:focus
        ) {
          background: rgba(255, 123, 24, 0.075) !important;
          border-color: rgba(255, 147, 56, 0.36) !important;
          box-shadow: 0 0 0 3px rgba(255, 122, 24, 0.07) !important;
        }

        html body .pf-page :is(.pf-inline-btn, .company-seller-small-btn) {
          background: #242529 !important;
          border-color: rgba(255, 255, 255, 0.13) !important;
          color: #f3f4f5 !important;
        }

        html body .pf-page :is(.pf-inline-btn.verify, .company-seller-add-btn, .pf-save-btn) {
          background: linear-gradient(135deg, #ff9d35, #f26708) !important;
          border-color: rgba(255, 193, 126, 0.48) !important;
          box-shadow:
            0 13px 28px rgba(224, 81, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.22) !important;
          color: #fff !important;
        }

        html body .pf-page :is(.pf-inline-btn.verify, .company-seller-add-btn, .pf-save-btn):hover {
          filter: brightness(1.08) !important;
          transform: translateY(-1px) !important;
        }

        html body .pf-page .pf-insights {
          gap: 16px !important;
        }

        html body .pf-page .pf-insight-card {
          border-radius: 16px !important;
          overflow: hidden !important;
          padding: 19px !important;
          position: relative !important;
        }

        html body .pf-page .pf-insight-card::before {
          background: radial-gradient(circle, rgba(255, 138, 35, 0.18), transparent 68%) !important;
          content: "" !important;
          height: 180px !important;
          pointer-events: none !important;
          position: absolute !important;
          right: -90px !important;
          top: -95px !important;
          width: 180px !important;
        }

        html body .pf-page .pf-insight-icon {
          background: linear-gradient(145deg, rgba(255, 157, 58, 0.2), rgba(255, 99, 7, 0.07)) !important;
          border-color: rgba(255, 139, 42, 0.38) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
          color: #ff9c37 !important;
        }

        html body .pf-page .pf-insight-heading h2 {
          color: #fff9f2 !important;
        }

        html body .pf-page .pf-insight-heading p,
        html body .pf-page .pf-completion-overview > div:last-child span {
          color: #9fa2a7 !important;
        }

        html body .pf-page .pf-trust-emblem {
          background:
            radial-gradient(circle at 42% 30%, #ffd083, #ff8a24 44%, #c94600 74%, #4b1700 100%) !important;
          border: 2px solid rgba(255, 211, 151, 0.78) !important;
          box-shadow:
            0 0 0 7px rgba(255, 122, 24, 0.07),
            0 16px 32px rgba(199, 63, 0, 0.24) !important;
          height: 72px !important;
          width: 72px !important;
        }

        html body .pf-page .pf-progress-track {
          background: rgba(255, 255, 255, 0.09) !important;
          height: 7px !important;
        }

        html body .pf-page .pf-progress-track > span {
          background: linear-gradient(90deg, #f4680b, #ffad42) !important;
          box-shadow: 0 0 12px rgba(255, 125, 26, 0.38) !important;
        }

        html body .pf-page .pf-insight-list {
          border-top-color: rgba(255, 255, 255, 0.085) !important;
        }

        html body .pf-page .pf-insight-list > div {
          color: #8f9297 !important;
        }

        html body .pf-page .pf-insight-list > div.is-complete {
          color: #c7c9cd !important;
        }

        html body .pf-page .pf-completion-ring {
          background: conic-gradient(#ff8a21 var(--profile-progress), rgba(255, 255, 255, 0.095) 0) !important;
          box-shadow: 0 0 25px rgba(255, 113, 13, 0.11) !important;
        }

        html body .pf-page .pf-completion-ring::before {
          background: #191a1d !important;
          box-shadow: inset 0 0 14px rgba(0, 0, 0, 0.35) !important;
        }

        html body .pf-page .pf-insight-action {
          background: linear-gradient(90deg, rgba(255, 122, 24, 0.09), rgba(255, 122, 24, 0.025)) !important;
          border-color: rgba(255, 129, 31, 0.72) !important;
          color: #ffa34a !important;
        }

        html body .pf-page :is(.company-seller-card, .company-seller-add, .company-seller-empty) {
          background: rgba(255, 255, 255, 0.025) !important;
          border-color: rgba(255, 255, 255, 0.09) !important;
        }

        html body .pf-page .company-seller-avatar {
          background: linear-gradient(145deg, #ff9d38, #cf4a00) !important;
          border-color: rgba(255, 207, 151, 0.5) !important;
          box-shadow: 0 8px 20px rgba(198, 62, 0, 0.18) !important;
        }

        html body .pf-page .pf-public-note {
          background: linear-gradient(90deg, rgba(255, 122, 24, 0.08), rgba(255, 255, 255, 0.018)) !important;
          border-top-color: rgba(255, 139, 42, 0.16) !important;
          color: #b3b5b9 !important;
        }

        html body .pf-page .pf-modal-backdrop {
          background: rgba(4, 4, 3, 0.78) !important;
          backdrop-filter: blur(10px) !important;
        }

        html body .pf-page :is(.pf-phone-modal, .pf-avatar-crop-modal) {
          background:
            radial-gradient(320px 190px at 10% 0%, rgba(255, 126, 27, 0.12), transparent 72%),
            linear-gradient(180deg, #25262a, #131416) !important;
          border-color: rgba(255, 139, 42, 0.34) !important;
        }

        html body .pf-page .pf-password-field > span {
          color: #d7d1ca !important;
        }

        html body .pf-page .pf-password-field input {
          background: rgba(255, 255, 255, 0.055) !important;
          border-color: rgba(255, 255, 255, 0.14) !important;
          color: #ffffff !important;
        }

        html body .pf-page .pf-password-visibility {
          color: #aeb4bd !important;
        }

        html body .pf-page .pf-password-visibility:hover,
        html body .pf-page .pf-password-visibility:focus-visible {
          color: #ff9b3d !important;
        }

        html body .pf-page .pf-password-field input:focus {
          border-color: rgba(255, 139, 42, 0.72) !important;
          box-shadow: 0 0 0 3px rgba(255, 122, 24, 0.13) !important;
        }

        html body .pf-page .pf-password-modal .pf-phone-status {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          color: #d6d8dc !important;
        }

        @media (max-width: 620px) {
          html body .pf-page .pf-user-card {
            grid-template-columns: 72px minmax(0, 1fr) !important;
            padding: 17px 14px !important;
          }

          html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
            min-height: 74px !important;
          }
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page {
          padding: 22px 14px 34px !important;
        }

        html body .pf-page .pf-layout {
          gap: 24px !important;
          grid-template-areas: "sidebar content" !important;
          grid-template-columns: 248px minmax(620px, 1fr) !important;
          max-width: 1126px !important;
        }

        html body .pf-page .pf-profile-heading {
          display: block !important;
          margin: 6px 2px 22px !important;
        }

        html body .pf-page .pf-profile-heading h1 {
          color: #fafafa !important;
          font-size: 25px !important;
          font-weight: 950 !important;
          letter-spacing: -0.03em !important;
          margin: 0 0 5px !important;
        }

        html body .pf-page .pf-profile-heading p {
          color: #a5a8ad !important;
          font-size: 13px !important;
          margin: 0 !important;
        }

        html body .pf-page .pf-sidebar {
          top: 86px !important;
        }

        html body .pf-page .pf-user-card {
          grid-template-columns: 78px minmax(0, 1fr) !important;
          min-height: 180px !important;
        }

        html body .pf-page .pf-sidebar-progress {
          display: grid !important;
          gap: 9px !important;
          grid-column: 1 / -1 !important;
          margin-top: 5px !important;
          position: relative !important;
          width: 100% !important;
          z-index: 1 !important;
        }

        html body .pf-page .pf-sidebar-progress > div {
          align-items: center !important;
          color: #c7c9cd !important;
          display: flex !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          justify-content: space-between !important;
        }

        html body .pf-page .pf-sidebar-progress strong {
          color: #fff !important;
          font-size: 12px !important;
        }

        html body .pf-page .pf-sidebar-progress-track {
          background: rgba(255, 255, 255, 0.1) !important;
          border-radius: 999px !important;
          display: block !important;
          height: 6px !important;
          overflow: hidden !important;
        }

        html body .pf-page .pf-sidebar-progress-track > span {
          background: linear-gradient(90deg, #f06408, #ff9b34) !important;
          border-radius: inherit !important;
          box-shadow: 0 0 12px rgba(255, 122, 24, 0.38) !important;
          display: block !important;
          height: 100% !important;
        }

        html body .pf-page .pf-nav-item {
          min-height: 56px !important;
        }

        html body .pf-page .pf-logout-button {
          background: rgba(255, 255, 255, 0.025) !important;
          border: 1px solid rgba(255, 255, 255, 0.11) !important;
          border-radius: 9px !important;
          color: #f1f2f3 !important;
          margin: 14px !important;
          min-height: 43px !important;
          width: calc(100% - 28px) !important;
        }

        html body .pf-page .pf-logout-button:hover {
          background: rgba(255, 122, 24, 0.1) !important;
          border-color: rgba(255, 136, 39, 0.34) !important;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section) {
          border-radius: 14px !important;
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          min-height: 72px !important;
          padding: 14px 22px 6px !important;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
          margin: 0 28px 16px !important;
          padding: 0 !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide) {
          background: transparent !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.095) !important;
          border-radius: 0 !important;
          margin: 0 !important;
          min-height: 48px !important;
          padding: 6px 4px !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):last-child {
          border-bottom: 0 !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover {
          background: linear-gradient(90deg, rgba(255, 124, 25, 0.065), transparent) !important;
          border-color: rgba(255, 153, 67, 0.2) !important;
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          background: transparent !important;
          border: 0 !important;
          color: #a8a19a !important;
        }

        html body .pf-page .pf-insights {
          top: 86px !important;
        }

        html body .pf-page .pf-insight-card {
          padding: 21px !important;
        }

        html body .pf-page .pf-help-card .pf-insight-action {
          margin-top: 18px !important;
          text-decoration: none !important;
        }

        html body .pf-page .pf-mfa-value {
          align-items: center !important;
          display: flex !important;
          gap: 10px !important;
          justify-content: flex-end !important;
        }

        html body .pf-page .pf-mfa-state {
          background: rgba(255, 255, 255, 0.055) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 999px !important;
          color: #aaa29a !important;
          font-size: 11px !important;
          font-weight: 850 !important;
          padding: 5px 10px !important;
          white-space: nowrap !important;
        }

        html body .pf-page .pf-mfa-state.is-enabled {
          background: rgba(68, 190, 88, 0.12) !important;
          border-color: rgba(78, 207, 100, 0.28) !important;
          color: #74df83 !important;
        }

        html body .pf-page .pf-mfa-manage-btn {
          min-width: 112px !important;
        }

        html body .pf-page .pf-mfa-modal {
          max-width: 580px !important;
          width: calc(100% - 28px) !important;
        }

        html body .pf-page .pf-mfa-options {
          display: grid !important;
          gap: 12px !important;
          margin: 22px 0 14px !important;
        }

        html body .pf-page .pf-mfa-options > button {
          align-items: center !important;
          background:
            linear-gradient(100deg, rgba(255, 128, 29, 0.1), rgba(255, 255, 255, 0.025)) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 12px !important;
          color: #f8f1ea !important;
          cursor: pointer !important;
          display: grid !important;
          gap: 13px !important;
          grid-template-columns: 48px minmax(0, 1fr) 20px !important;
          min-height: 88px !important;
          padding: 13px 15px !important;
          text-align: left !important;
          transition: border-color 160ms ease, transform 160ms ease !important;
        }

        html body .pf-page .pf-mfa-options > button:hover {
          border-color: rgba(255, 139, 42, 0.46) !important;
          transform: translateY(-1px) !important;
        }

        html body .pf-page .pf-mfa-option-icon {
          align-items: center !important;
          background: linear-gradient(145deg, #ff9d38, #d54b00) !important;
          border-radius: 11px !important;
          color: #fff !important;
          display: flex !important;
          height: 48px !important;
          justify-content: center !important;
          width: 48px !important;
        }

        html body .pf-page .pf-mfa-options strong,
        html body .pf-page .pf-mfa-options small {
          display: block !important;
        }

        html body .pf-page .pf-mfa-options strong {
          font-size: 14px !important;
          margin-bottom: 4px !important;
        }

        html body .pf-page .pf-mfa-options small {
          color: #a8a098 !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
        }

        html body .pf-page .pf-mfa-options .pf-mfa-option-arrow {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: currentColor !important;
          display: block !important;
          outline: 0 !important;
          padding: 0 !important;
        }

        html body .pf-page .pf-mfa-disable {
          background: transparent !important;
          border: 0 !important;
          color: #ff8e84 !important;
          cursor: pointer !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          padding: 10px !important;
          width: 100% !important;
        }

        html body .pf-page .pf-mfa-qr {
          background: #fff !important;
          border: 8px solid #fff !important;
          border-radius: 13px !important;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.38) !important;
          height: 220px !important;
          margin: 20px auto 14px !important;
          overflow: hidden !important;
          width: 220px !important;
        }

        html body .pf-page .pf-mfa-qr img {
          display: block !important;
          height: 100% !important;
          width: 100% !important;
        }

        html body .pf-page .pf-mfa-secret {
          background: rgba(255, 255, 255, 0.045) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 9px !important;
          display: grid !important;
          gap: 5px !important;
          margin: 0 auto 14px !important;
          max-width: 390px !important;
          padding: 10px 13px !important;
          text-align: center !important;
        }

        html body .pf-page .pf-mfa-secret span {
          color: #9f978f !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
        }

        html body .pf-page .pf-mfa-secret code {
          color: #ffb35d !important;
          font-size: 12px !important;
          overflow-wrap: anywhere !important;
        }

        html body .pf-page .pf-mfa-code-field {
          display: grid !important;
          gap: 7px !important;
          margin: 0 auto 17px !important;
          max-width: 300px !important;
        }

        html body .pf-page .pf-mfa-code-field span {
          color: #c5bdb5 !important;
          font-size: 12px !important;
          font-weight: 800 !important;
        }

        html body .pf-page .pf-mfa-code-field input {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 144, 49, 0.3) !important;
          border-radius: 9px !important;
          color: #fff !important;
          font-size: 24px !important;
          font-weight: 950 !important;
          letter-spacing: 0.28em !important;
          min-height: 52px !important;
          text-align: center !important;
        }

        @media (max-width: 1250px) {
          html body .pf-page .pf-layout {
            grid-template-columns: 230px minmax(0, 1fr) !important;
          }
        }

        @media (max-width: 900px) {
          html body .pf-page .pf-layout {
            grid-template-areas:
              "sidebar"
              "content" !important;
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 620px) {
          html body .pf-page .pf-profile-heading {
            margin: 4px 4px 15px !important;
          }

          html body .pf-page .pf-mfa-value {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          html body .pf-page .pf-mfa-options > button {
            grid-template-columns: 43px minmax(0, 1fr) !important;
          }

          html body .pf-page .pf-mfa-options > button > svg:last-child {
            display: none !important;
          }
        }

        /* Login palette for every profile tab and account surface. */
        html body .pf-page {
          --pf-auth-page: #071421;
          --pf-auth-surface: #0b151f;
          --pf-auth-surface-deep: #06101b;
          --pf-auth-input: rgba(3, 17, 29, 0.78);
          --pf-auth-line: rgba(112, 145, 175, 0.3);
          --pf-auth-line-soft: rgba(119, 147, 174, 0.2);
          --pf-auth-text: #f5f8fb;
          --pf-auth-muted: #93a5b8;
          --pf-auth-icon: #8fa2b5;
          --pf-auth-orange: var(--brand-primary, #ff7a18);
          --pf-auth-orange-light: var(--brand-accent, #ff8f20);
          background:
            radial-gradient(circle at 50% 8%, color-mix(in srgb, var(--pf-auth-orange) 8%, transparent), transparent 35%),
            var(--pf-auth-page) !important;
          color: var(--pf-auth-text) !important;
        }

        html body .pf-page .pf-sidebar,
        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section),
        html body .pf-page .pf-insight-card,
        html body .pf-page .pf-save-bar {
          background:
            radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--pf-auth-orange) 5%, transparent), transparent 38%),
            linear-gradient(155deg, var(--pf-auth-surface), var(--pf-auth-surface-deep)) !important;
          border-color: var(--pf-auth-line) !important;
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section)::before {
          background: linear-gradient(90deg, var(--pf-auth-orange), var(--pf-auth-orange-light), transparent 82%) !important;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section):hover {
          border-color: color-mix(in srgb, var(--pf-auth-orange) 42%, transparent) !important;
          box-shadow:
            0 27px 74px rgba(0, 0, 0, 0.36),
            0 0 0 1px color-mix(in srgb, var(--pf-auth-orange) 5%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        }

        html body .pf-page .pf-user-card {
          background:
            radial-gradient(220px 140px at 8% 0%, color-mix(in srgb, var(--pf-auth-orange) 12%, transparent), transparent 72%),
            linear-gradient(155deg, var(--pf-auth-surface), var(--pf-auth-surface-deep)) !important;
          border-bottom-color: var(--pf-auth-line-soft) !important;
        }

        html body .pf-page .pf-user-card::after {
          border-color: color-mix(in srgb, var(--pf-auth-orange) 18%, transparent) !important;
        }

        html body .pf-page .pf-avatar,
        html body .pf-page .pf-avatar-upload,
        html body .pf-page .profile-avatar-initial {
          background:
            radial-gradient(circle at 42% 24%, color-mix(in srgb, var(--pf-auth-orange) 18%, transparent), transparent 58%),
            var(--pf-auth-input) !important;
          border-color: var(--pf-auth-orange) !important;
        }

        html body .pf-page .pf-user-name,
        html body .pf-page :is(.pf-info-card-head h2, .pf-section-head h2),
        html body .pf-page .pf-insight-heading h2 {
          color: var(--pf-auth-text) !important;
        }

        html body .pf-page .pf-company-badge,
        html body .pf-page :is(.pf-info-card-head p, .pf-section-head p),
        html body .pf-page :is(.pf-info-label, .pf-field label),
        html body .pf-page .pf-insight-heading p,
        html body .pf-page .pf-completion-overview > div:last-child span,
        html body .pf-page .pf-last-updated {
          color: var(--pf-auth-muted) !important;
        }

        html body .pf-page .pf-nav-item {
          border-bottom-color: var(--pf-auth-line-soft) !important;
          color: var(--pf-auth-muted) !important;
        }

        html body .pf-page .pf-nav-item > svg:first-child {
          color: var(--pf-auth-icon) !important;
        }

        html body .pf-page .pf-nav-item:hover,
        html body .pf-page .pf-nav-active {
          background: linear-gradient(90deg, color-mix(in srgb, var(--pf-auth-orange) 18%, transparent), transparent 86%) !important;
          border-left-color: var(--pf-auth-orange) !important;
          color: var(--pf-auth-text) !important;
        }

        html body .pf-page .pf-nav-active::after {
          background: var(--pf-auth-orange) !important;
          box-shadow: 0 0 14px color-mix(in srgb, var(--pf-auth-orange) 52%, transparent) !important;
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          background: linear-gradient(90deg, color-mix(in srgb, var(--pf-auth-orange) 6%, transparent), transparent 48%) !important;
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg),
        html body .pf-page #julkinen-profiili .pf-section-head > svg,
        html body .pf-page .pf-insight-icon {
          background: color-mix(in srgb, var(--pf-auth-orange) 9%, transparent) !important;
          border-color: color-mix(in srgb, var(--pf-auth-orange) 48%, transparent) !important;
          color: var(--pf-auth-orange-light) !important;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
          background: transparent !important;
          border-color: var(--pf-auth-line-soft) !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide) {
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.018), transparent) !important;
          border-color: var(--pf-auth-line-soft) !important;
          border-bottom-color: var(--pf-auth-line-soft) !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover {
          background: linear-gradient(90deg, color-mix(in srgb, var(--pf-auth-orange) 6%, transparent), transparent) !important;
          border-color: color-mix(in srgb, var(--pf-auth-orange) 22%, transparent) !important;
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          background: var(--pf-auth-input) !important;
          border-color: var(--pf-auth-line) !important;
          color: var(--pf-auth-icon) !important;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover :is(.pf-info-row-icon, .pf-field-icon) {
          background: color-mix(in srgb, var(--pf-auth-orange) 10%, var(--pf-auth-input)) !important;
          border-color: color-mix(in srgb, var(--pf-auth-orange) 36%, transparent) !important;
          color: var(--pf-auth-orange-light) !important;
        }

        html body .pf-page :is(
          .pf-info-value input,
          .pf-info-value input:disabled,
          .pf-info-value > span,
          .pf-phone-number,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite input
        ) {
          color: var(--pf-auth-text) !important;
          -webkit-text-fill-color: var(--pf-auth-text) !important;
        }

        html body .pf-page :is(
          .pf-info-value input:not(:disabled):focus,
          #julkinen-profiili input:focus,
          #julkinen-profiili textarea:focus,
          #osoite input:focus
        ) {
          background: var(--pf-auth-input) !important;
          border-color: var(--pf-auth-orange) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-auth-orange) 14%, transparent) !important;
        }

        html body .pf-page :is(.pf-avatar-action, .pf-inline-btn, .company-seller-small-btn, .pf-logout-button) {
          background: var(--pf-auth-input) !important;
          border-color: var(--pf-auth-line) !important;
          color: #eff5fa !important;
        }

        html body .pf-page :is(.pf-inline-btn.verify, .company-seller-add-btn, .pf-save-btn) {
          background: linear-gradient(100deg, var(--pf-auth-orange-light), var(--pf-auth-orange)) !important;
          border-color: color-mix(in srgb, var(--pf-auth-orange-light) 62%, transparent) !important;
          box-shadow: 0 12px 26px color-mix(in srgb, var(--pf-auth-orange) 20%, transparent) !important;
          color: #ffffff !important;
        }

        html body .pf-page :is(.company-seller-card, .company-seller-add, .company-seller-empty),
        html body .pf-page :is(.pf-phone-modal, .pf-avatar-crop-modal) {
          background: var(--pf-auth-input) !important;
          border-color: var(--pf-auth-line) !important;
        }

        html body .pf-page .pf-modal-backdrop {
          background: rgba(2, 8, 14, 0.78) !important;
        }

        html body .pf-page .pf-password-field > span,
        html body .pf-page .pf-mfa-code-field span {
          color: #e4edf5 !important;
        }

        html body .pf-page :is(.pf-password-field input, .pf-mfa-code-field input) {
          background: var(--pf-auth-input) !important;
          border-color: var(--pf-auth-line) !important;
          color: var(--pf-auth-text) !important;
        }

        html body .pf-page :is(.pf-password-field input, .pf-mfa-code-field input):focus {
          border-color: var(--pf-auth-orange) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-auth-orange) 14%, transparent) !important;
        }
      `}</style>

    </main>
  );

}
