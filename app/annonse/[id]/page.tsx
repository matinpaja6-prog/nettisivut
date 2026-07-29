import { generateListingMetadataForLocale } from "@/app/listing/[id]/metadata";
import ListingPage from "@/app/listing/[id]/page";
import { listingSharePath } from "@/lib/routes";

type SharePageParams = { params: Promise<{ id: string }> };

export function generateMetadata(props: SharePageParams) {
  return props.params.then(({ id }) =>
    generateListingMetadataForLocale(
      props,
      "no",
      listingSharePath(decodeURIComponent(id), "no")
    )
  );
}

export default ListingPage;
