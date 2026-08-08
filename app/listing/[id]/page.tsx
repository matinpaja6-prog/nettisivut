import { notFound, redirect } from "next/navigation";

import { formatPrice, getListingPartNumber, type Listing } from "@/lib/listings";
import { listingNumberUrlId, listingPath, listingUrlId } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListingById, getListingDisplayNumber } from "@/lib/supabase";
import ListingPageClient from "./ListingPageClient";
import { generateListingMetadata } from "./metadata";

// Listing availability and visibility come directly from Supabase. Do not
// persist a failed database response in Next's full-route/fetch cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const listingTitle = cleanStructuredText(listing.title);
  const normalizedTitle = listingTitle.toLocaleLowerCase("fi");
  const missingVehicleDetails = [listing.brand, listing.model, listing.year]
    .map((value) => cleanStructuredText(value))
    .filter((value) => value && !normalizedTitle.includes(value.toLocaleLowerCase("fi")));
  const searchableProductName = [...missingVehicleDetails, listingTitle].join(" ");
  const images = [...new Set([listing.image_url, ...(listing.image_urls ?? [])])]
    .map((image) => cleanStructuredText(image))
    .filter((image) => image && !image.startsWith("data:") && !image.startsWith("blob:"))
    .map((image, index) => ({
      "@type": "ImageObject",
      contentUrl: absoluteSiteUrl(image),
      name: `${searchableProductName} – kuva ${index + 1}`,
      caption: `${searchableProductName}, ${formatPrice(Number(listing.price) || 0)}`
    }));
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
    name: searchableProductName,
    description: cleanStructuredText(listing.description).slice(0, 5_000),
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
      name: searchableProductName,
      primaryImageOfPage: images[0]
    },
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
      itemCondition: schemaCondition(listing.condition),
      ...(listing.seller_name
        ? {
            seller: {
              "@type": listing.company_name ? "Organization" : "Person",
              name: cleanStructuredText(listing.company_name || listing.seller_name)
            }
          }
        : {})
    }
  };
}

function buildBreadcrumbStructuredData(listing: Listing, url: string) {
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Maskines",
      item: absoluteSiteUrl("/")
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Ilmoitukset",
      item: absoluteSiteUrl("/ilmoitukset")
    },
    {
      "@type": "ListItem",
      position: 3,
      name: cleanStructuredText(listing.title),
      item: url
    }
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items
  };
}

function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  // The client already has the clicked listing in its local cache. In local
  // development, render that immediately instead of blocking navigation on a
  // remote server-side Supabase request that may be unavailable.
  if (process.env.NODE_ENV === "development") {
    return <ListingPageClient />;
  }

  const { data: listing } = await getListingById(decodedId);

  if (!listing || listing.is_hidden) {
    notFound();
  }

  const displayNumber = listing
    ? await getListingDisplayNumber(listing.created_at, listing.listing_number)
    : null;
  const canonicalId = listingNumberUrlId(displayNumber) || listingUrlId(listing);
  const canonicalPath = canonicalId ? listingPath(canonicalId) : "";

  if (canonicalPath && canonicalPath !== listingPath(decodedId)) {
    redirect(canonicalPath);
  }

  const productStructuredData =
    listing && !listing.is_hidden && !listing.is_sold && canonicalPath
      ? buildProductStructuredData(listing, absoluteSiteUrl(canonicalPath))
      : null;
  const breadcrumbStructuredData =
    listing && !listing.is_hidden && canonicalPath
      ? buildBreadcrumbStructuredData(listing, absoluteSiteUrl(canonicalPath))
      : null;

  return (
    <>
      {productStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(productStructuredData) }}
        />
      ) : null}
      {breadcrumbStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(breadcrumbStructuredData) }}
        />
      ) : null}
      <ListingPageClient initialListing={listing} />
    </>
  );
}
