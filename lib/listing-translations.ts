import type { Listing } from "./listings";

export type ListingLocale = "fi" | "en" | "sv";

export const listingLocales: ListingLocale[] = ["fi", "en", "sv"];

export function isListingLocale(value: unknown): value is ListingLocale {
  return value === "fi" || value === "en" || value === "sv";
}

export function getLocalizedListingText(
  listing: Pick<Listing, "title" | "description" | "original_language" | "translations">,
  locale: string
): { title: string; description: string } {
  const sourceLanguage = isListingLocale(listing.original_language)
    ? listing.original_language
    : "fi";
  const translated = isListingLocale(locale) && locale !== sourceLanguage
    ? listing.translations?.[locale]
    : undefined;

  return {
    title: translated?.title?.trim() || listing.title,
    description: translated?.description?.trim() || listing.description || ""
  };
}
