import { createClient, type Session, type User } from "@supabase/supabase-js";

import {
  type Listing,
  type ListingInput,
  type SoldListing,
  type ListingTranslations
} from "./listings";

import {
  isListingLocale,
  listingLocales,
  type ListingLocale
} from "./listing-translations";
import { isUuidLike, slugifyProfileName } from "./routes";

/* =========================
   TYPES
========================= */

export type UserProfile = {
  id: string;

  public_id?: string;

  account_type?: "private" | "company";

  first_name: string;

  last_name: string;

  company_name?: string | null;

  business_id?: string | null;

  company_role?: string | null;

  company_website?: string | null;

  company_verified_at?: string | null;

  company_verification_requested_at?: string | null;

  public_address?: string | null;

  billing_email?: string | null;

  full_name?: string;

  name?: string;

  username?: string | null;

  email: string;

  phone: string;

  phone_verified_at?: string | null;

  pending_phone?: string | null;

  phone_last_changed_at?: string | null;

  phone_verification_count?: number | null;

  address: string;

  postal_code: string;

  city: string;

  country: string;

  birth_date: string | null;

  bio?: string | null;

  avatar_url?: string | null;

  is_completed?: boolean;

  online?: boolean;

  last_seen?: string;

  points?: number;

  referral_code?: string | null;

  referred_by?: string | null;

  created_at?: string;

  updated_at?: string;
};

export type CompanySeller = {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  phone_verified_at?: string | null;
  edit_count?: number | null;
  created_at?: string;
  updated_at?: string | null;
};

export type Referral = {
  id: string;
  referrer_id: string;
  referred_id: string;
  points_awarded: number;
  created_at: string;
};

export type UserProfileInput = Omit<
  UserProfile,
  | "created_at"
  | "updated_at"
  | "full_name"
  | "public_id"
>;

export type SellerReview = {
  id: string;

  seller_id: string;

  reviewer_id: string | null;

  reviewer_name: string;

  rating: number;

  comment: string;

  created_at: string;

  like_count?: number;

  is_liked?: boolean;
};

export type SellerReviewInput = Omit<
  SellerReview,
  | "id"
  | "created_at"
>;

export type ProfileFollowStats = {
  follower_count: number;
  following_count: number;
  is_following: boolean;
};

export type SellerReviewLikeSummary = {
  review_id: string;
  like_count: number;
  is_liked: boolean;
};

export type SellerLevelStats = {
  listings_created: number;
  single_listings_created: number;
  multi_listings_created: number;
  sold_count: number;
  reviews_given: number;
  reviews_received: number;
  phone_verified: boolean;
};

export type ProfileFollowListItem = {
  direction: "following" | "follower";
  profile_id: string;
  account_type: string | null;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  relation_created_at: string;
};

export type PurchaseReviewRequest = {
  id: string;
  listing_id: string;
  conversation_id: string;
  buyer_id: string;
  seller_id: string;
  listing_title: string;
  seller_name: string;
  due_at: string;
  seen_at?: string | null;
  completed_at?: string | null;
  created_at: string;
};

export type PurchaseReviewRequestInput = {
  listing_id: string;
  conversation_id: string;
  buyer_id: string;
  seller_id: string;
  listing_title: string;
  seller_name: string;
  due_at?: string;
};

export type ListingBuyerCandidate = {
  conversation_id: string;
  buyer_id: string;
  buyer_name: string;
  created_at: string;
};

export type ReviewBuyerLookup = {
  buyer_id: string;
  buyer_name: string;
};

export type ListingUpdateInput = Pick<
  Listing,
  | "title"
  | "original_language"
  | "translations"
  | "price"
  | "vehicle_subtype"
  | "category"
  | "subcategory"
  | "part_number"
  | "location"
  | "condition"
  | "description"
  | "image_url"
  | "image_urls"
>;

export type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  updated_at?: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image?: string | null;
  read?: boolean | null;
  read_at?: string | null;
  created_at: string;
};

export type ConversationSummary = Conversation & {
  listing?: Pick<
    Listing,
    | "id"
    | "listing_number"
    | "title"
    | "image_url"
    | "price"
    | "seller_name"
  > | null;
  other_profile?: Pick<
    UserProfile,
    | "id"
    | "public_id"
    | "first_name"
    | "last_name"
    | "full_name"
    | "name"
    | "username"
    | "avatar_url"
    | "online"
    | "last_seen"
    | "created_at"
    | "city"
    | "country"
  > | null;
  last_message?: ChatMessage | null;
  other_review_average?: number | null;
  other_review_count?: number;
};

/* =========================
   HELPERS
========================= */

export function isProfileCompleted(
  profile:
    | UserProfile
    | null
    | undefined
) {

  if (!profile) {
    return false;
  }

  if (profile.is_completed === true) {
    return true;
  }

  if (profile.account_type === "company") {
    return Boolean(
      profile.company_name &&
      profile.business_id &&
      profile.email &&
      profile.phone &&
      profile.address &&
      profile.postal_code &&
      profile.city &&
      profile.country
    );
  }

  return Boolean(

    profile.first_name &&
    profile.last_name &&
    profile.email &&
    profile.phone &&
    profile.address &&
    profile.postal_code &&
    profile.city &&
    profile.country &&
    profile.birth_date

  );

}

/* =========================
   SUPABASE
========================= */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured =
  Boolean(
    supabaseUrl &&
    supabaseAnonKey
  );

export const supabase =
  isSupabaseConfigured
    ? createClient(
        supabaseUrl!,
        supabaseAnonKey!
      )
    : null;

function isInvalidRefreshTokenError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");

  return /invalid refresh token|refresh token not found|refresh_token_not_found/i.test(message);
}

function clearStoredSupabaseAuth() {
  if (typeof window === "undefined") return;

  try {
    const storages = [window.localStorage, window.sessionStorage];
    for (const storage of storages) {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (!key) continue;
        if (key.startsWith("sb-") && key.includes("-auth-token")) {
          storage.removeItem(key);
        }
      }
    }
  } catch {
    // Storage can be unavailable in private mode; failing to clear it should not crash the app.
  }
}

export async function getSafeAuthSession(): Promise<Session | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session ?? null;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      clearStoredSupabaseAuth();
      return null;
    }

    throw error;
  }
}

export async function getSafeAuthUser(): Promise<User | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user ?? null;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      clearStoredSupabaseAuth();
      return null;
    }

    throw error;
  }
}

type ListingImageFields = Pick<Listing, "image_url" | "image_urls">;

function storageObjectFromPublicUrl(value: string) {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return null;
  }

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex =
      parts.findIndex((part, index) =>
        part === "object" &&
        parts[index - 2] === "storage" &&
        parts[index - 1] === "v1"
      );

    if (objectIndex === -1) {
      return null;
    }

    const visibility = parts[objectIndex + 1];
    if (visibility !== "public" && visibility !== "sign") {
      return null;
    }

    const bucket = parts[objectIndex + 2];
    const path =
      parts
        .slice(objectIndex + 3)
        .map((part) => decodeURIComponent(part))
        .join("/");

    if (!bucket || !path) {
      return null;
    }

    return { bucket, path };
  } catch {
    return null;
  }
}

function collectListingStorageObjects(listing: Partial<ListingImageFields> | null | undefined) {
  const imageValues =
    Array.from(
      new Set([
        listing?.image_url,
        ...(Array.isArray(listing?.image_urls) ? listing.image_urls : [])
      ].filter((value): value is string => Boolean(value)))
    );

  const byBucket = new Map<string, Set<string>>();

  for (const value of imageValues) {
    const object = storageObjectFromPublicUrl(value);
    if (!object) continue;

    const paths =
      byBucket.get(object.bucket) ?? new Set<string>();
    paths.add(object.path);
    byBucket.set(object.bucket, paths);
  }

  return byBucket;
}

async function deleteListingStorageImages(
  listing: Partial<ListingImageFields> | null | undefined
) {
  if (!supabase) return null;

  const byBucket =
    collectListingStorageObjects(listing);
  let firstError: unknown = null;

  for (const [bucket, paths] of byBucket) {
    if (paths.size === 0) continue;

    const { error } =
      await supabase
        .storage
        .from(bucket)
        .remove([...paths]);

    if (error && !firstError) {
      firstError = error;
    }
  }

  return firstError;
}

/* =========================
   LISTINGS
========================= */

type GetListingsOptions = {
  enrichSellerProfiles?: boolean;
  includeOptionalFields?: boolean;
  limit?: number;
  offset?: number;
  includeCount?: boolean;
  onChunk?: (listings: Listing[]) => void;
};

const LISTINGS_FETCH_CHUNK_SIZE = 1000;

const BASE_LISTING_CARD_COLUMN_LIST = [
  "id",
  "seller_id",
  "title",
  "price",
  "vehicle_type",
  "brand",
  "model",
  "year",
  "engine_cc",
  "engine_model",
  "category",
  "subcategory",
  "location",
  "condition",
  "description",
  "image_url",
  "seller_name",
  "created_at"
];

const OPTIONAL_LISTING_CARD_COLUMN_LIST = [
  "listing_number",
  "original_language",
  "translations",
  "vehicle_subtype",
  "part_number",
  "image_urls",
  "company_name",
  "seller_avatar_url",
  "seller_email",
  "view_count",
  "is_sold",
  "is_hidden",
  "sold_price",
  "sold_at"
];

const LISTING_CARD_COLUMN_LIST = [
  ...BASE_LISTING_CARD_COLUMN_LIST,
  ...OPTIONAL_LISTING_CARD_COLUMN_LIST
];

const LISTING_CARD_SELECT =
  LISTING_CARD_COLUMN_LIST.join(",");

const BASE_LISTING_CARD_SELECT =
  BASE_LISTING_CARD_COLUMN_LIST.join(",");

const escapeIlikeTerm = (value: string) =>
  value.trim().replace(/[%_]/g, "");

export async function getListings(options: GetListingsOptions = {}) {

  if (!supabase) {

    return {
      data: [],
      error: null
    };

  }

  try {

    const publicListingsQuery = (columns: string[], includeCount = false) =>
      supabase
        .from("listings")
        .select(columns.join(","), includeCount ? { count: "exact" } : undefined)
        .eq("is_sold", false)
        .eq("is_hidden", false);

    const fetchListingsChunk = (columns: string[], from: number, to: number) =>
      publicListingsQuery(columns)
        .order("created_at", { ascending: false })
        .range(from, to)
        .returns<Listing[]>();

    const fetchListingsRange = (
      columns: string[],
      from: number,
      to: number,
      includeCount: boolean
    ) =>
      publicListingsQuery(columns, includeCount)
        .order("created_at", { ascending: false })
        .range(from, to)
        .returns<Listing[]>();

    const fetchAllListings = async (columns: string[]) => {
      const allListings: Listing[] = [];

      for (let from = 0; ; from += LISTINGS_FETCH_CHUNK_SIZE) {
        const to = from + LISTINGS_FETCH_CHUNK_SIZE - 1;
        const { data: chunk, error } = await fetchListingsChunk(columns, from, to);

        if (error) {
          return { data: allListings, error };
        }

        if (!chunk || chunk.length === 0) {
          break;
        }

        allListings.push(...chunk);
        options.onChunk?.([...allListings]);

        if (chunk.length < LISTINGS_FETCH_CHUNK_SIZE) {
          break;
        }
      }

      return { data: allListings, error: null };
    };

    const includeOptionalFields =
      options.includeOptionalFields ?? true;

    const selectedColumns =
      includeOptionalFields
        ? LISTING_CARD_COLUMN_LIST
        : BASE_LISTING_CARD_COLUMN_LIST;

    if (typeof options.limit === "number") {
      const offset = Math.max(0, options.offset ?? 0);
      const limit = Math.max(1, options.limit);
      let { data, error, count } = await fetchListingsRange(
        selectedColumns,
        offset,
        offset + limit - 1,
        Boolean(options.includeCount)
      );

      if (includeOptionalFields && error && hasMissingListingColumns(error)) {
        ({ data, error, count } = await fetchListingsRange(
          BASE_LISTING_CARD_COLUMN_LIST,
          offset,
          offset + limit - 1,
          Boolean(options.includeCount)
        ));
      }

      return {
        data: (data ?? []).filter((listing) => !listing.is_sold && !listing.is_hidden),
        error,
        count: count ?? null
      };
    }

    let { data, error } = await fetchAllListings(
      selectedColumns
    );

    if (includeOptionalFields && error && hasMissingListingColumns(error)) {
      ({ data, error } = await fetchAllListings(BASE_LISTING_CARD_COLUMN_LIST));
    }

    if (error || !data) {
      return {
        data: (data ?? []).filter((listing) => !listing.is_sold && !listing.is_hidden),
        error
      };
    }

    data = data.filter((listing) => !listing.is_sold && !listing.is_hidden);

    if (!options.enrichSellerProfiles) {
      return { data, error: null };
    }

    // Batch-fetch profile data for sellers missing avatar/company info
    const missingIds = [
      ...new Set(
        data
          .filter((l) => l.seller_id && (!l.seller_avatar_url || !l.company_name))
          .map((l) => l.seller_id as string)
      )
    ];

    if (missingIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, avatar_url, company_name, account_type")
        .in("id", missingIds);

      if (profiles && profiles.length > 0) {
        const profileMap = Object.fromEntries(
          profiles.map((p: { id: string; avatar_url?: string | null; company_name?: string | null; account_type?: string | null }) => [p.id, p])
        );
        for (const listing of data) {
          const p = listing.seller_id ? profileMap[listing.seller_id] : null;
          if (!p) continue;
          if (!listing.seller_avatar_url && p.avatar_url) listing.seller_avatar_url = p.avatar_url;
          if (!listing.company_name && p.account_type === "company" && p.company_name) listing.company_name = p.company_name;
        }
      }
    }

    return { data, error: null };

  } catch (error) {

    return {
      data: [],
      error
    };

  }

}

export async function getListingsByIds(listingIds: string[]) {
  if (!supabase) {
    return {
      data: [] as Listing[],
      error: null
    };
  }

  const ids = [
    ...new Set(
      listingIds
        .map((id) => id.trim())
        .filter(Boolean)
    )
  ];

  if (ids.length === 0) {
    return {
      data: [] as Listing[],
      error: null
    };
  }

  try {
    const fetchListingsByIds = (columns: string[]) =>
      supabase
        .from("listings")
        .select(columns.join(","))
        .in("id", ids)
        .returns<Listing[]>();

    let { data, error } =
      await fetchListingsByIds(LISTING_CARD_COLUMN_LIST);

    if (error && hasMissingListingColumns(error)) {
      ({ data, error } =
        await fetchListingsByIds(BASE_LISTING_CARD_COLUMN_LIST));
    }

    const orderById =
      new Map(ids.map((id, index) => [id, index]));

    return {
      data: (data ?? []).sort(
        (a, b) =>
          (orderById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (orderById.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      ),
      error
    };
  } catch (error) {
    return {
      data: [] as Listing[],
      error
    };
  }
}

export async function getListingById(
  listingId: string
) {

  if (!supabase) {

    return {
      data: null,
      error: null
    };

  }

  try {
    const resolvedListingId =
      await resolveListingId(listingId);

    const result = await supabase
      .from("listings")
      .select("*")
      .eq("id", resolvedListingId)
      .maybeSingle<Listing>();

    if (!result.data?.seller_id) {
      return result;
    }

    const { data: seller } =
      await supabase
        .from("profiles")
        .select("phone,first_name,last_name,full_name,name,avatar_url,company_name,account_type,phone_verified_at")
        .eq("id", result.data.seller_id)
        .maybeSingle<Pick<UserProfile, "phone" | "first_name" | "last_name" | "full_name" | "name" | "avatar_url" | "company_name" | "account_type" | "phone_verified_at">>();

    if (seller) {
      const sellerName =
        (
          seller.full_name ||
          seller.name ||
          `${seller.first_name ?? ""} ${
            seller.last_name ?? ""
          }`
        )
          .replace(/\s+/g, " ")
          .trim();

      const listingSellerName =
        result.data.seller_name?.replace(/\s+/g, " ").trim();

      result.data = {
        ...result.data,
        seller_name:      listingSellerName || sellerName || result.data.seller_name,
        seller_phone:     seller.phone || result.data.seller_phone || null,
        seller_avatar_url: result.data.seller_avatar_url || seller.avatar_url || null,
        company_name:     result.data.company_name || (seller.account_type === "company" ? seller.company_name ?? null : null),
        seller_phone_verified: Boolean(seller.phone_verified_at),
      };
    }

    return result;

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function incrementListingView(
  listingId: string
) {

  if (!supabase) {

    return {
      error: null
    };

  }

  try {

    const { error } =
      await supabase.rpc(
        "increment_listing_view",
        {
          listing_id_input: listingId
        }
      );

    return {
      error
    };

  } catch (error) {

    return {
      error
    };

  }

}

export async function getListingDisplayNumber(
  createdAt?: string | null,
  listingNumber?: number | null
) {
  if (listingNumber) {
    return listingNumber;
  }

  if (!supabase || !createdAt) {
    return null;
  }

  try {
    const { count, error } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .lte("created_at", createdAt);

    if (error) {
      return null;
    }

    return count === null ? null : count;
  } catch {
    return null;
  }
}

async function resolveListingId(listingIdOrDisplayId: string) {
  const value = listingIdOrDisplayId.trim();

  if (!/^\d+$/.test(value)) {
    return value;
  }

  const displayNumber = Number(value);

  if (!Number.isInteger(displayNumber) || displayNumber < 1) {
    return value;
  }

  const lookup =
    await supabase!
      .from("listings")
      .select("id")
      .eq("listing_number", displayNumber)
      .maybeSingle<{ id: string }>();

  if (!lookup.error && lookup.data?.id) {
    return lookup.data.id;
  }

  const rank =
    displayNumber >= 100001
      ? displayNumber - 100000
      : displayNumber;

  const fallback =
    await supabase!
      .from("listings")
      .select("id")
      .order("created_at", { ascending: true })
      .range(rank - 1, rank - 1)
      .returns<Array<{ id: string }>>();

  if (fallback.error || !fallback.data) {
    return value;
  }

  return fallback.data[0]?.id ?? value;
}

export type MarketplaceStats = {
  activeListings: number;
  allTimeListings: number;
  tradedTotal: number;
};

export async function getMarketplaceStats(): Promise<{
  data: MarketplaceStats | null;
  error: unknown;
}> {
  if (!supabase) return { data: null, error: null };

  try {
    const [
      activeResult,
      soldCountResult,
      soldValueResult
    ] = await Promise.all([
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("is_sold", false)
        .eq("is_hidden", false),
      supabase
        .from("sold_listings")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("sold_listings")
        .select("sold_price")
    ]);

    const firstError =
      activeResult.error ??
      soldCountResult.error ??
      soldValueResult.error;

    if (firstError) return { data: null, error: firstError };

    const tradedTotal = (soldValueResult.data ?? []).reduce(
      (sum, listing) => sum + (Number(listing.sold_price) || 0),
      0
    );

    const activeListings = activeResult.count ?? 0;
    return {
      data: {
        activeListings,
        allTimeListings: activeListings + (soldCountResult.count ?? 0),
        tradedTotal
      },
      error: null
    };
  } catch (error) {
    return { data: null, error };
  }
}

export async function getListingsBySeller(
  sellerId: string
) {

  if (!supabase) {

    return {
      data: [],
      error: null
    };

  }

  try {

    return await supabase
      .from("listings")
      .select("*")
      .eq("seller_id", sellerId)
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .returns<Listing[]>();

  } catch (error) {

    return {
      data: [],
      error
    };

  }

}

export async function getPublicListingsBySeller(
  sellerId: string
) {

  if (!supabase) {

    return {
      data: [],
      error: null
    };

  }

  try {
    const publicListingSelect = [
      "id",
      "listing_number",
      "seller_id",
      "title",
      "original_language",
      "translations",
      "listing_mode",
      "price",
      "vehicle_type",
      "vehicle_subtype",
      "brand",
      "model",
      "year",
      "engine_cc",
      "engine_model",
      "category",
      "subcategory",
      "part_number",
      "location",
      "condition",
      "description",
      "image_url",
      "image_urls",
      "seller_name",
      "created_at"
    ].join(",");

    const result = await supabase
      .from("listings")
      .select(publicListingSelect)
      .eq("seller_id", sellerId)
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .returns<Listing[]>();

    if (!hasMissingListingColumns(result.error)) {
      return result;
    }

    return await supabase
      .from("listings")
      .select(BASE_LISTING_CARD_SELECT)
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false })
      .returns<Listing[]>();

  } catch (error) {

    return {
      data: [],
      error
    };

  }

}

export async function setListingHidden(
  listingId: string,
  hidden: boolean
) {
  if (!supabase) return { data: null, error: null };
  try {
    const { data, error } = await supabase.rpc("set_listing_hidden", {
      p_listing_id: listingId,
      p_hidden: hidden
    });
    if (error && isMissingDatabaseRoutine(error)) {
      const result = await supabase
        .from("listings")
        .update({ is_hidden: hidden })
        .eq("id", listingId)
        .select("is_hidden")
        .maybeSingle<{ is_hidden: boolean }>();
      return { data: result.data?.is_hidden ?? null, error: result.error };
    }
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export type ListingMessageCount = {
  listing_id: string;
  conversation_count: number;
  message_count: number;
  unread_count: number;
};

export async function getMyListingMessageCounts(): Promise<{
  data: ListingMessageCount[];
  error: unknown;
}> {
  if (!supabase) return { data: [], error: null };
  try {
    const { data, error } = await supabase.rpc("get_my_listing_message_counts");
    return { data: (data as ListingMessageCount[] | null) ?? [], error };
  } catch (error) {
    return { data: [], error };
  }
}

export async function updateListing(
  listingId: string,
  listing: ListingUpdateInput
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    const {
      data: { user }
    } =
      await supabase.auth.getUser();

    if (!user) {

      return {
        data: null,
        error: new Error(
          "Et ole kirjautunut."
        )
      };

    }

    const banStatus =
      await getUserBanStatus(user.id);
    if (banStatus.isBanned) {
      return {
        data: null,
        error: new Error("Tilisi on bannattu, et voi muokata ilmoituksia.")
      };
    }

    const translatedListing = withInitialListingTranslations(listing);

    let result = await supabase
      .from("listings")
      .update(translatedListing)
      .eq("id", listingId)
      .eq("seller_id", user.id)
      .select()
      .single<Listing>();

    if (hasMissingListingColumns(result.error)) {
      const fallbackListing = { ...translatedListing };
      delete fallbackListing.original_language;
      delete fallbackListing.translations;
      delete fallbackListing.part_number;

      result = await supabase
        .from("listings")
        .update(fallbackListing)
        .eq("id", listingId)
        .eq("seller_id", user.id)
        .select()
        .single<Listing>();
    }

    return result;

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function deleteListing(
  listingId: string
) {

  if (!supabase) {

    return {
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    const {
      data: { user }
    } =
      await supabase.auth.getUser();

    if (!user) {

      return {
        error: new Error(
          "Et ole kirjautunut."
        )
      };

    }

    const listingResult =
      await supabase
        .from("listings")
        .select("image_url,image_urls")
        .eq("id", listingId)
        .eq("seller_id", user.id)
        .maybeSingle<ListingImageFields>();

    let listingImages =
      listingResult.data;

    if (hasMissingListingColumns(listingResult.error)) {
      const fallbackResult =
        await supabase
          .from("listings")
          .select("image_url")
          .eq("id", listingId)
          .eq("seller_id", user.id)
          .maybeSingle<Pick<Listing, "image_url">>();

      if (fallbackResult.error) {
        return { error: fallbackResult.error };
      }

      listingImages =
        fallbackResult.data
          ? {
              image_url: fallbackResult.data.image_url,
              image_urls: []
            }
          : null;
    } else if (listingResult.error) {
      return { error: listingResult.error };
    }

    const deleteResult =
      await supabase
      .from("listings")
      .delete()
      .eq("id", listingId)
      .eq("seller_id", user.id)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (deleteResult.error) {
      return deleteResult;
    }

    if (!deleteResult.data?.id) {
      return {
        error: new Error("Ilmoitusta ei poistettu. Tarkista tietokannan poistopolitiikat.")
      };
    }

    const imageCleanupError =
      await deleteListingStorageImages(listingImages);

    return {
      ...deleteResult,
      imageCleanupError
    };

  } catch (error) {

    return {
      error
    };

  }

}

export async function markListingAsSold(
  listingId: string,
  soldPrice: number
) {
  if (!supabase) return { error: new Error("Supabase ei ole konfiguroitu.") };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Et ole kirjautunut.") };
    return await supabase
      .from("listings")
      .update({ is_sold: true, sold_price: soldPrice, sold_at: new Date().toISOString() })
      .eq("id", listingId)
      .eq("seller_id", user.id);
  } catch (error) {
    return { error };
  }
}

export async function recordSoldListing(
  listing: Listing,
  soldPrice: number,
  buyerId?: string | null
) {
  if (!supabase) {
    return {
      data: null,
      error: new Error("Supabase ei ole konfiguroitu.")
    };
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: new Error("Et ole kirjautunut.")
      };
    }

    const soldAt = new Date().toISOString();
    const soldTitle =
      listing.title?.trim() ||
      listing.subcategory?.trim() ||
      listing.category?.trim() ||
      "Poistettu ilmoitus";

    // Store only the minimum required data. Keep a generic non-empty title so
    // older databases where sold_listings.title is still NOT NULL can accept it.
    const soldPayload = {
      listing_id: listing.id,
      seller_id: user.id,
      buyer_id: buyerId ?? null,
      title: soldTitle,
      price: listing.price,
      sold_price: soldPrice,
      vehicle_type: listing.vehicle_type ?? null,
      vehicle_subtype: listing.vehicle_subtype ?? null,
      brand: listing.brand ?? null,
      model: listing.model ?? null,
      year: listing.year ?? null,
      engine_cc: listing.engine_cc ?? null,
      engine_model: listing.engine_model ?? null,
      category: listing.category ?? null,
      subcategory: listing.subcategory ?? null,
      part_number: listing.part_number ?? null,
      condition: listing.condition ?? null,
      location: listing.location ?? null,
      image_url: null,
      listing_mode: listing.listing_mode ?? "single",
      sold_at: soldAt
    };

    let insertResult = await supabase
      .from("sold_listings")
      .insert(soldPayload)
      .select()
      .single<SoldListing>();

    if (hasMissingListingColumns(insertResult.error)) {
      const optionalSoldColumns = new Set([
        "listing_mode",
        "vehicle_subtype",
        "engine_cc",
        "engine_model",
        "part_number",
        "condition",
        "location"
      ]);
      const fallbackPayload = Object.fromEntries(
        Object.entries(soldPayload).filter(([key]) => !optionalSoldColumns.has(key))
      );
      insertResult = await supabase
        .from("sold_listings")
        .insert(fallbackPayload)
        .select()
        .single<SoldListing>();
    }

    if (!insertResult.error) {
      return { data: insertResult.data, error: null };
    }

    // Duplicate listing_id (unique violation 23505) — fetch existing record
    if (insertResult.error.code === "23505") {
      const existing = await supabase
        .from("sold_listings")
        .select("*")
        .eq("listing_id", listing.id)
        .single<SoldListing>();
      return { data: existing.data, error: existing.error };
    }

    return { data: null, error: insertResult.error };
  } catch (error) {
    return {
      data: null,
      error
    };
  }
}

export async function deleteSoldListing(soldOrListingId: string) {
  if (!supabase) {
    return {
      error: new Error("Supabase ei ole konfiguroitu.")
    };
  }

  try {
    // Try deleting by sold_listings.id first, then by listing_id – the
    // management page may pass either.
    const byId = await supabase
      .from("sold_listings")
      .delete()
      .eq("id", soldOrListingId);

    if (!byId.error && (byId.count ?? 1) > 0) {
      return { error: null };
    }

    const byListing = await supabase
      .from("sold_listings")
      .delete()
      .eq("listing_id", soldOrListingId);

    return { error: byListing.error ?? null };
  } catch (error) {
    return { error };
  }
}

export async function getSoldListingsBySeller(sellerId: string) {
  if (!supabase) return { data: [] as SoldListing[], error: null };
  try {
    const result = await supabase
      .from("sold_listings")
      .select("*")
      .eq("seller_id", sellerId)
      .order("sold_at", { ascending: false })
      .returns<SoldListing[]>();

    if (!result.error) return result;

    const fallback = await supabase
      .from("listings")
      .select("*")
      .eq("seller_id", sellerId)
      .eq("is_sold", true)
      .order("sold_at", { ascending: false })
      .returns<Listing[]>();

    return {
      data: (fallback.data ?? []).map((listing) => ({
        id: listing.id,
        listing_id: listing.id,
        seller_id: listing.seller_id ?? sellerId,
        title: listing.title,
        price: listing.price,
        sold_price: Number(listing.sold_price) || 0,
        vehicle_type: listing.vehicle_type,
        brand: listing.brand,
        model: listing.model,
        year: listing.year,
        category: listing.category,
        subcategory: listing.subcategory,
        image_url: listing.image_url,
        sold_at: listing.sold_at ?? listing.created_at,
        created_at: listing.created_at
      })),
      error: fallback.error
    };
  } catch (error) {
    return { data: [] as SoldListing[], error };
  }
}

export async function getSavedListingIds(): Promise<{
  data: string[];
  error: unknown;
}> {
  if (!supabase) {
    return {
      data: [],
      error: null
    };
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: [],
        error: null
      };
    }

    const { data, error } =
      await supabase
        .from("saved_listings")
        .select("listing_id")
        .eq("user_id", user.id);

    return {
      data: data?.map((item) => item.listing_id as string) ?? [],
      error
    };
  } catch (error) {
    return {
      data: [],
      error
    };
  }
}

export async function saveListing(
  listingId: string
) {
  if (!supabase) {
    return {
      error: null
    };
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: null
      };
    }

    const { error } =
      await supabase
        .from("saved_listings")
        .upsert(
          {
            user_id: user.id,
            listing_id: listingId
          },
          {
            onConflict: "user_id,listing_id"
          }
        );

    return {
      error
    };
  } catch (error) {
    return {
      error
    };
  }
}

export async function unsaveListing(
  listingId: string
) {
  if (!supabase) {
    return {
      error: null
    };
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: null
      };
    }

    const { error } =
      await supabase
        .from("saved_listings")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", listingId);

    return {
      error
    };
  } catch (error) {
    return {
      error
    };
  }
}

/* =========================
   PROFILE FOLLOWS
========================= */

const EMPTY_PROFILE_FOLLOW_STATS: ProfileFollowStats = {
  follower_count: 0,
  following_count: 0,
  is_following: false
};

async function getCurrentAccessToken() {
  if (!supabase) return null;

  const {
    data: { session }
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

async function requestProfileFollowApi<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T | null; error: unknown }> {
  try {
    const token = await getCurrentAccessToken();
    const headers = new Headers(init?.headers);

    if (token) headers.set("authorization", `Bearer ${token}`);
    if (init?.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: new Error(payload?.error ?? "Seurantapyyntö epäonnistui.")
      };
    }

    return {
      data: payload as T,
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error
    };
  }
}

export async function getProfileFollowStats(
  profileId: string
): Promise<{ data: ProfileFollowStats; error: unknown }> {
  const apiResult = await requestProfileFollowApi<ProfileFollowStats>(
    `/api/profile-follows?profileId=${encodeURIComponent(profileId)}`
  );

  if (apiResult.data) {
    return {
      data: apiResult.data,
      error: null
    };
  }

  if (!supabase) return { data: EMPTY_PROFILE_FOLLOW_STATS, error: apiResult.error };

  try {
    const { data, error } = await supabase.rpc(
      "get_profile_follow_stats",
      { target_profile_id: profileId }
    );
    const row = Array.isArray(data) ? data[0] : data;

    return {
      data: {
        follower_count: Number(row?.follower_count) || 0,
        following_count: Number(row?.following_count) || 0,
        is_following: Boolean(row?.is_following)
      },
      error
    };
  } catch (error) {
    return {
      data: EMPTY_PROFILE_FOLLOW_STATS,
      error
    };
  }
}

export async function getMyProfileFollows(): Promise<{
  data: ProfileFollowListItem[];
  error: unknown;
}> {
  if (!supabase) {
    return {
      data: [],
      error: null
    };
  }

  try {
    const apiResult = await requestProfileFollowApi<ProfileFollowListItem[]>(
      "/api/profile-follows?scope=mine"
    );

    if (apiResult.data) {
      return {
        data: apiResult.data,
        error: null
      };
    }

    const { data, error } = await supabase.rpc("get_my_profile_follows");
    return {
      data: (data ?? []) as ProfileFollowListItem[],
      error: error ?? apiResult.error
    };
  } catch (error) {
    return {
      data: [],
      error
    };
  }
}

export async function followProfile(
  profileId: string
) {
  if (!supabase) {
    return {
      error: new Error("Supabase ei ole konfiguroitu.")
    };
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: new Error("Kirjaudu sisään seurataksesi profiileja.")
      };
    }

    if (user.id === profileId) {
      return {
        error: new Error("Et voi seurata omaa profiiliasi.")
      };
    }

    const apiResult = await requestProfileFollowApi<{ ok: boolean }>("/api/profile-follows", {
      method: "POST",
      body: JSON.stringify({ profileId })
    });

    return {
      error: apiResult.error
    };
  } catch (error) {
    return {
      error
    };
  }
}

export async function unfollowProfile(
  profileId: string
) {
  if (!supabase) {
    return {
      error: new Error("Supabase ei ole konfiguroitu.")
    };
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: new Error("Kirjaudu sisään hallitaksesi seurattuja.")
      };
    }

    const apiResult = await requestProfileFollowApi<{ ok: boolean }>("/api/profile-follows", {
      method: "DELETE",
      body: JSON.stringify({ profileId })
    });

    return {
      error: apiResult.error
    };
  } catch (error) {
    return {
      error
    };
  }
}

async function getUserBanStatus(userId: string) {
  if (!supabase) return { isBanned: false };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", userId)
      .maybeSingle<{ is_banned: boolean | null }>();

    if (error) return { isBanned: false };
    return { isBanned: Boolean(data?.is_banned) };
  } catch {
    return { isBanned: false };
  }
}

export async function createListing(
  listing: ListingInput
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    const {
      data: { user }
    } =
      await supabase.auth.getUser();

    if (!user) {

      return {
        data: null,
        error: new Error(
          "Et ole kirjautunut."
        )
      };

    }

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("phone,account_type,first_name,last_name,full_name,name,company_name,avatar_url,city,is_banned")
        .eq("id", user.id)
        .maybeSingle<Pick<
          UserProfile,
          | "phone"
          | "account_type"
          | "first_name"
          | "last_name"
          | "full_name"
          | "name"
          | "company_name"
          | "avatar_url"
          | "city"
        > & { is_banned?: boolean | null }>();

    if (profile?.is_banned) {
      return {
        data: null,
        error: new Error("Tilisi on bannattu, et voi luoda ilmoituksia.")
      };
    }

    const profileName =
      profile?.account_type === "company"
        ? profile.company_name
        : profile?.full_name ||
          profile?.name ||
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

    const listingPayload = withInitialListingTranslations({
      ...listing,
      location: listing.location?.trim() || profile?.city?.trim() || "Ei maaritetty",
      seller_name: listing.seller_name || profileName?.trim() || user.email || "Myyja",
      seller_email: listing.seller_email || user.email || "",
      seller_phone: listing.seller_phone ?? profile?.phone ?? null,
      seller_avatar_url: listing.seller_avatar_url ?? profile?.avatar_url ?? null,
      company_name:
        listing.company_name ??
        (profile?.account_type === "company" ? profile.company_name ?? null : null)
    });
    delete listingPayload.user_id;

    let result = await supabase
      .from("listings")
      .insert({

        ...listingPayload,

        seller_id: user.id

      })
      .select()
      .single<Listing>();

    if (hasMissingListingColumns(result.error)) {
      const fallbackPayload = { ...listingPayload };
      delete fallbackPayload.original_language;
      delete fallbackPayload.translations;
      delete fallbackPayload.part_number;
      delete fallbackPayload.listing_mode;
      delete fallbackPayload.vehicle_subtype;

      result = await supabase
        .from("listings")
        .insert({
          ...fallbackPayload,
          seller_id: user.id
        })
        .select()
        .single<Listing>();
    }

    if (result.data?.id) {
      void notifySearchAlertsForListing(result.data.id);
    }

    return result;

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

function hasMissingListingColumns(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  return (
    message.includes("Could not find") ||
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("original_language") ||
    message.includes("translations") ||
    message.includes("part_number")
  );
}

function isMissingDatabaseRoutine(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const lowerMessage = message.toLowerCase();

  return (
    code === "42883" ||
    code === "PGRST202" ||
    lowerMessage.includes("could not find the function") ||
    (lowerMessage.includes("function") && lowerMessage.includes("does not exist"))
  );
}

function withInitialListingTranslations<T extends {
  title: string;
  description: string;
  original_language?: string | null;
  translations?: ListingTranslations | null;
}>(listing: T): T {
  const sourceLanguage: ListingLocale = isListingLocale(listing.original_language)
    ? listing.original_language
    : "fi";

  return {
    ...listing,
    original_language: sourceLanguage,
    translations:
      listing.translations ??
      buildOriginalTranslations(listing, sourceLanguage)
  };
}

export async function ensureListingTranslations(listing: Listing) {
  if (hasGeneratedTranslations(listing)) {
    return {
      data: listing,
      error: null
    };
  }

  try {
    const sourceLanguage: ListingLocale = isListingLocale(listing.original_language)
      ? listing.original_language
      : "fi";

    const response = await fetch("/api/translate-listing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        listingId: listing.id,
        title: listing.title,
        description: listing.description,
        sourceLanguage
      })
    });

    if (!response.ok) {
      return {
        data: listing,
        error: null
      };
    }

    const data = (await response.json()) as {
      translations?: ListingTranslations;
      warning?: string;
      saved?: boolean;
    };

    if (data.warning || !data.translations) {
      return {
        data: listing,
        error: null
      };
    }

    return {
      data: {
        ...listing,
        original_language: sourceLanguage,
        translations: data.translations
      },
      error: null
    };
  } catch (error) {
    return {
      data: listing,
      error
    };
  }
}

function hasCompleteTranslations(
  translations: ListingTranslations | null | undefined,
  sourceLanguage: ListingLocale
) {
  return listingLocales.every((locale) => {
    const item = translations?.[locale];
    return Boolean(item?.title && (item.description || locale === sourceLanguage));
  });
}

function hasGeneratedTranslations<T extends {
  title: string;
  description?: string | null;
  original_language?: string | null;
  translations?: ListingTranslations | null;
}>(listing: T) {
  const sourceLanguage: ListingLocale = isListingLocale(listing.original_language)
    ? listing.original_language
    : "fi";

  if (!hasCompleteTranslations(listing.translations, sourceLanguage)) {
    return false;
  }

  return listingLocales.some((locale) => {
    if (locale === sourceLanguage) return false;
    const item = listing.translations?.[locale];
    return Boolean(
      item &&
      (
        (item.title ?? "").trim() !== listing.title.trim() ||
        (item.description ?? "").trim() !== (listing.description ?? "").trim()
      )
    );
  });
}

function buildOriginalTranslations(
  listing: Pick<Listing, "title" | "description">,
  sourceLanguage: ListingLocale
): ListingTranslations {
  const translations = Object.fromEntries(
    listingLocales.map((locale) => [
      locale,
      {
        title: listing.title,
        description: listing.description
      }
    ])
  ) as ListingTranslations;

  translations[sourceLanguage] = {
    title: listing.title,
    description: listing.description
  };

  return translations;
}

export async function getListingSlotUsage(userId: string): Promise<{
  data: number;
  error: unknown;
}> {
  if (!supabase || !userId) return { data: 0, error: null };

  try {
    const { count, error } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", userId);

    return { data: count ?? 0, error };
  } catch (error) {
    return { data: 0, error };
  }
}

export async function notifySearchAlertsForListing(
  listingId: string
) {
  try {
    const response = await fetch("/api/search-alerts/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ listingId })
    });

    if (!response.ok) {
      const message = await response.text();
      console.warn("Search alert notification failed:", message);
    }
  } catch (error) {
    console.warn("Search alert notification failed:", error);
  }
}

/* =========================
   AUTH
========================= */

export async function signUpWithEmail(
  email: string,
  password: string,
  metadata?: Record<string, string>,
  emailRedirectTo?: string
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    return await supabase.auth
      .signUp({

        email,

        password,

        options: {
          ...(metadata ? { data: metadata } : {}),
          ...(emailRedirectTo ? { emailRedirectTo } : {})
        }

      });

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function signInWithEmail(
  email: string,
  password: string
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    return await supabase.auth
      .signInWithPassword({

        email,
        password

      });

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function signInWithGoogle(
  intent: "login" | "register" = "login"
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    return await supabase.auth
      .signInWithOAuth({

        provider: "google",

        options: {

          redirectTo:
            typeof window !==
            "undefined"
              ? `${window.location.origin}/auth?oauth=${intent}`
              : undefined

        }

      });

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function resetPassword(
  email: string
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    return await supabase.auth
      .resetPasswordForEmail(
        email,
        {
          redirectTo:
            typeof window !==
            "undefined"
              ? `${window.location.origin}/auth`
              : undefined
        }
      );

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function updatePassword(
  password: string
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    return await supabase.auth
      .updateUser({
        password
      });

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function signOut() {

  if (!supabase) {

    return {
      error: null
    };

  }

  try {

    const { data } =
      await supabase.auth.getSession();

    const userId =
      data.session?.user.id;

    if (userId) {
      void supabase
        .from("profiles")
        .update({
          online: false,
          last_seen:
            new Date().toISOString()
        })
        .eq("id", userId)
        .then(() => undefined);
    }

    return await supabase.auth.signOut({
      scope: "local"
    });

  } catch (error) {

    return {
      error
    };

  }

}

export async function getCurrentUserIsAdmin() {

  if (!supabase) {

    return false;

  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {

    return false;

  }

  const { data, error } =
    await supabase.rpc("is_admin");

  if (error) {

    return false;

  }

  return Boolean(data);

}

/* =========================
   ADMIN HELPERS
========================= */

export type AdminProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  phone_verification_count: number;
  is_banned: boolean;
  banned_reason: string | null;
  points: number;
  created_at: string | null;
  last_ip: string | null;
  last_seen_ip: string | null;
  ip_count: number;
  extra_phone_verifications: number;
  extra_listing_slots: number;
  is_admin?: boolean;
  account_type?: string | null;
  company_name?: string | null;
  business_id?: string | null;
  company_verified_at?: string | null;
  company_verification_requested_at?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  birth_date?: string | null;
  public_id?: string | null;
  username?: string | null;
  bio?: string | null;
  public_address?: string | null;
  billing_email?: string | null;
  company_website?: string | null;
  updated_at?: string | null;
};

export type AdminUserIp = {
  ip: string;
  last_seen: string;
  hits: number;
};

export async function verifyAdminPin(pin: string): Promise<{ data: boolean; error: unknown }> {
  if (!supabase) return { data: false, error: "no-supabase" };
  const { data, error } = await supabase.rpc("verify_admin_pin", { candidate_pin: pin });
  return { data: Boolean(data), error };
}

export async function setAdminPin(newPin: string): Promise<{ error: unknown }> {
  if (!supabase) return { error: "no-supabase" };
  const { error } = await supabase.rpc("set_admin_pin", { new_pin: newPin });
  return { error };
}

export async function adminAdjustPhoneVerifications(targetUserId: string, delta: number) {
  if (!supabase) return { data: null, error: "no-supabase" };
  const { data, error } = await supabase.rpc("admin_adjust_phone_verifications", {
    target_user_id: targetUserId,
    delta
  });
  return { data: data as number | null, error };
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  if (!supabase || !userId) return false;
  try {
    const { data } = await supabase.rpc("is_admin", { check_user_id: userId });
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function getProfileExtraSlots(userId: string): Promise<number> {
  if (!supabase || !userId) return 0;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("extra_listing_slots")
      .eq("id", userId)
      .maybeSingle<{ extra_listing_slots: number | null }>();
    return data?.extra_listing_slots ?? 0;
  } catch {
    return 0;
  }
}

export async function adminAdjustListingSlots(targetUserId: string, delta: number) {
  if (!supabase) return { data: null, error: "no-supabase" };
  const { data, error } = await supabase.rpc("admin_adjust_listing_slots", {
    target_user_id: targetUserId,
    delta
  });
  return { data: data as number | null, error };
}

export async function adminUserIps(targetUserId: string): Promise<{ data: AdminUserIp[]; error: unknown }> {
  if (!supabase) return { data: [], error: "no-supabase" };
  const { data, error } = await supabase.rpc("admin_user_ips", {
    target_user_id: targetUserId
  });
  return { data: (data ?? []) as AdminUserIp[], error };
}

export type AdminOverviewStats = {
  profiles_total: number;
  profiles_today: number;
  profiles_7d: number;
  profiles_month: number;
  profiles_prev_month: number;

  listings_total: number;
  listings_today: number;
  listings_7d: number;
  listings_month: number;
  listings_prev_month: number;

  sold_total: number;
  sold_today: number;
  sold_7d: number;
  sold_month: number;
  sold_prev_month: number;

  deleted_total: number;
  deleted_today: number;
  deleted_7d: number;
  deleted_month: number;

  visits_total: number;
  visits_today: number;
  visits_7d: number;
  visits_month: number;

  unique_visitors_total: number;
  unique_visitors_today: number;
  unique_visitors_7d: number;
  unique_visitors_month: number;

  revenue_total: number;
  revenue_today: number;
  revenue_7d: number;
  revenue_month: number;
  revenue_prev_month: number;
};

export type AdminBannedIp = {
  ip: string;
  reason: string | null;
  banned_at: string;
  banned_by: string | null;
};

export async function adminOverviewStats(): Promise<{ data: AdminOverviewStats | null; error: unknown }> {
  if (!supabase) return { data: null, error: "no-supabase" };
  const { data, error } = await supabase.rpc("admin_overview_stats");
  return { data: (data ?? null) as AdminOverviewStats | null, error };
}

export async function adminListProfiles(params: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: AdminProfileRow[]; error: unknown }> {
  if (!supabase) return { data: [], error: "no-supabase" };
  const apiResult = await adminActionRequest<{ data: AdminProfileRow[] }>("list-profiles", {
    query: params.query ?? "",
    limit: params.limit ?? 50,
    offset: params.offset ?? 0
  });
  if (!apiResult.error && apiResult.data?.data) {
    return { data: apiResult.data.data, error: null };
  }

  const { data, error } = await supabase.rpc("admin_list_profiles", {
    search_query: params.query ?? "",
    page_limit: params.limit ?? 50,
    page_offset: params.offset ?? 0
  });
  return { data: (data ?? []) as AdminProfileRow[], error };
}

export async function adminForceVerifyPhone(targetUserId: string, newPhone?: string) {
  if (!supabase) return { error: "no-supabase" };
  const { error } = await supabase.rpc("admin_force_verify_phone", {
    target_user_id: targetUserId,
    new_phone: newPhone ?? null
  });
  return { error };
}

export async function adminSetPoints(targetUserId: string, newPoints: number) {
  if (!supabase) return { data: null, error: "no-supabase" };
  const { data, error } = await supabase.rpc("admin_set_points", {
    target_user_id: targetUserId,
    new_points: newPoints
  });
  return { data: data as number | null, error };
}

export async function adminAddPoints(targetUserId: string, delta: number) {
  if (!supabase) return { data: null, error: "no-supabase" };
  const { data, error } = await supabase.rpc("admin_add_points", {
    target_user_id: targetUserId,
    delta
  });
  return { data: data as number | null, error };
}

export async function adminBanUser(targetUserId: string, reason?: string) {
  if (!supabase) return { error: "no-supabase" };
  const { error } = await supabase.rpc("admin_ban_user", {
    target_user_id: targetUserId,
    reason: reason ?? null
  });
  if (!error) return { error };
  return adminActionRequest("ban-user", { userId: targetUserId, reason: reason ?? null });
}

export async function adminUnbanUser(targetUserId: string) {
  if (!supabase) return { error: "no-supabase" };
  const { error } = await supabase.rpc("admin_unban_user", {
    target_user_id: targetUserId
  });
  if (!error) return { error };
  return adminActionRequest("unban-user", { userId: targetUserId });
}

export async function adminBanIp(ip: string, reason?: string) {
  if (!supabase) return { error: "no-supabase" };
  const { error } = await supabase.rpc("admin_ban_ip", {
    target_ip: ip,
    reason: reason ?? null
  });
  if (!error) return { error };
  return adminActionRequest("ban-ip", { ip, reason: reason ?? null });
}

export async function adminUnbanIp(ip: string) {
  if (!supabase) return { error: "no-supabase" };
  const { error } = await supabase.rpc("admin_unban_ip", {
    target_ip: ip
  });
  if (!error) return { error };
  return adminActionRequest("unban-ip", { ip });
}

export async function adminListBannedIps(): Promise<{ data: AdminBannedIp[]; error: unknown }> {
  if (!supabase) return { data: [], error: "no-supabase" };
  const { data, error } = await supabase
    .from("banned_ips")
    .select("ip, reason, banned_at, banned_by")
    .order("banned_at", { ascending: false });
  if (!error) return { data: (data ?? []) as AdminBannedIp[], error };

  const fallback = await adminActionRequest<{ data: AdminBannedIp[] }>("list-banned-ips", {});
  return {
    data: fallback.data?.data ?? [],
    error: fallback.error
  };
}

export async function adminDeleteUser(targetUserId: string) {
  if (!supabase) return { error: "no-supabase" };
  const { error } = await supabase.rpc("admin_delete_user", {
    target_user_id: targetUserId
  });
  return { error };
}

export async function adminDeleteListing(targetListingId: string, reason?: string) {
  if (!supabase) return { error: "no-supabase" };

  const listingResult =
    await supabase
      .from("listings")
      .select("image_url,image_urls")
      .eq("id", targetListingId)
      .maybeSingle<ListingImageFields>();

  let listingImages =
    listingResult.data;

  if (hasMissingListingColumns(listingResult.error)) {
    const fallbackResult =
      await supabase
        .from("listings")
        .select("image_url")
        .eq("id", targetListingId)
        .maybeSingle<Pick<Listing, "image_url">>();

    if (fallbackResult.error) {
      const fallback = await adminActionRequest("delete-listing", {
        listingId: targetListingId,
        reason: reason ?? null
      });
      return { error: fallback.error };
    }

    listingImages =
      fallbackResult.data
        ? {
            image_url: fallbackResult.data.image_url,
            image_urls: []
          }
        : null;
  } else if (listingResult.error) {
    const fallback = await adminActionRequest("delete-listing", {
      listingId: targetListingId,
      reason: reason ?? null
    });
    return { error: fallback.error };
  }

  const { error } = await supabase.rpc("admin_delete_listing", {
    target_listing_id: targetListingId,
    reason: reason ?? null
  });

  if (error) {
    const fallback = await adminActionRequest("delete-listing", {
      listingId: targetListingId,
      reason: reason ?? null
    });
    return { error: fallback.error };
  }

  const directDelete = await supabase
    .from("listings")
    .delete()
    .eq("id", targetListingId);

  if (directDelete.error) {
    const verify = await supabase
      .from("listings")
      .select("id")
      .eq("id", targetListingId)
      .maybeSingle<{ id: string }>();

    if (verify.data?.id) {
      return { error: directDelete.error };
    }
  }

  const imageCleanupError =
    await deleteListingStorageImages(listingImages);

  return { error, imageCleanupError };
}

async function adminActionRequest<T = { ok: boolean }>(
  action: string,
  payload: Record<string, unknown>
): Promise<{ data: T | null; error: unknown }> {
  if (!supabase) return { data: null, error: "no-supabase" };

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    const token = sessionData.session?.access_token;
    if (sessionError || !token) {
      return { data: null, error: sessionError ?? new Error("Kirjautuminen puuttuu.") };
    }

    const response = await fetch("/api/admin/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action, ...payload })
    });

    const json = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) {
      return { data: null, error: new Error(json.error || "Admin-toiminto epäonnistui.") };
    }

    return { data: json as T, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function adminUpdateProfile(
  targetUserId: string,
  updates: Partial<{
    first_name: string;
    last_name: string;
    full_name: string;
    phone: string;
    country: string;
    city: string;
    birth_date: string;
    company_name: string;
    business_id: string;
  }>
) {
  if (!supabase) return { error: "no-supabase" };
  const { error } = await supabase.rpc("admin_update_profile", {
    target_user_id: targetUserId,
    updates
  });
  return { error };
}

export async function adminSetCompanyVerified(targetUserId: string, verified: boolean) {
  if (!supabase) return { data: null, error: "no-supabase" };

  const { data, error } = await supabase.rpc("admin_set_company_verified", {
    target_user_id: targetUserId,
    verified
  });

  if (!error) {
    return { data: (data ?? null) as string | null, error };
  }

  const message = (error as { message?: string })?.message ?? "";
  if (!message.includes("admin_set_company_verified")) {
    return { data: null, error };
  }

  const nextValue = verified ? new Date().toISOString() : null;
  const fallback = await supabase
    .from("profiles")
    .update({
      company_verified_at: nextValue,
      company_verification_requested_at: null
    })
    .eq("id", targetUserId)
    .select("company_verified_at,company_verification_requested_at")
    .maybeSingle<{
      company_verified_at: string | null;
      company_verification_requested_at: string | null;
    }>();

  return { data: fallback.data?.company_verified_at ?? nextValue, error: fallback.error };
}

export async function trackSiteVisit(params: {
  ip?: string | null;
  path?: string | null;
  userAgent?: string | null;
}) {
  if (!supabase) return;
  try {
    await supabase.rpc("track_site_visit", {
      p_ip: params.ip ?? null,
      p_path: params.path ?? null,
      p_user_agent: params.userAgent ?? null
    });

    if (params.ip) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (token) {
        await fetch("/api/site-visit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ ip: params.ip })
        }).catch(() => undefined);
      }

      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (userId) {
        const current = await supabase
          .from("profiles")
          .select("last_ip,ip_count")
          .eq("id", userId)
          .maybeSingle<{ last_ip: string | null; ip_count: number | null }>();

        await supabase
          .from("profiles")
          .update({
            last_ip: params.ip,
            last_seen_ip: params.ip,
            ip_count: (current.data?.last_ip === params.ip)
              ? (current.data?.ip_count ?? 0)
              : (current.data?.ip_count ?? 0) + 1
          })
          .eq("id", userId);
      }
    }
  } catch {
    // tracking failures are silent
  }
}

/* =========================
   PROFILE
========================= */

export async function getProfile(
  userId: string
) {

  if (!supabase) {

    return {
      data: null,
      error: null
    };

  }

  try {

    const result =
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle<UserProfile>();

    if (result.data) {

      result.data.full_name =

        result.data.name ||

        `${result.data.first_name ?? ""}
         ${result.data.last_name ?? ""}`
          .replace(/\s+/g, " ")
          .trim();

    }

    return result;

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function ensureCurrentUserProfileName() {

  if (!supabase) {
    return;
  }

  const {
    data: { user }
  } =
    await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("first_name,last_name,name,full_name")
      .eq("id", user.id)
      .maybeSingle<Pick<
        UserProfile,
        | "first_name"
        | "last_name"
        | "name"
        | "full_name"
      >>();

  const metadata =
    user.user_metadata ?? {};

  const metadataName =
    String(
      metadata.full_name ??
      metadata.name ??
      ""
    )
      .replace(/\s+/g, " ")
      .trim();

  const profileName =
    (
      profile?.name ||
      profile?.full_name ||
      `${profile?.first_name ?? ""} ${
        profile?.last_name ?? ""
      }`
    )
      .replace(/\s+/g, " ")
      .trim();

  const nextName =
    profileName ||
    metadataName;

  if (!nextName) {
    return;
  }

  if (
    profile?.name === nextName &&
    profile?.full_name === nextName
  ) {
    return;
  }

  await supabase
    .from("profiles")
    .update({
      name: nextName,
      full_name: nextName
    })
    .eq("id", user.id);

}

/* =========================
   PUBLIC PROFILE
========================= */

export async function getPublicProfile(
  userId: string
) {

  if (!supabase) {

    return {
      data: null,
      error: null
    };

  }

  try {
    const profileSelect = `
          id,
          public_id,
          account_type,
          first_name,
          last_name,
          full_name,
          name,
          username,
          company_name,
          business_id,
          company_role,
          company_website,
          company_verified_at,
          public_address,
          phone,
          city,
          country,
          bio,
          avatar_url,
          created_at,
          phone_verified_at
      `;
    const fallbackProfileSelect = profileSelect.replace(/\s*company_verified_at,\n/, "\n");
    const withMissingCompanyVerificationFallback = async <T,>(
      query: PromiseLike<{ data: T; error: unknown }>,
      fallback: () => PromiseLike<{ data: T; error: unknown }>
    ): Promise<{ data: T; error: unknown }> => {
      const result = await query;
      const message = (result.error as { message?: string } | null)?.message ?? "";
      if (message.includes("company_verified_at")) {
        return fallback();
      }
      return result;
    };
    const isUuid = isUuidLike(userId);

    if (!isUuid) {
      const byPublicId = await withMissingCompanyVerificationFallback(
        supabase
        .from("profiles")
        .select(profileSelect)
        .eq("public_id", userId)
          .maybeSingle(),
        () => supabase
          .from("profiles")
          .select(fallbackProfileSelect)
          .eq("public_id", userId)
          .maybeSingle()
      );

      if (byPublicId.data || byPublicId.error) {
        return byPublicId;
      }

      const byUsername = await withMissingCompanyVerificationFallback(
        supabase
          .from("profiles")
          .select(profileSelect)
          .eq("username", userId)
          .maybeSingle(),
        () => supabase
          .from("profiles")
          .select(fallbackProfileSelect)
          .eq("username", userId)
          .maybeSingle()
      );

      if (byUsername.data || byUsername.error) {
        return byUsername;
      }

      const wantedSlug = slugifyProfileName(userId);
      const candidates = await withMissingCompanyVerificationFallback(
        supabase
          .from("profiles")
          .select(profileSelect)
          .range(0, 999) as unknown as PromiseLike<{ data: Partial<UserProfile>[] | null; error: unknown }>,
        () => supabase
          .from("profiles")
          .select(fallbackProfileSelect)
          .range(0, 999) as unknown as PromiseLike<{ data: Partial<UserProfile>[] | null; error: unknown }>
      );

      if (candidates.error) {
        return { data: null, error: candidates.error };
      }

      const match = (candidates.data ?? []).find((candidate) => {
        const profile = candidate as Partial<UserProfile>;
        const displayName =
          profile.account_type === "company"
            ? profile.company_name || profile.full_name || profile.name
            : profile.full_name ||
              profile.name ||
              `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();

        return [
          displayName,
          profile.company_name,
          profile.full_name,
          profile.name,
          profile.username,
          profile.public_id
        ].some((value) => slugifyProfileName(value) === wantedSlug);
      });

      return { data: (match ?? null) as UserProfile | null, error: null };
    }

    const byId = await withMissingCompanyVerificationFallback(
      supabase
        .from("profiles")
        .select(profileSelect)
        .eq("id", userId)
        .maybeSingle(),
      () => supabase
        .from("profiles")
        .select(fallbackProfileSelect)
        .eq("id", userId)
        .maybeSingle()
    );

    if (byId.data || byId.error) {
      return byId;
    }

    return await withMissingCompanyVerificationFallback(
      supabase
        .from("profiles")
        .select(profileSelect)
        .eq("public_id", userId)
        .maybeSingle(),
      () => supabase
        .from("profiles")
        .select(fallbackProfileSelect)
        .eq("public_id", userId)
        .maybeSingle()
    );

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function upsertProfile(
  profile: UserProfileInput
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    const contactName =
      `${profile.first_name}
       ${profile.last_name}`
        .replace(/\s+/g, " ")
        .trim();

    const fullName =
      profile.account_type === "company" && profile.company_name
        ? profile.company_name.trim()
        : contactName;

    let publicId = "";

    const {
      data: existingProfile
    } =
      await supabase
        .from("profiles")
        .select("public_id")
        .eq("id", profile.id)
        .maybeSingle();

    if (
      existingProfile?.public_id
    ) {

      publicId =
        existingProfile.public_id;

    } else {

      publicId =
        `KP${Date.now()}`;

    }

    const result =
      await supabase
        .from("profiles")
        .upsert({

          ...profile,

          public_id: publicId,

          full_name: fullName,

          name: fullName,

          is_completed: true

        })
        .select()
        .single<UserProfile>();

    if (result.data) {

      result.data.full_name =
        fullName;

    }

    return result;

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function upsertProfileFromApi(
  profile: UserProfileInput
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    const {
      data: sessionData,
      error: sessionError
    } =
      await supabase.auth.getSession();
    const token =
      sessionData.session?.access_token;

    if (sessionError || !token) {
      return {
        data: null,
        error:
          sessionError ??
          new Error("Kirjautuminen ei ole voimassa.")
      };
    }

    const response =
      await fetch("/api/profiles/upsert", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ profile })
      });

    const payload =
      await response.json().catch(() => ({})) as {
        data?: UserProfile;
        error?: string;
      };

    if (!response.ok) {
      return {
        data: null,
        error: new Error(
          payload.error || "Profiilin tallennus epaonnistui."
        )
      };
    }

    return {
      data: payload.data ?? null,
      error: null
    };

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function updateEditableProfile(
  userId: string,

  profile: Pick<
    UserProfile,
    | "address"
    | "account_type"
    | "postal_code"
    | "city"
    | "country"
    | "company_name"
    | "business_id"
    | "company_website"
    | "public_address"
    | "billing_email"
    | "bio"
  >
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    const updatePayload: Partial<UserProfile> = {
      ...profile,
      is_completed: true,
      updated_at: new Date().toISOString()
    };

    if (profile.account_type === "company") {
      const companyDisplayName = profile.company_name?.trim();
      if (companyDisplayName) {
        updatePayload.full_name = companyDisplayName;
        updatePayload.name = companyDisplayName;
      }
    }

    return await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select()
      .single<UserProfile>();

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

/* =========================
   COMPANY SELLERS
========================= */

export async function getCompanySellers(
  companyId: string
) {

  if (!supabase) {
    return {
      data: [] as CompanySeller[],
      error: null
    };
  }

  try {
    return await supabase
      .from("company_sellers")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .returns<CompanySeller[]>();
  } catch (error) {
    return {
      data: [] as CompanySeller[],
      error
    };
  }

}

export async function createCompanySeller(
  companyId: string,
  input: Pick<CompanySeller, "name" | "phone">
) {

  if (!supabase) {
    return {
      data: null,
      error: new Error("Supabase ei ole konfiguroitu.")
    };
  }

  try {
    return await supabase
      .from("company_sellers")
      .insert({
        company_id: companyId,
        name: input.name.trim(),
        phone: input.phone.trim()
      })
      .select()
      .single<CompanySeller>();
  } catch (error) {
    return {
      data: null,
      error
    };
  }

}

export async function updateCompanySeller(
  sellerId: string,
  companyId: string,
  input: Pick<CompanySeller, "name" | "phone"> & {
    edit_count?: number;
    phone_verified_at?: string | null;
  }
) {

  if (!supabase) {
    return {
      data: null,
      error: new Error("Supabase ei ole konfiguroitu.")
    };
  }

  try {
    return await supabase
      .from("company_sellers")
      .update({
        name: input.name.trim(),
        phone: input.phone.trim(),
        edit_count: input.edit_count,
        phone_verified_at: input.phone_verified_at ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("id", sellerId)
      .eq("company_id", companyId)
      .select()
      .single<CompanySeller>();
  } catch (error) {
    return {
      data: null,
      error
    };
  }

}

export async function deleteCompanySeller(
  sellerId: string,
  companyId: string
) {

  if (!supabase) {
    return {
      error: new Error("Supabase ei ole konfiguroitu.")
    };
  }

  try {
    return await supabase
      .from("company_sellers")
      .delete()
      .eq("id", sellerId)
      .eq("company_id", companyId);
  } catch (error) {
    return {
      error
    };
  }

}

/* =========================
   REVIEWS
========================= */

export async function getReviewsBySeller(
  userId: string
) {

  if (!supabase) {

    return {
      data: [],
      error: null
    };

  }

  try {

    return await supabase
      .from("seller_reviews")
      .select("*")
      .eq("seller_id", userId)
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .returns<SellerReview[]>();

  } catch (error) {

    return {
      data: [],
      error
    };

  }

}

export async function getSellerReviewLikeSummary(
  reviewIds: string[]
): Promise<{ data: SellerReviewLikeSummary[]; error: unknown }> {
  const uniqueIds = Array.from(new Set(reviewIds.filter(Boolean)));

  if (!supabase || uniqueIds.length === 0) {
    return {
      data: [],
      error: null
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      "get_seller_review_like_summary",
      { review_ids: uniqueIds }
    );

    return {
      data: (data ?? []).map((row: Partial<SellerReviewLikeSummary>) => ({
        review_id: String(row.review_id ?? ""),
        like_count: Number(row.like_count) || 0,
        is_liked: Boolean(row.is_liked)
      })).filter((row: SellerReviewLikeSummary) => row.review_id),
      error
    };
  } catch (error) {
    return {
      data: [],
      error
    };
  }
}

export async function likeSellerReview(reviewId: string) {
  if (!supabase) {
    return {
      error: new Error("Supabase ei ole konfiguroitu.")
    };
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: new Error("Kirjaudu sisÃ¤Ã¤n tykÃ¤tÃ¤ksesi arvostelusta.")
      };
    }

    const { error } = await supabase
      .from("seller_review_likes")
      .upsert(
        {
          review_id: reviewId,
          user_id: user.id
        },
        {
          onConflict: "review_id,user_id"
        }
      );

    return { error };
  } catch (error) {
    return { error };
  }
}

export async function unlikeSellerReview(reviewId: string) {
  if (!supabase) {
    return {
      error: new Error("Supabase ei ole konfiguroitu.")
    };
  }

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: new Error("Kirjaudu sisÃ¤Ã¤n hallitaksesi peukkuja.")
      };
    }

    const { error } = await supabase
      .from("seller_review_likes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", user.id);

    return { error };
  } catch (error) {
    return { error };
  }
}

function normalizeSellerLevelStats(value: Partial<SellerLevelStats> | null | undefined): SellerLevelStats {
  const listingsCreated = Math.max(0, Number(value?.listings_created) || 0);
  const multiListingsCreated = Math.max(0, Number(value?.multi_listings_created) || 0);
  const singleListingsCreated =
    value?.single_listings_created === undefined
      ? Math.max(0, listingsCreated - multiListingsCreated)
      : Math.max(0, Number(value.single_listings_created) || 0);

  return {
    listings_created: listingsCreated,
    single_listings_created: singleListingsCreated,
    multi_listings_created: multiListingsCreated,
    sold_count: Math.max(0, Number(value?.sold_count) || 0),
    reviews_given: Math.max(0, Number(value?.reviews_given) || 0),
    reviews_received: Math.max(0, Number(value?.reviews_received) || 0),
    phone_verified: Boolean(value?.phone_verified)
  };
}

export async function getPublicSellerLevelStats(
  sellerId: string
): Promise<{ data: SellerLevelStats; error: unknown }> {
  const empty = normalizeSellerLevelStats(null);
  if (!supabase) return { data: empty, error: null };

  try {
    const rpcResult = await supabase.rpc("get_public_seller_level_stats", {
      p_user_id: sellerId
    });

    if (!rpcResult.error && rpcResult.data) {
      return {
        data: normalizeSellerLevelStats(rpcResult.data as Partial<SellerLevelStats>),
        error: null
      };
    }

    const [
      listingsResult,
      soldResult,
      reviewsGivenResult,
      reviewsReceivedResult,
      profileResult
    ] = await Promise.all([
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId),
      supabase
        .from("sold_listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId),
      supabase
        .from("seller_reviews")
        .select("id", { count: "exact", head: true })
        .eq("reviewer_id", sellerId),
      supabase
        .from("seller_reviews")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId),
      supabase
        .from("profiles")
        .select("phone_verified_at")
        .eq("id", sellerId)
        .maybeSingle<Pick<UserProfile, "phone_verified_at">>()
    ]);

    const soldCount =
      soldResult.error ? 0 : soldResult.count ?? 0;

    return {
      data: normalizeSellerLevelStats({
        listings_created: (listingsResult.count ?? 0) + soldCount,
        single_listings_created: (listingsResult.count ?? 0) + soldCount,
        multi_listings_created: 0,
        sold_count: soldCount,
        reviews_given: reviewsGivenResult.count ?? 0,
        reviews_received: reviewsReceivedResult.count ?? 0,
        phone_verified: Boolean(profileResult.data?.phone_verified_at)
      }),
      error:
        rpcResult.error ??
        listingsResult.error ??
        soldResult.error ??
        reviewsGivenResult.error ??
        reviewsReceivedResult.error ??
        profileResult.error ??
        null
    };
  } catch (error) {
    return { data: empty, error };
  }
}

export async function createSellerReview(
  review: SellerReviewInput
) {

  if (!supabase) {

    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };

  }

  try {

    const { data: recentReview } =
      await supabase
        .from("seller_reviews")
        .select("id")
        .eq("seller_id", review.seller_id)
        .eq("reviewer_id", review.reviewer_id)
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        )
        .maybeSingle();

    if (recentReview) {
      return {
        data: null,
        error: new Error("Voit antaa samalle myyjälle vain yhden arvion viikossa.")
      };
    }

    return await supabase
      .from("seller_reviews")
      .insert(review)
      .select()
      .single<SellerReview>();

  } catch (error) {

    return {
      data: null,
      error
    };

  }

}

export async function createSellerReviewForRequest(
  requestId: string,
  review: SellerReviewInput
) {
  if (!supabase) {
    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };
  }

  try {
    const reviewResult =
      await createSellerReview(review);

    if (reviewResult.error || !reviewResult.data) {
      return reviewResult;
    }

    const { error: updateError } =
      await supabase
        .from("purchase_review_requests")
        .update({
          completed_at:
            new Date().toISOString()
        })
        .eq("id", requestId)
        .eq("buyer_id", review.reviewer_id);

    if (updateError) {
      return {
        data: reviewResult.data,
        error: updateError
      };
    }

    return reviewResult;
  } catch (error) {
    return {
      data: null,
      error
    };
  }
}

export async function getPendingPurchaseReviewRequests(
  userId: string
) {
  if (!supabase) {
    return {
      data: [] as PurchaseReviewRequest[],
      error: null
    };
  }

  try {
    const { data, error } =
      await supabase
        .from("purchase_review_requests")
        .select("*")
        .eq("buyer_id", userId)
        .is("completed_at", null)
        .order("due_at", {
          ascending: true
        })
        .returns<PurchaseReviewRequest[]>();

    return {
      data: data ?? [],
      error
    };
  } catch (error) {
    return {
      data: [] as PurchaseReviewRequest[],
      error
    };
  }
}

export async function markPurchaseReviewRequestsSeen(
  requestIds: string[],
  buyerId: string
) {
  if (!supabase || requestIds.length === 0) {
    return { error: null };
  }

  try {
    const { error } =
      await supabase
        .from("purchase_review_requests")
        .update({
          seen_at: new Date().toISOString()
        })
        .in("id", requestIds)
        .eq("buyer_id", buyerId)
        .is("seen_at", null);

    return { error };
  } catch (error) {
    return { error };
  }
}

export async function getPurchaseReviewRequestByConversation(
  conversationId: string
) {
  if (!supabase) {
    return {
      data: null,
      error: null
    };
  }

  try {
    return await supabase
      .from("purchase_review_requests")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle<PurchaseReviewRequest>();
  } catch (error) {
    return {
      data: null,
      error
    };
  }
}

export async function createPurchaseReviewRequest(
  request: PurchaseReviewRequestInput
) {
  if (!supabase) {
    return {
      data: null,
      error: new Error(
        "Supabase ei ole konfiguroitu."
      )
    };
  }

  try {
    return await supabase
      .from("purchase_review_requests")
      .upsert(
        request,
        {
          onConflict: "conversation_id"
        }
      )
      .select()
      .single<PurchaseReviewRequest>();
  } catch (error) {
    return {
      data: null,
      error
    };
  }
}

export async function dismissPurchaseReviewRequest(requestId: string) {
  if (!supabase) return { error: null };
  try {
    const { error } = await supabase
      .from("purchase_review_requests")
      .delete()
      .eq("id", requestId);
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function getListingBuyerCandidates(
  listingId: string
) {
  if (!supabase) {
    return {
      data: [] as ListingBuyerCandidate[],
      error: null
    };
  }

  try {
    const { data: conversations, error } =
      await supabase
        .from("conversations")
        .select("id,buyer_id,created_at")
        .eq("listing_id", listingId)
        .order("created_at", {
          ascending: false
        });

    if (error || !conversations?.length) {
      return {
        data: [] as ListingBuyerCandidate[],
        error
      };
    }

    const buyerIds =
      Array.from(
        new Set(
          conversations
            .map((conversation) =>
              String(conversation.buyer_id || "")
            )
            .filter(Boolean)
        )
      );

    const { data: profiles } =
      await supabase
        .from("profiles")
        .select("id,public_id,first_name,last_name,full_name,name,username")
        .in("id", buyerIds);

    const { data: publicProfiles } =
      await supabase
        .from("public_profiles")
        .select("id,first_name,last_name,full_name")
        .in("id", buyerIds);

    const profileById =
      new Map<string, Partial<UserProfile>>();

    for (const profile of publicProfiles ?? []) {
      profileById.set(
        String(profile.id),
        profile as Partial<UserProfile>
      );
    }

    for (const profile of profiles ?? []) {
      profileById.set(
        String(profile.id),
        {
          ...(profileById.get(String(profile.id)) ?? {}),
          ...(profile as Partial<UserProfile>)
        }
      );
    }

    const seenBuyerIds =
      new Set<string>();

    const candidates: ListingBuyerCandidate[] = [];

    for (const conversation of conversations) {
        const buyerId =
          String(conversation.buyer_id);

        if (
          !buyerId ||
          seenBuyerIds.has(buyerId)
        ) {
          continue;
        }

        seenBuyerIds.add(buyerId);

        const profile =
          profileById.get(buyerId);

        const buyerName =
          profile?.full_name ||
          profile?.name ||
          profile?.username ||
          `${profile?.first_name ?? ""} ${
            profile?.last_name ?? ""
          }`
            .replace(/\s+/g, " ")
            .trim() ||
          profile?.public_id ||
          `Käyttäjä ${buyerId.slice(0, 8)}`;

        candidates.push({
          conversation_id:
            String(conversation.id),
          buyer_id:
            buyerId,
          buyer_name:
            buyerName,
          created_at:
            String(conversation.created_at ?? "")
        });
    }

    return {
      data: candidates,
      error: null
    };
  } catch (error) {
    return {
      data: [] as ListingBuyerCandidate[],
      error
    };
  }
}

export async function findReviewBuyerByPhone(
  phone: string
) {
  if (!supabase) {
    return {
      data: null,
      error: null
    };
  }

  try {
    return await supabase
      .rpc("find_review_buyer_by_phone", {
        raw_phone: phone
      })
      .maybeSingle<ReviewBuyerLookup>();
  } catch (error) {
    return {
      data: null,
      error
    };
  }
}

/* =========================
   MESSAGES
========================= */

export async function getConversationSummaries(
  userId: string
) {

  if (!supabase) {

    return {
      data: [],
      error: null
    };

  }

  try {

    let conversationsResult =
      await supabase
        .from("conversations")
        .select("*")
        .or(
          `buyer_id.eq.${userId},seller_id.eq.${userId}`
        )
        .order(
          "updated_at",
          {
            ascending: false
          }
        )
        .returns<Conversation[]>();

    if (conversationsResult.error) {

      conversationsResult =
        await supabase
          .from("conversations")
          .select("*")
          .or(
            `buyer_id.eq.${userId},seller_id.eq.${userId}`
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          )
          .returns<Conversation[]>();

    }

    if (
      conversationsResult.error ||
      !conversationsResult.data?.length
    ) {

      return {
        data: [],
        error: conversationsResult.error
      };

    }

    const conversations =
      conversationsResult.data;

    const listingIds =
      Array.from(
        new Set(
          conversations.map(
            (conversation) =>
              conversation.listing_id
          )
        )
      );

    const otherUserIds =
      Array.from(
        new Set(
          conversations.map(
            (conversation) =>
              conversation.buyer_id === userId
                ? conversation.seller_id
                : conversation.buyer_id
          )
        )
      );

    const conversationIds =
      conversations.map(
        (conversation) =>
          conversation.id
      );

    const [
      listingsResult,
      profilesResult,
      publicProfilesResult,
      messagesResult,
      reviewsResult
    ] =
      await Promise.all([
        supabase
          .from("listings")
          .select("id,title,image_url,price,seller_name")
          .in("id", listingIds),

        supabase
          .from("profiles")
          .select(`
            id,
            public_id,
            first_name,
            last_name,
            full_name,
            name,
            username,
            avatar_url,
            online,
            last_seen,
            created_at,
            city,
            country
          `)
          .in("id", otherUserIds),

        supabase
          .from("public_profiles")
          .select(`
            id,
            first_name,
            last_name,
            full_name,
            avatar_url,
            created_at,
            city,
            country
          `)
          .in("id", otherUserIds),

        supabase
          .from("messages")
          .select("*")
          .in(
            "conversation_id",
            conversationIds
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          )
          .limit(Math.min(Math.max(conversationIds.length * 5, 100), 500))
          .returns<ChatMessage[]>(),

        supabase
          .from("seller_reviews")
          .select("seller_id,rating")
          .in("seller_id", otherUserIds)
          .returns<Array<{ seller_id: string; rating: number | null }>>()
      ]);

    const listingsById =
      new Map(
        (listingsResult.data ?? []).map(
          (listing) => [
            listing.id,
            listing
          ]
        )
      );

    const profilesById =
      new Map<
        string,
        ConversationSummary["other_profile"]
      >(
        (profilesResult.data ?? []).map(
          (profile) => [
            profile.id,
            profile
          ]
        )
      );

    for (const publicProfile of publicProfilesResult.data ?? []) {
      const existing =
        profilesById.get(publicProfile.id);

      profilesById.set(
        publicProfile.id,
        {
          ...existing,
          ...publicProfile
        }
      );
    }

    const lastMessageByConversation =
      new Map<string, ChatMessage>();

    const reviewStatsBySeller =
      new Map<
        string,
        {
          average: number;
          count: number;
        }
      >();

    for (const review of reviewsResult.data ?? []) {
      const sellerId =
        String(review.seller_id || "");
      const rating =
        Number(review.rating);

      if (
        !sellerId ||
        !Number.isFinite(rating)
      ) {
        continue;
      }

      const current =
        reviewStatsBySeller.get(sellerId);

      reviewStatsBySeller.set(
        sellerId,
        {
          average:
            current
              ? (
                  current.average * current.count +
                  rating
                ) / (current.count + 1)
              : rating,
          count:
            (current?.count ?? 0) + 1
        }
      );
    }

    for (const message of messagesResult.data ?? []) {

      if (
        !lastMessageByConversation.has(
          message.conversation_id
        )
      ) {

        lastMessageByConversation.set(
          message.conversation_id,
          message
        );

      }

    }

    const summaries =
      conversations.map(
        (conversation) => {

          const otherUserId =
            conversation.buyer_id === userId
              ? conversation.seller_id
              : conversation.buyer_id;
          const reviewStats =
            reviewStatsBySeller.get(otherUserId);

          return {
            ...conversation,
            listing:
              listingsById.get(
                conversation.listing_id
              ) ?? null,
            other_profile:
              profilesById.get(
                otherUserId
              ) ?? null,
            last_message:
              lastMessageByConversation.get(
                conversation.id
              ) ?? null,
            other_review_average:
              reviewStats?.average ?? null,
            other_review_count:
              reviewStats?.count ?? 0
          };

        }
      )
      .sort((a, b) => {

        const aTime =
          a.last_message?.created_at ||
          a.updated_at ||
          a.created_at;

        const bTime =
          b.last_message?.created_at ||
          b.updated_at ||
          b.created_at;

        return (
          new Date(bTime).getTime() -
          new Date(aTime).getTime()
        );

      });

    return {
      data: summaries,
      error:
        listingsResult.error ??
        profilesResult.error ??
        publicProfilesResult.error ??
        messagesResult.error ??
        reviewsResult.error ??
        null
    };

  } catch (error) {

    return {
      data: [],
      error
    };

  }

}

export async function getUnreadConversationSummaries(
  userId: string,
  limit = 30
) {
  if (!supabase) {
    return {
      data: [] as ConversationSummary[],
      error: null
    };
  }

  try {
    let unreadResult = await supabase
      .from("messages")
      .select("*")
      .eq("receiver_id", userId)
      .is("read_at", null)
      .or("read.is.null,read.eq.false")
      .order("created_at", { ascending: false })
      .limit(Math.max(limit * 3, limit))
      .returns<ChatMessage[]>();

    if (unreadResult.error) {
      unreadResult = await supabase
        .from("messages")
        .select("*")
        .eq("receiver_id", userId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(Math.max(limit * 3, limit))
        .returns<ChatMessage[]>();
    }

    if (unreadResult.error || !unreadResult.data?.length) {
      return {
        data: [],
        error: unreadResult.error
      };
    }

    const lastUnreadByConversation =
      new Map<string, ChatMessage>();

    for (const message of unreadResult.data) {
      if (!lastUnreadByConversation.has(message.conversation_id)) {
        lastUnreadByConversation.set(message.conversation_id, message);
      }
    }

    const conversationIds =
      Array.from(lastUnreadByConversation.keys()).slice(0, limit);

    if (conversationIds.length === 0) {
      return {
        data: [],
        error: null
      };
    }

    const conversationsResult =
      await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .returns<Conversation[]>();

    if (conversationsResult.error || !conversationsResult.data?.length) {
      return {
        data: [],
        error: conversationsResult.error
      };
    }

    const conversations =
      conversationsResult.data;

    const listingIds =
      Array.from(
        new Set(conversations.map((conversation) => conversation.listing_id))
      );

    const otherUserIds =
      Array.from(
        new Set(
          conversations.map((conversation) =>
            conversation.buyer_id === userId
              ? conversation.seller_id
              : conversation.buyer_id
          )
        )
      );

    const [
      listingsResult,
      profilesResult,
      publicProfilesResult,
      reviewsResult
    ] =
      await Promise.all([
        supabase
          .from("listings")
          .select("id,listing_number,title,image_url,price,seller_name")
          .in("id", listingIds),

        supabase
          .from("profiles")
          .select(`
            id,
            public_id,
            first_name,
            last_name,
            full_name,
            name,
            username,
            avatar_url,
            online,
            last_seen,
            created_at,
            city,
            country
          `)
          .in("id", otherUserIds),

        supabase
          .from("public_profiles")
          .select(`
            id,
            first_name,
            last_name,
            full_name,
            avatar_url,
            created_at,
            city,
            country
          `)
          .in("id", otherUserIds),

        supabase
          .from("seller_reviews")
          .select("seller_id,rating")
          .in("seller_id", otherUserIds)
          .returns<Array<{ seller_id: string; rating: number | null }>>()
      ]);

    const listingsById =
      new Map(
        (listingsResult.data ?? []).map((listing) => [
          listing.id,
          listing
        ])
      );

    const profilesById =
      new Map<string, ConversationSummary["other_profile"]>(
        (profilesResult.data ?? []).map((profile) => [
          profile.id,
          profile
        ])
      );

    for (const publicProfile of publicProfilesResult.data ?? []) {
      const existing =
        profilesById.get(publicProfile.id);

      profilesById.set(
        publicProfile.id,
        {
          ...existing,
          ...publicProfile
        }
      );
    }

    const reviewStatsBySeller =
      new Map<string, { average: number; count: number }>();

    for (const review of reviewsResult.data ?? []) {
      const sellerId =
        String(review.seller_id || "");
      const rating =
        Number(review.rating);

      if (!sellerId || !Number.isFinite(rating)) {
        continue;
      }

      const current =
        reviewStatsBySeller.get(sellerId);

      reviewStatsBySeller.set(
        sellerId,
        {
          average:
            current
              ? (current.average * current.count + rating) /
                (current.count + 1)
              : rating,
          count:
            (current?.count ?? 0) + 1
        }
      );
    }

    const orderByConversation =
      new Map(conversationIds.map((id, index) => [id, index]));

    const summaries =
      conversations
        .map((conversation) => {
          const otherUserId =
            conversation.buyer_id === userId
              ? conversation.seller_id
              : conversation.buyer_id;
          const reviewStats =
            reviewStatsBySeller.get(otherUserId);

          return {
            ...conversation,
            listing:
              listingsById.get(conversation.listing_id) ?? null,
            other_profile:
              profilesById.get(otherUserId) ?? null,
            last_message:
              lastUnreadByConversation.get(conversation.id) ?? null,
            other_review_average:
              reviewStats?.average ?? null,
            other_review_count:
              reviewStats?.count ?? 0
          };
        })
        .sort(
          (a, b) =>
            (orderByConversation.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (orderByConversation.get(b.id) ?? Number.MAX_SAFE_INTEGER)
        );

    return {
      data: summaries,
      error:
        listingsResult.error ??
        profilesResult.error ??
        publicProfilesResult.error ??
        reviewsResult.error ??
        null
    };
  } catch (error) {
    return {
      data: [] as ConversationSummary[],
      error
    };
  }
}

export async function getConversationCountForUser(
  userId: string
): Promise<{
  count: number;
  error: unknown;
}> {
  if (!supabase) {
    return {
      count: 0,
      error: null
    };
  }

  try {
    const { count, error } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

    return {
      count: count ?? 0,
      error
    };
  } catch (error) {
    return {
      count: 0,
      error
    };
  }
}

/* =========================
   MESSAGES — HELPERS
========================= */

export async function getMessagesForConversation(conversationId: string) {
  if (!supabase) return { data: [] as ChatMessage[], error: null };
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .returns<ChatMessage[]>();
    return { data: data ?? [], error };
  } catch (error) {
    return { data: [] as ChatMessage[], error };
  }
}

export async function getMessagesForConversationAfter(
  conversationId: string,
  afterCreatedAt: string
) {
  if (!supabase) return { data: [] as ChatMessage[], error: null };
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .gt("created_at", afterCreatedAt)
      .order("created_at", { ascending: true })
      .limit(60)
      .returns<ChatMessage[]>();
    return { data: data ?? [], error };
  } catch (error) {
    return { data: [] as ChatMessage[], error };
  }
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      String((error as { code?: unknown }).code) === "23505"
  );
}

async function findConversationForListingPair(
  listingId: string,
  buyerId: string,
  sellerId: string
) {
  if (!supabase) return { data: null as Conversation | null, error: null };

  try {
    let result = await supabase
      .from("conversations")
      .select("*")
      .eq("listing_id", listingId)
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<Conversation[]>();

    if (result.error) {
      result = await supabase
        .from("conversations")
        .select("*")
        .eq("listing_id", listingId)
        .eq("buyer_id", buyerId)
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<Conversation[]>();
    }

    return { data: result.data?.[0] ?? null, error: result.error };
  } catch (error) {
    return { data: null as Conversation | null, error };
  }
}

export async function getOrCreateConversationForListing(input: {
  listing_id: string;
  buyer_id: string;
  seller_id: string;
}) {
  if (!supabase) return { data: null as Conversation | null, error: new Error("Ei yhteyttä") };

  const listingId = input.listing_id;
  const buyerId = input.buyer_id;
  const sellerId = input.seller_id;

  if (!listingId || !buyerId || !sellerId) {
    return { data: null as Conversation | null, error: new Error("Keskustelun tiedot puuttuvat") };
  }

  if (buyerId === sellerId) {
    return { data: null as Conversation | null, error: new Error("Omaan ilmoitukseen ei voi aloittaa keskustelua") };
  }

  try {
    const rpcResult = await supabase.rpc(
      "start_listing_conversation",
      {
        p_listing_id: listingId
      }
    );

    if (!rpcResult.error && rpcResult.data) {
      const conversation =
        Array.isArray(rpcResult.data)
          ? rpcResult.data[0]
          : rpcResult.data;

      return {
        data: conversation as Conversation,
        error: null
      };
    }
  } catch {
    // Older databases may not have the RPC yet. Fall back to direct insert.
  }

  const existing = await findConversationForListingPair(listingId, buyerId, sellerId);
  if (existing.data || existing.error) return existing;

  try {
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: sellerId
      })
      .select()
      .single<Conversation>();

    if (error) {
      if (isUniqueViolation(error)) {
        return await findConversationForListingPair(listingId, buyerId, sellerId);
      }

      return { data: null as Conversation | null, error };
    }

    return { data, error: null };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return await findConversationForListingPair(listingId, buyerId, sellerId);
    }

    return { data: null as Conversation | null, error };
  }
}

export const CHAT_LAST_READ_STORAGE_KEY = "chatLastRead";
export const CHAT_NOTIFICATIONS_CHANGED_EVENT = "chat-notifications-changed";

export function dispatchChatNotificationsChanged(
  detail?: Record<string, unknown>
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      CHAT_NOTIFICATIONS_CHANGED_EVENT,
      {
        detail
      }
    )
  );
}

export function readChatLastRead(): Record<string, number> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CHAT_LAST_READ_STORAGE_KEY) ?? "{}"
    );

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, number>>(
      (result, [conversationId, value]) => {
        const timestamp = Number(value);
        if (conversationId && Number.isFinite(timestamp)) {
          result[conversationId] = timestamp;
        }
        return result;
      },
      {}
    );
  } catch {
    return {};
  }
}

export function writeChatLastRead(next: Record<string, number>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CHAT_LAST_READ_STORAGE_KEY,
      JSON.stringify(next)
    );
  } catch {
    // Local notification state is best-effort.
  }

  dispatchChatNotificationsChanged({
    reason: "last-read"
  });
}

export function isConversationLastMessageUnread(
  conversation: Pick<ConversationSummary, "id" | "last_message">,
  userId: string,
  lastRead = readChatLastRead()
) {
  const message = conversation.last_message;

  if (
    !message ||
    !userId ||
    message.sender_id === userId ||
    message.receiver_id !== userId ||
    message.read === true ||
    Boolean(message.read_at)
  ) {
    return false;
  }

  const sentAt =
    new Date(message.created_at).getTime();

  if (Number.isNaN(sentAt)) {
    return false;
  }

  return sentAt > (lastRead[conversation.id] ?? 0);
}

function isMissingReadColumnError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  return (
    message.includes("read") &&
    (
      message.includes("Could not find") ||
      message.includes("schema cache") ||
      message.includes("column")
    )
  );
}

export function rememberConversationReadLocally(
  conversationId: string,
  readAt = Date.now()
) {
  const current = readChatLastRead();
  const previous = Number(current[conversationId]) || 0;

  writeChatLastRead({
    ...current,
    [conversationId]: Math.max(previous, readAt)
  });
}

async function markConversationReadViaApi(
  conversationId: string,
  readAt: number
) {
  if (
    typeof window === "undefined" ||
    typeof fetch === "undefined" ||
    !supabase
  ) {
    return { error: new Error("API fallback ei ole käytettävissä.") };
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const accessToken =
    sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    return {
      error:
        sessionError ??
        new Error("Kirjautuminen ei ole voimassa.")
    };
  }

  try {
    const response =
      await fetch(
        "/api/messages/mark-read",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            conversationId,
            readAt
          })
        }
      );

    if (!response.ok) {
      const payload =
        await response.json().catch(() => ({})) as { error?: string };

      return {
        error: new Error(payload.error || "Luetuksi merkintä epäonnistui.")
      };
    }

    return { error: null };
  } catch (error) {
    return { error };
  }
}

type MarkConversationReadResult = {
  error: unknown;
};

const pendingConversationReadRequests =
  new Map<string, {
    readAt: number;
    promise: Promise<MarkConversationReadResult>;
  }>();

const completedConversationReadAt =
  new Map<string, number>();

async function persistConversationRead(
  conversationId: string,
  userId: string,
  readAt = Date.now()
): Promise<MarkConversationReadResult> {
  if (!supabase) {
    return { error: null };
  }

  try {
    const readAtIso =
      new Date(readAt).toISOString();

    let result = await supabase
      .from("messages")
      .update({
        read: true,
        read_at: readAtIso
      })
      .eq("conversation_id", conversationId)
      .eq("receiver_id", userId)
      .is("read_at", null);

    if (result.error && isMissingReadColumnError(result.error)) {
      result = await supabase
        .from("messages")
        .update({
          read_at: readAtIso
        })
        .eq("conversation_id", conversationId)
        .eq("receiver_id", userId)
        .is("read_at", null);
    }

    if (result.error) {
      const apiResult =
        await markConversationReadViaApi(
          conversationId,
          readAt
        );

      if (!apiResult.error) {
        dispatchChatNotificationsChanged({
          conversationId,
          reason: "read"
        });

        return apiResult;
      }
    }

    if (result.error) {
      result = await supabase
        .from("messages")
        .update({
          read: true
        })
        .eq("conversation_id", conversationId)
        .eq("receiver_id", userId);
    }

    if (result.error) {
      result = await supabase
        .from("messages")
        .update({
          read: true,
          read_at: readAtIso
        })
        .eq("conversation_id", conversationId)
        .eq("receiver_id", userId);
    }

    dispatchChatNotificationsChanged({
      conversationId,
      reason: "read"
    });

    return { error: result.error };
  } catch (error) {
    return { error };
  }
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
  readAt = Date.now()
) {
  rememberConversationReadLocally(conversationId, readAt);

  const completedAt =
    completedConversationReadAt.get(conversationId) ?? 0;

  if (readAt <= completedAt) {
    return { error: null };
  }

  const pending =
    pendingConversationReadRequests.get(conversationId);

  if (pending && readAt <= pending.readAt) {
    return pending.promise;
  }

  const promise =
    persistConversationRead(conversationId, userId, readAt)
      .then((result) => {
        if (!result.error) {
          completedConversationReadAt.set(
            conversationId,
            Math.max(
              completedConversationReadAt.get(conversationId) ?? 0,
              readAt
            )
          );
        }

        return result;
      })
      .finally(() => {
        const current =
          pendingConversationReadRequests.get(conversationId);

        if (current?.promise === promise) {
          pendingConversationReadRequests.delete(conversationId);
        }
      });

  pendingConversationReadRequests.set(
    conversationId,
    {
      readAt,
      promise
    }
  );

  return promise;
}

export async function sendChatMessage(msg: {
  conversation_id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image?: string | null;
}) {
  if (!supabase) return { data: null, error: new Error("Ei yhteyttä") };
  try {
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", msg.conversation_id)
      .maybeSingle<Conversation>();

    if (conversationError || !conversation) {
      return {
        data: null,
        error: conversationError ?? new Error("Keskustelua ei löytynyt")
      };
    }

    const senderIsBuyer = conversation.buyer_id === msg.sender_id;
    const senderIsSeller = conversation.seller_id === msg.sender_id;

    if (!senderIsBuyer && !senderIsSeller) {
      return { data: null, error: new Error("Et kuulu tähän keskusteluun") };
    }

    const receiverId = senderIsBuyer
      ? conversation.seller_id
      : conversation.buyer_id;

    const { data, error } = await supabase
      .from("messages")
      .insert({
        ...msg,
        listing_id: conversation.listing_id,
        receiver_id: receiverId
      })
      .select()
      .single<ChatMessage>();
    if (!error) {
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", msg.conversation_id);

      dispatchChatNotificationsChanged({
        conversationId: msg.conversation_id,
        reason: "sent"
      });
    }
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/* =========================
   GARAGE VEHICLES
========================= */

export type GarageVehicle = {
  id: string;
  user_id: string;
  vehicle_class?: string | null;
  make: string;
  model: string;
  year: number;
  nickname?: string | null;
  created_at: string;
};

export type GarageVehicleInput = {
  user_id: string;
  vehicle_class?: string | null;
  make: string;
  model: string;
  year: number;
  nickname?: string | null;
};

export async function getGarageVehicles(
  userId: string
) {

  if (!supabase) {
    return { data: [] as GarageVehicle[], error: null };
  }

  try {

    return await supabase
      .from("garage_vehicles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .returns<GarageVehicle[]>();

  } catch (error) {
    return { data: [] as GarageVehicle[], error };
  }

}

export async function addGarageVehicle(
  vehicle: GarageVehicleInput
) {

  if (!supabase) {
    return { data: null, error: new Error("Supabase not configured") };
  }

  try {

    return await supabase
      .from("garage_vehicles")
      .insert(vehicle)
      .select()
      .single<GarageVehicle>();

  } catch (error) {
    return { data: null, error };
  }

}

export async function deleteGarageVehicle(
  vehicleId: string
) {

  if (!supabase) {
    return { error: null };
  }

  try {

    const { error } = await supabase
      .from("garage_vehicles")
      .delete()
      .eq("id", vehicleId);

    return { error };

  } catch (error) {
    return { error };
  }

}

export async function getListingsByVehicle(
  make: string,
  model: string
) {

  if (!supabase) {
    return { data: [] as import("./listings").Listing[], error: null };
  }

  try {
    const makeTerm = escapeIlikeTerm(make);
    const modelTerms =
      model
        .split(/\s+/)
        .map(escapeIlikeTerm)
        .filter(Boolean)
        .slice(0, 3);

    let query =
      supabase
        .from("listings")
        .select(LISTING_CARD_SELECT)
        .order("created_at", { ascending: false })
        .limit(80);

    if (makeTerm) {
      query = query.or([
        `brand.ilike.%${makeTerm}%`,
        `title.ilike.%${makeTerm}%`,
        `description.ilike.%${makeTerm}%`
      ].join(","));
    }

    if (modelTerms[0]) {
      const term = modelTerms[0];
      query = query.or([
        `model.ilike.%${term}%`,
        `title.ilike.%${term}%`,
        `description.ilike.%${term}%`
      ].join(","));
    }

    let { data, error } =
      await query.returns<import("./listings").Listing[]>();

    if (error && hasMissingListingColumns(error)) {
      let fallbackQuery =
        supabase
          .from("listings")
          .select(BASE_LISTING_CARD_SELECT)
          .order("created_at", { ascending: false })
          .limit(80);

      if (makeTerm) {
        fallbackQuery = fallbackQuery.or([
          `brand.ilike.%${makeTerm}%`,
          `title.ilike.%${makeTerm}%`,
          `description.ilike.%${makeTerm}%`
        ].join(","));
      }

      if (modelTerms[0]) {
        const term = modelTerms[0];
        fallbackQuery = fallbackQuery.or([
          `model.ilike.%${term}%`,
          `title.ilike.%${term}%`,
          `description.ilike.%${term}%`
        ].join(","));
      }

      ({ data, error } =
        await fallbackQuery.returns<import("./listings").Listing[]>());
    }

    if (error) return { data: [] as import("./listings").Listing[], error };

    const makeLower = make.toLowerCase();
    const modelLower = model.toLowerCase();

    const filtered = (data ?? []).filter((l) => {
      const haystack = [
        l.brand ?? "",
        l.title,
        l.description ?? ""
      ].join(" ").toLowerCase();

      const matchesMake = makeLower ? haystack.includes(makeLower) : true;
      const modelWords = modelLower.split(" ").filter(Boolean);
      const matchesModel = modelWords.length === 0 || modelWords.every((word) => haystack.includes(word));

      return matchesMake && matchesModel;
    });

    return { data: filtered, error: null };

  } catch (error) {
    return { data: [] as import("./listings").Listing[], error };
  }

}

/* =========================
   SEARCH ALERTS (HAKUVAHTI)
========================= */

export type SearchAlert = {
  id: string;
  user_id: string;
  label: string;
  vehicle_type?: string | null;
  category?: string | null;
  subcategory?: string | null;
  query?: string | null;
  brand?: string | null;
  year_min?: number | null;
  year_max?: number | null;
  condition?: string | null;
  max_price?: number | null;
  is_active: boolean;
  created_at: string;
};

export type SearchAlertInput = {
  user_id: string;
  label: string;
  vehicle_type?: string | null;
  category?: string | null;
  subcategory?: string | null;
  query?: string | null;
  brand?: string | null;
  year_min?: number | null;
  year_max?: number | null;
  condition?: string | null;
  max_price?: number | null;
};

export async function getSearchAlerts(userId: string) {
  if (!supabase) return { data: [] as SearchAlert[], error: null };
  try {
    const { data, error } = await supabase
      .from("search_alerts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .returns<SearchAlert[]>();
    return { data: data ?? [], error };
  } catch (error) {
    return { data: [] as SearchAlert[], error };
  }
}

export async function createSearchAlert(alert: SearchAlertInput) {
  if (!supabase) return { data: null, error: new Error("Ei yhteyttä") };
  try {
    // Build payload with only non-null values to avoid errors on missing columns
    const payload: Record<string, unknown> = { user_id: alert.user_id, label: alert.label };
    if (alert.vehicle_type != null) payload.vehicle_type = alert.vehicle_type;
    if (alert.category    != null) payload.category     = alert.category;
    if (alert.subcategory != null) payload.subcategory  = alert.subcategory;
    if (alert.query       != null) payload.query        = alert.query;
    if (alert.brand       != null) payload.brand        = alert.brand;
    if (alert.year_min    != null) payload.year_min     = alert.year_min;
    if (alert.year_max    != null) payload.year_max     = alert.year_max;
    if (alert.condition   != null) payload.condition    = alert.condition;
    if (alert.max_price   != null) payload.max_price    = alert.max_price;
    const { data, error } = await supabase
      .from("search_alerts")
      .insert(payload)
      .select()
      .single<SearchAlert>();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteSearchAlert(alertId: string) {
  if (!supabase) return { error: new Error("Ei yhteyttä") };
  try {
    const { error } = await supabase
      .from("search_alerts")
      .delete()
      .eq("id", alertId);
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function updateSearchAlert(alertId: string, input: Omit<SearchAlertInput, "user_id">) {
  if (!supabase) return { error: new Error("Ei yhteyttä") };
  try {
    const { error } = await supabase
      .from("search_alerts")
      .update({
        label:        input.label,
        vehicle_type: input.vehicle_type ?? null,
        category:     input.category ?? null,
        subcategory:  input.subcategory ?? null,
        query:        input.query ?? null,
        brand:        input.brand ?? null,
        year_min:     input.year_min ?? null,
        year_max:     input.year_max ?? null,
        condition:    input.condition ?? null,
        max_price:    input.max_price ?? null,
      })
      .eq("id", alertId);
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function toggleSearchAlert(alertId: string, isActive: boolean) {
  if (!supabase) return { error: new Error("Ei yhteyttä") };
  try {
    const { error } = await supabase
      .from("search_alerts")
      .update({ is_active: isActive })
      .eq("id", alertId);
    return { error };
  } catch (error) {
    return { error };
  }
}

/* =========================
   ALERT NOTIFICATIONS (IN-APP)
========================= */

export type AlertNotification = {
  id: string;
  user_id: string;
  alert_id: string;
  listing_id: string;
  listing_title: string;
  listing_price: number | null;
  listing_image_url: string | null;
  alert_label: string;
  seen: boolean;
  created_at: string;
};

export async function getAlertNotifications(userId: string) {
  if (!supabase) return { data: [] as AlertNotification[], error: null };
  try {
    const { data, error } = await supabase
      .from("alert_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return { data: (data ?? []) as AlertNotification[], error };
  } catch (error) {
    return { data: [] as AlertNotification[], error };
  }
}

export async function getListingsMatchingAlert(alert: SearchAlert) {
  if (!supabase) return { data: [], error: null };
  try {
    const buildQuery = (includePartNumber: boolean) => {
      let q = supabase
        .from("listings")
        .select(includePartNumber ? LISTING_CARD_SELECT : BASE_LISTING_CARD_SELECT);
      if (alert.vehicle_type) q = q.eq("vehicle_type", alert.vehicle_type);
      if (alert.category)     q = q.eq("category", alert.category);
      if (alert.subcategory)  q = q.eq("subcategory", alert.subcategory);
      if (alert.condition)    q = q.eq("condition", alert.condition);
      if (alert.brand)        q = q.ilike("brand", `%${escapeIlikeTerm(alert.brand)}%`);
      if (alert.year_min)     q = q.gte("year", alert.year_min);
      if (alert.year_max)     q = q.lte("year", alert.year_max);
      if (alert.max_price != null) q = q.lte("price", alert.max_price);
      if (alert.query) {
        const term = escapeIlikeTerm(alert.query);
        const fields = [
          `title.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `brand.ilike.%${term}%`
        ];
        if (includePartNumber) fields.push(`part_number.ilike.%${term}%`);
        q = q.or(fields.join(","));
      }
      return q.order("created_at", { ascending: false }).limit(20).returns<Listing[]>();
    };

    let { data, error } = await buildQuery(true);
    if (hasMissingListingColumns(error)) {
      ({ data, error } = await buildQuery(false));
    }
    return { data: data ?? [], error };
  } catch (error) {
    return { data: [], error };
  }
}

export async function markNotificationsSeen(userId: string) {
  if (!supabase) return { error: null };
  try {
    const { error } = await supabase
      .from("alert_notifications")
      .update({ seen: true })
      .eq("user_id", userId)
      .eq("seen", false);
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function deleteAlertNotification(notificationId: string) {
  if (!supabase) return { error: null };

  try {
    const { error } = await supabase
      .from("alert_notifications")
      .delete()
      .eq("id", notificationId);

    return { error };
  } catch (error) {
    return { error };
  }
}

/* =========================
   REWARDS / REFERRALS
========================= */

export async function getReferrerIdByCode(code: string): Promise<string | null> {
  if (!supabase || !code) return null;
  try {
    const { data, error } = await supabase.rpc("get_referrer_id_by_code", { p_code: code });
    if (error) return null;
    return (data as string) || null;
  } catch {
    return null;
  }
}

export async function awardReferralPoints(
  referrerId: string,
  referredId: string,
  points = 100
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "no_supabase" };
  try {
    const { data, error } = await supabase.rpc("award_referral_points", {
      p_referrer_id: referrerId,
      p_referred_id: referredId,
      p_points: points
    });
    if (error) return { success: false, error: error.message };
    const result = data as { success: boolean; error?: string } | null;
    return result ?? { success: false, error: "unknown" };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export type QuestProgress = {
  listings: number;
  reviews_given: number;
  reviews_received: number;
  referrals: number;
  phone_verified: boolean;
  profile_completed: boolean;
  claimed: string[];
};

export async function getQuestProgress(userId: string): Promise<QuestProgress | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("get_quest_progress", { p_user_id: userId });
    if (error) {
      console.error("getQuestProgress error", error);
      return null;
    }
    return data as QuestProgress;
  } catch (e) {
    console.error("getQuestProgress exception", e);
    return null;
  }
}

export async function claimQuest(questId: string): Promise<{
  success: boolean;
  points?: number;
  error?: string;
  progress?: number;
  required?: number;
}> {
  if (!supabase) return { success: false, error: "no_supabase" };
  try {
    const { data, error } = await supabase.rpc("claim_quest", { p_quest_id: questId });
    if (error) return { success: false, error: error.message };
    return (data ?? { success: false, error: "unknown" }) as {
      success: boolean;
      points?: number;
      error?: string;
      progress?: number;
      required?: number;
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function getMyReferralStats(userId: string): Promise<{
  points: number;
  referralCode: string | null;
  referrals: Array<Referral & { referred_name?: string | null }>;
}> {
  if (!supabase) return { points: 0, referralCode: null, referrals: [] };
  try {
    const profileResult = await supabase
      .from("profiles")
      .select("points, referral_code")
      .eq("id", userId)
      .maybeSingle<Pick<UserProfile, "points" | "referral_code">>();

    const referralsResult = await supabase
      .from("referrals")
      .select("id, referrer_id, referred_id, points_awarded, created_at")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false });

    const referrals = (referralsResult.data ?? []) as Referral[];

    let withNames: Array<Referral & { referred_name?: string | null }> = referrals.map((r) => ({ ...r }));

    if (referrals.length > 0) {
      const ids = referrals.map((r) => r.referred_id);
      const namesResult = await supabase
        .from("profiles")
        .select("id, first_name, last_name, full_name, name")
        .in("id", ids);

      const nameMap = new Map<string, string>();
      for (const p of (namesResult.data ?? []) as Partial<UserProfile>[]) {
        const n =
          p.full_name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
          p.name ||
          "";
        if (p.id) nameMap.set(String(p.id), n);
      }

      withNames = referrals.map((r) => ({
        ...r,
        referred_name: nameMap.get(r.referred_id) ?? null
      }));
    }

    return {
      points: profileResult.data?.points ?? 0,
      referralCode: profileResult.data?.referral_code ?? null,
      referrals: withNames
    };
  } catch {
    return { points: 0, referralCode: null, referrals: [] };
  }
}

export async function spendUserPoints(
  userId: string,
  cost: number
): Promise<{
  success: boolean;
  points: number;
  error?: string;
}> {
  if (!supabase || !userId) return { success: false, points: 0, error: "no_supabase" };

  try {
    const profileResult = await supabase
      .from("profiles")
      .select("points")
      .eq("id", userId)
      .maybeSingle<Pick<UserProfile, "points">>();

    if (profileResult.error) {
      return { success: false, points: 0, error: profileResult.error.message };
    }

    const currentPoints = profileResult.data?.points ?? 0;

    if (currentPoints < cost) {
      return { success: false, points: currentPoints, error: "not_enough_points" };
    }

    const nextPoints = currentPoints - cost;
    const updateResult = await supabase
      .from("profiles")
      .update({ points: nextPoints })
      .eq("id", userId)
      .select("points")
      .single<Pick<UserProfile, "points">>();

    if (updateResult.error) {
      return { success: false, points: currentPoints, error: updateResult.error.message };
    }

    return { success: true, points: updateResult.data?.points ?? nextPoints };
  } catch (error) {
    return { success: false, points: 0, error: String(error) };
  }
}

/* =========================
   USER ACTIVITY / PERSONALIZED RECOMMENDATIONS
========================= */

export type UserPreferenceProfile = {
  vehicle_types: Record<string, number>;
  brands: Record<string, number>;
  models: Record<string, number>;
  categories: Record<string, number>;
  search_terms: Record<string, number>;
};

export async function trackUserActivity(params: {
  vehicle_type?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  search_term?: string | null;
}) {
  if (!supabase) return;
  try {
    await supabase.rpc("track_user_activity", {
      p_vehicle_type: params.vehicle_type ?? null,
      p_brand: params.brand ?? null,
      p_model: params.model ?? null,
      p_category: params.category ?? null,
      p_search_term: params.search_term ?? null
    });
  } catch {
    /* silent – tracking should never break UX */
  }
}

export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ url: string | null; error: unknown }> {
  if (!supabase) return { url: null, error: new Error("Supabase ei ole konfiguroitu.") };
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) return { url: null, error: uploadError };

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const url = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", userId);

    return { url, error: updateError };
  } catch (error) {
    return { url: null, error };
  }
}

export async function getUserPreferenceProfile(
  userId: string
): Promise<{ data: UserPreferenceProfile | null; error: unknown }> {
  if (!supabase || !userId) return { data: null, error: null };
  try {
    return await supabase
      .from("user_preference_profile")
      .select("vehicle_types, brands, models, categories, search_terms")
      .eq("user_id", userId)
      .maybeSingle<UserPreferenceProfile>();
  } catch (error) {
    return { data: null, error };
  }
}
