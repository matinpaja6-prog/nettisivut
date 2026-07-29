const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export type RouteLocale = "fi" | "en" | "sv";

const listingSegments: Record<RouteLocale, string> = {
  fi: "ilmoitukset",
  en: "listings",
  sv: "annonser"
};

const profileSegments: Record<RouteLocale, string> = {
  fi: "profiili",
  en: "profile",
  sv: "profil"
};

const pageSegments = {
  auth: { fi: "kirjaudu", en: "auth", sv: "logga-in" },
  sell: { fi: "myy", en: "sell", sv: "salj" },
  garage: { fi: "talli", en: "garage", sv: "garage" },
  messages: { fi: "viestit", en: "messages", sv: "meddelanden" },
  saved: { fi: "tallennetut", en: "saved", sv: "sparade" },
  followed: { fi: "seuratut", en: "followed", sv: "foljer" },
  "search-alerts": { fi: "hakuvahti", en: "search-alerts", sv: "sokbevakning" },
  settings: { fi: "asetukset", en: "settings", sv: "installningar" },
  "my-listings": { fi: "omat-ilmoitukset", en: "my-listings", sv: "mina-annonser" },
  about: { fi: "meista", en: "about", sv: "om-oss" },
  contact: { fi: "yhteys", en: "contact", sv: "kontakt" },
  faq: { fi: "ukk", en: "faq", sv: "vanliga-fragor" },
  safety: { fi: "turvallisuus", en: "safety", sv: "sakerhet" },
  terms: { fi: "ehdot", en: "terms", sv: "villkor" },
  privacy: { fi: "tietosuoja", en: "privacy", sv: "integritet" },
  cookies: { fi: "evasteet", en: "cookies", sv: "cookies" },
  alerts: { fi: "halytykset", en: "alerts", sv: "aviseringar" }
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
  return locale === "en" || locale === "sv" ? locale : "fi";
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
  void locale;
  const value = String(id ?? "");
  const urlId = /^\d+$/.test(value) ? `id${value}` : value;

  return `/ilmoitukset/${encodeURIComponent(urlId)}`;
}

export function listingSharePath(id?: string | number | null) {
  const value = String(id ?? "");
  const urlId = /^\d+$/.test(value) ? `id${value}` : value;

  return `/ilmoitus/${encodeURIComponent(urlId)}`;
}

export function listingNumberUrlId(value?: string | number | null) {
  const text = String(value ?? "").trim();
  const numeric = text.match(/^id(\d+)$/i)?.[1] ?? (/^\d+$/.test(text) ? text : "");

  return numeric ? `id${numeric}` : "";
}

export function listingUrlId(
  listing?: {
    id?: string | number | null;
    listing_id?: string | number | null;
    listing_number?: number | null;
  } | null
) {
  const numberUrlId = listingNumberUrlId(listing?.listing_number);
  if (numberUrlId) return numberUrlId;

  return listing?.id || listing?.listing_id || "";
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
