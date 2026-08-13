import type { MetadataRoute } from "next";

import { listingNumberUrlId, listingPath, listingUrlId, pagePath } from "@/lib/routes";
import {
  seoCollectionPath,
  seoPartSearchQueries,
  seoVehicleSearchQueries,
  type SeoCollectionKind
} from "@/lib/seo-search";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListingDisplayNumber, getListings } from "@/lib/supabase";

// The sitemap must reflect newly published listings as soon as Google fetches
// it. A cached static sitemap can otherwise lag behind the marketplace and
// leave new listing URLs undiscoverable until the next regeneration.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_STATIC_PATHS = [
  "/",
  "/ilmoitukset",
  "/ajoneuvot",
  "/varaosat",
  pagePath("about", "fi"),
  pagePath("contact", "fi"),
  pagePath("faq", "fi"),
  pagePath("safety", "fi"),
  pagePath("terms", "fi"),
  pagePath("privacy", "fi"),
  pagePath("cookies", "fi")
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_STATIC_PATHS.map((path) => ({
    url: absoluteSiteUrl(path),
    changeFrequency:
      path === "/" || path === "/ilmoitukset" || path === "/ajoneuvot" || path === "/varaosat"
        ? "hourly"
        : "monthly",
    priority:
      path === "/"
        ? 1
        : path === "/ilmoitukset" || path === "/ajoneuvot" || path === "/varaosat"
          ? 0.9
          : 0.5
  }));

  const { data: listings } = await getListings({
    includeOptionalFields: false,
    enrichSellerProfiles: false
  });

  const listingEntries: MetadataRoute.Sitemap = await Promise.all(
    listings
      .filter((listing) => !listing.is_hidden && !listing.is_sold)
      .map(async (listing) => {
        const createdAt = new Date(listing.created_at);
        const displayNumber = await getListingDisplayNumber(
          listing.created_at,
          listing.listing_number
        );
        const canonicalId =
          listingNumberUrlId(displayNumber) || listingUrlId(listing);

        return {
          url: absoluteSiteUrl(listingPath(canonicalId)),
          ...(Number.isNaN(createdAt.getTime()) ? {} : { lastModified: createdAt }),
          ...(listing.image_url
            ? { images: [absoluteSiteUrl(listing.image_url)] }
            : {}),
          changeFrequency: "daily" as const,
          priority: 0.8
        };
      })
  );

  const groupedSearchPages = new Map<
    string,
    { count: number; lastModified?: Date }
  >();

  function addCollectionQuery(
    kind: SeoCollectionKind,
    query: string,
    lastModified?: Date
  ) {
    const path = seoCollectionPath(kind, query);
    const group = groupedSearchPages.get(path);

    groupedSearchPages.set(path, {
      count: (group?.count ?? 0) + 1,
      lastModified:
        !group?.lastModified || (lastModified && lastModified > group.lastModified)
          ? lastModified
          : group.lastModified
    });
  }

  for (const listing of listings.filter((item) => !item.is_hidden && !item.is_sold)) {
    const createdAt = new Date(listing.created_at);
    const date = Number.isNaN(createdAt.getTime()) ? undefined : createdAt;

    for (const query of seoPartSearchQueries(listing)) {
      addCollectionQuery("parts", query, date);
    }

    for (const query of seoVehicleSearchQueries(listing)) {
      addCollectionQuery("vehicles", query, date);
    }
  }

  const searchEntries: MetadataRoute.Sitemap = [...groupedSearchPages.entries()]
    .filter(([, group]) => group.count > 0)
    .map(([path, group]) => ({
      url: absoluteSiteUrl(path),
      ...(group.lastModified ? { lastModified: group.lastModified } : {}),
      changeFrequency: "daily",
      priority: 0.85
    }));

  return [...staticEntries, ...searchEntries, ...listingEntries];
}
