"use client";

// Interactive home experience. The route-level server component supplies
// public listings so the same content exists in the initial HTML for crawlers.

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import styles from "./page.module.css";
import PageLoadingFallback from "@/app/components/PageLoadingFallback";
import MobileNativeSelect from "@/app/components/MobileNativeSelect";
import ListingSalePrice from "@/app/components/ListingSalePrice";

import {
  ArrowDownWideNarrow,
  Bookmark,
  Check,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Cog,
  Disc3,
  Gift,
  Grid2X2,
  Heart,
  MapPin,
  Palette,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Zap,
  X
} from "lucide-react";

import {
  fallbackListings,
  formatPrice,
  getListingPartNumber,
  getListingSalePricing,
  isKnownVehicleType,
  isVehicleListing,
  normalizeVehicleType,
  subcategoryGroups,
  type Listing
} from "@/lib/listings";
import {
  buildVehicleCategoriesFromTaxonomy,
  categoriesAsRecord,
  vehicleBrandsRecord
} from "@/lib/taxonomy";
import { useTaxonomy } from "./components/TaxonomyProvider";
import { getLocalizedListingText } from "@/lib/listing-translations";
import {
  readCachedListings,
  updateCachedListing,
  writeCachedListings
} from "@/lib/client-listings-cache";
import { formatLocationWithCountry, getCountryFlagFromLocation } from "@/lib/country-flags";
import {
  VEHICLE_ACCESSORY_OPTIONS,
  readVehicleAccessories,
  translateVehicleAccessory
} from "@/lib/vehicle-accessories";
import {
  VEHICLE_COLOR_OPTIONS,
  readVehicleColors,
  translateVehicleColor
} from "@/lib/vehicle-colors";
import {
  FINLAND_MUNICIPALITIES,
  FINLAND_MUNICIPALITIES_BY_REGION,
  FINLAND_REGIONS
} from "@/lib/finland-locations";
import {
  SWEDEN_COUNTIES,
  SWEDEN_MUNICIPALITIES,
  SWEDEN_MUNICIPALITIES_BY_COUNTY
} from "@/lib/sweden-locations";
import {
  NORWAY_COUNTIES,
  NORWAY_MUNICIPALITIES,
  NORWAY_MUNICIPALITIES_BY_COUNTY
} from "@/lib/norway-locations";
import {
  LOCATION_COUNTRIES,
  countryFlagEmoji,
  getNorwayLocationName,
  getSwedenLocationName,
  listingMatchesLocationFilter,
  parseLocationFilter,
  serializeLocationFilter,
  toNorwayLocationValue,
  toSwedenLocationValue,
  type LocationFilterSelection
} from "@/lib/location-filter";
import {
  buildFitmentProfile,
  hasFitmentProfile,
  listingMatchesCompatibleFitment
} from "@/lib/fitments";

import { buildRecoProfile, getRecommendedListings, setRecoUserId } from "@/lib/recommendations";
import { listingNumberUrlId, listingPath, listingUrlId, pagePath } from "@/lib/routes";
import {
  MARKETPLACE_YEAR_FILTER_MIN,
  buildMarketplaceCategorySource,
  buildMarketplaceFilterOptions,
  mergeMarketplaceCategorySources,
  buildMarketplaceModelOptions,
  buildMarketplaceSubcategoryGroups,
  buildMarketplaceYearOptions,
  getUnifiedAllCategoryName,
  getMarketplaceYearFilterMax
} from "@/lib/marketplace-filter-options";

import {
  getProfile,
  getSavedListingIds,
  getGarageVehicles,
  ensureListingTranslations,
  getListings,
  getUserPreferenceProfile,
  saveListing,
  supabase,
  trackUserActivity,
  unsaveListing,
  type GarageVehicle,
  type UserPreferenceProfile
} from "@/lib/supabase";
import {
  applyLocale,
  isLocale,
  normalizeLocale,
  purgeInvalidLocaleStorage,
  translateCategory,
  type Locale,
  type SupportedLocale
} from "@/lib/i18n";
import OptimizedListingImage, { fallbackListingImage } from "./components/OptimizedListingImage";
import ListingVehicleMeta from "./components/ListingVehicleMeta";
import { ListFilter } from "lucide-react";
import { getCategoryVehicleKey } from "./components/CategoryDrawer";

function HomeListingSaleBadge({ listing }: { listing: Pick<Listing, "price" | "translations"> }) {
  const pricing = getListingSalePricing(listing);
  if (!pricing.onSale) return null;
  return <span className={styles.listingSaleBadge}>ALE −{pricing.discountPercent} %</span>;
}

function VehicleTaxBadges({ listing }: { listing: Pick<Listing, "category" | "translations"> }) {
  if (!isVehicleListing(listing)) return null;
  const meta = listing.translations?._meta;
  if (!meta?.vat_deductible && !meta?.tax_free) return null;

  return (
    <div className={styles.vehicleTaxBadges} aria-label="Ajoneuvon verotiedot">
      {meta.vat_deductible ? <span>ALV-vähennyskelpoinen</span> : null}
      {meta.tax_free ? <span>Tax free</span> : null}
    </div>
  );
}

const HOME_RETURN_STATE_KEY = "home_return_state_v1";
const SAVED_SEARCHES_STORAGE_KEY = "maskines_saved_searches_v1";
const HOME_RETURN_PENDING_KEY = "home_return_pending_v1";
const CUSTOM_TRACK_MAT_DIMENSION_VALUE = "__custom_track_mat_dimension__";
const TRACK_MAT_DIMENSION_OPTIONS = [
  "307 cm x 38 cm x 6,4 cm / 121 x 15 x 2.52\"",
  "307 cm x 38 cm x 7,3 cm / 121 x 15 x 2.86\"",
  "307 cm x 41 cm x 6,4 cm / 121 x 16 x 2.52\"",
  "325 cm x 34 cm x 6,4 cm / 128 x 13.5 x 2.52\"",
  "325 cm x 36 cm x 6,4 cm / 128 x 14 x 2.52\"",
  "325 cm x 38 cm x 6,4 cm / 128 x 15 x 2.52\"",
  "328 cm x 38 cm x 7,3 cm / 129 x 15 x 2.86\"",
  "339 cm x 38 cm x 6,4 cm / 133.5 x 15 x 2.52\"",
  "345 cm x 38 cm x 6,4 cm / 136 x 15 x 2.52\"",
  "345 cm x 38 cm x 7,3 cm / 136 x 15 x 2.86\"",
  "348 cm x 38 cm x 7,3 cm / 137 x 15 x 2.86\"",
  "348 cm x 41 cm x 7,3 cm / 137 x 16 x 2.86\"",
  "358 cm x 38 cm x 6,4 cm / 141 x 15 x 2.52\"",
  "358 cm x 38 cm x 7,6 cm / 141 x 15 x 3.00\"",
  "366 cm x 34 cm x 6,4 cm / 144 x 13.5 x 2.52\"",
  "366 cm x 36 cm x 6,4 cm / 144 x 14 x 2.52\"",
  "366 cm x 38 cm x 6,4 cm / 144 x 15 x 2.52\"",
  "366 cm x 38 cm x 7,3 cm / 144 x 15 x 2.86\"",
  "371 cm x 38 cm x 7,3 cm / 146 x 15 x 2.86\"",
  "371 cm x 41 cm x 7,3 cm / 146 x 16 x 2.86\"",
  "383 cm x 38 cm x 6,4 cm / 151 x 15 x 2.52\"",
  "389 cm x 38 cm x 7,6 cm / 153 x 15 x 3.00\"",
  "391 cm x 38 cm x 7,3 cm / 154 x 15 x 2.86\"",
  "391 cm x 41 cm x 7,3 cm / 154 x 16 x 2.86\"",
  "391 cm x 41 cm x 7,6 cm / 154 x 16 x 3.00\"",
  "391 cm x 51 cm x 6,4 cm / 154 x 20 x 2.52\"",
  "391 cm x 51 cm x 7,3 cm / 154 x 20 x 2.86\"",
  "396 cm x 38 cm x 6,4 cm / 156 x 15 x 2.52\"",
  "396 cm x 38 cm x 7,6 cm / 156 x 15 x 3.00\"",
  "396 cm x 41 cm x 6,4 cm / 156 x 16 x 2.52\"",
  "396 cm x 51 cm x 6,4 cm / 156 x 20 x 2.52\"",
  "396 cm x 61 cm x 6,4 cm / 156 x 24 x 2.52\"",
  "404 cm x 38 cm x 6,4 cm / 159 x 15 x 2.52\"",
  "411 cm x 38 cm x 7,3 cm / 162 x 15 x 2.86\"",
  "411 cm x 38 cm x 7,6 cm / 162 x 15 x 3.00\"",
  "414 cm x 41 cm x 7,3 cm / 163 x 16 x 2.86\"",
  "414 cm x 41 cm x 7,6 cm / 163 x 16 x 3.00\"",
  "419 cm x 38 cm x 7,6 cm / 165 x 15 x 3.00\"",
  "419 cm x 38 cm x 8,9 cm / 165 x 15 x 3.50\"",
  "442 cm x 38 cm x 7,6 cm / 174 x 15 x 3.00\"",
  "442 cm x 38 cm x 8,9 cm / 174 x 15 x 3.50\"",
  "445 cm x 38 cm x 7,6 cm / 175 x 15 x 3.00\""
];

const TRACK_MAT_DIMENSIONS = TRACK_MAT_DIMENSION_OPTIONS.map((value) => {
  const [metricValue, imperialValueWithQuote = ""] = value.split(" / ");
  const [lengthCm = "", widthCm = "", pitchCm = ""] = metricValue.split(" x ");
  const [lengthInch = "", widthInch = "", pitchInch = ""] = imperialValueWithQuote
    .replace(/\"$/, "")
    .split(" x ");

  return {
    value,
    lengthCm,
    widthCm,
    pitchCm,
    lengthInch,
    widthInch,
    pitchInch
  };
});

type TrackMatDimension = (typeof TRACK_MAT_DIMENSIONS)[number];

function uniqueTrackMatChoices(
  dimensions: readonly TrackMatDimension[],
  getMetric: (dimension: TrackMatDimension) => string,
  getImperial: (dimension: TrackMatDimension) => string
) {
  const choices = new Map<string, string>();

  for (const dimension of dimensions) {
    const metric = getMetric(dimension);
    if (!metric || choices.has(metric)) continue;
    choices.set(metric, `${metric} / ${getImperial(dimension)}\"`);
  }

  return Array.from(choices, ([value, label]) => ({ value, label }));
}

function findTrackMatDimension(value: string) {
  return TRACK_MAT_DIMENSIONS.find((dimension) => dimension.value === value);
}

function isPublicListing(listing: Listing) {
  return !listing.is_sold && !listing.is_hidden;
}

const translations = {
  fi: {
    createListing: "Luo ilmoitus",
    profile: "Profiili",
    editProfile: "Muokkaa profiilia",
    myListings: "Omat ilmoitukset",
    messages: "Viestit",
    savedListings: "Tallennetut ilmoitukset",
    login: "Kirjaudu",
    signOut: "Kirjaudu ulos",
    heroTitle: "Maskines",
    heroSubtitle: "Pohjoismainen markkinapaikka pienkoneiden varaosille ja ajoneuvoille.",
    heroLeadStart: "Nopea haku",
    heroLeadHighlight: "osta ja myy",
    heroLeadEnd: "varaosat ja ajoneuvot",
    heroTrustFast: "Nopea ja helppo listaaminen",
    heroTrustFree: "Ilmainen myynti ostajalle",
    heroTrustSafe: "Turvallinen kauppa Suomessa",
    heroTrustService: "Palvelemme suomeksi ja englanniksi",
    heroBenefitSafeTitle: "Turvallinen kauppa",
    heroBenefitSafeText: "Pohjoismainen myyntialusta",
    heroBenefitFreeTitle: "Ilmainen",
    heroBenefitFreeText: "Osta ja myy ilmaiseksi",
    heroBenefitFastTitle: "Nopeasti myyntiin",
    heroBenefitFastText: "muutamassa minuutissa",
    heroBenefitServiceTitle: "Palvelemme",
    heroBenefitServiceText: "Suomessa ja Pohjoismaissa",
    sellPromoTitle: "Myy varaosat 2 minuutissa",
    sellPromoBulletOne: "Lisää kuvat",
    sellPromoBulletTwo: "Kirjoita tiedot",
    sellPromoBulletThree: "Julkaise ilmaiseksi",
    addListingNow: "Lisää ilmoitus nyt",
    instructions: "Ohjeet",
    sellGuideTitle: "Näin myyt varaosat",
    sellGuideStepOne: "Lisää selkeät kuvat osasta ja mahdollisesta osanumerosta.",
    sellGuideStepTwo: "Kirjoita merkki, malli, kunto, hinta ja sijainti.",
    sellGuideStepThree: "Julkaise ilmoitus — ostajat voivat ottaa sinuun yhteyttä.",
    sellGuideStepFour: "Sovi maksu ja toimitus turvallisesti viestien kautta.",
    brandTagline: "Kaikki varaosat. Kaikilta. Sinulle.",
    searchLabel: "Haku",
    searchCta: "Hae",
    searchPlaceholder: "Hae varaosia, merkkiä, mallia tai varaosanumeroa...",
    vehicleSelection: "Ajoneuvon valinta",
    content: "Sisältö",
    popularProducts: "Suositut tuotteet",
    viewAll: "Katso kaikki ›",
    noListings: "Ei ilmoituksia näytettäväksi",
    loadingListings: "Ladataan ilmoituksia...",
    changeFilters: "Poista suodattimet tai vaihda hakua.",
    resetFilters: "Nollaa suodattimet",
    openListing: "Avaa",
    removeFavorite: "Poista suosikeista",
    addFavorite: "Lisää suosikkeihin",
    country: "Suomi",
    viewProfile: "Katso profiili",
    sendEmail: "Lähetä sähköpostia",
    filters: "Suodattimet",
    sort: "Järjestys",
    relevance: "Osuvimmat ensin",
    newest: "Uusimmat ensin",
    oldest: "Vanhimmat ensin",
    lowestPrice: "Alhaisin hinta",
    highestPrice: "Korkein hinta",
    nearest: "Lähimpänä sinua",
    brand: "Merkki",
    model: "Malli",
    year: "Vuosimalli",
    yearPlaceholder: "esim. 2018",
    priceRange: "Hintaväli",
    minimum: "Minimi",
    maximum: "Maksimi",
    categories: "Kategoriat",
    categoryPlaceholder: "Etsi kategoriasta...",
    all: "Kaikki",
    language: "Kieli",
    snowmobiles: "Moottorikelkat",
    atvs: "Mönkijät",
    cars: "Motocross",
    mopeds: "Mopot",
    garageTitle: "Oma Talli",
    garageAddVehicle: "Lisää ajoneuvo",
    garagePartsFor: "Osat koneelle",
    saTitle: "Hakuvahti",
    loginToCreateListing: "Kirjaudu sisään luodaksesi ilmoituksen",
    notifications: "Ilmoitukset",
    reviews: "Arvostelut",
    reviewSeller: "Anna arvio myyjästä",
    openReview: "Avaa arvostelu",
    dismiss: "Poista",
    noNotifications: "Ei uusia ilmoituksia.",
    sellParts: "Myy osia",
    forYou: "Sinulle suosituksia",
    basedOnBrowsing: "Selaamasi perusteella",
    showMoreListings: "Näytä lisää",
    newBadge: "Uusi",
    allListings: "Kaikki ilmoitukset",
    selectedVehicle: "Valittu ajoneuvo",
    openCategories: "Avaa kategoriat",
    sellerLevel: "Myyjälevel",
    level: "Level",
    xpToNextLevel: "seuraavaan leveliin",
    maxLevel: "Maksimitaso"
  },
  en: {
    createListing: "Create listing",
    profile: "Profile",
    editProfile: "Edit profile",
    myListings: "My listings",
    messages: "Messages",
    savedListings: "Saved listings",
    login: "Log in",
    signOut: "Log out",
    heroTitle: "Vehicle parts that move you forward.",
    heroSubtitle: "A Nordic marketplace for small vehicles and spare parts.",
    heroLeadStart: "Fast search",
    heroLeadHighlight: "sell used",
    heroLeadEnd: "spare parts easily",
    heroTrustFast: "Fast and easy listing",
    heroTrustFree: "Free selling for buyers",
    heroTrustSafe: "Safe marketplace in Finland",
    heroTrustService: "Service in Finnish and English",
    heroBenefitSafeTitle: "Safe marketplace",
    heroBenefitSafeText: "in Finland",
    heroBenefitFreeTitle: "Free selling",
    heroBenefitFreeText: "for buyers",
    heroBenefitFastTitle: "Quick to publish",
    heroBenefitFastText: "in a few minutes",
    heroBenefitServiceTitle: "We serve",
    heroBenefitServiceText: "Finland and the Nordics",
    sellPromoTitle: "Sell parts in 2 minutes",
    sellPromoBulletOne: "Add photos",
    sellPromoBulletTwo: "Write details",
    sellPromoBulletThree: "Publish for free",
    addListingNow: "Add listing now",
    instructions: "Instructions",
    sellGuideTitle: "How to sell parts",
    sellGuideStepOne: "Add clear photos of the part and possible part number.",
    sellGuideStepTwo: "Write brand, model, condition, price and location.",
    sellGuideStepThree: "Publish the listing — buyers can contact you.",
    sellGuideStepFour: "Agree payment and delivery safely through messages.",
    brandTagline: "All parts. From everyone. For you.",
    searchLabel: "Search",
    searchCta: "Search",
    searchPlaceholder: "Search parts, brand or model...",
    vehicleSelection: "Vehicle selection",
    content: "Content",
    popularProducts: "Popular products",
    viewAll: "View all ›",
    noListings: "No listings to show",
    loadingListings: "Loading listings...",
    changeFilters: "Remove filters or change your search.",
    resetFilters: "Reset filters",
    openListing: "Open",
    removeFavorite: "Remove from favorites",
    addFavorite: "Add to favorites",
    country: "Finland",
    viewProfile: "View profile",
    sendEmail: "Send email",
    filters: "Filters",
    sort: "Sort",
    relevance: "Most relevant first",
    newest: "Newest first",
    oldest: "Oldest first",
    lowestPrice: "Lowest price",
    highestPrice: "Highest price",
    nearest: "Nearest to you",
    brand: "Brand",
    model: "Model",
    year: "Year",
    yearPlaceholder: "e.g. 2018",
    priceRange: "Price range",
    minimum: "Minimum",
    maximum: "Maximum",
    categories: "Categories",
    categoryPlaceholder: "Search categories...",
    all: "All",
    language: "Language",
    snowmobiles: "Snowmobiles",
    atvs: "ATVs",
    cars: "Motocross",
    mopeds: "Mopeds",
    garageTitle: "My Garage",
    garageAddVehicle: "Add vehicle",
    garagePartsFor: "Parts for",
    saTitle: "Search Alerts",
    loginToCreateListing: "Log in to create a listing",
    notifications: "Notifications",
    reviews: "Reviews",
    reviewSeller: "Review the seller",
    openReview: "Open review",
    dismiss: "Dismiss",
    noNotifications: "No new notifications.",
    sellParts: "Sell parts",
    forYou: "Recommendations for you",
    basedOnBrowsing: "Based on your browsing",
    showMoreListings: "Show more",
    newBadge: "New",
    allListings: "All listings",
    selectedVehicle: "Selected vehicle",
    openCategories: "Open categories",
    sellerLevel: "Seller level",
    level: "Level",
    xpToNextLevel: "to next level",
    maxLevel: "Max level"
  },
  sv: {
    createListing: "Skapa annons",
    profile: "Profil",
    editProfile: "Redigera profil",
    myListings: "Mina annonser",
    messages: "Meddelanden",
    savedListings: "Sparade annonser",
    login: "Logga in",
    signOut: "Logga ut",
    heroTitle: "Fordonsdelar som tar dig framåt.",
    heroSubtitle: "En nordisk marknadsplats för småfordon och reservdelar.",
    heroLeadStart: "Snabb sökning",
    heroLeadHighlight: "sälj begagnade",
    heroLeadEnd: "reservdelar enkelt",
    heroTrustFast: "Snabb och enkel annonsering",
    heroTrustFree: "Gratis försäljning för köparen",
    heroTrustSafe: "Trygg handel i Finland",
    heroTrustService: "Service på finska och engelska",
    heroBenefitSafeTitle: "Trygg handel",
    heroBenefitSafeText: "i Finland",
    heroBenefitFreeTitle: "Gratis försäljning",
    heroBenefitFreeText: "för köparen",
    heroBenefitFastTitle: "Snabbt till salu",
    heroBenefitFastText: "på några minuter",
    heroBenefitServiceTitle: "Vi betjänar",
    heroBenefitServiceText: "Finland och Norden",
    sellPromoTitle: "Sälj reservdelar på 2 minuter",
    sellPromoBulletOne: "Lägg till bilder",
    sellPromoBulletTwo: "Skriv uppgifter",
    sellPromoBulletThree: "Publicera gratis",
    addListingNow: "Lägg till annons nu",
    instructions: "Instruktioner",
    sellGuideTitle: "Så säljer du delar",
    sellGuideStepOne: "Lägg till tydliga bilder på delen och eventuellt artikelnummer.",
    sellGuideStepTwo: "Skriv märke, modell, skick, pris och plats.",
    sellGuideStepThree: "Publicera annonsen — köpare kan kontakta dig.",
    sellGuideStepFour: "Kom överens om betalning och leverans tryggt via meddelanden.",
    brandTagline: "Alla delar. Från alla. För dig.",
    searchLabel: "Sök",
    searchCta: "Sök",
    searchPlaceholder: "Sök reservdelar, märke eller modell...",
    vehicleSelection: "Val av fordon",
    content: "Innehåll",
    popularProducts: "Populära produkter",
    viewAll: "Visa alla ›",
    noListings: "Inga annonser att visa",
    loadingListings: "Laddar annonser...",
    changeFilters: "Ta bort filter eller ändra sökningen.",
    resetFilters: "Återställ filter",
    openListing: "Öppna",
    removeFavorite: "Ta bort från favoriter",
    addFavorite: "Lägg till i favoriter",
    country: "Finland",
    viewProfile: "Visa profil",
    sendEmail: "Skicka e-post",
    filters: "Filter",
    sort: "Sortering",
    relevance: "Mest relevanta först",
    newest: "Nyaste först",
    oldest: "Äldsta först",
    lowestPrice: "Lägsta pris",
    highestPrice: "Högsta pris",
    nearest: "Närmast dig",
    brand: "Märke",
    model: "Modell",
    year: "Årsmodell",
    yearPlaceholder: "t.ex. 2018",
    priceRange: "Prisintervall",
    minimum: "Minimum",
    maximum: "Maximum",
    categories: "Kategorier",
    categoryPlaceholder: "Sök kategori...",
    all: "Alla",
    language: "Språk",
    snowmobiles: "Snöskotrar",
    atvs: "Fyrhjulingar",
    cars: "Motocross",
    mopeds: "Mopeder",
    garageTitle: "Mitt Garage",
    garageAddVehicle: "Lägg till fordon",
    garagePartsFor: "Delar för",
    saTitle: "Bevakningar",
    loginToCreateListing: "Logga in för att skapa en annons",
    notifications: "Notiser",
    reviews: "Recensioner",
    reviewSeller: "Betygsätt säljaren",
    openReview: "Öppna recension",
    dismiss: "Ta bort",
    noNotifications: "Inga nya notiser.",
    sellParts: "Sälj delar",
    forYou: "Rekommendationer för dig",
    basedOnBrowsing: "Baserat på ditt bläddring",
    showMoreListings: "Visa fler",
    newBadge: "Ny",
    allListings: "Alla annonser",
    selectedVehicle: "Valt fordon",
    openCategories: "Öppna kategorier",
    sellerLevel: "Säljarnivå",
    level: "Level",
    xpToNextLevel: "till nästa level",
    maxLevel: "Maxnivå"
  },
  no: {
    createListing: "Opprett annonse",
    profile: "Profil",
    editProfile: "Rediger profil",
    myListings: "Mine annonser",
    messages: "Meldinger",
    savedListings: "Lagrede annonser",
    login: "Logg inn",
    signOut: "Logg ut",
    heroTitle: "Kjøretøydeler som tar deg videre.",
    heroSubtitle: "En nordisk markedsplass for små kjøretøy og reservedeler.",
    heroLeadStart: "Raskt søk",
    heroLeadHighlight: "selg brukte",
    heroLeadEnd: "reservedeler enkelt",
    heroTrustFast: "Rask og enkel annonsering",
    heroTrustFree: "Gratis salg for kjøperen",
    heroTrustSafe: "Trygg handel i Finland",
    heroTrustService: "Service på finsk og engelsk",
    heroBenefitSafeTitle: "Trygg handel",
    heroBenefitSafeText: "i Finland",
    heroBenefitFreeTitle: "Gratis salg",
    heroBenefitFreeText: "for kjøperen",
    heroBenefitFastTitle: "Raskt til salgs",
    heroBenefitFastText: "på noen minutter",
    heroBenefitServiceTitle: "Vi hjelper",
    heroBenefitServiceText: "Finland og Norden",
    sellPromoTitle: "Selg deler på 2 minutter",
    sellPromoBulletOne: "Legg til bilder",
    sellPromoBulletTwo: "Skriv detaljer",
    sellPromoBulletThree: "Publiser gratis",
    addListingNow: "Legg til annonse nå",
    instructions: "Hjelp",
    sellGuideTitle: "Slik selger du deler",
    sellGuideStepOne: "Legg til tydelige bilder av delen og eventuelt delenummer.",
    sellGuideStepTwo: "Skriv merke, modell, tilstand, pris og sted.",
    sellGuideStepThree: "Publiser annonsen — kjøpere kan kontakte deg.",
    sellGuideStepFour: "Avtal betaling og levering trygt via meldinger.",
    brandTagline: "Alle deler. Fra alle. For deg.",
    searchLabel: "Søk",
    searchCta: "Søk",
    searchPlaceholder: "Søk etter deler, merke eller modell...",
    vehicleSelection: "Valg av kjøretøy",
    content: "Innhold",
    popularProducts: "Populære produkter",
    viewAll: "Se alle ›",
    noListings: "Ingen annonser å vise",
    loadingListings: "Laster annonser...",
    changeFilters: "Fjern filtre eller endre søket.",
    resetFilters: "Tilbakestill filtre",
    openListing: "Åpne",
    removeFavorite: "Fjern fra favoritter",
    addFavorite: "Legg til i favoritter",
    country: "Finland",
    viewProfile: "Se profil",
    sendEmail: "Send e-post",
    filters: "Filtre",
    sort: "Sortering",
    relevance: "Mest relevante først",
    newest: "Nyeste først",
    oldest: "Eldste først",
    lowestPrice: "Laveste pris",
    highestPrice: "Høyeste pris",
    nearest: "Nærmest deg",
    brand: "Merke",
    model: "Modell",
    year: "Årsmodell",
    yearPlaceholder: "f.eks. 2018",
    priceRange: "Prisklasse",
    minimum: "Minimum",
    maximum: "Maksimum",
    categories: "Kategorier",
    categoryPlaceholder: "Søk i kategorier...",
    all: "Alle",
    language: "Språk",
    snowmobiles: "Snøscootere",
    atvs: "ATV-er",
    cars: "Motocross",
    mopeds: "Mopeder",
    garageTitle: "Min garasje",
    garageAddVehicle: "Legg til kjøretøy",
    garagePartsFor: "Deler for",
    saTitle: "Søkevarsler",
    loginToCreateListing: "Logg inn for å opprette annonse",
    rewards: "Belønninger",
    shop: "Butikk",
    notifications: "Varsler",
    reviews: "Anmeldelser",
    reviewSeller: "Vurder selgeren",
    openReview: "Åpne vurdering",
    dismiss: "Fjern",
    noNotifications: "Ingen nye varsler.",
    sellParts: "Selg deler",
    forYou: "Anbefalinger for deg",
    basedOnBrowsing: "Basert på din søking",
    showMoreListings: "Vis flere annonser",
    newBadge: "Ny",
    allListings: "Alle annonser",
    selectedVehicle: "Valgt kjøretøy",
    openCategories: "Åpne kategorier",
    sellerLevel: "Selgernivå",
    level: "Nivå",
    xpToNextLevel: "til neste nivå",
    maxLevel: "Maksnivå"
  },
} satisfies Record<Locale, Record<string, string>>;

const sortValues = [
  "Osuvimmat ensin",
  "Uusimmat ensin",
  "Vanhimmat ensin",
  "Alhaisin hinta",
  "Korkein hinta",
  "Lähimpänä sinua"
] as const;

type SortValue = typeof sortValues[number];

/*
const categoryTranslations: Record<Locale, Record<string, string>> = {
  fi: {},
  en: {
    Moottori: "Engine",
    "Voimansiirto": "Drivetrain",
    "Voimansiirron osat": "Drivetrain parts",
    Alusta: "Chassis",
    Sähkö: "Electrical",
    Sisusta: "Interior",
    Runko: "Frame",
    "Runko & katteet": "Frame & panels",
    "Telaston osat": "Track system parts",
    "Jousituksen osat": "Suspension parts",
    "Ohjauksen osat": "Steering parts",
    "Sähkö osat": "Electrical parts",
    Polttoainejärjestelmä: "Fuel system",
    Jarrut: "Brakes",
    Ohjaamo: "Cockpit",
    Sytytys: "Ignition",
    Suodattimet: "Filters",
    Tiivisteet: "Gaskets",
    Hihnat: "Belts",
    Ketjut: "Chains",
    Variaattori: "Variator",
    Variaattorit: "Variators",
    Iskunvaimentimet: "Shock absorbers",
    Laakerit: "Bearings",
    Ohjausnivelet: "Steering joints",
    Akku: "Battery",
    Akut: "Batteries",
    Valot: "Lights",
    Johdotus: "Wiring",
    Johdotukset: "Wiring",
    "Öljyt & suodattimet": "Oils & filters",
    Jäähdytys: "Cooling",
    Anturit: "Sensors",
    Penkit: "Seats",
    Matot: "Mats",
    Elektroniikka: "Electronics",
    Sylinteri: "Cylinder",
    Kaasutin: "Carburetor",
    Rattaat: "Sprockets",
    Kytkin: "Clutch",
    Katteet: "Panels",
    Ohjaustanko: "Handlebar",
    Männät: "Pistons",
    Kannet: "Heads",
    Kampiakseli: "Crankshaft",
    Kiinnitykset: "Mounts",
    Puolat: "Coils",
    "CDI-boksit": "CDI boxes",
    Jouset: "Springs",
    Ketjukotelot: "Chaincases",
    Hammasrattaat: "Gears",
    Telastopalkit: "Track rails",
    Telamatot: "Tracks",
    Telapyörät: "Bogey wheels",
    Nivelosat: "Joint parts",
    Ohjaustangot: "Handlebars",
    Tankopehmusteet: "Handlebar pads",
    "Tangon laakerit": "Handlebar bearings",
    Staattorit: "Stators",
    Kaasuttimet: "Carburetors",
    Suuttimet: "Jets",
    Polttoainepumput: "Fuel pumps",
    Tuulilasit: "Windshields",
    Sivukatteet: "Side panels",
    Takakatteet: "Rear panels",
    Jarrulevyt: "Brake discs",
    Jarrupalat: "Brake pads",
    Istuimet: "Seats",
    Mittaristot: "Dashboards",
    Käsisuojat: "Hand guards",
    Ohjaus: "Steering"
  },
  sv: {
    Moottori: "Motor",
    Voimansiirto: "Drivlina",
    "Voimansiirron osat": "Drivlinedelar",
    Alusta: "Chassi",
    Sähkö: "El",
    Sisusta: "Interiör",
    Runko: "Ram",
    "Runko & katteet": "Ram & kåpor",
    Jarrut: "Bromsar",
    Sytytys: "Tändning",
    Suodattimet: "Filter",
    Tiivisteet: "Packningar",
    Hihnat: "Remmar",
    Ketjut: "Kedjor",
    Variaattori: "Variator",
    Iskunvaimentimet: "Stötdämpare",
    Laakerit: "Lager",
    Akku: "Batteri",
    Valot: "Lampor",
    Johdotus: "Kablage",
    Jäähdytys: "Kylning",
    Anturit: "Sensorer",
    Penkit: "Säten",
    Matot: "Mattor",
    Elektroniikka: "Elektronik",
    Sylinteri: "Cylinder",
    Kaasutin: "Förgasare",
    Rattaat: "Drev",
    Kytkin: "Koppling",
    Katteet: "Kåpor",
    Ohjaustanko: "Styre",
    Ohjaus: "Styrning"
  },
};
*/

/* ======================================================
   CATEGORIES
====================================================== */

// Vehicle types are dynamic via taxonomy. Keep VehicleType permissive.
type VehicleType = string;
type VehicleFilter = string;
type SellerTypeFilter = "" | "company" | "private" | "verified-company";

type AppliedListingFilters = {
  query: string;
  category: string;
  subcategory: string;
  vehicleType: VehicleFilter;
  vehicleSubtype: string;
  selectedBrand: string;
  modelQuery: string;
  identifierQuery: string;
  locationQuery: string;
  yearQuery: string;
  yearMinQuery: string;
  yearMaxQuery: string;
  engineCcQuery: string;
  engineModelQuery: string;
  vehicleMileageMinQuery: string;
  vehicleMileageMaxQuery: string;
  vehicleHoursMinQuery: string;
  vehicleHoursMaxQuery: string;
  vehicleRegistrationQuery: string;
  vehicleEngineKindQuery: string;
  vehicleDriveTypeQuery: string;
  vehicleRoadLegalQuery: string;
  vehicleAccessoriesQuery: string[];
  vehicleColorsQuery: string[];
  vehicleVatDeductibleQuery?: boolean;
  vehicleTaxFreeQuery?: boolean;
  trackMatDimensionQuery: string;
  minPrice: number;
  maxPrice: number;
  garageFilterId: string;
  gearTypeQuery: string[];
  gearBrandOptionsQuery: string[];
  gearSizeOptionsQuery: string[];
  gearBrandQuery: string;
  gearSizeQuery: string;
  gearConditionQuery: string;
  gearTargetQuery: string;
  sellerType: SellerTypeFilter;
};

type MarketplaceMode = "parts" | "vehicles" | "gear";
type MarketplaceResultMode = MarketplaceMode | "all";

type SavedSearchRecord = {
  id: string;
  name: string;
  createdAt: string;
  marketplaceMode: MarketplaceMode;
  filters: AppliedListingFilters;
};

const RIDING_GEAR_TYPE_OPTIONS = [
  "Kypärät",
  "Ajotakit",
  "Ajohousut",
  "Ajopuvut",
  "Ajosaappaat",
  "Ajohanskat",
  "Suojavarusteet",
  "Sade- ja lämpövarusteet",
  "Muut ajovarusteet"
] as const;
const RIDING_GEAR_BRAND_OPTIONS = [
  "Acerbis", "Alpinestars", "Arai", "Bell", "Fox Racing", "FXR", "Halvarssons",
  "HJC", "Klim", "Leatt", "O'Neal", "Rukka", "Scott", "Shoei", "Thor"
] as const;
const RIDING_GEAR_SIZE_OPTIONS = [
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL",
  "116", "128", "140", "152", "164",
  "32", "34", "36", "38", "40", "42", "44", "46", "48",
  "50", "52", "54", "56", "58", "60", "62", "64"
] as const;
const RIDING_GEAR_CONDITION_OPTIONS = ["Uusi", "Uudenveroinen", "Hyvä", "Tyydyttävä", "Kunnostettava"] as const;
const RIDING_GEAR_TARGET_OPTIONS = ["Aikuisten", "Lasten", "Naisten", "Miesten", "Unisex"] as const;

function isRidingGearListing(listing: Listing) {
  return normalizeSearchText(`${listing.category ?? ""} ${listing.subcategory ?? ""}`).includes("ajovaruste");
}

const VEHICLE_ENGINE_KIND_OPTIONS = ["2-tahti", "4-tahti", "Diesel", "Sähkö"] as const;
const VEHICLE_DRIVE_TYPE_OPTIONS = [
  "Etuveto",
  "Kuusipyöräveto",
  "Hihnaveto",
  "Neliveto",
  "Kardaaniveto",
  "Takaveto",
  "Ketjuveto"
] as const;
const VEHICLE_ROAD_LEGAL_OPTIONS = [
  "Tieliikennekelpoinen",
  "Ei tieliikennekelpoinen"
] as const;
const VEHICLE_MILEAGE_FILTER_MAX = 200000;
const VEHICLE_HOURS_FILTER_MAX = 5000;
const VEHICLE_PRICE_FILTER_MAX = 100000;

function hasAppliedFilters(filters: AppliedListingFilters) {
  return (
    Boolean(filters.vehicleType) ||
    Boolean(filters.query.trim()) ||
    filters.selectedBrand !== "Kaikki" ||
    Boolean(filters.vehicleSubtype.trim()) ||
    Boolean(filters.category) ||
    Boolean(filters.subcategory) ||
    Boolean(filters.garageFilterId) ||
    Boolean(filters.modelQuery.trim()) ||
    Boolean(filters.identifierQuery.trim()) ||
    Boolean(filters.locationQuery.trim()) ||
    Boolean(filters.yearQuery.trim()) ||
    Boolean(filters.yearMinQuery.trim()) ||
    Boolean(filters.yearMaxQuery.trim()) ||
    Boolean(filters.engineCcQuery.trim()) ||
    Boolean(filters.engineModelQuery.trim()) ||
    Boolean(filters.vehicleMileageMinQuery.trim()) ||
    Boolean(filters.vehicleMileageMaxQuery.trim()) ||
    Boolean(filters.vehicleHoursMinQuery.trim()) ||
    Boolean(filters.vehicleHoursMaxQuery.trim()) ||
    Boolean(filters.vehicleRegistrationQuery.trim()) ||
    Boolean(filters.vehicleEngineKindQuery) ||
    Boolean(filters.vehicleDriveTypeQuery) ||
    Boolean(filters.vehicleRoadLegalQuery) ||
    filters.vehicleAccessoriesQuery.length > 0 ||
    filters.vehicleColorsQuery.length > 0 ||
    Boolean(filters.vehicleVatDeductibleQuery) ||
    Boolean(filters.vehicleTaxFreeQuery) ||
    Boolean(filters.trackMatDimensionQuery.trim()) ||
    filters.gearTypeQuery.length > 0 ||
    filters.gearBrandOptionsQuery.length > 0 ||
    filters.gearSizeOptionsQuery.length > 0 ||
    Boolean(filters.gearBrandQuery.trim()) ||
    Boolean(filters.gearSizeQuery.trim()) ||
    Boolean(filters.gearConditionQuery.trim()) ||
    Boolean(filters.gearTargetQuery.trim()) ||
    Boolean(filters.sellerType) ||
    filters.minPrice !== 0 ||
    filters.maxPrice !== 100000
  );
}

const MARKETPLACE_FILTER_URL_KEYS = [
  "q",
  "market",
  "seller",
  "location",
  "vehicleType",
  "vehicleSubtype",
  "brand",
  "model",
  "category",
  "subcategory",
  "identifier",
  "year",
  "yearMin",
  "yearMax",
  "engineCc",
  "engineModel",
  "mileageMin",
  "mileageMax",
  "hoursMin",
  "hoursMax",
  "registration",
  "engineKind",
  "driveType",
  "roadLegal",
  "accessory",
  "color",
  "vatDeductible",
  "taxFree",
  "track",
  "minPrice",
  "maxPrice",
  "gearType",
  "gearBrand",
  "gearSize",
  "gearBrandText",
  "gearSizeText",
  "gearCondition",
  "gearTarget"
] as const;

type MarketplaceFilterSearchParams = Pick<URLSearchParams, "get" | "getAll" | "has">;

function marketplaceModeFromSearchParams(params: MarketplaceFilterSearchParams): MarketplaceMode {
  const market = params.get("market");
  if (market === "vehicles" || market === "gear") return market;

  return normalizeSearchText(params.get("category") ?? "").includes("ajovaruste")
    ? "gear"
    : "parts";
}

function numberFilterParam(params: MarketplaceFilterSearchParams, key: string, fallback: number) {
  const rawValue = params.get(key)?.trim();
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function listingFiltersFromSearchParams(params: MarketplaceFilterSearchParams): AppliedListingFilters {
  const categoryParam = params.get("category")?.trim() ?? "";
  const categoryIsRidingGear = normalizeSearchText(categoryParam).includes("ajovaruste");

  return {
    query: params.get("q")?.trim() ?? "",
    category: categoryIsRidingGear ? "" : categoryParam,
    subcategory: params.get("subcategory")?.trim() ?? "",
    vehicleType: params.get("vehicleType")?.trim() ?? "",
    vehicleSubtype: params.get("vehicleSubtype")?.trim() ?? "",
    selectedBrand: params.get("brand")?.trim() || "Kaikki",
    modelQuery: params.get("model")?.trim() ?? "",
    identifierQuery: params.get("identifier")?.trim() ?? "",
    locationQuery: params.get("location")?.trim() ?? "",
    yearQuery: params.get("year")?.trim() ?? "",
    yearMinQuery: params.get("yearMin")?.trim() ?? "",
    yearMaxQuery: params.get("yearMax")?.trim() ?? "",
    engineCcQuery: params.get("engineCc")?.trim() ?? "",
    engineModelQuery: params.get("engineModel")?.trim() ?? "",
    vehicleMileageMinQuery: params.get("mileageMin")?.trim() ?? "",
    vehicleMileageMaxQuery: params.get("mileageMax")?.trim() ?? "",
    vehicleHoursMinQuery: params.get("hoursMin")?.trim() ?? "",
    vehicleHoursMaxQuery: params.get("hoursMax")?.trim() ?? "",
    vehicleRegistrationQuery: params.get("registration")?.trim() ?? "",
    vehicleEngineKindQuery: params.get("engineKind")?.trim() ?? "",
    vehicleDriveTypeQuery: params.get("driveType")?.trim() ?? "",
    vehicleRoadLegalQuery: params.get("roadLegal")?.trim() ?? "",
    vehicleAccessoriesQuery: params.getAll("accessory").map((value) => value.trim()).filter(Boolean),
    vehicleColorsQuery: params.getAll("color").map((value) => value.trim()).filter(Boolean),
    vehicleVatDeductibleQuery: params.get("vatDeductible") === "1",
    vehicleTaxFreeQuery: params.get("taxFree") === "1",
    trackMatDimensionQuery: params.get("track")?.trim() ?? "",
    minPrice: numberFilterParam(params, "minPrice", 0),
    maxPrice: numberFilterParam(params, "maxPrice", 100000),
    garageFilterId: "",
    gearTypeQuery: params.getAll("gearType").map((value) => value.trim()).filter(Boolean),
    gearBrandOptionsQuery: params.getAll("gearBrand").map((value) => value.trim()).filter(Boolean),
    gearSizeOptionsQuery: params.getAll("gearSize").map((value) => value.trim()).filter(Boolean),
    gearBrandQuery: params.get("gearBrandText")?.trim() ?? "",
    gearSizeQuery: params.get("gearSizeText")?.trim() ?? "",
    gearConditionQuery: params.get("gearCondition")?.trim() ?? "",
    gearTargetQuery: params.get("gearTarget")?.trim() ?? "",
    sellerType: (params.get("seller")?.trim() ?? "") as SellerTypeFilter
  };
}

function marketplaceFilterSearchParams(
  currentParams: MarketplaceFilterSearchParams,
  filters: AppliedListingFilters,
  mode: MarketplaceResultMode
) {
  const params = new URLSearchParams();

  for (const key of ["lang", "catalog"] as const) {
    const value = currentParams.get(key);
    if (value) params.set(key, value);
  }

  const setText = (key: string, value?: string | null) => {
    const normalized = value?.trim();
    if (normalized) params.set(key, normalized);
  };
  const appendValues = (key: string, values: readonly string[]) => {
    for (const value of values) setText(key, value);
  };

  setText("q", filters.query);
  if (mode === "vehicles" || mode === "gear") params.set("market", mode);
  setText("seller", filters.sellerType);
  setText("location", filters.locationQuery);
  setText("vehicleType", filters.vehicleType);
  setText("vehicleSubtype", filters.vehicleSubtype);
  if (filters.selectedBrand !== "Kaikki") setText("brand", filters.selectedBrand);
  setText("model", filters.modelQuery);
  setText("category", filters.category);
  setText("subcategory", filters.subcategory);
  setText("identifier", filters.identifierQuery);
  setText("year", filters.yearQuery);
  setText("yearMin", filters.yearMinQuery);
  setText("yearMax", filters.yearMaxQuery);
  setText("engineCc", filters.engineCcQuery);
  setText("engineModel", filters.engineModelQuery);
  setText("mileageMin", filters.vehicleMileageMinQuery);
  setText("mileageMax", filters.vehicleMileageMaxQuery);
  setText("hoursMin", filters.vehicleHoursMinQuery);
  setText("hoursMax", filters.vehicleHoursMaxQuery);
  setText("registration", filters.vehicleRegistrationQuery);
  setText("engineKind", filters.vehicleEngineKindQuery);
  setText("driveType", filters.vehicleDriveTypeQuery);
  setText("roadLegal", filters.vehicleRoadLegalQuery);
  appendValues("accessory", filters.vehicleAccessoriesQuery);
  appendValues("color", filters.vehicleColorsQuery);
  if (filters.vehicleVatDeductibleQuery) params.set("vatDeductible", "1");
  if (filters.vehicleTaxFreeQuery) params.set("taxFree", "1");
  setText("track", filters.trackMatDimensionQuery);
  if (filters.minPrice !== 0) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== 100000) params.set("maxPrice", String(filters.maxPrice));
  appendValues("gearType", filters.gearTypeQuery);
  appendValues("gearBrand", filters.gearBrandOptionsQuery);
  appendValues("gearSize", filters.gearSizeOptionsQuery);
  setText("gearBrandText", filters.gearBrandQuery);
  setText("gearSizeText", filters.gearSizeQuery);
  setText("gearCondition", filters.gearConditionQuery);
  setText("gearTarget", filters.gearTargetQuery);

  return params;
}

type LocationMultiSelectOption = {
  value: string;
  label: string;
  section?: string;
  action?: boolean;
  level?: number;
  actionLevel?: number;
  countryCode?: "FI" | "SE" | "NO";
  targetSection?: string;
};

function LocationMultiSelectField({
  label,
  placeholder,
  searchPlaceholder,
  options,
  selected,
  open,
  disabled = false,
  onToggleOpen,
  onToggle,
  onClear,
  onDone,
  selectedCountLabel,
  emptyLabel,
  clearLabel,
  doneLabel
}: {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  options: LocationMultiSelectOption[];
  selected: string[];
  open: boolean;
  disabled?: boolean;
  onToggleOpen: () => void;
  onToggle: (value: string) => void;
  onClear: () => void;
  onDone?: () => void;
  selectedCountLabel: (count: number) => string;
  emptyLabel: string;
  clearLabel: string;
  doneLabel?: string;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const optionListRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState("");
  const [visibleLocationLevel, setVisibleLocationLevel] = useState(0);
  const normalizedSearch = searchValue.trim().toLocaleLowerCase("fi");
  const selectedCountryCodes = selected
    .filter((value) => value.startsWith("country:"))
    .map((value) => value.slice("country:".length))
    .filter(
      (value): value is "FI" | "SE" | "NO" =>
        value === "FI" || value === "SE" || value === "NO"
    );
  const selectedRegionCountryCodes = Array.from(new Set(
    selected
      .filter((value) => value.startsWith("region:"))
      .map((value) => value.slice("region:".length))
      .map((value): "FI" | "SE" | "NO" => {
        if (getNorwayLocationName(value)) return "NO";
        if (getSwedenLocationName(value)) return "SE";
        return "FI";
      })
  ));
  const visibleCountryCodes: Array<"FI" | "SE" | "NO"> =
    visibleLocationLevel >= 2 && selectedRegionCountryCodes.length > 0
      ? selectedRegionCountryCodes
      : selectedCountryCodes.length > 0
        ? selectedCountryCodes
        : ["FI", "SE", "NO"];
  const availableOptions = options.filter(
    (option) =>
      (option.level ?? 0) === 0 ||
      (
        (option.level ?? 0) <= visibleLocationLevel &&
        (
          option.action ||
          (
            option.countryCode !== undefined &&
            visibleCountryCodes.includes(option.countryCode)
          )
        )
      )
  );
  const filteredOptions = normalizedSearch
    ? options.filter((option) =>
        option.label.toLocaleLowerCase("fi").includes(normalizedSearch)
      )
    : availableOptions;
  const listOptions = filteredOptions.filter((option) => !option.action);
  const nextActionOptions = normalizedSearch
    ? []
    : availableOptions.filter(
        (option) =>
          option.action &&
          option.actionLevel !== undefined &&
          option.actionLevel > visibleLocationLevel
      );
  const selectedLabels = selected
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter((value): value is string => Boolean(value));
  const summary = selectedLabels.length === 0
    ? placeholder
    : selectedLabels.length === 1
      ? selectedLabels[0]
      : selectedCountLabel(selectedLabels.length);

  useEffect(() => {
    if (!open) {
      setSearchValue("");
      setVisibleLocationLevel(0);
    }
  }, [open]);

  useEffect(() => {
    const selectedLevels = options
      .filter(
        (option) =>
          selected.includes(option.value) &&
          (option.level ?? 0) > 0
      )
      .map((option) => option.level ?? 0);
    if (selectedLevels.length === 0) return;

    setVisibleLocationLevel((current) => Math.max(current, ...selectedLevels));
  }, [options, selected]);

  useEffect(() => {
    if (!open) return;

    const closeWhenClickingOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-location-close="true"]')
      ) {
        return;
      }
      if (
        target instanceof Node &&
        fieldRef.current &&
        !fieldRef.current.contains(target)
      ) {
        onToggleOpen();
      }
    };

    document.addEventListener("pointerdown", closeWhenClickingOutside);
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside);
  }, [open, onToggleOpen]);

  const openLocationLevel = (option: LocationMultiSelectOption) => {
    if (option.actionLevel === undefined) return;

    setVisibleLocationLevel(option.actionLevel);
    onToggle(option.value);

    const targetCountryCodes =
      option.actionLevel >= 2 && selectedRegionCountryCodes.length > 0
        ? selectedRegionCountryCodes
        : visibleCountryCodes;
    const targetSection = option.targetSection ?? options.find(
      (candidate) =>
        !candidate.action &&
        candidate.section &&
        candidate.level === option.actionLevel &&
        candidate.countryCode &&
        targetCountryCodes.includes(candidate.countryCode)
    )?.section;
    if (!targetSection) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const section = optionListRef.current?.querySelector<HTMLElement>(
          `[data-location-section="${targetSection}"]`
        );
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  return (
    <div
      ref={fieldRef}
      className={`${styles.heroFilterFieldWrap} ${disabled ? styles.locationFilterDisabled : ""}`}
      data-no-auto-translate
    >
      <span className={styles.heroFilterLabel}>{label}</span>
      <button
        type="button"
        className={styles.heroFilterSelect}
        onClick={onToggleOpen}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <strong>{summary}</strong>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && !disabled ? (
        <div
          className={`${styles.heroFilterMenu} ${styles.locationMultiMenu} ${
            visibleLocationLevel === 0 && !normalizedSearch
              ? styles.locationCountriesMenu
              : styles.locationExpandedMenu
          }`}
          role="listbox"
          aria-multiselectable="true"
        >
          <label className={styles.locationSearchField}>
            <Search size={15} aria-hidden="true" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
          <div
            ref={optionListRef}
            className={`${styles.locationOptionList} ${
              visibleLocationLevel === 0 && !normalizedSearch
                ? styles.locationCountryGrid
                : ""
            }`}
          >
            {listOptions.length > 0 ? listOptions.map((option, index) => {
              const active = selected.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={`${styles.locationOptionGroup} ${
                    option.section === "Maat" ? styles.locationCountryGroup : ""
                  }`}
                >
                  {option.section && (
                    index === 0 || listOptions[index - 1]?.section !== option.section
                  ) ? (
                    <span
                      className={styles.locationOptionSection}
                      data-location-section={option.section}
                    >
                      {option.section}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={`${styles.locationMultiOption} ${
                      option.section === "Maat" ? styles.locationCountryOption : ""
                    } ${active ? styles.locationMultiOptionSelected : ""}`}
                    onClick={() => onToggle(option.value)}
                    role="option"
                    aria-selected={active}
                  >
                    <span>{option.label}</span>
                    <span className={styles.locationOptionCheck} aria-hidden="true">
                      {active ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                  </button>
                </div>
              );
            }) : (
              <span className={styles.heroFilterMenuEmpty}>{emptyLabel}</span>
            )}
          </div>
          {nextActionOptions.length > 0 || selected.length > 0 || onDone ? (
            <div className={styles.locationMenuFooter}>
              {nextActionOptions.map((actionOption) => (
                <div className={styles.locationOptionActionGroup} key={actionOption.value}>
                  <button
                    type="button"
                    className={`${styles.locationMultiOption} ${styles.locationMultiAction}`}
                    onClick={() => openLocationLevel(actionOption)}
                  >
                    <span>{actionOption.label}</span>
                    <span className={styles.locationActionArrow} aria-hidden="true">→</span>
                  </button>
                </div>
              ))}
              {selected.length > 0 || onDone ? (
                <div className={styles.locationMenuButtons}>
                  {selected.length > 0 ? (
                    <button type="button" className={styles.locationClearSelection} onClick={onClear}>
                      {clearLabel}
                    </button>
                  ) : null}
                  {onDone ? (
                    <button type="button" className={styles.locationDoneButton} onClick={onDone}>
                      {doneLabel ?? "Valmis"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const modelPlaceholders: Record<string, string> = {
  Moottorikelkka: "e.g. Lynx 600",
  Mönkijä: "e.g. Can-Am Outlander",
  Motocross: "e.g. YZ 250 / CRF 450",
  Mopot: "e.g. Yamaha DT",
  Mopo: "e.g. Yamaha DT"
};

function normalizeCategoryMatch(value?: string | null, subcategory = "") {
  const rawValue = (value ?? "").trim();
  const normalized = rawValue.toLowerCase();

  if (
    normalized === "moottori" ||
    normalized === "voimansiirto" ||
    normalized === "moottori & voimansiirto"
  ) {
    return getUnifiedAllCategoryName(rawValue, subcategory).toLowerCase();
  }
  if (normalized === "sähkö") return "sähköjärjestelmät";
  if (normalized === "pakoputki") return "pakoputkisto";
  if (normalized === "alusta" || normalized === "jousitus") return "alusta & telasto";
  if (normalized === "runko") return "runko & katteet";

  return normalized;
}

function normalizeSubcategoryMatch(value?: string | null) {
  const leaf = (value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase() ?? "";

  const singulars: Record<string, string> = {
    sylinteri: "sylinterit",
    mäntä: "männät",
    tiiviste: "laakerit & tiivisteet",
    kaasutin: "kaasuttimet",
    sytytys: "sytytyspuolat",
    akku: "akut",
    valo: "valot",
    johdotus: "johtosarjat",
    ohjaustanko: "ohjaustangot",
    jarrut: "jarrupalat",
    kytkin: "kytkin kitit",
    variaattori: "variaattori kitit",
    hihnat: "variaattorin hihnat",
    ketjut: "ketjut & hihnat",
    äänenvaimennin: "äänenvaimentimet"
  };

  return singulars[leaf] ?? leaf;
}

function listingMatchesSubcategoryFilter(
  listingSubcategory?: string | null,
  selectedSubcategory?: string | null,
  selectedGroupChildren: readonly string[] = []
) {
  if (!selectedSubcategory) return true;

  const listingValue = listingSubcategory ?? "";
  const selectedValue = selectedSubcategory ?? "";
  const normalizedListing = normalizeSubcategoryMatch(listingValue);
  const normalizedSelected = normalizeSubcategoryMatch(selectedValue);

  if (normalizedListing === normalizedSelected) return true;

  // A parent option such as "Moottorit" represents every detailed part in
  // that group, including standalone leaves such as "Kokonainen moottori".
  // Those leaves do not necessarily contain the parent name in their stored
  // subcategory, so a plain string/segment comparison would incorrectly
  // produce zero results for the parent selection.
  if (
    selectedGroupChildren.some((child) =>
      listingMatchesSubcategoryFilter(listingSubcategory, child)
    )
  ) {
    return true;
  }

  const listingParts = listingValue.split("/").map((part) => part.trim()).filter(Boolean);
  const selectedParts = selectedValue.split("/").map((part) => part.trim()).filter(Boolean);
  const selectedLeaf = selectedParts.at(-1) ?? selectedValue;
  const normalizedSelectedLeaf = normalizeSubcategoryMatch(selectedLeaf);

  return listingParts.some((part) => normalizeSubcategoryMatch(part) === normalizedSelectedLeaf);
}

function normalizeSearchText(value?: string | null) {
  return (value ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´.]/g, "")
    .replace(/[^a-z0-9åäö]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value?: string | null) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function vehicleDescriptionNumber(description: string | null | undefined, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = (description ?? "").match(new RegExp(`${escapedLabel}:\\s*([\\d\\s.,]+)`, "i"));
  if (!match) return null;

  const value = Number(match[1].replace(/[^\d]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function vehicleRegistrationFromDescription(description?: string | null) {
  return vehicleDescriptionValue(description, "Rekisteritunnus");
}

function vehicleDescriptionValue(description: string | null | undefined, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (description ?? "").match(new RegExp(`${escapedLabel}:\\s*([^\\r\\n]+)`, "i"))?.[1]?.trim() ?? "";
}

const MARKETPLACE_SEARCH_TERM_GROUPS: readonly (readonly string[])[] = [
  ["moottori", "moottorit", "moottorin", "moottoreita", "motor", "motorer", "motorn", "motorerna", "engine", "engines"],
  ["telamatto", "telamatot", "telamaton", "telamattoa", "drivmatta", "drivmattor", "drivmattan", "track", "tracks"],
  ["kytkin", "kytkimet", "koppling", "kopplingar", "clutch", "clutches"],
  ["variaattori", "variaattorit", "variator", "variatorer"],
  ["telasto", "telastot", "boggi", "boggier", "bogie", "suspension"],
  ["suksi", "sukset", "skida", "skidor", "ski", "skis"],
  ["iskunvaimennin", "iskunvaimentimet", "iskari", "iskarit", "stötdämpare", "stotdampare", "shock", "shocks"],
  ["jarru", "jarrut", "broms", "bromsar", "brake", "brakes"],
  ["pakoputki", "pakoputkisto", "avgassystem", "avgasrör", "avgasror", "exhaust"],
  ["tuulilasi", "tuulilasit", "vindruta", "vindrutor", "windshield"],
  ["istuin", "istuimet", "penkki", "penkit", "säte", "sate", "säten", "seat", "seats"],
  ["rengas", "renkaat", "däck", "dack", "däcken", "tire", "tires"],
  ["vanne", "vanteet", "fälg", "falg", "fälgar", "rim", "rims"],
  ["sähkö", "sahko", "elsystem", "elektrisk", "electric", "electrical"],
  ["sytytys", "tändning", "tandning", "ignition"],
  ["jäähdytys", "jaahdytys", "kylning", "cooling"],
  ["polttoaine", "polttoainejärjestelmä", "bränsle", "bransle", "fuel"],
  ["runko", "rungot", "ram", "ramar", "frame", "frames"],
  ["kate", "katteet", "kåpa", "kapa", "kåpor", "bodywork", "fairing", "fairings"]
].map((group) => group.map((term) => normalizeSearchText(term)));

const MARKETPLACE_SEARCH_ALIASES = new Map<string, readonly string[]>(
  MARKETPLACE_SEARCH_TERM_GROUPS.flatMap((group) =>
    group.map((term) => [term, group] as const)
  )
);

function sharedSearchPrefixLength(first: string, second: string) {
  const limit = Math.min(first.length, second.length);
  let index = 0;

  while (index < limit && first[index] === second[index]) index += 1;
  return index;
}

function searchWordsMatch(haystackWord: string, queryWord: string) {
  if (haystackWord === queryWord) return true;

  // Engine searches must not turn into a match for every snowmobile merely
  // because the vehicle type contains the word "moottori".
  if (
    MARKETPLACE_SEARCH_ALIASES.get(queryWord)?.includes("moottori") &&
    haystackWord.startsWith("moottorikelk")
  ) {
    return false;
  }

  const queryAlternatives = MARKETPLACE_SEARCH_ALIASES.get(queryWord) ?? [queryWord];

  return queryAlternatives.some((alternative) => {
    if (haystackWord === alternative) return true;
    if (
      alternative.length >= 4 &&
      (haystackWord.startsWith(alternative) || alternative.startsWith(haystackWord))
    ) {
      return true;
    }

    const sharedPrefixLength = sharedSearchPrefixLength(haystackWord, alternative);
    const shorterLength = Math.min(haystackWord.length, alternative.length);

    return (
      shorterLength >= 5 &&
      sharedPrefixLength >= Math.max(5, shorterLength - 3) &&
      sharedPrefixLength / shorterLength >= 0.7
    );
  });
}

function isMoreSpecificModelVariant(candidate: string, selectedModel: string) {
  const candidateText = normalizeSearchText(candidate);
  const selectedText = normalizeSearchText(selectedModel);

  if (!candidateText || !selectedText || candidateText === selectedText) return false;

  const candidateWords = candidateText.split(" ");
  const selectedWords = selectedText.split(" ");
  const containsSelectedWords = candidateWords.some((_, index) =>
    selectedWords.every((word, selectedIndex) => candidateWords[index + selectedIndex] === word)
  );

  if (containsSelectedWords) return true;

  const compactSelected = compactSearchText(selectedText);
  return compactSelected.length >= 2 && compactSearchText(candidateText).startsWith(compactSelected);
}

function textMatchesSearch(haystack: string, needle: string) {
  const normalizedNeedle = normalizeSearchText(needle);

  if (!normalizedNeedle) return true;

  const normalizedHaystack = normalizeSearchText(haystack);
  const haystackWords = normalizedHaystack.split(" ").filter(Boolean);
  const queryWords = normalizedNeedle.split(" ").filter(Boolean);

  if (queryWords.every((queryWord) =>
    haystackWords.some((haystackWord) => searchWordsMatch(haystackWord, queryWord))
  )) {
    return true;
  }

  if (
    queryWords.some((queryWord) =>
      MARKETPLACE_SEARCH_ALIASES.get(queryWord)?.includes("moottori")
    )
  ) {
    return false;
  }

  return (
    normalizedHaystack.includes(normalizedNeedle) ||
    compactSearchText(normalizedHaystack).includes(compactSearchText(normalizedNeedle))
  );
}

function allSearchWordsMatch(haystack: string, needle: string) {
  const ignoredSearchWords = new Set([
    "osa",
    "osat",
    "osia",
    "varaosa",
    "varaosat",
    "varaosia",
    "parts",
    "part"
  ]);

  return normalizeSearchText(needle)
    .split(" ")
    .filter(Boolean)
    .filter((word) => !ignoredSearchWords.has(word))
    .every((word) => textMatchesSearch(haystack, word));
}

const SUBCATEGORY_GROUP_SEARCH_TERMS: Record<string, readonly string[]> = {
  "Moottorit": ["moottori", "moottorit", "motor", "motorer", "engine", "engines"],
  "Kytkimet": ["kytkin", "kytkimet", "koppling", "kopplingar", "clutch", "clutches"],
  "Variaattorit": ["variaattori", "variaattorit", "variator", "variatorer"],
  "Voimansiirto": ["voimansiirto", "drivlina", "drivetrain"],
  "Telasto": ["telasto", "boggi", "boggier", "bogie", "suspension"],
  "Renkaat & vanteet": ["rengas", "renkaat", "vanne", "vanteet", "däck", "dack", "fälg", "falg", "tire", "rim"],
  "Alusta": ["alusta", "chassi", "chassis"],
  "Tukivarret": ["tukivarsi", "tukivarret", "länkarm", "lankarm", "control arm"],
  "Iskunvaimentimet": ["iskunvaimennin", "iskunvaimentimet", "iskari", "iskarit", "stötdämpare", "stotdampare", "shock"],
  "Ohjaus akseli": ["ohjaus", "ohjausakseli", "styrning", "styraxel", "steering"],
  "Hallintalaitteet": ["hallintalaite", "hallintalaitteet", "reglage", "controls"],
  "Jarrut": ["jarru", "jarrut", "broms", "bromsar", "brake", "brakes"],
  "Sukset": ["suksi", "sukset", "skida", "skidor", "ski", "skis"],
  "Sähkö": ["sähkö", "elsystem", "elektrisk", "electrical"],
  "Sytytys": ["sytytys", "tändning", "tandning", "ignition"],
  "Jäähdytys": ["jäähdytys", "kylning", "cooling"],
  "Polttoainejärjestelmä": ["polttoaine", "polttoainejärjestelmä", "bränsle", "bransle", "fuel"],
  "Pakoputkisto": ["pakoputki", "pakoputkisto", "avgassystem", "avgasrör", "avgasror", "exhaust"],
  "Runko": ["runko", "ram", "frame"],
  "Katteet": ["kate", "katteet", "kåpa", "kapa", "bodywork", "fairing"],
  "Etupuskurit": ["etupuskuri", "etupuskurit", "främre stötfångare", "front bumper"],
  "Takapuskurit": ["takapuskuri", "takapuskurit", "bakre stötfångare", "rear bumper"],
  "Istuimet & penkit": ["istuin", "istuimet", "penkki", "penkit", "säte", "sate", "seat"],
  "Tuulilasit": ["tuulilasi", "tuulilasit", "vindruta", "vindrutor", "windshield"]
};

function getSubcategoryGroupSearchScope(queryText: string) {
  const queryWords = normalizeSearchText(queryText).split(" ").filter(Boolean);
  const matchedWords = new Set<string>();
  const groups: Array<{ group: string; children: readonly string[] }> = [];

  for (const categoryGroups of Object.values(subcategoryGroups)) {
    for (const [group, children] of Object.entries(categoryGroups)) {
      const terms = SUBCATEGORY_GROUP_SEARCH_TERMS[group] ?? [normalizeSearchText(group)];
      const matchingWords = queryWords.filter((word) =>
        terms.some((term) => normalizeSearchText(term) === word)
      );

      if (matchingWords.length === 0) continue;
      matchingWords.forEach((word) => matchedWords.add(word));
      groups.push({ group, children });
    }
  }

  return {
    groups,
    remainingQuery: queryWords.filter((word) => !matchedWords.has(word)).join(" ")
  };
}

function queryWithoutVehicleIdentityTerms(
  queryText: string,
  values: Array<string | null | undefined>
) {
  const ignoredWords = new Set<string>();

  for (const value of values) {
    for (const word of normalizeSearchText(value).split(" ").filter(Boolean)) {
      ignoredWords.add(word);
    }
  }

  const yearWords = new Set(
    normalizeSearchText(queryText)
      .split(" ")
      .filter((word) => /^(19|20)\d{2}$/.test(word))
  );

  return normalizeSearchText(queryText)
    .split(" ")
    .filter(Boolean)
    .filter((word) => !ignoredWords.has(word))
    .filter((word) => !yearWords.has(word))
    .join(" ");
}

function brandMatchesListing(
  selectedBrand: string,
  listing: Listing,
  listingText: { title: string; description: string }
) {
  if (selectedBrand === "Kaikki") return true;

  if (listing.brand?.trim()) {
    return textMatchesSearch(listing.brand, selectedBrand);
  }

  const haystack = [
    listing.model ?? "",
    listing.title,
    listing.description,
    listingText.title,
    listingText.description
  ].join(" ");

  if (textMatchesSearch(haystack, selectedBrand)) {
    return true;
  }

  return false;
}

function getListingVehicleSubtypeText(
  listing: Listing,
  listingText: { title: string; description: string }
) {
  const metadataSubtype =
    `${listing.description ?? ""}\n${listingText.description ?? ""}`
      .match(/(?:^|\n)Ajoneuvotyyppi:\s*([^\n]+)/i)?.[1]
      ?.trim() ?? "";

  return [
    listing.vehicle_subtype ?? "",
    metadataSubtype,
    listing.title,
    listingText.title,
    listing.description,
    listingText.description
  ].join(" ");
}

function getListingYearText(
  listing: Listing,
  listingText: { title: string; description: string }
) {
  const metadataYear =
    `${listing.description ?? ""}\n${listingText.description ?? ""}`
      .match(/(?:^|\n)Vuosi(?:malli)?:\s*([^\n]+)/i)?.[1]
      ?.trim() ?? "";

  return [
    listing.year ?? "",
    metadataYear
  ].join(" ");
}

function listingMatchesVehicleType(
  listing: Listing,
  listingText: { title: string; description: string },
  selectedVehicleType: string
) {
  if (!selectedVehicleType) return true;

  const selected = normalizeVehicleType(selectedVehicleType);
  const stored = normalizeVehicleType(listing.vehicle_type ?? "");

  // If the listing has an explicit, known vehicle type, it is authoritative –
  // never allow fuzzy text/cc heuristics to pull it into the wrong category.
  if (isKnownVehicleType(stored)) {
    return stored === selected;
  }

  const haystack = [
    listing.vehicle_type ?? "",
    listing.title,
    listingText.title,
    listing.description,
    listingText.description,
    listing.brand ?? "",
    listing.model ?? "",
    listing.engine_cc ?? ""
  ].join(" ");

  if (selected === "Mopo") {
    // Exclude obvious motocross/snowmobile/ATV leaks when inferring by cc.
    if (
      textMatchesSearch(haystack, "motocross") ||
      textMatchesSearch(haystack, "moottorikelkka") ||
      textMatchesSearch(haystack, "kelkka") ||
      textMatchesSearch(haystack, "snowmobile") ||
      textMatchesSearch(haystack, "mönkijä") ||
      textMatchesSearch(haystack, "atv")
    ) {
      return false;
    }

    const cc = Number(String(listing.engine_cc ?? "").replace(/[^\d.]/g, ""));
    return (
      textMatchesSearch(haystack, "mopo") ||
      textMatchesSearch(haystack, "moped") ||
      textMatchesSearch(haystack, "bws") ||
      (cc > 0 && cc <= 50)
    );
  }

  if (selected === "Moottorikelkka") {
    return textMatchesSearch(haystack, "moottorikelkka") || textMatchesSearch(haystack, "kelkka") || textMatchesSearch(haystack, "snowmobile");
  }

  if (selected === "Mönkijä") {
    return textMatchesSearch(haystack, "mönkijä") || textMatchesSearch(haystack, "atv") || textMatchesSearch(haystack, "outlander") || textMatchesSearch(haystack, "sportsman");
  }

  if (selected === "Motocross") {
    return textMatchesSearch(haystack, "motocross") || textMatchesSearch(haystack, "yz") || textMatchesSearch(haystack, "crf") || textMatchesSearch(haystack, "sx");
  }

  return false;
}

const fallbackCardImage = fallbackListingImage;

function safeImageSrc(src: string | undefined | null) {
  if (!src) return fallbackCardImage;

  return src;
}

function isListingNew(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created < 24 * 60 * 60 * 1000;
}

function listingImageSrc(listing: Listing) {
  const firstStoredImage =
    listing.image_url ||
    listing.image_urls?.find(Boolean) ||
    null;

  return safeImageSrc(firstStoredImage);
}

function listingImageSeoAlt(listing: Listing, localizedTitle: string) {
  const title = localizedTitle.trim();
  const normalizedTitle = title.toLocaleLowerCase("fi");
  const missingVehicleDetails = [listing.brand, listing.model, listing.year]
    .map((value) => String(value ?? "").trim())
    .filter((value) => value && !normalizedTitle.includes(value.toLocaleLowerCase("fi")));

  return [...missingVehicleDetails, title, formatPrice(listing.price)]
    .filter(Boolean)
    .join(" – ");
}

function normalizeLocation(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9åäö\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLocationTerms(input: {
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
}) {
  return [input.city, input.postal_code, input.address]
    .flatMap((value) => normalizeLocation(value ?? "").split(" "))
    .filter((term) => term.length >= 3);
}

function locationMatchScore(listingLocation: string, terms: string[]) {
  if (terms.length === 0) return 0;

  const normalizedListingLocation = normalizeLocation(listingLocation);

  return terms.reduce(
    (score, term) =>
      normalizedListingLocation.includes(term)
        ? score + (/\d/.test(term) ? 3 : 2)
        : score,
    0
  );
}

function readSavedListingIds() {
  try {
    const saved = JSON.parse(localStorage.getItem("savedListings") || "[]");
    return Array.isArray(saved)
      ? saved.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "Pyyntö aikakatkaistiin."
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

/* ======================================================
   COMPONENT
====================================================== */

function BodyPortal({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (enabled && typeof document !== "undefined") {
    return createPortal(children, document.body);
  }

  return <>{children}</>;
}

export default function Home({
  initialListings = [],
  initialSearchQuery = "",
  initialMarketplaceMode
}: {
  initialListings?: Listing[];
  initialSearchQuery?: string;
  initialMarketplaceMode?: MarketplaceMode;
}) {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <HomeContent
        initialListings={initialListings}
        initialSearchQuery={initialSearchQuery}
        initialMarketplaceMode={initialMarketplaceMode}
      />
    </Suspense>
  );
}

function HomeContent({
  initialListings,
  initialSearchQuery,
  initialMarketplaceMode
}: {
  initialListings: Listing[];
  initialSearchQuery: string;
  initialMarketplaceMode?: MarketplaceMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [marketplaceMode, setMarketplaceMode] = useState<MarketplaceMode>(() =>
    initialMarketplaceMode ?? (searchParams.get("market") === "vehicles"
      ? "vehicles"
      : searchParams.get("market") === "gear"
        || normalizeSearchText(searchParams.get("category") ?? "").includes("ajovaruste")
        ? "gear"
        : "parts")
  );
  const [appliedMarketplaceMode, setAppliedMarketplaceMode] = useState<MarketplaceResultMode>(
    initialMarketplaceMode ?? "all"
  );
  const isVehicleMarketplace = marketplaceMode === "vehicles";
  const isGearMarketplace = marketplaceMode === "gear";

  const taxonomy = useTaxonomy();
  const partsCategories = useMemo(() => categoriesAsRecord(taxonomy), [taxonomy]);
  const vehicleBrands = useMemo(() => vehicleBrandsRecord(taxonomy), [taxonomy]);
  const vehicleCategories = useMemo(() => {
    const out: Record<string, Record<string, string[]>> = {};
    for (const v of taxonomy.vehicles) {
      out[v.key] = buildVehicleCategoriesFromTaxonomy(taxonomy, v.key);
    }
    return out;
  }, [taxonomy]);
  const allVehicleCategories = useMemo(
    () => mergeMarketplaceCategorySources(partsCategories, vehicleCategories),
    [partsCategories, vehicleCategories]
  );
  const taxonomyVehicleLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const vehicle of taxonomy.vehicles) {
      labels[vehicle.key] =
        vehicle.label?.trim() || vehicle.pillLabel?.trim() || vehicle.key.trim();
    }
    return labels;
  }, [taxonomy]);

  const resultsRef = useRef<HTMLElement | null>(null);
  const favoritesHydrated = useRef(false);
  const listingsPageFetchRef = useRef(false);
  const fullSearchCatalogRequestedRef = useRef(false);
  const garageUrlFilterAppliedRef = useRef(false);
  const marketplaceFilterUrlAppliedRef = useRef(false);

  const [activeLocale, setActiveLocale] = useState<SupportedLocale>("fi");
  const locale: Locale = activeLocale;
  const [localeReady, setLocaleReady] = useState(false);

  const [listings, setListings] = useState<Listing[]>(
    initialListings.length > 0 ? initialListings : fallbackListings
  );
  const [listingsLoading, setListingsLoading] = useState(
    initialListings.length === 0 && fallbackListings.length === 0
  );
  const [listingsTotalCount, setListingsTotalCount] = useState<number | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);

  const [query, setQuery] = useState(initialSearchQuery);
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [compactHeroSearch, setCompactHeroSearch] = useState(false);
  // Keep the server and browser's first render identical. The responsive
  // effect below applies the actual viewport state immediately after mount.
  const [homeSearchPanelOpen, setHomeSearchPanelOpen] = useState(false);
  const [desktopAllFiltersOpen, setDesktopAllFiltersOpen] = useState(false);
  const [desktopFilterTab, setDesktopFilterTab] = useState("basic");
  const [desktopMoreFiltersOpen, setDesktopMoreFiltersOpen] = useState(false);
  const [desktopSearchSaved, setDesktopSearchSaved] = useState(false);
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearchRecord[]>([]);
  const [mobileFilterExpanded, setMobileFilterExpanded] = useState(false);
  const [mobileFilterDragOffset, setMobileFilterDragOffset] = useState(0);
  const mobileFilterDragStartRef = useRef<number | null>(null);
  const mobileSheetFormRef = useRef<HTMLDivElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [listingsExpanded, setListingsExpanded] = useState(Boolean(initialSearchQuery));
  const [catalogOnlyView, setCatalogOnlyView] = useState(Boolean(initialSearchQuery));
  const [pageJumpValue, setPageJumpValue] = useState("");
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [mobilePagination, setMobilePagination] = useState(false);
  const [mobileLatestVisibleCount, setMobileLatestVisibleCount] = useState(12);
  const [desktopLatestVisibleCount, setDesktopLatestVisibleCount] = useState(12);
  const PAGE_SIZE = 40;
  const MOBILE_LISTINGS_INCREMENT = 12;
  const DESKTOP_INITIAL_LISTINGS_COUNT = 12;
  const DESKTOP_LISTINGS_INCREMENT = 12;
  const RECOMMENDED_PREVIEW_SIZE = 4;
  const INITIAL_LISTING_FETCH_LIMIT = 240;
  const YEAR_FILTER_MIN = MARKETPLACE_YEAR_FILTER_MIN;
  const YEAR_FILTER_MAX = getMarketplaceYearFilterMax();

  const [category, setCategory] = useState("");

  const [subcategory, setSubcategory] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleFilter>("");
  const [vehicleSubtype, setVehicleSubtype] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("Kaikki");
  const [modelQuery, setModelQuery] = useState("");
  const [identifierQuery, setIdentifierQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const locationSelection = useMemo(
    () => parseLocationFilter(locationQuery),
    [locationQuery]
  );
  const selectedFinlandRegions = useMemo(
    () => locationSelection.regions.filter(
      (region) => !getSwedenLocationName(region) && !getNorwayLocationName(region)
    ),
    [locationSelection.regions]
  );
  const selectedSwedenCounties = useMemo(
    () => locationSelection.regions
      .map(getSwedenLocationName)
      .filter((county): county is string => Boolean(county)),
    [locationSelection.regions]
  );
  const selectedNorwayCounties = useMemo(
    () => locationSelection.regions
      .map(getNorwayLocationName)
      .filter((county): county is string => Boolean(county)),
    [locationSelection.regions]
  );
  const locationMunicipalityOptions = useMemo(
    () => [...(
      selectedFinlandRegions.length > 0
        ? Array.from(new Set(
            selectedFinlandRegions.flatMap(
              (region) => FINLAND_MUNICIPALITIES_BY_REGION[region] ?? []
            )
          ))
        : FINLAND_MUNICIPALITIES
    )].sort((first, second) =>
      first.localeCompare(second, "fi", { sensitivity: "base" })
    ),
    [selectedFinlandRegions]
  );
  const swedenMunicipalityOptions = useMemo(
    () => [...(
      selectedSwedenCounties.length > 0
        ? Array.from(new Set(
            selectedSwedenCounties.flatMap(
              (county) => SWEDEN_MUNICIPALITIES_BY_COUNTY[county] ?? []
            )
          ))
        : SWEDEN_MUNICIPALITIES
    )].sort((first, second) =>
      first.localeCompare(second, "sv", { sensitivity: "base" })
    ),
    [selectedSwedenCounties]
  );
  const norwayMunicipalityOptions = useMemo(
    () => [...(
      selectedNorwayCounties.length > 0
        ? Array.from(new Set(
            selectedNorwayCounties.flatMap(
              (county) => NORWAY_MUNICIPALITIES_BY_COUNTY[county] ?? []
            )
          ))
        : NORWAY_MUNICIPALITIES
    )].sort((first, second) =>
      first.localeCompare(second, "nb", { sensitivity: "base" })
    ),
    [selectedNorwayCounties]
  );
  const locationFilterCopy = useMemo(() => ({
    fi: {
      location: "Sijainti",
      allLocations: "Kaikki sijainnit",
      searchPlaceholder: "Hae maata, aluetta tai kuntaa",
      noResults: "Ei hakutuloksia",
      clearSelections: "Tyhjennä valinnat",
      done: "Valmis",
      selectedCount: (count: number) => `${count} valittu`,
      countries: "Maat",
      countryNames: { FI: "Suomi", SE: "Ruotsi", NO: "Norja" },
      chooseRegions: "Valitse alue",
      chooseMunicipalities: "Valitse kaupunki tai kunta",
      finlandRegions: "Suomen alueet",
      finlandMunicipalities: "Suomen kaupungit ja kunnat",
      swedenRegions: "Ruotsin läänit",
      swedenMunicipalities: "Ruotsin kaupungit ja kunnat",
      norwayRegions: "Norjan läänit",
      norwayMunicipalities: "Norjan kaupungit ja kunnat"
    },
    en: {
      location: "Location",
      allLocations: "All locations",
      searchPlaceholder: "Search for a country, region or municipality",
      noResults: "No results",
      clearSelections: "Clear selections",
      done: "Done",
      selectedCount: (count: number) => `${count} selected`,
      countries: "Countries",
      countryNames: { FI: "Finland", SE: "Sweden", NO: "Norway" },
      chooseRegions: "Choose a region",
      chooseMunicipalities: "Choose a city or municipality",
      finlandRegions: "Regions of Finland",
      finlandMunicipalities: "Cities and municipalities of Finland",
      swedenRegions: "Counties of Sweden",
      swedenMunicipalities: "Cities and municipalities of Sweden",
      norwayRegions: "Counties of Norway",
      norwayMunicipalities: "Cities and municipalities of Norway"
    },
    sv: {
      location: "Plats",
      allLocations: "Alla platser",
      searchPlaceholder: "Sök land, område eller kommun",
      noResults: "Inga sökresultat",
      clearSelections: "Rensa val",
      done: "Klar",
      selectedCount: (count: number) => `${count} valda`,
      countries: "Länder",
      countryNames: { FI: "Finland", SE: "Sverige", NO: "Norge" },
      chooseRegions: "Välj område",
      chooseMunicipalities: "Välj stad eller kommun",
      finlandRegions: "Finlands regioner",
      finlandMunicipalities: "Finlands städer och kommuner",
      swedenRegions: "Sveriges län",
      swedenMunicipalities: "Sveriges städer och kommuner",
      norwayRegions: "Norges fylken",
      norwayMunicipalities: "Norges städer och kommuner"
    },
    no: {
      location: "Sted",
      allLocations: "Alle steder",
      searchPlaceholder: "Søk etter land, fylke eller kommune",
      noResults: "Ingen resultater",
      clearSelections: "Fjern valg",
      done: "Ferdig",
      selectedCount: (count: number) => `${count} valgt`,
      countries: "Land",
      countryNames: { FI: "Finland", SE: "Sverige", NO: "Norge" },
      chooseRegions: "Velg fylke",
      chooseMunicipalities: "Velg by eller kommune",
      finlandRegions: "Finlands regioner",
      finlandMunicipalities: "Finlands byer og kommuner",
      swedenRegions: "Sveriges län",
      swedenMunicipalities: "Sveriges byer og kommuner",
      norwayRegions: "Norges fylker",
      norwayMunicipalities: "Norges byer og kommuner"
    }
  })[activeLocale], [activeLocale]);
  const locationFilterOptions = useMemo<LocationMultiSelectOption[]>(
    () => [
      ...LOCATION_COUNTRIES.map((country) => ({
        value: `country:${country.value}`,
        label: locationFilterCopy.countryNames[country.value as "FI" | "SE" | "NO"],
        section: locationFilterCopy.countries,
        level: 0
      })),
      {
        value: "action:regions",
        label: locationFilterCopy.chooseRegions,
        action: true,
        level: 0,
        actionLevel: 1
      },
      ...FINLAND_REGIONS.map((region) => ({
        value: `region:${region}`,
        label: region,
        section: locationFilterCopy.finlandRegions,
        level: 1,
        countryCode: "FI" as const
      })),
      ...SWEDEN_COUNTIES.map((county) => ({
        value: `region:${toSwedenLocationValue(county)}`,
        label: county,
        section: locationFilterCopy.swedenRegions,
        level: 1,
        countryCode: "SE" as const
      })),
      ...NORWAY_COUNTIES.map((county) => ({
        value: `region:${toNorwayLocationValue(county)}`,
        label: county,
        section: locationFilterCopy.norwayRegions,
        level: 1,
        countryCode: "NO" as const
      })),
      {
        value: "action:municipalities",
        label: locationFilterCopy.chooseMunicipalities,
        action: true,
        level: 1,
        actionLevel: 2
      },
      ...locationMunicipalityOptions.map((municipality) => ({
        value: `municipality:${municipality}`,
        label: municipality,
        section: locationFilterCopy.finlandMunicipalities,
        level: 2,
        countryCode: "FI" as const
      })),
      ...swedenMunicipalityOptions.map((municipality) => ({
        value: `municipality:${toSwedenLocationValue(municipality)}`,
        label: municipality,
        section: locationFilterCopy.swedenMunicipalities,
        level: 2,
        countryCode: "SE" as const
      })),
      ...norwayMunicipalityOptions.map((municipality) => ({
        value: `municipality:${toNorwayLocationValue(municipality)}`,
        label: municipality,
        section: locationFilterCopy.norwayMunicipalities,
        level: 2,
        countryCode: "NO" as const
      }))
    ],
    [locationFilterCopy, locationMunicipalityOptions, norwayMunicipalityOptions, swedenMunicipalityOptions]
  );
  const [yearQuery, setYearQuery] = useState("");
  const [yearMinQuery, setYearMinQuery] = useState("");
  const [yearMaxQuery, setYearMaxQuery] = useState("");
  const [engineCcQuery, setEngineCcQuery] = useState("");
  const [engineModelQuery, setEngineModelQuery] = useState("");
  const [vehicleMileageMinQuery, setVehicleMileageMinQuery] = useState("");
  const [vehicleMileageMaxQuery, setVehicleMileageMaxQuery] = useState("");
  const [vehicleHoursMinQuery, setVehicleHoursMinQuery] = useState("");
  const [vehicleHoursMaxQuery, setVehicleHoursMaxQuery] = useState("");
  const [vehicleRegistrationQuery, setVehicleRegistrationQuery] = useState("");
  const [vehicleEngineKindQuery, setVehicleEngineKindQuery] = useState("");
  const [vehicleDriveTypeQuery, setVehicleDriveTypeQuery] = useState("");
  const [vehicleRoadLegalQuery, setVehicleRoadLegalQuery] = useState("");
  const [vehicleAccessoriesQuery, setVehicleAccessoriesQuery] = useState<string[]>([]);
  const [vehicleAccessoriesOpen, setVehicleAccessoriesOpen] = useState(false);
  const [vehicleColorsQuery, setVehicleColorsQuery] = useState<string[]>([]);
  const [vehicleColorsOpen, setVehicleColorsOpen] = useState(false);
  const [vehicleVatDeductibleQuery, setVehicleVatDeductibleQuery] = useState(false);
  const [vehicleTaxFreeQuery, setVehicleTaxFreeQuery] = useState(false);
  const [trackMatLengthQuery, setTrackMatLengthQuery] = useState("");
  const [trackMatLengthCustomQuery, setTrackMatLengthCustomQuery] = useState("");
  const [trackMatWidthQuery, setTrackMatWidthQuery] = useState("");
  const [trackMatWidthCustomQuery, setTrackMatWidthCustomQuery] = useState("");
  const [trackMatPitchQuery, setTrackMatPitchQuery] = useState("");
  const [trackMatPitchCustomQuery, setTrackMatPitchCustomQuery] = useState("");
  const [trackMatDimensionQuery, setTrackMatDimensionQuery] = useState("");
  const effectiveTrackMatLengthQuery = trackMatLengthQuery === CUSTOM_TRACK_MAT_DIMENSION_VALUE
    ? trackMatLengthCustomQuery.trim()
    : trackMatLengthQuery;
  const effectiveTrackMatWidthQuery = trackMatWidthQuery === CUSTOM_TRACK_MAT_DIMENSION_VALUE
    ? trackMatWidthCustomQuery.trim()
    : trackMatWidthQuery;
  const effectiveTrackMatPitchQuery = trackMatPitchQuery === CUSTOM_TRACK_MAT_DIMENSION_VALUE
    ? trackMatPitchCustomQuery.trim()
    : trackMatPitchQuery;

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);
  const [gearTypeQuery, setGearTypeQuery] = useState<string[]>([]);
  const [gearBrandOptionsQuery, setGearBrandOptionsQuery] = useState<string[]>([]);
  const [gearSizeOptionsQuery, setGearSizeOptionsQuery] = useState<string[]>([]);
  const [gearBrandQuery, setGearBrandQuery] = useState("");
  const [gearSizeQuery, setGearSizeQuery] = useState("");
  const [gearConditionQuery, setGearConditionQuery] = useState("");
  const [gearTargetQuery, setGearTargetQuery] = useState("");
  const [sellerType, setSellerType] = useState<SellerTypeFilter>("");
  const [appliedListingFilters, setAppliedListingFilters] = useState<AppliedListingFilters>({
    query: initialSearchQuery,
    category: "",
    subcategory: "",
    vehicleType: "",
    vehicleSubtype: "",
    selectedBrand: "Kaikki",
    modelQuery: "",
    identifierQuery: "",
    locationQuery: "",
    yearQuery: "",
    yearMinQuery: "",
    yearMaxQuery: "",
    engineCcQuery: "",
    engineModelQuery: "",
    vehicleMileageMinQuery: "",
    vehicleMileageMaxQuery: "",
    vehicleHoursMinQuery: "",
    vehicleHoursMaxQuery: "",
    vehicleRegistrationQuery: "",
    vehicleEngineKindQuery: "",
    vehicleDriveTypeQuery: "",
    vehicleRoadLegalQuery: "",
    vehicleAccessoriesQuery: [],
    vehicleColorsQuery: [],
    trackMatDimensionQuery: "",
    minPrice: 0,
    maxPrice: 100000,
    garageFilterId: "",
    gearTypeQuery: [],
    gearBrandOptionsQuery: [],
    gearSizeOptionsQuery: [],
    gearBrandQuery: "",
    gearSizeQuery: "",
    gearConditionQuery: "",
    gearTargetQuery: "",
    sellerType: ""
  });

  const [sort, setSort] = useState<SortValue>("Osuvimmat ensin");
  const [recommendationsMode, setRecommendationsMode] = useState(!initialSearchQuery);
  const [homeSortOpen, setHomeSortOpen] = useState(false);
  const [homeLatestExpanded, setHomeLatestExpanded] = useState(Boolean(initialSearchQuery));
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const openHomeFilters = useCallback(() => {
    const desktop = window.matchMedia("(min-width: 901px)").matches;
    setActiveHeroFilter(null);

    if (catalogOnlyView) {
      setDesktopFilterTab("basic");
      setDesktopAllFiltersOpen(true);
      return;
    }

    if (desktop) {
      setDesktopFilterTab("basic");
      setDesktopAllFiltersOpen(true);
    } else {
      setDesktopAllFiltersOpen(false);
      setMobileFilterExpanded(true);
      setHomeSearchPanelOpen(true);
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [catalogOnlyView]);

  useEffect(() => {
    window.addEventListener("maskines-open-home-filters", openHomeFilters);

    try {
      if (sessionStorage.getItem("maskinesOpenHomeFilters") === "1") {
        sessionStorage.removeItem("maskinesOpenHomeFilters");
        window.requestAnimationFrame(openHomeFilters);
      }
    } catch {
      /* Session storage may be unavailable in restricted browser contexts. */
    }

    return () => window.removeEventListener("maskines-open-home-filters", openHomeFilters);
  }, [openHomeFilters]);

  useEffect(() => {
    if (!desktopAllFiltersOpen) return;
    const desktopViewport = window.matchMedia("(min-width: 901px)");

    // The full-screen desktop filter fixes the document in place. If the
    // viewport changes to a phone size while it is open, close it immediately
    // so the old desktop scroll lock cannot follow the user into mobile mode.
    if (!desktopViewport.matches && !catalogOnlyView) {
      setDesktopAllFiltersOpen(false);
      return;
    }

    const lockedScrollY = window.scrollY;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight
    };
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDesktopAllFiltersOpen(false);
    };
    const closeOnMobileViewport = (event: MediaQueryListEvent) => {
      if (!event.matches && !catalogOnlyView) setDesktopAllFiltersOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    desktopViewport.addEventListener("change", closeOnMobileViewport);
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.left = previousBodyStyles.left;
      document.body.style.right = previousBodyStyles.right;
      document.body.style.width = previousBodyStyles.width;
      document.body.style.paddingRight = previousBodyStyles.paddingRight;
      window.scrollTo(0, lockedScrollY);
      window.removeEventListener("keydown", closeOnEscape);
      desktopViewport.removeEventListener("change", closeOnMobileViewport);
    };
  }, [catalogOnlyView, desktopAllFiltersOpen]);

  const [user, setUser] = useState<User | null>(null);
  const canUseFavorites = Boolean(user && !user.is_anonymous);
  const [userLocationTerms, setUserLocationTerms] = useState<string[]>([]);

  const [garageVehicles, setGarageVehicles] = useState<GarageVehicle[]>([]);
  const [garageFilter, setGarageFilter] = useState<GarageVehicle | null>(null);
  const [, setGarageDropdownOpen] = useState(false);
  const [sellGuideOpen, setSellGuideOpen] = useState(false);

  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const [categorySearch, setCategorySearch] = useState("");
  const [activeHeroFilter, setActiveHeroFilter] = useState<string | null>(null);
  const [dbPreferenceProfile, setDbPreferenceProfile] = useState<UserPreferenceProfile | null>(null);

  const t = translations[locale];
  const vehicleOptionCopy = {
    fi: {
      accessories: "Lis\u00e4varusteet",
      allAccessories: "Kaikki lis\u00e4varusteet",
      accessoriesDescription: "Valitse kaikki ilmoituksesta l\u00f6ytyv\u00e4t lis\u00e4varusteet.",
      closeAccessories: "Sulje lis\u00e4varusteet",
      color: "V\u00e4ri",
      allColors: "Kaikki v\u00e4rit",
      colorDescription: "Valitse yksi tai useampi ajoneuvon v\u00e4ri.",
      closeColors: "Sulje v\u00e4rivalinta",
      clearSelections: "Tyhjenn\u00e4 valinnat",
      done: "Valmis",
      selected: (count: number) => `${count} valittu`
    },
    en: {
      accessories: "Accessories",
      allAccessories: "All accessories",
      accessoriesDescription: "Select all accessories found in the listing.",
      closeAccessories: "Close accessories",
      color: "Color",
      allColors: "All colors",
      colorDescription: "Choose one or more vehicle colors.",
      closeColors: "Close color selection",
      clearSelections: "Clear selections",
      done: "Done",
      selected: (count: number) => `${count} selected`
    },
    sv: {
      accessories: "Extrautrustning",
      allAccessories: "All extrautrustning",
      accessoriesDescription: "V\u00e4lj all extrautrustning som finns i annonsen.",
      closeAccessories: "St\u00e4ng extrautrustningen",
      color: "F\u00e4rg",
      allColors: "Alla f\u00e4rger",
      colorDescription: "V\u00e4lj en eller flera fordonsf\u00e4rger.",
      closeColors: "St\u00e4ng f\u00e4rgvalet",
      clearSelections: "Rensa valen",
      done: "Klart",
      selected: (count: number) => `${count} valda`
    },
    no: {
      accessories: "Ekstrautstyr",
      allAccessories: "Alt ekstrautstyr",
      accessoriesDescription: "Velg alt ekstrautstyr som finnes i annonsen.",
      closeAccessories: "Lukk ekstrautstyr",
      color: "Farge",
      allColors: "Alle farger",
      colorDescription: "Velg en eller flere kj\u00f8ret\u00f8yfarger.",
      closeColors: "Lukk fargevalget",
      clearSelections: "Fjern valgene",
      done: "Ferdig",
      selected: (count: number) => `${count} valgt`
    }
  }[locale];
  const homeResultsText = {
    fi: {
      editSearch: "Muokkaa suodatusta",
      reset: "Nollaa",
      closeFilters: "Sulje suodatus",
      filter: "Suodata",
      latest: "Viimeisimmät ilmoitukset",
      results: (count: number) => `${count} ${count === 1 ? "hakutulos" : "hakutulosta"}`,
      noResults: "Ei löytynyt tuloksia",
      noResultsHint: "Kokeile muuttaa hakuehtoja tai nollaa suodattimet.",
      resetFilters: "Nollaa suodattimet"
    },
    en: {
      editSearch: "Edit filters",
      reset: "Reset",
      closeFilters: "Close filters",
      filter: "Filter",
      latest: "Latest listings",
      results: (count: number) => `${count} ${count === 1 ? "result" : "results"}`,
      noResults: "No results found",
      noResultsHint: "Try changing the search criteria or resetting the filters.",
      resetFilters: "Reset filters"
    },
    sv: {
      editSearch: "Ändra filter",
      reset: "Återställ",
      closeFilters: "Stäng filter",
      filter: "Filtrera",
      latest: "Senaste annonserna",
      results: (count: number) => `${count} sökresultat`,
      noResults: "Inga resultat hittades",
      noResultsHint: "Prova att ändra sökvillkoren eller återställa filtren.",
      resetFilters: "Återställ filter"
    },
    no: {
      editSearch: "Endre filtre",
      reset: "Tilbakestill",
      closeFilters: "Lukk filtre",
      filter: "Filtrer",
      latest: "Nyeste annonser",
      results: (count: number) => `${count} ${count === 1 ? "søkeresultat" : "søkeresultater"}`,
      noResults: "Ingen resultater funnet",
      noResultsHint: "Prøv å endre søkekriteriene eller tilbakestille filtrene.",
      resetFilters: "Tilbakestill filtre"
    }
  }[locale];

  useEffect(() => {
    if (
      !activeHeroFilter ||
      activeHeroFilter === "mobileLocation" ||
      activeHeroFilter === "locationCountries"
    ) {
      return;
    }

    const closeFilterMenuWhenPressingOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const pressedInsideMenu = target.closest(
        `.${styles.heroFilterMenu}, .${styles.mobileSheetMenu}, .${styles.gearTypeMultiMenu}`
      );
      const pressedFilterTrigger = target.closest(
        `.${styles.heroFilterSelect}, .${styles.mobileSheetSelect}, .${styles.heroYearBox}, .${styles.gearTypeMultiButton}`
      );

      if (pressedInsideMenu || pressedFilterTrigger) return;
      setActiveHeroFilter(null);
    };

    document.addEventListener("pointerdown", closeFilterMenuWhenPressingOutside);
    return () => {
      document.removeEventListener("pointerdown", closeFilterMenuWhenPressingOutside);
    };
  }, [activeHeroFilter]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const syncMobilePagination = () => setMobilePagination(media.matches);

    syncMobilePagination();
    media.addEventListener("change", syncMobilePagination);

    return () => {
      media.removeEventListener("change", syncMobilePagination);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_SEARCHES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedSearchRecord[];
      if (Array.isArray(parsed)) setSavedSearches(parsed.filter((item) => item?.id && item?.filters));
    } catch {
      setSavedSearches([]);
    }
  }, []);

  const saveHomeReturnState = useCallback(() => {
    try {
      sessionStorage.setItem(
        HOME_RETURN_STATE_KEY,
        JSON.stringify({
          query,
          category,
          subcategory,
          vehicleType,
          vehicleSubtype,
          selectedBrand,
          modelQuery,
          identifierQuery,
          locationQuery,
          yearQuery,
          yearMinQuery,
          yearMaxQuery,
          engineCcQuery,
          engineModelQuery,
          vehicleMileageMinQuery,
          vehicleMileageMaxQuery,
          vehicleHoursMinQuery,
          vehicleHoursMaxQuery,
          vehicleRegistrationQuery,
          vehicleEngineKindQuery,
          vehicleDriveTypeQuery,
          vehicleRoadLegalQuery,
          vehicleAccessoriesQuery,
          vehicleColorsQuery,
          trackMatLengthQuery,
          vehicleVatDeductibleQuery,
          vehicleTaxFreeQuery,
          trackMatLengthCustomQuery,
          trackMatWidthQuery,
          trackMatWidthCustomQuery,
          trackMatPitchQuery,
          trackMatPitchCustomQuery,
          trackMatDimensionQuery,
          minPrice,
          maxPrice,
          sort,
          recommendationsMode,
          garageFilterId: garageFilter?.id ?? "",
          gearTypeQuery,
          gearBrandOptionsQuery,
          gearSizeOptionsQuery,
          gearBrandQuery,
          gearSizeQuery,
          gearConditionQuery,
          gearTargetQuery,
          sellerType,
          currentPage,
          scrollY: window.scrollY
        })
      );
      sessionStorage.setItem(HOME_RETURN_PENDING_KEY, "1");
    } catch {
      // Session storage can be unavailable in private/browser-restricted contexts.
    }
  }, [
    category,
    currentPage,
    engineCcQuery,
    engineModelQuery,
    vehicleMileageMinQuery,
    vehicleMileageMaxQuery,
    vehicleHoursMinQuery,
    vehicleHoursMaxQuery,
    vehicleRegistrationQuery,
    vehicleEngineKindQuery,
    vehicleDriveTypeQuery,
    vehicleRoadLegalQuery,
    vehicleAccessoriesQuery,
    vehicleColorsQuery,
    vehicleVatDeductibleQuery,
    vehicleTaxFreeQuery,
    trackMatLengthQuery,
    trackMatLengthCustomQuery,
    trackMatWidthQuery,
    trackMatWidthCustomQuery,
    trackMatPitchQuery,
    trackMatPitchCustomQuery,
    trackMatDimensionQuery,
    garageFilter?.id,
    gearBrandOptionsQuery,
    gearBrandQuery,
    gearConditionQuery,
    gearSizeOptionsQuery,
    gearSizeQuery,
    gearTargetQuery,
    gearTypeQuery,
    identifierQuery,
    locationQuery,
    maxPrice,
    minPrice,
    modelQuery,
    query,
    recommendationsMode,
    selectedBrand,
    sellerType,
    sort,
    subcategory,
    vehicleType,
    vehicleSubtype,
    yearQuery,
    yearMinQuery,
    yearMaxQuery
  ]);

  const openListing = useCallback((listing: Listing) => {
    saveHomeReturnState();
    updateCachedListing(listing);
    router.push(listingPath(listing, locale));
  }, [locale, router, saveHomeReturnState]);

  const handleSortChange = useCallback((value: string) => {
    if (value === "recommendations") {
      setRecommendationsMode(true);
      setSort("Osuvimmat ensin");
    } else if (sortValues.includes(value as SortValue)) {
      setRecommendationsMode(false);
      setSort(value as SortValue);
    }

    setCurrentPage(1);
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(HOME_RETURN_PENDING_KEY) !== "1") return;

      const raw = sessionStorage.getItem(HOME_RETURN_STATE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as {
        query?: string;
        category?: string;
        subcategory?: string;
        vehicleType?: VehicleFilter;
        vehicleSubtype?: string;
        selectedBrand?: string;
        modelQuery?: string;
        identifierQuery?: string;
        locationQuery?: string;
        yearQuery?: string;
        yearMinQuery?: string;
        yearMaxQuery?: string;
        engineCcQuery?: string;
        engineModelQuery?: string;
        vehicleMileageMinQuery?: string;
        vehicleMileageMaxQuery?: string;
        vehicleHoursMinQuery?: string;
        vehicleHoursMaxQuery?: string;
        vehicleRegistrationQuery?: string;
        vehicleEngineKindQuery?: string;
        vehicleDriveTypeQuery?: string;
        vehicleRoadLegalQuery?: string;
        vehicleAccessoriesQuery?: string[];
        vehicleColorsQuery?: string[];
        vehicleVatDeductibleQuery?: boolean;
        vehicleTaxFreeQuery?: boolean;
        trackMatLengthQuery?: string;
        trackMatLengthCustomQuery?: string;
        trackMatWidthQuery?: string;
        trackMatWidthCustomQuery?: string;
        trackMatPitchQuery?: string;
        trackMatPitchCustomQuery?: string;
        trackMatDimensionQuery?: string;
        minPrice?: number;
        maxPrice?: number;
        sort?: SortValue;
        recommendationsMode?: boolean;
        garageFilterId?: string;
        gearTypeQuery?: string | string[];
        gearBrandOptionsQuery?: string[];
        gearSizeOptionsQuery?: string[];
        gearBrandQuery?: string;
        gearSizeQuery?: string;
        gearConditionQuery?: string;
        gearTargetQuery?: string;
        sellerType?: SellerTypeFilter;
        currentPage?: number;
        scrollY?: number;
      };

      if (saved.garageFilterId && garageVehicles.length === 0) return;

      setQuery(saved.query ?? "");
      setCategory(saved.category ?? "");
      setSubcategory(saved.subcategory ?? "");
      setVehicleType(saved.vehicleType ?? "");
      setVehicleSubtype(saved.vehicleSubtype ?? "");
      setSelectedBrand(saved.selectedBrand ?? "Kaikki");
      setModelQuery(saved.modelQuery ?? "");
      setIdentifierQuery(saved.identifierQuery ?? "");
      setLocationQuery(saved.locationQuery ?? "");
      setYearQuery(saved.yearQuery ?? "");
      setYearMinQuery(saved.yearMinQuery ?? "");
      setYearMaxQuery(saved.yearMaxQuery ?? "");
      setEngineCcQuery(saved.engineCcQuery ?? "");
      setEngineModelQuery(saved.engineModelQuery ?? "");
      setVehicleMileageMinQuery(saved.vehicleMileageMinQuery ?? "");
      setVehicleMileageMaxQuery(saved.vehicleMileageMaxQuery ?? "");
      setVehicleHoursMinQuery(saved.vehicleHoursMinQuery ?? "");
      setVehicleHoursMaxQuery(saved.vehicleHoursMaxQuery ?? "");
      setVehicleRegistrationQuery(saved.vehicleRegistrationQuery ?? "");
      setVehicleEngineKindQuery(saved.vehicleEngineKindQuery ?? "");
      setVehicleDriveTypeQuery(saved.vehicleDriveTypeQuery ?? "");
      setVehicleRoadLegalQuery(saved.vehicleRoadLegalQuery ?? "");
      setVehicleAccessoriesQuery(saved.vehicleAccessoriesQuery ?? []);
      setVehicleColorsQuery(saved.vehicleColorsQuery ?? []);
      setVehicleVatDeductibleQuery(saved.vehicleVatDeductibleQuery ?? false);
      setVehicleTaxFreeQuery(saved.vehicleTaxFreeQuery ?? false);
      const savedTrackMatDimension = findTrackMatDimension(saved.trackMatDimensionQuery ?? "");
      setTrackMatLengthQuery(saved.trackMatLengthQuery ?? savedTrackMatDimension?.lengthCm ?? "");
      setTrackMatLengthCustomQuery(saved.trackMatLengthCustomQuery ?? "");
      setTrackMatWidthQuery(saved.trackMatWidthQuery ?? savedTrackMatDimension?.widthCm ?? "");
      setTrackMatWidthCustomQuery(saved.trackMatWidthCustomQuery ?? "");
      setTrackMatPitchQuery(saved.trackMatPitchQuery ?? savedTrackMatDimension?.pitchCm ?? "");
      setTrackMatPitchCustomQuery(saved.trackMatPitchCustomQuery ?? "");
      setTrackMatDimensionQuery(saved.trackMatDimensionQuery ?? "");
      setMinPrice(typeof saved.minPrice === "number" ? saved.minPrice : 0);
      setMaxPrice(typeof saved.maxPrice === "number" ? saved.maxPrice : 100000);
      const savedGearTypes = Array.isArray(saved.gearTypeQuery)
        ? saved.gearTypeQuery
        : saved.gearTypeQuery
          ? [saved.gearTypeQuery]
          : [];
      setGearTypeQuery(savedGearTypes);
      setGearBrandOptionsQuery(saved.gearBrandOptionsQuery ?? []);
      setGearSizeOptionsQuery(saved.gearSizeOptionsQuery ?? []);
      setGearBrandQuery(saved.gearBrandQuery ?? "");
      setGearSizeQuery(saved.gearSizeQuery ?? "");
      setGearConditionQuery(saved.gearConditionQuery ?? "");
      setGearTargetQuery(saved.gearTargetQuery ?? "");
      setSellerType(saved.sellerType ?? "");
      setAppliedListingFilters({
        query: saved.query ?? "",
        category: saved.category ?? "",
        subcategory: saved.subcategory ?? "",
        vehicleType: saved.vehicleType ?? "",
        vehicleSubtype: saved.vehicleSubtype ?? "",
        selectedBrand: saved.selectedBrand ?? "Kaikki",
        modelQuery: saved.modelQuery ?? "",
        identifierQuery: saved.identifierQuery ?? "",
        locationQuery: saved.locationQuery ?? "",
        yearQuery: saved.yearQuery ?? "",
        yearMinQuery: saved.yearMinQuery ?? "",
        yearMaxQuery: saved.yearMaxQuery ?? "",
        engineCcQuery: saved.engineCcQuery ?? "",
        engineModelQuery: saved.engineModelQuery ?? "",
        vehicleMileageMinQuery: saved.vehicleMileageMinQuery ?? "",
        vehicleMileageMaxQuery: saved.vehicleMileageMaxQuery ?? "",
        vehicleHoursMinQuery: saved.vehicleHoursMinQuery ?? "",
        vehicleHoursMaxQuery: saved.vehicleHoursMaxQuery ?? "",
        vehicleRegistrationQuery: saved.vehicleRegistrationQuery ?? "",
        vehicleEngineKindQuery: saved.vehicleEngineKindQuery ?? "",
        vehicleDriveTypeQuery: saved.vehicleDriveTypeQuery ?? "",
        vehicleRoadLegalQuery: saved.vehicleRoadLegalQuery ?? "",
        vehicleAccessoriesQuery: saved.vehicleAccessoriesQuery ?? [],
        vehicleColorsQuery: saved.vehicleColorsQuery ?? [],
        trackMatDimensionQuery: saved.trackMatDimensionQuery ?? "",
        minPrice: typeof saved.minPrice === "number" ? saved.minPrice : 0,
        maxPrice: typeof saved.maxPrice === "number" ? saved.maxPrice : 100000,
        garageFilterId: saved.garageFilterId ?? "",
        gearTypeQuery: savedGearTypes,
        gearBrandOptionsQuery: saved.gearBrandOptionsQuery ?? [],
        gearSizeOptionsQuery: saved.gearSizeOptionsQuery ?? [],
        gearBrandQuery: saved.gearBrandQuery ?? "",
        gearSizeQuery: saved.gearSizeQuery ?? "",
        gearConditionQuery: saved.gearConditionQuery ?? "",
        gearTargetQuery: saved.gearTargetQuery ?? "",
        sellerType: saved.sellerType ?? ""
      });
      setSort(saved.sort ?? "Osuvimmat ensin");
      setRecommendationsMode(saved.recommendationsMode ?? true);
      const savedPage = typeof saved.currentPage === "number" ? saved.currentPage : 1;
      setCurrentPage(savedPage);
      setListingsExpanded(savedPage > 1);
      setGarageFilter(
        saved.garageFilterId
          ? garageVehicles.find((vehicle) => vehicle.id === saved.garageFilterId) ?? null
          : null
      );

      if (typeof saved.scrollY === "number") {
        window.setTimeout(() => window.scrollTo(0, saved.scrollY || 0), 0);
      }

      sessionStorage.removeItem(HOME_RETURN_PENDING_KEY);
    } catch {
      sessionStorage.removeItem(HOME_RETURN_PENDING_KEY);
    }
  }, [garageVehicles]);

  useEffect(() => {
    if (!homeLatestExpanded || catalogOnlyView) return;

    window.requestAnimationFrame(() => {
      if (compactHeroSearch) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      document.querySelector<HTMLElement>("[data-home-results-search]")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, [homeLatestExpanded, catalogOnlyView, compactHeroSearch]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const closeCompactSearch = () => {
      if (!media.matches && window.innerWidth > 900) return;

      setHomeSearchPanelOpen(false);
      setMobileFilterExpanded(false);
      setMobileFilterDragOffset(0);
      setActiveHeroFilter(null);
    };
    const syncCompactSearch = () => {
      const isMobileSearch = media.matches || window.innerWidth <= 900;
      setCompactHeroSearch(isMobileSearch);
      if (isMobileSearch) closeCompactSearch();
    };

    syncCompactSearch();
    media.addEventListener("change", syncCompactSearch);
    window.addEventListener("pageshow", closeCompactSearch);

    return () => {
      media.removeEventListener("change", syncCompactSearch);
      window.removeEventListener("pageshow", closeCompactSearch);
    };
  }, []);

  const sortLabel = useCallback((value: SortValue) => {
    return value === "Osuvimmat ensin"
      ? t.relevance
      : value === "Uusimmat ensin"
      ? t.newest
      : value === "Vanhimmat ensin"
      ? t.oldest
      : value === "Alhaisin hinta"
      ? t.lowestPrice
      : value === "Korkein hinta"
      ? t.highestPrice
      : t.nearest;
  }, [t]);

  function selectMarketplaceMode(nextMode: MarketplaceMode) {
    if (nextMode === marketplaceMode) return;

    setMarketplaceMode(nextMode);
    setHomeSearchPanelOpen(true);
    setDesktopMoreFiltersOpen(false);
    // Keep the mobile sheet at its current height when switching between
    // parts and vehicles. Only the filter content should change.
    setActiveHeroFilter(null);
    setVehicleType("");
    setVehicleSubtype("");
    setSelectedBrand("Kaikki");
    setModelQuery("");
    setEngineCcQuery("");
    setEngineModelQuery("");
    setCategory("");
    setSubcategory("");
    setTrackMatLengthQuery("");
    setTrackMatLengthCustomQuery("");
    setTrackMatWidthQuery("");
    setTrackMatWidthCustomQuery("");
    setTrackMatPitchQuery("");
    setTrackMatPitchCustomQuery("");
    setTrackMatDimensionQuery("");
    setVehicleMileageMinQuery("");
    setVehicleMileageMaxQuery("");
    setVehicleHoursMinQuery("");
    setVehicleHoursMaxQuery("");
    setVehicleRegistrationQuery("");
    setVehicleEngineKindQuery("");
    setVehicleDriveTypeQuery("");
    setVehicleRoadLegalQuery("");
    setVehicleAccessoriesQuery([]);
    setVehicleAccessoriesOpen(false);
    setVehicleColorsQuery([]);
    setVehicleColorsOpen(false);
    setVehicleVatDeductibleQuery(false);
    setVehicleTaxFreeQuery(false);
    setGearTypeQuery([]);
    setGearBrandOptionsQuery([]);
    setGearSizeOptionsQuery([]);
    setGearBrandQuery("");
    setGearSizeQuery("");
    setGearConditionQuery("");
    setGearTargetQuery("");
    setMinPrice(0);
    setMaxPrice(VEHICLE_PRICE_FILTER_MAX);
  }

  function updateMarketplaceFilterUrl(
    filters: AppliedListingFilters,
    mode: MarketplaceResultMode,
    history: "push" | "replace" = "push"
  ) {
    const params = marketplaceFilterSearchParams(searchParams, filters, mode);
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === currentUrl) return;

    if (history === "replace") {
      router.replace(nextUrl, { scroll: false });
    } else {
      router.push(nextUrl, { scroll: false });
    }
  }

  function clearListingFilters() {
    setQuery("");
    setVehicleType("");
    setVehicleSubtype("");
    setGarageFilter(null);
    setSelectedBrand("Kaikki");
    setModelQuery("");
    setIdentifierQuery("");
    setLocationQuery("");
    setYearQuery("");
    setYearMinQuery("");
    setYearMaxQuery("");
    setEngineCcQuery("");
    setEngineModelQuery("");
    setVehicleMileageMinQuery("");
    setVehicleMileageMaxQuery("");
    setVehicleHoursMinQuery("");
    setVehicleHoursMaxQuery("");
    setVehicleRegistrationQuery("");
    setVehicleEngineKindQuery("");
    setVehicleDriveTypeQuery("");
    setVehicleRoadLegalQuery("");
    setVehicleAccessoriesQuery([]);
    setVehicleAccessoriesOpen(false);
    setVehicleColorsQuery([]);
    setVehicleColorsOpen(false);
    setVehicleVatDeductibleQuery(false);
    setVehicleTaxFreeQuery(false);
    setTrackMatLengthQuery("");
    setTrackMatLengthCustomQuery("");
    setTrackMatWidthQuery("");
    setTrackMatWidthCustomQuery("");
    setTrackMatPitchQuery("");
    setTrackMatPitchCustomQuery("");
    setTrackMatDimensionQuery("");
    setCategory("");
    setSubcategory("");
    setOpenCategory(null);
    setCategorySearch("");
    setGearTypeQuery([]);
    setGearBrandOptionsQuery([]);
    setGearSizeOptionsQuery([]);
    setGearBrandQuery("");
    setGearSizeQuery("");
    setGearConditionQuery("");
    setGearTargetQuery("");
    setSellerType("");
    setMinPrice(0);
    setMaxPrice(100000);
    setAppliedListingFilters({
      query: "",
      category: "",
      subcategory: "",
      vehicleType: "",
      vehicleSubtype: "",
      selectedBrand: "Kaikki",
      modelQuery: "",
      identifierQuery: "",
      locationQuery: "",
      yearQuery: "",
      yearMinQuery: "",
      yearMaxQuery: "",
      engineCcQuery: "",
      engineModelQuery: "",
      vehicleMileageMinQuery: "",
      vehicleMileageMaxQuery: "",
      vehicleHoursMinQuery: "",
      vehicleHoursMaxQuery: "",
      vehicleRegistrationQuery: "",
      vehicleEngineKindQuery: "",
      vehicleDriveTypeQuery: "",
      vehicleRoadLegalQuery: "",
      vehicleAccessoriesQuery: [],
      vehicleColorsQuery: [],
      trackMatDimensionQuery: "",
      minPrice: 0,
      maxPrice: 100000,
      garageFilterId: "",
      gearTypeQuery: [],
      gearBrandOptionsQuery: [],
      gearSizeOptionsQuery: [],
      gearBrandQuery: "",
      gearSizeQuery: "",
      gearConditionQuery: "",
      gearTargetQuery: "",
      sellerType: ""
    });
    setAppliedMarketplaceMode("all");
    setActiveHeroFilter(null);
    setGarageDropdownOpen(false);
    setCurrentPage(1);
    setListingsExpanded(false);
    setCatalogOnlyView(false);
    updateMarketplaceFilterUrl(
      listingFiltersFromSearchParams(new URLSearchParams()),
      "all"
    );
  }

  function resetFilteredHomeView() {
    clearListingFilters();
    setHomeLatestExpanded(false);
    setHomeSearchPanelOpen(false);
    setMobileFilterExpanded(false);
    setRecommendationsMode(true);
    setSort("Osuvimmat ensin");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function showAllListings() {
    clearListingFilters();
    setHomeLatestExpanded(true);
    setRecommendationsMode(false);
    setSort("Uusimmat ensin");
    setListingsExpanded(true);
    setCatalogOnlyView(false);
    setCurrentPage(1);
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    const openAllListings = () => showAllListings();
    window.addEventListener("maskines-show-all-listings", openAllListings);

    const params = new URLSearchParams(window.location.search);
    if (params.get("catalog") === "all") {
      openAllListings();
    }

    const garageSearch = params.get("garageSearch")?.trim();
    if (garageSearch) {
      setQuery(garageSearch);
      setRecommendationsMode(false);
      setListingsExpanded(true);
      setHomeLatestExpanded(true);
      setCatalogOnlyView(false);
      setCurrentPage(1);
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    return () => window.removeEventListener("maskines-show-all-listings", openAllListings);
  }, []);

  useEffect(() => {
    const runHeaderSearch = (event: Event) => {
      const nextQuery = String((event as CustomEvent<string>).detail ?? "").trim();
      setQuery(nextQuery);
      setAppliedListingFilters((current) => ({ ...current, query: nextQuery }));
      setAppliedMarketplaceMode("all");
      setRecommendationsMode(false);
      setListingsExpanded(true);
      setHomeLatestExpanded(true);
      setCatalogOnlyView(Boolean(nextQuery));
      setCurrentPage(1);
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    window.addEventListener("maskines-home-search", runHeaderSearch);
    return () => window.removeEventListener("maskines-home-search", runHeaderSearch);
  }, []);

  function applyListingFilters() {
    if (trackMatDimensionFieldVisible && !trackMatDimensionQuery) {
      const nextRequiredField = !effectiveTrackMatLengthQuery
        ? "trackMatLength"
        : !effectiveTrackMatWidthQuery
          ? "trackMatWidth"
          : "trackMatPitch";
      setActiveHeroFilter(nextRequiredField);
      setMobileFilterExpanded(true);
      return false;
    }

    const nextFilters: AppliedListingFilters = {
      query,
      category,
      subcategory,
      vehicleType,
      vehicleSubtype,
      selectedBrand,
      modelQuery,
      identifierQuery,
      locationQuery,
      yearQuery,
      yearMinQuery,
      yearMaxQuery,
      engineCcQuery,
      engineModelQuery: marketplaceMode === "vehicles" ? "" : engineModelQuery,
      vehicleMileageMinQuery,
      vehicleMileageMaxQuery,
      vehicleHoursMinQuery,
      vehicleHoursMaxQuery,
      vehicleRegistrationQuery,
      vehicleEngineKindQuery,
      vehicleDriveTypeQuery,
      vehicleRoadLegalQuery,
      vehicleAccessoriesQuery,
      vehicleColorsQuery,
      vehicleVatDeductibleQuery,
      vehicleTaxFreeQuery,
      trackMatDimensionQuery,
      minPrice,
      maxPrice,
      garageFilterId: garageFilter?.id ?? "",
      gearTypeQuery,
      gearBrandOptionsQuery,
      gearSizeOptionsQuery,
      gearBrandQuery,
      gearSizeQuery,
      gearConditionQuery,
      gearTargetQuery,
      sellerType
    };
    setAppliedListingFilters(nextFilters);
    setAppliedMarketplaceMode(marketplaceMode);
    updateMarketplaceFilterUrl(nextFilters, marketplaceMode);
    setRecommendationsMode(false);
    setListingsExpanded(true);
    setHomeLatestExpanded(true);
    setCatalogOnlyView(true);
    setHomeSearchPanelOpen(false);
    setMobileFilterExpanded(false);
    setDesktopAllFiltersOpen(false);
    setActiveHeroFilter(null);
    setCurrentPage(1);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
    return true;
  }

  const activeFilterSignature = useMemo(() => (
    JSON.stringify({
      ...appliedListingFilters,
      appliedMarketplaceMode,
      sort,
      recommendationsMode
    })
  ), [
    appliedListingFilters,
    appliedMarketplaceMode,
    sort,
    recommendationsMode
  ]);

  useEffect(() => {
    setCurrentPage(1);
    setMobileLatestVisibleCount(MOBILE_LISTINGS_INCREMENT);
    setDesktopLatestVisibleCount(DESKTOP_INITIAL_LISTINGS_COUNT);
  }, [activeFilterSignature]);

  const translateCategoryLabel = useCallback((value: string) => {
    const source = value.trim();
    const translated = translateCategory(locale, source).trim();
    return translated || source;
  }, [locale]);

  const categoryFilterCopy = {
    fi: {
      mainCategory: "Pääkategoria",
      selectMainCategory: "Valitse pääkategoria",
      allCategories: "Kaikki kategoriat",
      subcategory: "Alakategoria",
      selectSubcategory: "Valitse alakategoria",
      allSubcategories: "Kaikki alakategoriat",
      detailedPart: "Tarkempi osa",
      selectDetailedPart: "Valitse tarkempi osa",
      allDetailedParts: "Kaikki tarkemmat osat"
    },
    en: {
      mainCategory: "Main category",
      selectMainCategory: "Select main category",
      allCategories: "All categories",
      subcategory: "Subcategory",
      selectSubcategory: "Select subcategory",
      allSubcategories: "All subcategories",
      detailedPart: "Detailed part",
      selectDetailedPart: "Select detailed part",
      allDetailedParts: "All detailed parts"
    },
    sv: {
      mainCategory: "Huvudkategori",
      selectMainCategory: "Välj huvudkategori",
      allCategories: "Alla kategorier",
      subcategory: "Underkategori",
      selectSubcategory: "Välj underkategori",
      allSubcategories: "Alla underkategorier",
      detailedPart: "Detaljerad del",
      selectDetailedPart: "Välj detaljerad del",
      allDetailedParts: "Alla detaljerade delar"
    },
    no: {
      mainCategory: "Hovedkategori",
      selectMainCategory: "Velg hovedkategori",
      allCategories: "Alle kategorier",
      subcategory: "Underkategori",
      selectSubcategory: "Velg underkategori",
      allSubcategories: "Alle underkategorier",
      detailedPart: "Detaljert del",
      selectDetailedPart: "Velg detaljert del",
      allDetailedParts: "Alle detaljerte deler"
    },
  }[locale];
  const allVehicleSubtypesLabel = {
    fi: "Kaikki tyypit",
    en: "All types",
    sv: "Alla typer",
    no: "Alle typer"
  }[locale];
  const heroFilterCopy = {
    fi: {
      vehicleType: "Ajoneuvolaji",
      allVehicles: "Kaikki ajoneuvot",
      type: "Tyyppi",
      brand: "Merkki",
      allBrands: "Kaikki merkit",
      model: "Malli",
      allModels: "Kaikki mallit",
      engineCapacity: "Moottoritilavuus (cm³)",
      allEngineSizes: "Kaikki koot",
      engine: "Moottori",
      allEngines: "Kaikki moottorit"
    },
    en: {
      vehicleType: "Vehicle type",
      allVehicles: "All vehicles",
      type: "Type",
      brand: "Brand",
      allBrands: "All brands",
      model: "Model",
      allModels: "All models",
      engineCapacity: "Engine displacement (cm³)",
      allEngineSizes: "All sizes",
      engine: "Engine",
      allEngines: "All engines"
    },
    sv: {
      vehicleType: "Fordonstyp",
      allVehicles: "Alla fordon",
      type: "Typ",
      brand: "Märke",
      allBrands: "Alla märken",
      model: "Modell",
      allModels: "Alla modeller",
      engineCapacity: "Motorvolym (cm³)",
      allEngineSizes: "Alla storlekar",
      engine: "Motor",
      allEngines: "Alla motorer"
    },
    no: {
      vehicleType: "Kjøretøytype",
      allVehicles: "Alle kjøretøy",
      type: "Type",
      brand: "Merke",
      allBrands: "Alle merker",
      model: "Modell",
      allModels: "Alle modeller",
      engineCapacity: "Motorvolum (cm³)",
      allEngineSizes: "Alle størrelser",
      engine: "Motor",
      allEngines: "Alle motorer"
    }
  }[locale];
  const homeFilterUiCopy = {
    fi: {
      year: "Vuosimalli",
      yearMin: "Vuosimallin minimi",
      yearMax: "Vuosimallin maksimi",
      yearRange: "Vuosimallin rajaus",
      partCategories: "Osakategoriointi",
      showResults: "Näytä tulokset",
      clearFilters: "Tyhjennä hakuehdot",
      sellTitle: "Lisää varaosat tai ajoneuvo myyntiin helposti",
      sellText: "Valitse ilmoitustyyppi ja lisää kuvat sekä tiedot — tavoita ostajat ympäri Suomen.",
      sellAction: "Aloita myynti",
      benefits: "Palvelun edut"
    },
    en: {
      year: "Model year",
      yearMin: "Minimum model year",
      yearMax: "Maximum model year",
      yearRange: "Model year range",
      partCategories: "Part categories",
      showResults: "Show results",
      clearFilters: "Clear filters",
      sellTitle: "List spare parts or a vehicle with ease",
      sellText: "Choose the listing type and add photos and details to reach buyers across Finland.",
      sellAction: "Start selling",
      benefits: "Service benefits"
    },
    sv: {
      year: "Årsmodell",
      yearMin: "Minsta årsmodell",
      yearMax: "Högsta årsmodell",
      yearRange: "Årsmodellintervall",
      partCategories: "Delkategorier",
      showResults: "Visa resultat",
      clearFilters: "Rensa filter",
      sellTitle: "Lägg enkelt ut reservdelar eller ett fordon till försäljning",
      sellText: "Välj annonstyp och lägg till bilder och uppgifter för att nå köpare i hela Finland.",
      sellAction: "Börja sälja",
      benefits: "Tjänstens fördelar"
    },
    no: {
      year: "Årsmodell",
      yearMin: "Laveste årsmodell",
      yearMax: "Høyeste årsmodell",
      yearRange: "Årsmodellintervall",
      partCategories: "Delkategorier",
      showResults: "Vis resultater",
      clearFilters: "Tøm filtre",
      sellTitle: "Legg enkelt ut reservedeler eller et kjøretøy for salg",
      sellText: "Velg annonsetype og legg til bilder og opplysninger for å nå kjøpere i hele Finland.",
      sellAction: "Start salget",
      benefits: "Fordeler med tjenesten"
    }
  }[locale];

  const translateVehicleTypeLabel = useCallback((value?: string | null) => {
    const vehicleTranslations: Record<Locale, Record<string, string>> = {
      fi: {
        Moottoripyörä: "Moottoripyörä",
        Moottorikelkka: "Moottorikelkka",
        Mönkijä: "Mönkijä",
        Motocross: "Motocross",
        Mopot: "Mopot",
        Mopo: "Mopo"
      },
      en: {
        Moottoripyörä: "Motorcycle",
        Moottorikelkka: "Snowmobile",
        Mönkijä: "ATV",
        Motocross: "Motocross",
        Mopot: "Mopeds",
        Mopo: "Moped"
      },
      sv: {
        Moottoripyörä: "Motorcykel",
        Moottorikelkka: "Snöskoter",
        Mönkijä: "ATV",
        Motocross: "Motocross",
        Mopot: "Mopeder",
        Mopo: "Moped"
      },
      no: {
        Moottoripyörä: "Motorsykkel",
        Moottorikelkka: "Snøscooter",
        Mönkijä: "ATV",
        Motocross: "Motocross",
        Mopot: "Mopeder",
        Mopo: "Moped"
      },
    };

    if (!value) return "";
    return vehicleTranslations[locale][value] ?? taxonomyVehicleLabels[value] ?? value;
  }, [locale, taxonomyVehicleLabels]);

  const getListingText = useCallback((listing: Listing) => {
    const listingText = getLocalizedListingText(listing, locale);

    if (locale === "fi") {
      return listingText;
    }

    const leafSubcategory =
      listing.subcategory?.split("/").map((part) => part.trim()).filter(Boolean).at(-1);

    const isGeneratedTitle =
      leafSubcategory &&
      listing.vehicle_type &&
      listing.title.trim().toLowerCase() ===
        `${leafSubcategory} - ${listing.vehicle_type}`.trim().toLowerCase();

    if (!isGeneratedTitle) {
      return listingText;
    }

    const translatedSubcategory = translateCategoryLabel(listing.subcategory ?? "");
    const translatedLeaf =
      translatedSubcategory.split("/").map((part) => part.trim()).filter(Boolean).at(-1) ||
      translateCategoryLabel(leafSubcategory);
    const translatedVehicle = translateVehicleTypeLabel(listing.vehicle_type);

    return {
      ...listingText,
      title: `${translatedLeaf} - ${translatedVehicle}`.trim()
    };
  }, [locale, translateCategoryLabel, translateVehicleTypeLabel]);

  const searchSuggestions = useMemo(() => {
    const needle = query.trim();
    const normalizedNeedle = normalizeSearchText(needle);
    if (normalizedNeedle.length < 2) {
      return { listings: [] as Listing[], categories: [] as string[], sellers: [] as string[] };
    }

    const scored = listings
      .filter(isPublicListing)
      .map((listing) => {
        const text = getListingText(listing);
        const partNumber = getListingPartNumber(listing);
        const listingNumber = String(listing.listing_number ?? "");
        const urlId = listingNumberUrlId(listing.listing_number);
        const seller = listing.company_name?.trim() || listing.seller_name?.trim() || "";
        const searchableText = [
          listing.id,
          listingNumber,
          urlId,
          `ID ${listingNumber}`,
          text.title,
          text.description,
          listing.description,
          listing.vehicle_type,
          listing.vehicle_subtype,
          listing.brand,
          listing.model,
          listing.year,
          listing.engine_cc,
          listing.engine_model,
          listing.category,
          listing.subcategory,
          listing.part_model,
          partNumber,
          listing.condition,
          listing.location,
          seller
        ].filter(Boolean).join(" ");

        if (!textMatchesSearch(searchableText, needle) && !allSearchWordsMatch(searchableText, needle)) {
          return null;
        }

        const normalizedTitle = normalizeSearchText(text.title);
        const normalizedSeller = normalizeSearchText(seller);
        const normalizedPartNumber = normalizeSearchText(partNumber);
        const normalizedIdentifier = normalizeSearchText(`${listingNumber} ${urlId} ${listing.id}`);
        let score = 0;
        if (normalizedTitle === normalizedNeedle) score += 120;
        else if (normalizedTitle.startsWith(normalizedNeedle)) score += 90;
        else if (normalizedTitle.includes(normalizedNeedle)) score += 70;
        if (normalizedSeller === normalizedNeedle) score += 110;
        else if (normalizedSeller.startsWith(normalizedNeedle)) score += 80;
        else if (normalizedSeller.includes(normalizedNeedle)) score += 60;
        if (normalizedPartNumber.includes(normalizedNeedle)) score += 100;
        if (normalizedIdentifier.includes(normalizedNeedle)) score += 100;
        if (normalizeSearchText(`${listing.brand ?? ""} ${listing.model ?? ""}`).includes(normalizedNeedle)) score += 55;
        if (normalizeSearchText(`${listing.category ?? ""} ${listing.subcategory ?? ""}`).includes(normalizedNeedle)) score += 35;

        return { listing, score };
      })
      .filter((item): item is { listing: Listing; score: number } => Boolean(item))
      .sort((a, b) => b.score - a.score || new Date(b.listing.created_at).getTime() - new Date(a.listing.created_at).getTime());

    const matchingListings = scored.map((item) => item.listing);
    const categories = Array.from(new Set(
      matchingListings.flatMap((listing) => [listing.category, listing.subcategory]).filter((value): value is string => Boolean(value?.trim()))
    )).slice(0, 6);
    const sellers = Array.from(new Set(
      matchingListings.map((listing) => listing.company_name?.trim() || listing.seller_name?.trim() || "").filter(Boolean)
    )).slice(0, 6);

    return { listings: matchingListings.slice(0, 8), categories, sellers };
  }, [getListingText, listings, query]);

  const showSearchSuggestions = searchSuggestionsOpen && query.trim().length >= 2;

  const applySuggestedSearch = useCallback((value: string) => {
    setQuery(value);
    setAppliedListingFilters((current) => ({ ...current, query: value }));
    setCurrentPage(1);
    setListingsExpanded(true);
    setCatalogOnlyView(true);
    setSearchSuggestionsOpen(false);
  }, []);

  function formatDate(date: string) {
    const locales: Record<Locale, string> = {
      fi: "fi-FI",
      en: "en-US",
      sv: "sv-SE",
      no: "nb-NO",
    };

    return new Date(date).toLocaleDateString(locales[locale]);
  }

  /* ======================================================
     LOAD GARAGE VEHICLES
  ====================================================== */

  useEffect(() => {
    setRecoUserId(user?.id ?? null);
    if (!user) {
      setGarageVehicles([]);
      setDbPreferenceProfile(null);
      setUserLocationTerms([]);
      return;
    }
    getUserPreferenceProfile(user.id)
      .then(({ data }) => setDbPreferenceProfile(data))
      .catch(() => setDbPreferenceProfile(null));
    getProfile(user.id)
      .then(({ data }) => {
        setUserLocationTerms(data ? buildLocationTerms(data) : []);
      })
      .catch(() => {});
    withTimeout(getGarageVehicles(user.id), 6000)
      .then(({ data }) => setGarageVehicles(data ?? []))
      .catch(() => setGarageVehicles([]));

  }, [user]);

  /* ======================================================
     LOAD LISTINGS
  ====================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadListings() {
      const cachedListings = readCachedListings();
      const localListings =
        (
          cachedListings.length > 0
            ? cachedListings
            : initialListings.length > 0
              ? initialListings
              : fallbackListings
        )
          .filter(isPublicListing);

      if (localListings.length > 0 && mounted) {
        setListings(localListings);
        setListingsLoading(false);
      } else if (mounted) {
        setListingsLoading(true);
      }

      let keepLoadingForRetry = false;

      try {
        const { data, error, count } =
          await withTimeout(
            getListings({
              includeOptionalFields: true,
              enrichSellerProfiles: true,
              includeCount: true,
              limit: INITIAL_LISTING_FETCH_LIMIT,
              offset: 0
            }),
            4500,
            "Ilmoitusten lataus kesti liian kauan."
          );

        if (error) {
          console.warn("Ilmoitusten lataus epäonnistui, käytetään paikallista listaa.", error);
          return;
        }

        if (mounted && data) {
          const publicData = data.filter(isPublicListing);
          setListings(publicData);
          if (typeof count === "number") setListingsTotalCount(count);
          writeCachedListings(publicData);
        }
      } catch (error) {
        console.warn("Nopea ilmoitusten lataus epäonnistui, yritetään pidemmällä aikakatkaisulla.", error);
        if (mounted) {
          keepLoadingForRetry = true;
          try {
            const { data, error: retryError, count } =
              await withTimeout(
                getListings({
                  includeOptionalFields: true,
                  enrichSellerProfiles: true,
                  includeCount: true,
                  limit: INITIAL_LISTING_FETCH_LIMIT,
                  offset: 0
                }),
                30000,
                "Ilmoitusten varalataus kesti liian kauan."
              );

            if (retryError) {
              console.warn("Ilmoitusten varalataus epäonnistui.", retryError);
            }

            if (mounted && data) {
              const publicData = data.filter(isPublicListing);
              setListings(publicData);
              if (typeof count === "number") setListingsTotalCount(count);
              writeCachedListings(publicData);
            }
          } catch (retryError) {
            console.warn("Ilmoitusten varalataus aikakatkaistiin.", retryError);
          } finally {
            keepLoadingForRetry = false;
          }
        }
      } finally {
        if (mounted && !keepLoadingForRetry) {
          setListingsLoading(false);
        }
      }
    }

    loadListings();

    return () => {
      mounted = false;
    };
  }, [initialListings, router]);

  useEffect(() => {
    const urlLocale = new URLSearchParams(window.location.search).get("lang");
    purgeInvalidLocaleStorage();

    const storedLocale = normalizeLocale(localStorage.getItem("locale"), "fi");
    const initialLocale = normalizeLocale(urlLocale, storedLocale);

    setActiveLocale(initialLocale);
    applyLocale(initialLocale);

    setLocaleReady(true);
  }, []);

  /*
   * The initial home feed is intentionally capped for a fast first paint.
   * A search must not use that cap, though: part-number listings are often
   * older than the newest feed page. Load the complete public catalogue once
   * the user submits a search and merge it into the already rendered cards.
   */
  useEffect(() => {
    const searchTerm = query.trim() || appliedListingFilters.query.trim();
    if (searchTerm.length < 2 || fullSearchCatalogRequestedRef.current) return;

    fullSearchCatalogRequestedRef.current = true;

    void getListings({ includeOptionalFields: true, enrichSellerProfiles: true })
      .then(({ data, error }) => {
        if (error) {
          fullSearchCatalogRequestedRef.current = false;
          console.warn("Koko ilmoitushaun lataus epäonnistui.", error);
          return;
        }

        const publicData = (data ?? []).filter(isPublicListing);
        setListings((current) => {
          const listingsById = new Map(current.map((listing) => [listing.id, listing]));
          for (const listing of publicData) listingsById.set(listing.id, listing);
          return Array.from(listingsById.values());
        });
      })
      .catch((error) => {
        fullSearchCatalogRequestedRef.current = false;
        console.warn("Koko ilmoitushaun lataus epäonnistui.", error);
      });
  }, [appliedListingFilters.query, query]);

  useEffect(() => {
    if (!localeReady) return;
    applyLocale(activeLocale);
  }, [activeLocale, localeReady]);

  // Listen for locale changes triggered elsewhere (e.g. BottomNav on mobile)
  // so this page's translations update without a reload.
  useEffect(() => {
    function handleLocaleChange(event: Event) {
      const next = (event as CustomEvent<SupportedLocale>).detail;
      if (isLocale(next)) {
        setActiveLocale(next);
      }
    }
    window.addEventListener("localechange", handleLocaleChange);
    return () => window.removeEventListener("localechange", handleLocaleChange);
  }, []);

  /* ======================================================
     AUTH
  ====================================================== */

  useEffect(() => {
    if (!supabase) return;

    const auth = supabase.auth;

    async function loadUser() {
      try {
        const {
          data: { user }
        } = await withTimeout(
          auth.getUser(),
          6000,
          "Kirjautumisen tarkistus kesti liian kauan."
        );

        setUser(user);

      } catch {
        setUser(null);
      }
    }

    loadUser();

    const {
      data: { subscription }
    } = auth.onAuthStateChange(() => {
      void loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  /* ======================================================
     FILTERED LISTINGS
  ====================================================== */

  const buildFilteredListings = useCallback((
    filters: AppliedListingFilters,
    listingMode: MarketplaceResultMode
  ) => {
    const {
      query: appliedQuery,
      vehicleType: appliedVehicleType,
      vehicleSubtype: appliedVehicleSubtype,
      category: appliedCategory,
      subcategory: appliedSubcategory,
      identifierQuery: appliedIdentifierQuery,
      locationQuery: appliedLocationQuery,
      selectedBrand: appliedSelectedBrand,
      modelQuery: appliedModelQuery,
      yearQuery: appliedYearQuery,
      yearMinQuery: appliedYearMinQuery,
      yearMaxQuery: appliedYearMaxQuery,
      engineCcQuery: appliedEngineCcQuery,
      engineModelQuery: appliedEngineModelQuery,
      vehicleMileageMinQuery: appliedVehicleMileageMinQuery,
      vehicleMileageMaxQuery: appliedVehicleMileageMaxQuery,
      vehicleHoursMinQuery: appliedVehicleHoursMinQuery,
      vehicleHoursMaxQuery: appliedVehicleHoursMaxQuery,
      vehicleRegistrationQuery: appliedVehicleRegistrationQuery,
      vehicleEngineKindQuery: appliedVehicleEngineKindQuery,
      vehicleDriveTypeQuery: appliedVehicleDriveTypeQuery,
      vehicleRoadLegalQuery: appliedVehicleRoadLegalQuery,
      vehicleAccessoriesQuery: appliedVehicleAccessoriesQuery,
      vehicleColorsQuery: appliedVehicleColorsQuery,
      vehicleVatDeductibleQuery: appliedVehicleVatDeductibleQuery = false,
      vehicleTaxFreeQuery: appliedVehicleTaxFreeQuery = false,
      trackMatDimensionQuery: appliedTrackMatDimensionQuery,
      minPrice: appliedMinPrice,
      maxPrice: appliedMaxPrice,
      garageFilterId: appliedGarageFilterId,
      gearTypeQuery: appliedGearTypeQuery,
      gearBrandOptionsQuery: appliedGearBrandOptionsQuery,
      gearSizeOptionsQuery: appliedGearSizeOptionsQuery,
      gearBrandQuery: appliedGearBrandQuery,
      gearSizeQuery: appliedGearSizeQuery,
      gearConditionQuery: appliedGearConditionQuery,
      gearTargetQuery: appliedGearTargetQuery,
      sellerType: appliedSellerType
    } = filters;
    const appliedGarageFilter =
      garageFilter && appliedGarageFilterId && garageFilter.id === appliedGarageFilterId
        ? garageFilter
        : null;
    const selectedFitmentProfile = buildFitmentProfile({
      vehicleType: appliedVehicleType,
      brand: appliedSelectedBrand === "Kaikki" ? "" : appliedSelectedBrand,
      model: [appliedModelQuery, appliedQuery].filter(Boolean).join(" "),
      year: "",
      engine: [appliedEngineModelQuery, appliedEngineCcQuery, appliedQuery].filter(Boolean).join(" ")
    });
    const compatibleQuery = queryWithoutVehicleIdentityTerms(appliedQuery, [
      appliedSelectedBrand === "Kaikki" ? "" : appliedSelectedBrand,
      appliedModelQuery,
      appliedEngineModelQuery,
      appliedEngineCcQuery
    ]);
    const hasVehicleIdentityFilter =
      (appliedSelectedBrand !== "Kaikki" && Boolean(appliedSelectedBrand)) ||
      Boolean(appliedModelQuery.trim()) ||
      Boolean(appliedEngineModelQuery.trim()) ||
      Boolean(appliedEngineCcQuery.trim()) ||
      Boolean(appliedQuery.trim());
    const compatibleFitmentActive =
      hasFitmentProfile(selectedFitmentProfile) && hasVehicleIdentityFilter;
    const normalizedAppliedModel = normalizeSearchText(appliedModelQuery);
    const availableAppliedModels = buildMarketplaceModelOptions({
      vehicle: appliedVehicleType,
      brand: appliedSelectedBrand === "Kaikki" ? "" : appliedSelectedBrand
    });
    const exactQueryModel = !normalizedAppliedModel
      ? availableAppliedModels.find((candidate) =>
          normalizeSearchText(candidate) === normalizeSearchText(appliedQuery)
        ) ?? ""
      : "";
    const exactModelFilter = appliedModelQuery || exactQueryModel;
    const normalizedExactModelFilter = normalizeSearchText(exactModelFilter);
    const moreSpecificAppliedModelVariants = normalizedExactModelFilter
      ? availableAppliedModels.filter((candidate) =>
          isMoreSpecificModelVariant(candidate, exactModelFilter)
        )
      : [];
    const subcategoryGroupSearchScope = getSubcategoryGroupSearchScope(appliedQuery);

    return listings
      .filter(isPublicListing)
      .filter((listing) =>
        listingMode === "all"
          ? true
          : listingMode === "vehicles"
            ? isVehicleListing(listing)
            : listingMode === "gear"
              ? !isVehicleListing(listing) && isRidingGearListing(listing)
              : !isVehicleListing(listing) && !isRidingGearListing(listing)
      )
      .filter((listing) => {
        if (!appliedSellerType) return true;

        const isCompany =
          listing.seller_account_type === "company" ||
          Boolean(listing.company_name?.trim());
        const isVerifiedCompany =
          isCompany && Boolean(listing.seller_company_verified_at);

        if (appliedSellerType === "verified-company") return isVerifiedCompany;
        if (appliedSellerType === "company") return isCompany;
        return !isCompany;
      })
      .filter((listing) => {
        const listingText = getListingText(listing);
        const listingPartNumber = getListingPartNumber(listing);
        const listingVehicleSubtypeText = getListingVehicleSubtypeText(listing, listingText);
        const search = `
          ${listing.id ?? ""}
          ${listing.listing_number ?? ""}
          ID ${listing.listing_number ?? ""}
          ${listingText.title}
          ${listingText.description}
          ${listing.description ?? ""}
          ${listing.category ?? ""}
          ${listing.subcategory ?? ""}
          ${listing.brand ?? ""}
          ${listing.model ?? ""}
          ${listing.part_model ?? ""}
          ${listing.engine_cc ?? ""}
          ${listing.engine_model ?? ""}
          ${listingPartNumber}
          ${listing.location}
          ${listing.company_name ?? ""}
          ${listing.seller_name ?? ""}
        `;
        // Keep multi-word free-text searches tied to the listing itself. Without
        // this narrower text, separate words could be satisfied by unrelated
        // taxonomy fields (for example "kokonainen" in the title and
        // "moottori" only in the category of a complete clutch listing).
        const listingContentSearch = `
          ${listingText.title}
          ${listingText.description}
          ${listing.description ?? ""}
          ${listing.brand ?? ""}
          ${listing.model ?? ""}
          ${listing.part_model ?? ""}
          ${listing.engine_cc ?? ""}
          ${listing.engine_model ?? ""}
          ${listingPartNumber}
          ${listing.company_name ?? ""}
          ${listing.seller_name ?? ""}
        `;

        const directPartNumberMatch =
          Boolean(appliedQuery) &&
          Boolean(listingPartNumber) &&
          textMatchesSearch(listingPartNumber, appliedQuery);

        const queryIdentifierTerm = appliedQuery.trim().toLowerCase().replace(/\s+/g, "");
        const queryIdentifierNumber =
          queryIdentifierTerm.match(/^(?:ilmoitus|id|#)?(\d+)$/)?.[1] ??
          queryIdentifierTerm.match(/^(\d+)(?:id|ilmoitus)$/)?.[1] ??
          "";
        const queryIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          queryIdentifierTerm
        );
        const queryIsIdentifierSearch = Boolean(queryIdentifierNumber || queryIsUuid);
        const normalizedQueryIdentifierNumber = queryIdentifierNumber
          ? String(Number(queryIdentifierNumber))
          : "";
        const directIdentifierMatch =
          queryIsIdentifierSearch && (
            String(listing.id ?? "").toLowerCase() === queryIdentifierTerm ||
            String(listing.listing_number ?? "") === queryIdentifierNumber ||
            String(listing.listing_number ?? "") === normalizedQueryIdentifierNumber ||
            listingNumberUrlId(listing.listing_number).toLowerCase() === queryIdentifierTerm
          );

        const matchesGarage = (() => {
          if (!appliedGarageFilter) return true;
          const haystack = [
            listing.brand ?? "",
            listing.model ?? "",
            listing.part_model ?? "",
            listingPartNumber,
            listingText.title,
            listingText.description
          ].join(" ");
          const matchesMake =
            !appliedGarageFilter.make || textMatchesSearch(haystack, appliedGarageFilter.make);
          const matchesModel =
            !appliedGarageFilter.model || allSearchWordsMatch(haystack, appliedGarageFilter.model);
          return matchesMake && matchesModel;
        })();

        const matchesVehicleType =
          listingMatchesVehicleType(listing, listingText, appliedVehicleType);
        const matchesVehicleSubtype =
          !appliedVehicleSubtype ||
          allSearchWordsMatch(listingVehicleSubtypeText, appliedVehicleSubtype);

        const matchesCategory =
          !appliedCategory ||
          (!appliedVehicleType
            ? getUnifiedAllCategoryName(listing.category ?? "", listing.subcategory ?? "") ===
              getUnifiedAllCategoryName(appliedCategory, appliedSubcategory)
            : normalizeCategoryMatch(listing.category, listing.subcategory ?? "") ===
              normalizeCategoryMatch(appliedCategory, appliedSubcategory));

        const matchesSubcategory =
          listingMatchesSubcategoryFilter(
            listing.subcategory,
            appliedSubcategory,
            subcategoryGroups[appliedCategory]?.[appliedSubcategory] ?? []
          );

        const matchesBrand =
          brandMatchesListing(appliedSelectedBrand, listing, listingText);

        const listingModelVariantText = [
          listing.model ?? "",
          listing.part_model ?? "",
          listingText.title,
          listingText.description
        ].join(" ");
        const containsMoreSpecificModelVariant = moreSpecificAppliedModelVariants.some((variant) =>
          textMatchesSearch(listingModelVariantText, variant)
        );
        const matchesExactModel =
          !normalizedExactModelFilter ||
          (
            normalizeSearchText(listing.model) === normalizedExactModelFilter &&
            !containsMoreSpecificModelVariant
          );
        const matchesModel = !normalizedAppliedModel || matchesExactModel;

        const listingYear = Number(String(listing.year ?? "").match(/(19|20)\d{2}/)?.[0] ?? "");
        const yearMin = Number(appliedYearMinQuery || appliedYearQuery || "");
        const yearMax = Number(appliedYearMaxQuery || appliedYearQuery || "");
        const hasYearFilter = Boolean(appliedYearQuery || appliedYearMinQuery || appliedYearMaxQuery);
        const matchesYear =
          !hasYearFilter ||
          (Number.isFinite(listingYear) &&
            listingYear > 0 &&
            (!yearMin || listingYear >= yearMin) &&
            (!yearMax || listingYear <= yearMax));

        const identifierTerm = appliedIdentifierQuery.trim().toLowerCase().replace(/\s+/g, "");
        const identifierNumber = identifierTerm.match(/^(?:ilmoitus|id|#)?(\d+)$/)?.[1] ?? "";
        const normalizedIdentifierNumber = identifierNumber ? String(Number(identifierNumber)) : "";
        const listingNumberText = String(listing.listing_number ?? "");
        const listingNumberUrlText = listingNumberUrlId(listing.listing_number).toLowerCase();
        const listingIdText = String(listing.id ?? "").toLowerCase();
        const matchesIdentifier =
          !identifierTerm ||
          listingIdText === identifierTerm ||
          listingNumberText === identifierNumber ||
          listingNumberText === normalizedIdentifierNumber ||
          listingNumberUrlText === identifierTerm;

        const matchesLocation = listingMatchesLocationFilter(
          listing.location,
          appliedLocationQuery
        );

        const matchesEngineCc =
          !appliedEngineCcQuery ||
          textMatchesSearch(listing.engine_cc ?? "", appliedEngineCcQuery);

        const matchesEngineModel =
          listingMode === "vehicles" ||
          !appliedEngineModelQuery ||
          textMatchesSearch(listing.engine_model ?? "", appliedEngineModelQuery);

        const listingMileage = vehicleDescriptionNumber(listing.description, "Ajokilometrit");
        const listingHours = vehicleDescriptionNumber(listing.description, "Käyttötunnit");
        const mileageMin = Number(appliedVehicleMileageMinQuery || "0");
        const mileageMax = Number(appliedVehicleMileageMaxQuery || "0");
        const hoursMin = Number(appliedVehicleHoursMinQuery || "0");
        const hoursMax = Number(appliedVehicleHoursMaxQuery || "0");
        const hasMileageFilter = Boolean(appliedVehicleMileageMinQuery || appliedVehicleMileageMaxQuery);
        const hasHoursFilter = Boolean(appliedVehicleHoursMinQuery || appliedVehicleHoursMaxQuery);
        const matchesVehicleMileage =
          !hasMileageFilter ||
          (listingMileage !== null &&
            (!mileageMin || listingMileage >= mileageMin) &&
            (!mileageMax || listingMileage <= mileageMax));
        const matchesVehicleHours =
          !hasHoursFilter ||
          (listingHours !== null &&
            (!hoursMin || listingHours >= hoursMin) &&
            (!hoursMax || listingHours <= hoursMax));
        const matchesVehicleRegistration =
          !appliedVehicleRegistrationQuery.trim() ||
          compactSearchText(vehicleRegistrationFromDescription(listing.description)).includes(
            compactSearchText(appliedVehicleRegistrationQuery)
          );
        const matchesVehicleEngineKind =
          !appliedVehicleEngineKindQuery ||
          normalizeSearchText(vehicleDescriptionValue(listing.description, "Moottorin tyyppi")) ===
            normalizeSearchText(appliedVehicleEngineKindQuery);
        const matchesVehicleDriveType =
          !appliedVehicleDriveTypeQuery ||
          normalizeSearchText(vehicleDescriptionValue(listing.description, "Vetotapa")) ===
            normalizeSearchText(appliedVehicleDriveTypeQuery);
        const matchesVehicleRoadLegal =
          !appliedVehicleRoadLegalQuery ||
          normalizeSearchText(vehicleDescriptionValue(listing.description, "Tieliikennekelpoisuus")) ===
            normalizeSearchText(appliedVehicleRoadLegalQuery);
        const listingVehicleAccessories = readVehicleAccessories(listing.description).map(normalizeSearchText);
        const matchesVehicleAccessories =
          appliedVehicleAccessoriesQuery.length === 0 ||
          appliedVehicleAccessoriesQuery.every((accessory) =>
            listingVehicleAccessories.includes(normalizeSearchText(accessory))
          );
        const listingVehicleColors = readVehicleColors(listing.description).map(normalizeSearchText);
        const matchesVehicleColors =
          appliedVehicleColorsQuery.length === 0 ||
          appliedVehicleColorsQuery.some((color) =>
            listingVehicleColors.includes(normalizeSearchText(color))
          );
        const matchesVehicleTax =
          (!appliedVehicleVatDeductibleQuery || Boolean(listing.translations?._meta?.vat_deductible)) &&
          (!appliedVehicleTaxFreeQuery || Boolean(listing.translations?._meta?.tax_free));

        const matchesTrackMatDimension =
          !appliedTrackMatDimensionQuery ||
          appliedTrackMatDimensionQuery
            .split(" / ")
            .map((part) => part.trim())
            .filter(Boolean)
            .some((dimensionPart) =>
              allSearchWordsMatch(
                `${listing.part_model ?? ""} ${listingText.title} ${listingText.description}`,
                dimensionPart
              )
            );

        const matchesCompatibleFitment =
          compatibleFitmentActive &&
          listingMatchesCompatibleFitment(listing, selectedFitmentProfile);
        const matchesSubcategoryGroupQuery =
          subcategoryGroupSearchScope.groups.length === 0 ||
          subcategoryGroupSearchScope.groups.some(({ group, children }) =>
            listingMatchesSubcategoryFilter(listing.subcategory, group, children)
          );
        const matchesFreeTextQuery =
          subcategoryGroupSearchScope.groups.length > 0
            ? matchesSubcategoryGroupQuery &&
              allSearchWordsMatch(search, subcategoryGroupSearchScope.remainingQuery)
            : textMatchesSearch(search, appliedQuery) ||
              allSearchWordsMatch(listingContentSearch, appliedQuery);
        const matchesCompatibleQuery =
          textMatchesSearch(search, compatibleQuery) ||
          allSearchWordsMatch(listingContentSearch, compatibleQuery);
        const matchesQuery =
          !appliedQuery ||
          (exactQueryModel
            ? matchesExactModel
            : matchesFreeTextQuery ||
              (matchesCompatibleFitment && matchesCompatibleQuery && matchesSubcategoryGroupQuery));

        // Explicit filters must stay strict. Compatibility expansion is useful for
        // free-text searches, but it must not override a brand/model selection.
        const matchesVehicleIdentity =
          matchesBrand && matchesModel && matchesYear && matchesEngineModel;

        const matchesPrice =
          listing.price >= appliedMinPrice &&
          listing.price <= appliedMaxPrice;
        const gearSearchText = `${listing.category ?? ""} ${listing.subcategory ?? ""} ${listing.brand ?? ""} ${listing.part_model ?? ""} ${listingText.title} ${listingText.description}`;
        const matchesGearType = appliedGearTypeQuery.length === 0 ||
          appliedGearTypeQuery.some((gearType) => allSearchWordsMatch(gearSearchText, gearType));
        const appliedGearBrands = [...appliedGearBrandOptionsQuery, appliedGearBrandQuery.trim()].filter(Boolean);
        const appliedGearSizes = [...appliedGearSizeOptionsQuery, appliedGearSizeQuery.trim()].filter(Boolean);
        const matchesGearBrand = appliedGearBrands.length === 0 ||
          appliedGearBrands.some((gearBrand) => allSearchWordsMatch(gearSearchText, gearBrand));
        const matchesGearSize = appliedGearSizes.length === 0 ||
          appliedGearSizes.some((gearSize) => allSearchWordsMatch(gearSearchText, gearSize));
        const matchesGearTarget = !appliedGearTargetQuery || allSearchWordsMatch(gearSearchText, appliedGearTargetQuery);
        const matchesGearCondition = !appliedGearConditionQuery ||
          normalizeSearchText(listing.condition) === normalizeSearchText(appliedGearConditionQuery);

        if (queryIsIdentifierSearch || directPartNumberMatch) {
          return (directIdentifierMatch || directPartNumberMatch) && matchesPrice;
        }

        return (
          matchesQuery &&
          matchesVehicleType &&
          matchesVehicleSubtype &&
          matchesCategory &&
          matchesSubcategory &&
          matchesVehicleIdentity &&
          matchesIdentifier &&
          matchesLocation &&
          matchesEngineCc &&
          matchesVehicleMileage &&
          matchesVehicleHours &&
          matchesVehicleRegistration &&
          matchesVehicleEngineKind &&
          matchesVehicleDriveType &&
          matchesVehicleRoadLegal &&
          matchesVehicleAccessories &&
          matchesVehicleColors &&
          matchesVehicleTax &&
          matchesTrackMatDimension &&
          matchesGearType &&
          matchesGearBrand &&
          matchesGearSize &&
          matchesGearTarget &&
          matchesGearCondition &&
          matchesPrice &&
          matchesGarage
        );
      })
      .sort((a, b) => {
        switch (sort) {
          case "Lähimpänä sinua": {
            const distanceDifference =
              locationMatchScore(b.location, userLocationTerms) -
              locationMatchScore(a.location, userLocationTerms);

            return (
              distanceDifference ||
              new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
          }

          case "Alhaisin hinta":
            return a.price - b.price;

          case "Korkein hinta":
            return b.price - a.price;

          case "Vanhimmat ensin":
            return (
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            );

          default:
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
        }
      });
  }, [
    listings,
    sort,
    userLocationTerms,
    garageFilter,
    getListingText
  ]);

  const currentDraftListingFilters = useMemo<AppliedListingFilters>(() => ({
    query,
    category,
    subcategory,
    vehicleType,
    vehicleSubtype,
    selectedBrand,
    modelQuery,
    identifierQuery,
    locationQuery,
    yearQuery,
    yearMinQuery,
    yearMaxQuery,
    engineCcQuery,
    engineModelQuery,
    vehicleMileageMinQuery,
    vehicleMileageMaxQuery,
    vehicleHoursMinQuery,
    vehicleHoursMaxQuery,
    vehicleRegistrationQuery,
    vehicleEngineKindQuery,
    vehicleDriveTypeQuery,
    vehicleRoadLegalQuery,
    vehicleAccessoriesQuery,
    vehicleColorsQuery,
    vehicleVatDeductibleQuery,
    vehicleTaxFreeQuery,
    trackMatDimensionQuery,
    minPrice,
    maxPrice,
    garageFilterId: garageFilter?.id ?? "",
    gearTypeQuery,
    gearBrandOptionsQuery,
    gearSizeOptionsQuery,
    gearBrandQuery,
    gearSizeQuery,
    gearConditionQuery,
    gearTargetQuery,
    sellerType
  }), [
    query,
    category,
    subcategory,
    vehicleType,
    vehicleSubtype,
    selectedBrand,
    modelQuery,
    identifierQuery,
    locationQuery,
    yearQuery,
    yearMinQuery,
    yearMaxQuery,
    engineCcQuery,
    engineModelQuery,
    vehicleMileageMinQuery,
    vehicleMileageMaxQuery,
    vehicleHoursMinQuery,
    vehicleHoursMaxQuery,
    vehicleRegistrationQuery,
    vehicleEngineKindQuery,
    vehicleDriveTypeQuery,
    vehicleRoadLegalQuery,
    vehicleAccessoriesQuery,
    vehicleColorsQuery,
    vehicleVatDeductibleQuery,
    vehicleTaxFreeQuery,
    vehicleVatDeductibleQuery,
    vehicleTaxFreeQuery,
    trackMatDimensionQuery,
    minPrice,
    maxPrice,
    gearTypeQuery,
    gearBrandOptionsQuery,
    gearSizeOptionsQuery,
    gearBrandQuery,
    gearSizeQuery,
    gearConditionQuery,
    gearTargetQuery,
    sellerType,
    garageFilter?.id
  ]);

  const persistSavedSearches = useCallback((next: SavedSearchRecord[]) => {
    setSavedSearches(next);
    try {
      localStorage.setItem(SAVED_SEARCHES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Keep the in-memory list usable if browser storage is unavailable.
    }
  }, []);

  const saveCurrentDesktopSearch = useCallback(() => {
    const modeLabel = marketplaceMode === "vehicles"
      ? "Ajoneuvot"
      : marketplaceMode === "gear"
        ? "Ajovarusteet"
        : "Varaosat";
    const details = marketplaceMode === "gear"
      ? gearTypeQuery.slice(0, 2).join(", ") || gearBrandQuery || "Kaikki"
      : marketplaceMode === "vehicles"
        ? [selectedBrand !== "Kaikki" ? selectedBrand : "", modelQuery, vehicleType].filter(Boolean).join(" · ") || "Kaikki"
        : [category, subcategory].filter(Boolean).join(" · ") || "Kaikki";
    const record: SavedSearchRecord = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: `${modeLabel} · ${details}`,
      createdAt: new Date().toISOString(),
      marketplaceMode,
      filters: currentDraftListingFilters
    };
    persistSavedSearches([record, ...savedSearches].slice(0, 20));
    setDesktopSearchSaved(true);
    setSavedSearchesOpen(true);
  }, [
    category,
    currentDraftListingFilters,
    gearBrandQuery,
    gearTypeQuery,
    marketplaceMode,
    modelQuery,
    persistSavedSearches,
    savedSearches,
    selectedBrand,
    subcategory,
    vehicleType
  ]);

  const restoreSavedSearch = useCallback((savedSearch: SavedSearchRecord) => {
    const saved = savedSearch.filters;
    const savedTrackMatDimension = findTrackMatDimension(saved.trackMatDimensionQuery ?? "");
    setMarketplaceMode(savedSearch.marketplaceMode);
    setQuery(saved.query ?? "");
    setCategory(saved.category ?? "");
    setSubcategory(saved.subcategory ?? "");
    setVehicleType(saved.vehicleType ?? "");
    setVehicleSubtype(saved.vehicleSubtype ?? "");
    setSelectedBrand(saved.selectedBrand ?? "Kaikki");
    setModelQuery(saved.modelQuery ?? "");
    setIdentifierQuery(saved.identifierQuery ?? "");
    setLocationQuery(saved.locationQuery ?? "");
    setYearQuery(saved.yearQuery ?? "");
    setYearMinQuery(saved.yearMinQuery ?? "");
    setYearMaxQuery(saved.yearMaxQuery ?? "");
    setEngineCcQuery(saved.engineCcQuery ?? "");
    setEngineModelQuery(saved.engineModelQuery ?? "");
    setVehicleMileageMinQuery(saved.vehicleMileageMinQuery ?? "");
    setVehicleMileageMaxQuery(saved.vehicleMileageMaxQuery ?? "");
    setVehicleHoursMinQuery(saved.vehicleHoursMinQuery ?? "");
    setVehicleHoursMaxQuery(saved.vehicleHoursMaxQuery ?? "");
    setVehicleRegistrationQuery(saved.vehicleRegistrationQuery ?? "");
    setVehicleEngineKindQuery(saved.vehicleEngineKindQuery ?? "");
    setVehicleDriveTypeQuery(saved.vehicleDriveTypeQuery ?? "");
    setVehicleRoadLegalQuery(saved.vehicleRoadLegalQuery ?? "");
    setVehicleAccessoriesQuery(saved.vehicleAccessoriesQuery ?? []);
    setVehicleColorsQuery(saved.vehicleColorsQuery ?? []);
    setVehicleVatDeductibleQuery(saved.vehicleVatDeductibleQuery ?? false);
    setVehicleTaxFreeQuery(saved.vehicleTaxFreeQuery ?? false);
    setTrackMatLengthQuery(savedTrackMatDimension?.lengthCm ?? "");
    setTrackMatLengthCustomQuery("");
    setTrackMatWidthQuery(savedTrackMatDimension?.widthCm ?? "");
    setTrackMatWidthCustomQuery("");
    setTrackMatPitchQuery(savedTrackMatDimension?.pitchCm ?? "");
    setTrackMatPitchCustomQuery("");
    setTrackMatDimensionQuery(saved.trackMatDimensionQuery ?? "");
    setMinPrice(saved.minPrice ?? 0);
    setMaxPrice(saved.maxPrice ?? VEHICLE_PRICE_FILTER_MAX);
    setGarageFilter(garageVehicles.find((vehicle) => vehicle.id === saved.garageFilterId) ?? null);
    setGearTypeQuery(saved.gearTypeQuery ?? []);
    setGearBrandOptionsQuery(saved.gearBrandOptionsQuery ?? []);
    setGearSizeOptionsQuery(saved.gearSizeOptionsQuery ?? []);
    setGearBrandQuery(saved.gearBrandQuery ?? "");
    setGearSizeQuery(saved.gearSizeQuery ?? "");
    setGearConditionQuery(saved.gearConditionQuery ?? "");
    setGearTargetQuery(saved.gearTargetQuery ?? "");
    setSellerType(saved.sellerType ?? "");
    setAppliedListingFilters(saved);
    setAppliedMarketplaceMode(savedSearch.marketplaceMode);
    setCurrentPage(1);
    setDesktopFilterTab("basic");
    setSavedSearchesOpen(false);
    setDesktopSearchSaved(true);
    setActiveHeroFilter(null);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-desktop-full-filter-scroll]")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [garageVehicles]);

  const removeSavedSearch = useCallback((id: string) => {
    persistSavedSearches(savedSearches.filter((item) => item.id !== id));
  }, [persistSavedSearches, savedSearches]);

  const filteredListings = useMemo(
    () => buildFilteredListings(appliedListingFilters, appliedMarketplaceMode),
    [appliedListingFilters, appliedMarketplaceMode, buildFilteredListings]
  );

  const draftListingResultCount = useMemo(
    () => buildFilteredListings(currentDraftListingFilters, marketplaceMode).length,
    [buildFilteredListings, currentDraftListingFilters, marketplaceMode]
  );

  const toggleFavoriteById = useCallback((listingId: string) => {
    setFavorites((prev) => {
      const current = prev.length > 0 ? prev : readSavedListingIds();
      const wasFavorite = current.includes(listingId);
      const next = current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId];

      try {
        localStorage.setItem("savedListings", JSON.stringify(next));
      } catch {}

      if (canUseFavorites) {
        void (wasFavorite ? unsaveListing(listingId) : saveListing(listingId));
      }

      return next;
    });
  }, [canUseFavorites]);

  function toggleFavorite(
    event: React.MouseEvent,
    listingId: string
  ) {
    event.preventDefault();
    event.stopPropagation();
    toggleFavoriteById(listingId);
  }

  function getGarageVehicleType(vehicle: GarageVehicle): VehicleFilter {
    return vehicle.vehicle_class === "Motocross" || vehicle.vehicle_class === "Auto" ? "Motocross"
      : vehicle.vehicle_class === "Mopo" ? "Mopot"
      : vehicle.vehicle_class === "Mönkijä" ? "Mönkijä"
      : "Moottorikelkka";
  }

  function getGarageVehicleEngineCc(vehicle: GarageVehicle) {
    const modelCc = String(vehicle.model ?? "").match(/\b(\d{2,4})\b/)?.[1] ?? "";
    return modelCc && Number(modelCc) >= 50 ? modelCc : "";
  }

  function applyGarageVehicleToCategorization(vehicle: GarageVehicle | null) {
    setGarageDropdownOpen(false);

    if (!vehicle) {
      setGarageFilter(null);
      setVehicleSubtype("");
      setSelectedBrand("Kaikki");
      setModelQuery("");
      setYearQuery("");
      setYearMinQuery("");
      setYearMaxQuery("");
      setEngineCcQuery("");
      setEngineModelQuery("");
      setActiveHeroFilter(null);
      return;
    }

    const vt = getGarageVehicleType(vehicle);
    setGarageFilter(vehicle);
    setVehicleType(vt);
    setVehicleSubtype("");
    setSelectedBrand(vehicle.make);
    setModelQuery(vehicle.model);
    setYearQuery(String(vehicle.year));
    setYearMinQuery(String(vehicle.year));
    setYearMaxQuery(String(vehicle.year));
    setEngineCcQuery(getGarageVehicleEngineCc(vehicle));
    setEngineModelQuery("");
    setActiveHeroFilter(null);
    setRecommendationsMode(false);
    setHomeLatestExpanded(true);
    setCurrentPage(1);
  }

  useEffect(() => {
    if (garageUrlFilterAppliedRef.current) return;

    const make = searchParams.get("garageMake")?.trim() ?? "";
    const model = searchParams.get("garageModel")?.trim() ?? "";
    const year = searchParams.get("garageYear")?.trim() ?? "";

    if (!make && !model && !year) return;

    garageUrlFilterAppliedRef.current = true;
    setGarageDropdownOpen(false);
    setGarageFilter(null);
    setSelectedBrand(make || "Kaikki");
    setModelQuery(model);
    setYearQuery(year);
    setYearMinQuery(year);
    setYearMaxQuery(year);
    setEngineCcQuery("");
    setEngineModelQuery("");
    setVehicleMileageMinQuery("");
    setVehicleMileageMaxQuery("");
    setVehicleHoursMinQuery("");
    setVehicleHoursMaxQuery("");
    setVehicleRegistrationQuery("");
    setVehicleEngineKindQuery("");
    setVehicleDriveTypeQuery("");
    setVehicleRoadLegalQuery("");
    setVehicleAccessoriesQuery([]);
    setVehicleAccessoriesOpen(false);
    setVehicleColorsQuery([]);
    setVehicleColorsOpen(false);
    setVehicleVatDeductibleQuery(false);
    setVehicleTaxFreeQuery(false);
    setSellerType("");
    setAppliedListingFilters({
      query: "",
      category: "",
      subcategory: "",
      vehicleType: "",
      vehicleSubtype: "",
      selectedBrand: make || "Kaikki",
      modelQuery: model,
      identifierQuery: "",
      locationQuery: "",
      yearQuery: year,
      yearMinQuery: year,
      yearMaxQuery: year,
      engineCcQuery: "",
      engineModelQuery: "",
      vehicleMileageMinQuery: "",
      vehicleMileageMaxQuery: "",
      vehicleHoursMinQuery: "",
      vehicleHoursMaxQuery: "",
      vehicleRegistrationQuery: "",
      vehicleEngineKindQuery: "",
      vehicleDriveTypeQuery: "",
      vehicleRoadLegalQuery: "",
      vehicleAccessoriesQuery: [],
      vehicleColorsQuery: [],
      trackMatDimensionQuery: "",
      minPrice: 0,
      maxPrice: 100000,
      garageFilterId: "",
      gearTypeQuery: [],
      gearBrandOptionsQuery: [],
      gearSizeOptionsQuery: [],
      gearBrandQuery: "",
      gearSizeQuery: "",
      gearConditionQuery: "",
      gearTargetQuery: "",
      sellerType: ""
    });
    setActiveHeroFilter(null);
    setRecommendationsMode(false);
    setHomeLatestExpanded(true);
    setCurrentPage(1);
  }, [searchParams]);

  useEffect(() => {
    const hasUrlFilters = MARKETPLACE_FILTER_URL_KEYS.some((key) => searchParams.has(key));
    if (!hasUrlFilters && !marketplaceFilterUrlAppliedRef.current) return;

    marketplaceFilterUrlAppliedRef.current = hasUrlFilters;
    const urlFilters = listingFiltersFromSearchParams(searchParams);
    const urlMarketplaceMode = marketplaceModeFromSearchParams(searchParams);
    const trackMatDimension = findTrackMatDimension(urlFilters.trackMatDimensionQuery);

    setGarageDropdownOpen(false);
    setGarageFilter(null);
    setMarketplaceMode(urlMarketplaceMode);
    setQuery(urlFilters.query);
    setCategory(urlFilters.category);
    setSubcategory(urlFilters.subcategory);
    setSelectedBrand(urlFilters.selectedBrand);
    setVehicleType(urlFilters.vehicleType);
    setVehicleSubtype(urlFilters.vehicleSubtype);
    setModelQuery(urlFilters.modelQuery);
    setIdentifierQuery(urlFilters.identifierQuery);
    setLocationQuery(urlFilters.locationQuery);
    setYearQuery(urlFilters.yearQuery);
    setYearMinQuery(urlFilters.yearMinQuery);
    setYearMaxQuery(urlFilters.yearMaxQuery);
    setEngineCcQuery(urlFilters.engineCcQuery);
    setEngineModelQuery(urlFilters.engineModelQuery);
    setVehicleMileageMinQuery(urlFilters.vehicleMileageMinQuery);
    setVehicleMileageMaxQuery(urlFilters.vehicleMileageMaxQuery);
    setVehicleHoursMinQuery(urlFilters.vehicleHoursMinQuery);
    setVehicleHoursMaxQuery(urlFilters.vehicleHoursMaxQuery);
    setVehicleRegistrationQuery(urlFilters.vehicleRegistrationQuery);
    setVehicleEngineKindQuery(urlFilters.vehicleEngineKindQuery);
    setVehicleDriveTypeQuery(urlFilters.vehicleDriveTypeQuery);
    setVehicleRoadLegalQuery(urlFilters.vehicleRoadLegalQuery);
    setVehicleAccessoriesQuery(urlFilters.vehicleAccessoriesQuery);
    setVehicleAccessoriesOpen(false);
    setVehicleColorsQuery(urlFilters.vehicleColorsQuery);
    setVehicleColorsOpen(false);
    setVehicleVatDeductibleQuery(Boolean(urlFilters.vehicleVatDeductibleQuery));
    setVehicleTaxFreeQuery(Boolean(urlFilters.vehicleTaxFreeQuery));
    setTrackMatLengthQuery(trackMatDimension?.lengthCm ?? "");
    setTrackMatLengthCustomQuery("");
    setTrackMatWidthQuery(trackMatDimension?.widthCm ?? "");
    setTrackMatWidthCustomQuery("");
    setTrackMatPitchQuery(trackMatDimension?.pitchCm ?? "");
    setTrackMatPitchCustomQuery("");
    setTrackMatDimensionQuery(urlFilters.trackMatDimensionQuery);
    setMinPrice(urlFilters.minPrice);
    setMaxPrice(urlFilters.maxPrice);
    setGearTypeQuery(urlFilters.gearTypeQuery);
    setGearBrandOptionsQuery(urlFilters.gearBrandOptionsQuery);
    setGearSizeOptionsQuery(urlFilters.gearSizeOptionsQuery);
    setGearBrandQuery(urlFilters.gearBrandQuery);
    setGearSizeQuery(urlFilters.gearSizeQuery);
    setGearConditionQuery(urlFilters.gearConditionQuery);
    setGearTargetQuery(urlFilters.gearTargetQuery);
    setSellerType(urlFilters.sellerType);
    setAppliedListingFilters(urlFilters);
    setAppliedMarketplaceMode(hasUrlFilters ? urlMarketplaceMode : "all");
    setActiveHeroFilter(null);
    setRecommendationsMode(!hasUrlFilters);
    setListingsExpanded(hasUrlFilters);
    setHomeLatestExpanded(hasUrlFilters);
    setCatalogOnlyView(hasUrlFilters);
    setCurrentPage(1);

    if (hasUrlFilters) {
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      setFavorites(readSavedListingIds());
      getSavedListingIds()
        .then(({ data }) => {
          if (data.length > 0) {
            localStorage.setItem("savedListings", JSON.stringify(data));
            setFavorites(data);
          }
        })
        .catch(() => undefined);
    } catch {}
    favoritesHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!favoritesHydrated.current) return;
    try {
      localStorage.setItem("savedListings", JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  /* ======================================================
     UI
  ====================================================== */

  const [recommendedListings, setRecommendedListings] = useState<Listing[]>([]);
  useEffect(() => {
    if (listingsLoading) return;
    const profile = buildRecoProfile(dbPreferenceProfile);
    const personalized = getRecommendedListings(listings, 18, profile);
    setRecommendedListings(
      personalized.length > 0
        ? personalized
        : listings.slice(0, 8)
    );
  }, [listings, listingsLoading, dbPreferenceProfile]);

  const hasActiveListingFilters =
    Boolean(sellerType) ||
    Boolean(vehicleType) ||
    Boolean(query.trim()) ||
    selectedBrand !== "Kaikki" ||
    Boolean(vehicleSubtype.trim()) ||
    Boolean(category) ||
    Boolean(subcategory) ||
    Boolean(garageFilter) ||
    Boolean(modelQuery.trim()) ||
    Boolean(identifierQuery.trim()) ||
    Boolean(locationQuery.trim()) ||
    Boolean(yearQuery.trim()) ||
    Boolean(yearMinQuery.trim()) ||
    Boolean(yearMaxQuery.trim()) ||
    Boolean(engineCcQuery.trim()) ||
    (marketplaceMode !== "vehicles" && Boolean(engineModelQuery.trim())) ||
    Boolean(trackMatDimensionQuery.trim()) ||
    minPrice !== 0 ||
    maxPrice !== 100000;
  const hasAppliedListingFilters =
    appliedMarketplaceMode !== "all" || hasAppliedFilters(appliedListingFilters);
  const showListingResultsSection =
    catalogOnlyView;

  const canShowRecommendations = false;

  const recommendationsEnabled = false;

  const canUseRemoteListingPages =
    !hasAppliedListingFilters &&
    (sort === "Osuvimmat ensin" || sort === "Uusimmat ensin");

  const sortMenuOptions = [
    ...(canShowRecommendations
      ? [{ value: "recommendations", label: t.relevance, icon: Settings2 }]
      : []),
    ...sortValues
      .filter((value) => (canShowRecommendations ? value !== "Osuvimmat ensin" : true))
      .map((value) => ({
        value,
        label: sortLabel(value),
        icon:
          value === "Uusimmat ensin"
            ? Clock3
            : value === "Vanhimmat ensin"
            ? CalendarDays
            : value === "Alhaisin hinta"
            ? TrendingDown
            : value === "Korkein hinta"
            ? TrendingUp
            : value === "Lähimpänä sinua"
            ? MapPin
            : Settings2
      }))
  ];
  const activeSortValue = recommendationsEnabled ? "recommendations" : sort;
  const activeSortOption = sortMenuOptions.find((option) => option.value === activeSortValue) ?? sortMenuOptions[0];
  const ActiveSortIcon = activeSortOption?.icon ?? Settings2;

  const selectSortOption = useCallback((value: string) => {
    handleSortChange(value);
    setHomeSortOpen(false);
  }, [handleSortChange]);

  const renderSortControl = (className: string) => (
    <div
      className={`${className} home-sort-control ${styles.sortControlRebuilt} ${homeSortOpen ? styles.sortControlOpen : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHomeSortOpen(false);
        }
      }}
    >
      <span className={styles.sortControlLabel}>{t.sort}</span>
      <button
        type="button"
        aria-label={t.sort}
        aria-expanded={homeSortOpen}
        className={`${styles.sortButtonFace} home-sort-button`}
        data-testid="home-sort-select"
        onClick={() => setHomeSortOpen((open) => !open)}
      >
        <ArrowDownWideNarrow size={17} className="home-sort-mobile-icon" aria-hidden="true" />
        <ActiveSortIcon size={16} className="home-sort-active-icon" aria-hidden="true" />
        <span>{activeSortOption?.label ?? sortLabel(sort)}</span>
        <ChevronDown size={16} className={styles.sortButtonChevron} aria-hidden="true" />
      </button>
      {homeSortOpen && (
        <div
          className={`${styles.sortMenuPanel} home-sort-menu`}
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {sortMenuOptions.map((option) => {
            const Icon = option.icon;
            const selected = option.value === activeSortValue;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`${styles.sortMenuItem} home-sort-option ${selected ? `${styles.sortMenuItemActive} is-active` : ""}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={() => {
                  selectSortOption(option.value);
                }}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{option.label}</span>
                {selected && <Check size={15} className={styles.sortMenuCheck} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const showRecoSection =
    recommendationsEnabled &&
    currentPage === 1;

  const showRecoContent =
    showRecoSection;
  const showAllListingsHeader = false;

  const sortedRecommendedListings = useMemo(() => [...recommendedListings].sort((a, b) => {
    return new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime();
  }), [recommendedListings]);

  const firstPageRecommendedListings = useMemo(() => {
    if (!recommendationsEnabled) return [];

    const seen = new Set<string>();

    return sortedRecommendedListings
      .filter((listing) => {
        if (seen.has(listing.id)) return false;
        seen.add(listing.id);
        return true;
      })
      .slice(0, RECOMMENDED_PREVIEW_SIZE);
  }, [RECOMMENDED_PREVIEW_SIZE, recommendationsEnabled, sortedRecommendedListings]);

  const firstPageRecommendedIds = useMemo(
    () => new Set(firstPageRecommendedListings.map((listing) => listing.id)),
    [firstPageRecommendedListings]
  );

  const listingsForPaging = useMemo(() => {
    if (!recommendationsEnabled || firstPageRecommendedIds.size === 0) {
      return filteredListings;
    }

    return filteredListings.filter((listing) => !firstPageRecommendedIds.has(listing.id));
  }, [filteredListings, firstPageRecommendedIds, recommendationsEnabled]);

  const remoteDisplayListings =
    canUseRemoteListingPages &&
    !hasActiveListingFilters &&
    typeof listingsTotalCount === "number"
      ? Math.max(listingsTotalCount, filteredListings.length)
      : filteredListings.length;

  const totalDisplayListings =
    recommendationsEnabled
      ? Math.max(
          remoteDisplayListings,
          firstPageRecommendedListings.length + listingsForPaging.length
        )
      : remoteDisplayListings;

  const firstPageListingSlots =
    recommendationsEnabled
      ? 0
      : PAGE_SIZE;

  const visibleRecommendedListings = useMemo(() => (
    showRecoContent
      ? firstPageRecommendedListings
      : []
  ), [showRecoContent, firstPageRecommendedListings]);

  const totalPages = recommendationsEnabled
    ? Math.max(
        1,
        1 + Math.ceil(Math.max(0, totalDisplayListings - firstPageRecommendedListings.length) / PAGE_SIZE)
      )
    : Math.max(1, Math.ceil(totalDisplayListings / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (
      listingsLoading ||
      !canUseRemoteListingPages ||
      typeof listingsTotalCount !== "number" ||
      listingsPageFetchRef.current ||
      listings.length >= listingsTotalCount
    ) {
      return;
    }

    const requiredListings =
      catalogOnlyView
        ? recommendationsEnabled
          ? currentPage === 1
            ? RECOMMENDED_PREVIEW_SIZE
            : (currentPage - 1) * PAGE_SIZE
          : currentPage * PAGE_SIZE
        : mobilePagination
          ? mobileLatestVisibleCount
          : desktopLatestVisibleCount;

    if (requiredListings <= listings.length) return;

    listingsPageFetchRef.current = true;
    const offset = listings.length;
    const limit = Math.max(PAGE_SIZE * 3, requiredListings - listings.length);
    let cancelled = false;

    getListings({
      includeOptionalFields: true,
      enrichSellerProfiles: true,
      limit,
      offset
    })
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return;

        setListings((current) => {
          const seen = new Set(current.map((listing) => listing.id));
          const next = [...current];

          for (const listing of data.filter(isPublicListing)) {
            if (seen.has(listing.id)) continue;
            seen.add(listing.id);
            next.push(listing);
          }

          return next;
        });
      })
      .catch((error) => {
        console.warn("Lisäilmoitusten lataus epäonnistui.", error);
      })
      .finally(() => {
        listingsPageFetchRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [
    canUseRemoteListingPages,
    catalogOnlyView,
    currentPage,
    desktopLatestVisibleCount,
    firstPageListingSlots,
    listings.length,
    listingsLoading,
    listingsTotalCount,
    mobileLatestVisibleCount,
    mobilePagination,
    recommendationsEnabled
  ]);

  const goToPage = useCallback((page: number) => {
    setListingsExpanded(true);
    const nextPage =
      Math.min(totalPages, Math.max(1, page));

    setCurrentPage(nextPage);
    window.requestAnimationFrame(() => {
      const isMobile = window.matchMedia("(max-width: 720px)").matches;

      if (isMobile && resultsRef.current) {
        const topbarOffset = 76;
        const targetTop =
          resultsRef.current.getBoundingClientRect().top + window.scrollY - topbarOffset;

        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth"
        });
        return;
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [totalPages]);

  const resetPageJump = useCallback(() => {
    setPageJumpValue("");
    setPageJumpOpen(false);
  }, []);

  const suggestedPageJump = Math.min(totalPages, Math.max(1, currentPage + 10));

  const submitPageJump = useCallback(() => {
    const page = Number.parseInt(pageJumpValue.trim() || String(suggestedPageJump), 10);

    if (Number.isNaN(page)) {
      resetPageJump();
      return;
    }

    goToPage(page);
    resetPageJump();
  }, [goToPage, pageJumpValue, resetPageJump, suggestedPageJump]);

  const featuredListings = useMemo(() => {
    if (!listingsExpanded && currentPage === 1) {
      return [...filteredListings]
        .sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime())
        .slice(0, RECOMMENDED_PREVIEW_SIZE);
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredListings.slice(start, start + PAGE_SIZE);
  }, [RECOMMENDED_PREVIEW_SIZE, filteredListings, currentPage, listingsExpanded]);

  const displayedListings = featuredListings;

  const heroLatestListings = useMemo(() => {
    const sourceListings = hasAppliedListingFilters
      ? filteredListings
      : listings
          .filter(isPublicListing);

    return [...sourceListings]
      .sort((a, b) => {
        switch (sort) {
          case "Lähimpänä sinua": {
            const distanceDifference =
              locationMatchScore(b.location, userLocationTerms) -
              locationMatchScore(a.location, userLocationTerms);

            return (
              distanceDifference ||
              new Date(b.created_at ?? "").getTime() -
                new Date(a.created_at ?? "").getTime()
            );
          }

          case "Alhaisin hinta":
            return a.price - b.price;

          case "Korkein hinta":
            return b.price - a.price;

          case "Vanhimmat ensin":
            return (
              new Date(a.created_at ?? "").getTime() -
              new Date(b.created_at ?? "").getTime()
            );

          default:
            return (
              new Date(b.created_at ?? "").getTime() -
              new Date(a.created_at ?? "").getTime()
            );
        }
      });
  }, [filteredListings, hasAppliedListingFilters, listings, sort, userLocationTerms]);

  const compactLatestListings = heroLatestListings.slice(
    0,
    mobilePagination
      ? mobileLatestVisibleCount
      : desktopLatestVisibleCount
  );
  const latestVisibleCount = mobilePagination
    ? mobileLatestVisibleCount
    : desktopLatestVisibleCount;
  const hasMoreLatestListings = compactLatestListings.length === latestVisibleCount;
  const hasNoHomeSearchResults =
    !listingsLoading &&
    homeLatestExpanded &&
    hasAppliedListingFilters &&
    compactLatestListings.length === 0;

  useEffect(() => {
    if (listingsLoading || locale === "fi") return;

    let cancelled = false;
    const visibleListings = displayedListings.slice(0, 12);

    async function translateVisibleListings() {
      for (const listing of visibleListings) {
        if (cancelled) return;

        const attemptKey = `listing-translation-attempt:${listing.id}:${locale}`;
        if (sessionStorage.getItem(attemptKey)) continue;
        sessionStorage.setItem(attemptKey, "1");

        const { data } = await ensureListingTranslations(listing);

        if (!cancelled && data?.translations) {
          setListings((current) =>
            current.map((item) =>
              item.id === data.id ? { ...item, ...data } : item
            )
          );
        }
      }
    }

    void translateVisibleListings();

    return () => {
      cancelled = true;
    };
  }, [displayedListings, listingsLoading, locale]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      void trackUserActivity({ search_term: q });
    }, 2000);
    return () => clearTimeout(timer);
  }, [query]);

  const selectedSubcategoryParts = useMemo(
    () => subcategory.split("/").map((part) => part.trim()).filter(Boolean),
    [subcategory]
  );
  const selectedSubcategoryParent = selectedSubcategoryParts.length > 1 ? selectedSubcategoryParts[0] : subcategory;
  const selectedSubcategoryLeaf =
    selectedSubcategoryParts.length > 1
      ? selectedSubcategoryParts[selectedSubcategoryParts.length - 1]
      : "";
  const trackMatDimensionFieldVisible = selectedSubcategoryParts.some((part) =>
    part.toLowerCase().includes("telamat")
  );

  useEffect(() => {
    if (!trackMatDimensionFieldVisible && (
      trackMatLengthQuery ||
      trackMatLengthCustomQuery ||
      trackMatWidthQuery ||
      trackMatWidthCustomQuery ||
      trackMatPitchQuery ||
      trackMatPitchCustomQuery ||
      trackMatDimensionQuery
    )) {
      setTrackMatLengthQuery("");
      setTrackMatLengthCustomQuery("");
      setTrackMatWidthQuery("");
      setTrackMatWidthCustomQuery("");
      setTrackMatPitchQuery("");
      setTrackMatPitchCustomQuery("");
      setTrackMatDimensionQuery("");
    }
  }, [
    trackMatDimensionFieldVisible,
    trackMatDimensionQuery,
    trackMatLengthCustomQuery,
    trackMatLengthQuery,
    trackMatPitchCustomQuery,
    trackMatPitchQuery,
    trackMatWidthCustomQuery,
    trackMatWidthQuery
  ]);

  const sharedFilterOptions = useMemo(
    () => buildMarketplaceFilterOptions({
      taxonomyVehicles: taxonomy.vehicles,
      vehicleBrands,
      vehicleCategories,
      allVehicleCategories,
      vehicleType,
      vehicleSubtype,
      brand: selectedBrand === "Kaikki" ? "" : selectedBrand,
      model: modelQuery,
      category,
      subcategoryParent: selectedSubcategoryParent
    }),
    [allVehicleCategories, category, modelQuery, selectedBrand, selectedSubcategoryParent, taxonomy.vehicles, vehicleBrands, vehicleCategories, vehicleSubtype, vehicleType]
  );

  const categorySource = useMemo(() => {
    return buildMarketplaceCategorySource({
      vehicleType,
      vehicleSubtype,
      vehicleCategories,
      allVehicleCategories
    });
  }, [allVehicleCategories, vehicleCategories, vehicleSubtype, vehicleType]);

  const categoryEntries = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    const entries = Object.entries(categorySource);

    if (!q) return entries;

    return entries.filter(([key, subs]) => {
      if (key.toLowerCase().includes(q)) return true;
      if (translateCategory(locale, key).toLowerCase().includes(q)) return true;
      return subs.some((s) => {
        const translated = translateCategory(locale, s);
        return s.toLowerCase().includes(q) || translated.toLowerCase().includes(q);
      });
    });
  }, [categorySearch, categorySource, locale]);

  const brandOptions = useMemo(() => ["Kaikki", ...sharedFilterOptions.brands], [sharedFilterOptions.brands]);

  const vehicleTypeOptions = useMemo(
    () => sharedFilterOptions.vehicleTypes,
    [sharedFilterOptions.vehicleTypes]
  );

  const vehicleSubtypeOptions = useMemo(() => sharedFilterOptions.vehicleSubtypes, [sharedFilterOptions.vehicleSubtypes]);

  const modelOptions = useMemo(
    () => sharedFilterOptions.models.filter((option) => {
      const normalized = option.trim().toLocaleLowerCase("fi-FI");
      return !/^(?:1|-)(?:\s+(?:malli|model))?$/.test(normalized);
    }),
    [sharedFilterOptions.models]
  );

  const engineCcOptions = useMemo(() => sharedFilterOptions.engineCcs, [sharedFilterOptions.engineCcs]);

  const engineModelOptions = useMemo(() => sharedFilterOptions.engineModels, [sharedFilterOptions.engineModels]);

  const railSubcategoryGroups = useMemo(
    () => buildMarketplaceSubcategoryGroups({ category, categorySource }),
    [category, categorySource]
  );

  const subcategoryParentOptions = useMemo(() => {
    if (!category) return [];
    if (railSubcategoryGroups) return Object.keys(railSubcategoryGroups);
    return categorySource[category] ?? [];
  }, [category, categorySource, railSubcategoryGroups]);

  const detailedSubcategoryOptions = useMemo(() => {
    if (!category) return [];
    if (railSubcategoryGroups && selectedSubcategoryParent) {
      return railSubcategoryGroups[selectedSubcategoryParent] ?? [];
    }
    const source = categorySource[category] ?? [];
    if (!selectedSubcategoryParent) return source;
    return source.filter((item) => item === selectedSubcategoryParent || item.startsWith(`${selectedSubcategoryParent} /`));
  }, [category, categorySource, railSubcategoryGroups, selectedSubcategoryParent]);

  function getVehiclePillLabel(vehicle: string) {
    const translatedLabel = translateVehicleTypeLabel(vehicle).trim();
    if (translatedLabel && translatedLabel !== vehicle) return translatedLabel;
    const taxonomyLabel = taxonomyVehicleLabels[vehicle]?.trim();
    if (taxonomyLabel) return taxonomyLabel;
    if (vehicle === "Moottorikelkka") return t.snowmobiles;
    if (vehicle === "Mönkijä") return t.atvs;
    if (vehicle === "Motocross") return t.cars;
    if (vehicle === "Mopot" || vehicle === "Mopo") return t.mopeds;
    return translatedLabel || vehicle;
  }

  function afterHeroFilterChange() {
    setGarageFilter(null);
    setGarageDropdownOpen(false);
    setRecommendationsMode(false);
    setListingsExpanded(false);
    setCatalogOnlyView(false);
    setCurrentPage(1);
  }

  function toggleMobileHeroFilter(fieldKey: string, fieldElement: HTMLElement) {
    setActiveHeroFilter((current) => {
      const opening = current !== fieldKey;
      if (opening) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const scroller = mobileSheetFormRef.current;
            if (!scroller) return;

            const scrollerRect = scroller.getBoundingClientRect();
            const fieldRect = fieldElement.getBoundingClientRect();
            const targetTop = scroller.scrollTop + fieldRect.top - scrollerRect.top - 8;
            scroller.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
          });
        });
      }
      return opening ? fieldKey : null;
    });
  }

  function isTrackMatSelection(value: string) {
    return value.toLowerCase().includes("telamat");
  }

  function enforceTrackMatMenuTheme(menu: HTMLDivElement | null) {
    if (!menu) return;

    const lightTheme = document.documentElement.dataset.theme === "light";
    const menuBackground = lightTheme ? "#ffffff" : "#071b2d";
    const menuBorder = lightTheme ? "#aebbc2" : "rgba(77, 120, 157, 0.72)";
    const menuColor = lightTheme ? "#16232c" : "#eef5fb";

    menu.style.setProperty("background", menuBackground, "important");
    menu.style.setProperty("background-color", menuBackground, "important");
    menu.style.setProperty("background-image", "none", "important");
    menu.style.setProperty("border-color", menuBorder, "important");
    menu.style.setProperty("color", menuColor, "important");
    menu.style.setProperty("color-scheme", lightTheme ? "light" : "dark", "important");

    menu.querySelectorAll<HTMLElement>(":scope > button, :scope > span").forEach((option) => {
      option.style.setProperty("background", "transparent", "important");
      option.style.setProperty("background-color", "transparent", "important");
      option.style.setProperty("background-image", "none", "important");
      option.style.setProperty("color", menuColor, "important");
      option.style.setProperty("-webkit-text-fill-color", menuColor, "important");
      option.style.setProperty("opacity", "1", "important");
    });
  }

  const trackMatLengthOptions = useMemo(
    () => uniqueTrackMatChoices(
      TRACK_MAT_DIMENSIONS,
      (dimension) => dimension.lengthCm,
      (dimension) => dimension.lengthInch
    ),
    []
  );

  const trackMatWidthOptions = useMemo(
    () => uniqueTrackMatChoices(
      TRACK_MAT_DIMENSIONS,
      (dimension) => dimension.widthCm,
      (dimension) => dimension.widthInch
    ),
    []
  );

  const trackMatPitchOptions = useMemo(
    () => uniqueTrackMatChoices(
      TRACK_MAT_DIMENSIONS,
      (dimension) => dimension.pitchCm,
      (dimension) => dimension.pitchInch
    ),
    []
  );

  useEffect(() => {
    if (!effectiveTrackMatLengthQuery || !effectiveTrackMatWidthQuery || !effectiveTrackMatPitchQuery) {
      setTrackMatDimensionQuery("");
      return;
    }

    const presetDimension = TRACK_MAT_DIMENSIONS.find((dimension) =>
      dimension.lengthCm === effectiveTrackMatLengthQuery &&
      dimension.widthCm === effectiveTrackMatWidthQuery &&
      dimension.pitchCm === effectiveTrackMatPitchQuery
    );

    setTrackMatDimensionQuery(
      presetDimension?.value ??
      `${effectiveTrackMatLengthQuery} x ${effectiveTrackMatWidthQuery} x ${effectiveTrackMatPitchQuery}`
    );
  }, [
    effectiveTrackMatLengthQuery,
    effectiveTrackMatPitchQuery,
    effectiveTrackMatWidthQuery
  ]);

  const trackMatDimensionFields = [
    {
      key: "trackMatLength",
      label: "Pituus",
      placeholder: "Pituus",
      value: trackMatLengthQuery,
      displayValue: trackMatLengthQuery === CUSTOM_TRACK_MAT_DIMENSION_VALUE ? "Muu" : trackMatLengthQuery,
      options: trackMatLengthOptions,
      customValue: trackMatLengthCustomQuery,
      customPlaceholder: "esim. 360 cm",
      nextKey: "trackMatWidth",
      onSelect: (value: string) => {
        setTrackMatLengthQuery(value);
        if (value !== CUSTOM_TRACK_MAT_DIMENSION_VALUE) setTrackMatLengthCustomQuery("");
        setTrackMatWidthQuery("");
        setTrackMatWidthCustomQuery("");
        setTrackMatPitchQuery("");
        setTrackMatPitchCustomQuery("");
        setActiveHeroFilter(
          value && value !== CUSTOM_TRACK_MAT_DIMENSION_VALUE ? "trackMatWidth" : null
        );
        afterHeroFilterChange();
      },
      onCustomChange: setTrackMatLengthCustomQuery,
      onCustomCommit: () => {
        if (trackMatLengthCustomQuery.trim()) setActiveHeroFilter("trackMatWidth");
      }
    },
    {
      key: "trackMatWidth",
      label: "Leveys",
      placeholder: "Leveys",
      value: trackMatWidthQuery,
      displayValue: trackMatWidthQuery === CUSTOM_TRACK_MAT_DIMENSION_VALUE ? "Muu" : trackMatWidthQuery,
      options: trackMatWidthOptions,
      customValue: trackMatWidthCustomQuery,
      customPlaceholder: "esim. 38 cm",
      nextKey: "trackMatPitch",
      onSelect: (value: string) => {
        setTrackMatWidthQuery(value);
        if (value !== CUSTOM_TRACK_MAT_DIMENSION_VALUE) setTrackMatWidthCustomQuery("");
        setTrackMatPitchQuery("");
        setTrackMatPitchCustomQuery("");
        setActiveHeroFilter(
          value && value !== CUSTOM_TRACK_MAT_DIMENSION_VALUE ? "trackMatPitch" : null
        );
        afterHeroFilterChange();
      },
      onCustomChange: setTrackMatWidthCustomQuery,
      onCustomCommit: () => {
        if (trackMatWidthCustomQuery.trim()) setActiveHeroFilter("trackMatPitch");
      }
    },
    {
      key: "trackMatPitch",
      label: "Jako",
      placeholder: "Jako",
      value: trackMatPitchQuery,
      displayValue: trackMatPitchQuery === CUSTOM_TRACK_MAT_DIMENSION_VALUE ? "Muu" : trackMatPitchQuery,
      options: trackMatPitchOptions,
      customValue: trackMatPitchCustomQuery,
      customPlaceholder: "esim. 7,3 cm",
      nextKey: null,
      onSelect: (value: string) => {
        setTrackMatPitchQuery(value);
        if (value !== CUSTOM_TRACK_MAT_DIMENSION_VALUE) setTrackMatPitchCustomQuery("");
        setActiveHeroFilter(null);
        afterHeroFilterChange();
      },
      onCustomChange: setTrackMatPitchCustomQuery,
      onCustomCommit: () => setActiveHeroFilter(null)
    }
  ];

  const yearOptions = useMemo(() => buildMarketplaceYearOptions(), []);

  const selectedYearMin = Number(yearMinQuery || YEAR_FILTER_MIN);
  const selectedYearMax = Number(yearMaxQuery || YEAR_FILTER_MAX);
  const yearMinPercent =
    ((Math.max(YEAR_FILTER_MIN, Math.min(selectedYearMin, YEAR_FILTER_MAX)) - YEAR_FILTER_MIN) /
      (YEAR_FILTER_MAX - YEAR_FILTER_MIN)) *
    100;
  const yearMaxPercent =
    ((Math.max(YEAR_FILTER_MIN, Math.min(selectedYearMax, YEAR_FILTER_MAX)) - YEAR_FILTER_MIN) /
      (YEAR_FILTER_MAX - YEAR_FILTER_MIN)) *
    100;

  const yearSliderRef = useRef<HTMLDivElement | null>(null);

  const updateYearRangeFromPointer = useCallback((clientX: number, handle?: "min" | "max") => {
    const slider = yearSliderRef.current;
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    const percent = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
    const rawYear = Math.round(YEAR_FILTER_MIN + percent * (YEAR_FILTER_MAX - YEAR_FILTER_MIN));
    const nextYear = Math.min(YEAR_FILTER_MAX, Math.max(YEAR_FILTER_MIN, rawYear));
    const currentMin = Number(yearMinQuery || YEAR_FILTER_MIN);
    const currentMax = Number(yearMaxQuery || YEAR_FILTER_MAX);
    const targetHandle =
      handle ??
      (Math.abs(nextYear - currentMin) <= Math.abs(nextYear - currentMax) ? "min" : "max");

    if (targetHandle === "min") {
      const nextMin = Math.min(nextYear, currentMax);
      setYearMinQuery(nextMin === YEAR_FILTER_MIN ? "" : String(nextMin));
    } else {
      const nextMax = Math.max(nextYear, currentMin);
      setYearMaxQuery(nextMax === YEAR_FILTER_MAX ? "" : String(nextMax));
    }

    setYearQuery("");
    afterHeroFilterChange();
  }, [YEAR_FILTER_MAX, YEAR_FILTER_MIN, yearMaxQuery, yearMinQuery]);

  const startYearRangeDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement | HTMLSpanElement | HTMLButtonElement>,
    handle?: "min" | "max"
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);
    updateYearRangeFromPointer(event.clientX, handle);

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      updateYearRangeFromPointer(moveEvent.clientX, handle);
    };
    const stop = (stopEvent: PointerEvent) => {
      if (stopEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }, [updateYearRangeFromPointer]);

  const startYearRangeMouseDrag = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const slider = yearSliderRef.current;
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    const minX = rect.left + (yearMinPercent / 100) * rect.width;
    const maxX = rect.left + (yearMaxPercent / 100) * rect.width;
    const handle: "min" | "max" = Math.abs(event.clientX - minX) <= Math.abs(event.clientX - maxX) ? "min" : "max";
    updateYearRangeFromPointer(event.clientX, handle);
    const move = (moveEvent: MouseEvent) => updateYearRangeFromPointer(moveEvent.clientX, handle);
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }, [updateYearRangeFromPointer, yearMaxPercent, yearMinPercent]);

  const heroFilterFields = [
    {
      key: "vehicleType",
      label: heroFilterCopy.vehicleType,
      value: vehicleType ? getVehiclePillLabel(vehicleType) : heroFilterCopy.allVehicles,
      options: [
        { label: heroFilterCopy.allVehicles, value: "" },
        ...vehicleTypeOptions.map((option) => ({
          label: getVehiclePillLabel(option),
          value: option
        }))
      ],
      onSelect: (value: string) => {
        setVehicleType(value);
        setVehicleSubtype("");
        setSelectedBrand("Kaikki");
        setModelQuery("");
        setEngineCcQuery("");
        setEngineModelQuery("");
        setCategory("");
        setSubcategory("");
        afterHeroFilterChange();
      }
    },
    {
      key: "vehicleSubtype",
      label: heroFilterCopy.type,
      value: vehicleSubtype ? translateCategoryLabel(vehicleSubtype) : allVehicleSubtypesLabel,
      options: [
        { label: allVehicleSubtypesLabel, value: "" },
        ...vehicleSubtypeOptions.map((option) => ({
          label: translateCategoryLabel(option),
          value: option
        }))
      ],
      onSelect: (value: string) => {
        setVehicleSubtype(value);
        setSelectedBrand("Kaikki");
        setModelQuery("");
        setEngineModelQuery("");
        setCategory("");
        setSubcategory("");
        afterHeroFilterChange();
      }
    },
    {
      key: "brand",
      label: heroFilterCopy.brand,
      value: selectedBrand && selectedBrand !== "Kaikki" ? selectedBrand : heroFilterCopy.allBrands,
      options: brandOptions.map((option) => ({
        label: option === "Kaikki" ? heroFilterCopy.allBrands : option,
        value: option
      })),
      onSelect: (value: string) => {
        setSelectedBrand(value || "Kaikki");
        setModelQuery("");
        setEngineModelQuery("");
        afterHeroFilterChange();
      }
    },
    {
      key: "model",
      label: heroFilterCopy.model,
      value: modelQuery || heroFilterCopy.allModels,
      options: [
        { label: heroFilterCopy.allModels, value: "" },
        ...modelOptions.map((option) => ({ label: option, value: option }))
      ],
      onSelect: (value: string) => {
        setModelQuery(value);
        afterHeroFilterChange();
      }
    },
    {
      key: "engineCc",
      label: heroFilterCopy.engineCapacity,
      value: engineCcQuery || heroFilterCopy.allEngineSizes,
      options: [
        { label: heroFilterCopy.allEngineSizes, value: "" },
        ...engineCcOptions.map((option) => ({ label: option, value: option }))
      ],
      onSelect: (value: string) => {
        setEngineCcQuery(value);
        afterHeroFilterChange();
      }
    },
    {
      key: "engineModel",
      label: heroFilterCopy.engine,
      value: engineModelQuery || heroFilterCopy.allEngines,
      options: [
        { label: heroFilterCopy.allEngines, value: "" },
        ...engineModelOptions.map((option) => ({ label: option, value: option }))
      ],
      onSelect: (value: string) => {
        setEngineModelQuery(value);
        afterHeroFilterChange();
      }
    },
    {
      key: "category",
      label: categoryFilterCopy.mainCategory,
      value: category ? translateCategoryLabel(category) : categoryFilterCopy.selectMainCategory,
      options: [
        { label: categoryFilterCopy.allCategories, value: "" },
        ...Object.keys(categorySource).map((option) => ({ label: translateCategoryLabel(option), value: option }))
      ],
      onSelect: (value: string) => {
        setCategory(value);
        setSubcategory("");
        afterHeroFilterChange();
      }
    },
    {
      key: "subcategory",
      label: categoryFilterCopy.subcategory,
      value: selectedSubcategoryParent
        ? translateCategoryLabel(selectedSubcategoryParent)
        : categoryFilterCopy.selectSubcategory,
      options: [
        { label: categoryFilterCopy.allSubcategories, value: "" },
        ...subcategoryParentOptions.map((option) => ({ label: translateCategoryLabel(option), value: option }))
      ],
      onSelect: (value: string) => {
        setSubcategory(value);
        if (isTrackMatSelection(value)) {
          setActiveHeroFilter("trackMatLength");
          window.setTimeout(() => {
            document.getElementById("mobile-track-mat-dimension")?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }, 0);
        } else {
          setTrackMatLengthQuery("");
          setTrackMatLengthCustomQuery("");
          setTrackMatWidthQuery("");
          setTrackMatWidthCustomQuery("");
          setTrackMatPitchQuery("");
          setTrackMatPitchCustomQuery("");
          setTrackMatDimensionQuery("");
        }
        afterHeroFilterChange();
      }
    },
    {
      key: "detailSubcategory",
      label: categoryFilterCopy.detailedPart,
      value: selectedSubcategoryLeaf ? translateCategoryLabel(selectedSubcategoryLeaf) : (
        isTrackMatSelection(subcategory)
          ? translateCategoryLabel("Telamatot")
          : subcategory
            ? categoryFilterCopy.allDetailedParts
            : categoryFilterCopy.selectDetailedPart
      ),
      options: [
        { label: categoryFilterCopy.allDetailedParts, value: selectedSubcategoryParent || "" },
        ...detailedSubcategoryOptions.map((option) => ({
          label: translateCategoryLabel(option.split("/").at(-1)?.trim() || option),
          value: option
        }))
      ],
      onSelect: (value: string) => {
        const detailedValue =
          value &&
          selectedSubcategoryParent &&
          value !== selectedSubcategoryParent &&
          !value.includes("/")
            ? `${selectedSubcategoryParent} / ${value}`
            : value;
        setSubcategory(detailedValue);
        if (isTrackMatSelection(detailedValue)) {
          setActiveHeroFilter("trackMatLength");
          revealPartCategoryMenu("trackMatLength");
        } else {
          setTrackMatLengthQuery("");
          setTrackMatLengthCustomQuery("");
          setTrackMatWidthQuery("");
          setTrackMatWidthCustomQuery("");
          setTrackMatPitchQuery("");
          setTrackMatPitchCustomQuery("");
          setTrackMatDimensionQuery("");
        }
        afterHeroFilterChange();
      }
    }
  ];

  const marketplaceHeroFilterFields = isGearMarketplace
    ? []
    : isVehicleMarketplace
    ? heroFilterFields.filter((field) =>
        !["engineModel", "category", "subcategory", "detailSubcategory"].includes(field.key)
      )
    : heroFilterFields;

  function updateLocationSelection(nextSelection: LocationFilterSelection) {
    setLocationQuery(serializeLocationFilter(nextSelection));
    afterHeroFilterChange();
  }

  function getLocationValueCountryCode(value: string): "FI" | "SE" | "NO" {
    if (getNorwayLocationName(value)) return "NO";
    if (getSwedenLocationName(value)) return "SE";
    return "FI";
  }

  function toggleLocationSelection(
    group: keyof LocationFilterSelection,
    value: string
  ) {
    const values = locationSelection[group];
    const nextValues = values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
    const nextSelection: LocationFilterSelection = {
      ...locationSelection,
      [group]: nextValues
    };

    if (group === "countries" && !nextValues.includes(value)) {
      if (value === "FI" || value === "SE" || value === "NO") {
        nextSelection.regions = nextSelection.regions.filter(
          (region) => getLocationValueCountryCode(region) !== value
        );
        nextSelection.municipalities = nextSelection.municipalities.filter(
          (municipality) => getLocationValueCountryCode(municipality) !== value
        );
      }
    }

    if (group !== "countries") {
      const countryCode = getLocationValueCountryCode(value);
      if (!nextSelection.countries.includes(countryCode)) {
        nextSelection.countries = [...nextSelection.countries, countryCode];
      }
    }

    updateLocationSelection(nextSelection);
  }

  function toggleLocationFilterValue(value: string) {
    const firstSeparatorIndex = value.indexOf(":");
    const group = value.slice(0, firstSeparatorIndex);
    const selectionValue = value.slice(firstSeparatorIndex + 1);

    if (group === "action") {
      const countryCode = selectionValue.slice(0, 2);
      if (
        (countryCode === "FI" || countryCode === "SE" || countryCode === "NO") &&
        !locationSelection.countries.includes(countryCode)
      ) {
        toggleLocationSelection("countries", countryCode);
      }
    } else if (group === "country") {
      toggleLocationSelection("countries", selectionValue);
    } else if (group === "region") {
      toggleLocationSelection("regions", selectionValue);
    } else if (group === "municipality") {
      toggleLocationSelection("municipalities", selectionValue);
    }
  }

  function clearLocationSelection(group: keyof LocationFilterSelection) {
    updateLocationSelection({
      ...locationSelection,
      [group]: []
    });
  }

  const heroRailFilterFields = marketplaceHeroFilterFields.filter((field) =>
    ["vehicleType", "vehicleSubtype", "brand", "model"].includes(field.key)
  );
  const heroRailEngineFields = marketplaceHeroFilterFields.filter((field) =>
    ["engineCc", "engineModel"].includes(field.key)
  );
  const heroRailPartCategoryFields = marketplaceHeroFilterFields.filter((field) =>
    ["category", "subcategory", "detailSubcategory"].includes(field.key)
  );

  function revealPartCategoryMenu(fieldKey: string) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const field = document.querySelector<HTMLElement>(
          `[data-part-category-filter="${fieldKey}"]`
        );
        const menu = field?.querySelector<HTMLElement>("[data-part-category-menu]");
        const scrollArea = field?.closest<HTMLElement>("[data-home-filter-scroll-area]");
        if (!menu || !scrollArea) return;

        const menuRect = menu.getBoundingClientRect();
        const scrollRect = scrollArea.getBoundingClientRect();
        const bottomOverflow = menuRect.bottom - (scrollRect.bottom - 14);
        const topOverflow = (scrollRect.top + 14) - menuRect.top;

        if (bottomOverflow > 0) {
          scrollArea.scrollBy({ top: bottomOverflow, behavior: "smooth" });
        } else if (topOverflow > 0) {
          scrollArea.scrollBy({ top: -topOverflow, behavior: "smooth" });
        }
      });
    });
  }

  const rangeThumbLeft = (percent: number) =>
    `calc(${percent}% + ${4 - (8 * percent) / 100}px)`;

  function renderNumericRangeSlider({
    label,
    minValue,
    maxValue,
    minimum = 0,
    maximum,
    step,
    onMinChange,
    onMaxChange
  }: {
    label: string;
    minValue: string;
    maxValue: string;
    minimum?: number;
    maximum: number;
    step: number;
    onMinChange: (value: string) => void;
    onMaxChange: (value: string) => void;
  }) {
    const rangeSize = Math.max(1, maximum - minimum);
    const selectedMin = Math.max(minimum, Math.min(Number(minValue || minimum), maximum));
    const selectedMax = Math.max(selectedMin, Math.min(Number(maxValue || maximum), maximum));
    const selectedMinPercent = ((selectedMin - minimum) / rangeSize) * 100;
    const selectedMaxPercent = ((selectedMax - minimum) / rangeSize) * 100;

    return (
      <div
        className={styles.vehicleNumericSlider}
        data-range-active={minValue || maxValue ? "true" : "false"}
        role="group"
        aria-label={label}
        style={{
          "--filter-range-min": `${selectedMinPercent}%`,
          "--filter-range-max": `${selectedMaxPercent}%`
        } as CSSProperties}
      >
        <span className={styles.vehicleNumericSliderLine} aria-hidden="true" />
        <span className={styles.rangeVisualThumb} style={{ left: rangeThumbLeft(selectedMinPercent) }} aria-hidden="true" />
        <span className={styles.rangeVisualThumb} style={{ left: rangeThumbLeft(selectedMaxPercent) }} aria-hidden="true" />
        <input
          type="range"
          min={minimum}
          max={maximum}
          step={step}
          value={selectedMin}
          aria-label={`${label}, minimi`}
          onInput={(event) => {
            const next = Math.min(Number(event.currentTarget.value), selectedMax);
            onMinChange(next === minimum ? "" : String(next));
            afterHeroFilterChange();
          }}
        />
        <input
          type="range"
          min={minimum}
          max={maximum}
          step={step}
          value={selectedMax}
          aria-label={`${label}, maksimi`}
          onInput={(event) => {
            const next = Math.max(Number(event.currentTarget.value), selectedMin);
            onMaxChange(next === maximum ? "" : String(next));
            afterHeroFilterChange();
          }}
        />
      </div>
    );
  }

  function renderVehicleUsageFilters(layout: "mobile" | "desktop") {
    if (!isVehicleMarketplace) return null;

    const filterIdPrefix = `${layout}-vehicle`;
    const numericValue = (value: string) => value.replace(/\D/g, "");

    return (
      <section
        className={styles.vehicleUsageFilters}
        data-vehicle-filter-layout={layout}
        aria-label="Ajoneuvon lisätiedot"
      >
        <label className={styles.vehicleUsageField} htmlFor={`${filterIdPrefix}-engine-kind`}>
          <span>Moottorin tyyppi</span>
          <span className={styles.vehicleUsageSelectShell}>
            <select
              id={`${filterIdPrefix}-engine-kind`}
              value={vehicleEngineKindQuery}
              onChange={(event) => setVehicleEngineKindQuery(event.target.value)}
            >
              <option value="">Ei väliä</option>
              {VEHICLE_ENGINE_KIND_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </label>
        <label className={styles.vehicleUsageField} htmlFor={`${filterIdPrefix}-drive-type`}>
          <span>Vetotapa</span>
          <span className={styles.vehicleUsageSelectShell}>
            <select
              id={`${filterIdPrefix}-drive-type`}
              value={vehicleDriveTypeQuery}
              onChange={(event) => setVehicleDriveTypeQuery(event.target.value)}
            >
              <option value="">Ei väliä</option>
              {VEHICLE_DRIVE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </label>
        <label className={styles.vehicleUsageField} htmlFor={`${filterIdPrefix}-road-legal`}>
          <span>Tieliikennekelpoisuus</span>
          <span className={styles.vehicleUsageSelectShell}>
            <select
              id={`${filterIdPrefix}-road-legal`}
              value={vehicleRoadLegalQuery}
              onChange={(event) => setVehicleRoadLegalQuery(event.target.value)}
            >
              <option value="">Ei väliä</option>
              {VEHICLE_ROAD_LEGAL_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </label>
        <span className={styles.vehicleUsageSectionLabel}>Ajomäärä ja rekisteri</span>
        <label className={styles.vehicleUsageField} htmlFor={`${filterIdPrefix}-mileage-min`}>
          <span>Ajokilometrit (km)</span>
          <div className={styles.vehicleUsageRange}>
            <input
              id={`${filterIdPrefix}-mileage-min`}
              type="text"
              inputMode="numeric"
              value={vehicleMileageMinQuery}
              placeholder="Minimi"
              onChange={(event) => setVehicleMileageMinQuery(numericValue(event.target.value))}
            />
            <i aria-hidden="true">–</i>
            <input
              aria-label="Ajokilometrien maksimi"
              type="text"
              inputMode="numeric"
              value={vehicleMileageMaxQuery}
              placeholder="Maksimi"
              onChange={(event) => setVehicleMileageMaxQuery(numericValue(event.target.value))}
            />
          </div>
          {renderNumericRangeSlider({
            label: "Ajokilometrit",
            minValue: vehicleMileageMinQuery,
            maxValue: vehicleMileageMaxQuery,
            maximum: VEHICLE_MILEAGE_FILTER_MAX,
            step: 1000,
            onMinChange: setVehicleMileageMinQuery,
            onMaxChange: setVehicleMileageMaxQuery
          })}
        </label>
        <label className={styles.vehicleUsageField} htmlFor={`${filterIdPrefix}-hours-min`}>
          <span>Käyttötunnit (h)</span>
          <div className={styles.vehicleUsageRange}>
            <input
              id={`${filterIdPrefix}-hours-min`}
              type="text"
              inputMode="numeric"
              value={vehicleHoursMinQuery}
              placeholder="Minimi"
              onChange={(event) => setVehicleHoursMinQuery(numericValue(event.target.value))}
            />
            <i aria-hidden="true">–</i>
            <input
              aria-label="Käyttötuntien maksimi"
              type="text"
              inputMode="numeric"
              value={vehicleHoursMaxQuery}
              placeholder="Maksimi"
              onChange={(event) => setVehicleHoursMaxQuery(numericValue(event.target.value))}
            />
          </div>
          {renderNumericRangeSlider({
            label: "Käyttötunnit",
            minValue: vehicleHoursMinQuery,
            maxValue: vehicleHoursMaxQuery,
            maximum: VEHICLE_HOURS_FILTER_MAX,
            step: 50,
            onMinChange: setVehicleHoursMinQuery,
            onMaxChange: setVehicleHoursMaxQuery
          })}
        </label>
        <label className={styles.vehicleUsageField} htmlFor={`${filterIdPrefix}-registration`}>
          <span>Rekisteritunnus</span>
          <input
            id={`${filterIdPrefix}-registration`}
            className={styles.vehicleRegistrationInput}
            type="text"
            autoCapitalize="characters"
            value={vehicleRegistrationQuery}
            placeholder="Esim. 123-ABC"
            onChange={(event) => setVehicleRegistrationQuery(event.target.value.toUpperCase())}
          />
        </label>
        <button
          type="button"
          className={styles.vehicleAccessoryFilterButton}
          onClick={() => setVehicleAccessoriesOpen(true)}
          aria-haspopup="dialog"
        >
          <span>
            <Cog size={17} aria-hidden="true" />
            <strong>{vehicleOptionCopy.accessories}</strong>
          </span>
          <span>
            {vehicleAccessoriesQuery.length > 0
              ? vehicleOptionCopy.selected(vehicleAccessoriesQuery.length)
              : vehicleOptionCopy.allAccessories}
            <ChevronRight size={17} aria-hidden="true" />
          </span>
        </button>
        {layout === "desktop" && vehicleAccessoriesOpen
          ? createPortal(
              <div className={styles.vehicleAccessoryOverlay} role="presentation" onMouseDown={() => setVehicleAccessoriesOpen(false)}>
                <section
                  className={styles.vehicleAccessoryDialog}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="filter-accessories-title"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <header className={styles.vehicleAccessoryDialogHeader}>
                    <div>
                      <h2 id="filter-accessories-title">{vehicleOptionCopy.accessories}</h2>
                      <p>{vehicleOptionCopy.accessoriesDescription}</p>
                    </div>
                    <button type="button" onClick={() => setVehicleAccessoriesOpen(false)} aria-label={vehicleOptionCopy.closeAccessories}>
                      <X size={22} aria-hidden="true" />
                    </button>
                  </header>
                  <div className={styles.vehicleAccessoryGrid}>
                    {VEHICLE_ACCESSORY_OPTIONS.map((accessory) => {
                      const selected = vehicleAccessoriesQuery.includes(accessory);
                      return (
                        <label key={accessory} className={selected ? styles.vehicleAccessoryOptionSelected : ""}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              setVehicleAccessoriesQuery((current) =>
                                current.includes(accessory)
                                  ? current.filter((item) => item !== accessory)
                                  : [...current, accessory]
                              );
                              afterHeroFilterChange();
                            }}
                          />
                          <span className={styles.vehicleAccessoryCheck} aria-hidden="true">
                            {selected ? <Check size={15} /> : null}
                          </span>
                          <span>{translateVehicleAccessory(locale, accessory)}</span>
                        </label>
                      );
                    })}
                  </div>
                  <footer className={styles.vehicleAccessoryDialogFooter}>
                    <button type="button" onClick={() => setVehicleAccessoriesQuery([])}>{vehicleOptionCopy.clearSelections}</button>
                    <button type="button" className={styles.vehicleAccessoryDone} onClick={() => setVehicleAccessoriesOpen(false)}>
                      {vehicleOptionCopy.done} ({vehicleAccessoriesQuery.length})
                    </button>
                  </footer>
                </section>
              </div>,
              document.body
            )
          : null}
        <button
          type="button"
          className={styles.vehicleAccessoryFilterButton}
          onClick={() => setVehicleColorsOpen(true)}
          aria-haspopup="dialog"
        >
          <span>
            <Palette size={17} aria-hidden="true" />
            <strong>{vehicleOptionCopy.color}</strong>
          </span>
          <span>
            {vehicleColorsQuery.length > 0
              ? vehicleOptionCopy.selected(vehicleColorsQuery.length)
              : vehicleOptionCopy.allColors}
            <ChevronRight size={17} aria-hidden="true" />
          </span>
        </button>
        {layout === "desktop" && vehicleColorsOpen
          ? createPortal(
              <div className={styles.vehicleAccessoryOverlay} role="presentation" onMouseDown={() => setVehicleColorsOpen(false)}>
                <section
                  className={styles.vehicleAccessoryDialog}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="filter-colors-title"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <header className={styles.vehicleAccessoryDialogHeader}>
                    <div>
                      <h2 id="filter-colors-title">{vehicleOptionCopy.color}</h2>
                      <p>{vehicleOptionCopy.colorDescription}</p>
                    </div>
                    <button type="button" onClick={() => setVehicleColorsOpen(false)} aria-label={vehicleOptionCopy.closeColors}>
                      <X size={22} aria-hidden="true" />
                    </button>
                  </header>
                  <div className={`${styles.vehicleAccessoryGrid} ${styles.vehicleColorGrid}`}>
                    {VEHICLE_COLOR_OPTIONS.map((color) => {
                      const selected = vehicleColorsQuery.includes(color.label);
                      return (
                        <label key={color.label} className={selected ? styles.vehicleAccessoryOptionSelected : ""}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              setVehicleColorsQuery((current) =>
                                current.includes(color.label)
                                  ? current.filter((item) => item !== color.label)
                                  : [...current, color.label]
                              );
                              afterHeroFilterChange();
                            }}
                          />
                          <span className={styles.vehicleAccessoryCheck} aria-hidden="true">
                            {selected ? <Check size={15} /> : null}
                          </span>
                          <span>{translateVehicleColor(locale, color.label)}</span>
                          <span
                            className={styles.vehicleColorSwatch}
                            style={{ background: color.swatch }}
                            aria-hidden="true"
                          >
                            {color.label === "Muu" ? "?" : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <footer className={styles.vehicleAccessoryDialogFooter}>
                    <button type="button" onClick={() => setVehicleColorsQuery([])}>{vehicleOptionCopy.clearSelections}</button>
                    <button type="button" className={styles.vehicleAccessoryDone} onClick={() => setVehicleColorsOpen(false)}>
                      {vehicleOptionCopy.done} ({vehicleColorsQuery.length})
                    </button>
                  </footer>
                </section>
              </div>,
              document.body
            )
          : null}
        <div className={styles.vehicleFilterTaxCard} aria-label="Ajoneuvon verotiedot">
          <strong>Verotiedot</strong>
          <div>
            <label>
              <input
                type="checkbox"
                checked={vehicleVatDeductibleQuery}
                onChange={(event) => {
                  setVehicleVatDeductibleQuery(event.target.checked);
                  afterHeroFilterChange();
                }}
              />
              <span aria-hidden="true">{vehicleVatDeductibleQuery ? <Check size={14} /> : null}</span>
              ALV-vähennyskelpoinen
            </label>
            <label>
              <input
                type="checkbox"
                checked={vehicleTaxFreeQuery}
                onChange={(event) => {
                  setVehicleTaxFreeQuery(event.target.checked);
                  afterHeroFilterChange();
                }}
              />
              <span aria-hidden="true">{vehicleTaxFreeQuery ? <Check size={14} /> : null}</span>
              Tax free
            </label>
          </div>
        </div>
      </section>
    );
  }

  function toggleGearType(option: string) {
    setGearTypeQuery((current) => current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option]);
  }

  function toggleGearBrandOption(option: string) {
    setGearBrandOptionsQuery((current) => current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option]);
  }

  function toggleGearSizeOption(option: string) {
    setGearSizeOptionsQuery((current) => current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option]);
  }

  function renderGearOptionPicker({
    menuKey,
    label,
    allLabel,
    options,
    selected,
    onToggle,
    onClear,
    customValue,
    onCustomChange,
    customPlaceholder
  }: {
    menuKey: string;
    label: string;
    allLabel: string;
    options: readonly string[];
    selected: string[];
    onToggle: (option: string) => void;
    onClear: () => void;
    customValue: string;
    onCustomChange: (value: string) => void;
    customPlaceholder: string;
  }) {
    const selectedCount = selected.length + (customValue.trim() ? 1 : 0);
    const summary = selectedCount === 0
      ? allLabel
      : selectedCount === 1
        ? selected[0] ?? customValue.trim()
        : `${selectedCount} valittu`;

    return (
      <div className={`${styles.vehicleUsageField} ${styles.gearTypeMultiField}`}>
        <span>{label}</span>
        <button
          type="button"
          className={styles.gearTypeMultiButton}
          aria-haspopup="true"
          aria-expanded={activeHeroFilter === menuKey}
          onClick={() => setActiveHeroFilter((current) => current === menuKey ? null : menuKey)}
        >
          <strong>{summary}</strong>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
        {activeHeroFilter === menuKey ? (
          <div className={styles.gearTypeMultiMenu} aria-label={`Valitse: ${label}`}>
            <button type="button" role="checkbox" aria-checked={selectedCount === 0} onClick={onClear}>
              <span aria-hidden="true">{selectedCount === 0 ? <Check size={14} /> : null}</span>
              {allLabel}
            </button>
            {options.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <button key={option} type="button" role="checkbox" aria-checked={isSelected} onClick={() => onToggle(option)}>
                  <span aria-hidden="true">{isSelected ? <Check size={14} /> : null}</span>
                  {option}
                </button>
              );
            })}
            <label className={styles.gearTypeMultiCustom}>
              <span>Muu</span>
              <input value={customValue} placeholder={customPlaceholder} onChange={(event) => onCustomChange(event.target.value)} />
            </label>
          </div>
        ) : null}
      </div>
    );
  }

  function renderRidingGearFilters(layout: "mobile" | "desktop") {
    if (!isGearMarketplace) return null;
    const prefix = `${layout}-gear`;
    const gearTypeMenuKey = `${prefix}-type-menu`;
    const gearTypeSummary = gearTypeQuery.length === 0
      ? "Kaikki ajovarusteet"
      : gearTypeQuery.length === 1
        ? gearTypeQuery[0]
        : `${gearTypeQuery.length} valittu`;
    return (
      <section className={`${styles.vehicleUsageFilters} ${styles.ridingGearFilters}`} aria-label="Ajovarusteiden suodattimet">
        <span className={styles.vehicleUsageSectionLabel}>Ajovarusteen tiedot</span>
        <div className={`${styles.vehicleUsageField} ${styles.gearTypeMultiField}`}>
          <span>Varustetyyppi</span>
          <button
            id={`${prefix}-type`}
            type="button"
            className={styles.gearTypeMultiButton}
            aria-haspopup="true"
            aria-expanded={activeHeroFilter === gearTypeMenuKey}
            onClick={() => setActiveHeroFilter((current) => current === gearTypeMenuKey ? null : gearTypeMenuKey)}
          >
            <strong>{gearTypeSummary}</strong>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {activeHeroFilter === gearTypeMenuKey ? (
            <div className={styles.gearTypeMultiMenu} aria-label="Valitse ajovarustetyypit">
              <button type="button" role="checkbox" aria-checked={gearTypeQuery.length === 0} onClick={() => setGearTypeQuery([])}>
                <span aria-hidden="true">{gearTypeQuery.length === 0 ? <Check size={14} /> : null}</span>
                Kaikki ajovarusteet
              </button>
              {RIDING_GEAR_TYPE_OPTIONS.map((option) => {
                const selected = gearTypeQuery.includes(option);
                return (
                  <button key={option} type="button" role="checkbox" aria-checked={selected} onClick={() => toggleGearType(option)}>
                    <span aria-hidden="true">{selected ? <Check size={14} /> : null}</span>
                    {option}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {renderGearOptionPicker({
          menuKey: `${prefix}-brand-menu`,
          label: "Merkki",
          allLabel: "Kaikki merkit",
          options: RIDING_GEAR_BRAND_OPTIONS,
          selected: gearBrandOptionsQuery,
          onToggle: toggleGearBrandOption,
          onClear: () => { setGearBrandOptionsQuery([]); setGearBrandQuery(""); },
          customValue: gearBrandQuery,
          onCustomChange: setGearBrandQuery,
          customPlaceholder: "Kirjoita muu merkki"
        })}
        {renderGearOptionPicker({
          menuKey: `${prefix}-size-menu`,
          label: "Koko",
          allLabel: "Kaikki koot",
          options: RIDING_GEAR_SIZE_OPTIONS,
          selected: gearSizeOptionsQuery,
          onToggle: toggleGearSizeOption,
          onClear: () => { setGearSizeOptionsQuery([]); setGearSizeQuery(""); },
          customValue: gearSizeQuery,
          onCustomChange: setGearSizeQuery,
          customPlaceholder: "Kirjoita muu koko"
        })}
        <label className={styles.vehicleUsageField} htmlFor={`${prefix}-target`}>
          <span>Kohderyhmä</span>
          <span className={styles.vehicleUsageSelectShell}>
            <select id={`${prefix}-target`} value={gearTargetQuery} onChange={(event) => setGearTargetQuery(event.target.value)}>
              <option value="">Ei väliä</option>
              {RIDING_GEAR_TARGET_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </label>
        <label className={styles.vehicleUsageField} htmlFor={`${prefix}-condition`}>
          <span>Kunto</span>
          <span className={styles.vehicleUsageSelectShell}>
            <select id={`${prefix}-condition`} value={gearConditionQuery} onChange={(event) => setGearConditionQuery(event.target.value)}>
              <option value="">Kaikki kuntoluokat</option>
              {RIDING_GEAR_CONDITION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </label>
      </section>
    );
  }

  function renderSellerTypeFilter(layout: "mobile" | "desktop") {
    const fieldId = `${layout}-seller-type`;
    const options: Array<{ value: SellerTypeFilter; label: string }> = [
      { value: "", label: "Kaikki myyjät" },
      { value: "company", label: "Yritys" },
      { value: "private", label: "Yksityinen myyjä" },
      { value: "verified-company", label: "Vahvistettu yritys" },
    ];

    if (layout === "desktop") {
      const menuKey = "desktopSellerType";
      const selectedLabel = options.find((option) => option.value === sellerType)?.label ?? "Kaikki myyjät";
      return (
        <section className={styles.vehicleUsageFilters} aria-label="Myyjän suodatin">
          <span className={styles.vehicleUsageSectionLabel}>Myyjä</span>
          <div className={styles.heroFilterFieldWrap} data-no-auto-translate translate="no">
            <span className={styles.heroFilterLabel}>Myyjä</span>
            <button
              type="button"
              className={styles.heroFilterSelect}
              aria-expanded={activeHeroFilter === menuKey}
              onClick={() => setActiveHeroFilter((current) => current === menuKey ? null : menuKey)}
            >
              <strong>{selectedLabel}</strong>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {activeHeroFilter === menuKey ? <div className={styles.heroFilterMenu}>
              {options.map((option) => <button
                key={option.value || "all"}
                type="button"
                className={styles.heroFilterMenuOption}
                onClick={() => {
                  setSellerType(option.value);
                  setActiveHeroFilter(null);
                }}
              >{option.label}</button>)}
            </div> : null}
          </div>
        </section>
      );
    }

    return (
      <section className={styles.vehicleUsageFilters} aria-label="Myyjän suodatin">
        <span className={styles.vehicleUsageSectionLabel}>Myyjä</span>
        <label className={styles.vehicleUsageField} htmlFor={fieldId}>
          <span>Myyjätyyppi</span>
          <span className={styles.vehicleUsageSelectShell}>
            <select
              id={fieldId}
              data-home-seller-select={layout}
              value={sellerType}
              onChange={(event) => setSellerType(event.target.value as SellerTypeFilter)}
            >
              {options.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </label>
      </section>
    );
  }

  function renderMarketplaceModeSwitch(layout: "mobile" | "desktop") {
    return (
      <section
        className={styles.marketplaceRailSwitch}
        data-marketplace-switch-layout={layout}
        aria-label="Valitse markkinapaikka"
      >
        <div className={`${styles.marketplaceModeTabs} home-marketplace-mode-tabs`} role="tablist" aria-label="Ilmoitustyyppi">
          <button
            type="button"
            role="tab"
            aria-selected={marketplaceMode === "parts"}
            className={`home-marketplace-mode-tab${marketplaceMode === "parts" ? ` ${styles.marketplaceModeTabActive} is-active` : ""}`}
            onClick={() => selectMarketplaceMode("parts")}
          >
            Varaosat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isVehicleMarketplace}
            className={`home-marketplace-mode-tab${isVehicleMarketplace ? ` ${styles.marketplaceModeTabActive} is-active` : ""}`}
            onClick={() => selectMarketplaceMode("vehicles")}
          >
            Ajoneuvot
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isGearMarketplace}
            className={`home-marketplace-mode-tab${isGearMarketplace ? ` ${styles.marketplaceModeTabActive} is-active` : ""}`}
            onClick={() => selectMarketplaceMode("gear")}
          >
            Ajovarusteet
          </button>
        </div>
      </section>
    );
  }

  function renderDesktopAllFilters() {
    const fieldByKey = (key: string) => heroFilterFields.find((field) => field.key === key);
    const vehicleTypeField = fieldByKey("vehicleType");
    const vehicleSubtypeField = fieldByKey("vehicleSubtype");
    const brandField = fieldByKey("brand");
    const modelField = fieldByKey("model");
    const engineCcField = fieldByKey("engineCc");
    const engineModelField = fieldByKey("engineModel");
    const categoryField = fieldByKey("category");
    const subcategoryField = fieldByKey("subcategory");
    const detailCategoryField = fieldByKey("detailSubcategory");
    const isOtherPartsFilter = marketplaceMode === "parts" && category === "Muut ajoneuvon osat";
    const tabs = isGearMarketplace
      ? [
          { id: "basic", label: "Ajovarustetyyppi" },
          { id: "technical", label: "Koko ja kunto" },
          { id: "colors", label: "Värit" },
          { id: "other", label: "Sijainti ja hinta" }
        ]
      : isVehicleMarketplace
        ? [
            { id: "basic", label: "Perustiedot" },
            { id: "technical", label: "Tekniikka" },
             { id: "equipment", label: "Varusteet" },
             { id: "colors", label: "Värit" },
             { id: "other", label: "Sijainti ja hinta" }
          ]
         : [
             { id: "basic", label: isOtherPartsFilter ? "Tuotetiedot" : "Sopivuus" },
             { id: "equipment", label: isOtherPartsFilter ? "Osaryhmät" : "Varaosaryhmät" },
             { id: "technical", label: "Mitat ja tekniikka" },
             { id: "other", label: "Sijainti ja hinta" }
          ];
    const desktopLocationSelectionCount = locationSelection.countries.length
      + locationSelection.regions.length
      + locationSelection.municipalities.length;
    const renderSelect = (field: (typeof heroFilterFields)[number] | undefined, label?: string) => {
      if (!field) return null;
      const selectedValue = field.options.find((option) => option.label === field.value)?.value ?? "";
      return (
        <label className={styles.desktopFullField} key={field.key}>
          <span>{label ?? field.label}</span>
          <select value={selectedValue} onChange={(event) => field.onSelect(event.target.value)}>
            {field.options.map((option) => <option key={`${field.key}-${option.value || "all"}`} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      );
    };
    const renderDesktopRangeField = ({
      label,
      minValue,
      maxValue,
      minimum = 0,
      maximum,
      step,
      onMinChange,
      onMaxChange,
      wide = false
    }: {
      label: string;
      minValue: string;
      maxValue: string;
      minimum?: number;
      maximum: number;
      step: number;
      onMinChange: (value: string) => void;
      onMaxChange: (value: string) => void;
      wide?: boolean;
    }) => (
      <label className={`${styles.desktopFullField} ${styles.desktopFullRangeField}${wide ? ` ${styles.desktopFullRangeWide}` : ""}`}>
        <span>{label}</span>
        <div className={styles.vehicleUsageRange}>
          <input
            inputMode="numeric"
            value={minValue}
            placeholder="Minimi"
            aria-label={`${label}, minimiarvo`}
            onChange={(event) => onMinChange(event.target.value.replace(/\D/g, ""))}
          />
          <i aria-hidden="true">–</i>
          <input
            inputMode="numeric"
            value={maxValue}
            placeholder="Maksimi"
            aria-label={`${label}, maksimiarvo`}
            onChange={(event) => onMaxChange(event.target.value.replace(/\D/g, ""))}
          />
        </div>
        {renderNumericRangeSlider({ label, minValue, maxValue, minimum, maximum, step, onMinChange, onMaxChange })}
      </label>
    );
    const renderCategoryStep = ({
      number,
      title,
      description,
      field,
      enabled,
      disabledLabel
    }: {
      number: number;
      title: string;
      description: string;
      field: (typeof heroFilterFields)[number] | undefined;
      enabled: boolean;
      disabledLabel: string;
    }) => {
      const selectedValue = enabled && field
        ? field.options.find((option) => option.label === field.value)?.value ?? ""
        : "";
      return (
        <div className={styles.desktopCategoryStep} data-enabled={enabled ? "true" : "false"}>
          <header>
            <span>{number}</span>
            <div><strong>{title}</strong><small>{description}</small></div>
          </header>
          <select
            aria-label={title}
            disabled={!enabled || !field}
            value={selectedValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              field?.onSelect(nextValue);
              if (!isTrackMatSelection(nextValue)) return;
              window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                  document.querySelector<HTMLElement>("[data-desktop-track-mat-card]")?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                  });
                });
              });
            }}
          >
            {!enabled || !field
              ? <option value="">{disabledLabel}</option>
              : field.options.map((option) => <option key={`${field.key}-${option.value || "all"}`} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      );
    };
    const scrollToTab = (id: string) => {
      setDesktopFilterTab(id);
      const container = document.querySelector<HTMLElement>("[data-desktop-full-filter-scroll]");
      const section = document.getElementById(`desktop-full-filter-${id}`);
      if (!container || !section) return;
      const nextTop = container.scrollTop + section.getBoundingClientRect().top - container.getBoundingClientRect().top;
      const maximumTop = Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollTo({ top: Math.min(maximumTop, Math.max(0, nextTop)), behavior: "auto" });
    };
    const toggleFeature = (value: string) => {
      setVehicleAccessoriesQuery((current) => current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]);
    };
    const selectFullMarketplace = (kind: "parts" | "vehicles" | "gear" | "other-parts") => {
      setDesktopFilterTab("basic");
      setActiveHeroFilter(null);
      document.querySelector<HTMLElement>("[data-desktop-full-filter-scroll]")?.scrollTo({ top: 0, behavior: "auto" });
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>("[data-desktop-full-filter-scroll]")?.scrollTo({ top: 0, behavior: "auto" });
      });
      if (kind === "other-parts") {
        if (marketplaceMode !== "parts") selectMarketplaceMode("parts");
        setCategory("Muut ajoneuvon osat");
        setSubcategory("");
        return;
      }
      if (marketplaceMode === kind) {
        setCategory("");
        setSubcategory("");
        return;
      }
      selectMarketplaceMode(kind);
    };
    const marketplaceChoices = [
      { id: "parts", title: "Varaosat", description: "Ajoneuvokohtaiset osat" },
      { id: "vehicles", title: "Ajoneuvot", description: "Kokonaiset ajoneuvot" },
      { id: "gear", title: "Ajovarusteet", description: "Kypärät, puvut ja suojat" },
      { id: "other-parts", title: "Muut osat", description: "Ilman tarkkaa kategoriaa" }
    ] as const;
    const selectedMarketplaceTitle = isOtherPartsFilter
      ? "Muut ajoneuvon osat"
      : isGearMarketplace
        ? "Ajovarusteet"
        : isVehicleMarketplace
          ? "Ajoneuvot"
          : "Varaosat";

    return (
      <div className={styles.desktopFullFilterPanel} role="dialog" aria-modal="true" aria-labelledby="desktop-all-filters-title">
        <header className={styles.desktopFullFilterTopbar}>
          <div className={styles.desktopFullHeading}>
            <strong>Kaikki hakuehdot</strong>
            <small>{selectedMarketplaceTitle} · rajaa hakua Maskines-tiedoilla</small>
          </div>
          <button
            type="button"
            className={styles.desktopSaveSearch}
            onClick={saveCurrentDesktopSearch}
          >
            <Bookmark size={17} aria-hidden="true" />
            {desktopSearchSaved ? "Haku tallennettu" : "Tallenna haku"}
          </button>
          <button
            type="button"
            className={styles.desktopFullSearchButton}
            onClick={() => {
              if (applyListingFilters()) setDesktopAllFiltersOpen(false);
            }}
          >
            Hae ({draftListingResultCount.toLocaleString(locale)})
          </button>
          <button type="button" className={styles.desktopFullClose} aria-label="Sulje kaikki hakuehdot" onClick={() => setDesktopAllFiltersOpen(false)}>
            <X size={25} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.desktopFullUtilityRow}>
          <div>
            <button
              type="button"
              aria-expanded={savedSearchesOpen}
              onClick={() => setSavedSearchesOpen((current) => !current)}
            >
              Tallennetut haut{savedSearches.length > 0 ? ` (${savedSearches.length})` : ""}
            </button>
          </div>
          <button type="button" onClick={clearListingFilters}>Tyhjennä</button>
        </div>

        {savedSearchesOpen ? (
          <section className={styles.desktopSavedSearchesPanel} aria-label="Tallennetut haut">
            <header>
              <div>
                <strong>Tallennetut haut</strong>
                <small>Haut säilyvät tällä laitteella myös selaimen sulkemisen jälkeen.</small>
              </div>
              <button type="button" aria-label="Sulje tallennetut haut" onClick={() => setSavedSearchesOpen(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            {savedSearches.length > 0 ? (
              <div className={styles.desktopSavedSearchList}>
                {savedSearches.map((savedSearch) => (
                  <article key={savedSearch.id} className={styles.desktopSavedSearchItem}>
                    <div>
                      <strong>{savedSearch.name}</strong>
                      <small>{new Date(savedSearch.createdAt).toLocaleString(locale)}</small>
                    </div>
                    <button type="button" onClick={() => restoreSavedSearch(savedSearch)}>Käytä hakua</button>
                    <button type="button" onClick={() => removeSavedSearch(savedSearch.id)}>Poista</button>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.desktopSavedSearchEmpty}>Ei tallennettuja hakuja vielä. Tee rajaus ja paina “Tallenna haku”.</p>
            )}
          </section>
        ) : null}

        <section className={styles.desktopMarketplaceChooser} aria-label="Valitse Maskines-osasto">
          <span>Mitä etsit?</span>
          <div>
            {marketplaceChoices.map((choice) => {
              const active = choice.id === "other-parts"
                ? isOtherPartsFilter
                : !isOtherPartsFilter && marketplaceMode === choice.id;
              return (
                <button key={choice.id} type="button" className={active ? styles.desktopMarketplaceChoiceActive : ""} onClick={() => selectFullMarketplace(choice.id)}>
                  <strong>{choice.title}</strong>
                  <small>{choice.description}</small>
                </button>
              );
            })}
          </div>
        </section>

        <nav className={styles.desktopFullTabs} aria-label="Hakuehtojen osiot">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={desktopFilterTab === tab.id ? styles.desktopFullTabActive : ""} onClick={() => scrollToTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <div
          className={styles.desktopFullFilterScroll}
          data-desktop-full-filter-scroll
          onScroll={(event) => {
            const container = event.currentTarget;
            const sections = tabs
              .map((tab) => ({ id: tab.id, element: document.getElementById(`desktop-full-filter-${tab.id}`) }))
              .filter((item): item is { id: string; element: HTMLElement } => Boolean(item.element));
            const containerTop = container.getBoundingClientRect().top;
            const visibleSection = sections.reduce((current, item) =>
              item.element.getBoundingClientRect().top <= containerTop + 90 ? item.id : current,
            sections[0]?.id ?? "basic");
            if (visibleSection !== desktopFilterTab) setDesktopFilterTab(visibleSection);
          }}
        >
          <section id="desktop-full-filter-basic" className={styles.desktopFullSection} style={{ order: 1 }}>
            <header><h2 id="desktop-all-filters-title">{isGearMarketplace ? "Ajovarusteet" : isVehicleMarketplace ? "Ajoneuvon perustiedot" : isOtherPartsFilter ? "Muut ajoneuvon osat" : "Varaosan sopivuus"}</h2><ChevronUp size={20} aria-hidden="true" /></header>
            {isOtherPartsFilter ? (
              <div className={styles.desktopFullBox}>
                <h3>Tuote ilman tarkkaa osakategoriaa</h3>
                <p className={styles.desktopOtherPartsCopy}>Käytä tätä hakua sellaisille ajoneuvon osille ja tarvikkeille, joille ei löydy sopivaa tarkkaa Maskines-kategoriaa.</p>
                <label className={styles.desktopFullField}><span>Hae tuotteen nimellä tai kuvauksella</span><input value={query} placeholder="Esim. yleismallinen kiinnike" onChange={(event) => setQuery(event.target.value)} /></label>
              </div>
            ) : isGearMarketplace ? (
              <div className={styles.desktopFullBox}>
                <h3>Ajovarusteen tyyppi</h3>
                <div className={styles.desktopCheckboxGrid}>
                  <label className={styles.desktopAnyOption}>
                    <input type="checkbox" checked={gearTypeQuery.length === 0} onChange={() => setGearTypeQuery([])} />
                    <span aria-hidden="true">{gearTypeQuery.length === 0 ? <Check size={15} /> : null}</span>Kaikki ajovarusteet
                  </label>
                  {RIDING_GEAR_TYPE_OPTIONS.map((option) => (
                    <label key={option}>
                      <input type="checkbox" checked={gearTypeQuery.includes(option)} onChange={() => toggleGearType(option)} />
                      <span aria-hidden="true">{gearTypeQuery.includes(option) ? <Check size={15} /> : null}</span>{option}
                    </label>
                  ))}
                </div>
              </div>
             ) : (
               <>
                 <div className={styles.desktopFullBox}>
                   <h3>{isVehicleMarketplace ? "Ajoneuvolaji" : "Sopivuus ajoneuvoon"}</h3>
                   <div className={styles.desktopFullFieldGrid}>
                     {renderSelect(vehicleTypeField, "Ajoneuvolaji")}
                   </div>
                 </div>
                <div className={styles.desktopFullBox}>
                  <h3>{isVehicleMarketplace ? "Ajoneuvon tyyppi" : "Ajoneuvotyypin tarkennus"}</h3>
                  <div className={styles.desktopFullFieldGrid}>
                    {renderSelect(vehicleSubtypeField)}
                  </div>
                </div>
              </>
            )}
          </section>

          <section
            id="desktop-full-filter-technical"
            className={styles.desktopFullSection}
            style={{ order: !isGearMarketplace && !isVehicleMarketplace ? 3 : 2 }}
          >
            <header><h2>{isGearMarketplace ? "Koko ja kunto" : isVehicleMarketplace ? "Ajoneuvon tekniikka" : isOtherPartsFilter ? "Tuotteen lisätiedot" : "Mitat ja tekniset tiedot"}</h2><ChevronUp size={20} aria-hidden="true" /></header>
            <div className={styles.desktopFullBox}>
              <div className={styles.desktopFullFieldGrid}>
                {isOtherPartsFilter ? (
                  <>
                    <label className={styles.desktopFullField}><span>Tuotteen merkki tai valmistaja</span><input value={gearBrandQuery} placeholder="Kirjoita jos tiedossa" onChange={(event) => setGearBrandQuery(event.target.value)} /></label>
                    <label className={styles.desktopFullField}><span>Koko tai mitta</span><input value={gearSizeQuery} placeholder="Esim. 42 mm tai 30 x 20 cm" onChange={(event) => setGearSizeQuery(event.target.value)} /></label>
                    <label className={styles.desktopFullField}><span>Kunto</span><select value={gearConditionQuery} onChange={(event) => setGearConditionQuery(event.target.value)}><option value="">Ei väliä</option>{RIDING_GEAR_CONDITION_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
                  </>
                ) : isGearMarketplace ? (
                  <>
                    {renderGearOptionPicker({
                      menuKey: "desktop-full-gear-brand-menu",
                      label: "Merkki",
                      allLabel: "Kaikki merkit",
                      options: RIDING_GEAR_BRAND_OPTIONS,
                      selected: gearBrandOptionsQuery,
                      onToggle: toggleGearBrandOption,
                      onClear: () => { setGearBrandOptionsQuery([]); setGearBrandQuery(""); },
                      customValue: gearBrandQuery,
                      onCustomChange: setGearBrandQuery,
                      customPlaceholder: "Kirjoita muu merkki"
                    })}
                    {renderGearOptionPicker({
                      menuKey: "desktop-full-gear-size-menu",
                      label: "Koko",
                      allLabel: "Kaikki koot",
                      options: RIDING_GEAR_SIZE_OPTIONS,
                      selected: gearSizeOptionsQuery,
                      onToggle: toggleGearSizeOption,
                      onClear: () => { setGearSizeOptionsQuery([]); setGearSizeQuery(""); },
                      customValue: gearSizeQuery,
                      onCustomChange: setGearSizeQuery,
                      customPlaceholder: "Kirjoita muu koko"
                    })}
                    <label className={styles.desktopFullField}><span>Kohderyhmä</span><select value={gearTargetQuery} onChange={(event) => setGearTargetQuery(event.target.value)}><option value="">Ei väliä</option>{RIDING_GEAR_TARGET_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
                    <label className={styles.desktopFullField}><span>Kunto</span><select value={gearConditionQuery} onChange={(event) => setGearConditionQuery(event.target.value)}><option value="">Ei väliä</option>{RIDING_GEAR_CONDITION_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
                  </>
                ) : (
                  <>{renderSelect(brandField)}{renderSelect(modelField)}{renderSelect(engineCcField)}{renderSelect(engineModelField)}</>
                )}
                {!isOtherPartsFilter ? renderDesktopRangeField({
                  label: "Vuosimalli",
                  minValue: yearMinQuery,
                  maxValue: yearMaxQuery,
                  minimum: YEAR_FILTER_MIN,
                  maximum: YEAR_FILTER_MAX,
                  step: 1,
                  wide: true,
                  onMinChange: (value) => {
                    const raw = value.slice(0, 4);
                    const next = raw.length === 4 ? Math.min(Number(raw), Number(yearMaxQuery || YEAR_FILTER_MAX)) : null;
                    setYearMinQuery(next === null ? raw : next > YEAR_FILTER_MIN ? String(next) : "");
                    setYearQuery("");
                  },
                  onMaxChange: (value) => {
                    const raw = value.slice(0, 4);
                    const next = raw.length === 4 ? Math.max(Number(raw), Number(yearMinQuery || YEAR_FILTER_MIN)) : null;
                    setYearMaxQuery(next === null ? raw : next < YEAR_FILTER_MAX ? String(next) : "");
                    setYearQuery("");
                  }
                }) : null}
                {isVehicleMarketplace ? <>
                  <label className={styles.desktopFullField}>
                    <span>Moottorin tyyppi</span>
                    <select value={vehicleEngineKindQuery} onChange={(event) => setVehicleEngineKindQuery(event.target.value)}>
                      <option value="">Ei väliä</option>
                      {VEHICLE_ENGINE_KIND_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className={styles.desktopFullField}>
                    <span>Vetotapa</span>
                    <select value={vehicleDriveTypeQuery} onChange={(event) => setVehicleDriveTypeQuery(event.target.value)}>
                      <option value="">Ei väliä</option>
                      {VEHICLE_DRIVE_TYPE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className={styles.desktopFullField}>
                    <span>Tieliikennekelpoisuus</span>
                    <select value={vehicleRoadLegalQuery} onChange={(event) => setVehicleRoadLegalQuery(event.target.value)}>
                      <option value="">Ei väliä</option>
                      {VEHICLE_ROAD_LEGAL_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className={styles.desktopFullField}>
                    <span>Rekisteritunnus</span>
                    <input value={vehicleRegistrationQuery} placeholder="Esim. 123-ABC" autoCapitalize="characters" onChange={(event) => setVehicleRegistrationQuery(event.target.value.toUpperCase())} />
                  </label>
                  {renderDesktopRangeField({
                    label: "Ajokilometrit (km)",
                    minValue: vehicleMileageMinQuery,
                    maxValue: vehicleMileageMaxQuery,
                    maximum: VEHICLE_MILEAGE_FILTER_MAX,
                    step: 1000,
                    onMinChange: (value) => {
                      const next = value ? Math.min(Number(value), Number(vehicleMileageMaxQuery || VEHICLE_MILEAGE_FILTER_MAX)) : 0;
                      setVehicleMileageMinQuery(next ? String(next) : "");
                    },
                    onMaxChange: (value) => {
                      const next = value ? Math.max(Number(value), Number(vehicleMileageMinQuery || 0)) : VEHICLE_MILEAGE_FILTER_MAX;
                      setVehicleMileageMaxQuery(next < VEHICLE_MILEAGE_FILTER_MAX ? String(next) : "");
                    }
                  })}
                  {renderDesktopRangeField({
                    label: "Käyttötunnit (h)",
                    minValue: vehicleHoursMinQuery,
                    maxValue: vehicleHoursMaxQuery,
                    maximum: VEHICLE_HOURS_FILTER_MAX,
                    step: 50,
                    onMinChange: (value) => {
                      const next = value ? Math.min(Number(value), Number(vehicleHoursMaxQuery || VEHICLE_HOURS_FILTER_MAX)) : 0;
                      setVehicleHoursMinQuery(next ? String(next) : "");
                    },
                    onMaxChange: (value) => {
                      const next = value ? Math.max(Number(value), Number(vehicleHoursMinQuery || 0)) : VEHICLE_HOURS_FILTER_MAX;
                      setVehicleHoursMaxQuery(next < VEHICLE_HOURS_FILTER_MAX ? String(next) : "");
                    }
                  })}
                </> : null}
              </div>
            </div>
          </section>

          {!isGearMarketplace ? <section
            id="desktop-full-filter-equipment"
            className={styles.desktopFullSection}
            style={{ order: !isVehicleMarketplace ? 2 : 3 }}
          >
            <header><h2>{isVehicleMarketplace ? "Ajoneuvon varusteet" : "Varaosaryhmät"}</h2><ChevronUp size={20} aria-hidden="true" /></header>
            <div className={styles.desktopFullBox}>
              {isOtherPartsFilter ? (
                <p className={styles.desktopOtherPartsCopy}>Tässä osastossa tarkkaa osaryhmää ei tarvitse valita. Haku käyttää tuotteen nimeä, kuvausta, merkkiä ja muita lisäämiäsi tietoja.</p>
              ) : !isGearMarketplace && !isVehicleMarketplace ? (
                <>
                  <div className={styles.desktopCategoryFlow}>
                    {renderCategoryStep({ number: 1, title: "Pääkategoria", description: "Valitse varaosan pääryhmä", field: categoryField, enabled: true, disabledLabel: "Valitse pääkategoria" })}
                    <ChevronRight className={styles.desktopCategoryArrow} size={22} aria-hidden="true" />
                    {renderCategoryStep({ number: 2, title: "Alakategoria", description: "Tarkenna valittua pääryhmää", field: subcategoryField, enabled: Boolean(category), disabledLabel: "Valitse ensin pääkategoria" })}
                    <ChevronRight className={styles.desktopCategoryArrow} size={22} aria-hidden="true" />
                    {renderCategoryStep({ number: 3, title: "Tarkempi osa", description: "Valitse tarkin sopiva osaryhmä", field: detailCategoryField, enabled: Boolean(category && subcategory), disabledLabel: "Valitse ensin alakategoria" })}
                  </div>
                  {trackMatDimensionFieldVisible ? (
                    <section className={styles.desktopTrackMatCard} data-desktop-track-mat-card aria-labelledby="desktop-track-mat-title">
                      <header>
                        <strong id="desktop-track-mat-title">Telamaton mitat</strong>
                        <small>Valitse pituus, leveys ja jako, jotta löydät yhteensopivat telamatot.</small>
                      </header>
                      <div className={styles.desktopTrackMatFullFields}>
                        {trackMatDimensionFields.map((field) => (
                          <label className={styles.desktopFullField} key={`desktop-full-${field.key}`}>
                            <span>{field.label}</span>
                            <select value={field.value} onChange={(event) => field.onSelect(event.target.value)}>
                              <option value="">{field.placeholder}</option>
                              {field.options.map((option) => (
                                <option key={`${field.key}-${option.value}`} value={option.value}>{option.label}</option>
                              ))}
                              <option value={CUSTOM_TRACK_MAT_DIMENSION_VALUE}>Muu mitta</option>
                            </select>
                            {field.value === CUSTOM_TRACK_MAT_DIMENSION_VALUE ? (
                              <input
                                value={field.customValue}
                                placeholder={field.customPlaceholder}
                                aria-label={`Muu ${field.label.toLowerCase()}`}
                                onChange={(event) => field.onCustomChange(event.target.value)}
                                onBlur={field.onCustomCommit}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter") return;
                                  event.preventDefault();
                                  field.onCustomCommit();
                                }}
                              />
                            ) : null}
                          </label>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : <div className={styles.desktopCheckboxGrid}>
                {isVehicleMarketplace ? VEHICLE_ACCESSORY_OPTIONS.map((option) => {
                  const selected = vehicleAccessoriesQuery.includes(option);
                  return <label key={option}><input type="checkbox" checked={selected} onChange={() => toggleFeature(option)} /><span aria-hidden="true">{selected ? <Check size={15} /> : null}</span>{option}</label>;
                }) : categoryField?.options.filter((option) => option.value).map((option) => {
                  const selected = category === option.value;
                  return <label key={option.value}><input type="checkbox" checked={selected} onChange={() => { setCategory(selected ? "" : option.value); setSubcategory(""); }} /><span aria-hidden="true">{selected ? <Check size={15} /> : null}</span>{option.label}</label>;
                })}
              </div>}
            </div>
          </section> : null}

          {(isVehicleMarketplace || isGearMarketplace) ? <section id="desktop-full-filter-colors" className={styles.desktopFullSection} style={{ order: 4 }}>
            <header><h2>Värisävy</h2><ChevronUp size={20} aria-hidden="true" /></header>
            <div className={`${styles.desktopFullBox} ${styles.desktopColorOptions}`}>
              {VEHICLE_COLOR_OPTIONS.map((color) => {
                const selected = vehicleColorsQuery.includes(color.label);
                return <label key={color.label}><input type="checkbox" checked={selected} onChange={() => setVehicleColorsQuery((current) => selected ? current.filter((item) => item !== color.label) : [...current, color.label])} /><span style={{ background: color.swatch }} aria-hidden="true" />{color.label}</label>;
              })}
            </div>
          </section> : null}

          <section id="desktop-full-filter-other" className={styles.desktopFullSection} style={{ order: 5 }}>
            <header><h2>Sijainti, myyjä ja hinta</h2><ChevronUp size={20} aria-hidden="true" /></header>
            <div className={`${styles.desktopFullBox} ${styles.desktopLocationBox} ${activeHeroFilter === "desktopFullLocation" ? styles.desktopLocationBoxOpen : ""}`}>
              <div className={styles.desktopLocationIntro}>
                <div>
                  <strong>Rajaa alue tarkasti</strong>
                  <small>Valitse maa, lääni tai kunta. Voit valita useita sijainteja samaan hakuun.</small>
                </div>
                {desktopLocationSelectionCount > 0 ? <span>{desktopLocationSelectionCount} valittu</span> : null}
              </div>
              <div className={styles.desktopLocationSecondaryGrid}>
                <div className={styles.desktopFullLocationField}>
                  <LocationMultiSelectField
                    label={locationFilterCopy.location}
                    placeholder={locationFilterCopy.allLocations}
                    searchPlaceholder={locationFilterCopy.searchPlaceholder}
                    options={locationFilterOptions}
                    selected={[...locationSelection.countries.map((value) => `country:${value}`), ...locationSelection.regions.map((value) => `region:${value}`), ...locationSelection.municipalities.map((value) => `municipality:${value}`)]}
                    open={activeHeroFilter === "desktopFullLocation"}
                    onToggleOpen={() => {
                      const willOpen = activeHeroFilter !== "desktopFullLocation";
                      setActiveHeroFilter((current) => current === "desktopFullLocation" ? null : "desktopFullLocation");
                      if (willOpen) {
                        window.requestAnimationFrame(() => scrollToTab("other"));
                      }
                    }}
                    onToggle={toggleLocationFilterValue}
                    onClear={() => updateLocationSelection({ countries: [], regions: [], municipalities: [] })}
                    onDone={() => setActiveHeroFilter(null)}
                    selectedCountLabel={locationFilterCopy.selectedCount}
                    emptyLabel={locationFilterCopy.noResults}
                    clearLabel={locationFilterCopy.clearSelections}
                    doneLabel="Valmis"
                  />
                </div>
                <label className={styles.desktopFullField} htmlFor="desktop-full-seller-type">
                  <span>Myyjä</span>
                  <select
                    id="desktop-full-seller-type"
                    value={sellerType}
                    onChange={(event) => setSellerType(event.target.value as SellerTypeFilter)}
                  >
                    <option value="">Kaikki myyjät</option>
                    <option value="company">Yritys</option>
                    <option value="private">Yksityinen myyjä</option>
                    <option value="verified-company">Vahvistettu yritys</option>
                  </select>
                </label>
                {renderDesktopRangeField({
                  label: "Hintaväli (€)",
                  minValue: minPrice ? String(minPrice) : "",
                  maxValue: maxPrice === VEHICLE_PRICE_FILTER_MAX ? "" : String(maxPrice),
                  maximum: VEHICLE_PRICE_FILTER_MAX,
                  step: 500,
                  onMinChange: (value) => setMinPrice(Math.min(Number(value || 0), maxPrice)),
                  onMaxChange: (value) => setMaxPrice(Math.max(Number(value || VEHICLE_PRICE_FILTER_MAX), minPrice))
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const startMobileFilterDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    mobileFilterDragStartRef.current = event.clientY;
    setMobileFilterDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveMobileFilterDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const startY = mobileFilterDragStartRef.current;
    if (startY === null) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.clientY - startY;
    setMobileFilterDragOffset(Math.max(-100, Math.min(180, delta)));
  };

  const finishMobileFilterDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const startY = mobileFilterDragStartRef.current;
    if (startY === null) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.clientY - startY;
    mobileFilterDragStartRef.current = null;
    setMobileFilterDragOffset(0);

    if (delta < -42) {
      setMobileFilterExpanded(true);
      return;
    }

    if (delta > 58) {
      if (mobileFilterExpanded) {
        setMobileFilterExpanded(false);
      } else {
        setHomeSearchPanelOpen(false);
      }
    }
  };

  return (
    <main
      data-home-page
      data-home-latest-expanded={homeLatestExpanded ? "true" : "false"}
      data-home-filtered-results={homeLatestExpanded && hasAppliedListingFilters ? "true" : "false"}
      className={styles.shell}
    >
      {!catalogOnlyView ? (
      <>
      <div data-home-background-region className={styles.heroWrap}>
        <div data-home-background-container className={styles.container}>
  <section data-home-hero className={styles.hero} aria-label="Hero">
    <div
      data-home-layout
      className={styles.heroInner}
      style={!homeLatestExpanded && !compactHeroSearch ? { position: "relative" } : undefined}
    >
      <div
        id={
          homeLatestExpanded && hasAppliedListingFilters
            ? "home-filtered-results-column"
            : undefined
        }
        data-home-results-mode={homeLatestExpanded ? "true" : "false"}
        className={
          homeLatestExpanded && hasAppliedListingFilters
            ? `${styles.heroLeadPanel} ${styles.heroLeadPanelFiltered}`
            : styles.heroLeadPanel
        }
      >
              {compactHeroSearch && homeLatestExpanded && hasAppliedListingFilters ? (
                <div data-home-filter-actions className={styles.heroFilteredActions}>
                  <button
                    type="button"
                    className={styles.heroFilteredEdit}
                    onClick={() => {
                      setHomeSearchPanelOpen(true);
                      setMobileFilterExpanded(true);
                    }}
                  >
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    <span>{homeResultsText.editSearch}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.heroFilteredReset}
                    onClick={resetFilteredHomeView}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    <span>{homeResultsText.reset}</span>
                  </button>
                </div>
              ) : null}

              <div
                id={
                  homeLatestExpanded && hasAppliedListingFilters
                    ? "home-filtered-results-list"
                    : undefined
                }
                data-home-results-list
                className={styles.heroDesktopLatest}
              >
                {!hasNoHomeSearchResults ? (
                <div data-home-latest-head className={styles.heroDesktopLatestHead}>
                  <strong className="home-latest-heading">
                    {!homeLatestExpanded
                      ? homeResultsText.latest
                      : homeResultsText.results(filteredListings.length)}
                  </strong>
                  <div data-home-latest-actions className={styles.heroDesktopLatestActions}>
                    {renderSortControl(styles.heroDesktopLatestSort)}
                  </div>
                </div>
                ) : null}
                {hasNoHomeSearchResults ? (
                  <div className={styles.heroNoResults} role="status">
                    <span className={styles.heroNoResultsIcon} aria-hidden="true"><Search /></span>
                    <strong>{homeResultsText.noResults}</strong>
                    <p>{homeResultsText.noResultsHint}</p>
                    <button type="button" onClick={clearListingFilters}>
                      <RotateCcw size={17} aria-hidden="true" />
                      <span>{homeResultsText.resetFilters}</span>
                    </button>
                  </div>
                ) : (
                <div
                  data-home-listing-grid
                  className={`${styles.heroDesktopLatestGrid} ${
                    homeLatestExpanded ? styles.heroDesktopLatestGridExpanded : ""
                  }`}
                >
                  {compactLatestListings.map((listing) => {
                    const listingText = getListingText(listing);
                    const isFavorite = favorites.includes(listing.id);
                    const countryFlag = getCountryFlagFromLocation(listing.location, t.country);
                    return (
                      <article
                        key={listing.id}
                        data-listing-card="true"
                        className={`${styles.card} ${styles.heroDesktopLatestCard}`}
                        role="link"
                        tabIndex={0}
                        aria-label={`${t.openListing} ${listingText.title}`}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest('[data-home-latest-favorite="true"]')) return;
                          openListing(listing);
                        }}
                        onKeyDown={(event) => {
                          if ((event.target as HTMLElement).closest('[data-home-latest-favorite="true"]')) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openListing(listing);
                          }
                        }}
                      >
                        <div className={`${styles.cardImage} ${styles.listingCardImage} ${styles.heroDesktopLatestImage}`} data-listing-card-image="true">
                          <span className={styles.cardImageBlur} aria-hidden="true">
                            <OptimizedListingImage src={listingImageSrc(listing)} alt="" decorative />
                          </span>
                          <Link
                            href={listingPath(listing, locale)}
                            className={styles.listingImageSeoLink}
                            aria-label={`${t.openListing} ${listingImageSeoAlt(listing, listingText.title)}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <OptimizedListingImage
                              src={listingImageSrc(listing)}
                              alt={listingImageSeoAlt(listing, listingText.title)}
                            />
                          </Link>
                          <HomeListingSaleBadge listing={listing} />
                          {!getListingSalePricing(listing).onSale && isListingNew(listing.created_at) ? (
                            <span className={styles.newBadge} aria-label={t.newBadge}>
                              {t.newBadge}
                            </span>
                          ) : null}
                          {canUseFavorites && <button
                            type="button"
                            data-home-latest-favorite="true"
                            data-listing-favorite="true"
                            data-listing-id={listing.id}
                            className={`${styles.favoriteButton} ${styles.heroDesktopFavorite} ${
                              isFavorite ? `${styles.favoriteButtonActive} ${styles.heroDesktopFavoriteActive}` : ""
                            }`}
                            onClick={(event) => toggleFavorite(event, listing.id)}
                            onMouseDown={(event) => {
                              event.stopPropagation();
                            }}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                            }}
                            onPointerUp={(event) => event.stopPropagation()}
                            onTouchStart={(event) => {
                              event.stopPropagation();
                            }}
                            onTouchEnd={(event) => event.stopPropagation()}
                            aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                            aria-pressed={isFavorite}
                          >
                            <Heart
                              data-home-latest-heart
                              size={18}
                              fill={isFavorite ? "currentColor" : "none"}
                              aria-hidden="true"
                            />
                          </button>}
                        </div>
                        <div className={`${styles.cardBody} ${styles.heroDesktopLatestBody}`} data-listing-card-body="true">
                          <ListingSalePrice listing={listing} className={`${styles.cardPrice} ${styles.heroDesktopLatestPrice}`} hideBadge />
                          <VehicleTaxBadges listing={listing} />
                          <h3 className={`${styles.cardTitle} ${styles.heroDesktopLatestTop}`}>{listingText.title}</h3>
                          <ListingVehicleMeta year={listing.year} brand={listing.brand} model={listing.model} compact />
                          <div className={`${styles.cardMetaRow} ${styles.heroDesktopLatestMeta}`} data-home-latest-meta data-listing-card-meta="true">
                            <span className={styles.cardLocationMeta} data-home-latest-location>
                              {countryFlag ? (
                                <img
                                  className={styles.listingCountryFlag}
                                  src={countryFlag.src}
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                />
                              ) : null}
                              {formatLocationWithCountry(listing.location, t.country, locale)}
                            </span>
                            <span className={styles.cardDateMeta} data-home-latest-date>
                              <Clock3 size={14} aria-hidden="true" />
                              {formatDate(listing.created_at)}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                )}
                {hasMoreLatestListings ? (
                  <button
                    type="button"
                    className={styles.latestLoadMore}
                    onClick={() => {
                      if (mobilePagination) {
                        setMobileLatestVisibleCount((current) => current + MOBILE_LISTINGS_INCREMENT);
                        return;
                      }

                      setDesktopLatestVisibleCount((current) => current + DESKTOP_LISTINGS_INCREMENT);
                    }}
                  >
                    <span>{t.showMoreListings}</span>
                    <ChevronDown strokeWidth={3} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            <BodyPortal enabled={(compactHeroSearch && homeSearchPanelOpen) || (!compactHeroSearch && desktopAllFiltersOpen)}>
            {compactHeroSearch && homeSearchPanelOpen ? (
              <button
                type="button"
                className={styles.mobileFilterBackdrop}
                data-mobile-filter-backdrop="true"
                aria-label="Sulje suodatus"
                onClick={() => {
                  setHomeSearchPanelOpen(false);
                  setMobileFilterExpanded(false);
                }}
              />
            ) : null}

            {!compactHeroSearch && desktopAllFiltersOpen ? (
              <button
                type="button"
                className={styles.desktopFilterBackdrop}
                aria-label="Sulje kaikki hakuehdot"
                onClick={() => setDesktopAllFiltersOpen(false)}
              />
            ) : null}

            {(!compactHeroSearch || homeSearchPanelOpen) ? (
<aside
  id={
    homeLatestExpanded && hasAppliedListingFilters
      ? "home-filtered-filter-rail"
      : "home-filter-rail"
  }

  data-home-filter-rail
  data-home-filter-sheet={compactHeroSearch ? "true" : desktopAllFiltersOpen ? "modal" : "false"}
  className={`${styles.heroRightRail} ${styles.heroRightRailOpen} ${compactHeroSearch ? styles.mobileFilterSheet : ""} ${desktopAllFiltersOpen ? styles.desktopFilterModal : ""} ${
                compactHeroSearch && mobileFilterExpanded ? styles.mobileFilterSheetExpanded : ""
              }`}
              style={
                compactHeroSearch
                  ? ({ "--mobile-sheet-offset": `${mobileFilterDragOffset}px` } as CSSProperties)
                  : undefined
              }
            >
              {!compactHeroSearch && desktopAllFiltersOpen ? renderDesktopAllFilters() : null}
              {(!compactHeroSearch || homeSearchPanelOpen) ? (
                <>
                  {!compactHeroSearch && desktopAllFiltersOpen ? (
                    <header className={styles.desktopFilterModalHeader}>
                      <div>
                        <strong>Kaikki hakuehdot</strong>
                        <span>Rajaa hakua tarkasti Maskines-markkinapaikalla</span>
                      </div>
                      <button type="button" aria-label="Sulje kaikki hakuehdot" onClick={() => setDesktopAllFiltersOpen(false)}>
                        <X size={22} aria-hidden="true" />
                      </button>
                    </header>
                  ) : null}
                  {compactHeroSearch ? (
                    <>
                      <div
                        className={styles.mobileFilterDragHandle}
                        onPointerDown={startMobileFilterDrag}
                        onPointerMove={moveMobileFilterDrag}
                        onPointerUp={finishMobileFilterDrag}
                        onPointerCancel={finishMobileFilterDrag}
                      >
                        <span aria-hidden="true" />
                      </div>
                      <div className={styles.mobileFilterSheetHeader}>
                        <strong>Suodata hakua</strong>
          <button
                          type="button"
                          data-location-close="true"
                          aria-label={
                            activeHeroFilter === "mobileLocation"
                              ? "Sulje sijaintivalikko"
                              : "Sulje suodatus"
                          }
                          onClick={() => {
                            if (activeHeroFilter === "mobileLocation") {
                              setActiveHeroFilter(null);
                              return;
                            }
                            setHomeSearchPanelOpen(false);
                            setMobileFilterExpanded(false);
                          }}
                        >
                          <X size={18} strokeWidth={2.8} aria-hidden="true" />
          </button>
        </div>
                      <div
                        ref={mobileSheetFormRef}
                        className={styles.mobileSheetForm}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                      >
                        {renderMarketplaceModeSwitch("mobile")}
                        {renderSellerTypeFilter("mobile")}

                        <section className={styles.heroLocationSection} aria-label="Sijaintisuodatin">
                          <LocationMultiSelectField
                            label={locationFilterCopy.location}
                            placeholder={locationFilterCopy.allLocations}
                            searchPlaceholder={locationFilterCopy.searchPlaceholder}
                            options={locationFilterOptions}
                            selected={[
                              ...locationSelection.countries.map((value) => `country:${value}`),
                              ...locationSelection.regions.map((value) => `region:${value}`),
                              ...locationSelection.municipalities.map((value) => `municipality:${value}`)
                            ]}
                            open={activeHeroFilter === "mobileLocation"}
                            onToggleOpen={() =>
                              setActiveHeroFilter((current) =>
                                current === "mobileLocation" ? null : "mobileLocation"
                              )
                            }
                            onToggle={toggleLocationFilterValue}
                            onClear={() =>
                              updateLocationSelection({
                                countries: [],
                                regions: [],
                                municipalities: []
                              })
                            }
                            onDone={() => setActiveHeroFilter(null)}
                            selectedCountLabel={locationFilterCopy.selectedCount}
                            emptyLabel={locationFilterCopy.noResults}
                            clearLabel={locationFilterCopy.clearSelections}
                            doneLabel={locationFilterCopy.done}
                          />
                        </section>

                        {isVehicleMarketplace ? (
                          <span className={styles.vehicleUsageSectionLabel}>Ajoneuvon perustiedot</span>
                        ) : null}

                        {marketplaceHeroFilterFields.slice(0, 2).map((field) => (
                          <div
                            key={`mobile-${field.key}`}
                            className={styles.mobileSheetField}
                            data-mobile-native-field
                            data-no-auto-translate
                            translate="no"
                          >
                            <span>{field.label}</span>
                            <button
                              type="button"
                              className={styles.mobileSheetSelect}
                              onClick={(event) => toggleMobileHeroFilter(field.key, event.currentTarget.parentElement ?? event.currentTarget)}
                            >
                              <strong>{field.value}</strong>
                              <ChevronDown size={15} aria-hidden="true" />
                            </button>
                            <MobileNativeSelect
                              value={field.options.find((option) => option.label === field.value)?.value ?? ""}
                              label={field.label}
                              options={field.options}
                              onChange={(nextValue) => {
                                field.onSelect(nextValue);
                                setActiveHeroFilter(null);
                              }}
                            />
                            {activeHeroFilter === field.key ? (
                              <div className={styles.mobileSheetMenu} data-mobile-native-menu>
                                {field.options.length ? field.options.map((option) => (
                                  <button
                                    key={`mobile-${field.key}-${option.value || "all"}`}
                                    type="button"
                                    onClick={() => {
                                      field.onSelect(option.value);
                                      if (!(field.key === "detailSubcategory" && isTrackMatSelection(option.value))) {
                                        setActiveHeroFilter(null);
                                      }
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                )) : <span>Ei valintoja</span>}
                              </div>
                            ) : null}
                          </div>
                        ))}

                        {marketplaceHeroFilterFields.slice(2, 4).map((field) => (
                          <div
                            key={`mobile-${field.key}`}
                            className={styles.mobileSheetField}
                            data-mobile-native-field
                            data-no-auto-translate
                            translate="no"
                          >
                            <span>{field.label}</span>
                            <button
                              type="button"
                              className={styles.mobileSheetSelect}
                              onClick={(event) => toggleMobileHeroFilter(field.key, event.currentTarget.parentElement ?? event.currentTarget)}
                            >
                              <strong>{field.value}</strong>
                              <ChevronDown size={15} aria-hidden="true" />
                            </button>
                            <MobileNativeSelect
                              value={field.options.find((option) => option.label === field.value)?.value ?? ""}
                              label={field.label}
                              options={field.options}
                              onChange={(nextValue) => {
                                field.onSelect(nextValue);
                                setActiveHeroFilter(null);
                              }}
                            />
                            {activeHeroFilter === field.key ? (
                              <div className={styles.mobileSheetMenu} data-mobile-native-menu>
                                {field.options.length ? field.options.map((option) => (
                                  <button
                                    key={`mobile-${field.key}-${option.value || "all"}`}
                                    type="button"
                                    onClick={() => {
                                      field.onSelect(option.value);
                                      setActiveHeroFilter(null);
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                )) : <span>Ei valintoja</span>}
                              </div>
                            ) : null}
                          </div>
                        ))}

                        <div className={styles.mobileSheetField}>
                          <span>{homeFilterUiCopy.year}</span>
                          <div className={styles.mobileSheetYearBoxes}>
                            <input
                              className={styles.yearRangeTextInput}
                              type="text"
                              inputMode="numeric"
                              value={yearMinQuery}
                              placeholder="Minimi"
                              aria-label={homeFilterUiCopy.yearMin}
                              onChange={(event) => {
                                setYearMinQuery(event.target.value.replace(/\D/g, "").slice(0, 4));
                                setYearQuery("");
                                afterHeroFilterChange();
                              }}
                            />
                            <span aria-hidden="true">-</span>
                            <input
                              className={styles.yearRangeTextInput}
                              type="text"
                              inputMode="numeric"
                              value={yearMaxQuery}
                              placeholder="Maksimi"
                              aria-label={homeFilterUiCopy.yearMax}
                              onChange={(event) => {
                                setYearMaxQuery(event.target.value.replace(/\D/g, "").slice(0, 4));
                                setYearQuery("");
                                afterHeroFilterChange();
                              }}
                            />
                          </div>
                          <div
                            className={styles.yearRangeClean}
                            data-year-range-clean="true"
                            data-mobile-year-range="true"
                            data-range-active={yearMinQuery || yearMaxQuery ? "true" : "false"}
                            ref={yearSliderRef}
                            role="group"
                            aria-label={homeFilterUiCopy.yearRange}
                            style={{
                              "--year-min": `${yearMinPercent}%`,
                              "--year-max": `${yearMaxPercent}%`,
                              "--year-mid": `${(yearMinPercent + yearMaxPercent) / 2}%`
                            } as CSSProperties}
                          >
                            <span className={styles.yearRangeCleanLine} aria-hidden="true" />
                            <span
                              className={styles.rangeVisualThumb}
                              style={{ left: rangeThumbLeft(yearMinPercent) }}
                              aria-hidden="true"
                            />
                            <span
                              className={styles.rangeVisualThumb}
                              style={{ left: rangeThumbLeft(yearMaxPercent) }}
                              aria-hidden="true"
                            />
                            <input
                              type="range"
                              className={`${styles.mobileYearRangeInput} ${styles.mobileYearRangeMin}`}
                              min={YEAR_FILTER_MIN}
                              max={YEAR_FILTER_MAX}
                              step={1}
                              value={selectedYearMin}
                              aria-label={homeFilterUiCopy.yearMin}
                              onInput={(event) => {
                                const next = Math.min(Number(event.currentTarget.value), selectedYearMax);
                                setYearMinQuery(next === YEAR_FILTER_MIN ? "" : String(next));
                                setYearQuery("");
                                afterHeroFilterChange();
                              }}
                            />
                            <input
                              type="range"
                              className={`${styles.mobileYearRangeInput} ${styles.mobileYearRangeMax}`}
                              min={YEAR_FILTER_MIN}
                              max={YEAR_FILTER_MAX}
                              step={1}
                              value={selectedYearMax}
                              aria-label={homeFilterUiCopy.yearMax}
                              onInput={(event) => {
                                const next = Math.max(Number(event.currentTarget.value), selectedYearMin);
                                setYearMaxQuery(next === YEAR_FILTER_MAX ? "" : String(next));
                                setYearQuery("");
                                afterHeroFilterChange();
                              }}
                            />
                          </div>
                        </div>

                        {isVehicleMarketplace ? (
                          <span className={styles.vehicleUsageSectionLabel}>Moottori ja tekniikka</span>
                        ) : null}

                        {marketplaceHeroFilterFields.slice(4).map((field) => (
                          <div
                            key={`mobile-${field.key}`}
                            className={styles.mobileSheetField}
                            data-mobile-native-field
                            data-no-auto-translate
                            translate="no"
                          >
                            {field.key === "category" ? <b className={styles.mobileSheetSectionTitle}>{homeFilterUiCopy.partCategories}</b> : null}
                            <span>{field.label}</span>
                            <button
                              type="button"
                              className={styles.mobileSheetSelect}
                              onClick={(event) => toggleMobileHeroFilter(field.key, event.currentTarget.parentElement ?? event.currentTarget)}
                            >
                              <strong>{field.value}</strong>
                              <ChevronDown size={15} aria-hidden="true" />
                            </button>
                            <MobileNativeSelect
                              value={field.options.find((option) => option.label === field.value)?.value ?? ""}
                              label={field.label}
                              options={field.options}
                              onChange={(nextValue) => {
                                field.onSelect(nextValue);
                                setActiveHeroFilter(null);
                              }}
                            />
                            {activeHeroFilter === field.key ? (
                              <div className={styles.mobileSheetMenu} data-mobile-native-menu>
                                {field.options.length ? field.options.map((option) => (
                                  <button
                                    key={`mobile-${field.key}-${option.value || "all"}`}
                                    type="button"
                                    onClick={() => {
                                      field.onSelect(option.value);
                                      if (!(
                                        (field.key === "subcategory" || field.key === "detailSubcategory") &&
                                        isTrackMatSelection(option.value)
                                      )) {
                                        setActiveHeroFilter(null);
                                      }
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                )) : <span>Ei valintoja</span>}
                              </div>
                            ) : null}
                          </div>
                        ))}

                        {renderVehicleUsageFilters("mobile")}
                        {renderRidingGearFilters("mobile")}

                        {trackMatDimensionFieldVisible ? (
                          <div id="mobile-track-mat-dimension" className={styles.trackMatDimensionGroup}>
                            <span className={styles.trackMatDimensionGroupLabel}>Telamaton mitat *</span>
                            <div className={styles.mobileTrackMatFields}>
                              {trackMatDimensionFields.map((field, index) => (
                                <Fragment key={`mobile-${field.key}`}>
                                  <div
                                    className={`${styles.mobileSheetField} ${styles.trackMatInlineField}`}
                                    data-mobile-native-field
                                  >
                                    <span>{field.label}</span>
                                    {field.value === CUSTOM_TRACK_MAT_DIMENSION_VALUE ? (
                                      <div className={`${styles.mobileSheetSelect} ${styles.trackMatCustomSelect}`}>
                                        <input
                                          id={`mobile-${field.key}-custom`}
                                          className={styles.trackMatCustomInput}
                                          value={field.customValue}
                                          onChange={(event) => field.onCustomChange(event.target.value)}
                                          onFocus={() => setActiveHeroFilter(null)}
                                          onBlur={field.onCustomCommit}
                                          onKeyDown={(event) => {
                                            if (event.key !== "Enter") return;
                                            event.preventDefault();
                                            field.onCustomCommit();
                                          }}
                                          placeholder={field.customPlaceholder}
                                          aria-label={`Muu ${field.label.toLowerCase()}`}
                                        />
                                        <button
                                          type="button"
                                          className={styles.trackMatCustomSelectToggle}
                                          aria-label={`Avaa ${field.label.toLowerCase()}valikko`}
                                          onClick={(event) => toggleMobileHeroFilter(
                                            field.key,
                                            event.currentTarget.parentElement?.parentElement ?? event.currentTarget
                                          )}
                                        >
                                          <ChevronDown size={15} aria-hidden="true" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          className={styles.mobileSheetSelect}
                                          data-track-mat-trigger={field.key}
                                          onClick={(event) => toggleMobileHeroFilter(
                                            field.key,
                                            event.currentTarget.parentElement ?? event.currentTarget
                                          )}
                                        >
                                          <strong>{field.displayValue || field.placeholder}</strong>
                                          <ChevronDown size={15} aria-hidden="true" />
                                        </button>
                                        <MobileNativeSelect
                                          value={field.value}
                                          label={field.label}
                                          options={[
                                            { value: "", label: field.placeholder },
                                            ...field.options,
                                            { value: CUSTOM_TRACK_MAT_DIMENSION_VALUE, label: "Muu" }
                                          ]}
                                          onChange={field.onSelect}
                                        />
                                      </>
                                    )}
                                    {activeHeroFilter === field.key ? (
                                      <div
                                        ref={enforceTrackMatMenuTheme}
                                        className={styles.mobileSheetMenu}
                                        data-track-mat-menu="true"
                                      >
                                        <button type="button" onClick={() => field.onSelect("")}>
                                          {field.placeholder}
                                        </button>
                                        {field.options.map((option) => (
                                          <button
                                            key={`mobile-${field.key}-${option.value}`}
                                            type="button"
                                            onClick={() => field.onSelect(option.value)}
                                          >
                                            {option.label}
                                          </button>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            field.onSelect(CUSTOM_TRACK_MAT_DIMENSION_VALUE);
                                            window.requestAnimationFrame(() => {
                                              document.getElementById(`mobile-${field.key}-custom`)?.focus();
                                            });
                                          }}
                                        >
                                          Muu
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                  {index < trackMatDimensionFields.length - 1 ? (
                                    <span className={styles.trackMatDimensionSeparator} aria-hidden="true">x</span>
                                  ) : null}
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className={styles.mobileSheetActions}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!applyListingFilters()) return;
                              setHomeSearchPanelOpen(false);
                              setMobileFilterExpanded(false);
                            }}
                          >
                            {homeFilterUiCopy.showResults} ({draftListingResultCount.toLocaleString(locale)})
                          </button>
                          <button type="button" onClick={clearListingFilters}>{homeFilterUiCopy.clearFilters}</button>
                        </div>
                      </div>
                    </>
                  ) : null}
                  {!compactHeroSearch ? (
                    <div className={styles.desktopCompactFilterHeader} data-compact-filter-header>
                      <strong>Suodata ilmoituksia</strong>
                      <button type="button" onClick={clearListingFilters}>
                        <RotateCcw size={13} aria-hidden="true" />
                        <span>Tyhjennä</span>
                      </button>
                    </div>
                  ) : null}
                  {!compactHeroSearch ? renderMarketplaceModeSwitch("desktop") : null}
                  <div className={styles.heroRailHeader}>
                    <strong>{t.filters}</strong>
                  </div>
                  <div className={styles.heroSearchPanel} data-home-filter-scroll-area>
                    {renderSellerTypeFilter("desktop")}
                    <div className={styles.heroSearchRow}>
                      <form
                        className={`${styles.heroSearch} ${compactHeroSearch ? styles.heroSearchMobile : ""}`}
                        role="search"
                        onSubmit={(event) => {
                          event.preventDefault();
                          setSearchSuggestionsOpen(false);
                          applyListingFilters();
                        }}
                      >
                        {compactHeroSearch ? (
                          <button type="submit" className={styles.heroSearchButton} aria-label={t.searchLabel}>
                            <Search size={18} />
                            <span>{t.searchCta}</span>
                          </button>
                        ) : null}
                        <input
                          className={styles.heroSearchInput}
                          type="search"
                          placeholder={t.searchPlaceholder}
                          value={query}
                          onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); setSearchSuggestionsOpen(true); }}
                          onFocus={() => setSearchSuggestionsOpen(true)}
                          onBlur={() => window.setTimeout(() => setSearchSuggestionsOpen(false), 120)}
                          aria-label={t.searchLabel}
                          aria-expanded={showSearchSuggestions}
                          aria-controls="marketplace-search-suggestions"
                          autoComplete="off"
                          spellCheck={false}
                          autoCorrect="off"
                          autoCapitalize="none"
                        />
                        {!compactHeroSearch ? (
                          <button type="submit" className={styles.heroSearchButton}>
                            <Search size={18} />
                            <span>{t.searchCta}</span>
                          </button>
                        ) : null}
                      </form>
                      {showSearchSuggestions ? (
                        <div
                          id="marketplace-search-suggestions"
                          className={styles.marketplaceSearchSuggestions}
                          role="dialog"
                          aria-label="Hakuehdotukset"
                          onMouseDown={(event) => event.preventDefault()}
                        >
                          <div className={styles.marketplaceSuggestionGroups}>
                            <button type="button" className={styles.marketplaceSearchAll} onClick={() => applySuggestedSearch(query.trim())}>
                              Hae <strong>”{query.trim()}”</strong> kaikista ilmoituksista
                            </button>
                            {searchSuggestions.categories.length > 0 ? <section><h3>Kategorioista</h3>{searchSuggestions.categories.map((item) => <button type="button" key={item} onClick={() => applySuggestedSearch(item)}>{translateCategoryLabel(item)}</button>)}</section> : null}
                            {searchSuggestions.sellers.length > 0 ? <section><h3>Yrityksistä ja myyjistä</h3>{searchSuggestions.sellers.map((item) => <button type="button" key={item} onClick={() => applySuggestedSearch(item)}>{item}</button>)}</section> : null}
                          </div>
                          <div className={styles.marketplaceSuggestionProducts}>
                            {searchSuggestions.listings.length > 0 ? searchSuggestions.listings.map((listing) => {
                              const suggestionText = getListingText(listing);
                              return <Link key={listing.id} href={listingPath(listing, locale)} onClick={() => setSearchSuggestionsOpen(false)}>
                                <img src={listingImageSrc(listing)} alt="" loading="lazy" />
                                <span><strong>{suggestionText.title}</strong><small>{[listing.company_name || listing.seller_name, listing.brand, listing.model, listing.part_number].filter(Boolean).join(" · ")}</small></span>
                                <b>{formatPrice(listing.price)}</b>
                              </Link>;
                            }) : <div className={styles.marketplaceSuggestionEmpty}><Search size={22} /><span>Ei ehdotuksia vielä. Hae kaikista ilmoituksista.</span></div>}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.heroFilterStack} aria-label={t.filters}>
                      <section className={styles.heroLocationSection} aria-label="Sijaintisuodatin">
                        <LocationMultiSelectField
                          label={locationFilterCopy.location}
                          placeholder={locationFilterCopy.allLocations}
                          searchPlaceholder={locationFilterCopy.searchPlaceholder}
                          options={locationFilterOptions}
                          selected={[
                            ...locationSelection.countries.map((value) => `country:${value}`),
                            ...locationSelection.regions.map((value) => `region:${value}`),
                            ...locationSelection.municipalities.map((value) => `municipality:${value}`)
                          ]}
                          open={activeHeroFilter === "locationCountries"}
                          onToggleOpen={() =>
                            setActiveHeroFilter((current) =>
                              current === "locationCountries" ? null : "locationCountries"
                            )
                          }
                          onToggle={toggleLocationFilterValue}
                          onClear={() =>
                            updateLocationSelection({
                              countries: [],
                              regions: [],
                              municipalities: []
                            })
                          }
                          selectedCountLabel={locationFilterCopy.selectedCount}
                          emptyLabel={locationFilterCopy.noResults}
                          clearLabel={locationFilterCopy.clearSelections}
                        />
                      </section>
                      {isVehicleMarketplace ? (
                        <span className={styles.vehicleUsageSectionLabel}>Ajoneuvon perustiedot</span>
                      ) : null}
                      {heroRailFilterFields.slice(0, 2).map((field) => (
                        <div key={field.key} className={styles.heroFilterFieldWrap} data-no-auto-translate translate="no">
                          <span className={styles.heroFilterLabel}>{field.label}</span>
                          <button
                            type="button"
                            className={styles.heroFilterSelect}
                            onClick={() => setActiveHeroFilter((current) => current === field.key ? null : field.key)}
                          >
                            <strong>{field.value}</strong>
                            <ChevronDown size={15} aria-hidden="true" />
                          </button>
                          {activeHeroFilter === field.key ? (
                            <div className={styles.heroFilterMenu}>
                              {field.options.length > 0 ? field.options.map((option) => (
                                <button
                                  key={`${field.key}-${option.value || "all"}`}
                                  type="button"
                                  className={styles.heroFilterMenuOption}
                                  onClick={() => {
                                    field.onSelect(option.value);
                                    setActiveHeroFilter(null);
                                  }}
                                >
                                  {option.label}
                                </button>
                              )) : (
                                <span className={styles.heroFilterMenuEmpty}>Ei valintoja</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {heroRailFilterFields.slice(2).map((field) => (
                        <div key={field.key} className={styles.heroFilterFieldWrap} data-no-auto-translate translate="no">
                          <span className={styles.heroFilterLabel}>{field.label}</span>
                          <button
                            type="button"
                            className={styles.heroFilterSelect}
                            onClick={() => setActiveHeroFilter((current) => current === field.key ? null : field.key)}
                          >
                            <strong>{field.value}</strong>
                            <ChevronDown size={15} aria-hidden="true" />
                          </button>
                          {activeHeroFilter === field.key ? (
                            <div className={styles.heroFilterMenu}>
                              {field.options.length > 0 ? field.options.map((option) => (
                                <button
                                  key={`${field.key}-${option.value || "all"}`}
                                  type="button"
                                  className={styles.heroFilterMenuOption}
                                  onClick={() => {
                                    field.onSelect(option.value);
                                    setActiveHeroFilter(null);
                                  }}
                                >
                                  {option.label}
                                </button>
                              )) : (
                                <span className={styles.heroFilterMenuEmpty}>Ei valintoja</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {isVehicleMarketplace ? <>
                      <div className={styles.heroYearRangeField}>
                        <span className={styles.heroYearRangeLabel}>{homeFilterUiCopy.year}</span>
                        <div className={styles.heroYearBoxes}>
                          <input
                            className={styles.yearRangeTextInput}
                            type="text"
                            inputMode="numeric"
                            value={yearMinQuery}
                            placeholder="Minimi"
                            aria-label={homeFilterUiCopy.yearMin}
                            onChange={(event) => {
                              setYearMinQuery(event.target.value.replace(/\D/g, "").slice(0, 4));
                              setYearQuery("");
                              afterHeroFilterChange();
                            }}
                          />
                          <span className={styles.heroYearDash} aria-hidden="true">-</span>
                          <input
                            className={styles.yearRangeTextInput}
                            type="text"
                            inputMode="numeric"
                            value={yearMaxQuery}
                            placeholder="Maksimi"
                            aria-label={homeFilterUiCopy.yearMax}
                            onChange={(event) => {
                              setYearMaxQuery(event.target.value.replace(/\D/g, "").slice(0, 4));
                              setYearQuery("");
                              afterHeroFilterChange();
                            }}
                          />
                        </div>
                        <div
                          className={styles.yearRangeClean}
                          data-year-range-clean="true"
                          data-range-active={yearMinQuery || yearMaxQuery ? "true" : "false"}
                          ref={yearSliderRef}
                          role="group"
                          aria-label={homeFilterUiCopy.yearRange}
                          style={{
                            "--year-min": `${yearMinPercent}%`,
                            "--year-max": `${yearMaxPercent}%`,
                            "--year-mid": `${(yearMinPercent + yearMaxPercent) / 2}%`
                          } as CSSProperties}
                          onMouseDown={startYearRangeMouseDrag}
                        >
                          <span className={styles.yearRangeCleanLine} aria-hidden="true" />
                          <span
                            className={styles.rangeVisualThumb}
                            style={{ left: rangeThumbLeft(yearMinPercent) }}
                            aria-hidden="true"
                          />
                          <span
                            className={styles.rangeVisualThumb}
                            style={{ left: rangeThumbLeft(yearMaxPercent) }}
                            aria-hidden="true"
                          />
                          <input
                            type="range"
                            className={`${styles.desktopYearRangeInput} ${styles.mobileYearRangeMin}`}
                            min={YEAR_FILTER_MIN}
                            max={YEAR_FILTER_MAX}
                            step={1}
                            value={selectedYearMin}
                            aria-label={homeFilterUiCopy.yearMin}
                            onInput={(event) => {
                              const next = Math.min(Number(event.currentTarget.value), selectedYearMax);
                              setYearMinQuery(next === YEAR_FILTER_MIN ? "" : String(next));
                              setYearQuery("");
                              afterHeroFilterChange();
                            }}
                          />
                          <input
                            type="range"
                            className={`${styles.desktopYearRangeInput} ${styles.mobileYearRangeMax}`}
                            min={YEAR_FILTER_MIN}
                            max={YEAR_FILTER_MAX}
                            step={1}
                            value={selectedYearMax}
                            aria-label={homeFilterUiCopy.yearMax}
                            onInput={(event) => {
                              const next = Math.max(Number(event.currentTarget.value), selectedYearMin);
                              setYearMaxQuery(next === YEAR_FILTER_MAX ? "" : String(next));
                              setYearQuery("");
                              afterHeroFilterChange();
                            }}
                          />
                        </div>
                      </div>
                      {isVehicleMarketplace ? (
                        <span className={styles.vehicleUsageSectionLabel}>Moottori ja tekniikka</span>
                      ) : null}
                      {heroRailEngineFields.map((field) => (
                        <div
                          key={field.key}
                          className={styles.heroFilterFieldWrap}
                          data-no-auto-translate
                          translate="no"
                        >
                          <span className={styles.heroFilterLabel}>{field.label}</span>
                          <button
                            type="button"
                            className={styles.heroFilterSelect}
                            onClick={() =>
                              setActiveHeroFilter((current) =>
                                current === field.key ? null : field.key
                              )
                            }
                          >
                            <strong>{field.value}</strong>
                            <ChevronDown size={15} aria-hidden="true" />
                          </button>
                          {activeHeroFilter === field.key ? (
                            <div className={styles.heroFilterMenu}>
                              {field.options.length > 0 ? field.options.map((option) => (
                                <button
                                  key={`${field.key}-${option.value || "all"}`}
                                  type="button"
                                  className={styles.heroFilterMenuOption}
                                  onClick={() => {
                                    field.onSelect(option.value);
                                    setActiveHeroFilter(null);
                                  }}
                                >
                                  {option.label}
                                </button>
                              )) : (
                                <span className={styles.heroFilterMenuEmpty}>Ei valintoja</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                      </> : null}
                    </div>

                    {desktopMoreFiltersOpen ? renderVehicleUsageFilters("desktop") : null}
                    {isGearMarketplace ? renderRidingGearFilters("desktop") : null}

                    {(marketplaceMode === "parts" || desktopMoreFiltersOpen) && (heroRailPartCategoryFields.length > 0 || trackMatDimensionFieldVisible) ? (
                    <div className={styles.heroPartCategoryStack} aria-label={homeFilterUiCopy.partCategories}>
                      <span className={styles.heroPartCategoryTitle}>{homeFilterUiCopy.partCategories}</span>
                      {heroRailPartCategoryFields.map((field) => (
                        <div
                          key={field.key}
                          className={styles.heroFilterFieldWrap}
                          data-part-category-filter={field.key}
                          data-no-auto-translate
                          translate="no"
                        >
                          <span className={styles.heroFilterLabel}>{field.label}</span>
                          <button
                            type="button"
                            className={styles.heroFilterSelect}
                            onClick={() => {
                              const willOpen = activeHeroFilter !== field.key;
                              setActiveHeroFilter((current) => current === field.key ? null : field.key);
                              if (willOpen) revealPartCategoryMenu(field.key);
                            }}
                          >
                            <strong>{field.value}</strong>
                            <ChevronDown size={15} aria-hidden="true" />
                          </button>
                          {activeHeroFilter === field.key ? (
                            <div className={styles.heroFilterMenu} data-part-category-menu>
                              {field.options.length > 0 ? field.options.map((option) => (
                                <button
                                  key={`${field.key}-${option.value || "all"}`}
                                  type="button"
                                  className={styles.heroFilterMenuOption}
                                  onClick={() => {
                                    field.onSelect(option.value);
                                    setActiveHeroFilter(null);
                                  }}
                                >
                                  {option.label}
                                </button>
                              )) : (
                                <span className={styles.heroFilterMenuEmpty}>Ei valintoja</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {trackMatDimensionFieldVisible ? (
                        <div className={styles.trackMatDimensionGroup}>
                          <span className={styles.trackMatDimensionGroupLabel}>Telamaton mitat *</span>
                          <div className={styles.desktopTrackMatFields}>
                            {trackMatDimensionFields.map((field, index) => (
                              <Fragment key={field.key}>
                                <div
                                  className={`${styles.heroFilterFieldWrap} ${styles.trackMatInlineField}`}
                                  data-part-category-filter={field.key}
                                >
                                  <span className={styles.heroFilterLabel}>{field.label}</span>
                                  {field.value === CUSTOM_TRACK_MAT_DIMENSION_VALUE ? (
                                    <div className={`${styles.heroFilterSelect} ${styles.trackMatCustomSelect}`}>
                                      <input
                                        id={`desktop-${field.key}-custom`}
                                        className={styles.trackMatCustomInput}
                                        value={field.customValue}
                                        onChange={(event) => field.onCustomChange(event.target.value)}
                                        onFocus={() => setActiveHeroFilter(null)}
                                        onBlur={field.onCustomCommit}
                                        onKeyDown={(event) => {
                                          if (event.key !== "Enter") return;
                                          event.preventDefault();
                                          field.onCustomCommit();
                                        }}
                                        placeholder={field.customPlaceholder}
                                        aria-label={`Muu ${field.label.toLowerCase()}`}
                                      />
                                      <button
                                        type="button"
                                        className={styles.trackMatCustomSelectToggle}
                                        aria-label={`Avaa ${field.label.toLowerCase()}valikko`}
                                        onClick={() => {
                                          const willOpen = activeHeroFilter !== field.key;
                                          setActiveHeroFilter((current) =>
                                            current === field.key ? null : field.key
                                          );
                                          if (willOpen) revealPartCategoryMenu(field.key);
                                        }}
                                      >
                                        <ChevronDown size={15} aria-hidden="true" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className={styles.heroFilterSelect}
                                      data-track-mat-trigger={field.key}
                                      onClick={() => {
                                        const willOpen = activeHeroFilter !== field.key;
                                        setActiveHeroFilter((current) =>
                                          current === field.key ? null : field.key
                                        );
                                        if (willOpen) revealPartCategoryMenu(field.key);
                                      }}
                                    >
                                      <strong>{field.displayValue || field.placeholder}</strong>
                                      <ChevronDown size={15} aria-hidden="true" />
                                    </button>
                                  )}
                                  {activeHeroFilter === field.key ? (
                                    <div
                                      ref={enforceTrackMatMenuTheme}
                                      className={styles.heroFilterMenu}
                                      data-part-category-menu
                                      data-track-mat-menu="true"
                                    >
                                      <button
                                        type="button"
                                        className={styles.heroFilterMenuOption}
                                        onClick={() => field.onSelect("")}
                                      >
                                        {field.placeholder}
                                      </button>
                                      {field.options.map((option) => (
                                        <button
                                          key={`${field.key}-${option.value}`}
                                          type="button"
                                          className={styles.heroFilterMenuOption}
                                          onClick={() => field.onSelect(option.value)}
                                        >
                                          {option.label}
                                        </button>
                                      ))}
                                      <button
                                        type="button"
                                        className={styles.heroFilterMenuOption}
                                        onClick={() => {
                                          field.onSelect(CUSTOM_TRACK_MAT_DIMENSION_VALUE);
                                          window.requestAnimationFrame(() => {
                                            document.getElementById(`desktop-${field.key}-custom`)?.focus();
                                          });
                                        }}
                                      >
                                        Muu
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                                {index < trackMatDimensionFields.length - 1 ? (
                                  <span className={styles.trackMatDimensionSeparator} aria-hidden="true">x</span>
                                ) : null}
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    ) : null}

                  </div>

                  <div className={styles.heroRailActions}>
                      {!desktopAllFiltersOpen ? (
                        <button
                          type="button"
                          className={styles.desktopMoreFiltersButton}
                          aria-haspopup="dialog"
                          onClick={() => setDesktopAllFiltersOpen(true)}
                        >
                          <SlidersHorizontal size={16} aria-hidden="true" />
                          <span>Lisää suodattimia</span>
                          <ChevronRight size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                      {!compactHeroSearch && !desktopAllFiltersOpen ? (
                        <button type="button" className={styles.desktopAllFiltersButton} onClick={() => setDesktopAllFiltersOpen(true)}>
                          <SlidersHorizontal size={17} aria-hidden="true" />
                          Kaikki hakuehdot
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.heroRailSubmit}
                        onClick={() => {
                          if (!applyListingFilters()) return;
                          if (compactHeroSearch) {
                            setHomeSearchPanelOpen(false);
                            setMobileFilterExpanded(false);
                          }
                          if (desktopAllFiltersOpen) setDesktopAllFiltersOpen(false);
                        }}
                      >
                        {homeFilterUiCopy.showResults} ({draftListingResultCount.toLocaleString(locale)})
                      </button>
                      <button type="button" className={styles.heroRailClear} onClick={clearListingFilters}>
                        {homeFilterUiCopy.clearFilters}
                      </button>
                  </div>

                  <div className={styles.heroLatestPanel}>
                    <div className={styles.heroLatestHeader}>
                      <strong>Uusimmat ilmoitukset</strong>
                    </div>
                    <div className={styles.heroLatestGrid}>
                      {heroLatestListings.map((listing) => {
                        const listingText = getListingText(listing);
                        return (
                          <Link
                            key={listing.id}
                            href={listingPath(listing, locale)}
                            className={styles.heroLatestCard}
                          >
                            <span className={styles.heroLatestImage}>
                              <OptimizedListingImage
                                src={listingImageSrc(listing)}
                                alt={listingImageSeoAlt(listing, listingText.title)}
                              />
                              <HomeListingSaleBadge listing={listing} />
                            </span>
                            <span className={styles.heroLatestInfo}>
                              <strong>{listingText.title}</strong>
                              <ListingVehicleMeta year={listing.year} brand={listing.brand} model={listing.model} compact />
                              <ListingSalePrice listing={listing} hideBadge />
                              <VehicleTaxBadges listing={listing} />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : null}
            </aside>
            ) : null}
            </BodyPortal>

          </div>
        </section>
      </div>
      </div>{/* heroWrap */}

      </>
      ) : null}

        {false && showRecoSection && (
          <div className={styles.recoFullBleed}>
            <div className={styles.recoSection}>
              <div className={styles.recoHead}>
                <div>
                  <>
                    <span className={styles.recoEyebrow}>✨ {t.forYou}</span>
                    <h2 className={styles.recoTitle}>{t.basedOnBrowsing}</h2>
                  </>
                </div>
                <div className={styles.recoActions}>
                  {renderSortControl(styles.recoSortControl)}
                <button
                  type="button"
                  className={styles.mobileSortBtn}
                  onClick={() => setSortSheetOpen(true)}
                  aria-label={t.sort}
                >
                  <ListFilter size={16} />
                  <span className={styles.mobileSortArrow} aria-hidden="true" />
                </button>
                </div>
              </div>
              {showRecoContent && (
              <div className={styles.recoCardsWrap}>
                <div className={styles.cardsGrid}>
                  {([] as Listing[]).map((listing) => {
                    const isFavorite = favorites.includes(listing.id);
                    const listingText = getListingText(listing);
                    const countryFlag = getCountryFlagFromLocation(listing.location, t.country);
                    return (
                      <article
                        key={listing.id}
                        data-listing-card="true"
                        className={styles.card}
                        role="link"
                        tabIndex={0}
                        aria-label={`${t.openListing} ${listingText.title}`}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest('[data-listing-favorite="true"]')) return;
                          openListing(listing);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openListing(listing);
                          }
                        }}
                      >
                        <div className={`${styles.cardImage} ${styles.listingCardImage}`} data-listing-card-image="true">
                          <span className={styles.cardImageBlur} aria-hidden="true">
                            <OptimizedListingImage src={listingImageSrc(listing)} alt="" decorative />
                          </span>
                          <Link
                            href={listingPath(listing, locale)}
                            className={styles.listingImageSeoLink}
                            aria-label={`${t.openListing} ${listingImageSeoAlt(listing, listingText.title)}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <OptimizedListingImage
                              src={listingImageSrc(listing)}
                              alt={listingImageSeoAlt(listing, listingText.title)}
                            />
                          </Link>
                          <HomeListingSaleBadge listing={listing} />
                          {canUseFavorites && <button
                            onClick={(e) => toggleFavorite(e, listing.id)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteButtonActive : ""}`}
                            data-listing-favorite="true"
                            data-listing-id={listing.id}
                            type="button"
                            aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                            aria-pressed={isFavorite}
                          >
                            <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                          </button>}
                        </div>
                        <div className={styles.cardBody} data-listing-card-body="true">
                          <ListingSalePrice listing={listing} className={styles.cardPrice} hideBadge />
                          <VehicleTaxBadges listing={listing} />
                          {listing.vehicle_subtype ? (
                          <div className={styles.badgeRow}>
                            <span className={styles.badge}>Tyyppi {listing.vehicle_subtype}</span>
                          </div>
                          ) : null}
                          <h3 className={styles.cardTitle}>{listingText.title}</h3>
                          <ListingVehicleMeta year={listing.year} brand={listing.brand} model={listing.model} />
                          <div className={styles.cardMetaRow} data-listing-card-meta="true">
                            <span className={styles.cardLocationMeta}>
                              {countryFlag ? (
                                <img
                                  className={styles.listingCountryFlag}
                                  src={countryFlag.src}
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                />
                              ) : null}
                              {formatLocationWithCountry(listing.location, t.country, locale)}
                            </span>
                            <span className={styles.cardDateMeta}><Clock3 size={14} />{formatDate(listing.created_at)}</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        {showListingResultsSection && showAllListingsHeader && (
          <div className={styles.allListingsHeader}>
            <span className={styles.allListingsHeaderLabel}>{t.allListings}</span>
            <button
              type="button"
              className={`${styles.mobileSortBtn} ${styles.allListingsSortBtn}`}
              onClick={() => setSortSheetOpen(true)}
              aria-label={t.sort}
            >
              <ListFilter size={16} />
              <span className={styles.mobileSortArrow} aria-hidden="true" />
            </button>
          </div>
        )}

        {showListingResultsSection ? (
        <section
          id="listings"
          ref={resultsRef}
          className={`${styles.mainGrid} ${styles.listingsPlainSection} ${!showRecoSection ? styles.mainGridNoReco : ""}`}
          aria-label={t.content}
          style={{ background: "transparent", border: 0, borderRadius: 0, boxShadow: "none" }}
        >
          <div
            className={styles.listingsPlainContainer}
            style={{ background: "transparent", border: 0, borderRadius: 0, boxShadow: "none" }}
          >
            <div className={styles.sectionHead}>
              <span className={styles.resultsCount}>
                {listingsLoading
                  ? ""
                  : listingsExpanded
                  ? homeResultsText.results(filteredListings.length)
                  : "Uusimmat varaosat"}
              </span>
              <div className={styles.listingToolbar}>
                <button
                  type="button"
                  className={styles.editResultsFiltersButton}
                  onClick={openHomeFilters}
                >
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  <span>{homeResultsText.editSearch}</span>
                </button>
                {listingsExpanded && hasAppliedListingFilters ? (
                  <button
                    type="button"
                    className={styles.resetResultsFiltersButton}
                    onClick={resetFilteredHomeView}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    <span>{homeResultsText.resetFilters}</span>
                  </button>
                ) : null}
                {listingsExpanded ? renderSortControl(styles.sectionSortControl) : null}
              </div>
            </div>

            <div
              className={styles.listingsPlainPanel}
              style={{ background: "transparent", border: 0, borderRadius: 0, boxShadow: "none" }}
            >
              <div className={styles.cardsGrid}>
              {listingsLoading ? null : displayedListings.length === 0 ? (
                <div
                  className={styles.listingsPlainState}
                  style={{ background: "transparent", border: 0, borderRadius: 0, boxShadow: "none" }}
                >
                  <strong>{t.noListings}</strong>
                  <span>{t.changeFilters}</span>
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={clearListingFilters}
                  >
                    {t.resetFilters}
                  </button>
                </div>
              ) : null}
              {displayedListings.map((listing) => {
                const isFavorite = favorites.includes(listing.id);
                const listingText = getListingText(listing);
                const countryFlag = getCountryFlagFromLocation(listing.location, t.country);
                return (
                  <article
                    key={listing.id}
                    data-listing-card="true"
                    className={styles.card}
                    role="link"
                    tabIndex={0}
                    aria-label={`${t.openListing} ${listingText.title}`}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('[data-listing-favorite="true"]')) return;
                      openListing(listing);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openListing(listing);
                      }
                    }}
                  >

                    <div className={`${styles.cardImage} ${styles.listingCardImage}`} data-listing-card-image="true">
                      <span className={styles.cardImageBlur} aria-hidden="true">
                        <OptimizedListingImage src={listingImageSrc(listing)} alt="" decorative />
                      </span>
                      <Link
                        href={listingPath(listing, locale)}
                        className={styles.listingImageSeoLink}
                        aria-label={`${t.openListing} ${listingImageSeoAlt(listing, listingText.title)}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <OptimizedListingImage
                          src={listingImageSrc(listing)}
                          alt={listingImageSeoAlt(listing, listingText.title)}
                        />
                      </Link>
                      <HomeListingSaleBadge listing={listing} />
                      {!getListingSalePricing(listing).onSale && isListingNew(listing.created_at) && (
                        <span className={styles.newBadge} aria-label={t.newBadge}>
                          {t.newBadge}
                        </span>
                      )}
                      {canUseFavorites && <button
                        onClick={(e) => toggleFavorite(e, listing.id)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className={`${styles.favoriteButton} ${
                          isFavorite ? styles.favoriteButtonActive : ""
                        }`}
                        data-listing-favorite="true"
                        data-listing-id={listing.id}
                        type="button"
                        aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                        aria-pressed={isFavorite}
                      >
                        <Heart
                          size={14}
                          fill={isFavorite ? "currentColor" : "none"}
                        />
                      </button>}
                    </div>

                    <div className={styles.cardBody} data-listing-card-body="true">
                      <ListingSalePrice listing={listing} className={styles.cardPrice} hideBadge />
                      <VehicleTaxBadges listing={listing} />
                      {listing.vehicle_subtype ? (
                      <div className={styles.badgeRow}>
                        <span className={styles.badge}>Tyyppi {listing.vehicle_subtype}</span>
                      </div>
                      ) : null}

                      <h3 className={styles.cardTitle}>{listingText.title}</h3>

                      <ListingVehicleMeta year={listing.year} brand={listing.brand} model={listing.model} />

                      <div className={styles.cardMetaRow} data-listing-card-meta="true">
                        <span className={styles.cardLocationMeta}>
                          {countryFlag ? (
                            <img
                              className={styles.listingCountryFlag}
                              src={countryFlag.src}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                            />
                          ) : null}
                          {formatLocationWithCountry(listing.location, t.country, locale)}
                        </span>
                        <span className={styles.cardDateMeta}>
                          <Clock3 size={14} />
                          {formatDate(listing.created_at)}
                        </span>
                      </div>

                    </div>
                  </article>
                );
              })}
              </div>

              {!listingsLoading && listingsExpanded && totalPages > 1 && !showRecoSection && (
                <div className={styles.pagination}>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={currentPage === 1}
                    onClick={() => {
                      goToPage(currentPage - 1);
                    }}
                    aria-label="Edellinen sivu"
                  >
                    <ChevronLeft size={16} strokeWidth={3} aria-hidden="true" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 5) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (Math.abs(p - currentPage) <= 1) return true;
                      return false;
                    })
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1 && !acc.includes("...")) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx, pages) =>
                      p === "..." ? (
                        mobilePagination ? (() => {
                          const previousPage = [...pages]
                            .slice(0, idx)
                            .reverse()
                            .find((item): item is number => typeof item === "number");
                          const nextPage = pages
                            .slice(idx + 1)
                            .find((item): item is number => typeof item === "number");
                          const jumpPage =
                            typeof nextPage === "number" && nextPage <= currentPage
                              ? Math.max(1, currentPage - 10)
                              : typeof previousPage === "number" && previousPage >= currentPage
                                ? Math.min(totalPages, currentPage + 10)
                                : suggestedPageJump;

                          return (
                            <button
                              key={`gap-${idx}`}
                              type="button"
                              className={`${styles.pageBtn} ${styles.pageGap}`}
                              aria-label={`Siirry sivulle ${jumpPage}`}
                              onClick={() => goToPage(jumpPage)}
                            >
                              {jumpPage}
                            </button>
                          );
                        })() : pageJumpOpen ? (
                          <form
                            key={`gap-${idx}`}
                            className={styles.pageJumpControl}
                            onSubmit={(e) => {
                              e.preventDefault();
                              submitPageJump();
                            }}
                          >
                            <span className={styles.pageJumpLabel}>Sivu</span>
                            <input
                              className={styles.pageJumpInput}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={totalPages}
                              value={pageJumpValue}
                              autoFocus
                              placeholder={String(suggestedPageJump)}
                              aria-label={`Siirry sivulle 1-${totalPages}`}
                              onChange={(e) => setPageJumpValue(e.target.value)}
                              onFocus={(e) => {
                                const input = e.currentTarget;

                                if (!pageJumpValue.trim()) {
                                  setPageJumpValue(String(suggestedPageJump));
                                  window.requestAnimationFrame(() => input.select());
                                  return;
                                }

                                input.select();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") resetPageJump();
                              }}
                              onBlur={(e) => {
                                if (!e.currentTarget.form?.contains(e.relatedTarget as Node | null)) {
                                  resetPageJump();
                                }
                              }}
                            />
                            <span className={styles.pageJumpTotal}>/ {totalPages}</span>
                            <button
                              type="submit"
                              className={styles.pageJumpSubmit}
                              aria-label="Siirry sivulle"
                            >
                              <Check size={17} strokeWidth={3.2} aria-hidden="true" />
                            </button>
                          </form>
                        ) : (
                          <button
                            key={`gap-${idx}`}
                            type="button"
                            className={`${styles.pageBtn} ${styles.pageGap}`}
                            aria-label="Avaa sivulle siirtyminen"
                            onClick={() => setPageJumpOpen(true)}
                          >
                            &hellip;
                          </button>
                        )
                      ) : (
                        <button
                          key={p}
                          type="button"
                          className={p === currentPage ? `${styles.pageBtn} ${styles.pageBtnActive}` : styles.pageBtn}
                          aria-current={p === currentPage ? "page" : undefined}
                          onClick={() => {
                            goToPage(p);
                          }}
                        >
                          {p}
                        </button>
                      )
                    )}

                  <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      goToPage(currentPage + 1);
                    }}
                    aria-label="Seuraava sivu"
                  >
                    <ChevronRight size={16} strokeWidth={3} aria-hidden="true" />
                  </button>
                </div>
              )}

            </div>
          </div>

          {false && false && <aside className={styles.filtersCard} aria-label={t.filters}>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 className={styles.filtersTitle} style={{ padding: 0 }}>{t.filters}</h2>
              {(category || subcategory || selectedBrand !== "Kaikki" || modelQuery || yearQuery) && (
                <button
                  type="button"
                  onClick={() => { setCategory(""); setSubcategory(""); setSelectedBrand("Kaikki"); setModelQuery(""); setYearQuery(""); setYearMinQuery(""); setYearMaxQuery(""); setOpenCategory(null); setCategorySearch(""); }}
                  style={{ fontSize: 11, fontWeight: 700, color: "#ff7a1a", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {t.resetFilters}
                </button>
              )}
            </div>

            <div className={styles.filtersGroup}>
              <span className={styles.filtersLabel}>{t.sort}</span>
              {renderSortControl(styles.sectionSortControl)}

              <span className={styles.filtersLabel}>{t.brand}</span>
              <select
                className={styles.select}
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
              >
                {brandOptions.map((brandOption) => (
                  <option key={brandOption} value={brandOption}>
                    {brandOption === "Kaikki" ? t.all : brandOption}
                  </option>
                ))}
              </select>

              <span className={styles.filtersLabel}>{t.model}</span>
              <div className={styles.searchInput}>
                <Search size={16} />
                <input
                  value={modelQuery}
                  onChange={(e) => setModelQuery(e.target.value)}
                  placeholder={vehicleType ? modelPlaceholders[vehicleType as VehicleType] : t.model}
                />
              </div>

              <span className={styles.filtersLabel}>{t.year}</span>
              <div className={styles.searchInput}>
                <Search size={16} />
                <input
                  value={yearQuery}
                  onChange={(e) => setYearQuery(e.target.value)}
                  placeholder={t.yearPlaceholder}
                  inputMode="numeric"
                />
              </div>

              <span className={styles.filtersLabel}>{t.priceRange}</span>
              <div className={styles.priceFilter}>
                <label>
                  {t.minimum}
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    step={100}
                    value={minPrice}
                    onChange={(e) => {
                      const next = Number(e.target.value || 0);
                      setMinPrice(Math.min(next, maxPrice));
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100000}
                    step={100}
                    value={minPrice}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setMinPrice(Math.min(next, maxPrice));
                    }}
                  />
                  <strong>{formatPrice(minPrice)}</strong>
                </label>
                <label>
                  {t.maximum}
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    step={100}
                    value={maxPrice}
                    onChange={(e) => {
                      const next = Number(e.target.value || 0);
                      setMaxPrice(Math.max(next, minPrice));
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100000}
                    step={100}
                    value={maxPrice}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setMaxPrice(Math.max(next, minPrice));
                    }}
                  />
                  <strong>{formatPrice(maxPrice)}</strong>
                </label>
              </div>

              <span className={styles.filtersLabel}>{t.categories}</span>
              <div className={styles.searchInput}>
                <Search size={16} />
                <input
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder={t.categoryPlaceholder}
                />
              </div>

              <div className={styles.categoryPanel}>
                {categoryEntries.map(([key, values]) => {
                  const opened = openCategory === key;
                  const selected = category === key && subcategory === "";

                  return (
                    <div key={key} className={styles.categoryGroup}>
                      <button
                        type="button"
                        className={`${styles.categoryGroupButton} ${
                          selected ? styles.categoryGroupButtonActive : ""
                        }`}
                        onClick={() => {
                          // Toggle off: click again clears
                          if (category === key && subcategory === "") {
                            setCategory("");
                            setSubcategory("");
                            setOpenCategory(null);
                            return;
                          }

                          setCategory(key);
                          setSubcategory("");
                          setOpenCategory(opened ? null : key);
                        }}
                      >
                        <span>{translateCategoryLabel(key)}</span>
                        <ChevronDown
                          size={16}
                          style={{
                            transform: opened ? "rotate(180deg)" : "rotate(0deg)",
                            transition: ".12s ease"
                          }}
                        />
                      </button>

                      {opened ? (
                        <div className={styles.subcategoryRow}>
                          <button
                            type="button"
                            className={`${styles.subcategoryChip} ${
                              category === key && subcategory === ""
                                ? styles.subcategoryChipActive
                                : ""
                            }`}
                            onClick={() => {
                              if (category === key && subcategory === "") {
                                setCategory("");
                                setSubcategory("");
                                setOpenCategory(null);
                              } else {
                                setCategory(key);
                                setSubcategory("");
                              }
                            }}
                          >
                            {t.all}
                          </button>
                          {values.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className={`${styles.subcategoryChip} ${
                                category === key && subcategory === item
                                  ? styles.subcategoryChipActive
                                  : ""
                              }`}
                              onClick={() => {
                                if (category === key && subcategory === item) {
                                  setSubcategory("");
                                } else {
                                  setCategory(key);
                                  setSubcategory(item);
                                }
                              }}
                            >
                              {translateCategoryLabel(item)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>}
        </section>
        ) : null}

      {catalogOnlyView && desktopAllFiltersOpen ? (
        <BodyPortal enabled>
          <button
            type="button"
            className={styles.desktopFilterBackdrop}
            aria-label="Sulje kaikki hakuehdot"
            onClick={() => setDesktopAllFiltersOpen(false)}
          />
          <aside className={`${styles.desktopFilterModal} ${styles.resultsFilterModal}`}>
            {renderDesktopAllFilters()}
          </aside>
        </BodyPortal>
      ) : null}

      {/* Mobile sort sheet */}
      {sortSheetOpen && (
        <div className={styles.mobileSortBackdrop} onClick={() => setSortSheetOpen(false)}>
          <div className={styles.mobileSortSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileSortHandle} />
            <button
              type="button"
              className={`${styles.mobileSortOption} ${styles.mobileSortOptionRestore}`}
              onClick={() => { handleSortChange("recommendations"); setSortSheetOpen(false); }}
            >
              <span className={styles.mobileSortRadio}>
                {recommendationsMode && sort === "Osuvimmat ensin" && <span className={styles.mobileSortRadioDot} />}
              </span>
              Palaa suosituksiin
            </button>
            {sortValues
              .map((value) => {
              const label = sortLabel(value);
              return (
                <button
                  key={value}
                  type="button"
                  className={`${styles.mobileSortOption}${!recommendationsEnabled && sort === value ? ` ${styles.mobileSortOptionActive}` : ""}`}
                  onClick={() => { handleSortChange(value); setSortSheetOpen(false); }}
                >
                  <span className={styles.mobileSortRadio}>
                    {!recommendationsEnabled && sort === value && <span className={styles.mobileSortRadioDot} />}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
