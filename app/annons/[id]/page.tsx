import { generateListingMetadataForLocale } from "@/app/listing/[id]/metadata";
import ListingPage from "@/app/listing/[id]/page";

type SharePageParams = { params: Promise<{ id: string }> };

export function generateMetadata(props: SharePageParams) {
  return generateListingMetadataForLocale(props, "sv");
}

export default ListingPage;
