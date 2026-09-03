import type { Metadata } from "next";

import HomeClient from "@/app/HomeClient";
import SeoCollectionDirectory from "@/app/components/SeoCollectionDirectory";
import { isVehicleListing } from "@/lib/listings";
import { listingPath, languagePaths, pagePath } from "@/lib/routes";
import { absoluteSiteUrl, PUBLIC_SITE_URL } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

export const revalidate = 300;

import { getServerLocale } from "@/lib/server-locale";

export async function generateMetadata(): Promise<Metadata> {
 const locale = await getServerLocale();
 const title = {fi:"Varaosat myynnissä",en:"Parts for sale",sv:"Reservdelar till salu",no:"Reservedeler til salgs"}[locale];
 const path = pagePath("varaosat", locale);
 return { title, description: title + " – Maskines", alternates: { canonical: path, languages: languagePaths(path) }, openGraph: { title, url: path } };
}

function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function PartsPage() {
  const locale = await getServerLocale();
  const { data: listings } = await getListings({
    includeOptionalFields: false,
    enrichSellerProfiles: false,
    filters: { kind: "parts" },
    limit: 48
  });
  const parts = listings.filter(
    (listing) => !listing.is_hidden && !listing.is_sold && !isVehicleListing(listing)
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Varaosat myynnissä",
    url: absoluteSiteUrl("/varaosat"),
    inLanguage: locale === "no" ? "nb" : locale,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: parts.length,
      itemListElement: parts.slice(0, 50).map((listing, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: listing.title,
        url: absoluteSiteUrl(listingPath(listing, locale))
      }))
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
      />
      <HomeClient
        initialListings={parts}
        initialMarketplaceMode="parts"
      />
      <SeoCollectionDirectory kind="parts" locale={locale} />
    </>
  );
}
