import type { Metadata } from "next";

import HomeClient from "./HomeClient";
import { getListings } from "@/lib/supabase";
import { listingPath, languagePaths, translateLocalizedPath } from "@/lib/routes";
import { absoluteSiteUrl, PUBLIC_SITE_URL } from "@/lib/site-url";

export const revalidate = 300;

import { getServerLocale } from "@/lib/server-locale";

const homeCopy = {
 fi: ["Maskines – Osta ja myy varaosia ja ajoneuvoja", "Pohjoismainen markkinapaikka pienkoneiden varaosille ja ajoneuvoille."],
 en: ["Maskines – Buy and sell parts and vehicles", "The Nordic marketplace for small vehicles and spare parts."],
 sv: ["Maskines – Köp och sälj reservdelar och fordon", "Den nordiska marknadsplatsen för småfordon och reservdelar."],
 no: ["Maskines – Kjøp og selg reservedeler og kjøretøy", "Den nordiske markedsplassen for små kjøretøy og reservedeler."]
};

export async function generateMetadata(): Promise<Metadata> {
 const locale = await getServerLocale();
 const [title, description] = homeCopy[locale];
 const url = absoluteSiteUrl(translateLocalizedPath("/", locale));
 return { title: { absolute: title }, description, alternates: { canonical: url, languages: { ...languagePaths("/"), "x-default": "/" } }, openGraph: { title, description, url, locale: {fi:"fi_FI",en:"en_GB",sv:"sv_SE",no:"nb_NO"}[locale] }, twitter: { title, description } };
}


function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const locale = await getServerLocale();
  const resolvedSearchParams = await searchParams;
  const rawSearchQuery = resolvedSearchParams.q;
  const initialSearchQuery = (Array.isArray(rawSearchQuery) ? rawSearchQuery[0] : rawSearchQuery)?.trim() ?? "";
  // In development the browser client already restores cached listings and
  // refreshes them after the first paint. Waiting for the remote Supabase
  // request here made every localhost reload block for several seconds.
  // Production keeps server-rendered listings for SEO and fast public loads.
  const usesDatabaseFilters = process.env.NEXT_PUBLIC_MARKETPLACE_DB_FILTERS === "true";
  const initialResult = process.env.NODE_ENV === "development"
    ? { data: [], count: null }
    : (await getListings({
        databaseFilters: usesDatabaseFilters ? { all: [] } : undefined,
        filters: { query: initialSearchQuery },
        includeOptionalFields: true,
        enrichSellerProfiles: true,
        includeCount: true,
        limit: 24
      }));

  const publicListings = initialResult.data.filter(
    (listing) => !listing.is_hidden && !listing.is_sold
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${PUBLIC_SITE_URL}/#organization`,
        name: "Maskines",
        url: PUBLIC_SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: absoluteSiteUrl("/maskines-favicon-v6.png")
        }
      },
      {
        "@type": "WebSite",
        "@id": `${PUBLIC_SITE_URL}/#website`,
        url: PUBLIC_SITE_URL,
        name: "Maskines",
        inLanguage: locale === "no" ? "nb" : locale,
        publisher: {
          "@id": `${PUBLIC_SITE_URL}/#organization`
        }
      },
      {
        "@type": "ItemList",
        name: "Uusimmat pienkoneiden ajoneuvo- ja varaosailmoitukset",
        numberOfItems: publicListings.length,
        itemListElement: publicListings.slice(0, 24).map((listing, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: listing.title,
          url: absoluteSiteUrl(listingPath(listing, locale))
        }))
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
        initialListings={publicListings}
        initialSearchQuery={initialSearchQuery}
        initialCount={initialResult.count ?? null}
        initialUsesDatabaseFilters={usesDatabaseFilters}
      />
    </>
  );
}
