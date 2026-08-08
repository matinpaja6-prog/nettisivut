import type { Listing } from "@/lib/listings";

export function normalizeSeoSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fi")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function seoSearchSlug(query: string) {
  return normalizeSeoSearchText(query).replace(/ /g, "-");
}

export function seoSearchPath(query: string) {
  return `/varaosat/${seoSearchSlug(query)}`;
}

export function seoSearchQueryFromSlug(slug: string) {
  return normalizeSeoSearchText(decodeURIComponent(slug)).replace(/\s+/g, " ");
}

export function seoListingSearchQuery(listing: Pick<Listing, "brand" | "model" | "title">) {
  const words = normalizeSeoSearchText(
    `${listing.brand ?? ""} ${listing.model ?? ""} ${listing.title ?? ""}`
  ).split(" ").filter(Boolean);

  return [...new Set(words)].join(" ");
}

export function listingMatchesSeoQuery(listing: Listing, query: string) {
  const words = normalizeSeoSearchText(query).split(" ").filter(Boolean);
  if (words.length === 0) return false;

  const haystack = normalizeSeoSearchText([
    listing.title,
    listing.description,
    listing.brand,
    listing.model,
    listing.part_model,
    listing.part_number,
    listing.category,
    listing.subcategory,
    listing.engine_model
  ].join(" "));

  return words.every((word) => haystack.includes(word));
}

export function formatSeoSearchLabel(query: string) {
  return normalizeSeoSearchText(query)
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^[a-z]{1,3}$/.test(word) && word !== "ja") return word.toUpperCase();
      if (word === "ja") return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}
