"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import homeStyles from "../../page.module.css";
import { Bell, Building2, CalendarDays, Check, ChevronDown, CircleX, Clock3, Crosshair, ExternalLink, Globe2, Heart, MapPin, MessageCircle, RotateCcw, Search, Shield, ShoppingBag, SlidersHorizontal, Star, Tag, TrendingDown, TrendingUp, UserCheck, UserPlus, Users, X } from "lucide-react";
import { formatPrice, normalizeVehicleType, type Listing } from "@/lib/listings";
import { useLanguage, translateCategory, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { formatLocationWithCountry, getCountryFlagFromLocation } from "@/lib/country-flags";
import { calculateSellerLevel } from "@/lib/seller-level";
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";
import { readCachedListings } from "@/lib/client-listings-cache";
import { listingPath, listingUrlId, pagePath, profilePath } from "@/lib/routes";
import {
  buildVehicleCategoriesFromTaxonomy,
  categoriesAsRecord,
  vehicleBrandsRecord
} from "@/lib/taxonomy";
import { useTaxonomy } from "@/app/components/TaxonomyProvider";
import ListingVehicleMeta from "@/app/components/ListingVehicleMeta";
import OptimizedListingImage from "@/app/components/OptimizedListingImage";
import {
  MARKETPLACE_YEAR_FILTER_MIN,
  buildMarketplaceCategorySource,
  buildMarketplaceFilterOptions,
  getMarketplaceYearFilterMax
} from "@/lib/marketplace-filter-options";
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

function FractionalRatingStar({ percentage }: { percentage: number }) {
  const gradientId = `seller-rating-${useId().replace(/:/g, "")}`;
  const safePercentage = Math.min(100, Math.max(0, percentage));

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${safePercentage}%`} stopColor="#ff7a1a" />
          <stop offset={`${safePercentage}%`} stopColor="#ff7a1a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.75 14.85 8.53 21.23 9.46 16.61 13.96 17.7 20.31 12 17.31 6.3 20.31 7.39 13.96 2.77 9.46 9.15 8.53 12 2.75Z"
        fill={`url(#${gradientId})`}
        stroke="#ff7a1a"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SellerFilterSelect({
  value,
  placeholder,
  options,
  onChange,
  getLabel = (option) => option
}: {
  value: string;
  placeholder: string;
  options: readonly string[];
  onChange: (value: string) => void;
  getLabel?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const activeLabel = value ? getLabel(value) : placeholder;

  return (
    <div
      ref={wrapRef}
      className={`sp-filter-select-wrap${open ? " is-open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="sp-filter-select-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => {
          const opening = !current;
          if (opening) {
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                (wrapRef.current?.closest(".sp-filter-field") ?? wrapRef.current)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start"
                });
              });
            });
          }
          return opening;
        })}
      >
        <span>{activeLabel}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="sp-filter-select-menu" role="listbox" tabIndex={-1}>
          <button
            type="button"
            className={`sp-filter-select-option${value === "" ? " is-selected" : ""}`}
            role="option"
            aria-selected={value === ""}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {placeholder}
          </button>
          {options.map((option) => (
            <button
              type="button"
              className={`sp-filter-select-option${value === option ? " is-selected" : ""}`}
              role="option"
              aria-selected={value === option}
              key={option}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {getLabel(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAccountAge(value: string | undefined, locale: string) {
  if (!value) return "";
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return "";
  return created.toLocaleDateString(
    locale === "fi" ? "fi-FI"
    : locale === "sv" ? "sv-SE"
    : locale === "no" ? "nb-NO"
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

function sellerSubcategoryMatches(value: string | null | undefined, selected: string) {
  if (!selected) return true;
  const normalizedValue = normalizeSubcategoryFilter(value);
  const normalizedSelected = normalizeSubcategoryFilter(selected);
  const selectedLeaf = normalizeSubcategoryFilter(categoryLeaf(selected));
  return (
    normalizedValue === normalizedSelected ||
    normalizedValue === selectedLeaf ||
    normalizedValue.includes(normalizedSelected) ||
    normalizedValue.includes(selectedLeaf)
  );
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
  const initials = name.trim().charAt(0);

  return initials.toLocaleUpperCase(locale === "fi" ? "fi-FI" : undefined) || "?";
}

type TabKey = "listings" | "reviews" | "about";
type ListingSort = "relevance" | "newest" | "oldest" | "priceAsc" | "priceDesc" | "nearest";
type ReviewSort = "newest" | "oldest" | "highest" | "lowest";

type SellerAppliedFilters = {
  searchQuery: string;
  listingSort: ListingSort;
  vehicleTypeFilter: string;
  vehicleSubtypeFilter: string;
  brandFilter: string;
  modelFilter: string;
  yearFilter: string;
  yearMinFilter: string;
  yearMaxFilter: string;
  engineCcFilter: string;
  engineModelFilter: string;
  categoryFilter: string;
  subcategoryParentFilter: string;
  subcategoryFilter: string;
  trackMatLengthFilter: string;
  trackMatWidthFilter: string;
  trackMatPitchFilter: string;
};

const EMPTY_SELLER_APPLIED_FILTERS: SellerAppliedFilters = {
  searchQuery: "",
  listingSort: "relevance",
  vehicleTypeFilter: "",
  vehicleSubtypeFilter: "",
  brandFilter: "",
  modelFilter: "",
  yearFilter: "",
  yearMinFilter: "",
  yearMaxFilter: "",
  engineCcFilter: "",
  engineModelFilter: "",
  categoryFilter: "",
  subcategoryParentFilter: "",
  subcategoryFilter: "",
  trackMatLengthFilter: "",
  trackMatWidthFilter: "",
  trackMatPitchFilter: ""
};

function isSellerTrackMatSelection(value: string) {
  return normalizeSubcategoryFilter(value).includes("telamat");
}

function sellerListingMatchesFilters(
  listing: Listing,
  filters: SellerAppliedFilters,
  locale: Locale,
  selectedSubcategoryChildren: readonly string[]
) {
  const query = filters.searchQuery.trim().toLowerCase();
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
    listing.part_model,
    listing.location
  ].filter(Boolean).join(" ").toLowerCase();

  if (query && !haystack.includes(query)) return false;
  if (filters.vehicleTypeFilter) {
    const selectedVehicle = normalizeVehicleType(filters.vehicleTypeFilter);
    const listingVehicle = normalizeVehicleType(listing.vehicle_type ?? "");
    if (listingVehicle) {
      if (listingVehicle !== selectedVehicle) return false;
    } else if (!sellerTextMatches(haystack, selectedVehicle)) {
      return false;
    }
  }
  if (filters.vehicleSubtypeFilter) {
    const subtypeHaystack = [listing.vehicle_subtype, haystack].filter(Boolean).join(" ");
    if (!sellerTextMatches(subtypeHaystack, filters.vehicleSubtypeFilter)) return false;
  }
  if (filters.brandFilter && !sellerTextMatches([listing.brand, listing.model, haystack].filter(Boolean).join(" "), filters.brandFilter)) return false;
  if (filters.modelFilter && !sellerTextMatches([listing.model, haystack].filter(Boolean).join(" "), filters.modelFilter)) return false;
  if (filters.yearFilter && !sellerTextMatches([listing.year, haystack].filter(Boolean).join(" "), filters.yearFilter)) return false;
  const listingYear = Number.parseInt(String(listing.year ?? ""), 10);
  if (filters.yearMinFilter && (!Number.isFinite(listingYear) || listingYear < Number.parseInt(filters.yearMinFilter, 10))) return false;
  if (filters.yearMaxFilter && (!Number.isFinite(listingYear) || listingYear > Number.parseInt(filters.yearMaxFilter, 10))) return false;
  if (filters.engineCcFilter && !sellerTextMatches([listing.engine_cc, haystack].filter(Boolean).join(" "), filters.engineCcFilter)) return false;
  if (filters.engineModelFilter && !sellerTextMatches([listing.engine_model, haystack].filter(Boolean).join(" "), filters.engineModelFilter)) return false;
  if (filters.categoryFilter && normalizeCategoryFilter(listing.category) !== normalizeCategoryFilter(filters.categoryFilter)) return false;
  if (filters.subcategoryParentFilter) {
    const parentMatches = sellerSubcategoryMatches(listing.subcategory, filters.subcategoryParentFilter);
    const childMatches = selectedSubcategoryChildren.some((child) => sellerSubcategoryMatches(listing.subcategory, child));
    if (!parentMatches && !childMatches) return false;
  }
  if (filters.subcategoryFilter) {
    if (!sellerSubcategoryMatches(listing.subcategory, filters.subcategoryFilter) && !sellerTextMatches(haystack, categoryLeaf(filters.subcategoryFilter))) return false;
  }

  const trackMatHaystack = [listing.part_model, localized.title, localized.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/,/g, ".");
  const trackMatValues = [filters.trackMatLengthFilter, filters.trackMatWidthFilter, filters.trackMatPitchFilter];
  if (trackMatValues.some((value) => value.trim() && !trackMatHaystack.includes(value.trim().toLowerCase().replace(/,/g, ".")))) {
    return false;
  }

  return true;
}

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

function SellerTabLoading({ label: _label }: { label: string }) {
  return (
    <div className="seller-tab-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="seller-tab-spinner" aria-hidden="true" />
    </div>
  );
}

const vehicleTypeTranslations: Record<Locale, Record<string, string>> = {
  fi: {},
  en: { Moottorikelkka: "Snowmobile", "Mönkijä": "ATV", Motocross: "Motocross", Mopot: "Moped" },
  sv: { Moottorikelkka: "Snöskoter", "Mönkijä": "ATV", Motocross: "Motocross", Mopot: "Moped" },
  no: { Moottorikelkka: "Snøscooter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
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
  const allVehicleCategories = useMemo(() => {
    const merged: Record<string, string[]> = {};
    for (const source of [partsCategories, ...Object.values(vehicleCategories)]) {
      for (const [category, subs] of Object.entries(source)) {
        merged[category] = Array.from(new Set([...(merged[category] ?? []), ...subs]));
      }
    }
    return merged;
  }, [partsCategories, vehicleCategories]);
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
  const [sellerFilterPanelOpen, setSellerFilterPanelOpen] = useState(false);
  const [showAllListings, setShowAllListings] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewRatingFilter, setReviewRatingFilter] = useState(0);
  const [reviewSort, setReviewSort] = useState<ReviewSort>("newest");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [yearMinFilter, setYearMinFilter] = useState("");
  const [yearMaxFilter, setYearMaxFilter] = useState("");
  const [engineCcFilter, setEngineCcFilter] = useState("");
  const [engineModelFilter, setEngineModelFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [subcategoryParentFilter, setSubcategoryParentFilter] = useState("");
  const [trackMatLengthFilter, setTrackMatLengthFilter] = useState("");
  const [trackMatWidthFilter, setTrackMatWidthFilter] = useState("");
  const [trackMatPitchFilter, setTrackMatPitchFilter] = useState("");
  const [vehicleSubtypeFilter, setVehicleSubtypeFilter] = useState("");
  const [sellerFilterSheetExpanded, setSellerFilterSheetExpanded] = useState(false);
  const [sellerFilterSheetDragging, setSellerFilterSheetDragging] = useState(false);
  const [sellerFilterSheetDragHeight, setSellerFilterSheetDragHeight] = useState<number | null>(null);
  const sellerFilterSheetRef = useRef<HTMLFormElement | null>(null);
  const sellerTrackMatDimensionsRef = useRef<HTMLFieldSetElement | null>(null);
  const sellerFilterSheetDragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
    currentHeight: number;
  } | null>(null);
  const [appliedSellerFilters, setAppliedSellerFilters] = useState<SellerAppliedFilters>(EMPTY_SELLER_APPLIED_FILTERS);
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

  useEffect(() => {
    if (!reviewsOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setReviewsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [reviewsOpen]);

  useEffect(() => {
    if (!sellerFilterPanelOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSellerFilterPanelOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sellerFilterPanelOpen]);

  useEffect(() => {
    if (sellerFilterPanelOpen) return;
    sellerFilterSheetDragRef.current = null;
    setSellerFilterSheetDragging(false);
    setSellerFilterSheetDragHeight(null);
    setSellerFilterSheetExpanded(false);
  }, [sellerFilterPanelOpen]);

  useEffect(() => {
    if (
      !sellerFilterPanelOpen ||
      !isSellerTrackMatSelection(subcategoryFilter) ||
      !window.matchMedia("(max-width: 820px)").matches
    ) return;

    // The three dimension inputs are rendered below the part selector. Expand
    // the mobile sheet and bring the new fields into view as soon as Telamatot
    // is selected so they cannot remain hidden below the collapsed viewport.
    setSellerFilterSheetDragHeight(null);
    setSellerFilterSheetExpanded(true);
    const frame = window.requestAnimationFrame(() => {
      sellerTrackMatDimensionsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [sellerFilterPanelOpen, subcategoryFilter]);

  useEffect(() => {
    const openSellerProfileFilters = () => {
      if (listings.length === 0) return;

      setSearchQuery(appliedSellerFilters.searchQuery);
      setListingSort(appliedSellerFilters.listingSort);
      setVehicleTypeFilter(appliedSellerFilters.vehicleTypeFilter);
      setVehicleSubtypeFilter(appliedSellerFilters.vehicleSubtypeFilter);
      setBrandFilter(appliedSellerFilters.brandFilter);
      setModelFilter(appliedSellerFilters.modelFilter);
      setYearFilter(appliedSellerFilters.yearFilter);
      setYearMinFilter(appliedSellerFilters.yearMinFilter);
      setYearMaxFilter(appliedSellerFilters.yearMaxFilter);
      setEngineCcFilter(appliedSellerFilters.engineCcFilter);
      setEngineModelFilter(appliedSellerFilters.engineModelFilter);
      setCategoryFilter(appliedSellerFilters.categoryFilter);
      setSubcategoryParentFilter(appliedSellerFilters.subcategoryParentFilter);
      setSubcategoryFilter(appliedSellerFilters.subcategoryFilter);
      setTrackMatLengthFilter(appliedSellerFilters.trackMatLengthFilter);
      setTrackMatWidthFilter(appliedSellerFilters.trackMatWidthFilter);
      setTrackMatPitchFilter(appliedSellerFilters.trackMatPitchFilter);
      setSellerFilterSheetExpanded(false);
      setSortOpen(false);
      setSellerFilterPanelOpen(true);
    };

    window.addEventListener("seller-profile-open-filters", openSellerProfileFilters);
    return () => window.removeEventListener("seller-profile-open-filters", openSellerProfileFilters);
  }, [appliedSellerFilters, listings.length]);

  // Public seller pages use a short public id in the URL. The first review
  // request may therefore finish before that id has been resolved to the
  // seller's auth UUID. Allow the review loader to run again with the UUID so
  // the visible rating is always the average of the seller_reviews rows.
  useEffect(() => {
    if (!profile?.id || profile.id === sellerId) return;
    setReviewsLoaded(false);
  }, [profile?.id, sellerId]);

  const selectedSubcategoryParentChildren = useMemo(() => {
    if (!appliedSellerFilters.categoryFilter || !appliedSellerFilters.subcategoryParentFilter) return [];
    const vehicle = appliedSellerFilters.vehicleTypeFilter || "";
    const categorySource = buildMarketplaceCategorySource({
      vehicleType: vehicle,
      vehicleSubtype: appliedSellerFilters.vehicleSubtypeFilter,
      vehicleCategories,
      allVehicleCategories
    });
    const categorySubs = categorySource[appliedSellerFilters.categoryFilter] ?? [];
    const groupOptions = buildMarketplaceFilterOptions({
      taxonomyVehicles: taxonomy.vehicles,
      vehicleBrands,
      vehicleCategories,
      allVehicleCategories,
      vehicleType: vehicle,
      vehicleSubtype: appliedSellerFilters.vehicleSubtypeFilter,
      brand: appliedSellerFilters.brandFilter,
      model: appliedSellerFilters.modelFilter,
      category: appliedSellerFilters.categoryFilter,
      subcategoryParent: appliedSellerFilters.subcategoryParentFilter
    });
    const baseChildren = groupOptions.subcategoryGroups?.[appliedSellerFilters.subcategoryParentFilter] ?? [];
    const dynamicChildren = categorySubs.filter((sub) => {
      const parent = sub.split(" / ").map((part) => part.trim()).filter(Boolean)[0];
      return normalizeSubcategoryFilter(parent) === normalizeSubcategoryFilter(appliedSellerFilters.subcategoryParentFilter);
    });
    return Array.from(new Set([...baseChildren, ...dynamicChildren]));
  }, [allVehicleCategories, appliedSellerFilters, taxonomy.vehicles, vehicleBrands, vehicleCategories]);

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
    const copy = listings.filter((listing) =>
      sellerListingMatchesFilters(listing, appliedSellerFilters, locale, selectedSubcategoryParentChildren)
    );

    return copy.sort((a, b) => {
      if (appliedSellerFilters.listingSort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (appliedSellerFilters.listingSort === "priceAsc") return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (appliedSellerFilters.listingSort === "priceDesc") return Number(b.price ?? 0) - Number(a.price ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [appliedSellerFilters, listings, locale, selectedSubcategoryParentChildren]);

  const sellerFilterOptions = useMemo(() => {
    return buildMarketplaceFilterOptions({
      taxonomyVehicles: taxonomy.vehicles,
      vehicleBrands,
      vehicleCategories,
      allVehicleCategories,
      vehicleType: vehicleTypeFilter,
      vehicleSubtype: vehicleSubtypeFilter,
      brand: brandFilter,
      model: modelFilter,
      category: categoryFilter,
      subcategoryParent: subcategoryParentFilter
    });
  }, [allVehicleCategories, brandFilter, categoryFilter, modelFilter, subcategoryParentFilter, taxonomy.vehicles, vehicleBrands, vehicleCategories, vehicleSubtypeFilter, vehicleTypeFilter]);
  const draftSellerFilters = useMemo<SellerAppliedFilters>(() => ({
    searchQuery,
    listingSort,
    vehicleTypeFilter,
    vehicleSubtypeFilter,
    brandFilter,
    modelFilter,
    yearFilter,
    yearMinFilter,
    yearMaxFilter,
    engineCcFilter,
    engineModelFilter,
    categoryFilter,
    subcategoryParentFilter,
    subcategoryFilter,
    trackMatLengthFilter,
    trackMatWidthFilter,
    trackMatPitchFilter
  }), [
    brandFilter,
    categoryFilter,
    engineCcFilter,
    engineModelFilter,
    listingSort,
    modelFilter,
    searchQuery,
    subcategoryFilter,
    subcategoryParentFilter,
    trackMatLengthFilter,
    trackMatPitchFilter,
    trackMatWidthFilter,
    vehicleSubtypeFilter,
    vehicleTypeFilter,
    yearFilter,
    yearMaxFilter,
    yearMinFilter
  ]);
  const draftFilteredListingCount = useMemo(
    () => listings.filter((listing) => sellerListingMatchesFilters(
      listing,
      draftSellerFilters,
      locale,
      sellerFilterOptions.subcategories
    )).length,
    [draftSellerFilters, listings, locale, sellerFilterOptions.subcategories]
  );
  const trackMatDimensionsVisible = isSellerTrackMatSelection(subcategoryFilter);
  const yearSliderMin = MARKETPLACE_YEAR_FILTER_MIN;
  const yearSliderMax = getMarketplaceYearFilterMax();
  const selectedYearMin = yearMinFilter ? Number.parseInt(yearMinFilter, 10) : yearSliderMin;
  const selectedYearMax = yearMaxFilter ? Number.parseInt(yearMaxFilter, 10) : yearSliderMax;
  const yearSliderRange = Math.max(1, yearSliderMax - yearSliderMin);
  const yearSliderLeft = ((selectedYearMin - yearSliderMin) / yearSliderRange) * 100;
  const yearSliderRight = 100 - ((selectedYearMax - yearSliderMin) / yearSliderRange) * 100;
  const sellerYearSliderRef = useRef<HTMLDivElement | null>(null);

  const updateSellerYearRangeFromPointer = useCallback((clientX: number, handle?: "min" | "max") => {
    const slider = sellerYearSliderRef.current;
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    const percent = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
    const nextYear = Math.min(
      yearSliderMax,
      Math.max(yearSliderMin, Math.round(yearSliderMin + percent * (yearSliderMax - yearSliderMin)))
    );
    const currentMin = yearMinFilter ? Number.parseInt(yearMinFilter, 10) : yearSliderMin;
    const currentMax = yearMaxFilter ? Number.parseInt(yearMaxFilter, 10) : yearSliderMax;
    const targetHandle =
      handle ??
      (Math.abs(nextYear - currentMin) <= Math.abs(nextYear - currentMax) ? "min" : "max");

    if (targetHandle === "min") {
      const nextMin = Math.min(nextYear, currentMax);
      setYearMinFilter(nextMin === yearSliderMin ? "" : String(nextMin));
    } else {
      const nextMax = Math.max(nextYear, currentMin);
      setYearMaxFilter(nextMax === yearSliderMax ? "" : String(nextMax));
    }
  }, [yearMaxFilter, yearMinFilter, yearSliderMax, yearSliderMin]);

  const startSellerYearRangeDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement | HTMLSpanElement>,
    handle?: "min" | "max"
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);
    updateSellerYearRangeFromPointer(event.clientX, handle);

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      updateSellerYearRangeFromPointer(moveEvent.clientX, handle);
    };
    const stop = (stopEvent: PointerEvent) => {
      if (stopEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }, [updateSellerYearRangeFromPointer]);

  const handleSellerYearRangeKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLSpanElement>,
    handle: "min" | "max"
  ) => {
    const currentValue = handle === "min" ? selectedYearMin : selectedYearMax;
    let nextValue = currentValue;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextValue -= 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") nextValue += 1;
    else if (event.key === "PageDown") nextValue -= 5;
    else if (event.key === "PageUp") nextValue += 5;
    else if (event.key === "Home") nextValue = handle === "min" ? yearSliderMin : selectedYearMin;
    else if (event.key === "End") nextValue = handle === "max" ? yearSliderMax : selectedYearMax;
    else return;

    event.preventDefault();
    if (handle === "min") {
      const nextMin = Math.max(yearSliderMin, Math.min(nextValue, selectedYearMax));
      setYearMinFilter(nextMin === yearSliderMin ? "" : String(nextMin));
    } else {
      const nextMax = Math.min(yearSliderMax, Math.max(nextValue, selectedYearMin));
      setYearMaxFilter(nextMax === yearSliderMax ? "" : String(nextMax));
    }
  }, [selectedYearMax, selectedYearMin, yearSliderMax, yearSliderMin]);

  const sellerListingTotalPages = Math.max(
    1,
    Math.ceil(filteredListings.length / SELLER_LISTINGS_PAGE_SIZE)
  );

  const paginatedSellerListings = useMemo(() => {
    const start = (sellerListingPage - 1) * SELLER_LISTINGS_PAGE_SIZE;
    return filteredListings.slice(start, start + SELLER_LISTINGS_PAGE_SIZE);
  }, [filteredListings, sellerListingPage]);

  const hasAdvancedFilters =
    appliedSellerFilters.searchQuery.trim() !== "" ||
    appliedSellerFilters.vehicleTypeFilter.trim() !== "" ||
    appliedSellerFilters.vehicleSubtypeFilter.trim() !== "" ||
    appliedSellerFilters.brandFilter.trim() !== "" ||
    appliedSellerFilters.modelFilter.trim() !== "" ||
    appliedSellerFilters.yearFilter.trim() !== "" ||
    appliedSellerFilters.yearMinFilter.trim() !== "" ||
    appliedSellerFilters.yearMaxFilter.trim() !== "" ||
    appliedSellerFilters.engineCcFilter.trim() !== "" ||
    appliedSellerFilters.engineModelFilter.trim() !== "" ||
    appliedSellerFilters.categoryFilter.trim() !== "" ||
    appliedSellerFilters.subcategoryParentFilter.trim() !== "" ||
    appliedSellerFilters.subcategoryFilter.trim() !== "" ||
    appliedSellerFilters.trackMatLengthFilter.trim() !== "" ||
    appliedSellerFilters.trackMatWidthFilter.trim() !== "" ||
    appliedSellerFilters.trackMatPitchFilter.trim() !== "";

  const reviewIds = useMemo(() => reviews.map((review) => review.id), [reviews]);
  const reviewIdsKey = reviewIds.join("|");

  function resetListingFilters() {
    setSearchQuery("");
    setVehicleTypeFilter("");
    setVehicleSubtypeFilter("");
    setBrandFilter("");
    setModelFilter("");
    setYearFilter("");
    setYearMinFilter("");
    setYearMaxFilter("");
    setEngineCcFilter("");
    setEngineModelFilter("");
    setCategoryFilter("");
    setSubcategoryParentFilter("");
    setSubcategoryFilter("");
    setTrackMatLengthFilter("");
    setTrackMatWidthFilter("");
    setTrackMatPitchFilter("");
    setAppliedSellerFilters({ ...EMPTY_SELLER_APPLIED_FILTERS });
    setSellerListingPage(1);
    setShowAllListings(false);
  }

  function toggleSellerFilters() {
    if (sellerFilterPanelOpen) {
      setSellerFilterPanelOpen(false);
      return;
    }

    setSearchQuery(appliedSellerFilters.searchQuery);
    setListingSort(appliedSellerFilters.listingSort);
    setVehicleTypeFilter(appliedSellerFilters.vehicleTypeFilter);
    setVehicleSubtypeFilter(appliedSellerFilters.vehicleSubtypeFilter);
    setBrandFilter(appliedSellerFilters.brandFilter);
    setModelFilter(appliedSellerFilters.modelFilter);
    setYearFilter(appliedSellerFilters.yearFilter);
    setYearMinFilter(appliedSellerFilters.yearMinFilter);
    setYearMaxFilter(appliedSellerFilters.yearMaxFilter);
    setEngineCcFilter(appliedSellerFilters.engineCcFilter);
    setEngineModelFilter(appliedSellerFilters.engineModelFilter);
    setCategoryFilter(appliedSellerFilters.categoryFilter);
    setSubcategoryParentFilter(appliedSellerFilters.subcategoryParentFilter);
    setSubcategoryFilter(appliedSellerFilters.subcategoryFilter);
    setTrackMatLengthFilter(appliedSellerFilters.trackMatLengthFilter);
    setTrackMatWidthFilter(appliedSellerFilters.trackMatWidthFilter);
    setTrackMatPitchFilter(appliedSellerFilters.trackMatPitchFilter);
    setSellerFilterSheetExpanded(false);
    setSellerFilterPanelOpen(true);
  }

  function applySellerFilters() {
    setAppliedSellerFilters({
      searchQuery,
      listingSort,
      vehicleTypeFilter,
      vehicleSubtypeFilter,
      brandFilter,
      modelFilter,
      yearFilter,
      yearMinFilter,
      yearMaxFilter,
      engineCcFilter,
      engineModelFilter,
      categoryFilter,
      subcategoryParentFilter,
      subcategoryFilter,
      trackMatLengthFilter,
      trackMatWidthFilter,
      trackMatPitchFilter
    });
    setSellerListingPage(1);
    setShowAllListings(false);
    setSellerFilterPanelOpen(false);
  }

  const startSellerFilterSheetDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const sheet = sellerFilterSheetRef.current;
    if (!sheet) return;

    event.preventDefault();
    const startHeight = sheet.getBoundingClientRect().height;
    sellerFilterSheetDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight,
      currentHeight: startHeight
    };
    setSellerFilterSheetDragging(true);
    setSellerFilterSheetDragHeight(startHeight);

    const move = (moveEvent: PointerEvent) => {
      const dragState = sellerFilterSheetDragRef.current;
      if (!dragState || moveEvent.pointerId !== dragState.pointerId) return;
      moveEvent.preventDefault();
      const viewportHeight = window.innerHeight;
      const nextHeight = Math.min(
        viewportHeight * 0.9,
        Math.max(260, dragState.startHeight - (moveEvent.clientY - dragState.startY))
      );
      dragState.currentHeight = nextHeight;
      setSellerFilterSheetDragHeight(nextHeight);
    };

    const stop = (stopEvent: PointerEvent) => {
      const dragState = sellerFilterSheetDragRef.current;
      if (!dragState || stopEvent.pointerId !== dragState.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      sellerFilterSheetDragRef.current = null;
      setSellerFilterSheetDragging(false);
      setSellerFilterSheetDragHeight(null);

      const viewportHeight = window.innerHeight;
      if (dragState.currentHeight < viewportHeight * 0.42) {
        setSellerFilterPanelOpen(false);
        return;
      }
      setSellerFilterSheetExpanded(dragState.currentHeight >= viewportHeight * 0.72);
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }, []);

  const handleSellerFilterSheetKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSellerFilterSheetExpanded(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (sellerFilterSheetExpanded) setSellerFilterSheetExpanded(false);
      else setSellerFilterPanelOpen(false);
    }
  }, [sellerFilterSheetExpanded]);

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
  }, [appliedSellerFilters, sellerId]);

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
    }[locale],
    averageRating: {
      fi: "Keskiarvo",
      en: "Average rating",
      sv: "Genomsnitt",
      no: "Gjennomsnitt",
    }[locale],
    noRatings: {
      fi: "Ei arvosteluja",
      en: "No reviews",
      sv: "Inga omdömen",
      no: "Ingen anmeldelser",
    }[locale],
    activeListings: {
      fi: "Aktiiviset ilmoitukset",
      en: "Active listings",
      sv: "Aktiva annonser",
      no: "Aktive annonser",
    }[locale],
    totalListings: {
      fi: "Ilmoituksia yhteensä",
      en: "Total listings",
      sv: "Annonser totalt",
      no: "Annonser totalt",
    }[locale],
    reviews: {
      fi: "Arvostelut",
      en: "Reviews",
      sv: "Recensioner",
      no: "Anmeldelser",
    }[locale],
    followers: {
      fi: "Seuraajat",
      en: "Followers",
      sv: "Följare",
      no: "Følgere",
    }[locale],
    follow: {
      fi: "Seuraa profiilia",
      en: "Follow profile",
      sv: "Följ profil",
      no: "Følg profil",
    }[locale],
    following: {
      fi: "Seurataan",
      en: "Following",
      sv: "Följer",
      no: "Følger",
    }[locale],
    loginToFollow: {
      fi: "Kirjaudu seurataksesi",
      en: "Sign in to follow",
      sv: "Logga in för att följa",
      no: "Logg inn for å følge",
    }[locale],
    followError: {
      fi: "Seurannan tallennus epäonnistui. Yritä uudelleen.",
      en: "Could not save the follow. Please try again.",
      sv: "Det gick inte att spara följningen. Försök igen.",
      no: "Kunne ikke lagre følgingen. Prøv igjen.",
    }[locale],
    sellerRating: {
      fi: "Myyjäarvio",
      en: "Seller rating",
      sv: "Säljarbetyg",
      no: "Selgervurdering",
    }[locale],
    greatJob: {
      fi: "Hyvä työ!",
      en: "Great job!",
      sv: "Bra jobbat!",
      no: "Bra jobbet!",
    }[locale],
    keepGoodWork: {
      fi: "Jatka samaan malliin.",
      en: "Keep up the good work.",
      sv: "Fortsätt så.",
      no: "Fortsett slik.",
    }[locale],
    completionRate: {
      fi: "Valmiusaste",
      en: "Completion rate",
      sv: "Slutförandegrad",
      no: "Fullføringsgrad",
    }[locale],
    points: {
      fi: "pistettä",
      en: "points",
      sv: "poäng",
      no: "poeng",
    }[locale],
    sellerLevel: {
      fi: "Myyjälevel",
      en: "Seller level",
      sv: "Säljarnivå",
      no: "Selgernivå",
    }[locale],
    accountLevel: {
      fi: "Account level",
      en: "Account level",
      sv: "Account level",
      no: "Kontonivå",
    }[locale],
    registered: {
      fi: "Rekisteroitynyt",
      en: "Registered",
      sv: "Registrerad",
      no: "Registrert",
    }[locale],
    location: {
      fi: "Sijainti",
      en: "Location",
      sv: "Plats",
      no: "Sted",
    }[locale],
    verified: {
      fi: "Vahvistettu",
      en: "Verified",
      sv: "Verifierad",
      no: "Verifisert",
    }[locale],
    extraInfo: {
      fi: "Lisatiedot",
      en: "Additional info",
      sv: "Mer information",
      no: "Mer informasjon",
    }[locale],
    levelMax: {
      fi: "Maksimitaso",
      en: "Max level",
      sv: "Maxnivå",
      no: "Maksnivå",
    }[locale],
    levelUpHint: {
      fi: "Luo ilmoituksia, merkitse myyntejä ja anna sekä saa arvioita.",
      en: "Create listings, mark sales, and give and receive reviews.",
      sv: "Skapa annonser, markera försäljningar och ge samt få recensioner.",
      no: "Opprett annonser, marker salg og gi og motta anmeldelser.",
    }[locale],
    nextLevel: {
      fi: "Seuraavaan tasoon",
      en: "To next level",
      sv: "Till nästa nivå",
      no: "Til neste nivå",
    }[locale],
    xp: {
      fi: "XP",
      en: "XP",
      sv: "XP",
      no: "XP",
    }[locale],
    level: {
      fi: "Level",
      en: "Level",
      sv: "Level",
      no: "Nivå",
    }[locale],
    sold: {
      fi: "Myyty",
      en: "Sold",
      sv: "Sålda",
      no: "Solgt",
    }[locale],
    reviewsGiven: {
      fi: "Annetut arviot",
      en: "Reviews given",
      sv: "Givna recensioner",
      no: "Gitte anmeldelser",
    }[locale],
    phone: {
      fi: "Puhelin",
      en: "Phone",
      sv: "Telefon",
      no: "Telefon",
    }[locale],
    businessId: {
      fi: "Y-tunnus",
      en: "Business ID",
      sv: "FO-nummer",
      no: "Organisasjonsnummer",
    }[locale],
    website: {
      fi: "Nettisivu",
      en: "Website",
      sv: "Webbplats",
      no: "Nettside",
    }[locale],
    advancedSearch: {
      fi: "Tarkempi haku",
      en: "Advanced search",
      sv: "Avancerad sökning",
      no: "Avansert søk",
    }[locale],
    searchPlaceholder: {
      fi: "Hae ilmoituksista",
      en: "Search listings",
      sv: "Sök i annonser",
      no: "Søk i annonser",
    }[locale],
    minPrice: {
      fi: "Min €",
      en: "Min €",
      sv: "Min €",
      no: "Min €",
    }[locale],
    maxPrice: {
      fi: "Max €",
      en: "Max €",
      sv: "Max €",
      no: "Maks €",
    }[locale],
    allConditions: {
      fi: "Kaikki kunnot",
      en: "All conditions",
      sv: "Alla skick",
      no: "Alle tilstander",
    }[locale],
    resetFilters: {
      fi: "Nollaa",
      en: "Reset",
      sv: "Nollställ",
      no: "Nullstill",
    }[locale],
    relevanceFirst: {
      fi: "Osuvimmat ensin",
      en: "Most relevant",
      sv: "Mest relevanta",
      no: "Mest relevante",
    }[locale],
    newestFirst: {
      fi: "Uusimmat ensin",
      en: "Newest first",
      sv: "Nyaste ensin",
      no: "Nyeste først",
    }[locale],
    oldestFirst: {
      fi: "Vanhimmat ensin",
      en: "Oldest first",
      sv: "Aldsta ensin",
      no: "Eldste først",
    }[locale],
    lowestPrice: {
      fi: "Halvin ensin",
      en: "Lowest price",
      sv: "Lagsta pris",
      no: "Laveste pris",
    }[locale],
    highestPrice: {
      fi: "Kallein ensin",
      en: "Highest price",
      sv: "Hogsta pris",
      no: "Høyeste pris",
    }[locale],
    nearestFirst: {
      fi: "Lähimpänä sinua",
      en: "Nearest to you",
      sv: "Narmast dig",
      no: "Nærmest deg",
    }[locale],
    noFilterResults: {
      fi: "Hakuehdoilla ei löytynyt ilmoituksia.",
      en: "No listings matched your filters.",
      sv: "Inga annonser matchade filtren.",
      no: "Ingen annonser matchet filtrene.",
    }[locale],
    noBio: {
      fi: "Myyjä ei ole vielä lisännyt esittelytekstiä.",
      en: "This seller has not added an about text yet.",
      sv: "Säljaren har inte lagt till någon presentation ännu.",
      no: "Selgeren har ikke lagt til en presentasjon ennå.",
    }[locale]
  };
  const companyVerifiedLabel = {
    fi: "Vahvistettu yritys",
    en: "Verified company",
    sv: "Verifierat företag",
    no: "Verifisert bedrift"
  }[locale];
  const languageInfo = {
    fi: { label: "Kieli", value: "Suomi" },
    en: { label: "Language", value: "English" },
    sv: { label: "Språk", value: "Svenska" },
    no: { label: "Språk", value: "Norsk" }
  }[locale];
  const reviewCountLabel = reviews.length === 1 ? t.spReviews.toLowerCase().replace(/s$/, "") : t.spReviews.toLowerCase();
  const visibleReviewCount = reviewsLoaded ? reviews.length : effectiveLevelStats.reviews_received;
  const reviewBasisWord = locale === "fi" ? "arvosteluun" : reviewCountLabel;
  const loadingReviewsLabel = {
    fi: "Ladataan arvosteluja...",
    en: "Loading reviews...",
    sv: "Laddar recensioner...",
    no: "Laster anmeldelser...",
  }[locale];
  const reviewEmptyDescription = {
    fi: `${sellerName} ei ole vielä saanut arvosteluja.`,
    en: `${sellerName} has not received reviews yet.`,
    sv: `${sellerName} har inte fått några recensioner ännu.`,
    no: `${sellerName} har ikke fått anmeldelser ennå.`,
  }[locale];
  const reviewLabels = {
    search: {
      fi: "Hae arvosteluista...",
      en: "Search reviews...",
      sv: "Sök bland recensioner...",
      no: "Søk i anmeldelser...",
    }[locale],
    average: {
      fi: "Keskimääräinen arvio",
      en: "Average rating",
      sv: "Genomsnittligt betyg",
      no: "Gjennomsnittlig vurdering",
    }[locale],
    basedOn: {
      fi: "Perustuu",
      en: "Based on",
      sv: "Baserat på",
      no: "Basert på",
    }[locale],
    verifiedTitle: {
      fi: "Vain vahvistetut kaupat",
      en: "Verified deals only",
      sv: "Endast verifierade affärer",
      no: "Kun verifiserte handler",
    }[locale],
    verifiedBody: {
      fi: "Arvostelut tulevat vain vahvistetuilta käyttäjiltä onnistuneiden kauppojen jälkeen.",
      en: "Reviews come only from verified users after successful deals.",
      sv: "Recensioner kommer bara från verifierade användare efter lyckade affärer.",
      no: "Anmeldelser kommer bare fra verifiserte brukere etter vellykkede handler.",
    }[locale],
    starFilter: {
      fi: "Suodata tähtien mukaan",
      en: "Filter by stars",
      sv: "Filtrera efter stjärnor",
      no: "Filtrer etter stjerner",
    }[locale],
    all: {
      fi: "Kaikki",
      en: "All",
      sv: "Alla",
      no: "Alle",
    }[locale],
    noMatches: {
      fi: "Hakuehdoilla ei löytynyt arvosteluja.",
      en: "No reviews matched your filters.",
      sv: "Inga recensioner matchade filtren.",
      no: "Ingen anmeldelser matchet filtrene.",
    }[locale],
    reply: {
      fi: "Vastaa",
      en: "Reply",
      sv: "Svara",
      no: "Svar",
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
  const renderAverageRatingStars = (rating: number, size = 16) => {
    const normalizedRating = Math.min(5, Math.max(0, rating));

    return (
      <span
        className="seller-ref-rating-stars"
        role="img"
        aria-label={`${normalizedRating.toFixed(1)}/5`}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const fillPercentage = Math.min(100, Math.max(0, (normalizedRating - (star - 1)) * 100));

          return (
            <span
              className="seller-ref-rating-star"
              key={star}
              style={{ "--seller-rating-star-size": `${size}px` } as CSSProperties}
              aria-hidden="true"
            >
              <FractionalRatingStar percentage={fillPercentage} />
            </span>
          );
        })}
      </span>
    );
  };
  const sortOptions: Array<{ value: ListingSort; label: string; icon: typeof Search }> = [
    { value: "relevance", label: refLabels.relevanceFirst, icon: Crosshair },
    { value: "newest", label: refLabels.newestFirst, icon: Clock3 },
    { value: "oldest", label: refLabels.oldestFirst, icon: CalendarDays },
    { value: "priceAsc", label: refLabels.lowestPrice, icon: TrendingDown },
    { value: "priceDesc", label: refLabels.highestPrice, icon: TrendingUp },
    { value: "nearest", label: refLabels.nearestFirst, icon: MapPin }
  ];
  const activeSort = sortOptions.find((option) => option.value === appliedSellerFilters.listingSort) ?? sortOptions[0];

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
              <h1>{sellerName}</h1>
              <span className="seller-ref-account-type">
                {isCompany ? <Building2 size={13} aria-hidden="true" /> : <Users size={13} aria-hidden="true" />}
                {isCompany
                  ? (locale === "fi" ? "Yritys" : locale === "sv" ? "Företag" : locale === "no" ? "Bedrift" : "Company")
                  : (locale === "fi" ? "Yksityishenkilö" : locale === "sv" ? "Privatperson" : locale === "no" ? "Privatperson" : "Private seller")}
              </span>
              {isCompany && profile?.company_verified_at && (
                <span className="seller-ref-title-verified">
                  <Shield size={15} aria-hidden="true" />
                  {companyVerifiedLabel}
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
                  <span className="seller-ref-phone-pill seller-ref-business-id">
                    <Building2 size={13} />
                    <span className="seller-ref-pill-text">
                      <small>{refLabels.businessId}:</small>
                      <strong>{profile.business_id.trim()}</strong>
                    </span>
                  </span>
                )}
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

              <div className="seller-ref-profile-progress">
                <div className="seller-ref-profile-rating">
                  {renderAverageRatingStars(averageRating, 18)}
                  <strong>{reviews.length ? averageRating.toFixed(1) : "–"}</strong>
                  <span>({visibleReviewCount} {reviewCountLabel})</span>
                </div>

                <div className="seller-ref-level-progress">
                  <div className="seller-ref-level-progress-head">
                    <strong>{refLabels.level} {sellerLevel.level}</strong>
                    <span>{sellerLevel.totalXp} {refLabels.xp}</span>
                  </div>
                  <div
                    className="seller-ref-level-progress-track"
                    role="progressbar"
                    aria-label={`${refLabels.level} ${sellerLevel.level}`}
                    aria-valuemin={0}
                    aria-valuemax={sellerLevel.xpForNextLevel}
                    aria-valuenow={sellerLevel.currentLevelXp}
                  >
                    <span style={{ width: `${sellerLevel.progressPercent}%` }} />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {(profile?.bio?.trim() || (isCompany && companyWebsite)) && (
            <article className="seller-ref-about seller-ref-about-highlight">
              {profile?.bio?.trim() && <p>{profile.bio.trim()}</p>}
              {isCompany && companyWebsite && (
                <a href={companyWebsite.href} target="_blank" rel="noreferrer">
                  <Globe2 size={15} aria-hidden="true" />
                  {companyWebsite.label}
                </a>
              )}
            </article>
          )}

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

          <div className="seller-ref-stats">
            <div className="seller-ref-stat">
              <Tag size={22} />
              <strong>{listings.length}</strong>
              <span>{refLabels.activeListings}</span>
            </div>
            <div className="seller-ref-stat">
              <ShoppingBag size={22} />
              <strong>{effectiveLevelStats.sold_count}</strong>
              <span>{refLabels.sold}</span>
            </div>
            <button
              type="button"
              className="seller-ref-stat seller-ref-review-stat"
              onClick={() => setReviewsOpen(true)}
              aria-label={`${t.spReviews}: ${visibleReviewCount}`}
            >
              <MessageCircle size={22} />
              <strong>{visibleReviewCount}</strong>
              <span>{refLabels.reviews}</span>
            </button>
          </div>

          <div className="seller-ref-detail-card" aria-label="Profiilin lisätiedot">
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
                    <span>{companyVerifiedLabel}</span>
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
              <span>{languageInfo.label}</span>
              <strong>{languageInfo.value}</strong>
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

        {false && activeTab === "listings" && sellerFilterPanelOpen && (
          <>
            <button
              type="button"
              className="sp-filter-panel-backdrop"
              aria-label="Sulje suodattimet"
              onClick={() => setSellerFilterPanelOpen(false)}
            />
            <aside className="sp-filter-panel" id="seller-profile-filter-panel" aria-label="Suodata ilmoituksia">
              <div className="sp-filter-panel-head">
                <strong>Suodata hakua</strong>
                <button type="button" aria-label="Sulje suodattimet" onClick={() => setSellerFilterPanelOpen(false)}>
                  <CircleX size={20} aria-hidden="true" />
                </button>
              </div>

              <label className="sp-filter-field">
                <span>Ajoneuvolaji</span>
                <SellerFilterSelect
                  value={vehicleTypeFilter}
                  placeholder="Kaikki ajoneuvot"
                  options={sellerFilterOptions.vehicleTypes}
                  onChange={(value) => {
                    setVehicleTypeFilter(value);
                    setVehicleSubtypeFilter("");
                    setBrandFilter("");
                    setModelFilter("");
                    setEngineModelFilter("");
                  }}
                />
              </label>

              <label className="sp-filter-field">
                <span>Tyyppi</span>
                <SellerFilterSelect
                  value={vehicleSubtypeFilter}
                  placeholder="Kaikki tyypit"
                  options={sellerFilterOptions.vehicleSubtypes}
                  onChange={setVehicleSubtypeFilter}
                />
              </label>

              <label className="sp-filter-field">
                <span>Merkki</span>
                <SellerFilterSelect
                  value={brandFilter}
                  placeholder="Kaikki merkit"
                  options={sellerFilterOptions.brands}
                  onChange={(value) => {
                    setBrandFilter(value);
                    setModelFilter("");
                  }}
                />
              </label>

              <label className="sp-filter-field sp-filter-field-compact">
                <span>Malli</span>
                <SellerFilterSelect
                  value={modelFilter}
                  placeholder="Kaikki mallit"
                  options={sellerFilterOptions.models}
                  onChange={setModelFilter}
                />
              </label>

              <div className="sp-filter-field">
                <span>Vuosimalli</span>
                <div className="sp-filter-year-row sp-filter-year-row-inline">
                  <SellerFilterSelect
                    value={yearMinFilter}
                    placeholder="Minimi"
                    options={sellerFilterOptions.years}
                    onChange={setYearMinFilter}
                  />
                  <small>-</small>
                  <SellerFilterSelect
                    value={yearMaxFilter}
                    placeholder="Maksimi"
                    options={sellerFilterOptions.years}
                    onChange={setYearMaxFilter}
                  />
                </div>
                <div
                  className="sp-year-range-clean"
                  data-sp-year-range-clean="true"
                  ref={sellerYearSliderRef}
                  role="group"
                  aria-label="Vuosimallin rajaus"
                  style={{
                    "--sp-year-min": `${yearSliderLeft}%`,
                    "--sp-year-max": `${100 - yearSliderRight}%`,
                    "--sp-year-mid": `${(yearSliderLeft + (100 - yearSliderRight)) / 2}%`
                  } as CSSProperties}
                  onPointerDown={(event) => startSellerYearRangeDrag(event)}
                >
                  <span className="sp-year-range-clean-line" aria-hidden="true" />
                  <span
                    role="slider"
                    tabIndex={0}
                    className="sp-year-range-clean-thumb"
                    style={{ left: `${yearSliderLeft}%` } as CSSProperties}
                    aria-label="Vuosimallin minimi"
                    aria-valuemin={yearSliderMin}
                    aria-valuemax={selectedYearMax}
                    aria-valuenow={selectedYearMin}
                    onPointerDown={(event) => startSellerYearRangeDrag(event, "min")}
                    onKeyDown={(event) => handleSellerYearRangeKeyDown(event, "min")}
                  />
                  <span
                    role="slider"
                    tabIndex={0}
                    className="sp-year-range-clean-thumb"
                    style={{ left: `${100 - yearSliderRight}%` } as CSSProperties}
                    aria-label="Vuosimallin maksimi"
                    aria-valuemin={selectedYearMin}
                    aria-valuemax={yearSliderMax}
                    aria-valuenow={selectedYearMax}
                    onPointerDown={(event) => startSellerYearRangeDrag(event, "max")}
                    onKeyDown={(event) => handleSellerYearRangeKeyDown(event, "max")}
                  />
                </div>
              </div>

              <label className="sp-filter-field">
                <span>Moottoritilavuus (cm3)</span>
                <SellerFilterSelect
                  value={engineCcFilter}
                  placeholder="Kaikki koot"
                  options={sellerFilterOptions.engineCcs}
                  onChange={setEngineCcFilter}
                />
              </label>

              <div className="sp-filter-section-title">Osakategoriointi</div>

              <label className="sp-filter-field">
                <span>Pääkategoria</span>
                <SellerFilterSelect
                  value={categoryFilter}
                  placeholder="Valitse pääkategoria"
                  options={sellerFilterOptions.categories}
                  getLabel={(option) => translateCategory(locale, option)}
                  onChange={(value) => {
                    setCategoryFilter(value);
                    setSubcategoryParentFilter("");
                    setSubcategoryFilter("");
                  }}
                />
              </label>

              <label className="sp-filter-field">
                <span>Alakategoria</span>
                <SellerFilterSelect
                  value={subcategoryParentFilter}
                  placeholder="Valitse alakategoria"
                  options={sellerFilterOptions.subcategoryParents}
                  getLabel={(option) => translateCategory(locale, categoryLeaf(option))}
                  onChange={(value) => {
                    setSubcategoryParentFilter(value);
                    setSubcategoryFilter("");
                  }}
                />
              </label>

              <label className="sp-filter-field">
                <span>Tarkempi osa</span>
                <SellerFilterSelect
                  value={subcategoryFilter}
                  placeholder="Valitse tarkempi osa"
                  options={sellerFilterOptions.subcategories}
                  getLabel={(option) => translateCategory(locale, categoryLeaf(option))}
                  onChange={setSubcategoryFilter}
                />
              </label>

              <div className="sp-filter-panel-actions">
              <button
                type="button"
                className="sp-filter-show-results"
                onClick={() => {
                  setSellerFilterPanelOpen(false);
                  setSellerListingPage(1);
                }}
              >
                Näytä tulokset ({filteredListings.length})
              </button>
              <button type="button" className="sp-filter-clear" onClick={resetListingFilters}>
                Tyhjennä hakuehdot
              </button>
              </div>
            </aside>
          </>
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
              {visibleReviewCount > 0 && (
                <button type="button" className="seller-empty-reviews-button" onClick={() => setReviewsOpen(true)}>
                  <Star size={15} aria-hidden="true" />
                  {locale === "fi" ? `Lue arvostelut (${visibleReviewCount})` : `${t.spReviews} (${visibleReviewCount})`}
                </button>
              )}
            </div>
          ) : (
            <div className="seller-profile-reference-main">
              <div className="seller-profile-listings-panel">
                <div className="seller-profile-section-heading">
                  <h2>{locale === "fi" ? "Viimeisimmät ilmoitukset" : locale === "sv" ? "Senaste annonser" : locale === "no" ? "Siste annonser" : "Latest listings"}</h2>
                  <button
                    type="button"
                    className="seller-profile-heading-filter-button"
                    aria-expanded={sellerFilterPanelOpen}
                    aria-controls="seller-home-filter-bar"
                    onClick={() => {
                      setSortOpen(false);
                      toggleSellerFilters();
                    }}
                  >
                    {locale === "fi" ? "Suodata" : locale === "sv" ? "Filtrera" : locale === "no" ? "Filtrer" : "Filter"}
                    <SlidersHorizontal size={14} aria-hidden="true" />
                  </button>
                  <div className="seller-profile-section-actions">
                    {hasAdvancedFilters && (
                      <button type="button" className="seller-profile-reset-filters" onClick={resetListingFilters}>
                        <RotateCcw size={14} aria-hidden="true" />
                        Nollaa suodatukset
                      </button>
                    )}
                    <button
                      type="button"
                      className="seller-profile-reviews-button"
                      onClick={() => setReviewsOpen(true)}
                    >
                      <Star size={15} aria-hidden="true" />
                      <span>
                        {locale === "fi"
                          ? `Arvostelut (${visibleReviewCount})`
                          : locale === "sv"
                            ? `Omdömen (${visibleReviewCount})`
                            : locale === "no"
                              ? `Anmeldelser (${visibleReviewCount})`
                              : `Reviews (${visibleReviewCount})`}
                      </span>
                    </button>
                    <div
                      className={`sp-sort-wrap seller-profile-sort${sortOpen ? " is-open" : ""}`}
                      onBlur={(event) => {
                        const nextTarget = event.relatedTarget;
                        if (!(nextTarget instanceof HTMLElement) || !event.currentTarget.contains(nextTarget)) {
                          setSortOpen(false);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setSortOpen(false);
                      }}
                    >
                      <button
                        type="button"
                        className="sp-sort-button"
                        aria-haspopup="menu"
                        aria-expanded={sortOpen}
                        onClick={() => setSortOpen((open) => !open)}
                      >
                        <SlidersHorizontal size={15} aria-hidden="true" />
                        <span>{activeSort.label}</span>
                        <ChevronDown size={15} className="sp-sort-chevron" aria-hidden="true" />
                      </button>
                      {sortOpen && (
                        <div className="sp-sort-menu" role="menu">
                          {sortOptions.map((option) => {
                            const Icon = option.icon;
                            const selected = option.value === appliedSellerFilters.listingSort;
                            return (
                              <button
                                type="button"
                                className={`sp-sort-option${selected ? " selected" : ""}`}
                                role="menuitemradio"
                                aria-checked={selected}
                                key={option.value}
                                onClick={() => {
                                  setListingSort(option.value);
                                  setAppliedSellerFilters((current) => ({ ...current, listingSort: option.value }));
                                  setSellerListingPage(1);
                                  setShowAllListings(false);
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
                      className="seller-profile-filter-button"
                      aria-expanded={sellerFilterPanelOpen}
                      aria-controls="seller-home-filter-bar"
                      onClick={() => {
                        setSortOpen(false);
                        toggleSellerFilters();
                      }}
                    >
                      {locale === "fi" ? "Suodata" : locale === "sv" ? "Filtrera" : locale === "no" ? "Filtrer" : "Filter"}
                      <SlidersHorizontal size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {sellerFilterPanelOpen && (
                  <button
                    type="button"
                    className="seller-home-filter-backdrop"
                    data-mobile-filter-backdrop="true"
                    aria-label="Sulje kategoriointi"
                    onClick={() => setSellerFilterPanelOpen(false)}
                  />
                )}
                <form
                  id="seller-home-filter-bar"
                  ref={sellerFilterSheetRef}
                  className={`seller-home-filter-bar${sellerFilterPanelOpen ? " is-open" : ""}${sellerFilterSheetExpanded ? " is-expanded" : ""}${sellerFilterSheetDragging ? " is-dragging" : ""}`}
                  style={{
                    "--seller-filter-sheet-height": sellerFilterSheetDragHeight === null
                      ? "auto"
                      : `${sellerFilterSheetDragHeight}px`
                  } as CSSProperties}
                  role="search"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <div
                    className="seller-mobile-filter-drag-handle"
                    role="button"
                    tabIndex={0}
                    aria-label="Muuta suodatuspaneelin korkeutta"
                    aria-expanded={sellerFilterSheetExpanded}
                    onPointerDown={startSellerFilterSheetDrag}
                    onKeyDown={handleSellerFilterSheetKeyDown}
                  >
                    <span />
                  </div>
                  <header className="seller-home-filter-head">
                    <strong>
                      <span className="seller-filter-title-desktop">Suodattimet</span>
                      <span className="seller-filter-title-mobile">Suodata hakua</span>
                    </strong>
                    <div>
                      <button type="button" className="seller-filter-head-reset" onClick={resetListingFilters}>Nollaa suodatukset</button>
                      <button type="button" className="seller-filter-head-close" aria-label="Sulje kategoriointi" onClick={() => setSellerFilterPanelOpen(false)}>
                        <X size={23} strokeWidth={2.6} aria-hidden="true" />
                      </button>
                    </div>
                  </header>

                  <div className="seller-mobile-filter-content">

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-vehicle`}>
                    <span className={homeStyles.heroFilterLabel}>Ajoneuvolaji</span>
                    <select
                      className={`${homeStyles.heroFilterSelect} seller-home-filter-select`}
                      value={vehicleTypeFilter}
                      onChange={(event) => {
                        setVehicleTypeFilter(event.target.value);
                        setVehicleSubtypeFilter("");
                        setBrandFilter("");
                        setModelFilter("");
                      }}
                    >
                      <option value="">Kaikki ajoneuvot</option>
                      {sellerFilterOptions.vehicleTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-type`}>
                    <span className={homeStyles.heroFilterLabel}>Tyyppi</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={vehicleSubtypeFilter} onChange={(event) => setVehicleSubtypeFilter(event.target.value)}>
                      <option value="">Kaikki tyypit</option>
                      {sellerFilterOptions.vehicleSubtypes.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-brand`}>
                    <span className={homeStyles.heroFilterLabel}>Merkki</span>
                    <select
                      className={`${homeStyles.heroFilterSelect} seller-home-filter-select`}
                      value={brandFilter}
                      onChange={(event) => { setBrandFilter(event.target.value); setModelFilter(""); }}
                    >
                      <option value="">Kaikki merkit</option>
                      {sellerFilterOptions.brands.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-model`}>
                    <span className={homeStyles.heroFilterLabel}>Malli</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}>
                      <option value="">Kaikki mallit</option>
                      {sellerFilterOptions.models.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>

                  <div className="seller-filter-section-title">Osakategoriointi</div>

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-category`}>
                    <span className={homeStyles.heroFilterLabel}>Pääkategoria</span>
                    <select
                      className={`${homeStyles.heroFilterSelect} seller-home-filter-select`}
                      value={categoryFilter}
                      onChange={(event) => {
                        setCategoryFilter(event.target.value);
                        setSubcategoryParentFilter("");
                        setSubcategoryFilter("");
                        setTrackMatLengthFilter("");
                        setTrackMatWidthFilter("");
                        setTrackMatPitchFilter("");
                      }}
                    >
                      <option value="">Kaikki kategoriat</option>
                      {sellerFilterOptions.categories.map((option) => <option key={option} value={option}>{translateCategory(locale, option)}</option>)}
                    </select>
                  </label>

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-subcategory`}>
                    <span className={homeStyles.heroFilterLabel}>Alakategoria</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={subcategoryParentFilter} onChange={(event) => {
                      setSubcategoryParentFilter(event.target.value);
                      setSubcategoryFilter("");
                      setTrackMatLengthFilter("");
                      setTrackMatWidthFilter("");
                      setTrackMatPitchFilter("");
                    }}>
                      <option value="">Kaikki alakategoriat</option>
                      {sellerFilterOptions.subcategoryParents.map((option) => <option key={option} value={option}>{translateCategory(locale, categoryLeaf(option))}</option>)}
                    </select>
                  </label>

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-part`}>
                    <span className={homeStyles.heroFilterLabel}>Tarkempi osa</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={subcategoryFilter} onChange={(event) => {
                      const nextValue = event.target.value;
                      setSubcategoryFilter(nextValue);
                      if (!isSellerTrackMatSelection(nextValue)) {
                        setTrackMatLengthFilter("");
                        setTrackMatWidthFilter("");
                        setTrackMatPitchFilter("");
                      }
                    }}>
                      <option value="">Kaikki tarkemmat osat</option>
                      {sellerFilterOptions.subcategories.map((option) => <option key={option} value={option}>{translateCategory(locale, categoryLeaf(option))}</option>)}
                    </select>
                  </label>

                  {trackMatDimensionsVisible && (
                    <fieldset ref={sellerTrackMatDimensionsRef} className="seller-track-mat-dimensions">
                      <legend>Telamaton mitat</legend>
                      <div className="seller-track-mat-dimension-fields">
                        <label>
                          <span>Pituus (cm)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={trackMatLengthFilter}
                            onChange={(event) => setTrackMatLengthFilter(event.target.value)}
                            placeholder="esim. 345"
                          />
                        </label>
                        <span aria-hidden="true">×</span>
                        <label>
                          <span>Leveys (cm)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={trackMatWidthFilter}
                            onChange={(event) => setTrackMatWidthFilter(event.target.value)}
                            placeholder="esim. 38"
                          />
                        </label>
                        <span aria-hidden="true">×</span>
                        <label>
                          <span>Jako (cm)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={trackMatPitchFilter}
                            onChange={(event) => setTrackMatPitchFilter(event.target.value)}
                            placeholder="esim. 7,3"
                          />
                        </label>
                      </div>
                    </fieldset>
                  )}

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-engine-cc`}>
                    <span className={homeStyles.heroFilterLabel}>Moottoritilavuus (cm³)</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={engineCcFilter} onChange={(event) => setEngineCcFilter(event.target.value)}>
                      <option value="">Kaikki koot</option>
                      {sellerFilterOptions.engineCcs.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>

                  <div className="seller-home-filter-years">
                    <span>Vuosimalli</span>
                    <select value={yearMinFilter} onChange={(event) => setYearMinFilter(event.target.value)}>
                      <option value="">Minimi</option>
                      {sellerFilterOptions.years.map((option) => <option key={`min-${option}`} value={option}>{option}</option>)}
                    </select>
                    <select value={yearMaxFilter} onChange={(event) => setYearMaxFilter(event.target.value)}>
                      <option value="">Maksimi</option>
                      {sellerFilterOptions.years.map((option) => <option key={`max-${option}`} value={option}>{option}</option>)}
                    </select>
                    <div
                      className="seller-home-year-slider"
                      ref={sellerYearSliderRef}
                      role="group"
                      aria-label="Vuosimallin rajaus"
                      onPointerDown={(event) => startSellerYearRangeDrag(event)}
                    >
                      <span className="seller-home-year-slider-rail" aria-hidden="true" />
                      <span
                        className="seller-home-year-slider-active"
                        style={{ left: `${yearSliderLeft}%`, right: `${yearSliderRight}%` }}
                        aria-hidden="true"
                      />
                      <span
                        role="slider"
                        tabIndex={0}
                        className="seller-home-year-slider-thumb"
                        style={{ left: `${yearSliderLeft}%` }}
                        aria-label="Vuosimallin minimi"
                        aria-valuemin={yearSliderMin}
                        aria-valuemax={selectedYearMax}
                        aria-valuenow={selectedYearMin}
                        onPointerDown={(event) => startSellerYearRangeDrag(event, "min")}
                        onKeyDown={(event) => handleSellerYearRangeKeyDown(event, "min")}
                      />
                      <span
                        role="slider"
                        tabIndex={0}
                        className="seller-home-year-slider-thumb"
                        style={{ left: `${100 - yearSliderRight}%` }}
                        aria-label="Vuosimallin maksimi"
                        aria-valuemin={selectedYearMin}
                        aria-valuemax={yearSliderMax}
                        aria-valuenow={selectedYearMax}
                        onPointerDown={(event) => startSellerYearRangeDrag(event, "max")}
                        onKeyDown={(event) => handleSellerYearRangeKeyDown(event, "max")}
                      />
                    </div>
                  </div>

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-engine-model`}>
                    <span className={homeStyles.heroFilterLabel}>Moottori</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={engineModelFilter} onChange={(event) => setEngineModelFilter(event.target.value)}>
                      <option value="">Kaikki moottorit</option>
                      {sellerFilterOptions.engineModels.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-sort`}>
                    <span className={homeStyles.heroFilterLabel}>Järjestys</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={listingSort} onChange={(event) => setListingSort(event.target.value as ListingSort)}>
                      {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>

                  </div>

                  <div className="seller-home-filter-actions">
                    <button type="button" onClick={applySellerFilters}>
                      Näytä tulokset ({draftFilteredListingCount})
                    </button>
                    <button type="button" onClick={resetListingFilters}>Tyhjennä hakuehdot</button>
                  </div>
                </form>
                {filteredListings.length === 0 ? (
                  <div className="sp-empty seller-filtered-empty">
                    <div className="sp-empty-icon">
                      <Search size={48} />
                    </div>
                    <h3>{refLabels.noFilterResults}</h3>
                    <p>Muokkaa suodatusta tai nollaa suodatukset.</p>
                  </div>
                ) : (
                <>
                <div className="seller-listing-grid">
              {(showAllListings ? paginatedSellerListings : paginatedSellerListings.slice(0, 8)).map((listing, index) => {
                const title = getListingTitle(listing);
                const locationLabel = formatListingLocation(listing.location, t.country);
                const countryFlag = getCountryFlagFromLocation(locationLabel, t.country);
                const fallbackImage = listingFallbackImageSrc(listing, index);
                const imageSrc = listingImageSrc(listing, index);
                const isFavorite = favorites.includes(listing.id);
                return (
                  <article
                    className={`${homeStyles.card} seller-home-listing-card`}
                    key={listing.id}
                    data-listing-card="true"
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
                    <div className={`${homeStyles.cardImage} ${homeStyles.listingCardImage}`}>
                      <span className={homeStyles.cardImageBlur} aria-hidden="true">
                        <OptimizedListingImage src={imageSrc || fallbackImage} alt="" decorative />
                      </span>
                      <OptimizedListingImage src={imageSrc || fallbackImage} alt={title} />
                      {isSellerListingNew(listing.created_at) && (
                        <span className={homeStyles.newBadge} aria-label={locale === "fi" ? "Uusi" : locale === "sv" ? "Ny" : locale === "no" ? "Ny" : "New"}>
                          {locale === "fi" ? "Uusi" : locale === "sv" ? "Ny" : locale === "no" ? "Ny" : "New"}
                        </span>
                      )}
                      {currentUserId && <button
                        type="button"
                        className={`${homeStyles.favoriteButton}${isFavorite ? ` ${homeStyles.favoriteButtonActive}` : ""}`}
                        aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                        onClick={(event) => toggleFavorite(event, listing.id)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                      >
                        <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                      </button>}
                    </div>
                    <div className={homeStyles.cardBody}>
                      <p className={homeStyles.cardPrice}>{formatPrice(listing.price)}</p>
                      <h3 className={homeStyles.cardTitle}>{title}</h3>
                      <ListingVehicleMeta year={listing.year} brand={listing.brand} model={listing.model} />
                      <div className={homeStyles.cardMetaRow} data-listing-card-meta="true">
                        <span className={homeStyles.cardLocationMeta}>
                          {countryFlag ? (
                            <img
                              className={homeStyles.listingCountryFlag}
                              src={countryFlag.src}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                            />
                          ) : null}
                          {formatLocationWithCountry(listing.location, t.country, locale)}
                        </span>
                        <span className={homeStyles.cardDateMeta}>
                          <Clock3 size={14} aria-hidden="true" />
                          {formatListingDate(listing.created_at, locale)}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
                </div>
            {!showAllListings && paginatedSellerListings.length > 8 && (
              <button type="button" className="seller-profile-show-more" onClick={() => setShowAllListings(true)}>
                {locale === "fi" ? "Näytä lisää ilmoituksia" : locale === "sv" ? "Visa fler annonser" : locale === "no" ? "Vis flere annonser" : "Show more listings"}
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            )}
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
              )}
              </div>

            </div>
          )
        )}

        {reviewsOpen && (
          <div
            className="seller-review-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setReviewsOpen(false);
            }}
          >
            <section className="seller-review-modal" role="dialog" aria-modal="true" aria-labelledby="seller-review-modal-title">
              <header className="seller-review-modal-head">
                <div>
                  <span>{sellerName}</span>
                  <h2 id="seller-review-modal-title">
                    {t.spReviews} <small>{visibleReviewCount}</small>
                  </h2>
                </div>
                <button type="button" aria-label="Sulje arvostelut" onClick={() => setReviewsOpen(false)}>
                  <CircleX size={24} aria-hidden="true" />
                </button>
              </header>

              <div className="seller-review-modal-summary">
                <strong>{reviews.length ? averageRating.toFixed(1) : "0.0"}</strong>
                <div>
                  {renderAverageRatingStars(averageRating, 19)}
                  <span>{visibleReviewCount} {reviewCountLabel}</span>
                </div>
              </div>

              <div className="seller-review-modal-list">
                {reviews.length > 0 ? reviews.map((review) => (
                  <article key={review.id}>
                    <header>
                      <span className="seller-review-modal-avatar">{getReviewInitials(review.reviewer_name)}</span>
                      <div>
                        <strong>{review.reviewer_name}</strong>
                        <time>{formatListingDate(review.created_at, locale)}</time>
                      </div>
                      {renderReviewStars(review.rating, 15)}
                    </header>
                    <p>{review.comment}</p>
                  </article>
                )) : (
                  <div className="seller-review-modal-empty">
                    <Star size={30} aria-hidden="true" />
                    <strong>{t.noReviews}</strong>
                    <p>{reviewEmptyDescription}</p>
                  </div>
                )}
              </div>
            </section>
          </div>
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

      </section>

      <style jsx media="not all">{`
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
