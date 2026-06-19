"use client";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { sanitizePhoneInput } from "@/lib/phone-input";
import { profilePath } from "@/lib/routes";

import {
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ExternalLink,
  FileText,
  Globe,
  Hash,
  Home,
  Info,
  Lock,
  LockKeyhole,
  Mail,
  Map,
  MapPin,
  Phone,
  Plus,
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
  getCompanySellers,
  getProfile,
  resetPassword,
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
  const profileText = {
    privateDetails: {
      fi: "Henkilökohtaiset tiedot",
      en: "Private details",
      sv: "Privata uppgifter",
      no: "Private opplysninger",
      et: "Privaatsed andmed"
    }[locale],
    accountHelp: {
      fi: "Katso ja hallitse henkilökohtaisia tietojasi.",
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
    publicProfile: { fi: "Julkinen profiili", en: "Public seller profile", sv: "Offentlig säljarprofil", no: "Offentlig selgerprofil", et: "Avalik müüja profiil" }[locale],
    profileDetails: { fi: "Profiilin tiedot", en: "Profile details", sv: "Profiluppgifter", no: "Profildetaljer", et: "Profiili andmed" }[locale],
    addressDetails: { fi: "Osoitetiedot", en: "Address details", sv: "Adressuppgifter", no: "Adresseopplysninger", et: "Aadressiandmed" }[locale],
    publicHelp: {
      fi: "Nämä tiedot näkyvät muille Marketplace-käyttäjille.",
      en: "Name, ID, exact address and your intro are shown publicly.",
      sv: "Namn, ID, exakt adress och din presentation visas offentligt.",
      no: "Navn, ID, nøyaktig adresse og introduksjonen din vises offentlig.",
      et: "Avalikult kuvatakse nimi, ID, täpne aadress ja sinu tutvustus."
    }[locale],
    publicVisibilityNote: {
      fi: "Julkiset tiedot näkyvät kaikille Marketplace-käyttäjille.",
      en: "Public details are visible to all Marketplace users.",
      sv: "Offentliga uppgifter visas för alla Marketplace-användare.",
      no: "Offentlige opplysninger vises for alle Marketplace-brukere.",
      et: "Avalikud andmed on nähtavad kõigile Marketplace'i kasutajatele."
    }[locale],
    moreInfo: {
      fi: "Lisätietoja",
      en: "More info",
      sv: "Mer information",
      no: "Mer informasjon",
      et: "Lisainfo"
    }[locale],
    publicName: { fi: "Näyttönimi", en: "Public name", sv: "Offentligt namn", no: "Offentlig navn", et: "Avalik nimi" }[locale],
    publicBio: {
      fi: "Tietoa minusta",
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
    publicAddress: {
      fi: "Yrityksen osoite",
      en: "Public exact address",
      sv: "Offentlig exakt adress",
      no: "Offentlig nøyaktig adresse",
      et: "Avalik täpne aadress"
    }[locale],
    publicAddressPlaceholder: {
      fi: "Esim. Varaosatie 4, 71800 Siilinjärvi",
      en: "E.g. Spare Parts Road 4, 71800 Siilinjarvi",
      sv: "T.ex. Reservdelsvägen 4, 71800 Siilinjärvi",
      no: "F.eks. Deleveien 4, 71800 Siilinjärvi",
      et: "Nt Varuosatee 4, 71800 Siilinjärvi"
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
      fi: "Yrityksen numeroa ei tarvitse vahvistaa ilmoitusten julkaisua varten.",
      en: "The company number does not need to be verified for publishing listings.",
      sv: "Företagets nummer behöver inte bekräftas för att publicera annonser.",
      no: "Bedriftens nummer trenger ikke å bekreftes for å publisere annonser.",
      et: "Ettevõtte numbrit ei pea kuulutuste avaldamiseks kinnitama."
    }[locale],
    companySellersTitle: {
      fi: "Yrityksen myyjät",
      en: "Company sellers",
      sv: "Företagets säljare",
      no: "Bedriftens selgere",
      et: "Ettevõtte müüjad"
    }[locale],
    companySellersHelp: {
      fi: "Lisää halutessasi yritykselle myyjiä. Ilmoitus voidaan julkaista myös yrityksen omilla tiedoilla.",
      en: "Optionally add company sellers. Listings can also be published with the company details.",
      sv: "Lägg till företagets säljare vid behov. Annonser kan också publiceras med företagets uppgifter.",
      no: "Legg til bedriftens selgere ved behov. Annonser kan også publiseres med bedriftens opplysninger.",
      et: "Soovi korral lisa ettevõtte müüjaid. Kuulutusi saab avaldada ka ettevõtte andmetega."
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
      fi: "Ei erillisiä myyjiä vielä. Ilmoituksissa käytetään yrityksen tietoja.",
      en: "No separate sellers yet. Listings use the company details.",
      sv: "Inga separata säljare ännu. Annonser använder företagets uppgifter.",
      no: "Ingen egne selgere ennå. Annonser bruker bedriftens opplysninger.",
      et: "Eraldi müüjaid pole veel. Kuulutustes kasutatakse ettevõtte andmeid."
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
    close: {
      fi: "Sulje",
      en: "Close",
      sv: "Stäng",
      no: "Lukk",
      et: "Sulge"
    }[locale],
    addPhoto: {
      fi: "Lisää kuva",
      en: "Add photo",
      sv: "Lägg till bild",
      no: "Legg til bilde",
      et: "Lisa pilt"
    }[locale],
    remove: {
      fi: "Poista",
      en: "Remove",
      sv: "Ta bort",
      no: "Fjern",
      et: "Eemalda"
    }[locale],
    editProfilePhoto: {
      fi: "Muokkaa profiilikuvaa",
      en: "Edit profile photo",
      sv: "Redigera profilbild",
      no: "Rediger profilbilde",
      et: "Muuda profiilipilti"
    }[locale],
    avatarCropHelp: {
      fi: "Zoomaa ja raahaa kuva sopivaan kohtaan.",
      en: "Zoom and drag the photo into position.",
      sv: "Zooma och dra bilden till rätt läge.",
      no: "Zoom og dra bildet til riktig posisjon.",
      et: "Suumi ja lohista pilt sobivasse kohta."
    }[locale],
    saving: {
      fi: "Tallennetaan...",
      en: "Saving...",
      sv: "Sparar...",
      no: "Lagrer...",
      et: "Salvestatakse..."
    }[locale],
    savePhoto: {
      fi: "Tallenna kuva",
      en: "Save photo",
      sv: "Spara bild",
      no: "Lagre bilde",
      et: "Salvesta pilt"
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
    accountSecurity: {
      fi: "Tilin turvallisuus",
      en: "Account security",
      sv: "Kontosäkerhet",
      no: "Kontosikkerhet",
      et: "Konto turvalisus"
    }[locale],
    passwordHelp: {
      fi: "Laheta salasanan vaihtolinkki tilisi sahkopostiin.",
      en: "Send a password change link to your account email.",
      sv: "Skicka en lank for att byta losenord till kontots e-post.",
      no: "Send en lenke for passordbytte til kontoens e-post.",
      et: "Saada parooli muutmise link konto e-posti aadressile."
    }[locale],
    passwordEmail: {
      fi: "Tilin sahkoposti",
      en: "Account email",
      sv: "Kontots e-post",
      no: "Kontoens e-post",
      et: "Konto e-post"
    }[locale],
    sendPasswordLink: {
      fi: "Vaihda salasana",
      en: "Change password",
      sv: "Byt losenord",
      no: "Bytt passord",
      et: "Muuda parooli"
    }[locale],
    passwordLinkSent: {
      fi: "Salasanan vaihtolinkki lahetetty sahkopostiisi.",
      en: "Password change link sent to your email.",
      sv: "Lanken for att byta losenord har skickats.",
      no: "Lenke for passordbytte er sendt til e-posten din.",
      et: "Parooli muutmise link saadeti sinu e-posti."
    }[locale],
    passwordLinkSending: {
      fi: "Lahetetaan linkkia...",
      en: "Sending link...",
      sv: "Skickar lank...",
      no: "Sender lenke...",
      et: "Saadan linki..."
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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSending, setPasswordSending] = useState(false);
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

  useEffect(() => {

    if (!user) return;

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
        setProfile(null);
        setProfileLoaded(true);
      });

  }, [user]);

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
    if (!profile?.email || passwordSending) return;
    setPasswordSending(true);
    setPasswordStatus(profileText.passwordLinkSending);
    const { error } = await resetPassword(profile.email);
    if (error) {
      setPasswordStatus(getErrorMessage(error));
      setPasswordSending(false);
      return;
    }
    setPasswordStatus(profileText.passwordLinkSent);
    setPasswordSending(false);
  }

  async function requestCompanyVerification() {
    if (!supabase || !user || !profile || profile.account_type !== "company") return;
    if (profile.company_verified_at || companyVerifySaving) return;

    setCompanyVerifySaving(true);
    setCompanyVerifyStatus("Lähetetään pyyntöä...");

    const requestedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("profiles")
      .update({ company_verification_requested_at: requestedAt })
      .eq("id", user.id)
      .select()
      .single<UserProfile>();

    if (error) {
      setCompanyVerifyStatus(getErrorMessage(error));
      setCompanyVerifySaving(false);
      return;
    }

    setProfile(data);
    writeCachedResource(`profile:${user.id}`, data);
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

    const { data, error } =
      await supabase
        .from("profiles")
        .update({
          phone: nextPhone,
          phone_verified_at: new Date().toISOString(),
          pending_phone: null
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

  const companyWebsiteHref =
    formatWebsiteHref(profile?.company_website);

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
                  {profileText.addPhoto}
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
          </nav>
        </aside>

        {/* Main content */}
        <div className="pf-content">
          {profile && (
            <div className="pf-profile-heading">
              <h1>
                {profile.account_type === "company"
                  ? "Yritysprofiili"
                  : "Yksityisprofiili"}
              </h1>
              <p>
                {profile.account_type === "company"
                  ? "Hallitse yrityksesi tietoja ja paranna näkyvyyttäsi ostajien keskuudessa."
                  : "Hallitse profiilisi tietoja ja pidä julkiset tiedot ajan tasalla."}
              </p>
            </div>
          )}

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
                            title={phoneChangeLocked ? phoneChangeLockText : "Vaihda puhelinnumero"}
                          >
                            {profileText.change}
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                  )}
                  {profile.account_type === "private" && (
                    <div className="pf-info-row pf-phone-info-row">
                      <span className="pf-info-row-icon">
                        <CalendarDays size={19} />
                      </span>
                      <span className="pf-info-label">{profileText.birthDate}</span>
                      <div className="pf-info-value">
                        <span>{formatBirthDate(profile.birth_date)}</span>
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
                        value={profile.business_id ?? ""}
                        onChange={e => setProfile({ ...profile, business_id: e.target.value })}
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
                            title={phoneChangeLocked ? phoneChangeLockText : "Vaihda puhelinnumero"}
                          >
                            {profileText.change}
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
                              inputMode="tel"
                              pattern="[+0-9]*"
                              value={sellerEditDraft.phone}
                              onChange={(event) => setSellerEditDraft({ ...sellerEditDraft, phone: sanitizePhoneInput(event.target.value) })}
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
                          inputMode="tel"
                          pattern="[+0-9]*"
                          value={sellerDraft.phone}
                          disabled={companySellers.length >= 8}
                          onChange={(event) => setSellerDraft({ ...sellerDraft, phone: sanitizePhoneInput(event.target.value) })}
                          placeholder="+358401234567"
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
                        value={profile.address ?? ""}
                        onChange={e => setProfile({ ...profile, address: e.target.value })}
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
                        value={profile.city ?? ""}
                        onChange={e => setProfile({ ...profile, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="pf-info-row">
                    <span className="pf-info-row-icon">
                      <Globe size={16} />
                    </span>
                    <span className="pf-info-label">{profileText.country}</span>
                    <div className="pf-info-value">
                      <input
                        value={profile.country ?? ""}
                        onChange={e => setProfile({ ...profile, country: e.target.value })}
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
                        <span className="pf-security-status">{passwordStatus}</span>
                      )}
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
              Vaihda puhelinnumero
            </h2>
            <p>
              Puhelinnumero tallennetaan profiiliisi ilman SMS-vahvistusta.
            </p>
            <div className="pf-phone-edit">
              <input
                ref={phoneInputRef}
                type="tel"
                inputMode="tel"
                pattern="[+0-9]*"
                value={phoneDraft}
                onChange={(event) =>
                  setPhoneDraft(sanitizePhoneInput(event.target.value))
                }
                placeholder="+358401234567"
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
        #osoite input {
          grid-column: 3 !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        .pf-info-value input,
        .pf-info-value input:disabled,
        .pf-info-value > span,
        .pf-phone-number,
        #julkinen-profiili .pf-locked input,
        #julkinen-profiili .pf-locked input:disabled,
        #julkinen-profiili .pf-readonly-value,
        #julkinen-profiili .pf-readonly-value span,
        #julkinen-profiili input,
        #julkinen-profiili textarea,
        #osoite input {
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
          #osoite input {
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

        .pf-info-value input,
        .pf-info-value input:disabled,
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

        .pf-page :is(.pf-info-value, #julkinen-profiili .pf-locked, #julkinen-profiili .pf-readonly-value, #julkinen-profiili input, #julkinen-profiili textarea, #osoite input) {
          align-items: center !important;
          display: flex !important;
          grid-column: 3 !important;
          min-height: 0 !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        .pf-page :is(
          .pf-info-value input,
          .pf-info-value input:disabled,
          .pf-info-value > span,
          .pf-phone-number,
          #julkinen-profiili .pf-locked input,
          #julkinen-profiili .pf-locked input:disabled,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili .pf-readonly-value span,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite input
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

        .pf-page :is(#julkinen-profiili input:focus, #julkinen-profiili textarea:focus, #osoite input:focus, .pf-info-value input:focus) {
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

          .pf-page :is(.pf-info-value, #julkinen-profiili .pf-locked, #julkinen-profiili .pf-readonly-value, #julkinen-profiili input, #julkinen-profiili textarea, #osoite input) {
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
          #osoite input
        ) {
          justify-content: flex-start !important;
          justify-self: start !important;
          text-align: left !important;
        }

        .pf-page :is(
          .pf-info-value input,
          .pf-info-value input:disabled,
          .pf-info-value > span,
          .pf-phone-number,
          #julkinen-profiili .pf-locked input,
          #julkinen-profiili .pf-locked input:disabled,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili .pf-readonly-value span,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite input
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
        .pf-page #osoite .pf-info-value :is(input, span),
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
          .pf-info-value input,
          .pf-info-value input:disabled,
          .pf-info-value > span,
          .pf-phone-number,
          #julkinen-profiili .pf-locked input,
          #julkinen-profiili .pf-locked input:disabled,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili .pf-readonly-value span,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite input
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

    </main>
  );

}
