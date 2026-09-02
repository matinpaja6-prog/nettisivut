import type { Metadata } from "next";

import { generateListingMetadataForLocale } from "@/app/listing/[id]/metadata";
import ListingPage from "@/app/listing/[id]/page";

type ListingSharePageParams = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(
  props: ListingSharePageParams
): Promise<Metadata> {
  return generateListingMetadataForLocale(props, "fi");
}

export default ListingPage;
