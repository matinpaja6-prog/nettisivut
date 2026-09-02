import type { Listing } from "./listings";
import { glossaryDescription, glossaryTitle, validTechnicalTranslation } from "./part-glossary";

export type ListingLocale = "fi" | "en" | "sv" | "no";

export const listingLocales: ListingLocale[] = ["fi", "en", "sv", "no"];

export function isListingLocale(value: unknown): value is ListingLocale {
  return value === "fi" || value === "en" || value === "sv" || value === "no";
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
    title: translated?.title && validTechnicalTranslation(listing.title, translated.title, locale, sourceLanguage) && translated.title.trim() !== listing.title.trim()
      ? sourceLanguage === "fi" ? glossaryTitle(translated.title.trim(), locale) : translated.title.trim()
      : sourceLanguage === "fi" ? glossaryTitle(listing.title, locale) : listing.title,
    description: translated?.description && validTechnicalTranslation(listing.description || "", translated.description, locale, sourceLanguage) && translated.description.trim() !== listing.description?.trim()
      ? sourceLanguage === "fi" ? glossaryDescription(translated.description.trim(), locale) : translated.description.trim()
      : sourceLanguage === "fi" ? glossaryDescription(listing.description || "", locale) : listing.description || ""
  };
}
