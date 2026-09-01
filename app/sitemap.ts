import type { MetadataRoute } from "next";

import {
  listingNumberUrlId,
  listingPath,
  listingSharePath,
  listingUrlId,
  pagePath,
  profilePath
} from "@/lib/routes";
import {
  seoCollectionLanguagePaths,
  seoCollectionPath,
  seoPartCollectionDescriptors,
  seoVehicleSearchQueries,
  type SeoCollectionKind
} from "@/lib/seo-search";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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
  "/yritykset",
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

  // A verified company profile is a public storefront. Adding only approved
  // companies here keeps unfinished, rejected and private company accounts
  // out of search results while making each real business discoverable.
  const { data: companyRows } = await getSupabaseAdmin()
    .from("companies")
    .select("owner_user_id,name,verified_at,updated_at,social_share_image_url,banner_image_url")
    .eq("verification_status", "approved");

  const companyEntries: MetadataRoute.Sitemap = (companyRows ?? [])
    .filter((company) => Boolean(company.owner_user_id))
    .map((company) => {
      const updatedAt = new Date(company.updated_at || company.verified_at || "");
      const socialImage = company.social_share_image_url || company.banner_image_url;

      const languagePaths = {
        "fi-FI": profilePath(company.owner_user_id, company.name, "fi"),
        en: profilePath(company.owner_user_id, company.name, "en"),
        sv: profilePath(company.owner_user_id, company.name, "sv"),
        nb: profilePath(company.owner_user_id, company.name, "no")
      };

      return {
        url: absoluteSiteUrl(languagePaths["fi-FI"]),
        ...(Number.isNaN(updatedAt.getTime()) ? {} : { lastModified: updatedAt }),
        ...(socialImage ? { images: [absoluteSiteUrl(socialImage)] } : {}),
        alternates: {
          languages: Object.fromEntries(
            Object.entries(languagePaths).map(([language, path]) => [language, absoluteSiteUrl(path)])
          )
        },
        changeFrequency: "weekly" as const,
        priority: 0.7
      };
    });

  // Sellers with live inventory are useful search results even when they are
  // private sellers. Their human-readable profile pages are therefore added
  // automatically whenever they have at least one active listing.
  const approvedCompanyOwners = new Set(
    (companyRows ?? []).map((company) => company.owner_user_id).filter(Boolean)
  );
  const activeSellerEntries = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const listing of listings.filter((item) => !item.is_hidden && !item.is_sold)) {
    const sellerId = listing.seller_id?.trim();
    const sellerName = (listing.company_name || listing.seller_name)?.trim();
    if (!sellerId || !sellerName || approvedCompanyOwners.has(sellerId)) continue;
    const createdAt = new Date(listing.created_at);
    const path = profilePath(sellerId, sellerName, "fi");
    activeSellerEntries.set(sellerId, {
      url: absoluteSiteUrl(path),
      ...(Number.isNaN(createdAt.getTime()) ? {} : { lastModified: createdAt }),
      ...(listing.seller_avatar_url ? { images: [absoluteSiteUrl(listing.seller_avatar_url)] } : {}),
      changeFrequency: "weekly",
      priority: 0.65
    });
  }
  const sellerEntries: MetadataRoute.Sitemap = [...activeSellerEntries.values()];

  const listingEntryGroups = await Promise.all(
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

        const languagePaths = {
          "fi-FI": listingPath({ ...listing, listing_number: displayNumber, id: canonicalId }),
          en: listingSharePath(canonicalId, "en"),
          sv: listingSharePath(canonicalId, "sv"),
          nb: listingSharePath(canonicalId, "no")
        };
        const languages = Object.fromEntries(
          Object.entries(languagePaths).map(([language, path]) => [language, absoluteSiteUrl(path)])
        );
        const shared = {
          ...(Number.isNaN(createdAt.getTime()) ? {} : { lastModified: createdAt }),
          ...(listing.image_url ? { images: [absoluteSiteUrl(listing.image_url)] } : {}),
          alternates: { languages },
          changeFrequency: "daily" as const,
          priority: 0.8
        };

        return Object.values(languagePaths).map((path) => ({
          url: absoluteSiteUrl(path),
          ...shared
        }));
      })
  );
  const listingEntries: MetadataRoute.Sitemap = listingEntryGroups.flat();

  const groupedSearchPages = new Map<
    string,
    { kind: SeoCollectionKind; query: string; path: string; count: number; lastModified?: Date }
  >();

  function addCollectionQuery(
    kind: SeoCollectionKind,
    query: string,
    path: string,
    lastModified?: Date
  ) {
    const group = groupedSearchPages.get(path);

    groupedSearchPages.set(path, {
      kind,
      query,
      path,
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

    for (const descriptor of seoPartCollectionDescriptors(listing)) {
      addCollectionQuery("parts", descriptor.query, descriptor.path, date);
    }

    for (const query of seoVehicleSearchQueries(listing)) {
      addCollectionQuery("vehicles", query, seoCollectionPath("vehicles", query), date);
    }
  }

  const searchEntries: MetadataRoute.Sitemap = [...groupedSearchPages.entries()]
    .filter(([, group]) => group.count > 0)
    .map(([, group]) => {
      const languagePaths = seoCollectionLanguagePaths(group.kind, group.query, group.path);
      const languages = Object.fromEntries(
        Object.entries(languagePaths)
          .filter(([language]) => language !== "x-default")
          .map(([language, path]) => [language, absoluteSiteUrl(path)])
      );

      // Publish one canonical Finnish collection URL per real search intent.
      // The other language variants remain discoverable through hreflang, but
      // do not multiply the sitemap into thousands of near-identical entries.
      return {
        url: absoluteSiteUrl(group.path),
        ...(group.lastModified ? { lastModified: group.lastModified } : {}),
        alternates: { languages },
        changeFrequency: "daily" as const,
        priority: 0.85
      };
    });

  // Different Finnish terms can translate to the same Swedish or Norwegian
  // slug. A sitemap must list each URL only once, even when its hreflang data
  // was produced from more than one source query.
  const allEntries = [
    ...staticEntries,
    ...companyEntries,
    ...sellerEntries,
    ...searchEntries,
    ...listingEntries
  ];
  return [...new Map(allEntries.map((entry) => [entry.url, entry])).values()];
}
