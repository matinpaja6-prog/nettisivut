import type { Metadata } from "next";

import HomeClient from "@/app/HomeClient";
import { isVehicleListing } from "@/lib/listings";
import { listingPath, listingUrlId } from "@/lib/routes";
import { absoluteSiteUrl, PUBLIC_SITE_URL } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

export const revalidate = 300;

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: { absolute: "Varaosat myynnissä | Maskines" },
  description:
    "Selaa moottorikelkkojen, mönkijöiden, motocross-pyörien ja mopojen varaosia. Hae varaosia merkin, mallin, vuosimallin ja osatyypin mukaan.",
  alternates: {
    canonical: absoluteSiteUrl("/varaosat")
  },
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    type: "website",
    locale: "fi_FI",
    siteName: "Maskines",
    title: "Varaosat myynnissä | Maskines",
    description:
      "Pienkoneiden varaosat moottorikelkkoihin, mönkijöihin, motocross-pyöriin ja mopoihin.",
    url: absoluteSiteUrl("/varaosat")
  }
};

function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function PartsPage() {
  const { data: listings } = await getListings({
    includeOptionalFields: false,
    enrichSellerProfiles: false,
    limit: 240
  });
  const parts = listings.filter(
    (listing) => !listing.is_hidden && !listing.is_sold && !isVehicleListing(listing)
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Varaosat myynnissä",
    url: absoluteSiteUrl("/varaosat"),
    inLanguage: "fi-FI",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: parts.length,
      itemListElement: parts.slice(0, 50).map((listing, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: listing.title,
        url: absoluteSiteUrl(listingPath(listing))
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
    </>
  );
}
