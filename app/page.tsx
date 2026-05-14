"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import styles from "./page.module.css";

import {
  Award,
  Bell,
  Car,
  ChevronDown,
  ClipboardList,
  Clock3,
  DoorOpen,
  Heart,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Settings2,
  Store,
  UserRound
} from "lucide-react";

import {
  buildVehicleCategories,
  categories,
  fallbackListings,
  formatPrice,
  getListingPartNumber,
  normalizeVehicleType,
  type Listing
} from "@/lib/listings";
import { getLocalizedListingText } from "@/lib/listing-translations";

import { buildRecoProfile, getRecommendedListings, setRecoUserId } from "@/lib/recommendations";

import {
  getAlertNotifications,
  getConversationSummaries,
  getProfile,
  getPendingPurchaseReviewRequests,
  getSavedListingIds,
  getGarageVehicles,
  getCurrentUserIsAdmin,
  ensureListingTranslations,
  getListings,
  getUserPreferenceProfile,
  isProfileCompleted,
  deleteAlertNotification,
  dismissPurchaseReviewRequest,
  markConversationRead,
  markNotificationsSeen,
  saveListing,
  signOut,
  supabase,
  trackUserActivity,
  unsaveListing,
  type AlertNotification,
  type ConversationSummary,
  type GarageVehicle,
  type PurchaseReviewRequest,
  type UserPreferenceProfile
} from "@/lib/supabase";
import { applyLocale, isLocale, translateCategory } from "@/lib/i18n";
import CategoryDrawer from "./components/CategoryDrawer";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { ListFilter, Menu } from "lucide-react";

type Locale = "fi" | "en" | "sv" | "no" | "et";

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
    heroTitle: "Arctic Parts",
    heroSubtitle: "Nopea haku. Laaja valikoima. Luotettavat myyjät.",
    heroLeadStart: "Nopea haku.",
    heroLeadHighlight: "Laaja valikoima.",
    heroLeadEnd: "Luotettavat myyjät.",
    brandTagline: "Kaikki varaosat. Kaikilta. Sinulle.",
    searchLabel: "Haku",
    searchCta: "Hae",
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
    allListings: "Kaikki ilmoitukset",
    selectedVehicle: "Valittu ajoneuvo",
    openCategories: "Avaa kategoriat"
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
    heroLeadStart: "Fast search.",
    heroLeadHighlight: "Wide selection.",
    heroLeadEnd: "Trusted sellers.",
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
    allListings: "All listings",
    selectedVehicle: "Selected vehicle",
    openCategories: "Open categories"
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
    heroLeadStart: "Snabb sökning.",
    heroLeadHighlight: "Brett utbud.",
    heroLeadEnd: "Pålitliga säljare.",
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
    allListings: "Alla annonser",
    selectedVehicle: "Valt fordon",
    openCategories: "Öppna kategorier"
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
    heroLeadStart: "Raskt søk.",
    heroLeadHighlight: "Stort utvalg.",
    heroLeadEnd: "Pålitelige selgere.",
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
    allListings: "Alle annonser",
    selectedVehicle: "Valgt kjøretøy",
    openCategories: "Åpne kategorier"
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
    heroLeadStart: "Kiire otsing.",
    heroLeadHighlight: "Lai valik.",
    heroLeadEnd: "Usaldusväärsed müüjad.",
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
    allListings: "Kõik kuulutused",
    selectedVehicle: "Valitud sõiduk",
    openCategories: "Ava kategooriad"
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

const SEEN_REVIEW_REQUESTS_STORAGE_KEY = "seenPurchaseReviewRequests";

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

/* ======================================================
   CATEGORIES
====================================================== */

const partsCategories = Object.fromEntries(
  Object.entries(categories).filter(([key]) => key !== "Kaikki")
) as Record<string, readonly string[]>;

type VehicleType = "Moottorikelkka" | "Mönkijä" | "Motocross" | "Mopot";
type VehicleFilter = VehicleType | "";

const vehiclePills: Array<{ label: string; type: VehicleFilter }> = [
  { label: "Kaikki", type: "" },
  { label: "Moottorikelkat", type: "Moottorikelkka" },
  { label: "Mönkijät", type: "Mönkijä" },
  { label: "Motocross", type: "Motocross" },
  { label: "Mopot", type: "Mopot" }
];

const vehicleCategories: Record<VehicleType, Record<string, readonly string[]>> = {
  Moottorikelkka: partsCategories,
  Mönkijä: buildVehicleCategories("Mönkijä"),
  Motocross: buildVehicleCategories("Motocross"),
  Mopot: buildVehicleCategories("Mopo")
};

const vehicleBrands: Record<VehicleType, string[]> = {
  Moottorikelkka: ["Kaikki", "Lynx", "Ski-Doo", "Polaris", "Arctic Cat"],
  Mönkijä: ["Kaikki", "Can-Am", "Polaris", "Yamaha", "Honda", "CFMOTO"],
  Motocross: ["Kaikki", "KTM", "Yamaha", "Honda", "Kawasaki", "Husqvarna", "Suzuki", "GasGas", "Beta", "Sherco", "TM"],
  Mopot: ["Kaikki", "Yamaha", "Honda", "Derbi", "Rieju", "KTM", "Aprilia"]
};

const modelPlaceholders: Record<VehicleType, string> = {
  Moottorikelkka: "e.g. Lynx 600",
  Mönkijä: "e.g. Can-Am Outlander",
  Motocross: "e.g. YZ 250 / CRF 450",
  Mopot: "e.g. Yamaha DT"
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
  return normalizeSearchText(needle)
    .split(" ")
    .filter(Boolean)
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

const fallbackCardImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dbeafe"/><stop offset="1" stop-color="#bfdbfe"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1e3a8a" font-family="Segoe UI,Arial,sans-serif" font-size="36">Kuva ei saatavilla</text></svg>`
  );

function safeImageSrc(src: string | undefined | null) {
  if (!src) return fallbackCardImage;

  // If image is a huge data URL, it may get truncated in DB → show fallback.
  if (src.startsWith("data:image/") && src.length > 250_000) {
    return fallbackCardImage;
  }

  return src;
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

  const profileRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const garageDropdownRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  const favoritesHydrated = useRef(false);

  const [locale, setLocale] = useState<Locale>("fi");
  const [localeReady, setLocaleReady] = useState(false);

  const [listings, setListings] = useState<Listing[]>(fallbackListings);
  const [listingsLoading, setListingsLoading] = useState(true);

  const [favorites, setFavorites] = useState<string[]>([]);

  const [query, setQuery] = useState("");
  const [compactHeroSearch, setCompactHeroSearch] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState("");
  const PAGE_SIZE = 28;

  const [category, setCategory] = useState("");

  const [subcategory, setSubcategory] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleFilter>("");
  const [selectedBrand, setSelectedBrand] = useState("Kaikki");
  const [modelQuery, setModelQuery] = useState("");
  const [yearQuery, setYearQuery] = useState("");
  const [engineCcQuery, setEngineCcQuery] = useState("");
  const [engineModelQuery, setEngineModelQuery] = useState("");

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);

  const [sort, setSort] = useState<SortValue>("Osuvimmat ensin");
  const [recommendationsMode, setRecommendationsMode] = useState(true);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userProfileInitial, setUserProfileInitial] = useState("?");
  const [userLocationTerms, setUserLocationTerms] = useState<string[]>([]);

  const [garageVehicles, setGarageVehicles] = useState<GarageVehicle[]>([]);
  const [garageFilter, setGarageFilter] = useState<GarageVehicle | null>(null);
  const [garageDropdownOpen, setGarageDropdownOpen] = useState(false);

  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const [profileMenu, setProfileMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notificationMenu, setNotificationMenu] = useState(false);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [reviewRequests, setReviewRequests] = useState<PurchaseReviewRequest[]>([]);
  const [seenReviewRequestIds, setSeenReviewRequestIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();

    try {
      const parsed =
        JSON.parse(localStorage.getItem(SEEN_REVIEW_REQUESTS_STORAGE_KEY) ?? "[]");

      return new Set(
        Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === "string")
          : []
      );
    } catch {
      return new Set();
    }
  });
  const [unreadConversations, setUnreadConversations] = useState<ConversationSummary[]>([]);
  const [convNotifSeen, setConvNotifSeen] = useState(false);

  const [categorySearch, setCategorySearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOpenStep, setDrawerOpenStep] = useState<number | undefined>(undefined);
  const [dbPreferenceProfile, setDbPreferenceProfile] = useState<UserPreferenceProfile | null>(null);

  const t = translations[locale];

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const syncCompactSearch = () => setCompactHeroSearch(media.matches);

    syncCompactSearch();
    media.addEventListener("change", syncCompactSearch);

    return () => media.removeEventListener("change", syncCompactSearch);
  }, []);

  useEffect(() => {
    function openCategoryDrawerFromTopbar() {
      setDrawerOpenStep(0);
      setDrawerOpen(true);
    }

    window.addEventListener("open-category-drawer", openCategoryDrawerFromTopbar);
    return () => window.removeEventListener("open-category-drawer", openCategoryDrawerFromTopbar);
  }, []);

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

  const vehicleTypeLabel = useCallback((type: VehicleFilter) => {
    if (!type) return t.all;
    return type === "Moottorikelkka"
      ? t.snowmobiles
      : type === "Mönkijä"
      ? t.atvs
      : type === "Motocross"
      ? t.cars
      : t.mopeds;
  }, [t]);

  function clearListingFilters() {
    setQuery("");
    setVehicleType("");
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

  const translateCategoryLeafLabel = useCallback((value: string) => {
    const translated = translateCategory(locale, value);
    return translated.split("/").map((part) => part.trim()).filter(Boolean).at(-1) ?? translated;
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
    return vehicleTranslations[locale][value] ?? value;
  }, [locale]);

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

  async function handleSignOut() {
    setUser(null);
    setProfileMenu(false);
    await signOut().finally(() => {
      router.refresh();
    });
    router.push("/");
  }

  const unreadSearchAlertCount = notifications.filter(n => !n.seen).length;
  const unreadReviewCount = reviewRequests.filter((request) => !seenReviewRequestIds.has(request.id)).length;
  const notificationCount = unreadSearchAlertCount + unreadReviewCount + (convNotifSeen ? 0 : unreadConversations.length);

  const markConversationNotificationRead = useCallback((conversation: ConversationSummary) => {
    if (!user) return;

    const lastMessageAt =
      conversation.last_message?.created_at
        ? new Date(conversation.last_message.created_at).getTime() + 1
        : Date.now();

    void markConversationRead(
      conversation.id,
      user.id,
      Math.max(Date.now(), lastMessageAt)
    );
  }, [user]);

  function toggleNotificationMenu() {
    if (!user) return;

    const nextOpen = !notificationMenu;
    setNotificationMenu(nextOpen);

    if (nextOpen) {
      setConvNotifSeen(true);
      unreadConversations.forEach(markConversationNotificationRead);
      if (reviewRequests.length > 0) {
        setSeenReviewRequestIds((prev) => {
          const next =
            new Set(prev);

          reviewRequests.forEach((request) => next.add(request.id));

          try {
            localStorage.setItem(
              SEEN_REVIEW_REQUESTS_STORAGE_KEY,
              JSON.stringify([...next])
            );
          } catch {}

          return next;
        });
      }
      if (unreadSearchAlertCount > 0) {
        markNotificationsSeen(user.id).then(() =>
          setNotifications((prev) =>
            prev.map((notification) => ({
              ...notification,
              seen: true
            }))
          )
        );
      }
    }
  }

  /* ======================================================
     LOAD GARAGE VEHICLES
  ====================================================== */

  useEffect(() => {
    setRecoUserId(user?.id ?? null);
    if (!user) {
      setGarageVehicles([]);
      setNotifications([]);
      setReviewRequests([]);
      setDbPreferenceProfile(null);
      setUserAvatarUrl(null);
      setUserProfileInitial("?");
      setUserLocationTerms([]);
      setIsAdmin(false);
      return;
    }
    getCurrentUserIsAdmin()
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
    getUserPreferenceProfile(user.id)
      .then(({ data }) => setDbPreferenceProfile(data))
      .catch(() => setDbPreferenceProfile(null));
    getProfile(user.id)
      .then(({ data }) => {
        setUserAvatarUrl(data?.avatar_url ?? null);
        const displayName =
          data?.company_name ||
          data?.full_name ||
          data?.name ||
          `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim() ||
          user.email ||
          "";
        setUserProfileInitial(displayName.trim().charAt(0).toUpperCase() || "?");
        setUserLocationTerms(data ? buildLocationTerms(data) : []);
      })
      .catch(() => {});
    withTimeout(getGarageVehicles(user.id), 6000)
      .then(({ data }) => setGarageVehicles(data ?? []))
      .catch(() => setGarageVehicles([]));

    withTimeout(getAlertNotifications(user.id), 6000)
      .then(({ data }) => setNotifications(data))
      .catch(() => setNotifications([]));

    withTimeout(getPendingPurchaseReviewRequests(user.id), 6000)
      .then(({ data }) => setReviewRequests(data ?? []))
      .catch(() => setReviewRequests([]));

    withTimeout(getConversationSummaries(user.id), 6000)
      .then(({ data }) => {
        let lastRead: Record<string, number> = {};
        try { lastRead = JSON.parse(localStorage.getItem("chatLastRead") ?? "{}"); } catch { /* ok */ }
        const unread = data.filter((c) => {
          const msg = c.last_message;
          if (!msg || msg.sender_id === user.id) return false;
          return new Date(msg.created_at).getTime() > (lastRead[c.id] ?? 0);
        });
        setUnreadConversations(unread);
      })
      .catch(() => {});

  }, [user]);

  useEffect(() => {
    if (!supabase || !user) return;

    const client = supabase;
    const channel = client
      .channel(`alert-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alert_notifications",
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const next = payload.new as AlertNotification;
          setNotifications((prev) => {
            if (prev.some((notification) => notification.id === next.id)) {
              return prev;
            }

            return [next, ...prev].slice(0, 30);
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "purchase_review_requests",
          filter: `buyer_id=eq.${user.id}`
        },
        (payload) => {
          const next = payload.new as PurchaseReviewRequest;
          setReviewRequests((prev) => {
            if (prev.some((request) => request.id === next.id)) {
              return prev;
            }

            return [next, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [user]);

  /* listen for new incoming messages → reset badge */
  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    const ch = client
      .channel(`new-messages-notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { sender_id: string; conversation_id: string };
          if (msg.sender_id === user.id) return;
          setConvNotifSeen(false);
          getConversationSummaries(user.id).then(({ data }) => {
            let lastRead: Record<string, number> = {};
            try { lastRead = JSON.parse(localStorage.getItem("chatLastRead") ?? "{}"); } catch { /* ok */ }
            const unread = data.filter((c) => {
              const m = c.last_message;
              if (!m || m.sender_id === user.id) return false;
              return new Date(m.created_at).getTime() > (lastRead[c.id] ?? 0);
            });
            setUnreadConversations(unread);
          });
        }
      )
      .subscribe();
    return () => { void client.removeChannel(ch); };
  }, [user]);

  /* ======================================================
     LOAD LISTINGS
  ====================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadListings() {
      try {
        if (mounted) {
          setListingsLoading(true);
        }

        const { data, error } =
          await withTimeout(
            getListings(),
            7000,
            "Ilmoitusten lataus kesti liian kauan."
          );

        if (error) {
          console.warn("Ilmoitusten lataus epäonnistui, käytetään tyhjää näkymää.", error);
          return;
        }

        if (mounted && data) {
          setListings(data);
        }
      } catch {

        if (mounted) {
          setListings(fallbackListings);
        }
      } finally {
        if (mounted) {
          setListingsLoading(false);
        }
      }
    }

    loadListings();

    return () => {
      mounted = false;
    };
  }, []);

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
  }, []);

  /* ======================================================
     CLOSE PROFILE MENU
  ====================================================== */

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest("[data-profile-menu]")
      ) {
        setProfileMenu(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node)
      ) {
        setNotificationMenu(false);
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
      .filter((listing) => {
        const listingText = getListingText(listing);
        const listingPartNumber = getListingPartNumber(listing);
        const search = `
          ${listingText.title}
          ${listingText.description}
          ${listing.description ?? ""}
          ${listing.brand ?? ""}
          ${listing.model ?? ""}
          ${listing.engine_cc ?? ""}
          ${listingPartNumber}
          ${listing.location}
        `;

        const matchesQuery =
          !query || textMatchesSearch(search, query);
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

        const matchesCategory =
          !category ||
          normalizeCategoryMatch(listing.category) === normalizeCategoryMatch(category);

        const matchesSubcategory =
          !subcategory ||
          normalizeSubcategoryMatch(listing.subcategory) === normalizeSubcategoryMatch(subcategory);

        const matchesBrand =
          brandMatchesListing(selectedBrand, listing, listingText);

        const matchesModel =
          !modelQuery ||
          allSearchWordsMatch(
            `${listing.model ?? ""} ${listingText.title} ${listingText.description} ${listingPartNumber}`,
            modelQuery
          );

        const yearNeedle = yearQuery.trim();
        const haystack = `${listingText.title} ${listingText.description} ${listing.model ?? ""} ${listingPartNumber}`;
        const matchesYear =
          !yearNeedle || textMatchesSearch(haystack, yearNeedle);

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

  function openGarageFilterInDrawer() {
    if (!garageFilter) return;

    const vt = garageFilter.vehicle_class === "Motocross" || garageFilter.vehicle_class === "Auto" ? "Motocross"
      : garageFilter.vehicle_class === "Mopo" ? "Mopot"
      : (garageFilter.vehicle_class as "Moottorikelkka" | "Mönkijä") ?? "Moottorikelkka";

    setVehicleType(vt);
    setSelectedBrand(garageFilter.make);
    setDrawerOpenStep(2);
    setDrawerOpen(true);
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
    Boolean(category) ||
    Boolean(subcategory) ||
    Boolean(garageFilter) ||
    Boolean(modelQuery.trim()) ||
    Boolean(yearQuery.trim()) ||
    Boolean(engineCcQuery.trim()) ||
    Boolean(engineModelQuery.trim()) ||
    Boolean(engineModelQuery.trim());

  const canShowRecommendations =
    !listingsLoading &&
    recommendedListings.length > 0 &&
    !hasActiveListingFilters;

  const recommendationsEnabled =
    canShowRecommendations &&
    recommendationsMode &&
    sort === "Osuvimmat ensin";

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

  const totalDisplayListings =
    recommendationsEnabled
      ? firstPageRecommendedListings.length + listingsForPaging.length
      : filteredListings.length;

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

  const goToPage = useCallback((page: number) => {
    const nextPage =
      Math.min(totalPages, Math.max(1, page));

    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [totalPages]);

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
    return vehicleType ? vehicleCategories[vehicleType] : partsCategories;
  }, [vehicleType]);

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
  }, [vehicleType]);

  return (
    <main className={styles.shell}>
      <div className={styles.heroWrap}>
      <div className={`${styles.container} ${styles.topbar}`}>
        <div style={{flex:1}} />
        <div className={styles.topActions} suppressHydrationWarning>
          {user ? (
            <Link
              href="/sell"
              className={`${styles.topButton} ${styles.topButtonSolid}`}
            >
              <Plus size={14} />
              <span className={styles.topButtonLabel}>{t.createListing}</span>
            </Link>
          ) : (
            <Link
              href="/auth"
              className={`${styles.topButton} ${styles.topButtonSolid}`}
              title={t.login}
              suppressHydrationWarning
            >
              <LockKeyhole size={14} />
              <span className={styles.topButtonLabel}>{t.login}</span>
            </Link>
          )}

          {user ? (
            <div ref={notificationRef} className={styles.notificationWrap}>
              <button
                type="button"
                className={styles.notificationButton}
                aria-label={t.notifications}
                aria-haspopup="menu"
                aria-expanded={notificationMenu}
                onClick={toggleNotificationMenu}
              >
                <Bell size={17} />
                {notificationCount > 0 && (
                  <span className={styles.notificationBadge}>
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </button>

              {notificationMenu && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 100002 }}
                    onClick={() => setNotificationMenu(false)}
                    aria-hidden="true"
                  />
                  <div className={styles.notificationMenu} role="menu">
                  <div className={styles.notificationHead}>
                    <strong>{t.notifications}</strong>
                    <Link href="/search-alerts" onClick={() => setNotificationMenu(false)}>
                      {t.saTitle}
                    </Link>
                  </div>

                  {unreadConversations.length > 0 && (
                    <div className={styles.notificationGroup}>
                      <span>{t.messages}</span>
                      {unreadConversations.slice(0, 4).map((c) => {
                        const other = c.other_profile;
                        const name = other?.full_name || other?.name ||
                          `${other?.first_name ?? ""} ${other?.last_name ?? ""}`.trim() || "–";
                        const listingTitle = (c.listing as { title?: string } | null)?.title ?? "";
                        return (
                          <div key={c.id} className={styles.notificationItemWrap}>
                            <Link
                              href={`/messages?conv=${c.id}`}
                              className={styles.notificationItem}
                              onClick={() => {
                                markConversationNotificationRead(c);
                                setUnreadConversations((prev) => prev.filter(x => x.id !== c.id));
                                setNotificationMenu(false);
                              }}
                            >
                              <div className={styles.notificationIcon}>
                                <MessageCircle size={14} />
                              </div>
                              <div>
                                <strong>{name}</strong>
                                {listingTitle && <p style={{color:"#64748b",fontSize:"11px",margin:"1px 0 0"}}>{listingTitle}</p>}
                                <p>{c.last_message?.content?.slice(0, 48) ?? ""}</p>
                              </div>
                            </Link>
                            <button
                              type="button"
                              className={styles.notificationDismiss}
                              title="Poista"
                              onClick={(e) => {
                                e.stopPropagation();
                                markConversationNotificationRead(c);
                                setUnreadConversations((prev) => prev.filter(x => x.id !== c.id));
                              }}
                            >✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {reviewRequests.length > 0 && (
                    <div className={styles.notificationGroup}>
                      <span>{t.reviews}</span>
                      {[...new Map(reviewRequests.map(r => [r.listing_id ?? r.id, r])).values()].slice(0, 4).map((request) => (
                          <div key={request.id} className={styles.notificationItemWrap}>
                            <button
                              type="button"
                              className={styles.notificationItem}
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent(
                                    "open-purchase-review",
                                    { detail: { requestId: request.id } }
                                  )
                                );
                                setNotificationMenu(false);
                              }}
                            >
                              <div className={styles.notificationIcon}>★</div>
                              <div>
                                <strong>{t.reviewSeller}</strong>
                                <p>{request.listing_title}</p>
                                <small>{t.openReview}</small>
                              </div>
                            </button>
                            <button
                              type="button"
                              className={styles.notificationDismiss}
                              title={t.dismiss}
                              onClick={(e) => {
                                e.stopPropagation();
                                dismissPurchaseReviewRequest(request.id);
                                setReviewRequests((prev) => prev.filter(r => r.id !== request.id));
                                window.dispatchEvent(new CustomEvent("review-request-dismissed", { detail: request.id }));
                              }}
                            >
                              ✕
                            </button>
                          </div>
                      ))}
                    </div>
                  )}

                  {notifications.length > 0 && (
                    <div className={styles.notificationGroup}>
                      <span>{t.saTitle}</span>
                      {notifications.slice(0, 5).map((notification) => (
                        <div key={notification.id} className={styles.notificationItemWrap}>
                          <Link
                            href={`/listing/${notification.listing_id}`}
                            className={styles.notificationItem}
                            onClick={() => setNotificationMenu(false)}
                          >
                            <div className={styles.notificationIcon}>
                              <Bell size={14} />
                            </div>
                            <div>
                              <strong>{notification.alert_label}</strong>
                              <p>{notification.listing_title}</p>
                              {notification.listing_price != null && (
                                <small>{formatPrice(notification.listing_price)}</small>
                              )}
                            </div>
                          </Link>
                          <button
                            type="button"
                            className={styles.notificationDismiss}
                            title={t.dismiss}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
                              void deleteAlertNotification(notification.id);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {notificationCount === 0 && unreadConversations.length === 0 && reviewRequests.length === 0 && notifications.length === 0 && (
                    <div className={styles.notificationEmpty}>
                      {t.noNotifications}
                    </div>
                  )}
                </div>
                </>
              )}
            </div>
          ) : null}

          {user ? (
            <div ref={profileRef} style={{ position: "relative", zIndex: 9999 }} className={styles.topbarProfileWrap}>
              <button
                onClick={() => setProfileMenu(!profileMenu)}
                className={styles.topButton}
                aria-haspopup="menu"
                aria-expanded={profileMenu}
                type="button"
              >
                {userAvatarUrl
                  ? <img src={userAvatarUrl} alt="" className={styles.navAvatar} referrerPolicy="no-referrer" />
                  : <span className="profile-avatar-initial nav-profile-avatar-initial">{userProfileInitial}</span>}
                <span className={styles.topButtonLabel}>{t.profile}</span>
              </button>

              {profileMenu && typeof window !== "undefined" && createPortal(
                <div className={styles.profileMenu} role="menu" data-profile-menu>
                  <div className={styles.profileMenuScroll}>
                  <Link href="/profile" className={styles.menuLink} role="menuitem">
                    <UserRound size={16} />
                    {t.editProfile}
                  </Link>
                  <Link href="/my-listings" className={styles.menuLink} role="menuitem">
                    <ClipboardList size={16} />
                    {t.myListings}
                  </Link>
                  <Link href="/garage" className={styles.menuLink} role="menuitem">
                    <Car size={16} />
                    {t.garageTitle}
                  </Link>
                  <Link href="/messages" className={styles.menuLink} role="menuitem">
                    <Mail size={16} />
                    {t.messages}
                  </Link>
                  <Link href="/saved" className={styles.menuLink} role="menuitem">
                    <Heart size={16} />
                    {t.savedListings}
                  </Link>
                  <Link
                    href="/search-alerts"
                    className={styles.menuLink}
                    role="menuitem"
                  >
                    <Bell size={16} />
                    {t.saTitle}
                  </Link>
                  <Link href="/rewards" className={styles.menuLink} role="menuitem">
                    <Award size={16} />
                    {t.rewards}
                  </Link>
                  <Link
                    href="/shop"
                    className={styles.menuLink}
                    role="menuitem"
                    onClick={() => setProfileMenu(false)}
                  >
                    <Store size={16} />
                    {t.shop}
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className={styles.menuLink}
                      role="menuitem"
                      onClick={() => setProfileMenu(false)}
                    >
                      <LockKeyhole size={16} />
                      Admin
                    </Link>
                  )}
                  </div>
                  <button
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleSignOut();
                    }}
                    className={styles.menuButton}
                    type="button"
                  >
                    <DoorOpen size={16} />
                    {t.signOut}
                  </button>
                </div>,
                document.body
              )}
            </div>
          ) : (
            <Link href="/auth" className={`${styles.topButton} ${styles.topbarProfileWrap}`}>
              <LockKeyhole size={14} />
              {t.profile}
            </Link>
          )}

          <LanguageSwitcher />

          <button
            type="button"
            className={styles.topbarCategoryButton}
            aria-label={t.openCategories}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDrawerOpenStep(0);
              setDrawerOpen(true);
            }}
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      <div className={styles.container}>
        <section className={styles.hero} aria-label="Hero">
          <div className={styles.heroInner}>
            <h1 className={styles.heroHeadline}>
              <span>{t.heroLeadStart}</span>
              <span className={styles.heroHeadlineAccent}>{t.heroLeadHighlight}</span>
              <span>{t.heroLeadEnd}</span>
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
              />
            </form>

            <div className={styles.categoryRowWrap}>
              <div className={styles.categoryRow} aria-label={t.vehicleSelection}>
                {vehiclePills.map((pill) => (
                  <button
                    key={pill.type}
                    type="button"
                    className={`${styles.categoryPill} ${
                      vehicleType === pill.type ? styles.categoryPillActive : ""
                    }`}
                    onClick={() => {
                      if (!pill.type) {
                        clearListingFilters();
                      } else {
                        if (vehicleType !== pill.type) {
                          setVehicleType(pill.type);
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
                        setDrawerOpen(false);
                        setDrawerOpenStep(undefined);
                        setCurrentPage(1);
                      }
                    }}
                  >
                    <Settings2 size={16} />
                    <span>{vehicleTypeLabel(pill.type)}</span>
                  </button>
                ))}

                <button
                  type="button"
                  className={`${styles.categoryPill} ${styles.mobileCategoryMenuPill}`}
                  onClick={() => {
                    setDrawerOpenStep(0);
                    setDrawerOpen(true);
                  }}
                >
                  <ListFilter size={16} />
                  <span>Kategoriat</span>
                </button>

                {user && garageVehicles.length > 0 && (
                  <div ref={garageDropdownRef} className={styles.garagePillWrap}>
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
                      <div className={styles.garageDropdown}>
                        {garageVehicles.length === 0 ? (
                          <Link href="/garage" className={styles.garageDropdownEmpty} onClick={() => setGarageDropdownOpen(false)}>
                            {t.garageAddVehicle} →
                          </Link>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`${styles.garageDropdownItem} ${!garageFilter ? styles.garageDropdownItemActive : ""}`}
                              onClick={() => { setGarageFilter(null); setGarageDropdownOpen(false); }}
                            >
                              {t.all}
                            </button>
                            {garageVehicles.map((v) => (
                              <div key={v.id} className={styles.garageDropdownRow}>
                                <button
                                  type="button"
                                  className={`${styles.garageDropdownItem} ${garageFilter?.id === v.id ? styles.garageDropdownItemActive : ""}`}
                                  onClick={() => {
                                    const next = garageFilter?.id === v.id ? null : v;
                                    setGarageFilter(next);
                                    setGarageDropdownOpen(false);
                                    if (next) {
                                      const vt = next.vehicle_class === "Motocross" || next.vehicle_class === "Auto" ? "Motocross"
                                        : next.vehicle_class === "Mopo" ? "Mopot"
                                        : (next.vehicle_class as "Moottorikelkka" | "Mönkijä") ?? "Moottorikelkka";
                                      setVehicleType(vt);
                                      setSelectedBrand(next.make);
                                      setModelQuery(next.model);
                                      setYearQuery(String(next.year));
                                      setDrawerOpenStep(2);
                                      setDrawerOpen(true);
                                    } else {
                                      setSelectedBrand("Kaikki");
                                      setModelQuery("");
                                      setYearQuery("");
                                      setEngineCcQuery("");
                                      setEngineModelQuery("");
                                    }
                                  }}
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
                    )}
                  </div>
                )}

              </div>

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
                  <label className={styles.recoSortControl} aria-label={t.sort}>
                    <select
                      value="recommendations-current"
                      onChange={(e) => {
                        setRecommendationsMode(false);
                        setSort(e.target.value as SortValue);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="recommendations-current" hidden>
                        {sortLabel(sort)}
                      </option>
                    {sortValues.map((value) => (
                        <option key={value} value={value}>
                          {sortLabel(value)}
                        </option>
                      ))}
                    </select>
                    <span className={styles.sortSelectFace} aria-hidden="true">
                      {sortLabel(sort)}
                    </span>
                  </label>
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
                    const listingPartNumber = getListingPartNumber(listing);
                    return (
                      <article
                        key={listing.id}
                        className={styles.card}
                        role="link"
                        tabIndex={0}
                        aria-label={`${t.openListing} ${listingText.title}`}
                        onClick={() => router.push(`/listing/${listing.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/listing/${listing.id}`);
                          }
                        }}
                      >
                        <div className={`${styles.cardImage} ${styles.listingCardImage}`}>
                          <img
                            src={listingImageSrc(listing)}
                            alt={listingText.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              const img = event.currentTarget;
                              img.onerror = null;
                              img.src = fallbackCardImage;
                            }}
                          />
                          <button
                            onClick={(e) => toggleFavorite(e, listing.id)}
                            className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteButtonActive : ""}`}
                            type="button"
                            aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                          >
                            <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                          </button>
                        </div>
                        <div className={styles.cardBody}>
                          <p className={styles.cardPrice}>{formatPrice(listing.price)}</p>
                          {listingPartNumber ? (
                          <div className={styles.badgeRow}>
                            {listingPartNumber ? <span className={`${styles.badge} ${styles.partNumberBadge}`}>OEM {listingPartNumber}</span> : null}
                          </div>
                          ) : null}
                          <h3 className={styles.cardTitle}>{listingText.title}</h3>
                          <div className={styles.cardMetaRow}>
                            <span><MapPin size={14} />{t.country}, {listing.location}</span>
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

        <section ref={resultsRef} className={`${styles.mainGrid} ${!showRecoSection ? styles.mainGridNoReco : ""}`} aria-label={t.content}>
          <div className={styles.container}>
            {/* Active filter chips */}
            {(garageFilter || selectedBrand !== "Kaikki" || category || subcategory) && (
              <div className={styles.activeFilters}>
                {garageFilter && (
                  <span className={styles.filterChip}>
                    <button
                      type="button"
                      className={styles.filterChipLabel}
                      onClick={openGarageFilterInDrawer}
                    >
                      <Car size={13} />
                      {t.garagePartsFor}: <strong>{garageFilter.make} {garageFilter.model} {garageFilter.year}</strong>
                    </button>
                    <button type="button" className={styles.filterChipX} onClick={() => setGarageFilter(null)}>✕</button>
                  </span>
                )}
                {selectedBrand !== "Kaikki" && (
                  <span className={styles.filterChip}>
                    <button type="button" className={styles.filterChipLabel} onClick={() => setDrawerOpen(true)}>{selectedBrand}</button>
                    <button type="button" className={styles.filterChipX} onClick={() => setSelectedBrand("Kaikki")}>✕</button>
                  </span>
                )}
                {category && (
                  <span className={styles.filterChip}>
                    <button type="button" className={styles.filterChipLabel} onClick={() => setDrawerOpen(true)}>{translateCategoryLabel(category)}</button>
                    <button type="button" className={styles.filterChipX} onClick={() => { setCategory(""); setSubcategory(""); }}>✕</button>
                  </span>
                )}
                {subcategory && (
                  <span className={styles.filterChip}>
                    <button type="button" className={styles.filterChipLabel} onClick={() => setDrawerOpen(true)}>{translateCategoryLeafLabel(subcategory)}</button>
                    <button type="button" className={styles.filterChipX} onClick={() => setSubcategory("")}>✕</button>
                  </span>
                )}
                <button
                  type="button"
                  className={styles.filterChipReset}
                  onClick={() => { setGarageFilter(null); setSelectedBrand("Kaikki"); setModelQuery(""); setYearQuery(""); setEngineCcQuery(""); setEngineModelQuery(""); setCategory(""); setSubcategory(""); }}
                >
                  {t.resetFilters}
                </button>
              </div>
            )}

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
                <label className={styles.sectionSortControl}>
                  <select
                    value={sort}
                    onChange={(e) => {
                      if (e.target.value === "recommendations") {
                        setRecommendationsMode(true);
                        setSort("Osuvimmat ensin");
                      } else {
                        setRecommendationsMode(false);
                        setSort(e.target.value as SortValue);
                      }
                      setCurrentPage(1);
                    }}
                  >
                    <option value={sort} hidden>
                      {sortLabel(sort)}
                    </option>
                    {canShowRecommendations && !recommendationsEnabled ? (
                      <option value="recommendations">Palaa suosituksiin</option>
                    ) : null}
                    {sortValues.filter((value) => value !== sort).map((value) => (
                      <option key={value} value={value}>
                        {sortLabel(value)}
                      </option>
                    ))}
                  </select>
                  <span className={styles.sortSelectFace} aria-hidden="true">
                    {sortLabel(sort)}
                  </span>
                </label>
              </div>
            </div>

            <div className={styles.featuredPanel}>
              <div className={styles.cardsGrid}>
              {listingsLoading ? (
                <div className={styles.emptyState}>
                  <strong>{t.loadingListings}</strong>
                </div>
              ) : displayedListings.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>{t.noListings}</strong>
                  <span>{t.changeFilters}</span>
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={() => {
                      setQuery("");
                      setCategory("");
                      setSubcategory("");
                      setOpenCategory(null);
                      setCategorySearch("");
                      setSelectedBrand("Kaikki");
                      setModelQuery("");
                      setYearQuery("");
                      setEngineCcQuery("");
                      setEngineModelQuery("");
                    }}
                  >
                    {t.resetFilters}
                  </button>
                </div>
              ) : null}
              {displayedListings.map((listing) => {
                const isFavorite = favorites.includes(listing.id);
                const listingText = getListingText(listing);
                const listingPartNumber = getListingPartNumber(listing);
                return (
                  <article
                    key={listing.id}
                    className={styles.card}
                    role="link"
                    tabIndex={0}
                    aria-label={`${t.openListing} ${listingText.title}`}
                    onClick={() => router.push(`/listing/${listing.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/listing/${listing.id}`);
                      }
                    }}
                  >

                    <div className={`${styles.cardImage} ${styles.listingCardImage}`}>
                      <img
                        src={listingImageSrc(listing)}
                        alt={listingText.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          const img = event.currentTarget;
                          console.warn("Listing image failed to load:", img.src);
                          img.onerror = null;
                          img.src = fallbackCardImage;
                        }}
                      />
                      <button
                        onClick={(e) => toggleFavorite(e, listing.id)}
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
                      {listingPartNumber ? (
                      <div className={styles.badgeRow}>
                        {listingPartNumber ? (
                          <span className={`${styles.badge} ${styles.partNumberBadge}`}>OEM {listingPartNumber}</span>
                        ) : null}
                      </div>
                      ) : null}

                      <h3 className={styles.cardTitle}>{listingText.title}</h3>

                      <div className={styles.cardMetaRow}>
                        <span>
                          <MapPin size={14} />
                          {t.country}, {listing.location}
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
                    ←
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 5) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (Math.abs(p - currentPage) <= 1) return true;
                      return false;
                    })
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "..." ? (
                        pageJumpOpen ? (
                          <input
                            key={`gap-${idx}`}
                            className={styles.pageJumpInput}
                            autoFocus
                            type="number"
                            min={1}
                            max={totalPages}
                            value={pageJumpValue}
                            onChange={(e) => setPageJumpValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const n = parseInt(pageJumpValue, 10);
                                if (!isNaN(n)) goToPage(n);
                                setPageJumpOpen(false);
                                setPageJumpValue("");
                              } else if (e.key === "Escape") {
                                setPageJumpOpen(false);
                                setPageJumpValue("");
                              }
                            }}
                            onBlur={() => {
                              const n = parseInt(pageJumpValue, 10);
                              if (!isNaN(n)) goToPage(n);
                              setPageJumpOpen(false);
                              setPageJumpValue("");
                            }}
                          />
                        ) : (
                          <button
                            key={`gap-${idx}`}
                            type="button"
                            className={styles.pageGap}
                            title="Hyppää sivulle"
                            onClick={() => { setPageJumpOpen(true); setPageJumpValue(""); }}
                          >…</button>
                        )
                      ) : (
                        <button
                          key={p}
                          type="button"
                          className={p === currentPage ? `${styles.pageBtn} ${styles.pageBtnActive}` : styles.pageBtn}
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
                    →
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
                  style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {t.resetFilters}
                </button>
              )}
            </div>

            <div className={styles.filtersGroup}>
              <span className={styles.filtersLabel}>{t.sort}</span>
              <select
                className={styles.select}
                value={sort}
                onChange={(e) =>
                  setSort(e.target.value as SortValue)
                }
              >
                {sortValues.map((value) => (
                  <option key={value} value={value}>
                    {sortLabel(value)}
                  </option>
                ))}
              </select>

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
        onApply={({ vehicleType: vt, brand, model, year, engineCc, engineModel, category: cat, subcategory: sub }) => {
          setVehicleType(vt);
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
              onClick={() => { setRecommendationsMode(true); setSort("Osuvimmat ensin"); setCurrentPage(1); setSortSheetOpen(false); }}
            >
              <span className={styles.mobileSortRadio}>
                {recommendationsMode && sort === "Osuvimmat ensin" && <span className={styles.mobileSortRadioDot} />}
              </span>
              Palaa suosituksiin
            </button>
            {sortValues
              .filter((value) => !(value === sort && (!recommendationsMode || value !== "Osuvimmat ensin")))
              .map((value) => {
              const label = sortLabel(value);
              return (
                <button
                  key={value}
                  type="button"
                  className={`${styles.mobileSortOption}${sort === value ? ` ${styles.mobileSortOptionActive}` : ""}`}
                  onClick={() => { setRecommendationsMode(false); setSort(value); setCurrentPage(1); setSortSheetOpen(false); }}
                >
                  <span className={styles.mobileSortRadio}>
                    {sort === value && <span className={styles.mobileSortRadioDot} />}
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
