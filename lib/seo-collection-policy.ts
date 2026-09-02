import type { Listing } from "./listings";
import {
  listingMatchesSeoCollection, seoCollectionLanguagePaths, seoCollectionPath,
  seoLocalizedCollectionDescriptorPath, seoPartCollectionDescriptors, seoVehicleSearchQueries,
  type SeoCollectionDescriptor, type SeoCollectionKind, type SeoSearchLocale
} from "./seo-search";

// An editorial publication rule for automatically generated search pages, NOT
// a Google requirement. Individual listings remain indexable at any inventory.
export const MIN_INDEXABLE_COLLECTION_LISTINGS = 3;

export function parseSeoCollectionRoute(pathname: string) {
  const roots: [string, SeoCollectionKind, SeoSearchLocale][] = [
    ["/varaosat/", "parts", "fi"], ["/ajoneuvot/", "vehicles", "fi"],
    ["/en/parts/", "parts", "en"], ["/en/vehicles/", "vehicles", "en"],
    ["/sv/reservdelar/", "parts", "sv"], ["/sv/fordon/", "vehicles", "sv"],
    ["/no/reservedeler/", "parts", "no"], ["/no/kjoretoy/", "vehicles", "no"]
  ];
  for (const [root, kind, locale] of roots) {
    if (!pathname.startsWith(root)) continue;
    const segments = pathname.slice(root.length).split("/").filter(Boolean);
    if (segments.length && (kind === "parts" || segments.length === 1)) return { segments, kind, locale };
  }
  return undefined;
}

export type SeoCollectionEntry = SeoCollectionDescriptor & {
  matches: Listing[];
  canonicalPath: string;
  indexable: boolean;
  reason: "indexable" | "small-inventory" | "duplicate-results" | "empty";
};

function preferredCollection(a: SeoCollectionDescriptor, b: SeoCollectionDescriptor) {
  // Prefer a short, broad buying intent to an incidental year/variant filter.
  // Ties are independent of listing order, so pagination cannot flip canonicals.
  return a.query.split(" ").length - b.query.split(" ").length ||
    a.path.split("/").length - b.path.split("/").length ||
    a.path.length - b.path.length || a.path.localeCompare(b.path, "en");
}

export function buildSeoCollectionCatalog(input: Listing[]): SeoCollectionEntry[] {
  const listings = [...new Map(input.filter(row => !row.is_hidden && !row.is_sold).map(row => [row.id, row])).values()];
  const descriptors = new Map<string, SeoCollectionDescriptor>();
  for (const listing of listings) {
    for (const descriptor of seoPartCollectionDescriptors(listing)) descriptors.set(descriptor.path, descriptor);
    for (const query of seoVehicleSearchQueries(listing)) {
      const path = seoCollectionPath("vehicles", query);
      descriptors.set(path, { kind: "vehicles", query, path });
    }
  }
  const owners = new Map<string, string>();
  return [...descriptors.values()].sort(preferredCollection).map(descriptor => {
    // Count actual unique matches, not how often a descriptor was generated.
    const matches = listings.filter(listing => listingMatchesSeoCollection(listing, descriptor.query, descriptor.kind));
    const signature = JSON.stringify([descriptor.kind, matches.map(row => row.id).sort()]);
    const canonicalPath = owners.get(signature) || descriptor.path;
    if (matches.length) owners.set(signature, canonicalPath);
    const reason = matches.length === 0 ? "empty" : matches.length < MIN_INDEXABLE_COLLECTION_LISTINGS
      ? "small-inventory" : canonicalPath !== descriptor.path ? "duplicate-results" : "indexable";
    return { ...descriptor, matches, canonicalPath, indexable: reason === "indexable", reason };
  });
}

/** One deterministic owner for translated slug collisions, including aliases. */
export function findSeoCollection(catalog: SeoCollectionEntry[], path: string, locale: SeoSearchLocale = "fi") {
  let normalized: string;
  try { normalized = decodeURIComponent(path).replace(/\/+$/, ""); } catch { return undefined; }
  return [...catalog].sort((a, b) => Number(b.indexable) - Number(a.indexable) || preferredCollection(a, b))
    .find(entry => seoLocalizedCollectionDescriptorPath(entry.kind, entry.path, locale) === normalized ||
      seoLocalizedCollectionDescriptorPath(entry.kind, seoCollectionPath(entry.kind, entry.query), locale) === normalized);
}

export function indexCollectionLanguages(entry: SeoCollectionEntry, catalog: SeoCollectionEntry[]) {
  const locales = { "fi-FI": "fi", en: "en", sv: "sv", nb: "no", "x-default": "fi" } as const;
  return Object.fromEntries(Object.entries(seoCollectionLanguagePaths(entry.kind, entry.query, entry.path))
    .filter(([language, path]) => findSeoCollection(catalog, path, locales[language as keyof typeof locales])?.path === entry.path));
}

export function collectionIndexing(entry: SeoCollectionEntry, catalog: SeoCollectionEntry[], locale: SeoSearchLocale) {
  const owner = catalog.find(candidate => candidate.path === entry.canonicalPath) || entry;
  // Small collections stay usable but aren't advertised as standalone landing
  // pages. Don't point a noindex page's canonical at an unrelated listing.
  const canonical = entry.reason === "small-inventory" ? entry : owner;
  const canonicalPath = seoLocalizedCollectionDescriptorPath(canonical.kind, canonical.path, locale);
  const index = entry.indexable || (entry.reason === "duplicate-results" && owner.indexable);
  return {
    canonicalPath,
    index,
    languages: entry.indexable ? indexCollectionLanguages(entry, catalog) : undefined
  };
}
