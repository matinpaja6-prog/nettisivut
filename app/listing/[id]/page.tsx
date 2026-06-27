import { redirect } from "next/navigation";

import { listingNumberUrlId, listingPath, listingUrlId } from "@/lib/routes";
import { getListingById, getListingDisplayNumber } from "@/lib/supabase";
import ListingPageClient from "./ListingPageClient";
import { generateListingMetadata } from "./metadata";

export const generateMetadata = generateListingMetadata;

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  if (!/^id\d+$/i.test(decodedId)) {
    const { data: listing } = await getListingById(decodedId);
    const displayNumber = listing
      ? await getListingDisplayNumber(listing.created_at, listing.listing_number)
      : null;
    const canonicalId = listingNumberUrlId(displayNumber) || listingUrlId(listing);
    const canonicalPath = canonicalId ? listingPath(canonicalId) : "";

    if (canonicalPath && canonicalPath !== listingPath(decodedId)) {
      redirect(canonicalPath);
    }
  }

  return <ListingPageClient />;
}
