import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";

import HomeClient from "@/app/HomeClient";
import { listingPath, listingUrlId } from "@/lib/routes";
import {
  formatSeoSearchLabel,
  listingMatchesSeoCollection,
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
  const query = seoSearchQueryFromSlug(slug);
  const { data } = await getListings({
    includeOptionalFields: true,
    enrichSellerProfiles: false
  });
  const listings = data.filter((listing) => !listing.is_hidden && !listing.is_sold);
  const matches = listings.filter((listing) =>
    listingMatchesSeoCollection(listing, query, "vehicles")
  );

  return { query, listings, matches };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { query, matches } = await getVehicleCollectionData(slug);
  const label = formatSeoSearchLabel(query);
  const canonical = absoluteSiteUrl(seoVehicleSearchPath(query));
  const isCollection = matches.length > 0;
  const title = `${label} ajoneuvot myynnissä | Maskines`;
  const description = isCollection
    ? `Katso kaikki ${label} -ajoneuvoilmoitukset. Vertaa ${matches.length} myynnissä olevaa ajoneuvoa, kuvia, hintoja ja myyjien tietoja.`
    : `Katso ${label} -ajoneuvoilmoitus Maskines-palvelussa.`;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: isCollection ? canonical : absoluteSiteUrl("/ilmoitukset")
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
  const { query, listings, matches } = await getVehicleCollectionData(slug);

  if (matches.length === 0) {
    permanentRedirect("/ajoneuvot");
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
      <HomeClient
        initialListings={listings}
        initialSearchQuery={query}
        initialMarketplaceMode="vehicles"
      />
    </>
  );
}
