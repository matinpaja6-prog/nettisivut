import type { Metadata } from "next";

import { generateListingMetadata } from "@/app/listing/[id]/metadata";
import ListingPage from "@/app/listing/[id]/page";

type ListingSharePageParams = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(
  props: ListingSharePageParams
): Promise<Metadata> {
  return generateListingMetadata(props);
}

export default ListingPage;
