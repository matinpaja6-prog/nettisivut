import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import HomeClient from "@/app/HomeClient";
import { listingPath } from "@/lib/routes";
import {
  findGeneratedSeoCollectionDescriptor,
  formatSeoSearchLabel,
  listingMatchesSeoCollection,
  seoCollectionLanguagePaths
} from "@/lib/seo-search";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

export const revalidate = 3_600;

type PageProps = {
  params: Promise<{ segments: string[] }>;
};

function requestedCollectionPath(segments: string[]) {
  return `/varaosat/${segments.map((segment) => encodeURIComponent(decodeURIComponent(segment))).join("/")}`;
}

const getSearchPageData = cache(async (segments: string[]) => {
  const { data } = await getListings({
    includeOptionalFields: true,
    enrichSellerProfiles: false
  });
  const listings = data.filter((listing) => !listing.is_hidden && !listing.is_sold);
  const requestedPath = requestedCollectionPath(segments);
  const descriptor = findGeneratedSeoCollectionDescriptor(listings, requestedPath, "parts");
  const matches = descriptor
    ? listings.filter((listing) => listingMatchesSeoCollection(listing, descriptor.query, "parts"))
    : [];

  return { descriptor, listings, matches, requestedPath };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments } = await params;
  const { descriptor, matches } = await getSearchPageData(segments);
  if (!descriptor || matches.length === 0) return { robots: { index: false, follow: true } };

  const label = formatSeoSearchLabel(descriptor.query);
  const canonical = absoluteSiteUrl(descriptor.path);
  const title = `${label} varaosat myynnissä | Maskines`;
  const description = `Katso kaikki Maskinesin ${label} -ilmoitukset. ${matches.length} myynnissä olevaa varaosailmoitusta samassa haussa.`;
  const languages = Object.fromEntries(
    Object.entries(seoCollectionLanguagePaths("parts", descriptor.query, descriptor.path)).map(
      ([language, path]) => [language, absoluteSiteUrl(path)]
    )
  );

  return {
    title: { absolute: title },
    description,
    alternates: { canonical, languages },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "fi_FI",
      siteName: "Maskines",
      title,
      description,
      url: canonical
    }
  };
}

function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function SeoSearchPage({ params }: PageProps) {
  const { segments } = await params;
  const { descriptor, listings, matches, requestedPath } = await getSearchPageData(segments);
  if (!descriptor || matches.length === 0) notFound();
  if (requestedPath !== descriptor.path) permanentRedirect(descriptor.path);

  const label = formatSeoSearchLabel(descriptor.query);
  const canonical = absoluteSiteUrl(descriptor.path);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${label} varaosat myynnissä`,
        url: canonical,
        inLanguage: "fi-FI",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: matches.length,
          itemListElement: matches.slice(0, 50).map((listing, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: listing.title,
            url: absoluteSiteUrl(listingPath(listing))
          }))
        }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Etusivu", item: absoluteSiteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Varaosat", item: absoluteSiteUrl("/varaosat") },
          { "@type": "ListItem", position: 3, name: label, item: canonical }
        ]
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
      />
      <HomeClient
        initialListings={listings}
        initialSearchQuery={descriptor.query}
        initialMarketplaceMode="parts"
      />
    </>
  );
}
