import type { Metadata } from "next";

import { generateListingMetadata } from "@/app/listing/[id]/metadata";
import ListingPage from "@/app/listing/[id]/page";
import { listingSharePath } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";

type ListingSharePageParams = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(
  props: ListingSharePageParams
): Promise<Metadata> {
  const metadata = await generateListingMetadata(props);
  const { id } = await props.params;
  const shareUrl = absoluteSiteUrl(listingSharePath(decodeURIComponent(id)));

  return {
    ...metadata,
    openGraph: metadata.openGraph
      ? {
          ...metadata.openGraph,
          type: "website",
          url: shareUrl
        }
      : metadata.openGraph
  };
}

export default ListingPage;
