import type { MetadataRoute } from "next";

import { listingNumberUrlId, listingPath, listingUrlId, pagePath } from "@/lib/routes";
import { seoListingSearchQuery, seoSearchPath } from "@/lib/seo-search";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListingDisplayNumber, getListings } from "@/lib/supabase";

export const revalidate = 3_600;

const PUBLIC_STATIC_PATHS = [
  "/",
  "/ilmoitukset",
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
    changeFrequency: path === "/" || path === "/ilmoitukset" ? "hourly" : "monthly",
    priority: path === "/" ? 1 : path === "/ilmoitukset" ? 0.9 : 0.5
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
          changeFrequency: "daily" as const,
          priority: 0.8
        };
      })
  );

  const searchPages = new Map<string, Date | undefined>();
  for (const listing of listings.filter((item) => !item.is_hidden && !item.is_sold)) {
    const query = seoListingSearchQuery(listing);
    if (!query) continue;
    const path = seoSearchPath(query);
    const createdAt = new Date(listing.created_at);
    const date = Number.isNaN(createdAt.getTime()) ? undefined : createdAt;
    const previous = searchPages.get(path);
    if (!previous || (date && date > previous)) searchPages.set(path, date);
  }

  const searchEntries: MetadataRoute.Sitemap = [...searchPages.entries()].map(
    ([path, lastModified]) => ({
      url: absoluteSiteUrl(path),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "daily",
      priority: 0.75
    })
  );

  return [...staticEntries, ...searchEntries, ...listingEntries];
}
