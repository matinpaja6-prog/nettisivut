import type { MetadataRoute } from "next";

import { listingPath, listingUrlId, pagePath } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

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

  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => {
    const createdAt = new Date(listing.created_at);

    return {
      url: absoluteSiteUrl(listingPath(listingUrlId(listing))),
      ...(Number.isNaN(createdAt.getTime()) ? {} : { lastModified: createdAt }),
      changeFrequency: "daily",
      priority: 0.8
    };
  });

  return [...staticEntries, ...listingEntries];
}
