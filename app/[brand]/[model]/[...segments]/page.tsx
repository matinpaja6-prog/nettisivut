import { notFound } from "next/navigation";


import ListingPage, { generateMetadata as generateBaseMetadata } from "@/app/listing/[id]/page";

type SeoListingPageProps = {
  params: Promise<{ brand: string; model: string; segments: string[] }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function listingParams(params: SeoListingPageProps["params"]) {
  const { brand, model, segments } = await params;

  if (segments.length === 1) {
    return { brand, model, id: segments[0] };
  }

  if (segments.length === 2) {
    return { brand, model, part: segments[0], id: segments[1] };
  }

  notFound();
}

export function generateMetadata({ params }: SeoListingPageProps) {
  return generateBaseMetadata({
    params: listingParams(params).then(({ id }) => ({ id }))
  });
}

export default function SeoListingPage({ params }: SeoListingPageProps) {
  return ListingPage({ params: listingParams(params) });
}
