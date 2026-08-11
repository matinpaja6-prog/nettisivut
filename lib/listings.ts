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

  listing_number?: number | null;

  seller_id?: string | null;

  user_id?: string | null;

  title: string;

  original_language?: string | null;

  translations?: ListingTranslations | null;

  listing_mode?: "single" | "multiple" | null;

  price: number;

  // ajoneuvotyyppi
  vehicle_type?: string | null;

  // ajoneuvon tarkempi tyyppi
  vehicle_subtype?: string | null;

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

  // osan tarkka malli / valmistajasarja, esim. Stage6 tai Airsal
  part_model?: string | null;

  location: string;

  condition: string;

  description: string;

  image_url: string;

  image_urls?: string[] | null;

  seller_name: string;

  company_name?: string | null;

  seller_avatar_url?: string | null;

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
  vehicle_subtype?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  engine_cc?: string | null;
  engine_model?: string | null;
  category?: string | null;
  subcategory?: string | null;
  part_number?: string | null;
  part_model?: string | null;
  condition?: string | null;
  location?: string | null;
  image_url?: string | null;
  listing_mode?: "single" | "multiple" | null;
  sold_at: string;
  created_at?: string | null;
};

export type ListingTranslation = {
  title?: string | null;
  description?: string | null;
};

export type ListingTranslations = Partial<
  Record<"fi" | "en" | "sv" | "no", ListingTranslation>
> & {
  _meta?: {
    publication_group_id?: string | null;
    listing_mode?: "single" | "multiple" | null;
    marketplace_kind?: "part" | "vehicle" | null;
  };
};

export type ListingInput = Omit<
  Listing,
  "id" | "created_at"
>;

export const VEHICLE_LISTING_CATEGORY = "Ajoneuvot";

export function isVehicleListing(
  listing: Pick<Listing, "category" | "translations">
) {
  if (listing.translations?._meta?.marketplace_kind === "vehicle") return true;

  const category = listing.category?.trim().toLocaleLowerCase("fi-FI") ?? "";
  return ["ajoneuvo", "ajoneuvot", "kokonainen ajoneuvo"].includes(category);
}

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
    "Tukivarret / Täydellinen tukivarsi sarja",
    "Tukivarret / Ylä tukivarret oikea",
    "Tukivarret / Ala tukivarret oikea",
    "Tukivarret / Ylä tukivarret vasen",
    "Tukivarret / Ala tukivarret vasen",
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
    "Tunnelit / Takarunko",
    "Kuomut & konepellit",
    "Sivukatteet",
    "Etupuskurit",
    "Takapuskurit",
    "Istuimet & penkit",
    "Tuulilasit"
  ]
} as const;

/**
 * Shared three-level part taxonomy for mopeds, motorcycles and motocross bikes.
 * Stored subcategory values keep the existing "Group / Detail" format so the
 * sell flow and buyer filters can use the same database fields and navigation.
 */
export const twoWheelerPartSubcategoryGroups: Record<string, Record<string, string[]>> = {
  "Moottori": {
    "Kokonainen moottori": [
      "Kokonainen moottori / Täydelliset moottorit",
      "Kokonainen moottori / Moottoriprojektit / vialliset moottorit"
    ],
    "Sylinteri & sylinterin tarvikkeet": [
      "Sylinteri & sylinterin tarvikkeet / Sylinterisarjat",
      "Sylinteri & sylinterin tarvikkeet / Sylinterikannet",
      "Sylinteri & sylinterin tarvikkeet / Männät & tarvikkeet",
      "Sylinteri & sylinterin tarvikkeet / Sylinterin tiivisteet"
    ],
    "Kampiakseli & lohkot": [
      "Kampiakseli & lohkot / Lohkopuoliskot",
      "Kampiakseli & lohkot / Täydelliset kampiakselit",
      "Kampiakseli & lohkot / Kiertokanget",
      "Kampiakseli & lohkot / Kampiakselin laakerit",
      "Kampiakseli & lohkot / Kampiakselin korjaussarjat",
      "Kampiakseli & lohkot / Lohkojen tiivisteet"
    ],
    "Vaihteisto": [
      "Vaihteisto / Täydelliset vaihteistot",
      "Vaihteisto / Vaihderummut",
      "Vaihteisto / Vaihdehaarukat",
      "Vaihteisto / Vaihteiston hammasrattaat",
      "Vaihteisto / Vaihteiston laakerit",
      "Vaihteisto / Vaihteiston korjaussarjat"
    ],
    "Kytkin": [
      "Kytkin / Täydellinen kytkin",
      "Kytkin / Kytkinlevyt",
      "Kytkin / Kytkinkorit",
      "Kytkin / Kytkinjouset",
      "Kytkin / Kytkinkopat",
      "Kytkin / Kytkimen painelaakerit & tarvikkeet"
    ],
    "Imu- & polttoaineosat": [
      "Imu- & polttoaineosat / Kaasuttimet",
      "Imu- & polttoaineosat / Kaasuttimen osat",
      "Imu- & polttoaineosat / Imukaulat",
      "Imu- & polttoaineosat / Läppärungot",
      "Imu- & polttoaineosat / Ilmansuodattimet",
      "Imu- & polttoaineosat / Polttoainehanat",
      "Imu- & polttoaineosat / Polttoaineletkut",
      "Imu- & polttoaineosat / Polttoainepumput"
    ],
    "Pakoputkisto": [
      "Pakoputkisto / Täydellinen pakoputkisto (pakoputki ja äänenvaimennin)",
      "Pakoputkisto / Pakoputket",
      "Pakoputkisto / Äänenvaimentimet",
      "Pakoputkisto / Pakoputken tiivisteet",
      "Pakoputkisto / Pakoputken kiinnikkeet"
    ],
    "Jäähdytysjärjestelmä": [
      "Jäähdytysjärjestelmä / Syylärit",
      "Jäähdytysjärjestelmä / Vesipumput",
      "Jäähdytysjärjestelmä / Jäähdytysletkut",
      "Jäähdytysjärjestelmä / Termostaatit"
    ],
    "Moottoriosat": [
      "Moottoriosat / Moottorin ripustukset",
      "Moottoriosat / Moottorin tukikumit",
      "Moottoriosat / Tuorevoitelupumput (2T)",
      "Moottoriosat / Tuorevoitelusäiliöt",
      "Moottoriosat / Jäähdytyspuhaltimet",
      "Moottoriosat / Puhallinkopat & ilmanohjaimet"
    ]
  },
  "Voimansiirto": {
    "Ketjut & rattaat": [
      "Ketjut & rattaat / Ketjut",
      "Ketjut & rattaat / Eturattaat",
      "Ketjut & rattaat / Takarattaat",
      "Ketjut & rattaat / Ketjunkiristimet",
      "Ketjut & rattaat / Ketjusuojat"
    ],
    "Variaattori": [
      "Variaattori / Etuvariaattorit",
      "Variaattori / Takavariaattorit",
      "Variaattori / Variaattorihihnat",
      "Variaattori / Variaattorin rullat",
      "Variaattori / Liukupalat",
      "Variaattori / Ramppilevyt",
      "Variaattori / Holkit & bossit",
      "Variaattori / Variaattorin lautaset",
      "Variaattori / Variaattorin tuulettimet",
      "Variaattori / Variaattorin kopat & lohkot"
    ],
    "Kytkin": [
      "Kytkin / Täydelliset keskipakokytkimet",
      "Kytkin / Kytkinkellot",
      "Kytkin / Kytkinjouset",
      "Kytkin / Vastapainejouset (VP-jouset)"
    ],
    "Perävälitys": [
      "Perävälitys / Perävälityssarjat & perävälit",
      "Perävälitys / Ensiövälityksen rattaat",
      "Perävälitys / Toisiovälityksen rattaat",
      "Perävälitys / Perävälityksen akselit",
      "Perävälitys / Perävälityksen laakerit",
      "Perävälitys / Perävälityksen stefat & tiivisteet",
      "Perävälitys / Perävälityskopat"
    ]
  },
  "Jousitus & ohjaus": {
    "Etujousitus": [
      "Etujousitus / Etuhaarukat",
      "Etujousitus / T-palat",
      "Etujousitus / Ohjauslaakerit"
    ],
    "Takajousitus": [
      "Takajousitus / Takaiskunvaimentimet",
      "Takajousitus / Takahaarukat",
      "Takajousitus / Linkustot"
    ],
    "Ohjaus": [
      "Ohjaus / Ohjaustangot",
      "Ohjaus / Tangon kiinnikkeet",
      "Ohjaus / Tupit",
      "Ohjaus / Kaasukahvat",
      "Ohjaus / Kytkinkahvat",
      "Ohjaus / Jarrukahvat",
      "Ohjaus / Peilit",
      "Ohjaus / Katkaisimet"
    ]
  },
  "Jarrut": {
    "Jarrujen osat": [
      "Jarrujen osat / Täydellinen etujarru",
      "Jarrujen osat / Täydellinen takajarru",
      "Jarrujen osat / Jarrusatulat",
      "Jarrujen osat / Jarrulevyt",
      "Jarrujen osat / Jarrupalat",
      "Jarrujen osat / Jarrusylinterit",
      "Jarrujen osat / Jarruletkut"
    ],
    "Jarruosat": [
      "Jarruosat / Jarrukengät",
      "Jarruosat / Jarrurummut",
      "Jarruosat / Takajarruvaijerit",
      "Jarruosat / Jarruvalokatkaisimet"
    ]
  },
  "Renkaat & vanteet": {
    "Renkaat": [
      "Renkaat / Eturenkaat",
      "Renkaat / Takarenkaat",
      "Renkaat / Sisärenkaat"
    ],
    "Vanteet": [
      "Vanteet / Etuvanteet",
      "Vanteet / Takavanteet",
      "Vanteet / Vanteiden laakerit",
      "Vanteet / Vanteiden akselit"
    ]
  },
  "Sähköjärjestelmä": {
    "Sytytys": [
      "Sytytys / Sytytyspuolat",
      "Sytytys / Sytytysyksiköt (CDI)",
      "Sytytys / Moottorinohjaimet (ECU)",
      "Sytytys / Staattorit",
      "Sytytys / Magneetto / vauhtipyörä",
      "Sytytys / Sytytystulpat"
    ],
    "Käynnistys & lataus": [
      "Käynnistys & lataus / Starttimoottorit",
      "Käynnistys & lataus / Starttireleet",
      "Käynnistys & lataus / Jännitteensäätimet",
      "Käynnistys & lataus / Akut",
      "Käynnistys & lataus / Poljinkäynnistimet & niiden osat"
    ],
    "Sähköosat": [
      "Sähköosat / Johdinsarjat",
      "Sähköosat / Releet",
      "Sähköosat / Sulakkeet",
      "Sähköosat / Anturit",
      "Sähköosat / Virtalukot"
    ],
    "Valot & mittaristo": [
      "Valot & mittaristo / Ajovalot",
      "Valot & mittaristo / Takavalot",
      "Valot & mittaristo / Vilkut",
      "Valot & mittaristo / Mittaristot",
      "Valot & mittaristo / Valokatkaisimet"
    ]
  },
  "Runko & koriosat": {
    "Runko": [
      "Runko / Runko",
      "Runko / Takarunko / takahäkki",
      "Runko / Polttoainetankki",
      "Runko / Tankinkorkit",
      "Runko / Seisontatuet",
      "Runko / Keskiseisontatuet",
      "Runko / Jalkatapit"
    ],
    "Katteet": [
      "Katteet / Etukatteet",
      "Katteet / Sivukatteet",
      "Katteet / Takakatteet",
      "Katteet / Lokasuojat",
      "Katteet / Katteiden kiinnikkeet"
    ],
    "Penkit": [
      "Penkit / Penkit",
      "Penkit / Penkinpäälliset",
      "Penkit / Penkin lukot & kiinnikkeet"
    ],
    "Koriosat": [
      "Koriosat / Astinlaudat & astinlautakatteet",
      "Koriosat / Etukatteen sisäosat",
      "Koriosat / Penkinaluskaukalot & tavaratilat",
      "Koriosat / Tavaratelineet",
      "Koriosat / Keskiseisontatuet",
      "Koriosat / Sivuseisontatuet",
      "Koriosat / Penkin saranat & lukot"
    ]
  }
};

export const twoWheelerPartCategories: Record<string, string[]> = Object.fromEntries(
  Object.entries(twoWheelerPartSubcategoryGroups).map(([category, groups]) => [
    category,
    Object.values(groups).flat()
  ])
);

export const atvPartSubcategoryGroups: Record<string, Record<string, string[]>> = {
  "Moottori": {
    "Kokonainen moottori": [
      "Kokonainen moottori / Täydelliset moottorit",
      "Kokonainen moottori / Moottoriprojektit / vialliset moottorit"
    ],
    "Sylinteri & sylinterin tarvikkeet": [
      "Sylinteri & sylinterin tarvikkeet / Sylinterisarjat",
      "Sylinteri & sylinterin tarvikkeet / Sylinterikannet",
      "Sylinteri & sylinterin tarvikkeet / Männät & tarvikkeet",
      "Sylinteri & sylinterin tarvikkeet / Sylinterin tiivisteet"
    ],
    "Kampiakseli & lohkot": [
      "Kampiakseli & lohkot / Lohkopuoliskot",
      "Kampiakseli & lohkot / Täydelliset kampiakselit",
      "Kampiakseli & lohkot / Kiertokanget",
      "Kampiakseli & lohkot / Lohkojen tiivisteet"
    ],
    "Vaihteisto": [
      "Vaihteisto / Täydelliset vaihteistot",
      "Vaihteisto / Vaihderummut",
      "Vaihteisto / Vaihdehaarukat",
      "Vaihteisto / Hammasrattaat"
    ],
    "Kytkin": [
      "Kytkin / Täydellinen kytkin",
      "Kytkin / Kytkinlevyt",
      "Kytkin / Kytkinkorit",
      "Kytkin / Kytkinjouset",
      "Kytkin / Kytkinkopat"
    ],
    "Imu- & polttoaineosat": [
      "Imu- & polttoaineosat / Kaasuttimet",
      "Imu- & polttoaineosat / Kaasuttimen osat",
      "Imu- & polttoaineosat / Imukaulat",
      "Imu- & polttoaineosat / Kaasuläpät",
      "Imu- & polttoaineosat / Ilmansuodattimet",
      "Imu- & polttoaineosat / Suuttimet",
      "Imu- & polttoaineosat / Polttoainepumput"
    ],
    "Pakoputkisto": [
      "Pakoputkisto / Täydellinen pakoputkisto",
      "Pakoputkisto / Pakoputket",
      "Pakoputkisto / Äänenvaimentimet",
      "Pakoputkisto / Pakoputken tiivisteet"
    ],
    "Jäähdytysjärjestelmä": [
      "Jäähdytysjärjestelmä / Syylärit",
      "Jäähdytysjärjestelmä / Vesipumput",
      "Jäähdytysjärjestelmä / Jäähdytysletkut"
    ]
  },
  "Voimansiirto": {
    "Kardaani & vetolinja": [
      "Kardaani & vetolinja / Kardaanit",
      "Kardaani & vetolinja / Vetarit",
      "Kardaani & vetolinja / Vetonivelet",
      "Kardaani & vetolinja / Tasauspyörästöt"
    ],
    "Variaattori": [
      "Variaattori / Etuvariaattorit",
      "Variaattori / Takavariaattorit",
      "Variaattori / Variaattorihihnat",
      "Variaattori / Rullat",
      "Variaattori / Keskipakokytkimet"
    ]
  },
  "Jousitus & ohjaus": {
    "Etujousitus": [
      "Etujousitus / A-tukivarret",
      "Etujousitus / Iskunvaimentimet",
      "Etujousitus / Pallonivelet",
      "Etujousitus / Raidetangot"
    ],
    "Takajousitus": [
      "Takajousitus / Takaiskunvaimentimet",
      "Takajousitus / Tukivarret",
      "Takajousitus / Akselit"
    ],
    "Ohjaus": [
      "Ohjaus / Ohjaustangot",
      "Ohjaus / Tangon kiinnikkeet",
      "Ohjaus / Ohjausakselit",
      "Ohjaus / Kaasukahvat",
      "Ohjaus / Kytkinkahvat",
      "Ohjaus / Jarrukahvat",
      "Ohjaus / Tupit"
    ]
  },
  "Jarrut": {
    "Jarrujen osat": [
      "Jarrujen osat / Täydellinen etujarru",
      "Jarrujen osat / Täydellinen takajarru",
      "Jarrujen osat / Jarrusatulat",
      "Jarrujen osat / Jarrulevyt",
      "Jarrujen osat / Jarrupalat",
      "Jarrujen osat / Jarrusylinterit"
    ]
  },
  "Renkaat & vanteet": {
    "Renkaat": [
      "Renkaat / Eturenkaat",
      "Renkaat / Takarenkaat"
    ],
    "Vanteet": [
      "Vanteet / Etuvanteet",
      "Vanteet / Takavanteet"
    ]
  },
  "Telasarjat": {
    "Telat": [
      "Telat / Täydelliset telasarjat",
      "Telat / Etutelat",
      "Telat / Takatelat",
      "Telat / Telaston osat"
    ]
  },
  "Sähköjärjestelmä": {
    "Sytytys": [
      "Sytytys / Sytytyspuolat",
      "Sytytys / CDI-yksiköt",
      "Sytytys / ECU:t",
      "Sytytys / Staattorit",
      "Sytytys / Magneetto / vauhtipyörä",
      "Sytytys / Sytytystulpat"
    ],
    "Käynnistys & lataus": [
      "Käynnistys & lataus / Starttimoottorit",
      "Käynnistys & lataus / Starttireleet",
      "Käynnistys & lataus / Jännitteensäätimet",
      "Käynnistys & lataus / Akut"
    ],
    "Sähköosat": [
      "Sähköosat / Johdinsarjat",
      "Sähköosat / Sulakkeet",
      "Sähköosat / Releet",
      "Sähköosat / Anturit",
      "Sähköosat / Virtalukot"
    ],
    "Valot & mittaristo": [
      "Valot & mittaristo / Ajovalot",
      "Valot & mittaristo / Takavalot",
      "Valot & mittaristo / Vilkut",
      "Valot & mittaristo / Mittaristot"
    ]
  },
  "Runko & koriosat": {
    "Runko": [
      "Runko / Runko",
      "Runko / Tavaratelineet",
      "Runko / Puskurit",
      "Runko / Astinlaudat",
      "Runko / Vinssit",
      "Runko / Vetokoukut",
      "Runko / Polttoainetankit"
    ],
    "Katteet": [
      "Katteet / Etukatteet",
      "Katteet / Sivukatteet",
      "Katteet / Takakatteet",
      "Katteet / Lokasuojat"
    ],
    "Penkit": [
      "Penkit / Penkit",
      "Penkit / Penkinpäälliset",
      "Penkit / Penkin lukot & kiinnikkeet"
    ]
  }
};

export const atvPartCategories: Record<string, string[]> = Object.fromEntries(
  Object.entries(atvPartSubcategoryGroups).map(([category, groups]) => [
    category,
    Object.values(groups).flat()
  ])
);

const scooterOnlyPartGroups = new Set([
  "Moottori::Moottoriosat",
  "Voimansiirto::Variaattori",
  "Voimansiirto::Kytkin",
  "Voimansiirto::Perävälitys",
  "Jarrut::Jarruosat",
  "Runko & koriosat::Koriosat"
]);

const gearedBikeOnlyPartGroups = new Set([
  "Moottori::Vaihteisto",
  "Moottori::Kytkin",
  "Voimansiirto::Ketjut & rattaat"
]);

export function isScooterVehicleSubtype(
  vehicleType: string | null | undefined,
  vehicleSubtype: string | null | undefined
) {
  const normalizedVehicle = normalizeVehicleType(vehicleType);
  const normalizedSubtype = (vehicleSubtype ?? "").trim().toLocaleLowerCase("fi");

  return (
    (normalizedVehicle === "Mopo" || normalizedVehicle === "Moottoripyörä") &&
    normalizedSubtype.includes("skootteri")
  );
}

export function filterVehiclePartCategoriesBySubtype(
  categorySource: Record<string, readonly string[]>,
  vehicleType: string | null | undefined,
  vehicleSubtype: string | null | undefined
): Record<string, string[]> {
  const normalizedVehicle = normalizeVehicleType(vehicleType);
  const isTwoWheeler =
    normalizedVehicle === "Mopo" ||
    normalizedVehicle === "Moottoripyörä" ||
    normalizedVehicle === "Motocross";

  if (!isTwoWheeler) {
    return Object.fromEntries(
      Object.entries(categorySource).map(([category, subcategories]) => [
        category,
        [...subcategories]
      ])
    );
  }

  const scooterSubtype = isScooterVehicleSubtype(vehicleType, vehicleSubtype);

  return Object.fromEntries(
    Object.entries(categorySource)
      .map(([category, subcategories]) => [
        category,
        subcategories.filter((subcategory) => {
          const groupName = subcategory.split(" / ", 1)[0]?.trim() ?? "";
          const qualifiedGroupName = `${category}::${groupName}`;
          return scooterSubtype
            ? !gearedBikeOnlyPartGroups.has(qualifiedGroupName)
            : !scooterOnlyPartGroups.has(qualifiedGroupName);
        })
      ] as const)
      .filter(([, subcategories]) => subcategories.length > 0)
  );
}

function usesTwoWheelerPartTaxonomy(vehicleType: string) {
  const normalizedVehicle = normalizeVehicleType(vehicleType);
  return (
    normalizedVehicle === "Mopo" ||
    normalizedVehicle === "Moottoripyörä" ||
    normalizedVehicle === "Motocross"
  );
}

export function normalizeVehicleType(value?: string | null) {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (["moottoripyora", "moottoripyorat", "motorcycle", "motorcycles"].includes(normalized)) {
    return "Moottoripyörä";
  }
  if (["mopo", "mopot", "moped", "mopeds"].includes(normalized)) {
    return "Mopo";
  }
  if (["monkija", "monkijat", "atv", "atvs", "quad", "quads"].includes(normalized)) {
    return "Mönkijä";
  }
  if (["moottorikelkka", "moottorikelkat", "kelkka", "kelkat", "snowmobile", "snowmobiles"].includes(normalized)) {
    return "Moottorikelkka";
  }
  if (["motocross", "cross", "crossi", "crossit", "mx"].includes(normalized)) {
    return "Motocross";
  }

  return value ?? "";
}

export function isKnownVehicleType(value?: string | null) {
  return [
    "Moottoripyörä",
    "Mopo",
    "Mönkijä",
    "Moottorikelkka",
    "Motocross"
  ].includes(normalizeVehicleType(value));
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

  const isTwoWheeler =
    normalizedVehicle === "Mopo" ||
    normalizedVehicle === "Motocross" ||
    normalizedVehicle === "Moottoripyörä";

  if (isTwoWheeler) {
    const twoWheelerDisallowed =
      subcategory.startsWith("Tukivarret /") ||
      subcategory === "Kokonainen alusta" ||
      subcategory === "Olka-akselit" ||
      subcategory === "Vetoakselit" ||
      subcategory === "Ohjaus / Ohjausakselit" ||
      subcategory === "Ohjaus / Raidetangot" ||
      subcategory === "Kytkimet / Painovarret" ||
      subcategory === "Kuomut & konepellit" ||
      subcategory === "Etupuskurit" ||
      subcategory === "Takapuskurit";

    if (twoWheelerDisallowed) return false;

    if (
      normalizedVehicle === "Motocross" &&
      (
        subcategory.startsWith("Variaattorit /") ||
        subcategory === "Variaattorin hihnat" ||
        subcategory === "Tuulilasit"
      )
    ) {
      return false;
    }
  }

  const atvOrSnowmobileOnly =
    category === "Runko & katteet" &&
    subcategory === "Kuomut & konepellit";

  return !atvOrSnowmobileOnly;
}

export function displayCategoryForVehicle(
  vehicleType: string | null | undefined,
  category: string
) {
  const normalizedVehicle = normalizeVehicleType(vehicleType);

  if (
    category === "Alusta & telasto" &&
    (normalizedVehicle === "Motocross" || normalizedVehicle === "Mopo" || normalizedVehicle === "Moottoripyörä")
  ) {
    return "Renkaat, vanteet & alusta";
  }

  return category;
}

export function buildVehicleCategories(vehicleType: string, vehicleSubtype?: string) {
  if (normalizeVehicleType(vehicleType) === "Mönkijä") {
    return Object.fromEntries(
      Object.entries(atvPartCategories).map(([category, subcategories]) => [
        category,
        [...subcategories]
      ])
    );
  }

  if (usesTwoWheelerPartTaxonomy(vehicleType)) {
    if (vehicleSubtype === undefined) {
      return Object.fromEntries(
        Object.entries(twoWheelerPartCategories).map(([category, subcategories]) => [
          category,
          [...subcategories]
        ])
      );
    }

    return filterVehiclePartCategoriesBySubtype(
      twoWheelerPartCategories,
      vehicleType,
      vehicleSubtype
    );
  }

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
  ...twoWheelerPartSubcategoryGroups,
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
    "Tukivarret":         ["Tukivarret / Täydellinen tukivarsi sarja","Tukivarret / Ylä tukivarret oikea","Tukivarret / Ala tukivarret oikea","Tukivarret / Ylä tukivarret vasen","Tukivarret / Ala tukivarret vasen"],
    "Iskunvaimentimet":   ["Iskunvaimentimet / Kokonainen iskunvaimennussarja","Iskunvaimentimet / Etuiskunvaimentimet","Iskunvaimentimet / Takaiskunvaimentimet","Iskunvaimentimet / Telaston iskunvaimentimet","Jouset"]
  },
  "Ohjaus & hallintalaitteet": {
    "Ohjaus akseli":      ["Kokonainen ohjaus","Ohjaustangot","Käsisuojat","Tangon korokepalat","Ohjaus / Ohjausakselit","Ohjaus / Raidetangot","Ohjaus / Muut ohjauksen osat"],
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
    "Runko":              ["Kokonainen runko","Tunnelit / Keskirunko","Tunnelit / Eturunko","Tunnelit / Takarunko"],
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

