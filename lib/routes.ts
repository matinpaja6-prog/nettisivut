const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export type RouteLocale = "fi" | "en" | "sv" | "no" | "et";

const listingSegments: Record<RouteLocale, string> = {
  fi: "ilmoitukset",
  en: "listings",
  sv: "annonser",
  no: "annonser",
  et: "kuulutused"
};

const profileSegments: Record<RouteLocale, string> = {
  fi: "profiili",
  en: "profile",
  sv: "profil",
  no: "profil",
  et: "profiil"
};

const pageSegments = {
  auth: { fi: "kirjaudu", en: "auth", sv: "logga-in", no: "logg-inn", et: "logi-sisse" },
  sell: { fi: "myy", en: "sell", sv: "salj", no: "selg", et: "muu" },
  garage: { fi: "talli", en: "garage", sv: "garage", no: "garasje", et: "garaaz" },
  messages: { fi: "viestit", en: "messages", sv: "meddelanden", no: "meldinger", et: "sonumid" },
  saved: { fi: "tallennetut", en: "saved", sv: "sparade", no: "lagret", et: "salvestatud" },
  followed: { fi: "seuratut", en: "followed", sv: "foljer", no: "fulgte", et: "jalgitavad" },
  "search-alerts": { fi: "hakuvahti", en: "search-alerts", sv: "sokbevakning", no: "sokevarsel", et: "otsinguvalvur" },
  "my-listings": { fi: "omat-ilmoitukset", en: "my-listings", sv: "mina-annonser", no: "mine-annonser", et: "minu-kuulutused" },
  rewards: { fi: "palkinnot", en: "rewards", sv: "beloningar", no: "belonninger", et: "preemiad" },
  shop: { fi: "kauppa", en: "shop", sv: "butik", no: "butikk", et: "pood" },
  about: { fi: "meista", en: "about", sv: "om-oss", no: "om-oss", et: "meist" },
  contact: { fi: "yhteys", en: "contact", sv: "kontakt", no: "kontakt", et: "kontakt" },
  faq: { fi: "ukk", en: "faq", sv: "vanliga-fragor", no: "ofte-stilte-sporsmal", et: "kkk" },
  safety: { fi: "turvallisuus", en: "safety", sv: "sakerhet", no: "sikkerhet", et: "turvalisus" },
  terms: { fi: "ehdot", en: "terms", sv: "villkor", no: "vilkar", et: "tingimused" },
  privacy: { fi: "tietosuoja", en: "privacy", sv: "integritet", no: "personvern", et: "privaatsus" },
  cookies: { fi: "evasteet", en: "cookies", sv: "cookies", no: "informasjonskapsler", et: "kupsised" },
  alerts: { fi: "halytykset", en: "alerts", sv: "aviseringar", no: "varsler", et: "teated" }
} satisfies Record<string, Record<RouteLocale, string>>;

const localizedRouteGroups: Record<string, Record<RouteLocale, string>> = {
  listing: listingSegments,
  profile: profileSegments,
  ...pageSegments
};

const canonicalSegments: Record<string, string> = {
  listing: "listing",
  seller: "seller"
};

for (const [canonical, segments] of Object.entries(localizedRouteGroups)) {
  canonicalSegments[canonical] = canonical;
  for (const segment of Object.values(segments)) {
    canonicalSegments[segment] = canonical;
  }
}

function routeLocale(locale?: string | null): RouteLocale {
  return locale === "en" || locale === "sv" || locale === "no" || locale === "et" ? locale : "fi";
}

export function normalizeRouteLocale(locale?: string | null): RouteLocale {
  return routeLocale(locale);
}

export function slugifyProfileName(value?: string | null) {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || null;
}

export function listingPath(id?: string | number | null, locale?: string | null) {
  const segment = listingSegments[routeLocale(locale)];
  return `/${segment}/${encodeURIComponent(String(id ?? ""))}`;
}

export function listingUrlId(
  listing?: {
    id?: string | number | null;
    listing_id?: string | number | null;
    listing_number?: number | null;
  } | null
) {
  return listing?.listing_number || listing?.id || listing?.listing_id || "";
}

export function profilePath(id?: string | null, name?: string | null, locale?: string | null) {
  const slug = slugifyProfileName(name);
  const fallback = id ? String(id) : "";
  const segment = profileSegments[routeLocale(locale)];

  if (slug) {
    return `/${segment}/${encodeURIComponent(slug)}`;
  }

  return `/${segment}/${encodeURIComponent(fallback)}`;
}

export function legacySellerPath(id?: string | null) {
  return `/seller/${encodeURIComponent(String(id ?? ""))}`;
}

export function profileRootPath(locale?: string | null) {
  return `/${profileSegments[routeLocale(locale)]}`;
}

export function pagePath(page: keyof typeof pageSegments, locale?: string | null) {
  return `/${pageSegments[page][routeLocale(locale)]}`;
}

export function isUuidLike(value: string) {
  return UUID_RE.test(value);
}

export function translateLocalizedPath(pathname: string, locale?: string | null) {
  const normalizedLocale = routeLocale(locale);
  const parts = pathname.split("/");
  const first = parts[1] ?? "";
  const canonical = canonicalSegments[first];

  if (canonical && localizedRouteGroups[canonical]) {
    parts[1] = localizedRouteGroups[canonical][normalizedLocale];
    return parts.join("/") || "/";
  }

  return pathname;
}

export function canonicalPathFromLocalized(pathname: string) {
  const parts = pathname.split("/");
  const first = parts[1] ?? "";
  const canonical = canonicalSegments[first];

  if (!canonical) return pathname;

  parts[1] = canonical;
  return parts.join("/") || "/";
}

export function localizedPathFromCanonical(pathname: string, locale?: string | null) {
  return translateLocalizedPath(canonicalPathFromLocalized(pathname), locale);
}
