import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import HomeClient from "@/app/HomeClient";
import SeoLandingIntro from "@/app/SeoLandingIntro";
import { listingPath, listingUrlId } from "@/lib/routes";
import {
  formatSeoSearchLabel,
  listingMatchesSeoCollection,
  localizeSeoSearchQuery,
  seoCollectionLanguagePaths,
  seoCollectionPath,
  seoLocalizedCollectionDescriptorPath,
  seoLocalizedCollectionRoot,
  seoPartCollectionDescriptors,
  seoSearchSlug,
  seoVehicleSearchQueries,
  type SeoCollectionKind,
  type SeoSearchLocale
} from "@/lib/seo-search";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

type CollectionPageParams = {
  params: Promise<{ slug?: string; segments?: string[] }>;
};

const localeCopy = {
  en: {
    language: "en",
    vehiclesTitle: (label: string) => `${label} vehicles for sale | Maskines`,
    partsTitle: (label: string) => `${label} parts for sale | Maskines`,
    vehiclesDescription: (label: string, count: number) =>
      `Browse all ${count} ${label} vehicle listings. Compare prices, photos and sellers.`,
    partsDescription: (label: string, count: number) =>
      `Browse all ${count} ${label} spare-part listings. Compare prices, photos and sellers.`,
    vehicles: "Vehicles",
    parts: "Spare parts"
  },
  sv: {
    language: "sv-SE",
    vehiclesTitle: (label: string) => `${label} fordon till salu | Maskines`,
    partsTitle: (label: string) => `${label} reservdelar till salu | Maskines`,
    vehiclesDescription: (label: string, count: number) =>
      `Se alla ${count} fordonsannonser för ${label}. Jämför priser, bilder och säljare.`,
    partsDescription: (label: string, count: number) =>
      `Se alla ${count} reservdelsannonser för ${label}. Jämför priser, bilder och säljare.`,
    vehicles: "Fordon",
    parts: "Reservdelar"
  },
  no: {
    language: "nb-NO",
    vehiclesTitle: (label: string) => `${label} kjøretøy til salgs | Maskines`,
    partsTitle: (label: string) => `${label} reservedeler til salgs | Maskines`,
    vehiclesDescription: (label: string, count: number) =>
      `Se alle ${count} kjøretøyannonser for ${label}. Sammenlign priser, bilder og selgere.`,
    partsDescription: (label: string, count: number) =>
      `Se alle ${count} reservedelsannonser for ${label}. Sammenlign priser, bilder og selgere.`,
    vehicles: "Kjøretøy",
    parts: "Reservedeler"
  }
} as const;

const getLocalizedCollectionData = cache(
  async (
    requestedSegments: string[],
    kind: SeoCollectionKind,
    locale: Exclude<SeoSearchLocale, "fi">
  ) => {
    const { data } = await getListings({
      includeOptionalFields: true,
      enrichSellerProfiles: false
    });
    const listings = data.filter((listing) => !listing.is_hidden && !listing.is_sold);
    const requestedPath = `${seoLocalizedCollectionRoot(kind, locale)}/${requestedSegments
      .map((segment) => seoSearchSlug(decodeURIComponent(segment)))
      .join("/")}`;
    const descriptors = new Map<string, { query: string; path: string; finnishPath: string }>();

    for (const listing of listings) {
      if (kind === "parts") {
        for (const descriptor of seoPartCollectionDescriptors(listing)) {
          const path = seoLocalizedCollectionDescriptorPath(kind, descriptor.path, locale);
          descriptors.set(path, { query: descriptor.query, path, finnishPath: descriptor.path });
        }
      } else {
        for (const query of seoVehicleSearchQueries(listing)) {
          const finnishPath = seoCollectionPath(kind, query);
          const path = seoLocalizedCollectionDescriptorPath(kind, finnishPath, locale);
          descriptors.set(path, { query, path, finnishPath });
        }
      }
    }

    const descriptor = descriptors.get(requestedPath);
    const matches = descriptor
      ? listings.filter((listing) => listingMatchesSeoCollection(listing, descriptor.query, kind))
      : [];

    return { descriptor, listings, matches };
  }
);

async function collectionSegments(params: CollectionPageParams["params"]) {
  const { slug, segments } = await params;
  return segments?.length ? segments : slug ? [slug] : [];
}

function localizedLabel(query: string, locale: Exclude<SeoSearchLocale, "fi">) {
  return formatSeoSearchLabel(localizeSeoSearchQuery(query, locale));
}

export async function generateLocalizedCollectionMetadata(
  { params }: CollectionPageParams,
  kind: SeoCollectionKind,
  locale: Exclude<SeoSearchLocale, "fi">
): Promise<Metadata> {
  const segments = await collectionSegments(params);
  const { descriptor, matches } = await getLocalizedCollectionData(segments, kind, locale);
  if (!descriptor || matches.length === 0) return { robots: { index: false, follow: true } };

  const copy = localeCopy[locale];
  const label = localizedLabel(descriptor.query, locale);
  const path = descriptor.path;
  const title = kind === "vehicles" ? copy.vehiclesTitle(label) : copy.partsTitle(label);
  const description = kind === "vehicles"
    ? copy.vehiclesDescription(label, matches.length)
    : copy.partsDescription(label, matches.length);
  const languages = Object.fromEntries(
    Object.entries(seoCollectionLanguagePaths(kind, descriptor.query, descriptor.finnishPath)).map(([language, languagePath]) => [
      language,
      absoluteSiteUrl(languagePath)
    ])
  );

  return {
    title: { absolute: title },
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: absoluteSiteUrl(path), languages },
    openGraph: {
      type: "website",
      siteName: "Maskines",
      title,
      description,
      url: absoluteSiteUrl(path),
      locale: locale === "en" ? "en_US" : locale === "sv" ? "sv_SE" : "nb_NO"
    }
  };
}

export async function LocalizedSeoCollectionPage({
  params,
  kind,
  locale
}: CollectionPageParams & {
  kind: SeoCollectionKind;
  locale: Exclude<SeoSearchLocale, "fi">;
}) {
  const segments = await collectionSegments(params);
  const { descriptor, listings, matches } = await getLocalizedCollectionData(segments, kind, locale);
  if (!descriptor || matches.length === 0) notFound();

  const copy = localeCopy[locale];
  const label = localizedLabel(descriptor.query, locale);
  const path = descriptor.path;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: kind === "vehicles" ? copy.vehiclesTitle(label) : copy.partsTitle(label),
    url: absoluteSiteUrl(path),
    inLanguage: copy.language,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: matches.length,
      itemListElement: matches.slice(0, 50).map((listing, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: listing.title,
        url: absoluteSiteUrl(listingPath(listing))
      }))
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <SeoLandingIntro
        title={kind === "vehicles" ? copy.vehiclesTitle(label).replace(" | Maskines", "") : copy.partsTitle(label).replace(" | Maskines", "")}
        description={kind === "vehicles" ? copy.vehiclesDescription(label, matches.length) : copy.partsDescription(label, matches.length)}
      />
      <HomeClient
        initialListings={listings}
        initialSearchQuery={descriptor.query}
        initialMarketplaceMode={kind}
      />
    </>
  );
}
