import type { Metadata } from "next";
import { unstable_cache } from "next/cache";

import { formatPrice, isVehicleListing } from "@/lib/listings";
import { getLocalizedListingText, type ListingLocale } from "@/lib/listing-translations";
import { listingNumberUrlId, listingPath, listingSharePath } from "@/lib/routes";
import { absoluteSiteUrl, PUBLIC_SITE_URL } from "@/lib/site-url";
import { getListingById, getListingDisplayNumber } from "@/lib/supabase";

type ListingPageParams = {
  params: Promise<{ id: string }>;
};

const translateMetadataText = unstable_cache(
  async (text: string, targetLocale: ListingLocale) => {
    if (!text.trim() || targetLocale === "fi") return text;

    try {
      const query = new URLSearchParams({
        client: "gtx",
        sl: "auto",
        tl: targetLocale,
        dt: "t",
        q: text
      });
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?${query}`,
        { signal: AbortSignal.timeout(4_000) }
      );
      if (!response.ok) return text;
      const payload = await response.json();
      return payload?.[0]?.map((part: unknown[]) => part?.[0] ?? "").join("").trim() || text;
    } catch {
      return text;
    }
  },
  ["listing-share-metadata-translation-v1"],
  { revalidate: 86_400 }
);

async function getShareListingText(
  listing: NonNullable<Awaited<ReturnType<typeof getListingById>>["data"]>,
  locale?: ListingLocale
) {
  if (!locale) return { title: listing.title, description: listing.description || "" };

  const localized = getLocalizedListingText(listing, locale);
  const storedTitle = listing.translations?.[locale]?.title?.trim() || "";
  const storedDescription = listing.translations?.[locale]?.description?.trim() || "";
  const hasStoredTranslation = Boolean(
    (storedTitle && storedTitle !== listing.title.trim()) ||
    (storedDescription && storedDescription !== (listing.description || "").trim())
  );
  if (hasStoredTranslation || listing.original_language === locale) return localized;

  const [title, description] = await Promise.all([
    translateMetadataText(listing.title, locale),
    translateMetadataText(listing.description || "", locale)
  ]);
  return { title, description };
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

  const parts = [
    formatPrice(Number(listing.price) || 0),
    vehicle,
    partType,
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
  const missingVehicleDetails = [listing.brand, listing.model, listing.year, partType]
    .map((item) => cleanMetaText(item))
    .filter((item) => item && !normalizedTitle.includes(item.toLocaleLowerCase("fi")));
  const searchableTitle = [...missingVehicleDetails, listingTitle].join(" ");

  return `${searchableTitle} - ${formatPrice(Number(listing.price) || 0)}`;
}

export async function generateListingMetadataForLocale(
  { params }: ListingPageParams,
  locale?: ListingLocale,
  sharePath?: string
): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  // Local navigation must not wait for remote social/SEO metadata. Production
  // still generates the complete listing metadata below.
  if (process.env.NODE_ENV === "development") {
    return {
      title: "Ilmoitus | Maskines",
      robots: { index: false, follow: false }
    };
  }

  const { data: listing } = await getListingById(decodedId);

  if (!listing || listing.is_hidden || listing.is_sold) {
    const fallbackUrl = absoluteSiteUrl(listingPath(decodedId));

    return {
      title: "Ilmoitus | Maskines",
      description: "Katso ajoneuvojen varaosailmoitus Maskines-palvelussa.",
      robots: {
        index: false,
        follow: false
      },
      alternates: {
        canonical: fallbackUrl
      },
      openGraph: {
        type: "website",
        siteName: "Maskines",
        title: "Ilmoitus | Maskines",
        description: "Katso ajoneuvojen varaosailmoitus Maskines-palvelussa.",
        url: fallbackUrl,
        images: [
          {
            url: absoluteSiteUrl("/maskines-share-logo.png"),
            width: 1200,
            height: 1200,
            alt: "Maskines"
          }
        ]
      },
      twitter: {
        card: "summary_large_image",
        title: "Ilmoitus | Maskines",
        description: "Katso ajoneuvojen varaosailmoitus Maskines-palvelussa.",
        images: [absoluteSiteUrl("/maskines-share-logo.png")]
      }
    };
  }

  const localizedText = locale ? await getShareListingText(listing, locale) : null;
  const metadataListing = localizedText
    ? { ...listing, title: localizedText.title, description: localizedText.description }
    : listing;
  const effectiveLocale = locale ?? "fi";
  const rawPartType = !isVehicleListing(listing)
    ? cleanMetaText(listing.subcategory?.split("/").at(-1) || listing.category)
    : "";
  const localizedPartType = rawPartType
    ? await translateMetadataText(rawPartType, effectiveLocale)
    : "";
  const title = buildTitle(metadataListing, localizedPartType);
  const description = buildDescription(metadataListing, localizedPartType);
  const displayNumber = await getListingDisplayNumber(listing.created_at, listing.listing_number);
  const urlId = listingNumberUrlId(displayNumber) || listing.id;
  const url = absoluteSiteUrl(sharePath || listingPath(urlId));
  const imageUrl = absoluteSiteUrl(`/og/listing/${encodeURIComponent(urlId)}/preview.jpg`);
  const languages = {
    "fi-FI": absoluteSiteUrl(listingPath(urlId)),
    en: absoluteSiteUrl(listingSharePath(urlId, "en")),
    sv: absoluteSiteUrl(listingSharePath(urlId, "sv")),
    nb: absoluteSiteUrl(listingSharePath(urlId, "no")),
    "x-default": absoluteSiteUrl(listingPath(urlId))
  };

  return {
    metadataBase: new URL(PUBLIC_SITE_URL),
    title,
    description,
    robots: {
      index: true,
      follow: true
    },
    alternates: {
      canonical: url,
      languages
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
  return generateListingMetadataForLocale(props);
}
