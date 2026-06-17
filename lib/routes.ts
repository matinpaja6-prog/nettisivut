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

const allListingSegments = new Set(["listing", ...Object.values(listingSegments)]);
const allProfileSegments = new Set(["seller", ...Object.values(profileSegments)]);

function routeLocale(locale?: string | null): RouteLocale {
  return locale === "en" || locale === "sv" || locale === "no" || locale === "et" ? locale : "fi";
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

export function listingUrlId(listing?: { id?: string | number | null; listing_number?: number | null } | null) {
  return listing?.listing_number || listing?.id || "";
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

export function isUuidLike(value: string) {
  return UUID_RE.test(value);
}

export function translateLocalizedPath(pathname: string, locale?: string | null) {
  const normalizedLocale = routeLocale(locale);
  const parts = pathname.split("/");
  const first = parts[1] ?? "";

  if (allListingSegments.has(first)) {
    parts[1] = listingSegments[normalizedLocale];
    return parts.join("/") || "/";
  }

  if (allProfileSegments.has(first)) {
    parts[1] = profileSegments[normalizedLocale];
    return parts.join("/") || "/";
  }

  return pathname;
}
