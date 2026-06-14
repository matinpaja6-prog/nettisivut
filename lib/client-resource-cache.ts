const RESOURCE_CACHE_PREFIX = "arctic-resource-cache-v1:";
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

type ResourceCache<T> = {
  cachedAt: number;
  value: T;
};

const memoryCache = new Map<string, ResourceCache<unknown>>();

export function readCachedResource<T>(
  key: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS
): T | null {
  if (typeof window === "undefined") return null;

  const memoryValue = memoryCache.get(key);
  if (memoryValue && Date.now() - memoryValue.cachedAt <= maxAgeMs) {
    return memoryValue.value as T;
  }

  try {
    const raw = sessionStorage.getItem(`${RESOURCE_CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const cache = JSON.parse(raw) as Partial<ResourceCache<T>>;
    if (
      typeof cache.cachedAt !== "number" ||
      Date.now() - cache.cachedAt > maxAgeMs ||
      !("value" in cache)
    ) {
      sessionStorage.removeItem(`${RESOURCE_CACHE_PREFIX}${key}`);
      return null;
    }

    memoryCache.set(key, cache as ResourceCache<unknown>);
    return cache.value as T;
  } catch {
    return null;
  }
}

export function writeCachedResource<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  const cache = {
    cachedAt: Date.now(),
    value
  } satisfies ResourceCache<T>;
  memoryCache.set(key, cache);

  try {
    sessionStorage.setItem(
      `${RESOURCE_CACHE_PREFIX}${key}`,
      JSON.stringify(cache)
    );
  } catch {
    // Cache failure must never block the live request or rendering.
  }
}

export function removeCachedResource(key: string) {
  if (typeof window === "undefined") return;

  memoryCache.delete(key);

  try {
    sessionStorage.removeItem(`${RESOURCE_CACHE_PREFIX}${key}`);
  } catch {
    // Browser storage can be unavailable in restricted contexts.
  }
}
