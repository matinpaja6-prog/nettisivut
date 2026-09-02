import { partGlossary } from "./part-glossary";

export type ListingQueryFilters = {
  kind?: "all" | "parts" | "vehicles" | "gear";
  query?: string;
  brand?: string;
  model?: string;
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  yearMin?: string;
  yearMax?: string;
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// Never interpolate PostgREST operators, commas, brackets or wildcards from user input.
export const safeSearchTerm = (value: string) => value.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().slice(0, 120);
// part_model is an optional legacy field absent from the current public table.
// Referencing it in OR filters rejects the whole request (Postgres 42703).
// Model/series details remain searchable in title and description.
const columns = ["title", "description", "brand", "model", "part_number", "engine_model", "category", "subcategory", "seller_name", "location"] as const;

export function listingSearchTerms(query: string) {
  const safe = safeSearchTerm(query);
  if (!safe) return [];
  const words = safe.split(/\s+/).filter(word => !["id", "part", "parts", "varaosa", "varaosat"].includes(word.toLowerCase())).slice(0, 8);
  return words.map(word => {
    const normalized = normalize(word);
    const group = partGlossary.find(entry => entry.flatMap(term => term.split("|")).some(term => normalize(term) === normalized));
    const alternatives = [...new Set([word, ...(group ? group.flatMap(term => term.split("|")) : [])])].slice(0, 10);
    return { word, alternatives };
  });
}

/** Same aliases as the database query; used for local suggestions, not catalogue downloads. */
export function listingMatchesQuery(listing: Partial<Record<(typeof columns)[number] | "id" | "listing_number", unknown>>, query: string) {
  const terms = listingSearchTerms(query);
  const searchable = columns.map(column => normalize(String(listing[column] ?? "")));
  return terms.length > 0 && terms.every(({ word, alternatives }) => {
    if (alternatives.some(term => searchable.some(value => value.includes(normalize(term))))) return true;
    const compact = word.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (/\d/.test(compact) && compact.length >= 3 &&
      String(listing.part_number ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().includes(compact)) return true;
    const identifier = word.match(/^(?:id|ilmoitus)?(\d{1,10})$/i)?.[1];
    return Boolean(identifier && Number(identifier) === listing.listing_number) || normalize(String(listing.id ?? "")) === normalize(word);
  });
}

export function listingSearchClauses(query: string) {
  return listingSearchTerms(query).map(({ word, alternatives }) => {
    const clauses = alternatives.flatMap(term => columns.map(column => column + ".ilike.*" + safeSearchTerm(term) + "*"));
    const compact = word.replace(/[^a-zA-Z0-9]/g, "");
    if (/\d/.test(compact) && compact.length >= 3) {
      // OEM identifiers remain searchable despite spaces/hyphens in stored data.
      clauses.push("part_number.ilike.*" + compact.split("").join("*") + "*");
    }
    const identifier = word.match(/^(?:id|ilmoitus)?(\d{1,10})$/i)?.[1];
    if (identifier) clauses.push("listing_number.eq." + Number(identifier));
    if (/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(word)) clauses.push("id.eq." + word);
    return clauses.join(",");
  });
}
