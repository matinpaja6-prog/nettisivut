import type { Metadata } from "next";

import { generateListingMetadataForLocale } from "@/app/listing/[id]/metadata";
import ListingPage from "@/app/listing/[id]/page";
import { listingSharePath } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";

type ListingSharePageParams = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(
  props: ListingSharePageParams
): Promise<Metadata> {
  const { id } = await props.params;
  const shareUrl = absoluteSiteUrl(listingSharePath(decodeURIComponent(id)));
  const metadata = await generateListingMetadataForLocale(props, "fi", listingSharePath(decodeURIComponent(id)));

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
