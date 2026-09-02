import "server-only";
import { cache } from "react";
import { getListingById } from "./supabase";

// Deduplicate metadata and page reads within one server render, never across
// requests: a sold/hidden listing must not survive in a persistent SEO cache.
export const getServerListing = cache(getListingById);
