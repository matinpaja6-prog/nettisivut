import ListingPageClient from "./ListingPageClient";
import { generateListingMetadata } from "./metadata";

export const generateMetadata = generateListingMetadata;

export default function ListingPage() {
  return <ListingPageClient />;
}
