import { generateListingMetadata } from "@/app/listing/[id]/metadata";
import ListingPage from "@/app/listing/[id]/page";

type SharePageParams = { params: Promise<{ id: string }> };

export function generateMetadata(props: SharePageParams) {
  return generateListingMetadata(props);
}

export default ListingPage;
