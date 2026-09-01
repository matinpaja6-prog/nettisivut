import ListingPage, { generateMetadata as generateBaseMetadata } from "@/app/listing/[id]/page";

type SeoListingPageProps = {
  params: Promise<{ brand: string; model: string; id: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateMetadata({ params }: SeoListingPageProps) {
  return generateBaseMetadata({
    params: params.then(({ id }) => ({ id }))
  });
}

export default function SeoListingPage({ params }: SeoListingPageProps) {
  return ListingPage({ params });
}
