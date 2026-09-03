import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { buildSeoCollectionCatalog, findSeoCollection, parseSeoCollectionRoute } from "./seo-collection-policy";
import { seoLocalizedCollectionRoot, seoLocalizedCollectionDescriptorPath, type SeoCollectionKind, type SeoSearchLocale } from "./seo-search";
import { getListings } from "./supabase";

export const getSeoCollectionCatalog = cache(async () => {
  const { data, error } = await getListings({ includeOptionalFields: true, enrichSellerProfiles: false });
  if (error) throw new Error("Collection inventory is temporarily unavailable");
  return buildSeoCollectionCatalog(data);
});

export async function collectionData(segments: string[], kind: SeoCollectionKind, locale: SeoSearchLocale) {
  let path: string;
  try {
    path = `${seoLocalizedCollectionRoot(kind, locale)}/${segments.map(segment => decodeURIComponent(segment)).join("/")}`;
  } catch { notFound(); }
  const catalog = await getSeoCollectionCatalog();
  const entry = findSeoCollection(catalog, path, locale);
  if (!entry || entry.kind !== kind || !entry.matches.length) notFound();
  return { catalog, entry, path };
}

// The root loading.tsx wraps child layouts too. Validate only collection routes
// before that streaming boundary; otherwise notFound() can become a soft 404.
// React.cache shares this inventory read with the page and its metadata.
export async function validateSeoCollectionRoute(pathname: string) {
  const route = parseSeoCollectionRoute(pathname);
  if (!route) return;
  const { entry, path } = await collectionData(route.segments, route.kind, route.locale);
  const ownPath = seoLocalizedCollectionDescriptorPath(route.kind, entry.path, route.locale);
  if (path !== ownPath) permanentRedirect(ownPath);
}
