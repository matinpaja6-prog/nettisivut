"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import styles from "./page.module.css";

import {
  Check,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gift,
  Heart,
  MapPin,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X
} from "lucide-react";

import {
  fallbackListings,
  formatPrice,
  getListingPartNumber,
  normalizeVehicleType,
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
  buildMarketplaceSubcategoryGroups,
  buildMarketplaceYearOptions,
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
import { applyLocale, isLocale, translateCategory } from "@/lib/i18n";
import OptimizedListingImage, { fallbackListingImage } from "./components/OptimizedListingImage";
import { ListFilter } from "lucide-react";
import { getCategoryVehicleKey } from "./components/CategoryDrawer";

type Locale = "fi" | "en" | "sv" | "no" | "et";

const HOME_RETURN_STATE_KEY = "home_return_state_v1";
const HOME_RETURN_PENDING_KEY = "home_return_pending_v1";
const TRACK_MAT_DIMENSION_OPTIONS = [
  "307 cm x 38 cm x 6,4 cm / 121 x 15 x 2.52\"",
  "307 cm x 41 cm x 6,4 cm / 121 x 16 x 2.52\"",
  "325 cm x 38 cm x 6,4 cm / 128 x 15 x 2.52\"",
  "345 cm x 38 cm x 6,4 cm / 136 x 15 x 2.52\"",
  "348 cm x 38 cm x 7,3 cm / 137 x 15 x 2.86\"",
  "358 cm x 38 cm x 6,4 cm / 141 x 15 x 2.52\"",
  "366 cm x 34 cm x 6,4 cm / 144 x 13.5 x 2.52\"",
  "366 cm x 36 cm x 6,4 cm / 144 x 14 x 2.52\"",
  "366 cm x 38 cm x 6,4 cm / 144 x 15 x 2.52\"",
  "371 cm x 38 cm x 7,3 cm / 146 x 15 x 2.86\"",
  "383 cm x 38 cm x 6,4 cm / 151 x 15 x 2.52\"",
  "391 cm x 38 cm x 7,3 cm / 154 x 15 x 2.86\"",
  "391 cm x 41 cm x 7,3 cm / 154 x 16 x 2.86\"",
  "391 cm x 51 cm x 6,4 cm / 154 x 20 x 2.52\"",
  "396 cm x 38 cm x 6,4 cm / 156 x 15 x 2.52\"",
  "396 cm x 41 cm x 6,4 cm / 156 x 16 x 2.52\"",
  "396 cm x 51 cm x 6,4 cm / 156 x 20 x 2.52\"",
  "411 cm x 38 cm x 7,6 cm / 162 x 15 x 3.00\"",
  "414 cm x 41 cm x 7,6 cm / 163 x 16 x 3.00\"",
  "419 cm x 38 cm x 7,6 cm / 165 x 15 x 3.00\"",
  "442 cm x 38 cm x 7,6 cm / 174 x 15 x 3.00\"",
  "445 cm x 38 cm x 7,6 cm / 175 x 15 x 3.00\""
];

function isPublicListing(listing: Listing) {
  return !listing.is_sold && !listing.is_hidden;
}

function mergeCategorySources(
  baseCategories: Record<string, readonly string[]>,
  vehicleCategorySources: Record<string, Record<string, readonly string[]>>
) {
  const merged = new Map<string, string[]>();

  function addCategorySource(source: Record<string, readonly string[]>) {
    for (const [categoryName, subcategories] of Object.entries(source)) {
      const existing = merged.get(categoryName) ?? [];
      const next = [...existing];

      for (const subcategory of subcategories) {
        if (!next.includes(subcategory)) next.push(subcategory);
      }

      merged.set(categoryName, next);
    }
  }

  addCategorySource(baseCategories);
  for (const source of Object.values(vehicleCategorySources)) {
    addCategorySource(source);
  }

  return Object.fromEntries(merged.entries()) as Record<string, readonly string[]>;
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
    heroSubtitle: "Suomen kattava varaosamarketplace moottorikelkoille, mönkijöille, motocrossiin ja mopoihin.",
    heroLeadStart: "Nopea haku",
    heroLeadHighlight: "myy käytetyt",
    heroLeadEnd: "varaosat helposti",
    heroTrustFast: "Nopea ja helppo listaaminen",
    heroTrustFree: "Ilmainen myynti ostajalle",
    heroTrustSafe: "Turvallinen kauppa Suomessa",
    heroTrustService: "Palvelemme suomeksi ja englanniksi",
    heroBenefitSafeTitle: "Turvallinen kauppa",
    heroBenefitSafeText: "kauppa Suomessa",
    heroBenefitFreeTitle: "Ilmainen myynti",
    heroBenefitFreeText: "ostajalle",
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
    searchCta: "Hae varaosia",
    searchPlaceholder: "Hae varaosia, merkkiä tai mallia...",
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
    rewards: "Palkinnot",
    shop: "Kauppa",
    notifications: "Ilmoitukset",
    reviews: "Arvostelut",
    reviewSeller: "Anna arvio myyjästä",
    openReview: "Avaa arvostelu",
    dismiss: "Poista",
    noNotifications: "Ei uusia ilmoituksia.",
    sellParts: "Myy osia",
    forYou: "Sinulle suosituksia",
    basedOnBrowsing: "Selaamasi perusteella",
    showMoreListings: "Näytä lisää ilmoituksia",
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
    heroSubtitle: "Fast search. Wide selection. Trusted sellers.",
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
    rewards: "Rewards",
    shop: "Shop",
    notifications: "Notifications",
    reviews: "Reviews",
    reviewSeller: "Review the seller",
    openReview: "Open review",
    dismiss: "Dismiss",
    noNotifications: "No new notifications.",
    sellParts: "Sell parts",
    forYou: "Recommendations for you",
    basedOnBrowsing: "Based on your browsing",
    showMoreListings: "Show more listings",
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
    heroSubtitle: "Snabb sökning. Brett utbud. Pålitliga säljare.",
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
    rewards: "Belöningar",
    shop: "Butik",
    notifications: "Notiser",
    reviews: "Recensioner",
    reviewSeller: "Betygsätt säljaren",
    openReview: "Öppna recension",
    dismiss: "Ta bort",
    noNotifications: "Inga nya notiser.",
    sellParts: "Sälj delar",
    forYou: "Rekommendationer för dig",
    basedOnBrowsing: "Baserat på ditt bläddring",
    showMoreListings: "Visa fler annonser",
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
    heroSubtitle: "Raskt søk. Stort utvalg. Pålitelige selgere.",
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
    instructions: "Instruksjoner",
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
    garageTitle: "Min Garasje",
    garageAddVehicle: "Legg til kjøretøy",
    garagePartsFor: "Deler for",
    saTitle: "Søkevakter",
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
    level: "Level",
    xpToNextLevel: "til neste level",
    maxLevel: "Maksnivå"
  },
  et: {
    createListing: "Loo kuulutus",
    profile: "Profiil",
    editProfile: "Muuda profiili",
    myListings: "Minu kuulutused",
    messages: "Sõnumid",
    savedListings: "Salvestatud kuulutused",
    login: "Logi sisse",
    signOut: "Logi välja",
    heroTitle: "Sõidukiosad, mis viivad sind edasi.",
    heroSubtitle: "Kiire otsing. Lai valik. Usaldusväärsed müüjad.",
    heroLeadStart: "Kiire otsing",
    heroLeadHighlight: "müü kasutatud",
    heroLeadEnd: "varuosi lihtsalt",
    heroTrustFast: "Kiire ja lihtne kuulutamine",
    heroTrustFree: "Ostjale tasuta müük",
    heroTrustSafe: "Turvaline kauplemine Soomes",
    heroTrustService: "Teenindus soome ja inglise keeles",
    heroBenefitSafeTitle: "Turvaline kauplemine",
    heroBenefitSafeText: "Soomes",
    heroBenefitFreeTitle: "Tasuta müük",
    heroBenefitFreeText: "ostjale",
    heroBenefitFastTitle: "Kiirelt müüki",
    heroBenefitFastText: "mõne minutiga",
    heroBenefitServiceTitle: "Teenindame",
    heroBenefitServiceText: "Soomes ja Põhjamaades",
    sellPromoTitle: "Müü varuosi 2 minutiga",
    sellPromoBulletOne: "Lisa pildid",
    sellPromoBulletTwo: "Kirjuta andmed",
    sellPromoBulletThree: "Avalda tasuta",
    addListingNow: "Lisa kuulutus nüüd",
    instructions: "Juhised",
    sellGuideTitle: "Kuidas varuosi müüa",
    sellGuideStepOne: "Lisa selged pildid varuosast ja võimalikust osanumbrist.",
    sellGuideStepTwo: "Kirjuta mark, mudel, seisukord, hind ja asukoht.",
    sellGuideStepThree: "Avalda kuulutus — ostjad saavad sinuga ühendust võtta.",
    sellGuideStepFour: "Lepi makse ja tarne turvaliselt sõnumites kokku.",
    brandTagline: "Kõik osad. Kõigilt. Sulle.",
    searchLabel: "Otsing",
    searchCta: "Otsi",
    searchPlaceholder: "Otsi varuosi, marki või mudelit...",
    vehicleSelection: "Sõiduki valik",
    content: "Sisu",
    popularProducts: "Populaarsed tooted",
    viewAll: "Vaata kõiki ›",
    noListings: "Kuulutusi pole kuvada",
    loadingListings: "Laadin kuulutusi...",
    changeFilters: "Eemalda filtrid või muuda otsingut.",
    resetFilters: "Lähtesta filtrid",
    openListing: "Ava",
    removeFavorite: "Eemalda lemmikutest",
    addFavorite: "Lisa lemmikutesse",
    country: "Soome",
    viewProfile: "Vaata profiili",
    sendEmail: "Saada e-kiri",
    filters: "Filtrid",
    sort: "Sortimine",
    relevance: "Asjakohasemad ees",
    newest: "Uusimad ees",
    oldest: "Vanemad ees",
    lowestPrice: "Madalaim hind",
    highestPrice: "Kõrgeim hind",
    nearest: "Lähim sinule",
    brand: "Mark",
    model: "Mudel",
    year: "Aasta",
    yearPlaceholder: "nt 2018",
    priceRange: "Hinnaklass",
    minimum: "Miinimum",
    maximum: "Maksimum",
    categories: "Kategooriad",
    categoryPlaceholder: "Otsi kategooriat...",
    all: "Kõik",
    language: "Keel",
    snowmobiles: "Mootorsaanid",
    atvs: "ATV-d",
    cars: "Motocross",
    mopeds: "Mopeedid",
    garageTitle: "Minu Garaaž",
    garageAddVehicle: "Lisa sõiduk",
    garagePartsFor: "Osad sõidukile",
    saTitle: "Otsinguvahid",
    loginToCreateListing: "Logi sisse kuulutuse loomiseks",
    rewards: "Auhinnad",
    shop: "Pood",
    notifications: "Teavitused",
    reviews: "Hinnangud",
    reviewSeller: "Hinda müüjat",
    openReview: "Ava hinnang",
    dismiss: "Eemalda",
    noNotifications: "Uusi teavitusi pole.",
    sellParts: "Müü osi",
    forYou: "Soovitused sulle",
    basedOnBrowsing: "Põhineb sirvimisajaloole",
    showMoreListings: "Näita rohkem kuulutusi",
    newBadge: "Uus",
    allListings: "Kõik kuulutused",
    selectedVehicle: "Valitud sõiduk",
    openCategories: "Ava kategooriad",
    sellerLevel: "Müüja level",
    level: "Level",
    xpToNextLevel: "järgmise levelini",
    maxLevel: "Maksimaalne tase"
  }
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
  no: {
    Moottori: "Motor",
    Voimansiirto: "Drivverk",
    "Voimansiirron osat": "Drivverksdeler",
    Alusta: "Understell",
    Sähkö: "Elektrisk",
    Sisusta: "Interiør",
    Runko: "Ramme",
    "Runko & katteet": "Ramme & deksler",
    Jarrut: "Bremser",
    Sytytys: "Tenning",
    Suodattimet: "Filtre",
    Tiivisteet: "Pakninger",
    Hihnat: "Reimer",
    Ketjut: "Kjeder",
    Variaattori: "Variator",
    Iskunvaimentimet: "Støtdempere",
    Laakerit: "Lagre",
    Akku: "Batteri",
    Valot: "Lys",
    Johdotus: "Ledninger",
    Jäähdytys: "Kjøling",
    Anturit: "Sensorer",
    Penkit: "Seter",
    Matot: "Matter",
    Elektroniikka: "Elektronikk",
    Sylinteri: "Sylinder",
    Kaasutin: "Forgasser",
    Rattaat: "Drev",
    Kytkin: "Clutch",
    Katteet: "Deksler",
    Ohjaustanko: "Styre",
    Ohjaus: "Styring"
  },
  et: {}
};
*/

/* ======================================================
   CATEGORIES
====================================================== */

// Vehicle types are dynamic via taxonomy. Keep VehicleType permissive.
type VehicleType = string;
type VehicleFilter = string;

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
  trackMatDimensionQuery: string;
  minPrice: number;
  maxPrice: number;
  garageFilterId: string;
};

const modelPlaceholders: Record<string, string> = {
  Moottorikelkka: "e.g. Lynx 600",
  Mönkijä: "e.g. Can-Am Outlander",
  Motocross: "e.g. YZ 250 / CRF 450",
  Mopot: "e.g. Yamaha DT",
  Mopo: "e.g. Yamaha DT"
};

function normalizeCategoryMatch(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "moottori") return "moottori & voimansiirto";
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
  selectedSubcategory?: string | null
) {
  if (!selectedSubcategory) return true;

  const listingValue = listingSubcategory ?? "";
  const selectedValue = selectedSubcategory ?? "";
  const normalizedListing = normalizeSubcategoryMatch(listingValue);
  const normalizedSelected = normalizeSubcategoryMatch(selectedValue);

  if (normalizedListing === normalizedSelected) return true;

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

function textMatchesSearch(haystack: string, needle: string) {
  const normalizedNeedle = normalizeSearchText(needle);

  if (!normalizedNeedle) return true;

  const normalizedHaystack = normalizeSearchText(haystack);

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
  const knownVehicleTypes = ["Mopo", "Motocross", "Moottorikelkka", "Mönkijä"];
  if (stored && knownVehicleTypes.includes(stored)) {
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

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    () => mergeCategorySources(partsCategories, vehicleCategories),
    [partsCategories, vehicleCategories]
  );
  const taxonomyVehicleLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const vehicle of taxonomy.vehicles) {
      labels[vehicle.key] = vehicle.label || vehicle.pillLabel || vehicle.key;
    }
    return labels;
  }, [taxonomy]);

  const resultsRef = useRef<HTMLElement | null>(null);
  const favoritesHydrated = useRef(false);
  const listingsPageFetchRef = useRef(false);
  const garageUrlFilterAppliedRef = useRef(false);

  const [locale, setLocale] = useState<Locale>("fi");
  const [localeReady, setLocaleReady] = useState(false);

  const [listings, setListings] = useState<Listing[]>(fallbackListings);
  const [listingsLoading, setListingsLoading] = useState(fallbackListings.length === 0);
  const [listingsTotalCount, setListingsTotalCount] = useState<number | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);

  const [query, setQuery] = useState("");
  const [compactHeroSearch, setCompactHeroSearch] = useState(false);
  const [homeSearchPanelOpen, setHomeSearchPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 720px)").matches;
  });
  const [mobileFilterExpanded, setMobileFilterExpanded] = useState(false);
  const [mobileFilterDragOffset, setMobileFilterDragOffset] = useState(0);
  const mobileFilterDragStartRef = useRef<number | null>(null);
  const mobileSheetFormRef = useRef<HTMLDivElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [listingsExpanded, setListingsExpanded] = useState(false);
  const [catalogOnlyView, setCatalogOnlyView] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState("");
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [mobilePagination, setMobilePagination] = useState(false);
  const PAGE_SIZE = 40;
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
  const [yearQuery, setYearQuery] = useState("");
  const [yearMinQuery, setYearMinQuery] = useState("");
  const [yearMaxQuery, setYearMaxQuery] = useState("");
  const [engineCcQuery, setEngineCcQuery] = useState("");
  const [engineModelQuery, setEngineModelQuery] = useState("");
  const [trackMatDimensionQuery, setTrackMatDimensionQuery] = useState("");

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);
  const [appliedListingFilters, setAppliedListingFilters] = useState<AppliedListingFilters>({
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
    trackMatDimensionQuery: "",
    minPrice: 0,
    maxPrice: 100000,
    garageFilterId: ""
  });

  const [sort, setSort] = useState<SortValue>("Osuvimmat ensin");
  const [recommendationsMode, setRecommendationsMode] = useState(true);
  const [homeSortOpen, setHomeSortOpen] = useState(false);
  const [homeLatestExpanded, setHomeLatestExpanded] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  useEffect(() => {
    if (!compactHeroSearch || !homeSearchPanelOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyTouchAction = document.body.style.touchAction;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    const lockedScrollY = window.scrollY;

    document.body.dataset.homeSearchLocked = "true";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.width = "100%";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      delete document.body.dataset.homeSearchLocked;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.touchAction = previousBodyTouchAction;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      window.scrollTo(0, lockedScrollY);
    };
  }, [compactHeroSearch, homeSearchPanelOpen]);

  useEffect(() => {
    const openMobileFilters = () => {
      setMobileFilterExpanded(false);
      setActiveHeroFilter(null);
      setHomeSearchPanelOpen(true);
    };

    window.addEventListener("maskines-open-home-filters", openMobileFilters);

    try {
      if (sessionStorage.getItem("maskinesOpenHomeFilters") === "1") {
        sessionStorage.removeItem("maskinesOpenHomeFilters");
        window.requestAnimationFrame(openMobileFilters);
      }
    } catch {
      /* Session storage may be unavailable in restricted browser contexts. */
    }

    return () => window.removeEventListener("maskines-open-home-filters", openMobileFilters);
  }, []);

  const [user, setUser] = useState<User | null>(null);
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

  useEffect(() => {
    let suppressRailClick = false;

    const handleRailToggle = (event: Event) => {
      if (event.type === "click" && suppressRailClick) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        suppressRailClick = false;
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) return;

      if (target.closest('[class*="heroRailEdgeToggle"]')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (event.type === "pointerdown" || event.type === "mousedown") {
          suppressRailClick = true;
          setHomeSearchPanelOpen(false);
        } else if (suppressRailClick) {
          suppressRailClick = false;
        }
        return;
      }

      if (target.closest('[class*="heroRailClosedButton"]')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (event.type === "pointerdown" || event.type === "mousedown") {
          suppressRailClick = true;
          setHomeSearchPanelOpen(true);
        } else if (suppressRailClick) {
          suppressRailClick = false;
        }
      }
    };

    document.addEventListener("pointerdown", handleRailToggle, true);
    document.addEventListener("mousedown", handleRailToggle, true);
    document.addEventListener("click", handleRailToggle, true);

    return () => {
      document.removeEventListener("pointerdown", handleRailToggle, true);
      document.removeEventListener("mousedown", handleRailToggle, true);
      document.removeEventListener("click", handleRailToggle, true);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const syncMobilePagination = () => setMobilePagination(media.matches);

    syncMobilePagination();
    media.addEventListener("change", syncMobilePagination);

    return () => {
      media.removeEventListener("change", syncMobilePagination);
    };
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
          trackMatDimensionQuery,
          minPrice,
          maxPrice,
          sort,
          recommendationsMode,
          garageFilterId: garageFilter?.id ?? "",
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
    trackMatDimensionQuery,
    garageFilter?.id,
    identifierQuery,
    locationQuery,
    maxPrice,
    minPrice,
    modelQuery,
    query,
    recommendationsMode,
    selectedBrand,
    sort,
    subcategory,
    vehicleType,
    vehicleSubtype,
    yearQuery
  ]);

  const openListing = useCallback((listing: Listing) => {
    saveHomeReturnState();
    updateCachedListing(listing);
    router.push(listingPath(listingUrlId(listing), locale));
  }, [locale, router, saveHomeReturnState]);

  const openListingFromCard = useCallback((event: React.MouseEvent, listing: Listing) => {
    const target = event.target;
    if (target instanceof Element && target.closest("button")) return;
    openListing(listing);
  }, [openListing]);

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
        trackMatDimensionQuery?: string;
        minPrice?: number;
        maxPrice?: number;
        sort?: SortValue;
        recommendationsMode?: boolean;
        garageFilterId?: string;
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
      setTrackMatDimensionQuery(saved.trackMatDimensionQuery ?? "");
      setMinPrice(typeof saved.minPrice === "number" ? saved.minPrice : 0);
      setMaxPrice(typeof saved.maxPrice === "number" ? saved.maxPrice : 100000);
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
        trackMatDimensionQuery: saved.trackMatDimensionQuery ?? "",
        minPrice: typeof saved.minPrice === "number" ? saved.minPrice : 0,
        maxPrice: typeof saved.maxPrice === "number" ? saved.maxPrice : 100000,
        garageFilterId: saved.garageFilterId ?? ""
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
    const media = window.matchMedia("(max-width: 720px), (pointer: coarse)");
    const syncCompactSearch = () => {
      const isMobileSearch = media.matches || window.innerWidth <= 720;
      setCompactHeroSearch(isMobileSearch);
      if (isMobileSearch) setHomeSearchPanelOpen(false);
    };

    syncCompactSearch();
    media.addEventListener("change", syncCompactSearch);

    return () => media.removeEventListener("change", syncCompactSearch);
  }, []);

  const openMobileHomeSearchSheet = useCallback(() => {
    const isMobileSearch = typeof window !== "undefined"
      ? window.matchMedia("(max-width: 720px), (pointer: coarse)").matches || window.innerWidth <= 720
      : compactHeroSearch;

    if (isMobileSearch) {
      setCompactHeroSearch(true);
      setMobileFilterExpanded(false);
    }

    setHomeSearchPanelOpen(true);
    setActiveHeroFilter(null);
  }, [compactHeroSearch]);

  const handleHeroMainSearchButtonClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    const isMobileSearch = typeof window !== "undefined"
      ? window.matchMedia("(max-width: 720px), (pointer: coarse)").matches || window.innerWidth <= 720
      : compactHeroSearch;

    if (!isMobileSearch) return;

    event.preventDefault();
    openMobileHomeSearchSheet();
  }, [compactHeroSearch, openMobileHomeSearchSheet]);

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
    setTrackMatDimensionQuery("");
    setCategory("");
    setSubcategory("");
    setOpenCategory(null);
    setCategorySearch("");
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
      trackMatDimensionQuery: "",
      minPrice: 0,
      maxPrice: 100000,
      garageFilterId: ""
    });
    setActiveHeroFilter(null);
    setGarageDropdownOpen(false);
    setCurrentPage(1);
    setListingsExpanded(false);
    setCatalogOnlyView(false);
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
      setCatalogOnlyView(false);
      setCurrentPage(1);
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    return () => window.removeEventListener("maskines-show-all-listings", openAllListings);
  }, []);

  function applyListingFilters() {
    setAppliedListingFilters({
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
      trackMatDimensionQuery,
      minPrice,
      maxPrice,
      garageFilterId: garageFilter?.id ?? ""
    });
    setRecommendationsMode(false);
    setListingsExpanded(true);
    setCatalogOnlyView(true);
    setActiveHeroFilter(null);
    setCurrentPage(1);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  const activeFilterSignature = useMemo(() => (
    JSON.stringify({
      ...appliedListingFilters,
      sort,
      recommendationsMode
    })
  ), [
    appliedListingFilters,
    sort,
    recommendationsMode
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilterSignature]);

  const translateCategoryLabel = useCallback((value: string) => {
    return translateCategory(locale, value);
  }, [locale]);

  const translateVehicleTypeLabel = useCallback((value?: string | null) => {
    const vehicleTranslations: Record<Locale, Record<string, string>> = {
      fi: {
        Moottorikelkka: "Moottorikelkka",
        Mönkijä: "Mönkijä",
        Motocross: "Motocross",
        Mopot: "Mopot"
      },
      en: {
        Moottorikelkka: "Snowmobile",
        Mönkijä: "ATV",
        Motocross: "Motocross",
        Mopot: "Moped"
      },
      sv: {
        Moottorikelkka: "Snöskoter",
        Mönkijä: "ATV",
        Motocross: "Motocross",
        Mopot: "Moped"
      },
      no: {
        Moottorikelkka: "Snøscooter",
        Mönkijä: "ATV",
        Motocross: "Motocross",
        Mopot: "Moped"
      },
      et: {
        Moottorikelkka: "Mootorsaan",
        Mönkijä: "ATV",
        Motocross: "Motokross",
        Mopot: "Mopeed"
      }
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

  function formatDate(date: string) {
    const locales: Record<Locale, string> = {
      fi: "fi-FI",
      en: "en-US",
      sv: "sv-SE",
      no: "nb-NO",
      et: "et-EE"
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
        (cachedListings.length > 0 ? cachedListings : fallbackListings)
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
  }, [router]);

  useEffect(() => {
    const urlLocale = new URLSearchParams(window.location.search).get("lang");

    if (isLocale(urlLocale)) {
      setLocale(urlLocale);
      applyLocale(urlLocale);
    } else {
      const storedLocale = localStorage.getItem("locale");

      if (isLocale(storedLocale)) {
        setLocale(storedLocale);
      }
    }

    setLocaleReady(true);
  }, []);

  useEffect(() => {
    if (!localeReady) return;
    applyLocale(locale);
  }, [locale, localeReady]);

  // Listen for locale changes triggered elsewhere (e.g. BottomNav on mobile)
  // so this page's translations update without a reload.
  useEffect(() => {
    function handleLocaleChange(event: Event) {
      const next = (event as CustomEvent<Locale>).detail;
      if (isLocale(next)) {
        setLocale(next);
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

  const buildFilteredListings = useCallback((filters: AppliedListingFilters) => {
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
      trackMatDimensionQuery: appliedTrackMatDimensionQuery,
      minPrice: appliedMinPrice,
      maxPrice: appliedMaxPrice,
      garageFilterId: appliedGarageFilterId
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

    return listings
      .filter(isPublicListing)
      .filter((listing) => {
        const listingText = getListingText(listing);
        const listingPartNumber = getListingPartNumber(listing);
        const listingVehicleSubtypeText = getListingVehicleSubtypeText(listing, listingText);
        const search = `
          ${listingText.title}
          ${listingText.description}
          ${listing.description ?? ""}
          ${listing.brand ?? ""}
          ${listing.model ?? ""}
          ${listing.part_model ?? ""}
          ${listingVehicleSubtypeText}
          ${listing.engine_cc ?? ""}
          ${listingPartNumber}
          ${listing.location}
        `;

        const directPartNumberMatch =
          Boolean(appliedQuery) &&
          Boolean(listingPartNumber) &&
          textMatchesSearch(listingPartNumber, appliedQuery);

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
          normalizeCategoryMatch(listing.category) === normalizeCategoryMatch(appliedCategory);

        const matchesSubcategory =
          listingMatchesSubcategoryFilter(listing.subcategory, appliedSubcategory);

        const matchesBrand =
          brandMatchesListing(appliedSelectedBrand, listing, listingText);

        const matchesModel =
          !appliedModelQuery ||
          allSearchWordsMatch(
            `${listing.model ?? ""} ${listing.part_model ?? ""} ${listingText.title} ${listingText.description} ${listingPartNumber}`,
            appliedModelQuery
          );

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

        const matchesLocation =
          !appliedLocationQuery.trim() ||
          textMatchesSearch(listing.location, appliedLocationQuery);

        const matchesEngineCc =
          !appliedEngineCcQuery ||
          textMatchesSearch(listing.engine_cc ?? "", appliedEngineCcQuery);

        const matchesEngineModel =
          !appliedEngineModelQuery ||
          textMatchesSearch(listing.engine_model ?? "", appliedEngineModelQuery);

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
        const matchesQuery =
          !appliedQuery ||
          allSearchWordsMatch(search, appliedQuery) ||
          (matchesCompatibleFitment && allSearchWordsMatch(search, compatibleQuery));

        const matchesVehicleIdentity =
          matchesCompatibleFitment ||
          (matchesBrand && matchesModel && matchesYear && matchesEngineModel);

        const matchesPrice =
          listing.price >= appliedMinPrice &&
          listing.price <= appliedMaxPrice;

        if (directPartNumberMatch) {
          return matchesPrice;
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
          matchesTrackMatDimension &&
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
    trackMatDimensionQuery,
    minPrice,
    maxPrice,
    garageFilterId: garageFilter?.id ?? ""
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
    trackMatDimensionQuery,
    minPrice,
    maxPrice,
    garageFilter?.id
  ]);

  const filteredListings = useMemo(
    () => buildFilteredListings(appliedListingFilters),
    [appliedListingFilters, buildFilteredListings]
  );

  const draftListingResultCount = useMemo(
    () => buildFilteredListings(currentDraftListingFilters).length,
    [buildFilteredListings, currentDraftListingFilters]
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

      if (user) {
        void (wasFavorite ? unsaveListing(listingId) : saveListing(listingId));
      }

      return next;
    });
  }, [user]);

  function toggleFavorite(
    event: React.MouseEvent,
    listingId: string
  ) {
    event.preventDefault();
    event.stopPropagation();
    toggleFavoriteById(listingId);
  }

  useEffect(() => {
    const handleHomeLatestFavorite = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>("[data-home-latest-favorite]");
      if (!button) return;

      const listingId = button.dataset.listingId;
      if (!listingId) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleFavoriteById(listingId);
    };

    document.addEventListener("click", handleHomeLatestFavorite, true);

    return () => {
      document.removeEventListener("click", handleHomeLatestFavorite, true);
    };
  }, [toggleFavoriteById]);

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
      trackMatDimensionQuery: "",
      minPrice: 0,
      maxPrice: 100000,
      garageFilterId: ""
    });
    setActiveHeroFilter(null);
    setRecommendationsMode(false);
    setCurrentPage(1);
  }, [searchParams]);

  useEffect(() => {
    const categoryParam = searchParams.get("category")?.trim() ?? "";
    const brandParam = searchParams.get("brand")?.trim() ?? "";
    const modelParam = searchParams.get("model")?.trim() ?? "";
    const vehicleTypeParam = searchParams.get("vehicleType")?.trim() as VehicleFilter;

    if (!categoryParam && !brandParam && !modelParam && !vehicleTypeParam) return;

    setGarageDropdownOpen(false);
    setGarageFilter(null);
    setQuery("");
    setCategory(categoryParam);
    setSubcategory("");
    setSelectedBrand(brandParam || "Kaikki");
    setVehicleType(vehicleTypeParam || "");
    setModelQuery(modelParam);
    setYearQuery("");
    setYearMinQuery("");
    setYearMaxQuery("");
    setEngineCcQuery("");
    setEngineModelQuery("");
    setAppliedListingFilters({
      query: "",
      category: categoryParam,
      subcategory: "",
      vehicleType: vehicleTypeParam || "",
      vehicleSubtype: "",
      selectedBrand: brandParam || "Kaikki",
      modelQuery: modelParam,
      identifierQuery: "",
      locationQuery: "",
      yearQuery: "",
      yearMinQuery: "",
      yearMaxQuery: "",
      engineCcQuery: "",
      engineModelQuery: "",
      trackMatDimensionQuery: "",
      minPrice: 0,
      maxPrice: 100000,
      garageFilterId: ""
    });
    setActiveHeroFilter(null);
    setRecommendationsMode(false);
    setListingsExpanded(true);
    setCatalogOnlyView(false);
    setCurrentPage(1);

    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    Boolean(engineModelQuery.trim()) ||
    Boolean(trackMatDimensionQuery.trim()) ||
    minPrice !== 0 ||
    maxPrice !== 100000;
  const showListingResultsSection =
    catalogOnlyView;

  const canShowRecommendations = false;

  const recommendationsEnabled = false;

  const canUseRemoteListingPages =
    !hasActiveListingFilters &&
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
      className={`${className} ${styles.sortControlRebuilt} ${homeSortOpen ? styles.sortControlOpen : ""}`}
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
        className={styles.sortButtonFace}
        data-testid="home-sort-select"
        onClick={() => setHomeSortOpen((open) => !open)}
      >
        <ActiveSortIcon size={16} aria-hidden="true" />
        <span>{activeSortOption?.label ?? sortLabel(sort)}</span>
        <ChevronDown size={16} className={styles.sortButtonChevron} aria-hidden="true" />
      </button>
      {homeSortOpen && (
        <div className={styles.sortMenuPanel} role="menu">
          {sortMenuOptions.map((option) => {
            const Icon = option.icon;
            const selected = option.value === activeSortValue;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`${styles.sortMenuItem} ${selected ? styles.sortMenuItemActive : ""}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  selectSortOption(option.value);
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
      recommendationsEnabled
        ? currentPage === 1
          ? RECOMMENDED_PREVIEW_SIZE
          : (currentPage - 1) * PAGE_SIZE
        : currentPage * PAGE_SIZE;

    if (requiredListings <= listings.length) return;

    listingsPageFetchRef.current = true;
    const offset = listings.length;
    const limit = Math.max(PAGE_SIZE * 3, requiredListings - listings.length);
    let cancelled = false;

    getListings({
      includeOptionalFields: false,
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
        console.warn("LisÃ¤ilmoitusten lataus epÃ¤onnistui.", error);
      })
      .finally(() => {
        listingsPageFetchRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [
    canUseRemoteListingPages,
    currentPage,
    firstPageListingSlots,
    listings.length,
    listingsLoading,
    listingsTotalCount,
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
    const sourceListings = hasActiveListingFilters
      ? filteredListings
      : listings.filter(isPublicListing);

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
      })
      .slice(0, 12);
  }, [filteredListings, hasActiveListingFilters, listings, sort, userLocationTerms]);

  const compactLatestListings = heroLatestListings.slice(0, homeLatestExpanded ? 12 : 4);

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
    if (!trackMatDimensionFieldVisible && trackMatDimensionQuery) {
      setTrackMatDimensionQuery("");
    }
  }, [trackMatDimensionFieldVisible, trackMatDimensionQuery]);

  const sharedFilterOptions = useMemo(
    () => buildMarketplaceFilterOptions({
      taxonomyVehicles: taxonomy.vehicles,
      vehicleBrands,
      vehicleCategories,
      allVehicleCategories,
      vehicleType,
      brand: selectedBrand === "Kaikki" ? "" : selectedBrand,
      model: modelQuery,
      category,
      subcategoryParent: selectedSubcategoryParent
    }),
    [allVehicleCategories, category, modelQuery, selectedBrand, selectedSubcategoryParent, taxonomy.vehicles, vehicleBrands, vehicleCategories, vehicleType]
  );

  const categorySource = useMemo(() => {
    return buildMarketplaceCategorySource({ vehicleType, vehicleCategories, allVehicleCategories });
  }, [allVehicleCategories, vehicleCategories, vehicleType]);

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

  const modelOptions = useMemo(() => sharedFilterOptions.models, [sharedFilterOptions.models]);

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
    if (taxonomyVehicleLabels[vehicle]) return taxonomyVehicleLabels[vehicle];
    if (vehicle === "Moottorikelkka") return t.snowmobiles;
    if (vehicle === "Mönkijä") return t.atvs;
    if (vehicle === "Motocross") return t.cars;
    if (vehicle === "Mopot" || vehicle === "Mopo") return t.mopeds;
    return vehicle;
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
      label: "Ajoneuvolaji",
      value: vehicleType ? getVehiclePillLabel(vehicleType) : "Kaikki ajoneuvot",
      options: [
        { label: "Kaikki ajoneuvot", value: "" },
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
        setCategory("");
        setSubcategory("");
        afterHeroFilterChange();
      }
    },
    {
      key: "vehicleSubtype",
      label: "Tyyppi",
      value: vehicleSubtype || "Kaikki tyypit",
      options: [
        { label: "Kaikki tyypit", value: "" },
        ...vehicleSubtypeOptions.map((option) => ({ label: option, value: option }))
      ],
      onSelect: (value: string) => {
        setVehicleSubtype(value);
        afterHeroFilterChange();
      }
    },
    {
      key: "brand",
      label: "Merkki",
      value: selectedBrand && selectedBrand !== "Kaikki" ? selectedBrand : "Kaikki merkit",
      options: brandOptions.map((option) => ({
        label: option === "Kaikki" ? "Kaikki merkit" : option,
        value: option
      })),
      onSelect: (value: string) => {
        setSelectedBrand(value || "Kaikki");
        setModelQuery("");
        afterHeroFilterChange();
      }
    },
    {
      key: "model",
      label: "Malli",
      value: modelQuery || "Kaikki mallit",
      options: [
        { label: "Kaikki mallit", value: "" },
        ...modelOptions.map((option) => ({ label: option, value: option }))
      ],
      onSelect: (value: string) => {
        setModelQuery(value);
        afterHeroFilterChange();
      }
    },
    {
      key: "engineCc",
      label: "Moottoritilavuus (cm³)",
      value: engineCcQuery || "Kaikki koot",
      options: [
        { label: "Kaikki koot", value: "" },
        ...engineCcOptions.map((option) => ({ label: option, value: option }))
      ],
      onSelect: (value: string) => {
        setEngineCcQuery(value);
        afterHeroFilterChange();
      }
    },
    {
      key: "engineModel",
      label: "Moottori",
      value: engineModelQuery || "Kaikki moottorit",
      options: [
        { label: "Kaikki moottorit", value: "" },
        ...engineModelOptions.map((option) => ({ label: option, value: option }))
      ],
      onSelect: (value: string) => {
        setEngineModelQuery(value);
        afterHeroFilterChange();
      }
    },
    {
      key: "category",
      label: "Pääkategoria",
      value: category || "Valitse pääkategoria",
      options: [
        { label: "Kaikki kategoriat", value: "" },
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
      label: "Alakategoria",
      value: selectedSubcategoryParent || "Valitse alakategoria",
      options: [
        { label: "Kaikki alakategoriat", value: "" },
        ...subcategoryParentOptions.map((option) => ({ label: translateCategoryLabel(option), value: option }))
      ],
      onSelect: (value: string) => {
        setSubcategory(value);
        if (isTrackMatSelection(value)) {
          setActiveHeroFilter("trackMatDimension");
          window.setTimeout(() => {
            document.getElementById("mobile-track-mat-dimension")?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }, 0);
        } else {
          setTrackMatDimensionQuery("");
        }
        afterHeroFilterChange();
      }
    },
    {
      key: "detailSubcategory",
      label: "Tarkempi osa",
      value: selectedSubcategoryLeaf || (
        isTrackMatSelection(subcategory)
          ? "Telamatot"
          : subcategory
            ? "Kaikki tarkemmat osat"
            : "Valitse tarkempi osa"
      ),
      options: [
        { label: "Kaikki tarkemmat osat", value: selectedSubcategoryParent || "" },
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
          setActiveHeroFilter("trackMatDimension");
        } else {
          setTrackMatDimensionQuery("");
        }
        afterHeroFilterChange();
      }
    }
  ];

  const heroRailFilterFields = heroFilterFields.filter((field) =>
    ["vehicleType", "vehicleSubtype", "brand", "model"].includes(field.key)
  );
  const heroRailEngineFields = heroFilterFields.filter((field) =>
    ["engineCc", "engineModel"].includes(field.key)
  );
  const heroRailPartCategoryFields = heroFilterFields.filter((field) =>
    ["category", "subcategory", "detailSubcategory"].includes(field.key)
  );

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
    <main className={styles.shell}>
      {!catalogOnlyView ? (
      <>
      <div className={styles.heroWrap}>
        <div className={styles.container}>
        <section className={styles.hero} aria-label="Hero">
          <div className={styles.heroInner}>
            <div className={styles.heroLeadPanel}>
              <h1 className={styles.heroHeadline}>
                <span style={{ display: "block", width: "100%" }}>Suomen suurin</span>
                <span style={{ display: "block", width: "100%" }}><span className={styles.heroHeadlineAccent}>käytettyjen varaosien</span>{" "}markkinapaikka</span>
              </h1>
              <p className={styles.heroReferenceSubtitle}>{t.heroSubtitle}</p>
              <div className={styles.heroDesktopActions}>
                <button
                  type="button"
                  className={styles.heroStartSearchButton}
                  onClick={() => {
                    setHomeSearchPanelOpen(true);
                    setActiveHeroFilter("vehicleType");
                  }}
                >
                  Aloita haku
                </button>
                <span className={styles.heroTrustMini}>
                  <ShieldCheck size={17} aria-hidden="true" />
                  Turvallinen kaupankäynti
                </span>
              </div>

              <div className={styles.heroMainSearchPanel}>
                <form
                  className={styles.heroMainSearch}
                  role="search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    applyListingFilters();
                  }}
                >
                  <span className={styles.heroMainSearchIcon} aria-hidden="true">
                    <Search size={16} />
                  </span>
                  <input
                    className={styles.heroMainSearchInput}
                    type="search"
                    placeholder={t.searchPlaceholder}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }}
                    aria-label={t.searchLabel}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                  />
                  <button
                    type={compactHeroSearch ? "button" : "submit"}
                    className={styles.heroMainSearchButton}
                    aria-label={compactHeroSearch ? "Avaa suodatus" : "Hae"}
                    onClick={handleHeroMainSearchButtonClick}
                  >
                    <Search size={18} aria-hidden="true" />
                    <span>Hae</span>
                  </button>
                </form>
              </div>

              <button
                type="button"
                className={styles.heroMobileFilterToggle}
                onClick={openMobileHomeSearchSheet}
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
                <span>{homeSearchPanelOpen ? "Sulje suodatus" : "Suodata"}</span>
              </button>

              <div className={styles.heroDesktopLatest}>
                <div className={styles.heroDesktopLatestHead}>
                  <strong>Viimeisimmät ilmoitukset</strong>
                  <div className={styles.heroDesktopLatestActions}>
                    {homeLatestExpanded ? renderSortControl(styles.heroDesktopLatestSort) : null}
                    {!homeLatestExpanded ? (
                      <button
                        type="button"
                        onClick={() => setHomeLatestExpanded(true)}
                      >
                        Näytä kaikki
                      </button>
                    ) : null}
                  </div>
                </div>
                <div
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
                        className={styles.heroDesktopLatestCard}
                        role="link"
                        tabIndex={0}
                        onClick={(event) => openListingFromCard(event, listing)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openListing(listing);
                          }
                        }}
                      >
                        <span className={styles.heroDesktopLatestImage}>
                          <OptimizedListingImage src={listingImageSrc(listing)} alt={listingText.title} />
                          <button
                            type="button"
                            data-home-latest-favorite="true"
                            data-listing-id={listing.id}
                            className={`${styles.heroDesktopFavorite} ${
                              isFavorite ? styles.heroDesktopFavoriteActive : ""
                            }`}
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
                          >
                            <Heart size={17} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
                          </button>
                        </span>
                        <span className={styles.heroDesktopLatestPrice}>{formatPrice(listing.price)}</span>
                        <span className={styles.heroDesktopLatestTop}>
                          <strong>{listingText.title}</strong>
                        </span>
                        <span className={styles.heroDesktopLatestModel}>
                          {[listing.brand, listing.model].filter(Boolean).join(" ") || listing.category || "Varaosa"}
                        </span>
                        <span className={styles.heroDesktopLatestMeta} data-home-latest-meta>
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
                        </span>
                      </article>
                    );
                  })}
                </div>
              </div>
              {!homeLatestExpanded ? (
                <div className={styles.heroReferenceBenefits} aria-label="Palvelun edut">
                  <span>
                    <ShieldCheck size={30} aria-hidden="true" />
                    <strong>Turvallista kaupankäyntiä</strong>
                    <small>Varmista turvallinen kauppa ilmoitusten avulla.</small>
                  </span>
                  <span>
                    <Gift size={30} aria-hidden="true" />
                    <strong>Ilmainen käyttää kaikille</strong>
                    <small>Selaa ja julkaise ilmoituksia maksutta.</small>
                  </span>
                  <span>
                    <Search size={30} aria-hidden="true" />
                    <strong>Helppo ja nopea</strong>
                    <small>Löydä, vertaa ja osta vaivattomasti.</small>
                  </span>
                  <span>
                    <Check size={30} aria-hidden="true" />
                    <strong>Apua saatavilla</strong>
                    <small>Asiakastuki auttaa sinua jokaisessa vaiheessa.</small>
                  </span>
                </div>
              ) : null}
            </div>

            {compactHeroSearch && homeSearchPanelOpen ? (
              <button
                type="button"
                className={styles.mobileFilterBackdrop}
                aria-label="Sulje suodatus"
                onClick={() => {
                  setHomeSearchPanelOpen(false);
                  setMobileFilterExpanded(false);
                }}
              />
            ) : null}

            {(!compactHeroSearch || homeSearchPanelOpen) ? (
            <aside
              className={`${styles.heroRightRail} ${
                homeSearchPanelOpen ? styles.heroRightRailOpen : styles.heroRightRailClosed
              } ${compactHeroSearch ? styles.mobileFilterSheet : ""} ${
                compactHeroSearch && mobileFilterExpanded ? styles.mobileFilterSheetExpanded : ""
              }`}
              style={
                compactHeroSearch
                  ? ({ "--mobile-sheet-offset": `${mobileFilterDragOffset}px` } as CSSProperties)
                  : homeSearchPanelOpen ? {
                    maxWidth: "410px",
                    right: 0,
                    width: "410px"
                  } as CSSProperties : {
                    maxWidth: "22px",
                    right: 0,
                    width: "22px"
                  } as CSSProperties
              }
            >
              {homeSearchPanelOpen ? (
                <>
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
                          aria-label="Sulje suodatus"
                          onClick={() => {
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
                        <label className={styles.mobileSheetField}>
                          <span>Ilmoituksen ID</span>
                          <input
                            value={identifierQuery}
                            onChange={(event) => {
                              setIdentifierQuery(event.target.value);
                              afterHeroFilterChange();
                            }}
                            placeholder="Hae esim. ID 40"
                            spellCheck={false}
                          />
                        </label>

                        {heroFilterFields.slice(0, 4).map((field) => (
                          <div key={`mobile-${field.key}`} className={styles.mobileSheetField}>
                            <span>{field.label}</span>
                            <button
                              type="button"
                              className={styles.mobileSheetSelect}
                              onClick={(event) => toggleMobileHeroFilter(field.key, event.currentTarget.parentElement ?? event.currentTarget)}
                            >
                              <strong>{field.value}</strong>
                              <ChevronDown size={15} aria-hidden="true" />
                            </button>
                            {activeHeroFilter === field.key ? (
                              <div className={styles.mobileSheetMenu}>
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

                        <div className={styles.mobileSheetField}>
                          <span>Vuosimalli</span>
                          <div className={styles.mobileSheetYearBoxes}>
                            <button
                              type="button"
                              className={styles.mobileSheetSelect}
                              onClick={() => setActiveHeroFilter((current) => current === "yearMin" ? null : "yearMin")}
                            >
                              <strong>{yearMinQuery || "Minimi"}</strong>
                              <ChevronDown size={13} aria-hidden="true" />
                            </button>
                            <span aria-hidden="true">-</span>
                            <button
                              type="button"
                              className={styles.mobileSheetSelect}
                              onClick={() => setActiveHeroFilter((current) => current === "yearMax" ? null : "yearMax")}
                            >
                              <strong>{yearMaxQuery || "Maksimi"}</strong>
                              <ChevronDown size={13} aria-hidden="true" />
                            </button>
                          </div>
                          {activeHeroFilter === "yearMin" || activeHeroFilter === "yearMax" ? (
                            <div className={styles.mobileSheetMenu}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeHeroFilter === "yearMin") setYearMinQuery("");
                                  else setYearMaxQuery("");
                                  setYearQuery("");
                                  setActiveHeroFilter(null);
                                }}
                              >
                                {activeHeroFilter === "yearMin" ? "Minimi" : "Maksimi"}
                              </button>
                              {yearOptions.map((year) => (
                                <button
                                  key={`mobile-${activeHeroFilter}-${year}`}
                                  type="button"
                                  onClick={() => {
                                    if (activeHeroFilter === "yearMin") setYearMinQuery(year);
                                    else setYearMaxQuery(year);
                                    setYearQuery("");
                                    setActiveHeroFilter(null);
                                    afterHeroFilterChange();
                                  }}
                                >
                                  {year}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div
                            className={styles.yearRangeClean}
                            data-year-range-clean="true"
                            data-mobile-year-range="true"
                            ref={yearSliderRef}
                            role="group"
                            aria-label="Vuosimallin rajaus"
                            style={{
                              "--year-min": `${yearMinPercent}%`,
                              "--year-max": `${yearMaxPercent}%`,
                              "--year-mid": `${(yearMinPercent + yearMaxPercent) / 2}%`
                            } as CSSProperties}
                          >
                            <span className={styles.yearRangeCleanLine} aria-hidden="true" />
                            <input
                              type="range"
                              className={`${styles.mobileYearRangeInput} ${styles.mobileYearRangeMin}`}
                              min={YEAR_FILTER_MIN}
                              max={YEAR_FILTER_MAX}
                              step={1}
                              value={selectedYearMin}
                              aria-label="Vuosimallin minimi"
                              onChange={(event) => {
                                const next = Math.min(Number(event.target.value), selectedYearMax);
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
                              aria-label="Vuosimallin maksimi"
                              onChange={(event) => {
                                const next = Math.max(Number(event.target.value), selectedYearMin);
                                setYearMaxQuery(next === YEAR_FILTER_MAX ? "" : String(next));
                                setYearQuery("");
                                afterHeroFilterChange();
                              }}
                            />
                          </div>
                        </div>

                        {heroFilterFields.slice(4).map((field) => (
                          <div key={`mobile-${field.key}`} className={styles.mobileSheetField}>
                            {field.key === "category" ? <b className={styles.mobileSheetSectionTitle}>Osakategoriointi</b> : null}
                            <span>{field.label}</span>
                            <button
                              type="button"
                              className={styles.mobileSheetSelect}
                              onClick={(event) => toggleMobileHeroFilter(field.key, event.currentTarget.parentElement ?? event.currentTarget)}
                            >
                              <strong>{field.value}</strong>
                              <ChevronDown size={15} aria-hidden="true" />
                            </button>
                            {activeHeroFilter === field.key ? (
                              <div className={styles.mobileSheetMenu}>
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

                        {trackMatDimensionFieldVisible ? (
                          <div id="mobile-track-mat-dimension" className={styles.mobileSheetField}>
                            <span>Telamaton pituus</span>
                            <button
                              type="button"
                              className={styles.mobileSheetSelect}
                              onClick={(event) => toggleMobileHeroFilter(
                                "trackMatDimension",
                                event.currentTarget.parentElement ?? event.currentTarget
                              )}
                            >
                              <strong>{trackMatDimensionQuery || "Kaikki pituudet"}</strong>
                              <ChevronDown size={15} aria-hidden="true" />
                            </button>
                            {activeHeroFilter === "trackMatDimension" ? (
                              <div className={styles.mobileSheetMenu}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrackMatDimensionQuery("");
                                    setActiveHeroFilter(null);
                                    afterHeroFilterChange();
                                  }}
                                >
                                  Kaikki pituudet
                                </button>
                                {TRACK_MAT_DIMENSION_OPTIONS.map((option) => (
                                  <button
                                    key={`mobile-track-mat-${option}`}
                                    type="button"
                                    onClick={() => {
                                      setTrackMatDimensionQuery(option);
                                      setActiveHeroFilter(null);
                                      afterHeroFilterChange();
                                    }}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className={styles.mobileSheetActions}>
                          <button
                            type="button"
                            onClick={() => {
                              applyListingFilters();
                              setHomeSearchPanelOpen(false);
                              setMobileFilterExpanded(false);
                            }}
                          >
                            Näytä tulokset ({draftListingResultCount.toLocaleString("fi-FI")})
                          </button>
                          <button type="button" onClick={clearListingFilters}>Tyhjennä hakuehdot</button>
                        </div>
                      </div>
                    </>
                  ) : null}
                  <div className={styles.heroRailHeader}>
                    <strong>Suodata hakua</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.heroRailEdgeToggle}
                    aria-label="Pienennä hakupalkki reunaan"
                    onClickCapture={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.nativeEvent.stopImmediatePropagation();
                      window.setTimeout(() => setHomeSearchPanelOpen(false), 0);
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.nativeEvent.stopImmediatePropagation();
                      setHomeSearchPanelOpen(false);
                    }}
                    onPointerUp={(event) => {
                      event.stopPropagation();
                    }}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      window.setTimeout(() => setHomeSearchPanelOpen(false), 0);
                    }}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                  <div className={styles.heroSearchPanel}>
                    <div className={styles.heroSearchRow}>
                      <form
                        className={`${styles.heroSearch} ${compactHeroSearch ? styles.heroSearchMobile : ""}`}
                        role="search"
                        onSubmit={(event) => {
                          event.preventDefault();
                          applyListingFilters();
                        }}
                      >
                        {compactHeroSearch ? (
                          <button type="submit" className={styles.heroSearchButton} aria-label="Hae">
                            <Search size={18} />
                            <span>Hae</span>
                          </button>
                        ) : null}
                        <input
                          className={styles.heroSearchInput}
                          type="search"
                          placeholder={compactHeroSearch ? "Hae varaosia tai mallia" : t.searchPlaceholder}
                          value={query}
                          onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }}
                          aria-label={t.searchLabel}
                          spellCheck={false}
                          autoCorrect="off"
                          autoCapitalize="none"
                        />
                        {!compactHeroSearch ? (
                          <button type="submit" className={styles.heroSearchButton}>
                            <Search size={18} />
                            <span>Hae</span>
                          </button>
                        ) : null}
                      </form>
                    </div>

                    <div className={styles.heroFilterStack} aria-label="Hakuehdot">
                      <label className={styles.heroIdentifierField}>
                        <span className={styles.heroFilterLabel}>Ilmoituksen ID</span>
                        <input
                          className={styles.heroFilterInput}
                          value={identifierQuery}
                          onChange={(event) => {
                            setIdentifierQuery(event.target.value);
                            afterHeroFilterChange();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              applyListingFilters();
                            }
                          }}
                          placeholder="Hae esim. ID 40"
                          spellCheck={false}
                        />
                      </label>
                      {heroRailFilterFields.map((field) => (
                        <div key={field.key} className={styles.heroFilterFieldWrap}>
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
                      <div className={styles.heroYearRangeField}>
                        <span className={styles.heroYearRangeLabel}>Vuosimalli</span>
                        <div className={styles.heroYearBoxes}>
                          <div className={styles.heroYearSelectWrap}>
                            <button
                              type="button"
                              className={styles.heroYearBox}
                              onClick={() => setActiveHeroFilter((current) => current === "yearMin" ? null : "yearMin")}
                            >
                              <strong>{yearMinQuery || "Minimi"}</strong>
                              <ChevronDown size={13} aria-hidden="true" />
                            </button>
                            {activeHeroFilter === "yearMin" ? (
                              <div className={styles.heroFilterMenu}>
                                <button
                                  type="button"
                                  className={styles.heroFilterMenuOption}
                                  onClick={() => {
                                    setYearMinQuery("");
                                    setYearQuery("");
                                    setActiveHeroFilter(null);
                                  }}
                                >
                                  Minimi
                                </button>
                                {yearOptions.map((year) => (
                                  <button
                                    key={`year-min-${year}`}
                                    type="button"
                                    className={styles.heroFilterMenuOption}
                                    onClick={() => {
                                      setYearMinQuery(year);
                                      setYearQuery("");
                                      setActiveHeroFilter(null);
                                    }}
                                  >
                                    {year}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <span className={styles.heroYearDash} aria-hidden="true">-</span>
                          <div className={styles.heroYearSelectWrap}>
                            <button
                              type="button"
                              className={styles.heroYearBox}
                              onClick={() => setActiveHeroFilter((current) => current === "yearMax" ? null : "yearMax")}
                            >
                              <strong>{yearMaxQuery || "Maksimi"}</strong>
                              <ChevronDown size={13} aria-hidden="true" />
                            </button>
                            {activeHeroFilter === "yearMax" ? (
                              <div className={styles.heroFilterMenu}>
                                <button
                                  type="button"
                                  className={styles.heroFilterMenuOption}
                                  onClick={() => {
                                    setYearMaxQuery("");
                                    setYearQuery("");
                                    setActiveHeroFilter(null);
                                  }}
                                >
                                  Maksimi
                                </button>
                                {yearOptions.map((year) => (
                                  <button
                                    key={`year-max-${year}`}
                                    type="button"
                                    className={styles.heroFilterMenuOption}
                                    onClick={() => {
                                      setYearMaxQuery(year);
                                      setYearQuery("");
                                      setActiveHeroFilter(null);
                                    }}
                                  >
                                    {year}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div
                          className={styles.yearRangeClean}
                          data-year-range-clean="true"
                          ref={yearSliderRef}
                          role="group"
                          aria-label="Vuosimallin rajaus"
                          style={{
                            "--year-min": `${yearMinPercent}%`,
                            "--year-max": `${yearMaxPercent}%`,
                            "--year-mid": `${(yearMinPercent + yearMaxPercent) / 2}%`
                          } as CSSProperties}
                          onMouseDown={startYearRangeMouseDrag}
                        >
                          <span className={styles.yearRangeCleanLine} aria-hidden="true" />
                          <input
                            type="range"
                            className={`${styles.desktopYearRangeInput} ${styles.mobileYearRangeMin}`}
                            min={YEAR_FILTER_MIN}
                            max={YEAR_FILTER_MAX}
                            step={1}
                            value={selectedYearMin}
                            aria-label="Vuosimallin minimi"
                            onChange={(event) => {
                              const next = Math.min(Number(event.target.value), selectedYearMax);
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
                            aria-label="Vuosimallin maksimi"
                            onChange={(event) => {
                              const next = Math.max(Number(event.target.value), selectedYearMin);
                              setYearMaxQuery(next === YEAR_FILTER_MAX ? "" : String(next));
                              setYearQuery("");
                              afterHeroFilterChange();
                            }}
                          />
                        </div>
                      </div>
                      {heroRailEngineFields.map((field) => (
                        <div key={field.key} className={styles.heroFilterFieldWrap}>
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
                    </div>

                    <div className={styles.heroPartCategoryStack} aria-label="Osakategoriointi">
                      <span className={styles.heroPartCategoryTitle}>Osakategoriointi</span>
                      {heroRailPartCategoryFields.map((field) => (
                        <div key={field.key} className={styles.heroFilterFieldWrap}>
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
                      {trackMatDimensionFieldVisible ? (
                        <div className={styles.heroFilterFieldWrap}>
                          <span className={styles.heroFilterLabel}>Telamaton koko</span>
                          <button
                            type="button"
                            className={styles.heroFilterSelect}
                            onClick={() =>
                              setActiveHeroFilter((current) =>
                                current === "trackMatDimension" ? null : "trackMatDimension"
                              )
                            }
                          >
                            <strong>{trackMatDimensionQuery || "Kaikki telamaton koot"}</strong>
                            <ChevronDown size={15} aria-hidden="true" />
                          </button>
                          {activeHeroFilter === "trackMatDimension" ? (
                            <div className={styles.heroFilterMenu}>
                              <button
                                type="button"
                                className={styles.heroFilterMenuOption}
                                onClick={() => {
                                  setTrackMatDimensionQuery("");
                                  setActiveHeroFilter(null);
                                  afterHeroFilterChange();
                                }}
                              >
                                Kaikki telamaton koot
                              </button>
                              {TRACK_MAT_DIMENSION_OPTIONS.map((option) => (
                                <button
                                  key={`track-mat-${option}`}
                                  type="button"
                                  className={styles.heroFilterMenuOption}
                                  onClick={() => {
                                    setTrackMatDimensionQuery(option);
                                    setActiveHeroFilter(null);
                                    afterHeroFilterChange();
                                  }}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.heroRailActions}>
                      <button
                        type="button"
                        className={styles.heroRailSubmit}
                        onClick={() => {
                          applyListingFilters();
                          if (compactHeroSearch) {
                            setHomeSearchPanelOpen(false);
                            setMobileFilterExpanded(false);
                          }
                        }}
                      >
                        Näytä tulokset ({draftListingResultCount.toLocaleString("fi-FI")})
                      </button>
                      <button type="button" className={styles.heroRailClear} onClick={clearListingFilters}>
                        Tyhjennä hakuehdot
                      </button>
                    </div>
                  </div>

                  <div className={styles.heroLatestPanel}>
                    <div className={styles.heroLatestHeader}>
                      <strong>Uusimmat ilmoitukset</strong>
                      {!homeLatestExpanded ? (
                        <button type="button" onClick={showAllListings}>Näytä kaikki</button>
                      ) : null}
                    </div>
                    <div className={styles.heroLatestGrid}>
                      {heroLatestListings.map((listing) => {
                        const listingText = getListingText(listing);
                        return (
                          <button
                            key={listing.id}
                            type="button"
                            className={styles.heroLatestCard}
                            onClick={() => openListing(listing)}
                          >
                            <span className={styles.heroLatestImage}>
                              <OptimizedListingImage src={listingImageSrc(listing)} alt={listingText.title} />
                            </span>
                            <span className={styles.heroLatestInfo}>
                              <strong>{listingText.title}</strong>
                              <span>{formatPrice(listing.price)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.heroRailClosedButton}
                  aria-label="Avaa hakupalkki"
                  onClickCapture={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.nativeEvent.stopImmediatePropagation();
                    window.setTimeout(() => setHomeSearchPanelOpen(true), 0);
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.nativeEvent.stopImmediatePropagation();
                    setHomeSearchPanelOpen(true);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.setTimeout(() => setHomeSearchPanelOpen(true), 0);
                  }}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                  <span>Haku</span>
                </button>
              )}
            </aside>
            ) : null}

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
                        className={styles.card}
                        role="link"
                        tabIndex={0}
                        aria-label={`${t.openListing} ${listingText.title}`}
                        onClick={() => openListing(listing)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openListing(listing);
                          }
                        }}
                      >
                        <div className={`${styles.cardImage} ${styles.listingCardImage}`}>
                          <span className={styles.cardImageBlur} aria-hidden="true">
                            <OptimizedListingImage src={listingImageSrc(listing)} alt="" decorative />
                          </span>
                          <OptimizedListingImage
                            src={listingImageSrc(listing)}
                            alt={listingText.title}
                          />
                          <button
                            onClick={(e) => toggleFavorite(e, listing.id)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteButtonActive : ""}`}
                            type="button"
                            aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                          >
                            <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                          </button>
                        </div>
                        <div className={styles.cardBody}>
                          <p className={styles.cardPrice}>{formatPrice(listing.price)}</p>
                          {listing.vehicle_subtype ? (
                          <div className={styles.badgeRow}>
                            <span className={styles.badge}>Tyyppi {listing.vehicle_subtype}</span>
                          </div>
                          ) : null}
                          <h3 className={styles.cardTitle}>{listingText.title}</h3>
                          <div className={styles.cardMetaRow}>
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
            <div className={styles.appliedFilterActions} aria-label="Suodatetun haun toiminnot">
              <button
                type="button"
                className={styles.appliedFilterClear}
                onClick={() => {
                  clearListingFilters();
                  window.requestAnimationFrame(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  });
                }}
              >
                <RotateCcw size={15} aria-hidden="true" />
                <span>Poista suodatukset</span>
              </button>
              <button
                type="button"
                className={styles.appliedFilterEdit}
                onClick={() => {
                  setHomeSearchPanelOpen(true);
                  setMobileFilterExpanded(true);
                  window.requestAnimationFrame(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  });
                }}
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                <span>Muokkaa hakua</span>
              </button>
            </div>
            <div className={styles.sectionHead}>
              <span className={styles.resultsCount}>
                {listingsLoading
                  ? ""
                  : listingsExpanded
                  ? `${filteredListings.length} ${t.content}`
                  : "Uusimmat varaosat"}
              </span>
              <div className={styles.listingToolbar}>
                {!listingsExpanded && !listingsLoading && totalDisplayListings > displayedListings.length ? (
                  <button
                    type="button"
                    className={`${styles.showMoreListingsButton} ${styles.showAllListingsInlineButton}`}
                    onClick={showAllListings}
                  >
                    <span>Näytä kaikki</span>
                    <ChevronRight size={16} strokeWidth={3} aria-hidden="true" />
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
                    className={styles.card}
                    role="link"
                    tabIndex={0}
                    aria-label={`${t.openListing} ${listingText.title}`}
                    onClick={() => openListing(listing)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openListing(listing);
                      }
                    }}
                  >

                    <div className={`${styles.cardImage} ${styles.listingCardImage}`}>
                      <span className={styles.cardImageBlur} aria-hidden="true">
                        <OptimizedListingImage src={listingImageSrc(listing)} alt="" decorative />
                      </span>
                      <OptimizedListingImage
                        src={listingImageSrc(listing)}
                        alt={listingText.title}
                      />
                      {isListingNew(listing.created_at) && (
                        <span className={styles.newBadge} aria-label={t.newBadge}>
                          {t.newBadge}
                        </span>
                      )}
                      <button
                        onClick={(e) => toggleFavorite(e, listing.id)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className={`${styles.favoriteButton} ${
                          isFavorite ? styles.favoriteButtonActive : ""
                        }`}
                        type="button"
                        aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                      >
                        <Heart
                          size={14}
                          fill={isFavorite ? "currentColor" : "none"}
                        />
                      </button>
                    </div>

                    <div className={styles.cardBody}>
                      <p className={styles.cardPrice}>{formatPrice(listing.price)}</p>
                      {listing.vehicle_subtype ? (
                      <div className={styles.badgeRow}>
                        <span className={styles.badge}>Tyyppi {listing.vehicle_subtype}</span>
                      </div>
                      ) : null}

                      <h3 className={styles.cardTitle}>{listingText.title}</h3>

                      <div className={styles.cardMetaRow}>
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
