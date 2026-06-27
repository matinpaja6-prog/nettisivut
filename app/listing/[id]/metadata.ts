import type { Metadata } from "next";

import { formatPrice } from "@/lib/listings";
import { listingPath } from "@/lib/routes";
import { absoluteSiteUrl, PUBLIC_SITE_URL } from "@/lib/site-url";
import { getListingById } from "@/lib/supabase";

type ListingPageParams = {
  params: Promise<{ id: string }>;
};

function cleanMetaText(value?: string | null, fallback = "") {
  return String(value ?? fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function firstListingImage(listing: {
  image_url?: string | null;
  image_urls?: string[] | null;
}) {
  return (
    listing.image_urls?.find((url) => cleanMetaText(url)) ||
    cleanMetaText(listing.image_url) ||
    "/maskines-share-logo.png"
  );
}

function buildDescription(listing: Awaited<ReturnType<typeof getListingById>>["data"]) {
  if (!listing) {
    return "Katso ajoneuvojen varaosailmoitus Maskines-palvelussa.";
  }

  const vehicle = [listing.brand, listing.model, listing.year]
    .map((item) => cleanMetaText(item))
    .filter(Boolean)
    .join(" ");

  const parts = [
    formatPrice(Number(listing.price) || 0),
    vehicle,
    cleanMetaText(listing.location),
    cleanMetaText(listing.description).slice(0, 150)
  ].filter(Boolean);

  return parts.join(" · ");
}

export async function generateListingMetadata({ params }: ListingPageParams): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { data: listing } = await getListingById(decodedId);

  if (!listing) {
    const fallbackUrl = absoluteSiteUrl(listingPath(decodedId));

    return {
      title: "Ilmoitus | Maskines",
      description: "Katso ajoneuvojen varaosailmoitus Maskines-palvelussa.",
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
            width: 479,
            height: 479,
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

  const title = `${cleanMetaText(listing.title, "Ilmoitus")} - ${formatPrice(Number(listing.price) || 0)}`;
  const description = buildDescription(listing);
  const url = absoluteSiteUrl(listingPath(listing.listing_number || listing.id));
  const imageUrl = absoluteSiteUrl(firstListingImage(listing));

  return {
    metadataBase: new URL(PUBLIC_SITE_URL),
    title,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      type: "article",
      siteName: "Maskines",
      title,
      description,
      url,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: cleanMetaText(listing.title, "Maskines ilmoitus")
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
