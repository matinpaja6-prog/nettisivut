import { getLocalizedListingText } from "@/lib/listing-translations";
import { getServerLocale, getServerPathname } from "@/lib/server-locale";
import { notFound, permanentRedirect } from "next/navigation";


import { formatPrice, getListingPartNumber, getListingSalePricing, type Listing } from "@/lib/listings";
import { listingNumberUrlId, listingPath, listingUrlId } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListingDisplayNumber } from "@/lib/supabase";
import { getServerListing } from "@/lib/server-listing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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
  const salePricing = getListingSalePricing(listing);
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
      caption: `${searchableProductName}, ${formatPrice(salePricing.currentPrice)}`
    }));
  const additionalProperties = [
    ["Ajoneuvotyyppi", listing.vehicle_type],
    ["Merkki", listing.brand],
    ["Malli", listing.model],
    ["Vuosimalli", listing.year],
    ["Moottorimalli", listing.engine_model],
    ["Kategoria", listing.category],
    ["Alakategoria", listing.subcategory],
    ["Osan malli tai tuotesarja", listing.part_model],
    ["OEM- tai osanumero", partNumber],
    ["Kunto", listing.condition],
    ["Sijainti", listing.location]
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
      price: salePricing.currentPrice,
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

export default async function ListingPage({ params }: { params: Promise<{ id: string; brand?: string; model?: string; part?: string }> }) {
  const { id, brand: requestedBrand, model: requestedModel, part: requestedPart } = await params;
  const decodedId = decodeURIComponent(id);
  const locale = await getServerLocale();

  const { data: listing } = await getServerListing(decodedId);

  if (!listing || listing.is_hidden || listing.is_sold) {
    notFound();
  }

  const commerceProductId = listing.translations?._meta?.commerce_product_id?.trim();
  if (commerceProductId) {
    const { data: availableProduct } = await getSupabaseAdmin()
      .from("products")
      .select("id")
      .eq("id", commerceProductId)
      .eq("active", true)
      .gt("stock_quantity", 0)
      .maybeSingle<{ id: string }>();
    if (!availableProduct) notFound();
  }

  const displayNumber = listing
    ? await getListingDisplayNumber(listing.created_at, listing.listing_number)
    : null;
  const canonicalId = listingNumberUrlId(displayNumber) || listingUrlId(listing);
  const canonicalPath = canonicalId
    ? listingPath({ ...listing, listing_number: displayNumber, id: canonicalId }, locale)
    : "";
  const requestedPath = await getServerPathname();

  if (canonicalPath && canonicalPath !== requestedPath) {
    permanentRedirect(canonicalPath);
  }

  const localizedListing = { ...listing, ...getLocalizedListingText(listing, locale) };
  const productStructuredData =
    listing && !listing.is_hidden && !listing.is_sold && canonicalPath
      ? buildProductStructuredData(localizedListing, absoluteSiteUrl(canonicalPath))
      : null;
  const breadcrumbStructuredData =
    listing && !listing.is_hidden && !listing.is_sold && canonicalPath
      ? buildBreadcrumbStructuredData(localizedListing, absoluteSiteUrl(canonicalPath))
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
