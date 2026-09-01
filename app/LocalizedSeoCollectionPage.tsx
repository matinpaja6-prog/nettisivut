import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import HomeClient from "@/app/HomeClient";
import { listingPath, listingUrlId } from "@/lib/routes";
import {
  formatSeoSearchLabel,
  listingMatchesSeoCollection,
  localizeSeoSearchQuery,
  seoCollectionLanguagePaths,
  seoLocalizedCollectionPath,
  seoPartSearchQueries,
  seoSearchSlug,
  seoVehicleSearchQueries,
  type SeoCollectionKind,
  type SeoSearchLocale
} from "@/lib/seo-search";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

type CollectionPageParams = { params: Promise<{ slug: string }> };

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
  async (slug: string, kind: SeoCollectionKind, locale: Exclude<SeoSearchLocale, "fi">) => {
    const { data } = await getListings({
      includeOptionalFields: true,
      enrichSellerProfiles: false
    });
    const listings = data.filter((listing) => !listing.is_hidden && !listing.is_sold);
    const requestedSlug = seoSearchSlug(decodeURIComponent(slug));
    const queries = new Set<string>();

    for (const listing of listings) {
      const generated = kind === "vehicles"
        ? seoVehicleSearchQueries(listing)
        : seoPartSearchQueries(listing);
      for (const query of generated) queries.add(query);
    }

    const query = [...queries].find(
      (candidate) => seoSearchSlug(localizeSeoSearchQuery(candidate, locale)) === requestedSlug
    );
    const matches = query
      ? listings.filter((listing) => listingMatchesSeoCollection(listing, query, kind))
      : [];

    return { query, listings, matches };
  }
);

function localizedLabel(query: string, locale: Exclude<SeoSearchLocale, "fi">) {
  return formatSeoSearchLabel(localizeSeoSearchQuery(query, locale));
}

export async function generateLocalizedCollectionMetadata(
  { params }: CollectionPageParams,
  kind: SeoCollectionKind,
  locale: Exclude<SeoSearchLocale, "fi">
): Promise<Metadata> {
  const { slug } = await params;
  const { query, matches } = await getLocalizedCollectionData(slug, kind, locale);
  if (!query || matches.length === 0) return { robots: { index: false, follow: true } };

  const copy = localeCopy[locale];
  const label = localizedLabel(query, locale);
  const path = seoLocalizedCollectionPath(kind, query, locale);
  const title = kind === "vehicles" ? copy.vehiclesTitle(label) : copy.partsTitle(label);
  const description = kind === "vehicles"
    ? copy.vehiclesDescription(label, matches.length)
    : copy.partsDescription(label, matches.length);
  const languages = Object.fromEntries(
    Object.entries(seoCollectionLanguagePaths(kind, query)).map(([language, languagePath]) => [
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
  const { slug } = await params;
  const { query, listings, matches } = await getLocalizedCollectionData(slug, kind, locale);
  if (!query || matches.length === 0) notFound();

  const copy = localeCopy[locale];
  const label = localizedLabel(query, locale);
  const path = seoLocalizedCollectionPath(kind, query, locale);
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
      <HomeClient
        initialListings={listings}
        initialSearchQuery={query}
        initialMarketplaceMode={kind}
      />
    </>
  );
}
