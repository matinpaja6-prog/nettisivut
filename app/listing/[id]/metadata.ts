import type { Metadata } from "next";
import { glossaryTitle } from "@/lib/part-glossary";
import { getServerLocale } from "@/lib/server-locale";

import { formatPrice, getListingSalePricing, isVehicleListing } from "@/lib/listings";
import { getLocalizedListingText, type ListingLocale } from "@/lib/listing-translations";
import { listingNumberUrlId, listingPath, languagePaths } from "@/lib/routes";
import { absoluteSiteUrl, PUBLIC_SITE_URL } from "@/lib/site-url";
import { getListingById, getListingDisplayNumber } from "@/lib/supabase";
import { getServerListing } from "@/lib/server-listing";

type ListingPageParams = {
  params: Promise<{ id: string }>;
};


async function getShareListingText(
  listing: NonNullable<Awaited<ReturnType<typeof getListingById>>["data"]>,
  locale?: ListingLocale
) {
  if (!locale) return { title: listing.title, description: listing.description || "" };

  const localized = getLocalizedListingText(listing, locale);
  return localized;
}

function cleanMetaText(value?: string | null, fallback = "") {
  return String(value ?? fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function buildDescription(
  listing: Awaited<ReturnType<typeof getListingById>>["data"],
  localizedPartType = ""
) {
  if (!listing) {
    return "Katso ajoneuvojen varaosailmoitus Maskines-palvelussa.";
  }

  const vehicle = [listing.brand, listing.model, listing.year]
    .map((item) => cleanMetaText(item))
    .filter(Boolean)
    .join(" ");
  const partType = !isVehicleListing(listing)
    ? cleanMetaText(localizedPartType || listing.subcategory?.split("/").at(-1) || listing.category)
    : "";
  const partModel = !isVehicleListing(listing) ? cleanMetaText(listing.part_model) : "";
  const partNumber = !isVehicleListing(listing) ? cleanMetaText(listing.part_number) : "";

  const parts = [
    formatPrice(getListingSalePricing(listing).currentPrice),
    vehicle,
    partType,
    partModel,
    partNumber ? `OEM / osanumero ${partNumber}` : "",
    cleanMetaText(listing.engine_model),
    cleanMetaText(listing.location),
    cleanMetaText(listing.description).slice(0, 150)
  ].filter(Boolean);

  return parts.join(" - ");
}

function buildTitle(
  listing: NonNullable<Awaited<ReturnType<typeof getListingById>>["data"]>,
  localizedPartType = ""
) {
  const listingTitle = cleanMetaText(listing.title, "Ilmoitus");
  const normalizedTitle = listingTitle.toLocaleLowerCase("fi");
  const partType = !isVehicleListing(listing)
    ? cleanMetaText(localizedPartType || listing.subcategory?.split("/").at(-1) || listing.category)
    : "";
  const missingVehicleDetails = [
    listing.brand,
    listing.model,
    listing.year
  ]
    .map((item) => cleanMetaText(item))
    .filter((item) => item && !normalizedTitle.includes(item.toLocaleLowerCase("fi")));
  const missingPartDetails = [
    partType,
    !isVehicleListing(listing) ? listing.part_model : "",
    !isVehicleListing(listing) ? listing.part_number : ""
  ]
    .map((item) => cleanMetaText(item))
    .filter((item) => item && !normalizedTitle.includes(item.toLocaleLowerCase("fi")));
  // Keep the seller's product/manufacturer name near the start of the title,
  // ahead of long category labels and OEM numbers that Google may truncate.
  const searchableTitle = [...missingVehicleDetails, listingTitle, ...missingPartDetails].join(" ");

  return `${searchableTitle} - ${formatPrice(getListingSalePricing(listing).currentPrice)}`;
}

export async function generateListingMetadataForLocale(
  { params }: ListingPageParams,
  locale?: ListingLocale
): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  const effectiveLocale = locale ?? "fi";
  const fallbackCopy = {
    fi: { title: "Ilmoitus", description: "Katso ajoneuvojen varaosailmoitus Maskines-palvelussa." },
    en: { title: "Listing", description: "View vehicle parts and listings on Maskines." },
    sv: { title: "Annons", description: "Se fordonsdelar och annonser på Maskines." },
    no: { title: "Annonse", description: "Se kjøretøydeler og annonser på Maskines." }
  }[effectiveLocale];
  const fallbackTitle = `${fallbackCopy.title} | Maskines`;
  const { data: listing } = await getServerListing(decodedId);

  if (!listing || listing.is_hidden || listing.is_sold) {
    const fallbackUrl = absoluteSiteUrl(listingPath(decodedId, effectiveLocale));

    return {
      title: { absolute: fallbackTitle },
      description: fallbackCopy.description,
      robots: {
        index: false,
        follow: false,
        noarchive: true,
        nosnippet: true,
        noimageindex: true,
        googleBot: {
          index: false,
          follow: false,
          noarchive: true,
          nosnippet: true,
          noimageindex: true
        }
      },
      alternates: {
        canonical: fallbackUrl
      },
      openGraph: {
        type: "website",
        siteName: "Maskines",
        title: fallbackTitle,
        description: fallbackCopy.description,
        url: fallbackUrl,
        images: [
          {
            url: absoluteSiteUrl("/maskines-brand-share-v2.png"),
            width: 1200,
            height: 1200,
            alt: "Maskines"
          }
        ]
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: fallbackCopy.description,
        images: [absoluteSiteUrl("/maskines-brand-share-v2.png")]
      }
    };
  }

  const localizedText = locale ? await getShareListingText(listing, locale) : null;
  const metadataListing = localizedText
    ? { ...listing, title: localizedText.title, description: localizedText.description }
    : listing;
  const rawPartType = !isVehicleListing(listing)
    ? cleanMetaText(listing.subcategory?.split("/").at(-1) || listing.category)
    : "";
  const localizedPartType = glossaryTitle(rawPartType, effectiveLocale);
  const title = buildTitle(metadataListing, localizedPartType);
  const description = buildDescription(metadataListing, localizedPartType);
  const displayNumber = await getListingDisplayNumber(listing.created_at, listing.listing_number);
  const urlId = listingNumberUrlId(displayNumber) || listing.id;
  const canonicalListingPath = listingPath({ ...listing, listing_number: displayNumber, id: urlId }, effectiveLocale);
  const url = absoluteSiteUrl(canonicalListingPath);
  const imageUrl = absoluteSiteUrl(`/og/listing/${encodeURIComponent(urlId)}/preview.jpg`);

  return {
    metadataBase: new URL(PUBLIC_SITE_URL),
    title: { absolute: `${title} | Maskines` },
    description,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    },
    alternates: {
      // All legacy share aliases resolve to this one public listing URL.
      canonical: url,
      languages: languagePaths(canonicalListingPath)
    },
    openGraph: {
      type: "website",
      siteName: "Maskines",
      title,
      description,
      url,
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          type: "image/jpeg",
          width: 1200,
          height: 630,
          alt: cleanMetaText(metadataListing.title, "Maskines ilmoitus")
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl]
    }
  };
}

export async function generateListingMetadata(props: ListingPageParams): Promise<Metadata> {
  return generateListingMetadataForLocale(props, await getServerLocale());
}
