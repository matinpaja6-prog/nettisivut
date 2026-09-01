import type { Metadata } from "next";

import HomeClient from "@/app/HomeClient";
import { isVehicleListing } from "@/lib/listings";
import { listingPath, listingUrlId } from "@/lib/routes";
import { absoluteSiteUrl, PUBLIC_SITE_URL } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

export const revalidate = 300;

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: { absolute: "Ajoneuvot myynnissä | Maskines" },
  description:
    "Selaa myynnissä olevia moottorikelkkoja, mönkijöitä, motocross-pyöriä ja mopoja. Vertaa ajoneuvojen hintoja, kuvia ja myyjiä.",
  alternates: {
    canonical: absoluteSiteUrl("/ajoneuvot")
  },
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    type: "website",
    locale: "fi_FI",
    siteName: "Maskines",
    title: "Ajoneuvot myynnissä | Maskines",
    description:
      "Moottorikelkat, mönkijät, motocross-pyörät ja mopot myynnissä pohjoismaisella markkinapaikalla.",
    url: absoluteSiteUrl("/ajoneuvot")
  }
};

function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function VehiclesPage() {
  const { data: listings } = await getListings({
    includeOptionalFields: false,
    enrichSellerProfiles: false,
    limit: 240
  });
  const vehicles = listings.filter(
    (listing) => !listing.is_hidden && !listing.is_sold && isVehicleListing(listing)
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Ajoneuvot myynnissä",
    url: absoluteSiteUrl("/ajoneuvot"),
    inLanguage: "fi-FI",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: vehicles.length,
      itemListElement: vehicles.slice(0, 50).map((listing, index) => ({
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
        initialListings={vehicles}
        initialMarketplaceMode="vehicles"
      />
    </>
  );
}
