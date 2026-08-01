import type { Metadata } from "next";

import HomeClient from "./HomeClient";
import { getListings } from "@/lib/supabase";
import { listingPath, listingUrlId } from "@/lib/routes";
import { absoluteSiteUrl, PUBLIC_SITE_URL } from "@/lib/site-url";

export const revalidate = 300;

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: {
    absolute: "Maskines: Osta ja myy ajoneuvojen varaosat"
  },
  description:
    "Osta ja myy käytettyjä moottorikelkan, mönkijän, motocross-pyörän ja mopon varaosia. Hae osia merkin, mallin, vuosimallin ja kategorian mukaan.",
  alternates: {
    canonical: absoluteSiteUrl("/")
  },
  openGraph: {
    type: "website",
    locale: "fi_FI",
    siteName: "Maskines",
    title: "Maskines: Osta ja myy ajoneuvojen varaosat",
    description:
      "Ajoneuvojen käytettyjen varaosien markkinapaikka. Löydä moottorikelkan, mönkijän, motocross-pyörän ja mopon osat.",
    url: absoluteSiteUrl("/"),
    images: [
      {
        url: absoluteSiteUrl("/maskines-share-logo.png"),
        width: 1200,
        height: 1200,
        alt: "Maskines – käytettyjen ajoneuvojen varaosat"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Maskines: Osta ja myy ajoneuvojen varaosat",
    description:
      "Osta ja myy käytettyjä moottorikelkan, mönkijän, motocross-pyörän ja mopon varaosia.",
    images: [absoluteSiteUrl("/maskines-share-logo.png")]
  }
};

function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function HomePage() {
  // In development the browser client already restores cached listings and
  // refreshes them after the first paint. Waiting for the remote Supabase
  // request here made every localhost reload block for several seconds.
  // Production keeps server-rendered listings for SEO and fast public loads.
  const listings = process.env.NODE_ENV === "development"
    ? []
    : (await getListings({
        includeOptionalFields: false,
        enrichSellerProfiles: false,
        limit: 48
      })).data;

  const publicListings = listings.filter(
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
          url: absoluteSiteUrl("/maskines-icon.png")
        }
      },
      {
        "@type": "WebSite",
        "@id": `${PUBLIC_SITE_URL}/#website`,
        url: PUBLIC_SITE_URL,
        name: "Maskines",
        inLanguage: "fi-FI",
        publisher: {
          "@id": `${PUBLIC_SITE_URL}/#organization`
        }
      },
      {
        "@type": "ItemList",
        name: "Uusimmat ajoneuvojen varaosailmoitukset",
        numberOfItems: publicListings.length,
        itemListElement: publicListings.slice(0, 24).map((listing, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: listing.title,
          url: absoluteSiteUrl(listingPath(listingUrlId(listing)))
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
      <HomeClient initialListings={publicListings} />
    </>
  );
}
