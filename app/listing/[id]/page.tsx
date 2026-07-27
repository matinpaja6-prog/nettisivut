import { redirect } from "next/navigation";

import { getListingPartNumber, type Listing } from "@/lib/listings";
import { listingNumberUrlId, listingPath, listingUrlId } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListingById, getListingDisplayNumber } from "@/lib/supabase";
import ListingPageClient from "./ListingPageClient";
import { generateListingMetadata } from "./metadata";

export const generateMetadata = generateListingMetadata;

function cleanStructuredText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function schemaCondition(condition?: string | null) {
  const value = cleanStructuredText(condition).toLocaleLowerCase("fi");

  if (value === "uusi" || value === "new") {
    return "https://schema.org/NewCondition";
  }

  if (value.includes("kunnost") || value.includes("refurbished")) {
    return "https://schema.org/RefurbishedCondition";
  }

  return "https://schema.org/UsedCondition";
}

function buildProductStructuredData(listing: Listing, url: string) {
  const partNumber = getListingPartNumber(listing);
  const images = [...new Set([listing.image_url, ...(listing.image_urls ?? [])])]
    .map((image) => cleanStructuredText(image))
    .filter((image) => image && !image.startsWith("data:") && !image.startsWith("blob:"))
    .map((image) => absoluteSiteUrl(image));
  const additionalProperties = [
    ["Ajoneuvotyyppi", listing.vehicle_type],
    ["Merkki", listing.brand],
    ["Malli", listing.model],
    ["Vuosimalli", listing.year],
    ["Kategoria", listing.category],
    ["Alakategoria", listing.subcategory]
  ]
    .map(([name, value]) => ({ name, value: cleanStructuredText(value) }))
    .filter((property) => property.value)
    .map((property) => ({
      "@type": "PropertyValue",
      ...property
    }));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: cleanStructuredText(listing.title),
    description: cleanStructuredText(listing.description).slice(0, 5_000),
    url,
    ...(images.length > 0 ? { image: images } : {}),
    ...(listing.brand
      ? {
          brand: {
            "@type": "Brand",
            name: cleanStructuredText(listing.brand)
          }
        }
      : {}),
    ...(listing.model ? { model: cleanStructuredText(listing.model) } : {}),
    ...(partNumber ? { sku: partNumber, mpn: partNumber } : {}),
    ...(additionalProperties.length > 0
      ? { additionalProperty: additionalProperties }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      price: Number(listing.price) || 0,
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      itemCondition: schemaCondition(listing.condition)
    }
  };
}

function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { data: listing } = await getListingById(decodedId);
  const displayNumber = listing
    ? await getListingDisplayNumber(listing.created_at, listing.listing_number)
    : null;
  const canonicalId = listingNumberUrlId(displayNumber) || listingUrlId(listing);
  const canonicalPath = canonicalId ? listingPath(canonicalId) : "";

  if (!/^id\d+$/i.test(decodedId)) {
    if (canonicalPath && canonicalPath !== listingPath(decodedId)) {
      redirect(canonicalPath);
    }
  }

  const structuredData =
    listing && !listing.is_hidden && !listing.is_sold && canonicalPath
      ? buildProductStructuredData(listing, absoluteSiteUrl(canonicalPath))
      : null;

  return (
    <>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
        />
      ) : null}
      <ListingPageClient />
    </>
  );
}
