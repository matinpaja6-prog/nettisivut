/**
 * Personal recommendations system.
 * Tracks user view history in localStorage and scores listings
 * based on overlap with viewed vehicle types, brands, models, and categories.
 */

import type { Listing } from "@/lib/listings";
import type { UserPreferenceProfile } from "@/lib/supabase";

const STORAGE_KEY_BASE = "recoHistory_v1";
const MAX_HISTORY = 60;
const MIN_VIEWS_FOR_RECOS = 3;

let currentUserId: string | null = null;

/**
 * Scope recommendation history to a specific user. Pass null/undefined for guests.
 * Call this whenever the signed-in user changes so a fresh account starts with
 * an empty history instead of inheriting the previous user's localStorage data.
 */
export function setRecoUserId(userId: string | null | undefined) {
  currentUserId = userId ?? null;
}

function storageKey(): string {
  return `${STORAGE_KEY_BASE}:${currentUserId ?? "anon"}`;
}

type ViewEvent = {
  id: string;
  ts: number;
  vehicle_type?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
};

export type RecoProfile = {
  vehicleTypes: Map<string, number>;
  brands: Map<string, number>;
  models: Map<string, number>;
  categories: Map<string, number>;
  searchTerms: Map<string, number>;
  viewedIds: Set<string>;
};

function safeGetHistory(): ViewEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeSetHistory(events: ViewEvent[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(events.slice(-MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

/**
 * Record that the user viewed a listing.
 */
export function trackListingView(listing: Listing | null | undefined) {
  if (!listing || !listing.id) return;
  const history = safeGetHistory();
  const event: ViewEvent = {
    id: listing.id,
    ts: Date.now(),
    vehicle_type: (listing as { vehicle_type?: string | null }).vehicle_type ?? null,
    brand: listing.brand ?? null,
    model: listing.model ?? null,
    category: listing.category ?? null
  };
  // De-dupe: keep newest entry per id
  const filtered = history.filter((h) => h.id !== event.id);
  filtered.push(event);
  safeSetHistory(filtered);
}

/**
 * Build a weighted preference profile from view history.
 * Newer views weigh more (exponential decay over ~30 days).
 */
export function getRecommendationProfile(): RecoProfile {
  const history = safeGetHistory();
  const now = Date.now();
  const halfLifeMs = 1000 * 60 * 60 * 24 * 14; // 14 days

  const profile: RecoProfile = {
    vehicleTypes: new Map(),
    brands: new Map(),
    models: new Map(),
    categories: new Map(),
    searchTerms: new Map(),
    viewedIds: new Set()
  };

  for (const ev of history) {
    const ageMs = now - ev.ts;
    const weight = Math.pow(0.5, ageMs / halfLifeMs);
    profile.viewedIds.add(ev.id);

    const add = (map: Map<string, number>, key?: string | null) => {
      if (!key) return;
      const k = key.toString().trim().toLowerCase();
      if (!k) return;
      map.set(k, (map.get(k) ?? 0) + weight);
    };

    add(profile.vehicleTypes, ev.vehicle_type);
    add(profile.brands, ev.brand);
    add(profile.models, ev.model);
    add(profile.categories, ev.category);
  }

  return profile;
}

/**
 * Score a listing against the user's profile (higher is better).
 * Exact model match weighs most, then brand, vehicle type, category.
 */
export function scoreListing(listing: Listing, profile: RecoProfile): number {
  const norm = (v?: string | null) => (v ?? "").toString().trim().toLowerCase();
  let score = 0;
  const vt = norm((listing as { vehicle_type?: string | null }).vehicle_type);
  const brand = norm(listing.brand);
  const model = norm(listing.model);
  const category = norm(listing.category);

  if (model && profile.models.has(model)) score += (profile.models.get(model) ?? 0) * 4;
  if (brand && profile.brands.has(brand)) score += (profile.brands.get(brand) ?? 0) * 2.5;
  if (vt && profile.vehicleTypes.has(vt)) score += (profile.vehicleTypes.get(vt) ?? 0) * 1.5;
  if (category && profile.categories.has(category)) score += (profile.categories.get(category) ?? 0) * 1;

  if (profile.searchTerms.size > 0) {
    const listingText = `${brand} ${model} ${norm(listing.title)} ${norm(listing.description ?? "")}`;
    for (const [term, weight] of profile.searchTerms) {
      if (term.length >= 2 && listingText.includes(term)) {
        score += weight * 0.8;
      }
    }
  }

  return score;
}

/**
 * Return listings ordered by personal relevance.
 * Excludes already-viewed listings.
 * Pass an optional pre-built profile (e.g. merged DB + localStorage).
 */
export function getRecommendedListings(
  listings: Listing[],
  limit: number = 12,
  profile?: RecoProfile
): Listing[] {
  const effectiveProfile = profile ?? getRecommendationProfile();
  if (
    effectiveProfile.brands.size === 0 &&
    effectiveProfile.models.size === 0 &&
    effectiveProfile.vehicleTypes.size === 0 &&
    effectiveProfile.categories.size === 0 &&
    effectiveProfile.searchTerms.size === 0
  ) {
    return [];
  }
  // Require a minimum amount of activity before showing recommendations,
  // so fresh accounts don't immediately get "for you" suggestions.
  if (effectiveProfile.viewedIds.size < MIN_VIEWS_FOR_RECOS) {
    return [];
  }
  const scored = listings
    .filter((l) => !effectiveProfile.viewedIds.has(l.id))
    .map((l) => ({ l, s: scoreListing(l, effectiveProfile) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.l);
  return scored;
}

/**
 * Merge DB preference profile with localStorage profile.
 * DB counts are normalized to the same 0-1 scale as localStorage weights.
 */
export function buildRecoProfile(
  dbProfile?: UserPreferenceProfile | null
): RecoProfile {
  const local = getRecommendationProfile();
  if (!dbProfile) return local;

  const allDbValues = [
    ...Object.values(dbProfile.vehicle_types),
    ...Object.values(dbProfile.brands),
    ...Object.values(dbProfile.models),
    ...Object.values(dbProfile.categories),
    ...Object.values(dbProfile.search_terms)
  ];
  const maxDb = Math.max(...allDbValues, 1);

  const mergeMap = (
    localMap: Map<string, number>,
    dbObj: Record<string, number>
  ): Map<string, number> => {
    const result = new Map(localMap);
    for (const [key, count] of Object.entries(dbObj)) {
      const normalized = count / maxDb;
      result.set(key, (result.get(key) ?? 0) + normalized * 0.5);
    }
    return result;
  };

  const searchTerms = new Map<string, number>();
  for (const [term, count] of Object.entries(dbProfile.search_terms)) {
    searchTerms.set(term, count / maxDb);
  }

  return {
    vehicleTypes: mergeMap(local.vehicleTypes, dbProfile.vehicle_types),
    brands: mergeMap(local.brands, dbProfile.brands),
    models: mergeMap(local.models, dbProfile.models),
    categories: mergeMap(local.categories, dbProfile.categories),
    searchTerms,
    viewedIds: local.viewedIds
  };
}

/**
 * Returns true if the user has viewed enough listings for recos to be meaningful.
 */
export function hasRecommendationData(): boolean {
  return safeGetHistory().length >= MIN_VIEWS_FOR_RECOS;
}

/**
 * Clear all history (for privacy / settings page).
 */
export function clearRecommendationHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
}
