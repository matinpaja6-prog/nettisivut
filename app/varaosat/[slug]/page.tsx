import type { Metadata } from "next";

import HomeClient from "@/app/HomeClient";
import { listingPath, listingUrlId } from "@/lib/routes";
import {
  formatSeoSearchLabel,
  listingMatchesSeoQuery,
  seoSearchPath,
  seoSearchQueryFromSlug
} from "@/lib/seo-search";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

export const revalidate = 3_600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getSearchPageData(slug: string) {
  const query = seoSearchQueryFromSlug(slug);
  const { data } = await getListings({
    includeOptionalFields: true,
    enrichSellerProfiles: false
  });
  const listings = data.filter((listing) => !listing.is_hidden && !listing.is_sold);
  const matches = listings.filter((listing) => listingMatchesSeoQuery(listing, query));

  return { query, listings, matches };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { query, matches } = await getSearchPageData(slug);
  const label = formatSeoSearchLabel(query);
  const canonical = absoluteSiteUrl(seoSearchPath(query));
  const title = `${label} – kaikki ilmoitukset | Maskines`;
  const description = matches.length > 0
    ? `Katso kaikki Maskinesin ${label} -ilmoitukset. ${matches.length} myynnissä olevaa varaosailmoitusta samassa haussa.`
    : `Hae Maskinesista ${label} -varaosia ja ilmoituksia.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: matches.length > 0
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

export default async function SeoSearchPage({ params }: PageProps) {
  const { slug } = await params;
  const { query, listings, matches } = await getSearchPageData(slug);
  const label = formatSeoSearchLabel(query);
  const canonical = absoluteSiteUrl(seoSearchPath(query));
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${label} – kaikki ilmoitukset`,
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
            name: "Varaosat",
            item: absoluteSiteUrl("/ilmoitukset")
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
      <HomeClient initialListings={listings} initialSearchQuery={query} />
    </>
  );
}
