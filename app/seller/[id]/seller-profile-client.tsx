"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import homeStyles from "../../page.module.css";
import { ArrowDownWideNarrow, ArrowRight, Bell, Bookmark, Building2, CalendarDays, Check, ChevronDown, ChevronRight, ChevronUp, CircleX, Clock3, Cog, CreditCard, Crosshair, ExternalLink, Globe2, Heart, LayoutGrid, List, MapPin, MessageCircle, PackageCheck, Palette, Phone, RotateCcw, Search, Shield, ShoppingBag, ShoppingCart, SlidersHorizontal, Star, Store, Tag, TrendingDown, TrendingUp, Truck, UserCheck, UserPlus, Users, X } from "lucide-react";
import { formatPrice, isVehicleListing, normalizeVehicleType, type Listing } from "@/lib/listings";
import { useLanguage, translateCategory, type Locale } from "@/lib/i18n";
import { generatedUiTranslations } from "@/lib/generated-ui-translations";
import { commerceUiTranslations } from "@/lib/commerce-ui-translations";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { formatLocationWithCountry, getCountryFlagFromLocation } from "@/lib/country-flags";
import { calculateSellerLevel } from "@/lib/seller-level";
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";
import { listingPath, listingUrlId, pagePath, profilePath, publicCompanyDisplayName } from "@/lib/routes";
import {
  buildVehicleCategoriesFromTaxonomy,
  categoriesAsRecord,
  vehicleBrandsRecord
} from "@/lib/taxonomy";
import { useTaxonomy } from "@/app/components/TaxonomyProvider";
import ListingVehicleMeta from "@/app/components/ListingVehicleMeta";
import OptimizedListingImage from "@/app/components/OptimizedListingImage";
import ListingSalePrice from "@/app/components/ListingSalePrice";
import { useCurrency } from "@/app/components/CurrencyProvider";
import PageLoadingFallback from "@/app/components/PageLoadingFallback";
import commerceStyles from "@/app/commerce.module.css";
import premiumStyles from "./premium-company-profile.module.css";
import { addCartProduct } from "@/lib/commerce/cart";
import { activeSaleDiscountPercent, activeSalePrice } from "@/lib/commerce/discounts";
import type { PublicProduct, PublicStorefront } from "@/lib/commerce/types";
import {
  MARKETPLACE_YEAR_FILTER_MIN,
  buildMarketplaceCategorySource,
  buildMarketplaceFilterOptions,
  getMarketplaceYearFilterMax
} from "@/lib/marketplace-filter-options";
import { VEHICLE_ACCESSORY_OPTIONS, readVehicleAccessories, translateVehicleAccessory } from "@/lib/vehicle-accessories";
import { VEHICLE_COLOR_OPTIONS, readVehicleColors, translateVehicleColor } from "@/lib/vehicle-colors";
import {
  getPublicListingsBySeller,
  getSavedListingIds,
  getProfileFollowStats,
  getSellerReviewLikeSummary,
  getProfile,
  getPublicProfile,
  getPublicSellerLevelStats,
  getReviewsBySeller,
  createSellerReview,
  getMaskinesProfileDisplayName,
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

type StorefrontItemView = {
  kind: "product" | "listing";
  key: string;
  product: PublicProduct | null;
  listing: Listing | null;
  mode: "parts" | "vehicles" | "gear";
  category: string;
  subcategory: string;
  vehicleType: string;
  vehicleSubtype: string;
  brand: string;
  model: string;
  year: string;
  engineCc: string;
  engineModel: string;
  title: string;
  description: string;
  priceCents: number;
  createdAt: string;
  pickupAvailable: boolean;
  shippingAvailable: boolean;
};

type ProfileDesktopFilterChoice = {
  id: string;
  title: string;
  description: string;
  active: boolean;
  count: number;
  onSelect: () => void;
};

type ProfileDesktopFilterTab = {
  id: string;
  label: string;
};

function ProfileDesktopFilterPanel({
  dialogTitleId,
  scrollScope,
  subtitle,
  resultCount,
  saved,
  choices,
  tabs,
  activeTab,
  onSave,
  onClear,
  onApply,
  onClose,
  onTabSelect,
  children
}: {
  dialogTitleId: string;
  scrollScope: string;
  subtitle: string;
  resultCount: number;
  saved: boolean;
  choices: ProfileDesktopFilterChoice[];
  tabs: ProfileDesktopFilterTab[];
  activeTab: string;
  onSave: () => void;
  onClear: () => void;
  onApply: () => void;
  onClose: () => void;
  onTabSelect: (tabId: string) => void;
  children: ReactNode;
}) {
  return (
    <div className={homeStyles.desktopFullFilterPanel} role="dialog" aria-modal="true" aria-labelledby={dialogTitleId}>
      <header className={homeStyles.desktopFullFilterTopbar}>
        <div className={homeStyles.desktopFullHeading}>
          <strong id={dialogTitleId}>Kaikki hakuehdot</strong>
          <small>{subtitle}</small>
        </div>
        <button type="button" className={homeStyles.desktopSaveSearch} onClick={onSave}>
          <Bookmark size={17} aria-hidden="true" />
          {saved ? "Haku tallennettu" : "Tallenna haku"}
        </button>
        <button type="button" className={homeStyles.desktopFullSearchButton} onClick={onApply}>
          Hae ({resultCount.toLocaleString("fi-FI")})
        </button>
        <button type="button" className={homeStyles.desktopFullClose} aria-label="Sulje kaikki hakuehdot" onClick={onClose}>
          <X size={25} aria-hidden="true" />
        </button>
      </header>

      <div className={homeStyles.desktopFullUtilityRow}>
        <div><span className={premiumStyles.profileFilterScopeText}>Vain tämän profiilin myynnissä olevat tuotteet</span></div>
        <button type="button" onClick={onClear}>Tyhjennä</button>
      </div>

      <section className={homeStyles.desktopMarketplaceChooser} aria-label="Valitse ilmoitustyyppi">
        <span>Mitä etsit?</span>
        <div style={{ gridTemplateColumns: `repeat(${Math.max(1, choices.length)}, minmax(0, 1fr))` }}>
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={choice.active ? homeStyles.desktopMarketplaceChoiceActive : ""}
              onClick={choice.onSelect}
            >
              <strong>{choice.title}</strong>
              <small>{choice.description} · {choice.count}</small>
            </button>
          ))}
        </div>
      </section>

      <nav className={homeStyles.desktopFullTabs} aria-label="Hakuehtojen osiot">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? homeStyles.desktopFullTabActive : ""}
            onClick={() => onTabSelect(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={homeStyles.desktopFullFilterScroll} data-profile-desktop-filter-scroll={scrollScope}>
        {children}
      </div>
    </div>
  );
}

function ProfileDesktopSelect({
  label,
  value,
  allLabel,
  options,
  onChange
}: {
  label: string;
  value: string;
  allLabel: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <label className={homeStyles.desktopFullField}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ProfileDesktopCategoryStep({
  number,
  title,
  description,
  value,
  options,
  enabled,
  disabledLabel,
  onChange
}: {
  number: number;
  title: string;
  description: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  enabled: boolean;
  disabledLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={homeStyles.desktopCategoryStep} data-enabled={enabled ? "true" : "false"}>
      <header>
        <span>{number}</span>
        <div><strong>{title}</strong><small>{description}</small></div>
      </header>
      <select aria-label={title} disabled={!enabled} value={enabled ? value : ""} onChange={(event) => onChange(event.target.value)}>
        {!enabled
          ? <option value="">{disabledLabel}</option>
          : <><option value="">Kaikki</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</>}
      </select>
    </div>
  );
}

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
type ListingSort = "relevance" | "newest" | "oldest" | "priceAsc" | "priceDesc";
type StorefrontSort = ListingSort;
type ReviewSort = "newest" | "oldest" | "highest" | "lowest";
type SellerListingMode = "parts" | "vehicles" | "gear";
type SellerListingResultMode = SellerListingMode | "all";

const SELLER_VEHICLE_ENGINE_KIND_OPTIONS = ["2-tahti", "4-tahti", "Diesel", "Sähkö"] as const;
const SELLER_VEHICLE_DRIVE_TYPE_OPTIONS = [
  "Etuveto",
  "Kuusipyöräveto",
  "Hihnaveto",
  "Neliveto",
  "Kardaaniveto",
  "Takaveto",
  "Ketjuveto"
] as const;
const SELLER_VEHICLE_ROAD_LEGAL_OPTIONS = [
  "Tieliikennekelpoinen",
  "Ei tieliikennekelpoinen"
] as const;
const SELLER_VEHICLE_MILEAGE_FILTER_MAX = 200000;
const SELLER_VEHICLE_HOURS_FILTER_MAX = 5000;
const SELLER_VEHICLE_PRICE_FILTER_MAX = 100000;

function sellerVehicleDescriptionValue(description: string | null | undefined, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (description ?? "").match(new RegExp(`${escapedLabel}:\\s*([^\\r\\n]+)`, "i"))?.[1]?.trim() ?? "";
}

function storefrontItemMode(listing: Listing | null, ...labels: Array<string | null | undefined>): StorefrontItemView["mode"] {
  if (listing && isVehicleListing(listing)) return "vehicles";
  const text = normalizeSellerFilterText(labels.join(" "));
  const gearTerms = ["ajovarust", "ajoasu", "ajokenka", "ajosaapas", "kypara", "kypärä", "hanska", "suojavarust"];
  return gearTerms.some((term) => text.includes(normalizeSellerFilterText(term))) ? "gear" : "parts";
}

function sellerListingModeForListing(listing: Listing): SellerListingMode {
  return storefrontItemMode(
    listing,
    listing.category,
    listing.subcategory,
    listing.vehicle_type,
    listing.title,
    listing.description
  );
}

const STOREFRONT_SEARCH_LOCALES: Locale[] = ["fi", "en", "sv", "no"];

function storefrontItemSearchText(view: StorefrontItemView) {
  const listing = view.listing;
  const translatedListingText = listing
    ? STOREFRONT_SEARCH_LOCALES.flatMap((language) => [
        listing.translations?.[language]?.title,
        listing.translations?.[language]?.description
      ])
    : [];
  const translatedTaxonomy = STOREFRONT_SEARCH_LOCALES.flatMap((language) => [
    translateCategory(language, view.category),
    ...view.subcategory.split("/").map((part) => translateCategory(language, part.trim())),
    translateCategory(language, view.vehicleType)
  ]);
  const listingNumber = listing?.listing_number ? String(listing.listing_number) : "";

  return [
    view.title,
    view.description,
    view.category,
    view.subcategory,
    view.vehicleType,
    view.vehicleSubtype,
    view.brand,
    view.model,
    view.year,
    view.engineCc,
    view.engineModel,
    listing?.title,
    listing?.description,
    listing?.part_number,
    listing?.part_model,
    listing?.condition,
    listing?.location,
    listing?.id,
    listingNumber,
    listingNumber ? `id${listingNumber}` : "",
    ...translatedListingText,
    ...translatedTaxonomy
  ].filter(Boolean).join(" ");
}

function storefrontSearchMatches(haystack: string, query: string) {
  const needle = normalizeSellerFilterText(query);
  if (!needle) return true;

  const searchable = normalizeSellerFilterText(haystack);
  if (searchable.includes(needle)) return true;

  const searchableWords = searchable.split(" ").filter(Boolean);
  return needle.split(" ").filter(Boolean).every((word) =>
    searchableWords.some((candidate) =>
      candidate === word ||
      candidate.startsWith(word) ||
      (word.length >= 4 && candidate.includes(word))
    )
  );
}

function storefrontSearchScore(view: StorefrontItemView, query: string) {
  const needle = normalizeSellerFilterText(query);
  const title = normalizeSellerFilterText(view.title);
  const listingTitles = view.listing
    ? STOREFRONT_SEARCH_LOCALES.map((language) => normalizeSellerFilterText(view.listing?.translations?.[language]?.title))
    : [];
  const titles = [title, ...listingTitles].filter(Boolean);
  let score = 0;

  if (titles.some((candidate) => candidate === needle)) score += 120;
  else if (titles.some((candidate) => candidate.startsWith(needle))) score += 90;
  else if (titles.some((candidate) => candidate.includes(needle))) score += 70;
  if (normalizeSellerFilterText(`${view.brand} ${view.model}`).includes(needle)) score += 55;
  if (normalizeSellerFilterText(`${view.listing?.part_number ?? ""} ${view.listing?.part_model ?? ""}`).includes(needle)) score += 65;

  return score;
}

function storefrontItemHref(view: StorefrontItemView) {
  if (view.product) return `/tuotteet/${view.product.id}`;
  if (view.listing) return listingPath(listingUrlId(view.listing));
  return "#yrityksen-yhteystiedot";
}

function storefrontItemImageSrc(view: StorefrontItemView, index = 0) {
  return view.product?.image_urls?.find(Boolean) ||
    (view.listing ? listingImageSrc(view.listing, index) : "/maskines-brand-mark-clean-v4.png");
}

function storefrontItemDisplayTitle(view: StorefrontItemView, locale: Locale) {
  return view.listing ? getLocalizedListingText(view.listing, locale).title : view.title;
}

function sellerVehicleDescriptionNumber(description: string | null | undefined, label: string) {
  const value = sellerVehicleDescriptionValue(description, label);
  if (!value) return null;
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

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
  vehicleMileageMinFilter: string;
  vehicleMileageMaxFilter: string;
  vehicleHoursMinFilter: string;
  vehicleHoursMaxFilter: string;
  vehicleRegistrationFilter: string;
  vehicleEngineKindFilter: string;
  vehicleDriveTypeFilter: string;
  vehicleRoadLegalFilter: string;
  vehiclePriceMinFilter: string;
  vehiclePriceMaxFilter: string;
  vehicleAccessoriesFilter: string[];
  vehicleColorsFilter: string[];
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
  trackMatPitchFilter: "",
  vehicleMileageMinFilter: "",
  vehicleMileageMaxFilter: "",
  vehicleHoursMinFilter: "",
  vehicleHoursMaxFilter: "",
  vehicleRegistrationFilter: "",
  vehicleEngineKindFilter: "",
  vehicleDriveTypeFilter: "",
  vehicleRoadLegalFilter: "",
  vehiclePriceMinFilter: "",
  vehiclePriceMaxFilter: "",
  vehicleAccessoriesFilter: [],
  vehicleColorsFilter: []
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
  const listingMileage = sellerVehicleDescriptionNumber(listing.description, "Ajokilometrit");
  const listingHours = sellerVehicleDescriptionNumber(listing.description, "Käyttötunnit");
  const mileageMin = Number(filters.vehicleMileageMinFilter || "0");
  const mileageMax = Number(filters.vehicleMileageMaxFilter || "0");
  const hoursMin = Number(filters.vehicleHoursMinFilter || "0");
  const hoursMax = Number(filters.vehicleHoursMaxFilter || "0");
  if ((mileageMin || mileageMax) && (listingMileage === null || (mileageMin && listingMileage < mileageMin) || (mileageMax && listingMileage > mileageMax))) return false;
  if ((hoursMin || hoursMax) && (listingHours === null || (hoursMin && listingHours < hoursMin) || (hoursMax && listingHours > hoursMax))) return false;
  if (filters.vehicleRegistrationFilter && !normalizeSellerFilterText(sellerVehicleDescriptionValue(listing.description, "Rekisteritunnus")).replace(/\s+/g, "").includes(normalizeSellerFilterText(filters.vehicleRegistrationFilter).replace(/\s+/g, ""))) return false;
  if (filters.vehicleEngineKindFilter && normalizeSellerFilterText(sellerVehicleDescriptionValue(listing.description, "Moottorin tyyppi")) !== normalizeSellerFilterText(filters.vehicleEngineKindFilter)) return false;
  if (filters.vehicleDriveTypeFilter && normalizeSellerFilterText(sellerVehicleDescriptionValue(listing.description, "Vetotapa")) !== normalizeSellerFilterText(filters.vehicleDriveTypeFilter)) return false;
  if (filters.vehicleRoadLegalFilter && normalizeSellerFilterText(sellerVehicleDescriptionValue(listing.description, "Tieliikennekelpoisuus")) !== normalizeSellerFilterText(filters.vehicleRoadLegalFilter)) return false;
  const priceMin = Number(filters.vehiclePriceMinFilter || "0");
  const priceMax = Number(filters.vehiclePriceMaxFilter || "0");
  if ((priceMin && Number(listing.price) < priceMin) || (priceMax && Number(listing.price) > priceMax)) return false;
  const listingAccessories = readVehicleAccessories(listing.description).map(normalizeSellerFilterText);
  if (filters.vehicleAccessoriesFilter.length > 0 && !filters.vehicleAccessoriesFilter.every((accessory) => listingAccessories.includes(normalizeSellerFilterText(accessory)))) return false;
  const listingColors = readVehicleColors(listing.description).map(normalizeSellerFilterText);
  if (filters.vehicleColorsFilter.length > 0 && !filters.vehicleColorsFilter.some((color) => listingColors.includes(normalizeSellerFilterText(color)))) return false;
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
  const { formatFromEur } = useCurrency();
  const sft = useCallback((text: string) => {
    if (locale === "fi") return text;
    const translations = generatedUiTranslations as Partial<Record<Exclude<Locale, "fi">, Record<string, string>>>;
    return commerceUiTranslations[locale]?.[text] ?? translations[locale]?.[text] ?? text;
  }, [locale]);
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
  const [profileLoading, setProfileLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [commerceProducts, setCommerceProducts] = useState<PublicProduct[]>([]);
  const [commerceProductsLoading, setCommerceProductsLoading] = useState(true);
  const [storefront, setStorefront] = useState<PublicStorefront | null>(null);
  const [storefrontLoading, setStorefrontLoading] = useState(true);
  const [storefrontMode, setStorefrontMode] = useState<"all" | "parts" | "vehicles" | "gear">("all");
  const [storefrontCategory, setStorefrontCategory] = useState("");
  const [storefrontSubcategoryParent, setStorefrontSubcategoryParent] = useState("");
  const [storefrontSubcategory, setStorefrontSubcategory] = useState("");
  const [storefrontVehicleType, setStorefrontVehicleType] = useState("");
  const [storefrontVehicleSubtype, setStorefrontVehicleSubtype] = useState("");
  const [storefrontBrand, setStorefrontBrand] = useState("");
  const [storefrontModel, setStorefrontModel] = useState("");
  const [storefrontYearMin, setStorefrontYearMin] = useState("");
  const [storefrontYearMax, setStorefrontYearMax] = useState("");
  const [storefrontEngineCc, setStorefrontEngineCc] = useState("");
  const [storefrontEngineModel, setStorefrontEngineModel] = useState("");
  const [storefrontPriceMin, setStorefrontPriceMin] = useState("");
  const [storefrontPriceMax, setStorefrontPriceMax] = useState("");
  const [storefrontSearch, setStorefrontSearch] = useState("");
  const [storefrontSearchOpen, setStorefrontSearchOpen] = useState(false);
  const [storefrontDelivery, setStorefrontDelivery] = useState<"all" | "pickup" | "posti">("all");
  const [storefrontSort, setStorefrontSort] = useState<StorefrontSort>("newest");
  const [storefrontSortOpen, setStorefrontSortOpen] = useState(false);
  const [storefrontCollection, setStorefrontCollection] = useState<"popular" | "newest" | "sale">("popular");
  const [companyStoreView, setCompanyStoreView] = useState<"catalog" | "details" | "reviews" | "delivery">("catalog");
  const [storefrontFilterOpen, setStorefrontFilterOpen] = useState(false);
  const [storefrontDesktopFilterTab, setStorefrontDesktopFilterTab] = useState("basic");
  const [storefrontDesktopSearchSaved, setStorefrontDesktopSearchSaved] = useState(false);
  const [commerceMessage, setCommerceMessage] = useState("");
  const [savedCommerceProductIds, setSavedCommerceProductIds] = useState<string[]>([]);
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
  const [sellerListingMode, setSellerListingMode] = useState<SellerListingMode>("parts");
  const [appliedSellerListingMode, setAppliedSellerListingMode] = useState<SellerListingResultMode>("all");
  const [sortOpen, setSortOpen] = useState(false);
  const [sellerFilterPanelOpen, setSellerFilterPanelOpen] = useState(false);
  const [sellerDesktopFilterTab, setSellerDesktopFilterTab] = useState("basic");
  const [sellerDesktopSearchSaved, setSellerDesktopSearchSaved] = useState(false);
  const [showAllListings, setShowAllListings] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewComposerOpen, setReviewComposerOpen] = useState(false);
  const [reviewDraftRating, setReviewDraftRating] = useState(5);
  const [reviewDraftComment, setReviewDraftComment] = useState("");
  const [reviewSubmitPending, setReviewSubmitPending] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState("");
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
  const [vehicleMileageMinFilter, setVehicleMileageMinFilter] = useState("");
  const [vehicleMileageMaxFilter, setVehicleMileageMaxFilter] = useState("");
  const [vehicleHoursMinFilter, setVehicleHoursMinFilter] = useState("");
  const [vehicleHoursMaxFilter, setVehicleHoursMaxFilter] = useState("");
  const [vehicleRegistrationFilter, setVehicleRegistrationFilter] = useState("");
  const [vehicleEngineKindFilter, setVehicleEngineKindFilter] = useState("");
  const [vehicleDriveTypeFilter, setVehicleDriveTypeFilter] = useState("");
  const [vehicleRoadLegalFilter, setVehicleRoadLegalFilter] = useState("");
  const [vehiclePriceMinFilter, setVehiclePriceMinFilter] = useState("");
  const [vehiclePriceMaxFilter, setVehiclePriceMaxFilter] = useState("");
  const [vehicleAccessoriesFilter, setVehicleAccessoriesFilter] = useState<string[]>([]);
  const [vehicleColorsFilter, setVehicleColorsFilter] = useState<string[]>([]);
  const [vehicleAccessoriesOpen, setVehicleAccessoriesOpen] = useState(false);
  const [vehicleColorsOpen, setVehicleColorsOpen] = useState(false);
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
    if (!reviewsOpen && !reviewComposerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setReviewsOpen(false);
        setReviewComposerOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [reviewComposerOpen, reviewsOpen]);

  useEffect(() => {
    if (!storefrontFilterOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setStorefrontFilterOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [storefrontFilterOpen]);

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
      const verifiedCompanyProfile = profile?.account_type === "company" && Boolean(profile.company_verified_at);
      if (verifiedCompanyProfile && (commerceProducts.length > 0 || listings.length > 0)) {
        setStorefrontDesktopFilterTab("basic");
        setStorefrontFilterOpen(true);
        return;
      }

      if (listings.length === 0) return;

      setSearchQuery(appliedSellerFilters.searchQuery);
      setSellerListingMode(defaultSellerListingMode());
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
      setVehicleMileageMinFilter(appliedSellerFilters.vehicleMileageMinFilter);
      setVehicleMileageMaxFilter(appliedSellerFilters.vehicleMileageMaxFilter);
      setVehicleHoursMinFilter(appliedSellerFilters.vehicleHoursMinFilter);
      setVehicleHoursMaxFilter(appliedSellerFilters.vehicleHoursMaxFilter);
      setVehicleRegistrationFilter(appliedSellerFilters.vehicleRegistrationFilter);
      setVehicleEngineKindFilter(appliedSellerFilters.vehicleEngineKindFilter);
      setVehicleDriveTypeFilter(appliedSellerFilters.vehicleDriveTypeFilter);
      setVehicleRoadLegalFilter(appliedSellerFilters.vehicleRoadLegalFilter);
      setVehiclePriceMinFilter(appliedSellerFilters.vehiclePriceMinFilter);
      setVehiclePriceMaxFilter(appliedSellerFilters.vehiclePriceMaxFilter);
      setVehicleAccessoriesFilter(appliedSellerFilters.vehicleAccessoriesFilter);
      setVehicleColorsFilter(appliedSellerFilters.vehicleColorsFilter);
      setSellerFilterSheetExpanded(false);
      setSortOpen(false);
      setSellerFilterPanelOpen(true);
    };

    window.addEventListener("seller-profile-open-filters", openSellerProfileFilters);
    return () => window.removeEventListener("seller-profile-open-filters", openSellerProfileFilters);
  }, [appliedSellerFilters, appliedSellerListingMode, commerceProducts.length, listings, profile?.account_type, profile?.company_verified_at]);

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
    const copy = listings
      .filter((listing) =>
        appliedSellerListingMode === "all"
          ? true
          : sellerListingModeForListing(listing) === appliedSellerListingMode
      )
      .filter((listing) =>
        sellerListingMatchesFilters(listing, appliedSellerFilters, locale, selectedSubcategoryParentChildren)
      );

    return copy.sort((a, b) => {
      if (appliedSellerFilters.listingSort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (appliedSellerFilters.listingSort === "priceAsc") return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (appliedSellerFilters.listingSort === "priceDesc") return Number(b.price ?? 0) - Number(a.price ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [appliedSellerFilters, appliedSellerListingMode, listings, locale, selectedSubcategoryParentChildren]);

  const sellerFilterOptions = useMemo(() => {
    const unique = (values: Array<string | null | undefined>, numeric = false) =>
      Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)))
        .sort((left, right) => numeric
          ? Number(right) - Number(left)
          : left.localeCompare(right, "fi", { sensitivity: "base" }));
    const modeListings = listings.filter((listing) => sellerListingModeForListing(listing) === sellerListingMode);
    const typeScoped = modeListings.filter((listing) =>
      !vehicleTypeFilter || normalizeVehicleType(listing.vehicle_type ?? "") === normalizeVehicleType(vehicleTypeFilter)
    );
    const subtypeScoped = typeScoped.filter((listing) =>
      !vehicleSubtypeFilter || sellerTextMatches(listing.vehicle_subtype ?? "", vehicleSubtypeFilter)
    );
    const brandScoped = subtypeScoped.filter((listing) =>
      !brandFilter || normalizeSellerFilterText(listing.brand) === normalizeSellerFilterText(brandFilter)
    );
    const categoryScoped = modeListings.filter((listing) =>
      !categoryFilter || normalizeCategoryFilter(listing.category) === normalizeCategoryFilter(categoryFilter)
    );
    const parentScoped = categoryScoped.filter((listing) =>
      !subcategoryParentFilter || sellerSubcategoryMatches(listing.subcategory, subcategoryParentFilter)
    );

    return {
      vehicleTypes: unique(modeListings.map((listing) => listing.vehicle_type)),
      vehicleSubtypes: unique(typeScoped.map((listing) => listing.vehicle_subtype)),
      brands: unique(subtypeScoped.map((listing) => listing.brand)),
      models: unique(brandScoped.map((listing) => listing.model)),
      years: unique(brandScoped.map((listing) => listing.year), true),
      engineCcs: unique(brandScoped.map((listing) => listing.engine_cc), true),
      engineModels: unique(brandScoped.map((listing) => listing.engine_model)),
      engineKinds: unique(modeListings.map((listing) => sellerVehicleDescriptionValue(listing.description, "Moottorin tyyppi"))),
      driveTypes: unique(modeListings.map((listing) => sellerVehicleDescriptionValue(listing.description, "Vetotapa"))),
      roadLegalValues: unique(modeListings.map((listing) => sellerVehicleDescriptionValue(listing.description, "Tieliikennekelpoisuus"))),
      accessories: unique(modeListings.flatMap((listing) => readVehicleAccessories(listing.description))),
      colors: unique(modeListings.flatMap((listing) => readVehicleColors(listing.description))),
      categories: unique(modeListings.map((listing) => listing.category)),
      subcategoryParents: unique(categoryScoped.map((listing) =>
        listing.subcategory?.split("/").map((part) => part.trim()).filter(Boolean)[0]
      )),
      subcategories: unique(parentScoped.map((listing) => listing.subcategory))
    };
  }, [brandFilter, categoryFilter, listings, sellerListingMode, subcategoryParentFilter, vehicleSubtypeFilter, vehicleTypeFilter]);
  const sellerAvailableListingModes = useMemo(
    () => (["parts", "vehicles", "gear"] as const).filter((mode) =>
      listings.some((listing) => sellerListingModeForListing(listing) === mode)
    ),
    [listings]
  );
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
    trackMatPitchFilter,
    vehicleMileageMinFilter,
    vehicleMileageMaxFilter,
    vehicleHoursMinFilter,
    vehicleHoursMaxFilter,
    vehicleRegistrationFilter,
    vehicleEngineKindFilter,
    vehicleDriveTypeFilter,
    vehicleRoadLegalFilter,
    vehiclePriceMinFilter,
    vehiclePriceMaxFilter,
    vehicleAccessoriesFilter,
    vehicleColorsFilter
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
    vehicleDriveTypeFilter,
    vehicleEngineKindFilter,
    vehicleHoursMaxFilter,
    vehicleHoursMinFilter,
    vehicleMileageMaxFilter,
    vehicleMileageMinFilter,
    vehicleRegistrationFilter,
    vehicleRoadLegalFilter,
    vehiclePriceMaxFilter,
    vehiclePriceMinFilter,
    vehicleAccessoriesFilter,
    vehicleColorsFilter,
    vehicleSubtypeFilter,
    vehicleTypeFilter,
    yearFilter,
    yearMaxFilter,
    yearMinFilter
  ]);
  const draftFilteredListingCount = useMemo(
    () => listings
      .filter((listing) => sellerListingModeForListing(listing) === sellerListingMode)
      .filter((listing) => sellerListingMatchesFilters(
        listing,
        draftSellerFilters,
        locale,
        sellerFilterOptions.subcategories
      )).length,
    [draftSellerFilters, listings, locale, sellerFilterOptions.subcategories, sellerListingMode]
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
  const sellerRangeThumbLeft = (percent: number) =>
    `calc(${percent}% + ${4 - (8 * percent) / 100}px)`;

  const renderSellerNumericRangeSlider = ({
    label,
    minValue,
    maxValue,
    maximum,
    step,
    onMinChange,
    onMaxChange
  }: {
    label: string;
    minValue: string;
    maxValue: string;
    maximum: number;
    step: number;
    onMinChange: (value: string) => void;
    onMaxChange: (value: string) => void;
  }) => {
    const selectedMinValue = Math.min(Number(minValue || 0), maximum);
    const selectedMaxValue = Math.max(selectedMinValue, Math.min(Number(maxValue || maximum), maximum));
    const selectedMinPercent = (selectedMinValue / maximum) * 100;
    const selectedMaxPercent = (selectedMaxValue / maximum) * 100;

    return (
      <div
        className={homeStyles.vehicleNumericSlider}
        data-range-active={minValue || maxValue ? "true" : "false"}
        role="group"
        aria-label={label}
        style={{
          "--filter-range-min": `${selectedMinPercent}%`,
          "--filter-range-max": `${selectedMaxPercent}%`
        } as CSSProperties}
      >
        <span className={homeStyles.vehicleNumericSliderLine} aria-hidden="true" />
        <span className={homeStyles.rangeVisualThumb} style={{ left: sellerRangeThumbLeft(selectedMinPercent) }} aria-hidden="true" />
        <span className={homeStyles.rangeVisualThumb} style={{ left: sellerRangeThumbLeft(selectedMaxPercent) }} aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={maximum}
          step={step}
          value={selectedMinValue}
          aria-label={`${label}, minimi`}
          onInput={(event) => {
            const next = Math.min(Number(event.currentTarget.value), selectedMaxValue);
            onMinChange(next === 0 ? "" : String(next));
          }}
        />
        <input
          type="range"
          min={0}
          max={maximum}
          step={step}
          value={selectedMaxValue}
          aria-label={`${label}, maksimi`}
          onInput={(event) => {
            const next = Math.max(Number(event.currentTarget.value), selectedMinValue);
            onMaxChange(next === maximum ? "" : String(next));
          }}
        />
      </div>
    );
  };

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
    appliedSellerListingMode !== "all" ||
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
    appliedSellerFilters.trackMatPitchFilter.trim() !== "" ||
    appliedSellerFilters.vehicleMileageMinFilter.trim() !== "" ||
    appliedSellerFilters.vehicleMileageMaxFilter.trim() !== "" ||
    appliedSellerFilters.vehicleHoursMinFilter.trim() !== "" ||
    appliedSellerFilters.vehicleHoursMaxFilter.trim() !== "" ||
    appliedSellerFilters.vehicleRegistrationFilter.trim() !== "" ||
    appliedSellerFilters.vehicleEngineKindFilter.trim() !== "" ||
    appliedSellerFilters.vehicleDriveTypeFilter.trim() !== "" ||
    appliedSellerFilters.vehicleRoadLegalFilter.trim() !== "" ||
    appliedSellerFilters.vehiclePriceMinFilter.trim() !== "" ||
    appliedSellerFilters.vehiclePriceMaxFilter.trim() !== "" ||
    appliedSellerFilters.vehicleAccessoriesFilter.length > 0 ||
    appliedSellerFilters.vehicleColorsFilter.length > 0;

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
    setVehicleMileageMinFilter("");
    setVehicleMileageMaxFilter("");
    setVehicleHoursMinFilter("");
    setVehicleHoursMaxFilter("");
    setVehicleRegistrationFilter("");
    setVehicleEngineKindFilter("");
    setVehicleDriveTypeFilter("");
    setVehicleRoadLegalFilter("");
    setVehiclePriceMinFilter("");
    setVehiclePriceMaxFilter("");
    setVehicleAccessoriesFilter([]);
    setVehicleColorsFilter([]);
    setVehicleAccessoriesOpen(false);
    setVehicleColorsOpen(false);
    setAppliedSellerFilters({ ...EMPTY_SELLER_APPLIED_FILTERS });
    setAppliedSellerListingMode("all");
    setSellerListingPage(1);
    setShowAllListings(false);
  }

  function selectSellerListingMode(nextMode: SellerListingMode) {
    if (nextMode === sellerListingMode) return;

    setSellerListingMode(nextMode);
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
    setVehicleMileageMinFilter("");
    setVehicleMileageMaxFilter("");
    setVehicleHoursMinFilter("");
    setVehicleHoursMaxFilter("");
    setVehicleRegistrationFilter("");
    setVehicleEngineKindFilter("");
    setVehicleDriveTypeFilter("");
    setVehicleRoadLegalFilter("");
    setVehiclePriceMinFilter("");
    setVehiclePriceMaxFilter("");
    setVehicleAccessoriesFilter([]);
    setVehicleColorsFilter([]);
    setSellerDesktopFilterTab("basic");
    setSellerDesktopSearchSaved(false);
  }

  function defaultSellerListingMode(): SellerListingMode {
    if (appliedSellerListingMode !== "all") return appliedSellerListingMode;
    if (sellerAvailableListingModes.includes("parts")) return "parts";
    if (sellerAvailableListingModes.includes("vehicles")) return "vehicles";
    if (sellerAvailableListingModes.includes("gear")) return "gear";
    return "parts";
  }

  function toggleSellerFilters() {
    if (sellerFilterPanelOpen) {
      setSellerFilterPanelOpen(false);
      return;
    }

    setSearchQuery(appliedSellerFilters.searchQuery);
    setSellerListingMode(defaultSellerListingMode());
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
    setVehicleMileageMinFilter(appliedSellerFilters.vehicleMileageMinFilter);
    setVehicleMileageMaxFilter(appliedSellerFilters.vehicleMileageMaxFilter);
    setVehicleHoursMinFilter(appliedSellerFilters.vehicleHoursMinFilter);
    setVehicleHoursMaxFilter(appliedSellerFilters.vehicleHoursMaxFilter);
    setVehicleRegistrationFilter(appliedSellerFilters.vehicleRegistrationFilter);
    setVehicleEngineKindFilter(appliedSellerFilters.vehicleEngineKindFilter);
    setVehicleDriveTypeFilter(appliedSellerFilters.vehicleDriveTypeFilter);
    setVehicleRoadLegalFilter(appliedSellerFilters.vehicleRoadLegalFilter);
    setVehiclePriceMinFilter(appliedSellerFilters.vehiclePriceMinFilter);
    setVehiclePriceMaxFilter(appliedSellerFilters.vehiclePriceMaxFilter);
    setVehicleAccessoriesFilter(appliedSellerFilters.vehicleAccessoriesFilter);
    setVehicleColorsFilter(appliedSellerFilters.vehicleColorsFilter);
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
      engineModelFilter: sellerListingMode === "parts" ? engineModelFilter : "",
      categoryFilter,
      subcategoryParentFilter,
      subcategoryFilter,
      trackMatLengthFilter,
      trackMatWidthFilter,
      trackMatPitchFilter,
      vehicleMileageMinFilter,
      vehicleMileageMaxFilter,
      vehicleHoursMinFilter,
      vehicleHoursMaxFilter,
      vehicleRegistrationFilter,
      vehicleEngineKindFilter,
      vehicleDriveTypeFilter,
      vehicleRoadLegalFilter,
      vehiclePriceMinFilter,
      vehiclePriceMaxFilter,
      vehicleAccessoriesFilter,
      vehicleColorsFilter
    });
    setAppliedSellerListingMode(sellerListingMode);
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
    setProfileLoading(true);
    setProfile(null);
    setListings([]);
    setReviews([]);
    setListingsLoaded(false);
    setReviewsLoaded(false);
    setListingsLoading(false);
    setReviewsLoading(false);
    setSellerListingPage(1);
    setCompanyStoreView("catalog");
    setStorefrontSearch("");
    setStorefrontSearchOpen(false);

    setLevelStats(emptySellerLevelStats);

    let cancelled = false;

    getPublicProfile(sellerId).then(({ data }) => {
      if (cancelled) return;
      setProfile(data ?? null);
      if (data) writeSellerProfileCachePatch(sellerId, { profile: data });
    }).catch(() => {
      if (!cancelled) setProfile(null);
    }).finally(() => {
      if (!cancelled) setProfileLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  useEffect(() => {
    let cancelled = false;
    setCommerceProducts([]);
    setCommerceProductsLoading(true);
    fetch(`/api/commerce/catalog?seller_id=${encodeURIComponent(resolvedSellerId)}&limit=100`, {
      cache: "no-store"
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Tuotteiden lataaminen epäonnistui.");
        if (!cancelled) setCommerceProducts(body.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setCommerceProducts([]);
      })
      .finally(() => {
        if (!cancelled) setCommerceProductsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedSellerId]);

  useEffect(() => {
    let cancelled = false;
    setStorefront(null);
    setStorefrontLoading(true);
    fetch(`/api/commerce/storefront?seller_id=${encodeURIComponent(resolvedSellerId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => { if (!cancelled) setStorefront(body.storefront ?? null); })
      .catch(() => { if (!cancelled) setStorefront(null); })
      .finally(() => { if (!cancelled) setStorefrontLoading(false); });
    return () => { cancelled = true; };
  }, [resolvedSellerId]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("savedCommerceProducts") || "[]");
      setSavedCommerceProductIds(Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : []);
    } catch {
      setSavedCommerceProductIds([]);
    }
  }, []);

  const commerceProductViews = useMemo<StorefrontItemView[]>(() => commerceProducts.map((product) => {
    const directlyLinkedListing = listings.find((listing) => listing.translations?._meta?.commerce_product_id === product.id) ?? null;
    const productImages = new Set(product.image_urls.filter(Boolean));
    const matchingListings = listings.filter((listing) => (
      normalizeSellerFilterText(listing.title) === normalizeSellerFilterText(product.name) &&
      (
        Math.round(Number(listing.price) * 100) === product.price_cents ||
        [listing.image_url, ...(listing.image_urls ?? [])]
          .filter(Boolean)
          .some((image) => productImages.has(image))
      )
    ));
    const productCreatedAt = new Date(product.created_at).getTime();
    const listing = directlyLinkedListing ?? matchingListings.sort((left, right) => (
      Math.abs(new Date(left.created_at).getTime() - productCreatedAt) -
      Math.abs(new Date(right.created_at).getTime() - productCreatedAt)
    ))[0] ?? null;
    const mode = storefrontItemMode(listing, product.storefront_category, listing?.category, listing?.subcategory, product.name);
    const rawCategory = product.storefront_category?.trim() || listing?.category?.trim();
    const category = mode === "gear" && (!rawCategory || normalizeSellerFilterText(rawCategory) === "muut tuotteet")
      ? "Ajovarusteet"
      : rawCategory || "Muut tuotteet";

    return {
      kind: "product",
      key: `product:${product.id}`,
      product,
      listing,
      mode,
      category,
      subcategory: listing?.subcategory?.trim() || "",
      vehicleType: listing?.vehicle_type?.trim() || "",
      vehicleSubtype: listing?.vehicle_subtype?.trim() || "",
      brand: listing?.brand?.trim() || "",
      model: listing?.model?.trim() || "",
      year: listing?.year?.trim() || "",
      engineCc: listing?.engine_cc?.trim() || "",
      engineModel: listing?.engine_model?.trim() || "",
      title: product.name,
      description: product.description,
      priceCents: activeSalePrice(product),
      createdAt: product.published_at ?? product.created_at,
      pickupAvailable: product.pickup_available,
      shippingAvailable: product.shipping_available && product.posti_enabled
    };
  }), [commerceProducts, listings]);
  const storefrontListingViews = useMemo<StorefrontItemView[]>(() => {
    const commerceListingIds = new Set(commerceProductViews.flatMap((view) => view.listing ? [view.listing.id] : []));

    return listings
      .filter((listing) => (
        !commerceListingIds.has(listing.id) &&
        !listing.translations?._meta?.commerce_product_id &&
        !listing.is_sold &&
        !listing.is_hidden
      ))
      .map((listing) => {
        const deliveryText = normalizeSellerFilterText(`${listing.description} ${listing.condition}`);
        return {
          kind: "listing",
          key: `listing:${listing.id}`,
          product: null,
          listing,
          mode: storefrontItemMode(listing, listing.category, listing.subcategory, listing.vehicle_type, listing.title),
          category: listing.category?.trim() || "Muut tuotteet",
          subcategory: listing.subcategory?.trim() || "",
          vehicleType: listing.vehicle_type?.trim() || "",
          vehicleSubtype: listing.vehicle_subtype?.trim() || "",
          brand: listing.brand?.trim() || "",
          model: listing.model?.trim() || "",
          year: listing.year?.trim() || "",
          engineCc: listing.engine_cc?.trim() || "",
          engineModel: listing.engine_model?.trim() || "",
          title: listing.title,
          description: listing.description,
          priceCents: Math.round(Number(listing.price || 0) * 100),
          createdAt: listing.created_at,
          pickupAvailable: deliveryText.includes("nouto"),
          shippingAvailable: ["toimitus", "lahetys", "posti"].some((term) => deliveryText.includes(term))
        };
      });
  }, [commerceProductViews, listings]);
  const storefrontItemViews = useMemo(
    () => [...commerceProductViews, ...storefrontListingViews],
    [commerceProductViews, storefrontListingViews]
  );
  const storefrontModes = useMemo(() => Array.from(new Set(
    storefrontItemViews.map((view) => view.mode)
  )), [storefrontItemViews]);

  useEffect(() => {
    if (!storefrontFilterOpen || storefrontMode !== "all" || !storefrontModes[0]) return;
    selectStorefrontFilterMode(storefrontModes.includes("parts") ? "parts" : storefrontModes[0]);
  }, [storefrontFilterOpen, storefrontMode, storefrontModes]);
  const storefrontCategories = useMemo(() => Array.from(new Set(
    storefrontItemViews
      .filter((view) => storefrontMode === "all" || view.mode === storefrontMode)
      .map((view) => view.category)
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, "fi")), [storefrontItemViews, storefrontMode]);
  const storefrontSubcategoryParents = useMemo(() => Array.from(new Set(
    storefrontItemViews
      .filter((view) => (storefrontMode === "all" || view.mode === storefrontMode) && (!storefrontCategory || view.category === storefrontCategory))
      .map((view) => view.subcategory.split("/").map((part) => part.trim()).filter(Boolean)[0] ?? "")
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, "fi")), [storefrontCategory, storefrontItemViews, storefrontMode]);
  const storefrontSubcategories = useMemo(() => Array.from(new Set(
    storefrontItemViews
      .filter((view) => (
        (storefrontMode === "all" || view.mode === storefrontMode) &&
        (!storefrontCategory || view.category === storefrontCategory) &&
        (!storefrontSubcategoryParent || sellerSubcategoryMatches(view.subcategory, storefrontSubcategoryParent))
      ))
      .map((view) => view.subcategory)
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, "fi")), [storefrontCategory, storefrontItemViews, storefrontMode, storefrontSubcategoryParent]);
  const storefrontVehicleTypes = useMemo(() => Array.from(new Set(
    storefrontItemViews
      .filter((view) => (
        (storefrontMode === "all" || view.mode === storefrontMode) &&
        (!storefrontCategory || view.category === storefrontCategory) &&
        (!storefrontSubcategoryParent || sellerSubcategoryMatches(view.subcategory, storefrontSubcategoryParent)) &&
        (!storefrontSubcategory || view.subcategory === storefrontSubcategory)
      ))
      .map((view) => view.vehicleType)
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, "fi")), [storefrontCategory, storefrontItemViews, storefrontMode, storefrontSubcategory, storefrontSubcategoryParent]);
  const storefrontVehicleSubtypes = useMemo(() => Array.from(new Set(
    storefrontItemViews
      .filter((view) => (
        (storefrontMode === "all" || view.mode === storefrontMode) &&
        (!storefrontCategory || view.category === storefrontCategory) &&
        (!storefrontSubcategoryParent || sellerSubcategoryMatches(view.subcategory, storefrontSubcategoryParent)) &&
        (!storefrontSubcategory || view.subcategory === storefrontSubcategory) &&
        (!storefrontVehicleType || view.vehicleType === storefrontVehicleType)
      ))
      .map((view) => view.vehicleSubtype)
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, "fi")), [storefrontCategory, storefrontItemViews, storefrontMode, storefrontSubcategory, storefrontSubcategoryParent, storefrontVehicleType]);
  const storefrontBrands = useMemo(() => Array.from(new Set(
    storefrontItemViews
      .filter((view) => (
        (storefrontMode === "all" || view.mode === storefrontMode) &&
        (!storefrontCategory || view.category === storefrontCategory) &&
        (!storefrontSubcategoryParent || sellerSubcategoryMatches(view.subcategory, storefrontSubcategoryParent)) &&
        (!storefrontSubcategory || view.subcategory === storefrontSubcategory) &&
        (!storefrontVehicleType || view.vehicleType === storefrontVehicleType) &&
        (!storefrontVehicleSubtype || view.vehicleSubtype === storefrontVehicleSubtype)
      ))
      .map((view) => view.brand)
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, "fi")), [storefrontCategory, storefrontItemViews, storefrontMode, storefrontSubcategory, storefrontSubcategoryParent, storefrontVehicleSubtype, storefrontVehicleType]);
  const storefrontModels = useMemo(() => Array.from(new Set(
    storefrontItemViews
      .filter((view) => (
        (storefrontMode === "all" || view.mode === storefrontMode) &&
        (!storefrontCategory || view.category === storefrontCategory) &&
        (!storefrontSubcategoryParent || sellerSubcategoryMatches(view.subcategory, storefrontSubcategoryParent)) &&
        (!storefrontSubcategory || view.subcategory === storefrontSubcategory) &&
        (!storefrontVehicleType || view.vehicleType === storefrontVehicleType) &&
        (!storefrontVehicleSubtype || view.vehicleSubtype === storefrontVehicleSubtype) &&
        (!storefrontBrand || view.brand === storefrontBrand)
      ))
      .map((view) => view.model)
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, "fi")), [storefrontBrand, storefrontCategory, storefrontItemViews, storefrontMode, storefrontSubcategory, storefrontSubcategoryParent, storefrontVehicleSubtype, storefrontVehicleType]);
  const storefrontTechnicalOptions = useMemo(() => {
    const scoped = storefrontItemViews.filter((view) => (
      (storefrontMode === "all" || view.mode === storefrontMode) &&
      (!storefrontCategory || view.category === storefrontCategory) &&
      (!storefrontSubcategoryParent || sellerSubcategoryMatches(view.subcategory, storefrontSubcategoryParent)) &&
      (!storefrontSubcategory || view.subcategory === storefrontSubcategory) &&
      (!storefrontVehicleType || view.vehicleType === storefrontVehicleType) &&
      (!storefrontVehicleSubtype || view.vehicleSubtype === storefrontVehicleSubtype) &&
      (!storefrontBrand || view.brand === storefrontBrand) &&
      (!storefrontModel || view.model === storefrontModel)
    ));
    const unique = (values: string[], numeric = false) => Array.from(new Set(values.filter(Boolean))).sort((left, right) => numeric
      ? Number(right) - Number(left)
      : left.localeCompare(right, "fi"));
    return {
      years: unique(scoped.map((view) => view.year), true),
      engineCcs: unique(scoped.map((view) => view.engineCc), true),
      engineModels: unique(scoped.map((view) => view.engineModel))
    };
  }, [storefrontBrand, storefrontCategory, storefrontItemViews, storefrontMode, storefrontModel, storefrontSubcategory, storefrontSubcategoryParent, storefrontVehicleSubtype, storefrontVehicleType]);
  const storefrontDeliveryOptions = useMemo(() => ({
    pickup: storefrontItemViews.filter((view) => view.pickupAvailable).length,
    posti: storefrontItemViews.filter((view) => view.shippingAvailable).length
  }), [storefrontItemViews]);
  const storefrontSearchResults = useMemo(() => {
    const query = storefrontSearch.trim();
    if (normalizeSellerFilterText(query).length < 2) {
      return { items: [] as StorefrontItemView[], totalCount: 0 };
    }

    const results = storefrontItemViews
      .filter((view) => storefrontSearchMatches(storefrontItemSearchText(view), query))
      .map((view) => ({ view, score: storefrontSearchScore(view, query) }))
      .sort((left, right) =>
        right.score - left.score ||
        new Date(right.view.createdAt).getTime() - new Date(left.view.createdAt).getTime()
      )
      .map(({ view }) => view);

    return { items: results.slice(0, 8), totalCount: results.length };
  }, [storefrontItemViews, storefrontSearch]);
  const visibleStorefrontItems = useMemo(() => {
    const search = normalizeSellerFilterText(storefrontSearch);
    const filtered = storefrontItemViews.filter((view) => {
      if (storefrontMode !== "all" && view.mode !== storefrontMode) return false;
      if (storefrontCategory && view.category !== storefrontCategory) return false;
      if (storefrontSubcategoryParent && !sellerSubcategoryMatches(view.subcategory, storefrontSubcategoryParent)) return false;
      if (storefrontSubcategory && view.subcategory !== storefrontSubcategory) return false;
      if (storefrontVehicleType && view.vehicleType !== storefrontVehicleType) return false;
      if (storefrontVehicleSubtype && view.vehicleSubtype !== storefrontVehicleSubtype) return false;
      if (storefrontBrand && view.brand !== storefrontBrand) return false;
      if (storefrontModel && view.model !== storefrontModel) return false;
      const itemYear = Number.parseInt(view.year, 10);
      if (storefrontYearMin && (!Number.isFinite(itemYear) || itemYear < Number.parseInt(storefrontYearMin, 10))) return false;
      if (storefrontYearMax && (!Number.isFinite(itemYear) || itemYear > Number.parseInt(storefrontYearMax, 10))) return false;
      if (storefrontEngineCc && view.engineCc !== storefrontEngineCc) return false;
      if (storefrontEngineModel && view.engineModel !== storefrontEngineModel) return false;
      if (storefrontPriceMin && view.priceCents < Number(storefrontPriceMin) * 100) return false;
      if (storefrontPriceMax && view.priceCents > Number(storefrontPriceMax) * 100) return false;
      if (storefrontDelivery === "pickup" && !view.pickupAvailable) return false;
      if (storefrontDelivery === "posti" && !view.shippingAvailable) return false;
      if (storefrontCollection === "sale" && (!view.product || activeSalePrice(view.product) >= view.product.price_cents)) return false;
      if (!search) return true;
      return storefrontSearchMatches(storefrontItemSearchText(view), search);
    });
    return filtered.sort((left, right) => storefrontSort === "priceAsc"
      ? left.priceCents - right.priceCents
      : storefrontSort === "priceDesc"
        ? right.priceCents - left.priceCents
        : storefrontSort === "oldest"
          ? new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          : storefrontSort === "relevance"
            ? 0
            : new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [storefrontBrand, storefrontCategory, storefrontCollection, storefrontDelivery, storefrontEngineCc, storefrontEngineModel, storefrontItemViews, storefrontMode, storefrontModel, storefrontPriceMax, storefrontPriceMin, storefrontSearch, storefrontSort, storefrontSubcategory, storefrontSubcategoryParent, storefrontVehicleSubtype, storefrontVehicleType, storefrontYearMax, storefrontYearMin]);
  const storefrontItemCount = storefrontItemViews.length;
  const immediatePurchaseCount = commerceProductViews.length;
  const inquiryListingCount = storefrontListingViews.length;
  const storefrontActiveFilterCount = [
    storefrontMode !== "all",
    Boolean(storefrontCategory),
    Boolean(storefrontSubcategoryParent),
    Boolean(storefrontSubcategory),
    Boolean(storefrontVehicleType),
    Boolean(storefrontVehicleSubtype),
    Boolean(storefrontBrand),
    Boolean(storefrontModel),
    Boolean(storefrontYearMin || storefrontYearMax),
    Boolean(storefrontEngineCc),
    Boolean(storefrontEngineModel),
    Boolean(storefrontPriceMin),
    Boolean(storefrontPriceMax),
    storefrontDelivery !== "all"
  ].filter(Boolean).length;

  useEffect(() => {
    let cancelled = false;

    const refreshLevelStats = () => {
      void getPublicSellerLevelStats(resolvedSellerId).then(({ data }) => {
        if (!cancelled && data) {
          setLevelStats(data);
          writeSellerProfileCachePatch(sellerId, { levelStats: data });
        }
      });
    };

    const refreshVisibleProfile = () => {
      if (document.visibilityState === "visible") refreshLevelStats();
    };

    refreshLevelStats();
    window.addEventListener("focus", refreshLevelStats);
    document.addEventListener("visibilitychange", refreshVisibleProfile);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshLevelStats);
      document.removeEventListener("visibilitychange", refreshVisibleProfile);
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

  function openPublicReviewForm() {
    setReviewsOpen(false);
    setReviewFeedback("");

    if (!currentUserId) {
      router.push(`${pagePath("auth", locale)}?mode=login&returnTo=${encodeURIComponent(profilePath(sellerId, sellerName, locale))}`);
      return;
    }

    if (currentUserId === resolvedSellerId) {
      setReviewFeedback("Et voi arvostella omaa profiiliasi.");
      return;
    }

    setReviewDraftRating(5);
    setReviewDraftComment("");
    setReviewComposerOpen(true);
  }

  async function submitPublicReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !currentUserId || currentUserId === resolvedSellerId || reviewSubmitPending) return;

    const comment = reviewDraftComment.trim();
    if (comment.length < 2) {
      setReviewFeedback("Kirjoita vähintään kaksi merkkiä pitkä arvostelu.");
      return;
    }

    setReviewSubmitPending(true);
    setReviewFeedback("");
    const { data: reviewerProfile } = await getProfile(currentUserId);
    const reviewerName = getMaskinesProfileDisplayName(reviewerProfile);
    const result = await createSellerReview({
      seller_id: resolvedSellerId,
      reviewer_id: currentUserId,
      reviewer_name: reviewerName,
      rating: reviewDraftRating,
      comment
    });
    setReviewSubmitPending(false);

    if (result.error || !result.data) {
      setReviewFeedback(result.error instanceof Error ? result.error.message : "Arvostelun tallennus epäonnistui.");
      return;
    }

    setReviews((current) => [result.data, ...current]);
    setReviewsLoaded(true);
    setReviewComposerOpen(false);
    setReviewDraftComment("");
    setReviewFeedback("Kiitos! Arvostelusi julkaistiin.");
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

  const rawSellerName =
    profile?.account_type === "company"
      ? profile.company_name || profile.full_name || listings[0]?.seller_name || t.authCompanyLabel
      :
    profile?.full_name ||
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
    listings[0]?.seller_name ||
    t.sellerProfile;
  const sellerName = profile?.account_type === "company" ? publicCompanyDisplayName(rawSellerName) : rawSellerName;
  const sellerAvatarUrl = profile?.avatar_url?.trim() || "";
  const showSellerAvatar = Boolean(sellerAvatarUrl && !avatarFailed);
  const sellerInitial = getSellerInitials(sellerName, locale);
  const isCompany =
    profile?.account_type === "company";
  const isVerifiedCompany = isCompany && Boolean(profile?.company_verified_at);
  const locationFallback = {
    fi: "Sijaintia ei ole asetettu",
    en: "Location not set",
    sv: "Plats har inte angetts",
    no: "Sted er ikke angitt",
  }[locale];
  const publicAddress =
    profile?.public_address?.trim();
  const sellerLocation =
    isCompany
      ? publicAddress || ""
      : [profile?.city, profile?.country].filter(Boolean).join(", ") || listings[0]?.location || locationFallback;
  const companyWebsite =
    isCompany ? formatWebsiteUrl(storefront?.website || profile?.company_website) : null;
  const companyPublicPhone = storefront?.phone?.trim() || profile?.phone?.trim() || commerceProducts[0]?.company.phone?.trim() || "";
  const companyPublicEmail = storefront?.email?.trim() || commerceProducts[0]?.company.email?.trim() || "";
  const companyPublicAddress = [storefront?.address_line, storefront?.postal_code, storefront?.city, storefront?.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ") || publicAddress || "";
  const companyVerifiedDate = storefront?.verified_at
    ? new Intl.DateTimeFormat("fi-FI", { day: "numeric", month: "long", year: "numeric" }).format(new Date(storefront.verified_at))
    : profile?.company_verified_at
      ? new Intl.DateTimeFormat("fi-FI", { day: "numeric", month: "long", year: "numeric" }).format(new Date(profile.company_verified_at))
      : "";
  const companyInventoryCount = commerceProducts.reduce((sum, product) => sum + product.stock_quantity, 0) + inquiryListingCount;
  const companyCoverImage = storefront?.banner_image_url?.trim() || "";
  const hasSaleProducts = commerceProducts.some((product) => activeSalePrice(product) < product.price_cents);
  const addCommerceProduct = (product: PublicProduct) => {
    const result = addCartProduct(product.id, product.company_id);
    setCommerceMessage(result.ok
      ? `${product.name} lisättiin ostoskoriin.`
      : result.error);
  };
  const toggleSavedCommerceProduct = (productId: string) => {
    setSavedCommerceProductIds((current) => {
      const next = current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId];
      localStorage.setItem("savedCommerceProducts", JSON.stringify(next));
      return next;
    });
  };
  const resetStorefrontFilters = () => {
    setStorefrontMode("all");
    setStorefrontCategory("");
    setStorefrontSubcategoryParent("");
    setStorefrontSubcategory("");
    setStorefrontVehicleType("");
    setStorefrontVehicleSubtype("");
    setStorefrontBrand("");
    setStorefrontModel("");
    setStorefrontYearMin("");
    setStorefrontYearMax("");
    setStorefrontEngineCc("");
    setStorefrontEngineModel("");
    setStorefrontPriceMin("");
    setStorefrontPriceMax("");
    setStorefrontDelivery("all");
  };
  const selectStorefrontFilterMode = (mode: "all" | "parts" | "vehicles" | "gear") => {
    setStorefrontMode(mode);
    setStorefrontCategory("");
    setStorefrontSubcategoryParent("");
    setStorefrontSubcategory("");
    setStorefrontVehicleType("");
    setStorefrontVehicleSubtype("");
    setStorefrontBrand("");
    setStorefrontModel("");
    setStorefrontYearMin("");
    setStorefrontYearMax("");
    setStorefrontEngineCc("");
    setStorefrontEngineModel("");
  };
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
  const companyFoundedYear = (() => {
    const value = storefront?.created_at || profile?.created_at;
    if (!value) return null;
    const year = new Date(value).getFullYear();
    return Number.isFinite(year) ? year : null;
  })();
  const companyFreeShippingThreshold = storefront?.free_shipping_threshold_cents != null && storefront.free_shipping_threshold_cents > 0
    ? formatFromEur(storefront.free_shipping_threshold_cents / 100)
    : "200 €";
  const companyPromoTitle = storefront?.storefront_promo_title?.trim() ?? "";
  const companyPromoSubtitle = storefront?.storefront_promo_subtitle?.trim() ?? "";
  const companyPromoColor = /^#[0-9a-f]{6}$/i.test(storefront?.storefront_promo_background_color ?? "")
    ? storefront!.storefront_promo_background_color
    : "#ff6500";
  const companyPromoImage = storefront?.storefront_promo_image_url?.trim() || "";
  const companyPromoEnabled = storefront?.storefront_promo_enabled === true
    && Boolean(companyPromoTitle || companyPromoSubtitle || companyPromoImage);
  const isMatinOsatStore = sellerName.toLocaleLowerCase("fi-FI").includes("matin osat");
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
      fi: "Seuraa",
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
      fi: "Avoin Maskines-käyttäjille",
      en: "Open to Maskines users",
      sv: "Öppet för Maskines-användare",
      no: "Åpent for Maskines-brukere",
    }[locale],
    verifiedBody: {
      fi: "Jokainen kirjautunut käyttäjä voi jakaa kokemuksensa ilman aiempaa ostosta.",
      en: "Every signed-in user can share their experience without a previous purchase.",
      sv: "Alla inloggade användare kan dela sin upplevelse utan ett tidigare köp.",
      no: "Alle innloggede brukere kan dele erfaringen sin uten et tidligere kjøp.",
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
    { value: "priceDesc", label: refLabels.highestPrice, icon: TrendingUp }
  ];
  const activeSort = sortOptions.find((option) => option.value === appliedSellerFilters.listingSort) ?? sortOptions[0];
  const storefrontSortOptions: Array<{ value: StorefrontSort; label: string; icon: typeof Search }> = [
    { value: "relevance", label: refLabels.relevanceFirst, icon: Crosshair },
    { value: "newest", label: refLabels.newestFirst, icon: Clock3 },
    { value: "oldest", label: refLabels.oldestFirst, icon: CalendarDays },
    { value: "priceAsc", label: refLabels.lowestPrice, icon: TrendingDown },
    { value: "priceDesc", label: refLabels.highestPrice, icon: TrendingUp }
  ];
  const activeStorefrontSort = storefrontSortOptions.find((option) => option.value === storefrontSort) ?? storefrontSortOptions[0];

  const scrollProfileDesktopFilterTo = (
    scope: "seller" | "storefront",
    tabId: string,
    setActiveTab: (value: string) => void
  ) => {
    setActiveTab(tabId);
    window.requestAnimationFrame(() => {
      const container = document.querySelector<HTMLElement>(`[data-profile-desktop-filter-scroll="${scope}"]`);
      const section = document.getElementById(`${scope}-desktop-filter-${tabId}`);
      if (!container || !section) return;
      const nextTop = container.scrollTop + section.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    });
  };

  const renderSellerDesktopFilter = () => {
    const selectedModeLabel = sellerListingMode === "vehicles"
      ? "Ajoneuvot"
      : sellerListingMode === "gear"
        ? "Ajovarusteet"
        : "Varaosat";
    const hasGroupSection = sellerListingMode === "vehicles"
      ? sellerFilterOptions.accessories.length > 0
      : sellerFilterOptions.categories.length > 0;
    const tabs: ProfileDesktopFilterTab[] = [
      { id: "basic", label: sellerListingMode === "vehicles" ? "Perustiedot" : "Sopivuus" },
      ...(hasGroupSection ? [{ id: "equipment", label: sellerListingMode === "vehicles" ? "Varusteet" : "Varaosaryhmät" }] : []),
      { id: "technical", label: "Mitat ja tekniikka" },
      ...(sellerListingMode !== "parts" && sellerFilterOptions.colors.length > 0 ? [{ id: "colors", label: "Värit" }] : []),
      { id: "other", label: "Hinta ja järjestys" }
    ];
    const modeCopy: Record<SellerListingMode, { title: string; description: string }> = {
      parts: { title: "Varaosat", description: "Ajoneuvokohtaiset osat" },
      vehicles: { title: "Ajoneuvot", description: "Kokonaiset ajoneuvot" },
      gear: { title: "Ajovarusteet", description: "Kypärät, puvut ja suojat" }
    };
    const choices = sellerAvailableListingModes.map((mode) => ({
      id: mode,
      ...modeCopy[mode],
      active: sellerListingMode === mode,
      count: listings.filter((listing) => sellerListingModeForListing(listing) === mode).length,
      onSelect: () => {
        selectSellerListingMode(mode);
        setSellerDesktopFilterTab("basic");
      }
    }));
    const categoryOptions = sellerFilterOptions.categories.map((option) => ({ value: option, label: translateCategory(locale, option) }));
    const parentOptions = sellerFilterOptions.subcategoryParents.map((option) => ({ value: option, label: translateCategory(locale, categoryLeaf(option)) }));
    const detailOptions = sellerFilterOptions.subcategories.map((option) => ({ value: option, label: translateCategory(locale, categoryLeaf(option)) }));

    return (
      <ProfileDesktopFilterPanel
        dialogTitleId="seller-profile-desktop-filter-title"
        scrollScope="seller"
        subtitle={`${selectedModeLabel} · rajaa vain myyjän ${sellerName} ilmoituksia`}
        resultCount={draftFilteredListingCount}
        saved={sellerDesktopSearchSaved}
        choices={choices}
        tabs={tabs}
        activeTab={sellerDesktopFilterTab}
        onSave={() => {
          localStorage.setItem(`maskines:seller-filter:${resolvedSellerId}`, JSON.stringify({ mode: sellerListingMode, filters: draftSellerFilters }));
          setSellerDesktopSearchSaved(true);
        }}
        onClear={() => {
          resetListingFilters();
          setSellerDesktopSearchSaved(false);
        }}
        onApply={applySellerFilters}
        onClose={() => setSellerFilterPanelOpen(false)}
        onTabSelect={(tabId) => scrollProfileDesktopFilterTo("seller", tabId, setSellerDesktopFilterTab)}
      >
        <section id="seller-desktop-filter-basic" className={homeStyles.desktopFullSection}>
          <header><h2>{sellerListingMode === "vehicles" ? "Ajoneuvon perustiedot" : "Varaosan sopivuus"}</h2><ChevronUp size={20} aria-hidden="true" /></header>
          {sellerFilterOptions.vehicleTypes.length > 0 && <div className={homeStyles.desktopFullBox}>
            <h3>{sellerListingMode === "vehicles" ? "Ajoneuvolaji" : "Sopivuus ajoneuvoon"}</h3>
            <div className={homeStyles.desktopFullFieldGrid}>
              <ProfileDesktopSelect label="Ajoneuvolaji" value={vehicleTypeFilter} allLabel="Kaikki ajoneuvot" options={sellerFilterOptions.vehicleTypes} onChange={(value) => {
                setVehicleTypeFilter(value);
                setVehicleSubtypeFilter("");
                setBrandFilter("");
                setModelFilter("");
              }} />
            </div>
          </div>}
          {sellerFilterOptions.vehicleSubtypes.length > 0 && <div className={homeStyles.desktopFullBox}>
            <h3>Ajoneuvotyypin tarkennus</h3>
            <div className={homeStyles.desktopFullFieldGrid}>
              <ProfileDesktopSelect label="Tyyppi" value={vehicleSubtypeFilter} allLabel="Kaikki tyypit" options={sellerFilterOptions.vehicleSubtypes} onChange={setVehicleSubtypeFilter} />
            </div>
          </div>}
        </section>

        {hasGroupSection && <section id="seller-desktop-filter-equipment" className={homeStyles.desktopFullSection}>
          <header><h2>{sellerListingMode === "vehicles" ? "Ajoneuvon varusteet" : "Varaosaryhmät"}</h2><ChevronUp size={20} aria-hidden="true" /></header>
          <div className={homeStyles.desktopFullBox}>
            {sellerListingMode === "vehicles" ? <div className={homeStyles.desktopCheckboxGrid}>
              {sellerFilterOptions.accessories.map((accessory) => {
                const selected = vehicleAccessoriesFilter.includes(accessory);
                return <label key={accessory}><input type="checkbox" checked={selected} onChange={() => setVehicleAccessoriesFilter((current) => selected ? current.filter((item) => item !== accessory) : [...current, accessory])} /><span aria-hidden="true">{selected ? <Check size={15} /> : null}</span>{translateVehicleAccessory(locale, accessory)}</label>;
              })}
            </div> : <div className={homeStyles.desktopCategoryFlow}>
              <ProfileDesktopCategoryStep number={1} title="Pääkategoria" description="Valitse varaosan pääryhmä" value={categoryFilter} options={categoryOptions} enabled={categoryOptions.length > 0} disabledLabel="Ei kategorioita" onChange={(value) => {
                setCategoryFilter(value);
                setSubcategoryParentFilter("");
                setSubcategoryFilter("");
              }} />
              <ChevronRight className={homeStyles.desktopCategoryArrow} size={22} aria-hidden="true" />
              <ProfileDesktopCategoryStep number={2} title="Alakategoria" description="Tarkenna valittua pääryhmää" value={subcategoryParentFilter} options={parentOptions} enabled={Boolean(categoryFilter && parentOptions.length)} disabledLabel="Valitse ensin pääkategoria" onChange={(value) => {
                setSubcategoryParentFilter(value);
                setSubcategoryFilter("");
              }} />
              <ChevronRight className={homeStyles.desktopCategoryArrow} size={22} aria-hidden="true" />
              <ProfileDesktopCategoryStep number={3} title="Tarkempi osa" description="Valitse tarkin sopiva osaryhmä" value={subcategoryFilter} options={detailOptions} enabled={Boolean(categoryFilter && subcategoryParentFilter && detailOptions.length)} disabledLabel="Valitse ensin alakategoria" onChange={setSubcategoryFilter} />
            </div>}
          </div>
        </section>}

        <section id="seller-desktop-filter-technical" className={homeStyles.desktopFullSection}>
          <header><h2>Mitat ja tekniset tiedot</h2><ChevronUp size={20} aria-hidden="true" /></header>
          <div className={homeStyles.desktopFullBox}>
            <div className={homeStyles.desktopFullFieldGrid}>
              <ProfileDesktopSelect label="Merkki" value={brandFilter} allLabel="Kaikki merkit" options={sellerFilterOptions.brands} onChange={(value) => { setBrandFilter(value); setModelFilter(""); }} />
              <ProfileDesktopSelect label="Malli" value={modelFilter} allLabel="Kaikki mallit" options={sellerFilterOptions.models} onChange={setModelFilter} />
              <ProfileDesktopSelect label="Moottoritilavuus (cm³)" value={engineCcFilter} allLabel="Kaikki koot" options={sellerFilterOptions.engineCcs} onChange={setEngineCcFilter} />
              {sellerListingMode === "parts" && <ProfileDesktopSelect label="Moottori" value={engineModelFilter} allLabel="Kaikki moottorit" options={sellerFilterOptions.engineModels} onChange={setEngineModelFilter} />}
              {sellerFilterOptions.years.length > 0 && <label className={homeStyles.desktopFullField}>
                <span>Vuosimalli</span>
                <div className={premiumStyles.profileDesktopRangePair}>
                  <select value={yearMinFilter} aria-label="Vuosimallin minimi" onChange={(event) => setYearMinFilter(event.target.value)}><option value="">Minimi</option>{sellerFilterOptions.years.map((year) => <option key={`desktop-min-${year}`} value={year}>{year}</option>)}</select>
                  <i aria-hidden="true">–</i>
                  <select value={yearMaxFilter} aria-label="Vuosimallin maksimi" onChange={(event) => setYearMaxFilter(event.target.value)}><option value="">Maksimi</option>{sellerFilterOptions.years.map((year) => <option key={`desktop-max-${year}`} value={year}>{year}</option>)}</select>
                </div>
              </label>}
              {sellerListingMode === "vehicles" && <>
                <ProfileDesktopSelect label="Moottorin tyyppi" value={vehicleEngineKindFilter} allLabel="Ei väliä" options={sellerFilterOptions.engineKinds} onChange={setVehicleEngineKindFilter} />
                <ProfileDesktopSelect label="Vetotapa" value={vehicleDriveTypeFilter} allLabel="Ei väliä" options={sellerFilterOptions.driveTypes} onChange={setVehicleDriveTypeFilter} />
                <ProfileDesktopSelect label="Tieliikennekelpoisuus" value={vehicleRoadLegalFilter} allLabel="Ei väliä" options={sellerFilterOptions.roadLegalValues} onChange={setVehicleRoadLegalFilter} />
              </>}
            </div>
          </div>
        </section>

        {sellerListingMode !== "parts" && sellerFilterOptions.colors.length > 0 && <section id="seller-desktop-filter-colors" className={homeStyles.desktopFullSection}>
          <header><h2>Värisävy</h2><ChevronUp size={20} aria-hidden="true" /></header>
          <div className={`${homeStyles.desktopFullBox} ${homeStyles.desktopColorOptions}`}>
            {sellerFilterOptions.colors.map((color) => {
              const selected = vehicleColorsFilter.includes(color);
              const swatch = VEHICLE_COLOR_OPTIONS.find((option) => option.label === color)?.swatch ?? "#7c8a96";
              return <label key={color}><input type="checkbox" checked={selected} onChange={() => setVehicleColorsFilter((current) => selected ? current.filter((item) => item !== color) : [...current, color])} /><span style={{ background: swatch }} aria-hidden="true" />{translateVehicleColor(locale, color)}</label>;
            })}
          </div>
        </section>}

        <section id="seller-desktop-filter-other" className={homeStyles.desktopFullSection}>
          <header><h2>Hinta ja järjestys</h2><ChevronUp size={20} aria-hidden="true" /></header>
          <div className={homeStyles.desktopFullBox}>
            <div className={homeStyles.desktopFullFieldGrid}>
              <label className={homeStyles.desktopFullField}>
                <span>Hintaväli (€)</span>
                <div className={premiumStyles.profileDesktopRangePair}>
                  <input inputMode="numeric" value={vehiclePriceMinFilter} placeholder="Minimi" aria-label="Hinnan minimi" onChange={(event) => setVehiclePriceMinFilter(event.target.value.replace(/\D/g, ""))} />
                  <i aria-hidden="true">–</i>
                  <input inputMode="numeric" value={vehiclePriceMaxFilter} placeholder="Maksimi" aria-label="Hinnan maksimi" onChange={(event) => setVehiclePriceMaxFilter(event.target.value.replace(/\D/g, ""))} />
                </div>
              </label>
              <label className={homeStyles.desktopFullField}>
                <span>Järjestä</span>
                <select value={listingSort} onChange={(event) => setListingSort(event.target.value as ListingSort)}>
                  <option value="relevance">Osuvimmat ensin</option>
                  <option value="newest">Uusimmat ensin</option>
                  <option value="oldest">Vanhimmat ensin</option>
                  <option value="priceAsc">Edullisin ensin</option>
                  <option value="priceDesc">Kallein ensin</option>
                </select>
              </label>
            </div>
          </div>
        </section>
      </ProfileDesktopFilterPanel>
    );
  };

  const renderStorefrontDesktopFilter = () => {
    const effectiveMode = storefrontMode === "all"
      ? (storefrontModes.includes("parts") ? "parts" : storefrontModes[0] ?? "parts")
      : storefrontMode;
    const selectedModeLabel = effectiveMode === "vehicles" ? "Ajoneuvot" : effectiveMode === "gear" ? "Ajovarusteet" : "Varaosat";
    const hasGroups = storefrontCategories.length > 0;
    const tabs: ProfileDesktopFilterTab[] = [
      { id: "basic", label: effectiveMode === "vehicles" ? "Perustiedot" : "Sopivuus" },
      ...(hasGroups ? [{ id: "equipment", label: effectiveMode === "vehicles" ? "Ryhmät" : "Varaosaryhmät" }] : []),
      { id: "technical", label: "Mitat ja tekniikka" },
      { id: "other", label: "Hinta ja toimitus" }
    ];
    const modeCopy: Record<StorefrontItemView["mode"], { title: string; description: string }> = {
      parts: { title: "Varaosat", description: "Ajoneuvokohtaiset osat" },
      vehicles: { title: "Ajoneuvot", description: "Kokonaiset ajoneuvot" },
      gear: { title: "Ajovarusteet", description: "Kypärät, puvut ja suojat" }
    };
    const choices = storefrontModes.map((mode) => ({
      id: mode,
      ...modeCopy[mode],
      active: effectiveMode === mode,
      count: storefrontItemViews.filter((view) => view.mode === mode).length,
      onSelect: () => {
        selectStorefrontFilterMode(mode);
        setStorefrontDesktopFilterTab("basic");
      }
    }));
    const categoryOptions = storefrontCategories.map((option) => ({ value: option, label: translateCategory(locale, option) }));
    const parentOptions = storefrontSubcategoryParents.map((option) => ({ value: option, label: translateCategory(locale, categoryLeaf(option)) }));
    const detailOptions = storefrontSubcategories.map((option) => ({ value: option, label: translateCategory(locale, categoryLeaf(option)) }));

    return (
      <ProfileDesktopFilterPanel
        dialogTitleId="company-profile-desktop-filter-title"
        scrollScope="storefront"
        subtitle={`${selectedModeLabel} · rajaa vain yrityksen ${sellerName} valikoimaa`}
        resultCount={visibleStorefrontItems.length}
        saved={storefrontDesktopSearchSaved}
        choices={choices}
        tabs={tabs}
        activeTab={storefrontDesktopFilterTab}
        onSave={() => {
          localStorage.setItem(`maskines:storefront-filter:${resolvedSellerId}`, JSON.stringify({
            mode: effectiveMode,
            category: storefrontCategory,
            subcategoryParent: storefrontSubcategoryParent,
            subcategory: storefrontSubcategory,
            vehicleType: storefrontVehicleType,
            vehicleSubtype: storefrontVehicleSubtype,
            brand: storefrontBrand,
            model: storefrontModel,
            yearMin: storefrontYearMin,
            yearMax: storefrontYearMax,
            engineCc: storefrontEngineCc,
            engineModel: storefrontEngineModel,
            priceMin: storefrontPriceMin,
            priceMax: storefrontPriceMax,
            delivery: storefrontDelivery
          }));
          setStorefrontDesktopSearchSaved(true);
        }}
        onClear={() => {
          resetStorefrontFilters();
          setStorefrontSort("newest");
          setStorefrontDesktopSearchSaved(false);
        }}
        onApply={() => setStorefrontFilterOpen(false)}
        onClose={() => setStorefrontFilterOpen(false)}
        onTabSelect={(tabId) => scrollProfileDesktopFilterTo("storefront", tabId, setStorefrontDesktopFilterTab)}
      >
        <section id="storefront-desktop-filter-basic" className={homeStyles.desktopFullSection}>
          <header><h2>{effectiveMode === "vehicles" ? "Ajoneuvon perustiedot" : "Varaosan sopivuus"}</h2><ChevronUp size={20} aria-hidden="true" /></header>
          {storefrontVehicleTypes.length > 0 && <div className={homeStyles.desktopFullBox}>
            <h3>{effectiveMode === "vehicles" ? "Ajoneuvolaji" : "Sopivuus ajoneuvoon"}</h3>
            <div className={homeStyles.desktopFullFieldGrid}>
              <ProfileDesktopSelect label="Ajoneuvolaji" value={storefrontVehicleType} allLabel="Kaikki ajoneuvot" options={storefrontVehicleTypes} onChange={(value) => {
                setStorefrontVehicleType(value);
                setStorefrontVehicleSubtype("");
                setStorefrontBrand("");
                setStorefrontModel("");
              }} />
            </div>
          </div>}
          {storefrontVehicleSubtypes.length > 0 && <div className={homeStyles.desktopFullBox}>
            <h3>Ajoneuvotyypin tarkennus</h3>
            <div className={homeStyles.desktopFullFieldGrid}>
              <ProfileDesktopSelect label="Tyyppi" value={storefrontVehicleSubtype} allLabel="Kaikki tyypit" options={storefrontVehicleSubtypes} onChange={(value) => { setStorefrontVehicleSubtype(value); setStorefrontBrand(""); setStorefrontModel(""); }} />
            </div>
          </div>}
        </section>

        {hasGroups && <section id="storefront-desktop-filter-equipment" className={homeStyles.desktopFullSection}>
          <header><h2>{effectiveMode === "vehicles" ? "Tuoteryhmät" : "Varaosaryhmät"}</h2><ChevronUp size={20} aria-hidden="true" /></header>
          <div className={homeStyles.desktopFullBox}>
            <div className={homeStyles.desktopCategoryFlow}>
              <ProfileDesktopCategoryStep number={1} title="Pääkategoria" description="Valitse varaosan pääryhmä" value={storefrontCategory} options={categoryOptions} enabled={categoryOptions.length > 0} disabledLabel="Ei kategorioita" onChange={(value) => {
                setStorefrontCategory(value);
                setStorefrontSubcategoryParent("");
                setStorefrontSubcategory("");
                setStorefrontVehicleType("");
                setStorefrontVehicleSubtype("");
                setStorefrontBrand("");
                setStorefrontModel("");
              }} />
              <ChevronRight className={homeStyles.desktopCategoryArrow} size={22} aria-hidden="true" />
              <ProfileDesktopCategoryStep number={2} title="Alakategoria" description="Tarkenna valittua pääryhmää" value={storefrontSubcategoryParent} options={parentOptions} enabled={Boolean(storefrontCategory && parentOptions.length)} disabledLabel="Valitse ensin pääkategoria" onChange={(value) => {
                setStorefrontSubcategoryParent(value);
                setStorefrontSubcategory("");
                setStorefrontBrand("");
                setStorefrontModel("");
              }} />
              <ChevronRight className={homeStyles.desktopCategoryArrow} size={22} aria-hidden="true" />
              <ProfileDesktopCategoryStep number={3} title="Tarkempi osa" description="Valitse tarkin sopiva osaryhmä" value={storefrontSubcategory} options={detailOptions} enabled={Boolean(storefrontCategory && storefrontSubcategoryParent && detailOptions.length)} disabledLabel="Valitse ensin alakategoria" onChange={(value) => { setStorefrontSubcategory(value); setStorefrontBrand(""); setStorefrontModel(""); }} />
            </div>
          </div>
        </section>}

        <section id="storefront-desktop-filter-technical" className={homeStyles.desktopFullSection}>
          <header><h2>Mitat ja tekniset tiedot</h2><ChevronUp size={20} aria-hidden="true" /></header>
          <div className={homeStyles.desktopFullBox}>
            <div className={homeStyles.desktopFullFieldGrid}>
              <ProfileDesktopSelect label="Merkki" value={storefrontBrand} allLabel="Kaikki merkit" options={storefrontBrands} onChange={(value) => { setStorefrontBrand(value); setStorefrontModel(""); }} />
              <ProfileDesktopSelect label="Malli" value={storefrontModel} allLabel="Kaikki mallit" options={storefrontModels} onChange={setStorefrontModel} />
              {storefrontTechnicalOptions.years.length > 0 && <label className={homeStyles.desktopFullField}>
                <span>Vuosimalli</span>
                <div className={premiumStyles.profileDesktopRangePair}>
                  <select value={storefrontYearMin} aria-label="Vuosimallin minimi" onChange={(event) => setStorefrontYearMin(event.target.value)}><option value="">Minimi</option>{storefrontTechnicalOptions.years.map((year) => <option key={`storefront-desktop-min-${year}`} value={year}>{year}</option>)}</select>
                  <i aria-hidden="true">–</i>
                  <select value={storefrontYearMax} aria-label="Vuosimallin maksimi" onChange={(event) => setStorefrontYearMax(event.target.value)}><option value="">Maksimi</option>{storefrontTechnicalOptions.years.map((year) => <option key={`storefront-desktop-max-${year}`} value={year}>{year}</option>)}</select>
                </div>
              </label>}
              <ProfileDesktopSelect label="Moottoritilavuus (cm³)" value={storefrontEngineCc} allLabel="Kaikki koot" options={storefrontTechnicalOptions.engineCcs} onChange={setStorefrontEngineCc} />
              <ProfileDesktopSelect label="Moottori" value={storefrontEngineModel} allLabel="Kaikki moottorit" options={storefrontTechnicalOptions.engineModels} onChange={setStorefrontEngineModel} />
            </div>
          </div>
        </section>

        <section id="storefront-desktop-filter-other" className={homeStyles.desktopFullSection}>
          <header><h2>Hinta, toimitus ja järjestys</h2><ChevronUp size={20} aria-hidden="true" /></header>
          <div className={homeStyles.desktopFullBox}>
            <div className={homeStyles.desktopFullFieldGrid}>
              <label className={homeStyles.desktopFullField}>
                <span>Hintaväli (€)</span>
                <div className={premiumStyles.profileDesktopRangePair}>
                  <input inputMode="numeric" value={storefrontPriceMin} placeholder="Minimi" aria-label="Hinnan minimi" onChange={(event) => setStorefrontPriceMin(event.target.value.replace(/\D/g, ""))} />
                  <i aria-hidden="true">–</i>
                  <input inputMode="numeric" value={storefrontPriceMax} placeholder="Maksimi" aria-label="Hinnan maksimi" onChange={(event) => setStorefrontPriceMax(event.target.value.replace(/\D/g, ""))} />
                </div>
              </label>
              {(storefrontDeliveryOptions.pickup > 0 || storefrontDeliveryOptions.posti > 0) && <label className={homeStyles.desktopFullField}>
                <span>Toimitustapa</span>
                <select value={storefrontDelivery} onChange={(event) => setStorefrontDelivery(event.target.value as typeof storefrontDelivery)}><option value="all">Kaikki toimitustavat</option>{storefrontDeliveryOptions.pickup > 0 && <option value="pickup">Nouto</option>}{storefrontDeliveryOptions.posti > 0 && <option value="posti">Posti</option>}</select>
              </label>}
              <label className={homeStyles.desktopFullField}>
                <span>Järjestä</span>
                <select value={storefrontSort} onChange={(event) => setStorefrontSort(event.target.value as StorefrontSort)}>{storefrontSortOptions.map((option) => <option key={`storefront-desktop-sort-${option.value}`} value={option.value}>{option.label}</option>)}</select>
              </label>
            </div>
          </div>
        </section>
      </ProfileDesktopFilterPanel>
    );
  };

  if (profileLoading || (profile?.account_type === "company" && storefrontLoading)) {
    return <PageLoadingFallback />;
  }

  return (
    <main className={`auth-page seller-page ${isVerifiedCompany ? "seller-company-page seller-verified-company-page" : `seller-private-page${isCompany ? " seller-unverified-company-page" : ""}`}`}>
      <section className="sp-wrap">
        {!isVerifiedCompany && (
          <div className={`seller-ref-hero${storefront?.banner_image_url ? " has-storefront-banner" : ""}`} style={storefront?.banner_image_url ? { backgroundImage: `linear-gradient(90deg, rgba(3, 12, 24, .92), rgba(3, 12, 24, .54)), url(${JSON.stringify(storefront.banner_image_url)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
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

          {profile?.bio?.trim() && (
            <article className="seller-ref-about seller-ref-about-highlight">
              <p>{profile.bio.trim()}</p>
            </article>
          )}

          {currentUserId === resolvedSellerId && isCompany && (
            <div className="seller-ref-follow-row">
              <Link className="seller-ref-follow-button" href="/yritys">
                <Cog size={15} />
                Muokkaa yrityssivua
              </Link>
            </div>
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
              <strong>{isVerifiedCompany && commerceProducts.length > 0 ? commerceProducts.length : listings.length}</strong>
              <span>{isVerifiedCompany && commerceProducts.length > 0 ? "Tuotteet" : refLabels.activeListings}</span>
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
            <div className="seller-ref-detail-row">
              <MessageCircle size={20} aria-hidden="true" />
              <span>{languageInfo.label}</span>
              <strong>{languageInfo.value}</strong>
            </div>
          </div>
          </div>
        )}

        {isVerifiedCompany && (() => {
          const commerceStyles = premiumStyles;
          return (
          <section className={commerceStyles.companyStorefront} aria-label={`${sellerName} ${sft("Verkkokauppa")}`}>
            <div
              className={commerceStyles.companyProfileHero}
              style={companyCoverImage ? {
                backgroundImage: `linear-gradient(rgba(7, 16, 25, .88), rgba(7, 16, 25, .88)), url(${JSON.stringify(companyCoverImage)})`
              } : undefined}
            >
              <div className={commerceStyles.companyProfileBreadcrumb}>
                <Link href="/">{sft("Etusivu")}</Link><ChevronRight size={13} /><span>{sft("Yritykset")}</span><ChevronRight size={13} /><strong>{sellerName}</strong>{companyStoreView === "reviews" && <><ChevronRight size={13} /><strong>{sft("Arvostelut")}</strong></>}
              </div>
              <div className={commerceStyles.companyProfileIdentity}>
                <div className={commerceStyles.companyProfileLogo}>
                  {showSellerAvatar ? <img
                    src={sellerAvatarUrl}
                    alt={`${sellerName} logo`}
                    onError={() => setAvatarFailed(true)}
                  /> : companyCoverImage ? <img
                    src={companyCoverImage}
                    alt={`${sellerName} logo`}
                    className={commerceStyles.companyProfileLogoFromBanner}
                    style={isMatinOsatStore ? { objectPosition: "22% center" } : undefined}
                  /> : <strong>{sellerInitial}</strong>}
                </div>
                <div className={commerceStyles.companyProfileCopy}>
                  <div className={commerceStyles.companyProfileTitleRow}>
                    <h1>{sellerName}</h1>
                    <span className={commerceStyles.companyProfileVerified}><Shield size={15} /> {sft("Vahvistettu yritys")}</span>
                  </div>
                  <p>{storefront?.storefront_headline || storefront?.description?.trim() || profile?.bio?.trim() || "Laadukkaita ja tarkastettuja tuotteita sekä asiantuntevaa palvelua."}</p>
                  <div className={commerceStyles.companyProfileMeta}>
                    <button type="button" onClick={() => setCompanyStoreView("reviews")}><Star size={17} fill="currentColor" /> {reviews.length ? `${averageRating.toFixed(1)}/5` : sft("Ei arvioita")} <span>({visibleReviewCount})</span></button>
                    <span>{storefrontItemCount.toLocaleString(locale === "fi" ? "fi-FI" : locale)} {sft("tuotetta")}</span>
                  </div>
                </div>
              </div>
              <div className={commerceStyles.companyProfileSide}>
                <div className={commerceStyles.companyProfileActions}>
                  {currentUserId === resolvedSellerId ? (
                    <Link className={commerceStyles.companyProfileSecondaryAction} href="/yritys?tab=appearance" aria-label={sft("Muokkaa profiilia")}><Cog size={17} /><span>{sft("Muokkaa profiilia")}</span></Link>
                  ) : currentUserId ? (
                    <button
                      type="button"
                      className={commerceStyles.companyProfileFollowAction}
                      disabled={followSaving}
                      aria-pressed={followStats.is_following}
                      onClick={handleProfileFollowToggle}
                    >
                      {followStats.is_following ? <UserCheck size={17} /> : <UserPlus size={17} />}
                      {followStats.is_following ? refLabels.following : refLabels.follow}
                    </button>
                  ) : (
                    <Link
                      className={commerceStyles.companyProfileFollowAction}
                      href={`${pagePath("auth", locale)}?returnTo=${encodeURIComponent(profilePath(sellerId, sellerName, locale))}`}
                    >
                      <UserPlus size={17} /> {refLabels.follow}
                    </Link>
                  )}
                </div>
                {followError && currentUserId !== resolvedSellerId && <small className={commerceStyles.companyProfileFollowError}>{followError}</small>}
              </div>
            </div>

            <div className={commerceStyles.companyStoreNav} aria-label={sft("Yrityskaupan navigointi")}>
              <nav>
                <button type="button" className={companyStoreView === "catalog" ? commerceStyles.companyStoreNavActive : ""} aria-pressed={companyStoreView === "catalog"} onClick={() => setCompanyStoreView("catalog")}><ShoppingBag size={15} /> {sft("Kauppa")}</button>
                <button type="button" className={companyStoreView === "details" ? commerceStyles.companyStoreNavActive : ""} aria-pressed={companyStoreView === "details"} onClick={() => setCompanyStoreView("details")}><Building2 size={15} /> {sft("Yrityksen tiedot")}</button>
                <button type="button" className={companyStoreView === "reviews" ? commerceStyles.companyStoreNavActive : ""} aria-pressed={companyStoreView === "reviews"} onClick={() => setCompanyStoreView("reviews")}><Star size={15} /> {sft("Arvostelut")}</button>
              </nav>
            </div>

            <div className={commerceStyles.companyStoreBody}>
            <div className={commerceStyles.companyStoreMain}>
            {companyStoreView === "catalog" && <div className={commerceStyles.companyCatalog} id="yrityksen-tuotteet">
              <header className={commerceStyles.companyCatalogHeader}>
                <div>
                  <h2>{sellerName} · {sft("Verkkokauppa")}</h2>
                  <p>{storefront?.description?.trim() || profile?.bio?.trim() || sft("Yritys ei ole vielä lisännyt esittelytekstiä.")}</p>
                </div>
              </header>
              <section className={`${commerceStyles.companyTrustStrip} ${commerceStyles.companyTrustStripTop}`} aria-label={sft("Kaupankäynnin edut")}>
                <div><Truck size={22} /><span><strong>{sft("Joustava toimitus")}</strong><small>{sft("Nouto tai toimitus tuotteen mukaan")}</small></span></div>
                <div><CreditCard size={22} /><span><strong>{sft("Turvallinen maksaminen")}</strong><small>{sft("Maksu suojatun kassapalvelun kautta")}</small></span></div>
                <div><PackageCheck size={22} /><span><strong>{sft("Ajantasainen varasto")}</strong><small>{companyInventoryCount} {sft("kappaletta saatavilla")}</small></span></div>
              </section>
              {companyPromoEnabled && <div
                className={`${commerceStyles.companyFreeShippingBanner}${companyPromoImage ? ` ${commerceStyles.companyFreeShippingBannerWithImage}` : ""}`}
                style={{
                  backgroundColor: companyPromoColor,
                  backgroundImage: companyPromoImage ? `linear-gradient(90deg, rgba(5,17,30,.68), rgba(5,17,30,.25)), url(${JSON.stringify(companyPromoImage)})` : "none"
                }}
              >
                <span>
                  {companyPromoTitle && <strong>{companyPromoTitle}</strong>}
                  {companyPromoSubtitle && <small>{companyPromoSubtitle}</small>}
                </span>
              </div>}
              {isMatinOsatStore && (
                <div className={commerceStyles.companyCatalogPromoBanner}>
                  <img src="/black-friday-banner.png" alt="Black Friday -alennus" />
                </div>
              )}
              <h2 className={commerceStyles.companyCatalogSectionTitle}>{sft("Tuotteet ja varaosat")}</h2>
              <div className={commerceStyles.companyMarketTabs} data-count={storefrontModes.length + 1} role="tablist" aria-label={sft("Kaupan ilmoitustyyppi")}>
                {(["all", ...storefrontModes] as const).map((mode) => {
                  const label = mode === "all" ? "Kaikki" : mode === "vehicles" ? "Ajoneuvot" : mode === "parts" ? "Varaosat" : "Ajovarusteet";
                  return (
                  <button
                    type="button"
                    role="tab"
                    key={mode}
                    aria-selected={storefrontMode === mode}
                    className={storefrontMode === mode ? commerceStyles.companyMarketTabActive : ""}
                    onClick={() => selectStorefrontFilterMode(mode)}
                  >
                    <span>{sft(label)}</span>
                    <small>{mode === "all" ? storefrontItemCount : storefrontItemViews.filter((item) => item.mode === mode).length}</small>
                  </button>
                  );
                })}
              </div>
              <div className={commerceStyles.companyCatalogTools}>
                <form
                  className={commerceStyles.companyStoreSearch}
                  role="search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setStorefrontSearchOpen(false);
                  }}
                  onBlur={() => window.setTimeout(() => setStorefrontSearchOpen(false), 140)}
                >
                  <Search size={19} aria-hidden="true" />
                  <input
                    value={storefrontSearch}
                    onChange={(event) => {
                      setStorefrontSearch(event.target.value);
                      setStorefrontSearchOpen(true);
                    }}
                    onFocus={() => setStorefrontSearchOpen(true)}
                    placeholder={sft(profile?.account_type === "company" ? "Hae tämän yrityksen tuotteista" : "Hae tämän myyjän tuotteista")}
                    aria-label={sft(profile?.account_type === "company" ? "Hae yrityksen tuotteista" : "Hae myyjän tuotteista")}
                    aria-controls="seller-storefront-search-suggestions"
                    aria-expanded={storefrontSearchOpen && normalizeSellerFilterText(storefrontSearch).length >= 2}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {storefrontSearch && <button className={commerceStyles.companyStoreSearchClear} type="button" aria-label={sft("Tyhjennä haku")} onClick={() => { setStorefrontSearch(""); setStorefrontSearchOpen(false); }}><X size={17} /></button>}
                  {storefrontSearchOpen && normalizeSellerFilterText(storefrontSearch).length >= 2 && (
                    <section
                      id="seller-storefront-search-suggestions"
                      className={commerceStyles.companyStoreSearchSuggestions}
                      aria-label={sft("Hakuehdotukset")}
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <button
                        type="submit"
                        className={commerceStyles.companyStoreSearchAll}
                        onClick={() => setStorefrontSearchOpen(false)}
                      >
                        <Search size={17} aria-hidden="true" />
                        <span>
                          <strong>{storefrontSearch.trim()}</strong>
                          <small>{sft("Hae kaikki tämän myyjän tuotteet")} · {storefrontSearchResults.totalCount} {sft(storefrontSearchResults.totalCount === 1 ? "osuma" : "osumaa")}</small>
                        </span>
                      </button>
                      <div className={commerceStyles.companyStoreSearchSuggestionList}>
                        {storefrontSearchResults.items.length > 0 ? storefrontSearchResults.items.map((item, index) => {
                          const title = storefrontItemDisplayTitle(item, locale);
                          const detail = [translateCategory(locale, item.category), item.brand, item.model, item.year, item.listing?.part_number].filter(Boolean).join(" · ");
                          return (
                            <Link
                              key={item.key}
                              href={storefrontItemHref(item)}
                              className={commerceStyles.companyStoreSearchSuggestion}
                              onClick={() => setStorefrontSearchOpen(false)}
                            >
                              <img src={storefrontItemImageSrc(item, index)} alt="" loading="lazy" />
                              <span><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
                              <b>{formatFromEur(item.priceCents / 100)}</b>
                            </Link>
                          );
                        }) : <p>{sft("Ei suoria tuote-ehdotuksia")}</p>}
                      </div>
                    </section>
                  )}
                </form>
                <div
                  className={`${commerceStyles.companyStoreSortWrap}${storefrontSortOpen ? ` ${commerceStyles.companyStoreSortWrapOpen}` : ""}`}
                  onBlur={(event) => {
                    const nextTarget = event.relatedTarget;
                    if (!(nextTarget instanceof HTMLElement) || !event.currentTarget.contains(nextTarget)) setStorefrontSortOpen(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setStorefrontSortOpen(false);
                  }}
                >
                  <button type="button" className={commerceStyles.companyStoreSortButton} aria-label={`${sft("Järjestä tuotteet")}: ${activeStorefrontSort.label}`} aria-haspopup="menu" aria-expanded={storefrontSortOpen} onClick={() => setStorefrontSortOpen((open) => !open)}>
                    <ArrowDownWideNarrow size={19} aria-hidden="true" />
                    <span>{activeStorefrontSort.label}</span>
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>
                  {storefrontSortOpen && <div className={commerceStyles.companyStoreSortMenu} role="menu">
                    {storefrontSortOptions.map((option) => {
                      const Icon = option.icon;
                      const selected = option.value === storefrontSort;
                      return <button type="button" role="menuitemradio" aria-checked={selected} className={selected ? commerceStyles.companyStoreSortOptionSelected : commerceStyles.companyStoreSortOption} key={option.value} onClick={() => { setStorefrontSort(option.value); setStorefrontSortOpen(false); }}><Icon size={16} aria-hidden="true" /><span>{option.label}</span>{selected && <Check size={16} aria-hidden="true" />}</button>;
                    })}
                  </div>}
                </div>
                <div className={commerceStyles.companyStoreFilterWrap}>
                  <button type="button" className={storefrontFilterOpen || storefrontActiveFilterCount ? commerceStyles.companyStoreFilterActive : commerceStyles.companyStoreFilterButton} aria-expanded={storefrontFilterOpen} onClick={() => {
                    setStorefrontSortOpen(false);
                    if (!storefrontFilterOpen && storefrontMode === "all" && storefrontModes[0]) {
                      selectStorefrontFilterMode(storefrontModes.includes("parts") ? "parts" : storefrontModes[0]);
                    }
                    setStorefrontDesktopFilterTab("basic");
                    setStorefrontFilterOpen((open) => !open);
                  }}><SlidersHorizontal size={18} /> {sft("Suodata")}{storefrontActiveFilterCount > 0 && <span>{storefrontActiveFilterCount}</span>}<ChevronDown size={16} /></button>
                </div>
              </div>
              <div className={commerceStyles.companyCollectionBar}>
                <div className={commerceStyles.companyCollectionTabs} role="tablist" aria-label={sft("Tuotevalikoima")}>
                  <button type="button" role="tab" aria-selected={storefrontCollection === "popular"} className={storefrontCollection === "popular" ? commerceStyles.companyCollectionTabActive : ""} onClick={() => { setStorefrontCollection("popular"); setStorefrontSort("newest"); }}>{sft("Suosituimmat")}</button>
                  <button type="button" role="tab" aria-selected={storefrontCollection === "newest"} className={storefrontCollection === "newest" ? commerceStyles.companyCollectionTabActive : ""} onClick={() => { setStorefrontCollection("newest"); setStorefrontSort("newest"); }}>{sft("Uusimmat")}</button>
                  <button type="button" role="tab" aria-selected={storefrontCollection === "sale"} className={storefrontCollection === "sale" ? commerceStyles.companyCollectionTabActive : ""} disabled={!hasSaleProducts} onClick={() => { setStorefrontCollection("sale"); setStorefrontSort("newest"); }}>{sft("Tarjouksessa")}</button>
                </div>
                <div className={commerceStyles.companyCatalogCount}>
                  <span>1–{Math.min(24, visibleStorefrontItems.length)} / {visibleStorefrontItems.length} {sft("tuotetta")}</span>
                  <div><button type="button" aria-label={sft("Ruudukkonäkymä")} aria-pressed="true"><LayoutGrid size={17} /></button><button type="button" aria-label={sft("Listanäkymä")} aria-pressed="false"><List size={17} /></button></div>
                </div>
              </div>
              <div className={commerceStyles.companyCatalogFilterPortal}>
                <div className={commerceStyles.companyStoreFilterWrap}>
                  {storefrontFilterOpen && createPortal(<>
                    <button type="button" className={`${homeStyles.desktopFilterBackdrop} ${premiumStyles.profileDesktopFilterOnly}`} aria-label={sft("Sulje suodattimet")} onClick={() => setStorefrontFilterOpen(false)} />
                    <aside className={`${homeStyles.desktopFilterModal} ${homeStyles.resultsFilterModal} ${premiumStyles.profileDesktopFilterOnly}`}>
                      {renderStorefrontDesktopFilter()}
                    </aside>
                    <div className={`seller-page ${premiumStyles.profileMobileFilterOnly}`}>
                    <button type="button" className="seller-home-filter-backdrop" aria-label={sft("Sulje suodattimet")} onClick={() => setStorefrontFilterOpen(false)} />
                    <form className={`seller-home-filter-bar is-open is-expanded ${commerceStyles.companyMobileFilterSheet}`} role="search" aria-label={sft("Suodata hakua")} onSubmit={(event) => event.preventDefault()}>
                      <div className="seller-mobile-filter-drag-handle" aria-hidden="true"><span /></div>
                      <header className="seller-home-filter-head">
                        <strong><span className="seller-filter-title-mobile">{sft("Suodata hakua")}</span></strong>
                        <div>
                          <button type="button" className="seller-filter-head-reset" onClick={() => { resetStorefrontFilters(); setStorefrontSort("newest"); }}>{sft("Nollaa suodatukset")}</button>
                          <button type="button" className={`seller-filter-head-close ${commerceStyles.companyMobileFilterClose}`} aria-label={sft("Sulje suodattimet")} onClick={() => setStorefrontFilterOpen(false)}><X size={23} strokeWidth={2.6} /></button>
                        </div>
                      </header>
                      {storefrontModes.length > 1 && <section className={homeStyles.marketplaceRailSwitch} aria-label={sft("Valitse suodatettava ilmoitustyyppi")}>
                        <div className={homeStyles.marketplaceModeTabs} role="tablist" aria-label={sft("Ilmoitustyyppi")} style={{ gridTemplateColumns: `repeat(${storefrontModes.length}, minmax(0, 1fr))` }}>
                          {storefrontModes.map((mode) => <button type="button" role="tab" key={mode} aria-selected={storefrontMode === mode} className={storefrontMode === mode ? homeStyles.marketplaceModeTabActive : ""} onClick={() => selectStorefrontFilterMode(mode)}>{sft(mode === "parts" ? "Varaosat" : mode === "vehicles" ? "Ajoneuvot" : "Ajovarusteet")}</button>)}
                        </div>
                      </section>}
                      <div className="seller-mobile-filter-content">
                        {(storefrontDeliveryOptions.pickup > 0 || storefrontDeliveryOptions.posti > 0) && <label className={`${homeStyles.heroFilterFieldWrap} ${commerceStyles.companyMobileDeliveryField}`}><span className={homeStyles.heroFilterLabel}>{sft("Toimitustapa")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontDelivery} onChange={(event) => setStorefrontDelivery(event.target.value as typeof storefrontDelivery)}><option value="all">{sft("Kaikki toimitustavat")}</option>{storefrontDeliveryOptions.pickup > 0 && <option value="pickup">{sft("Nouto")}</option>}{storefrontDeliveryOptions.posti > 0 && <option value="posti">{sft("Posti")}</option>}</select></label>}
                        {storefrontVehicleTypes.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-vehicle`}><span className={homeStyles.heroFilterLabel}>{sft("Ajoneuvolaji")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontVehicleType} onChange={(event) => { setStorefrontVehicleType(event.target.value); setStorefrontVehicleSubtype(""); setStorefrontBrand(""); setStorefrontModel(""); }}><option value="">{sft("Kaikki ajoneuvot")}</option>{storefrontVehicleTypes.map((vehicleType) => <option key={vehicleType} value={vehicleType}>{translateCategory(locale, vehicleType)}</option>)}</select></label>}
                        {storefrontVehicleSubtypes.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-type`}><span className={homeStyles.heroFilterLabel}>{sft("Tyyppi")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontVehicleSubtype} onChange={(event) => { setStorefrontVehicleSubtype(event.target.value); setStorefrontBrand(""); setStorefrontModel(""); }}><option value="">{sft("Kaikki tyypit")}</option>{storefrontVehicleSubtypes.map((vehicleSubtype) => <option key={vehicleSubtype} value={vehicleSubtype}>{vehicleSubtype}</option>)}</select></label>}
                        {storefrontBrands.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-brand`}><span className={homeStyles.heroFilterLabel}>{sft("Merkki")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontBrand} onChange={(event) => { setStorefrontBrand(event.target.value); setStorefrontModel(""); }}><option value="">{sft("Kaikki merkit")}</option>{storefrontBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label>}
                        {storefrontModels.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-model`}><span className={homeStyles.heroFilterLabel}>{sft("Malli")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontModel} onChange={(event) => setStorefrontModel(event.target.value)}><option value="">{sft("Kaikki mallit")}</option>{storefrontModels.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>}
                        {storefrontTechnicalOptions.years.length > 0 && <div className="seller-home-filter-years"><span>{sft("Vuosimalli")}</span><select value={storefrontYearMin} aria-label={sft("Vuosimallin minimi")} onChange={(event) => setStorefrontYearMin(event.target.value)}><option value="">{sft("Minimi")}</option>{storefrontTechnicalOptions.years.map((year) => <option key={`storefront-mobile-min-${year}`} value={year}>{year}</option>)}</select><select value={storefrontYearMax} aria-label={sft("Vuosimallin maksimi")} onChange={(event) => setStorefrontYearMax(event.target.value)}><option value="">{sft("Maksimi")}</option>{storefrontTechnicalOptions.years.map((year) => <option key={`storefront-mobile-max-${year}`} value={year}>{year}</option>)}</select><div className="seller-home-year-slider" aria-hidden="true"><span className="seller-home-year-slider-rail" /><span className="seller-home-year-slider-active" style={{ left: 0, right: 0 }} /><span className="seller-home-year-slider-thumb" style={{ left: 0 }} /><span className="seller-home-year-slider-thumb" style={{ left: "100%" }} /></div></div>}
                        {storefrontCategories.length > 0 && <><div className="seller-filter-section-title">{sft("Osakategoriointi")}</div><label className={`${homeStyles.heroFilterFieldWrap} seller-filter-category`}><span className={homeStyles.heroFilterLabel}>{sft("Pääkategoria")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontCategory} onChange={(event) => { setStorefrontCategory(event.target.value); setStorefrontSubcategoryParent(""); setStorefrontSubcategory(""); setStorefrontVehicleType(""); setStorefrontVehicleSubtype(""); setStorefrontBrand(""); setStorefrontModel(""); }}><option value="">{sft("Kaikki kategoriat")}</option>{storefrontCategories.map((category) => <option key={category} value={category}>{translateCategory(locale, category)}</option>)}</select></label></>}
                        {storefrontSubcategoryParents.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-subcategory`}><span className={homeStyles.heroFilterLabel}>{sft("Alakategoria")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontSubcategoryParent} onChange={(event) => { setStorefrontSubcategoryParent(event.target.value); setStorefrontSubcategory(""); setStorefrontBrand(""); setStorefrontModel(""); }}><option value="">{sft("Kaikki alakategoriat")}</option>{storefrontSubcategoryParents.map((subcategory) => <option key={subcategory} value={subcategory}>{translateCategory(locale, categoryLeaf(subcategory))}</option>)}</select></label>}
                        {storefrontSubcategories.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-part`}><span className={homeStyles.heroFilterLabel}>{sft("Tarkempi osa")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontSubcategory} onChange={(event) => { setStorefrontSubcategory(event.target.value); setStorefrontBrand(""); setStorefrontModel(""); }}><option value="">{sft("Kaikki tarkemmat osat")}</option>{storefrontSubcategories.map((subcategory) => <option key={subcategory} value={subcategory}>{translateCategory(locale, categoryLeaf(subcategory))}</option>)}</select></label>}
                        {storefrontTechnicalOptions.engineCcs.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-engine-cc`}><span className={homeStyles.heroFilterLabel}>{sft("Moottoritilavuus (cm³)")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontEngineCc} onChange={(event) => setStorefrontEngineCc(event.target.value)}><option value="">{sft("Kaikki koot")}</option>{storefrontTechnicalOptions.engineCcs.map((engineCc) => <option key={engineCc} value={engineCc}>{engineCc}</option>)}</select></label>}
                        <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-sort`}><span className={homeStyles.heroFilterLabel}>{sft("Järjestys")}</span><select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={storefrontSort} onChange={(event) => setStorefrontSort(event.target.value as StorefrontSort)}>{storefrontSortOptions.map((option) => <option key={`storefront-mobile-sort-${option.value}`} value={option.value}>{option.label}</option>)}</select></label>
                      </div>
                      <div className={`seller-home-filter-actions ${commerceStyles.companyMobileFilterActions}`}><button type="button" onClick={() => setStorefrontFilterOpen(false)}>{sft("Näytä")} {visibleStorefrontItems.length} {sft("tuotetta")}</button><button type="button" onClick={() => { resetStorefrontFilters(); setStorefrontSort("newest"); }}>{sft("Tyhjennä suodattimet")}</button></div>
                    </form>
                    </div>
                  </>, document.body)}
                </div>
              </div>
              {commerceMessage && <p className={commerceMessage.includes("lisättiin") ? commerceStyles.success : commerceStyles.warning}>{commerceMessage}</p>}
              {(commerceProductsLoading || (listingsLoading && !listingsLoaded)) ? <div className={commerceStyles.companyProductLoading} role="status" aria-label={sft("Tuotteita ladataan")}><span /><span /><span /></div> : visibleStorefrontItems.length === 0 ? <div className={commerceStyles.companyStoreNoResults}><Search size={30} /><strong>{sft("Tuotteita ei löytynyt")}</strong><p>{sft("Kokeile toista hakusanaa tai poista suodattimia.")}</p><button type="button" onClick={() => { setStorefrontSearch(""); resetStorefrontFilters(); }}>{sft("Näytä kaikki tuotteet")}</button></div> : <div className={commerceStyles.companyProductGrid}>
                {visibleStorefrontItems.map((item, index) => {
                  const listing = item.listing;
                  const product = item.product;
                  const itemHref = product
                    ? `/tuotteet/${product.id}`
                    : listing
                      ? listingPath(listingUrlId(listing))
                      : "#yrityksen-yhteystiedot";

                  if (item.kind === "product" && product) {
                    const isSaved = savedCommerceProductIds.includes(product.id);

                    return (
                      <article className={commerceStyles.companyProductCard} key={item.key}>
                        <div className={commerceStyles.companyProductImageWrap}>
                          <Link className={commerceStyles.companyProductImage} href={itemHref}>
                            {product.image_urls?.[0] ? <img src={product.image_urls[0]} alt={product.name} loading="lazy" /> : listing ? <img src={listingImageSrc(listing, index)} alt={product.name} loading="lazy" /> : <span><ShoppingBag size={44} /></span>}
                          </Link>
                          {activeSaleDiscountPercent(product) > 0 && <span className={commerceStyles.companyProductSaleBadge}>ALE −{activeSaleDiscountPercent(product)} %</span>}
                          <button type="button" className={isSaved ? commerceStyles.companyProductFavoriteActive : commerceStyles.companyProductFavorite} aria-label={isSaved ? "Poista suosikeista" : "Lisää suosikkeihin"} aria-pressed={isSaved} onClick={() => toggleSavedCommerceProduct(product.id)}><Heart size={19} fill={isSaved ? "currentColor" : "none"} /></button>
                        </div>
                        <div className={commerceStyles.companyProductBody}>
                          <div className={commerceStyles.companyProductEyebrow}>
                            <span>{item.category}</span>
                            {product.stock_quantity > 3 && <span>Varastossa</span>}
                          </div>
                          <Link href={itemHref}><h3>{product.name}</h3></Link>
                          {(item.brand || item.model || item.year) && <p className={commerceStyles.companyProductFitment}>{[item.brand, item.model, item.year].filter(Boolean).join(" · ")}</p>}
                          <div className={commerceStyles.companyProductPrice}>{activeSalePrice(product) < product.price_cents && <del>{formatFromEur(product.price_cents / 100)}</del>}<strong>{formatFromEur(activeSalePrice(product) / 100)}</strong>{Number(product.vat_rate) > 0 && <small>Sis. ALV {product.vat_rate}%</small>}</div>
                          <div className={commerceStyles.companyProductActions}>
                            <button type="button" onClick={() => addCommerceProduct(product)}><strong>Lisää ostoskoriin</strong><span><ShoppingCart size={18} /></span></button>
                          </div>
                        </div>
                      </article>
                    );
                  }

                  if (!listing) return null;
                  const isSaved = favorites.includes(listing.id);

                  return (
                    <article className={`${commerceStyles.companyProductCard} ${commerceStyles.companyListingCard}`} key={item.key}>
                      <div className={commerceStyles.companyProductImageWrap}>
                        <Link className={commerceStyles.companyProductImage} href={itemHref}>
                          <span className={commerceStyles.companyListingImageBlur} aria-hidden="true"><OptimizedListingImage src={listingImageSrc(listing, index)} alt="" decorative /></span>
                          <OptimizedListingImage src={listingImageSrc(listing, index)} alt={listing.title} sizes="(max-width: 480px) 100vw, (max-width: 780px) 50vw, (max-width: 1120px) 33vw, 25vw" />
                        </Link>
                        <button type="button" className={isSaved ? commerceStyles.companyProductFavoriteActive : commerceStyles.companyProductFavorite} aria-label={isSaved ? "Poista suosikeista" : "Lisää suosikkeihin"} aria-pressed={isSaved} onClick={(event) => toggleFavorite(event, listing.id)}><Heart size={19} fill={isSaved ? "currentColor" : "none"} /></button>
                      </div>
                      <div className={commerceStyles.companyProductBody}>
                        <Link href={itemHref}><h3>{listing.title}</h3></Link>
                        {(item.brand || item.model || item.year) && <p className={commerceStyles.companyProductFitment}>{[item.brand, item.model, item.year].filter(Boolean).join(" · ")}</p>}
                        <div className={commerceStyles.companyProductPrice}><ListingSalePrice listing={listing} /></div>
                        <div className={commerceStyles.companyListingActions}>
                          <Link href={itemHref}>{sft("Katso ilmoitusta")} <ArrowRight size={18} /></Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>}
            </div>}

            {companyStoreView === "details" && <div className={commerceStyles.companyDetailsView} id="yrityksen-esittely">
              <div className={commerceStyles.companyDetailsLayout}>
              <div className={commerceStyles.companyDetailsPrimary}>
              <header className={commerceStyles.companyDetailsHeader}>
                <div><h2>Yrityksen tiedot</h2><p>Kaikki tärkeät tiedot yrityksestämme.</p></div>
                {currentUserId === resolvedSellerId && <Link className={commerceStyles.companyDetailsEditAction} href="/yritys?tab=appearance#yrityssivun-tekstit"><Cog size={16} /> Muokkaa tietoja</Link>}
              </header>
              <section className={commerceStyles.companyDetailsGrid}>
                <article className={commerceStyles.companyDetailsAboutCard}>
                  <h3>Tietoa yrityksestä</h3>
                  <p>{storefront?.description?.trim() || profile?.bio?.trim() || `${sellerName} on tuotteisiin ja varaosiin erikoistunut suomalainen yritys. Tarjoamme laajan valikoiman laadukkaita tuotteita sekä asiantuntevaa palvelua yksityisille ja yritysasiakkaille.`}</p>
                  <div className={commerceStyles.companyDetailsFacts}>
                    {companyFoundedYear && <span><CalendarDays size={18} /><small>Perustettu</small><strong>{companyFoundedYear}</strong></span>}
                    {(storefront?.business_id || profile?.business_id?.trim()) && <span><Tag size={18} /><small>Y-tunnus</small><strong>{storefront?.business_id || profile?.business_id?.trim()}</strong></span>}
                  </div>
                </article>

                <article className={commerceStyles.companyDetailsContactCard} id="yrityksen-yhteystiedot">
                  <h3>Yhteystiedot</h3>
                  <div>
                    <dl>
                      {companyPublicAddress && <div><dt><MapPin size={16} /> Osoite</dt><dd>{companyPublicAddress}</dd></div>}
                      {companyPublicPhone && <div><dt><MessageCircle size={16} /> Puhelin</dt><dd><a href={`tel:${companyPublicPhone.replace(/[^\d+]/g, "")}`}>{companyPublicPhone}</a></dd></div>}
                      {companyPublicEmail && <div><dt><MessageCircle size={16} /> Sähköposti</dt><dd><a href={`mailto:${companyPublicEmail}`}>{companyPublicEmail}</a></dd></div>}
                    </dl>
                    <dl>
                      <div><dt><Clock3 size={16} /> Asiakaspalvelu</dt><dd>Sopimuksen mukaan</dd></div>
                      {companyWebsite && <div><dt><Globe2 size={16} /> Verkkosivusto</dt><dd><a href={companyWebsite.href} target="_blank" rel="noreferrer">{companyWebsite.label}</a></dd></div>}
                      <div><dt><MessageCircle size={16} /> Vastausaika</dt><dd>Ota yhteyttä yritykseen</dd></div>
                    </dl>
                  </div>
                </article>

                <article className={commerceStyles.companyDetailsCommerceCard}>
                  <h3>Toimitus ja maksaminen</h3>
                  <div>
                    <section>
                      <strong>Toimitustavat</strong>
                      {storefrontDeliveryOptions.posti > 0 && <span><Check size={15} /> Posti</span>}
                      {storefrontDeliveryOptions.pickup > 0 && <span><Check size={15} /> Nouto paikan päältä</span>}
                      {storefrontDeliveryOptions.posti === 0 && storefrontDeliveryOptions.pickup === 0 && <span>Toimitustapa sovitaan tuotekohtaisesti</span>}
                    </section>
                    <section>
                      <strong>Maksutavat</strong>
                      {commerceProductViews.length > 0 && <span><Check size={15} /> Korttimaksu Maskinesin kautta</span>}
                      {inquiryListingCount > 0 && <span><Check size={15} /> Maksutapa sovitaan myyjän kanssa</span>}
                      {commerceProductViews.length === 0 && inquiryListingCount === 0 && <span>Ei maksutapoja ilmoitettu</span>}
                    </section>
                  </div>
                </article>
              </section>
              </div>

              <aside className={commerceStyles.companyDetailsSidebar} aria-label="Yrityksen yhteenveto">
                <article className={commerceStyles.companyDetailsIdentityCard}>
                  <header>
                    <div className={commerceStyles.companyDetailsSidebarLogo}>
                      {showSellerAvatar ? <img src={sellerAvatarUrl} alt={`${sellerName} logo`} onError={() => setAvatarFailed(true)} /> : <strong>{sellerInitial}</strong>}
                    </div>
                    <div><h3>{sellerName}</h3><span><Shield size={14} /> Vahvistettu yritys</span></div>
                  </header>
                  <dl>
                    {(storefront?.city || sellerLocation) && <div><dt><MapPin size={17} /> Sijainti</dt><dd>{storefront?.city || sellerLocation}, {storefront?.country || "FI"}</dd></div>}
                    {companyFoundedYear && <div><dt><CalendarDays size={17} /> Liittynyt Maskinesiin</dt><dd>{companyFoundedYear}</dd></div>}
                    {(storefront?.business_id || profile?.business_id?.trim()) && <div><dt><Tag size={17} /> Y-tunnus</dt><dd>{storefront?.business_id || profile?.business_id?.trim()}</dd></div>}
                    {companyPublicEmail && <div><dt><MessageCircle size={17} /> Sähköposti</dt><dd><a href={`mailto:${companyPublicEmail}`}>{companyPublicEmail}</a></dd></div>}
                    {companyPublicPhone && <div><dt><Clock3 size={17} /> Puhelin</dt><dd><a href={`tel:${companyPublicPhone.replace(/[^\d+]/g, "")}`}>{companyPublicPhone}</a></dd></div>}
                  </dl>
                </article>

                <article className={commerceStyles.companyDetailsTrustCard}>
                  <h3>Maskinesin luottamuslupaus</h3>
                  <span><Shield size={22} /><span><strong>Turvallinen kauppa</strong><small>Kauppasi on suojattu Maskinesin palvelussa.</small></span></span>
                  <span><MessageCircle size={22} /><span><strong>Suomalainen tuki</strong><small>Asiakaspalvelu palvelee sinua suomeksi.</small></span></span>
                  <span><PackageCheck size={22} /><span><strong>14 päivän palautusoikeus</strong><small>Palauta tuote helposti 14 päivän sisällä.</small></span></span>
                </article>
              </aside>
              </div>
            </div>}

            {companyStoreView === "reviews" && <div className={commerceStyles.companyReviewsView} id="yrityksen-arvostelut">
              <div className={commerceStyles.companyReviewLayout}>
                <main className={commerceStyles.companyReviewMain}>
                  <section className={commerceStyles.companyReviewDashboard} aria-label="Arvostelujen yhteenveto">
                    <div className={commerceStyles.companyReviewOverviewScore}>
                      <span>Arvostelut yhteensä</span>
                      <strong>{reviews.length ? averageRating.toFixed(1) : "–"}<small>/ 5</small></strong>
                      <div>{renderAverageRatingStars(averageRating, 25)}</div>
                      <p>{visibleReviewCount} arvostelua</p>
                    </div>
                    <div className={commerceStyles.companyReviewBars} aria-label="Arvosanojen jakauma">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = reviews.filter((review) => Math.round(review.rating) === rating).length;
                        const percent = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
                        return <div key={rating}><span>{rating} <Star size={13} fill="currentColor" /></span><i><b style={{ width: `${percent}%` }} /></i><strong>{count}</strong></div>;
                      })}
                    </div>
                  </section>
                  <div className={commerceStyles.companyReviewFilters}>
                    <label><select aria-label="Järjestä arvostelut" defaultValue="newest"><option value="newest">Uusimmat ensin</option><option value="oldest">Vanhimmat ensin</option><option value="best">Parhaat ensin</option></select><ChevronDown size={14} /></label>
                  </div>
                  <div className={commerceStyles.companyReviewList}>
                    {reviews.length ? reviews.map((review) => <article key={review.id}>
                      <div className={commerceStyles.companyReviewPerson}><span className={commerceStyles.companyReviewAvatar}>{getReviewInitials(review.reviewer_name)}</span><span><strong>{review.reviewer_name}</strong><small><Check size={12} /> Maskines-käyttäjä</small></span></div>
                      <div className={commerceStyles.companyReviewContent}>
                        <header><span className={commerceStyles.companyReviewStars}>{renderReviewStars(review.rating, 16)}</span><strong>{review.rating >= 5 ? "Kaikki toimi loistavasti" : review.rating >= 4 ? "Hyvä kokemus" : review.rating >= 3 ? "Asiallinen kokemus" : "Kokemus kaupasta"}</strong></header>
                        <p>{review.comment}</p>
                      </div>
                      <time>{formatListingDate(review.created_at, locale)}</time>
                    </article>) : <div className={commerceStyles.companyReviewEmptyLarge}><Star size={30} /><strong>Ei vielä arvosteluja</strong><p>Ole ensimmäinen, joka kertoo kokemuksensa tästä myyjästä.</p></div>}
                  </div>
                </main>
                <aside className={commerceStyles.companyReviewSidebar} aria-label="Yrityksen arvostelutiedot">
                  <article className={commerceStyles.companyReviewCompanyCard}>
                    <header><div className={commerceStyles.companyReviewCompanyLogo}>{showSellerAvatar ? <img src={sellerAvatarUrl} alt={`${sellerName} logo`} /> : <strong>{sellerInitial}</strong>}</div><div><h3>{sellerName}</h3><span><Shield size={13} /> Vahvistettu yritys</span></div></header>
                    <dl>
                      {(storefront?.city || sellerLocation) && <div><dt><MapPin size={17} /></dt><dd>{storefront?.city || sellerLocation}, {storefront?.country || "FI"}</dd></div>}
                      {(storefront?.business_id || profile?.business_id?.trim()) && <div><dt><CalendarDays size={17} /></dt><dd>Y-tunnus: {storefront?.business_id || profile?.business_id?.trim()}</dd></div>}
                      {companyPublicEmail && <div><dt><MessageCircle size={17} /></dt><dd>{companyPublicEmail}</dd></div>}
                      {companyPublicPhone && <div><dt><Phone size={17} /></dt><dd>{companyPublicPhone}</dd></div>}
                    </dl>
                    <button type="button" onClick={() => setCompanyStoreView("details")}>Näytä kaikki yrityksen tiedot <ChevronRight size={16} /></button>
                  </article>
                  <article className={commerceStyles.companyReviewTrustCard}>
                    <h3>Arvostelujen luotettavuus</h3>
                    <span><Shield size={23} /><span><strong>Kaikki kirjautuneet käyttäjät voivat arvostella</strong><small>Arvostelun voi jättää ilman aiempaa ostosta.</small></span></span>
                    <span><PackageCheck size={23} /><span><strong>Selkeät yhteiset pelisäännöt</strong><small>Epäasialliset tai harhaanjohtavat arvostelut voidaan poistaa.</small></span></span>
                    <span><UserCheck size={23} /><span><strong>Arvostelut eivät ole nimettömiä</strong><small>Arvostelu näytetään Maskines-käyttäjän nimellä.</small></span></span>
                  </article>
                  <article className={commerceStyles.companyReviewWriteCard}>
                    <h3>Jaa kokemuksesi</h3><p>Autat muita tekemään parempia päätöksiä. Ostoa ei vaadita.</p><button type="button" onClick={openPublicReviewForm}><Star size={19} /> Kirjoita arvostelu</button>{reviewFeedback && <small className={commerceStyles.companyReviewFeedback}>{reviewFeedback}</small>}
                  </article>
                </aside>
              </div>
            </div>}

            {companyStoreView === "delivery" && <div className={commerceStyles.companyDeliveryView} id="yrityksen-toimitus">
              <header className={commerceStyles.companyDetailsHeader}>
                <h2>Toimitus ja nouto</h2>
              </header>
              {companyPromoEnabled && <div className={commerceStyles.companyDeliveryBenefit}>
                <Truck size={24} />
                <span>
                  {companyPromoTitle && <strong>{companyPromoTitle}</strong>}
                  {companyPromoSubtitle && <small>{companyPromoSubtitle}</small>}
                </span>
              </div>}
              <section className={commerceStyles.companyDeliveryCards}>
                <article><span><MapPin size={29} /></span><div><h3>Posti – noutopiste</h3><strong>{storefront?.default_shipping_price_fi_cents == null ? "4,90 €" : formatFromEur(storefront.default_shipping_price_fi_cents / 100)}</strong><dl><div><dt><Clock3 size={13} /> Arvioitu toimitusaika:</dt><dd>2–4 arkipäivää</dd></div><div><dt><Check size={13} /> Seuranta:</dt><dd>Sisältyy</dd></div></dl><p><b>Toimitusehdot:</b> Toimitus yli {companyFreeShippingThreshold} tilauksiin ilmainen.</p></div></article>
                <article><span><Building2 size={29} /></span><div><h3>Posti – kotiinkuljetus</h3><strong>9,90 €</strong><dl><div><dt><Clock3 size={13} /> Arvioitu toimitusaika:</dt><dd>2–4 arkipäivää</dd></div><div><dt><Check size={13} /> Seuranta:</dt><dd>Sisältyy</dd></div></dl><p><b>Toimitusehdot:</b> Toimitus yli {companyFreeShippingThreshold} tilauksiin ilmainen.</p></div></article>
                <article><span><Store size={29} /></span><div><h3>Nouto myymälästä</h3><strong>0,00 €</strong><dl><div><dt><Clock3 size={13} /> Arvioitu noutoaika:</dt><dd>1–2 arkipäivää</dd></div><div><dt><Check size={13} /> Seuranta:</dt><dd>Saat ilmoituksen</dd></div></dl><p><b>Toimitusehdot:</b> Tilauksen nouto mahdollinen, kun saat ilmoituksen.</p></div></article>
              </section>
              <section className={commerceStyles.companyDeliveryProcess} aria-label="Toimitusprosessi">
                <h3>Toimitusprosessi</h3>
                <div>
                  <span><b>1</b><PackageCheck size={24} /><strong>Tilaus vastaanotettu</strong><small>Vahvistamme tilauksen ja aloitamme käsittelyn.</small></span>
                  <span><b>2</b><ShoppingBag size={24} /><strong>Pakkaus</strong><small>Tuotteet kerätään ja pakataan huolellisesti.</small></span>
                  <span><b>3</b><Truck size={24} /><strong>Kuljetuksessa</strong><small>Lähetys siirtyy kuljetukseen ja on matkalla perille.</small></span>
                  <span><b>4</b><Building2 size={24} /><strong>Perillä</strong><small>Tilauksesi on saapunut perille.</small></span>
                </div>
              </section>
              <section className={commerceStyles.companyDeliveryInfoGrid}>
                <article><h3><Globe2 size={17} /> Toimitusalueet</h3><span><small>🇫🇮 Suomi</small><small>🇸🇪 Ruotsi</small></span><p>Toimitamme tällä hetkellä Suomeen ja Ruotsiin.</p></article>
                <article><h3><Store size={17} /> Nouto myymälästä</h3><strong>{sellerName}</strong><p>{companyPublicAddress || storefront?.city || sellerLocation}</p><dl><div><dt>Ma–Pe</dt><dd>9.00–16.00</dd></div><div><dt>La</dt><dd>Suljettu</dd></div></dl></article>
                <article><h3><RotateCcw size={17} /> Palautukset</h3><strong>14 päivän palautusoikeus</strong><p>Sinulla on 14 päivän palautusoikeus tuotteen vastaanottamisesta. Tuotteen tulee olla käyttämätön ja alkuperäispakkauksessa.</p><button type="button">Näytä palautusohjeet <ChevronRight size={14} /></button></article>
              </section>
              <section className={commerceStyles.companyDeliveryFaq}>
                <h3>Usein kysytyt kysymykset</h3>
                <button type="button"><span>Kuinka kauan toimitus kestää?</span><ChevronRight size={16} /></button>
                <button type="button"><span>Mistä näen seurannan?</span><ChevronRight size={16} /></button>
                <button type="button"><span>Voinko muuttaa toimitusosoitetta?</span><ChevronRight size={16} /></button>
              </section>
            </div>}
            </div>

            </div>
          </section>
          );
        })()}

        {!isVerifiedCompany && <>
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
                        data-seller-sort-button="true"
                        aria-haspopup="menu"
                        aria-expanded={sortOpen}
                        onClick={() => setSortOpen((open) => !open)}
                      >
                        <ArrowDownWideNarrow size={17} aria-hidden="true" />
                        <span>{activeSort.label}</span>
                        <ChevronDown size={15} className="sp-sort-chevron" aria-hidden="true" />
                      </button>
                      {sortOpen && (
                        <div className="sp-sort-menu" data-seller-sort-menu="true" role="menu">
                          {sortOptions.map((option) => {
                            const Icon = option.icon;
                            const selected = option.value === appliedSellerFilters.listingSort;
                            return (
                              <button
                                type="button"
                                className={`sp-sort-option${selected ? " selected" : ""}`}
                                data-seller-sort-option="true"
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
                    className={`seller-home-filter-backdrop ${premiumStyles.profileMobileFilterOnly}`}
                    data-mobile-filter-backdrop="true"
                    aria-label={sft("Sulje kategoriointi")}
                    onClick={() => setSellerFilterPanelOpen(false)}
                  />
                )}
                {sellerFilterPanelOpen && createPortal(<>
                  <button type="button" className={`${homeStyles.desktopFilterBackdrop} ${premiumStyles.profileDesktopFilterOnly}`} aria-label={sft("Sulje kategoriointi")} onClick={() => setSellerFilterPanelOpen(false)} />
                  <aside className={`${homeStyles.desktopFilterModal} ${homeStyles.resultsFilterModal} ${premiumStyles.profileDesktopFilterOnly}`}>
                    {renderSellerDesktopFilter()}
                  </aside>
                </>, document.body)}
                <form
                  id="seller-home-filter-bar"
                  ref={sellerFilterSheetRef}
                  className={`seller-home-filter-bar ${premiumStyles.profileMobileFilterOnly}${sellerFilterPanelOpen ? " is-open" : ""}${sellerFilterSheetExpanded ? " is-expanded" : ""}${sellerFilterSheetDragging ? " is-dragging" : ""}`}
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
                    aria-label={sft("Muuta suodatuspaneelin korkeutta")}
                    aria-expanded={sellerFilterSheetExpanded}
                    onPointerDown={startSellerFilterSheetDrag}
                    onKeyDown={handleSellerFilterSheetKeyDown}
                  >
                    <span />
                  </div>
                  <header className="seller-home-filter-head">
                    <strong>
                      <span className="seller-filter-title-desktop">{sft("Suodattimet")}</span>
                      <span className="seller-filter-title-mobile">{sft("Suodata hakua")}</span>
                    </strong>
                    <div>
                      <button type="button" className="seller-filter-head-reset" onClick={resetListingFilters}>{sft("Nollaa suodatukset")}</button>
                      <button type="button" className="seller-filter-head-close" aria-label={sft("Sulje kategoriointi")} onClick={() => setSellerFilterPanelOpen(false)}>
                        <X size={23} strokeWidth={2.6} aria-hidden="true" />
                      </button>
                    </div>
                  </header>

                  <section
                    className={homeStyles.marketplaceRailSwitch}
                    aria-label={sft("Valitse suodatettava ilmoitustyyppi")}
                  >
                    <div
                      className={homeStyles.marketplaceModeTabs}
                      role="tablist"
                      aria-label={sft("Ilmoitustyyppi")}
                      style={{ gridTemplateColumns: `repeat(${Math.max(1, sellerAvailableListingModes.length)}, minmax(0, 1fr))` }}
                    >
                      {sellerAvailableListingModes.map((mode) => (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={sellerListingMode === mode}
                          className={sellerListingMode === mode ? homeStyles.marketplaceModeTabActive : ""}
                          onClick={() => selectSellerListingMode(mode)}
                          key={mode}
                        >
                          {sft(mode === "parts" ? "Varaosat" : mode === "vehicles" ? "Ajoneuvot" : "Ajovarusteet")}
                        </button>
                      ))}
                    </div>
                  </section>

                  <div className="seller-mobile-filter-content">

                  {sellerFilterOptions.vehicleTypes.length > 0 && (
                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-vehicle`}>
                    <span className={homeStyles.heroFilterLabel}>{sft("Ajoneuvolaji")}</span>
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
                      <option value="">{sft("Kaikki ajoneuvot")}</option>
                      {sellerFilterOptions.vehicleTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  )}

                  {sellerFilterOptions.vehicleSubtypes.length > 0 && (
                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-type`}>
                    <span className={homeStyles.heroFilterLabel}>{sft("Tyyppi")}</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={vehicleSubtypeFilter} onChange={(event) => setVehicleSubtypeFilter(event.target.value)}>
                      <option value="">{sft("Kaikki tyypit")}</option>
                      {sellerFilterOptions.vehicleSubtypes.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  )}

                  {sellerFilterOptions.brands.length > 0 && (
                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-brand`}>
                    <span className={homeStyles.heroFilterLabel}>{sft("Merkki")}</span>
                    <select
                      className={`${homeStyles.heroFilterSelect} seller-home-filter-select`}
                      value={brandFilter}
                      onChange={(event) => { setBrandFilter(event.target.value); setModelFilter(""); }}
                    >
                      <option value="">{sft("Kaikki merkit")}</option>
                      {sellerFilterOptions.brands.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  )}

                  {sellerFilterOptions.models.length > 0 && (
                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-model`}>
                    <span className={homeStyles.heroFilterLabel}>{sft("Malli")}</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}>
                      <option value="">{sft("Kaikki mallit")}</option>
                      {sellerFilterOptions.models.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  )}

                  {sellerListingMode !== "vehicles" && sellerFilterOptions.categories.length > 0 && (
                  <>
                  <div className="seller-filter-section-title">{sft("Osakategoriointi")}</div>

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-category`}>
                    <span className={homeStyles.heroFilterLabel}>{sft("Pääkategoria")}</span>
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
                      <option value="">{sft("Kaikki kategoriat")}</option>
                      {sellerFilterOptions.categories.map((option) => <option key={option} value={option}>{translateCategory(locale, option)}</option>)}
                    </select>
                  </label>

                  {sellerFilterOptions.subcategoryParents.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-subcategory`}>
                    <span className={homeStyles.heroFilterLabel}>{sft("Alakategoria")}</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={subcategoryParentFilter} onChange={(event) => {
                      setSubcategoryParentFilter(event.target.value);
                      setSubcategoryFilter("");
                      setTrackMatLengthFilter("");
                      setTrackMatWidthFilter("");
                      setTrackMatPitchFilter("");
                    }}>
                      <option value="">{sft("Kaikki alakategoriat")}</option>
                      {sellerFilterOptions.subcategoryParents.map((option) => <option key={option} value={option}>{translateCategory(locale, categoryLeaf(option))}</option>)}
                    </select>
                  </label>}

                  {sellerFilterOptions.subcategories.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-part`}>
                    <span className={homeStyles.heroFilterLabel}>{sft("Tarkempi osa")}</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={subcategoryFilter} onChange={(event) => {
                      const nextValue = event.target.value;
                      setSubcategoryFilter(nextValue);
                      if (!isSellerTrackMatSelection(nextValue)) {
                        setTrackMatLengthFilter("");
                        setTrackMatWidthFilter("");
                        setTrackMatPitchFilter("");
                      }
                    }}>
                      <option value="">{sft("Kaikki tarkemmat osat")}</option>
                      {sellerFilterOptions.subcategories.map((option) => <option key={option} value={option}>{translateCategory(locale, categoryLeaf(option))}</option>)}
                    </select>
                  </label>}

                  {sellerListingMode === "parts" && trackMatDimensionsVisible && (
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
                  </>
                  )}

                  {sellerFilterOptions.engineCcs.length > 0 && <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-engine-cc`}>
                    <span className={homeStyles.heroFilterLabel}>{sft("Moottoritilavuus (cm³)")}</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={engineCcFilter} onChange={(event) => setEngineCcFilter(event.target.value)}>
                      <option value="">{sft("Kaikki koot")}</option>
                      {sellerFilterOptions.engineCcs.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>}

                  {sellerFilterOptions.years.length > 0 && <div className="seller-home-filter-years">
                    <span>{sft("Vuosimalli")}</span>
                    <select value={yearMinFilter} onChange={(event) => setYearMinFilter(event.target.value)}>
                      <option value="">{sft("Minimi")}</option>
                      {sellerFilterOptions.years.map((option) => <option key={`min-${option}`} value={option}>{option}</option>)}
                    </select>
                    <select value={yearMaxFilter} onChange={(event) => setYearMaxFilter(event.target.value)}>
                      <option value="">{sft("Maksimi")}</option>
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
                  </div>}

                  {sellerListingMode === "parts" && sellerFilterOptions.engineModels.length > 0 ? (
                    <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-engine-model`}>
                      <span className={homeStyles.heroFilterLabel}>{sft("Moottori")}</span>
                      <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={engineModelFilter} onChange={(event) => setEngineModelFilter(event.target.value)}>
                        <option value="">{sft("Kaikki moottorit")}</option>
                        {sellerFilterOptions.engineModels.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  ) : null}

                  {sellerListingMode === "vehicles" && (
                    <section className={`${homeStyles.vehicleUsageFilters} seller-vehicle-extra-filters`} aria-label={sft("Ajoneuvon lisätiedot")}>
                      <label className={homeStyles.vehicleUsageField}>
                        <span>{sft("Moottorin tyyppi")}</span>
                        <span className={`${homeStyles.vehicleUsageSelectShell} seller-vehicle-select-shell`}>
                          <select value={vehicleEngineKindFilter} onChange={(event) => setVehicleEngineKindFilter(event.target.value)}>
                            <option value="">{sft("Ei väliä")}</option>
                            {SELLER_VEHICLE_ENGINE_KIND_OPTIONS.map((option) => <option key={option} value={option}>{sft(option)}</option>)}
                          </select>
                          <ChevronDown size={14} aria-hidden="true" />
                        </span>
                      </label>

                      <label className={homeStyles.vehicleUsageField}>
                        <span>{sft("Vetotapa")}</span>
                        <span className={`${homeStyles.vehicleUsageSelectShell} seller-vehicle-select-shell`}>
                          <select value={vehicleDriveTypeFilter} onChange={(event) => setVehicleDriveTypeFilter(event.target.value)}>
                            <option value="">{sft("Ei väliä")}</option>
                            {SELLER_VEHICLE_DRIVE_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{sft(option)}</option>)}
                          </select>
                          <ChevronDown size={14} aria-hidden="true" />
                        </span>
                      </label>

                      <label className={homeStyles.vehicleUsageField}>
                        <span>{sft("Tieliikennekelpoisuus")}</span>
                        <span className={`${homeStyles.vehicleUsageSelectShell} seller-vehicle-select-shell`}>
                          <select value={vehicleRoadLegalFilter} onChange={(event) => setVehicleRoadLegalFilter(event.target.value)}>
                            <option value="">{sft("Ei väliä")}</option>
                            {SELLER_VEHICLE_ROAD_LEGAL_OPTIONS.map((option) => <option key={option} value={option}>{sft(option)}</option>)}
                          </select>
                          <ChevronDown size={14} aria-hidden="true" />
                        </span>
                      </label>
                      <span className={homeStyles.vehicleUsageSectionLabel}>{sft("Ajomäärä ja rekisteri")}</span>
                      <label className={homeStyles.vehicleUsageField}>
                        <span>{sft("Ajokilometrit (km)")}</span>
                        <div className={homeStyles.vehicleUsageRange}>
                          <input type="text" inputMode="numeric" value={vehicleMileageMinFilter} placeholder={sft("Minimi")} aria-label={sft("Ajokilometrien minimi")} onChange={(event) => setVehicleMileageMinFilter(event.target.value.replace(/\D/g, ""))} />
                          <i aria-hidden="true">–</i>
                          <input type="text" inputMode="numeric" value={vehicleMileageMaxFilter} placeholder={sft("Maksimi")} aria-label={sft("Ajokilometrien maksimi")} onChange={(event) => setVehicleMileageMaxFilter(event.target.value.replace(/\D/g, ""))} />
                        </div>
                        {renderSellerNumericRangeSlider({ label: "Ajokilometrit", minValue: vehicleMileageMinFilter, maxValue: vehicleMileageMaxFilter, maximum: SELLER_VEHICLE_MILEAGE_FILTER_MAX, step: 1000, onMinChange: setVehicleMileageMinFilter, onMaxChange: setVehicleMileageMaxFilter })}
                      </label>
                      <label className={homeStyles.vehicleUsageField}>
                        <span>{sft("Käyttötunnit (h)")}</span>
                        <div className={homeStyles.vehicleUsageRange}>
                          <input type="text" inputMode="numeric" value={vehicleHoursMinFilter} placeholder={sft("Minimi")} aria-label={sft("Käyttötuntien minimi")} onChange={(event) => setVehicleHoursMinFilter(event.target.value.replace(/\D/g, ""))} />
                          <i aria-hidden="true">–</i>
                          <input type="text" inputMode="numeric" value={vehicleHoursMaxFilter} placeholder={sft("Maksimi")} aria-label={sft("Käyttötuntien maksimi")} onChange={(event) => setVehicleHoursMaxFilter(event.target.value.replace(/\D/g, ""))} />
                        </div>
                        {renderSellerNumericRangeSlider({ label: "Käyttötunnit", minValue: vehicleHoursMinFilter, maxValue: vehicleHoursMaxFilter, maximum: SELLER_VEHICLE_HOURS_FILTER_MAX, step: 50, onMinChange: setVehicleHoursMinFilter, onMaxChange: setVehicleHoursMaxFilter })}
                      </label>
                      <label className={homeStyles.vehicleUsageField}>
                        <span>{sft("Rekisteritunnus")}</span>
                        <input className={homeStyles.vehicleRegistrationInput} type="text" autoCapitalize="characters" value={vehicleRegistrationFilter} placeholder={sft("Esim. 123-ABC")} onChange={(event) => setVehicleRegistrationFilter(event.target.value.toUpperCase())} />
                      </label>
                      <span className={homeStyles.vehicleUsageSectionLabel}>{sft("Hinta")}</span>
                      <label className={homeStyles.vehicleUsageField}>
                        <span>{sft("Hintaväli (€)")}</span>
                        <div className={homeStyles.vehicleUsageRange}>
                          <input type="text" inputMode="numeric" value={vehiclePriceMinFilter} placeholder={sft("Minimi")} aria-label={sft("Hinnan minimi")} onChange={(event) => setVehiclePriceMinFilter(event.target.value.replace(/\D/g, ""))} />
                          <i aria-hidden="true">–</i>
                          <input type="text" inputMode="numeric" value={vehiclePriceMaxFilter} placeholder={sft("Maksimi")} aria-label={sft("Hinnan maksimi")} onChange={(event) => setVehiclePriceMaxFilter(event.target.value.replace(/\D/g, ""))} />
                        </div>
                        {renderSellerNumericRangeSlider({ label: "Hintaväli", minValue: vehiclePriceMinFilter, maxValue: vehiclePriceMaxFilter, maximum: SELLER_VEHICLE_PRICE_FILTER_MAX, step: 500, onMinChange: setVehiclePriceMinFilter, onMaxChange: setVehiclePriceMaxFilter })}
                      </label>
                      <button type="button" className={homeStyles.vehicleAccessoryFilterButton} onClick={() => setVehicleAccessoriesOpen(true)} aria-haspopup="dialog">
                        <span><Cog size={17} aria-hidden="true" /><strong>{sft("Lisävarusteet")}</strong></span>
                        <span>{vehicleAccessoriesFilter.length > 0 ? `${vehicleAccessoriesFilter.length} ${sft("valittu")}` : sft("Kaikki lisävarusteet")}<ChevronRight size={17} aria-hidden="true" /></span>
                      </button>
                      <button type="button" className={homeStyles.vehicleAccessoryFilterButton} onClick={() => setVehicleColorsOpen(true)} aria-haspopup="dialog">
                        <span><Palette size={17} aria-hidden="true" /><strong>{sft("Väri")}</strong></span>
                        <span>{vehicleColorsFilter.length > 0 ? `${vehicleColorsFilter.length} ${sft("valittu")}` : sft("Kaikki värit")}<ChevronRight size={17} aria-hidden="true" /></span>
                      </button>
                    </section>
                  )}

                  {vehicleAccessoriesOpen ? createPortal(
                    <div className={homeStyles.vehicleAccessoryOverlay} role="presentation" onMouseDown={() => setVehicleAccessoriesOpen(false)}>
                      <section className={homeStyles.vehicleAccessoryDialog} role="dialog" aria-modal="true" aria-labelledby="seller-filter-accessories-title" onMouseDown={(event) => event.stopPropagation()}>
                        <header className={homeStyles.vehicleAccessoryDialogHeader}>
                          <div><h2 id="seller-filter-accessories-title">{sft("Lisävarusteet")}</h2><p>{sft("Valitse kaikki ilmoituksesta löytyvät lisävarusteet.")}</p></div>
                          <button type="button" onClick={() => setVehicleAccessoriesOpen(false)} aria-label={sft("Sulje lisävarusteet")}><X size={22} aria-hidden="true" /></button>
                        </header>
                        <div className={homeStyles.vehicleAccessoryGrid}>
                          {VEHICLE_ACCESSORY_OPTIONS.map((accessory) => {
                            const selected = vehicleAccessoriesFilter.includes(accessory);
                            return (
                              <label key={accessory} className={selected ? homeStyles.vehicleAccessoryOptionSelected : ""}>
                                <input type="checkbox" checked={selected} onChange={() => setVehicleAccessoriesFilter((current) => current.includes(accessory) ? current.filter((item) => item !== accessory) : [...current, accessory])} />
                                <span className={homeStyles.vehicleAccessoryCheck} aria-hidden="true">{selected ? <Check size={15} /> : null}</span>
                                <span>{translateVehicleAccessory(locale, accessory)}</span>
                              </label>
                            );
                          })}
                        </div>
                        <footer className={homeStyles.vehicleAccessoryDialogFooter}>
                          <button type="button" onClick={() => setVehicleAccessoriesFilter([])}>{sft("Tyhjennä valinnat")}</button>
                          <button type="button" className={homeStyles.vehicleAccessoryDone} onClick={() => setVehicleAccessoriesOpen(false)}>{sft("Valmis")} ({vehicleAccessoriesFilter.length})</button>
                        </footer>
                      </section>
                    </div>,
                    document.body
                  ) : null}

                  {vehicleColorsOpen ? createPortal(
                    <div className={homeStyles.vehicleAccessoryOverlay} role="presentation" onMouseDown={() => setVehicleColorsOpen(false)}>
                      <section className={homeStyles.vehicleAccessoryDialog} role="dialog" aria-modal="true" aria-labelledby="seller-filter-colors-title" onMouseDown={(event) => event.stopPropagation()}>
                        <header className={homeStyles.vehicleAccessoryDialogHeader}>
                          <div><h2 id="seller-filter-colors-title">{sft("Väri")}</h2><p>{sft("Valitse yksi tai useampi ajoneuvon väri.")}</p></div>
                          <button type="button" onClick={() => setVehicleColorsOpen(false)} aria-label={sft("Sulje värivalinta")}><X size={22} aria-hidden="true" /></button>
                        </header>
                        <div className={`${homeStyles.vehicleAccessoryGrid} ${homeStyles.vehicleColorGrid}`}>
                          {VEHICLE_COLOR_OPTIONS.map((color) => {
                            const selected = vehicleColorsFilter.includes(color.label);
                            return (
                              <label key={color.label} className={selected ? homeStyles.vehicleAccessoryOptionSelected : ""}>
                                <input type="checkbox" checked={selected} onChange={() => setVehicleColorsFilter((current) => current.includes(color.label) ? current.filter((item) => item !== color.label) : [...current, color.label])} />
                                <span className={homeStyles.vehicleAccessoryCheck} aria-hidden="true">{selected ? <Check size={15} /> : null}</span>
                                <span>{translateVehicleColor(locale, color.label)}</span>
                                <span className={homeStyles.vehicleColorSwatch} style={{ background: color.swatch }} aria-hidden="true">{color.label === "Muu" ? "?" : null}</span>
                              </label>
                            );
                          })}
                        </div>
                        <footer className={homeStyles.vehicleAccessoryDialogFooter}>
                          <button type="button" onClick={() => setVehicleColorsFilter([])}>{sft("Tyhjennä valinnat")}</button>
                          <button type="button" className={homeStyles.vehicleAccessoryDone} onClick={() => setVehicleColorsOpen(false)}>{sft("Valmis")} ({vehicleColorsFilter.length})</button>
                        </footer>
                      </section>
                    </div>,
                    document.body
                  ) : null}

                  <label className={`${homeStyles.heroFilterFieldWrap} seller-filter-sort`}>
                    <span className={homeStyles.heroFilterLabel}>{sft("Järjestys")}</span>
                    <select className={`${homeStyles.heroFilterSelect} seller-home-filter-select`} value={listingSort} onChange={(event) => setListingSort(event.target.value as ListingSort)}>
                      {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>

                  </div>

                  <div className="seller-home-filter-actions">
                    <button type="button" onClick={applySellerFilters}>
                      {sft("Näytä tulokset")} ({draftFilteredListingCount})
                    </button>
                    <button type="button" onClick={resetListingFilters}>{sft("Tyhjennä hakuehdot")}</button>
                  </div>
                </form>
                {filteredListings.length === 0 ? (
                  <div className="sp-empty seller-filtered-empty">
                    <div className="sp-empty-icon">
                      <Search size={48} />
                    </div>
                    <h3>{refLabels.noFilterResults}</h3>
                    <p>{sft("Muokkaa suodatusta tai nollaa suodatukset.")}</p>
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
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('[data-listing-favorite="true"]')) return;
                      router.push(listingPath(listingUrlId(listing), locale));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(listingPath(listingUrlId(listing), locale));
                      }
                    }}
                  >
                    <div className={`${homeStyles.cardImage} ${homeStyles.listingCardImage}`} data-listing-card-image="true">
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
                        data-listing-favorite="true"
                        data-listing-id={listing.id}
                        aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                        aria-pressed={isFavorite}
                        onClick={(event) => toggleFavorite(event, listing.id)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                      >
                        <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                      </button>}
                    </div>
                    <div className={homeStyles.cardBody} data-listing-card-body="true">
                      <ListingSalePrice listing={listing} className={homeStyles.cardPrice} />
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

        </>}

        {reviewComposerOpen && createPortal(
          <div className={premiumStyles.reviewComposerBackdrop} role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reviewSubmitPending) setReviewComposerOpen(false);
          }}>
            <form className={premiumStyles.reviewComposer} onSubmit={submitPublicReview}>
              <header>
                <div>
                  <span>Arvostele myyjä</span>
                  <h2>{sellerName}</h2>
                </div>
                <button type="button" aria-label="Sulje arvostelulomake" disabled={reviewSubmitPending} onClick={() => setReviewComposerOpen(false)}><X size={22} /></button>
              </header>
              <fieldset>
                <legend>Arvosana</legend>
                <div className={premiumStyles.reviewComposerStars}>
                  {[1, 2, 3, 4, 5].map((rating) => <button type="button" key={rating} aria-label={`${rating} tähteä`} aria-pressed={reviewDraftRating === rating} onClick={() => setReviewDraftRating(rating)}><Star size={28} fill={rating <= reviewDraftRating ? "currentColor" : "none"} /></button>)}
                </div>
              </fieldset>
              <label>
                <span>Kerro kokemuksesi</span>
                <textarea value={reviewDraftComment} minLength={2} maxLength={800} required placeholder="Millainen kokemus sinulla oli tästä myyjästä?" onChange={(event) => setReviewDraftComment(event.target.value)} />
                <small>{reviewDraftComment.length}/800</small>
              </label>
              {reviewFeedback && <p className={premiumStyles.reviewComposerError}>{reviewFeedback}</p>}
              <footer>
                <button type="button" disabled={reviewSubmitPending} onClick={() => setReviewComposerOpen(false)}>Peruuta</button>
                <button type="submit" disabled={reviewSubmitPending || reviewDraftComment.trim().length < 2}>{reviewSubmitPending ? "Tallennetaan…" : "Julkaise arvostelu"}</button>
              </footer>
            </form>
          </div>,
          document.body
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
                <button type="button" className="seller-review-modal-write" onClick={openPublicReviewForm}><Star size={16} /> Kirjoita arvostelu</button>
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
          background: var(--site-bg, #c8d0d7);
          background-image: none;
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
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          outline: 0;
          padding: 0;
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
          display: grid;
          grid-template-rows: 220px 1fr;
          height: 410px;
          min-height: 410px;
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
          display: block;
          background: #06111f;
          overflow: hidden;
          border-bottom: 1px solid rgba(255, 122, 26, 0.28);
          height: 220px;
          max-height: 220px;
          min-height: 220px;
          position: relative;
          width: 100%;
        }

        .seller-listing-image img {
          width: 100%;
          height: 100%;
          max-height: 220px;
          object-fit: cover;
          display: block;
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
            border-radius: 12px;
            grid-template-rows: 118px 1fr;
            height: 276px;
            min-height: 276px;
          }

          .seller-listing-image,
          .seller-listing-image img {
            height: 118px;
            max-height: 118px;
            min-height: 118px;
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

        /* Unified own/public profile surface: no gray divider stripes or hover recoloring. */
        .seller-page :is(
          .seller-ref-hero,
          .seller-ref-copy,
          .seller-ref-pill-row,
          .seller-ref-phone-pill,
          .seller-ref-about,
          .seller-ref-about-highlight,
          .seller-ref-stats,
          .seller-ref-stat,
          .seller-ref-detail-card,
          .seller-ref-detail-row
        ) {
          border-color: transparent !important;
          transition: none !important;
        }

        .seller-page :is(
          .seller-ref-copy,
          .seller-ref-pill-row,
          .seller-ref-about,
          .seller-ref-about-highlight,
          .seller-ref-stats,
          .seller-ref-stat,
          .seller-ref-detail-card,
          .seller-ref-detail-row
        )::before,
        .seller-page :is(
          .seller-ref-copy,
          .seller-ref-pill-row,
          .seller-ref-about,
          .seller-ref-about-highlight,
          .seller-ref-stats,
          .seller-ref-stat,
          .seller-ref-detail-card,
          .seller-ref-detail-row
        )::after {
          display: none !important;
          content: none !important;
        }

        .seller-page .seller-ref-copy,
        .seller-page .seller-ref-pill-row,
        .seller-page .seller-ref-detail-row,
        .seller-page .seller-ref-stat,
        .seller-page .seller-ref-stat + .seller-ref-stat {
          border: 0 !important;
          border-top: 0 !important;
          border-right: 0 !important;
          border-bottom: 0 !important;
          border-left: 0 !important;
          box-shadow: none !important;
        }

        .seller-page .seller-ref-stats {
          gap: 0 !important;
          padding: 0 !important;
          border: 1px solid #31536b !important;
          border-radius: 14px !important;
          box-shadow: none !important;
        }

        .seller-page :is(
          .seller-profile-listings-panel,
          .seller-tab-loading,
          .seller-tab-loading-placeholder,
          .sp-empty,
          .seller-review-dashboard,
          .seller-ref-about,
          .sp-tabs
        ) {
          border: 0 !important;
          box-shadow: none !important;
          transition: none !important;
        }

        .seller-page :is(
          .seller-profile-listings-panel,
          .seller-tab-loading,
          .seller-tab-loading-placeholder,
          .sp-empty,
          .seller-review-dashboard,
          .seller-ref-about,
          .sp-tabs
        )::before,
        .seller-page :is(
          .seller-profile-listings-panel,
          .seller-tab-loading,
          .seller-tab-loading-placeholder,
          .sp-empty,
          .seller-review-dashboard,
          .seller-ref-about,
          .sp-tabs
        )::after {
          content: none !important;
          display: none !important;
        }

        .seller-page .seller-ref-stat {
          border-radius: 0 !important;
          background: transparent !important;
        }

        .seller-page :is(.seller-ref-stat, .seller-ref-phone-pill, .seller-ref-link-pill):hover,
        .seller-page :is(.seller-ref-stat, .seller-ref-phone-pill, .seller-ref-link-pill):focus-visible,
        .seller-page :is(.seller-ref-stat, .seller-ref-phone-pill, .seller-ref-link-pill):active {
          background: transparent !important;
          border-color: transparent !important;
          box-shadow: none !important;
          color: inherit !important;
          filter: none !important;
          outline: none !important;
          transform: none !important;
        }

        .seller-page .seller-ref-stats > .seller-ref-stat + .seller-ref-stat {
          border-left: 1px solid #31536b !important;
        }

        .seller-page .seller-ref-stat > :is(svg, strong, span),
        .seller-page .seller-ref-phone-pill > * {
          transition: none !important;
        }
      `}</style>
    </main>
  );
}
