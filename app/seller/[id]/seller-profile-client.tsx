"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Bell, Building2, CalendarDays, Check, ChevronDown, CircleX, Clock3, Crosshair, ExternalLink, Globe2, Heart, MapPin, Menu, MessageCircle, RotateCcw, Search, Shield, ShoppingBag, SlidersHorizontal, Star, Tag, TrendingDown, TrendingUp, Trophy, UserCheck, UserPlus, Users } from "lucide-react";
import { formatPrice, normalizeVehicleType, type Listing } from "@/lib/listings";
import { useLanguage, translateCategory, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { getCountryFlagFromLocation } from "@/lib/country-flags";
import { calculateSellerLevel } from "@/lib/seller-level";
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";
import { readCachedListings } from "@/lib/client-listings-cache";
import { listingPath, listingUrlId, pagePath, profilePath } from "@/lib/routes";
import { buildVehicleCategoriesFromTaxonomy, categoriesAsRecord, vehicleBrandsRecord } from "@/lib/taxonomy";
import { useTaxonomy } from "@/app/components/TaxonomyProvider";
import {
  getPublicListingsBySeller,
  getSavedListingIds,
  getProfileFollowStats,
  getSellerReviewLikeSummary,
  getPublicProfile,
  getPublicSellerLevelStats,
  getReviewsBySeller,
  ensureListingTranslations,
  followProfile,
  saveListing,
  supabase,
  unsaveListing,
  unfollowProfile,
  type ProfileFollowStats,
  type SellerLevelStats,
  type SellerReview,
  type UserProfile
} from "@/lib/supabase";

const CategoryDrawer = dynamic(() => import("@/app/components/CategoryDrawer"), {
  ssr: false,
  loading: () => null
});

type PublicProfile = Pick<
  UserProfile,
  | "id"
  | "public_id"
  | "account_type"
  | "first_name"
  | "last_name"
  | "full_name"
  | "company_name"
  | "business_id"
  | "company_role"
  | "company_website"
  | "company_verified_at"
  | "public_address"
  | "phone"
  | "city"
  | "country"
  | "bio"
  | "avatar_url"
  | "created_at"
  | "phone_verified_at"
>;

function formatAccountAge(value: string | undefined, locale: string) {
  if (!value) return "";
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return "";
  return created.toLocaleDateString(
    locale === "fi" ? "fi-FI"
    : locale === "sv" ? "sv-SE"
    : locale === "no" ? "nb-NO"
    : locale === "et" ? "et-EE"
    : "en-US",
    { day: "numeric", month: "long", year: "numeric" }
  );
}

function formatWebsiteUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const href = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(href);
    return {
      href: url.toString(),
      label: url.hostname.replace(/^www\./i, "")
    };
  } catch {
    return null;
  }
}

function formatListingDate(value: string | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(
    locale === "fi" ? "fi-FI"
    : locale === "sv" ? "sv-SE"
    : locale === "no" ? "nb-NO"
    : locale === "et" ? "et-EE"
    : "en-US",
    { day: "numeric", month: "numeric", year: "numeric" }
  );
}

function isSellerListingNew(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created < 24 * 60 * 60 * 1000;
}

function formatListingLocation(location: string | undefined, fallbackCountry: string) {
  const cityOrLocation = location?.trim() ?? "";
  const country = fallbackCountry.trim();

  if (!cityOrLocation) return country;
  if (!country || getCountryFlagFromLocation(cityOrLocation)) return cityOrLocation;
  return `${cityOrLocation}, ${country}`;
}

function listingFallbackImageSrc(listing: Listing, index = 0) {
  const haystack = [
    listing.title,
    listing.description,
    listing.category,
    listing.subcategory,
    listing.vehicle_type,
    listing.brand,
    listing.model
  ].filter(Boolean).join(" ").toLowerCase();

  if (haystack.includes("iskun") || haystack.includes("shock") || haystack.includes("jous")) {
    return "/category-sub/iskunvaimentimet.png";
  }
  if (haystack.includes("telasto") || haystack.includes("tela") || haystack.includes("track")) {
    return "/category-sub/telasto.png";
  }
  if (haystack.includes("moottorikelkka") || haystack.includes("ski-doo") || haystack.includes("lynx")) {
    return "/vehicles/moottorikelkka.png";
  }
  if (haystack.includes("voimansiirto") || haystack.includes("kytkin") || haystack.includes("ketju")) {
    return "/category-main/moottori-voimansiirto.png";
  }
  if (haystack.includes("moottori") || haystack.includes("mäntä") || haystack.includes("männ") || haystack.includes("engine")) {
    return "/category-sub/moottorit.png";
  }

  const fallbacks = [
    "/category-sub/moottorit.png",
    "/vehicles/moottorikelkka.png",
    "/category-main/moottori-voimansiirto.png",
    "/category-sub/iskunvaimentimet.png",
    "/category-sub/telasto.png"
  ];
  return fallbacks[index % fallbacks.length];
}

function listingImageSrc(listing: Listing, index = 0) {
  return listing.image_url || listing.image_urls?.find(Boolean) || listingFallbackImageSrc(listing, index);
}

function readSavedListingIds() {
  try {
    const saved = JSON.parse(localStorage.getItem("savedListings") || "[]");
    return Array.isArray(saved)
      ? saved.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function normalizeSellerFilterText(value?: string | null) {
  return (value ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´.]/g, "")
    .replace(/[^a-z0-9åäö]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sellerTextMatches(haystack: string, needle: string) {
  const normalizedNeedle = normalizeSellerFilterText(needle);
  if (!normalizedNeedle) return true;

  const normalizedHaystack = normalizeSellerFilterText(haystack);

  return (
    normalizedHaystack.includes(normalizedNeedle) ||
    normalizedHaystack.replace(/\s+/g, "").includes(normalizedNeedle.replace(/\s+/g, ""))
  );
}

function normalizeCategoryFilter(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "moottori") return "moottori & voimansiirto";
  if (normalized === "sähkö") return "sähköjärjestelmät";
  if (normalized === "pakoputki") return "pakoputkisto";
  if (normalized === "alusta" || normalized === "jousitus") return "alusta & telasto";
  if (normalized === "runko") return "runko & katteet";
  return normalized;
}

function normalizeSubcategoryFilter(value?: string | null) {
  return (value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase() ?? "";
}

function categoryLeaf(value: string) {
  return value.split("/").map((part) => part.trim()).filter(Boolean).at(-1) ?? value;
}

function formatReviewAge(value: string | undefined, locale: Locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / dayMs));

  if (locale === "fi") {
    if (diffDays === 0) return "Tänään";
    if (diffDays === 1) return "1 päivä sitten";
    if (diffDays < 7) return `${diffDays} päivää sitten`;
    const weeks = Math.floor(diffDays / 7);
    if (weeks === 1) return "1 viikko sitten";
    if (weeks < 5) return `${weeks} viikkoa sitten`;
  }

  return formatAccountAge(value, locale);
}

function getReviewInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return initials || "AR";
}

function getSellerInitials(name: string, locale: Locale) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return initials.toLocaleUpperCase(locale === "fi" ? "fi-FI" : undefined) || "?";
}

type TabKey = "listings" | "reviews" | "about";
type ListingSort = "relevance" | "newest" | "oldest" | "priceAsc" | "priceDesc" | "nearest";
type ReviewSort = "newest" | "oldest" | "highest" | "lowest";

type SellerProfileCache = {
  profile: PublicProfile | null;
  listings: Listing[];
  reviews: SellerReview[];
  levelStats?: SellerLevelStats;
};

const SELLER_LISTINGS_PAGE_SIZE = 40;

const emptySellerLevelStats: SellerLevelStats = {
  listings_created: 0,
  single_listings_created: 0,
  multi_listings_created: 0,
  sold_count: 0,
  reviews_given: 0,
  reviews_received: 0,
  phone_verified: false
};

function writeSellerProfileCachePatch(
  sellerId: string,
  patch: Partial<SellerProfileCache>
) {
  const cacheKey = `seller-profile:${sellerId}`;
  const cached = readCachedResource<SellerProfileCache>(cacheKey);

  writeCachedResource(cacheKey, {
    profile: patch.profile ?? cached?.profile ?? null,
    listings: patch.listings ?? cached?.listings ?? [],
    reviews: patch.reviews ?? cached?.reviews ?? [],
    levelStats: patch.levelStats ?? cached?.levelStats
  });
}

function SellerTabLoading({ label }: { label: string }) {
  return (
    <div className="seller-tab-loading" role="status" aria-live="polite">
      <span className="seller-tab-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

const vehicleTypeTranslations: Record<Locale, Record<string, string>> = {
  fi: {},
  en: { Moottorikelkka: "Snowmobile", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
  sv: { Moottorikelkka: "Snöskoter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
  no: { Moottorikelkka: "Snøscooter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
  et: { Moottorikelkka: "Mootorsaan", Mönkijä: "ATV", Motocross: "Motokross", Mopot: "Mopeed" }
};

export default function SellerProfileClient({ sellerId }: { sellerId: string }) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const taxonomy = useTaxonomy();
  const partsCategories = useMemo(() => categoriesAsRecord(taxonomy), [taxonomy]);
  const vehicleBrands = useMemo(() => vehicleBrandsRecord(taxonomy), [taxonomy]);
  const vehicleCategories = useMemo(() => {
    const out: Record<string, Record<string, string[]>> = {};
    for (const vehicle of taxonomy.vehicles) {
      out[vehicle.key] = buildVehicleCategoriesFromTaxonomy(taxonomy, vehicle.key);
    }
    return out;
  }, [taxonomy]);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>(() =>
    readCachedListings().filter((listing) => listing.seller_id === sellerId)
  );
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [levelStats, setLevelStats] = useState<SellerLevelStats>(emptySellerLevelStats);
  const [activeTab, setActiveTab] = useState<TabKey>("listings");
  const [listingsLoaded, setListingsLoaded] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showListingsLoader, setShowListingsLoader] = useState(false);
  const [showReviewsLoader, setShowReviewsLoader] = useState(false);
  const [sellerListingPage, setSellerListingPage] = useState(1);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [listingSort, setListingSort] = useState<ListingSort>("relevance");
  const [sortOpen, setSortOpen] = useState(false);
  const [reviewRatingFilter, setReviewRatingFilter] = useState(0);
  const [reviewSort, setReviewSort] = useState<ReviewSort>("newest");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOpenStep, setDrawerOpenStep] = useState<number | undefined>(undefined);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [engineCcFilter, setEngineCcFilter] = useState("");
  const [engineModelFilter, setEngineModelFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [followStats, setFollowStats] = useState<ProfileFollowStats>({
    follower_count: 0,
    following_count: 0,
    is_following: false
  });
  const [followSaving, setFollowSaving] = useState(false);
  const [followError, setFollowError] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const resolvedSellerId = profile?.id ?? sellerId;
  const listingsSellerId = resolvedSellerId;

  function getListingTitle(listing: Listing): string {
    const localized = getLocalizedListingText(listing, locale);
    if (locale === "fi") return localized.title;
    const leaf = listing.subcategory?.split("/").map((p) => p.trim()).filter(Boolean).at(-1);
    if (!leaf) return localized.title;
    const knownVehicleTypes = Object.keys(vehicleTypeTranslations.en);
    const vehicleType = listing.vehicle_type
      ?? knownVehicleTypes.find((vt) => listing.title.toLowerCase().endsWith(` - ${vt.toLowerCase()}`))
      ?? null;
    const expectedFi = vehicleType ? `${leaf} - ${vehicleType}` : leaf;
    const isGenerated = listing.title.trim().toLowerCase() === expectedFi.trim().toLowerCase();
    if (!isGenerated) return localized.title;
    const translatedSub = translateCategory(locale, listing.subcategory ?? "");
    const subParts = translatedSub.split("/").map((p) => p.trim()).filter(Boolean);
    const translatedLeaf = subParts.at(-1) !== leaf ? (subParts.at(-1) ?? leaf) : (translateCategory(locale, leaf) !== leaf ? translateCategory(locale, leaf) : leaf);
    const translatedVehicle = vehicleType ? (vehicleTypeTranslations[locale]?.[vehicleType] ?? vehicleType) : "";
    return (translatedVehicle ? `${translatedLeaf} - ${translatedVehicle}` : translatedLeaf).trim();
  }

  const filteredListings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const copy = listings.filter((listing) => {
      const localized = getLocalizedListingText(listing, locale);
      const haystack = [
        localized.title,
        localized.description,
        listing.title,
        listing.description,
        listing.brand,
        listing.model,
        listing.vehicle_type,
        listing.category,
        listing.subcategory,
        listing.part_number,
        listing.location
      ].filter(Boolean).join(" ").toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (vehicleTypeFilter) {
        const selectedVehicle = normalizeVehicleType(vehicleTypeFilter);
        const listingVehicle = normalizeVehicleType(listing.vehicle_type ?? "");
        if (listingVehicle) {
          if (listingVehicle !== selectedVehicle) return false;
        } else if (!sellerTextMatches(haystack, selectedVehicle)) {
          return false;
        }
      }
      if (brandFilter && !sellerTextMatches([listing.brand, listing.model, haystack].filter(Boolean).join(" "), brandFilter)) return false;
      if (modelFilter && !sellerTextMatches([listing.model, haystack].filter(Boolean).join(" "), modelFilter)) return false;
      if (yearFilter && !sellerTextMatches([listing.year, haystack].filter(Boolean).join(" "), yearFilter)) return false;
      if (engineCcFilter && !sellerTextMatches([listing.engine_cc, haystack].filter(Boolean).join(" "), engineCcFilter)) return false;
      if (engineModelFilter && !sellerTextMatches([listing.engine_model, haystack].filter(Boolean).join(" "), engineModelFilter)) return false;
      if (categoryFilter && normalizeCategoryFilter(listing.category) !== normalizeCategoryFilter(categoryFilter)) return false;
      if (subcategoryFilter) {
        const selectedSub = normalizeSubcategoryFilter(subcategoryFilter);
        const listingSub = normalizeSubcategoryFilter(listing.subcategory);
        if (listingSub !== selectedSub && !sellerTextMatches(haystack, categoryLeaf(subcategoryFilter))) return false;
      }
      return true;
    });

    return copy.sort((a, b) => {
      if (listingSort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (listingSort === "priceAsc") return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (listingSort === "priceDesc") return Number(b.price ?? 0) - Number(a.price ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [brandFilter, categoryFilter, engineCcFilter, engineModelFilter, listingSort, listings, locale, modelFilter, searchQuery, subcategoryFilter, vehicleTypeFilter, yearFilter]);

  const sellerListingTotalPages = Math.max(
    1,
    Math.ceil(filteredListings.length / SELLER_LISTINGS_PAGE_SIZE)
  );

  const paginatedSellerListings = useMemo(() => {
    const start = (sellerListingPage - 1) * SELLER_LISTINGS_PAGE_SIZE;
    return filteredListings.slice(start, start + SELLER_LISTINGS_PAGE_SIZE);
  }, [filteredListings, sellerListingPage]);

  const hasAdvancedFilters =
    searchQuery.trim() !== "" ||
    vehicleTypeFilter.trim() !== "" ||
    brandFilter.trim() !== "" ||
    modelFilter.trim() !== "" ||
    yearFilter.trim() !== "" ||
    engineCcFilter.trim() !== "" ||
    engineModelFilter.trim() !== "" ||
    categoryFilter.trim() !== "" ||
    subcategoryFilter.trim() !== "";

  const categoryFilterSummary = useMemo(() => {
    const parts = [
      vehicleTypeFilter,
      brandFilter,
      modelFilter,
      yearFilter,
      engineCcFilter,
      engineModelFilter,
      categoryFilter ? translateCategory(locale, categoryFilter) : "",
      subcategoryFilter ? translateCategory(locale, categoryLeaf(subcategoryFilter)) : ""
    ].filter(Boolean);

    return parts.join(" / ");
  }, [brandFilter, categoryFilter, engineCcFilter, engineModelFilter, locale, modelFilter, subcategoryFilter, vehicleTypeFilter, yearFilter]);
  const reviewIds = useMemo(() => reviews.map((review) => review.id), [reviews]);
  const reviewIdsKey = reviewIds.join("|");

  function resetListingFilters() {
    setSearchQuery("");
    setVehicleTypeFilter("");
    setBrandFilter("");
    setModelFilter("");
    setYearFilter("");
    setEngineCcFilter("");
    setEngineModelFilter("");
    setCategoryFilter("");
    setSubcategoryFilter("");
  }

  useEffect(() => {
    if (locale === "fi" || listings.length === 0) return;

    let cancelled = false;
    const visibleListings = listings.slice(0, 12);

    async function translateSellerListings() {
      for (const listing of visibleListings) {
        if (cancelled) return;

        const key = `sp-translation-attempt:${listing.id}:${locale}`;
        if (sessionStorage.getItem(key)) continue;
        sessionStorage.setItem(key, "1");

        const { data } = await ensureListingTranslations(listing);
        if (!cancelled && data?.translations) {
          setListings((current) =>
            current.map((item) =>
              item.id === data.id ? { ...item, ...data } : item
            )
          );
        }
      }
    }

    void translateSellerListings();

    return () => {
      cancelled = true;
    };
  }, [listings, locale]);

  useEffect(() => {
    const cacheKey = `seller-profile:${sellerId}`;
    const cached = readCachedResource<SellerProfileCache>(cacheKey);

    setListings(readCachedListings().filter((listing) => listing.seller_id === sellerId));
    setReviews([]);
    setListingsLoaded(false);
    setReviewsLoaded(false);
    setListingsLoading(false);
    setReviewsLoading(false);
    setSellerListingPage(1);

    if (cached) {
      setProfile(cached.profile);
      setListings(cached.listings);
      setListingsLoaded(cached.listings.length > 0);
      if (cached.levelStats) setLevelStats(cached.levelStats);
    } else {
      setProfile(null);
      setLevelStats(emptySellerLevelStats);
    }

    let cancelled = false;

    getPublicProfile(sellerId).then(({ data }) => {
      if (!cancelled && data) {
        setProfile(data);
        writeSellerProfileCachePatch(sellerId, { profile: data });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  useEffect(() => {
    let cancelled = false;

    getPublicSellerLevelStats(resolvedSellerId).then(({ data }) => {
      if (!cancelled && data) {
        setLevelStats(data);
        writeSellerProfileCachePatch(sellerId, { levelStats: data });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resolvedSellerId, sellerId]);

  useEffect(() => {
    setSellerListingPage(1);
  }, [
    brandFilter,
    categoryFilter,
    engineCcFilter,
    engineModelFilter,
    listingSort,
    modelFilter,
    searchQuery,
    sellerId,
    subcategoryFilter,
    vehicleTypeFilter,
    yearFilter
  ]);

  useEffect(() => {
    if (sellerListingPage > sellerListingTotalPages) {
      setSellerListingPage(sellerListingTotalPages);
    }
  }, [sellerListingPage, sellerListingTotalPages]);

  useEffect(() => {
    if (activeTab !== "listings") return;

    const cacheKey = `seller-profile:${sellerId}`;
    const cached = readCachedResource<SellerProfileCache>(cacheKey);
    if (cached?.listings.length) {
      setListings(cached.listings);
      setListingsLoaded(true);
    }

    let cancelled = false;
    setListingsLoading(true);

    getPublicListingsBySeller(listingsSellerId)
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setListings(data);
          writeSellerProfileCachePatch(sellerId, { listings: data });
        }
        setListingsLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setListingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, listingsSellerId, sellerId]);

  useEffect(() => {
    if (reviewsLoaded) return;

    const cacheKey = `seller-profile:${sellerId}`;
    const cached = readCachedResource<SellerProfileCache>(cacheKey);
    if (cached?.reviews.length) {
      setReviews(cached.reviews);
      setReviewsLoaded(true);
    }

    let cancelled = false;
    setReviewsLoading(true);

    getReviewsBySeller(resolvedSellerId)
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setReviews(data);
          writeSellerProfileCachePatch(sellerId, { reviews: data });
        }
        setReviewsLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setReviewsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedSellerId, reviewsLoaded, sellerId]);

  useEffect(() => {
    if (!listingsLoading) {
      setShowListingsLoader(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowListingsLoader(true);
    }, 280);

    return () => {
      window.clearTimeout(timer);
    };
  }, [listingsLoading]);

  useEffect(() => {
    if (!reviewsLoading) {
      setShowReviewsLoader(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowReviewsLoader(true);
    }, 280);

    return () => {
      window.clearTimeout(timer);
    };
  }, [reviewsLoading]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [profile?.avatar_url]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setFavorites(readSavedListingIds());

    if (!currentUserId) return;

    getSavedListingIds()
      .then(({ data }) => {
        localStorage.setItem("savedListings", JSON.stringify(data));
        setFavorites(data);
      })
      .catch(() => undefined);
  }, [currentUserId]);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    getProfileFollowStats(resolvedSellerId).then(({ data }) => {
      if (!cancelled) setFollowStats(data);
    });

    return () => {
      cancelled = true;
    };
  }, [authReady, currentUserId, resolvedSellerId]);

  useEffect(() => {
    const ids = reviewIdsKey ? reviewIdsKey.split("|") : [];
    if (ids.length === 0) return;

    let cancelled = false;

    getSellerReviewLikeSummary(ids).then(({ data }) => {
      if (cancelled || data.length === 0) return;

      const summaryByReview = new Map(
        data.map((item) => [item.review_id, item])
      );

      setReviews((current) =>
        current.map((review) => {
          const summary = summaryByReview.get(review.id);
          return summary
            ? {
                ...review,
                like_count: summary.like_count,
                is_liked: summary.is_liked
              }
            : review;
        })
      );
    });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, reviewIdsKey]);

  async function handleProfileFollowToggle() {
    if (!currentUserId || currentUserId === resolvedSellerId || followSaving) return;

    setFollowSaving(true);
    setFollowError("");
    const result = followStats.is_following
      ? await unfollowProfile(resolvedSellerId)
      : await followProfile(resolvedSellerId);

    if (result.error) {
      setFollowError(result.error instanceof Error ? result.error.message : refLabels.followError);
    } else {
      const { data } = await getProfileFollowStats(resolvedSellerId);
      setFollowStats(data);
      window.dispatchEvent(new CustomEvent("profile-follow-changed"));
    }

    setFollowSaving(false);
  }

  function toggleFavorite(event: React.MouseEvent, listingId: string) {
    event.preventDefault();
    event.stopPropagation();

    if (!currentUserId) return;

    setFavorites((current) => {
      const next = current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId];

      localStorage.setItem("savedListings", JSON.stringify(next));
      void (
        current.includes(listingId)
          ? unsaveListing(listingId)
          : saveListing(listingId)
      );

      return next;
    });
  }

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [reviews]);

  const reviewRatingCounts = useMemo(() => {
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((review) => Math.min(5, Math.max(1, Math.round(review.rating))) === stars).length
    }));
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const filtered = reviews.filter((review) => {
      const rating = Math.min(5, Math.max(1, Math.round(review.rating)));
      if (reviewRatingFilter && rating !== reviewRatingFilter) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime() || 0;
      const bTime = new Date(b.created_at).getTime() || 0;
      if (reviewSort === "oldest") return aTime - bTime;
      if (reviewSort === "highest") return b.rating - a.rating || bTime - aTime;
      if (reviewSort === "lowest") return a.rating - b.rating || bTime - aTime;
      return bTime - aTime;
    });
  }, [reviewRatingFilter, reviewSort, reviews]);

  const sellerName =
    profile?.account_type === "company"
      ? profile.company_name || profile.full_name || listings[0]?.seller_name || t.authCompanyLabel
      :
    profile?.full_name ||
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
    listings[0]?.seller_name ||
    t.sellerProfile;
  const sellerAvatarUrl = profile?.avatar_url?.trim() || "";
  const showSellerAvatar = Boolean(sellerAvatarUrl && !avatarFailed);
  const sellerInitial = getSellerInitials(sellerName, locale);
  const isCompany =
    profile?.account_type === "company";
  const locationFallback = {
    fi: "Sijaintia ei ole asetettu",
    en: "Location not set",
    sv: "Plats har inte angetts",
    no: "Sted er ikke angitt",
    et: "Asukohta pole määratud"
  }[locale];
  const publicAddress =
    profile?.public_address?.trim();
  const baseLocation =
    [profile?.city, profile?.country].filter(Boolean).join(", ");
  const sellerLocation =
    isCompany && publicAddress
      ? [baseLocation, publicAddress].filter(Boolean).join(" - ")
      : baseLocation ||
    listings[0]?.location ||
    locationFallback;
  const companyWebsite =
    isCompany ? formatWebsiteUrl(profile?.company_website) : null;
  const effectiveLevelStats = useMemo<SellerLevelStats>(() => ({
    listings_created: Math.max(levelStats.listings_created, listings.length),
    single_listings_created:
      levelStats.listings_created > 0
        ? levelStats.single_listings_created
        : listings.filter((listing) => listing.listing_mode !== "multiple").length,
    multi_listings_created:
      levelStats.listings_created > 0
        ? levelStats.multi_listings_created
        : listings.filter((listing) => listing.listing_mode === "multiple").length,
    sold_count: levelStats.sold_count,
    reviews_given: levelStats.reviews_given,
    reviews_received: Math.max(levelStats.reviews_received, reviews.length),
    phone_verified: levelStats.phone_verified || Boolean(profile?.phone_verified_at)
  }), [levelStats, listings, profile?.phone_verified_at, reviews.length]);

  const sellerLevel = useMemo(
    () => calculateSellerLevel(effectiveLevelStats),
    [effectiveLevelStats]
  );

  const memberSince = formatAccountAge(profile?.created_at, locale);
  const refLabels = {
    about: {
      fi: "Tietoja",
      en: "About",
      sv: "Om",
      no: "Om",
      et: "Info"
    }[locale],
    averageRating: {
      fi: "Keskiarvo",
      en: "Average rating",
      sv: "Genomsnitt",
      no: "Gjennomsnitt",
      et: "Keskmine hinne"
    }[locale],
    activeListings: {
      fi: "Aktiiviset ilmoitukset",
      en: "Active listings",
      sv: "Aktiva annonser",
      no: "Aktive annonser",
      et: "Aktiivsed kuulutused"
    }[locale],
    totalListings: {
      fi: "Ilmoituksia yhteensä",
      en: "Total listings",
      sv: "Annonser totalt",
      no: "Annonser totalt",
      et: "Kuulutusi kokku"
    }[locale],
    reviews: {
      fi: "Arvostelut",
      en: "Reviews",
      sv: "Recensioner",
      no: "Anmeldelser",
      et: "Arvustused"
    }[locale],
    followers: {
      fi: "Seuraajat",
      en: "Followers",
      sv: "Följare",
      no: "Følgere",
      et: "Jälgijad"
    }[locale],
    follow: {
      fi: "Seuraa profiilia",
      en: "Follow profile",
      sv: "Följ profil",
      no: "Følg profil",
      et: "Jälgi profiili"
    }[locale],
    following: {
      fi: "Seurataan",
      en: "Following",
      sv: "Följer",
      no: "Følger",
      et: "Jälgid"
    }[locale],
    loginToFollow: {
      fi: "Kirjaudu seurataksesi",
      en: "Sign in to follow",
      sv: "Logga in för att följa",
      no: "Logg inn for å følge",
      et: "Jälgimiseks logi sisse"
    }[locale],
    followError: {
      fi: "Seurannan tallennus epäonnistui. Yritä uudelleen.",
      en: "Could not save the follow. Please try again.",
      sv: "Det gick inte att spara följningen. Försök igen.",
      no: "Kunne ikke lagre følgingen. Prøv igjen.",
      et: "Jälgimise salvestamine ebaõnnestus. Proovi uuesti."
    }[locale],
    sellerRating: {
      fi: "Myyjäarvio",
      en: "Seller rating",
      sv: "Säljarbetyg",
      no: "Selgervurdering",
      et: "Müüja hinnang"
    }[locale],
    greatJob: {
      fi: "Hyvä työ!",
      en: "Great job!",
      sv: "Bra jobbat!",
      no: "Bra jobbet!",
      et: "Tubli töö!"
    }[locale],
    keepGoodWork: {
      fi: "Jatka samaan malliin.",
      en: "Keep up the good work.",
      sv: "Fortsätt så.",
      no: "Fortsett slik.",
      et: "Jätka samas vaimus."
    }[locale],
    completionRate: {
      fi: "Valmiusaste",
      en: "Completion rate",
      sv: "Slutförandegrad",
      no: "Fullføringsgrad",
      et: "Täidetuse määr"
    }[locale],
    points: {
      fi: "pistettä",
      en: "points",
      sv: "poäng",
      no: "poeng",
      et: "punkti"
    }[locale],
    sellerLevel: {
      fi: "Myyjälevel",
      en: "Seller level",
      sv: "Säljarnivå",
      no: "Selgernivå",
      et: "Müüja tase"
    }[locale],
    accountLevel: {
      fi: "Account level",
      en: "Account level",
      sv: "Account level",
      no: "Account level",
      et: "Account level"
    }[locale],
    registered: {
      fi: "Rekisteroitynyt",
      en: "Registered",
      sv: "Registrerad",
      no: "Registrert",
      et: "Registreeritud"
    }[locale],
    location: {
      fi: "Sijainti",
      en: "Location",
      sv: "Plats",
      no: "Sted",
      et: "Asukoht"
    }[locale],
    verified: {
      fi: "Vahvistettu",
      en: "Verified",
      sv: "Verifierad",
      no: "Verifisert",
      et: "Kinnitatud"
    }[locale],
    extraInfo: {
      fi: "Lisatiedot",
      en: "Additional info",
      sv: "Mer information",
      no: "Mer informasjon",
      et: "Lisainfo"
    }[locale],
    levelMax: {
      fi: "Maksimitaso",
      en: "Max level",
      sv: "Maxnivå",
      no: "Maksnivå",
      et: "Maksimaalne tase"
    }[locale],
    levelUpHint: {
      fi: "Luo ilmoituksia, merkitse myyntejä ja anna sekä saa arvioita.",
      en: "Create listings, mark sales, and give and receive reviews.",
      sv: "Skapa annonser, markera försäljningar och ge samt få recensioner.",
      no: "Opprett annonser, marker salg og gi og motta anmeldelser.",
      et: "Loo kuulutusi, märgi müüke ning anna ja saa arvustusi."
    }[locale],
    nextLevel: {
      fi: "Seuraavaan tasoon",
      en: "To next level",
      sv: "Till nästa nivå",
      no: "Til neste nivå",
      et: "Järgmise tasemeni"
    }[locale],
    xp: {
      fi: "XP",
      en: "XP",
      sv: "XP",
      no: "XP",
      et: "XP"
    }[locale],
    level: {
      fi: "Level",
      en: "Level",
      sv: "Level",
      no: "Level",
      et: "Level"
    }[locale],
    sold: {
      fi: "Myyty",
      en: "Sold",
      sv: "Sålda",
      no: "Solgt",
      et: "Müüdud"
    }[locale],
    reviewsGiven: {
      fi: "Annetut arviot",
      en: "Reviews given",
      sv: "Givna recensioner",
      no: "Gitte anmeldelser",
      et: "Antud arvustused"
    }[locale],
    phone: {
      fi: "Puhelin",
      en: "Phone",
      sv: "Telefon",
      no: "Telefon",
      et: "Telefon"
    }[locale],
    businessId: {
      fi: "Y-tunnus",
      en: "Business ID",
      sv: "FO-nummer",
      no: "Organisasjonsnummer",
      et: "Registrikood"
    }[locale],
    website: {
      fi: "Nettisivu",
      en: "Website",
      sv: "Webbplats",
      no: "Nettside",
      et: "Veebileht"
    }[locale],
    trustedSeller: {
      fi: "Luotettu myyjä",
      en: "Trusted seller",
      sv: "Betrodd säljare",
      no: "Betrodd selger",
      et: "Usaldatud müüja"
    }[locale],
    advancedSearch: {
      fi: "Tarkempi haku",
      en: "Advanced search",
      sv: "Avancerad sökning",
      no: "Avansert søk",
      et: "Täpsem otsing"
    }[locale],
    searchPlaceholder: {
      fi: "Hae ilmoituksista",
      en: "Search listings",
      sv: "Sök i annonser",
      no: "Søk i annonser",
      et: "Otsi kuulutustest"
    }[locale],
    minPrice: {
      fi: "Min €",
      en: "Min €",
      sv: "Min €",
      no: "Min €",
      et: "Min €"
    }[locale],
    maxPrice: {
      fi: "Max €",
      en: "Max €",
      sv: "Max €",
      no: "Max €",
      et: "Max €"
    }[locale],
    allConditions: {
      fi: "Kaikki kunnot",
      en: "All conditions",
      sv: "Alla skick",
      no: "Alle tilstander",
      et: "Kõik seisukorrad"
    }[locale],
    resetFilters: {
      fi: "Nollaa",
      en: "Reset",
      sv: "Nollställ",
      no: "Nullstill",
      et: "Lähtesta"
    }[locale],
    relevanceFirst: {
      fi: "Osuvimmat ensin",
      en: "Most relevant",
      sv: "Mest relevanta",
      no: "Mest relevante",
      et: "Asjakohasemad enne"
    }[locale],
    newestFirst: {
      fi: "Uusimmat ensin",
      en: "Newest first",
      sv: "Nyaste ensin",
      no: "Nyeste først",
      et: "Uuemad enne"
    }[locale],
    oldestFirst: {
      fi: "Vanhimmat ensin",
      en: "Oldest first",
      sv: "Aldsta ensin",
      no: "Eldste først",
      et: "Vanemad enne"
    }[locale],
    lowestPrice: {
      fi: "Halvin ensin",
      en: "Lowest price",
      sv: "Lagsta pris",
      no: "Laveste pris",
      et: "Madalaim hind"
    }[locale],
    highestPrice: {
      fi: "Kallein ensin",
      en: "Highest price",
      sv: "Hogsta pris",
      no: "Hoyeste pris",
      et: "Korgeim hind"
    }[locale],
    nearestFirst: {
      fi: "Lähimpänä sinua",
      en: "Nearest to you",
      sv: "Narmast dig",
      no: "Narmest deg",
      et: "Sulle lahemal"
    }[locale],
    noFilterResults: {
      fi: "Hakuehdoilla ei löytynyt ilmoituksia.",
      en: "No listings matched your filters.",
      sv: "Inga annonser matchade filtren.",
      no: "Ingen annonser matchet filtrene.",
      et: "Filtritele vastavaid kuulutusi ei leitud."
    }[locale],
    highlyRated: {
      fi: "Hyvin arvioitu",
      en: "Highly rated",
      sv: "Högt betyg",
      no: "Høyt vurdert",
      et: "Kõrgelt hinnatud"
    }[locale],
    noBio: {
      fi: "Myyjä ei ole vielä lisännyt esittelytekstiä.",
      en: "This seller has not added an about text yet.",
      sv: "Säljaren har inte lagt till någon presentation ännu.",
      no: "Selgeren har ikke lagt til en presentasjon ennå.",
      et: "Müüja pole veel tutvustust lisanud."
    }[locale]
  };
  const reviewCountLabel = reviews.length === 1 ? t.spReviews.toLowerCase().replace(/s$/, "") : t.spReviews.toLowerCase();
  const visibleReviewCount = reviewsLoaded ? reviews.length : effectiveLevelStats.reviews_received;
  const reviewBasisWord = locale === "fi" ? "arvosteluun" : reviewCountLabel;
  const loadingReviewsLabel = {
    fi: "Ladataan arvosteluja...",
    en: "Loading reviews...",
    sv: "Laddar recensioner...",
    no: "Laster anmeldelser...",
    et: "Laadin arvustusi..."
  }[locale];
  const reviewEmptyDescription = {
    fi: `${sellerName} ei ole vielä saanut arvosteluja.`,
    en: `${sellerName} has not received reviews yet.`,
    sv: `${sellerName} har inte fått några recensioner ännu.`,
    no: `${sellerName} har ikke fått anmeldelser ennå.`,
    et: `${sellerName} ei ole veel arvustusi saanud.`
  }[locale];
  const reviewLabels = {
    search: {
      fi: "Hae arvosteluista...",
      en: "Search reviews...",
      sv: "Sök bland recensioner...",
      no: "Søk i anmeldelser...",
      et: "Otsi arvustustest..."
    }[locale],
    average: {
      fi: "Keskimääräinen arvio",
      en: "Average rating",
      sv: "Genomsnittligt betyg",
      no: "Gjennomsnittlig vurdering",
      et: "Keskmine hinnang"
    }[locale],
    basedOn: {
      fi: "Perustuu",
      en: "Based on",
      sv: "Baserat på",
      no: "Basert på",
      et: "Põhineb"
    }[locale],
    verifiedTitle: {
      fi: "Vain vahvistetut kaupat",
      en: "Verified deals only",
      sv: "Endast verifierade affärer",
      no: "Kun verifiserte handler",
      et: "Ainult kinnitatud tehingud"
    }[locale],
    verifiedBody: {
      fi: "Arvostelut tulevat vain vahvistetuilta käyttäjiltä onnistuneiden kauppojen jälkeen.",
      en: "Reviews come only from verified users after successful deals.",
      sv: "Recensioner kommer bara från verifierade användare efter lyckade affärer.",
      no: "Anmeldelser kommer bare fra verifiserte brukere etter vellykkede handler.",
      et: "Arvustused tulevad ainult kinnitatud kasutajatelt pärast edukaid tehinguid."
    }[locale],
    starFilter: {
      fi: "Suodata tähtien mukaan",
      en: "Filter by stars",
      sv: "Filtrera efter stjärnor",
      no: "Filtrer etter stjerner",
      et: "Filtreeri tähtede järgi"
    }[locale],
    all: {
      fi: "Kaikki",
      en: "All",
      sv: "Alla",
      no: "Alle",
      et: "Kõik"
    }[locale],
    noMatches: {
      fi: "Hakuehdoilla ei löytynyt arvosteluja.",
      en: "No reviews matched your filters.",
      sv: "Inga recensioner matchade filtren.",
      no: "Ingen anmeldelser matchet filtrene.",
      et: "Filtritele vastavaid arvustusi ei leitud."
    }[locale],
    reply: {
      fi: "Vastaa",
      en: "Reply",
      sv: "Svara",
      no: "Svar",
      et: "Vasta"
    }[locale]
  };
  const reviewSortOptions: Array<{ value: ReviewSort; label: string }> = [
    { value: "newest", label: refLabels.newestFirst },
    { value: "oldest", label: refLabels.oldestFirst },
    { value: "highest", label: "Korkein arvio" },
    { value: "lowest", label: "Alhaisin arvio" }
  ];
  const renderReviewStars = (rating: number, size = 15) => (
    <span className="seller-review-stars" aria-label={`${rating}/5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(rating) ? "filled" : "empty"}
          fill={star <= Math.round(rating) ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
  const sortOptions: Array<{ value: ListingSort; label: string; icon: typeof Search }> = [
    { value: "relevance", label: refLabels.relevanceFirst, icon: Crosshair },
    { value: "newest", label: refLabels.newestFirst, icon: Clock3 },
    { value: "oldest", label: refLabels.oldestFirst, icon: CalendarDays },
    { value: "priceAsc", label: refLabels.lowestPrice, icon: TrendingDown },
    { value: "priceDesc", label: refLabels.highestPrice, icon: TrendingUp },
    { value: "nearest", label: refLabels.nearestFirst, icon: MapPin }
  ];
  const activeSort = sortOptions.find((option) => option.value === listingSort) ?? sortOptions[0];

  return (
    <main className={`auth-page seller-page ${isCompany ? "seller-company-page" : "seller-private-page"}`}>
      <section className="sp-wrap">
          <div className="seller-ref-hero">
            <div className="seller-ref-identity">
            <div className={`seller-ref-avatar${showSellerAvatar ? " has-photo" : ""}`}>
              {showSellerAvatar && (
                <img
                  src={sellerAvatarUrl}
                  alt={`${sellerName} profile picture`}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    setAvatarFailed(true);
                  }}
                />
              )}
              <span className="seller-ref-logo">
                <strong className="seller-ref-initial">{sellerInitial}</strong>
              </span>
            </div>

            <div className="seller-ref-copy">
              <h1>
                {sellerName}
                <span aria-hidden="true">✓</span>
              </h1>
              {isCompany && profile?.company_verified_at && (
                <span className="seller-ref-title-verified">
                  <Shield size={15} aria-hidden="true" />
                  Vahvistettu yritys
                </span>
              )}
              {memberSince && (
                <p>
                  <CalendarDays size={13} />
                  {t.spMemberSince.replace("{date}", memberSince)}
                </p>
              )}
              {sellerLocation && (
                <p>
                  <MapPin size={13} />
                  {sellerLocation}
                </p>
              )}

              <div className="seller-ref-pill-row">
                {isCompany && profile?.business_id?.trim() && (
                  <span className="seller-ref-phone-pill">
                    <Building2 size={13} />
                    {refLabels.businessId} {profile.business_id.trim()}
                  </span>
                )}
                <span className="seller-ref-phone-pill">
                  <Trophy size={13} />
                  {refLabels.accountLevel} {sellerLevel.level}
                </span>
                {isCompany && companyWebsite && (
                  <a
                    className="seller-ref-phone-pill seller-ref-link-pill"
                    href={companyWebsite.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Globe2 size={13} />
                    {refLabels.website} <strong>{companyWebsite.label}</strong>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div className="seller-ref-mini-row">
                <span>
                  <Shield size={13} />
                  {refLabels.trustedSeller}
                </span>
                <span className="is-good">
                  {refLabels.highlyRated}
                  {reviews.length > 0 && <> · {reviews.length} {reviewCountLabel}</>}
                </span>
              </div>

              {currentUserId !== resolvedSellerId && (
                <div className="seller-ref-follow-row">
                  {currentUserId ? (
                    <button
                      type="button"
                      className={`seller-ref-follow-button${followStats.is_following ? " is-following" : ""}`}
                      disabled={followSaving}
                      onClick={handleProfileFollowToggle}
                    >
                      {followStats.is_following ? <UserCheck size={15} /> : <UserPlus size={15} />}
                      {followStats.is_following ? refLabels.following : refLabels.follow}
                    </button>
                  ) : (
                    <Link className="seller-ref-follow-button" href={`${pagePath("auth", locale)}?returnTo=${encodeURIComponent(profilePath(sellerId, sellerName, locale))}`}>
                      <UserPlus size={15} />
                      {refLabels.loginToFollow}
                    </Link>
                  )}
                  {followError && <span className="seller-ref-follow-error">{followError}</span>}
                </div>
              )}

            </div>
          </div>

          <article className="seller-ref-about seller-ref-about-highlight">
            <h2>{refLabels.extraInfo}</h2>
            <p>{profile?.bio?.trim() || refLabels.noBio}</p>
          </article>

          <div className="seller-ref-stats">
            <div className="seller-ref-stat is-rating">
              <Star size={24} />
              <strong>{reviews.length ? averageRating.toFixed(1) : "–"}</strong>
              <span>{refLabels.averageRating}</span>
              <div aria-hidden="true">
                <Star size={13} fill="currentColor" />
                <Star size={13} fill="currentColor" />
                <Star size={13} fill="currentColor" />
                <Star size={13} fill="currentColor" />
                <Star size={13} fill="currentColor" />
              </div>
            </div>
            <div className="seller-ref-stat">
              <Tag size={22} />
              <strong>{effectiveLevelStats.listings_created}</strong>
              <span>{refLabels.totalListings}</span>
            </div>
            <div className="seller-ref-stat">
              <ShoppingBag size={22} />
              <strong>{effectiveLevelStats.sold_count}</strong>
              <span>{refLabels.sold}</span>
            </div>
            <div className="seller-ref-stat">
              <MessageCircle size={22} />
              <strong>{visibleReviewCount}</strong>
              <span>{refLabels.reviews}</span>
            </div>
          </div>

          <div className="seller-ref-detail-card" aria-label="Profiilin lisätiedot">
            <div className="seller-ref-detail-row">
              <Trophy size={20} aria-hidden="true" />
              <span>{refLabels.accountLevel}</span>
              <strong>
                {refLabels.level} {sellerLevel.level}
                <small>{sellerLevel.totalXp} {refLabels.xp}</small>
              </strong>
            </div>
            <div className="seller-ref-detail-row">
              <Shield size={20} aria-hidden="true" />
              <span>{refLabels.trustedSeller}</span>
              <strong className="is-good">
                {refLabels.highlyRated}
                {visibleReviewCount > 0 && <small>{visibleReviewCount} {reviewCountLabel}</small>}
              </strong>
            </div>
            {memberSince && (
              <div className="seller-ref-detail-row">
                <CalendarDays size={20} aria-hidden="true" />
                <span>{refLabels.registered}</span>
                <strong>{memberSince}</strong>
              </div>
            )}
            {sellerLocation && (
              <div className="seller-ref-detail-row">
                <MapPin size={20} aria-hidden="true" />
                <span>{refLabels.location}</span>
                <strong>{sellerLocation}</strong>
              </div>
            )}
            {isCompany && profile?.business_id?.trim() && (
              <>
                <div className="seller-ref-detail-row">
                  <Building2 size={20} aria-hidden="true" />
                  <span>{refLabels.businessId}</span>
                  <strong>{profile.business_id.trim()}</strong>
                </div>
                {profile.company_verified_at && (
                  <div className="seller-ref-detail-row seller-ref-company-verified-text">
                    <Shield size={20} aria-hidden="true" />
                    <span>Vahvistettu yritys</span>
                  </div>
                )}
              </>
            )}
            {isCompany && companyWebsite && (
              <div className="seller-ref-detail-row">
                <Globe2 size={20} aria-hidden="true" />
                <span>{refLabels.website}</span>
                <strong>
                  <a href={companyWebsite.href} target="_blank" rel="noreferrer">
                    {companyWebsite.label}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </strong>
              </div>
            )}
            <div className="seller-ref-detail-row">
              <MessageCircle size={20} aria-hidden="true" />
              <span>Kieli</span>
              <strong>{locale === "fi" ? "Suomi" : locale.toUpperCase()}</strong>
            </div>
          </div>
        </div>

        <div className="sp-tabs">
          <div className="sp-tabs-left">
            <button
              type="button"
              className={`sp-tab${activeTab === "listings" ? " active" : ""}`}
              onClick={() => setActiveTab("listings")}
            >
              <Bell size={22} aria-hidden="true" />
              <span>{t.spListings} ({filteredListings.length})</span>
            </button>
            <button
              type="button"
              className={`sp-tab${activeTab === "reviews" ? " active" : ""}`}
              onClick={() => setActiveTab("reviews")}
            >
              <Star size={23} aria-hidden="true" />
              <span>{t.spReviews} ({visibleReviewCount})</span>
            </button>
          </div>
        </div>

        {activeTab === "listings" && listings.length > 0 && (
          <div className="sp-advanced-search" role="search" aria-label={refLabels.advancedSearch}>
            <label className="sp-search-field">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                className="sp-search-input"
                value={searchQuery}
                aria-label={refLabels.searchPlaceholder}
                placeholder={refLabels.searchPlaceholder}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="sp-search-clear"
                  aria-label={refLabels.resetFilters}
                  onClick={() => setSearchQuery("")}
                >
                  <CircleX size={20} aria-hidden="true" />
                </button>
              )}
            </label>
            <div className={`sp-sort-wrap${sortOpen ? " is-open" : ""}`}>
              <button
                type="button"
                className="sp-sort-button"
                aria-haspopup="menu"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen((open) => !open)}
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                <span>{activeSort.label}</span>
                <ChevronDown size={16} className="sp-sort-chevron" aria-hidden="true" />
              </button>
              {sortOpen && (
                <div className="sp-sort-menu" role="menu">
                  {sortOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = option.value === listingSort;
                    return (
                      <button
                        type="button"
                        className={`sp-sort-option${selected ? " selected" : ""}`}
                        role="menuitemradio"
                        aria-checked={selected}
                        key={option.value}
                        onClick={() => {
                          setListingSort(option.value);
                          setSortOpen(false);
                        }}
                      >
                        <Icon size={15} aria-hidden="true" />
                        <span>{option.label}</span>
                        {selected && <Check size={15} className="sp-sort-check" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              className={`sp-menu-trigger sp-category-trigger${categoryFilterSummary ? " has-selection" : ""}`}
              aria-label={refLabels.advancedSearch}
              title={refLabels.advancedSearch}
              onClick={() => {
                setDrawerOpenStep(2);
                setDrawerOpen(true);
              }}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            {hasAdvancedFilters && (
              <div className="sp-filter-actions">
                <button type="button" className="sp-filter-reset" onClick={resetListingFilters}>
                  <RotateCcw size={14} aria-hidden="true" />
                  {refLabels.resetFilters}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "listings" && (
          listingsLoading && listings.length === 0 && showListingsLoader ? (
            <SellerTabLoading label={t.loadingListings} />
          ) : !listingsLoaded && listings.length === 0 ? (
            <div className="seller-tab-loading-placeholder" aria-hidden="true" />
          ) : listings.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">
                <Building2 size={48} />
              </div>
              <h3>{t.spNoListings}</h3>
              <p>{t.spNoListingsDesc.replace("{name}", sellerName)}</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">
                <Search size={48} />
              </div>
              <h3>{refLabels.noFilterResults}</h3>
              <p>{refLabels.searchPlaceholder}</p>
            </div>
          ) : (
            <>
            <div className="seller-listing-grid">
              {paginatedSellerListings.map((listing, index) => {
                const title = getListingTitle(listing);
                const locationLabel = formatListingLocation(listing.location, t.country);
                const countryFlag = getCountryFlagFromLocation(locationLabel, t.country);
                const fallbackImage = listingFallbackImageSrc(listing, index);
                const imageSrc = listingImageSrc(listing, index);
                const isFavorite = favorites.includes(listing.id);
                return (
                  <article
                    className="listing-card seller-listing-card"
                    key={listing.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`${t.openListing} ${title}`}
                    onClick={() => router.push(listingPath(listingUrlId(listing), locale))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(listingPath(listingUrlId(listing), locale));
                      }
                    }}
                  >
                    <span className="seller-listing-image">
                      <span className="seller-listing-image-blur" aria-hidden="true">
                        <img
                          src={imageSrc}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            if (event.currentTarget.src.endsWith(fallbackImage)) return;
                            event.currentTarget.src = fallbackImage;
                          }}
                        />
                      </span>
                      <img
                        src={imageSrc}
                        alt={title}
                        loading="lazy"
                        onError={(event) => {
                          if (event.currentTarget.src.endsWith(fallbackImage)) return;
                          event.currentTarget.src = fallbackImage;
                        }}
                      />
                      {isSellerListingNew(listing.created_at) && (
                        <span className="seller-listing-new-badge" aria-label="Uusi">
                          Uusi
                        </span>
                      )}
                      <button
                        type="button"
                        className={`seller-listing-heart${isFavorite ? " is-active" : ""}`}
                        disabled={!currentUserId}
                        aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                        title={!currentUserId ? t.login : undefined}
                        onClick={(event) => toggleFavorite(event, listing.id)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                      >
                        <Heart size={17} fill={isFavorite ? "currentColor" : "none"} />
                      </button>
                    </span>
                    <div className="listing-body">
                      <strong className="seller-listing-price">{formatPrice(listing.price)}</strong>
                      <h3>{title}</h3>
                      <p>{getLocalizedListingText(listing, locale).description}</p>
                      <div className="seller-listing-meta">
                        <span className="seller-listing-location">
                          {countryFlag ? (
                            <span
                              className="seller-listing-country-flag"
                              data-country={countryFlag.code}
                              aria-hidden="true"
                            >
                              <img
                                src={countryFlag.src}
                                alt=""
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            </span>
                          ) : null}
                          <span className="seller-listing-location-label">{locationLabel}</span>
                        </span>
                        <span>
                          <Clock3 size={14} />
                          {formatListingDate(listing.created_at, locale)}
                        </span>
                      </div>
                      <div className="price-row">
                        <span>{(t as Record<string,string>)["cond" + (listing.condition === "Hyvä" ? "Good" : listing.condition === "Uusi" ? "New" : listing.condition === "Kuin uusi" ? "LikeNew" : listing.condition === "Tyydyttävä" ? "Fair" : listing.condition === "Heikko" ? "Poor" : "")] || listing.condition}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {sellerListingTotalPages > 1 && (
              <nav className="seller-profile-pagination" aria-label="Myyjän ilmoitusten sivutus">
                <button
                  type="button"
                  className="seller-profile-page-button"
                  disabled={sellerListingPage === 1}
                  onClick={() => setSellerListingPage((page) => Math.max(1, page - 1))}
                  aria-label="Edellinen sivu"
                >
                  ‹
                </button>
                {Array.from({ length: sellerListingTotalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (sellerListingTotalPages <= 5) return true;
                    if (page === 1 || page === sellerListingTotalPages) return true;
                    return Math.abs(page - sellerListingPage) <= 1;
                  })
                  .reduce<(number | "...")[]>((pages, page, index, source) => {
                    if (index > 0 && page - (source[index - 1] as number) > 1) {
                      pages.push("...");
                    }
                    pages.push(page);
                    return pages;
                  }, [])
                  .map((page, index) =>
                    page === "..." ? (
                      <span className="seller-profile-page-gap" key={`gap-${index}`}>...</span>
                    ) : (
                      <button
                        type="button"
                        key={page}
                        className={`seller-profile-page-button${page === sellerListingPage ? " is-active" : ""}`}
                        aria-current={page === sellerListingPage ? "page" : undefined}
                        onClick={() => setSellerListingPage(page)}
                      >
                        {page}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  className="seller-profile-page-button"
                  disabled={sellerListingPage === sellerListingTotalPages}
                  onClick={() => setSellerListingPage((page) => Math.min(sellerListingTotalPages, page + 1))}
                  aria-label="Seuraava sivu"
                >
                  ›
                </button>
              </nav>
            )}
            </>
          )
        )}

        {activeTab === "reviews" && (
          reviewsLoading && reviews.length === 0 && showReviewsLoader ? (
            <SellerTabLoading label={loadingReviewsLabel} />
          ) : !reviewsLoaded && reviews.length === 0 ? (
            <div className="seller-tab-loading-placeholder" aria-hidden="true" />
          ) : (
            <section className="seller-review-dashboard" aria-label={t.spReviews}>
              <div className="seller-review-summary">
                <div className="seller-review-score-card">
                  <Star size={60} fill="currentColor" aria-hidden="true" />
                  <div>
                    <strong>
                      {averageRating.toFixed(1)}
                      <span> / 5</span>
                    </strong>
                    <p>{reviewLabels.average}</p>
                    <small>
                      <Users size={14} aria-hidden="true" />
                      {reviewLabels.basedOn} {reviews.length} {reviewBasisWord}
                    </small>
                  </div>
                </div>

                <div className="seller-review-bars" aria-label="Arvostelujakauma">
                  {reviewRatingCounts.map(({ stars, count }) => (
                    <div className="seller-review-bar-row" key={stars}>
                      {renderReviewStars(stars, 14)}
                      <span className="seller-review-bar-track">
                        <span
                          className="seller-review-bar-fill"
                          style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }}
                        />
                      </span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>

                <aside className="seller-review-verify-card">
                  <span className="seller-review-shield">
                    <Shield size={32} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{reviewLabels.verifiedTitle}</strong>
                    <p>{reviewLabels.verifiedBody}</p>
                  </div>
                </aside>
              </div>

              <div className="seller-review-filters">
                <button type="button" className="seller-review-filter-select">
                  {reviewLabels.starFilter}
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                <div className="seller-review-star-filters" role="group" aria-label={reviewLabels.starFilter}>
                  <button
                    type="button"
                    className={`seller-review-star-button${reviewRatingFilter === 0 ? " active" : ""}`}
                    onClick={() => setReviewRatingFilter(0)}
                  >
                    {reviewLabels.all}
                  </button>
                  {[5, 4, 3, 2, 1].map((stars) => (
                    <button
                      type="button"
                      className={`seller-review-star-button${reviewRatingFilter === stars ? " active" : ""}`}
                      key={stars}
                      onClick={() => setReviewRatingFilter(stars)}
                    >
                      {renderReviewStars(stars, 13)}
                    </button>
                  ))}
                </div>
                <label className="seller-review-sort">
                  <select
                    value={reviewSort}
                    aria-label={refLabels.newestFirst}
                    onChange={(event) => setReviewSort(event.target.value as ReviewSort)}
                  >
                    {reviewSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" />
                </label>
              </div>

              {filteredReviews.length === 0 ? (
                <div className="sp-empty seller-review-empty">
                  <div className="sp-empty-icon">
                    {reviews.length === 0 ? <Star size={44} /> : <Search size={44} />}
                  </div>
                  <h3>{reviews.length === 0 ? t.noReviews : reviewLabels.noMatches}</h3>
                  <p>{reviews.length === 0 ? reviewEmptyDescription : reviewLabels.search}</p>
                </div>
              ) : (
                <div className="seller-review-grid">
                  {filteredReviews.map((review) => (
                    <article className="seller-review-card" key={review.id}>
                      <div className="seller-review-card-head">
                        <span className="seller-review-avatar">{getReviewInitials(review.reviewer_name)}</span>
                        <div>
                          <strong>
                            {review.reviewer_name}
                            <Check size={13} aria-hidden="true" />
                          </strong>
                          <small>{formatReviewAge(review.created_at, locale)}</small>
                        </div>
                        {renderReviewStars(review.rating, 16)}
                      </div>
                      <p>{review.comment}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )
        )}

        {activeTab === "about" && (
          <article className="seller-ref-about">
            <h2>{refLabels.about}</h2>
            <p>{profile?.bio?.trim() || refLabels.noBio}</p>
          </article>
        )}

        <CategoryDrawer
          isOpen={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setDrawerOpenStep(undefined);
          }}
          vehicleType={vehicleTypeFilter}
          vehicleSubtype=""
          brand={brandFilter}
          model={modelFilter}
          year={yearFilter}
          engineCc={engineCcFilter}
          engineModel={engineModelFilter}
          category={categoryFilter}
          subcategory={subcategoryFilter}
          openAtStep={drawerOpenStep}
          vehicleBrands={vehicleBrands}
          vehicleCategories={vehicleCategories}
          partsCategories={partsCategories}
          onApply={({ vehicleType, brand, model, year, engineCc, engineModel, category, subcategory }) => {
            setVehicleTypeFilter(vehicleType);
            setBrandFilter(brand);
            setModelFilter(model);
            setYearFilter(year);
            setEngineCcFilter(engineCc);
            setEngineModelFilter(engineModel);
            setCategoryFilter(category);
            setSubcategoryFilter(subcategory);
            setActiveTab("listings");
          }}
        />
      </section>

      <style jsx>{`
        .seller-page {
          min-height: 100vh;
          padding: clamp(18px, 3vw, 34px) 0 88px;
          background: var(--site-bg, #c8d0d7) !important;
          background-image: none !important;
          color: #0f172a;
        }

        .sp-wrap {
          width: min(1180px, calc(100vw - 32px));
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .sp-header {
          display: grid;
          grid-template-columns: 112px minmax(0, 1fr) minmax(280px, 420px);
          gap: 20px;
          align-items: center;
          padding: clamp(22px, 4vw, 34px);
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 24px;
          background:
            radial-gradient(720px 260px at 96% 0%, rgba(255, 122, 26, 0.18), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98));
          box-shadow: 0 24px 70px rgba(0, 7, 18, 0.34), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .sp-avatar {
          width: 104px;
          height: 104px;
          border-radius: 28px;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: rgba(3, 12, 24, 0.58);
          border: 1px solid rgba(255, 122, 26, 0.34);
          box-shadow: 0 18px 40px rgba(0, 7, 18, 0.3);
        }

        .sp-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .sp-avatar-initial {
          color: #fff;
          font-size: 42px;
          font-weight: 950;
        }

        .sp-header-info {
          min-width: 0;
          display: grid;
          gap: 10px;
        }

        .sp-header-info h1 {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin: 0;
          color: #fff;
          font-size: clamp(2rem, 5vw, 3.4rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .sp-member-since,
        .sp-location,
        .sp-website,
        .sp-trust-label {
          margin: 0;
          color: rgba(226, 244, 255, 0.72);
          font-size: 14px;
          font-weight: 750;
        }

        .sp-location,
        .sp-website,
        .sp-verified,
        .sp-trust-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          width: fit-content;
        }

        .sp-website {
          text-decoration: none;
          color: #ffb45f;
        }

        .sp-verified-row,
        .sp-trust-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sp-verified,
        .sp-trust-badge {
          min-height: 30px;
          padding: 0;
          border-radius: 999px;
          border: 0;
          background: transparent;
          color: rgba(226, 244, 255, 0.82);
          font-size: 12px;
          font-weight: 900;
        }

        .sp-verified.is-phone {
          color: #4ade80;
        }

        .sp-verified.is-phone svg {
          color: #22c55e;
          filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.32));
        }

        .sp-trust-badge strong {
          color: #fff;
        }

        .sp-bio {
          max-width: 620px;
          margin: 4px 0 0;
          color: rgba(226, 244, 255, 0.82);
          font-size: 15px;
          font-weight: 650;
          line-height: 1.55;
          white-space: pre-line;
        }

        .sp-trust-breakdown {
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .sp-trust-panel,
        .sp-trust-stats {
          border: 1px solid rgba(151, 178, 205, 0.16);
          border-radius: 18px;
          background: rgba(3, 12, 24, 0.34);
          padding: 16px;
        }

        .sp-data-head {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
        }

        .sp-data-head span,
        .sp-trust-meter-head span,
        .sp-trust-stats span {
          color: rgba(226, 244, 255, 0.66);
          font-size: 12px;
          font-weight: 800;
        }

        .sp-data-head strong,
        .sp-trust-meter-head strong,
        .sp-trust-stats strong {
          display: block;
          color: #fff;
          font-weight: 950;
        }

        .sp-trust-panel-icon {
          color: #ffb45f;
        }

        .sp-trust-meter-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 14px;
        }

        .sp-trust-bar {
          height: 10px;
          margin-top: 8px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(151, 178, 205, 0.18);
        }

        .sp-trust-bar-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(135deg, #ff9a24, #ff6b16);
        }

        .sp-trust-stats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .sp-trust-stats div {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .sp-tabs {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px;
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 18px;
          background: rgba(13, 29, 46, 0.72);
        }

        .sp-tabs-left {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sp-tab {
          min-height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(151, 178, 205, 0.16);
          background: rgba(12, 28, 46, 0.78);
          color: rgba(226, 244, 255, 0.78);
          font-weight: 900;
          cursor: pointer;
        }

        .sp-tab.active {
          background: linear-gradient(135deg, #ff9a24, #ff6b16);
          border-color: rgba(255, 210, 165, 0.62);
          color: #fff;
        }

        .sp-search-field .sp-search-input {
          appearance: none !important;
          -webkit-appearance: none !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: 0 !important;
          padding: 0 !important;
        }

        .sp-sort-wrap {
          position: relative;
          min-width: 0;
          width: 184px;
          display: flex;
          align-items: center;
        }

        .sp-sort-select {
          width: 100%;
          min-height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(151, 178, 205, 0.22);
          background: rgba(3, 12, 24, 0.62);
          color: #f4f8fc;
          font-weight: 850;
          padding: 0 34px 0 12px;
          appearance: none;
          -webkit-appearance: none;
          background-image: none;
          line-height: 40px;
        }

        .sp-sort-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #ffb45f;
          pointer-events: none;
          z-index: 1;
        }

        .seller-listing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 18px;
          align-items: stretch;
        }

        .seller-listing-card,
        .sp-empty,
        .review-card {
          overflow: hidden;
          border: 1px solid rgba(255, 122, 26, 0.58);
          border-radius: 18px;
          background:
            radial-gradient(420px 160px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98));
          color: #f4f8fc;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(0, 7, 18, 0.24), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .seller-listing-card {
          display: grid !important;
          grid-template-rows: 220px 1fr !important;
          height: 410px !important;
          min-height: 410px !important;
          outline: 1px solid rgba(255, 154, 36, 0.72);
          outline-offset: -1px;
          transition: border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
        }

        .seller-listing-card:hover {
          border-color: rgba(255, 183, 93, 0.95);
          box-shadow: 0 22px 54px rgba(0, 7, 18, 0.3), 0 0 0 1px rgba(255, 154, 36, 0.42);
          transform: translateY(-2px);
        }

        .seller-listing-image {
          display: block !important;
          background: #06111f;
          overflow: hidden;
          border-bottom: 1px solid rgba(255, 122, 26, 0.28);
          height: 220px !important;
          max-height: 220px !important;
          min-height: 220px !important;
          position: relative;
          width: 100% !important;
        }

        .seller-listing-image img {
          width: 100% !important;
          height: 100% !important;
          max-height: 220px !important;
          object-fit: cover !important;
          display: block !important;
        }

        .seller-listing-heart {
          align-items: center;
          background: rgba(9, 23, 38, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.46);
          border-radius: 999px;
          color: #ffffff;
          display: inline-flex;
          height: 34px;
          justify-content: center;
          position: absolute;
          right: 12px;
          top: 12px;
          width: 34px;
          z-index: 2;
        }

        .seller-listing-new-badge {
          align-items: center;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          border: 1px solid rgba(187, 247, 208, 0.72);
          border-radius: 999px;
          box-shadow:
            0 3px 9px rgba(22, 163, 74, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
          color: #ffffff;
          display: inline-flex;
          font-size: 9px;
          font-weight: 950;
          justify-content: center;
          left: 8px;
          letter-spacing: 0.02em;
          line-height: 1;
          padding: 3px 8px;
          pointer-events: none;
          position: absolute;
          text-transform: uppercase;
          top: 8px;
          white-space: nowrap;
          z-index: 2;
        }

        .listing-body {
          display: grid;
          grid-template-rows: auto auto auto 1fr auto;
          gap: 8px;
          padding: 16px;
          min-height: 190px;
          background: #09233d;
        }

        .seller-listing-price {
          color: #ffffff;
          font-size: 2rem;
          font-weight: 950;
          line-height: 1;
        }

        .listing-body h3 {
          margin: 0;
          color: #fff;
          font-size: 16px;
          font-weight: 950;
          line-height: 1.2;
          min-height: 38px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .seller-listing-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          color: rgba(226, 244, 255, 0.72);
          font-size: 12px;
          font-weight: 850;
          line-height: 1.25;
        }

        .seller-listing-meta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
        }

        .listing-body p {
          margin: 0;
          color: rgba(226, 244, 255, 0.66);
          font-size: 13px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .price-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 0;
        }

        .price-row strong {
          color: #fff;
          font-size: 20px;
          font-weight: 950;
        }

        .price-row span {
          border: 1px solid rgba(255, 122, 26, 0.58);
          border-radius: 999px;
          background: transparent;
          color: #ffb45f;
          font-size: 11px;
          font-weight: 900;
          padding: 5px 8px;
        }

        .sp-empty {
          min-height: 280px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 10px;
          padding: 32px;
          text-align: center;
        }

        .sp-empty-icon {
          color: #ffb45f;
        }

        .sp-empty h3 {
          margin: 0;
          color: #fff;
          font-size: 22px;
          font-weight: 950;
        }

        .sp-empty.seller-review-empty h3,
        .sp-empty.seller-review-empty p {
          color: #ff8a16;
        }

        .sp-empty p,
        .review-card p {
          margin: 0;
          color: rgba(226, 244, 255, 0.7);
        }

        .review-list {
          display: grid;
          gap: 12px;
        }

        .review-card {
          padding: 16px;
        }

        .review-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .review-card-head strong {
          color: #fff;
        }

        .review-card-head span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #ffb45f;
          font-weight: 950;
        }

        @media (max-width: 900px) {
          .sp-header {
            grid-template-columns: 88px minmax(0, 1fr);
          }

          .sp-avatar {
            width: 82px;
            height: 82px;
            border-radius: 22px;
          }

          .sp-trust-breakdown {
            grid-column: 1 / -1;
          }

          .sp-trust-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sp-tabs {
            align-items: stretch;
            flex-direction: column;
          }

          .sp-sort-wrap {
            width: 100%;
            max-width: 220px;
          }
        }

        @media (max-width: 560px) {
          .seller-page {
            padding-top: 14px;
          }

          .sp-wrap {
            width: min(100% - 24px, 1180px);
          }

          .sp-header {
            grid-template-columns: 1fr;
            padding: 20px;
          }

          .sp-header-info h1 {
            font-size: 2rem;
          }

          .sp-avatar {
            width: 76px;
            height: 76px;
          }

          .seller-listing-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .seller-listing-card {
            border-radius: 12px !important;
            grid-template-rows: 118px 1fr !important;
            height: 276px !important;
            min-height: 276px !important;
          }

          .seller-listing-image,
          .seller-listing-image img {
            height: 118px !important;
            max-height: 118px !important;
            min-height: 118px !important;
          }

          .seller-listing-heart {
            height: 30px;
            right: 8px;
            top: 8px;
            width: 30px;
          }

          .seller-listing-new-badge {
            font-size: 8px;
            left: 6px;
            min-height: 17px;
            padding: 2px 7px;
            top: 6px;
          }

          .listing-body {
            gap: 5px;
            min-height: 158px;
            padding: 10px;
          }

          .seller-listing-price {
            font-size: 1.35rem;
          }

          .listing-body h3 {
            font-size: 13px;
            min-height: 31px;
          }

          .listing-body p {
            display: none;
          }

          .seller-listing-meta {
            gap: 5px;
            font-size: 10px;
          }

          .price-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
          }

          .price-row span {
            font-size: 10px;
            padding: 4px 7px;
          }
        }
      `}</style>
    </main>
  );
}


