import { isVehicleListing, type Listing } from "@/lib/listings";

export type SeoCollectionKind = "parts" | "vehicles";
export type SeoSearchLocale = "fi" | "en" | "sv" | "no";

export type SeoCollectionLink = {
  kind: SeoCollectionKind;
  query: string;
  path: string;
  count: number;
};

export function normalizeSeoSearchText(value: unknown) {
  return String(value ?? "")
    .replace(/æ/gi, "ae")
    .replace(/[øö]/gi, "o")
    .replace(/[åä]/gi, "a")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fi")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function seoSearchSlug(query: string) {
  return normalizeSeoSearchText(query).replace(/ /g, "-");
}

export function seoSearchPath(query: string) {
  return `/varaosat/${seoSearchSlug(query)}`;
}

export function seoVehicleSearchPath(query: string) {
  return `/ajoneuvot/${seoSearchSlug(query)}`;
}

export function seoCollectionPath(kind: SeoCollectionKind, query: string) {
  return kind === "vehicles" ? seoVehicleSearchPath(query) : seoSearchPath(query);
}

const localizedCollectionSegments: Record<
  SeoSearchLocale,
  Record<SeoCollectionKind, string>
> = {
  fi: { vehicles: "ajoneuvot", parts: "varaosat" },
  en: { vehicles: "en/vehicles", parts: "en/parts" },
  sv: { vehicles: "sv/fordon", parts: "sv/reservdelar" },
  no: { vehicles: "no/kjoretoy", parts: "no/reservedeler" }
};

const localizedSeoTerms: Record<string, Record<Exclude<SeoSearchLocale, "fi">, string>> = {
  anturit: { en: "sensors", sv: "sensorer", no: "sensorer" },
  iskarit: { en: "shocks", sv: "stötdämpare", no: "støtdempere" },
  iskunvaimentimet: { en: "shock absorbers", sv: "stötdämpare", no: "støtdempere" },
  etuiskunvaimentimet: { en: "front shocks", sv: "främre stötdämpare", no: "fremre støtdempere" },
  takaiskunvaimentimet: { en: "rear shocks", sv: "bakre stötdämpare", no: "bakre støtdempere" },
  jarrut: { en: "brakes", sv: "bromsar", no: "bremser" },
  katteet: { en: "fairings", sv: "kåpor", no: "kåper" },
  ketjukotelot: { en: "chaincases", sv: "kedjehus", no: "kjedehus" },
  letkut: { en: "hoses", sv: "slangar", no: "slanger" },
  moottori: { en: "engine", sv: "motor", no: "motor" },
  putki: { en: "exhaust pipe", sv: "avgasror", no: "eksosror" },
  pakoputki: { en: "exhaust pipe", sv: "avgasror", no: "eksosror" },
  pakoputkisto: { en: "exhaust", sv: "avgassystem", no: "eksosanlegg" },
  penkit: { en: "seats", sv: "säten", no: "seter" },
  puskurit: { en: "bumpers", sv: "stötfångare", no: "støtfangere" },
  runko: { en: "chassis", sv: "chassi", no: "ramme" },
  staattorit: { en: "stators", sv: "statorer", no: "statorer" },
  sukset: { en: "skis", sv: "skidor", no: "ski" },
  tangot: { en: "rods", sv: "stag", no: "stag" },
  telamatot: { en: "tracks", sv: "drivmattor", no: "belter" },
  telasto: { en: "suspension", sv: "boggi", no: "understell" },
  valot: { en: "lights", sv: "lampor", no: "lys" },
  variaattori: { en: "variator", sv: "variator", no: "variator" },
  vetoakselit: { en: "drive shafts", sv: "drivaxlar", no: "drivaksler" }
};

export function localizeSeoSearchQuery(query: string, locale: SeoSearchLocale) {
  const normalized = normalizeSeoSearchText(query);
  if (locale === "fi") return normalized;

  const terms = Object.keys(localizedSeoTerms).sort((a, b) => b.length - a.length);
  let localized = ` ${normalized} `;
  for (const term of terms) {
    localized = localized.replace(new RegExp(`\\b${term}\\b`, "g"), localizedSeoTerms[term][locale]);
  }
  return localized.trim().replace(/\s+/g, " ");
}

export function seoLocalizedCollectionPath(
  kind: SeoCollectionKind,
  query: string,
  locale: SeoSearchLocale
) {
  return `/${localizedCollectionSegments[locale][kind]}/${seoSearchSlug(
    localizeSeoSearchQuery(query, locale)
  )}`;
}

export function seoCollectionLanguagePaths(kind: SeoCollectionKind, query: string) {
  return {
    "fi-FI": seoLocalizedCollectionPath(kind, query, "fi"),
    en: seoLocalizedCollectionPath(kind, query, "en"),
    sv: seoLocalizedCollectionPath(kind, query, "sv"),
    nb: seoLocalizedCollectionPath(kind, query, "no"),
    "x-default": seoLocalizedCollectionPath(kind, query, "fi")
  };
}

export function seoSearchQueryFromSlug(slug: string) {
  return normalizeSeoSearchText(decodeURIComponent(slug)).replace(/\s+/g, " ");
}

export function seoListingSearchQueries(
  listing: Pick<Listing, "brand" | "model" | "title">
) {
  const brand = normalizeSeoSearchText(listing.brand);
  const model = normalizeSeoSearchText(listing.model);
  if (!brand || !model) return [];

  const modelWords = model.split(" ").filter(Boolean);
  const finalModelWord = modelWords.at(-1) ?? "";
  const wellKnownVariantCodes = new Set(["re", "rs"]);

  // Buyers commonly group variants such as Lynx Rave RS and Ski-Doo MXZ RS
  // under the shorter "Lynx RS" / "Ski-Doo RS" search. Use one canonical
  // collection query instead of publishing several pages with identical items.
  const baseQueries = new Set([`${brand} ${model}`]);

  if (modelWords.length > 1 && wellKnownVariantCodes.has(finalModelWord)) {
    baseQueries.add(`${brand} ${modelWords.slice(0, -1).join(" ")}`);
    baseQueries.add(`${brand} ${finalModelWord}`);
  }

  return [...baseQueries];
}

function seoPartTerms(listing: Pick<Listing, "category" | "subcategory">) {
  const terms = new Set<string>();
  const category = normalizeSeoSearchText(listing.category);
  const subcategory = normalizeSeoSearchText(
    listing.subcategory?.split("/").map((part) => part.trim()).filter(Boolean).at(-1)
  );

  if (subcategory) terms.add(subcategory);
  if (category && category !== "ajoneuvot" && category !== subcategory) terms.add(category);

  // Common searches often use only the final noun from a compound category,
  // for example "tangot" instead of the stored "raidetangot".
  const searchableSuffixes = [
    "anturit",
    "iskunvaimentimet",
    "iskarit",
    "jarrut",
    "katteet",
    "ketjukotelot",
    "letkut",
    "moottori",
    "pakoputkisto",
    "penkit",
    "puskurit",
    "runko",
    "staattorit",
    "sukset",
    "tangot",
    "telamatot",
    "telasto",
    "valot",
    "variaattori",
    "vetoakselit"
  ];

  for (const value of [category, subcategory]) {
    const valueWords = new Set(value.split(" ").filter(Boolean));
    for (const suffix of searchableSuffixes) {
      if (value.includes(suffix) && !valueWords.has(suffix)) terms.add(suffix);
    }
  }

  if ([category, subcategory].some((value) => value.includes("iskunvaiment"))) {
    terms.add("iskarit");
  }
  if ([category, subcategory].some((value) => value.includes("iskarit"))) {
    terms.add("iskunvaimentimet");
  }
  // Finnish buyers often search for an exhaust with the shorter everyday
  // terms "putki" or "pakoputki". Publish those useful model-specific
  // collection URLs alongside the taxonomy term "pakoputkisto", for example
  // /varaosat/yamaha-dt-putki.
  if ([category, subcategory].some((value) =>
    value.includes("pakoputk") || value.includes("tehoputk")
  )) {
    terms.add("putki");
    terms.add("pakoputki");
  }

  return [...terms];
}

export function seoPartSearchQueries(listing: Listing) {
  if (isVehicleListing(listing)) return [];

  const vehicleType = normalizeSeoSearchText(listing.vehicle_type);
  const brand = normalizeSeoSearchText(listing.brand);
  const model = normalizeSeoSearchText(listing.model);
  const vehicleQueries = seoListingSearchQueries(listing);
  const queries = new Set(vehicleQueries);
  const partTerms = seoPartTerms(listing);

  // Publish only combinations backed by a live listing. These cover the ways
  // buyers actually narrow a catalogue: part type, brand, model and vehicle
  // type, from broad category pages down to an exact fitment search.
  for (const partTerm of partTerms) {
    queries.add(partTerm);
    if (brand) queries.add(`${brand} ${partTerm}`);
    if (brand && model) queries.add(`${brand} ${model} ${partTerm}`);
    if (vehicleType) queries.add(`${vehicleType} ${partTerm}`);
    if (vehicleType && brand) queries.add(`${vehicleType} ${brand} ${partTerm}`);
    if (vehicleType && brand && model) {
      queries.add(`${vehicleType} ${brand} ${model} ${partTerm}`);
    }
  }

  if (brand) queries.add(brand);
  if (vehicleType) queries.add(vehicleType);
  if (vehicleType && brand) queries.add(`${vehicleType} ${brand}`);
  if (vehicleType && brand && model) queries.add(`${vehicleType} ${brand} ${model}`);

  // Keep model and model+part landing pages useful and distinct. The year is
  // carried by each individual listing's title and metadata, so we avoid
  // publishing hundreds of near-duplicate year-filtered collection pages.
  for (const vehicleQuery of vehicleQueries.slice(0, 2)) {
    for (const partTerm of seoPartTerms(listing)) {
      queries.add(`${vehicleQuery} ${partTerm}`);
    }
  }

  return [...queries];
}

export function seoVehicleSearchQueries(listing: Listing) {
  if (!isVehicleListing(listing)) return [];

  const vehicleType = normalizeSeoSearchText(listing.vehicle_type);
  const brand = normalizeSeoSearchText(listing.brand);
  const model = normalizeSeoSearchText(listing.model);
  const queries = new Set(seoListingSearchQueries(listing));

  if (vehicleType) queries.add(vehicleType);
  if (brand) queries.add(brand);
  if (vehicleType && brand) queries.add(`${vehicleType} ${brand}`);
  if (vehicleType && brand && model) queries.add(`${vehicleType} ${brand} ${model}`);

  return [...queries];
}

export function listingMatchesSeoCollection(
  listing: Listing,
  query: string,
  kind: SeoCollectionKind
) {
  if (kind === "vehicles" ? !isVehicleListing(listing) : isVehicleListing(listing)) {
    return false;
  }

  return listingMatchesSeoQuery(listing, query);
}

export function buildSeoCollectionLinks(
  listings: Listing[],
  minimumListings = 1
): SeoCollectionLink[] {
  const groups = new Map<string, SeoCollectionLink>();

  for (const listing of listings) {
    const kind: SeoCollectionKind = isVehicleListing(listing) ? "vehicles" : "parts";
    const queries = kind === "vehicles"
      ? seoVehicleSearchQueries(listing)
      : seoPartSearchQueries(listing);

    for (const query of queries) {
      const path = seoCollectionPath(kind, query);
      const key = `${kind}:${path}`;
      const current = groups.get(key);
      groups.set(key, {
        kind,
        query,
        path,
        count: (current?.count ?? 0) + 1
      });
    }
  }

  return [...groups.values()]
    .filter((group) => group.count >= minimumListings)
    .sort((first, second) =>
      second.count - first.count || first.path.localeCompare(second.path, "fi")
    );
}

export function listingMatchesSeoQuery(listing: Listing, query: string) {
  const words = normalizeSeoSearchText(query).split(" ").filter(Boolean);
  if (words.length === 0) return false;

  const haystack = normalizeSeoSearchText([
    listing.title,
    listing.description,
    listing.brand,
    listing.model,
    listing.part_model,
    listing.part_number,
    listing.category,
    listing.subcategory,
    listing.engine_model,
    ...seoPartTerms(listing)
  ].join(" "));
  const haystackWords = new Set(haystack.split(" ").filter(Boolean));

  return words.every((word) =>
    word.length <= 3 ? haystackWords.has(word) : haystack.includes(word)
  );
}

export function formatSeoSearchLabel(query: string) {
  const acronyms = new Set([
    "atv",
    "dt",
    "ecu",
    "exc",
    "mxz",
    "oem",
    "pps",
    "qrs",
    "re",
    "rmk",
    "rs",
    "xcr"
  ]);

  const label = normalizeSeoSearchText(query)
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word === "ja") return word;
      if (acronyms.has(word)) return word.toUpperCase();
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");

  return label
    .replace(/\bSki Doo\b/g, "Ski-Doo")
    .replace(/\bCan Am\b/g, "Can-Am");
}
