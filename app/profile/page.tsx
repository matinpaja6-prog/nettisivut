"use client";
import "@/app/styles/generated/profile.css";
import UiText from "@/app/components/UiText";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import Link from "@/app/components/LocalizedLink";
import { useRouter } from "@/lib/navigation";
import { useLanguage, type Locale } from "@/lib/i18n";
import { sanitizePhoneInput } from "@/lib/phone-input";
import { pagePath, profilePath } from "@/lib/routes";

import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  ChevronDown,
  CreditCard,
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
  LoaderCircle,
  Mail,
  Map,
  MapPin,
  Phone,
  Plus,
  QrCode,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCircle,
  Users,
  WalletCards,
  X
} from "lucide-react";

import type { User } from "@supabase/supabase-js";
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";
import type { Company } from "@/lib/commerce/types";
import {
  missingCompanyVerificationFields,
  type CompanyVerificationRequiredField
} from "@/lib/company-verification-requirements";

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

type MfaSetupStep = "choose" | "totp" | null;
type PasswordChangeStep = "code" | "password" | null;

type EmbeddedCheckoutInstance = {
  mount: (selector: string | HTMLElement) => void;
  destroy: () => void;
};

type StripeBrowserClient = {
  initEmbeddedCheckout: (options: { fetchClientSecret: () => Promise<string> }) => Promise<EmbeddedCheckoutInstance>;
};

declare global {
  interface Window {
    Stripe?: (publishableKey: string, options?: { stripeAccount?: string }) => StripeBrowserClient;
  }
}

let stripeJsPromise: Promise<void> | null = null;

function loadStripeJs(errorMessage: string) {
  if (typeof window === "undefined" || window.Stripe) return Promise.resolve();
  if (stripeJsPromise) return stripeJsPromise;

  stripeJsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/clover/stripe.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(errorMessage)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.stripe.com/clover/stripe.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(errorMessage));
    document.head.appendChild(script);
  });

  return stripeJsPromise;
}

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

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

function preserveEditableProfileDraft(server: UserProfile, draft: UserProfile): UserProfile {
  return {
    ...server,
    address: draft.address,
    postal_code: draft.postal_code,
    city: draft.city,
    country: draft.country,
    company_name: draft.company_name,
    business_id: draft.business_id,
    company_website: draft.company_website,
    public_address: draft.public_address,
    billing_email: draft.billing_email,
    bio: draft.bio
  };
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

const companyVerificationText = {
  fi: {
    close: "Sulje", price: "19,99 €", verificationSection: "Yrityksen vahvistus", awaitingReview: "Odottaa käsittelyä", verifyCompanyAction: "Vahvista yritys", secureCheckout: "Maskines turvallinen kassa", finishTitle: "Viimeistele yritysvahvistus",
    finishDescription: "Valitse sinulle sopiva maksutapa ja maksa turvallisesti poistumatta Maskinesista.",
    orderSummary: "Tilauksen yhteenveto", companyToVerify: "Vahvistettava yritys", companyFallback: "Yritys",
    businessIdMissing: "Y-tunnus puuttuu", verificationProduct: "Maskines yritysvahvistus",
    manualReview: "Yritystietojen manuaalinen tarkistus", amountDue: "Maksettavaa",
    protectedStripe: "Suojattu Stripe-maksu", oneTimeNoMonthly: "Kertamaksu, ei kuukausimaksua",
    paidToMaskines: "Maksu suoritetaan Maskinesille", paymentMethods: "Maksutavat", paymentMethod: "Maksutapa",
    chooseMethod: "Valitse käytettävissä olevista vaihtoehdoista", secure: "Suojattu", title: "Vahvista yrityksesi",
    description: "Tee yrityksestäsi luotettavampi ostajille ja ota kaikki Maskinesin yritysominaisuudet käyttöön yhdellä vahvistuksella.",
    paymentReceived: "Maksu vastaanotettu", pendingReview: "Yrityksesi tiedot odottavat Maskinesin tarkistusta.",
    verifiedCompany: "Vahvistettu yritys", verifiedCompanyDescription: "Manuaalinen yritystietojen tarkistus ja vahvistusmerkki",
    paymentsAccess: "Maksupalveluiden käyttö", paymentsAccessDescription: "Ota Maskinesin turvalliset maksutavat yrityksesi käyttöön",
    premiumProfile: "Premium-yritysprofiili", premiumProfileDescription: "Arvokkaampi profiili ja parempi luottamus ostajien silmissä",
    companyManagement: "Yrityksen hallinta", companyManagementDescription: "Hallinnoi yritystä, myyjiä ja kaupankäyntiä yhdessä paikassa",
    verificationTitle: "Yritysvahvistus", allFeatures: "Kaikki vahvistetun yrityksen ominaisuudet", oneTimePayment: "Kertamaksu",
    disclaimer: "Ei kuukausimaksua. Maksu kattaa yritystietojen tarkistuksen eikä takaa hyväksyntää. Maksu suoritetaan Maskinesille turvallisesti Stripen kautta.",
    preparingPayment: "Valmistellaan maksua", keepOpen: "Pidä tämä ikkuna avoinna. Tässä kestää yleensä vain hetki.",
    retryPayment: "Yritä maksua uudelleen · 19,99 €", continuePayment: "Jatka maksuun · 19,99 €", paymentFailed: "Maksu epäonnistui",
    paymentCancelled: "Maksu keskeytettiin. Yritysvahvistusta ei veloitettu.",
    returnIncomplete: "Maksun paluutiedot olivat puutteelliset. Maksua ei merkitty käsitellyksi.",
    checkingPayment: "Tarkistetaan maksun tila...", loginExpired: "Kirjautuminen ei ole voimassa.",
    confirmFailed: "Maksun vahvistaminen epäonnistui.", confirmationTakingLong: "Maksu on vastaanotettu, mutta vahvistuksen päivittyminen kestää tavallista pidempään. Voit sulkea ikkunan ja jatkaa sivun käyttöä.", paymentReceivedStatus: "Maksu vastaanotettu. Yrityksesi tiedot ovat nyt tarkistettavana.",
    openingPayment: "Avataan turvallista maksua...", openPaymentFailed: "Maksusivua ei voitu avata.", paymentServiceLoadFailed: "Maksupalvelun lataaminen epäonnistui."
  },
  en: {
    close: "Close", price: "€19.99", verificationSection: "Company verification", awaitingReview: "Awaiting review", verifyCompanyAction: "Verify company", secureCheckout: "Maskines secure checkout", finishTitle: "Complete company verification",
    finishDescription: "Choose a suitable payment method and pay securely without leaving Maskines.",
    orderSummary: "Order summary", companyToVerify: "Company to verify", companyFallback: "Company",
    businessIdMissing: "Business ID missing", verificationProduct: "Maskines company verification",
    manualReview: "Manual review of company details", amountDue: "Amount due",
    protectedStripe: "Protected Stripe payment", oneTimeNoMonthly: "One-time payment, no monthly fee",
    paidToMaskines: "Payment is made to Maskines", paymentMethods: "Payment methods", paymentMethod: "Payment method",
    chooseMethod: "Choose from the available options", secure: "Secure", title: "Verify your company",
    description: "Build buyer trust and unlock all Maskines company features with one verification.",
    paymentReceived: "Payment received", pendingReview: "Your company details are awaiting review by Maskines.",
    verifiedCompany: "Verified company", verifiedCompanyDescription: "Manual company-detail review and a verification badge",
    paymentsAccess: "Access to payment services", paymentsAccessDescription: "Enable Maskines secure payment methods for your company",
    premiumProfile: "Premium company profile", premiumProfileDescription: "A more professional profile and stronger buyer trust",
    companyManagement: "Company management", companyManagementDescription: "Manage your company, sellers and commerce in one place",
    verificationTitle: "Company verification", allFeatures: "All verified-company features", oneTimePayment: "One-time payment",
    disclaimer: "No monthly fee. The payment covers review of the company details and does not guarantee approval. Payment is made securely to Maskines through Stripe.",
    preparingPayment: "Preparing payment", keepOpen: "Keep this window open. This usually takes only a moment.",
    retryPayment: "Try payment again · €19.99", continuePayment: "Continue to payment · €19.99", paymentFailed: "Payment failed",
    paymentCancelled: "Payment was cancelled. You were not charged for company verification.",
    returnIncomplete: "The payment return details were incomplete. The payment was not marked as processed.",
    checkingPayment: "Checking payment status...", loginExpired: "Your sign-in session is no longer valid.",
    confirmFailed: "Payment confirmation failed.", confirmationTakingLong: "Your payment was received, but the verification update is taking longer than usual. You can close this window and continue using the site.", paymentReceivedStatus: "Payment received. Your company details are now being reviewed.",
    openingPayment: "Opening secure payment...", openPaymentFailed: "The payment page could not be opened.", paymentServiceLoadFailed: "The payment service could not be loaded."
  },
  sv: {
    close: "Stäng", price: "19,99 €", verificationSection: "Företagsverifiering", awaitingReview: "Väntar på granskning", verifyCompanyAction: "Verifiera företag", secureCheckout: "Maskines säkra kassa", finishTitle: "Slutför företagsverifieringen",
    finishDescription: "Välj ett lämpligt betalningssätt och betala säkert utan att lämna Maskines.",
    orderSummary: "Ordersammanfattning", companyToVerify: "Företag som ska verifieras", companyFallback: "Företag",
    businessIdMissing: "Organisationsnummer saknas", verificationProduct: "Maskines företagsverifiering",
    manualReview: "Manuell granskning av företagsuppgifter", amountDue: "Att betala",
    protectedStripe: "Skyddad Stripe-betalning", oneTimeNoMonthly: "Engångsbetalning, ingen månadsavgift",
    paidToMaskines: "Betalningen görs till Maskines", paymentMethods: "Betalningssätt", paymentMethod: "Betalningssätt",
    chooseMethod: "Välj bland tillgängliga alternativ", secure: "Säker", title: "Verifiera ditt företag",
    description: "Öka köparnas förtroende och lås upp alla företagsfunktioner i Maskines med en verifiering.",
    paymentReceived: "Betalning mottagen", pendingReview: "Dina företagsuppgifter väntar på granskning av Maskines.",
    verifiedCompany: "Verifierat företag", verifiedCompanyDescription: "Manuell granskning av företagsuppgifter och verifieringsmärke",
    paymentsAccess: "Tillgång till betaltjänster", paymentsAccessDescription: "Aktivera Maskines säkra betalningssätt för ditt företag",
    premiumProfile: "Premium-företagsprofil", premiumProfileDescription: "En mer professionell profil och större förtroende hos köpare",
    companyManagement: "Företagshantering", companyManagementDescription: "Hantera företag, säljare och handel på ett ställe",
    verificationTitle: "Företagsverifiering", allFeatures: "Alla funktioner för verifierade företag", oneTimePayment: "Engångsbetalning",
    disclaimer: "Ingen månadsavgift. Betalningen täcker granskningen av företagsuppgifterna och garanterar inte godkännande. Betalningen görs säkert till Maskines via Stripe.",
    preparingPayment: "Förbereder betalningen", keepOpen: "Håll fönstret öppet. Det tar vanligtvis bara ett ögonblick.",
    retryPayment: "Försök betala igen · 19,99 €", continuePayment: "Fortsätt till betalning · 19,99 €", paymentFailed: "Betalningen misslyckades",
    paymentCancelled: "Betalningen avbröts. Du debiterades inte för företagsverifieringen.",
    returnIncomplete: "Betalningens returuppgifter var ofullständiga. Betalningen markerades inte som behandlad.",
    checkingPayment: "Kontrollerar betalningsstatus...", loginExpired: "Din inloggningssession är inte längre giltig.",
    confirmFailed: "Betalningen kunde inte bekräftas.", confirmationTakingLong: "Betalningen har mottagits, men verifieringsuppdateringen tar längre tid än vanligt. Du kan stänga fönstret och fortsätta använda sidan.", paymentReceivedStatus: "Betalningen har mottagits. Dina företagsuppgifter granskas nu.",
    openingPayment: "Öppnar säker betalning...", openPaymentFailed: "Betalningssidan kunde inte öppnas.", paymentServiceLoadFailed: "Betaltjänsten kunde inte laddas."
  },
  no: {
    close: "Lukk", price: "19,99 €", verificationSection: "Bedriftsverifisering", awaitingReview: "Venter på kontroll", verifyCompanyAction: "Verifiser bedrift", secureCheckout: "Maskines sikre betaling", finishTitle: "Fullfør bedriftsverifiseringen",
    finishDescription: "Velg en passende betalingsmåte og betal sikkert uten å forlate Maskines.",
    orderSummary: "Ordresammendrag", companyToVerify: "Bedrift som skal verifiseres", companyFallback: "Bedrift",
    businessIdMissing: "Organisasjonsnummer mangler", verificationProduct: "Maskines bedriftsverifisering",
    manualReview: "Manuell kontroll av bedriftsopplysninger", amountDue: "Til betaling",
    protectedStripe: "Beskyttet Stripe-betaling", oneTimeNoMonthly: "Engangsbetaling, ingen månedsavgift",
    paidToMaskines: "Betalingen gjøres til Maskines", paymentMethods: "Betalingsmåter", paymentMethod: "Betalingsmåte",
    chooseMethod: "Velg blant tilgjengelige alternativer", secure: "Sikker", title: "Verifiser bedriften din",
    description: "Bygg tillit hos kjøpere og lås opp alle bedriftsfunksjonene i Maskines med én verifisering.",
    paymentReceived: "Betaling mottatt", pendingReview: "Bedriftsopplysningene dine venter på kontroll hos Maskines.",
    verifiedCompany: "Verifisert bedrift", verifiedCompanyDescription: "Manuell kontroll av bedriftsopplysninger og verifiseringsmerke",
    paymentsAccess: "Tilgang til betalingstjenester", paymentsAccessDescription: "Aktiver Maskines sine sikre betalingsmåter for bedriften",
    premiumProfile: "Premium-bedriftsprofil", premiumProfileDescription: "En mer profesjonell profil og større tillit hos kjøpere",
    companyManagement: "Bedriftsadministrasjon", companyManagementDescription: "Administrer bedrift, selgere og handel på ett sted",
    verificationTitle: "Bedriftsverifisering", allFeatures: "Alle funksjoner for verifiserte bedrifter", oneTimePayment: "Engangsbetaling",
    disclaimer: "Ingen månedsavgift. Betalingen dekker kontroll av bedriftsopplysningene og garanterer ikke godkjenning. Betalingen gjøres sikkert til Maskines via Stripe.",
    preparingPayment: "Forbereder betaling", keepOpen: "Hold vinduet åpent. Dette tar vanligvis bare et øyeblikk.",
    retryPayment: "Prøv betalingen på nytt · 19,99 €", continuePayment: "Fortsett til betaling · 19,99 €", paymentFailed: "Betalingen mislyktes",
    paymentCancelled: "Betalingen ble avbrutt. Du ble ikke belastet for bedriftsverifiseringen.",
    returnIncomplete: "Returdataene fra betalingen var ufullstendige. Betalingen ble ikke markert som behandlet.",
    checkingPayment: "Kontrollerer betalingsstatus...", loginExpired: "Innloggingen din er ikke lenger gyldig.",
    confirmFailed: "Betalingen kunne ikke bekreftes.", confirmationTakingLong: "Betalingen er mottatt, men verifiseringsoppdateringen tar lengre tid enn vanlig. Du kan lukke vinduet og fortsette å bruke siden.", paymentReceivedStatus: "Betalingen er mottatt. Bedriftsopplysningene dine blir nå kontrollert.",
    openingPayment: "Åpner sikker betaling...", openPaymentFailed: "Betalingssiden kunne ikke åpnes.", paymentServiceLoadFailed: "Betalingstjenesten kunne ikke lastes inn."
  }
} as const;

export default function ProfilePage() {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const companyVerifyText = companyVerificationText[locale];
  const companyVerificationRequirementsText = {
    fi: { title: "Täydennä yritystiedot", prefix: "Täytä seuraavat tiedot ennen vahvistusta", save: "Tallenna yritystietojen muutokset ennen vahvistusta." },
    en: { title: "Complete company details", prefix: "Complete these details before verification", save: "Save the company-detail changes before verification." },
    sv: { title: "Fyll i företagsuppgifterna", prefix: "Fyll i följande uppgifter före verifieringen", save: "Spara ändringarna i företagsuppgifterna före verifieringen." },
    no: { title: "Fullfør bedriftsopplysningene", prefix: "Fyll inn disse opplysningene før verifisering", save: "Lagre endringene i bedriftsopplysningene før verifisering." }
  }[locale];
  const authPagePath = pagePath("auth", locale);
  const profileText = {
    privateDetails: {
      fi: "Käyttäjän tiedot",
      en: "User details",
      sv: "Användaruppgifter",
      no: "Brukeropplysninger",
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
    fullName: { fi: "Etu- ja sukunimi", en: "First and last name", sv: "För- och efternamn",
      no: "For- og etternavn",
    }[locale],
    email: { fi: "Sähköpostiosoite", en: "Email address", sv: "E-postadress",
      no: "E-postadresse",
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
  const [commerceCompany, setCommerceCompany] = useState<Company | null>(null);
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
  const [companyVerifyConfirming, setCompanyVerifyConfirming] = useState(false);
  const [companyVerifyStatus, setCompanyVerifyStatus] = useState("");
  const [companyVerifyClientSecret, setCompanyVerifyClientSecret] = useState("");
  const [companyVerifyPublishableKey, setCompanyVerifyPublishableKey] = useState("");
  const companyVerifyPaymentMountRef = useRef<HTMLDivElement | null>(null);
  const companyVerifyCheckoutRef = useRef<EmbeddedCheckoutInstance | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarCropPreview, setAvatarCropPreview] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1.12);
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarDragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const profileLoadGenerationRef = useRef(0);
  const profileDraftEditedRef = useRef(false);
  const companyVerificationReturnHandledRef = useRef(false);
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneStatus, setPhoneStatus] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailChangeStep, setEmailChangeStep] = useState<"email" | "code">("email");
  const [emailDraft, setEmailDraft] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailChallenge, setEmailChallenge] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
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

  function updateProfileDraft(values: Partial<UserProfile>) {
    profileDraftEditedRef.current = true;
    setProfile((current) => current ? { ...current, ...values } : current);
  }
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
    if (
      !profile ||
      profile.account_type !== "company" ||
      profile.company_verified_at ||
      typeof window === "undefined"
    ) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("verifyCompany") !== "1") return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("tilin-turvallisuus")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      if (!profile.company_verification_requested_at) {
        setCompanyVerifyStatus("");
        setCompanyVerifyModalOpen(true);
      }

      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}#tilin-turvallisuus`
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [profile]);

  const companyVerificationProfileId = profile?.id ?? "";
  const companyVerificationAccountType = profile?.account_type ?? null;
  const companyVerificationUserId = user?.id ?? "";
  const companyVerificationForcedOpen = Boolean(
    profile?.account_type === "company" &&
    !profile.company_verified_at &&
    !profile.company_verification_requested_at &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("verifyCompany") === "1"
  );

  useEffect(() => {
    if (
      companyVerificationReturnHandledRef.current ||
      !supabase ||
      !companyVerificationUserId ||
      !companyVerificationProfileId ||
      companyVerificationAccountType !== "company" ||
      typeof window === "undefined"
    ) return;

    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get("companyVerification");
    if (!paymentResult) return;

    companyVerificationReturnHandledRef.current = true;
    setCompanyVerifyModalOpen(true);

    if (paymentResult === "cancelled") {
      setCompanyVerifyStatus(companyVerifyText.paymentCancelled);
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}#tilin-turvallisuus`
      );
      return;
    }

    const sessionId = params.get("session_id") ?? "";
    if (paymentResult !== "success" || !sessionId) {
      setCompanyVerifyStatus(companyVerifyText.returnIncomplete);
      return;
    }

    let cancelled = false;
    let confirmTimeout: ReturnType<typeof setTimeout> | null = null;
    setCompanyVerifySaving(true);
    setCompanyVerifyConfirming(true);
    setCompanyVerifyStatus(companyVerifyText.checkingPayment);

    void supabase.auth.getSession()
      .then(async ({ data, error }) => {
        if (error || !data.session?.access_token) {
          throw error ?? new Error(companyVerifyText.loginExpired);
        }

        const controller = new AbortController();
        confirmTimeout = setTimeout(() => controller.abort(), 15000);
        let response: Response;
        try {
          response = await fetch("/api/company-verification/confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`
            },
            body: JSON.stringify({ sessionId, locale }),
            signal: controller.signal
          });
        } catch (requestError) {
          if (!controller.signal.aborted) throw requestError;

          const { data: timedOutProfile, error: timedOutProfileError } = await getProfile(companyVerificationUserId);
          if (timedOutProfileError) throw timedOutProfileError;
          if (!timedOutProfile?.company_verification_requested_at) {
            throw new Error(companyVerifyText.confirmationTakingLong);
          }

          if (!cancelled) {
            setProfile(timedOutProfile);
            writeCachedResource(`profile:${companyVerificationUserId}`, timedOutProfile);
            setCompanyVerifyStatus(companyVerifyText.paymentReceivedStatus);
            window.history.replaceState(
              window.history.state,
              "",
              `${window.location.pathname}#tilin-turvallisuus`
            );
          }
          return;
        } finally {
          if (confirmTimeout) {
            clearTimeout(confirmTimeout);
            confirmTimeout = null;
          }
        }
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(body.error || companyVerifyText.confirmFailed);

        const { data: refreshedProfile, error: profileError } = await getProfile(companyVerificationUserId);
        if (profileError) throw profileError;
        if (cancelled) return;

        if (refreshedProfile) {
          setProfile(refreshedProfile);
          writeCachedResource(`profile:${companyVerificationUserId}`, refreshedProfile);
        }
        setCompanyVerifyStatus(companyVerifyText.paymentReceivedStatus);
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}#tilin-turvallisuus`
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setCompanyVerifyStatus(getErrorMessage(error));
          window.history.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}#tilin-turvallisuus`
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompanyVerifySaving(false);
          setCompanyVerifyConfirming(false);
        }
      });

    return () => {
      cancelled = true;
      if (confirmTimeout) clearTimeout(confirmTimeout);
    };
  }, [companyVerificationAccountType, companyVerificationProfileId, companyVerificationUserId, companyVerifyText]);

  useEffect(() => {
    if (
      !companyVerifyModalOpen ||
      !companyVerifyClientSecret ||
      !companyVerifyPublishableKey ||
      !companyVerifyPaymentMountRef.current
    ) return;

    let cancelled = false;

    void loadStripeJs(companyVerifyText.paymentServiceLoadFailed)
      .then(async () => {
        if (cancelled || !window.Stripe || !companyVerifyPaymentMountRef.current) return;

        companyVerifyCheckoutRef.current?.destroy();
        const stripe = window.Stripe(companyVerifyPublishableKey);
        const checkout = await stripe.initEmbeddedCheckout({
          fetchClientSecret: async () => companyVerifyClientSecret
        });

        if (cancelled || !companyVerifyPaymentMountRef.current) {
          checkout.destroy();
          return;
        }

        companyVerifyCheckoutRef.current = checkout;
        checkout.mount(companyVerifyPaymentMountRef.current);
      })
      .catch((error) => {
        if (!cancelled) {
          setCompanyVerifyStatus(getErrorMessage(error));
          setCompanyVerifySaving(false);
        }
      });

    return () => {
      cancelled = true;
      companyVerifyCheckoutRef.current?.destroy();
      companyVerifyCheckoutRef.current = null;
    };
  }, [companyVerifyClientSecret, companyVerifyModalOpen, companyVerifyPublishableKey, companyVerifyText.paymentServiceLoadFailed]);

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
          setProfile((current) => {
            const nextProfile = profileDraftEditedRef.current && current
              ? preserveEditableProfileDraft(data, current)
              : data;
            writeCachedResource(cacheKey, nextProfile);
            return nextProfile;
          });
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
    if (!user || profile?.account_type !== "company" || !supabase) {
      setCommerceCompany(null);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token;
      if (!accessToken) return;
      const response = await fetch("/api/commerce/company", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const body = await response.json().catch(() => ({}));
      if (active && response.ok) setCommerceCompany(body.company ?? null);
    }).catch(() => {
      if (active) setCommerceCompany(null);
    });

    return () => { active = false; };
  }, [profile?.account_type, user]);

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
    if (profile.account_type === "company" && commerceCompany && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) { setStatus("Kirjautuminen vanheni. Kirjaudu uudelleen ja yritä uudelleen."); return; }
      const companyResponse = await fetch("/api/commerce/company", {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...commerceCompany,
          name: profile.company_name || commerceCompany.name,
          business_id: profile.business_id || commerceCompany.business_id,
          website: profile.company_website,
          description: profile.bio ?? "",
          phone: profile.phone,
          address_line: profile.address,
          postal_code: profile.postal_code,
          city: profile.city,
          country: profile.country,
          email: profile.email || commerceCompany.email
        })
      });
      const companyBody = await companyResponse.json().catch(() => ({}));
      if (!companyResponse.ok) { setStatus(companyBody.error || "Yritystietojen tallentaminen epäonnistui."); return; }
      setCommerceCompany(companyBody.company ?? commerceCompany);
    }
    profileDraftEditedRef.current = false;
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
    if (
      profile.company_verified_at ||
      profile.company_verification_requested_at ||
      companyVerifySaving
    ) return;

    const requirementsError = getCompanyVerificationRequirementsError();
    if (requirementsError) {
      setCompanyVerifyStatus(requirementsError);
      return;
    }

    setCompanyVerifySaving(true);
    setCompanyVerifyStatus(companyVerifyText.openingPayment);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        throw error ?? new Error(companyVerifyText.loginExpired);
      }

      const response = await fetch("/api/company-verification/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`
        },
        body: JSON.stringify({ attemptId: crypto.randomUUID(), locale })
      });
      const body = await response.json().catch(() => ({})) as {
        clientSecret?: string;
        publishableKey?: string;
        error?: string;
      };
      if (!response.ok || !body.clientSecret || !body.publishableKey) {
        throw new Error(body.error || companyVerifyText.openPaymentFailed);
      }

      setCompanyVerifyClientSecret(body.clientSecret);
      setCompanyVerifyPublishableKey(body.publishableKey);
      setCompanyVerifyStatus("");
      setCompanyVerifySaving(false);
    } catch (error) {
      setCompanyVerifyStatus(getErrorMessage(error));
      setCompanyVerifySaving(false);
    }
  }

  function getCompanyVerificationRequirementsError() {
    if (!profile || profile.account_type !== "company") return "";

    const fieldLabels: Record<CompanyVerificationRequiredField, string> = {
      company_name: profileText.companyName,
      business_id: profileText.businessId,
      email: profileText.email,
      phone: profileText.companyPhone,
      public_address: profileText.publicAddress,
      bio: profileText.publicBio,
      address: profileText.address,
      postal_code: profileText.postalCode,
      city: profileText.city,
      country: profileText.country
    };
    const missingFields = missingCompanyVerificationFields(profile);

    if (missingFields.length > 0) {
      return `${companyVerificationRequirementsText.prefix}: ${missingFields.map((field) => fieldLabels[field]).join(", ")}.`;
    }
    if (profileDraftEditedRef.current) {
      return companyVerificationRequirementsText.save;
    }
    return "";
  }

  function closeCompanyVerificationModal() {
    if (companyVerifySaving && !companyVerifyConfirming) return;
    companyVerifyCheckoutRef.current?.destroy();
    companyVerifyCheckoutRef.current = null;
    setCompanyVerifyClientSecret("");
    setCompanyVerifyPublishableKey("");
    setCompanyVerifyModalOpen(false);
    setCompanyVerifyStatus("");
    if (typeof window !== "undefined") {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}#tilin-turvallisuus`
      );
    }
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

  function startEmailEdit() {
    setEmailDraft("");
    setEmailCode("");
    setEmailChallenge("");
    setEmailStatus("");
    setEmailChangeStep("email");
    setEmailEditing(true);
  }

  function cancelEmailEdit() {
    if (emailSaving) return;
    setEmailEditing(false);
    setEmailDraft("");
    setEmailCode("");
    setEmailChallenge("");
    setEmailStatus("");
    setEmailChangeStep("email");
  }

  async function requestEmailChangeCode() {
    if (!supabase || emailSaving) return;
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
      setEmailStatus("Anna kelvollinen sähköpostiosoite.");
      return;
    }

    setEmailSaving(true);
    setEmailStatus("Lähetetään vahvistuskoodia...");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setEmailStatus("Kirjautuminen ei ole voimassa. Kirjaudu uudelleen.");
      setEmailSaving(false);
      return;
    }

    const response = await fetch("/api/account/email-change", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", email: nextEmail, locale })
    }).catch(() => null);
    const result = response
      ? await response.json().catch(() => ({})) as { challenge?: string; error?: string }
      : { error: "Verkkovirhe. Tarkista yhteys ja yritä uudelleen." };

    setEmailSaving(false);
    if (!response?.ok || !result.challenge) {
      setEmailStatus(result.error || "Vahvistuskoodin lähettäminen epäonnistui.");
      return;
    }

    setEmailDraft(nextEmail);
    setEmailChallenge(result.challenge);
    setEmailCode("");
    setEmailChangeStep("code");
    setEmailStatus(`Kuusinumeroinen koodi lähetettiin osoitteeseen ${nextEmail}.`);
  }

  async function verifyEmailChangeCode() {
    if (!supabase || !user || !profile || emailSaving || emailCode.length !== 6) return;
    setEmailSaving(true);
    setEmailStatus("Vahvistetaan koodia...");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setEmailStatus("Kirjautuminen ei ole voimassa. Kirjaudu uudelleen.");
      setEmailSaving(false);
      return;
    }

    const response = await fetch("/api/account/email-change", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        email: emailDraft,
        code: emailCode,
        challenge: emailChallenge,
        locale
      })
    }).catch(() => null);
    const result = response
      ? await response.json().catch(() => ({})) as { email?: string; error?: string }
      : { error: "Verkkovirhe. Tarkista yhteys ja yritä uudelleen." };

    if (!response?.ok || !result.email) {
      setEmailStatus(result.error || "Sähköpostiosoitteen vaihtaminen epäonnistui.");
      setEmailSaving(false);
      return;
    }

    const updatedProfile = { ...profile, email: result.email };
    setProfile(updatedProfile);
    writeCachedResource(`profile:${user.id}`, updatedProfile);
    const { data: refreshedSession } = await supabase.auth.refreshSession();
    if (refreshedSession.user) {
      setUser(refreshedSession.user);
    } else {
      const { data: refreshedUser } = await supabase.auth.getUser();
      if (refreshedUser.user) setUser(refreshedUser.user);
    }
    setEmailSaving(false);
    setEmailEditing(false);
    setEmailCode("");
    setEmailChallenge("");
    setEmailStatus("");
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
  const missingListingProfileFields = profile
    ? [
        [profile.phone, profileText.phone],
        [profile.address, profileText.address],
        [profile.postal_code, profileText.postalCode],
        [profile.city, profileText.city],
        [profile.country, profileText.country]
      ]
        .filter(([value]) => !String(value ?? "").trim())
        .map(([, label]) => String(label))
    : [];
  const listingProfileNoticeText = missingListingProfileFields.length > 0
    ? `Täytä ennen ilmoituksen luomista: ${missingListingProfileFields.join(", ")}.`
    : "Tallenna muutokset ja palaa sitten ilmoituksen luomiseen.";

  return (
    <main className="pf-page">

      <button
        type="button"
        className="pf-mobile-profile-close"
        aria-label="Sulje profiili"
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
            return;
          }
          router.push("/");
        }}
      >
        <X size={21} aria-hidden="true" />
      </button>

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
            <div className="pf-user-identity">
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
                  {avatarUrl ? profileText.change : profileText.addPhoto}
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
                <span><UiText text={"Profiilin täyttöaste"} /></span>
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
            <Link
              href={user ? profilePath(user.id, profile?.company_name || profile?.full_name || `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(), locale) : "/"}
              className="pf-nav-item"
              target="_blank"
            >
              <Globe size={19} />
              {profileText.publicProfile}
              <ExternalLink size={13} className="pf-nav-external" />
            </Link>
            {profile && (
              <button
                type="button"
                className="pf-nav-item pf-nav-danger pf-nav-button"
                onClick={openDeleteModal}
              >
                <Trash2 size={19} /><UiText text={"Poista tili"} /></button>
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
                  : "Käyttäjätiedot"}
              </h1>
            </div>
          )}

          {listingProfileNotice && profile && (
            <div className="pf-login-prompt pf-listing-profile-notice" role="alert">
              <Info size={19} />
              <span>{listingProfileNoticeText}</span>
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
                      <UserCircle size={18} />
                    </span>
                    <div>
                      <h2>{profileText.privateDetails}</h2>
                      <p>{profileText.accountHelp}</p>
                    </div>
                  </div>
                </div>
                <div className="pf-info-rows pf-card-body">
                  <div className="pf-info-row pf-user-detail-row pf-name-info-row">
                    <span className="pf-info-row-icon">
                      <UserCircle size={20} />
                    </span>
                    <span className="pf-info-label">{profileText.fullName}</span>
                    <div className="pf-info-value">
                      <input disabled value={profile.full_name || `${profile.first_name} ${profile.last_name}`.trim()} />
                    </div>
                  </div>
                  <div className="pf-info-row pf-user-detail-row pf-email-info-row">
                    <span className="pf-info-row-icon">
                      <Mail size={19} />
                    </span>
                    <span className="pf-info-label">{profileText.email}</span>
                    <div className="pf-info-value pf-info-email-value">
                      <div className="pf-phone-row pf-email-row">
                        <div className="pf-phone-card pf-email-card">
                          <span className="pf-phone-number pf-email-address">{profile.email}</span>
                        </div>
                        <div className="pf-phone-actions pf-email-actions">
                          <button type="button" className="pf-inline-btn pf-phone-change-btn pf-email-change-btn" onClick={startEmailEdit}>
                            {profileText.change}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {profile.account_type === "private" && (
                    <div className="pf-info-row pf-user-detail-row pf-phone-info-row">
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
                  <div className="pf-info-row pf-user-detail-row pf-address-info-row">
                    <span className="pf-info-row-icon"><MapPin size={19} /></span>
                    <span className="pf-info-label">{profileText.address}</span>
                    <div className="pf-info-value pf-private-address-value">
                      <input
                        className="pf-private-address-input"
                        autoComplete="off"
                        name="profile-private-address"
                        defaultValue={profile.address ?? ""}
                        onChange={e => updateProfileDraft({ address: e.target.value })}
                        placeholder="Aloita kirjoittamalla osoite"
                      />
                    </div>
                  </div>
                  <div className="pf-info-row pf-user-detail-row pf-postal-info-row">
                    <span className="pf-info-row-icon"><Hash size={19} /></span>
                    <span className="pf-info-label">{profileText.postalCode}</span>
                    <div className="pf-info-value">
                      <input
                        autoComplete="postal-code"
                        name="postal-code"
                        defaultValue={profile.postal_code ?? ""}
                        onChange={e => updateProfileDraft({ postal_code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="pf-info-row pf-user-detail-row pf-city-info-row">
                    <span className="pf-info-row-icon"><Building2 size={19} /></span>
                    <span className="pf-info-label">{profileText.city}</span>
                    <div className="pf-info-value">
                      <input
                        autoComplete="address-level2"
                        name="address-level2"
                        defaultValue={profile.city ?? ""}
                        onChange={e => updateProfileDraft({ city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="pf-info-row pf-user-detail-row pf-country-info-row">
                    <span className="pf-info-row-icon"><Globe size={19} /></span>
                    <span className="pf-info-label">{profileText.country}</span>
                    <div className="pf-info-value">
                      <input
                        autoComplete="country-name"
                        name="country-name"
                        defaultValue={profile.country ?? ""}
                        onChange={(event) => updateProfileDraft({ country: event.target.value })}
                        placeholder={profileText.country}
                      />
                    </div>
                  </div>
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
                        onChange={e => updateProfileDraft({ company_name: e.target.value })}
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
                        onChange={e => updateProfileDraft({ business_id: e.target.value.replace(/\D/g, "") })}
                      />
                      </div>
                    </div>
                    <div className="pf-info-row pf-company-email-info-row">
                      <span className="pf-info-row-icon">
                        <Mail size={19} />
                      </span>
                      <span className="pf-info-label">{profileText.email}</span>
                      <div className="pf-info-value pf-info-email-value">
                        <div className="pf-phone-row pf-email-row">
                          <div className="pf-phone-card pf-email-card">
                            <span className="pf-phone-number pf-email-address">{profile.email}</span>
                          </div>
                          <div className="pf-phone-actions pf-email-actions">
                            <button
                              type="button"
                              className="pf-inline-btn pf-phone-change-btn pf-email-change-btn"
                              onClick={startEmailEdit}
                            >
                              {profileText.change}
                            </button>
                          </div>
                        </div>
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
                          onChange={e => updateProfileDraft({ company_website: e.target.value })}
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
                            <ExternalLink size={18} aria-hidden="true" />
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
                  {profile.account_type === "company" && (
                    <div className="pf-field pf-field-wide pf-public-address-field">
                      <span className="pf-field-icon">
                        <MapPin size={16} />
                      </span>
                      <label>{profileText.publicAddress}</label>
                      <input
                        value={profile.public_address ?? ""}
                        onChange={e => updateProfileDraft({ public_address: e.target.value })}
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
                      onInput={(event) => {
                        const textarea = event.currentTarget;
                        textarea.style.height = "auto";
                        textarea.style.height = `${textarea.scrollHeight}px`;
                      }}
                      onChange={e => updateProfileDraft({ bio: e.target.value })}
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
              {profile.account_type === "company" && (
              <section className="pf-section pf-aligned-section" id="osoite">
                <div className="pf-section-head">
                  <Home size={17} />
                  <div>
                    <h2><UiText text={"Osoitetiedot"} /></h2>
                    <p><UiText text={"Hallitse osoitetietojasi."} /></p>
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
                        key="company-address-plain-input-v2"
                        autoComplete="off"
                        name="profile-company-address"
                        defaultValue={profile.address ?? ""}
                        onChange={e => updateProfileDraft({ address: e.target.value })}
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
                        autoComplete="off"
                        name="profile-company-postal-code"
                        defaultValue={profile.postal_code ?? ""}
                        onChange={e => updateProfileDraft({ postal_code: e.target.value })}
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
                        autoComplete="off"
                        name="profile-company-city"
                        defaultValue={profile.city ?? ""}
                        onChange={e => updateProfileDraft({ city: e.target.value })}
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
                        autoComplete="off"
                        name="profile-company-country"
                        defaultValue={profile.country ?? ""}
                        onChange={(event) => updateProfileDraft({ country: event.target.value })}
                        placeholder={profileText.country}
                      />
                    </div>
                  </div>
                </div>
              </section>
              )}

              <section className="pf-section pf-security-section pf-aligned-section" id="tilin-turvallisuus">
                <div className="pf-section-head">
                  <ShieldCheck size={17} />
                  <div>
                    <h2>{profileText.accountSecurity}</h2>
                    <p>{profileText.passwordHelp}</p>
                  </div>
                </div>
                <div className="pf-info-rows pf-card-body">
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
                    <span className="pf-info-label pf-mfa-label"><UiText text={"Kaksivaiheinen tunnistus"} /><small className={`pf-mfa-label-state${mfaMethod ? " is-enabled" : ""}`}>
                        {mfaMethod === "totp"
                          ? "Authenticator käytössä"
                          : mfaMethod === "email"
                            ? "Sähköpostikoodi käytössä"
                            : "Ei käytössä"}
                      </small>
                    </span>
                    <div className="pf-info-value pf-security-action-value pf-mfa-value">
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
                      <span className="pf-info-label">{companyVerifyText.verificationSection}</span>
                      <div className="pf-info-value pf-security-action-value">
                        {profile.company_verified_at ? (
                          <span className="pf-company-verify-ok">{companyVerifyText.verifiedCompany}</span>
                        ) : profile.company_verification_requested_at ? (
                          <span className="pf-company-verify-pending">{companyVerifyText.awaitingReview}</span>
                        ) : (
                          <button
                            type="button"
                            className="pf-inline-btn verify pf-company-verify-btn"
                            onClick={() => {
                              setCompanyVerifyStatus(getCompanyVerificationRequirementsError());
                              setCompanyVerifyModalOpen(true);
                            }}
                          >
                            {companyVerifyText.verifyCompanyAction}
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
                  <span className="pf-last-updated"><UiText text={"Viimeksi päivitetty "} />{formatProfileUpdatedAt(profile.updated_at)}
                  </span>
                )}
                {status && <span className="pf-status">{status}</span>}
              </div>

            </form>
          )}
        </div>

      </div>

      {(companyVerifyModalOpen || companyVerificationForcedOpen) && profile?.account_type === "company" && (
        <div
          className="pf-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && (!companyVerifySaving || companyVerifyConfirming)) {
              closeCompanyVerificationModal();
            }
          }}
        >
          <div
            className={`pf-phone-modal pf-company-verify-modal${companyVerifyClientSecret ? " is-payment" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-verify-title"
          >
            <button
              type="button"
              className="pf-modal-close"
              disabled={companyVerifySaving && !companyVerifyConfirming}
              onClick={closeCompanyVerificationModal}
              aria-label={companyVerifyText.close}
            >
              <X size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
            {companyVerifyClientSecret ? (
              <div className="pf-company-verify-payment-view">
                <header className="pf-company-verify-payment-head">
                  <span className="pf-company-verify-payment-mark"><UiText text={"M"} /></span>
                  <div>
                    <span className="pf-company-verify-kicker"><ShieldCheck size={14} /> {companyVerifyText.secureCheckout}</span>
                    <h2 id="company-verify-title">{companyVerifyText.finishTitle}</h2>
                    <p>{companyVerifyText.finishDescription}</p>
                  </div>
                </header>
                <div className="pf-company-verify-payment-layout">
                  <aside className="pf-company-verify-payment-summary">
                    <span className="pf-company-verify-payment-label">{companyVerifyText.orderSummary}</span>
                    <div className="pf-company-verify-payment-company">
                      <Building2 size={19} />
                      <span>
                        <small>{companyVerifyText.companyToVerify}</small>
                        <strong>{profile.company_name || companyVerifyText.companyFallback}</strong>
                        <em>{profile.business_id || companyVerifyText.businessIdMissing}</em>
                      </span>
                    </div>
                    <div className="pf-company-verify-payment-item">
                      <span>
                        <strong>{companyVerifyText.verificationProduct}</strong>
                        <small>{companyVerifyText.manualReview}</small>
                      </span>
                      <strong>{companyVerifyText.price}</strong>
                    </div>
                    <div className="pf-company-verify-payment-total">
                      <span>{companyVerifyText.amountDue}</span>
                      <strong>{companyVerifyText.price}</strong>
                    </div>
                    <div className="pf-company-verify-payment-trust">
                      <span><LockKeyhole size={14} /> {companyVerifyText.protectedStripe}</span>
                      <span><Check size={14} /> {companyVerifyText.oneTimeNoMonthly}</span>
                      <span><ShieldCheck size={14} /> {companyVerifyText.paidToMaskines}</span>
                    </div>
                  </aside>
                  <section className="pf-company-verify-payment-shell" aria-label={companyVerifyText.paymentMethods}>
                    <div className="pf-company-verify-payment-shell-head">
                      <div><CreditCard size={18} /><span><strong>{companyVerifyText.paymentMethod}</strong><small>{companyVerifyText.chooseMethod}</small></span></div>
                      <span><ShieldCheck size={14} /> {companyVerifyText.secure}</span>
                    </div>
                    <div className="pf-company-verify-embedded-wrap">
                      <div ref={companyVerifyPaymentMountRef} className="pf-company-verify-embedded" />
                    </div>
                  </section>
                </div>
                {companyVerifyStatus && <span className="pf-modal-note">{companyVerifyStatus}</span>}
              </div>
            ) : (
              <>
                <div className="pf-company-verify-heading">
                  <div className="pf-company-verify-brand-row">
                    <div className="pf-modal-icon">
                      <ShieldCheck size={24} />
                    </div>
                    <span className="pf-company-verify-kicker"><BadgeCheck size={14} /><UiText text={" Maskines Verified"} /></span>
                  </div>
                  <h2 id="company-verify-title">{companyVerifyText.title}</h2>
                  <p>{companyVerifyText.description}</p>
                </div>
                <div className="pf-company-verify-summary">
                  <span>{companyVerifyText.companyToVerify}</span>
                  <strong>{profile.company_name || companyVerifyText.companyFallback}</strong>
                  <small>{profile.business_id || companyVerifyText.businessIdMissing}</small>
                </div>
                {profile.company_verification_requested_at ? (
                  <div className="pf-company-verify-paid">
                    <BadgeCheck size={24} />
                    <div>
                      <strong>{companyVerifyText.paymentReceived}</strong>
                      <span>{companyVerifyText.pendingReview}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="pf-company-verify-benefits">
                      <div>
                        <span><BadgeCheck size={17} /></span>
                        <div><strong>{companyVerifyText.verifiedCompany}</strong><small>{companyVerifyText.verifiedCompanyDescription}</small></div>
                      </div>
                      <div>
                        <span><WalletCards size={17} /></span>
                        <div><strong>{companyVerifyText.paymentsAccess}</strong><small>{companyVerifyText.paymentsAccessDescription}</small></div>
                      </div>
                      <div>
                        <span><Sparkles size={17} /></span>
                        <div><strong>{companyVerifyText.premiumProfile}</strong><small>{companyVerifyText.premiumProfileDescription}</small></div>
                      </div>
                      <div>
                        <span><Building2 size={17} /></span>
                        <div><strong>{companyVerifyText.companyManagement}</strong><small>{companyVerifyText.companyManagementDescription}</small></div>
                      </div>
                    </div>
                    <div className="pf-company-verify-price">
                      <div className="pf-company-verify-price-copy">
                        <span><UiText text={"Maskines Verified"} /></span>
                        <strong>{companyVerifyText.verificationTitle}</strong>
                        <small>{companyVerifyText.allFeatures}</small>
                      </div>
                      <div className="pf-company-verify-price-amount">
                        <strong>{companyVerifyText.price}</strong>
                        <span>{companyVerifyText.oneTimePayment}</span>
                      </div>
                    </div>
                    <p className="pf-company-verify-disclaimer">{companyVerifyText.disclaimer}</p>
                    {companyVerifySaving ? (
                      <div className="pf-company-verify-progress" role="status" aria-live="polite">
                        <LoaderCircle size={20} />
                        <div>
                          <strong>{companyVerifyStatus || companyVerifyText.preparingPayment}</strong>
                          <span>{companyVerifyText.keepOpen}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pf-phone-actions pf-company-verify-actions">
                        <button
                          type="button"
                          className="pf-inline-btn verify pf-company-verify-pay-btn"
                          disabled={Boolean(getCompanyVerificationRequirementsError())}
                          onClick={requestCompanyVerification}
                        >
                          <CreditCard size={17} />
                          {getCompanyVerificationRequirementsError()
                            ? companyVerificationRequirementsText.title
                            : companyVerifyStatus
                              ? companyVerifyText.retryPayment
                              : companyVerifyText.continuePayment}
                        </button>
                      </div>
                    )}
                  </>
                )}
                {companyVerifyStatus && !companyVerifySaving && !profile.company_verification_requested_at && (
                  <div className="pf-company-verify-error" role="alert">
                    <X size={18} />
                    <div>
                      <strong>
                        {getCompanyVerificationRequirementsError()
                          ? companyVerificationRequirementsText.title
                          : companyVerifyText.paymentFailed}
                      </strong>
                      <span>{companyVerifyStatus}</span>
                    </div>
                  </div>
                )}
              </>
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
            ><UiText text={"×"} /></button>
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
                <h2 id="password-change-title"><UiText text={"Syötä sähköpostiin lähetetty koodi"} /></h2>
                <p><UiText text={"Lähetimme kuusinumeroisen vahvistuskoodin osoitteeseen "} /><strong>{user?.email || profile?.email}</strong>.
                </p>
                <label className="pf-password-field">
                  <span><UiText text={"Vahvistuskoodi"} /></span>
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
                  <button type="button" className="pf-inline-btn secondary" onClick={() => void handlePasswordReset()} disabled={passwordSending}><UiText text={"Lähetä uusi koodi"} /></button>
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
                <h2 id="password-change-title"><UiText text={"Kirjoita uusi salasana"} /></h2>
                <p><UiText text={"Kirjoita uusi salasana kaksi kertaa. Salasanassa pitää olla vähintään 8 merkkiä."} /></p>
                <label className="pf-password-field">
                  <span><UiText text={"Uusi salasana"} /></span>
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
                  <span><UiText text={"Uusi salasana uudelleen"} /></span>
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
                  <button type="button" className="pf-inline-btn secondary" onClick={closePasswordChange} disabled={passwordSending}><UiText text={"Peruuta"} /></button>
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
            ><UiText text={"×"} /></button>

            {mfaSetupStep === "choose" ? (
              <>
                <div className="pf-modal-icon"><ShieldCheck size={23} /></div>
                <h2 id="mfa-setup-title"><UiText text={"Kaksivaiheinen tunnistus"} /></h2>
                <p><UiText text={"Valitse kirjautumisen toinen vahvistustapa. Toiminto on vapaaehtoinen ja sen voi poistaa käytöstä milloin tahansa."} /></p>
                <div className="pf-mfa-options">
                  <button type="button" onClick={() => void beginTotpEnrollment()} disabled={mfaSaving}>
                    <span className="pf-mfa-option-icon"><QrCode size={25} /></span>
                    <span>
                      <strong><UiText text={"Authenticator-sovellus"} /></strong>
                      <small><UiText text={"Skannaa QR-koodi Google Authenticatorilla tai vastaavalla sovelluksella."} /></small>
                    </span>
                    <ArrowRight className="pf-mfa-option-arrow" size={18} />
                  </button>
                  <button type="button" onClick={() => void enableEmailMfa()} disabled={mfaSaving}>
                    <span className="pf-mfa-option-icon"><Mail size={25} /></span>
                    <span>
                      <strong><UiText text={"Sähköpostikoodi"} /></strong>
                      <small><UiText text={"Saat kuusinumeroisen koodin sähköpostiisi jokaisella kirjautumiskerralla."} /></small>
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
                  ><UiText text={"Poista kaksivaiheinen tunnistus käytöstä"} /></button>
                )}
              </>
            ) : (
              <>
                <div className="pf-modal-icon"><QrCode size={23} /></div>
                <h2 id="mfa-setup-title"><UiText text={"Yhdistä Authenticator"} /></h2>
                <p><UiText text={"Skannaa QR-koodi ja anna sovelluksen näyttämä kuusinumeroinen koodi."} /></p>
                {mfaEnrollment && (
                  <>
                    <div className="pf-mfa-qr">
                      <img src={mfaEnrollment.qrCode} alt="Authenticator QR-koodi" />
                    </div>
                    <div className="pf-mfa-secret">
                      <span><UiText text={"Manuaalinen avain"} /></span>
                      <code>{mfaEnrollment.secret}</code>
                    </div>
                    <label className="pf-mfa-code-field">
                      <span><UiText text={"Vahvistuskoodi"} /></span>
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
                      <button type="button" className="pf-inline-btn secondary" onClick={() => void closeMfaSetup()} disabled={mfaSaving}><UiText text={"Peruuta"} /></button>
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

      {emailEditing && (
        <div
          className="pf-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !emailSaving) cancelEmailEdit();
          }}
        >
          <div className="pf-phone-modal pf-email-change-modal" role="dialog" aria-modal="true" aria-labelledby="email-change-title">
            <button type="button" className="pf-modal-close" disabled={emailSaving} onClick={cancelEmailEdit} aria-label="Sulje"><UiText text={"×"} /></button>
            <div className="pf-modal-icon"><Mail size={22} /></div>
            <h2 id="email-change-title"><UiText text={"Vaihda sähköpostiosoite"} /></h2>

            {emailChangeStep === "email" ? (
              <form onSubmit={(event) => { event.preventDefault(); void requestEmailChangeCode(); }}>
                <p><UiText text={"Anna uusi sähköpostiosoite. Lähetämme siihen kuusinumeroisen vahvistuskoodin."} /></p>
                <label className="pf-email-change-field">
                  <span><UiText text={"Uusi sähköpostiosoite"} /></span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    placeholder="nimi@esimerkki.fi"
                    autoFocus
                  />
                </label>
                <div className="pf-avatar-crop-actions">
                  <button type="button" className="pf-inline-btn secondary" onClick={cancelEmailEdit} disabled={emailSaving}><UiText text={"Peruuta"} /></button>
                  <button type="submit" className="pf-inline-btn verify" disabled={emailSaving || !emailDraft.trim()}>
                    {emailSaving ? "Lähetetään..." : "Lähetä vahvistuskoodi"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); void verifyEmailChangeCode(); }}>
                <p><UiText text={"Syötä osoitteeseen "} /><strong>{emailDraft}</strong><UiText text={" lähetetty kuusinumeroinen koodi."} /></p>
                <label className="pf-email-change-field">
                  <span><UiText text={"Vahvistuskoodi"} /></span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    autoFocus
                  />
                </label>
                <div className="pf-email-change-resend">
                  <button type="button" onClick={() => { setEmailChangeStep("email"); setEmailCode(""); setEmailStatus(""); }} disabled={emailSaving}><UiText text={"Muuta osoitetta"} /></button>
                  <button type="button" onClick={() => void requestEmailChangeCode()} disabled={emailSaving}><UiText text={"Lähetä uusi koodi"} /></button>
                </div>
                <div className="pf-avatar-crop-actions">
                  <button type="button" className="pf-inline-btn secondary" onClick={cancelEmailEdit} disabled={emailSaving}><UiText text={"Peruuta"} /></button>
                  <button type="submit" className="pf-inline-btn verify" disabled={emailSaving || emailCode.length !== 6}>
                    {emailSaving ? "Vahvistetaan..." : "Vahvista ja vaihda"}
                  </button>
                </div>
              </form>
            )}

            {emailStatus && <span className="pf-phone-status" role="status">{emailStatus}</span>}
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
            ><UiText text={"×"} /></button>
            <div className="pf-modal-icon">
              <Phone size={22} />
            </div>
            <h2 id="phone-verification-title">
              {hasPhoneNumber ? "Vaihda puhelinnumero" : "Lisää puhelinnumero"}
            </h2>
            <p><UiText text={"Puhelinnumero tallennetaan profiiliisi ilman SMS-vahvistusta."} /></p>
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
              ><UiText text={"Tallenna"} /></button>
              <button
                type="button"
                className="pf-inline-btn secondary"
                disabled={phoneSaving}
                onClick={cancelPhoneEdit}
              ><UiText text={"Peruuta"} /></button>
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
            ><UiText text={"×"} /></button>
            <div className="pf-delete-modal-icon">
              <Trash2 size={22} />
            </div>
            <h2 id="delete-account-title">
              {deleteFinalConfirm ? "Poistetaanko tili pysyvästi?" : "Tilin poistaminen"}
            </h2>
            <p><UiText text={"Tämä poistaa tilin pysyvästi. Kysymme vielä viimeisen varmistuksen ennen kuin poisto tehdään."} /></p>
            {deleteFinalConfirm && (
              <p className="pf-delete-final-copy"><UiText text={"Tätä toimintoa ei voi perua. Tilisi, profiilisi ja kirjautumisoikeutesi poistetaan."} /></p>
            )}
            <span className="pf-delete-email">
              {profile.email}
            </span>
            {deleteFinalConfirm && (
              <div className="pf-delete-warning-list">
                <span><UiText text={"Puhelinnumero varataan 3 kuukaudeksi."} /></span>
                <span><UiText text={"Poiston jälkeen tiliä ei voi palauttaa."} /></span>
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
            <span className="pf-modal-note pf-delete-note"><UiText text={"Jos tilillä on puhelinnumero, sitä ei voi liittää uuteen tiliin 3 kuukauteen poiston jälkeen."} /></span>
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
            ><UiText text={"×"} /></button>
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
              <span><UiText text={"Zoom"} /></span>
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
          background: #112027;
          color: #ffffff;
          overflow-x: hidden;
          padding: 10px 0 28px;
        }

        .pf-page,
        .pf-page * {
          box-sizing: border-box;
        }

        .pf-layout {
          display: block;
          margin: 0 auto;
          max-width: 1220px;
          padding: 0 14px;
          width: 100%;
        }

        .pf-sidebar,
        .pf-profile-heading,
        .pf-public-note,
        .pf-phone-help,
        .pf-lock-icon,
        .pf-readonly-value > svg {
          display: none;
        }

        .pf-content {
          margin: 0;
          max-width: none;
          padding: 0;
          width: 100%;
        }

        .pf-form {
          display: grid;
          gap: 14px;
          grid-template-columns: 1fr;
          width: 100%;
        }

        .pf-form > :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-save-bar) {
          grid-column: 1 / -1;
          width: 100%;
        }

        .pf-section,
        .pf-info-card,
        .pf-public-profile-section {
          background:
            radial-gradient(760px 260px at 12% 0%, rgba(31, 124, 195, 0.14), transparent 72%),
            linear-gradient(180deg, rgba(5, 27, 49, 0.99), rgba(3, 18, 33, 0.99));
          border: 1px solid rgba(67, 139, 198, 0.58);
          border-radius: 7px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          overflow: hidden;
          padding: 0;
        }

        .pf-info-card-head,
        .pf-section-head {
          align-items: center;
          border: 0;
          display: grid;
          gap: 16px;
          grid-template-columns: 56px minmax(0, 1fr) auto;
          min-height: 100px;
          padding: 18px 24px 10px;
        }

        .pf-info-title {
          align-items: center;
          display: grid;
          gap: 16px;
          grid-column: 1 / 3;
          grid-template-columns: 56px minmax(0, 1fr);
          min-width: 0;
        }

        .pf-info-title-icon,
        .pf-section-head > svg {
          align-items: center;
          background: rgba(255, 122, 26, 0.07);
          border: 1px solid rgba(255, 138, 31, 0.7);
          border-radius: 16px;
          color: #ff8a1f;
          display: inline-flex;
          height: 62px;
          justify-content: center;
          padding: 15px;
          width: 62px;
        }

        #julkinen-profiili .pf-section-head > svg {
          background: rgba(37, 160, 255, 0.12);
          border-color: rgba(70, 184, 255, 0.72);
          color: #38b9ff;
        }

        .pf-info-card-head h2,
        .pf-section-head h2 {
          color: #ffffff;
          font-size: 22px;
          font-weight: 950;
          line-height: 1.08;
          margin: 0 0 6px;
          overflow-wrap: anywhere;
        }

        .pf-info-card-head p,
        .pf-section-head p {
          color: rgba(216, 232, 244, 0.7);
          font-size: 13px;
          font-weight: 800;
          line-height: 1.25;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .pf-info-edit-btn,
        .pf-manage-btn {
          align-items: center;
          background: rgba(4, 17, 31, 0.72);
          border: 1px solid rgba(105, 156, 200, 0.42);
          border-radius: 7px;
          box-shadow: none;
          color: #ffffff;
          display: inline-flex;
          font-size: 13px;
          font-weight: 950;
          gap: 9px;
          grid-column: 3;
          justify-content: center;
          justify-self: end;
          min-height: 46px;
          min-width: 136px;
          padding: 0 18px;
          white-space: nowrap;
        }

        .pf-info-edit-btn svg,
        .pf-manage-btn svg {
          color: #ff8a1f;
          height: 16px;
          width: 16px;
        }

        .pf-info-rows,
        #julkinen-profiili .pf-public-fields,
        #osoite .pf-fields {
          background: rgba(2, 15, 29, 0.36);
          border: 1px solid rgba(96, 148, 192, 0.28);
          border-radius: 7px;
          display: grid;
          gap: 0;
          grid-template-columns: 1fr;
          margin: 0 24px 22px;
          overflow: hidden;
          padding: 14px 16px;
        }

        .pf-info-row,
        #julkinen-profiili .pf-field,
        #julkinen-profiili .pf-field.pf-field-wide,
        #osoite .pf-field,
        #osoite .pf-field:last-child {
          align-items: center;
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(96, 148, 192, 0.2);
          display: grid;
          gap: 18px;
          grid-column: 1 / -1;
          grid-template-columns: 48px minmax(170px, 0.24fr) minmax(0, 1fr);
          min-height: 64px;
          min-width: 0;
          padding: 8px 0;
          width: 100%;
        }

        .pf-info-row:last-child,
        #julkinen-profiili .pf-field:last-child,
        #osoite .pf-field:last-child {
          border-bottom: 0;
        }

        #julkinen-profiili .pf-field::before,
        #osoite .pf-field::before {
          content: none;
          display: none;
        }

        .pf-info-row-icon,
        .pf-field-icon {
          align-items: center;
          align-self: center;
          background: rgba(33, 88, 130, 0.5);
          border: 1px solid rgba(120, 158, 195, 0.28);
          border-radius: 8px;
          color: rgba(215, 233, 247, 0.9);
          display: inline-flex;
          grid-column: 1;
          height: 42px;
          justify-content: center;
          min-width: 42px;
          width: 42px;
        }

        .pf-info-row-icon svg,
        .pf-field-icon svg {
          height: 20px;
          width: 20px;
        }

        .pf-info-label,
        .pf-field label {
          color: rgba(207, 222, 235, 0.76);
          font-size: 13px;
          font-weight: 900;
          grid-column: 2;
          line-height: 1.2;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .pf-info-value,
        #julkinen-profiili .pf-locked,
        #julkinen-profiili .pf-readonly-value,
        #julkinen-profiili input,
        #julkinen-profiili textarea,
        #osoite :is(input, select) {
          grid-column: 3;
          min-width: 0;
          width: 100%;
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
          background: rgba(9, 30, 52, 0.88);
          border: 1px solid rgba(91, 141, 184, 0.36);
          border-radius: 6px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          color: #ffffff;
          display: block;
          font-size: 16px;
          font-weight: 850;
          line-height: 1.25;
          min-height: 48px;
          min-width: 0;
          overflow: hidden;
          padding: 12px 16px;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
          -webkit-text-fill-color: #ffffff;
        }

        #julkinen-profiili .pf-readonly-value {
          align-items: center;
          display: flex;
        }

        .pf-country-input {
          background: rgba(9, 30, 52, 0.88);
          border: 1px solid rgba(126, 197, 240, 0.42);
          border-radius: 6px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 10px 24px rgba(0, 7, 18, 0.16);
          color: #ffffff;
          font-size: 15px;
          font-weight: 900;
          height: 42px;
          line-height: 1;
          padding: 0 12px;
          width: min(100%, 260px);
          -webkit-text-fill-color: #ffffff;
        }

        .pf-country-input:focus {
          border-color: rgba(255, 138, 34, 0.86);
          box-shadow:
            0 0 0 3px rgba(255, 138, 34, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          outline: none;
        }

        @media (max-width: 760px) {
          .pf-country-input {
            height: 40px;
            font-size: 14px;
            width: 100%;
          }
        }

        #julkinen-profiili textarea {
          height: 48px;
          min-height: 48px;
          resize: vertical;
          white-space: normal;
        }

        .pf-phone-row {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr) auto minmax(210px, 0.35fr);
          width: 100%;
        }

        .pf-phone-card {
          display: contents;
        }

        .pf-verified,
        .pf-unverified,
        .pf-locked-badge {
          align-self: center;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 950;
          min-height: 32px;
          padding: 8px 12px;
          white-space: nowrap;
        }

        .pf-phone-actions {
          display: grid;
          gap: 8px;
          grid-auto-flow: column;
          grid-auto-columns: minmax(180px, 1fr);
          min-width: 0;
        }

        .pf-inline-btn {
          min-height: 40px;
        }

        .pf-save-bar {
          align-items: center;
          background:
            radial-gradient(500px 180px at 10% 0%, rgba(31, 124, 195, 0.13), transparent 72%),
            rgba(6, 25, 43, 0.88);
          border: 1px solid rgba(82, 139, 190, 0.5);
          border-radius: 7px;
          box-shadow: none;
          display: flex;
          flex-direction: row;
          gap: 22px;
          min-height: 82px;
          padding: 18px 22px;
        }

        .pf-save-btn {
          background: linear-gradient(180deg, #ff9f2e, #ff7418);
          border: 1px solid rgba(255, 210, 165, 0.62);
          border-radius: 7px;
          box-shadow: 0 16px 30px rgba(255, 120, 24, 0.24);
          color: #ffffff;
          min-height: 52px;
          min-width: 240px;
          width: auto;
        }

        .pf-last-updated {
          color: rgba(207, 222, 235, 0.72);
          font-size: 13px;
          font-weight: 800;
        }

        @media (max-width: 760px) {
          .pf-page {
            padding-top: 0;
          }

          .pf-layout {
            padding: 0 10px 24px;
          }

          .pf-info-card-head,
          .pf-section-head {
            grid-template-columns: 50px minmax(0, 1fr);
            min-height: 0;
            padding: 16px 14px 10px;
          }

          .pf-info-title {
            grid-column: 1 / -1;
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .pf-info-title-icon,
          .pf-section-head > svg {
            border-radius: 13px;
            height: 50px;
            padding: 12px;
            width: 50px;
          }

          .pf-info-card-head h2,
          .pf-section-head h2 {
            font-size: 18px;
          }

          .pf-info-edit-btn,
          .pf-manage-btn {
            grid-column: 1 / -1;
            justify-self: stretch;
            width: 100%;
          }

          .pf-info-rows,
          #julkinen-profiili .pf-public-fields,
          #osoite .pf-fields {
            margin: 0 12px 12px;
            padding: 10px;
          }

          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite .pf-field,
          #osoite .pf-field:last-child {
            gap: 8px 12px;
            grid-template-columns: 42px minmax(0, 1fr);
            min-height: 0;
            padding: 10px 0;
          }

          .pf-info-value,
          #julkinen-profiili .pf-locked,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite :is(input, select) {
            grid-column: 1 / -1;
          }

          .pf-phone-row,
          .pf-phone-actions {
            grid-auto-flow: row;
            grid-template-columns: 1fr;
          }

          .pf-save-bar {
            align-items: stretch;
            flex-direction: column;
          }

          .pf-save-btn {
            min-width: 0;
            width: 100%;
          }
        }

        /* Address card hard fix: never use the old multi-column address grid. */
        #osoite.pf-section .pf-fields {
          align-content: stretch;
          align-items: stretch;
          display: flex;
          flex-direction: column;
          gap: 0;
          grid-template-columns: none;
          width: auto;
        }

        #osoite.pf-section .pf-fields > .pf-field,
        #osoite.pf-section .pf-fields > .pf-field:last-child {
          align-items: center;
          border-bottom: 1px solid rgba(96, 148, 192, 0.2);
          display: grid;
          flex: 0 0 auto;
          gap: 18px;
          grid-column: auto;
          grid-template-columns: 48px minmax(170px, 0.24fr) minmax(0, 1fr);
          max-width: none;
          min-width: 0;
          width: 100%;
        }

        #osoite.pf-section .pf-fields > .pf-field:last-child {
          border-bottom: 0;
        }

        #osoite.pf-section .pf-field > .pf-field-icon {
          grid-column: 1;
        }

        #osoite.pf-section .pf-field > label {
          grid-column: 2;
        }

        #osoite.pf-section .pf-field > input {
          grid-column: 3;
          max-width: none;
          overflow: visible;
          text-overflow: clip;
          width: 100%;
        }

        @media (max-width: 760px) {
          #osoite.pf-section .pf-fields > .pf-field,
          #osoite.pf-section .pf-fields > .pf-field:last-child {
            gap: 8px 12px;
            grid-template-columns: 42px minmax(0, 1fr);
          }

          #osoite.pf-section .pf-field > input {
            grid-column: 1 / -1;
          }
        }

        /* Screenshot parity: values are row text, not separate input boxes. */
        .pf-layout {
          margin: 20px auto 0;
          max-width: none;
          padding: 0;
          width: min(1350px, calc(100vw - 60px));
        }

        .pf-form {
          gap: 18px;
        }

        .pf-section,
        .pf-info-card,
        .pf-public-profile-section {
          border-color: rgba(67, 139, 198, 0.56);
          border-radius: 8px;
        }

        .pf-info-card-head,
        .pf-section-head {
          gap: 18px;
          grid-template-columns: 62px minmax(0, 1fr) auto;
          min-height: 92px;
          padding: 18px 22px 10px;
        }

        .pf-info-title {
          gap: 18px;
          grid-template-columns: 62px minmax(0, 1fr);
        }

        .pf-info-title-icon,
        .pf-section-head > svg {
          border-radius: 16px;
          height: 58px;
          padding: 14px;
          width: 58px;
        }

        .pf-info-card-head h2,
        .pf-section-head h2 {
          font-size: 19px;
          letter-spacing: 0;
          line-height: 1.08;
          margin-bottom: 7px;
        }

        .pf-info-card-head p,
        .pf-section-head p {
          font-size: 12px;
          line-height: 1.25;
        }

        .pf-info-edit-btn,
        .pf-manage-btn {
          border-radius: 7px;
          font-size: 13px;
          min-height: 43px;
          min-width: 126px;
          padding: 0 18px;
        }

        .pf-info-rows,
        #julkinen-profiili .pf-public-fields,
        #osoite.pf-section .pf-fields {
          background: rgba(2, 15, 29, 0.22);
          border-color: rgba(96, 148, 192, 0.3);
          border-radius: 7px;
          margin: 0 22px 21px;
          overflow: hidden;
          padding: 0;
        }

        .pf-info-row,
        #julkinen-profiili .pf-field,
        #julkinen-profiili .pf-field.pf-field-wide,
        #osoite.pf-section .pf-fields > .pf-field,
        #osoite.pf-section .pf-fields > .pf-field:last-child {
          border-bottom: 1px solid rgba(96, 148, 192, 0.23);
          gap: 20px;
          grid-template-columns: 52px minmax(220px, 310px) minmax(0, 1fr);
          min-height: 55px;
          padding: 0 11px;
        }

        .pf-info-row:last-child,
        #julkinen-profiili .pf-field:last-child,
        #osoite.pf-section .pf-fields > .pf-field:last-child {
          border-bottom: 0;
        }

        .pf-info-row-icon,
        .pf-field-icon {
          border-radius: 8px;
          height: 42px;
          min-width: 42px;
          width: 42px;
        }

        .pf-info-label,
        .pf-field label {
          font-size: 13px;
          line-height: 1.2;
        }

        .pf-info-value,
        #julkinen-profiili .pf-locked,
        #julkinen-profiili .pf-readonly-value,
        #julkinen-profiili input,
        #julkinen-profiili textarea,
        #osoite.pf-section .pf-field > input {
          align-items: center;
          display: flex;
          grid-column: 3;
          min-height: 0;
          min-width: 0;
          width: 100%;
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
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          color: #ffffff;
          display: block;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.25;
          min-height: 0;
          outline: none;
          overflow: hidden;
          padding: 0;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
          -webkit-text-fill-color: #ffffff;
        }

        #julkinen-profiili textarea {
          height: 22px;
          min-height: 22px;
          resize: none;
          white-space: nowrap;
        }

        #julkinen-profiili input:focus,
        #julkinen-profiili textarea:focus,
        #osoite.pf-section .pf-field > input:focus {
          background: rgba(9, 30, 52, 0.72);
          border: 1px solid rgba(91, 141, 184, 0.38);
          border-radius: 5px;
          margin: -8px -10px;
          padding: 8px 10px;
        }

        .pf-info-phone-value {
          display: block;
        }

        .pf-phone-row {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: max-content max-content minmax(270px, 0.38fr);
          width: 100%;
        }

        .pf-phone-number {
          width: auto;
        }

        .pf-verified,
        .pf-unverified,
        .pf-locked-badge {
          align-items: center;
          display: inline-flex;
          font-size: 11px;
          min-height: 28px;
          padding: 6px 12px;
        }

        .pf-phone-actions {
          display: grid;
          gap: 8px;
          grid-auto-flow: column;
          grid-auto-columns: minmax(270px, 1fr);
        }

        .pf-inline-btn {
          min-height: 30px;
        }

        .pf-save-bar {
          min-height: 72px;
          padding: 12px 21px;
        }

        .pf-save-btn {
          min-height: 46px;
          min-width: 210px;
        }

        @media (max-width: 760px) {
          .pf-layout {
            margin-top: 10px;
            width: calc(100vw - 20px);
          }

          .pf-info-card-head,
          .pf-section-head {
            grid-template-columns: 50px minmax(0, 1fr);
            min-height: 0;
          }

          .pf-info-title {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .pf-info-rows,
          #julkinen-profiili .pf-public-fields,
          #osoite.pf-section .pf-fields {
            margin: 0 12px 12px;
          }

          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite.pf-section .pf-fields > .pf-field,
          #osoite.pf-section .pf-fields > .pf-field:last-child {
            grid-template-columns: 42px minmax(0, 1fr);
            min-height: 0;
            padding: 10px;
          }

          .pf-info-value,
          #julkinen-profiili .pf-locked,
          #julkinen-profiili .pf-readonly-value,
          #julkinen-profiili input,
          #julkinen-profiili textarea,
          #osoite.pf-section .pf-field > input {
            grid-column: 1 / -1;
          }

          .pf-phone-row,
          .pf-phone-actions {
            grid-auto-flow: row;
            grid-template-columns: 1fr;
          }
        }

        /* Runtime-final profile view: this wins after the client-side style tag mounts. */
        .pf-page {
          background:
            radial-gradient(980px 460px at 62% 0%, rgba(20, 93, 147, 0.16), transparent 68%),
            linear-gradient(180deg, #06131f 0%, #071522 48%, #07131d 100%);
          color: #f4f8fc;
          min-height: 100dvh;
          overflow-x: hidden;
          padding: 0;
        }

        .pf-page .pf-layout {
          box-sizing: border-box;
          align-items: start;
          display: grid;
          gap: 18px;
          grid-template-columns: 260px minmax(0, 1fr);
          margin: 0 auto;
          max-width: none;
          padding: 20px 30px 28px;
          width: min(100%, 1460px);
        }

        .pf-page .pf-profile-heading,
        .pf-page .pf-public-note,
        .pf-page .pf-phone-help,
        .pf-page .pf-lock-icon,
        .pf-page .pf-readonly-value > svg {
          display: none;
        }

        .pf-page .pf-sidebar {
          align-self: start;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
          position: sticky;
          top: 18px;
          width: 100%;
        }

        .pf-page .pf-user-card,
        .pf-page .pf-nav {
          background:
            radial-gradient(360px 160px at 10% 0%, rgba(33, 125, 197, 0.16), transparent 72%),
            rgba(5, 28, 51, 0.96);
          border: 1px solid rgba(61, 133, 193, 0.72);
          border-radius: 8px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          box-sizing: border-box;
          overflow: hidden;
        }

        .pf-page .pf-user-card {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          gap: 12px;
          min-width: 0;
          padding: 15px;
          width: 100%;
        }

        .pf-page .pf-user-card > div:not(.pf-avatar) {
          flex: 1 1 auto;
          min-width: 0;
        }

        .pf-page .pf-avatar {
          align-items: center;
          background:
            radial-gradient(circle at 30% 20%, rgba(88, 199, 255, 0.55), transparent 45%),
            linear-gradient(135deg, rgba(15, 75, 123, 0.98), rgba(3, 18, 33, 0.98));
          border: 1px solid rgba(70, 184, 255, 0.62);
          border-radius: 999px;
          color: #ffffff;
          display: flex;
          flex: 0 0 auto;
          height: 58px;
          justify-content: center;
          overflow: visible;
          position: relative;
          width: 58px;
        }

        .pf-page .pf-avatar > img,
        .pf-page .pf-avatar > .profile-avatar-initial {
          border-radius: 999px;
          height: 100%;
          width: 100%;
        }

        .pf-page .pf-avatar > img {
          display: block;
          object-fit: cover;
          overflow: hidden;
        }

        .pf-page .pf-avatar > .profile-avatar-initial {
          align-items: center;
          display: flex;
          font-size: 21px;
          font-weight: 950;
          justify-content: center;
        }

        .pf-page .pf-avatar-overlay {
          align-items: center;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 999px;
          color: #ffffff;
          display: flex;
          inset: 0;
          justify-content: center;
          opacity: 0;
          position: absolute;
          transition: opacity 0.15s ease;
        }

        .pf-page .pf-avatar-upload:hover .pf-avatar-overlay,
        .pf-page .pf-avatar-loading .pf-avatar-overlay {
          opacity: 1;
        }

        .pf-page .pf-avatar-remove {
          align-items: center;
          background: linear-gradient(135deg, #ff9a24, #ff6b16);
          border: 2px solid rgba(255, 255, 255, 0.94);
          border-radius: 999px;
          box-shadow: 0 8px 18px rgba(255, 122, 26, 0.32), 0 0 0 2px rgba(8, 20, 34, 0.95);
          color: #ffffff;
          cursor: pointer;
          display: flex;
          font-size: 13px;
          font-weight: 950;
          height: 20px;
          justify-content: center;
          line-height: 1;
          padding: 0;
          position: absolute;
          right: -7px;
          top: -7px;
          width: 20px;
          z-index: 3;
        }

        .pf-page .pf-user-name {
          color: #ffffff;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.2;
          max-width: 150px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pf-page .pf-company-badge {
          color: rgba(216, 232, 244, 0.72);
          font-size: 11px;
          font-weight: 850;
          margin-top: 4px;
        }

        .pf-page .pf-nav {
          display: grid;
          flex: 0 0 auto;
          width: 100%;
        }

        .pf-page .pf-nav-item {
          align-items: center;
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(96, 148, 192, 0.2);
          border-left: 3px solid transparent;
          box-sizing: border-box;
          color: rgba(207, 222, 235, 0.78);
          display: flex;
          font-size: 13px;
          font-weight: 900;
          gap: 10px;
          min-height: 48px;
          padding: 0 14px;
          text-align: left;
          text-decoration: none;
          width: 100%;
        }

        .pf-page .pf-nav-item:last-child {
          border-bottom: 0;
        }

        .pf-page .pf-nav-item:hover,
        .pf-page .pf-nav-active {
          background: rgba(255, 122, 26, 0.1);
          border-left-color: #ff8a1f;
          color: #ffffff;
        }

        .pf-page .pf-nav-item svg {
          color: currentColor;
          flex: 0 0 auto;
        }

        .pf-page .pf-nav-external {
          margin-left: auto;
          opacity: 0.72;
        }

        .pf-page .pf-nav-danger {
          color: #ffb39f;
        }

        .pf-page .pf-nav-danger:hover {
          background: rgba(239, 68, 68, 0.12);
          border-left-color: #ff7a66;
          color: #ffd0c6;
        }

        .pf-page .pf-content {
          margin: 0;
          max-width: none;
          min-width: 0;
          padding: 0;
          width: 100%;
        }

        .pf-page .pf-form,
        .pf-page .pf-form:has(.pf-company-sellers-section) {
          align-items: stretch;
          display: grid;
          gap: 18px;
          grid-template-columns: 1fr;
          width: 100%;
        }

        .pf-page :is(#tiedot, #yritys, #julkinen-profiili, #osoite, .pf-company-sellers-section, .pf-save-bar) {
          grid-column: 1 / -1;
          width: 100%;
        }

        .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section) {
          background:
            radial-gradient(760px 280px at 8% 0%, rgba(33, 125, 197, 0.16), transparent 74%),
            linear-gradient(180deg, rgba(5, 28, 51, 0.98), rgba(3, 18, 33, 0.99));
          border: 1px solid rgba(61, 133, 193, 0.78);
          border-radius: 8px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          box-sizing: border-box;
          overflow: hidden;
        }

        .pf-page :is(.pf-info-card-head, .pf-section-head) {
          align-items: center;
          border: 0;
          display: grid;
          gap: 20px;
          grid-template-columns: 58px minmax(0, 1fr) auto;
          min-height: 91px;
          padding: 18px 22px 10px;
        }

        .pf-page .pf-info-title {
          align-items: center;
          display: grid;
          gap: 20px;
          grid-column: 1 / 3;
          grid-template-columns: 58px minmax(0, 1fr);
          min-width: 0;
        }

        .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          align-items: center;
          background: rgba(255, 122, 26, 0.07);
          border: 1px solid rgba(255, 138, 31, 0.76);
          border-radius: 18px;
          box-sizing: border-box;
          color: #ff8a1f;
          display: inline-flex;
          height: 58px;
          justify-content: center;
          padding: 14px;
          width: 58px;
        }

        .pf-page #julkinen-profiili .pf-section-head > svg {
          background: rgba(37, 160, 255, 0.12);
          border-color: rgba(70, 184, 255, 0.76);
          color: #38b9ff;
        }

        .pf-page :is(.pf-info-card-head h2, .pf-section-head h2) {
          color: #ffffff;
          font-size: 20px;
          font-weight: 950;
          letter-spacing: 0;
          line-height: 1.08;
          margin: 0 0 7px;
          overflow-wrap: anywhere;
        }

        .pf-page :is(.pf-info-card-head p, .pf-section-head p) {
          color: rgba(216, 232, 244, 0.72);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.25;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .pf-page :is(.pf-info-edit-btn, .pf-manage-btn) {
          align-items: center;
          background: rgba(4, 17, 31, 0.72);
          border: 1px solid rgba(105, 156, 200, 0.44);
          border-radius: 7px;
          color: #ffffff;
          display: inline-flex;
          font-size: 13px;
          font-weight: 950;
          gap: 8px;
          grid-column: 3;
          justify-content: center;
          justify-self: end;
          min-height: 43px;
          min-width: 126px;
          padding: 0 18px;
          white-space: nowrap;
        }

        .pf-page :is(.pf-info-edit-btn, .pf-manage-btn) svg {
          color: #ff8a1f;
          height: 15px;
          width: 15px;
        }

        .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-fields) {
          background: rgba(2, 15, 29, 0.24);
          border: 1px solid rgba(96, 148, 192, 0.32);
          border-radius: 7px;
          display: grid;
          gap: 0;
          grid-template-columns: 1fr;
          margin: 0 22px 21px;
          overflow: hidden;
          padding: 0;
        }

        .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide, #osoite .pf-field, #osoite .pf-field:last-child) {
          align-items: center;
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(96, 148, 192, 0.24);
          display: grid;
          gap: 20px;
          grid-column: 1 / -1;
          grid-template-columns: 52px minmax(220px, 310px) minmax(0, 1fr);
          min-height: 56px;
          min-width: 0;
          padding: 0 11px;
          width: 100%;
        }

        .pf-page :is(.pf-info-row:last-child, #julkinen-profiili .pf-field:last-child, #osoite .pf-field:last-child) {
          border-bottom: 0;
        }

        .pf-page #julkinen-profiili .pf-field::before,
        .pf-page #osoite .pf-field::before {
          content: none;
          display: none;
        }

        .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          align-items: center;
          align-self: center;
          background: rgba(33, 88, 130, 0.5);
          border: 1px solid rgba(120, 158, 195, 0.28);
          border-radius: 8px;
          box-sizing: border-box;
          color: rgba(215, 233, 247, 0.9);
          display: inline-flex;
          grid-column: 1;
          height: 42px;
          justify-content: center;
          min-width: 42px;
          width: 42px;
        }

        .pf-page :is(.pf-info-row-icon, .pf-field-icon) svg {
          height: 20px;
          width: 20px;
        }

        .pf-page :is(.pf-info-label, .pf-field label) {
          color: rgba(207, 222, 235, 0.76);
          font-size: 13px;
          font-weight: 900;
          grid-column: 2;
          letter-spacing: 0;
          line-height: 1.2;
          min-width: 0;
          overflow-wrap: anywhere;
          text-transform: none;
        }

        .pf-page :is(.pf-info-value, #julkinen-profiili .pf-locked, #julkinen-profiili .pf-readonly-value, #julkinen-profiili input, #julkinen-profiili textarea, #osoite input, #osoite select) {
          align-items: center;
          display: flex;
          grid-column: 3;
          min-height: 0;
          min-width: 0;
          width: 100%;
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
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          box-sizing: border-box;
          color: #ffffff;
          display: block;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.25;
          min-height: 0;
          min-width: 0;
          opacity: 1;
          outline: none;
          overflow: hidden;
          padding: 0;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
          -webkit-text-fill-color: #ffffff;
        }

        .pf-page #julkinen-profiili textarea {
          height: 22px;
          min-height: 22px;
          resize: none;
          white-space: nowrap;
        }

        .pf-page :is(#julkinen-profiili input:focus, #julkinen-profiili textarea:focus, #osoite input:focus, #osoite select:focus, .pf-info-value input:focus, .pf-info-value select:focus) {
          background: rgba(9, 30, 52, 0.74);
          border: 1px solid rgba(91, 141, 184, 0.42);
          border-radius: 5px;
          margin: -8px -10px;
          padding: 8px 10px;
        }

        .pf-page .pf-info-phone-value {
          display: block;
        }

        .pf-page .pf-phone-row {
          align-items: center;
          display: grid;
          gap: 12px;
          grid-template-columns: max-content max-content minmax(270px, 0.38fr);
          width: 100%;
        }

        .pf-page .pf-phone-card {
          display: contents;
        }

        .pf-page .pf-phone-number {
          width: auto;
        }

        .pf-page :is(.pf-verified, .pf-unverified, .pf-locked-badge) {
          align-items: center;
          align-self: center;
          border-radius: 6px;
          display: inline-flex;
          font-size: 11px;
          font-weight: 950;
          justify-content: center;
          min-height: 28px;
          padding: 6px 12px;
          white-space: nowrap;
        }

        .pf-page .pf-verified {
          background: rgba(34, 197, 94, 0.18);
          border: 1px solid rgba(34, 197, 94, 0.44);
          color: #4ade80;
        }

        .pf-page .pf-unverified,
        .pf-page .pf-locked-badge {
          background: rgba(255, 122, 26, 0.1);
          border: 1px solid rgba(255, 122, 26, 0.44);
          color: #ffd2a1;
        }

        .pf-page .pf-phone-actions {
          display: grid;
          gap: 8px;
          grid-auto-flow: column;
          grid-auto-columns: minmax(270px, 1fr);
          min-width: 0;
        }

        .pf-page .pf-inline-btn {
          background: rgba(4, 17, 31, 0.72);
          border: 1px solid rgba(105, 156, 200, 0.44);
          border-radius: 6px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 950;
          min-height: 30px;
        }

        .pf-page .pf-inline-btn.verify {
          background: linear-gradient(135deg, #ff9a24, #ff7418);
          border-color: rgba(255, 213, 166, 0.48);
        }

        .pf-page .pf-save-bar {
          align-items: center;
          background:
            radial-gradient(500px 180px at 10% 0%, rgba(31, 124, 195, 0.13), transparent 72%),
            rgba(6, 25, 43, 0.88);
          border: 1px solid rgba(82, 139, 190, 0.56);
          border-radius: 7px;
          box-shadow: none;
          box-sizing: border-box;
          display: flex;
          flex-direction: row;
          gap: 22px;
          min-height: 72px;
          padding: 12px 21px;
        }

        .pf-page .pf-save-btn {
          background: linear-gradient(180deg, #ff9f2e, #ff7418);
          border: 1px solid rgba(255, 210, 165, 0.62);
          border-radius: 7px;
          box-shadow: 0 16px 30px rgba(255, 120, 24, 0.24);
          color: #ffffff;
          font-size: 14px;
          font-weight: 950;
          min-height: 46px;
          min-width: 210px;
          padding: 0 22px;
          width: auto;
        }

        .pf-page .pf-last-updated,
        .pf-page .pf-status {
          color: rgba(207, 222, 235, 0.72);
          font-size: 13px;
          font-weight: 800;
        }

        @media (max-width: 760px) {
          .pf-page .pf-layout {
            gap: 14px;
            grid-template-columns: 1fr;
            padding: 10px 10px 24px;
            width: 100%;
          }

          .pf-page .pf-sidebar {
            height: auto;
            min-height: 0;
            position: static;
          }

          .pf-page .pf-user-card,
          .pf-page .pf-nav {
            flex: 0 0 auto;
            height: auto;
            min-height: 0;
          }

          .pf-page .pf-user-card {
            min-height: 82px;
            padding: 12px;
          }

          .pf-page .pf-nav {
            grid-template-columns: 1fr;
          }

          .pf-page .pf-nav-item {
            height: auto;
            min-height: 52px;
          }

          .pf-page :is(.pf-info-card-head, .pf-section-head) {
            grid-template-columns: 50px minmax(0, 1fr);
            min-height: 0;
            padding: 16px 14px 10px;
          }

          .pf-page .pf-info-title {
            grid-column: 1 / -1;
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
            border-radius: 13px;
            height: 50px;
            padding: 12px;
            width: 50px;
          }

          .pf-page :is(.pf-info-edit-btn, .pf-manage-btn) {
            grid-column: 1 / -1;
            justify-self: stretch;
            width: 100%;
          }

          .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-fields) {
            margin: 0 12px 12px;
          }

          .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide, #osoite .pf-field, #osoite .pf-field:last-child) {
            gap: 8px 12px;
            grid-template-columns: 42px minmax(0, 1fr);
            min-height: 0;
            padding: 10px;
          }

          .pf-page :is(.pf-info-value, #julkinen-profiili .pf-locked, #julkinen-profiili .pf-readonly-value, #julkinen-profiili input, #julkinen-profiili textarea, #osoite input, #osoite select) {
            grid-column: 1 / -1;
          }

          .pf-page .pf-phone-row,
          .pf-page .pf-phone-actions {
            grid-auto-flow: row;
            grid-template-columns: 1fr;
          }

          .pf-page .pf-save-bar {
            align-items: stretch;
            flex-direction: column;
          }

          .pf-page .pf-save-btn {
            min-width: 0;
            width: 100%;
          }
        }

        /* Final own-profile alignment: no header action buttons, equal section titles, values closer left. */
        .pf-page :is(.pf-info-edit-btn, .pf-manage-btn) {
          display: none;
        }

        .pf-page :is(.pf-info-card-head, .pf-section-head) {
          gap: 14px;
          grid-template-columns: 48px minmax(0, 1fr) auto;
          min-height: 74px;
          padding: 14px 18px 10px;
        }

        .pf-page .pf-info-title {
          gap: 14px;
          grid-column: 1 / 3;
          grid-template-columns: 48px minmax(0, 1fr);
        }

        .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          border-radius: 12px;
          height: 48px;
          padding: 12px;
          width: 48px;
        }

        .pf-page :is(.pf-info-title > div, .pf-section-head > div) {
          justify-self: start;
          text-align: left;
        }

        .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-info-rows, #osoite .pf-address-rows) {
          margin: 0 18px 16px;
        }

        .pf-page :is(
          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite .pf-info-row,
          #osoite .pf-field,
          #osoite .pf-field:last-child
        ) {
          gap: 20px;
          grid-template-columns: 52px minmax(220px, 310px) minmax(0, 1fr);
          padding: 0 8px;
        }

        .pf-page :is(.pf-info-label, .pf-field label) {
          justify-self: start;
          text-align: left;
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
          justify-content: flex-start;
          justify-self: start;
          text-align: left;
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
          text-align: left;
        }

        @media (max-width: 720px) {
          .pf-page :is(.pf-info-card-head, .pf-section-head) {
            grid-template-columns: 44px minmax(0, 1fr);
            padding: 14px 12px 10px;
          }

          .pf-page .pf-info-title {
            grid-column: 1 / -1;
            grid-template-columns: 44px minmax(0, 1fr);
          }

          .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
            height: 44px;
            width: 44px;
          }

          .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-info-rows, #osoite .pf-address-rows) {
            margin: 0 12px 12px;
          }

          .pf-page :is(
            .pf-info-row,
            #julkinen-profiili .pf-field,
            #julkinen-profiili .pf-field.pf-field-wide,
            #osoite .pf-info-row,
            #osoite .pf-field,
            #osoite .pf-field:last-child
          ) {
            grid-template-columns: 36px minmax(0, 1fr);
          }
        }

        .pf-page #julkinen-profiili .pf-public-fields > .pf-field,
        .pf-page #julkinen-profiili .pf-public-fields > .pf-field.pf-field-wide,
        .pf-page #osoite .pf-address-rows > .pf-info-row,
        .pf-page #yritys .pf-info-rows > .pf-info-row,
        .pf-page #tiedot .pf-info-rows > .pf-info-row {
          column-gap: 20px;
          grid-template-columns: 52px minmax(220px, 310px) minmax(0, 1fr);
        }

        .pf-page #julkinen-profiili :is(.pf-locked, .pf-readonly-value, input, textarea),
        .pf-page #osoite .pf-info-value,
        .pf-page #yritys .pf-info-value,
        .pf-page #tiedot .pf-info-value {
          grid-column: 3;
          justify-self: stretch;
          text-align: left;
        }

        .pf-page #julkinen-profiili .pf-public-name-field > .pf-locked,
        .pf-page #julkinen-profiili .pf-public-address-field > input,
        .pf-page #julkinen-profiili .pf-public-bio-field > textarea,
        .pf-page #osoite .pf-info-row > .pf-info-value,
        .pf-page #yritys .pf-info-row > .pf-info-value,
        .pf-page #tiedot .pf-info-row > .pf-info-value {
          grid-column: 3;
          margin-left: 0;
        }

        .pf-page #julkinen-profiili :is(.pf-locked input, .pf-locked input:disabled, .pf-readonly-value, .pf-readonly-value span, input, textarea),
        .pf-page #osoite .pf-info-value :is(input, select, span),
        .pf-page #yritys .pf-info-value :is(input, span),
        .pf-page #tiedot .pf-info-value :is(input, span) {
          padding-left: 0;
          text-align: left;
        }

        /* Final profile polish: shared topbar, cleaner avatar, no status dots, left-aligned row values. */
        html body:has(.pf-page) header.universal-app-topbar {
          display: flex;
        }

        html body:has(.pf-page) nextjs-portal {
          display: none;
        }

        html body .pf-page .pf-sidebar-language {
          display: none;
        }

        html body .pf-page .pf-layout {
          gap: 24px;
          grid-template-columns: 260px minmax(0, 1fr);
          max-width: 1520px;
        }

        html body .pf-page .pf-sidebar {
          grid-template-rows: auto auto 1fr;
        }

        html body .pf-page .pf-sidebar::before {
          content: none;
          display: none;
        }

        html body .pf-page .pf-user-card {
          grid-template-columns: 68px minmax(0, 1fr);
          min-height: 112px;
          padding: 16px 12px 18px;
        }

        html body .pf-page .pf-avatar,
        html body .pf-page .pf-avatar-upload {
          background:
            radial-gradient(48px 38px at 50% 26%, rgba(95, 207, 255, 0.26), transparent 72%),
            linear-gradient(145deg, rgba(10, 50, 80, 0.98), rgba(2, 16, 30, 0.98));
          border: 2px solid rgba(96, 190, 235, 0.74);
          box-shadow:
            0 0 0 3px rgba(5, 20, 35, 0.96),
            0 14px 24px rgba(0, 8, 20, 0.3);
          height: 66px;
          overflow: hidden;
          width: 66px;
        }

        html body .pf-page .pf-avatar::before,
        html body .pf-page .pf-avatar::after,
        html body .pf-page .pf-avatar-overlay::before {
          content: none;
          display: none;
        }

        html body .pf-page .profile-avatar-initial {
          background:
            radial-gradient(circle at 50% 30%, rgba(95, 207, 255, 0.3), transparent 66%),
            linear-gradient(145deg, #0d3658, #061724);
          color: #effaff;
        }

        html body .pf-page .pf-avatar-overlay {
          background: rgba(0, 0, 0, 0.5);
          border: 0;
          border-radius: 999px;
          bottom: auto;
          color: #ffffff;
          height: auto;
          inset: 0;
          opacity: 0;
          right: auto;
          width: auto;
        }

        html body .pf-page .pf-avatar-overlay svg {
          display: block;
        }

        html body .pf-page .pf-avatar-upload:hover .pf-avatar-overlay,
        html body .pf-page .pf-avatar-loading .pf-avatar-overlay {
          opacity: 1;
        }

        html body .pf-page .pf-avatar-remove {
          display: none;
        }

        html body .pf-page .pf-avatar-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 2px;
        }

        html body .pf-page .pf-avatar-action {
          align-items: center;
          background: rgba(4, 18, 33, 0.72);
          border: 1px solid rgba(105, 156, 200, 0.46);
          border-radius: 6px;
          color: #eef8ff;
          cursor: pointer;
          display: inline-flex;
          font-size: 11px;
          font-weight: 900;
          gap: 5px;
          min-height: 26px;
          padding: 0 9px;
        }

        html body .pf-page .pf-avatar-action:hover {
          border-color: rgba(123, 196, 244, 0.68);
          color: #ffffff;
        }

        html body .pf-page .pf-avatar-action.danger {
          border-color: rgba(255, 123, 93, 0.48);
          color: #ffc9bd;
        }

        html body .pf-page .pf-avatar-action:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        html body .pf-page .pf-company-sellers-section .company-seller-empty {
          background: rgba(3, 16, 29, 0.34);
          border: 1px solid rgba(107, 154, 195, 0.24);
          border-radius: 7px;
          color: rgba(226, 236, 247, 0.86);
          display: flex;
          gap: 0;
          min-height: 44px;
          padding: 0 14px;
        }

        html body .pf-page .pf-company-sellers-section .company-seller-empty::before {
          content: none;
          display: none;
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          gap: 12px;
          grid-template-columns: 44px minmax(0, 1fr) auto;
          min-height: 68px;
          padding: 14px 16px 10px;
        }

        html body .pf-page .pf-info-title {
          gap: 12px;
          grid-template-columns: 44px minmax(0, 1fr);
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          border-radius: 11px;
          height: 44px;
          padding: 10px;
          width: 44px;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-info-rows, #osoite .pf-address-rows) {
          margin: 0 16px 14px;
        }

        html body .pf-page :is(
          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite .pf-info-row,
          #osoite .pf-field,
          #osoite .pf-field:last-child
        ) {
          gap: 12px;
          grid-template-columns: 42px 150px minmax(0, 1fr);
          padding: 0 10px;
        }

        html body .pf-page :is(.pf-info-label, .pf-field label) {
          grid-column: 2;
          justify-self: start;
          text-align: left;
        }

        html body .pf-page .pf-info-row > .pf-info-value,
        html body .pf-page #julkinen-profiili .pf-field > :is(.pf-locked, .pf-readonly-value, input, textarea),
        html body .pf-page #osoite .pf-info-row > .pf-info-value,
        html body .pf-page #yritys .pf-info-row > .pf-info-value,
        html body .pf-page #tiedot .pf-info-row > .pf-info-value {
          grid-column: 3;
          justify-content: flex-start;
          justify-self: stretch;
          margin-left: 0;
          padding-left: 0;
          text-align: left;
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
          padding-left: 0;
          text-align: left;
        }

        @media (max-width: 720px) {
          html body .pf-page .pf-layout {
            gap: 14px;
            grid-template-columns: 1fr;
          }

          html body .pf-page :is(
            .pf-info-row,
            #julkinen-profiili .pf-field,
            #julkinen-profiili .pf-field.pf-field-wide,
            #osoite .pf-info-row,
            #osoite .pf-field,
            #osoite .pf-field:last-child
          ) {
            grid-template-columns: 36px minmax(0, 1fr);
          }

          html body .pf-page .pf-info-row > .pf-info-value,
          html body .pf-page #julkinen-profiili .pf-field > :is(.pf-locked, .pf-readonly-value, input, textarea),
          html body .pf-page #osoite .pf-info-row > .pf-info-value,
          html body .pf-page #yritys .pf-info-row > .pf-info-value,
          html body .pf-page #tiedot .pf-info-row > .pf-info-value {
            grid-column: 1 / -1;
          }
        }

        /* Final alignment pass: symmetric cards, tighter text columns and clean account sidebar. */
        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          grid-template-columns: 52px minmax(0, 1fr) auto;
          gap: 16px;
          min-height: 82px;
          padding: 16px 20px 12px;
        }

        html body .pf-page .pf-info-title {
          grid-template-columns: 52px minmax(0, 1fr);
          gap: 16px;
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          border-radius: 12px;
          height: 52px;
          padding: 12px;
          width: 52px;
        }

        html body .pf-page :is(.pf-info-card-head h2, .pf-section-head h2) {
          margin-bottom: 5px;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-fields, #osoite .pf-info-rows, #osoite .pf-address-rows) {
          margin: 0 20px 20px;
          width: calc(100% - 40px);
        }

        html body .pf-page :is(
          .pf-info-row,
          #julkinen-profiili .pf-field,
          #julkinen-profiili .pf-field.pf-field-wide,
          #osoite .pf-info-row,
          #osoite .pf-field,
          #osoite .pf-field:last-child
        ) {
          gap: 16px;
          grid-template-columns: 44px 150px minmax(0, 1fr);
          padding: 0 10px;
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          height: 36px;
          min-width: 36px;
          width: 36px;
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) svg {
          height: 17px;
          width: 17px;
        }

        html body .pf-page :is(.pf-info-label, .pf-field label) {
          justify-self: start;
          max-width: 150px;
          text-align: left;
        }

        html body .pf-page .pf-security-action-value {
          align-items: center;
          display: flex;
          gap: 12px;
        }

        html body .pf-page .pf-password-reset-btn {
          min-width: 150px;
        }

        html body .pf-page .pf-security-status {
          color: rgba(207, 222, 235, 0.72);
          font-size: 12px;
          font-weight: 850;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        html body .pf-page .pf-avatar-actions,
        html body .pf-page .pf-avatar-actions::before,
        html body .pf-page .pf-company-badge,
        html body .pf-page .pf-company-badge::before {
          border: 0;
          box-shadow: none;
          text-decoration: none;
        }

        html body .pf-page .pf-avatar-actions {
          padding-top: 0;
        }

        html body .pf-page .company-seller-list,
        html body .pf-page .company-seller-add,
        html body .pf-page .company-seller-footer {
          margin-left: 20px;
          margin-right: 20px;
          width: calc(100% - 40px);
        }

        html body .pf-page .company-seller-empty {
          justify-content: flex-start;
          padding-left: 14px;
          text-align: left;
        }

        html body .pf-page #osoite .pf-section-head {
          align-items: center;
          gap: 16px;
          grid-template-columns: 52px minmax(0, 1fr) auto;
          justify-content: start;
          padding-left: 20px;
          padding-right: 20px;
          text-align: left;
        }

        html body .pf-page #osoite .pf-section-head > svg {
          grid-column: 1;
          justify-self: start;
          margin: 0;
        }

        html body .pf-page #osoite .pf-section-head > div {
          grid-column: 2;
          justify-self: start;
          margin: 0;
          text-align: left;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) .pf-section-head {
          align-items: center;
          display: grid;
          gap: 16px;
          grid-template-columns: 52px minmax(0, 1fr) auto;
          margin-left: 0;
          margin-right: 0;
          padding-left: 34px;
          padding-right: 20px;
          text-align: left;
          transform: none;
          width: 100%;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) .pf-section-head > svg {
          grid-column: 1;
          justify-self: start;
          margin: 0;
          transform: none;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) .pf-section-head > div {
          grid-column: 2;
          justify-self: start;
          margin: 0;
          text-align: left;
          transform: none;
        }

        html body .pf-page :is(#julkinen-profiili .pf-public-fields, #osoite .pf-info-rows, #osoite .pf-address-rows, #tilin-turvallisuus .pf-info-rows) {
          margin-left: 24px;
          margin-right: 24px;
          width: calc(100% - 48px);
        }

        html body .pf-page :is(#julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide, #osoite .pf-info-row, #tilin-turvallisuus .pf-info-row) {
          gap: 16px;
          grid-template-columns: 44px 150px minmax(0, 1fr);
          padding-left: 10px;
          padding-right: 10px;
        }

        html body .pf-page :is(#osoite .pf-info-row > .pf-info-value, #tilin-turvallisuus .pf-info-row > .pf-info-value) {
          grid-column: 3;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) {
          padding-left: 0;
          padding-right: 0;
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-section-head, .pf-info-rows, .pf-public-fields, .company-seller-list, .company-seller-add, .company-seller-footer) {
          margin-left: 24px;
          margin-right: 24px;
          width: calc(100% - 48px);
        }

        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > .pf-section-head {
          margin-bottom: 0;
          padding-left: 0;
          padding-right: 0;
        }

        html body .pf-page #osoite > .pf-info-rows.pf-address-rows,
        html body .pf-page #osoite > .pf-address-rows,
        html body .pf-page #tilin-turvallisuus > .pf-info-rows,
        html body .pf-page .pf-company-sellers-section > .company-seller-list,
        html body .pf-page .pf-company-sellers-section > .company-seller-add {
          margin-left: 24px;
          margin-right: 24px;
          max-width: none;
          transform: none;
          width: calc(100% - 48px);
        }

        html body .pf-page #julkinen-profiili > .pf-fields.pf-public-fields {
          margin-left: 0;
          margin-right: 24px;
          max-width: none;
          transform: none;
          width: calc(100% - 24px);
        }

        html body .pf-page :is(#yritys, #tiedot, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
          align-items: center;
          display: grid;
          gap: 16px;
          grid-template-columns: 52px minmax(0, 1fr) auto;
          margin: 0;
          padding: 20px 42px 16px;
          text-align: left;
          transform: none;
          width: 100%;
        }

        html body .pf-page :is(#yritys, #tiedot) > .pf-info-card-head > .pf-info-title {
          display: grid;
          gap: 16px;
          grid-column: 1 / 3;
          grid-template-columns: 52px minmax(0, 1fr);
          margin: 0;
          transform: none;
        }

        html body .pf-page :is(#yritys, #tiedot) > .pf-info-card-head .pf-info-title-icon,
        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > .pf-section-head > svg {
          grid-column: 1;
          height: 52px;
          justify-self: start;
          margin: 0;
          min-width: 52px;
          transform: none;
          width: 52px;
        }

        html body .pf-page :is(#yritys, #tiedot) > .pf-info-card-head .pf-info-title > div,
        html body .pf-page :is(.pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > .pf-section-head > div {
          grid-column: 2;
          justify-self: start;
          margin: 0;
          min-width: 0;
          text-align: left;
          transform: none;
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
          margin: 0 42px 20px;
          max-width: none;
          transform: none;
          width: calc(100% - 84px);
        }

        html body .pf-page :is(.pf-company-sellers-section > .company-seller-list, .pf-company-sellers-section > .company-seller-add) > * {
          margin-left: 0;
          margin-right: 0;
          width: 100%;
        }

        html body .pf-page :is(#yritys, #tiedot, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
          margin-left: 66px;
          margin-right: 66px;
          padding-left: 0;
          padding-right: 0;
          width: calc(100% - 132px);
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
          margin-left: 66px;
          margin-right: 66px;
          width: calc(100% - 132px);
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) {
          --pf-card-inset: 66px;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
          box-sizing: border-box;
          margin: 0;
          padding: 20px var(--pf-card-inset) 16px;
          width: 100%;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-rows, .pf-public-fields, .pf-fields.pf-public-fields, .pf-address-rows, .company-seller-list, .company-seller-add) {
          box-sizing: border-box;
          margin: 0 var(--pf-card-inset) 20px;
          max-width: none;
          transform: none;
          width: auto;
        }

        html body .pf-page .pf-company-sellers-section > .company-seller-list > *,
        html body .pf-page .pf-company-sellers-section > .company-seller-add {
          box-sizing: border-box;
          margin-left: 0;
          margin-right: 0;
          width: 100%;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-rows, .pf-public-fields, .pf-fields.pf-public-fields, .pf-address-rows, .company-seller-list, .company-seller-add) {
          box-sizing: border-box;
          margin: 0 90px 20px;
          max-width: none;
          transform: none;
          width: calc(100% - 180px);
        }

        html body .pf-page .pf-company-sellers-section > .company-seller-list > *,
        html body .pf-page .pf-company-sellers-section > .company-seller-add {
          box-sizing: border-box;
          margin-left: 0;
          margin-right: 0;
          width: 100%;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
          box-sizing: border-box;
          margin: 0;
          padding: 20px 90px 16px;
          width: 100%;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot) > .pf-info-card-head > .pf-info-title,
        html body .pf-page .pf-form > :is(#myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > .pf-section-head {
          align-items: center;
          display: grid;
          gap: 16px;
          grid-template-columns: 52px minmax(0, 1fr) auto;
        }

        html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, .pf-company-sellers-section, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-rows, .pf-public-fields, .pf-fields.pf-public-fields, .pf-address-rows, .company-seller-list, .company-seller-add) {
          box-sizing: border-box;
          margin: 0 90px 20px;
          max-width: none;
          transform: none;
          width: calc(100% - 180px);
        }

        html body .pf-page .pf-company-verify-ok {
          color: #4ade80;
          -webkit-text-fill-color: #4ade80;
          font-weight: 950;
        }

        html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-company-verify-ok,
        html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-info-value > span.pf-company-verify-ok {
          background: transparent;
          border: 0;
          box-shadow: none;
          color: #4ade80;
          -webkit-text-fill-color: #4ade80;
          padding: 0;
          text-shadow: none;
        }

        html body .pf-page .pf-company-verify-pending {
          color: #fbbf24;
          font-weight: 950;
        }

        html body .pf-page .pf-company-verify-btn {
          min-width: 150px;
        }

        html body .pf-page .pf-company-verify-modal {
          background:
            radial-gradient(420px 220px at 0% 0%, rgba(255, 122, 26, 0.13), transparent 70%),
            linear-gradient(180deg, #101b25 0%, #0a141d 100%);
          border: 1px solid rgba(170, 190, 205, 0.2);
          border-radius: 22px;
          box-shadow: 0 34px 90px rgba(0, 5, 12, 0.52);
          max-width: min(520px, calc(100vw - 28px));
          overflow: hidden;
          padding: 34px;
        }

        html body .pf-page .pf-company-verify-modal.is-payment {
          max-width: min(1060px, calc(100vw - 36px));
          padding: 0;
          width: min(1060px, calc(100vw - 36px));
        }

        html body .pf-modal-backdrop:has(.pf-company-verify-modal) {
          align-items: flex-start;
          overflow-y: auto;
          padding-bottom: 30px;
          padding-top: max(58px, calc(var(--topbar-h, 58px) + 42px));
        }

        html body .pf-modal-backdrop:has(.pf-company-verify-modal.is-payment) {
          align-items: flex-start;
          overflow-y: auto;
          padding-bottom: 34px;
          padding-top: max(66px, calc(var(--topbar-h, 58px) + 50px));
        }

        html body .pf-page .pf-company-verify-payment-view {
          padding: 32px;
        }

        html body .pf-page .pf-company-verify-payment-head {
          align-items: center;
          display: flex;
          gap: 15px;
          margin: 0 48px 25px 0;
        }

        html body .pf-page .pf-company-verify-payment-mark {
          align-items: center;
          background: linear-gradient(145deg, #ff8d35, #ef6000);
          border: 1px solid rgba(255, 190, 139, 0.65);
          border-radius: 14px;
          box-shadow: 0 12px 28px rgba(255, 103, 9, 0.24);
          color: #ffffff;
          display: inline-flex;
          flex: 0 0 52px;
          font-size: 22px;
          font-weight: 950;
          height: 52px;
          justify-content: center;
        }

        html body .pf-page .pf-company-verify-payment-head > div {
          min-width: 0;
        }

        html body .pf-page .pf-company-verify-payment-head h2 {
          color: #f7fafc;
          font-size: 27px;
          letter-spacing: -0.03em;
          line-height: 1.12;
          margin: 0 0 5px;
        }

        html body .pf-page .pf-company-verify-payment-head p {
          color: #aebbc6;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
          margin: 0;
        }

        html body .pf-page .pf-company-verify-payment-layout {
          align-items: start;
          display: grid;
          gap: 22px;
          grid-template-columns: minmax(260px, 0.78fr) minmax(440px, 1.42fr);
        }

        html body .pf-page .pf-company-verify-payment-summary,
        html body .pf-page .pf-company-verify-payment-shell {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(166, 187, 202, 0.17);
          border-radius: 16px;
          overflow: hidden;
        }

        html body .pf-page .pf-company-verify-payment-summary {
          padding: 20px;
        }

        html body .pf-page .pf-company-verify-payment-label {
          color: #8798a5;
          display: block;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.09em;
          margin-bottom: 14px;
          text-transform: uppercase;
        }

        html body .pf-page .pf-company-verify-payment-company {
          align-items: center;
          background: rgba(255, 122, 26, 0.08);
          border: 1px solid rgba(255, 145, 65, 0.18);
          border-radius: 12px;
          color: #ff9a4e;
          display: flex;
          gap: 11px;
          padding: 13px;
        }

        html body .pf-page .pf-company-verify-payment-company > span {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        html body .pf-page .pf-company-verify-payment-company small,
        html body .pf-page .pf-company-verify-payment-company em {
          color: #95a5b0;
          font-size: 11px;
          font-style: normal;
          font-weight: 650;
        }

        html body .pf-page .pf-company-verify-payment-company strong {
          color: #f4f7f9;
          font-size: 14px;
        }

        html body .pf-page .pf-company-verify-payment-item {
          align-items: flex-start;
          border-bottom: 1px solid rgba(166, 187, 202, 0.13);
          display: flex;
          gap: 12px;
          justify-content: space-between;
          padding: 18px 2px;
        }

        html body .pf-page .pf-company-verify-payment-item > span {
          display: grid;
          gap: 3px;
        }

        html body .pf-page .pf-company-verify-payment-item strong {
          color: #eef4f7;
          font-size: 13px;
        }

        html body .pf-page .pf-company-verify-payment-item small {
          color: #8798a5;
          font-size: 11px;
          line-height: 1.4;
        }

        html body .pf-page .pf-company-verify-payment-total {
          align-items: end;
          display: flex;
          justify-content: space-between;
          padding: 17px 2px 20px;
        }

        html body .pf-page .pf-company-verify-payment-total span {
          color: #c6d0d7;
          font-size: 13px;
          font-weight: 750;
        }

        html body .pf-page .pf-company-verify-payment-total strong {
          color: #ffffff;
          font-size: 25px;
          letter-spacing: -0.03em;
        }

        html body .pf-page .pf-company-verify-payment-trust {
          border-top: 1px solid rgba(166, 187, 202, 0.13);
          display: grid;
          gap: 9px;
          padding-top: 17px;
        }

        html body .pf-page .pf-company-verify-payment-trust span {
          align-items: center;
          color: #98a8b3;
          display: flex;
          font-size: 11px;
          font-weight: 650;
          gap: 7px;
        }

        html body .pf-page .pf-company-verify-payment-trust svg {
          color: #6ee7a1;
        }

        html body .pf-page .pf-company-verify-payment-shell {
          background: #ffffff;
          color-scheme: light;
        }

        html body .pf-page .pf-company-verify-payment-shell-head {
          align-items: center;
          background: #f6f8f9;
          border-bottom: 1px solid #e1e6e9;
          color: #263843;
          display: flex;
          justify-content: space-between;
          padding: 14px 17px;
        }

        html body .pf-page .pf-company-verify-payment-shell-head > div {
          align-items: center;
          display: flex;
          gap: 9px;
        }

        html body .pf-page .pf-company-verify-payment-shell-head > div > span {
          display: grid;
          gap: 1px;
        }

        html body .pf-page .pf-company-verify-payment-shell-head strong {
          color: #1f303a;
          font-size: 13px;
        }

        html body .pf-page .pf-company-verify-payment-shell-head small {
          color: #71818b;
          font-size: 10px;
        }

        html body .pf-page .pf-company-verify-payment-shell-head > span {
          align-items: center;
          color: #3c6d54;
          display: flex;
          font-size: 10px;
          font-weight: 750;
          gap: 5px;
        }

        html body .pf-page .pf-company-verify-embedded-wrap {
          background: #ffffff;
          min-height: 440px;
          padding: 4px;
        }

        html body .pf-page .pf-company-verify-embedded {
          min-height: 430px;
          width: 100%;
        }

        html body .pf-page .pf-company-verify-modal::before {
          background: linear-gradient(90deg, #ff7a1a, #ffb067 52%, transparent);
          content: "";
          height: 2px;
          inset: 0 0 auto;
          position: absolute;
        }

        html body .pf-page .pf-company-verify-modal .pf-modal-close {
          background: rgba(255, 255, 255, 0.055);
          border-color: rgba(181, 199, 213, 0.2);
          color: #dbe5ec;
          height: 36px;
          right: 20px;
          top: 20px;
          width: 36px;
        }

        html body .pf-page .pf-company-verify-modal:not(.is-payment) .pf-modal-close {
          align-items: center;
          display: inline-flex;
          justify-content: center;
          left: auto;
          line-height: 0;
          padding: 0;
          right: 20px;
          top: 20px;
          transform: none;
        }

        html body .pf-page .pf-company-verify-heading {
          display: flex;
          flex-direction: column;
        }

        html body .pf-page .pf-company-verify-brand-row {
          align-items: center;
          display: flex;
          gap: 13px;
          margin: 0 48px 18px 0;
        }

        html body .pf-page .pf-company-verify-heading .pf-modal-icon {
          background: linear-gradient(145deg, #eafff1, #bff2d0);
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 14px;
          box-shadow: 0 14px 34px rgba(34, 197, 94, 0.18);
          color: #159447;
          flex: 0 0 52px;
          height: 52px;
          margin: 0;
          width: 52px;
        }

        html body .pf-page .pf-company-verify-kicker {
          align-items: center;
          color: #62d994;
          display: inline-flex;
          font-size: 11px;
          font-weight: 850;
          gap: 6px;
          letter-spacing: 0.09em;
          margin: 0;
          text-transform: uppercase;
        }

        html body .pf-page .pf-company-verify-heading h2 {
          color: #f7fafc;
          font-size: 30px;
          letter-spacing: -0.03em;
          line-height: 1.12;
          margin: 0 44px 10px 0;
        }

        html body .pf-page .pf-company-verify-heading > p {
          color: #aebbc6;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.58;
          margin: 0 0 20px;
        }

        html body .pf-page .pf-company-verify-summary {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(166, 187, 202, 0.16);
          border-radius: 12px;
          display: grid;
          gap: 3px;
          margin: 0 0 16px;
          padding: 14px 16px;
          text-align: left;
        }

        html body .pf-page .pf-company-verify-summary span {
          color: #8495a3;
          font-size: 11px;
          font-weight: 750;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        html body .pf-page .pf-company-verify-summary strong {
          color: #f3f7fa;
          font-size: 15px;
          font-weight: 800;
        }

        html body .pf-page .pf-company-verify-summary small {
          color: #9cabb6;
          font-size: 12px;
          font-weight: 650;
        }

        html body .pf-page .pf-company-verify-benefits {
          display: grid;
          gap: 9px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin: 0 0 18px;
        }

        html body .pf-page .pf-company-verify-benefits > div {
          align-items: flex-start;
          background: rgba(255, 255, 255, 0.028);
          border: 1px solid rgba(166, 187, 202, 0.13);
          border-radius: 12px;
          display: flex;
          gap: 10px;
          min-height: 78px;
          padding: 12px;
        }

        html body .pf-page .pf-company-verify-benefits > div > span {
          align-items: center;
          background: rgba(34, 197, 94, 0.11);
          border: 1px solid rgba(74, 222, 128, 0.2);
          border-radius: 9px;
          color: #62d994;
          display: inline-flex;
          flex: 0 0 34px;
          height: 34px;
          justify-content: center;
        }

        html body .pf-page .pf-company-verify-benefits > div > div {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        html body .pf-page .pf-company-verify-benefits strong {
          color: #e9f0f4;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.25;
        }

        html body .pf-page .pf-company-verify-benefits small {
          color: #81929e;
          font-size: 10px;
          font-weight: 600;
          line-height: 1.4;
        }

        html body .pf-page .pf-company-verify-price {
          align-items: stretch;
          background:
            radial-gradient(170px 110px at 100% 0%, rgba(74, 222, 128, 0.14), transparent 75%),
            linear-gradient(115deg, rgba(34, 197, 94, 0.1), rgba(255, 255, 255, 0.035));
          border: 1px solid rgba(74, 222, 128, 0.3);
          border-radius: 14px;
          display: flex;
          gap: 16px;
          justify-content: space-between;
          margin-top: 2px;
          overflow: hidden;
          padding: 16px 17px;
          position: relative;
        }

        html body .pf-page .pf-company-verify-price::before {
          background: linear-gradient(#6ee7a1, #159447);
          content: "";
          inset: 0 auto 0 0;
          position: absolute;
          width: 3px;
        }

        html body .pf-page .pf-company-verify-price-copy,
        html body .pf-page .pf-company-verify-price-amount {
          display: flex;
          flex-direction: column;
        }

        html body .pf-page .pf-company-verify-price-copy {
          gap: 2px;
        }

        html body .pf-page .pf-company-verify-price-copy > span {
          color: #62d994;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        html body .pf-page .pf-company-verify-price-copy > strong {
          color: #f4f7f9;
          font-size: 14px;
          font-weight: 850;
        }

        html body .pf-page .pf-company-verify-price-copy > small {
          color: #8798a4;
          font-size: 10px;
          font-weight: 650;
        }

        html body .pf-page .pf-company-verify-price-amount {
          align-items: flex-end;
          flex: 0 0 auto;
          justify-content: center;
        }

        html body .pf-page .pf-company-verify-price-amount > strong {
          color: #ffffff;
          font-size: 27px;
          font-weight: 900;
          letter-spacing: -0.035em;
          line-height: 1;
        }

        html body .pf-page .pf-company-verify-price-amount > span {
          color: #a7b4bd;
          font-size: 10px;
          font-weight: 700;
          margin-top: 5px;
        }

        html body .pf-page .pf-company-verify-disclaimer {
          color: #7f909d;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.5;
          margin: 10px 2px 0;
        }

        html body .pf-page .pf-company-verify-actions {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
          margin-top: 18px;
        }

        html body .pf-page .pf-company-verify-actions > button {
          border-radius: 10px;
          height: 48px;
          justify-content: center;
          margin: 0;
          width: 100%;
        }

        html body .pf-page .pf-company-verify-actions .secondary {
          background: transparent;
          border-color: rgba(166, 187, 202, 0.25);
          color: #b8c4cd;
        }

        html body .pf-page .pf-company-verify-pay-btn {
          align-items: center;
          background: #ff7414;
          border-color: #ff964f;
          box-shadow: 0 12px 26px rgba(255, 103, 9, 0.22);
          display: inline-flex;
          font-size: 14px;
          gap: 8px;
        }

        html body .pf-page .pf-company-verify-progress {
          align-items: center;
          background: linear-gradient(110deg, rgba(34, 197, 94, 0.1), rgba(255, 255, 255, 0.035));
          border: 1px solid rgba(74, 222, 128, 0.28);
          border-radius: 12px;
          color: #62d994;
          display: flex;
          gap: 12px;
          margin-top: 18px;
          min-height: 56px;
          padding: 11px 14px;
        }

        html body .pf-page .pf-company-verify-progress > svg {
          animation: pf-company-verify-spin 0.9s linear infinite;
          flex: 0 0 auto;
        }

        html body .pf-page .pf-company-verify-progress > div {
          display: grid;
          gap: 2px;
        }

        html body .pf-page .pf-company-verify-progress strong {
          color: #f2f6f8;
          font-size: 12px;
          font-weight: 800;
        }

        html body .pf-page .pf-company-verify-progress span {
          color: #8fa0ab;
          font-size: 10px;
          font-weight: 600;
        }

        @keyframes pf-company-verify-spin {
          to { transform: rotate(360deg); }
        }

        html body .pf-page .pf-company-verify-error {
          align-items: center;
          background: rgba(239, 68, 68, 0.09);
          border: 1px solid rgba(248, 113, 113, 0.28);
          border-radius: 12px;
          color: #f87171;
          display: flex;
          gap: 11px;
          margin-top: 12px;
          padding: 11px 13px;
        }

        html body .pf-page .pf-company-verify-error > svg {
          flex: 0 0 auto;
        }

        html body .pf-page .pf-company-verify-error > div {
          display: grid;
          gap: 2px;
        }

        html body .pf-page .pf-company-verify-error strong {
          color: #fecaca;
          font-size: 12px;
          font-weight: 850;
        }

        html body .pf-page .pf-company-verify-error span {
          color: #d9a4a4;
          font-size: 10px;
          font-weight: 650;
        }

        html body .pf-page .pf-company-verify-paid {
          align-items: center;
          background: rgba(34, 197, 94, 0.09);
          border: 1px solid rgba(74, 222, 128, 0.24);
          border-radius: 14px;
          color: #6ee7a1;
          display: flex;
          gap: 12px;
          padding: 15px 16px;
        }

        html body .pf-page .pf-company-verify-paid > div {
          display: grid;
          gap: 2px;
        }

        html body .pf-page .pf-company-verify-paid strong {
          color: #eafaf0;
          font-size: 14px;
        }

        html body .pf-page .pf-company-verify-paid span {
          color: #9fc8ae;
          font-size: 12px;
        }

        html body .pf-page .pf-company-verify-modal > .pf-modal-note {
          background: rgba(255, 122, 26, 0.09);
          border-color: rgba(255, 145, 65, 0.25);
          color: #ffc18d;
          margin: 14px 0 0;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-modal {
          background:
            radial-gradient(420px 220px at 0% 0%, rgba(255, 122, 26, 0.08), transparent 70%),
            #ffffff;
          border-color: #d9e1e7;
          box-shadow: 0 34px 90px rgba(25, 42, 54, 0.18);
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-modal .pf-modal-close {
          background: #f6f8f9;
          border-color: #d8e0e5;
          color: #263843;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-kicker {
          color: #167c3d;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-heading h2 {
          color: #16232c;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-heading > p {
          color: #61727d;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-summary {
          background: #f6f8f9;
          border-color: #dce3e8;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-summary span,
        html[data-theme="light"] body .pf-page .pf-company-verify-summary small {
          color: #697b86;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-summary strong {
          color: #16232c;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-benefits > div {
          background: #f7f9fa;
          border-color: #dce3e8;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-benefits > div > span {
          background: #eaf8ef;
          border-color: #bfe6cc;
          color: #167c3d;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-benefits strong {
          color: #263843;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-benefits small {
          color: #697b86;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-price {
          background: #effaf3;
          border-color: #bde4ca;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-price-copy > strong {
          color: #164b2c;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-price-copy > small,
        html[data-theme="light"] body .pf-page .pf-company-verify-price-amount > span {
          color: #52705d;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-price-amount > strong {
          color: #137a3a;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-disclaimer {
          color: #6b7c87;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-actions .secondary {
          background: #ffffff;
          border-color: #c8d2d9;
          color: #334956;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-progress {
          background: #effaf3;
          border-color: #bde4ca;
          color: #167c3d;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-progress strong {
          color: #164b2c;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-progress span {
          color: #52705d;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-error {
          background: #fff1f1;
          border-color: #f4c2c2;
          color: #c92a2a;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-error strong {
          color: #8e2020;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-error span {
          color: #8b5151;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-paid {
          background: #edf9f1;
          border-color: #bee5ca;
          color: #16803b;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-paid strong {
          color: #154b28;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-paid span {
          color: #52705d;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-payment-head h2,
        html[data-theme="light"] body .pf-page .pf-company-verify-payment-company strong,
        html[data-theme="light"] body .pf-page .pf-company-verify-payment-item strong,
        html[data-theme="light"] body .pf-page .pf-company-verify-payment-total strong {
          color: #16232c;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-payment-head p,
        html[data-theme="light"] body .pf-page .pf-company-verify-payment-company small,
        html[data-theme="light"] body .pf-page .pf-company-verify-payment-company em,
        html[data-theme="light"] body .pf-page .pf-company-verify-payment-item small,
        html[data-theme="light"] body .pf-page .pf-company-verify-payment-trust span {
          color: #657782;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-payment-summary {
          background: #f7f9fa;
          border-color: #dce3e8;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-payment-company {
          background: #fff7f0;
          border-color: #ffd9bd;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-payment-item,
        html[data-theme="light"] body .pf-page .pf-company-verify-payment-trust {
          border-color: #dce3e8;
        }

        html[data-theme="light"] body .pf-page .pf-company-verify-payment-total span {
          color: #40535f;
        }

        @media (max-width: 860px) {
          html body .pf-page .pf-company-verify-modal.is-payment {
            max-width: min(620px, calc(100vw - 24px));
            width: min(620px, calc(100vw - 24px));
          }

          html body .pf-page .pf-company-verify-payment-layout {
            grid-template-columns: 1fr;
          }

          html body .pf-page .pf-company-verify-payment-summary {
            order: 1;
          }

          html body .pf-page .pf-company-verify-payment-shell {
            order: 2;
          }
        }

        @media (max-width: 520px) {
          html body .pf-page .pf-company-verify-modal {
            border-radius: 18px;
            padding: 26px 20px 22px;
          }

          html body .pf-page .pf-company-verify-modal.is-payment {
            border-radius: 16px;
            max-width: calc(100vw - 16px);
            padding: 0;
            width: calc(100vw - 16px);
          }

          html body .pf-page .pf-company-verify-payment-view {
            padding: 22px 12px 14px;
          }

          html body .pf-page .pf-company-verify-payment-head {
            align-items: flex-start;
            margin-bottom: 19px;
            padding-right: 25px;
          }

          html body .pf-page .pf-company-verify-payment-mark {
            flex-basis: 44px;
            height: 44px;
          }

          html body .pf-page .pf-company-verify-payment-head h2 {
            font-size: 22px;
          }

          html body .pf-page .pf-company-verify-payment-head p {
            font-size: 12px;
          }

          html body .pf-page .pf-company-verify-payment-summary {
            padding: 15px;
          }

          html body .pf-page .pf-company-verify-payment-shell-head {
            align-items: flex-start;
            padding: 12px;
          }

          html body .pf-page .pf-company-verify-payment-shell-head > span {
            display: none;
          }

          html body .pf-page .pf-company-verify-heading h2 {
            font-size: 26px;
          }

          html body .pf-page .pf-company-verify-brand-row {
            margin-right: 42px;
          }

          html body .pf-page .pf-company-verify-benefits {
            grid-template-columns: 1fr;
          }

          html body .pf-page .pf-company-verify-benefits > div {
            min-height: 0;
          }

          html body .pf-page .pf-company-verify-price {
            align-items: flex-start;
          }

          html body .pf-page .pf-company-verify-price-copy > small {
            max-width: 180px;
          }

          html body .pf-page .pf-company-verify-price-amount > strong {
            font-size: 24px;
          }

          html body .pf-page .pf-company-verify-actions {
            grid-template-columns: 1fr;
          }
        }

        @media (min-width: 761px) {
          html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-row {
            align-items: center;
            display: grid;
            gap: 12px;
            grid-template-columns: minmax(0, 1fr) auto;
            width: 100%;
          }

          html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-actions {
            justify-content: flex-end;
            width: auto;
          }

          html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-change-btn {
            height: 34px;
            min-height: 34px;
            min-width: 116px;
            padding: 0 18px;
            width: auto;
          }

          html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-info-value,
          html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-info-value > .pf-company-verify-ok {
            background: none;
            background-color: transparent;
            background-image: none;
            border: 0;
            box-shadow: none;
            filter: none;
            outline: 0;
            text-shadow: none;
          }
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) {
          --pf-profile-inset: 72px;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > :is(.pf-info-card-head, .pf-section-head) {
          align-items: center;
          box-sizing: border-box;
          display: grid;
          gap: 16px;
          grid-template-columns: 52px minmax(0, 1fr) auto;
          margin: 0;
          padding: 20px var(--pf-profile-inset) 16px;
          text-align: left;
          transform: none;
          width: 100%;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head > .pf-info-title {
          align-items: center;
          display: grid;
          gap: 16px;
          grid-column: 1 / 3;
          grid-template-columns: 52px minmax(0, 1fr);
          margin: 0;
          transform: none;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head .pf-info-title-icon,
        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-section-head > svg {
          grid-column: 1;
          height: 52px;
          justify-self: start;
          margin: 0;
          min-width: 52px;
          transform: none;
          width: 52px;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head .pf-info-title > div,
        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-section-head > div {
          grid-column: 2;
          justify-self: start;
          margin: 0;
          min-width: 0;
          text-align: left;
          transform: none;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-card-body {
          box-sizing: border-box;
          margin: 0 var(--pf-profile-inset) 20px;
          max-width: none;
          transform: none;
          width: calc(100% - (var(--pf-profile-inset) * 2));
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-card-body > :is(.pf-info-row, .pf-field) {
          box-sizing: border-box;
          display: grid;
          gap: 16px;
          grid-template-columns: 44px 180px minmax(0, 1fr);
          margin-left: 0;
          margin-right: 0;
          max-width: none;
          width: 100%;
        }

        html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-card-body > :is(.company-seller-card, .company-seller-empty) {
          box-sizing: border-box;
          margin-left: 0;
          margin-right: 0;
          max-width: none;
          width: 100%;
        }

        @media (max-width: 760px) {
          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) {
            --pf-profile-inset: 14px;
          }

          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > :is(.pf-info-card-head, .pf-section-head) {
            gap: 12px;
            grid-template-columns: 44px minmax(0, 1fr) auto;
            padding-top: 14px;
          }

          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head > .pf-info-title {
            gap: 12px;
            grid-template-columns: 44px minmax(0, 1fr);
          }

          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-info-card-head .pf-info-title-icon,
          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-section-head > svg {
            height: 44px;
            min-width: 44px;
            width: 44px;
          }

          html body .pf-page .pf-form > :is(#yritys.pf-aligned-section, #tiedot.pf-aligned-section, #myyjat.pf-aligned-section, #julkinen-profiili.pf-aligned-section, #osoite.pf-aligned-section, #tilin-turvallisuus.pf-aligned-section) > .pf-card-body > :is(.pf-info-row, .pf-field) {
            grid-template-columns: 44px minmax(92px, 0.35fr) minmax(0, 1fr);
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
          box-sizing: border-box;
          padding: 0;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head {
          align-items: center;
          box-sizing: border-box;
          border-bottom: 0;
          display: grid;
          gap: 16px;
          grid-template-columns: 52px minmax(0, 1fr) auto;
          left: auto;
          margin: 0;
          max-width: none;
          padding: 20px var(--pf-hard-inset) 16px;
          right: auto;
          text-align: left;
          transform: none;
          width: 100%;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head > .pf-info-title,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head > .pf-info-title {
          align-items: center;
          box-sizing: border-box;
          display: grid;
          gap: 16px;
          grid-column: 1 / 3;
          grid-template-columns: 52px minmax(0, 1fr);
          margin: 0;
          max-width: none;
          padding: 0;
          transform: none;
          width: 100%;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head .pf-info-title-icon,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head .pf-info-title-icon,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head > svg,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head > svg,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head > svg,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head > svg {
          grid-column: 1;
          height: 52px;
          justify-self: start;
          margin: 0;
          min-width: 52px;
          transform: none;
          width: 52px;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head .pf-info-title > div,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head .pf-info-title > div,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head > div,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head > div,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head > div,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head > div {
          grid-column: 2;
          justify-self: start;
          margin: 0;
          min-width: 0;
          text-align: left;
          transform: none;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body {
          box-sizing: border-box;
          display: grid;
          left: auto;
          margin: 0 var(--pf-hard-inset) 20px;
          max-width: none;
          padding: 0;
          right: auto;
          transform: none;
          width: auto;
        }

        html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body > .pf-info-row,
        html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body > .pf-info-row,
        html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field,
        html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body > .pf-info-row,
        html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body > .pf-info-row {
          box-sizing: border-box;
          display: grid;
          gap: 16px;
          grid-template-columns: 44px 150px minmax(0, 1fr);
          margin-left: 0;
          margin-right: 0;
          max-width: none;
          padding-left: 10px;
          padding-right: 10px;
          transform: none;
          width: 100%;
        }

        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-card-body > .company-seller-card,
        html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-card-body > .company-seller-empty {
          box-sizing: border-box;
          margin-left: 0;
          margin-right: 0;
          max-width: none;
          transform: none;
          width: 100%;
        }

        @media (max-width: 760px) {
          html body .pf-page .pf-form > #yritys.pf-aligned-section,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section,
          html body .pf-page .pf-form > #osoite.pf-aligned-section,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section {
            --pf-hard-inset: 14px;
            border-radius: 8px;
            overflow: hidden;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head {
            align-items: start;
            gap: 12px;
            grid-template-columns: 48px minmax(0, 1fr);
            min-height: 0;
            padding: 20px var(--pf-hard-inset) 14px;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head > .pf-info-title,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head > .pf-info-title {
            gap: 12px;
            grid-column: 1 / -1;
            grid-template-columns: 48px minmax(0, 1fr);
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head .pf-info-title-icon,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head .pf-info-title-icon,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head > svg,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head > svg,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head > svg,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head > svg {
            height: 44px;
            min-width: 44px;
            padding: 8px;
            width: 44px;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-card-head .pf-info-title > div,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-card-head .pf-info-title > div,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-section-head > div,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-section-head > div,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-section-head > div,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-section-head > div {
            grid-column: 2;
            min-width: 0;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #myyjat, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section :is(h2, p, label, span, strong, small) {
            max-width: 100%;
            min-width: 0;
            overflow-wrap: anywhere;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #myyjat.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body {
            display: grid;
            gap: 10px;
            grid-column: 1 / -1;
            justify-self: stretch;
            margin: 0 var(--pf-hard-inset) 18px;
            max-width: none;
            min-width: 0;
            width: auto;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body > .pf-info-row {
            align-items: start;
            background: rgba(4, 18, 32, 0.42);
            border: 1px solid rgba(95, 143, 179, 0.22);
            border-radius: 8px;
            box-sizing: border-box;
            display: grid;
            gap: 6px 10px;
            grid-template-columns: 34px minmax(0, 1fr);
            justify-self: stretch;
            min-height: 0;
            min-width: 0;
            padding: 10px;
            width: 100%;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field-icon {
            grid-column: 1;
            grid-row: 1 / span 2;
            height: 30px;
            justify-self: start;
            width: 30px;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field label {
            align-self: center;
            grid-column: 2;
            grid-row: 1;
            line-height: 1.2;
            margin: 0;
            white-space: normal;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(.pf-locked, .pf-readonly-value, input, textarea) {
            grid-column: 2;
            grid-row: 2;
            min-width: 0;
            width: 100%;
          }

          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body {
            grid-template-columns: minmax(0, 1fr);
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body > .pf-info-row {
            max-width: none;
            width: 100%;
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
              grid-template-columns: 32px minmax(0, 1fr);
              padding: 10px 12px;
            }
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value :is(input, span),
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(input, textarea, .pf-readonly-value span) {
            min-width: 0;
            overflow: visible;
            text-overflow: clip;
            white-space: normal;
            word-break: break-word;
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field {
            min-width: 0;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section,
          html body .pf-page .pf-form > #osoite.pf-aligned-section,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section {
            overflow: visible;
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body {
            left: auto;
            margin: 0 14px 18px;
            max-width: none;
            position: relative;
            transform: none;
            width: calc(100% - 28px);
          }

          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-card-body > .pf-info-row {
            align-items: center;
            gap: 8px;
            grid-template-columns: 30px minmax(70px, 0.38fr) minmax(0, 1fr);
            min-height: 58px;
            padding: 8px 10px;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field-icon {
            grid-column: 1;
            grid-row: 1;
            height: 28px;
            width: 28px;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field label {
            grid-column: 2;
            grid-row: 1;
            line-height: 1.05;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(.pf-locked, .pf-readonly-value, input, textarea) {
            grid-column: 3;
            grid-row: 1;
          }

          html body .pf-page .pf-company-sellers-section > .company-seller-list > *,
          html body .pf-page .pf-company-sellers-section > .company-seller-add {
            margin-inline: 0;
            width: 100%;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section {
            display: block;
            max-width: none;
            min-width: 0;
            overflow: hidden;
            width: 100%;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot).pf-aligned-section > .pf-info-card-head,
          html body .pf-page .pf-form > :is(#julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-section-head {
            box-sizing: border-box;
            margin: 0;
            width: 100%;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body {
            box-sizing: border-box;
            display: grid;
            gap: 10px;
            grid-template-columns: minmax(0, 1fr);
            left: auto;
            margin: 0 12px 18px;
            max-width: none;
            min-width: 0;
            padding: 0;
            position: static;
            right: auto;
            transform: none;
            width: calc(100% - 24px);
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field {
            align-items: center;
            box-sizing: border-box;
            display: grid;
            gap: 8px 10px;
            grid-template-columns: 32px minmax(0, 1fr);
            grid-template-rows: auto auto;
            justify-self: stretch;
            margin: 0;
            max-width: none;
            min-height: 0;
            min-width: 0;
            padding: 10px 12px;
            transform: none;
            width: 100%;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field-icon {
            grid-column: 1;
            grid-row: 1 / span 2;
            height: 30px;
            width: 30px;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field label {
            grid-column: 2;
            grid-row: 1;
            min-width: 0;
            white-space: normal;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(.pf-locked, .pf-readonly-value, input, textarea) {
            display: block;
            grid-column: 2;
            grid-row: 2;
            min-width: 0;
            overflow-wrap: anywhere;
            text-align: left;
            white-space: normal;
            width: 100%;
            word-break: normal;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body {
            margin: 0 18px 18px;
            max-width: none;
            width: calc(100% - 36px);
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-card-body > .pf-field {
            border-radius: 8px;
            grid-template-columns: 42px minmax(0, 1fr);
            grid-template-rows: auto auto;
            min-height: 76px;
            padding: 14px 16px;
            width: 100%;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field-icon {
            grid-column: 1;
            grid-row: 1 / span 2;
            height: 38px;
            width: 38px;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section .pf-field label {
            grid-column: 2;
            grid-row: 1;
            line-height: 1.15;
          }

          html body .pf-page .pf-form > :is(#yritys, #tiedot, #osoite, #tilin-turvallisuus).pf-aligned-section .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section :is(.pf-locked, .pf-readonly-value, input, textarea) {
            grid-column: 2;
            grid-row: 2;
            line-height: 1.18;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row {
            grid-template-columns: 42px minmax(0, 1fr) auto;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-info-label {
            grid-column: 2;
            grid-row: 1 / span 2;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-info-value {
            grid-column: 3;
            grid-row: 1 / span 2;
            justify-self: end;
            width: auto;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-inline-btn {
            max-width: 100%;
            min-width: 0;
            white-space: nowrap;
            width: auto;
          }

          @media (max-width: 380px) {
            html body .pf-page .pf-form > :is(#yritys, #tiedot, #julkinen-profiili, #osoite, #tilin-turvallisuus).pf-aligned-section > .pf-card-body {
              margin-left: 12px;
              margin-right: 12px;
              width: calc(100% - 24px);
            }

            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row {
              grid-template-columns: 38px minmax(0, 1fr);
              min-height: 88px;
            }

            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-info-label {
              grid-column: 2;
              grid-row: 1;
              line-height: 1.15;
              overflow-wrap: normal;
              word-break: normal;
            }

            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-info-value {
              grid-column: 2;
              grid-row: 2;
              justify-self: stretch;
              width: 100%;
            }

            html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section .pf-security-action-row .pf-inline-btn {
              width: 100%;
            }
          }

          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-rows.pf-card-body,
          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-rows.pf-card-body,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-info-rows.pf-address-rows.pf-card-body,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-info-rows.pf-card-body {
            align-self: stretch;
            box-sizing: border-box;
            display: grid;
            inline-size: calc(100% - 24px);
            justify-self: stretch;
            margin: 0 12px 18px;
            max-inline-size: none;
            max-width: none;
            min-inline-size: calc(100% - 24px);
            min-width: calc(100% - 24px);
            padding: 0;
            width: calc(100% - 24px);
          }

          html body .pf-page .pf-form > #tiedot.pf-aligned-section > .pf-info-rows.pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #yritys.pf-aligned-section > .pf-info-rows.pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-field,
          html body .pf-page .pf-form > #osoite.pf-aligned-section > .pf-info-rows.pf-address-rows.pf-card-body > .pf-info-row,
          html body .pf-page .pf-form > #tilin-turvallisuus.pf-aligned-section > .pf-info-rows.pf-card-body > .pf-info-row {
            box-sizing: border-box;
            inline-size: 100%;
            max-inline-size: none;
            max-width: none;
            min-inline-size: 100%;
            min-width: 100%;
            width: 100%;
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-public-name-field {
            min-height: 48px;
            padding-bottom: 4px;
            padding-top: 4px;
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-public-bio-field {
            min-height: 118px;
            padding-bottom: 14px;
            padding-top: 14px;
          }

          html body .pf-page .pf-form > #julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-public-bio-field textarea {
            min-height: 72px;
          }

          html body .pf-page #osoite .pf-address-rows,
          html body .pf-page #osoite .pf-country-info-row,
          html body .pf-page #osoite .pf-country-info-row .pf-info-value {
            overflow: visible;
          }

          html body .pf-page #osoite .pf-country-info-row {
            align-items: start;
            isolation: isolate;
            position: relative;
            z-index: 30;
          }

          html body .pf-page #osoite .pf-country-info-row .pf-info-value {
            align-self: start;
            display: block;
          }

          @media (max-width: 640px) {
            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section {
              --pf-card-inset: 14px;
              border-radius: 12px;
              min-height: 0;
              padding-bottom: 18px;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .pf-section-head {
              align-items: start;
              gap: 12px;
              grid-template-columns: 44px minmax(0, 1fr);
              padding: 18px var(--pf-card-inset) 14px;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .pf-section-head > svg {
              height: 44px;
              min-width: 44px;
              padding: 10px;
              width: 44px;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .pf-section-head h2 {
              font-size: 20px;
              line-height: 1.05;
              white-space: normal;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .pf-section-head p {
              font-size: 12px;
              line-height: 1.32;
              max-width: none;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > :is(.company-seller-list, .company-seller-add) {
              box-sizing: border-box;
              inline-size: calc(100% - (var(--pf-card-inset) * 2));
              justify-self: stretch;
              margin: 0 var(--pf-card-inset) 12px;
              max-width: none;
              max-inline-size: none;
              min-width: 0;
              min-inline-size: 0;
              place-self: stretch;
              transform: none;
              width: calc(100% - (var(--pf-card-inset) * 2));
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .company-seller-list {
              display: grid;
              gap: 10px;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .company-seller-list > *,
            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section > .company-seller-add {
              box-sizing: border-box;
              inline-size: 100%;
              justify-self: stretch;
              margin-left: 0;
              margin-right: 0;
              max-width: none;
              max-inline-size: none;
              min-width: 0;
              min-inline-size: 0;
              place-self: stretch;
              transform: none;
              width: 100%;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-empty {
              align-items: flex-start;
              align-self: stretch;
              box-sizing: border-box;
              flex: 1 1 auto;
              inline-size: 100%;
              justify-content: flex-start;
              line-height: 1.3;
              max-width: none;
              max-inline-size: none;
              min-height: 0;
              min-width: 0;
              min-inline-size: 0;
              padding: 14px;
              place-self: stretch;
              text-align: left;
              width: 100%;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add {
              border-radius: 10px;
              box-sizing: border-box;
              inline-size: 100%;
              margin-top: 10px;
              max-width: none;
              max-inline-size: none;
              min-width: 0;
              min-inline-size: 0;
              place-self: stretch;
              transform: none;
              width: 100%;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add-btn {
              align-self: stretch;
              box-sizing: border-box;
              min-height: 56px;
              justify-content: center;
              max-width: none;
              min-width: 0;
              padding: 0 14px;
              white-space: normal;
              width: 100%;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add-fields {
              display: grid;
              gap: 12px;
              padding: 14px;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add:not(.is-open) .company-seller-add-fields {
              display: none;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add-fields label {
              display: grid;
              gap: 7px;
              min-width: 0;
            }

            html body .pf-page .pf-form > #myyjat.pf-company-sellers-section .company-seller-add-fields input {
              width: 100%;
            }
          }

          html body .pf-page .pf-form .pf-phone-change-btn {
            background: linear-gradient(180deg, rgba(18, 50, 76, 0.96), rgba(7, 25, 43, 0.96));
            border: 1px solid rgba(96, 160, 210, 0.48);
            border-radius: 8px;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.08),
              0 10px 20px rgba(0, 0, 0, 0.16);
            color: #ffffff;
            flex: 0 0 auto;
            justify-self: center;
            min-height: 34px;
            min-width: 104px;
            padding: 0 16px;
            width: auto;
          }

          html body .pf-page .pf-form .pf-info-phone-value .pf-phone-actions {
            align-self: center;
            justify-content: center;
            margin-inline: auto;
            width: auto;
          }

          html body .pf-page .pf-form .pf-phone-change-btn:hover:not(:disabled) {
            border-color: rgba(255, 141, 37, 0.78);
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 0 0 2px rgba(255, 122, 24, 0.14),
              0 12px 24px rgba(255, 122, 24, 0.16);
          }

          html body .pf-page .pf-form .pf-phone-change-btn:disabled {
            cursor: not-allowed;
            opacity: 0.48;
          }

          @media (max-width: 760px) {
            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row {
              grid-template-columns: 36px minmax(0, 1fr);
              min-height: 76px;
              padding: 7px 12px 6px;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-info-row-icon {
              height: 34px;
              width: 34px;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-info-label {
              align-self: center;
              grid-column: 2;
              justify-self: start;
              line-height: 1.05;
              margin: 0;
              text-align: left;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-info-phone-value {
              grid-column: 1 / -1;
              margin-top: 0;
              min-height: 28px;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-row {
              align-items: center;
              display: grid;
              gap: 8px;
              grid-template-columns: minmax(0, 1fr) auto;
              min-height: 28px;
              width: 100%;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-card {
              background: transparent;
              border: 0;
              box-shadow: none;
              display: flex;
              min-height: 28px;
              padding: 0;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-number {
              font-size: 13px;
              line-height: 1.1;
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-actions {
              align-items: center;
              align-self: center;
              display: flex;
              justify-content: flex-end;
              margin-inline: 0;
              transform: translateY(-4px);
            }

            html body .pf-page .pf-form .pf-info-row.pf-phone-info-row .pf-phone-change-btn {
              height: 26px;
              min-height: 26px;
              min-width: 72px;
              padding: 0 10px;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) {
              min-height: 82px;
              padding-bottom: 6px;
              padding-top: 7px;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-info-row-icon {
              height: 34px;
              width: 34px;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-info-label {
              justify-self: start;
              line-height: 1.05;
              margin-bottom: 0;
              text-align: left;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-info-phone-value {
              margin-top: 2px;
              min-height: 28px;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-row {
              align-items: center;
              display: grid;
              gap: 8px;
              grid-template-columns: minmax(0, 1fr) auto;
              min-height: 28px;
              width: 100%;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-card {
              background: transparent;
              border: 0;
              box-shadow: none;
              display: flex;
              min-height: 28px;
              padding: 0;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-number {
              font-size: 13px;
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-actions {
              align-items: center;
              align-self: center;
              display: flex;
              justify-content: flex-end;
              margin-inline: 0;
              transform: translateY(-5px);
            }

            html body .pf-page .pf-form .pf-info-row:has(.pf-phone-row) .pf-phone-change-btn {
              height: 26px;
              min-height: 26px;
              min-width: 72px;
              padding: 0 10px;
            }
          }

          html body .pf-modal-backdrop:has(.pf-delete-modal) {
            align-items: flex-start;
            padding: calc(var(--topbar-h, 58px) + env(safe-area-inset-top, 0px) + 72px) 20px 28px;
            overflow-y: auto;
          }

          html body .pf-phone-modal.pf-delete-modal {
            margin: 0 auto 28px;
            max-height: none;
            width: min(100%, 420px);
          }

          html body .pf-phone-modal.pf-delete-modal .pf-modal-close {
            right: 16px;
            top: 16px;
          }

          html body .pf-page #osoite,
          html body .pf-page #osoite > .pf-address-rows,
          html body .pf-page #osoite .pf-country-info-row,
          html body .pf-page #osoite .pf-country-info-row > .pf-info-value {
            overflow: visible;
          }

          html body .pf-page .pf-nav-item,
          html body .pf-page .pf-nav-item * {
            min-width: 0;
            overflow-wrap: normal;
            text-wrap: nowrap;
            white-space: nowrap;
            word-break: keep-all;
          }

          html body .pf-page .pf-nav-item {
            overflow: hidden;
            text-overflow: ellipsis;
          }

          @media (max-width: 1180px) {
            html body .pf-page .pf-layout {
              align-items: stretch;
              display: grid;
              gap: 16px;
              grid-template-columns: 1fr;
              padding: 16px 18px 28px;
              width: min(100%, 980px);
            }

            html body .pf-page .pf-sidebar {
              display: grid;
              gap: 12px;
              grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr);
              position: static;
              top: auto;
              width: 100%;
            }

            html body .pf-page .pf-user-card {
              min-width: 0;
              width: 100%;
            }

            html body .pf-page .pf-user-name {
              max-width: none;
            }

            html body .pf-page .pf-nav {
              align-self: stretch;
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              overflow: hidden;
              width: 100%;
            }

            html body .pf-page .pf-nav-item {
              border-bottom: 1px solid rgba(96, 148, 192, 0.2);
              border-left: 0;
              border-top: 3px solid transparent;
              font-size: 12px;
              justify-content: flex-start;
              min-height: 48px;
              padding: 0 12px;
            }

            html body .pf-page .pf-nav-active,
            html body .pf-page .pf-nav-item:hover {
              border-left-color: transparent;
              border-top-color: #ff8a1f;
            }
          }

          @media (max-width: 820px) {
            html body .pf-page .pf-layout {
              padding: 12px 10px 24px;
              width: 100%;
            }

            html body .pf-page .pf-sidebar {
              grid-template-columns: 1fr;
            }

            html body .pf-page .pf-nav {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            html body .pf-page .pf-nav-item {
              min-height: 46px;
            }
          }

          @media (max-width: 520px) {
            html body .pf-page .pf-nav {
              grid-template-columns: 1fr;
            }

            html body .pf-page .pf-nav-item {
              border-top: 0;
              border-left: 3px solid transparent;
              font-size: 13px;
              min-height: 50px;
            }

            html body .pf-page .pf-nav-active,
            html body .pf-page .pf-nav-item:hover {
              border-left-color: #ff8a1f;
              border-top-color: transparent;
            }
          }

          @media (max-width: 640px) {
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-list.pf-card-body,
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-add.pf-card-body {
              box-sizing: border-box;
              display: grid;
              inline-size: calc(100% - 28px);
              justify-self: stretch;
              margin: 0 14px 12px;
              max-inline-size: none;
              max-width: none;
              min-inline-size: 0;
              min-width: 0;
              padding-left: 0;
              padding-right: 0;
              place-self: stretch;
              transform: none;
              width: calc(100% - 28px);
            }

            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-list.pf-card-body > .company-seller-empty,
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-list.pf-card-body > .company-seller-card,
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-add.pf-card-body > .company-seller-add-btn,
            html body .pf-page .pf-form > section#myyjat.pf-company-sellers-section > div.company-seller-add.pf-card-body > .company-seller-add-fields {
              box-sizing: border-box;
              inline-size: 100%;
              justify-self: stretch;
              margin-left: 0;
              margin-right: 0;
              max-inline-size: none;
              max-width: none;
              min-inline-size: 0;
              min-width: 0;
              place-self: stretch;
              transform: none;
              width: 100%;
            }

            html body .pf-page .pf-form #tilin-turvallisuus .pf-company-verify-row .pf-info-value > .pf-company-verify-ok {
              background: transparent;
              border: 0;
              box-shadow: none;
              color: #4ade80;
              -webkit-text-fill-color: #4ade80;
              padding: 0;
            }
          }
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page {
          background:
            radial-gradient(900px 540px at 8% 18%, rgba(17, 82, 125, 0.17), transparent 68%),
            radial-gradient(720px 440px at 94% 12%, rgba(255, 122, 24, 0.055), transparent 72%),
            linear-gradient(180deg, #07111b 0%, #081521 48%, #06101a 100%);
          color: #eef6fc;
          min-height: calc(100vh - 72px);
          padding: 28px 22px 54px;
        }

        html body .pf-page .pf-layout {
          align-items: start;
          display: grid;
          gap: 18px;
          grid-template-areas: "sidebar content insights";
          grid-template-columns: 248px minmax(520px, 1fr) 282px;
          margin: 0 auto;
          max-width: 1480px;
          padding: 0;
          width: 100%;
        }

        html body .pf-page .pf-sidebar {
          align-self: start;
          background: linear-gradient(180deg, rgba(10, 27, 42, 0.97), rgba(5, 18, 30, 0.98));
          border: 1px solid rgba(113, 153, 184, 0.18);
          border-radius: 13px;
          box-shadow: 0 22px 60px rgba(0, 6, 13, 0.24);
          display: block;
          grid-area: sidebar;
          min-height: 0;
          overflow: hidden;
          position: sticky;
          top: 90px;
        }

        html body .pf-page .pf-user-card {
          align-items: center;
          background:
            radial-gradient(190px 110px at 0% 0%, rgba(255, 123, 25, 0.17), transparent 72%),
            rgba(7, 24, 38, 0.72);
          border: 0;
          border-bottom: 1px solid rgba(113, 153, 184, 0.18);
          border-radius: 0;
          display: grid;
          gap: 13px;
          grid-template-columns: 68px minmax(0, 1fr);
          min-height: 116px;
          padding: 18px;
        }

        html body .pf-page .pf-avatar,
        html body .pf-page .pf-avatar-upload {
          background: #10283b;
          border: 2px solid rgba(255, 139, 39, 0.88);
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(255, 128, 27, 0.08);
          height: 64px;
          min-height: 64px;
          width: 64px;
        }

        html body .pf-page .pf-avatar-overlay {
          background: #ff7a1a;
          border: 2px solid #0a1927;
          border-radius: 50%;
          bottom: -2px;
          color: #fff;
          display: flex;
          height: 24px;
          opacity: 1;
          right: -2px;
          top: auto;
          width: 24px;
        }

        html body .pf-page .pf-user-name {
          color: #fff;
          font-size: 15px;
          font-weight: 900;
          line-height: 1.25;
          margin: 0;
        }

        html body .pf-page .pf-company-badge {
          background: transparent;
          border: 0;
          color: #91a6b8;
          font-size: 11px;
          font-weight: 750;
          margin: 3px 0 0;
          padding: 0;
        }

        html body .pf-page .pf-avatar-actions {
          display: flex;
          gap: 7px;
          margin-top: 7px;
        }

        html body .pf-page .pf-avatar-action {
          background: transparent;
          border: 0;
          color: #ff9b45;
          font-size: 10px;
          font-weight: 850;
          gap: 4px;
          padding: 0;
        }

        html body .pf-page .pf-nav {
          display: grid;
          grid-template-columns: 1fr;
          width: 100%;
        }

        html body .pf-page .pf-nav-item {
          align-items: center;
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(113, 153, 184, 0.11);
          border-left: 3px solid transparent;
          border-radius: 0;
          color: #acbac7;
          display: grid;
          font-size: 13px;
          font-weight: 850;
          gap: 12px;
          grid-template-columns: 22px minmax(0, 1fr) auto;
          height: 58px;
          min-height: 58px;
          padding: 0 15px;
          text-align: left;
        }

        html body .pf-page .pf-nav-item:hover,
        html body .pf-page .pf-nav-active {
          background:
            radial-gradient(180px 80px at 30% 50%, rgba(255, 126, 25, 0.13), transparent 76%),
            rgba(13, 36, 55, 0.72);
          border-left-color: #ff7a1a;
          border-top-color: transparent;
          color: #fff;
          padding-left: 15px;
        }

        html body .pf-page .pf-nav-active svg,
        html body .pf-page .pf-nav-item:hover > svg:first-child {
          color: #ff8b29;
        }

        html body .pf-page .pf-content {
          grid-area: content;
          min-width: 0;
          padding: 0;
          width: 100%;
        }

        html body .pf-page .pf-form {
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr);
          width: 100%;
        }

        html body .pf-page .pf-form > :is(section, .pf-save-bar) {
          grid-column: 1;
          width: 100%;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section) {
          background:
            radial-gradient(680px 220px at 8% 0%, rgba(38, 102, 148, 0.11), transparent 72%),
            linear-gradient(180deg, rgba(11, 28, 42, 0.97), rgba(7, 21, 34, 0.99));
          border: 1px solid rgba(101, 145, 179, 0.2);
          border-radius: 12px;
          box-shadow: 0 18px 48px rgba(0, 6, 14, 0.18);
          overflow: hidden;
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          border: 0;
          display: grid;
          gap: 13px;
          grid-template-columns: 42px minmax(0, 1fr) auto;
          min-height: 72px;
          padding: 14px 18px 10px;
        }

        html body .pf-page .pf-info-title {
          gap: 13px;
          grid-template-columns: 42px minmax(0, 1fr);
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          background: transparent;
          border: 0;
          border-radius: 0;
          color: #ff891f;
          height: 42px;
          padding: 9px;
          width: 42px;
        }

        html body .pf-page :is(.pf-info-card-head h2, .pf-section-head h2) {
          color: #f6f9fc;
          font-size: 17px;
          font-weight: 900;
        }

        html body .pf-page :is(.pf-info-card-head p, .pf-section-head p) {
          color: #8294a4;
          font-size: 12px;
          font-weight: 650;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
          background: transparent;
          border: 0;
          border-radius: 0;
          margin: 0;
          padding: 0 18px 17px;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide) {
          background: rgba(3, 15, 25, 0.34);
          border: 1px solid rgba(112, 151, 181, 0.14);
          border-bottom: 1px solid rgba(112, 151, 181, 0.14);
          border-radius: 7px;
          margin-top: 7px;
          min-height: 48px;
          padding: 6px 10px;
        }

        html body .pf-page .pf-save-bar {
          background: transparent;
          border: 0;
          box-shadow: none;
          justify-content: flex-start;
          padding: 8px 0 0;
        }

        html body .pf-page .pf-save-btn {
          background: linear-gradient(135deg, #ff961f, #f26a0b);
          border: 1px solid rgba(255, 193, 131, 0.45);
          border-radius: 8px;
          box-shadow: 0 14px 30px rgba(238, 99, 5, 0.2);
          min-height: 45px;
        }

        html body .pf-page .pf-insights {
          align-self: start;
          display: grid;
          gap: 14px;
          grid-area: insights;
          min-width: 0;
          position: sticky;
          top: 90px;
        }

        html body .pf-page .pf-insight-card {
          background:
            radial-gradient(260px 150px at 10% 0%, rgba(28, 94, 139, 0.13), transparent 72%),
            linear-gradient(180deg, rgba(11, 28, 42, 0.98), rgba(7, 21, 34, 0.99));
          border: 1px solid rgba(101, 145, 179, 0.2);
          border-radius: 12px;
          box-shadow: 0 18px 48px rgba(0, 6, 14, 0.18);
          overflow: hidden;
          padding: 17px;
        }

        html body .pf-page .pf-insight-heading {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: 35px minmax(0, 1fr);
        }

        html body .pf-page .pf-insight-icon {
          align-items: center;
          background: rgba(255, 126, 25, 0.08);
          border: 1px solid rgba(255, 137, 31, 0.42);
          border-radius: 9px;
          color: #ff8a1f;
          display: inline-flex;
          height: 35px;
          justify-content: center;
          width: 35px;
        }

        html body .pf-page .pf-insight-heading h2 {
          color: #f7fafc;
          font-size: 15px;
          font-weight: 900;
          margin: 0;
        }

        html body .pf-page .pf-insight-heading p {
          color: #8193a3;
          font-size: 10px;
          font-weight: 700;
          margin: 2px 0 0;
        }

        html body .pf-page .pf-trust-score {
          align-items: center;
          display: flex;
          flex-direction: column;
          padding: 21px 0 14px;
          text-align: center;
        }

        html body .pf-page .pf-trust-emblem {
          align-items: center;
          background:
            radial-gradient(circle at 50% 36%, #ffbb61, #ef6d11 62%, #6d2705 100%);
          border: 1px solid rgba(255, 208, 153, 0.7);
          border-radius: 50% 50% 44% 44%;
          box-shadow: 0 0 28px rgba(255, 120, 22, 0.28);
          color: #fff;
          display: flex;
          height: 62px;
          justify-content: center;
          margin-bottom: 10px;
          width: 62px;
        }

        html body .pf-page .pf-trust-score strong {
          color: #fff;
          font-size: 19px;
          font-weight: 950;
        }

        html body .pf-page .pf-trust-score > span {
          color: #c6d2dc;
          font-size: 11px;
          font-weight: 750;
          margin-top: 2px;
        }

        html body .pf-page .pf-progress-track {
          background: rgba(106, 137, 160, 0.17);
          border-radius: 999px;
          height: 6px;
          overflow: hidden;
          width: 100%;
        }

        html body .pf-page .pf-progress-track > span {
          background: linear-gradient(90deg, #ff8d1c, #ffb13b);
          border-radius: inherit;
          display: block;
          height: 100%;
        }

        html body .pf-page .pf-insight-list {
          border-top: 1px solid rgba(110, 148, 177, 0.14);
          display: grid;
          gap: 0;
          margin-top: 15px;
          padding-top: 8px;
        }

        html body .pf-page .pf-insight-list > div {
          align-items: center;
          color: #8193a2;
          display: flex;
          font-size: 11px;
          font-weight: 700;
          gap: 8px;
          justify-content: space-between;
          min-height: 30px;
        }

        html body .pf-page .pf-insight-list > div.is-complete {
          color: #c3d1dc;
        }

        html body .pf-page .pf-insight-list > div.is-complete svg {
          color: #32d16d;
        }

        html body .pf-page .pf-insight-dot {
          border: 1px solid #587083;
          border-radius: 50%;
          height: 13px;
          width: 13px;
        }

        html body .pf-page .pf-insight-action {
          align-items: center;
          background: transparent;
          border: 1px solid #f47816;
          border-radius: 7px;
          color: #ff8b25;
          display: flex;
          font-size: 12px;
          font-weight: 900;
          gap: 7px;
          justify-content: center;
          margin-top: 12px;
          min-height: 39px;
          width: 100%;
        }

        html body .pf-page .pf-completion-overview {
          align-items: center;
          display: grid;
          gap: 13px;
          grid-template-columns: 70px minmax(0, 1fr);
          padding: 20px 0 8px;
        }

        html body .pf-page .pf-completion-ring {
          align-items: center;
          background: conic-gradient(#ff8b1f var(--profile-progress), rgba(101, 137, 164, 0.18) 0);
          border-radius: 50%;
          display: flex;
          height: 68px;
          justify-content: center;
          position: relative;
          width: 68px;
        }

        html body .pf-page .pf-completion-ring::before {
          background: #0a1a29;
          border-radius: 50%;
          content: "";
          inset: 8px;
          position: absolute;
        }

        html body .pf-page .pf-completion-ring span {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          position: relative;
        }

        html body .pf-page .pf-completion-overview > div:last-child {
          display: grid;
          gap: 3px;
        }

        html body .pf-page .pf-completion-overview strong {
          color: #eef5fb;
          font-size: 12px;
          font-weight: 900;
        }

        html body .pf-page .pf-completion-overview > div:last-child span {
          color: #8193a3;
          font-size: 10px;
          line-height: 1.35;
        }

        html body .pf-page .pf-completion-list {
          max-height: 228px;
          overflow-y: auto;
          padding-right: 3px;
        }

        html body .pf-page .pf-avatar-crop-modal {
          background: linear-gradient(180deg, #0c2234, #071725);
          border: 1px solid rgba(255, 139, 36, 0.38);
          border-radius: 14px;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.58);
        }

        html body .pf-page .pf-avatar-crop-frame {
          border: 2px solid #ff8420;
          box-shadow: 0 0 0 6px rgba(255, 126, 26, 0.08);
        }

        @media (max-width: 1250px) {
          html body .pf-page .pf-layout {
            grid-template-areas:
              "sidebar content"
              "insights insights";
            grid-template-columns: 230px minmax(0, 1fr);
          }

          html body .pf-page .pf-insights {
            display: grid;
            grid-area: insights;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            position: static;
          }
        }

        @media (max-width: 900px) {
          html body .pf-page {
            padding: 14px 10px 34px;
          }

          html body .pf-page .pf-layout {
            grid-template-areas:
              "sidebar"
              "content"
              "insights";
            grid-template-columns: 1fr;
          }

          html body .pf-page .pf-sidebar {
            position: static;
          }

          html body .pf-page .pf-nav {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          html body .pf-page .pf-nav-item {
            border: 1px solid rgba(113, 153, 184, 0.12);
            border-left: 3px solid transparent;
          }

          html body .pf-page .pf-nav-active,
          html body .pf-page .pf-nav-item:hover {
            border-left-color: #ff7a1a;
            border-top-color: rgba(113, 153, 184, 0.12);
          }
        }

        @media (max-width: 620px) {
          html body .pf-page .pf-insights,
          html body .pf-page .pf-nav {
            grid-template-columns: 1fr;
          }

          html body .pf-page .pf-user-card {
            grid-template-columns: 64px minmax(0, 1fr);
          }

          html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
            grid-template-columns: 38px minmax(0, 1fr);
            padding: 13px;
          }

          html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
            padding: 0 12px 12px;
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
            linear-gradient(145deg, #141518 0%, #0b0c0e 52%, #151619 100%);
          background-size: 42px 42px, 42px 42px, auto, auto, auto;
          color: #f7f4f0;
        }

        html body .pf-page .pf-sidebar,
        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section),
        html body .pf-page .pf-insight-card {
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 46%),
            linear-gradient(180deg, rgba(31, 32, 35, 0.98), rgba(17, 18, 20, 0.99));
          border: 1px solid rgba(255, 255, 255, 0.105);
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.045);
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section) {
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section)::before {
          background: linear-gradient(90deg, var(--pf-orange), rgba(255, 174, 75, 0.68), transparent 80%);
          content: "";
          height: 2px;
          left: 0;
          opacity: 0.75;
          position: absolute;
          right: 0;
          top: 0;
          z-index: 2;
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section):hover {
          border-color: rgba(255, 130, 34, 0.3);
          box-shadow:
            0 27px 74px rgba(0, 0, 0, 0.34),
            0 0 0 1px rgba(255, 126, 26, 0.035),
            inset 0 1px 0 rgba(255, 255, 255, 0.055);
        }

        html body .pf-page .pf-sidebar {
          border-radius: 16px;
        }

        html body .pf-page .pf-user-card {
          align-items: center;
          background:
            radial-gradient(180px 120px at 12% 8%, rgba(255, 137, 37, 0.22), transparent 74%),
            linear-gradient(135deg, rgba(45, 38, 31, 0.96), rgba(17, 16, 15, 0.98));
          border-bottom: 1px solid rgba(255, 255, 255, 0.105);
          gap: 16px;
          grid-template-columns: 78px minmax(0, 1fr);
          min-height: 136px;
          overflow: hidden;
          padding: 20px 17px;
          position: relative;
        }

        html body .pf-page .pf-user-card::after {
          border: 1px solid rgba(255, 139, 47, 0.13);
          border-radius: 50%;
          content: "";
          height: 130px;
          pointer-events: none;
          position: absolute;
          right: -70px;
          top: -72px;
          width: 130px;
        }

        html body .pf-page .pf-avatar,
        html body .pf-page .pf-avatar-upload {
          background: linear-gradient(145deg, #30271f, #12110f);
          border: 2px solid #ff8a27;
          box-shadow:
            0 0 0 5px rgba(255, 122, 24, 0.1),
            0 12px 28px rgba(0, 0, 0, 0.34);
          height: 72px;
          min-height: 72px;
          width: 72px;
        }

        html body .pf-page .pf-avatar-overlay {
          background: linear-gradient(145deg, #ffad45, #f06408);
          border-color: #171411;
          box-shadow: 0 5px 12px rgba(0, 0, 0, 0.34);
          height: 27px;
          width: 27px;
        }

        html body .pf-page .pf-user-name {
          color: #fafafa;
          font-size: 16px;
          letter-spacing: -0.01em;
        }

        html body .pf-page .pf-company-badge {
          color: #b8afa6;
          font-size: 11px;
        }

        html body .pf-page .pf-avatar-actions {
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          position: relative;
          z-index: 1;
        }

        html body .pf-page .pf-avatar-action {
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 6px;
          color: #fff4e8;
          min-height: 25px;
          padding: 0 8px;
        }

        html body .pf-page .pf-avatar-action:hover {
          background: rgba(255, 122, 24, 0.13);
          border-color: rgba(255, 137, 41, 0.42);
          color: #ffaf57;
        }

        html body .pf-page .pf-avatar-action.danger {
          background: rgba(255, 68, 68, 0.07);
          border-color: rgba(255, 92, 92, 0.24);
          color: #ff9a90;
        }

        html body .pf-page .pf-nav-item {
          border-bottom-color: rgba(255, 255, 255, 0.075);
          color: #aaa49d;
          min-height: 62px;
          transition: background 160ms ease, color 160ms ease;
        }

        html body .pf-page .pf-nav-item > svg:first-child {
          color: #77736f;
          filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.25));
        }

        html body .pf-page .pf-nav-item:hover,
        html body .pf-page .pf-nav-active {
          background:
            linear-gradient(90deg, rgba(255, 119, 16, 0.22), rgba(255, 135, 31, 0.055) 72%, transparent);
          border-left-color: #ff7a18;
          color: #fff9f2;
        }

        html body .pf-page .pf-nav-active::after {
          background: #ff8a28;
          border-radius: 999px;
          box-shadow: 0 0 14px rgba(255, 123, 25, 0.58);
          content: "";
          height: 26px;
          justify-self: end;
          width: 3px;
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          background:
            linear-gradient(90deg, rgba(255, 122, 24, 0.055), transparent 44%);
          min-height: 82px;
          padding: 17px 20px 12px;
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg) {
          background: linear-gradient(145deg, rgba(255, 154, 54, 0.2), rgba(255, 102, 8, 0.07));
          border: 1px solid rgba(255, 139, 40, 0.36);
          border-radius: 12px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 8px 20px rgba(0, 0, 0, 0.2);
          color: #ff952f;
        }

        html body .pf-page #julkinen-profiili .pf-section-head > svg {
          background: linear-gradient(145deg, rgba(255, 183, 76, 0.2), rgba(255, 114, 13, 0.06));
          border-color: rgba(255, 166, 65, 0.36);
          color: #ffb04e;
        }

        html body .pf-page :is(.pf-info-card-head h2, .pf-section-head h2) {
          color: #fffaf4;
          font-size: 18px;
          letter-spacing: -0.015em;
        }

        html body .pf-page :is(.pf-info-card-head p, .pf-section-head p) {
          color: #9fa2a7;
          font-weight: 650;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
          padding: 0 20px 20px;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide) {
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0.008));
          border-color: rgba(255, 255, 255, 0.085);
          border-bottom-color: rgba(255, 255, 255, 0.085);
          border-radius: 9px;
          min-height: 52px;
          transition: background 160ms ease, border-color 160ms ease;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover {
          background: linear-gradient(90deg, rgba(255, 127, 28, 0.065), rgba(255, 255, 255, 0.014));
          border-color: rgba(255, 145, 52, 0.2);
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          background: linear-gradient(145deg, #303237, #1c1d20);
          border-color: rgba(255, 255, 255, 0.1);
          color: #d2d4d8;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover :is(.pf-info-row-icon, .pf-field-icon) {
          background: linear-gradient(145deg, rgba(255, 141, 43, 0.22), rgba(255, 91, 5, 0.08));
          border-color: rgba(255, 145, 52, 0.3);
          color: #ffad56;
        }

        html body .pf-page :is(.pf-info-label, .pf-field label) {
          color: #a4a7ac;
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
          color: #fafafa;
          -webkit-text-fill-color: #fafafa;
        }

        html body .pf-page :is(
          .pf-info-value input:not(:disabled):focus,
          #julkinen-profiili input:focus,
          #julkinen-profiili textarea:focus,
          #osoite input:focus
        ) {
          background: rgba(255, 123, 24, 0.075);
          border-color: rgba(255, 147, 56, 0.36);
          box-shadow: 0 0 0 3px rgba(255, 122, 24, 0.07);
        }

        html body .pf-page :is(.pf-inline-btn, .company-seller-small-btn) {
          background: #242529;
          border-color: rgba(255, 255, 255, 0.13);
          color: #f3f4f5;
        }

        html body .pf-page :is(.pf-inline-btn.verify, .company-seller-add-btn, .pf-save-btn) {
          background: linear-gradient(135deg, #ff9d35, #f26708);
          border-color: rgba(255, 193, 126, 0.48);
          box-shadow:
            0 13px 28px rgba(224, 81, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
          color: #fff;
        }

        html body .pf-page :is(.pf-inline-btn.verify, .company-seller-add-btn, .pf-save-btn):hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        html body .pf-page .pf-insights {
          gap: 16px;
        }

        html body .pf-page .pf-insight-card {
          border-radius: 16px;
          overflow: hidden;
          padding: 19px;
          position: relative;
        }

        html body .pf-page .pf-insight-card::before {
          background: radial-gradient(circle, rgba(255, 138, 35, 0.18), transparent 68%);
          content: "";
          height: 180px;
          pointer-events: none;
          position: absolute;
          right: -90px;
          top: -95px;
          width: 180px;
        }

        html body .pf-page .pf-insight-icon {
          background: linear-gradient(145deg, rgba(255, 157, 58, 0.2), rgba(255, 99, 7, 0.07));
          border-color: rgba(255, 139, 42, 0.38);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
          color: #ff9c37;
        }

        html body .pf-page .pf-insight-heading h2 {
          color: #fff9f2;
        }

        html body .pf-page .pf-insight-heading p,
        html body .pf-page .pf-completion-overview > div:last-child span {
          color: #9fa2a7;
        }

        html body .pf-page .pf-trust-emblem {
          background:
            radial-gradient(circle at 42% 30%, #ffd083, #ff8a24 44%, #c94600 74%, #4b1700 100%);
          border: 2px solid rgba(255, 211, 151, 0.78);
          box-shadow:
            0 0 0 7px rgba(255, 122, 24, 0.07),
            0 16px 32px rgba(199, 63, 0, 0.24);
          height: 72px;
          width: 72px;
        }

        html body .pf-page .pf-progress-track {
          background: rgba(255, 255, 255, 0.09);
          height: 7px;
        }

        html body .pf-page .pf-progress-track > span {
          background: linear-gradient(90deg, #f4680b, #ffad42);
          box-shadow: 0 0 12px rgba(255, 125, 26, 0.38);
        }

        html body .pf-page .pf-insight-list {
          border-top-color: rgba(255, 255, 255, 0.085);
        }

        html body .pf-page .pf-insight-list > div {
          color: #8f9297;
        }

        html body .pf-page .pf-insight-list > div.is-complete {
          color: #c7c9cd;
        }

        html body .pf-page .pf-completion-ring {
          background: conic-gradient(#ff8a21 var(--profile-progress), rgba(255, 255, 255, 0.095) 0);
          box-shadow: 0 0 25px rgba(255, 113, 13, 0.11);
        }

        html body .pf-page .pf-completion-ring::before {
          background: #191a1d;
          box-shadow: inset 0 0 14px rgba(0, 0, 0, 0.35);
        }

        html body .pf-page .pf-insight-action {
          background: linear-gradient(90deg, rgba(255, 122, 24, 0.09), rgba(255, 122, 24, 0.025));
          border-color: rgba(255, 129, 31, 0.72);
          color: #ffa34a;
        }

        html body .pf-page :is(.company-seller-card, .company-seller-add, .company-seller-empty) {
          background: rgba(255, 255, 255, 0.025);
          border-color: rgba(255, 255, 255, 0.09);
        }

        html body .pf-page .company-seller-avatar {
          background: linear-gradient(145deg, #ff9d38, #cf4a00);
          border-color: rgba(255, 207, 151, 0.5);
          box-shadow: 0 8px 20px rgba(198, 62, 0, 0.18);
        }

        html body .pf-page .pf-public-note {
          background: linear-gradient(90deg, rgba(255, 122, 24, 0.08), rgba(255, 255, 255, 0.018));
          border-top-color: rgba(255, 139, 42, 0.16);
          color: #b3b5b9;
        }

        html body .pf-page .pf-modal-backdrop {
          background: rgba(4, 4, 3, 0.78);
          backdrop-filter: blur(10px);
        }

        html body .pf-page :is(.pf-phone-modal, .pf-avatar-crop-modal) {
          background:
            radial-gradient(320px 190px at 10% 0%, rgba(255, 126, 27, 0.12), transparent 72%),
            linear-gradient(180deg, #25262a, #131416);
          border-color: rgba(255, 139, 42, 0.34);
        }

        html body .pf-page .pf-password-field > span {
          color: #d7d1ca;
        }

        html body .pf-page .pf-password-field input {
          background: rgba(255, 255, 255, 0.055);
          border-color: rgba(255, 255, 255, 0.14);
          color: #ffffff;
        }

        html body .pf-page .pf-password-visibility {
          color: #aeb4bd;
        }

        html body .pf-page .pf-password-visibility:hover,
        html body .pf-page .pf-password-visibility:focus-visible {
          color: #ff9b3d;
        }

        html body .pf-page .pf-password-field input:focus {
          border-color: rgba(255, 139, 42, 0.72);
          box-shadow: 0 0 0 3px rgba(255, 122, 24, 0.13);
        }

        html body .pf-page .pf-password-modal .pf-phone-status {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          color: #d6d8dc;
        }

        @media (max-width: 620px) {
          html body .pf-page .pf-user-card {
            grid-template-columns: 72px minmax(0, 1fr);
            padding: 17px 14px;
          }

          html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
            min-height: 74px;
          }
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page {
          padding: 22px 14px 34px;
        }

        html body .pf-page .pf-layout {
          gap: 24px;
          grid-template-areas: "sidebar content";
          grid-template-columns: 248px minmax(620px, 1fr);
          max-width: 1126px;
        }

        html body .pf-page .pf-profile-heading {
          display: block;
          margin: 6px 2px 22px;
        }

        html body .pf-page .pf-profile-heading h1 {
          color: #fafafa;
          font-size: 25px;
          font-weight: 950;
          letter-spacing: -0.03em;
          margin: 0 0 5px;
        }

        html body .pf-page .pf-profile-heading p {
          color: #a5a8ad;
          font-size: 13px;
          margin: 0;
        }

        html body .pf-page .pf-sidebar {
          top: 86px;
        }

        html body .pf-page .pf-user-card {
          grid-template-columns: 78px minmax(0, 1fr);
          min-height: 180px;
        }

        html body .pf-page .pf-sidebar-progress {
          display: grid;
          gap: 9px;
          grid-column: 1 / -1;
          margin-top: 5px;
          position: relative;
          width: 100%;
          z-index: 1;
        }

        html body .pf-page .pf-sidebar-progress > div {
          align-items: center;
          color: #c7c9cd;
          display: flex;
          font-size: 11px;
          font-weight: 800;
          justify-content: space-between;
        }

        html body .pf-page .pf-sidebar-progress strong {
          color: #fff;
          font-size: 12px;
        }

        html body .pf-page .pf-sidebar-progress-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          display: block;
          height: 6px;
          overflow: hidden;
        }

        html body .pf-page .pf-sidebar-progress-track > span {
          background: linear-gradient(90deg, #f06408, #ff9b34);
          border-radius: inherit;
          box-shadow: 0 0 12px rgba(255, 122, 24, 0.38);
          display: block;
          height: 100%;
        }

        html body .pf-page .pf-nav-item {
          min-height: 56px;
        }

        html body .pf-page .pf-logout-button {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 9px;
          color: #f1f2f3;
          margin: 14px;
          min-height: 43px;
          width: calc(100% - 28px);
        }

        html body .pf-page .pf-logout-button:hover {
          background: rgba(255, 122, 24, 0.1);
          border-color: rgba(255, 136, 39, 0.34);
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section) {
          border-radius: 14px;
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          min-height: 72px;
          padding: 14px 22px 6px;
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
          margin: 0 28px 16px;
          padding: 0;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide) {
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.095);
          border-radius: 0;
          margin: 0;
          min-height: 48px;
          padding: 6px 4px;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):last-child {
          border-bottom: 0;
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover {
          background: linear-gradient(90deg, rgba(255, 124, 25, 0.065), transparent);
          border-color: rgba(255, 153, 67, 0.2);
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          background: transparent;
          border: 0;
          color: #a8a19a;
        }

        html body .pf-page .pf-insights {
          top: 86px;
        }

        html body .pf-page .pf-insight-card {
          padding: 21px;
        }

        html body .pf-page .pf-help-card .pf-insight-action {
          margin-top: 18px;
          text-decoration: none;
        }

        html body .pf-page .pf-mfa-value {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        html body .pf-page .pf-mfa-state {
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          color: #aaa29a;
          font-size: 11px;
          font-weight: 850;
          padding: 5px 10px;
          white-space: nowrap;
        }

        html body .pf-page .pf-mfa-state.is-enabled {
          background: rgba(68, 190, 88, 0.12);
          border-color: rgba(78, 207, 100, 0.28);
          color: #74df83;
        }

        html body .pf-page .pf-mfa-manage-btn {
          min-width: 112px;
        }

        html body .pf-page .pf-mfa-modal {
          max-width: 580px;
          width: calc(100% - 28px);
        }

        html body .pf-page .pf-mfa-options {
          display: grid;
          gap: 12px;
          margin: 22px 0 14px;
        }

        html body .pf-page .pf-mfa-options > button {
          align-items: center;
          background:
            linear-gradient(100deg, rgba(255, 128, 29, 0.1), rgba(255, 255, 255, 0.025));
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          color: #f8f1ea;
          cursor: pointer;
          display: grid;
          gap: 13px;
          grid-template-columns: 48px minmax(0, 1fr) 20px;
          min-height: 88px;
          padding: 13px 15px;
          text-align: left;
          transition: border-color 160ms ease, transform 160ms ease;
        }

        html body .pf-page .pf-mfa-options > button:hover {
          border-color: rgba(255, 139, 42, 0.46);
          transform: translateY(-1px);
        }

        html body .pf-page .pf-mfa-option-icon {
          align-items: center;
          background: linear-gradient(145deg, #ff9d38, #d54b00);
          border-radius: 11px;
          color: #fff;
          display: flex;
          height: 48px;
          justify-content: center;
          width: 48px;
        }

        html body .pf-page .pf-mfa-options strong,
        html body .pf-page .pf-mfa-options small {
          display: block;
        }

        html body .pf-page .pf-mfa-options strong {
          font-size: 14px;
          margin-bottom: 4px;
        }

        html body .pf-page .pf-mfa-options small {
          color: #a8a098;
          font-size: 11px;
          line-height: 1.4;
        }

        html body .pf-page .pf-mfa-options .pf-mfa-option-arrow {
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          color: currentColor;
          display: block;
          outline: 0;
          padding: 0;
        }

        html body .pf-page .pf-mfa-disable {
          background: transparent;
          border: 0;
          color: #ff8e84;
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
          padding: 10px;
          width: 100%;
        }

        html body .pf-page .pf-mfa-qr {
          background: #fff;
          border: 8px solid #fff;
          border-radius: 13px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.38);
          height: 220px;
          margin: 20px auto 14px;
          overflow: hidden;
          width: 220px;
        }

        html body .pf-page .pf-mfa-qr img {
          display: block;
          height: 100%;
          width: 100%;
        }

        html body .pf-page .pf-mfa-secret {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 9px;
          display: grid;
          gap: 5px;
          margin: 0 auto 14px;
          max-width: 390px;
          padding: 10px 13px;
          text-align: center;
        }

        html body .pf-page .pf-mfa-secret span {
          color: #9f978f;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        html body .pf-page .pf-mfa-secret code {
          color: #ffb35d;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        html body .pf-page .pf-mfa-code-field {
          display: grid;
          gap: 7px;
          margin: 0 auto 17px;
          max-width: 300px;
        }

        html body .pf-page .pf-mfa-code-field span {
          color: #c5bdb5;
          font-size: 12px;
          font-weight: 800;
        }

        html body .pf-page .pf-mfa-code-field input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 144, 49, 0.3);
          border-radius: 9px;
          color: #fff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: 0.28em;
          min-height: 52px;
          text-align: center;
        }

        @media (max-width: 1250px) {
          html body .pf-page .pf-layout {
            grid-template-columns: 230px minmax(0, 1fr);
          }
        }

        @media (max-width: 900px) {
          html body .pf-page .pf-layout {
            grid-template-areas:
              "sidebar"
              "content";
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          html body .pf-page .pf-profile-heading {
            margin: 4px 4px 15px;
          }

          html body .pf-page .pf-mfa-value {
            align-items: stretch;
            flex-direction: column;
          }

          html body .pf-page .pf-mfa-options > button {
            grid-template-columns: 43px minmax(0, 1fr);
          }

          html body .pf-page .pf-mfa-options > button > svg:last-child {
            display: none;
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
            var(--pf-auth-page);
          color: var(--pf-auth-text);
        }

        html body .pf-page .pf-sidebar,
        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section),
        html body .pf-page .pf-insight-card,
        html body .pf-page .pf-save-bar {
          background:
            radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--pf-auth-orange) 5%, transparent), transparent 38%),
            linear-gradient(155deg, var(--pf-auth-surface), var(--pf-auth-surface-deep));
          border-color: var(--pf-auth-line);
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section)::before {
          background: linear-gradient(90deg, var(--pf-auth-orange), var(--pf-auth-orange-light), transparent 82%);
        }

        html body .pf-page :is(.pf-section, .pf-info-card, .pf-public-profile-section, .pf-company-sellers-section):hover {
          border-color: color-mix(in srgb, var(--pf-auth-orange) 42%, transparent);
          box-shadow:
            0 27px 74px rgba(0, 0, 0, 0.36),
            0 0 0 1px color-mix(in srgb, var(--pf-auth-orange) 5%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        html body .pf-page .pf-user-card {
          background:
            radial-gradient(220px 140px at 8% 0%, color-mix(in srgb, var(--pf-auth-orange) 12%, transparent), transparent 72%),
            linear-gradient(155deg, var(--pf-auth-surface), var(--pf-auth-surface-deep));
          border-bottom-color: var(--pf-auth-line-soft);
        }

        html body .pf-page .pf-user-card::after {
          border-color: color-mix(in srgb, var(--pf-auth-orange) 18%, transparent);
        }

        html body .pf-page .pf-avatar,
        html body .pf-page .pf-avatar-upload,
        html body .pf-page .profile-avatar-initial {
          background:
            radial-gradient(circle at 42% 24%, color-mix(in srgb, var(--pf-auth-orange) 18%, transparent), transparent 58%),
            var(--pf-auth-input);
          border-color: var(--pf-auth-orange);
        }

        html body .pf-page .pf-user-name,
        html body .pf-page :is(.pf-info-card-head h2, .pf-section-head h2),
        html body .pf-page .pf-insight-heading h2 {
          color: var(--pf-auth-text);
        }

        html body .pf-page .pf-company-badge,
        html body .pf-page :is(.pf-info-card-head p, .pf-section-head p),
        html body .pf-page :is(.pf-info-label, .pf-field label),
        html body .pf-page .pf-insight-heading p,
        html body .pf-page .pf-completion-overview > div:last-child span,
        html body .pf-page .pf-last-updated {
          color: var(--pf-auth-muted);
        }

        html body .pf-page .pf-nav-item {
          border-bottom-color: var(--pf-auth-line-soft);
          color: var(--pf-auth-muted);
        }

        html body .pf-page .pf-nav-item > svg:first-child {
          color: var(--pf-auth-icon);
        }

        html body .pf-page .pf-nav-item:hover,
        html body .pf-page .pf-nav-active {
          background: linear-gradient(90deg, color-mix(in srgb, var(--pf-auth-orange) 18%, transparent), transparent 86%);
          border-left-color: var(--pf-auth-orange);
          color: var(--pf-auth-text);
        }

        html body .pf-page .pf-nav-active::after {
          background: var(--pf-auth-orange);
          box-shadow: 0 0 14px color-mix(in srgb, var(--pf-auth-orange) 52%, transparent);
        }

        html body .pf-page :is(.pf-info-card-head, .pf-section-head) {
          background: linear-gradient(90deg, color-mix(in srgb, var(--pf-auth-orange) 6%, transparent), transparent 48%);
        }

        html body .pf-page :is(.pf-info-title-icon, .pf-section-head > svg),
        html body .pf-page #julkinen-profiili .pf-section-head > svg,
        html body .pf-page .pf-insight-icon {
          background: color-mix(in srgb, var(--pf-auth-orange) 9%, transparent);
          border-color: color-mix(in srgb, var(--pf-auth-orange) 48%, transparent);
          color: var(--pf-auth-orange-light);
        }

        html body .pf-page :is(.pf-info-rows, #julkinen-profiili .pf-public-fields, #osoite .pf-address-rows) {
          background: transparent;
          border-color: var(--pf-auth-line-soft);
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field, #julkinen-profiili .pf-field.pf-field-wide) {
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.018), transparent);
          border-color: var(--pf-auth-line-soft);
          border-bottom-color: var(--pf-auth-line-soft);
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover {
          background: linear-gradient(90deg, color-mix(in srgb, var(--pf-auth-orange) 6%, transparent), transparent);
          border-color: color-mix(in srgb, var(--pf-auth-orange) 22%, transparent);
        }

        html body .pf-page :is(.pf-info-row-icon, .pf-field-icon) {
          background: var(--pf-auth-input);
          border-color: var(--pf-auth-line);
          color: var(--pf-auth-icon);
        }

        html body .pf-page :is(.pf-info-row, #julkinen-profiili .pf-field):hover :is(.pf-info-row-icon, .pf-field-icon) {
          background: color-mix(in srgb, var(--pf-auth-orange) 10%, var(--pf-auth-input));
          border-color: color-mix(in srgb, var(--pf-auth-orange) 36%, transparent);
          color: var(--pf-auth-orange-light);
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
          color: var(--pf-auth-text);
          -webkit-text-fill-color: var(--pf-auth-text);
        }

        html body .pf-page :is(
          .pf-info-value input:not(:disabled):focus,
          #julkinen-profiili input:focus,
          #julkinen-profiili textarea:focus,
          #osoite input:focus
        ) {
          background: var(--pf-auth-input);
          border-color: var(--pf-auth-orange);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-auth-orange) 14%, transparent);
        }

        html body .pf-page :is(.pf-avatar-action, .pf-inline-btn, .company-seller-small-btn, .pf-logout-button) {
          background: var(--pf-auth-input);
          border-color: var(--pf-auth-line);
          color: #eff5fa;
        }

        html body .pf-page :is(.pf-inline-btn.verify, .company-seller-add-btn, .pf-save-btn) {
          background: linear-gradient(100deg, var(--pf-auth-orange-light), var(--pf-auth-orange));
          border-color: color-mix(in srgb, var(--pf-auth-orange-light) 62%, transparent);
          box-shadow: 0 12px 26px color-mix(in srgb, var(--pf-auth-orange) 20%, transparent);
          color: #ffffff;
        }

        html body .pf-page :is(.company-seller-card, .company-seller-add, .company-seller-empty),
        html body .pf-page :is(.pf-phone-modal, .pf-avatar-crop-modal) {
          background: var(--pf-auth-input);
          border-color: var(--pf-auth-line);
        }

        html body .pf-page .pf-modal-backdrop {
          background: rgba(2, 8, 14, 0.78);
        }

        html body .pf-page .pf-password-field > span,
        html body .pf-page .pf-mfa-code-field span {
          color: #e4edf5;
        }

        html body .pf-page :is(.pf-password-field input, .pf-mfa-code-field input) {
          background: var(--pf-auth-input);
          border-color: var(--pf-auth-line);
          color: var(--pf-auth-text);
        }

        html body .pf-page :is(.pf-password-field input, .pf-mfa-code-field input):focus {
          border-color: var(--pf-auth-orange);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-auth-orange) 14%, transparent);
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page #tiedot {
          --pf-user-card: #111c26;
          --pf-user-control: #182630;
          --pf-user-text: #f4f8fb;
          --pf-user-muted: #9babb7;
          --pf-user-line: #526573;
          --pf-user-accent: #ff7a1a;
        }

        html[data-theme="light"] body .pf-page #tiedot {
          --pf-user-card: var(--theme-surface);
          --pf-user-control: var(--theme-surface-soft);
          --pf-user-text: var(--theme-text);
          --pf-user-muted: var(--theme-muted);
          --pf-user-line: var(--theme-line-strong);
          --pf-user-accent: var(--theme-accent);
        }

        html body .pf-page .pf-form > #tiedot.pf-info-card {
          background: var(--pf-user-card) !important;
          background-color: var(--pf-user-card) !important;
          background-image: none !important;
          border: 1px solid var(--pf-user-line) !important;
          border-radius: 18px !important;
          box-shadow: none !important;
          color: var(--pf-user-text) !important;
          overflow: visible !important;
        }

        html body .pf-page .pf-form > #tiedot > .pf-info-card-head {
          min-height: auto !important;
          padding: 22px 28px 6px !important;
          background: transparent !important;
          background-image: none !important;
          border: 0 !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-info-title {
          justify-content: center !important;
          width: 100% !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-info-title-icon,
        html body .pf-page .pf-form > #tiedot .pf-info-title p {
          display: none !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-info-title h2 {
          color: var(--pf-user-text) !important;
          font-size: 19px !important;
          text-align: center !important;
          -webkit-text-fill-color: var(--pf-user-text) !important;
        }

        html body .pf-page .pf-form > #tiedot > .pf-info-rows {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 22px !important;
          margin: 0 !important;
          padding: 28px 28px 32px !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-user-detail-row {
          position: relative !important;
          display: block !important;
          min-width: 0 !important;
          min-height: 62px !important;
          margin: 0 !important;
          padding: 8px 12px 6px !important;
          background: transparent !important;
          background-image: none !important;
          border: 1.5px solid var(--pf-user-line) !important;
          border-radius: 14px !important;
          box-shadow: none !important;
        }

        html body .pf-page .pf-form > #tiedot :is(.pf-name-info-row, .pf-address-info-row) {
          grid-column: 1 / -1 !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-info-row-icon {
          display: none !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-info-label {
          position: absolute !important;
          z-index: 2 !important;
          top: -10px !important;
          left: 12px !important;
          display: inline-flex !important;
          width: auto !important;
          padding: 0 5px !important;
          background: var(--pf-user-card) !important;
          color: var(--pf-user-muted) !important;
          font-size: 13px !important;
          line-height: 19px !important;
          -webkit-text-fill-color: var(--pf-user-muted) !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-info-value {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 46px !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-info-value > input,
        html body .pf-page .pf-form > #tiedot .pf-phone-card {
          width: 100% !important;
          min-height: 46px !important;
          padding: 0 4px !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: var(--pf-user-text) !important;
          font-size: 15px !important;
          font-weight: 800 !important;
          -webkit-text-fill-color: var(--pf-user-text) !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-phone-row {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          min-height: 46px !important;
          gap: 0 !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-phone-card {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-phone-actions {
          display: flex !important;
          align-items: stretch !important;
        }

        html body .pf-page .pf-form > #tiedot .pf-phone-change-btn {
          min-height: 46px !important;
          min-width: 86px !important;
          padding: 0 8px 0 14px !important;
          background: transparent !important;
          border: 0 !important;
          border-left: 1px solid var(--pf-user-line) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: var(--pf-user-accent) !important;
          font-weight: 900 !important;
          -webkit-text-fill-color: var(--pf-user-accent) !important;
        }

        html body .pf-page .pf-form > #tiedot :is(.pf-phone-number, .pf-email-address) {
          display: block !important;
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          text-align: left !important;
          white-space: nowrap !important;
        }

        html body .pf-email-change-modal form {
          display: grid;
          gap: 16px;
        }

        html body .pf-email-change-modal form > p {
          margin: 0;
        }

        html body .pf-email-change-field {
          display: grid;
          gap: 7px;
          text-align: left;
        }

        html body .pf-email-change-field > span {
          color: #dce7ef;
          font-size: 12px;
          font-weight: 900;
        }

        html body .pf-email-change-field input {
          width: 100%;
          min-height: 48px;
          padding: 0 13px;
          border: 1px solid rgba(126, 158, 190, 0.44);
          border-radius: 11px;
          background: rgba(7, 23, 39, 0.92);
          color: #f4f8fb;
          font: inherit;
          font-weight: 800;
          outline: 0;
        }

        html body .pf-email-change-field input:focus {
          border-color: #ff7a1a;
          box-shadow: 0 0 0 3px rgba(255, 122, 26, 0.13);
        }

        html body .pf-email-change-resend {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        html body .pf-email-change-resend button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #ff9b4a;
          font: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        html[data-theme="light"] body .pf-email-change-field > span {
          color: var(--theme-text);
        }

        html[data-theme="light"] body .pf-email-change-field input {
          background: var(--theme-surface);
          border-color: var(--theme-line-strong);
          color: var(--theme-text);
          -webkit-text-fill-color: var(--theme-text);
        }

        @media (max-width: 760px) {
          html body .pf-page .pf-form > #tiedot.pf-info-card {
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
          }

          html body .pf-page .pf-form > #tiedot > .pf-info-card-head {
            padding: 14px 14px 20px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-title h2 {
            font-size: clamp(26px, 8vw, 34px) !important;
          }

          html body .pf-page .pf-form > #tiedot > .pf-info-rows {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 18px !important;
            padding: 0 14px 28px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-user-detail-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            min-height: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-name-info-row { order: 1; }
          html body .pf-page .pf-form > #tiedot .pf-address-info-row { order: 2; }
          html body .pf-page .pf-form > #tiedot .pf-postal-info-row { order: 3; }
          html body .pf-page .pf-form > #tiedot .pf-city-info-row { order: 4; }
          html body .pf-page .pf-form > #tiedot .pf-country-info-row { order: 5; }
          html body .pf-page .pf-form > #tiedot .pf-email-info-row { order: 6; margin-top: 16px !important; }
          html body .pf-page .pf-form > #tiedot .pf-phone-info-row { order: 7; }

          html body .pf-page .pf-form > #tiedot .pf-info-label {
            position: static !important;
            display: block !important;
            padding: 0 0 8px 4px !important;
            background: transparent !important;
            color: var(--pf-user-muted) !important;
            font-size: 15px !important;
            font-weight: 850 !important;
            line-height: 1.2 !important;
            -webkit-text-fill-color: var(--pf-user-muted) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-value {
            min-height: 58px !important;
            padding: 0 14px 0 48px !important;
            background: var(--pf-user-control) !important;
            border: 1px solid var(--pf-user-line) !important;
            border-radius: 18px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-row-icon {
            position: absolute !important;
            z-index: 2 !important;
            left: 15px !important;
            bottom: 17px !important;
            display: grid !important;
            width: 24px !important;
            height: 24px !important;
            place-items: center !important;
            background: transparent !important;
            border: 0 !important;
            color: var(--pf-user-muted) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-row-icon svg {
            width: 20px !important;
            height: 20px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-value > input,
          html body .pf-page .pf-form > #tiedot .pf-phone-card {
            min-height: 56px !important;
            font-size: 17px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-row {
            min-height: 58px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-change-btn {
            min-height: 56px !important;
            min-width: 76px !important;
            padding-inline: 10px !important;
            font-size: 11px !important;
          }

          html body .pf-page .pf-form > #tiedot :is(.pf-phone-number, .pf-email-address) {
            font-size: 14px !important;
          }

          /* Mobile account view: full-width Maskines panels and one datum per row. */
          html body .pf-page {
            --pf-mobile-panel: #0b151f;
            --pf-mobile-row: #13283a;
            --pf-mobile-line: #31536b;
            --pf-mobile-text: #f5f8fa;
            --pf-mobile-muted: #9eafbd;
            --pf-mobile-accent: #ff7a1a;
            padding-right: 0 !important;
            padding-left: 0 !important;
            padding-bottom: 96px !important;
            background: #071421 !important;
            color: var(--pf-mobile-text) !important;
          }

          html[data-theme="light"] body .pf-page {
            --pf-mobile-panel: var(--theme-surface);
            --pf-mobile-row: var(--theme-surface-soft);
            --pf-mobile-line: var(--theme-line-strong);
            --pf-mobile-text: var(--theme-text);
            --pf-mobile-muted: var(--theme-muted);
            --pf-mobile-accent: var(--theme-accent);
            background: var(--theme-bg) !important;
          }

          html body .pf-page :is(.pf-layout, .pf-content, .pf-form) {
            width: 100% !important;
            max-width: none !important;
            margin-right: 0 !important;
            margin-left: 0 !important;
          }

          html body .pf-page .pf-content {
            padding-right: 0 !important;
            padding-left: 0 !important;
          }

          html body .pf-page .pf-profile-heading {
            width: 100% !important;
            margin: 0 !important;
            padding: 24px 14px 18px !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            text-align: center !important;
          }

          html body .pf-page .pf-profile-heading h1 {
            margin: 0 !important;
            color: var(--pf-mobile-text) !important;
            font-size: clamp(30px, 9vw, 40px) !important;
            line-height: 1.02 !important;
            text-align: center !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form {
            display: grid !important;
            gap: 16px !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #julkinen-profiili, #tilin-turvallisuus) {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 12px 18px !important;
            background: var(--pf-mobile-panel) !important;
            background-color: var(--pf-mobile-panel) !important;
            background-image: none !important;
            border-top: 1px solid var(--pf-mobile-line) !important;
            border-right: 0 !important;
            border-bottom: 1px solid var(--pf-mobile-line) !important;
            border-left: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
            overflow: visible !important;
          }

          html body .pf-page .pf-form > #tiedot.pf-info-card {
            background: var(--pf-mobile-panel) !important;
            border-top: 1px solid var(--pf-mobile-line) !important;
            border-bottom: 1px solid var(--pf-mobile-line) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #julkinen-profiili, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
            display: flex !important;
            align-items: center !important;
            min-height: 62px !important;
            margin: 0 !important;
            padding: 12px 4px !important;
            background: transparent !important;
            border: 0 !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-title {
            justify-content: flex-start !important;
            gap: 10px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-title-icon,
          html body .pf-page .pf-form > :is(#julkinen-profiili, #tilin-turvallisuus) > .pf-section-head > svg {
            display: grid !important;
            flex: 0 0 30px !important;
            width: 30px !important;
            height: 30px !important;
            place-items: center !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            color: var(--pf-mobile-accent) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #julkinen-profiili, #tilin-turvallisuus) :is(.pf-info-title h2, .pf-section-head h2) {
            margin: 0 !important;
            color: var(--pf-mobile-text) !important;
            font-size: 21px !important;
            line-height: 1.15 !important;
            text-align: left !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #julkinen-profiili, #tilin-turvallisuus) :is(.pf-info-title p, .pf-section-head p),
          html body .pf-page #julkinen-profiili .pf-public-note {
            display: none !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #tilin-turvallisuus) > .pf-info-rows,
          html body .pf-page .pf-form > #julkinen-profiili > .pf-public-fields {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 9px !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-user-detail-row,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field.pf-field-wide {
            position: relative !important;
            display: grid !important;
            grid-template-columns: 34px minmax(108px, 0.82fr) minmax(0, 1.18fr) auto !important;
            align-items: center !important;
            gap: 8px !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 66px !important;
            margin: 0 !important;
            padding: 9px 12px !important;
            background: var(--pf-mobile-row) !important;
            background-color: var(--pf-mobile-row) !important;
            background-image: none !important;
            border: 1px solid var(--pf-mobile-line) !important;
            border-radius: 15px !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-row-icon,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field-icon {
            position: static !important;
            display: grid !important;
            grid-column: 1 !important;
            width: 28px !important;
            height: 28px !important;
            place-items: center !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            color: var(--pf-mobile-muted) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-row-icon svg,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-row-icon svg,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field-icon svg {
            width: 21px !important;
            height: 21px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-label,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field > label {
            position: static !important;
            grid-column: 2 !important;
            width: auto !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            color: var(--pf-mobile-muted) !important;
            font-size: 14px !important;
            font-weight: 750 !important;
            line-height: 1.2 !important;
            -webkit-text-fill-color: var(--pf-mobile-muted) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-value,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field > :is(.pf-locked, .pf-readonly-value, input, textarea) {
            position: static !important;
            grid-column: 3 / -1 !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-value > input,
          html body .pf-page .pf-form > #julkinen-profiili :is(.pf-locked input, .pf-locked input:disabled, input, textarea) {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 42px !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
            font-size: 15px !important;
            font-weight: 850 !important;
            line-height: 1.25 !important;
            text-align: left !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: center !important;
            width: 100% !important;
            min-height: 44px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-card {
            min-width: 0 !important;
            min-height: 44px !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-change-btn,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-inline-btn {
            min-width: 0 !important;
            min-height: 38px !important;
            margin: 0 !important;
            padding: 0 8px !important;
            background: transparent !important;
            border: 0 !important;
            border-left: 1px solid var(--pf-mobile-line) !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: var(--pf-mobile-accent) !important;
            font-size: 12px !important;
            font-weight: 900 !important;
            white-space: nowrap !important;
            -webkit-text-fill-color: var(--pf-mobile-accent) !important;
          }

          html body .pf-page .pf-form > #tiedot :is(.pf-phone-number, .pf-email-address) {
            color: var(--pf-mobile-text) !important;
            font-size: 14px !important;
            font-weight: 850 !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field {
            grid-template-rows: auto auto !important;
            min-height: 88px !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > textarea {
            grid-column: 3 / -1 !important;
            min-height: 60px !important;
            resize: none !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > .pf-phone-help,
          html body .pf-page .pf-form > #julkinen-profiili .pf-lock-icon {
            display: none !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-security-action-value,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-mfa-value {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 8px !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus :is(.pf-mfa-state, .pf-security-status, .pf-info-value > span) {
            min-width: 0 !important;
            color: var(--pf-mobile-text) !important;
            font-size: 13px !important;
            font-weight: 750 !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          /* Compact layout for genuinely narrow phones. */
          html body .pf-page :is(.pf-layout, .pf-content, .pf-form) {
            padding-right: 0 !important;
            padding-left: 0 !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-user-detail-row,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field.pf-field-wide {
            grid-template-columns: 32px minmax(0, 1fr) auto !important;
            grid-template-rows: auto auto !important;
            column-gap: 9px !important;
            row-gap: 2px !important;
            min-height: 62px !important;
            padding: 9px 11px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-row-icon,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field-icon {
            grid-column: 1 !important;
            grid-row: 1 / 3 !important;
            align-self: center !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-label,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field > label {
            grid-column: 2 / -1 !important;
            grid-row: 1 !important;
            align-self: end !important;
            overflow: hidden !important;
            font-size: 12px !important;
            line-height: 1.15 !important;
            text-align: left !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-value,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field > :is(.pf-locked, .pf-readonly-value, input, textarea) {
            grid-column: 2 / -1 !important;
            grid-row: 2 !important;
            align-self: start !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-value > input,
          html body .pf-page .pf-form > #julkinen-profiili :is(.pf-locked input, .pf-locked input:disabled, input, textarea) {
            min-height: 25px !important;
            font-size: 14px !important;
            line-height: 25px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-row,
          html body .pf-page .pf-form > #tiedot .pf-phone-card {
            min-height: 27px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-card {
            align-items: flex-start !important;
          }

          html body .pf-page .pf-form > #tiedot :is(.pf-phone-number, .pf-email-address) {
            max-width: none !important;
            font-size: 13px !important;
            line-height: 27px !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-change-btn {
            min-height: 27px !important;
            padding: 0 0 0 8px !important;
            font-size: 11px !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-security-action-value,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-mfa-value {
            justify-content: flex-start !important;
            flex-wrap: wrap !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field {
            grid-template-rows: auto minmax(44px, auto) !important;
          }

          /* Fluid finishing: keeps the same proportions from 280 px to tablet width. */
          html body .pf-page .pf-form {
            gap: clamp(12px, 4vw, 20px) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #julkinen-profiili, #tilin-turvallisuus) {
            padding-right: clamp(8px, 3.5vw, 18px) !important;
            padding-bottom: clamp(14px, 4vw, 22px) !important;
            padding-left: clamp(8px, 3.5vw, 18px) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #julkinen-profiili, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
            min-height: clamp(56px, 17vw, 68px) !important;
            padding-right: clamp(3px, 1.5vw, 8px) !important;
            padding-left: clamp(3px, 1.5vw, 8px) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #julkinen-profiili, #tilin-turvallisuus) :is(.pf-info-title h2, .pf-section-head h2) {
            font-size: clamp(18px, 6vw, 23px) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-user-detail-row,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field.pf-field-wide {
            grid-template-columns: clamp(28px, 9vw, 36px) minmax(0, 1fr) auto !important;
            min-height: clamp(58px, 18vw, 70px) !important;
            padding: clamp(8px, 2.8vw, 12px) clamp(9px, 3vw, 14px) !important;
            border-radius: clamp(12px, 4vw, 17px) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-label,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field > label {
            font-size: clamp(11px, 3.4vw, 13px) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-info-value > input,
          html body .pf-page .pf-form > #julkinen-profiili :is(.pf-locked input, .pf-locked input:disabled, input, textarea),
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-info-value {
            font-size: clamp(13px, 4vw, 15px) !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field,
          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field.pf-field-wide {
            grid-template-rows: auto auto !important;
            height: auto !important;
            min-height: clamp(116px, 37vw, 150px) !important;
            align-items: start !important;
            overflow: visible !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > textarea {
            grid-column: 2 / -1 !important;
            grid-row: 2 !important;
            min-height: clamp(78px, 25vw, 108px) !important;
            height: auto;
            padding: 4px 2px 3px 0 !important;
            overflow: hidden !important;
            font-size: clamp(13px, 4vw, 15px) !important;
            line-height: 1.4 !important;
            resize: none !important;
            scrollbar-width: none !important;
            white-space: pre-wrap !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > textarea::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-security-action-value,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-mfa-value {
            width: 100% !important;
            justify-content: flex-start !important;
            gap: 7px !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-inline-btn {
            min-height: 30px !important;
            padding: 0 clamp(10px, 3.5vw, 16px) !important;
            background: var(--pf-mobile-accent) !important;
            border: 0 !important;
            border-radius: 9px !important;
            color: #ffffff !important;
            font-size: clamp(10px, 3.2vw, 12px) !important;
            line-height: 1 !important;
            -webkit-text-fill-color: #ffffff !important;
            width: auto !important;
            max-width: min(100%, 168px) !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-security-action-row {
            min-height: clamp(72px, 23vw, 88px) !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus :is(.pf-mfa-state, .pf-security-status, .pf-info-value > span) {
            font-size: clamp(11px, 3.5vw, 13px) !important;
            line-height: 1.25 !important;
          }

          html body .pf-page .pf-form > .pf-save-bar {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            justify-items: center !important;
            gap: 9px !important;
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 14px clamp(10px, 4vw, 20px) 18px !important;
            overflow: visible !important;
            background: var(--pf-mobile-panel) !important;
            border-top: 1px solid var(--pf-mobile-line) !important;
            border-right: 0 !important;
            border-bottom: 1px solid var(--pf-mobile-line) !important;
            border-left: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          html body .pf-page .pf-form > .pf-save-bar .pf-save-btn {
            justify-content: center !important;
            width: min(100%, 280px) !important;
            min-width: 0 !important;
            min-height: 44px !important;
            margin: 0 !important;
          }

          html body .pf-page .pf-form > .pf-save-bar :is(.pf-last-updated, .pf-status) {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            color: var(--pf-mobile-muted) !important;
            font-size: clamp(10px, 3.4vw, 12px) !important;
            line-height: 1.35 !important;
            text-align: center !important;
            white-space: normal !important;
            -webkit-text-fill-color: var(--pf-mobile-muted) !important;
          }

          html body .pf-page .pf-sidebar {
            align-self: start !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 6px !important;
          }

          html body .pf-page .pf-nav {
            display: grid !important;
            height: auto !important;
            min-height: 0 !important;
          }

          html body .pf-page .pf-layout {
            align-items: start !important;
            gap: 8px !important;
            grid-auto-rows: max-content !important;
          }

          html body .pf-page .pf-content {
            align-self: start !important;
            min-height: 0 !important;
          }

          html body .pf-page .pf-nav-item {
            min-height: 44px !important;
          }

          html body .pf-page .pf-nav-danger {
            width: calc(100% - 20px) !important;
            min-height: 42px !important;
            margin: 7px 10px 10px !important;
            padding: 0 13px !important;
            background: color-mix(in srgb, #ef4444 8%, transparent) !important;
            border: 1px solid color-mix(in srgb, #ef4444 45%, var(--pf-mobile-line)) !important;
            border-radius: 11px !important;
            color: #d94747 !important;
            -webkit-text-fill-color: #d94747 !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-actions {
            padding-right: clamp(4px, 2.5vw, 10px) !important;
          }

          html body .pf-page .pf-form > #tiedot .pf-phone-change-btn {
            min-width: fit-content !important;
            padding: 0 8px !important;
            background: color-mix(in srgb, var(--pf-mobile-accent) 10%, transparent) !important;
            border: 0 !important;
            border-radius: 8px !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus > .pf-info-rows {
            gap: 7px !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-security-action-row {
            grid-template-columns: clamp(28px, 9vw, 36px) minmax(0, 1fr) !important;
            grid-template-rows: auto auto !important;
            min-height: 78px !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-security-action-row > .pf-info-row-icon {
            grid-column: 1 !important;
            grid-row: 1 / 3 !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-security-action-row > .pf-info-label {
            grid-column: 2 !important;
            grid-row: 1 !important;
            align-self: end !important;
            text-align: left !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-security-action-row > .pf-security-action-value {
            display: flex !important;
            grid-column: 2 !important;
            grid-row: 2 !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-security-action-row .pf-inline-btn {
            width: clamp(126px, 48vw, 158px) !important;
            max-width: 100% !important;
            min-height: 31px !important;
            padding: 0 10px !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-mfa-label {
            overflow: visible !important;
            white-space: normal !important;
          }

          html body .pf-page .pf-form > #tilin-turvallisuus .pf-mfa-label-state {
            display: block !important;
            margin-top: 2px !important;
            color: var(--pf-mobile-text) !important;
            font-size: clamp(10px, 3.2vw, 12px) !important;
            font-style: normal !important;
            font-weight: 800 !important;
            line-height: 1.15 !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          /* Company profile uses the same mobile visual system as a private profile. */
          html body .pf-page .pf-form > :is(#yritys, #myyjat, #osoite) {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 clamp(8px, 3.5vw, 18px) clamp(14px, 4vw, 22px) !important;
            background: var(--pf-mobile-panel) !important;
            background-color: var(--pf-mobile-panel) !important;
            background-image: none !important;
            border-top: 1px solid var(--pf-mobile-line) !important;
            border-right: 0 !important;
            border-bottom: 1px solid var(--pf-mobile-line) !important;
            border-left: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
            overflow: visible !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #myyjat, #osoite) > :is(.pf-info-card-head, .pf-section-head) {
            display: flex !important;
            align-items: center !important;
            min-height: clamp(56px, 17vw, 68px) !important;
            margin: 0 !important;
            padding: 12px clamp(3px, 1.5vw, 8px) !important;
            background: transparent !important;
            border: 0 !important;
          }

          html body .pf-page .pf-form > #yritys .pf-info-title {
            justify-content: flex-start !important;
            gap: 10px !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > #yritys .pf-info-title-icon,
          html body .pf-page .pf-form > :is(#myyjat, #osoite) > .pf-section-head > svg {
            display: grid !important;
            flex: 0 0 30px !important;
            width: 30px !important;
            height: 30px !important;
            place-items: center !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            color: var(--pf-mobile-accent) !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #myyjat, #osoite) :is(.pf-info-title h2, .pf-section-head h2) {
            margin: 0 !important;
            color: var(--pf-mobile-text) !important;
            font-size: clamp(18px, 6vw, 23px) !important;
            line-height: 1.15 !important;
            text-align: left !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #myyjat, #osoite) :is(.pf-info-title p, .pf-section-head p) {
            display: none !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #osoite) > .pf-info-rows {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 7px !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #osoite) > .pf-info-rows > .pf-info-row {
            position: relative !important;
            display: grid !important;
            grid-template-columns: clamp(28px, 9vw, 36px) minmax(0, 1fr) auto !important;
            grid-template-rows: auto auto !important;
            align-items: center !important;
            column-gap: 9px !important;
            row-gap: 2px !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: clamp(58px, 18vw, 70px) !important;
            margin: 0 !important;
            padding: clamp(8px, 2.8vw, 12px) clamp(9px, 3vw, 14px) !important;
            background: var(--pf-mobile-row) !important;
            background-color: var(--pf-mobile-row) !important;
            background-image: none !important;
            border: 1px solid var(--pf-mobile-line) !important;
            border-radius: clamp(12px, 4vw, 17px) !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #osoite) .pf-info-row-icon {
            position: static !important;
            display: grid !important;
            grid-column: 1 !important;
            grid-row: 1 / 3 !important;
            align-self: center !important;
            width: 28px !important;
            height: 28px !important;
            place-items: center !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            color: var(--pf-mobile-muted) !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #osoite) .pf-info-label {
            position: static !important;
            display: block !important;
            grid-column: 2 / -1 !important;
            grid-row: 1 !important;
            align-self: end !important;
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: transparent !important;
            color: var(--pf-mobile-muted) !important;
            font-size: clamp(11px, 3.4vw, 13px) !important;
            font-weight: 750 !important;
            line-height: 1.15 !important;
            text-align: left !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            -webkit-text-fill-color: var(--pf-mobile-muted) !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #osoite) .pf-info-value {
            position: static !important;
            display: block !important;
            grid-column: 2 / -1 !important;
            grid-row: 2 !important;
            align-self: start !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 25px !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          html body .pf-page .pf-form > :is(#yritys, #osoite) .pf-info-value > input {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 25px !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
            font-size: clamp(13px, 4vw, 15px) !important;
            font-weight: 850 !important;
            line-height: 25px !important;
            text-align: left !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #yritys .pf-phone-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 6px !important;
            width: 100% !important;
            min-height: 27px !important;
          }

          html body .pf-page .pf-form > #yritys .pf-phone-card {
            display: flex !important;
            align-items: flex-start !important;
            min-width: 0 !important;
            min-height: 27px !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          html body .pf-page .pf-form > #yritys .pf-phone-number {
            overflow: hidden !important;
            color: var(--pf-mobile-text) !important;
            font-size: clamp(12px, 4vw, 14px) !important;
            font-weight: 850 !important;
            line-height: 27px !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #yritys .pf-phone-actions {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            margin: 0 !important;
            padding-right: clamp(4px, 2.5vw, 10px) !important;
            transform: none !important;
          }

          html body .pf-page .pf-form > #yritys .pf-phone-change-btn {
            width: auto !important;
            min-width: fit-content !important;
            min-height: 27px !important;
            margin: 0 !important;
            padding: 0 8px !important;
            background: color-mix(in srgb, var(--pf-mobile-accent) 10%, transparent) !important;
            border: 0 !important;
            border-radius: 8px !important;
            color: var(--pf-mobile-accent) !important;
            font-size: 11px !important;
            -webkit-text-fill-color: var(--pf-mobile-accent) !important;
          }

          html body .pf-page .pf-form > #yritys .pf-info-website-value {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 7px !important;
          }

          html body .pf-page .pf-form > #yritys .pf-website-link {
            position: static !important;
            display: grid !important;
            width: 28px !important;
            height: 28px !important;
            place-items: center !important;
            color: var(--pf-mobile-accent) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-limit {
            margin-left: auto !important;
            color: var(--pf-mobile-muted) !important;
          }

          html body .pf-page .pf-form > #myyjat > :is(.company-seller-list, .company-seller-add) {
            width: 100% !important;
            margin: 0 0 7px !important;
            padding: 0 !important;
          }

          html body .pf-page .pf-form > #myyjat :is(.company-seller-card, .company-seller-empty, .company-seller-add) {
            background: var(--pf-mobile-row) !important;
            border: 1px solid var(--pf-mobile-line) !important;
            border-radius: clamp(12px, 4vw, 17px) !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-footer {
            margin: 8px 0 0 !important;
            padding: 0 3px !important;
            background: transparent !important;
            border: 0 !important;
            color: var(--pf-mobile-muted) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add {
            display: grid !important;
            gap: 12px !important;
            padding: 13px !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-head {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-head :is(strong, span) {
            color: inherit !important;
            -webkit-text-fill-color: currentColor !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-fields {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 10px !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-fields > label {
            display: grid !important;
            gap: 6px !important;
            min-width: 0 !important;
            color: var(--pf-mobile-muted) !important;
            font-size: 12px !important;
            font-weight: 800 !important;
            -webkit-text-fill-color: var(--pf-mobile-muted) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-fields input,
          html body .pf-page .pf-form > #myyjat .company-seller-edit input {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 43px !important;
            padding: 0 12px !important;
            background: var(--pf-mobile-panel) !important;
            border: 1px solid var(--pf-mobile-line) !important;
            border-radius: 10px !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
            font-size: 14px !important;
            font-weight: 750 !important;
            outline: 0 !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-fields input:focus,
          html body .pf-page .pf-form > #myyjat .company-seller-edit input:focus {
            border-color: var(--pf-mobile-accent) !important;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-mobile-accent) 13%, transparent) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-btn {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            width: 100% !important;
            min-height: 44px !important;
            margin: 0 !important;
            padding: 0 14px !important;
            background: var(--pf-mobile-accent) !important;
            border: 0 !important;
            border-radius: 10px !important;
            box-shadow: none !important;
            color: #ffffff !important;
            font-size: 13px !important;
            font-weight: 900 !important;
            -webkit-text-fill-color: #ffffff !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-card {
            display: grid !important;
            grid-template-columns: 40px minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 10px !important;
            min-height: 68px !important;
            padding: 10px 12px !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-card :is(strong, span) {
            color: var(--pf-mobile-text) !important;
            -webkit-text-fill-color: var(--pf-mobile-text) !important;
          }

          html body .pf-page .pf-form > #yritys .pf-company-email-info-row .pf-email-address {
            display: block !important;
            min-width: 0 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          html[data-theme="light"] body .pf-page .pf-form > :is(#yritys, #myyjat, #osoite) {
            background: var(--theme-surface) !important;
            border-color: var(--theme-line-strong) !important;
          }

          html[data-theme="light"] body .pf-page .pf-form > :is(#yritys, #osoite) > .pf-info-rows > .pf-info-row,
          html[data-theme="light"] body .pf-page .pf-form > #myyjat :is(.company-seller-card, .company-seller-empty, .company-seller-add) {
            background: var(--theme-surface-soft) !important;
            border-color: var(--theme-line-strong) !important;
          }

          html[data-theme="light"] body .pf-page .pf-form > #myyjat :is(.company-seller-add-fields input, .company-seller-edit input) {
            background: var(--theme-surface) !important;
            border-color: var(--theme-line-strong) !important;
            color: var(--theme-text) !important;
            -webkit-text-fill-color: var(--theme-text) !important;
          }
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page .pf-private-address-value {
          position: relative !important;
          z-index: 5 !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 8px !important;
          pointer-events: auto !important;
        }

        html body .pf-page .pf-private-address-input {
          position: relative !important;
          z-index: 6 !important;
          pointer-events: auto !important;
          user-select: text !important;
          cursor: text !important;
        }

        @media (max-width: 760px) {
          html body .pf-page .pf-private-address-value {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }

        html body .pf-page .pf-mfa-label-state {
          display: block;
          margin-top: 3px;
          color: var(--theme-muted, #93a5b8);
          font-size: 11px;
          font-style: normal;
          font-weight: 800;
          line-height: 1.2;
        }

        html body .pf-modal-backdrop:has(.pf-delete-modal) {
          --pf-delete-surface: #0b1c24;
          --pf-delete-soft: #142831;
          --pf-delete-line: #39505a;
          --pf-delete-text: #f5f8fa;
          --pf-delete-muted: #acbac1;
          align-items: flex-start !important;
          padding: calc(var(--topbar-h, 58px) + env(safe-area-inset-top, 0px) + 92px) 14px 32px !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }

        html[data-theme="light"] body .pf-modal-backdrop:has(.pf-delete-modal) {
          --pf-delete-surface: var(--theme-surface);
          --pf-delete-soft: var(--theme-surface-soft);
          --pf-delete-line: var(--theme-line-strong);
          --pf-delete-text: var(--theme-text);
          --pf-delete-muted: var(--theme-muted);
        }

        html body .pf-phone-modal.pf-delete-modal {
          width: min(100%, 420px) !important;
          max-width: 420px !important;
          max-height: none !important;
          margin: 0 auto 28px !important;
          padding: 26px 20px 22px !important;
          background: var(--pf-delete-surface) !important;
          border: 1px solid var(--pf-delete-line) !important;
          border-radius: 20px !important;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.32) !important;
          color: var(--pf-delete-text) !important;
        }

        html body .pf-phone-modal.pf-delete-modal .pf-modal-close {
          top: 14px !important;
          right: 14px !important;
        }

        html body .pf-phone-modal.pf-delete-modal .pf-delete-modal-icon {
          width: 48px !important;
          height: 48px !important;
          margin: 0 0 18px !important;
          background: color-mix(in srgb, #ef4444 10%, var(--pf-delete-surface)) !important;
          border: 1px solid color-mix(in srgb, #ef4444 45%, var(--pf-delete-line)) !important;
          border-radius: 14px !important;
          color: #ef4444 !important;
        }

        html body .pf-phone-modal.pf-delete-modal h2 {
          margin: 0 38px 14px 0 !important;
          color: var(--pf-delete-text) !important;
          font-size: clamp(21px, 6vw, 26px) !important;
          line-height: 1.12 !important;
          -webkit-text-fill-color: var(--pf-delete-text) !important;
        }

        html body .pf-phone-modal.pf-delete-modal > p {
          margin: 0 0 14px !important;
          color: var(--pf-delete-muted) !important;
          font-size: 13px !important;
          line-height: 1.48 !important;
          -webkit-text-fill-color: var(--pf-delete-muted) !important;
        }

        html body .pf-phone-modal.pf-delete-modal .pf-delete-email {
          width: 100% !important;
          margin: 4px 0 16px !important;
          padding: 12px 13px !important;
          overflow: hidden !important;
          background: var(--pf-delete-soft) !important;
          border: 1px solid var(--pf-delete-line) !important;
          border-radius: 10px !important;
          color: var(--pf-delete-text) !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          -webkit-text-fill-color: var(--pf-delete-text) !important;
        }

        html body .pf-phone-modal.pf-delete-modal .pf-delete-warning-list {
          display: grid !important;
          gap: 8px !important;
          margin: 0 0 16px !important;
        }

        html body .pf-phone-modal.pf-delete-modal .pf-delete-warning-list > span {
          padding: 9px 11px !important;
          background: color-mix(in srgb, #ef4444 8%, var(--pf-delete-surface)) !important;
          border: 1px solid color-mix(in srgb, #ef4444 50%, var(--pf-delete-line)) !important;
          border-radius: 10px !important;
          color: var(--pf-delete-text) !important;
          font-size: 12px !important;
          line-height: 1.25 !important;
          -webkit-text-fill-color: var(--pf-delete-text) !important;
        }

        html body .pf-phone-modal.pf-delete-modal .pf-delete-modal-actions {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 10px !important;
          width: 100% !important;
          margin: 18px 0 0 !important;
        }

        html body .pf-phone-modal.pf-delete-modal .pf-delete-modal-actions > button {
          width: 100% !important;
          min-height: 46px !important;
          margin: 0 !important;
          border-radius: 10px !important;
        }

        html body .pf-phone-modal.pf-delete-modal .pf-delete-btn {
          background: linear-gradient(135deg, #ff5a6d, #e51f43) !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        html body .pf-phone-modal.pf-delete-modal .pf-delete-note {
          display: block !important;
          width: 100% !important;
          margin: 18px 0 0 !important;
          padding: 12px !important;
          background: color-mix(in srgb, #38a9ff 10%, var(--pf-delete-soft)) !important;
          border: 1px solid color-mix(in srgb, #38a9ff 50%, var(--pf-delete-line)) !important;
          border-radius: 11px !important;
          color: var(--pf-delete-text) !important;
          font-size: 12px !important;
          line-height: 1.35 !important;
          text-align: left !important;
          -webkit-text-fill-color: var(--pf-delete-text) !important;
        }

        @media (max-width: 520px) {
          html body .pf-modal-backdrop:has(.pf-delete-modal) {
            padding-top: calc(var(--topbar-h, 58px) + env(safe-area-inset-top, 0px) + 106px) !important;
            padding-right: 14px !important;
            padding-left: 14px !important;
          }

          html body .pf-phone-modal.pf-delete-modal {
            padding: 24px 17px 20px !important;
            border-radius: 17px !important;
          }
        }
      `}</style>

      <style jsx global>{`
        @media (min-width: 761px) {
          html body .pf-page {
            --pf-desktop-panel: #071b2d;
            --pf-desktop-row: #13283a;
            --pf-desktop-line: #31536b;
            --pf-desktop-text: #f5f8fa;
            --pf-desktop-muted: #9eafbd;
            --pf-desktop-accent: #ff7a1a;
            padding: 24px 24px 40px !important;
          }

          html[data-theme="light"] body .pf-page {
            --pf-desktop-panel: var(--theme-surface);
            --pf-desktop-row: var(--theme-surface-soft);
            --pf-desktop-line: var(--theme-line-strong);
            --pf-desktop-text: var(--theme-text);
            --pf-desktop-muted: var(--theme-muted);
            --pf-desktop-accent: var(--theme-accent);
          }

          html body .pf-page .pf-layout {
            grid-template-columns: 236px minmax(0, 860px) !important;
            justify-content: center !important;
            gap: 24px !important;
            width: min(100%, 1120px) !important;
            max-width: 1120px !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }

          html body .pf-page .pf-content,
          html body .pf-page .pf-form {
            width: 100% !important;
            max-width: 860px !important;
            min-width: 0 !important;
          }

          html body .pf-page .pf-form {
            display: grid !important;
            gap: 16px !important;
          }

          html body .pf-page .pf-sidebar {
            align-self: start !important;
            height: auto !important;
            min-height: 0 !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #myyjat, #julkinen-profiili, #osoite, #tilin-turvallisuus) {
            width: 100% !important;
            max-width: 860px !important;
            margin: 0 !important;
            padding: 0 18px 20px !important;
            background: var(--pf-desktop-panel) !important;
            background-color: var(--pf-desktop-panel) !important;
            background-image: none !important;
            border: 1px solid var(--pf-desktop-line) !important;
            border-radius: 16px !important;
            box-shadow: none !important;
            color: var(--pf-desktop-text) !important;
            overflow: visible !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #myyjat, #julkinen-profiili, #osoite, #tilin-turvallisuus) > :is(.pf-info-card-head, .pf-section-head) {
            display: flex !important;
            align-items: center !important;
            min-height: 68px !important;
            margin: 0 !important;
            padding: 14px 4px 12px !important;
            background: transparent !important;
            border: 0 !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys) .pf-info-title {
            justify-content: flex-start !important;
            gap: 11px !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys) .pf-info-title-icon,
          html body .pf-page .pf-form > :is(#myyjat, #julkinen-profiili, #osoite, #tilin-turvallisuus) > .pf-section-head > svg {
            display: grid !important;
            flex: 0 0 34px !important;
            width: 34px !important;
            height: 34px !important;
            place-items: center !important;
            margin: 0 !important;
            padding: 0 !important;
            background: color-mix(in srgb, var(--pf-desktop-accent) 8%, transparent) !important;
            border: 1px solid color-mix(in srgb, var(--pf-desktop-accent) 55%, var(--pf-desktop-line)) !important;
            border-radius: 10px !important;
            color: var(--pf-desktop-accent) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #myyjat, #julkinen-profiili, #osoite, #tilin-turvallisuus) :is(.pf-info-title h2, .pf-section-head h2) {
            margin: 0 !important;
            color: var(--pf-desktop-text) !important;
            font-size: 19px !important;
            line-height: 1.2 !important;
            text-align: left !important;
            -webkit-text-fill-color: var(--pf-desktop-text) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #myyjat, #julkinen-profiili, #osoite, #tilin-turvallisuus) :is(.pf-info-title p, .pf-section-head p) {
            margin: 3px 0 0 !important;
            color: var(--pf-desktop-muted) !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
            -webkit-text-fill-color: var(--pf-desktop-muted) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #osoite, #tilin-turvallisuus) > .pf-info-rows,
          html body .pf-page .pf-form > #julkinen-profiili > .pf-public-fields {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 8px !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #osoite, #tilin-turvallisuus) .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field.pf-field-wide {
            position: relative !important;
            display: grid !important;
            grid-template-columns: 38px minmax(150px, 0.72fr) minmax(0, 1.28fr) auto !important;
            align-items: center !important;
            gap: 10px !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 62px !important;
            margin: 0 !important;
            padding: 9px 14px !important;
            background: var(--pf-desktop-row) !important;
            background-color: var(--pf-desktop-row) !important;
            background-image: none !important;
            border: 1px solid var(--pf-desktop-line) !important;
            border-radius: 13px !important;
            box-shadow: none !important;
            color: var(--pf-desktop-text) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #osoite, #tilin-turvallisuus) .pf-info-row-icon,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field-icon {
            position: static !important;
            display: grid !important;
            grid-column: 1 !important;
            width: 30px !important;
            height: 30px !important;
            place-items: center !important;
            margin: 0 !important;
            padding: 0 !important;
            background: color-mix(in srgb, var(--pf-desktop-line) 28%, transparent) !important;
            border: 1px solid color-mix(in srgb, var(--pf-desktop-line) 72%, transparent) !important;
            border-radius: 999px !important;
            color: var(--pf-desktop-muted) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #osoite, #tilin-turvallisuus) .pf-info-label,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field > label {
            position: static !important;
            grid-column: 2 !important;
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            color: var(--pf-desktop-muted) !important;
            font-size: 13px !important;
            font-weight: 750 !important;
            line-height: 1.2 !important;
            text-align: left !important;
            -webkit-text-fill-color: var(--pf-desktop-muted) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #osoite, #tilin-turvallisuus) .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field > :is(.pf-locked, input, textarea) {
            position: static !important;
            grid-column: 3 / -1 !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 32px !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: var(--pf-desktop-text) !important;
            -webkit-text-fill-color: var(--pf-desktop-text) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #osoite) .pf-info-value > input,
          html body .pf-page .pf-form > #julkinen-profiili :is(.pf-locked input, .pf-locked input:disabled, input, textarea) {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 32px !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: var(--pf-desktop-text) !important;
            font-size: 14px !important;
            font-weight: 850 !important;
            text-align: left !important;
            -webkit-text-fill-color: var(--pf-desktop-text) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys) .pf-phone-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: center !important;
            gap: 10px !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys) .pf-phone-card {
            display: flex !important;
            align-items: center !important;
            min-width: 0 !important;
            min-height: 32px !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys) :is(.pf-phone-number, .pf-email-address) {
            overflow: hidden !important;
            color: var(--pf-desktop-text) !important;
            font-size: 14px !important;
            font-weight: 850 !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            -webkit-text-fill-color: var(--pf-desktop-text) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys) .pf-phone-change-btn,
          html body .pf-page .pf-form > #tilin-turvallisuus .pf-inline-btn {
            width: auto !important;
            min-width: 112px !important;
            min-height: 34px !important;
            margin: 0 !important;
            padding: 0 14px !important;
            background: color-mix(in srgb, var(--pf-desktop-accent) 11%, transparent) !important;
            border: 1px solid color-mix(in srgb, var(--pf-desktop-accent) 42%, var(--pf-desktop-line)) !important;
            border-radius: 9px !important;
            color: var(--pf-desktop-accent) !important;
            font-size: 12px !important;
            font-weight: 900 !important;
            -webkit-text-fill-color: var(--pf-desktop-accent) !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field {
            min-height: 116px !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > textarea {
            min-height: 88px !important;
            overflow: hidden !important;
            resize: none !important;
            line-height: 1.45 !important;
          }

          html body .pf-page #julkinen-profiili .pf-public-note {
            display: none !important;
          }

          html body .pf-page .pf-form > #myyjat > :is(.company-seller-list, .company-seller-add) {
            width: 100% !important;
            margin: 0 0 8px !important;
            padding: 0 !important;
          }

          html body .pf-page .pf-form > #myyjat :is(.company-seller-card, .company-seller-empty, .company-seller-add) {
            background: var(--pf-desktop-row) !important;
            border: 1px solid var(--pf-desktop-line) !important;
            border-radius: 13px !important;
            box-shadow: none !important;
            color: var(--pf-desktop-text) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add {
            display: grid !important;
            gap: 12px !important;
            padding: 14px !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-fields {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-fields input {
            width: 100% !important;
            min-height: 42px !important;
            background: var(--pf-desktop-panel) !important;
            border: 1px solid var(--pf-desktop-line) !important;
            border-radius: 9px !important;
            color: var(--pf-desktop-text) !important;
            -webkit-text-fill-color: var(--pf-desktop-text) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-btn {
            width: min(100%, 230px) !important;
            min-height: 42px !important;
            background: var(--pf-desktop-accent) !important;
            border: 0 !important;
            border-radius: 9px !important;
            color: #ffffff !important;
            -webkit-text-fill-color: #ffffff !important;
          }

          html body .pf-page .pf-form > .pf-save-bar {
            width: 100% !important;
            max-width: 860px !important;
          }
        }

        @media (min-width: 761px) and (max-width: 1040px) {
          html body .pf-page .pf-layout {
            grid-template-columns: 210px minmax(0, 1fr) !important;
            width: min(100%, 940px) !important;
          }
        }
      `}</style>

      <style jsx global>{`
        @media (min-width: 761px) {
          html body .pf-page .pf-layout {
            justify-content: start !important;
            margin-right: auto !important;
            margin-left: clamp(8px, 1.5vw, 22px) !important;
          }

          html body .pf-page {
            overflow-x: hidden !important;
          }

          html body .pf-page .pf-sidebar {
            min-height: 438px !important;
            padding-bottom: 16px !important;
            background: var(--pf-desktop-panel) !important;
            border: 1px solid var(--pf-desktop-line) !important;
            border-radius: 16px !important;
            overflow: hidden !important;
          }

          html body .pf-page .pf-sidebar .pf-user-card {
            display: grid !important;
            grid-template-columns: 78px minmax(0, 1fr) !important;
            grid-template-rows: auto auto auto auto !important;
            align-items: center !important;
            justify-items: stretch !important;
            column-gap: 13px !important;
            row-gap: 7px !important;
            min-height: 218px !important;
            padding: 20px 16px 17px !important;
            background: var(--pf-desktop-panel) !important;
            border: 0 !important;
            border-bottom: 1px solid var(--pf-desktop-line) !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          html body .pf-page .pf-sidebar .pf-user-identity {
            display: contents !important;
          }

          html body .pf-page .pf-sidebar .pf-user-name {
            grid-column: 1 / -1 !important;
            grid-row: 1 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            overflow: visible !important;
            color: var(--pf-desktop-text) !important;
            font-size: 16px !important;
            font-weight: 950 !important;
            line-height: 1.2 !important;
            justify-self: start !important;
            text-align: left !important;
            text-overflow: clip !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            -webkit-text-fill-color: var(--pf-desktop-text) !important;
          }

          html body .pf-page .pf-sidebar .pf-avatar {
            grid-column: 1 !important;
            grid-row: 2 / 4 !important;
            align-self: center !important;
            width: 74px !important;
            height: 74px !important;
            margin: 0 !important;
          }

          html body .pf-page .pf-sidebar .pf-company-badge {
            grid-column: 2 !important;
            grid-row: 3 !important;
            align-self: start !important;
            justify-self: start !important;
            margin: 0 !important;
            text-align: left !important;
          }

          html body .pf-page .pf-sidebar .pf-avatar-actions {
            grid-column: 2 !important;
            grid-row: 2 !important;
            align-self: end !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
            gap: 6px !important;
            width: 100% !important;
            margin: 0 !important;
          }

          html body .pf-page .pf-sidebar .pf-avatar-action {
            justify-content: center !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 36px !important;
            padding: 5px 8px !important;
            overflow: visible !important;
            font-size: 10px !important;
            line-height: 1.15 !important;
            text-align: center !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }

          html body .pf-page .pf-sidebar .pf-sidebar-progress {
            grid-column: 1 / -1 !important;
            grid-row: 4 !important;
            width: 100% !important;
            margin: 9px 0 0 !important;
          }

          html body .pf-page .pf-sidebar .pf-nav {
            flex: 1 1 auto !important;
            padding-bottom: 8px !important;
            background: var(--pf-desktop-panel) !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          html body .pf-page .pf-sidebar .pf-nav-item {
            min-height: 50px !important;
          }

          html body .pf-page .pf-sidebar .pf-nav-danger {
            width: calc(100% - 24px) !important;
            min-height: 46px !important;
            margin: 9px 12px 12px !important;
            padding: 0 14px !important;
            background: color-mix(in srgb, #ef4444 8%, transparent) !important;
            border: 1px solid #ef4444 !important;
            border-left: 3px solid #ef4444 !important;
            border-radius: 10px !important;
            color: #ff5b62 !important;
            -webkit-text-fill-color: #ff5b62 !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #myyjat, #julkinen-profiili, #osoite, #tilin-turvallisuus) {
            background: var(--pf-desktop-panel) !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #osoite, #tilin-turvallisuus) .pf-info-row,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field.pf-field-wide {
            grid-template-columns: 38px minmax(92px, 0.46fr) minmax(0, 1.54fr) auto !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #osoite, #tilin-turvallisuus) .pf-info-value,
          html body .pf-page .pf-form > #julkinen-profiili .pf-field > :is(.pf-locked, input, textarea) {
            justify-self: stretch !important;
            text-align: left !important;
          }

          html body .pf-page .pf-form > :is(#tiedot, #yritys, #osoite) .pf-info-value > input,
          html body .pf-page .pf-form > #julkinen-profiili :is(.pf-locked input, .pf-locked input:disabled, input, textarea) {
            text-align: left !important;
          }

          html body .pf-page .pf-form > #myyjat > div.company-seller-add.pf-card-body {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 13px !important;
            width: 100% !important;
            padding: 16px !important;
          }

          html body .pf-page .pf-form > #myyjat > div.company-seller-add.pf-card-body > .company-seller-add-head {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > #myyjat > div.company-seller-add.pf-card-body > .company-seller-add-fields {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
            width: 100% !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-fields > label {
            display: grid !important;
            gap: 6px !important;
            min-width: 0 !important;
            color: var(--pf-desktop-muted) !important;
            font-size: 12px !important;
            font-weight: 800 !important;
            -webkit-text-fill-color: var(--pf-desktop-muted) !important;
          }

          html body .pf-page .pf-form > #myyjat .company-seller-add-fields input {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 44px !important;
            padding: 0 12px !important;
            font-size: 14px !important;
          }

          html body .pf-page .pf-form > #myyjat > div.company-seller-add.pf-card-body > .company-seller-add-btn {
            justify-self: start !important;
            width: min(100%, 220px) !important;
            min-height: 44px !important;
            margin: 0 !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field,
          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field.pf-field-wide {
            grid-template-columns: 38px minmax(0, 1fr) !important;
            grid-template-rows: auto auto !important;
            align-items: start !important;
            min-height: 166px !important;
            padding: 14px !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > .pf-field-icon {
            grid-column: 1 !important;
            grid-row: 1 / 3 !important;
            align-self: start !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > label {
            grid-column: 2 !important;
            grid-row: 1 !important;
            align-self: center !important;
            margin: 0 0 5px !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > textarea {
            grid-column: 2 !important;
            grid-row: 2 !important;
            width: 100% !important;
            min-height: 112px !important;
            padding: 4px 0 18px !important;
            overflow: hidden !important;
            resize: none !important;
            line-height: 1.45 !important;
            text-align: left !important;
            white-space: pre-wrap !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
          }

          html body main.pf-page .pf-form > section#julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-field.pf-field-wide.pf-public-bio-field {
            grid-template-columns: 38px minmax(0, 1fr) !important;
            grid-template-rows: auto auto !important;
          }

          html body main.pf-page .pf-form > section#julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-field.pf-field-wide.pf-public-bio-field > label {
            grid-column: 2 !important;
            grid-row: 1 !important;
            justify-self: start !important;
            text-align: left !important;
          }

          html body main.pf-page .pf-form > section#julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-field.pf-field-wide.pf-public-bio-field > textarea {
            grid-column: 2 !important;
            grid-row: 2 !important;
            justify-self: stretch !important;
            width: 100% !important;
            padding-right: 0 !important;
            padding-left: 0 !important;
            text-align: left !important;
            direction: ltr !important;
          }

          html body main.pf-page .pf-form > section#julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > :is(.pf-public-name-field, .pf-public-address-field) > :is(.pf-locked, input) {
            justify-self: stretch !important;
            text-align: left !important;
          }

          html body main.pf-page .pf-form > section#julkinen-profiili.pf-aligned-section > .pf-fields.pf-public-fields.pf-card-body > .pf-public-name-field > .pf-locked > input {
            text-align: left !important;
          }

          html body .pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > .pf-phone-help {
            right: 14px !important;
            bottom: 10px !important;
          }
        }
      `}</style>

      <style jsx global>{`
        html body .pf-page {
          position: relative;
        }

        html body .pf-page .pf-listing-profile-notice {
          display: grid !important;
          grid-template-columns: 24px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 10px !important;
          width: 100% !important;
          min-height: 0 !important;
          margin: 0 0 12px !important;
          padding: 12px 14px !important;
          background: var(--pf-desktop-row, var(--theme-surface-soft)) !important;
          border: 1px solid var(--pf-desktop-line, var(--theme-line-strong)) !important;
          border-radius: 11px !important;
          box-shadow: none !important;
          color: var(--pf-desktop-text, var(--theme-text)) !important;
          text-align: left !important;
        }

        html body .pf-page .pf-listing-profile-notice > svg {
          color: var(--theme-accent, #ff7a1a) !important;
        }

        html body .pf-page .pf-listing-profile-notice > span {
          color: var(--pf-desktop-muted, var(--theme-muted)) !important;
          font-size: 12px !important;
          font-weight: 750 !important;
          line-height: 1.4 !important;
          text-align: left !important;
          -webkit-text-fill-color: var(--pf-desktop-muted, var(--theme-muted)) !important;
        }

        html body .pf-page .pf-mobile-profile-close {
          display: none !important;
        }

        @media (min-width: 761px) {
          html body main.pf-page form.pf-form > .pf-save-bar {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 20px !important;
            width: 100% !important;
            min-height: 70px !important;
            padding: 12px 18px !important;
          }

          html body main.pf-page form.pf-form > .pf-save-bar > button.pf-save-btn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            align-self: center !important;
            width: auto !important;
            min-width: 220px !important;
            margin: 0 0 0 14px !important;
            text-align: center !important;
          }

          html body main.pf-page form.pf-form > .pf-save-bar > :is(.pf-last-updated, .pf-status) {
            display: inline-block !important;
            width: auto !important;
            margin: 0 !important;
            text-align: left !important;
          }
        }

        @media (max-width: 760px) {
          html body .pf-page .pf-listing-profile-notice {
            display: grid !important;
            grid-template-columns: 24px minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 10px !important;
            width: calc(100% - 20px) !important;
            min-height: 0 !important;
            margin: 0 10px !important;
            padding: 12px 13px !important;
            background: var(--pf-mobile-row) !important;
            border: 1px solid var(--pf-mobile-line) !important;
            border-radius: 11px !important;
            box-shadow: none !important;
            color: var(--pf-mobile-text) !important;
            text-align: left !important;
          }

          html body .pf-page .pf-listing-profile-notice > svg {
            width: 19px !important;
            height: 19px !important;
            color: var(--pf-mobile-accent) !important;
          }

          html body .pf-page .pf-listing-profile-notice > span {
            color: var(--pf-mobile-muted) !important;
            font-size: 12px !important;
            font-weight: 750 !important;
            line-height: 1.4 !important;
            text-align: left !important;
            -webkit-text-fill-color: var(--pf-mobile-muted) !important;
          }

          html body .pf-page .pf-mobile-profile-close {
            position: absolute !important;
            z-index: 100 !important;
            top: calc(20px + env(safe-area-inset-top, 0px)) !important;
            right: 2px !important;
            display: grid !important;
            width: 40px !important;
            height: 40px !important;
            place-items: center !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: var(--theme-accent, #ff7a1a) !important;
            cursor: pointer !important;
            -webkit-text-fill-color: var(--theme-accent, #ff7a1a) !important;
          }

          html body .pf-page .pf-mobile-profile-close:active {
            transform: scale(0.94) !important;
          }
        }

        html body main.pf-page .pf-form > section#tiedot .pf-address-info-row > .pf-info-value.pf-private-address-value {
          position: relative !important;
          z-index: 20 !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 8px !important;
          width: 100% !important;
          pointer-events: auto !important;
        }

        html body main.pf-page .pf-form > section#tiedot .pf-address-info-row .pf-private-address-input {
          position: relative !important;
          z-index: 21 !important;
          width: 100% !important;
          min-width: 0 !important;
          pointer-events: auto !important;
          user-select: text !important;
          cursor: text !important;
        }

        html:not([data-theme="light"]) body main.pf-page .pf-form > section#tiedot,
        html:not([data-theme="light"]) body main.pf-page .pf-form > section#tiedot > .pf-info-card-head,
        html:not([data-theme="light"]) body main.pf-page .pf-form > section#tiedot > .pf-info-rows {
          background: #071b2d !important;
          background-color: #071b2d !important;
          background-image: none !important;
        }

        @media (min-width: 761px) {
          html body main.pf-page > .pf-layout {
            grid-template-columns: 236px minmax(0, 860px) !important;
            justify-content: center !important;
            width: min(1120px, calc(100vw - 48px)) !important;
            max-width: 1120px !important;
            margin-right: auto !important;
            margin-left: auto !important;
            padding-right: 0 !important;
            padding-left: 0 !important;
          }

          html body main.pf-page .pf-form > section#julkinen-profiili.pf-public-profile-section {
            align-self: start !important;
            height: auto !important;
            min-height: 0 !important;
            padding-bottom: 16px !important;
          }

          html body main.pf-page .pf-form > #julkinen-profiili .pf-public-bio-field,
          html body main.pf-page .pf-form > #julkinen-profiili .pf-public-bio-field.pf-field-wide {
            height: auto !important;
            min-height: 92px !important;
            padding-top: 12px !important;
            padding-bottom: 12px !important;
          }

          html body main.pf-page .pf-form > #julkinen-profiili .pf-public-bio-field > textarea {
            height: 54px !important;
            min-height: 54px !important;
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }
        }

        @media (max-width: 760px) {
          html:has(main.pf-page),
          body:has(main.pf-page) {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            overflow-x: hidden !important;
          }

          html body main.pf-page .pf-layout {
            width: 100% !important;
            min-height: 0 !important;
            align-content: start !important;
            grid-template-rows: max-content max-content !important;
          }

          html body main.pf-page .pf-sidebar,
          html body main.pf-page .pf-content {
            width: 100% !important;
            min-width: 0 !important;
            margin-top: 0 !important;
          }

          html body main.pf-page .pf-sidebar {
            border-right: 0 !important;
          }
        }

        @media (max-width: 320px) {
          html body:has(main.pf-page) header.universal-app-topbar {
            width: 100vw !important;
            min-width: 0 !important;
            max-width: 100vw !important;
            gap: 6px !important;
            padding-right: 9px !important;
            padding-left: 9px !important;
          }

          html body:has(main.pf-page) header.universal-app-topbar .universal-topbar-actions {
            display: none !important;
          }

          html body:has(main.pf-page) header.universal-app-topbar .universal-home-navigation,
          html body:has(main.pf-page) header.universal-app-topbar .universal-page-back-brand {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          html body main.pf-page .pf-user-card {
            grid-template-columns: 64px minmax(0, 1fr) !important;
            column-gap: 10px !important;
            padding: 14px 10px !important;
          }

          html body main.pf-page .pf-avatar {
            width: 64px !important;
            height: 64px !important;
          }

          html body main.pf-page .pf-avatar-actions {
            gap: 5px !important;
          }

          html body main.pf-page .pf-avatar-action {
            min-height: 30px !important;
            padding: 4px 6px !important;
            font-size: 10px !important;
          }
        }

        /* Keep the compact change actions crisp and make the website shortcut
           easier to recognise without altering the surrounding row layout. */
        html body main.pf-page .pf-phone-change-btn,
        html body main.pf-page .pf-phone-change-btn:hover:not(:disabled),
        html body main.pf-page .pf-phone-change-btn:focus-visible {
          box-shadow: none !important;
          filter: none !important;
          text-shadow: none !important;
        }

        html body main.pf-page .pf-info-website-value .pf-website-link svg {
          width: 18px !important;
          height: 18px !important;
          stroke-width: 2.25 !important;
        }
      `}</style>

    </main>
  );

}
