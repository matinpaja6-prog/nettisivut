const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RouteLocale = "fi" | "en" | "sv" | "no";

const listingSegments: Record<RouteLocale, string> = {
  fi: "ilmoitukset",
  en: "listings",
  sv: "annonser",
  no: "annonser"
};

const profileSegments: Record<RouteLocale, string> = {
  fi: "profiili",
  en: "profile",
  sv: "profil",
  no: "profil"
};

const pageSegments = {
  auth: { fi: "kirjaudu", en: "auth", sv: "logga-in", no: "logg-inn" },
  sell: { fi: "myy", en: "sell", sv: "salj", no: "selg" },
  garage: { fi: "talli", en: "garage", sv: "garage", no: "garasje" },
  messages: { fi: "viestit", en: "messages", sv: "meddelanden", no: "meldinger" },
  saved: { fi: "tallennetut", en: "saved", sv: "sparade", no: "lagret" },
  followed: { fi: "seuratut", en: "followed", sv: "foljer", no: "fulgte" },
  "search-alerts": { fi: "hakuvahti", en: "search-alerts", sv: "sokbevakning", no: "sokevarsel" },
  settings: { fi: "asetukset", en: "settings", sv: "installningar", no: "innstillinger" },
  "my-listings": { fi: "omat-ilmoitukset", en: "my-listings", sv: "mina-annonser", no: "mine-annonser" },
  about: { fi: "meista", en: "about", sv: "om-oss", no: "om-oss" },
  contact: { fi: "yhteys", en: "contact", sv: "kontakt", no: "kontakt" },
  faq: { fi: "ukk", en: "faq", sv: "vanliga-fragor", no: "ofte-stilte-sporsmal" },
  safety: { fi: "turvallisuus", en: "safety", sv: "sakerhet", no: "sikkerhet" },
  terms: { fi: "ehdot", en: "terms", sv: "villkor", no: "vilkar" },
  privacy: { fi: "tietosuoja", en: "privacy", sv: "integritet", no: "personvern" },
  cookies: { fi: "evasteet", en: "cookies", sv: "cookies", no: "informasjonskapsler" },
  alerts: { fi: "halytykset", en: "alerts", sv: "aviseringar", no: "varsler" },
  yritykset: { fi: "yritykset", en: "companies", sv: "foretag", no: "bedrifter" },
  varaosat: { fi: "varaosat", en: "parts", sv: "reservdelar", no: "reservedeler" },
  ajoneuvot: { fi: "ajoneuvot", en: "vehicles", sv: "fordon", no: "kjoretoy" }
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
  return locale === "en" || locale === "sv" || locale === "no" ? locale : "fi";
}

export function normalizeRouteLocale(locale?: string | null): RouteLocale {
  return routeLocale(locale);
}

export const routeLocales: RouteLocale[] = ["fi", "en", "sv", "no"];

export function localeFromPath(pathname: string): RouteLocale {
  const segment = pathname.split(/[/?#]/)[1];
  return segment === "eng" ? "en" : routeLocale(segment);
}

export function hasLocalePrefix(pathname: string) {
  return /^\/(?:fi|en|eng|sv|no)(?:\/|$|[?#])/.test(pathname);
}

export function stripLocalePrefix(pathname: string) {
  return pathname.replace(/^\/(?:fi|en|eng|sv|no)(?=\/|$|[?#])/, "") || "/";
}

export function isUnlocalizedPath(pathname: string) {
  return !pathname.startsWith("/") || pathname.startsWith("//") ||
    /^\/(?:api|_next|admin|\.well-known)(?:\/|$)/.test(pathname) ||
    /\.[a-z0-9]{2,8}(?:[?#]|$)/i.test(pathname);
}

function prefixPath(pathname: string, locale: RouteLocale) {
  return locale === "fi" ? pathname : `/${locale}${pathname === "/" ? "" : pathname}`;
}

/** Localize navigation, but preserve explicitly language-qualified links. */
export function localizeHref(href: string, locale: RouteLocale) {
  if (isUnlocalizedPath(href) || hasLocalePrefix(href)) return href;
  const match = href.match(/^([^?#]*)(.*)$/);
  return match ? `${translateLocalizedPath(match[1], locale)}${match[2]}` : href;
}

export function languagePaths(pathname: string) {
  return Object.fromEntries(routeLocales.map(locale => [
    locale === "no" ? "nb" : locale,
    translateLocalizedPath(pathname, locale)
  ]));
}

export function publicCompanyDisplayName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+oyj?\.?$/i, "")
    .trim();
}

export function legacySlugifyProfileName(value?: string | null) {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "");

  return slug || null;
}

export function slugifyProfileName(value?: string | null) {
  return legacySlugifyProfileName(publicCompanyDisplayName(value));
}

export type ListingRouteValue =
  | string
  | number
  | null
  | undefined
  | {
      id?: string | number | null;
      listing_id?: string | number | null;
      listing_number?: number | null;
      brand?: string | null;
      model?: string | null;
      category?: string | null;
      subcategory?: string | null;
    };

export function slugifyListingSegment(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fi")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function listingPartSegment(
  listing?: Exclude<ListingRouteValue, string | number | null | undefined> | null
) {
  if (!listing) return "";

  const category = String(listing.category ?? "").trim();
  const normalizedCategory = category.toLocaleLowerCase("fi-FI");
  const isVehicle = ["ajoneuvo", "ajoneuvot", "kokonainen ajoneuvo"].includes(
    normalizedCategory
  );
  if (isVehicle) return "";

  const partName = String(listing.subcategory || category)
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);

  return slugifyListingSegment(partName);
}

export function listingPath(valueOrListing?: ListingRouteValue, locale?: string | null) {
  const listing = typeof valueOrListing === "object" && valueOrListing !== null
    ? valueOrListing
    : null;
  const value = String(
    listing
      ? listingNumberUrlId(listing.listing_number) || listing.id || listing.listing_id || ""
      : valueOrListing ?? ""
  ).trim();
  const urlId = value.match(/^id(\d+)$/i)?.[1] ?? value;
  const brand = slugifyListingSegment(listing?.brand);
  const model = slugifyListingSegment(listing?.model);
  const part = listingPartSegment(listing);

  if (brand && model && urlId) {
    if (part) {
      return prefixPath(`/${encodeURIComponent(brand)}/${encodeURIComponent(model)}/${encodeURIComponent(part)}/${encodeURIComponent(urlId)}`, routeLocale(locale));
    }
    return prefixPath(`/${encodeURIComponent(brand)}/${encodeURIComponent(model)}/${encodeURIComponent(urlId)}`, routeLocale(locale));
  }

  return prefixPath(`/${listingSegments[routeLocale(locale)]}/${encodeURIComponent(urlId)}`, routeLocale(locale));
}

export function listingIndexPath(locale?: string | null) {
  return prefixPath(`/${listingSegments[routeLocale(locale)]}`, routeLocale(locale));
}

export function listingSharePath(id?: string | number | null, locale?: string | null) {
  const value = String(id ?? "");
  const urlId = /^\d+$/.test(value) ? `id${value}` : value;
  const segment = locale === "en" ? "ad" : locale === "sv" ? "annons" : locale === "no" ? "annonse" : "ilmoitus";

  return prefixPath(`/${segment}/${encodeURIComponent(urlId)}`, routeLocale(locale));
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
  const profileId = id ? String(id).trim() : "";
  const profileSlug = slugifyProfileName(name);
  const segment = profileSegments[routeLocale(locale)];

  return prefixPath(`/${segment}/${encodeURIComponent(profileSlug || profileId)}`, routeLocale(locale));
}

export function legacySellerPath(id?: string | null) {
  return `/seller/${encodeURIComponent(String(id ?? ""))}`;
}

export function profileRootPath(locale?: string | null) {
  return prefixPath(`/${profileSegments[routeLocale(locale)]}`, routeLocale(locale));
}

export function pagePath(page: keyof typeof pageSegments, locale?: string | null) {
  return prefixPath(`/${pageSegments[page][routeLocale(locale)]}`, routeLocale(locale));
}

export function isUuidLike(value: string) {
  return UUID_RE.test(value);
}

export function translateLocalizedPath(pathname: string, locale?: string | null) {
  const normalizedLocale = routeLocale(locale);
  if (isUnlocalizedPath(pathname)) return pathname;
  const parts = stripLocalePrefix(pathname).split("/");
  const first = parts[1] ?? "";
  const canonical = canonicalSegments[first];

  if (canonical && localizedRouteGroups[canonical]) {
    parts[1] = localizedRouteGroups[canonical][normalizedLocale];
    return prefixPath(parts.join("/") || "/", normalizedLocale);
  }

  return prefixPath(parts.join("/") || "/", normalizedLocale);
}

export function canonicalPathFromLocalized(pathname: string) {
  const parts = stripLocalePrefix(pathname).split("/");
  const first = parts[1] ?? "";
  const canonical = canonicalSegments[first];

  if (!canonical) return parts.join("/") || "/";

  parts[1] = canonical;
  return parts.join("/") || "/";
}

export function localizedPathFromCanonical(pathname: string, locale?: string | null) {
  return translateLocalizedPath(canonicalPathFromLocalized(pathname), locale);
}
