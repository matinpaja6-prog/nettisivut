import type { Listing } from "./listings";

export type ListingLocale = "fi" | "en" | "sv" | "no" | "et";

export const listingLocales: ListingLocale[] = ["fi", "en", "sv", "no", "et"];

export function isListingLocale(value: unknown): value is ListingLocale {
  return value === "fi" || value === "en" || value === "sv" || value === "no" || value === "et";
}

export function getLocalizedListingText(
  listing: Pick<Listing, "title" | "description" | "translations">,
  locale: string
): { title: string; description: string } {
  const translated = isListingLocale(locale)
    ? listing.translations?.[locale]
    : undefined;

  return {
    title: translated?.title?.trim() || listing.title,
    description: translated?.description?.trim() || listing.description || ""
  };
}
