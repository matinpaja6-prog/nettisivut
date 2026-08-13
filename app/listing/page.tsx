import type { Metadata } from "next";

import ListingsIndexClient from "./ListingsIndexClient";
import SeoCollectionLinks from "@/app/components/SeoCollectionLinks";
import { getListings } from "@/lib/supabase";
import { absoluteSiteUrl, PUBLIC_SITE_URL } from "@/lib/site-url";

export const revalidate = 300;

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: "Pienkoneiden ajoneuvot ja varaosat",
  description:
    "Selaa moottorikelkkojen, mönkijöiden, motocross-pyörien ja mopojen ajoneuvo- ja varaosailmoituksia. Vertaa hintoja, kuvia ja myyjiä.",
  alternates: {
    canonical: absoluteSiteUrl("/ilmoitukset")
  },
  robots: {
    index: true,
    follow: true
  }
};

export default async function ListingsIndexPage() {
  const { data: listings } = await getListings({
    includeOptionalFields: false,
    enrichSellerProfiles: false,
    limit: 240
  });

  const publicListings = listings.filter(
    (listing) => !listing.is_hidden && !listing.is_sold
  );

  return (
    <>
      <ListingsIndexClient initialListings={publicListings} />
      <SeoCollectionLinks listings={publicListings} />
    </>
  );
}
