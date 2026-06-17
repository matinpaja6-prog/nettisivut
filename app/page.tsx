"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import styles from "./page.module.css";

import {
  Car,
  Check,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  MapPin,
  Search,
  Settings2,
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
import { readCachedListings, writeCachedListings } from "@/lib/client-listings-cache";
import { formatLocationWithCountry, getCountryFlagFromLocation } from "@/lib/country-flags";

import { buildRecoProfile, getRecommendedListings, setRecoUserId } from "@/lib/recommendations";

import {
  getProfile,
  getSavedListingIds,
  getGarageVehicles,
  ensureListingTranslations,
  getListings,
  getUserPreferenceProfile,
  isProfileCompleted,
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

const CategoryDrawer = dynamic(() => import("./components/CategoryDrawer"), {
  ssr: false,
  loading: () => null
});

type Locale = "fi" | "en" | "sv" | "no" | "et";

const HOME_RETURN_STATE_KEY = "home_return_state_v1";
const HOME_RETURN_PENDING_KEY = "home_return_pending_v1";

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
    heroSubtitle: "Nopea haku. Laaja valikoima. Luotettavat myyjät.",
    heroLeadStart: "Nopea haku",
    heroLeadHighlight: "Laaja valikoima",
    heroLeadEnd: "Luotettavat myyjät",
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
    heroLeadHighlight: "Wide selection",
    heroLeadEnd: "Trusted sellers",
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
    heroLeadHighlight: "Brett utbud",
    heroLeadEnd: "Pålitliga säljare",
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
    heroLeadHighlight: "Stort utvalg",
    heroLeadEnd: "Pålitelige selgere",
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
    heroLeadHighlight: "Lai valik",
    heroLeadEnd: "Usaldusväärsed müüjad",
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
  const router = useRouter();

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
  const vehiclePills = useMemo(
    () => [
      { label: "Kaikki", type: "" as string },
      ...taxonomy.vehicles
        .filter((v) => ["Moottorikelkka", "Mönkijä", "Motocross", "Mopot", "Mopo"].includes(v.key))
        .map((v) => ({ label: v.pillLabel, type: v.key }))
    ],
    [taxonomy]
  );
  const taxonomyVehicleLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const vehicle of taxonomy.vehicles) {
      labels[vehicle.key] = vehicle.label || vehicle.pillLabel || vehicle.key;
    }
    return labels;
  }, [taxonomy]);

  const garageDropdownRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  const favoritesHydrated = useRef(false);
  const listingsPageFetchRef = useRef(false);

  const [locale, setLocale] = useState<Locale>("fi");
  const [localeReady, setLocaleReady] = useState(false);

  const [listings, setListings] = useState<Listing[]>(fallbackListings);
  const [listingsLoading, setListingsLoading] = useState(fallbackListings.length === 0);
  const [listingsTotalCount, setListingsTotalCount] = useState<number | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);

  const [query, setQuery] = useState("");
  const [compactHeroSearch, setCompactHeroSearch] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageJumpValue, setPageJumpValue] = useState("");
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [mobilePagination, setMobilePagination] = useState(false);
  const PAGE_SIZE = 40;
  const INITIAL_LISTING_FETCH_LIMIT = 240;

  const [category, setCategory] = useState("");

  const [subcategory, setSubcategory] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleFilter>("");
  const [vehicleSubtype, setVehicleSubtype] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("Kaikki");
  const [modelQuery, setModelQuery] = useState("");
  const [yearQuery, setYearQuery] = useState("");
  const [engineCcQuery, setEngineCcQuery] = useState("");
  const [engineModelQuery, setEngineModelQuery] = useState("");

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);

  const [sort, setSort] = useState<SortValue>("Osuvimmat ensin");
  const [recommendationsMode, setRecommendationsMode] = useState(true);
  const [homeSortOpen, setHomeSortOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [userLocationTerms, setUserLocationTerms] = useState<string[]>([]);

  const [garageVehicles, setGarageVehicles] = useState<GarageVehicle[]>([]);
  const [garageFilter, setGarageFilter] = useState<GarageVehicle | null>(null);
  const [garageDropdownOpen, setGarageDropdownOpen] = useState(false);

  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const [categorySearch, setCategorySearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOpenStep, setDrawerOpenStep] = useState<number | undefined>(undefined);
  const [dbPreferenceProfile, setDbPreferenceProfile] = useState<UserPreferenceProfile | null>(null);

  const t = translations[locale];

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
          yearQuery,
          engineCcQuery,
          engineModelQuery,
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
    garageFilter?.id,
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

  const openListing = useCallback((listingId: string) => {
    saveHomeReturnState();
    router.push(`/listing/${listingId}`);
  }, [router, saveHomeReturnState]);

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
        yearQuery?: string;
        engineCcQuery?: string;
        engineModelQuery?: string;
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
      setYearQuery(saved.yearQuery ?? "");
      setEngineCcQuery(saved.engineCcQuery ?? "");
      setEngineModelQuery(saved.engineModelQuery ?? "");
      setMinPrice(typeof saved.minPrice === "number" ? saved.minPrice : 0);
      setMaxPrice(typeof saved.maxPrice === "number" ? saved.maxPrice : 100000);
      setSort(saved.sort ?? "Osuvimmat ensin");
      setRecommendationsMode(saved.recommendationsMode ?? true);
      setCurrentPage(typeof saved.currentPage === "number" ? saved.currentPage : 1);
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
    const media = window.matchMedia("(max-width: 720px)");
    const syncCompactSearch = () => setCompactHeroSearch(media.matches);

    syncCompactSearch();
    media.addEventListener("change", syncCompactSearch);

    return () => media.removeEventListener("change", syncCompactSearch);
  }, []);

  useEffect(() => {
    function openCategoryDrawerFromTopbar() {
      setDrawerOpen((open) => {
        if (open) {
          setDrawerOpenStep(undefined);
          return false;
        }

        setDrawerOpenStep(2);
        return true;
      });
    }

    window.addEventListener("open-category-drawer", openCategoryDrawerFromTopbar);
    return () => window.removeEventListener("open-category-drawer", openCategoryDrawerFromTopbar);
  }, [vehicleType]);

  useEffect(() => {
    if (!drawerOpen) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const previousBodyStyle = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width
    };
    const previousHtmlOverflow = html.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyStyle.overflow;
      body.style.position = previousBodyStyle.position;
      body.style.top = previousBodyStyle.top;
      body.style.left = previousBodyStyle.left;
      body.style.right = previousBodyStyle.right;
      body.style.width = previousBodyStyle.width;
      window.scrollTo(0, scrollY);
    };
  }, [drawerOpen]);

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
    setYearQuery("");
    setEngineCcQuery("");
    setEngineModelQuery("");
    setCategory("");
    setSubcategory("");
    setOpenCategory(null);
    setCategorySearch("");
    setMinPrice(0);
    setMaxPrice(100000);
    setDrawerOpen(false);
    setGarageDropdownOpen(false);
    setCurrentPage(1);
  }

  function applyListingFilters() {
    setRecommendationsMode(false);
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
      query: query.trim(),
      vehicleType,
      vehicleSubtype,
      garageFilterId: garageFilter?.id ?? "",
      selectedBrand,
      modelQuery: modelQuery.trim(),
      yearQuery: yearQuery.trim(),
      engineCcQuery: engineCcQuery.trim(),
      engineModelQuery: engineModelQuery.trim(),
      category,
      subcategory,
      minPrice,
      maxPrice,
      sort,
      recommendationsMode
    })
  ), [
    query,
    vehicleType,
    vehicleSubtype,
    garageFilter?.id,
    selectedBrand,
    modelQuery,
    yearQuery,
    engineCcQuery,
    engineModelQuery,
    category,
    subcategory,
    minPrice,
    maxPrice,
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
              includeOptionalFields: false,
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
                  includeOptionalFields: false,
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

        if (user) {
          const { data: profileData } = await getProfile(user.id);
          if (!isProfileCompleted(profileData)) {
            router.push("/auth");
            return;
          }
        }
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
     CLOSE PROFILE MENU
  ====================================================== */

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-garage-dropdown-root]")) {
        return;
      }

      if (
        garageDropdownRef.current &&
        !garageDropdownRef.current.contains(e.target as Node)
      ) {
        setGarageDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  /* ======================================================
     FILTERED LISTINGS
  ====================================================== */

  const filteredListings = useMemo(() => {
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
          ${listingVehicleSubtypeText}
          ${listing.engine_cc ?? ""}
          ${listingPartNumber}
          ${listing.location}
        `;

        const matchesQuery =
          !query || allSearchWordsMatch(search, query);
        const directPartNumberMatch =
          Boolean(query) &&
          Boolean(listingPartNumber) &&
          textMatchesSearch(listingPartNumber, query);

        const matchesGarage = (() => {
          if (!garageFilter) return true;
          const haystack = [
            listing.brand ?? "",
            listing.model ?? "",
            listingPartNumber,
            listingText.title,
            listingText.description
          ].join(" ");
          const matchesMake =
            !garageFilter.make || textMatchesSearch(haystack, garageFilter.make);
          const matchesModel =
            !garageFilter.model || allSearchWordsMatch(haystack, garageFilter.model);
          return matchesMake && matchesModel;
        })();

        const matchesVehicleType =
          listingMatchesVehicleType(listing, listingText, vehicleType);
        const matchesVehicleSubtype =
          !vehicleSubtype ||
          allSearchWordsMatch(listingVehicleSubtypeText, vehicleSubtype);

        const matchesCategory =
          !category ||
          normalizeCategoryMatch(listing.category) === normalizeCategoryMatch(category);

        const matchesSubcategory =
          listingMatchesSubcategoryFilter(listing.subcategory, subcategory);

        const matchesBrand =
          brandMatchesListing(selectedBrand, listing, listingText);

        const matchesModel =
          !modelQuery ||
          allSearchWordsMatch(
            `${listing.model ?? ""} ${listingText.title} ${listingText.description} ${listingPartNumber}`,
            modelQuery
          );

        const yearNeedle = yearQuery.trim();
        const listingYearText = getListingYearText(listing, listingText);
        const matchesYear =
          !yearNeedle || textMatchesSearch(listingYearText, yearNeedle);

        const matchesEngineCc =
          !engineCcQuery ||
          textMatchesSearch(listing.engine_cc ?? "", engineCcQuery);

        const matchesEngineModel =
          !engineModelQuery ||
          textMatchesSearch(listing.engine_model ?? "", engineModelQuery);

        const matchesPrice =
          listing.price >= minPrice &&
          listing.price <= maxPrice;

        if (directPartNumberMatch) {
          return matchesPrice;
        }

        return (
          matchesQuery &&
          matchesVehicleType &&
          matchesVehicleSubtype &&
          matchesCategory &&
          matchesSubcategory &&
          matchesBrand &&
          matchesModel &&
          matchesYear &&
          matchesEngineCc &&
          matchesEngineModel &&
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
    query,
    vehicleType,
    vehicleSubtype,
    category,
    subcategory,
    selectedBrand,
    modelQuery,
    yearQuery,
    engineCcQuery,
    engineModelQuery,
    minPrice,
    maxPrice,
    sort,
    userLocationTerms,
    garageFilter,
    getListingText
  ]);

  function toggleFavorite(
    event: React.MouseEvent,
    listingId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!user) return;

    setFavorites((prev) => {
      const current = prev.length > 0 ? prev : readSavedListingIds();
      const next = current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId];

      try {
        localStorage.setItem("savedListings", JSON.stringify(next));
      } catch {}

      void (
        current.includes(listingId)
          ? unsaveListing(listingId)
          : saveListing(listingId)
      );

      return next;
    });
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
      setEngineCcQuery("");
      setEngineModelQuery("");
      setDrawerOpenStep(undefined);
      return;
    }

    const vt = getGarageVehicleType(vehicle);
    setGarageFilter(vehicle);
    setVehicleType(vt);
    setVehicleSubtype("");
    setSelectedBrand(vehicle.make);
    setModelQuery(vehicle.model);
    setYearQuery(String(vehicle.year));
    setEngineCcQuery(getGarageVehicleEngineCc(vehicle));
    setEngineModelQuery("");
    setDrawerOpenStep(2);
    setDrawerOpen(true);
    setRecommendationsMode(false);
    setCurrentPage(1);
  }

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
    Boolean(yearQuery.trim()) ||
    Boolean(engineCcQuery.trim()) ||
    Boolean(engineModelQuery.trim()) ||
    minPrice !== 0 ||
    maxPrice !== 100000;

  const canShowRecommendations =
    !listingsLoading &&
    recommendedListings.length > 0 &&
    !hasActiveListingFilters;

  const recommendationsEnabled =
    canShowRecommendations &&
    recommendationsMode &&
    sort === "Osuvimmat ensin";

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
                onClick={() => {
                  handleSortChange(option.value);
                  setHomeSortOpen(false);
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
      .slice(0, PAGE_SIZE);
  }, [recommendationsEnabled, sortedRecommendedListings]);

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
      ? Math.max(0, PAGE_SIZE - firstPageRecommendedListings.length)
      : PAGE_SIZE;

  const visibleRecommendedListings = useMemo(() => (
    showRecoContent
      ? firstPageRecommendedListings
      : []
  ), [showRecoContent, firstPageRecommendedListings]);

  const totalPages = Math.max(1, Math.ceil(totalDisplayListings / PAGE_SIZE));

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
          ? firstPageListingSlots
          : firstPageListingSlots + (currentPage - 1) * PAGE_SIZE
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
    if (recommendationsEnabled) {
      if (currentPage === 1) {
        return listingsForPaging.slice(0, firstPageListingSlots);
      }

      const start = firstPageListingSlots + (currentPage - 2) * PAGE_SIZE;
      return listingsForPaging.slice(start, start + PAGE_SIZE);
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredListings.slice(start, start + PAGE_SIZE);
  }, [filteredListings, listingsForPaging, currentPage, recommendationsEnabled, firstPageListingSlots]);

  const displayedListings = useMemo(() => (
    showRecoContent
      ? [...visibleRecommendedListings, ...featuredListings]
      : featuredListings
  ), [featuredListings, showRecoContent, visibleRecommendedListings]);

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

  const categorySource = useMemo(() => {
    return vehicleType ? vehicleCategories[vehicleType] : allVehicleCategories;
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

  const brandOptions = useMemo(() => {
    return vehicleType ? vehicleBrands[vehicleType] : ["Kaikki"];
  }, [vehicleBrands, vehicleType]);

  function selectVehicleType(nextVehicleType: VehicleFilter) {
    if (!nextVehicleType) {
      clearListingFilters();
      return;
    }

    if (vehicleType !== nextVehicleType) {
      setVehicleType(nextVehicleType);
      setVehicleSubtype("");
      setGarageFilter(null);
      setSelectedBrand("Kaikki");
      setModelQuery("");
      setYearQuery("");
      setEngineCcQuery("");
      setEngineModelQuery("");
      setCategory("");
      setSubcategory("");
      setOpenCategory(null);
      setCategorySearch("");
      setMinPrice(0);
      setMaxPrice(100000);
    }

    setCurrentPage(1);
  }

  function getVehiclePillLabel(vehicle: string) {
    if (vehicle === "Moottorikelkka") return t.snowmobiles;
    if (vehicle === "Mönkijä") return t.atvs;
    if (vehicle === "Motocross") return t.cars;
    if (vehicle === "Mopot" || vehicle === "Mopo") return t.mopeds;
    return vehicle;
  }

  return (
    <main className={styles.shell}>
      <div className={styles.heroWrap}>
        <div className={styles.container}>
        <section className={styles.hero} aria-label="Hero">
          <div className={styles.heroInner}>
            <div style={{ margin: "0 auto", maxWidth: "100%", width: "min(720px, calc(100vw - 28px))" }}>
              <h1 className={styles.heroHeadline}>
                <span style={{ display: "block", width: "100%" }}>{t.heroLeadStart}</span>
                <span className={styles.heroHeadlineAccent} style={{ display: "block", width: "100%" }}>{t.heroLeadHighlight}</span>
              </h1>

              <form
                className={styles.heroSearch}
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyListingFilters();
                }}
              >
                <span className={styles.heroSearchIcon} aria-hidden="true">
                  <Search size={20} />
                </span>
                <input
                  className={styles.heroSearchInput}
                  type="search"
                  placeholder={compactHeroSearch ? t.searchCta : t.searchPlaceholder}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }}
                  aria-label={t.searchLabel}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                />
              </form>

            </div>

            <div className={styles.categoryRowWrap}>
              <div className={styles.categoryRow} aria-label={t.vehicleSelection}>
                {vehiclePills.map((pill) => (
                  <button
                    key={pill.type}
                    type="button"
                    className={`${styles.categoryPill} ${
                      vehicleType === pill.type ? styles.categoryPillActive : ""
                    }`}
                    onClick={() => selectVehicleType(pill.type)}
                  >
                    <Settings2 size={16} />
                    <span>{pill.type ? pill.label : t.all}</span>
                  </button>
                ))}

                {user && garageVehicles.length > 0 && (
                  <div ref={garageDropdownRef} className={styles.garagePillWrap} data-garage-dropdown-root>
                    <button
                      type="button"
                      className={`${styles.categoryPill} ${garageFilter || garageDropdownOpen ? styles.garagePillActive : styles.garagePillBtn}`}
                      onClick={() => setGarageDropdownOpen((o) => !o)}
                    >
                      <Car size={16} />
                      {t.garageTitle}
                      {garageFilter && <span className={styles.garagePillDot} />}
                      <ChevronDown size={14} style={{ transform: garageDropdownOpen ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                    </button>

                    {garageDropdownOpen && (
                      <>
                        <div
                          className={styles.garageDropdownBackdrop}
                          onClick={() => setGarageDropdownOpen(false)}
                          aria-hidden="true"
                        />
                        <div className={styles.garageDropdown} role="dialog" aria-label={t.garageTitle}>
                          <div className={styles.garageDropdownHeader}>
                            <strong>{t.garageTitle}</strong>
                            <button
                              type="button"
                              className={styles.garageDropdownClose}
                              onClick={() => setGarageDropdownOpen(false)}
                              aria-label="Sulje"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          {garageVehicles.length === 0 ? (
                            <Link href="/garage" className={styles.garageDropdownEmpty} onClick={() => setGarageDropdownOpen(false)}>
                              {t.garageAddVehicle} →
                            </Link>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={`${styles.garageDropdownItem} ${!garageFilter ? styles.garageDropdownItemActive : ""}`}
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  applyGarageVehicleToCategorization(null);
                                }}
                                onClick={() => applyGarageVehicleToCategorization(null)}
                              >
                                {t.all}
                              </button>
                              {garageVehicles.map((v) => (
                              <div key={v.id} className={styles.garageDropdownRow}>
                                <button
                                  type="button"
                                  className={`${styles.garageDropdownItem} ${garageFilter?.id === v.id ? styles.garageDropdownItemActive : ""}`}
                                  onPointerDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    applyGarageVehicleToCategorization(v);
                                  }}
                                  onClick={() => applyGarageVehicleToCategorization(v)}
                                >
                                  <Car size={14} />
                                  <span>{v.make} {v.model}</span>
                                  <span className={styles.garageDropdownYear}>{v.year}</span>
                                </button>
                                <Link
                                  href={`/sell?make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&year=${v.year}&vehicleType=${encodeURIComponent(v.vehicle_class === "Auto" ? "Motocross" : v.vehicle_class || "Moottorikelkka")}`}
                                  className={styles.garageDropdownSell}
                                  onClick={() => setGarageDropdownOpen(false)}
                                >
                                  {t.sellParts}
                                </Link>
                              </div>
                            ))}
                            <Link href="/garage" className={styles.garageDropdownLink} onClick={() => setGarageDropdownOpen(false)}>
                              {t.garageTitle} →
                            </Link>
                          </>
                        )}
                        </div>
                      </>
                    )}
                  </div>
                )}

              </div>

            </div>

            <div className={styles.heroQuickCategoryRow} aria-label={t.vehicleSelection}>
              {vehiclePills.map((pill) => (
                <div key={pill.type} className={styles.heroQuickCategoryItem}>
                  <button
                    type="button"
                    className={`${styles.heroQuickCategory} ${vehicleType === pill.type ? styles.heroQuickCategoryActive : ""}`}
                    onClick={() => selectVehicleType(pill.type)}
                  >
                    <Car size={15} />
                    <span>{pill.type ? getVehiclePillLabel(pill.type) : t.all}</span>
                  </button>
                </div>
              ))}
              {user && garageVehicles.length > 0 && (
                <div className={styles.heroGaragePillWrap} data-garage-dropdown-root>
                  <button
                    type="button"
                    className={`${styles.heroQuickCategory} ${garageFilter || garageDropdownOpen ? styles.heroQuickCategoryActive : ""}`}
                    onClick={() => setGarageDropdownOpen((open) => !open)}
                  >
                    <Car size={15} />
                    <span>{t.garageTitle}</span>
                    <ChevronDown size={13} />
                  </button>
                  {garageDropdownOpen && (
                    <div className={styles.heroGarageDropdown}>
                      <button
                        type="button"
                        className={!garageFilter ? styles.garageDropdownItemActive : ""}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          applyGarageVehicleToCategorization(null);
                        }}
                        onClick={() => {
                          applyGarageVehicleToCategorization(null);
                        }}
                      >
                        {t.all}
                      </button>
                      {garageVehicles.map((vehicle) => (
                        <button
                          key={vehicle.id}
                          type="button"
                          className={garageFilter?.id === vehicle.id ? styles.garageDropdownItemActive : ""}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            applyGarageVehicleToCategorization(vehicle);
                          }}
                          onClick={() => applyGarageVehicleToCategorization(vehicle)}
                        >
                          {vehicle.make} {vehicle.model} {vehicle.year}
                        </button>
                      ))}
                      <Link href="/garage" onClick={() => setGarageDropdownOpen(false)}>
                        {t.garageTitle} →
                      </Link>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                className={styles.heroRefineCategoryButton}
                onClick={() => {
                  setDrawerOpenStep(2);
                  setDrawerOpen(true);
                }}
              >
                <Settings2 size={14} strokeWidth={2.8} aria-hidden="true" />
                <span>{t.openCategories}</span>
              </button>
            </div>

          </div>
        </section>
      </div>
      </div>{/* heroWrap */}

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
                        onClick={() => openListing(listing.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openListing(listing.id);
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
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteButtonActive : ""} ${!user ? styles.favoriteButtonDisabled : ""}`}
                            type="button"
                            disabled={!user}
                            aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                            title={!user ? t.login : undefined}
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
                              {formatLocationWithCountry(listing.location, t.country)}
                            </span>
                            <span><Clock3 size={14} />{formatDate(listing.created_at)}</span>
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

        {showAllListingsHeader && (
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
              {showRecoSection ? (
                <div className={styles.recoHeading}>
                  <div className={styles.recoHeadingText}>
                    <span className={styles.recoEyebrow}>{t.forYou}</span>
                    <h2 className={styles.recoTitle}>{t.basedOnBrowsing}</h2>
                  </div>
                </div>
              ) : (
                <span className={styles.resultsCount}>
                  {listingsLoading ? t.loadingListings : `${filteredListings.length} ${t.content}`}
                </span>
              )}
              <div className={styles.listingToolbar}>
                {renderSortControl(styles.sectionSortControl)}
              </div>
            </div>

            <div
              className={styles.listingsPlainPanel}
              style={{ background: "transparent", border: 0, borderRadius: 0, boxShadow: "none" }}
            >
              <div className={styles.cardsGrid}>
              {listingsLoading ? (
                <div
                  className={styles.listingsPlainState}
                  style={{ background: "transparent", border: 0, borderRadius: 0, boxShadow: "none" }}
                >
                  <strong>{t.loadingListings}</strong>
                </div>
              ) : displayedListings.length === 0 ? (
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
                    onClick={() => openListing(listing.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openListing(listing.id);
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
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className={`${styles.favoriteButton} ${
                          isFavorite ? styles.favoriteButtonActive : ""
                        } ${!user ? styles.favoriteButtonDisabled : ""}`}
                        type="button"
                        disabled={!user}
                        aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                        title={!user ? t.login : undefined}
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
                          {formatLocationWithCountry(listing.location, t.country)}
                        </span>
                        <span>
                          <Clock3 size={14} />
                          {formatDate(listing.created_at)}
                        </span>
                      </div>

                    </div>
                  </article>
                );
              })}
              </div>

              {!listingsLoading && totalPages > 1 && (
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
                  onClick={() => { setCategory(""); setSubcategory(""); setSelectedBrand("Kaikki"); setModelQuery(""); setYearQuery(""); setOpenCategory(null); setCategorySearch(""); }}
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

      <CategoryDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDrawerOpenStep(undefined); }}
        vehicleType={vehicleType}
        vehicleSubtype={vehicleSubtype}
        brand={selectedBrand === "Kaikki" ? "" : selectedBrand}
        model={modelQuery}
        year={yearQuery}
        engineCc={engineCcQuery}
        engineModel={engineModelQuery}
        category={category}
        subcategory={subcategory}
        openAtStep={drawerOpenStep}
        vehicleBrands={vehicleBrands}
        vehicleCategories={vehicleCategories}
        partsCategories={partsCategories}
        onApply={({ vehicleType: vt, vehicleSubtype: vst, brand, model, year, engineCc, engineModel, category: cat, subcategory: sub }) => {
          setVehicleType(vt);
          setVehicleSubtype(vst);
          setSelectedBrand(brand || "Kaikki");
          setModelQuery(model);
          setYearQuery(year);
          setEngineCcQuery(engineCc);
          setEngineModelQuery(engineModel);
          setCategory(cat);
          setSubcategory(sub);
          setRecommendationsMode(false);
          setCurrentPage(1);
          requestAnimationFrame(() => {
            resultsRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          });
        }}
      />
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
