import type { LucideIcon } from "lucide-react";

import {
  Snowflake,
  Cog,
  Wrench,
  Gauge,
  Zap,
  Fuel,
  PanelsTopLeft,
  Tag
} from "lucide-react";

/* =========================
   LISTING TYPES
========================= */

export type Listing = {
  id: string;

  seller_id?: string | null;

  user_id?: string | null;

  title: string;

  original_language?: string | null;

  translations?: ListingTranslations | null;

  price: number;

  // ajoneuvotyyppi
  vehicle_type?: string | null;

  // merkki
  brand?: string | null;

  // malli
  model?: string | null;

  // vuosimalli
  year?: string | null;

  // moottorin tilavuus (cc)
  engine_cc?: string | null;

  // moottorityyppi / -malli
  engine_model?: string | null;

  // pääkategoria
  category?: string | null;

  // alakategoria
  subcategory?: string | null;

  // varaosanumero / OEM-numero
  part_number?: string | null;

  location: string;

  condition: string;

  description: string;

  image_url: string;

  image_urls?: string[] | null;

  seller_name: string;

  company_name?: string | null;

  seller_avatar_url?: string | null;

  seller_email: string;

  seller_phone?: string | null;

  seller_phone_verified?: boolean | null;

  view_count?: number | null;

  is_sold?: boolean | null;

  is_hidden?: boolean | null;

  sold_price?: number | null;

  sold_at?: string | null;

  created_at: string;
};

export type SoldListing = {
  id: string;
  listing_id?: string | null;
  seller_id: string;
  buyer_id?: string | null;
  title: string;
  price?: number | null;
  sold_price: number;
  vehicle_type?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  category?: string | null;
  subcategory?: string | null;
  image_url?: string | null;
  sold_at: string;
  created_at?: string | null;
};

export type ListingTranslation = {
  title?: string | null;
  description?: string | null;
};

export type ListingTranslations = Partial<
  Record<"fi" | "en" | "sv" | "no" | "et", ListingTranslation>
>;

export type ListingInput = Omit<
  Listing,
  "id" | "created_at"
>;

export function extractListingPartNumber(value?: string | null) {
  const text = value ?? "";
  const match = text.match(
    /(?:varaosanumero|osanumero|oem(?:-numero)?)\s*[:#]?\s*([A-ZÅÄÖ0-9][A-ZÅÄÖ0-9 ._'’/-]{1,48})/i
  );

  return match?.[1]
    ?.split(/\r?\n/)
    .at(0)
    ?.trim()
    .replace(/[.,;:]$/, "") || "";
}

export function getListingPartNumber(
  listing: Pick<Listing, "part_number" | "description">
) {
  return listing.part_number?.trim() || extractListingPartNumber(listing.description);
}

export function appendPartNumberToDescription(
  description: string,
  partNumber?: string | null
) {
  const cleanPartNumber = partNumber?.trim();
  const cleanDescription = description.trim();

  if (!cleanPartNumber) return cleanDescription;

  const existingNumber = getListingPartNumber({
    part_number: null,
    description: cleanDescription
  });

  if (existingNumber) return cleanDescription;

  return [
    cleanDescription,
    `Varaosanumero: ${cleanPartNumber}`
  ].filter(Boolean).join("\n\n");
}

/* =========================
   MERKIT
========================= */

export const brands = [
  "Kaikki",
  "Polaris",
  "Arctic Cat",
  "Ski-Doo",
  "Lynx"
] as const;

export type Brand =
  typeof brands[number];

/* =========================
   KATEGORIAT
========================= */

export const categories = {
  Kaikki: [],

  "Moottori & voimansiirto": [
    "Kokonainen moottori",
    "Kokonainen voimansiirto",
    "Moottorit / Sylinterit",
    "Moottorit / Sylinterin kannet",
    "Moottorit / Männät",
    "Moottorit / Kampiakselit",
    "Moottorit / Moottorin lohkot",
    "Moottorit / Laakerit & tiivisteet",
    "Kytkimet / Kokonainen kytkin",
    "Kytkimet / Kytkin kitit",
    "Kytkimet / Jouset",
    "Kytkimet / Painovarret",
    "Variaattorit / Kokonainen variaattori",
    "Variaattorit / Variaattori kitit",
    "Variaattorit / Jouset",
    "Variaattorin hihnat",
    "Ketjukotelot",
    "Ketjut & hihnat"
  ],

  "Alusta & telasto": [
    "Kokonainen telasto",
    "Kokonainen alusta",
    "Telasto / Etupukit",
    "Telasto / Takapukit",
    "Telasto / Liukurungot",
    "Telasto / Tela- ja kääntöpyörät",
    "Renkaat & vanteet / Renkaat",
    "Renkaat & vanteet / Vanteet",
    "Renkaat & vanteet / Rengassarjat",
    "Renkaat & vanteet / Vannesetit",
    "Renkaat & vanteet / Akselit & laakerit",
    "Tukivarret / Oikea ylä",
    "Tukivarret / Oikea ala",
    "Tukivarret / Vasen ylä",
    "Tukivarret / Vasen ala",
    "Olka-akselit",
    "Vetoakselit",
    "Telamatot",
    "Iskunvaimentimet / Kokonainen iskunvaimennussarja",
    "Iskunvaimentimet / Etuiskunvaimentimet",
    "Iskunvaimentimet / Takaiskunvaimentimet",
    "Iskunvaimentimet / Telaston iskunvaimentimet",
    "Jouset"
  ],

  "Ohjaus & hallintalaitteet": [
    "Kokonainen ohjaus",
    "Ohjaustangot",
    "Käsisuojat",
    "Tangon korokepalat",
    "Kaasukahvat",
    "Kaasuvaijerit",
    "Jarrut / Kokonainen jarrujärjestelmä",
    "Jarrut / Levyt",
    "Jarrut / Jarrusatulat & letkut",
    "Jarrut / Kahvat & puristimet",
    "Jarrut / Jarrupalat",
    "Ohjaus / Ohjausakselit",
    "Ohjaus / Raidetangot",
    "Ohjaus / Muut ohjauksen osat",
    "Sukset / Kokonainen sukset",
    "Sukset / Ohjainraudat",
    "Sukset / Suksikumit"
  ],

  "Sähköjärjestelmät": [
    "Kokonainen sähköjärjestelmä",
    "Staattorit & vauhtipyörät",
    "Triggerit",
    "Akut",
    "Sytytyspuolat",
    "ECU & ohjainyksiköt",
    "Johtosarjat",
    "Valot",
    "Anturit",
    "Mittaristot",
    "Kytkimet & katkaisijat"
  ],

  "Jäähdytys & polttoaine": [
    "Kokonainen jäähdytysjärjestelmä",
    "Kokonainen polttoainejärjestelmä",
    "Jäähdyttimet",
    "Vesipumput",
    "Letkut",
    "Polttoainepumput",
    "Kaasuttimet",
    "Ruiskutusjärjestelmät",
    "Polttoainesäiliöt & tankit"
  ],

  "Pakoputkisto": [
    "Kokonainen pakoputkisto",
    "Alkukäyrät",
    "Pakosarjat & Y-haarat",
    "Äänenvaimentimet",
    "Resonanssiputket"
  ],

  "Runko & katteet": [
    "Kokonainen runko",
    "Kokonainen katesarja",
    "Tunnelit / Keskirunko",
    "Tunnelit / Eturunko",
    "Kuomut & konepellit",
    "Sivukatteet",
    "Etupuskurit",
    "Takapuskurit",
    "Istuimet & penkit",
    "Tuulilasit"
  ]
} as const;

export function normalizeVehicleType(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "mopo" || normalized === "mopot") return "Mopo";
  if (normalized === "mönkijä" || normalized === "mönkijät") return "Mönkijä";
  if (normalized === "moottorikelkka" || normalized === "moottorikelkat") return "Moottorikelkka";
  if (normalized === "motocross") return "Motocross";

  return value ?? "";
}

export function isVehiclePartAllowed(
  vehicleType: string,
  category: string,
  subcategory: string
) {
  const normalizedVehicle = normalizeVehicleType(vehicleType);

  const snowmobileOnly =
    subcategory.startsWith("Telasto /") ||
    subcategory === "Kokonainen telasto" ||
    subcategory === "Telamatot" ||
    subcategory === "Iskunvaimentimet / Telaston iskunvaimentimet" ||
    subcategory.startsWith("Sukset /") ||
    subcategory === "Sukset / Kokonainen sukset" ||
    subcategory.startsWith("Tunnelit /");

  const wheelAndRim =
    subcategory.startsWith("Renkaat & vanteet /");

  if (normalizedVehicle === "Moottorikelkka") {
    return !wheelAndRim;
  }

  if (normalizedVehicle === "Mönkijä") {
    const atvDisallowed =
      subcategory.startsWith("Sukset /") ||
      subcategory === "Sukset / Kokonainen sukset" ||
      subcategory.startsWith("Tunnelit /");

    return !atvDisallowed;
  }

  if (snowmobileOnly) return false;

  const atvOrSnowmobileOnly =
    category === "Runko & katteet" &&
    (
      subcategory === "Kuomut & konepellit" ||
      subcategory === "Tuulilasit"
    );

  return !atvOrSnowmobileOnly;
}

export function displayCategoryForVehicle(
  vehicleType: string | null | undefined,
  category: string
) {
  const normalizedVehicle = normalizeVehicleType(vehicleType);

  if (
    category === "Alusta & telasto" &&
    (normalizedVehicle === "Motocross" || normalizedVehicle === "Mopo")
  ) {
    return "Renkaat, vanteet & alusta";
  }

  return category;
}

export function buildVehicleCategories(vehicleType: string) {
  const entries = Object.entries(categories)
    .filter(([key]) => key !== "Kaikki")
    .map(([category, subcategories]) => [
      category,
      subcategories.filter((subcategory) =>
        isVehiclePartAllowed(vehicleType, category, subcategory)
      )
    ])
    .filter(([, subcategories]) => subcategories.length > 0);

  return Object.fromEntries(entries) as Record<string, readonly string[]>;
}

/* =========================
   SUBCATEGORY GROUPS
   Navigation hierarchy: category → group → [leaf items]
   Empty array = group is itself the selectable leaf
========================= */
export const subcategoryGroups: Record<string, Record<string, string[]>> = {
  "Moottori & voimansiirto": {
    "Moottorit":          ["Kokonainen moottori","Moottorit / Sylinterit","Moottorit / Sylinterin kannet","Moottorit / Männät","Moottorit / Kampiakselit","Moottorit / Moottorin lohkot","Moottorit / Laakerit & tiivisteet"],
    "Kytkimet":           ["Kytkimet / Kokonainen kytkin","Kytkimet / Kytkin kitit","Kytkimet / Jouset","Kytkimet / Painovarret"],
    "Variaattorit":       ["Variaattorit / Kokonainen variaattori","Variaattorit / Variaattori kitit","Variaattorit / Jouset","Variaattorin hihnat"],
    "Voimansiirto":       ["Kokonainen voimansiirto","Ketjukotelot","Ketjut & hihnat"]
  },
  "Alusta & telasto": {
    "Telasto":            ["Kokonainen telasto","Telasto / Etupukit","Telasto / Takapukit","Telasto / Liukurungot","Telasto / Tela- ja kääntöpyörät","Telamatot"],
    "Renkaat & vanteet":  ["Renkaat & vanteet / Renkaat","Renkaat & vanteet / Vanteet","Renkaat & vanteet / Rengassarjat","Renkaat & vanteet / Vannesetit","Renkaat & vanteet / Akselit & laakerit"],
    "Alusta":             ["Kokonainen alusta","Olka-akselit","Vetoakselit"],
    "Tukivarret":         ["Tukivarret / Oikea ylä","Tukivarret / Oikea ala","Tukivarret / Vasen ylä","Tukivarret / Vasen ala"],
    "Iskunvaimentimet":   ["Iskunvaimentimet / Kokonainen iskunvaimennussarja","Iskunvaimentimet / Etuiskunvaimentimet","Iskunvaimentimet / Takaiskunvaimentimet","Iskunvaimentimet / Telaston iskunvaimentimet","Jouset"]
  },
  "Ohjaus & hallintalaitteet": {
    "Ohjaus":             ["Kokonainen ohjaus","Ohjaustangot","Käsisuojat","Tangon korokepalat","Ohjaus / Ohjausakselit","Ohjaus / Raidetangot","Ohjaus / Muut ohjauksen osat"],
    "Hallintalaitteet":   ["Kaasukahvat","Kaasuvaijerit"],
    "Jarrut":             ["Jarrut / Kokonainen jarrujärjestelmä","Jarrut / Levyt","Jarrut / Jarrusatulat & letkut","Jarrut / Kahvat & puristimet","Jarrut / Jarrupalat"],
    "Sukset":             ["Sukset / Kokonainen sukset","Sukset / Ohjainraudat","Sukset / Suksikumit"]
  },
  "Sähköjärjestelmät": {
    "Sähkö": ["Kokonainen sähköjärjestelmä","Akut","ECU & ohjainyksiköt","Johtosarjat","Valot","Anturit","Mittaristot","Kytkimet & katkaisijat"],
    "Sytytys": ["Staattorit & vauhtipyörät","Triggerit","Sytytyspuolat"]
  },
  "Jäähdytys & polttoaine": {
    "Jäähdytys": ["Kokonainen jäähdytysjärjestelmä","Jäähdyttimet","Vesipumput","Letkut"],
    "Polttoainejärjestelmä": ["Kokonainen polttoainejärjestelmä","Polttoainepumput","Kaasuttimet","Ruiskutusjärjestelmät","Polttoainesäiliöt & tankit"]
  },
  "Pakoputkisto": {
    "Pakoputkisto": ["Kokonainen pakoputkisto","Alkukäyrät","Pakosarjat & Y-haarat","Äänenvaimentimet","Resonanssiputket"]
  },
  "Runko & katteet": {
    "Runko":              ["Kokonainen runko","Tunnelit / Keskirunko","Tunnelit / Eturunko"],
    "Katteet":            ["Kokonainen katesarja","Kuomut & konepellit","Sivukatteet"],
    "Etupuskurit":        [],
    "Takapuskurit":       [],
    "Istuimet & penkit":  [],
    "Tuulilasit":         []
  }
};

/* =========================
   TYPES
========================= */

export type Category =
  keyof typeof categories;

/* =========================
   CATEGORY NAMES
========================= */

export const categoryNames =
  Object.keys(
    categories
  ) as Category[];

/* =========================
   ICONS
========================= */

export const categoryIcons: Record<
  Category,
  LucideIcon
> = {
  Kaikki: Tag,

  "Moottori & voimansiirto": Cog,

  "Alusta & telasto": Snowflake,

  "Ohjaus & hallintalaitteet": Gauge,

  "Sähköjärjestelmät": Zap,

  "Jäähdytys & polttoaine": Fuel,

  "Pakoputkisto": Wrench,

  "Runko & katteet": PanelsTopLeft
};

/* =========================
   CONDITIONS
========================= */

export const conditions = [
  "Uusi",
  "Erinomainen",
  "Hyvä",
  "Käytetty",
  "Korjattava"
] as const;

/* =========================
   FALLBACK
========================= */

export const fallbackListings: Listing[] =
  [];

/* =========================
   FORMAT PRICE
========================= */

export function formatPrice(
  price: number
) {

  return new Intl.NumberFormat(
    "fi-FI",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }
  ).format(price);

}
