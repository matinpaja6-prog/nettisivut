import { isVehicleListing, type Listing } from "@/lib/listings";

export type SeoCollectionKind = "parts" | "vehicles";
export type SeoSearchLocale = "fi" | "en" | "sv" | "no";

export type SeoCollectionLink = {
  kind: SeoCollectionKind;
  query: string;
  path: string;
  count: number;
};

export type SeoCollectionDescriptor = {
  kind: SeoCollectionKind;
  query: string;
  path: string;
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

function seoPathFromSegments(kind: SeoCollectionKind, ...segments: Array<string | null | undefined>) {
  const root = kind === "vehicles" ? "/ajoneuvot" : "/varaosat";
  const pathSegments = segments
    .map((segment) => seoSearchSlug(String(segment ?? "")))
    .filter(Boolean);

  return `${root}/${pathSegments.join("/")}`;
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

export function seoLocalizedCollectionRoot(
  kind: SeoCollectionKind,
  locale: SeoSearchLocale
) {
  return `/${localizedCollectionSegments[locale][kind]}`;
}

const localizedSeoTerms: Record<string, Record<Exclude<SeoSearchLocale, "fi">, string>> = {
  "alusta telasto": { en: "chassis track system", sv: "chassi boggi", no: "ramme understell" },
  anturit: { en: "sensors", sv: "sensorer", no: "sensorer" },
  "ecu ohjainyksikot": { en: "ecu control units", sv: "ecu styrenheter", no: "ecu styreenheter" },
  iskarit: { en: "shocks", sv: "stötdämpare", no: "støtdempere" },
  iskunvaimentimet: { en: "shock absorbers", sv: "stötdämpare", no: "støtdempere" },
  etuiskunvaimentimet: { en: "front shocks", sv: "främre stötdämpare", no: "fremre støtdempere" },
  takaiskunvaimentimet: { en: "rear shocks", sv: "bakre stötdämpare", no: "bakre støtdempere" },
  etukatteet: { en: "front panels", sv: "framkåpor", no: "frontdeksler" },
  etupuskurit: { en: "front bumpers", sv: "främre stötfångare", no: "frontstøtfangere" },
  eturunko: { en: "front frame", sv: "framram", no: "frontramme" },
  jarrut: { en: "brakes", sv: "bromsar", no: "bremser" },
  "jaahdytys polttoaine": { en: "cooling fuel", sv: "kylning bränsle", no: "kjøling drivstoff" },
  kaasuttimet: { en: "carburetors", sv: "förgasare", no: "forgassere" },
  katteet: { en: "fairings", sv: "kåpor", no: "kåper" },
  keskirunko: { en: "center frame", sv: "mittram", no: "midtramme" },
  ketjukotelot: { en: "chaincases", sv: "kedjehus", no: "kjedehus" },
  "kokonainen iskunvaimennussarja": { en: "complete shock set", sv: "komplett stötdämparset", no: "komplett støtdempersett" },
  "kokonainen jarrujarjestelma": { en: "complete brake system", sv: "komplett bromssystem", no: "komplett bremsesystem" },
  "kokonainen moottori": { en: "complete engine", sv: "komplett motor", no: "komplett motor" },
  "kokonainen pakoputkisto": { en: "complete exhaust system", sv: "komplett avgassystem", no: "komplett eksosanlegg" },
  "kokonainen runko": { en: "complete frame", sv: "komplett ram", no: "komplett ramme" },
  "kokonainen telasto": { en: "complete track suspension", sv: "komplett boggi", no: "komplett understell" },
  "kokonainen variaattori": { en: "complete variator", sv: "komplett variator", no: "komplett variator" },
  letkut: { en: "hoses", sv: "slangar", no: "slanger" },
  moottori: { en: "engine", sv: "motor", no: "motor" },
  "moottori voimansiirto": { en: "engine drivetrain", sv: "motor drivlina", no: "motor drivverk" },
  "muut ohjauksen osat": { en: "other steering parts", sv: "övriga styrdelar", no: "andre styringsdeler" },
  "ohjaus hallintalaitteet": { en: "steering controls", sv: "styrning reglage", no: "styring kontroller" },
  putki: { en: "exhaust pipe", sv: "avgasror", no: "eksosror" },
  pakoputki: { en: "exhaust pipe", sv: "avgasror", no: "eksosror" },
  pakoputkisto: { en: "exhaust", sv: "avgassystem", no: "eksosanlegg" },
  "polttoainesailiot tankit": { en: "fuel tanks", sv: "bränsletankar", no: "drivstofftanker" },
  penkit: { en: "seats", sv: "säten", no: "seter" },
  "istuimet penkit": { en: "seats", sv: "säten", no: "seter" },
  puskurit: { en: "bumpers", sv: "stötfångare", no: "støtfangere" },
  runko: { en: "chassis", sv: "chassi", no: "ramme" },
  "runko katteet": { en: "frame panels", sv: "ram kåpor", no: "ramme deksler" },
  "runko koriosat": { en: "frame body parts", sv: "ram karossdelar", no: "ramme karosserideler" },
  ruiskutusjarjestelmat: { en: "injection systems", sv: "insprutningssystem", no: "innsprøytningssystemer" },
  sahkojarjestelmat: { en: "electrical systems", sv: "elsystem", no: "elektriske systemer" },
  staattorit: { en: "stators", sv: "statorer", no: "statorer" },
  "staattorit vauhtipyorat": { en: "stators flywheels", sv: "statorer svänghjul", no: "statorer svinghjul" },
  "sylinterin kannet": { en: "cylinder heads", sv: "topplock", no: "topplokk" },
  sukset: { en: "skis", sv: "skidor", no: "ski" },
  tangot: { en: "rods", sv: "stag", no: "stag" },
  telamatot: { en: "tracks", sv: "drivmattor", no: "belter" },
  telasto: { en: "suspension", sv: "boggi", no: "understell" },
  takapukit: { en: "rear suspension arms", sv: "bakre boggiefästen", no: "bakre boggiefester" },
  "taydelliset moottorit": { en: "complete engines", sv: "kompletta motorer", no: "komplette motorer" },
  valot: { en: "lights", sv: "lampor", no: "lys" },
  "vasen ala": { en: "lower left", sv: "vänster nedre", no: "venstre nedre" },
  variaattori: { en: "variator", sv: "variator", no: "variator" },
  vetoakselit: { en: "drive shafts", sv: "drivaxlar", no: "drivaksler" }
};

// Product manufacturers and performance-part brands are often the strongest
// buying-intent words in a listing title. Keep this list deliberately focused:
// it gives searches such as "Yamaha DT Voca" a stable landing page without
// turning every arbitrary word in a seller's description into an indexable URL.
const knownPartProductTerms = [
  "airsal",
  "bidalot",
  "brp",
  "kashima",
  "kyb",
  "malossi",
  "nos",
  "polini",
  "powdermax",
  "stage 6",
  "stage6",
  "tpr",
  "voca"
];

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

export function seoLocalizedCollectionDescriptorPath(
  kind: SeoCollectionKind,
  finnishPath: string,
  locale: SeoSearchLocale
) {
  if (locale === "fi") return finnishPath;

  const segments = finnishPath.split("/").filter(Boolean).slice(1);
  const localizedSegments = segments.map((segment) =>
    seoSearchSlug(localizeSeoSearchQuery(seoSearchQueryFromSlug(segment), locale))
  );

  return `${seoLocalizedCollectionRoot(kind, locale)}/${localizedSegments.join("/")}`;
}

export function seoCollectionLanguagePaths(
  kind: SeoCollectionKind,
  query: string,
  canonicalFinnishPath?: string
) {
  return {
    "fi-FI": canonicalFinnishPath || seoLocalizedCollectionPath(kind, query, "fi"),
    en: canonicalFinnishPath
      ? seoLocalizedCollectionDescriptorPath(kind, canonicalFinnishPath, "en")
      : seoLocalizedCollectionPath(kind, query, "en"),
    sv: canonicalFinnishPath
      ? seoLocalizedCollectionDescriptorPath(kind, canonicalFinnishPath, "sv")
      : seoLocalizedCollectionPath(kind, query, "sv"),
    nb: canonicalFinnishPath
      ? seoLocalizedCollectionDescriptorPath(kind, canonicalFinnishPath, "no")
      : seoLocalizedCollectionPath(kind, query, "no"),
    "x-default": canonicalFinnishPath || seoLocalizedCollectionPath(kind, query, "fi")
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

function seoPartProductTerms(
  listing: Pick<Listing, "title" | "description" | "part_model">
) {
  const productText = normalizeSeoSearchText([
    listing.part_model,
    listing.title,
    listing.description
  ].filter(Boolean).join(" "));
  const paddedText = ` ${productText} `;
  const terms = new Set<string>();

  for (const term of knownPartProductTerms) {
    const normalizedTerm = normalizeSeoSearchText(term);
    if (paddedText.includes(` ${normalizedTerm} `)) terms.add(normalizedTerm);
  }

  // A dedicated part-model field is controlled catalogue data and can safely
  // become a search term even when the manufacturer is not yet in the list.
  const partModel = normalizeSeoSearchText(listing.part_model);
  if (partModel && partModel.length <= 48) {
    terms.add(partModel);
    const firstWord = partModel.split(" ")[0];
    if (firstWord && firstWord.length >= 3) terms.add(firstWord);
  }

  return [...terms];
}

export function seoPartSearchQueries(listing: Listing) {
  return seoPartCollectionDescriptors(listing).map((descriptor) => descriptor.query);
}

export function seoPartCollectionDescriptors(listing: Listing): SeoCollectionDescriptor[] {
  if (isVehicleListing(listing)) return [];

  const vehicleType = normalizeSeoSearchText(listing.vehicle_type);
  const brand = normalizeSeoSearchText(listing.brand);
  const model = normalizeSeoSearchText(listing.model);
  const year = normalizeSeoSearchText(listing.year);
  const vehicleQueries = seoListingSearchQueries(listing);
  const descriptors = new Map<string, SeoCollectionDescriptor>();
  const partTerms = seoPartTerms(listing).filter((term) => {
    const wordCount = term.split(" ").filter(Boolean).length;
    return term.length <= 36 && wordCount <= 3;
  });
  const productTerms = seoPartProductTerms(listing);

  const add = (query: string, path: string) => {
    const normalizedQuery = normalizeSeoSearchText(query);
    if (!normalizedQuery || !path) return;
    descriptors.set(`${normalizedQuery}:${path}`, {
      kind: "parts",
      query: normalizedQuery,
      path
    });
  };

  for (const vehicleQuery of vehicleQueries) {
    const variantModel = vehicleQuery.startsWith(`${brand} `)
      ? vehicleQuery.slice(brand.length + 1).trim()
      : "";
    if (brand && variantModel) {
      add(vehicleQuery, seoPathFromSegments("parts", brand, variantModel));
      if (year) {
        add(
          `${vehicleQuery} ${year}`,
          seoPathFromSegments("parts", brand, variantModel, year)
        );
      }
    } else {
      add(vehicleQuery, seoSearchPath(vehicleQuery));
    }
  }

  if (brand) add(brand, seoPathFromSegments("parts", brand));
  if (vehicleType) add(vehicleType, seoPathFromSegments("parts", vehicleType));
  if (vehicleType && brand) {
    add(`${vehicleType} ${brand}`, seoPathFromSegments("parts", vehicleType, brand));
  }
  if (brand && model) {
    add(`${brand} ${model}`, seoPathFromSegments("parts", brand, model));
  }
  if (brand && model && year) {
    add(`${brand} ${model} ${year}`, seoPathFromSegments("parts", brand, model, year));
  }

  // Publish only concise combinations backed by a live listing. Brand, model
  // and part type mirror real purchase searches without producing a separate
  // index page for every possible vehicle-type/category permutation.
  for (const partTerm of partTerms) {
    add(partTerm, seoPathFromSegments("parts", partTerm));
    if (brand) {
      add(`${brand} ${partTerm}`, seoPathFromSegments("parts", brand, partTerm));
    }
    if (brand && model) {
      add(
        `${brand} ${model} ${partTerm}`,
        seoPathFromSegments("parts", brand, model, partTerm)
      );
    }
    if (brand && model && year) {
      add(
        `${brand} ${model} ${year} ${partTerm}`,
        seoPathFromSegments("parts", brand, model, year, partTerm)
      );
    }
  }

  // Keep model and model+part landing pages useful and distinct. The year is
  // carried by each individual listing's title and metadata, so we avoid
  // publishing hundreds of near-duplicate year-filtered collection pages.
  for (const vehicleQuery of vehicleQueries.slice(0, 2)) {
    const variantModel = vehicleQuery.startsWith(`${brand} `)
      ? vehicleQuery.slice(brand.length + 1).trim()
      : "";
    for (const partTerm of partTerms) {
      add(
        `${vehicleQuery} ${partTerm}`,
        variantModel
          ? seoPathFromSegments("parts", brand, variantModel, partTerm)
          : seoSearchPath(`${vehicleQuery} ${partTerm}`)
      );
      if (variantModel && year) {
        add(
          `${vehicleQuery} ${year} ${partTerm}`,
          seoPathFromSegments("parts", brand, variantModel, year, partTerm)
        );
      }
    }

    for (const productTerm of productTerms) {
      if (brand && variantModel) {
        add(
          `${vehicleQuery} ${productTerm}`,
          seoPathFromSegments("parts", brand, variantModel, productTerm)
        );
      } else {
        add(`${vehicleQuery} ${productTerm}`, seoSearchPath(`${vehicleQuery} ${productTerm}`));
      }
    }
  }

  return [...descriptors.values()];
}

export function findGeneratedSeoCollectionDescriptor(
  listings: Listing[],
  requestedPath: string,
  kind: SeoCollectionKind
) {
  const normalizedRequestedPath = `/${requestedPath
    .split("/")
    .map((segment) => seoSearchSlug(decodeURIComponent(segment)))
    .filter(Boolean)
    .join("/")}`;
  const descriptors = new Map<string, SeoCollectionDescriptor>();

  for (const listing of listings) {
    const listingKind: SeoCollectionKind = isVehicleListing(listing) ? "vehicles" : "parts";
    if (listingKind !== kind) continue;

    if (kind === "parts") {
      for (const descriptor of seoPartCollectionDescriptors(listing)) {
        descriptors.set(descriptor.path, descriptor);
        descriptors.set(seoCollectionPath(kind, descriptor.query), descriptor);
      }
    } else {
      for (const query of seoVehicleSearchQueries(listing)) {
        const descriptor = { kind, query, path: seoCollectionPath(kind, query) };
        descriptors.set(descriptor.path, descriptor);
      }
    }
  }

  return descriptors.get(normalizedRequestedPath);
}

export function findGeneratedSeoCollectionQuery(
  listings: Listing[],
  requestedQuery: string,
  kind: SeoCollectionKind
) {
  const requestedSlug = seoSearchSlug(requestedQuery);
  const generatedQueries = new Set<string>();

  for (const listing of listings) {
    const listingKind: SeoCollectionKind = isVehicleListing(listing) ? "vehicles" : "parts";
    if (listingKind !== kind) continue;

    const queries = kind === "vehicles"
      ? seoVehicleSearchQueries(listing)
      : seoPartSearchQueries(listing);
    for (const query of queries) generatedQueries.add(query);
  }

  return [...generatedQueries].find((query) => seoSearchSlug(query) === requestedSlug);
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
    const descriptors = kind === "vehicles"
      ? seoVehicleSearchQueries(listing).map((query) => ({
          kind,
          query,
          path: seoCollectionPath(kind, query)
        }))
      : seoPartCollectionDescriptors(listing);

    for (const descriptor of descriptors) {
      const { query, path } = descriptor;
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
    listing.vehicle_type,
    listing.brand,
    listing.model,
    listing.year,
    listing.part_model,
    listing.part_number,
    listing.category,
    listing.subcategory,
    listing.engine_model,
    ...seoPartTerms(listing)
  ].join(" "));
  const haystackWords = new Set(haystack.split(" ").filter(Boolean));

  // Generated collection terms are normalized catalogue words. A substring
  // match made "moottori" (engine) match "moottorikelkka" (snowmobile), so
  // an engine landing page incorrectly contained nearly every spare part.
  return words.every((word) => haystackWords.has(word));
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
