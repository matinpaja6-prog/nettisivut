import type { Listing } from "@/lib/listings";

const LISTINGS_CACHE_KEY = "arctic-listings-cache-v1";
const LISTINGS_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

type ListingsCache = {
  cachedAt: number;
  listings: Listing[];
};

let memoryCache: ListingsCache | null = null;

export function readCachedListings() {
  if (typeof window === "undefined") return [];

  if (
    memoryCache &&
    Date.now() - memoryCache.cachedAt <= LISTINGS_CACHE_MAX_AGE_MS
  ) {
    return memoryCache.listings;
  }

  try {
    const raw =
      localStorage.getItem(LISTINGS_CACHE_KEY) ??
      sessionStorage.getItem(LISTINGS_CACHE_KEY);
    if (!raw) return [];

    const cache = JSON.parse(raw) as Partial<ListingsCache>;
    if (
      !Array.isArray(cache.listings) ||
      typeof cache.cachedAt !== "number" ||
      Date.now() - cache.cachedAt > LISTINGS_CACHE_MAX_AGE_MS
    ) {
      localStorage.removeItem(LISTINGS_CACHE_KEY);
      sessionStorage.removeItem(LISTINGS_CACHE_KEY);
      return [];
    }

    memoryCache = cache as ListingsCache;
    return cache.listings;
  } catch {
    try {
      localStorage.removeItem(LISTINGS_CACHE_KEY);
      sessionStorage.removeItem(LISTINGS_CACHE_KEY);
    } catch {
      // Ignore storage cleanup failures in restricted browser contexts.
    }
    return [];
  }
}

export function writeCachedListings(listings: Listing[]) {
  if (typeof window === "undefined" || listings.length === 0) return;

  const cache = {
    cachedAt: Date.now(),
    listings
  } satisfies ListingsCache;
  memoryCache = cache;

  try {
    const serialized = JSON.stringify(cache);
    localStorage.setItem(LISTINGS_CACHE_KEY, serialized);
    sessionStorage.setItem(LISTINGS_CACHE_KEY, serialized);
  } catch {
    // A full or browser-restricted session storage should not block rendering.
  }
}

export function readCachedListing(listingId: string) {
  return readCachedListings().find((listing) => listing.id === listingId) ?? null;
}
