"use client";

import type { MouseEvent, TouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import OptimizedListingImage from "@/app/components/OptimizedListingImage";
import ListingVehicleMeta from "@/app/components/ListingVehicleMeta";
import ListingSalePrice from "@/app/components/ListingSalePrice";
import { useCurrency } from "@/app/components/CurrencyProvider";
import homeStyles from "@/app/page.module.css";

import {
  Building2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Mail,
  MessageCircle,
  MessageSquareText,
  MapPin,
  Package,
  ShieldCheck,
  Phone,
  PhoneCall,
  Heart,
  LockKeyhole,
  Share2,
  ShoppingCart,
  Star,
  UserRound,
  X,
  ZoomIn
} from "lucide-react";

import {
  getListingImageAlt,
  getListingPartNumber,
  isVehicleListing,
  type Listing
} from "@/lib/listings";
import { isSupportedCurrency } from "@/lib/currency";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { useLanguage, translateCategory, type Locale } from "@/lib/i18n";
import { formatLocationWithCountry, getCountryFlagFromLocation } from "@/lib/country-flags";
import {
  listingNumberUrlId,
  listingPath,
  listingSharePath,
  listingUrlId,
  pagePath,
  profilePath
} from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";
import { readVehicleAccessories } from "@/lib/vehicle-accessories";
import { readVehicleColors, VEHICLE_COLORS_DESCRIPTION_LABEL } from "@/lib/vehicle-colors";
import { addCartProduct } from "@/lib/commerce/cart";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { activeSaleDiscountPercent, activeSalePrice } from "@/lib/commerce/discounts";
import type { PublicProduct } from "@/lib/commerce/types";

import { trackListingView, setRecoUserId } from "@/lib/recommendations";

import {
  getSavedListingIds,
  getListingById,
  getListingDisplayNumber,
  getOrCreateConversationForListing,
  getListings,
  getPublicSellerLevelStats,
  incrementListingView,
  saveListing,
  supabase,
  trackUserActivity,
  unsaveListing
} from "@/lib/supabase";

const listingUiText = {
  fi: {
    loading: "Ladataan...",
    notFound: "Ei löytynyt",
    linkCopied: "Linkki kopioitu!",
    back: "Takaisin",
    forSale: "Myynnissä",
    part: "Varaosa",
    category: "Kategoria",
    updated: "Päivitetty",
    imageSingular: "kuva",
    imagePlural: "kuvaa",
    share: "Jaa",
    saved: "Tallennettu",
    save: "Tallenna",
    description: "Kuvaus",
    basicInfo: "Perustiedot",
    additionalInfo: "Lisätiedot",
    noDescription: "Ei kuvausta.",
    vehicle: "Ajoneuvo",
    gearType: "Ajovarusteen tyyppi",
    size: "Koko",
    targetGroup: "Kohderyhmä",
    partModel: "Osan malli",
    trackMatDetails: "Telamaton tiedot",
    trackMatDimensions: "Telamaton mitat",
    partNumber: "Varaosanumero",
    brand: "Merkki",
    model: "Malli",
    brandModel: "Merkki ja malli",
    year: "Vuosimalli",
    condition: "Kunto",
    location: "Sijainti",
    notSpecified: "Ei ilmoitettu",
    seller: "Myyjä",
    fallbackSeller: "Myyjä",
    verified: "Tunnistettu",
    sellers: "Myyjät",
    map: "Kartta",
    website: "WWW-sivut",
    openSellerProfile: (name: string) => `Avaa myyjän ${name} julkinen profiili`,
    viewProfile: "Katso profiili",
    contactHeading: "Kysyttävää kohteesta?",
    sendMessage: "Lähetä viesti",
    fetchingPhone: "...",
    showPhone: "Näytä numero",
    missingPhone: "Numero puuttuu",
    loginContact: "Kirjaudu nähdäksesi yhteystiedot",
    callPhone: "Soita",
    whatsappPhone: "WhatsApp-viesti",
    textPhone: "Tekstiviesti",
    phoneActions: "Valitse yhteydenottotapa",
    messageLoginRequired: "Haluatko kysyä tuotteesta?",
    loginNow: "Kirjaudu sisään ja lähetä viesti"
  },
  en: {
    loading: "Loading...",
    notFound: "Not found",
    linkCopied: "Link copied!",
    back: "Back",
    forSale: "For sale",
    part: "Part",
    category: "Category",
    updated: "Updated",
    imageSingular: "image",
    imagePlural: "images",
    share: "Share",
    saved: "Saved",
    save: "Save",
    description: "Description",
    basicInfo: "Basic information",
    additionalInfo: "Additional details",
    noDescription: "No description.",
    vehicle: "Vehicle",
    gearType: "Riding gear type",
    size: "Size",
    targetGroup: "Target group",
    partModel: "Part model",
    trackMatDetails: "Track mat details",
    trackMatDimensions: "Track mat dimensions",
    partNumber: "Part number",
    brand: "Brand",
    model: "Model",
    brandModel: "Brand and model",
    year: "Year",
    condition: "Condition",
    location: "Location",
    notSpecified: "Not specified",
    seller: "Seller",
    fallbackSeller: "Seller",
    verified: "Verified",
    sellers: "Sellers",
    map: "Map",
    website: "Website",
    openSellerProfile: (name: string) => `Open ${name}'s public seller profile`,
    viewProfile: "View profile",
    contactHeading: "Questions about this listing?",
    sendMessage: "Send message",
    fetchingPhone: "...",
    showPhone: "Show number",
    missingPhone: "Number missing",
    loginContact: "Log in to see contact details",
    callPhone: "Call",
    whatsappPhone: "WhatsApp message",
    textPhone: "Text message",
    phoneActions: "Choose how to contact",
    messageLoginRequired: "Want to ask about this item?",
    loginNow: "Log in and send a message"
  },
  sv: {
    loading: "Laddar...",
    notFound: "Hittades inte",
    linkCopied: "Länken kopierad!",
    back: "Tillbaka",
    forSale: "Till salu",
    part: "Reservdel",
    category: "Kategori",
    updated: "Uppdaterad",
    imageSingular: "bild",
    imagePlural: "bilder",
    share: "Dela",
    saved: "Sparad",
    save: "Spara",
    description: "Beskrivning",
    basicInfo: "Grunduppgifter",
    additionalInfo: "Tilläggsinformation",
    noDescription: "Ingen beskrivning.",
    vehicle: "Fordon",
    gearType: "Typ av körutrustning",
    size: "Storlek",
    targetGroup: "Målgrupp",
    partModel: "Delmodell",
    trackMatDetails: "Mattans uppgifter",
    trackMatDimensions: "Mattans mått",
    partNumber: "Artikelnummer",
    brand: "Märke",
    model: "Modell",
    brandModel: "Märke och modell",
    year: "Årsmodell",
    condition: "Skick",
    location: "Plats",
    notSpecified: "Ej angivet",
    seller: "Säljare",
    fallbackSeller: "Säljare",
    verified: "Verifierad",
    sellers: "Säljare",
    map: "Karta",
    website: "Webbplats",
    openSellerProfile: (name: string) => `Öppna ${name}s offentliga säljarprofil`,
    viewProfile: "Visa profil",
    contactHeading: "Frågor om annonsen?",
    sendMessage: "Skicka meddelande",
    fetchingPhone: "...",
    showPhone: "Visa nummer",
    missingPhone: "Nummer saknas",
    loginContact: "Logga in för att se kontaktuppgifter",
    callPhone: "Ring",
    whatsappPhone: "WhatsApp-meddelande",
    textPhone: "Sms",
    phoneActions: "Välj kontaktsätt",
    messageLoginRequired: "Vill du fråga om produkten?",
    loginNow: "Logga in och skicka ett meddelande"
  },
  no: {
    loading: "Laster...",
    notFound: "Ikke funnet",
    linkCopied: "Lenken er kopiert!",
    back: "Tilbake",
    forSale: "Til salgs",
    part: "Del",
    category: "Kategori",
    updated: "Oppdatert",
    imageSingular: "bilde",
    imagePlural: "bilder",
    share: "Del",
    saved: "Lagret",
    save: "Lagre",
    description: "Beskrivelse",
    basicInfo: "Grunnopplysninger",
    additionalInfo: "Tilleggsinformasjon",
    noDescription: "Ingen beskrivelse.",
    vehicle: "Kjøretøy",
    gearType: "Type kjøreutstyr",
    size: "Størrelse",
    targetGroup: "Målgruppe",
    partModel: "Delmodell",
    trackMatDetails: "Beltemattedetaljer",
    trackMatDimensions: "Beltemattemål",
    partNumber: "Delenummer",
    brand: "Merke",
    model: "Modell",
    brandModel: "Merke og modell",
    year: "Årsmodell",
    condition: "Tilstand",
    location: "Sted",
    notSpecified: "Ikke oppgitt",
    seller: "Selger",
    fallbackSeller: "Selger",
    verified: "Verifisert",
    sellers: "Selgere",
    map: "Kart",
    website: "Nettside",
    openSellerProfile: (name: string) => `Åpne den offentlige selgerprofilen til ${name}`,
    viewProfile: "Vis profil",
    contactHeading: "Spørsmål om annonsen?",
    sendMessage: "Send melding",
    fetchingPhone: "...",
    showPhone: "Vis nummer",
    missingPhone: "Nummer mangler",
    loginContact: "Logg inn for å se kontaktopplysninger",
    callPhone: "Ring",
    whatsappPhone: "WhatsApp-melding",
    textPhone: "Tekstmelding",
    phoneActions: "Velg kontaktmåte",
    messageLoginRequired: "Vil du spørre om denne varen?",
    loginNow: "Logg inn og send en melding"
  },
} satisfies Record<Locale, Record<string, string | ((name: string) => string)>>;

const conditionLabels: Record<Locale, Record<string, string>> = {
  fi: {},
  en: { "Hyvä": "Good", Uusi: "New", "Kuin uusi": "Like new", "Tyydyttävä": "Fair", Heikko: "Poor" },
  sv: { "Hyvä": "Bra", Uusi: "Ny", "Kuin uusi": "Som ny", "Tyydyttävä": "Godtagbar", Heikko: "Dålig" },
  no: { Hyvä: "God", Uusi: "Ny", "Kuin uusi": "Som ny", Tyydyttävä: "Greit", Heikko: "Dårlig" },
};

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function phoneLinkValue(value: string) {
  return value.trim().replace(/[^\d+]/g, "");
}

function whatsappPhoneValue(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `358${digits.slice(1)}`;
  return digits;
}

function getSimilarListingScore(current: Listing, candidate: Listing) {
  let score = 0;

  if (normalizeComparable(current.subcategory) && normalizeComparable(current.subcategory) === normalizeComparable(candidate.subcategory)) score += 5;
  if (normalizeComparable(current.category) && normalizeComparable(current.category) === normalizeComparable(candidate.category)) score += 3;
  if (normalizeComparable(current.vehicle_type) && normalizeComparable(current.vehicle_type) === normalizeComparable(candidate.vehicle_type)) score += 2;
  if (normalizeComparable(current.brand) && normalizeComparable(current.brand) === normalizeComparable(candidate.brand)) score += 1;
  if (normalizeComparable(current.model) && normalizeComparable(current.model) === normalizeComparable(candidate.model)) score += 1;
  if (normalizeComparable(current.year) && normalizeComparable(current.year) === normalizeComparable(candidate.year)) score += 1;

  return score;
}

const dateLocales: Record<Locale, string> = {
  fi: "fi-FI",
  en: "en-US",
  sv: "sv-SE",
  no: "nb-NO",
};

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(dateLocales[locale], {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(date);
}

function isListingNew(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;

  return Date.now() - created < 24 * 60 * 60 * 1000;
}

function listingImageSrc(listing: Listing) {
  return (
    listing.image_url ||
    listing.image_urls?.find(Boolean) ||
    null
  );
}

function readSavedListingIds() {
  try {
    const savedListings = JSON.parse(
      localStorage.getItem("savedListings") || "[]"
    );

    return Array.isArray(savedListings)
      ? savedListings.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function formatLocation(value: string | null | undefined) {
  return (value || "")
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : "";
    })
    .filter(Boolean)
    .join(", ");
}

function readDescriptionField(description: string | null | undefined, label: string) {
  const normalizedLabel = label.trim().toLocaleLowerCase("fi-FI");

  for (const line of (description ?? "").split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;

    const lineLabel = line.slice(0, separatorIndex).trim().toLocaleLowerCase("fi-FI");
    if (lineLabel === normalizedLabel) return line.slice(separatorIndex + 1).trim();
  }

  return "";
}

function removeDescriptionFields(description: string, labels: readonly string[]) {
  const normalizedLabels = new Set(
    labels.map((label) => label.trim().toLocaleLowerCase("fi-FI"))
  );

  return description
    .split(/\r?\n/)
    .filter((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex < 0) return true;

      const lineLabel = line.slice(0, separatorIndex).trim().toLocaleLowerCase("fi-FI");
      return !normalizedLabels.has(lineLabel);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const vehicleFactText: Record<Locale, {
  listingType: string;
  registration: string;
  mileage: string;
  operatingHours: string;
  engineDisplacement: string;
  engineModel: string;
  engineKind: string;
  driveType: string;
  roadLegal: string;
  accessories: string;
  color: string;
}> = {
  fi: {
    listingType: "Ilmoitustyyppi",
    registration: "Rekisteritunnus",
    mileage: "Ajokilometrit",
    operatingHours: "Käyttötunnit",
    engineDisplacement: "Moottoritilavuus",
    engineModel: "Moottori / malli",
    engineKind: "Moottorin tyyppi",
    driveType: "Vetotapa",
    roadLegal: "Tieliikennekelpoisuus",
    accessories: "Lisävarusteet",
    color: "Väri"
  },
  en: {
    listingType: "Listing type",
    registration: "Registration number",
    mileage: "Mileage",
    operatingHours: "Operating hours",
    engineDisplacement: "Engine displacement",
    engineModel: "Engine / model",
    engineKind: "Engine type",
    driveType: "Drive type",
    roadLegal: "Road legality",
    accessories: "Accessories",
    color: "Color"
  },
  sv: {
    listingType: "Annonstyp",
    registration: "Registreringsnummer",
    mileage: "Mätarställning",
    operatingHours: "Drifttimmar",
    engineDisplacement: "Motorvolym",
    engineModel: "Motor / modell",
    engineKind: "Motortyp",
    driveType: "Drivtyp",
    roadLegal: "Trafikduglighet",
    accessories: "Tillbehör",
    color: "Färg"
  },
  no: {
    listingType: "Annonsetype",
    registration: "Registreringsnummer",
    mileage: "Kilometerstand",
    operatingHours: "Driftstimer",
    engineDisplacement: "Motorvolum",
    engineModel: "Motor / modell",
    engineKind: "Motortype",
    driveType: "Drivtype",
    roadLegal: "Veigodkjenning",
    accessories: "Ekstrautstyr",
    color: "Farge"
  }
};

const VEHICLE_DESCRIPTION_FIELDS = [
  "Ajoneuvotyyppi",
  "Toimitustapa",
  "Ajokilometrit",
  "Käyttötunnit",
  "Rekisteritunnus",
  "Moottorin tyyppi",
  "Vetotapa",
  "Tieliikennekelpoisuus",
  "Lisävarusteet",
  VEHICLE_COLORS_DESCRIPTION_LABEL
] as const;

const listingExtraText: Record<
  Locale,
  {
    vehicleSubtype: string;
    delivery: string;
    businessId: string;
    memberSince: string;
    verifiedCompany: string;
    company: string;
    privateSeller: string;
    verifiedSellerSuffix: string;
    noReviews: string;
    oneReview: string;
    reviews: (count: number) => string;
    successfulDeal: string;
    successfulDeals: string;
    sellerStatsAria: string;
  }
> = {
  fi: {
    vehicleSubtype: "Tyyppi",
    delivery: "Toimitus",
    businessId: "Y-tunnus",
    memberSince: "J\u00e4senen\u00e4 vuodesta",
    verifiedCompany: "Vahvistettu yritys",
    company: "Yritys",
    privateSeller: "Yksityinen myyj\u00e4",
    verifiedSellerSuffix: " myyj\u00e4",
    noReviews: "Ei arvioita",
    oneReview: "1 arvio",
    reviews: (count) => `${count} arviota`,
    successfulDeal: "Onnistunut kauppa",
    successfulDeals: "Onnistunutta kauppaa",
    sellerStatsAria: "Myyj\u00e4n arviot ja kaupat"
  },
  en: {
    vehicleSubtype: "Vehicle type",
    delivery: "Delivery",
    businessId: "Business ID",
    memberSince: "Member since",
    verifiedCompany: "Verified company",
    company: "Company",
    privateSeller: "Private seller",
    verifiedSellerSuffix: " seller",
    noReviews: "No reviews",
    oneReview: "1 review",
    reviews: (count) => `${count} reviews`,
    successfulDeal: "Successful deal",
    successfulDeals: "Successful deals",
    sellerStatsAria: "Seller reviews and deals"
  },
  sv: {
    vehicleSubtype: "Fordonstyp",
    delivery: "Leverans",
    businessId: "FO-nummer",
    memberSince: "Medlem sedan",
    verifiedCompany: "Verifierat f\u00f6retag",
    company: "F\u00f6retag",
    privateSeller: "Privat s\u00e4ljare",
    verifiedSellerSuffix: " s\u00e4ljare",
    noReviews: "Inga recensioner",
    oneReview: "1 recension",
    reviews: (count) => `${count} recensioner`,
    successfulDeal: "Lyckad aff\u00e4r",
    successfulDeals: "Lyckade aff\u00e4rer",
    sellerStatsAria: "S\u00e4ljarens recensioner och aff\u00e4rer"
  },
  no: {
    vehicleSubtype: "Kj\u00f8ret\u00f8ytype",
    delivery: "Levering",
    businessId: "Organisasjonsnummer",
    memberSince: "Medlem siden",
    verifiedCompany: "Verifisert bedrift",
    company: "Bedrift",
    privateSeller: "Privat selger",
    verifiedSellerSuffix: " selger",
    noReviews: "Ingen anmeldelser",
    oneReview: "1 anmeldelse",
    reviews: (count) => `${count} anmeldelser`,
    successfulDeal: "Vellykket handel",
    successfulDeals: "Vellykkede handler",
    sellerStatsAria: "Selgerens anmeldelser og handler"
  },
};

function translateDeliveryMethod(locale: Locale, value: string) {
  const normalized = value.trim().toLowerCase();
  const key =
    normalized.includes("nouto") && (normalized.includes("lähetys") || normalized.includes("lähetys"))
      ? "both"
      : normalized.includes("nouto")
        ? "pickup"
        : normalized.includes("lähetys") || normalized.includes("lähetys")
          ? "shipping"
          : "";

  const labels = {
    fi: {
      both: "Lähetys ja nouto",
      shipping: "Lähetys",
      pickup: "Nouto"
    },
    en: {
      both: "Shipping and pickup",
      shipping: "Shipping",
      pickup: "Pickup"
    },
    sv: {
      both: "Frakt och avhämtning",
      shipping: "Frakt",
      pickup: "Avhämtning"
    },
    no: {
      both: "Frakt og henting",
      shipping: "Frakt",
      pickup: "Henting"
    },
  } satisfies Record<Locale, Record<string, string>>;

  return key ? labels[locale][key] : translateCategory(locale, value);
}

function restoreConversationVisibility(userId: string, conversationId: string) {
  if (typeof window === "undefined" || !userId || !conversationId) {
    return;
  }

  for (const key of [
    `hiddenConversations:${userId}`,
    `deletedConversations:${userId}`
  ]) {
    try {
      const stored = JSON.parse(
        localStorage.getItem(key) || "[]"
      );

      if (!Array.isArray(stored)) {
        continue;
      }

      const next =
        stored.filter((id) => id !== conversationId);

      if (next.length !== stored.length) {
        localStorage.setItem(
          key,
          JSON.stringify(next)
        );
      }
    } catch {}
  }
}

export default function ListingPage({
  initialListing = null
}: {
  initialListing?: Listing | null;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale, activeLocale } = useLanguage();
  const { currency, formatAmount, formatFromEur } = useCurrency();
  const ui = listingUiText[locale];
  const extraUi = listingExtraText[locale];
  const fallbackCountry = locale === "fi" ? "Suomi" : "Finland";

  const initialListingRef = useRef<Listing | null | undefined>(undefined);
  if (initialListingRef.current === undefined) {
    initialListingRef.current = initialListing ?? null;
  }

  const [listing, setListing] =
    useState<Listing | null>(() => initialListingRef.current ?? null);
  const analyticsListingIdRef = useRef("");

  useEffect(() => {
    if (!listing || analyticsListingIdRef.current === listing.id) return;
    analyticsListingIdRef.current = listing.id;
    trackAnalyticsEvent("view_item", {
      currency: "EUR",
      value: Number(listing.price) || 0,
      items: [{
        item_id: String(listing.listing_number ?? listing.id),
        item_name: listing.title,
        item_brand: listing.brand || undefined,
        item_category: listing.vehicle_type || listing.category || undefined,
        item_variant: listing.model || undefined,
        price: Number(listing.price) || 0,
        quantity: 1
      }]
    });
  }, [listing]);

  const [loading, setLoading] =
    useState(() => !initialListingRef.current);

  const [commerceProduct, setCommerceProduct] =
    useState<PublicProduct | null>(null);

  const [commerceProductLoading, setCommerceProductLoading] =
    useState(true);

  const [commerceProductListingId, setCommerceProductListingId] =
    useState<string | null>(null);

  const [commerceMessage, setCommerceMessage] =
    useState("");

  const [activeImage, setActiveImage] =
    useState<string | null>(null);

  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  const [basicInfoOpen, setBasicInfoOpen] =
    useState(() => Boolean(initialListingRef.current && isVehicleListing(initialListingRef.current)));

  const [additionalInfoOpen, setAdditionalInfoOpen] =
    useState(true);

  useEffect(() => {
    if (listing) {
      setBasicInfoOpen(isVehicleListing(listing));
    }
  }, [listing?.id]);

  const [showPhone, setShowPhone] =
    useState(false);

  const [phoneActionsOpen, setPhoneActionsOpen] =
    useState(false);

  const [companyContactOpen, setCompanyContactOpen] =
    useState(false);

  const [companyPhoneVisible, setCompanyPhoneVisible] =
    useState(false);

  const [sellerPhone, setSellerPhone] =
    useState("");

  useEffect(() => {
    setCompanyPhoneVisible(false);
  }, [commerceProduct?.id]);

  const [sellerBusinessId, setSellerBusinessId] =
    useState<string | null>(null);

  const [sellerCompanyVerifiedAt, setSellerCompanyVerifiedAt] =
    useState<string | null>(null);

  const [sellerProfileAvatarUrl, setSellerProfileAvatarUrl] =
    useState<string | null>(null);

  const [sellerAccountType, setSellerAccountType] =
    useState<"company" | "private" | null>(null);

  const [sellerProfileCreatedAt, setSellerProfileCreatedAt] =
    useState<string | null>(null);

  const [sellerReviewAverage, setSellerReviewAverage] =
    useState<number | null>(null);

  const [sellerReviewCount, setSellerReviewCount] =
    useState<number | null>(null);

  const [sellerSoldCount, setSellerSoldCount] =
    useState<number | null>(null);

  const [phoneLoading, setPhoneLoading] =
    useState(false);

  const [messageLoading, setMessageLoading] =
    useState(false);
  const messagesNavigationPendingRef =
    useRef(false);

  function setMessagesNavigationPending(value: boolean) {
    messagesNavigationPendingRef.current = value;
    setMessageLoading(value);
  }

  const [saved, setSaved] =
    useState(false);

  const [savedListingIds, setSavedListingIds] =
    useState<string[]>([]);

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const [listingDisplayNumber, setListingDisplayNumber] =
    useState<number | null>(null);

  const [similarListings, setSimilarListings] =
    useState<Listing[]>([]);

  const swipeStartXRef =
    useRef<number | null>(null);

  const swipeMovedRef =
    useRef(false);

  const sellerCardHeaderRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const header = sellerCardHeaderRef.current;
    if (!header) return;

    const narrowPhone = window.matchMedia("(max-width: 420px)");
    const profileButton = header.querySelector<HTMLElement>(".seller-profile-btn-top");
    const mobileProperties: Array<[string, string]> = [
      ["align-items", "start"],
      ["display", "grid"],
      ["flex-direction", "column"],
      ["gap", "12px"],
      ["grid-template-columns", "minmax(0, 1fr)"],
      ["justify-items", "start"]
    ];

    const syncSellerHeaderLayout = () => {
      for (const [property, value] of mobileProperties) {
        if (narrowPhone.matches) {
          header.style.setProperty(property, value, "important");
        } else {
          header.style.removeProperty(property);
        }
      }

      if (profileButton) {
        if (narrowPhone.matches) {
          profileButton.style.setProperty("align-self", "end", "important");
          profileButton.style.setProperty("justify-self", "end", "important");
          profileButton.style.setProperty("margin", "0", "important");
        } else {
          profileButton.style.removeProperty("align-self");
          profileButton.style.removeProperty("justify-self");
          profileButton.style.removeProperty("margin");
        }
      }
    };

    syncSellerHeaderLayout();
    narrowPhone.addEventListener("change", syncSellerHeaderLayout);

    return () => narrowPhone.removeEventListener("change", syncSellerHeaderLayout);
  }, [listing?.id]);

  const sellerIdForPublicStats =
    listing?.seller_id ?? null;

  useEffect(() => {
    if (!previewImage) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscrollBehavior =
      document.documentElement.style.overscrollBehavior;
    const previousPreviewHeaderHeight =
      document.documentElement.style.getPropertyValue(
        "--listing-preview-header-height",
      );
    const previousPreviewUtilityHeight =
      document.documentElement.style.getPropertyValue(
        "--listing-preview-utility-height",
      );
    const previousOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior =
      document.body.style.overscrollBehavior;
    const appHeader = document.querySelector<HTMLElement>(
      ".universal-app-topbar",
    );
    const appHeaderHeight = Math.ceil(
      appHeader?.getBoundingClientRect().height ?? 0,
    );
    const utilityBar = document.querySelector<HTMLElement>(
      ".universal-utility-bar",
    );
    const utilityBarHeight = Math.ceil(
      utilityBar?.getBoundingClientRect().height ?? 0,
    );

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    }

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    if (appHeaderHeight > 0) {
      document.documentElement.style.setProperty(
        "--listing-preview-header-height",
        `${appHeaderHeight}px`,
      );
    }
    if (utilityBarHeight > 0) {
      document.documentElement.style.setProperty(
        "--listing-preview-utility-height",
        `${utilityBarHeight}px`,
      );
    }
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior =
        previousHtmlOverscrollBehavior;
      if (previousPreviewHeaderHeight) {
        document.documentElement.style.setProperty(
          "--listing-preview-header-height",
          previousPreviewHeaderHeight,
        );
      } else {
        document.documentElement.style.removeProperty(
          "--listing-preview-header-height",
        );
      }
      if (previousPreviewUtilityHeight) {
        document.documentElement.style.setProperty(
          "--listing-preview-utility-height",
          previousPreviewUtilityHeight,
        );
      } else {
        document.documentElement.style.removeProperty(
          "--listing-preview-utility-height",
        );
      }
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setIsLoggedIn(Boolean(data.session?.user));
          setRecoUserId(data.session?.user?.id ?? null);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoggedIn(false);
          setRecoUserId(null);
        }
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(Boolean(session?.user));
        setRecoUserId(session?.user?.id ?? null);
        if (!session?.user) {
          setShowPhone(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    setListingDisplayNumber(null);
    setActiveImage(null);
    setPreviewImage(null);
    setShowPhone(false);
    setSellerPhone("");

    const resolvedInitialListing = initialListing ?? null;

    if (resolvedInitialListing) {
      setListing(resolvedInitialListing);
      setLoading(false);
    } else {
      setListing(null);
      setLoading(true);
    }

    getListingById(resolvedInitialListing?.id || params.id)
      .then(({ data }) => {
        if (mounted) {
          const resolved = data ?? null;
          setListing(resolved);
          trackListingView(resolved);
          if (resolved) {
            void trackUserActivity({
              vehicle_type: resolved.vehicle_type,
              brand: resolved.brand,
              model: resolved.model,
              category: resolved.category
            });
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setListing(resolvedInitialListing);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [initialListing, params.id]);

  useEffect(() => {
    if (!listing) return;

    let mounted = true;

    getListingDisplayNumber(listing.created_at, listing.listing_number)
      .then((number) => {
        if (mounted) {
          setListingDisplayNumber(number);
        }
      })
      .catch(() => {
        if (mounted) {
          setListingDisplayNumber(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [listing]);

  useEffect(() => {
    if (!listing?.id) {
      setCommerceProduct(null);
      setCommerceProductLoading(false);
      setCommerceProductListingId(null);
      setCommerceMessage("");
      return;
    }

    let cancelled = false;
    const currentListingId = listing.id;
    const linkedProductId = listing.translations?._meta?.commerce_product_id?.trim() ?? "";
    setCommerceProduct(null);
    setCommerceProductLoading(true);
    setCommerceProductListingId(null);
    setCompanyContactOpen(false);

    async function fetchProduct(url: string) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return null;
      const body = await response.json() as { product?: PublicProduct | null };
      return body.product ?? null;
    }

    async function loadCommerceProduct() {
      try {
        let product = linkedProductId
          ? await fetchProduct(`/api/commerce/catalog/${encodeURIComponent(linkedProductId)}`)
          : null;

        // Compatibility path for listings published before the product id was
        // stored in the listing metadata.
        product ??= await fetchProduct(`/api/commerce/catalog?listing_id=${encodeURIComponent(currentListingId)}`);

        if (!cancelled) {
          setCommerceProduct(product);
          setCommerceMessage("");
        }
      } catch {
        if (!cancelled) setCommerceProduct(null);
      } finally {
        if (!cancelled) {
          setCommerceProductListingId(currentListingId);
          setCommerceProductLoading(false);
        }
      }
    }

    void loadCommerceProduct();
    return () => { cancelled = true; };
  }, [listing?.id, listing?.translations?._meta?.commerce_product_id]);

  useEffect(() => {
    if (!loading && !listing) {
      router.replace("/");
    }
  }, [listing, loading, router]);

  useEffect(() => {
    if (!supabase || !sellerIdForPublicStats) {
      setSellerBusinessId(null);
      setSellerCompanyVerifiedAt(null);
      setSellerProfileAvatarUrl(null);
      setSellerAccountType(null);
      setSellerProfileCreatedAt(null);
      setSellerReviewAverage(null);
      setSellerReviewCount(null);
      setSellerSoldCount(null);
      return;
    }

    const sellerId = sellerIdForPublicStats;
    let mounted = true;

    async function loadSellerPublicStats() {
      try {
        const [
          profileResult,
          reviewsResult,
          sellerLevelStatsResult
        ] = await Promise.all([
          supabase!
            .from("profiles")
            .select("business_id,company_verified_at,account_type,created_at,avatar_url")
            .eq("id", sellerId)
            .maybeSingle<{
              business_id?: string | null;
              company_verified_at?: string | null;
              account_type?: "company" | "private" | null;
              created_at?: string | null;
              avatar_url?: string | null;
            }>(),
          supabase!
            .from("seller_reviews")
            .select("rating")
            .eq("seller_id", sellerId)
            .returns<Array<{ rating: number | null }>>(),
          getPublicSellerLevelStats(sellerId)
        ]);

        if (!mounted) return;
        const data = profileResult.data;
        const ratings =
          reviewsResult.error
            ? null
            : (reviewsResult.data ?? [])
              .map((review) => Number(review.rating))
              .filter((rating) => Number.isFinite(rating));
        setSellerBusinessId(data?.business_id?.trim() || null);
        setSellerCompanyVerifiedAt(data?.company_verified_at ?? null);
        setSellerProfileAvatarUrl(data?.avatar_url?.trim() || null);
        setSellerAccountType(data?.account_type ?? null);
        setSellerProfileCreatedAt(data?.created_at ?? null);
        setSellerReviewCount(ratings ? ratings.length : null);
        setSellerReviewAverage(
          ratings && ratings.length > 0
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : null
        );
        setSellerSoldCount(sellerLevelStatsResult.data.sold_count);
      } catch {
        if (mounted) {
          setSellerBusinessId(null);
          setSellerCompanyVerifiedAt(null);
          setSellerProfileAvatarUrl(null);
          setSellerAccountType(null);
          setSellerProfileCreatedAt(null);
          setSellerReviewAverage(null);
          setSellerReviewCount(null);
          setSellerSoldCount(null);
        }
      }
    }

    void loadSellerPublicStats();

    return () => {
      mounted = false;
    };
  }, [sellerIdForPublicStats]);

  useEffect(() => {
    if (!listing) {
      setSimilarListings([]);
      return;
    }

    const currentListing = listing;
    let mounted = true;

    async function loadSimilarListings() {
      const { data } = await getListings({
        includeOptionalFields: false,
        limit: 240
      });
      const source = data;

      const ranked = source
        .filter((candidate) =>
          candidate.id !== currentListing.id &&
          !candidate.is_sold &&
          !candidate.is_hidden
        )
        .map((candidate) => ({
          candidate,
          score: getSimilarListingScore(currentListing, candidate)
        }))
        .filter(({ score }) => score >= 5)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(b.candidate.created_at).getTime() - new Date(a.candidate.created_at).getTime();
        })
        .slice(0, 4)
        .map(({ candidate }) => candidate);

      if (mounted) {
        setSimilarListings(ranked);
      }
    }

    void loadSimilarListings();

    return () => {
      mounted = false;
    };
  }, [listing]);

  useEffect(() => {
    if (!listing?.id) {
      return;
    }

    const storageKey =
      `listing-viewed:${listing.id}`;

    const viewedAt =
      typeof window !== "undefined"
        ? Number(sessionStorage.getItem(storageKey) || 0)
        : 0;

    if (
      typeof window !== "undefined" &&
      Date.now() - viewedAt < 5000
    ) {
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        storageKey,
        String(Date.now())
      );
    }

    void incrementListingView(listing.id);
  }, [listing?.id]);

  const gallery = useMemo(() => {
    if (!listing) return [];

    const seen = new Set<string>();
    return [
      listing.image_url,
      ...(listing.image_urls ?? [])
    ]
      .filter(Boolean)
      .filter((url) => {
        const normalized = String(url).split("?")[0].trim();
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      }) as string[];
  }, [listing]);

  useEffect(() => {
    if (gallery.length) {
      setActiveImage(gallery[0]);
    }
  }, [gallery]);

  const activeImageIndex =
    activeImage ? gallery.indexOf(activeImage) : -1;
  const activeImageNumber =
    activeImageIndex >= 0 ? activeImageIndex + 1 : 1;

  const switchGalleryImage = (direction: 1 | -1) => {
    if (gallery.length < 2) return;

    const currentIndex =
      activeImageIndex >= 0 ? activeImageIndex : 0;
    const nextIndex =
      (currentIndex + direction + gallery.length) % gallery.length;
    const nextImage = gallery[nextIndex];

    setActiveImage(nextImage);

    if (previewImage) {
      setPreviewImage(nextImage);
    }
  };

  const startImageSwipe = (event: TouchEvent) => {
    swipeStartXRef.current =
      event.touches[0]?.clientX ?? null;
  };

  const finishImageSwipe = (event: TouchEvent) => {
    const startX = swipeStartXRef.current;

    if (startX === null) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const distance = endX - startX;

    swipeStartXRef.current = null;

    if (Math.abs(distance) < 38) return;

    swipeMovedRef.current = true;
    switchGalleryImage(distance < 0 ? 1 : -1);
  };

  useEffect(() => {
    if (!listing) return;

    const localSavedIds = readSavedListingIds();
    setSavedListingIds(localSavedIds);
    setSaved(localSavedIds.includes(listing.id));
    getSavedListingIds()
      .then(({ data }) => {
        if (data.length > 0) {
          localStorage.setItem("savedListings", JSON.stringify(data));
          setSavedListingIds(data);
          setSaved(data.includes(listing.id));
        }
      })
      .catch(() => undefined);
  }, [listing]);

  useEffect(() => {
    function syncSavedState() {
      if (!listing) return;
      const localSavedIds = readSavedListingIds();
      setSavedListingIds(localSavedIds);
      setSaved(localSavedIds.includes(listing.id));
    }

    window.addEventListener("focus", syncSavedState);
    window.addEventListener("storage", syncSavedState);

    return () => {
      window.removeEventListener("focus", syncSavedState);
      window.removeEventListener("storage", syncSavedState);
    };
  }, [listing]);

  function toggleSave() {
    if (!listing) return;

    const savedListings = readSavedListingIds();
    const isCurrentlySaved =
      saved || savedListings.includes(listing.id);

    const updated = isCurrentlySaved
      ? savedListings.filter((id) => id !== listing.id)
      : [...savedListings, listing.id];

    localStorage.setItem(
      "savedListings",
      JSON.stringify(updated)
    );

    setSaved(updated.includes(listing.id));
    setSavedListingIds(updated);

    void (
      isCurrentlySaved
        ? unsaveListing(listing.id)
        : saveListing(listing.id)
    );
  }

  function toggleSimilarSave(
    event: MouseEvent<HTMLButtonElement>,
    listingId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    const savedListings = readSavedListingIds();
    const isCurrentlySaved = savedListings.includes(listingId);
    const updated = isCurrentlySaved
      ? savedListings.filter((id) => id !== listingId)
      : [...savedListings, listingId];

    localStorage.setItem("savedListings", JSON.stringify(updated));
    setSavedListingIds(updated);

    if (listing?.id === listingId) {
      setSaved(updated.includes(listingId));
    }

    void (
      isCurrentlySaved
        ? unsaveListing(listingId)
        : saveListing(listingId)
    );
  }

  function openSimilarListing(item: Pick<Listing, "id" | "listing_number">) {
    router.push(listingPath(item, locale));
  }

  async function shareListing() {
    if (!listing) return;

    const shareUrlId =
      listingNumberUrlId(listing.listing_number) ||
      listingNumberUrlId(listingDisplayNumber) ||
      listingUrlId(listing);
    const url = absoluteSiteUrl(listingSharePath(shareUrlId, activeLocale));

    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert(ui.linkCopied);
    }
  }

  async function handleShowPhone() {
    if (!listing) return;

    if (listing.seller_phone) {
      setSellerPhone(listing.seller_phone);
      setShowPhone(true);
      return;
    }

    if (!supabase || !listing.seller_id) {
      setSellerPhone("");
      setShowPhone(true);
      return;
    }

    setPhoneLoading(true);

    const { data } =
      await supabase
        .from("profiles")
        .select("phone")
        .eq("id", listing.seller_id)
        .maybeSingle<{ phone?: string | null }>();

    const nextPhone =
      data?.phone || "";

    setSellerPhone(nextPhone);
    setListing({
      ...listing,
      seller_phone:
        nextPhone || null
    });
    setShowPhone(true);
    setPhoneLoading(false);
  }

  function handlePhoneNumberClick(event: MouseEvent<HTMLAnchorElement>) {
    if (window.matchMedia("(max-width: 760px)").matches) {
      event.preventDefault();
      setPhoneActionsOpen((open) => !open);
    }
  }

  async function handleSendMessage() {
    if (!listing || messageLoading) {
      return;
    }

    if (!supabase) {
      router.push(pagePath("messages", locale));
      return;
    }

    setMessageLoading(true);

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(pagePath("auth", locale));
        return;
      }

      const sellerId =
        listing.seller_id || listing.user_id || "";

      if (!sellerId) {
        router.push(pagePath("messages", locale));
        return;
      }

      const { data: conversation } =
        await getOrCreateConversationForListing({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: sellerId
        });

      if (conversation?.id) {
        restoreConversationVisibility(
          user.id,
          conversation.id
        );
        setMessagesNavigationPending(true);
        router.push(
          `${pagePath("messages", locale)}?conversation=${encodeURIComponent(conversation.id)}`
        );
        return;
      }

      setMessagesNavigationPending(true);
      router.push(pagePath("messages", locale));
    } finally {
      if (!messagesNavigationPendingRef.current) {
        setMessageLoading(false);
      }
    }
  }

  function addCommerceItem(goToCart = false) {
    if (!commerceProduct) return;
    const result = addCartProduct(
      commerceProduct.id,
      commerceProduct.company_id,
      1
    );
    if (!result.ok) {
      setCommerceMessage(result.error);
      return;
    }
    setCommerceMessage("Tuote lisättiin ostoskoriin.");
    if (goToCart) router.push("/ostoskori");
  }

  if (loading) {
    return null;
  }

  if (!listing) {
    return null;
  }

  const commerceProductPending =
    commerceProductLoading || commerceProductListingId !== listing.id;
  const resolvedCommerceProduct = commerceProductPending ? null : commerceProduct;
  const commerceSalePrice = resolvedCommerceProduct ? activeSalePrice(resolvedCommerceProduct) : null;
  const commerceDiscountPercent = resolvedCommerceProduct ? activeSaleDiscountPercent(resolvedCommerceProduct) : 0;
  const listingSourceCurrency = isSupportedCurrency(listing.translations?._meta?.listing_currency)
    ? listing.translations?._meta?.listing_currency
    : "EUR";
  const listingOriginalPrice = Number(listing.translations?._meta?.listing_original_price);
  const formattedListingPrice = listingSourceCurrency === currency && Number.isFinite(listingOriginalPrice) && listingOriginalPrice > 0
    ? formatAmount(listingOriginalPrice, currency)
    : formatFromEur(listing.price);
  const formattedCurrentPrice = commerceSalePrice !== null
    ? formatFromEur(commerceSalePrice / 100)
    : formattedListingPrice;

  const sellerProfileId =
    listing.seller_id || listing.user_id;
  const isCompanySeller =
    Boolean(listing.company_name);
  const sellerDisplayName =
    listing.company_name || listing.seller_name || ui.fallbackSeller;
  const sellerHref =
    sellerProfileId
      ? profilePath(sellerProfileId, sellerDisplayName, locale)
      : "#";
  const companySellerNames =
    isCompanySeller &&
    listing.seller_name &&
    listing.seller_name !== listing.company_name
      ? listing.seller_name
      : "";
  const sellerInitial =
    (sellerDisplayName || "M").trim().slice(0, 1).toUpperCase();
  const vehicleTypeMap: Record<Locale, Record<string, string>> = {
    fi: {},
    en: { Moottorikelkka: "Snowmobile", "M\u00f6nkij\u00e4": "ATV", Motocross: "Motocross", Mopot: "Moped" },
    sv: { Moottorikelkka: "Sn\u00f6skoter", "M\u00f6nkij\u00e4": "ATV", Motocross: "Motocross", Mopot: "Moped" },
    no: { Moottorikelkka: "Sn\u00f8scooter", "M\u00f6nkij\u00e4": "ATV", Motocross: "Motocross", Mopot: "Moped" },
  };
  const baseListingText = getLocalizedListingText(listing, locale);
  const vehicleFacts = vehicleFactText[locale];
  const listingIsVehicle = isVehicleListing(listing);
  const listingTaxLabels = [
    listing.translations?._meta?.vat_deductible ? "ALV-vähennyskelpoinen" : "",
    listing.translations?._meta?.tax_free ? "Tax free" : ""
  ].filter(Boolean);
  const listingIsRidingGear = normalizeComparable(listing.category) === "ajovarusteet";
  const listingPartNumber = getListingPartNumber(listing);
  const listingIsTrackMat = [
    listing.category,
    listing.subcategory,
    listing.title
  ].some((value) => (value ?? "").trim().toLowerCase().includes("telamat"));
  const parsedPartModelDetails = (() => {
    const raw = listing.part_model?.trim() ?? "";
    if (!raw) return { partModel: "", trackMatDimensions: "", ridingGearSize: "", ridingGearTarget: "" };

    let partModel = "";
    let trackMatDimensions = "";
    let ridingGearSize = "";
    let ridingGearTarget = "";

    for (const line of raw.split(/\r?\n|\s*·\s*/)) {
      const cleanLine = line.trim();
      const separatorIndex = cleanLine.indexOf(":");
      const label = separatorIndex >= 0 ? cleanLine.slice(0, separatorIndex).trim().toLowerCase() : "";
      const value = separatorIndex >= 0 ? cleanLine.slice(separatorIndex + 1).trim() : cleanLine;

      if (label === "osan tarkka malli" || label === "osan malli") {
        partModel = value;
      } else if (label === "telamaton mitat" || label === "telamaton tiedot") {
        trackMatDimensions = value;
      } else if (label === "koko") {
        ridingGearSize = value;
      } else if (label === "kohderyhmä") {
        ridingGearTarget = value;
      } else if (!partModel && !listingIsTrackMat) {
        partModel = cleanLine;
      } else if (!trackMatDimensions && listingIsTrackMat) {
        trackMatDimensions = cleanLine;
      }
    }

    return { partModel, trackMatDimensions, ridingGearSize, ridingGearTarget };
  })();
  const translateConditionLabel = (value: string | null | undefined) =>
    value ? conditionLabels[locale][value] ?? value : ui.notSpecified;
  const translateVehicleTypeLabel = (value: string | null | undefined) =>
    value ? vehicleTypeMap[locale]?.[value] ?? value : ui.notSpecified;
  const ridingGearTargetMap: Record<Locale, Record<string, string>> = {
    fi: {},
    en: { Aikuisten: "Adults", Lasten: "Children", Naisten: "Women", Miesten: "Men", Unisex: "Unisex" },
    sv: { Aikuisten: "Vuxna", Lasten: "Barn", Naisten: "Dam", Miesten: "Herr", Unisex: "Unisex" },
    no: { Aikuisten: "Voksne", Lasten: "Barn", Naisten: "Dame", Miesten: "Herre", Unisex: "Unisex" }
  };
  const listingRidingGearSize =
    parsedPartModelDetails.ridingGearSize ||
    listing.translations?._meta?.riding_gear_size?.trim() ||
    listing.model?.trim() ||
    "";
  const listingRidingGearTarget =
    parsedPartModelDetails.ridingGearTarget ||
    listing.translations?._meta?.riding_gear_target?.trim() ||
    "";
  const listingBrandModel =
    [listing.brand, listing.model]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ");
  const listingLocation = formatLocation(formatLocationWithCountry(listing.location, fallbackCountry, locale));
  const sellerMemberYear =
    sellerProfileCreatedAt
      ? new Date(sellerProfileCreatedAt).getFullYear()
      : null;
  const hasSellerReviewStats = sellerReviewCount !== null;
  const hasSellerSoldStats = sellerSoldCount !== null;
  const sellerStatsCount =
    Number(hasSellerReviewStats) + Number(hasSellerSoldStats);
  const sellerAccountTypeLabel =
    sellerAccountType === "company"
      ? sellerCompanyVerifiedAt ? extraUi.verifiedCompany : extraUi.company
      : sellerAccountType === "private"
        ? extraUi.privateSeller
        : null;
  const showSellerBusinessId = sellerAccountType !== "private";
  const listingText = (() => {
    if (locale === "fi") return baseListingText;
    const leaf = listing.subcategory?.split("/").map((p) => p.trim()).filter(Boolean).at(-1);
    const isGenerated = leaf && listing.vehicle_type &&
      listing.title.trim().toLowerCase() === `${leaf} - ${listing.vehicle_type}`.trim().toLowerCase();
    if (!isGenerated) return baseListingText;
    const tSub = translateCategory(locale, listing.subcategory ?? "");
    const tLeaf = tSub.split("/").map((p) => p.trim()).filter(Boolean).at(-1) || translateCategory(locale, leaf);
    const tVehicle = vehicleTypeMap[locale]?.[listing.vehicle_type ?? ""] ?? listing.vehicle_type ?? "";
    return { ...baseListingText, title: `${tLeaf} - ${tVehicle}`.trim() };
  })();
  const localizedPartCategory = translateCategory(
    locale,
    listing.subcategory?.trim() || listing.category?.trim() || ""
  );
  const listingPartForSale =
    localizedPartCategory
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) || listingText.title;
  const listingImageDescription = getListingImageAlt(listing, listingText.title);
  const descriptionWithoutVehicleMeta =
    (listingText.description || "")
      .replace(/^(?:Ajoneuvo:[^\n]*\n?)?(?:Merkki:[^\n]*\n?)?(?:Malli:[^\n]*\n?)?(?:Vuosimalli:[^\n]*\n?)?/i, "")
      .replace(/Ajoneuvo:\s*\S+\s+Merkki:\s*[^\s]+(?:\s+\S+)?\s+Malli:\s*[^\s]+(?:\s+\S+)*?\s+Vuosimalli:\s*\d+\s*/i, "")
      .trim();
  const listingDeliveryMethod =
    descriptionWithoutVehicleMeta.match(/(?:^|\n)Toimitustapa:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const listingVehicleSubtype =
    listing.vehicle_subtype?.trim() ||
    descriptionWithoutVehicleMeta.match(/(?:^|\n)Ajoneuvotyyppi:\s*([^\n]+)/i)?.[1]?.trim() ||
    "";
  const listingVehicleMileage = readDescriptionField(listing.description, "Ajokilometrit");
  const listingVehicleHours = readDescriptionField(listing.description, "Käyttötunnit");
  const listingVehicleRegistration = readDescriptionField(listing.description, "Rekisteritunnus");
  const listingVehicleEngineKind = readDescriptionField(listing.description, "Moottorin tyyppi");
  const listingVehicleDriveType = readDescriptionField(listing.description, "Vetotapa");
  const listingVehicleRoadLegal = readDescriptionField(listing.description, "Tieliikennekelpoisuus");
  const listingVehicleAccessories = readVehicleAccessories(listing.description);
  const listingVehicleColors = readVehicleColors(listing.description);
  const listingEngineCc = listing.engine_cc?.trim() || "";
  const formattedEngineCc = listingEngineCc
    ? /(?:cc|cm³|cm3)/i.test(listingEngineCc)
      ? listingEngineCc
      : `${listingEngineCc} cm³`
    : "";
  const combinedVehicleEngine = [formattedEngineCc, listingVehicleEngineKind]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
  const combinedVehicleEngineLabel = {
    fi: "Moottori",
    en: "Engine",
    sv: "Motor",
    no: "Motor"
  }[locale];
  const formattedVehicleMileage = listingVehicleMileage
    ? /\bkm\b/i.test(listingVehicleMileage)
      ? listingVehicleMileage
      : `${listingVehicleMileage} km`
    : "";
  const formattedVehicleHours = listingVehicleHours
    ? /\bh\b/i.test(listingVehicleHours)
      ? listingVehicleHours
      : `${listingVehicleHours} h`
    : "";
  const vehicleEquipmentTitle = ({
    fi: "Varusteet",
    en: "Equipment",
    sv: "Utrustning",
    no: "Utstyr"
  } as const)[locale];
  const listingDescription =
    removeDescriptionFields(descriptionWithoutVehicleMeta, VEHICLE_DESCRIPTION_FIELDS) || ui.noDescription;
  const sellerAvatarUrl = listing.seller_avatar_url || sellerProfileAvatarUrl;

  return (
    <main className="page listing-detail-page">
      <div className="container">

        <section className="layout" data-listing-layout>

          {/* LEFT */}

          <div className="main">

            <div className="title-row">

              <div className="title-left">
                <span className="mobile-listing-id">
                  ID <strong>{
                    listingDisplayNumber ??
                    listing.listing_number ??
                    String(params.id).match(/^id(\d+)$/i)?.[1] ??
                    "..."
                  }</strong>
                </span>
                <h1>{listingText.title}</h1>
                <dl className="desktop-listing-title-facts" aria-label={ui.basicInfo}>
                  <div>
                    <dt>{ui.brandModel}</dt>
                    <dd>{listingBrandModel || ui.notSpecified}</dd>
                  </div>
                  <div>
                    <dt>{ui.year}</dt>
                    <dd>{listing.year || ui.notSpecified}</dd>
                  </div>
                  <div>
                    <dt>{ui.category}</dt>
                    <dd>{listingPartForSale || ui.notSpecified}</dd>
                  </div>
                </dl>

              </div>

              <div className="mobile-title-actions">
                <span className="mobile-title-price">{formattedCurrentPrice}{commerceDiscountPercent > 0 ? ` · −${commerceDiscountPercent} %` : ""}</span>
                <button
                  onClick={shareListing}
                  className="icon-btn"
                  title={ui.share}
                  aria-label={ui.share}
                >
                  <Share2 size={20} />
                </button>

                {isLoggedIn && <button
                  type="button"
                  onClick={toggleSave}
                  className={`icon-btn listing-favorite-button ${
                    saved ? "icon-saved" : ""
                  }`}
                  title={saved ? ui.saved : ui.save}
                  aria-label={saved ? ui.saved : ui.save}
                  aria-pressed={saved}
                >
                  <Heart
                    size={20}
                    fill={
                      saved
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>}
              </div>

            </div>

            {/* IMAGE */}

            <div className="desktop-image-meta">
              <span>
                {ui.updated} {formatDate(listing.created_at, locale)}
              </span>
              <span className="desktop-meta-location">
                {listingLocation}
                <MapPin size={15} />
              </span>
              <strong>ID {listingDisplayNumber ?? "..."}</strong>
            </div>

            <div className="image-wrapper">

              {activeImage && (
                <button
                  type="button"
                  className="main-img-button"
                  onClick={() => {
                    if (swipeMovedRef.current) {
                      swipeMovedRef.current = false;
                      return;
                    }

                    setPreviewImage(activeImage);
                  }}
                  onTouchStart={startImageSwipe}
                  onTouchEnd={finishImageSwipe}
                  aria-label="Avaa kuva suurempana"
                >
                  <span className="listing-image-soft-bg" aria-hidden="true">
                    <OptimizedListingImage
                      src={activeImage}
                      alt=""
                      decorative
                      sizes="(max-width: 900px) 100vw, 760px"
                    />
                  </span>
                  <OptimizedListingImage
                    src={activeImage}
                    className="main-img"
                    alt={listingImageDescription}
                    priority
                    sizes="(max-width: 900px) 100vw, 760px"
                  />
                </button>
              )}

              <div className="image-badge">
                {activeImageNumber}/{gallery.length}
              </div>

              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    className="gallery-arrow gallery-arrow-left"
                    onClick={() => switchGalleryImage(-1)}
                    aria-label="Edellinen kuva"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    className="gallery-arrow gallery-arrow-right"
                    onClick={() => switchGalleryImage(1)}
                    aria-label="Seuraava kuva"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}

              {activeImage && (
                <button
                  type="button"
                  className="image-zoom-button"
                  onClick={() => setPreviewImage(activeImage)}
                  aria-label="Avaa kuva suurempana"
                >
                  <ZoomIn size={20} />
                </button>
              )}

              <div className="mobile-image-actions">
                <button
                  onClick={shareListing}
                  className="icon-btn"
                  title={ui.share}
                >
                  <Share2 size={20} />
                </button>

                {isLoggedIn && <button
                  type="button"
                  onClick={toggleSave}
                  className={`icon-btn listing-favorite-button ${
                    saved ? "icon-saved" : ""
                  }`}
                  title={saved ? ui.saved : ui.save}
                  aria-label={saved ? ui.saved : ui.save}
                  aria-pressed={saved}
                >
                  <Heart
                    size={20}
                    fill={
                      saved
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>}
              </div>

              {gallery.length > 1 && (
                <div className="mobile-image-thumbs" aria-label="Ilmoituksen kuvat">
                  {gallery.map((url, index) => (
                    <button
                      key={`${url}-mobile-${index}`}
                      type="button"
                      className={activeImage === url ? "active" : ""}
                      onClick={() => setActiveImage(url)}
                      aria-label={`Kuva ${index + 1}/${gallery.length}`}
                    >
                      <OptimizedListingImage
                        src={url}
                        alt={`${listingImageDescription}, kuva ${index + 1}`}
                        sizes="72px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {gallery.length > 0 && (
              <div className="desktop-image-thumbs" aria-label="Ilmoituksen kuvat">
                {gallery.map((url, index) => (
                  <button
                    key={`${url}-desktop-${index}`}
                    type="button"
                    className={activeImage === url ? "active" : ""}
                    onClick={() => setActiveImage(url)}
                    aria-label={`Kuva ${index + 1}/${gallery.length}`}
                  >
                    <OptimizedListingImage
                      src={url}
                      alt={`${listingImageDescription}, kuva ${index + 1}`}
                      sizes="120px"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* PRICE + ACTIONS ROW */}

            <div className="price-actions-row">

              <div className="image-actions">

                <span className={`price-stack${commerceDiscountPercent > 0 ? " listing-sale-price-stack" : ""}`}>
                  {commerceDiscountPercent > 0 && <span className="listing-sale-badge">ALE −{commerceDiscountPercent} %</span>}
                  <span className="price-display">
                    {formattedCurrentPrice}
                  </span>
                  {commerceDiscountPercent > 0 && <del className="listing-original-price">{formattedListingPrice}</del>}
                  <span className="price-subline">
                    {listingTaxLabels.join(" · ")}
                  </span>
                </span>

                <div className="listing-bottom-actions">
                  <button
                    onClick={shareListing}
                    className="icon-btn"
                    title={ui.share}
                    aria-label={ui.share}
                  >
                    <Share2 size={20} />
                  </button>

                  {isLoggedIn && <button
                    type="button"
                    onClick={toggleSave}
                    className={`icon-btn listing-favorite-button ${
                      saved ? "icon-saved" : ""
                    }`}
                    title={saved ? ui.saved : ui.save}
                    aria-label={saved ? ui.saved : ui.save}
                    aria-pressed={saved}
                  >
                    <Heart
                      size={20}
                      fill={
                        saved
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>}
                </div>

              </div>

            </div>

            {/* DETAILS */}

            {!listingIsVehicle && (
              <div className="description-card listing-facts-card">

                <button
                  type="button"
                  className="listing-section-toggle"
                  aria-expanded={additionalInfoOpen}
                  onClick={() => setAdditionalInfoOpen((open) => !open)}
                >
                  <span>{ui.description}</span>
                  {additionalInfoOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                <div className={additionalInfoOpen ? "listing-section-content" : "listing-section-content is-collapsed"}>
                  <p className={listingDescription === ui.noDescription ? "listing-description-empty" : ""}>
                    {listingDescription}
                  </p>
                </div>

              </div>
            )}

            <div className="description-card listing-extra-card">

              <button
                type="button"
                className="listing-section-toggle"
                aria-expanded={basicInfoOpen}
                onClick={() => setBasicInfoOpen((open) => !open)}
              >
                <span>{ui.basicInfo}</span>
                {basicInfoOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              <div className={basicInfoOpen ? "listing-section-content" : "listing-section-content is-collapsed"}>

              <div className={`listing-fact-grid ${listingIsVehicle ? "listing-vehicle-facts" : ""}`}>
                {listingIsVehicle ? (
                  [
                    { label: ui.vehicle, value: listing.vehicle_type ? translateVehicleTypeLabel(listing.vehicle_type) : "" },
                    { label: extraUi.vehicleSubtype, value: listingVehicleSubtype ? translateCategory(locale, listingVehicleSubtype) : "" },
                    { label: ui.brand, value: listing.brand || "" },
                    { label: ui.model, value: listing.model || "" },
                    { label: ui.year, value: listing.year ? String(listing.year) : "" },
                    { label: vehicleFacts.registration, value: listingVehicleRegistration },
                    { label: vehicleFacts.mileage, value: formattedVehicleMileage },
                    { label: vehicleFacts.operatingHours, value: formattedVehicleHours },
                    { label: combinedVehicleEngineLabel, value: combinedVehicleEngine },
                    { label: vehicleFacts.engineModel, value: listing.engine_model || "" },
                    { label: vehicleFacts.driveType, value: listingVehicleDriveType },
                    { label: vehicleFacts.roadLegal, value: listingVehicleRoadLegal },
                    { label: vehicleFacts.color, value: listingVehicleColors.join(", ") },
                    { label: "Verotus", value: listingTaxLabels.join(" · ") }
                  ]
                    .filter((item) => item.value.trim().length > 0)
                    .map((item) => (
                      <span key={item.label}><strong>{item.label}</strong>{item.value}</span>
                    ))
                ) : listingIsRidingGear ? (
                  [
                    { label: ui.gearType, value: listing.subcategory ? translateCategory(locale, listing.subcategory) : "" },
                    { label: ui.brand, value: listing.brand?.trim() || "" },
                    { label: ui.size, value: listingRidingGearSize },
                    { label: ui.targetGroup, value: listingRidingGearTarget ? ridingGearTargetMap[locale][listingRidingGearTarget] ?? listingRidingGearTarget : "" },
                    { label: ui.condition, value: translateConditionLabel(listing.condition) },
                    { label: extraUi.delivery, value: listingDeliveryMethod ? translateDeliveryMethod(locale, listingDeliveryMethod) : ui.notSpecified }
                  ]
                    .filter((item) => item.value.trim().length > 0)
                    .map((item) => (
                      <span key={item.label}><strong>{item.label}</strong>{item.value}</span>
                    ))
                ) : (
                  <>
                    <span>
                      <strong>{ui.vehicle}</strong>
                      {translateVehicleTypeLabel(listing.vehicle_type)}
                    </span>
                    <span>
                      <strong>{extraUi.vehicleSubtype}</strong>
                      {listingVehicleSubtype ? translateCategory(locale, listingVehicleSubtype) : ui.notSpecified}
                    </span>
                    {parsedPartModelDetails.partModel && (
                      <span>
                        <strong>{ui.partModel}</strong>
                        {parsedPartModelDetails.partModel}
                      </span>
                    )}
                    {parsedPartModelDetails.trackMatDimensions && (
                      <span>
                        <strong>{ui.trackMatDimensions}</strong>
                        {parsedPartModelDetails.trackMatDimensions}
                      </span>
                    )}
                    {listingPartNumber && (
                      <span>
                        <strong>{ui.partNumber}</strong>
                        {listingPartNumber}
                      </span>
                    )}
                    <span><strong>{ui.brandModel}</strong>{listingBrandModel || ui.notSpecified}</span>
                    <span><strong>{ui.year}</strong>{listing.year || ui.notSpecified}</span>
                    <span><strong>{ui.condition}</strong>{translateConditionLabel(listing.condition)}</span>
                    <span>
                      <strong>{extraUi.delivery}</strong>
                      {listingDeliveryMethod ? translateDeliveryMethod(locale, listingDeliveryMethod) : ui.notSpecified}
                    </span>
                  </>
                )}
              </div>

              {listingIsVehicle && listingVehicleAccessories.length > 0 ? (
                <section className="listing-vehicle-equipment" aria-label={vehicleEquipmentTitle}>
                  <h3>{vehicleEquipmentTitle}</h3>
                  <div>
                    {listingVehicleAccessories.map((accessory) => (
                      <span key={accessory}>{accessory}</span>
                    ))}
                  </div>
                </section>
              ) : null}

              </div>

            </div>

            {listingIsVehicle && (
              <div className="description-card listing-facts-card">

                <button
                  type="button"
                  className="listing-section-toggle"
                  aria-expanded={additionalInfoOpen}
                  onClick={() => setAdditionalInfoOpen((open) => !open)}
                >
                  <span>{ui.description}</span>
                  {additionalInfoOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                <div className={additionalInfoOpen ? "listing-section-content" : "listing-section-content is-collapsed"}>
                  <p className={listingDescription === ui.noDescription ? "listing-description-empty" : ""}>
                    {listingDescription}
                  </p>
                </div>

              </div>
            )}

          </div>

          {/* RIGHT */}

          <aside className="sidebar" data-listing-seller-sidebar>

            {/* SELLER */}

            <div className="seller-card" data-seller-panel>

              <div className="seller-card-body seller-card-panel">
                <div ref={sellerCardHeaderRef} id="listing-seller-card-header" className="seller-card-top seller-card-top-mobile-safe">
                  {sellerAccountTypeLabel ? (
                    <div className={`seller-type-corner${sellerCompanyVerifiedAt ? " is-company-verified" : ""}`}>
                      <ShieldCheck size={14} />
                      <strong>{sellerAccountTypeLabel}</strong>
                    </div>
                  ) : (
                    <div className="seller-card-label">{ui.seller}</div>
                  )}
                  <Link
                    href={sellerHref}
                    className="seller-profile-btn seller-profile-btn-top"
                    aria-label={ui.openSellerProfile(sellerDisplayName)}
                  >
                    <UserRound size={18} />
                    {ui.viewProfile}
                    <ChevronRight size={14} />
                  </Link>
                </div>

                <div className="seller-identity-row">
                  <div className="seller-avatar-detail">
                    {sellerAvatarUrl
                      ? <img src={sellerAvatarUrl} alt="" className="seller-avatar-img" referrerPolicy="no-referrer" />
                      : <span className="seller-avatar-initial">{sellerInitial}</span>}
                  </div>

                  <div className="seller-info">

                    <div className="seller-name-row">
                      <strong>{sellerDisplayName}</strong>
                      {listing.seller_phone_verified && (
                        <span className="verified-chip"><ShieldCheck size={11} /> {ui.verified}{extraUi.verifiedSellerSuffix}</span>
                      )}
                    </div>

                  </div>
                </div>

                <div className="seller-meta-rows">
                  <div className="seller-meta-row">
                    <UserRound size={14} />
                    <span>{ui.seller}:</span>
                    <strong>{companySellerNames || sellerDisplayName}</strong>
                  </div>
                  {showSellerBusinessId && (
                    <>
                      <div className="seller-meta-row">
                        <Building2 size={14} />
                        <span>{extraUi.businessId}:</span>
                        <strong>{sellerBusinessId || ui.notSpecified}</strong>
                      </div>
                    </>
                  )}
                  {listingLocation && (
                    <div className="seller-meta-row">
                      <MapPin size={14} />
                      <span>{ui.location}:</span>
                      <strong>{listingLocation}</strong>
                    </div>
                  )}
                  {sellerMemberYear && (
                    <div className="seller-meta-row">
                      <UserRound size={14} />
                      <span>{extraUi.memberSince}:</span>
                      <strong>{sellerMemberYear}</strong>
                    </div>
                  )}
                </div>
                {(hasSellerReviewStats || hasSellerSoldStats) && (
                  <div
                    className={`seller-stats-row${sellerStatsCount === 1 ? " seller-stats-row-single" : ""}`}
                    aria-label={extraUi.sellerStatsAria}
                  >
                    {hasSellerReviewStats && (
                      <div className="seller-stat seller-stat-rating">
                        <Star size={18} />
                        <span>
                          <strong>
                            {sellerReviewAverage !== null
                              ? sellerReviewAverage.toFixed(1)
                              : extraUi.noReviews}
                          </strong>
                          <small>
                            {sellerReviewCount === 1
                              ? extraUi.oneReview
                              : extraUi.reviews(sellerReviewCount)}
                          </small>
                        </span>
                      </div>
                    )}
                    {hasSellerSoldStats && (
                      <div className="seller-stat seller-stat-sales">
                        <Package size={18} />
                        <span>
                          <strong>{sellerSoldCount}</strong>
                          <small>
                            {sellerSoldCount === 1
                              ? extraUi.successfulDeal
                              : extraUi.successfulDeals}
                          </small>
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="seller-divider" />
                {!commerceProductPending && commerceProduct && (
                  <div className="seller-commerce-actions" aria-label="Tuotteen ostaminen">
                    <span className="seller-commerce-label">
                      <ShoppingCart size={17} aria-hidden="true" /> Osta turvallisesti Stripe-maksulla
                    </span>
                    <button
                      type="button"
                      className="seller-add-cart-button"
                      onClick={() => addCommerceItem(false)}
                    >
                      <ShoppingCart size={18} aria-hidden="true" /> Lisää ostoskoriin
                    </button>
                    {commerceMessage && (
                      <p className="seller-commerce-message" role="status">{commerceMessage}</p>
                    )}
                  </div>
                )}
                {!commerceProductPending && commerceProduct && (
                  <button
                    type="button"
                    className="seller-company-contact-toggle"
                    aria-expanded={companyContactOpen}
                    aria-controls="seller-company-contact-options"
                    onClick={() => setCompanyContactOpen((open) => !open)}
                  >
                    <span><MessageSquareText size={19} aria-hidden="true" /> Ota yhteyttä</span>
                    <small>Viesti, puhelin tai sähköposti</small>
                    {companyContactOpen ? <ChevronUp size={19} aria-hidden="true" /> : <ChevronDown size={19} aria-hidden="true" />}
                  </button>
                )}
                {!commerceProductPending && (!commerceProduct || companyContactOpen) && <div
                  id={commerceProduct ? "seller-company-contact-options" : undefined}
                  className={`seller-contact-merged${commerceProduct ? " seller-company-contact seller-company-contact-open" : ""}`}
                >
                  {commerceProduct && (
                    <div className="seller-company-contact-heading">
                      <strong>Ota yhteyttä yritykseen</strong>
                      <span>Kysy tuotteesta viestillä, puhelimella tai sähköpostilla.</span>
                    </div>
                  )}
                  {isLoggedIn ? (
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={messageLoading}
                      className="message-btn"
                    >
                      <Mail size={20} />
                      {ui.sendMessage}
                    </button>
                  ) : (
                    <div className="contact-login-notice" role="alert">
                      <div className="contact-login-icon" aria-hidden="true">
                        <LockKeyhole size={21} />
                      </div>
                      <div className="contact-login-copy">
                        <strong>{ui.messageLoginRequired}</strong>
                        <Link href={pagePath("auth", locale)}>
                          <span>{ui.loginNow}</span>
                          <ChevronRight size={16} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  )}
                  {commerceProduct?.company.phone?.trim() ? companyPhoneVisible ? (
                    <a
                      className="seller-company-contact-method seller-company-phone-visible"
                      href={`tel:${phoneLinkValue(commerceProduct.company.phone)}`}
                      aria-label={`${ui.callPhone} ${commerceProduct.company.phone}`}
                    >
                      <span className="seller-company-contact-icon"><PhoneCall size={19} aria-hidden="true" /></span>
                      <span><small>{ui.callPhone}</small><strong>{commerceProduct.company.phone}</strong></span>
                      <b>{ui.callPhone}</b>
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="seller-company-contact-method seller-company-phone-reveal"
                      onClick={() => setCompanyPhoneVisible(true)}
                    >
                      <span className="seller-company-contact-icon"><Phone size={19} aria-hidden="true" /></span>
                      <span><small>Puhelin</small><strong>{ui.showPhone}</strong></span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  ) : !showPhone ? (
                    <button
                      type="button"
                      className="phone-btn"
                      onClick={handleShowPhone}
                      disabled={phoneLoading}
                    >
                      <Phone size={20} />
                      {phoneLoading
                        ? ui.fetchingPhone
                        : ui.showPhone}
                    </button>
                  ) : sellerPhone || listing.seller_phone ? (
                    <div className="phone-action-wrap">
                        <a
                          href={`tel:${phoneLinkValue(sellerPhone || listing.seller_phone || "")}`}
                          className="phone-number"
                          onClick={handlePhoneNumberClick}
                          aria-expanded={phoneActionsOpen}
                        >
                          {sellerPhone ||
                            listing.seller_phone}
                        </a>
                        {phoneActionsOpen ? (
                          <div
                            className="phone-action-overlay"
                            onClick={() => setPhoneActionsOpen(false)}
                            role="presentation"
                          >
                            <div
                              className="phone-action-dialog"
                              role="dialog"
                              aria-modal="true"
                              aria-label={ui.phoneActions}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="phone-action-close"
                                aria-label="Sulje"
                                onClick={() => setPhoneActionsOpen(false)}
                              >
                                <X size={18} />
                              </button>
                              <strong className="phone-action-title">{ui.phoneActions}</strong>
                              <span className="phone-action-value">
                                {sellerPhone || listing.seller_phone}
                              </span>
                              <div className="phone-action-menu">
                                <a href={`tel:${phoneLinkValue(sellerPhone || listing.seller_phone || "")}`}>
                                  <Phone size={18} />
                                  {ui.callPhone}
                                </a>
                                <a href={`sms:${phoneLinkValue(sellerPhone || listing.seller_phone || "")}`}>
                                  <MessageSquareText size={18} />
                                  {ui.textPhone}
                                </a>
                                <a
                                  href={`https://wa.me/${whatsappPhoneValue(sellerPhone || listing.seller_phone || "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MessageCircle size={18} />
                                  {ui.whatsappPhone}
                                </a>
                              </div>
                            </div>
                          </div>
                        ) : null}
                    </div>
                  ) : (
                    <span className="phone-number">{ui.missingPhone}</span>
                  )}
                  {commerceProduct?.company.email?.trim() && (
                    <a className="seller-company-contact-method" href={`mailto:${commerceProduct.company.email}`}>
                      <Mail size={19} aria-hidden="true" />
                      <span><small>Sähköposti</small><strong>{commerceProduct.company.email}</strong></span>
                    </a>
                  )}
                </div>}
              </div>

            </div>

            {/* CONTACT */}

            <div className="contact-card" style={{ display: "none" }}>

              <h3>
                {ui.contactHeading}
              </h3>

              {isLoggedIn ? (
                <>
                  {!showPhone ? (

                    <button
                      className="phone-btn"
                      onClick={handleShowPhone}
                      disabled={phoneLoading}
                    >
                      <Phone size={20} />
                      {phoneLoading
                        ? ui.fetchingPhone
                        : ui.showPhone}
                    </button>

                  ) : (

                    <a
                      href={`tel:${
                        sellerPhone ||
                        listing.seller_phone ||
                        ""
                      }`}
                      className="phone-number"
                    >
                      {sellerPhone ||
                        listing.seller_phone ||
                        ui.missingPhone}
                    </a>

                  )}
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={messageLoading}
                    className="message-btn"
                  >
                    <Mail size={20} />
                    {ui.sendMessage}
                  </button>
                </>
              ) : (
                <Link
                  href={pagePath("auth", locale)}
                  className="login-contact"
                >
                  <LockKeyhole size={20} />
                  {ui.loginContact}
                </Link>
              )}

            </div>

          </aside>

        </section>

        {similarListings.length > 0 && (
          <section className="similar-listings-section" aria-label="Samanlaisia tuotteita myynnissä">
            <div className="similar-listings-head">
              <span>{ui.forSale}</span>
              <h2>Samanlaisia tuotteita</h2>
            </div>
            <div className={`${homeStyles.cardsGrid} similar-home-grid`} data-similar-listings-grid="true">
              {similarListings.map((item) => {
                const itemText = getLocalizedListingText(item, locale);
                const itemImageSrc = listingImageSrc(item);
                const isFavorite = savedListingIds.includes(item.id);
                const countryFlag = getCountryFlagFromLocation(item.location, fallbackCountry);
                return (
                  <article
                    key={item.id}
                    data-listing-card="true"
                    data-similar-listing-card="true"
                    className={`${homeStyles.card} similar-home-card`}
                    role="link"
                    tabIndex={0}
                    aria-label={`Avaa ilmoitus ${itemText.title}`}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('[data-listing-favorite="true"]')) return;
                      openSimilarListing(item);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openSimilarListing(item);
                      }
                    }}
                  >
                    <div className={`${homeStyles.cardImage} ${homeStyles.listingCardImage}`} data-listing-card-image="true" data-similar-listing-image="true">
                      <span className={homeStyles.cardImageBlur} aria-hidden="true">
                        <OptimizedListingImage src={itemImageSrc} alt="" decorative />
                      </span>
                      <OptimizedListingImage
                        src={itemImageSrc}
                        alt={itemText.title}
                      />
                      {isListingNew(item.created_at) && (
                        <span className={homeStyles.newBadge} aria-label="Uusi">
                          Uusi
                        </span>
                      )}
                      {isLoggedIn && <button
                        onClick={(event) => toggleSimilarSave(event, item.id)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        className={`${homeStyles.favoriteButton} ${
                          isFavorite ? homeStyles.favoriteButtonActive : ""
                        }`}
                        data-listing-favorite="true"
                        data-listing-id={item.id}
                        type="button"
                        aria-pressed={isFavorite}
                        aria-label={isFavorite ? "Poista suosikeista" : "Lisää suosikkeihin"}
                      >
                        <Heart
                          size={14}
                          fill={isFavorite ? "currentColor" : "none"}
                        />
                      </button>}
                    </div>
                    <div className={homeStyles.cardBody} data-listing-card-body="true" data-similar-listing-body="true">
                      <ListingSalePrice listing={item} className={homeStyles.cardPrice} />
                      <h3 className={homeStyles.cardTitle}>{itemText.title}</h3>
                      <ListingVehicleMeta year={item.year} brand={item.brand} model={item.model} />
                      <div className={homeStyles.cardMetaRow} data-listing-card-meta="true">
                        <span className={homeStyles.cardLocationMeta}>
                          {countryFlag ? (
                            <img
                              className={homeStyles.listingCountryFlag}
                              src={countryFlag.src}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                            />
                          ) : (
                            <MapPin size={14} />
                          )}
                          {formatLocation(formatLocationWithCountry(item.location, fallbackCountry, locale))}
                        </span>
                        <span>
                          <Clock3 size={14} />
                          {formatDate(item.created_at, locale)}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {previewImage && (
        <div
          className="listing-image-preview"
          role="dialog"
          aria-modal="true"
          aria-label="Kuvan esikatselu"
          onClick={() => setPreviewImage(null)}
        >
          <div className="listing-image-preview-backdrop" aria-hidden="true" />
          <button
            type="button"
            className="listing-image-preview-close"
            onClick={() => setPreviewImage(null)}
            aria-label="Sulje kuvan esikatselu"
          >
            <X size={26} strokeWidth={2.5} />
          </button>
          <div
            className="listing-image-preview-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <OptimizedListingImage
              src={previewImage}
              alt={listingImageDescription}
              priority
              sizes="96vw"
              onTouchStart={startImageSwipe}
              onTouchEnd={finishImageSwipe}
            />
            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  className="listing-image-preview-arrow listing-image-preview-arrow-left"
                  onClick={() => switchGalleryImage(-1)}
                  aria-label="Edellinen kuva"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  className="listing-image-preview-arrow listing-image-preview-arrow-right"
                  onClick={() => switchGalleryImage(1)}
                  aria-label="Seuraava kuva"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`

        .page {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 900px 500px at 10% 0%, rgba(14, 165, 233, 0.18), transparent 60%),
            radial-gradient(ellipse 700px 400px at 90% 5%, rgba(34, 211, 238, 0.13), transparent 58%),
            radial-gradient(ellipse 600px 600px at 50% 80%, rgba(3, 105, 161, 0.12), transparent 65%),
            linear-gradient(160deg, #0b1a2f 0%, #0d2240 40%, #071526 100%);
        }

        .container {
          max-width: 1560px;
          margin: 0 auto;
          padding: 28px clamp(18px, 3vw, 36px) 58px;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(310px, 360px);
          gap: 28px;
          align-items: start;
        }

        .main {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(100, 116, 139, 0.14);
          border-radius: 28px;
          padding: 32px;
          box-shadow:
            0 28px 90px rgba(0, 8, 24, 0.42),
            0 0 0 1px rgba(14, 165, 233, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 26px;
        }

        .listing-kicker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 18px 0 0;
        }

        .listing-kicker span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(100, 116, 139, 0.1);
          border: 1px solid rgba(100, 116, 139, 0.18);
          color: #374151;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .title-left {
          flex: 1;
          min-width: 0;
        }

        .title-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
          flex-shrink: 0;
        }

        .title-actions {
          display: flex;
          gap: 8px;
        }

        .icon-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        }

        .icon-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
        }

        .icon-btn.icon-saved {
          background: rgba(255, 122, 26, 0.12);
          border-color: rgba(255, 122, 26, 0.38);
          color: #e85a00;
        }

        .title-row h1 {
          font-size: clamp(1.5rem, 2.5vw, 2rem);
          line-height: 1.3;
          margin: 0;
          font-weight: 800;
          max-width: 100%;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .desktop-listing-title-facts {
          display: none;
        }

        @media (min-width: 761px) {
          .title-left {
            flex: 1 1 100%;
            padding-right: 0;
            width: 100%;
          }

          .desktop-listing-title-facts {
            align-items: center;
            border-bottom: 1px solid var(--line, rgba(100, 116, 139, 0.24));
            display: flex;
            flex-wrap: wrap;
            gap: 0;
            margin: 14px 0 0;
            padding: 0 0 14px;
            width: 100%;
          }

          .desktop-listing-title-facts > div {
            align-items: center;
            background: transparent;
            border: 0;
            border-radius: 0;
            display: inline-flex;
            min-width: 0;
            padding: 0;
          }

          .desktop-listing-title-facts > div + div::before {
            color: var(--muted, #64748b);
            content: "•";
            font-size: 12px;
            margin: 0 12px;
          }

          .desktop-listing-title-facts dt {
            clip: rect(0 0 0 0);
            clip-path: inset(50%);
            height: 1px;
            overflow: hidden;
            position: absolute;
            white-space: nowrap;
            width: 1px;
          }

          .desktop-listing-title-facts dd {
            color: var(--text, #0f172a);
            font-size: 14px;
            font-weight: 850;
            line-height: 1.4;
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }

        .sub-info {
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(11, 26, 58, 0.7);
          font-size: 15px;
          font-weight: 750;
          flex-wrap: wrap;
        }

        .location {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .dot {
          font-size: 18px;
        }

        .listing-id {
          color: rgba(11, 26, 58, 0.6);
          font-size: 15px;
          font-weight: 750;
        }

        .mobile-listing-id {
          display: none;
        }

        .mobile-listing-id strong,
        .mobile-image-actions {
          display: none;
        }

        .image-wrapper {
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid rgba(100, 116, 139, 0.14);
          box-shadow: 0 22px 70px rgba(5, 24, 46, 0.12);
          position: relative;
          background: #e2e8f0;
        }

        .desktop-image-meta {
          align-items: center;
          color: rgba(11, 26, 58, 0.72);
          display: flex;
          font-size: 15px;
          font-weight: 750;
          gap: 10px;
          margin: 0 4px 10px;
        }

        .desktop-image-meta strong {
          color: #071827;
          font-size: 16px;
          font-weight: 950;
          margin-left: auto;
          white-space: nowrap;
        }

        .desktop-meta-location {
          align-items: center;
          display: inline-flex;
          gap: 5px;
        }

        .image-wrapper::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 -90px 80px rgba(6, 26, 46, 0.18);
        }

        .main-img-button {
          background: transparent;
          border: 0;
          cursor: zoom-in;
          display: block;
          margin: 0;
          padding: 0;
          width: 100%;
        }

        .main-img-button:focus-visible {
          outline: 3px solid rgba(255, 154, 36, 0.82);
          outline-offset: -6px;
        }

        .image-badge {
          position: absolute;
          left: 16px;
          bottom: 16px;
          z-index: 2;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(100, 116, 139, 0.22);
          color: #374151;
          font-size: 13px;
          font-weight: 950;
          backdrop-filter: blur(10px);
        }

        .image-zoom-button {
          align-items: center;
          background: rgba(5, 18, 32, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: 999px;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          height: 40px;
          justify-content: center;
          position: absolute;
          right: 14px;
          top: 14px;
          width: 40px;
          z-index: 3;
        }

        .price-actions-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 16px;
        }

        .commerce-buy-panel {
          display: grid;
          gap: 18px;
          margin-top: 18px;
          padding: 22px;
          border: 1px solid rgba(234, 88, 12, 0.28);
          border-radius: 22px;
          background: linear-gradient(145deg, #fff8ee 0%, #ffffff 62%);
          box-shadow: 0 18px 45px rgba(124, 45, 18, 0.09);
          color: #172033;
        }

        .commerce-buy-head {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
        }

        .commerce-buy-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border-radius: 15px;
          background: linear-gradient(135deg, #ff9d2e, #f25d0b);
          color: white;
        }

        .commerce-buy-eyebrow {
          color: #c2410c;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .commerce-buy-head h2 { margin: 3px 0 4px; color: #111827; font-size: 20px; }
        .commerce-buy-head p { margin: 0; color: #64748b; font-size: 13px; line-height: 1.45; }
        .commerce-buy-price { color: #c2410c; font-size: 25px; white-space: nowrap; }

        .commerce-buy-facts {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
        }

        .commerce-buy-facts span {
          display: grid;
          gap: 4px;
          padding: 11px 12px;
          border: 1px solid rgba(148, 163, 184, .22);
          border-radius: 12px;
          background: #fff;
          color: #334155;
          font-size: 13px;
        }

        .commerce-buy-facts strong { color: #0f172a; font-size: 11px; text-transform: uppercase; }
        .commerce-delivery-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .commerce-delivery-details > div { padding: 14px; border-radius: 13px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .commerce-delivery-details strong { color: #0f172a; font-size: 13px; }
        .commerce-delivery-details p { margin: 5px 0 0; color: #475569; font-size: 13px; line-height: 1.45; }
        .commerce-delivery-details small { display: block; margin-top: 5px; color: #64748b; line-height: 1.45; }
        .commerce-delivery-details .commerce-pickup-only { border-color: rgba(234, 88, 12, .22); background: #fff7ed; }

        .commerce-buy-actions { display: grid; grid-template-columns: 96px minmax(150px, 1fr) minmax(130px, .8fr) auto; gap: 9px; align-items: end; }
        .commerce-buy-actions label { display: grid; gap: 5px; color: #475569; font-size: 11px; font-weight: 900; }
        .commerce-buy-actions input { width: 100%; height: 45px; padding: 0 11px; border: 1px solid #cbd5e1; border-radius: 11px; background: #fff; color: #0f172a; font: inherit; }
        .commerce-buy-actions button, .commerce-open-cart { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 45px; padding: 0 14px; border-radius: 11px; font-size: 13px; font-weight: 950; cursor: pointer; text-decoration: none; }
        .commerce-cart-button { border: 0; background: linear-gradient(135deg, #ff8a24, #ee5e0b); color: white; }
        .commerce-buy-now-button { border: 1px solid #0f172a; background: #0f172a; color: white; }
        .commerce-open-cart { border: 1px solid #cbd5e1; background: #fff; color: #0f172a; }
        .commerce-buy-message { margin: -6px 0 0; padding: 10px 12px; border-radius: 10px; background: #ecfdf5; color: #047857; font-size: 13px; font-weight: 850; }

        @media (max-width: 720px) {
          .commerce-buy-panel { padding: 18px; border-radius: 18px; }
          .commerce-buy-head { grid-template-columns: auto minmax(0, 1fr); align-items: start; }
          .commerce-buy-price { grid-column: 2; font-size: 23px; }
          .commerce-buy-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .commerce-delivery-details { grid-template-columns: 1fr; }
          .commerce-buy-actions { grid-template-columns: 88px minmax(0, 1fr); }
          .commerce-buy-now-button, .commerce-open-cart { grid-column: 1 / -1; }
        }

        .image-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .main-img {
          width: 100%;
          height: clamp(360px, 48vw, 560px);
          object-fit: cover;
          display: block;
        }

        .listing-image-preview {
          align-items: center;
          display: flex;
          inset: var(--topbar-h, 64px) 0 0;
          justify-content: center;
          padding: 22px;
          position: fixed;
          z-index: 9999;
        }

        .listing-image-preview-backdrop {
          background: rgba(0, 8, 20, 0.82);
          border: 0;
          cursor: zoom-out;
          inset: 0;
          position: absolute;
        }

        .listing-image-preview-panel {
          background: rgba(5, 20, 38, 0.96);
          border: 1px solid rgba(151, 178, 205, 0.28);
          border-radius: 12px;
          box-shadow: 0 28px 86px rgba(0, 8, 20, 0.62);
          max-height: min(calc(100dvh - var(--topbar-h, 64px) - 44px), 820px);
          max-width: min(94vw, 1120px);
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        .listing-image-preview-panel img {
          display: block;
          max-height: min(calc(100dvh - var(--topbar-h, 64px) - 44px), 820px);
          max-width: min(94vw, 1120px);
          object-fit: contain;
          width: 100%;
        }

        .listing-image-preview-close {
          align-items: center;
          background: rgba(4, 18, 34, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.42);
          border-radius: 999px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.38);
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          height: 48px;
          justify-content: center;
          position: absolute;
          right: max(16px, env(safe-area-inset-right));
          top: max(16px, env(safe-area-inset-top));
          width: 48px;
          z-index: 3;
        }

        .listing-image-preview-close:hover {
          background: rgba(12, 35, 58, 0.98);
          color: #ffb45f;
        }

        .listing-image-preview-close:focus-visible {
          outline: 3px solid #ff8a1c;
          outline-offset: 3px;
        }

        .thumbs {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-top: 20px;
        }

        .thumbs img {
          width: 100%;
          height: 80px;
          border-radius: 14px;
          object-fit: cover;
          cursor: pointer;
          border: 3px solid transparent;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
        }

        .thumbs img:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15);
        }

        .thumbs img.active {
          border-color: #64748b;
          box-shadow: 0 10px 28px rgba(100, 116, 139, 0.22);
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .price-display {
          font-size: 1.6rem;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1;
          padding: 0 6px 0 0;
        }

        .action-btn {
          height: 52px;
          padding: 0 24px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.9));
          display: flex;
          align-items: center;
          gap: 12px;
          color: #0f172a;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
        }

        .action-btn:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.95));
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.15);
        }

        .action-btn.saved {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15));
          border-color: rgba(16, 185, 129, 0.3);
          color: #059669;
        }

        .description-card {
          margin-top: 32px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(100, 116, 139, 0.12);
          border-radius: 24px;
          padding: 36px;
          box-shadow: 0 20px 70px rgba(5, 24, 46, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .listing-section-toggle {
          align-items: center;
          background: transparent;
          border: 0;
          color: #0f172a;
          cursor: pointer;
          display: flex;
          font: inherit;
          font-size: 1.5rem;
          font-weight: 800;
          justify-content: space-between;
          letter-spacing: 0;
          margin: 0;
          padding: 0;
          text-align: left;
          width: 100%;
        }

        .listing-section-toggle svg {
          flex: 0 0 auto;
        }

        .listing-section-content.is-collapsed {
          display: none;
        }

        .description-card p {
          color: rgba(15, 23, 42, 0.75);
          line-height: 1.7;
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 0;
          white-space: pre-line;
        }

        .listing-fact-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 26px;
        }

        .listing-fact-grid span {
          display: grid;
          gap: 6px;
          border-radius: 16px;
          padding: 14px;
          background: rgba(218, 249, 255, 0.46);
          border: 1px solid rgba(8, 121, 149, 0.12);
          color: #547083;
          font-weight: 800;
        }

        .listing-fact-grid strong {
          color: #087995;
          font-size: 12px;
          text-transform: uppercase;
        }

        .sidebar {
          position: sticky;
          top: 20px;
        }

        .seller-card,
        .contact-card {
          background:
            radial-gradient(360px 140px at 100% 0%, rgba(201, 247, 255, 0.28), transparent 70%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 253, 255, 0.94));
          border: 1px solid rgba(8, 121, 149, 0.14);
          border-radius: 24px;
          padding: 28px;
          margin-bottom: 24px;
          box-shadow: 0 24px 80px rgba(5, 24, 46, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .seller-card {
          overflow: hidden;
          padding: 0;
          background:
            radial-gradient(380px 180px at 100% 0%, rgba(73, 199, 216, 0.36), transparent 66%),
            linear-gradient(145deg, #061827 0%, #0b3550 54%, #087995 100%);
          border-color: rgba(201, 247, 255, 0.24);
          color: #ffffff;
        }

        .seller-card h2,
        .contact-card h3 {
          margin: 0 0 20px;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .seller-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 18px 0;
        }

        .seller-card-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(201, 247, 255, 0.72);
          margin: 0;
        }

        .seller-card-body {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 14px 14px 12px;
          min-height: 86px;
          padding: 13px 14px;
          position: relative;
        }

        .seller-card-link {
          border: 1px solid rgba(201, 247, 255, 0.16);
          border-radius: 18px;
          background: transparent;
          color: inherit;
          text-decoration: none;
          transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
        }

        .seller-card-link:hover {
          background: rgba(201, 247, 255, 0.08);
          border-color: rgba(201, 247, 255, 0.34);
          transform: translateY(-1px);
        }

        .seller-avatar-detail {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(145deg, #d9fbff 0%, #6ed2e4 45%, #0a4462 100%);
          border: 2px solid rgba(8, 121, 149, 0.22);
          box-shadow:
            0 0 0 2px #ffffff,
            0 6px 18px rgba(8, 121, 149, 0.18);
          color: #061a2e;
          font-size: 1.4rem;
          font-weight: 950;
          flex: none;
        }

        .seller-info {
          flex: 1;
          min-width: 0;
        }

        .seller-name-row {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .seller-name-row strong {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .verified-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10.5px;
          font-weight: 700;
          color: #087995;
          background: rgba(8, 121, 149, 0.08);
          border: 1px solid rgba(8, 121, 149, 0.18);
          border-radius: 99px;
          padding: 2px 7px;
          white-space: nowrap;
        }

        .seller-card .verified-chip {
          color: #dffaff;
          background: rgba(201, 247, 255, 0.12);
          border-color: rgba(201, 247, 255, 0.26);
        }
        .seller-meta-rows {
          display: grid;
          gap: 10px;
          margin-top: 12px;
          color: rgba(228, 237, 249, 0.9);
        }
        .seller-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 650;
        }
        .seller-meta-row strong {
          color: #ffffff;
          font-weight: 800;
        }
        .seller-contact-merged {
          display: grid;
          gap: 12px;
          margin-top: 14px;
        }

        .seller-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: transparent;
          padding: 0;
          display: block;
          border-radius: 50%;
        }

        .seller-profile-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 32px;
          padding: 0 10px 0 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(218, 249, 255, 0.9));
          border: 1px solid rgba(201, 247, 255, 0.42);
          color: #06445f;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
          box-shadow:
            0 10px 24px rgba(0, 10, 24, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.72);
        }

        .seller-profile-btn:hover {
          background: #ffffff;
          border-color: rgba(201, 247, 255, 0.48);
          transform: translateY(-1px);
        }

        .seller-employee-name {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          color: rgba(223, 250, 255, 0.78);
          font-size: 12px;
          font-weight: 850;
          min-width: 0;
        }

        .seller-employee-name strong {
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .seller-location {
          margin-top: 5px;
          color: rgba(223, 250, 255, 0.72);
          font-size: 14px;
          font-weight: 750;
        }

        .seller-card-arrow {
          color: rgba(223, 250, 255, 0.76);
          flex: none;
        }

        .message-btn,
        .phone-btn,
        .phone-number,
        .login-contact {
          width: 100%;
          height: 66px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 850;
          text-decoration: none;
          margin-top: 16px;
          transition: all 0.2s ease;
        }

        .message-btn,
        .phone-btn,
        .login-contact {
          background: linear-gradient(135deg, #071827 0%, #0b5d82 48%, #49c7d8 100%);
          color: white;
          border: 1px solid rgba(201, 247, 255, 0.36);
          cursor: pointer;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        }

        .message-btn:hover,
        .phone-btn:hover,
        .login-contact:hover {
          transform: translateY(-1px);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.22);
        }

        .phone-number {
          background: linear-gradient(135deg, #087995 0%, #49c7d8 100%);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        }

        @media (max-width: 1280px) {

          .layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: static;
          }

          .title-row {
            flex-direction: column;
          }

          .title-row h1 {
            font-size: 2.7rem;
          }

          .main-img {
            height: 420px;
          }

        }

        @media (max-width: 640px) {

          .container {
            padding: 12px;
          }

          .main {
            padding: 18px;
          }

          .listing-fact-grid {
            grid-template-columns: 1fr;
          }

          .title-row h1 {
            font-size: 2rem;
          }

          .main-img {
            height: 260px;
          }

          .thumbs img {
            width: 90px;
            height: 70px;
          }

          .price-actions-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .action-buttons {
            width: 100%;
            justify-content: space-between;
          }

          .action-btn {
            flex: 1;
            justify-content: center;
          }

        }

        /* Final listing detail skin: match main page, keep portrait photos fully visible. */
        .page {
          background:
            radial-gradient(760px 320px at 88% -8%, rgba(255, 122, 26, 0.12), transparent 62%),
            radial-gradient(680px 300px at 8% 0%, rgba(64, 216, 255, 0.08), transparent 68%),
            #0b1118;
          color: #f4f8fc;
        }

        .container {
          width: min(1320px, calc(100vw - 32px));
          max-width: none;
          padding: clamp(18px, 3vw, 34px) 0 88px;
        }

        .layout {
          grid-template-columns: minmax(0, 1fr) minmax(280px, 330px);
          gap: 18px;
        }

        .main {
          background:
            radial-gradient(680px 260px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98));
          border: 1px solid rgba(151, 178, 205, 0.2);
          border-radius: 20px;
          box-shadow: 0 24px 70px rgba(0, 7, 18, 0.34), inset 0 1px 0 rgba(255,255,255,0.05);
          padding: clamp(18px, 3vw, 28px);
        }

        .title-row {
          margin-bottom: 18px;
        }

        .title-row h1 {
          color: #ffffff;
          font-size: clamp(1.55rem, 2.4vw, 2.15rem);
          font-weight: 950;
          line-height: 1.12;
        }

        .sub-info,
        .desktop-image-meta,
        .listing-id {
          color: rgba(226, 244, 255, 0.68);
          font-size: 13px;
        }

        .desktop-image-meta strong {
          color: #ffb45f;
        }

        .listing-kicker span {
          background: rgba(255, 122, 26, 0.12);
          border-color: rgba(255, 122, 26, 0.3);
          color: #ffd1a3;
        }

        .image-wrapper {
          background: #06111f;
          border: 1px solid rgba(151, 178, 205, 0.2);
          border-radius: 18px;
          box-shadow: 0 18px 54px rgba(0, 7, 18, 0.28);
        }

        .main-img-button {
          position: relative;
          min-height: clamp(360px, 52vw, 620px);
          overflow: hidden;
          background: #06111f;
        }

        .listing-image-soft-bg {
          position: absolute;
          inset: 0;
          display: block;
          overflow: hidden;
          pointer-events: none;
        }

        .listing-image-soft-bg img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          filter: blur(22px) saturate(0.85) brightness(0.56);
          transform: scale(1.08);
          opacity: 0.8;
        }

        .listing-image-soft-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(3, 12, 24, 0.28);
        }

        .main-img {
          position: relative;
          z-index: 1;
          width: 100%;
          height: clamp(360px, 52vw, 620px);
          object-fit: contain;
          object-position: center center;
          background: transparent;
        }

        .image-wrapper::after {
          z-index: 2;
          box-shadow: inset 0 -90px 80px rgba(0, 7, 18, 0.22);
        }

        .image-badge,
        .gallery-arrow,
        .image-zoom-button {
          z-index: 4;
        }

        .image-badge {
          background: rgba(3, 12, 24, 0.72);
          border-color: rgba(151, 178, 205, 0.24);
          color: #ffffff;
        }

        .price-actions-row {
          align-items: center;
          margin-top: 16px;
        }

        .price-display {
          color: #ffffff;
          font-size: clamp(1.8rem, 3vw, 2.35rem);
          font-weight: 950;
        }

        .icon-btn {
          background: rgba(12, 28, 46, 0.86);
          border-color: rgba(151, 178, 205, 0.22);
          color: #f4f8fc;
          box-shadow: none;
        }

        .icon-btn.icon-saved {
          background: rgba(255, 122, 26, 0.16);
          border-color: rgba(255, 122, 26, 0.48);
          color: #ffb45f;
        }

        .thumbs {
          display: flex;
          gap: 10px;
          margin-top: 14px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .thumbs img,
        .mobile-image-thumbs img {
          width: 82px;
          height: 64px;
          flex: 0 0 auto;
          border: 2px solid rgba(151, 178, 205, 0.2);
          border-radius: 12px;
          background: #06111f;
          object-fit: contain;
          padding: 2px;
        }

        .thumbs img.active,
        .mobile-image-thumbs button.active img {
          border-color: rgba(255, 122, 26, 0.72);
          box-shadow: 0 0 0 2px rgba(255, 122, 26, 0.16);
        }

        .description-card,
        .listing-facts-card,
        .listing-extra-card,
        .contact-card,
        .seller-card {
          background:
            radial-gradient(520px 220px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98));
          border: 1px solid rgba(151, 178, 205, 0.2);
          border-radius: 18px;
          box-shadow: 0 18px 46px rgba(0, 7, 18, 0.28), inset 0 1px 0 rgba(255,255,255,0.04);
          color: #f4f8fc;
        }

        .description-card {
          margin-top: 18px;
          padding: 0;
          overflow: hidden;
        }

        .listing-section-toggle {
          min-height: 58px;
          padding: 0 18px;
          background: rgba(3, 12, 24, 0.22);
          border: 0;
          color: #ffffff;
          font-size: 1rem;
          font-weight: 950;
        }

        .listing-section-content {
          padding: 16px 18px 18px;
        }

        .description-card p {
          color: rgba(226, 244, 255, 0.74);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.65;
          margin: 0;
        }

        .listing-fact-grid {
          gap: 10px;
          margin: 0;
        }

        .listing-fact-grid span {
          min-height: 74px;
          background: rgba(3, 12, 24, 0.38);
          border: 1px solid rgba(151, 178, 205, 0.16);
          border-radius: 14px;
          color: rgba(226, 244, 255, 0.82);
        }

        .listing-fact-grid strong {
          color: #ffb45f;
          font-size: 11px;
          letter-spacing: 0.06em;
        }

        .seller-card {
          overflow: hidden;
          padding: 0;
        }

        .seller-profile-btn {
          background: rgba(255, 122, 26, 0.14);
          border-color: rgba(255, 122, 26, 0.34);
          color: #ffd1a3;
          box-shadow: none;
        }

        .contact-card {
          padding: 18px;
        }

        .contact-card h3 {
          color: #ffffff;
          font-size: 16px;
          margin-bottom: 14px;
        }

        .message-btn,
        .phone-btn,
        .login-contact {
          min-height: 50px;
          height: auto;
          border-radius: 12px;
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%);
          border-color: rgba(255, 210, 165, 0.58);
          box-shadow: 0 16px 34px rgba(255, 122, 26, 0.22);
          font-size: 14px;
        }

        @media (max-width: 1280px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: static;
          }
        }

        @media (max-width: 640px) {
          .container {
            width: min(100% - 24px, 1320px);
            padding-top: 14px;
          }

          .main {
            display: flex;
            flex-direction: column;
            padding: 14px;
            border-radius: 18px;
          }

          .image-wrapper {
            order: 1;
            margin-bottom: 14px;
          }

          .title-row {
            order: 2;
            margin-bottom: 8px;
          }

          .desktop-image-meta {
            order: 3;
            margin: 0 0 14px;
          }

          .price-actions-row {
            order: 4;
            margin-top: 8px;
            margin-bottom: 14px;
          }

          .thumbs {
            order: 5;
            margin-top: 0;
            margin-bottom: 16px;
          }

          .listing-facts-card {
            order: 6;
          }

          .listing-extra-card {
            order: 7;
          }

          .mobile-listing-id {
            align-items: center;
            color: rgba(226, 244, 255, 0.74);
            display: flex;
            font-size: 13px;
            font-weight: 900;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 6px;
            width: 100%;
          }

          .mobile-listing-id strong {
            color: #ffffff;
            display: inline-flex;
            flex: 0 0 auto;
            font-size: 1.15rem;
            font-weight: 950;
            line-height: 1;
          }

          .title-row h1 {
            font-size: 1.45rem;
          }

          .sub-info,
          .desktop-image-meta {
            gap: 7px;
            font-size: 12px;
          }

          .desktop-image-meta {
            align-items: center;
            border-bottom: 1px solid rgba(151, 178, 205, 0.22);
            display: flex;
            flex-wrap: wrap;
            line-height: 1.35;
            padding-bottom: 12px;
          }

          .desktop-image-meta strong {
            display: none;
          }

          .image-badge {
            bottom: auto;
            left: 10px;
            min-height: 28px;
            padding: 0 8px;
            top: 10px;
          }

          .mobile-image-actions {
            bottom: 12px;
            display: flex;
            gap: 10px;
            position: absolute;
            right: 12px;
            z-index: 5;
          }

          .mobile-image-actions .icon-btn {
            backdrop-filter: blur(10px);
            background: rgba(3, 12, 24, 0.76);
            border-color: rgba(255, 255, 255, 0.28);
            border-radius: 999px;
            height: 42px;
            width: 42px;
          }

          .main-img-button,
          .main-img {
            height: min(72vh, 520px);
            min-height: 340px;
          }

          .price-actions-row {
            display: none;
          }

          .image-actions {
            width: 100%;
            justify-content: space-between;
          }

          .price-display {
            font-size: 2rem;
          }

          .listing-fact-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Sidebar final polish: force the contact links to render as real buttons. */
        .listing-detail-page .sidebar {
          background:
            radial-gradient(280px 180px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 72%),
            linear-gradient(180deg, rgba(13, 28, 45, 0.96), rgba(7, 20, 34, 0.96));
          border: 1px solid rgba(151, 178, 205, 0.22);
          border-radius: 18px;
          box-shadow: 0 18px 48px rgba(0, 6, 16, 0.22);
          display: grid;
          gap: 22px;
          padding: 22px;
        }

        .listing-detail-page .seller-card,
        .listing-detail-page .contact-card {
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          overflow: visible;
        }

        .listing-detail-page .seller-card {
          padding: 0;
        }

        .listing-detail-page .seller-card-header {
          justify-content: flex-start;
          padding: 0;
        }

        .listing-detail-page .seller-card-label {
          background: transparent;
          border: 0;
          border-radius: 0;
          color: #ffb45f;
          display: block;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
          line-height: 1;
          margin: 3px 0 7px;
          padding: 0;
          transform: translateY(4px);
        }

        .listing-detail-page .seller-card-body {
          align-items: center;
          display: grid;
          grid-template-columns: 64px minmax(0, 1fr);
          gap: 12px;
          margin: 16px 0 0;
          min-height: 96px;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
        }

        .listing-detail-page .seller-profile-btn {
          align-items: center;
          background:
            linear-gradient(180deg, rgba(17, 39, 61, 0.98), rgba(8, 24, 42, 0.98));
          border: 1px solid rgba(255, 122, 26, 0.42);
          border-radius: 13px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          color: #ffffff;
          display: flex;
          font-size: 14px;
          font-weight: 950;
          gap: 8px;
          height: 46px;
          justify-content: center;
          margin: 8px 0 0;
          padding: 0 14px;
          text-decoration: none;
          width: 100%;
        }

        .listing-detail-page .seller-profile-btn svg {
          color: #ffb45f;
          height: 16px;
          width: 16px;
        }

        .listing-detail-page .seller-profile-btn:hover {
          border-color: rgba(255, 154, 36, 0.72);
          filter: brightness(1.05);
          transform: translateY(-1px);
        }

        .listing-detail-page .seller-avatar-detail {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          border: 1px solid rgba(255, 122, 26, 0.34);
          box-shadow: 0 14px 28px rgba(0, 7, 18, 0.22);
          background: rgba(3, 12, 24, 0.54);
        }

        .listing-detail-page .seller-avatar-img {
          border-radius: 18px;
          object-fit: cover;
        }

        .listing-detail-page .seller-name-row strong {
          color: #ffffff;
          display: block;
          font-size: 17px;
          font-weight: 950;
          max-width: 100%;
          white-space: normal;
        }

        .listing-detail-page .seller-card .verified-chip {
          background: transparent;
          border: 0;
          color: #4ade80;
          padding: 0;
        }

        .listing-detail-page .seller-card .verified-chip svg {
          color: #22c55e;
          filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.28));
        }

        .listing-detail-page .seller-location {
          color: rgba(226, 244, 255, 0.72);
          font-size: 13px;
          font-weight: 850;
        }

        .listing-detail-page .seller-card-arrow {
          color: #ffb45f;
        }

        .listing-detail-page .contact-card {
          display: grid;
          gap: 10px;
          margin-top: 4px;
          padding: 0;
        }

        .listing-detail-page .contact-card h3 {
          color: #ffffff;
          font-size: 17px;
          font-weight: 950;
          line-height: 1.15;
          margin: 0 0 2px;
        }

        .listing-detail-page .contact-card .message-btn,
        .listing-detail-page .contact-card .phone-btn,
        .listing-detail-page .contact-card .login-contact,
        .listing-detail-page .contact-card .phone-number {
          align-items: center;
          border-radius: 13px;
          box-sizing: border-box;
          display: flex;
          gap: 9px;
          height: 54px;
          justify-content: center;
          margin: 0;
          min-height: 54px;
          padding: 0 16px;
          text-align: center;
          text-decoration: none;
          width: 100%;
        }

        .listing-detail-page .contact-card .message-btn {
          background:
            linear-gradient(180deg, rgba(20, 42, 64, 0.96), rgba(10, 27, 45, 0.96));
          border: 1px solid rgba(151, 178, 205, 0.36);
          color: #ffffff;
          font-size: 14px;
          font-weight: 950;
          box-shadow:
            0 10px 24px rgba(0, 6, 16, 0.18),
            inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .listing-detail-page .contact-card .phone-btn,
        .listing-detail-page .contact-card .login-contact {
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%);
          border: 1px solid rgba(255, 210, 165, 0.62);
          color: #ffffff;
          font-size: 14px;
          font-weight: 950;
          box-shadow: 0 16px 34px rgba(255, 122, 26, 0.22);
        }

        .listing-detail-page .contact-card .message-btn svg,
        .listing-detail-page .contact-card .phone-btn svg,
        .listing-detail-page .contact-card .login-contact svg,
        .listing-detail-page .contact-card .phone-number svg {
          flex: 0 0 auto;
          height: 18px;
          width: 18px;
        }

        .listing-detail-page .contact-card .message-btn:hover,
        .listing-detail-page .contact-card .phone-btn:hover,
        .listing-detail-page .contact-card .login-contact:hover {
          filter: brightness(1.05);
          transform: translateY(-1px);
        }

        .similar-listings-section {
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          margin: 30px 0 72px;
          padding: 0;
        }

        .similar-listings-head {
          align-items: baseline;
          background: transparent;
          border-bottom: 1px solid rgba(255, 122, 26, 0.62);
          display: grid;
          gap: 12px;
          grid-template-columns: auto 1fr;
          margin: 0;
          padding: 16px 18px;
        }

        .similar-listings-head span {
          color: #ffb45f;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .similar-listings-head h2 {
          color: #ffffff;
          font-size: 20px;
          font-weight: 950;
          justify-self: end;
          line-height: 1.1;
          margin: 0;
        }

        .similar-listings-grid {
          display: grid;
          gap: 0;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          padding: 16px 0 0;
        }

        .similar-listing-card {
          background: transparent;
          border: 0;
          border-left: 1px solid rgba(255, 122, 26, 0.62);
          border-radius: 0;
          color: #ffffff;
          display: grid;
          grid-template-rows: 158px 1fr;
          overflow: hidden;
          padding: 0 14px;
          text-decoration: none;
          transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }

        .similar-listing-card:first-child {
          border-left: 0;
          padding-left: 0;
        }

        .similar-listing-card:last-child {
          padding-right: 0;
        }

        .similar-listing-card:hover {
          border-color: rgba(255, 184, 93, 0.95);
          box-shadow: none;
          transform: translateY(-2px);
        }

        .similar-listing-image {
          background: #06111f;
          border: 1px solid rgba(255, 122, 26, 0.26);
          display: block;
          overflow: hidden;
          position: relative;
        }

        .similar-listing-image::after {
          border: 1px solid rgba(255, 255, 255, 0.08);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
        }

        .similar-listing-image img {
          display: block;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .similar-listing-body {
          display: grid;
          gap: 8px;
          padding: 14px;
          min-height: 136px;
        }

        .similar-listing-body strong {
          color: #ffffff;
          font-size: 23px;
          font-weight: 950;
          line-height: 1;
        }

        .similar-listing-title {
          color: #ffffff;
          display: -webkit-box;
          font-size: 14px;
          font-weight: 950;
          line-height: 1.18;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .similar-listing-meta {
          align-items: center;
          color: rgba(226, 244, 255, 0.68);
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          font-size: 12px;
          font-weight: 800;
        }

        @media (max-width: 640px) {
          .listing-detail-page .seller-card-body {
            grid-template-columns: 58px minmax(0, 1fr);
          }

          .listing-detail-page .sidebar {
            padding: 18px;
          }

          .listing-detail-page .seller-avatar-detail {
            width: 58px;
            height: 58px;
          }

          .similar-listings-section {
            margin: 22px 0 48px;
          }

          .similar-listings-head {
            align-items: flex-start;
            display: grid;
            gap: 6px;
            grid-template-columns: 1fr;
            padding: 14px;
          }

          .similar-listings-head h2 {
            justify-self: start;
          }

          .similar-listings-grid {
            gap: 10px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            padding: 14px 0 0;
          }

          .similar-listing-card,
          .similar-listing-card:first-child,
          .similar-listing-card:last-child {
            border-left: 0;
            padding: 0;
          }

          .similar-listing-card:nth-child(odd) {
            border-right: 1px solid rgba(255, 122, 26, 0.62);
            padding-right: 10px;
          }

          .similar-listing-card:nth-child(even) {
            padding-left: 10px;
          }

          .similar-listing-card {
            grid-template-columns: 1fr;
            grid-template-rows: 118px 1fr;
            min-height: 250px;
          }

          .similar-listing-image {
            border-bottom: 1px solid rgba(255, 122, 26, 0.42);
            border-right: 0;
          }

          .similar-listing-body {
            gap: 6px;
            min-height: 132px;
            padding: 10px;
          }

          .similar-listing-body strong {
            font-size: 20px;
          }

          .similar-listing-title {
            font-size: 12px;
          }

          .similar-listing-meta {
            font-size: 10px;
            gap: 5px;
          }
        }

        /* Final gallery arrow placement: centered on both sides of the image. */
        .listing-detail-page .image-wrapper .gallery-arrow {
          align-items: center;
          background: rgba(3, 12, 24, 0.76);
          border: 1px solid rgba(151, 178, 205, 0.28);
          border-radius: 999px;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          height: 46px;
          justify-content: center;
          padding: 0;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 46px;
          z-index: 6;
        }

        .listing-detail-page .image-wrapper .gallery-arrow-left {
          left: 18px;
        }

        .listing-detail-page .image-wrapper .gallery-arrow-right {
          right: 18px;
        }

        .listing-detail-page .image-wrapper .gallery-arrow:hover {
          background: rgba(255, 122, 26, 0.92);
          border-color: rgba(255, 208, 164, 0.8);
        }

        @media (max-width: 640px) {
          .listing-detail-page .image-wrapper .gallery-arrow {
            height: 38px;
            top: 44%;
            width: 38px;
          }

          .listing-detail-page .image-wrapper .gallery-arrow-left {
            left: 10px;
          }

          .listing-detail-page .image-wrapper .gallery-arrow-right {
            right: 10px;
          }

          .listing-detail-page .mobile-image-thumbs {
            gap: 6px;
            padding: 7px 8px;
          }

          .listing-detail-page .mobile-image-thumbs button {
            height: 54px;
            min-width: 42px;
            width: 42px;
          }

          .listing-detail-page .mobile-image-thumbs img {
            border-radius: 7px;
            height: 54px;
            padding: 1px;
            width: 42px;
          }
        }

        /* Final similar listings image lock: every card keeps the same image size. */
        .listing-detail-page .similar-listing-card {
          grid-template-rows: 168px minmax(132px, auto);
          min-height: 0;
        }

        .listing-detail-page .similar-listing-image {
          aspect-ratio: 16 / 10;
          display: block;
          height: 168px;
          max-height: 168px;
          min-height: 168px;
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .listing-detail-page .similar-listing-image img {
          display: block;
          height: 100%;
          inset: 0;
          object-fit: cover;
          object-position: center;
          position: absolute;
          width: 100%;
        }

        .listing-detail-page .listing-image-preview-arrow {
          align-items: center;
          background: rgba(3, 12, 24, 0.78);
          border: 1px solid rgba(151, 178, 205, 0.28);
          border-radius: 999px;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          height: 46px;
          justify-content: center;
          padding: 0;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 46px;
          z-index: 3;
        }

        .listing-detail-page .listing-image-preview-arrow-left {
          left: 14px;
        }

        .listing-detail-page .listing-image-preview-arrow-right {
          right: 14px;
        }

        .listing-detail-page .listing-image-preview-arrow:hover {
          background: rgba(255, 122, 26, 0.92);
          border-color: rgba(255, 208, 164, 0.8);
        }

        @media (max-width: 640px) {
          .listing-detail-page .similar-listing-card {
            grid-template-rows: 118px minmax(132px, auto);
          }

          .listing-detail-page .similar-listing-image {
            height: 118px;
            max-height: 118px;
            min-height: 118px;
          }

          .listing-detail-page .listing-image-preview-arrow {
            height: 38px;
            width: 38px;
          }

          .listing-detail-page .listing-image-preview-arrow-left {
            left: 8px;
          }

          .listing-detail-page .listing-image-preview-arrow-right {
            right: 8px;
          }
        }

        /* Final no-outline pass: remove the visible page/card edge borders. */
        .listing-detail-page .container,
        .listing-detail-page .layout,
        .listing-detail-page .main,
        .listing-detail-page .sidebar,
        .listing-detail-page .seller-card,
        .listing-detail-page .seller-card-header,
        .listing-detail-page .seller-card-body,
        .listing-detail-page .contact-card,
        .listing-detail-page .description-card,
        .listing-detail-page .listing-facts-card,
        .listing-detail-page .listing-extra-card,
        .listing-detail-page .similar-listings-section {
          border: 0;
          border-color: transparent;
          box-shadow: none;
          outline: 0;
        }

        .listing-detail-page .main,
        .listing-detail-page .sidebar,
        .listing-detail-page .seller-card,
        .listing-detail-page .contact-card {
          background-clip: padding-box;
        }

        .listing-detail-page .sidebar,
        .listing-detail-page .seller-card,
        .listing-detail-page .seller-card-body,
        .listing-detail-page .seller-info,
        .listing-detail-page .contact-card {
          text-align: center;
        }

        .listing-detail-page .seller-card-body,
        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row,
        .listing-detail-page .seller-employee-name,
        .listing-detail-page .seller-location,
        .listing-detail-page .verified-chip,
        .listing-detail-page .seller-profile-btn,
        .listing-detail-page .contact-card h3,
        .listing-detail-page .contact-card .message-btn,
        .listing-detail-page .contact-card .phone-btn,
        .listing-detail-page .contact-card .phone-number,
        .listing-detail-page .contact-card .login-contact {
          align-items: center;
          justify-content: center;
          margin-left: auto;
          margin-right: auto;
        }

        @media (min-width: 761px) {
          .listing-detail-page .layout {
            grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
          }

          .listing-detail-page .sidebar {
            bottom: auto;
            left: auto;
            max-height: calc(100vh - 104px);
            overflow: auto;
            position: fixed;
            right: max(20px, calc((100vw - 1320px) / 2 + 20px));
            scrollbar-width: none;
            top: 86px;
            width: clamp(300px, 24vw, 360px);
            z-index: 30;
          }

          .listing-detail-page .sidebar::-webkit-scrollbar {
            display: none;
          }
        }

        .listing-detail-page .seller-profile-btn,
        .listing-detail-page .contact-card .message-btn,
        .listing-detail-page .contact-card .phone-btn,
        .listing-detail-page .contact-card .login-contact,
        .listing-detail-page .gallery-arrow,
        .listing-detail-page .listing-image-preview-arrow,
        .listing-detail-page .mobile-image-thumbs button {
          box-shadow: none;
        }

        /* Keep the seller panel in the page flow and center its contents. */
        @media (min-width: 761px) {
          .listing-detail-page .sidebar {
            left: auto;
            max-height: none;
            overflow: visible;
            position: static;
            right: auto;
            top: auto;
            width: auto;
            z-index: auto;
          }
        }

        .listing-detail-page .seller-card-body,
        .listing-detail-page .seller-card-link {
          grid-template-columns: 1fr;
        }

        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row {
          width: 100%;
        }

        .listing-detail-page .seller-profile-btn {
          align-self: center;
          border-radius: 999px;
          display: inline-flex;
          margin: 16px auto 0;
          min-height: 42px;
          padding: 0 18px;
          width: min(100%, 230px);
        }

        .listing-detail-page .seller-card-link {
          width: 100%;
        }

        .listing-detail-page .seller-profile-btn {
          grid-area: profile;
          height: 38px;
          margin: 4px auto 0;
          min-height: 38px;
          width: min(100%, 220px);
        }

        @media (min-width: 641px) {
          .listing-detail-page .desktop-image-meta {
            box-sizing: border-box;
            margin: 0 0 12px;
            padding-inline: clamp(28px, 3.6vw, 56px);
            width: 100%;
          }

          .listing-detail-page .desktop-image-meta strong {
            margin-left: auto;
          }

          .listing-detail-page .image-badge {
            bottom: auto;
            left: clamp(28px, 3.6vw, 54px);
            top: 18px;
          }

          .listing-detail-page .image-zoom-button {
            right: clamp(28px, 3.6vw, 54px);
            top: 18px;
          }

          .listing-detail-page .image-wrapper .gallery-arrow-left {
            left: clamp(28px, 3.6vw, 54px);
          }

          .listing-detail-page .image-wrapper .gallery-arrow-right {
            right: clamp(28px, 3.6vw, 54px);
          }
        }

        @media (max-width: 420px) {
          .listing-detail-page .seller-card-link {
            padding: 16px;
          }
        }

        /* Seller profile card match to reference */
        .listing-detail-page .sidebar {
          background: transparent;
          padding: 0;
          gap: 0;
        }

        .listing-detail-page .seller-card {
          border-radius: 34px;
          border: 1px solid rgba(136, 177, 220, 0.28);
          background:
            radial-gradient(120% 100% at 50% 0%, rgba(20, 61, 120, 0.34), rgba(5, 24, 52, 0.95) 66%),
            linear-gradient(180deg, rgba(7, 29, 56, 0.98), rgba(5, 23, 46, 0.98));
          box-shadow:
            0 30px 80px rgba(1, 10, 24, 0.56),
            inset 0 1px 0 rgba(195, 227, 255, 0.2);
          overflow: hidden;
        }

        .listing-detail-page .seller-card-body.seller-card-panel {
          display: grid;
          grid-template-columns: 86px minmax(0, 1fr);
          gap: 14px;
          padding: 18px 18px;
          margin: 0;
        }

        .listing-detail-page .seller-card-top {
          grid-column: 1 / -1;
          display: flex;
          justify-content: flex-end;
          margin-bottom: 4px;
        }

        .listing-detail-page .seller-profile-btn {
          background: transparent;
          border: 0;
          box-shadow: none;
          color: rgba(230, 241, 255, 0.84);
          font-size: 17px;
          font-weight: 700;
          height: auto;
          min-height: 0;
          margin: 0;
          padding: 0;
          width: auto;
        }

        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 86px;
          height: 86px;
          border-radius: 14px;
          border: 0;
          background: #ffffff;
        }

        .listing-detail-page .seller-name-row strong {
          font-size: clamp(26px, 5.5vw, 48px);
          line-height: 1.06;
          font-weight: 900;
          letter-spacing: -0.02em;
          word-break: break-word;
        }

        .listing-detail-page .seller-card .verified-chip {
          color: #46e58f;
          font-size: 18px;
          font-weight: 800;
          gap: 8px;
        }

        .listing-detail-page .seller-meta-rows {
          grid-column: 1 / -1;
          border-top: 1px solid rgba(146, 180, 214, 0.28);
          margin-top: 8px;
          padding-top: 22px;
          gap: 14px;
        }

        .listing-detail-page .seller-meta-row {
          justify-content: flex-start;
          font-size: 18px;
          color: rgba(219, 231, 245, 0.76);
        }

        .listing-detail-page .seller-meta-row strong {
          font-size: clamp(20px, 4.6vw, 36px);
          font-weight: 850;
          color: #ffffff;
        }

        .listing-detail-page .seller-contact-merged {
          grid-column: 1 / -1;
          margin-top: 18px;
          gap: 14px;
        }

        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          width: 100%;
          height: 54px;
          min-height: 54px;
          border-radius: 16px;
          font-size: 16px;
          font-weight: 850;
        }

        .listing-detail-page .contact-card {
          display: none;
        }

        .listing-detail-page .seller-contact-merged .message-btn {
          background: linear-gradient(90deg, #ff9b1d 0%, #ff5f00 100%);
          border: 1px solid rgba(255, 185, 101, 0.62);
          color: #ffffff;
        }

        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          background: rgba(7, 31, 58, 0.72);
          border: 2px solid #ff9c26;
          color: #f4f8ff;
        }

        /* Hard final override for seller card layout integrity */
        .listing-detail-page .seller-card-body.seller-card-panel {
          display: block;
          padding: 20px 16px;
        }

        .listing-detail-page .seller-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .listing-detail-page .seller-identity-row {
          display: grid;
          grid-template-columns: 72px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
        }

        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row {
          display: block;
          text-align: left;
          width: 100%;
          min-width: 0;
        }

        .listing-detail-page .seller-name-row strong {
          display: block;
          font-size: 22px;
          line-height: 1.15;
          white-space: normal;
          word-break: normal;
          overflow-wrap: anywhere;
          max-width: 100%;
        }

        .listing-detail-page .seller-card .verified-chip {
          display: inline-flex;
          margin-top: 4px;
          font-size: 14px;
        }

        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 72px;
          height: 72px;
          border-radius: 12px;
        }

        .listing-detail-page .seller-meta-rows {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(146, 180, 214, 0.28);
          display: grid;
          gap: 8px;
        }

        .listing-detail-page .seller-meta-row {
          display: flex;
          justify-content: flex-start;
          align-items: baseline;
          gap: 6px;
          font-size: 14px;
        }

        .listing-detail-page .seller-meta-row strong {
          font-size: 14px;
          line-height: 1.3;
        }

        .listing-detail-page .seller-contact-merged {
          margin-top: 14px;
          display: grid;
          gap: 10px;
        }

        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          height: 48px;
          min-height: 48px;
          border-radius: 14px;
          font-size: 15px;
          padding: 0 12px;
        }

        .listing-detail-page .similar-home-grid {
          margin-top: 18px;
        }

        .listing-detail-page .similar-home-card {
          min-width: 0;
        }

        .listing-detail-page .container::before,
        .listing-detail-page .container::after,
        .listing-detail-page .layout::before,
        .listing-detail-page .layout::after,
        .listing-detail-page .main::before,
        .listing-detail-page .main::after,
        .listing-detail-page .sidebar::before,
        .listing-detail-page .sidebar::after {
          background: none;
          border: 0;
          box-shadow: none;
          content: none;
          display: none;
        }

        /* Force unified seller panel background with no inner color bars. */
        .listing-detail-page .seller-card-body.seller-card-panel,
        .listing-detail-page .seller-card-body.seller-card-panel:hover,
        .listing-detail-page .seller-identity-row,
        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row,
        .listing-detail-page .seller-employee-name,
        .listing-detail-page .seller-address {
          background: transparent;
          background-image: none;
          border: 0;
          box-shadow: none;
        }

        .listing-detail-page .seller-card {
          background: #06203a;
          background-image: none;
          border: 0;
          box-shadow: none;
        }

        .listing-detail-page .sidebar,
        .listing-detail-page .contact-card,
        .listing-detail-page .seller-card,
        .listing-detail-page .seller-card-body,
        .listing-detail-page .seller-card-body.seller-card-panel,
        .listing-detail-page .seller-identity-row,
        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row,
        .listing-detail-page .seller-employee-name,
        .listing-detail-page .seller-address {
          background: #06203a;
          background-image: none;
          border-color: transparent;
          box-shadow: none;
        }

        /* Reference-match seller card (final) */
        .listing-detail-page .seller-card {
          border-radius: 42px;
          border: 1px solid rgba(173, 205, 238, 0.35);
          background:
            radial-gradient(120% 140% at 15% 0%, rgba(72, 115, 172, 0.35), transparent 45%),
            radial-gradient(120% 140% at 100% 100%, rgba(0, 57, 122, 0.2), transparent 55%),
            linear-gradient(180deg, #052247 0%, #021735 100%);
          box-shadow:
            0 24px 70px rgba(0, 8, 20, 0.48),
            inset 0 1px 0 rgba(215, 235, 255, 0.22);
          overflow: hidden;
        }
        .listing-detail-page .seller-card-body.seller-card-panel {
          display: block;
          padding: 26px 22px 24px;
        }
        .listing-detail-page .seller-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }
        .listing-detail-page .seller-card-label {
          color: #ffb255;
          font-size: 34px;
          font-weight: 900;
          letter-spacing: 0;
          margin: 0;
          transform: none;
        }
        .listing-detail-page .seller-profile-btn {
          background: transparent;
          border: 0;
          color: rgba(228, 237, 248, 0.92);
          font-size: 26px;
          font-weight: 700;
          padding: 0;
        }
        .listing-detail-page .seller-identity-row {
          display: grid;
          grid-template-columns: 140px minmax(0, 1fr);
          gap: 22px;
          align-items: center;
        }
        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 140px;
          height: 140px;
          border-radius: 20px;
          background: #fff;
        }
        .listing-detail-page .seller-name-row strong {
          font-size: 48px;
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.02em;
          white-space: normal;
          word-break: normal;
          overflow-wrap: anywhere;
        }
        .listing-detail-page .seller-card .verified-chip {
          color: #46ec95;
          font-size: 20px;
          font-weight: 800;
          gap: 8px;
          margin-top: 8px;
        }
        .listing-detail-page .seller-meta-rows {
          border-top: 1px solid rgba(174, 202, 231, 0.32);
          margin-top: 14px;
          padding-top: 20px;
          gap: 14px;
        }
        .listing-detail-page .seller-meta-row {
          font-size: 22px;
          color: rgba(218, 229, 243, 0.8);
          gap: 10px;
        }
        .listing-detail-page .seller-meta-row strong {
          color: #fff;
          font-size: 22px;
          font-weight: 800;
        }
        .listing-detail-page .seller-divider {
          margin: 18px 0;
          border-color: rgba(174, 202, 231, 0.26);
        }
        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number {
          height: 64px;
          min-height: 64px;
          border-radius: 20px;
          font-size: 18px;
          font-weight: 850;
        }
        .listing-detail-page .seller-contact-merged .message-btn {
          background: linear-gradient(90deg, #ff9b1f 0%, #ff6300 100%);
          border: 1px solid rgba(255, 180, 84, 0.58);
          color: #fff;
        }
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number {
          background: rgba(0, 26, 58, 0.65);
          border: 2px solid #ff961f;
          color: #eef3fa;
        }
        .listing-detail-page .contact-card { display: none; }

        @media (min-width: 761px) {
          .listing-detail-page .sidebar {
            max-width: 920px;
            width: 100%;
            margin: 0 auto;
          }
          .listing-detail-page .seller-card-body.seller-card-panel {
            padding: 54px 54px 46px;
          }
          .listing-detail-page .seller-card-top {
            margin-bottom: 34px;
          }
          .listing-detail-page .seller-card-label {
            display: none;
          }
          .listing-detail-page .seller-profile-btn {
            font-size: 48px;
          }
          .listing-detail-page .seller-identity-row {
            grid-template-columns: 248px minmax(0, 1fr);
            gap: 32px;
          }
          .listing-detail-page .seller-avatar-detail,
          .listing-detail-page .seller-avatar-img {
            width: 248px;
            height: 248px;
            border-radius: 30px;
          }
          .listing-detail-page .seller-name-row strong {
            font-size: 74px;
            line-height: 1.03;
          }
          .listing-detail-page .seller-card .verified-chip {
            font-size: 56px;
          }
          .listing-detail-page .seller-divider {
            margin: 40px 0 28px;
          }
          .listing-detail-page .seller-meta-row {
            font-size: 56px;
            gap: 16px;
          }
          .listing-detail-page .seller-meta-row strong {
            font-size: 56px;
          }
          .listing-detail-page .seller-contact-merged {
            margin-top: 36px;
            gap: 20px;
          }
          .listing-detail-page .seller-contact-merged .message-btn,
          .listing-detail-page .seller-contact-merged .phone-btn,
          .listing-detail-page .seller-contact-merged .phone-number {
            height: 136px;
            min-height: 136px;
            border-radius: 32px;
            font-size: 64px;
          }
        }

        @media (max-width: 760px) {
          .listing-detail-page .seller-card { border-radius: 22px; }
          .listing-detail-page .seller-card-body.seller-card-panel { padding: 16px; }
          .listing-detail-page .seller-card-label { font-size: 28px; }
          .listing-detail-page .seller-profile-btn { font-size: 15px; }
          .listing-detail-page .seller-identity-row { grid-template-columns: 72px minmax(0, 1fr); gap: 10px; }
          .listing-detail-page .seller-avatar-detail,
          .listing-detail-page .seller-avatar-img { width: 72px; height: 72px; border-radius: 12px; }
          .listing-detail-page .seller-name-row strong { font-size: 18px; line-height: 1.08; max-width: 160px; }
          .listing-detail-page .seller-card .verified-chip { font-size: 14px; margin-top: 4px; }
          .listing-detail-page .seller-meta-rows { margin-top: 10px; padding-top: 14px; }
          .listing-detail-page .seller-meta-row { font-size: 12px; gap: 6px; }
          .listing-detail-page .seller-meta-row strong { font-size: 12px; }
          .listing-detail-page .seller-contact-merged .message-btn,
          .listing-detail-page .seller-contact-merged .phone-btn,
          .listing-detail-page .seller-contact-merged .phone-number { height: 54px; min-height: 54px; border-radius: 16px; font-size: 14px; }
          .listing-detail-page .seller-divider { margin: 14px 0; }
        }

        /* Seller card final reference lock */
        .listing-detail-page .sidebar {
          background: transparent;
          border: 0;
          box-shadow: none;
          padding: 0;
          max-width: 380px;
          width: 100%;
          margin: 0;
        }

        .listing-detail-page .seller-card {
          border: 1px solid rgba(139, 178, 219, 0.34);
          border-radius: 30px;
          background:
            radial-gradient(120% 120% at 8% 0%, rgba(79, 119, 164, 0.32), transparent 45%),
            radial-gradient(100% 90% at 100% 100%, rgba(0, 55, 115, 0.18), transparent 55%),
            linear-gradient(180deg, #062447 0%, #031935 100%);
          box-shadow:
            0 22px 54px rgba(0, 8, 22, 0.48),
            inset 0 1px 0 rgba(220, 238, 255, 0.18);
          overflow: hidden;
        }

        .listing-detail-page .seller-card-body.seller-card-panel {
          background: transparent;
          display: block;
          padding: 28px 26px 26px;
        }

        .listing-detail-page .seller-card-top {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin: 0 0 30px;
        }

        .listing-detail-page .seller-card-label {
          display: none;
        }

        .listing-detail-page .seller-profile-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: auto;
          height: auto;
          min-height: 0;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          color: rgba(226, 236, 249, 0.86);
          font-size: 18px;
          font-weight: 650;
          line-height: 1;
        }

        .listing-detail-page .seller-profile-btn svg {
          color: rgba(226, 236, 249, 0.84);
          width: 22px;
          height: 22px;
        }

        .listing-detail-page .seller-identity-row {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          align-items: center;
          gap: 22px;
          background: transparent;
        }

        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 92px;
          height: 92px;
          border-radius: 18px;
          background: #ffffff;
          border: 0;
          box-shadow: 0 14px 26px rgba(0, 8, 20, 0.22);
          object-fit: cover;
        }

        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row {
          display: block;
          width: 100%;
          min-width: 0;
          text-align: left;
          background: transparent;
        }

        .listing-detail-page .seller-name-row strong {
          display: block;
          max-width: 100%;
          color: #ffffff;
          font-size: 30px;
          font-weight: 900;
          letter-spacing: 0;
          line-height: 1.08;
          white-space: normal;
          word-break: normal;
          overflow-wrap: anywhere;
          text-align: left;
        }

        .listing-detail-page .seller-card .verified-chip {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          margin: 10px 0 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: #45e78c;
          font-size: 17px;
          font-weight: 800;
          line-height: 1.15;
          text-align: left;
        }

        .listing-detail-page .seller-card .verified-chip svg {
          width: 22px;
          height: 22px;
          color: #43e789;
          fill: #43e789;
          stroke: #062447;
          stroke-width: 3;
        }

        .listing-detail-page .seller-meta-rows {
          display: grid;
          gap: 18px;
          margin: 34px 0 0;
          padding: 26px 0 0;
          border-top: 1px solid rgba(177, 203, 230, 0.3);
          background: transparent;
        }

        .listing-detail-page .seller-meta-row {
          display: grid;
          grid-template-columns: 32px auto 1fr;
          align-items: center;
          gap: 10px;
          color: rgba(219, 229, 242, 0.78);
          font-size: 20px;
          font-weight: 650;
          line-height: 1.2;
          text-align: left;
          background: transparent;
        }

        .listing-detail-page .seller-meta-row svg {
          width: 24px;
          height: 24px;
          color: rgba(219, 229, 242, 0.82);
        }

        .listing-detail-page .seller-meta-row strong {
          color: #ffffff;
          font-size: 20px;
          font-weight: 800;
          line-height: 1.2;
          white-space: normal;
        }

        .listing-detail-page .seller-divider {
          display: none;
        }

        .listing-detail-page .seller-contact-merged {
          display: grid;
          gap: 14px;
          margin: 34px 0 0;
          background: transparent;
        }

        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          width: 100%;
          height: 62px;
          min-height: 62px;
          margin: 0;
          padding: 0 18px;
          border-radius: 16px;
          box-shadow: none;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0;
          line-height: 1;
          text-decoration: none;
          text-align: center;
        }

        .listing-detail-page .seller-contact-merged .message-btn {
          background: linear-gradient(90deg, #ff991f 0%, #ff5f00 100%);
          border: 1px solid rgba(255, 181, 91, 0.7);
          color: #ffffff;
        }

        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          background: transparent;
          border: 2px solid #ff9418;
          color: #f6f8fc;
        }

        .listing-detail-page .seller-contact-merged svg {
          width: 26px;
          height: 26px;
          flex: 0 0 auto;
        }

        .listing-detail-page .contact-card {
          display: none;
        }

        @media (max-width: 420px) {
          .listing-detail-page .sidebar {
            max-width: 100%;
          }

          .listing-detail-page .seller-card {
            border-radius: 24px;
          }

          .listing-detail-page .seller-card-body.seller-card-panel {
            padding: 24px 22px 22px;
          }

          .listing-detail-page .seller-card-top {
            margin-bottom: 26px;
          }

          .listing-detail-page .seller-profile-btn {
            font-size: 15px;
          }

          .listing-detail-page .seller-profile-btn svg {
            width: 18px;
            height: 18px;
          }

          .listing-detail-page .seller-identity-row {
            grid-template-columns: 72px minmax(0, 1fr);
            gap: 18px;
          }

          .listing-detail-page .seller-avatar-detail,
          .listing-detail-page .seller-avatar-img {
            width: 72px;
            height: 72px;
            border-radius: 14px;
          }

          .listing-detail-page .seller-name-row strong {
            font-size: 34px;
          }

          .listing-detail-page .seller-card .verified-chip {
            font-size: 22px;
          }

          .listing-detail-page .seller-card .verified-chip svg {
            width: 18px;
            height: 18px;
          }

          .listing-detail-page .seller-meta-row {
            grid-template-columns: 26px auto 1fr;
            font-size: 17px;
          }

          .listing-detail-page .seller-meta-row strong {
            font-size: 17px;
          }

          .listing-detail-page .seller-contact-merged .message-btn,
          .listing-detail-page .seller-contact-merged .phone-btn,
          .listing-detail-page .seller-contact-merged .phone-number,
          .listing-detail-page .seller-contact-merged .login-contact {
            height: 58px;
            min-height: 58px;
            font-size: 19px;
          }
        }
      `}</style>
      <style jsx global>{`
        .listing-detail-page .sidebar {
          background: transparent;
          border: 0;
          box-shadow: none;
          padding: 0;
          max-width: 380px;
          width: 100%;
          margin: 0;
        }

        .listing-detail-page .seller-card {
          border: 1px solid rgba(139, 178, 219, 0.34);
          border-radius: 30px;
          background:
            radial-gradient(120% 120% at 8% 0%, rgba(79, 119, 164, 0.32), transparent 45%),
            radial-gradient(100% 90% at 100% 100%, rgba(0, 55, 115, 0.18), transparent 55%),
            linear-gradient(180deg, #062447 0%, #031935 100%);
          box-shadow:
            0 22px 54px rgba(0, 8, 22, 0.48),
            inset 0 1px 0 rgba(220, 238, 255, 0.18);
          overflow: hidden;
        }

        .listing-detail-page .seller-card-body.seller-card-panel {
          background: transparent;
          display: block;
          padding: 30px 28px 28px;
        }

        .listing-detail-page .seller-card-top {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin: 0 0 30px;
        }

        .listing-detail-page .seller-card-label {
          display: none;
        }

        .listing-detail-page .seller-profile-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: auto;
          height: auto;
          min-height: 0;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          color: rgba(226, 236, 249, 0.88);
          font-size: 18px;
          font-weight: 650;
          line-height: 1;
        }

        .listing-detail-page .seller-profile-btn svg {
          color: rgba(226, 236, 249, 0.86);
          width: 24px;
          height: 24px;
        }

        .listing-detail-page .seller-identity-row {
          display: grid;
          grid-template-columns: 96px minmax(0, 1fr);
          align-items: center;
          gap: 24px;
          background: transparent;
        }

        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 96px;
          height: 96px;
          border-radius: 18px;
          background: #ffffff;
          border: 0;
          box-shadow: 0 14px 26px rgba(0, 8, 20, 0.22);
          object-fit: cover;
        }

        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row {
          display: block;
          width: 100%;
          min-width: 0;
          text-align: left;
          background: transparent;
        }

        .listing-detail-page .seller-name-row strong {
          display: block;
          max-width: 100%;
          color: #ffffff;
          font-size: 30px;
          font-weight: 900;
          letter-spacing: 0;
          line-height: 1.08;
          white-space: normal;
          word-break: normal;
          overflow-wrap: anywhere;
          text-align: left;
        }

        .listing-detail-page .seller-card .verified-chip {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          margin: 10px 0 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: #45e78c;
          font-size: 17px;
          font-weight: 800;
          line-height: 1.15;
          text-align: left;
        }

        .listing-detail-page .seller-card .verified-chip svg {
          width: 22px;
          height: 22px;
          color: #43e789;
          fill: #43e789;
          stroke: #062447;
          stroke-width: 3;
        }

        .listing-detail-page .seller-meta-rows {
          display: grid;
          gap: 18px;
          margin: 34px 0 0;
          padding: 26px 0 0;
          border-top: 1px solid rgba(177, 203, 230, 0.3);
          background: transparent;
        }

        .listing-detail-page .seller-meta-row {
          display: grid;
          grid-template-columns: 32px auto 1fr;
          align-items: center;
          gap: 10px;
          color: rgba(219, 229, 242, 0.78);
          font-size: 20px;
          font-weight: 650;
          line-height: 1.2;
          text-align: left;
          background: transparent;
        }

        .listing-detail-page .seller-meta-row svg {
          width: 24px;
          height: 24px;
          color: rgba(219, 229, 242, 0.82);
        }

        .listing-detail-page .seller-meta-row strong {
          color: #ffffff;
          font-size: 20px;
          font-weight: 800;
          line-height: 1.2;
          white-space: normal;
        }

        .listing-detail-page .seller-divider {
          display: none;
        }

        .listing-detail-page .seller-contact-merged {
          display: grid;
          gap: 14px;
          margin: 34px 0 0;
          background: transparent;
        }

        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          width: 100%;
          height: 62px;
          min-height: 62px;
          margin: 0;
          padding: 0 18px;
          border-radius: 16px;
          box-shadow: none;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0;
          line-height: 1;
          text-decoration: none;
          text-align: center;
        }

        .listing-detail-page .seller-contact-merged .message-btn {
          background: linear-gradient(90deg, #ff991f 0%, #ff5f00 100%);
          border: 1px solid rgba(255, 181, 91, 0.7);
          color: #ffffff;
        }

        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          background: transparent;
          border: 2px solid #ff9418;
          color: #f6f8fc;
        }

        .listing-detail-page .seller-contact-merged svg {
          width: 26px;
          height: 26px;
          flex: 0 0 auto;
        }

        .listing-detail-page .contact-card {
          display: none;
        }

        @media (max-width: 420px) {
          .listing-detail-page .seller-card {
            border-radius: 24px;
          }

          .listing-detail-page .seller-card-body.seller-card-panel {
            padding: 24px 22px 22px;
          }

          .listing-detail-page .seller-card-top {
            margin-bottom: 26px;
          }

          .listing-detail-page .seller-profile-btn {
            font-size: 15px;
          }

          .listing-detail-page .seller-profile-btn svg {
            width: 18px;
            height: 18px;
          }

          .listing-detail-page .seller-identity-row {
            grid-template-columns: 72px minmax(0, 1fr);
            gap: 18px;
          }

          .listing-detail-page .seller-avatar-detail,
          .listing-detail-page .seller-avatar-img {
            width: 72px;
            height: 72px;
            border-radius: 14px;
          }

          .listing-detail-page .seller-name-row strong {
            font-size: 30px;
          }

          .listing-detail-page .seller-card .verified-chip {
            font-size: 16px;
          }

          .listing-detail-page .seller-card .verified-chip svg {
            width: 18px;
            height: 18px;
          }

          .listing-detail-page .seller-meta-row {
            grid-template-columns: 26px auto 1fr;
            font-size: 17px;
          }

          .listing-detail-page .seller-meta-row strong {
            font-size: 17px;
          }

          .listing-detail-page .seller-contact-merged .message-btn,
          .listing-detail-page .seller-contact-merged .phone-btn,
          .listing-detail-page .seller-contact-merged .phone-number,
          .listing-detail-page .seller-contact-merged .login-contact {
            height: 58px;
            min-height: 58px;
            font-size: 19px;
          }
        }

        main.listing-detail-page .seller-card .seller-card-top a.seller-profile-btn.seller-profile-btn-top {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: auto;
          height: auto;
          min-height: 0;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          background-image: none;
          box-shadow: none;
          color: rgba(226, 236, 249, 0.88);
          font-size: 18px;
          font-weight: 650;
          line-height: 1;
        }

        main.listing-detail-page .seller-card .seller-card-top a.seller-profile-btn.seller-profile-btn-top svg {
          color: rgba(226, 236, 249, 0.86);
          width: 24px;
          height: 24px;
        }

        @media (min-width: 900px) {
          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            grid-template-columns: minmax(0, 1fr) minmax(320px, 350px);
            align-items: start;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar {
            max-width: 350px;
            width: 100%;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card {
            border-radius: 24px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-body.seller-card-panel {
            padding: 18px 20px 18px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-top.seller-card-top {
            margin: 0 0 14px;
          }

          .listing-detail-page .seller-profile-btn,
          main.listing-detail-page .seller-card .seller-card-top a.seller-profile-btn.seller-profile-btn-top {
            background: transparent;
            background-image: none;
            border: 0;
            border-radius: 0;
            box-shadow: none;
            color: rgba(226, 236, 249, 0.88);
            font-size: 14px;
            font-weight: 650;
            padding: 0;
            width: auto;
          }

          .listing-detail-page .seller-profile-btn svg,
          main.listing-detail-page .seller-card .seller-card-top a.seller-profile-btn.seller-profile-btn-top svg {
            width: 18px;
            height: 18px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-identity-row.seller-identity-row {
            grid-template-columns: 70px minmax(0, 1fr);
            gap: 14px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-detail.seller-avatar-detail,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-img.seller-avatar-img {
            width: 70px;
            height: 70px;
            border-radius: 14px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-name-row.seller-name-row strong {
            font-size: 22px;
            line-height: 1.08;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
            font-size: 14px;
            margin-top: 6px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip svg {
            width: 16px;
            height: 16px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows {
            gap: 7px;
            margin-top: 16px;
            padding-top: 0;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row {
            grid-template-columns: 24px auto 1fr;
            gap: 8px;
            font-size: 14px;
            line-height: 1.05;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row svg {
            width: 18px;
            height: 18px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row strong {
            font-size: 14px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged {
            gap: 10px;
            margin-top: 18px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact {
            height: 42px;
            min-height: 42px;
            border-radius: 12px;
            font-size: 15px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged svg {
            width: 19px;
            height: 19px;
          }
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows,
        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row {
          background: transparent;
          background-color: transparent;
          background-image: none;
          border: 0;
          box-shadow: none;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows {
          border-top: 0;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row::before,
        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row::after,
        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows::before,
        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows::after {
          display: none;
          content: none;
        }

        @media (max-width: 420px) {
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-name-row.seller-name-row strong {
            font-size: 30px;
            line-height: 1.08;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
            font-size: 16px;
            line-height: 1.15;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip svg {
            width: 18px;
            height: 18px;
          }
        }

        /* Listing page reference polish, Finnish content only */
        main.listing-detail-page {
          background:
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 10px),
            radial-gradient(900px 520px at 18% 0%, rgba(20, 72, 122, 0.3), transparent 64%),
            linear-gradient(180deg, #06111e 0%, #020912 100%);
        }

        main.listing-detail-page .container {
          max-width: 1240px;
          padding: 22px 20px 54px;
        }

        body main.page.listing-detail-page.listing-detail-page section.layout.layout {
          grid-template-columns: minmax(0, 780px) minmax(320px, 350px);
          gap: 18px;
          justify-content: center;
        }

        main.listing-detail-page .main {
          background:
            radial-gradient(100% 80% at 10% 0%, rgba(33, 81, 130, 0.34), transparent 56%),
            linear-gradient(180deg, #061d39 0%, #031425 100%);
          border: 1px solid rgba(128, 167, 210, 0.28);
          border-radius: 22px;
          box-shadow: 0 24px 58px rgba(0, 8, 20, 0.38);
          overflow: hidden;
          padding: 26px;
        }

        main.listing-detail-page .listing-featured-pill {
          align-items: center;
          border: 1px solid rgba(255, 141, 24, 0.72);
          border-radius: 999px;
          color: #ff9a1f;
          display: inline-flex;
          font-size: 12px;
          font-weight: 900;
          gap: 8px;
          margin: 0 0 12px;
          padding: 6px 12px;
          text-transform: uppercase;
          width: fit-content;
        }

        main.listing-detail-page .listing-featured-pill svg {
          width: 14px;
          height: 14px;
        }

        main.listing-detail-page .title-row {
          margin-bottom: 18px;
        }

        main.listing-detail-page .title-row h1 {
          color: #ffffff;
          font-size: 30px;
          font-weight: 900;
          letter-spacing: 0;
          line-height: 1.1;
        }

        main.listing-detail-page .desktop-image-meta {
          color: rgba(230, 239, 249, 0.86);
          font-size: 14px;
          font-weight: 750;
          margin: 0 0 18px;
          padding: 0;
        }

        main.listing-detail-page .desktop-image-meta strong {
          color: #ffae52;
          font-size: 14px;
          font-weight: 900;
        }

        main.listing-detail-page .image-wrapper {
          background: #111923;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          margin: 0 -26px;
        }

        main.listing-detail-page .main-img-button,
        main.listing-detail-page .main-img {
          height: min(54vh, 520px);
          min-height: 420px;
        }

        main.listing-detail-page .desktop-image-thumbs {
          display: flex;
          gap: 12px;
          margin: -86px 0 18px;
          padding: 0 18px;
          position: relative;
          z-index: 8;
        }

        main.listing-detail-page .desktop-image-thumbs button {
          background: rgba(8, 18, 32, 0.78);
          border: 1px solid rgba(147, 176, 209, 0.32);
          border-radius: 8px;
          cursor: pointer;
          height: 72px;
          overflow: hidden;
          padding: 0;
          width: 118px;
        }

        main.listing-detail-page .desktop-image-thumbs button.active {
          border-color: #ff9418;
        }

        main.listing-detail-page .desktop-image-thumbs img {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        main.listing-detail-page .price-actions-row {
          border-bottom: 1px solid rgba(150, 181, 215, 0.24);
          margin: 0 -26px;
          padding: 20px 26px;
        }

        main.listing-detail-page .price-display {
          color: #ffffff;
          font-size: 32px;
          font-weight: 950;
        }

        main.listing-detail-page .description-card {
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(150, 181, 215, 0.2);
          border-radius: 0;
          box-shadow: none;
          margin: 0 -26px;
          padding: 0 26px;
        }

        main.listing-detail-page .listing-section-toggle {
          color: #ffffff;
          font-size: 15px;
          font-weight: 900;
          min-height: 44px;
          padding: 0;
        }

        main.listing-detail-page .listing-section-content {
          color: rgba(235, 243, 252, 0.9);
          padding: 0 0 20px;
        }

        main.listing-detail-page .listing-fact-grid span {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: rgba(235, 243, 252, 0.9);
        }

        main.listing-detail-page .listing-fact-grid strong {
          color: rgba(255, 255, 255, 0.62);
        }

        @media (max-width: 900px) {
          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            grid-template-columns: 1fr;
          }

          main.listing-detail-page .main {
            padding: 18px;
          }

          main.listing-detail-page .image-wrapper,
          main.listing-detail-page .price-actions-row,
          main.listing-detail-page .description-card {
            margin-left: -18px;
            margin-right: -18px;
          }

          main.listing-detail-page .desktop-image-thumbs {
            display: none;
          }

          main.listing-detail-page .main-img-button,
          main.listing-detail-page .main-img {
            height: min(62vh, 520px);
            min-height: 320px;
          }
        }

        /* Final listing page reference v2 */
        html,
        body {
          background: #030b14;
          overflow-x: hidden;
        }

        body main.page.listing-detail-page.listing-detail-page {
          color: #f8fbff;
          overflow-x: hidden;
        }

        body main.page.listing-detail-page.listing-detail-page .container.container {
          box-sizing: border-box;
          max-width: 1220px;
          padding: 20px 20px 52px;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page section.layout.layout {
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(0, 760px) minmax(320px, 350px);
          justify-content: center;
          max-width: 1128px;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .main.main {
          background:
            radial-gradient(820px 420px at 12% 0%, rgba(37, 86, 137, 0.34), transparent 58%),
            linear-gradient(180deg, #061d39 0%, #031426 100%);
          border: 1px solid rgba(121, 157, 198, 0.28);
          border-radius: 20px;
          box-shadow: 0 24px 68px rgba(0, 6, 16, 0.42);
          box-sizing: border-box;
          overflow: hidden;
          padding: 24px 26px 0;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-featured-pill.listing-featured-pill {
          border-color: rgba(255, 139, 23, 0.82);
          color: #ff9c25;
          font-size: 12px;
          height: 30px;
          margin-bottom: 12px;
          padding: 0 13px;
        }

        body main.page.listing-detail-page.listing-detail-page .title-row.title-row {
          margin: 0 0 24px;
        }

        body main.page.listing-detail-page.listing-detail-page .title-row.title-row h1 {
          color: #ffffff;
          font-size: 31px;
          font-weight: 950;
          line-height: 1.08;
          margin: 0;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
          color: rgba(232, 241, 251, 0.9);
          font-size: 14px;
          font-weight: 800;
          gap: 14px;
          margin: 0 0 22px;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta strong {
          color: #ffae52;
          font-size: 14px;
          font-weight: 950;
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
          background: #101820;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          margin: 0 -26px;
          overflow: hidden;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
        body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
          height: 520px;
          min-height: 520px;
          max-height: 520px;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
          object-fit: cover;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .image-badge.image-badge {
          background: rgba(4, 12, 22, 0.78);
          border: 1px solid rgba(219, 232, 247, 0.26);
          color: #ffffff;
          left: 24px;
          top: 18px;
        }

        body main.page.listing-detail-page.listing-detail-page .image-zoom-button.image-zoom-button {
          background: rgba(4, 12, 22, 0.72);
          border: 1px solid rgba(219, 232, 247, 0.32);
          color: #ffffff;
          right: 24px;
          top: 18px;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
          display: flex;
          gap: 12px;
          margin: -84px 0 16px;
          padding: 0 18px;
          position: relative;
          z-index: 8;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs button {
          background: rgba(5, 14, 26, 0.86);
          border: 1px solid rgba(139, 169, 205, 0.36);
          border-radius: 8px;
          box-shadow: none;
          height: 74px;
          width: 124px;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs button.active {
          border-color: #ff9418;
        }

        body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
          border-bottom: 1px solid rgba(139, 169, 205, 0.24);
          margin: 0 -26px;
          padding: 20px 26px 18px;
        }

        body main.page.listing-detail-page.listing-detail-page .image-actions.image-actions {
          justify-content: space-between;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .price-display.price-display {
          color: #ffffff;
          font-size: 34px;
          font-weight: 950;
          line-height: 1;
        }

        body main.page.listing-detail-page.listing-detail-page .icon-btn.icon-btn {
          background: rgba(7, 20, 36, 0.84);
          border: 1px solid rgba(148, 180, 215, 0.3);
          border-radius: 10px;
          color: #ffffff;
        }

        body main.page.listing-detail-page.listing-detail-page .description-card.description-card {
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(139, 169, 205, 0.22);
          border-radius: 0;
          box-shadow: none;
          margin: 0 -26px;
          padding: 0 26px;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-section-toggle.listing-section-toggle {
          background: transparent;
          color: #ffffff;
          font-size: 15px;
          font-weight: 900;
          min-height: 46px;
          padding: 0;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-section-content.listing-section-content {
          color: rgba(237, 244, 252, 0.92);
          padding-bottom: 22px;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid {
          gap: 10px;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid span {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-extra-card.listing-extra-card::after,
        body main.page.listing-detail-page.listing-detail-page .listing-facts-card.listing-facts-card::after {
          content: none;
          display: none;
        }

        @media (max-width: 1100px) {
          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            grid-template-columns: minmax(0, 1fr);
            max-width: 780px;
          }
        }

        @media (max-width: 760px) {
          body main.page.listing-detail-page.listing-detail-page .container.container {
            padding: 14px 12px 42px;
          }

          body main.page.listing-detail-page.listing-detail-page .main.main {
            border-radius: 16px;
            padding: 18px 18px 0;
          }

          body main.page.listing-detail-page.listing-detail-page .title-row.title-row h1 {
            font-size: 24px;
          }

          body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper,
          body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row,
          body main.page.listing-detail-page.listing-detail-page .description-card.description-card {
            margin-left: -18px;
            margin-right: -18px;
          }

          body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
          body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
            height: 330px;
            min-height: 330px;
            max-height: 330px;
          }
        }

        /* Final reference match: page scale and section proportions */
        @media (min-width: 1281px) {
          body main.page.listing-detail-page.listing-detail-page .container.container {
            max-width: 1240px;
            padding: 20px 20px 54px;
          }

          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            gap: 18px;
            grid-template-columns: 780px 390px;
            max-width: 1188px;
          }

          body main.page.listing-detail-page.listing-detail-page .main.main {
            border-radius: 20px;
            padding: 26px 26px 0;
          }

          body main.page.listing-detail-page.listing-detail-page .title-row.title-row h1 {
            font-size: 32px;
            line-height: 1.08;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
            margin-bottom: 20px;
          }

          body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
            margin-left: -26px;
            margin-right: -26px;
          }

          body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
          body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
            height: 520px;
            min-height: 520px;
            max-height: 520px;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
            display: flex;
            gap: 12px;
            margin: -86px 0 16px;
            padding: 0 18px;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs button {
            height: 74px;
            width: 124px;
          }

          body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
            margin-left: -26px;
            margin-right: -26px;
            padding: 20px 26px;
          }

          body main.page.listing-detail-page.listing-detail-page .price-stack.price-stack {
            display: grid;
            gap: 6px;
          }

          body main.page.listing-detail-page.listing-detail-page .price-display.price-display {
            font-size: 34px;
          }

          body main.page.listing-detail-page.listing-detail-page .price-subline.price-subline {
            color: rgba(229, 239, 250, 0.78);
            display: block;
            font-size: 14px;
            font-weight: 650;
          }

          body main.page.listing-detail-page.listing-detail-page .description-card.description-card {
            margin-left: -26px;
            margin-right: -26px;
            padding-left: 26px;
            padding-right: 26px;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-section-content.listing-section-content p {
            color: rgba(238, 245, 253, 0.94);
            font-size: 15px;
            line-height: 1.55;
            max-width: 600px;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar {
            max-width: 390px;
            width: 390px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card {
            border-radius: 20px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-body.seller-card-panel {
            padding: 32px 26px 28px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-top.seller-card-top {
            margin-bottom: 26px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-identity-row.seller-identity-row {
            grid-template-columns: 102px minmax(0, 1fr);
            gap: 22px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-detail.seller-avatar-detail,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-img.seller-avatar-img {
            width: 102px;
            height: 102px;
            border-radius: 16px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-name-row.seller-name-row strong {
            font-size: 26px;
            line-height: 1.1;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
            font-size: 16px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows {
            gap: 16px;
            margin-top: 30px;
            padding-top: 0;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row {
            font-size: 16px;
            grid-template-columns: 26px auto 1fr;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row strong {
            font-size: 16px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged {
            gap: 14px;
            margin-top: 30px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact {
            height: 56px;
            min-height: 56px;
            border-radius: 10px;
            font-size: 18px;
          }
        }

        /* Final reference match v3: responsive scale parity */
        @media (min-width: 760px) and (max-width: 1280px) {
          body main.page.listing-detail-page.listing-detail-page .container.container {
            max-width: 940px;
            padding: 18px 18px 48px;
          }

          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            display: grid;
            gap: 14px;
            grid-template-columns: minmax(0, 780px);
            justify-content: center;
            max-width: 780px;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar {
            position: static;
            width: 100%;
            max-width: 780px;
            min-width: 0;
          }

          body main.page.listing-detail-page.listing-detail-page .main.main {
            border-radius: 16px;
            padding: 24px 20px 0;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-featured-pill.listing-featured-pill {
            font-size: 11px;
            height: 26px;
            margin-bottom: 10px;
          }

          body main.page.listing-detail-page.listing-detail-page .title-row.title-row h1 {
            font-size: 28px;
            line-height: 1.08;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
            font-size: 13px;
            margin-bottom: 18px;
          }

          body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
            margin-left: -20px;
            margin-right: -20px;
          }

          body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
          body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
            height: 420px;
            min-height: 420px;
            max-height: 420px;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
            margin: -72px 0 14px;
            padding: 0 14px;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs button {
            height: 62px;
            width: 98px;
          }

          body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
            margin-left: -20px;
            margin-right: -20px;
            padding: 18px 20px;
          }

          body main.page.listing-detail-page.listing-detail-page .price-display.price-display {
            font-size: 30px;
          }

          body main.page.listing-detail-page.listing-detail-page .description-card.description-card {
            margin-left: -20px;
            margin-right: -20px;
            padding-left: 20px;
            padding-right: 20px;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar {
            min-width: 0;
            max-width: 780px;
            width: 100%;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card {
            border-radius: 16px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-body.seller-card-panel {
            padding: 22px 18px 22px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-top.seller-card-top {
            margin-bottom: 20px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-identity-row.seller-identity-row {
            grid-template-columns: 82px minmax(0, 1fr);
            gap: 16px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-detail.seller-avatar-detail,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-img.seller-avatar-img {
            width: 82px;
            height: 82px;
            border-radius: 14px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-name-row.seller-name-row strong {
            font-size: 22px;
            line-height: 1.08;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
            font-size: 14px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows {
            gap: 12px;
            margin-top: 24px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row strong {
            font-size: 14px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged {
            gap: 12px;
            margin-top: 24px;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact {
            height: 50px;
            min-height: 50px;
            border-radius: 10px;
            font-size: 15px;
          }
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stats-row.seller-stats-row {
          background: transparent;
          background-color: transparent;
          background-image: none;
          border: 0;
          box-shadow: none;
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr 1fr;
          margin: 22px 0 0;
          padding: 0;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-type-corner.seller-type-corner {
          align-items: center;
          background: transparent;
          border: 0;
          box-shadow: none;
          color: rgba(221, 233, 247, 0.86);
          display: inline-flex;
          font-size: 13px;
          font-weight: 800;
          gap: 7px;
          justify-self: start;
          line-height: 1;
          min-width: 0;
          margin-right: auto;
          white-space: nowrap;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-type-corner.seller-type-corner svg {
          color: rgba(221, 233, 247, 0.9);
          flex: 0 0 auto;
          height: 15px;
          width: 15px;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-type-corner.seller-type-corner strong {
          color: #ffffff;
          font-weight: 900;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stats-row.seller-stats-row.seller-stats-row-single {
          grid-template-columns: 1fr;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat {
          align-items: center;
          background: transparent;
          background-color: transparent;
          background-image: none;
          border: 0;
          box-shadow: none;
          display: flex;
          gap: 10px;
          min-width: 0;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat svg {
          flex: 0 0 auto;
          height: 21px;
          width: 21px;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat-rating svg {
          color: #ff9418;
          fill: #ff9418;
          stroke: #ff9418;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat-sales svg {
          color: #f7fbff;
          fill: none;
          stroke: #f7fbff;
          stroke-width: 2.2;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat span {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat strong {
          color: #ffffff;
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat small {
          color: rgba(238, 246, 255, 0.78);
          font-size: 11px;
          font-weight: 650;
          line-height: 1.1;
          white-space: nowrap;
        }

        body main.page.listing-detail-page.listing-detail-page .main.main {
          background: #062142;
          background-image: none;
        }

        body main.page.listing-detail-page.listing-detail-page .title-row.title-row {
          align-items: flex-start;
          display: flex;
          gap: 16px;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-featured-pill.listing-featured-pill {
          display: none;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-top-actions.listing-top-actions {
          display: none;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          gap: 10px;
          justify-content: flex-end;
          margin-left: auto;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn {
          align-items: center;
          background: #082449;
          border: 1px solid rgba(160, 190, 226, 0.34);
          border-radius: 10px;
          box-shadow: none;
          color: rgba(239, 246, 255, 0.92);
          display: inline-flex;
          height: 40px;
          justify-content: center;
          min-height: 40px;
          padding: 0;
          width: 40px;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn:hover {
          background: #0a2b56;
          border-color: rgba(196, 216, 240, 0.48);
        }

        body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row,
        body main.page.listing-detail-page.listing-detail-page .description-card.description-card,
        body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
          background: #062142;
          background-image: none;
        }

        body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
          border-top: 0;
          border-bottom: 1px solid rgba(150, 181, 215, 0.2);
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
          background: #062142;
          background-image: none;
          box-sizing: border-box;
          padding: 0;
        }

        body main.page.listing-detail-page.listing-detail-page .image-actions.image-actions {
          align-items: center;
          display: flex;
          gap: 16px;
          justify-content: space-between;
        }

        body main.page.listing-detail-page.listing-detail-page .price-stack.price-stack {
          margin-right: 0;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-section-content.listing-section-content,
        body main.page.listing-detail-page.listing-detail-page .listing-section-content.listing-section-content p,
        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid,
        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid span {
          background: #062142;
          background-color: #062142;
          background-image: none;
          box-shadow: none;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid span {
          border: 1px solid rgba(150, 181, 215, 0.2);
          border-radius: 10px;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-extra-card.listing-extra-card,
        body main.page.listing-detail-page.listing-detail-page .listing-facts-card.listing-facts-card {
          background: #062142;
          background-image: none;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
          background: #062142;
          background-image: none;
        }

        body:has(main.listing-detail-page.listing-detail-page) .universal-app-topbar {
          border-radius: 0;
        }

        body main.page.listing-detail-page.listing-detail-page .main.main,
        body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card {
          border-radius: 10px;
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper,
        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
        body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
          border-radius: 0;
          overflow: hidden;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button {
          background: #062142;
          box-sizing: border-box;
          display: block;
          max-width: none;
          padding: 0;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
          display: block;
          object-fit: cover;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-image-soft-bg.listing-image-soft-bg {
          display: none;
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper::after {
          content: none;
          display: none;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button > img.main-img.main-img {
          height: 100%;
          max-width: none;
          min-width: 100%;
          object-fit: cover;
          object-position: center center;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button {
          line-height: 0;
          overflow: hidden;
        }

        body main.page.listing-detail-page.listing-detail-page .image-badge.image-badge {
          left: 12px;
          top: 12px;
        }

        body main.page.listing-detail-page.listing-detail-page .image-zoom-button.image-zoom-button {
          right: 12px;
          top: 12px;
        }

        body main.page.listing-detail-page.listing-detail-page .mobile-image-actions.mobile-image-actions {
          display: none;
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
          background: #06111f;
          border-left: 0;
          border-right: 0;
          box-sizing: border-box;
          margin-left: 0;
          margin-right: 0;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button {
          align-items: center;
          background: #06111f;
          display: flex;
          justify-content: center;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button > img.main-img.main-img {
          display: block;
          height: 520px;
          max-height: 520px;
          max-width: 100%;
          min-height: 520px;
          min-width: 0;
          object-fit: contain;
          object-position: center center;
          width: 100%;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
          background: #06111f;
          margin-left: 0;
          margin-right: 0;
          padding-left: 14px;
          padding-right: 14px;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-image-preview.listing-image-preview {
          align-items: center;
          inset: var(--topbar-h, 64px) 0 0;
          padding: 18px 22px 22px;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-image-preview-panel.listing-image-preview-panel {
          max-height: min(calc(100dvh - var(--topbar-h, 64px) - 40px), 820px);
          max-width: min(94vw, 1120px);
        }

        body main.page.listing-detail-page.listing-detail-page .listing-image-preview-panel.listing-image-preview-panel img {
          max-height: min(calc(100dvh - var(--topbar-h, 64px) - 40px), 820px);
          object-fit: contain;
        }

        @media (min-width: 761px) {
          body main.page.listing-detail-page.listing-detail-page .listing-image-preview.listing-image-preview {
            inset: 0;
            padding: 32px clamp(42px, 5vw, 88px);
          }

          body main.page.listing-detail-page.listing-detail-page .listing-image-preview-panel.listing-image-preview-panel {
            background: #020b16;
            height: min(90vh, 920px);
            max-height: min(90vh, 920px);
            max-width: min(92vw, 1500px);
            width: min(92vw, 1500px);
          }

          body main.page.listing-detail-page.listing-detail-page .listing-image-preview-panel.listing-image-preview-panel > img {
            height: 100%;
            max-height: 100%;
            max-width: 100%;
            width: 100%;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-image-preview-arrow-left {
            left: 24px;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-image-preview-arrow-right {
            right: 24px;
          }
        }

        body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
          color: #dbeafe;
        }

        body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip svg {
          color: #8fbfff;
          fill: none;
          stroke: #8fbfff;
        }

        @media (max-width: 760px) {
          body main.page.listing-detail-page.listing-detail-page .container.container {
            padding-left: 10px;
            padding-right: 10px;
          }

          body main.page.listing-detail-page.listing-detail-page .main.main,
          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card {
            border-radius: 8px;
          }

          body main.page.listing-detail-page.listing-detail-page .title-row.title-row {
            margin-bottom: 14px;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            line-height: 1.25;
            margin-bottom: 12px;
          }

          body main.page.listing-detail-page.listing-detail-page .image-actions.image-actions {
            align-items: center;
            display: grid;
            gap: 12px;
            grid-template-columns: minmax(0, 1fr) auto;
          }

          body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
            padding-bottom: 16px;
            padding-top: 16px;
          }

          body main.page.listing-detail-page.listing-detail-page .price-display.price-display {
            font-size: 28px;
            line-height: 1;
          }

          body main.page.listing-detail-page.listing-detail-page .price-subline.price-subline {
            font-size: 11px;
            line-height: 1.25;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions {
            display: flex;
            gap: 8px;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn {
            border-radius: 8px;
            height: 38px;
            min-height: 38px;
            width: 38px;
          }

          body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
          body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
            height: 280px;
            min-height: 280px;
            max-height: 280px;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid {
            grid-template-columns: 1fr;
          }
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
          aspect-ratio: auto;
          box-sizing: border-box;
          height: auto;
          min-height: 0;
          padding-left: 0;
          padding-right: 0;
          padding: 0;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
          box-sizing: border-box;
          margin-left: 0;
          margin-right: 0;
          max-width: none;
          min-width: 100%;
          width: 100%;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
          background: transparent;
          background-color: transparent;
          background-image: none;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta) {
          align-items: center;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: auto auto auto minmax(0, 1fr) auto;
          padding-left: 0;
          padding-right: 0;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta > span:first-child) {
          grid-column: 1;
          margin-left: 0;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta strong) {
          grid-column: 5;
          grid-row: 1;
          margin-left: auto;
          margin-right: clamp(18px, 2.6vw, 30px);
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta strong),
        body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta strong {
          background: transparent;
          border: 0;
          box-shadow: none;
          color: #ff8a1c;
          outline: 0;
          padding: 0;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
          align-items: center;
          gap: 8px;
          justify-content: flex-start;
          margin: -64px 0 10px;
          padding: 0 18px;
          pointer-events: none;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button) {
          background: rgba(4, 13, 25, 0.48);
          border: 1px solid rgba(255, 148, 24, 0.72);
          border-radius: 6px;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
          height: 42px;
          overflow: hidden;
          pointer-events: auto;
          width: 68px;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs img) {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        @media (min-width: 641px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            background: #06111f;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button) {
            align-items: center;
            background: #06111f;
            display: flex;
            justify-content: center;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            height: 100%;
            object-fit: contain;
            object-position: center center;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            background: #062142;
            border-bottom: 1px solid rgba(143, 191, 255, 0.14);
            display: flex;
            gap: 10px;
            justify-content: flex-start;
            margin: 0 -26px 0;
            overflow: hidden;
            padding: 14px 26px 16px;
            pointer-events: auto;
            scrollbar-width: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button) {
            background: rgba(2, 10, 20, 0.56);
            border: 1px solid rgba(143, 191, 255, 0.32);
            border-radius: 8px;
            box-shadow: none;
            flex: 1 1 0;
            height: clamp(44px, 8vw, 70px);
            max-width: 94px;
            min-width: 0;
            width: auto;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button.active) {
            border-color: #ff8a1c;
            box-shadow: 0 0 0 1px rgba(255, 138, 28, 0.24);
          }
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-subline.price-subline) {
          display: none;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
          display: flex;
          justify-content: flex-end;
          padding-bottom: 18px;
          padding-top: 16px;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-actions.image-actions) {
          align-items: center;
          display: flex;
          gap: 18px;
          justify-content: flex-end;
          width: auto;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-stack.price-stack) {
          align-items: flex-end;
          text-align: right;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions) {
          display: flex;
          gap: 10px;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.icon-btn.icon-btn.icon-saved) {
          background: rgba(255, 122, 26, 0.18);
          border-color: #ff8a1c;
          color: #ff8a1c;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.icon-btn.icon-btn.icon-saved svg) {
          color: #ff8a1c;
          fill: #ff8a1c;
          stroke: #ff8a1c;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow.gallery-arrow) {
          align-items: center;
          background: rgba(3, 12, 24, 0.74);
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 999px;
          color: #ffffff;
          display: inline-flex;
          height: 42px;
          justify-content: center;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 42px;
          z-index: 9;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-left.gallery-arrow-left) {
          left: 14px;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-right.gallery-arrow-right) {
          right: 14px;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip) {
          color: #32f58a;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip svg) {
          color: #32f58a;
          fill: none;
          stroke: #32f58a;
        }

        @media (max-width: 760px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta) {
            display: flex;
            padding-left: 0;
            padding-right: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta > span:first-child) {
            margin-left: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            margin: -56px 0 8px;
            padding-left: 12px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button) {
            height: 38px;
            width: 62px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            justify-content: stretch;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-actions.image-actions) {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-stack.price-stack) {
            align-items: flex-start;
            text-align: left;
          }
        }

        @media (max-width: 640px) {
          :global(body) {
            background: #07111c;
          }

          :global(body:has(main.listing-detail-page.listing-detail-page) .universal-app-topbar) {
            background: #07111c;
            border-bottom: 1px solid rgba(143, 191, 255, 0.12);
            border-radius: 0;
            height: 76px;
            padding: 12px 12px;
          }

          :global(body:has(main.listing-detail-page.listing-detail-page) .universal-return-button) {
            height: 44px;
            min-width: 44px;
            overflow: hidden;
            padding: 0;
            width: 44px;
          }

          :global(body:has(main.listing-detail-page.listing-detail-page) .universal-return-button span) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) {
            background: #07111c;
            padding: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.container.container) {
            max-width: 460px;
            padding: 16px 10px 36px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.layout.layout) {
            display: flex;
            flex-direction: column;
            gap: 18px;
            max-width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main.main) {
            background: #062142;
            border: 1px solid rgba(75, 139, 205, 0.58);
            border-radius: 8px;
            box-shadow: none;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            border: 0;
            border-radius: 0;
            margin: 0;
            order: 1;
            overflow: hidden;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img.main-img) {
            height: clamp(280px, 70vw, 340px);
            max-height: 340px;
            min-height: 280px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-badge.image-badge) {
            background: rgba(3, 12, 24, 0.82);
            border: 1px solid rgba(255, 255, 255, 0.24);
            border-radius: 6px;
            font-size: 12px;
            font-weight: 950;
            left: 10px;
            min-height: 24px;
            padding: 0 7px;
            top: 10px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-zoom-button.image-zoom-button) {
            height: 42px;
            right: 12px;
            top: 12px;
            width: 42px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row) {
            background: #04182d;
            border: 1px solid rgba(143, 191, 255, 0.16);
            border-left: 0;
            border-right: 0;
            margin: 0;
            order: 2;
            padding: 16px 18px 14px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-left.title-left) {
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id) {
            align-items: baseline;
            color: #d7e5f7;
            display: flex;
            font-size: 12px;
            font-weight: 900;
            gap: 8px;
            justify-content: flex-start;
            margin: 0 0 5px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id strong) {
            color: #ffffff;
            display: inline-flex;
            font-size: 20px;
            font-weight: 950;
            line-height: 1;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row h1) {
            color: #ffffff;
            font-size: 24px;
            font-weight: 950;
            letter-spacing: -0.03em;
            line-height: 1.08;
            margin: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta) {
            align-items: center;
            background: #062142;
            border-bottom: 1px solid rgba(143, 191, 255, 0.2);
            color: #dbeafe;
            display: flex;
            flex-wrap: wrap;
            font-size: 14px;
            font-weight: 900;
            gap: 8px;
            line-height: 1.3;
            margin: 0;
            order: 3;
            padding: 18px 18px 12px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta strong) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            background: #062142;
            border-bottom: 1px solid rgba(143, 191, 255, 0.16);
            display: block;
            margin: 0;
            order: 4;
            padding: 20px 18px 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-actions.image-actions) {
            align-items: center;
            display: flex;
            justify-content: space-between;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-stack.price-stack) {
            align-items: flex-start;
            text-align: left;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-display.price-display) {
            color: #ffffff;
            font-size: 28px;
            font-weight: 950;
            line-height: 1;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions) {
            display: flex;
            gap: 10px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn) {
            background: #08284e;
            border: 1px solid rgba(143, 191, 255, 0.42);
            border-radius: 8px;
            height: 40px;
            width: 40px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card) {
            background: #062142;
            border: 0;
            margin: 0;
            order: 5;
            padding: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle) {
            border-bottom: 1px solid rgba(143, 191, 255, 0.16);
            min-height: 62px;
            padding: 0 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content) {
            padding: 16px 18px 22px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(aside.sidebar.sidebar) {
            margin: 0;
            max-width: none;
            position: static;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card) {
            background: #0a2b56;
            border: 1px solid rgba(75, 139, 205, 0.56);
            border-radius: 18px;
            box-shadow: none;
            margin: 0;
            overflow: hidden;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-body.seller-card-panel) {
            padding: 28px 26px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-top.seller-card-top) {
            align-items: center;
            display: flex;
            justify-content: space-between;
            margin: 0 0 28px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-corner.seller-type-corner) {
            font-size: 16px;
            gap: 8px;
            position: static;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-profile-btn-top.seller-profile-btn-top) {
            background: transparent;
            border: 0;
            color: #dbeafe;
            gap: 10px;
            padding: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-identity-row.seller-identity-row) {
            align-items: center;
            display: grid;
            gap: 18px;
            grid-template-columns: 72px minmax(0, 1fr);
            margin-bottom: 30px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-detail.seller-avatar-detail),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-img.seller-avatar-img) {
            border-radius: 10px;
            height: 64px;
            width: 64px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name-row.seller-name-row strong) {
            color: #ffffff;
            font-size: 28px;
            line-height: 1.05;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip) {
            color: #dbeafe;
            font-size: 16px;
            margin-top: 10px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-rows.seller-meta-rows) {
            gap: 16px;
            margin-top: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row) {
            color: #cbd9ec;
            font-size: 18px;
            grid-template-columns: 26px auto minmax(0, 1fr);
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row strong) {
            color: #ffffff;
            font-size: 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-stats-row.seller-stats-row) {
            border-top: 0;
            margin: 24px 0 0;
            padding: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-divider.seller-divider) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged) {
            gap: 14px;
            margin-top: 28px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact) {
            border-radius: 14px;
            font-size: 20px;
            height: 62px;
            min-height: 62px;
          }
        }

        @media (max-width: 640px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main.main),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span) {
            background: #062142;
            background-color: #062142;
            background-image: none;
            box-shadow: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card) {
            border-color: rgba(143, 191, 255, 0.14);
          }

          :global(body) {
            background:
              radial-gradient(circle at 50% -8%, rgba(28, 89, 143, 0.28), transparent 42%),
              #050d17;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) {
            background: transparent;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.container.container) {
            max-width: 430px;
            padding: 12px 8px 36px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main.main) {
            background:
              linear-gradient(180deg, rgba(9, 47, 88, 0.98), rgba(3, 23, 43, 0.98));
            border: 1px solid rgba(76, 144, 214, 0.62);
            border-radius: 20px;
            overflow: hidden;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            background: #06111f;
            border-bottom: 1px solid rgba(143, 191, 255, 0.18);
            margin: 0;
            order: 1;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img.main-img) {
            height: clamp(410px, 105vw, 560px);
            max-height: 560px;
            min-height: 410px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img.main-img) {
            object-fit: contain;
            object-position: center center;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-image-soft-bg.listing-image-soft-bg) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs) {
            align-items: center;
            bottom: 10px;
            display: grid;
            gap: 6px;
            grid-auto-flow: column;
            grid-auto-columns: minmax(34px, 1fr);
            left: 12px;
            overflow-x: visible;
            padding: 0 0 2px;
            position: absolute;
            right: 12px;
            scrollbar-width: none;
            z-index: 8;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs::-webkit-scrollbar) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs button) {
            background: rgba(2, 10, 20, 0.72);
            border: 1px solid rgba(143, 191, 255, 0.35);
            border-radius: 7px;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
            height: clamp(32px, 10vw, 48px);
            max-width: 52px;
            min-width: 0;
            overflow: hidden;
            padding: 0;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs button.active) {
            border-color: #ff8a1c;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs img) {
            height: 100%;
            object-fit: cover;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-badge.image-badge) {
            background: rgba(2, 10, 20, 0.86);
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 999px;
            font-size: 16px;
            height: 42px;
            left: 20px;
            padding: 0 14px;
            top: 22px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-zoom-button.image-zoom-button) {
            background: rgba(2, 10, 20, 0.78);
            border-radius: 999px;
            height: 46px;
            right: 20px;
            top: 22px;
            width: 46px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-actions.mobile-image-actions) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row) {
            background:
              linear-gradient(180deg, rgba(3, 25, 47, 0.98), rgba(4, 31, 58, 0.98));
            border: 0;
            border-bottom: 1px solid rgba(143, 191, 255, 0.16);
            display: grid;
            gap: 18px;
            grid-template-columns: minmax(0, 1fr) auto;
            margin: 0;
            padding: 26px 24px 22px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id) {
            color: #c9d8eb;
            display: block;
            font-size: 15px;
            font-weight: 850;
            letter-spacing: 0.01em;
            margin: 0 0 12px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id strong) {
            color: #ff8a2a;
            display: inline-flex;
            font-size: 13px;
            font-weight: 950;
            line-height: 1;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row h1) {
            font-size: 30px;
            line-height: 1.08;
            max-width: 92%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions) {
            align-items: center;
            display: flex;
            gap: 10px;
            grid-column: 1 / -1;
            justify-content: space-between;
            margin-top: 6px;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-price.mobile-title-price) {
            color: #ffffff;
            display: inline-flex;
            flex: 1 1 auto;
            font-size: 34px;
            font-weight: 950;
            letter-spacing: -0.04em;
            line-height: 1;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions .icon-btn.icon-btn) {
            background: rgba(6, 35, 67, 0.92);
            border: 1px solid rgba(143, 191, 255, 0.34);
            border-radius: 10px;
            color: #ffffff;
            height: 52px;
            width: 52px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta) {
            background: transparent;
            border-bottom: 1px solid rgba(143, 191, 255, 0.16);
            color: #d9e6f7;
            align-items: flex-start;
            flex-direction: column;
            flex-wrap: nowrap;
            font-size: 12px;
            font-weight: 750;
            gap: 3px;
            line-height: 1.2;
            padding: 7px 16px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta > span) {
            white-space: nowrap;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-display.price-display) {
            font-size: 34px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn) {
            background: rgba(6, 35, 67, 0.92);
            border-color: rgba(143, 191, 255, 0.34);
            border-radius: 10px;
            height: 52px;
            width: 52px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn.icon-saved) {
            color: #ff8a1c;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card) {
            background: #062142;
            border: 0;
            border-bottom: 1px solid rgba(143, 191, 255, 0.14);
            box-shadow: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle) {
            background: #062142;
            border: 0;
            color: #ffffff;
            font-size: 18px;
            min-height: 56px;
            outline: none;
            padding: 0 24px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:hover),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:active) {
            background: #062142;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-extra-card.listing-extra-card) {
            margin-top: -8px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus-visible) {
            box-shadow: inset 0 0 0 1px rgba(143, 191, 255, 0.22);
            outline: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle svg),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:hover svg),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus svg),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle svg path) {
            color: #ffffff;
            stroke: #ffffff;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content) {
            background: #062142;
            color: #d9e6f7;
            font-size: 17px;
            line-height: 1.65;
            padding: 0 24px 28px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid) {
            display: grid;
            gap: 16px;
            grid-template-columns: 1fr;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span) {
            align-items: center;
            background: transparent;
            border: 0;
            border-bottom: 1px solid rgba(143, 191, 255, 0.1);
            border-radius: 0;
            display: grid;
            gap: 10px;
            grid-template-columns: minmax(145px, 0.8fr) minmax(0, 1fr);
            padding: 0 0 15px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span:last-child) {
            border-bottom: 0;
            padding-bottom: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid strong) {
            color: #aebfd5;
            font-size: 16px;
            hyphens: none;
            overflow-wrap: normal;
            text-transform: none;
            white-space: normal;
            word-break: normal;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(aside.sidebar.sidebar) {
            margin-top: 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card) {
            background:
              linear-gradient(145deg, rgba(11, 47, 89, 0.98), rgba(3, 22, 41, 0.99));
            border-radius: 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-body.seller-card-panel) {
            padding: 24px 18px 28px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-top.seller-card-top) {
            margin-bottom: 28px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-identity-row.seller-identity-row) {
            grid-template-columns: 98px minmax(0, 1fr);
            gap: 18px;
            margin-bottom: 34px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-detail.seller-avatar-detail),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-img.seller-avatar-img) {
            border-radius: 14px;
            height: 92px;
            width: 92px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name-row.seller-name-row strong) {
            font-size: 25px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip) {
            color: #32f58a;
            font-size: 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip svg) {
            color: #32f58a;
            stroke: #32f58a;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row) {
            font-size: 17px;
            grid-template-columns: 28px 82px minmax(0, 1fr);
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row strong) {
            font-size: 17px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact) {
            border-radius: 10px;
            font-size: 17px;
            height: 54px;
            min-height: 54px;
            padding-left: 16px;
            padding-right: 16px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged svg) {
            height: 19px;
            width: 19px;
          }
        }

        @media (min-width: 641px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content p) {
            background: #062142;
            background-color: #062142;
            background-image: none;
            box-shadow: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            border-bottom: 0;
            margin-bottom: 0;
            padding-bottom: 10px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            background: transparent;
            border-bottom: 0;
            border-top: 0;
            margin-top: -94px;
            padding-bottom: 18px;
            padding-top: 20px;
            pointer-events: none;
            position: relative;
            z-index: 12;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row .icon-btn.icon-btn) {
            pointer-events: auto;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card) {
            border: 0;
            margin-top: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle) {
            border-bottom: 1px solid rgba(143, 191, 255, 0.12);
            outline: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content) {
            border: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus-visible) {
            box-shadow: none;
            outline: none;
          }
        }

        @media (min-width: 641px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            background: rgba(3, 13, 24, 0.78);
            backdrop-filter: blur(8px);
            border-bottom: 1px solid rgba(143, 191, 255, 0.12);
            gap: 8px;
            margin: -68px -26px 0;
            padding: 8px 12px 9px;
            position: relative;
            z-index: 8;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button) {
            background: rgba(226, 232, 240, 0.2);
            border: 1px solid rgba(203, 213, 225, 0.42);
            border-radius: 5px;
            height: 52px;
            max-width: 86px;
            overflow: hidden;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button.active) {
            border-color: #ff8a1c;
            box-shadow: inset 0 0 0 1px rgba(255, 138, 28, 0.45);
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs img) {
            filter: saturate(0.82) contrast(1.04);
            object-fit: cover;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            background: #062142;
            border: 0;
            margin: 0 -26px;
            padding: 16px 26px 18px;
            pointer-events: auto;
            position: relative;
            z-index: 1;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-actions.image-actions) {
            align-items: center;
            display: flex;
            justify-content: space-between;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-stack.price-stack) {
            align-items: flex-start;
            display: grid;
            gap: 7px;
            grid-template-columns: auto auto;
            text-align: left;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.fair-price-badge.fair-price-badge) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.fair-price-badge.fair-price-badge svg) {
            color: #32f58a;
            stroke: #32f58a;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-subline.price-subline) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions) {
            display: flex;
            gap: 10px;
          }
        }

        @media (max-width: 640px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main.main) {
            background: #062142;
            border-color: rgba(76, 144, 214, 0.42);
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            background: #06111f;
            border: 1px solid rgba(76, 144, 214, 0.42);
            border-radius: 16px 16px 0 0;
            margin: 0;
            overflow: hidden;
            position: relative;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button) {
            align-items: center;
            background: #06111f;
            display: flex;
            justify-content: center;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            height: clamp(300px, 82vw, 430px);
            max-height: 430px;
            min-height: 300px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            object-fit: contain;
            object-position: center center;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-image-soft-bg.listing-image-soft-bg),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-badge.image-badge) {
            background: rgba(0, 0, 0, 0.72);
            border: 0;
            border-radius: 0;
            color: #ffffff;
            font-size: 13px;
            font-weight: 900;
            height: 24px;
            left: 0;
            min-height: 24px;
            padding: 0 7px;
            top: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-zoom-button.image-zoom-button) {
            align-items: center;
            background: rgba(0, 0, 0, 0.62);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 999px;
            color: #ffffff;
            height: 42px;
            justify-content: center;
            padding: 0;
            right: 12px;
            top: 12px;
            width: 42px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-actions.mobile-image-actions) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow.gallery-arrow) {
            background: rgba(2, 10, 20, 0.62);
            border: 1px solid rgba(255, 255, 255, 0.18);
            height: 38px;
            opacity: 0.92;
            width: 38px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-left.gallery-arrow-left) {
            left: 12px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-right.gallery-arrow-right) {
            right: 12px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row) {
            padding-top: 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row h1) {
            font-size: clamp(24px, 7vw, 30px);
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions) {
            margin-top: 14px;
          }
        }

        @media (max-width: 640px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            background: #06111f;
            border: 1px solid rgba(76, 144, 214, 0.42);
            border-radius: 16px 16px 0 0;
            margin: 0;
            overflow: hidden;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button) {
            background: #06111f;
            padding: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            height: clamp(315px, 86vw, 430px);
            max-height: 430px;
            min-height: 315px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            background: #06111f;
            object-fit: contain;
            object-position: center center;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-actions.mobile-image-actions) {
            display: none;
            visibility: hidden;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs) {
            align-items: center;
            background: rgba(2, 12, 24, 0.86);
            border-top: 1px solid rgba(143, 191, 255, 0.14);
            bottom: 0;
            display: flex;
            gap: 6px;
            left: 0;
            overflow-x: auto;
            padding: 7px 10px 8px;
            position: absolute;
            right: 0;
            scrollbar-width: none;
            z-index: 12;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs::-webkit-scrollbar) {
            display: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs button) {
            aspect-ratio: 1.18 / 1;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(203, 213, 225, 0.32);
            border-radius: 5px;
            flex: 1 1 0;
            height: 46px;
            max-width: 68px;
            min-width: 44px;
            overflow: hidden;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs button.active) {
            border-color: #ff8a1c;
            box-shadow: inset 0 0 0 1px rgba(255, 138, 28, 0.5);
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs img) {
            height: 100%;
            object-fit: cover;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-badge.image-badge) {
            border-radius: 999px;
            left: 10px;
            top: 10px;
            z-index: 13;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-zoom-button.image-zoom-button) {
            height: 38px;
            right: 10px;
            top: 10px;
            width: 38px;
            z-index: 13;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow.gallery-arrow) {
            background: rgba(2, 10, 20, 0.68);
            border: 1px solid rgba(255, 255, 255, 0.18);
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
            height: 36px;
            width: 36px;
            z-index: 13;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-left.gallery-arrow-left) {
            left: 10px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-right.gallery-arrow-right) {
            right: 10px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row) {
            border-bottom: 1px solid rgba(143, 191, 255, 0.14);
            background: #062142;
            display: block;
            padding: 18px 22px 20px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id) {
            align-items: center;
            color: rgba(226, 232, 240, 0.9);
            display: inline-flex;
            font-size: 13px;
            font-weight: 900;
            gap: 6px;
            justify-content: flex-end;
            letter-spacing: 0.01em;
            margin: 0 0 8px;
            text-align: right;
            width: 100%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id strong) {
            color: #ff8a2a;
            display: inline-flex;
            font-size: 13px;
            font-weight: 950;
            line-height: 1;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row h1) {
            font-size: clamp(22px, 6vw, 28px);
            line-height: 1.08;
            max-width: 92%;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions) {
            align-items: center;
            display: flex;
            gap: 10px;
            justify-content: flex-start;
            margin-top: 16px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-price.mobile-title-price) {
            font-size: clamp(28px, 7.4vw, 34px);
            line-height: 1;
            margin-right: auto;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions .icon-btn.icon-btn) {
            border-radius: 10px;
            height: 44px;
            min-width: 44px;
            width: 44px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card) {
            padding: 18px 18px 24px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-top.seller-card-top) {
            align-items: center;
            gap: 8px;
            margin-bottom: 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-badge.seller-type-badge),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-profile-link.seller-profile-link) {
            font-size: 15px;
            line-height: 1.1;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-main.seller-main) {
            gap: 16px;
            grid-template-columns: 92px minmax(0, 1fr);
            margin-bottom: 28px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-logo.seller-logo) {
            height: 84px;
            width: 84px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name.seller-name),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card h2) {
            font-size: 25px;
            line-height: 1.08;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-text.verified-text),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-verified.seller-verified) {
            color: #32f58a;
            font-size: 17px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta.seller-meta) {
            gap: 14px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row) {
            column-gap: 12px;
            grid-template-columns: 26px 86px minmax(0, 1fr);
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row span),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row strong) {
            font-size: 16px;
            line-height: 1.15;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-stats.seller-stats) {
            margin: 24px 0 24px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact) {
            height: 54px;
            min-height: 54px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-detail.seller-avatar-detail),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-img.seller-avatar-img) {
            border-radius: 12px;
            height: 72px;
            width: 72px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name-row.seller-name-row strong) {
            font-size: 22px;
            line-height: 1.08;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-profile-btn-top.seller-profile-btn-top) {
            border-radius: 9px;
            font-size: 12px;
            gap: 5px;
            min-height: 32px;
            padding: 0 8px;
            white-space: nowrap;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-profile-btn-top.seller-profile-btn-top svg) {
            height: 14px;
            width: 14px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-company-verified-line.seller-company-verified-line) {
            background: transparent;
            border: 0;
            box-shadow: none;
            color: #4ade80;
            font-weight: 950;
            padding-top: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-company-verified-line.seller-company-verified-line span),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-company-verified-line.seller-company-verified-line svg) {
            color: #4ade80;
            stroke: #4ade80;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-corner.is-company-verified.is-company-verified) {
            color: #4ade80;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-corner.is-company-verified.is-company-verified strong),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-corner.is-company-verified.is-company-verified svg) {
            color: #4ade80;
            stroke: #4ade80;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number) {
            background: linear-gradient(180deg, rgba(5, 25, 46, 0.98), rgba(3, 15, 30, 0.98));
            border: 1px solid rgba(255, 122, 26, 0.82);
            border-radius: 12px;
            color: #ffffff;
            font-size: 14px;
            font-weight: 950;
          }
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-corner.is-company-verified.is-company-verified),
        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-corner.is-company-verified.is-company-verified strong) {
          color: #4ade80;
          -webkit-text-fill-color: #4ade80;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-corner.is-company-verified.is-company-verified svg) {
          color: #4ade80;
          stroke: #4ade80;
        }

        @media (max-width: 760px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid) {
            gap: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span) {
            align-items: start;
            column-gap: 14px;
            grid-template-columns: minmax(108px, 0.42fr) minmax(0, 1fr);
            min-width: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span > strong) {
            font-size: clamp(13px, 3.6vw, 15px);
            line-height: 1.25;
            min-width: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span) {
            font-size: clamp(14px, 4vw, 17px);
            line-height: 1.35;
            overflow-wrap: anywhere;
            word-break: normal;
          }
        }

        @media (max-width: 360px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span) {
            grid-template-columns: 1fr;
            row-gap: 6px;
          }
        }

        /* Definitive responsive seller-column layout. Keep this last. */
        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card),
        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card *) {
          box-sizing: border-box;
          min-width: 0;
          writing-mode: horizontal-tb;
          text-orientation: mixed;
          word-break: normal;
          hyphens: none;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name-row.seller-name-row strong),
        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row strong),
        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row span) {
          max-width: 100%;
          overflow-wrap: break-word;
          white-space: normal;
        }

        @media (min-width: 1024px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.container.container) {
            box-sizing: border-box;
            width: min(calc(100% - 40px), 1240px);
            max-width: 1240px;
            margin-inline: auto;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.layout.layout) {
            display: grid;
            grid-template-columns: minmax(0, 1fr) clamp(340px, 30vw, 390px);
            align-items: start;
            gap: clamp(18px, 2vw, 24px);
            width: 100%;
            max-width: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(aside.sidebar.sidebar),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card) {
            position: static;
            align-self: start;
            width: 100%;
            min-width: 340px;
            max-width: 390px;
            margin: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-identity-row.seller-identity-row) {
            display: grid;
            grid-template-columns: 92px minmax(0, 1fr);
            align-items: center;
            gap: 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name-row.seller-name-row strong) {
            display: block;
            width: 100%;
            font-size: clamp(22px, 2vw, 26px);
            line-height: 1.1;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row) {
            display: grid;
            grid-template-columns: 26px 86px minmax(0, 1fr);
            align-items: start;
            gap: 10px;
          }
        }

        @media (min-width: 641px) and (max-width: 1023px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.container.container) {
            box-sizing: border-box;
            width: min(calc(100% - 32px), 900px);
            max-width: 900px;
            margin-inline: auto;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.layout.layout) {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 18px;
            width: 100%;
            max-width: none;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(aside.sidebar.sidebar),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card) {
            position: static;
            width: 100%;
            min-width: 0;
            max-width: none;
            margin: 0;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-identity-row.seller-identity-row) {
            display: grid;
            grid-template-columns: 92px minmax(0, 1fr);
            align-items: center;
            gap: 18px;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row) {
            display: grid;
            grid-template-columns: 26px minmax(90px, auto) minmax(0, 1fr);
            align-items: start;
            gap: 10px;
          }
        }

        /* Active final seller-card scale: match the wide reference card. */
        @media (min-width: 820px) {
          body main.page.listing-detail-page.listing-detail-page .container.container {
            box-sizing: border-box;
            width: min(calc(100% - 24px), 1240px);
            max-width: 1240px;
            margin-inline: auto;
          }

          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) clamp(360px, 31vw, 390px);
            align-items: start;
            gap: clamp(16px, 2vw, 24px);
            width: 100%;
            max-width: none;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar,
          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card {
            position: static;
            align-self: start;
            box-sizing: border-box;
            width: 100%;
            min-width: 360px;
            max-width: 390px;
            margin: 0;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            align-content: start;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar > * {
            grid-column: 1 / -1;
            width: 100%;
            max-width: none;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card,
          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card * {
            min-width: 0;
            writing-mode: horizontal-tb;
            text-orientation: mixed;
            word-break: normal;
            hyphens: none;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-body.seller-card-panel {
            display: block;
            padding: 26px 22px 24px;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-top.seller-card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 24px;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-identity-row.seller-identity-row {
            display: grid;
            grid-template-columns: 102px minmax(0, 1fr);
            align-items: center;
            gap: 24px;
            margin-bottom: 26px;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-detail.seller-avatar-detail,
          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-img.seller-avatar-img {
            width: 102px;
            height: 102px;
            border-radius: 16px;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-name-row.seller-name-row strong {
            display: block;
            width: 100%;
            max-width: 100%;
            font-size: clamp(24px, 2.2vw, 28px);
            line-height: 1.08;
            overflow-wrap: break-word;
            white-space: normal;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows {
            display: grid;
            gap: 14px;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row {
            display: grid;
            grid-template-columns: 26px max-content minmax(0, 1fr);
            align-items: start;
            gap: 10px;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row strong,
          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row span {
            max-width: 100%;
            overflow-wrap: break-word;
            white-space: normal;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stats-row.seller-stats-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-top: 24px;
          }

          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged,
          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged > * {
            width: 100%;
            max-width: none;
          }
        }

        @media (min-width: 820px) and (max-width: 1199px) {
          body main.page.listing-detail-page.listing-detail-page .title-row.title-row {
            min-height: 0;
            height: auto;
            padding: 18px 20px;
            margin-bottom: 16px;
            gap: 12px;
          }

          body main.page.listing-detail-page.listing-detail-page .title-row.title-row h1 {
            max-width: min(100%, 520px);
            font-size: clamp(23px, 2.8vw, 28px);
            line-height: 1.08;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
            margin-bottom: 14px;
          }
        }

        @media (min-width: 641px) and (max-width: 819px) {
          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 18px;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar,
          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card {
            position: static;
            width: 100%;
            min-width: 0;
            max-width: none;
            margin: 0;
          }
        }

        /* Keep the shared no-photo avatar visible after all responsive seller-card rules. */
        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card
          .seller-avatar-detail.seller-avatar-detail:not(:has(img)) {
          position: relative;
          overflow: hidden;
          background: #25282c;
          background-image: none;
          border: 2px solid #ff861d;
          box-shadow: none;
          color: #ffffff;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card
          .seller-avatar-detail.seller-avatar-detail:not(:has(img))
          > .seller-avatar-initial.seller-avatar-initial {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          background: transparent !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 950;
          line-height: 1;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card
          .seller-avatar-detail.seller-avatar-detail
          > img.seller-avatar-img.seller-avatar-img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          max-width: none;
          max-height: none;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: inherit;
          background: transparent;
          object-fit: cover;
          object-position: center center;
        }

        /* Vehicle facts use a compact specification table instead of cards. */
        body main.page.listing-detail-page.listing-detail-page
          .listing-fact-grid.listing-fact-grid.listing-vehicle-facts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: clamp(18px, 3vw, 36px);
          row-gap: 8px;
          margin: 0;
          padding: 4px 0 2px;
        }

        body main.page.listing-detail-page.listing-detail-page
          .listing-fact-grid.listing-fact-grid.listing-vehicle-facts > span {
          align-items: baseline;
          display: grid;
          grid-template-columns: minmax(108px, 0.62fr) minmax(0, 1fr);
          gap: 10px;
          min-height: 0;
          margin: 0;
          padding: 0;
          background: transparent;
          background-color: transparent;
          background-image: none;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          color: #edf4fc;
          font-size: 14px;
          font-weight: 850;
          line-height: 1.35;
        }

        body main.page.listing-detail-page.listing-detail-page
          .listing-fact-grid.listing-fact-grid.listing-vehicle-facts > span > strong {
          color: #9fb0c2;
          font-size: 13px;
          font-weight: 750;
          letter-spacing: 0;
          line-height: 1.35;
          text-transform: none;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-fact-grid.listing-fact-grid.listing-vehicle-facts > span {
          color: #16232c;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-fact-grid.listing-fact-grid.listing-vehicle-facts > span > strong {
          color: #536572;
        }

        @media (max-width: 760px) {
          body main.page.listing-detail-page.listing-detail-page
            .listing-fact-grid.listing-fact-grid.listing-vehicle-facts {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          body main.page.listing-detail-page.listing-detail-page
            .listing-fact-grid.listing-fact-grid.listing-vehicle-facts > span {
            grid-template-columns: minmax(104px, 0.55fr) minmax(0, 1fr);
            gap: 10px;
          }
        }

        @media (max-width: 360px) {
          body main.page.listing-detail-page.listing-detail-page
            .listing-fact-grid.listing-fact-grid.listing-vehicle-facts > span {
            grid-template-columns: 1fr;
            gap: 4px;
          }
        }

        body main.page.listing-detail-page.listing-detail-page .listing-vehicle-equipment {
          margin-top: 28px;
          padding: 22px 0 4px;
          border-top: 1px solid rgba(143, 191, 255, 0.16);
        }

        body main.page.listing-detail-page.listing-detail-page .listing-vehicle-equipment h3 {
          margin: 0 0 16px;
          color: #ffffff;
          font-size: 18px;
          font-weight: 900;
          line-height: 1.25;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-vehicle-equipment > div {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: clamp(32px, 8vw, 110px);
          row-gap: 9px;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-vehicle-equipment span {
          color: #dce8f5;
          font-size: 15px;
          font-weight: 650;
          line-height: 1.35;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page .listing-vehicle-equipment {
          border-top-color: #cbd3d7;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page .listing-vehicle-equipment h3,
        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page .listing-vehicle-equipment span {
          color: #16232c;
        }

        @media (max-width: 520px) {
          body main.page.listing-detail-page.listing-detail-page .listing-vehicle-equipment > div {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 14px;
            row-gap: 10px;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-vehicle-equipment span {
            min-width: 0;
            overflow-wrap: anywhere;
          }
        }

        body main.page.listing-detail-page.listing-detail-page .listing-description-empty {
          align-items: center;
          display: flex;
          gap: 10px;
          margin: 4px 0 0;
          padding: 12px 14px;
          background: rgba(143, 191, 255, 0.07);
          border: 1px solid rgba(143, 191, 255, 0.14);
          border-radius: 8px;
          color: #afbdca;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-description-empty::before {
          align-items: center;
          display: inline-flex;
          flex: 0 0 20px;
          height: 20px;
          justify-content: center;
          border: 1px solid currentColor;
          border-radius: 999px;
          content: "i";
          font-size: 12px;
          font-weight: 900;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page .listing-description-empty {
          background: #f5f6f6;
          border-color: #d7dee2;
          color: #60717d;
        }

        body main.page.listing-detail-page.listing-detail-page
          .listing-facts-card.listing-facts-card
          .listing-section-content.listing-section-content {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .listing-facts-card.listing-facts-card
          .listing-section-content.listing-section-content > p:not(.listing-description-empty) {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-section-toggle.listing-section-toggle svg,
        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-section-toggle.listing-section-toggle svg path {
          color: #16232c;
          stroke: #16232c;
          opacity: 1;
        }

        @media (max-width: 760px) {
          body main.page.listing-detail-page.listing-detail-page
            .listing-fact-grid.listing-fact-grid.listing-vehicle-facts > span {
            align-items: start;
            grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          }

          body main.page.listing-detail-page.listing-detail-page
            .listing-fact-grid.listing-fact-grid.listing-vehicle-facts > span > strong {
            hyphens: auto;
            overflow-wrap: anywhere;
            word-break: normal;
          }
        }

        @media (max-width: 360px) {
          body main.page.listing-detail-page.listing-detail-page
            .listing-fact-grid.listing-fact-grid.listing-vehicle-facts > span {
            grid-template-columns: 1fr;
          }
        }

        body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button,
        body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button:is(:hover, :focus-visible, :active) {
          position: static !important;
          align-items: center !important;
          justify-content: center !important;
          width: 40px !important;
          min-width: 40px !important;
          height: 40px !important;
          min-height: 40px !important;
          padding: 0 !important;
          background: #082449 !important;
          background-color: #082449 !important;
          background-image: none !important;
          border: 1px solid rgba(160, 190, 226, 0.34) !important;
          border-radius: 10px !important;
          box-shadow: none !important;
          color: #ff7a1a !important;
          transform: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button svg {
          width: 18px !important;
          height: 18px !important;
          margin: 0 !important;
          color: #ff7a1a !important;
          fill: transparent !important;
          stroke: #ff7a1a !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button.icon-saved svg {
          fill: #ff7a1a !important;
        }

        body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card {
          position: relative !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-card-body.seller-card-panel {
          position: static !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-card-top.seller-card-top {
          align-items: center !important;
          display: flex !important;
          gap: 10px !important;
          justify-content: space-between !important;
          min-height: 32px !important;
          padding-right: 0 !important;
          position: static !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-card-top.seller-card-top > a.seller-profile-btn.seller-profile-btn-top {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
          position: static !important;
          top: auto !important;
          right: auto !important;
          z-index: 20 !important;
          flex: 0 0 auto !important;
          margin: 0 0 0 auto !important;
          white-space: nowrap !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-card-top.seller-card-top > a.seller-profile-btn.seller-profile-btn-top:is(:hover, :focus-visible, :active) {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
          transform: none !important;
        }

        @media (max-width: 520px) {
          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-card-top.seller-card-top {
            padding-right: 0 !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-card-top.seller-card-top > a.seller-profile-btn.seller-profile-btn-top {
            top: auto !important;
            right: auto !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-identity-row.seller-identity-row {
            position: relative !important;
            align-items: start !important;
            padding-bottom: 28px !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card :is(.seller-info, .seller-name-row) {
            position: static !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-name-row.seller-name-row .verified-chip {
            position: absolute !important;
            top: 76px !important;
            left: 0 !important;
            z-index: 3 !important;
            margin: 0 !important;
            white-space: nowrap !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-stats-row.seller-stats-row {
            gap: 8px !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-stat.seller-stat {
            gap: 7px !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-stat.seller-stat svg {
            width: 18px !important;
            height: 18px !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-stat.seller-stat small {
            max-width: 100% !important;
            font-size: clamp(8px, 2.5vw, 10px) !important;
            letter-spacing: -0.02em !important;
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: nowrap !important;
          }
        }

        @media (max-width: 300px) {
          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-card-top.seller-card-top {
            padding-top: 34px !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .seller-card.seller-card .seller-card-top.seller-card-top > a.seller-profile-btn.seller-profile-btn-top {
            position: absolute !important;
            top: 10px !important;
            right: 10px !important;
          }
        }

        /* Keep the detail-page favorite readable on the light theme. This is
           intentionally the last page-local rule so the older action-button
           styling above cannot paint the heart navy-on-navy. */
        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button,
        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button:is(:hover, :focus-visible, :active) {
          background: #ffffff !important;
          background-color: #ffffff !important;
          background-image: none !important;
          border-color: #aebbc2 !important;
          box-shadow: 0 5px 14px rgba(25, 38, 48, 0.14) !important;
          color: #16232c !important;
          transform: none !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button:not(.icon-saved) svg,
        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button:not(.icon-saved) svg path {
          color: #16232c !important;
          fill: transparent !important;
          stroke: #16232c !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button.icon-saved svg,
        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .listing-bottom-actions.listing-bottom-actions > button.icon-btn.listing-favorite-button.icon-saved svg path {
          color: #ff7a1a !important;
          fill: #ff7a1a !important;
          stroke: #ff7a1a !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        /* Keep the two-line update/location block vertically centered in its
           compact mobile row. */
        @media (max-width: 640px) {
          body main.page.listing-detail-page.listing-detail-page
            .desktop-image-meta.desktop-image-meta {
            align-items: flex-start !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            flex-wrap: nowrap !important;
            gap: 2px !important;
            justify-content: center !important;
            height: 48px !important;
            min-height: 48px !important;
            line-height: 1.15 !important;
            padding-bottom: 0 !important;
            padding-top: 0 !important;
          }

          /* Part listings need enough room for long values such as OEM/part
             numbers. Keep labels and values in separate columns without
             allowing either one to paint over the other. */
          body main.page.listing-detail-page.listing-detail-page
            .listing-fact-grid.listing-fact-grid:not(.listing-vehicle-facts) > span {
            grid-template-columns: minmax(122px, 0.48fr) minmax(0, 1fr) !important;
            column-gap: 12px !important;
          }

          body main.page.listing-detail-page.listing-detail-page
            .listing-fact-grid.listing-fact-grid:not(.listing-vehicle-facts) > span > strong {
            min-width: 0 !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
          }
        }

        @media (max-width: 330px) {
          body main.page.listing-detail-page.listing-detail-page
            .listing-fact-grid.listing-fact-grid:not(.listing-vehicle-facts) > span {
            grid-template-columns: 1fr !important;
            row-gap: 3px !important;
          }
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-commerce-actions {
          display: grid !important;
          gap: 10px !important;
          width: 100% !important;
          margin-top: 14px !important;
          padding-top: 16px !important;
          border-top: 1px solid rgba(255, 255, 255, 0.14) !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-commerce-label {
          display: flex !important;
          align-items: center !important;
          gap: 7px !important;
          color: #f8c27c !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          letter-spacing: 0.02em !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card :is(.seller-buy-now-button, .seller-add-cart-button) {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          width: 100% !important;
          min-height: 54px !important;
          padding: 0 16px !important;
          border-radius: 14px !important;
          cursor: pointer !important;
          font-size: 16px !important;
          font-weight: 950 !important;
          transition: transform 0.16s ease, filter 0.16s ease !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-buy-now-button {
          border: 1px solid #ffad52 !important;
          background: linear-gradient(90deg, #ff9b1d 0%, #ff5f00 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 12px 28px rgba(255, 95, 0, 0.24) !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-add-cart-button {
          border: 1px solid #ff9b1d !important;
          background: linear-gradient(100deg, #ff9b1d 0%, #ff6900 58%, #ff5200 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 12px 26px rgba(255, 105, 0, 0.28) !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card :is(.seller-buy-now-button, .seller-add-cart-button):hover {
          filter: brightness(1.08) !important;
          transform: translateY(-1px) !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-commerce-message {
          margin: 0 !important;
          padding: 9px 11px !important;
          border: 1px solid rgba(74, 222, 128, 0.32) !important;
          border-radius: 10px !important;
          background: rgba(22, 101, 52, 0.24) !important;
          color: #bbf7d0 !important;
          font-size: 12px !important;
          font-weight: 850 !important;
          line-height: 1.4 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-toggle {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          grid-template-rows: auto auto !important;
          gap: 2px 10px !important;
          align-items: center !important;
          width: 100% !important;
          min-height: 58px !important;
          margin-top: 10px !important;
          padding: 10px 14px !important;
          border: 1px solid rgba(151, 180, 211, 0.3) !important;
          border-radius: 14px !important;
          background: linear-gradient(145deg, rgba(15, 45, 68, 0.92), rgba(5, 20, 35, 0.94)) !important;
          color: #ffffff !important;
          font: inherit !important;
          text-align: left !important;
          cursor: pointer !important;
          transition: border-color 0.16s ease, transform 0.16s ease, background 0.16s ease !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-toggle:hover {
          border-color: rgba(255, 156, 38, 0.78) !important;
          transform: translateY(-1px) !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-toggle > span {
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          color: #ffffff !important;
          font-size: 14px !important;
          font-weight: 950 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-toggle > span svg {
          color: #ff9b38 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-toggle > small {
          grid-column: 1 !important;
          color: #9fb0c0 !important;
          font-size: 10px !important;
          font-weight: 700 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-toggle > svg {
          grid-column: 2 !important;
          grid-row: 1 / 3 !important;
          color: #ff9b38 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 9px !important;
          width: 100% !important;
          margin-top: 8px !important;
          padding: 16px !important;
          border: 1px solid rgba(151, 180, 211, 0.2) !important;
          border-radius: 16px !important;
          background: linear-gradient(160deg, rgba(10, 35, 55, 0.72), rgba(3, 18, 35, 0.5)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact .message-btn {
          min-height: 52px !important;
          border: 1px solid #ff9b1d !important;
          border-radius: 13px !important;
          background: linear-gradient(100deg, #ff9b1d, #ff6500) !important;
          color: #ffffff !important;
          box-shadow: 0 10px 22px rgba(255, 105, 0, 0.2) !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-heading {
          display: grid !important;
          gap: 3px !important;
          margin-bottom: 3px !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-heading strong {
          color: #ffffff !important;
          font-size: 14px !important;
          font-weight: 950 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-heading span {
          color: #aebdca !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method {
          display: flex !important;
          align-items: center !important;
          gap: 11px !important;
          width: 100% !important;
          min-width: 0 !important;
          min-height: 54px !important;
          padding: 9px 13px !important;
          border: 1px solid rgba(151, 180, 211, 0.24) !important;
          border-radius: 13px !important;
          background: rgba(3, 18, 35, 0.48) !important;
          color: #ffffff !important;
          text-decoration: none !important;
          font: inherit !important;
          text-align: left !important;
          cursor: pointer !important;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method:is(:hover, :focus-visible) {
          border-color: rgba(255, 155, 29, 0.72) !important;
          background: rgba(20, 48, 70, 0.72) !important;
          transform: translateY(-1px) !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method > svg {
          flex: 0 0 auto !important;
          color: #ff9b38 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method > .seller-company-contact-icon {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex: 0 0 38px !important;
          width: 38px !important;
          height: 38px !important;
          border-radius: 11px !important;
          background: rgba(255, 139, 20, 0.14) !important;
          color: #ff9b38 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method > span:not(.seller-company-contact-icon) {
          display: grid !important;
          gap: 1px !important;
          min-width: 0 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method small {
          color: #91a4b9 !important;
          font-size: 10px !important;
          font-weight: 850 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.06em !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method strong {
          overflow: hidden !important;
          color: #ffffff !important;
          font-size: 12px !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-phone-reveal > svg {
          margin-left: auto !important;
          color: #ff9b38 !important;
        }

        body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-phone-visible > b {
          margin-left: auto !important;
          padding: 7px 10px !important;
          border-radius: 999px !important;
          background: #ff7a00 !important;
          color: #ffffff !important;
          font-size: 11px !important;
          font-weight: 950 !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-toggle {
          border-color: #d7e0e8 !important;
          background: linear-gradient(145deg, #ffffff, #f4f7fa) !important;
          color: #17212b !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-toggle > span {
          color: #17212b !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-toggle > small {
          color: #64748b !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact {
          border-color: #e2e8f0 !important;
          background: linear-gradient(160deg, #ffffff, #f7f9fb) !important;
          box-shadow: 0 12px 28px rgba(15, 35, 55, 0.07) !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-heading strong,
        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method strong {
          color: #17212b !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-heading span,
        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method small {
          color: #64748b !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method {
          border-color: #d8e1ea !important;
          background: #f8fafc !important;
          color: #17212b !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method:is(:hover, :focus-visible) {
          border-color: #ffb25c !important;
          background: #fff8f0 !important;
        }

        html[data-theme="light"] body main.page.listing-detail-page.listing-detail-page
          .seller-card.seller-card .seller-company-contact-method > .seller-company-contact-icon {
          background: #fff0df !important;
        }

        body main.page.listing-detail-page .listing-sale-price-stack {
          display: flex !important;
          align-items: baseline !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
        }

        body main.page.listing-detail-page .listing-sale-badge {
          display: inline-flex !important;
          align-items: center !important;
          min-height: 28px !important;
          padding: 5px 9px !important;
          border-radius: 6px !important;
          background: #e54813 !important;
          color: #fff !important;
          font-size: 12px !important;
          font-weight: 950 !important;
          letter-spacing: .035em !important;
          line-height: 1 !important;
          box-shadow: 0 6px 14px rgba(201,55,12,.24) !important;
        }

        body main.page.listing-detail-page .listing-original-price {
          color: #91a4b9 !important;
          font-size: 16px !important;
          font-weight: 800 !important;
        }

      `}</style>
    </main>
  );
}
