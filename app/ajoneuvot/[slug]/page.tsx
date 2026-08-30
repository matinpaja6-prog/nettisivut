import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import HomeClient from "@/app/HomeClient";
import SeoCollectionIntro from "@/app/SeoCollectionIntro";
import { listingPath, listingUrlId } from "@/lib/routes";
import {
  formatSeoSearchLabel,
  findGeneratedSeoCollectionQuery,
  listingMatchesSeoCollection,
  seoCollectionLanguagePaths,
  seoSearchQueryFromSlug,
  seoVehicleSearchPath
} from "@/lib/seo-search";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

export const revalidate = 3_600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

const getVehicleCollectionData = cache(async (slug: string) => {
  const requestedQuery = seoSearchQueryFromSlug(slug);
  const { data } = await getListings({
    includeOptionalFields: true,
    enrichSellerProfiles: false
  });
  const listings = data.filter((listing) => !listing.is_hidden && !listing.is_sold);
  const query = findGeneratedSeoCollectionQuery(listings, requestedQuery, "vehicles");
  const matches = query
    ? listings.filter((listing) => listingMatchesSeoCollection(listing, query, "vehicles"))
    : [];

  return { query: query ?? requestedQuery, isGenerated: Boolean(query), listings, matches };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { query, isGenerated, matches } = await getVehicleCollectionData(slug);
  const label = formatSeoSearchLabel(query);
  const canonical = absoluteSiteUrl(seoVehicleSearchPath(query));
  const isCollection = isGenerated && matches.length > 0;
  const title = `${label} ajoneuvot myynnissä | Maskines`;
  const description = isCollection
    ? `Katso kaikki ${label} -ajoneuvoilmoitukset. Vertaa ${matches.length} myynnissä olevaa ajoneuvoa, kuvia, hintoja ja myyjien tietoja.`
    : `Katso ${label} -ajoneuvoilmoitus Maskines-palvelussa.`;
  const languages = Object.fromEntries(
    Object.entries(seoCollectionLanguagePaths("vehicles", query)).map(([language, path]) => [
      language,
      absoluteSiteUrl(path)
    ])
  );

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: isCollection ? canonical : absoluteSiteUrl("/ilmoitukset"),
      ...(isCollection ? { languages } : {})
    },
    robots: isCollection
      ? { index: true, follow: true }
      : { index: false, follow: true },
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

export default async function VehicleCollectionPage({ params }: PageProps) {
  const { slug } = await params;
  const { query, isGenerated, listings, matches } = await getVehicleCollectionData(slug);

  if (!isGenerated || matches.length === 0) {
    notFound();
  }

  const label = formatSeoSearchLabel(query);
  const canonical = absoluteSiteUrl(seoVehicleSearchPath(query));
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${label} ajoneuvot myynnissä`,
        url: canonical,
        inLanguage: "fi-FI",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: matches.length,
          itemListElement: matches.slice(0, 50).map((listing, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: listing.title,
            url: absoluteSiteUrl(listingPath(listingUrlId(listing)))
          }))
        }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Etusivu",
            item: absoluteSiteUrl("/")
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Ajoneuvot",
            item: absoluteSiteUrl("/ajoneuvot")
          },
          {
            "@type": "ListItem",
            position: 3,
            name: label,
            item: canonical
          }
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
      <SeoCollectionIntro
        listings={listings}
        matches={matches}
        query={query}
        kind="vehicles"
      />
      <HomeClient
        initialListings={listings}
        initialSearchQuery={query}
        initialMarketplaceMode="vehicles"
      />
    </>
  );
}
