"use client";
import UiText from "@/app/components/UiText";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/app/components/LocalizedLink";
import OptimizedListingImage from "@/app/components/OptimizedListingImage";
import ListingVehicleMeta from "@/app/components/ListingVehicleMeta";
import ListingSalePrice from "@/app/components/ListingSalePrice";
import { translateCategory, useLanguage } from "@/lib/i18n";
import { listingPath, listingUrlId } from "@/lib/routes";
import { sanitizePhoneInput } from "@/lib/phone-input";
import { prepareImageFileTo1080p } from "@/app/components/chat/image-processing";

import {
  Calendar,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  ImageIcon,
  ImagePlus,
  LayoutGrid,
  List as ListIcon,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Phone,
  PackagePlus,
  Search,
  Tag,
  TrendingUp,
  Trash2,
  X
} from "lucide-react";

import type { User } from "@supabase/supabase-js";

import {
  createPurchaseReviewRequest,
  deleteListing,
  findReviewBuyerByPhone,
  getListingById,
  getListingBuyerCandidates,
  getListingsBySeller,
  getMyListingMessageCounts,
  getSoldListingsBySeller,
  recordSoldListing,
  setListingHidden,
  supabase,
  updateListing,
  type ListingBuyerCandidate,
  type ListingMessageCount,
  type ReviewBuyerLookup
} from "@/lib/supabase";
import { removeCachedListing, updateCachedListing } from "@/lib/client-listings-cache";
import { removeCachedResource } from "@/lib/client-resource-cache";

import styles from "./my-listings.module.css";

import {
  conditions,
  formatPrice,
  isVehicleListing,
  type Listing,
  type SoldListing
} from "@/lib/listings";
import type { Company, Product } from "@/lib/commerce/types";
import { canPublishProduct, commerceStatusMessage } from "@/lib/commerce/validation";
import { VAT_RATE_OPTIONS, ZERO_VAT_RATE } from "@/lib/commerce/vat";
import { buildVehicleCategoriesFromTaxonomy, categoriesAsRecord } from "@/lib/taxonomy";
import { useTaxonomy } from "@/app/components/TaxonomyProvider";
import {
  BRAND_MODELS,
  COMMON_BRAND_MODELS_BY_VEHICLE,
  getBrandModelOptions,
  getCategoryVehicleKey,
  getCommonVehicleKey
} from "@/app/components/CategoryDrawer";

const RIDING_GEAR_CATEGORIES = [
  "Kypärät", "Ajotakit", "Ajohousut", "Ajopuvut", "Ajosaappaat", "Ajohanskat",
  "Suojavarusteet", "Sade- ja lämpövarusteet", "Muut ajovarusteet"
];
const RIDING_GEAR_BRANDS = [
  "Acerbis", "Alpinestars", "Arai", "Bell", "Fox Racing", "FXR", "Halvarssons",
  "HJC", "Klim", "Leatt", "O'Neal", "Rukka", "Scott", "Shoei", "Thor"
];
const RIDING_GEAR_SIZES = [
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL",
  "116", "128", "140", "152", "164",
  "32", "34", "36", "38", "40", "42", "44", "46", "48",
  "50", "52", "54", "56", "58", "60", "62", "64"
];
const RIDING_GEAR_TARGETS = ["Aikuisten", "Lasten", "Naisten", "Miesten", "Unisex"];

function isRidingGearListing(listing: Pick<Listing, "category">) {
  return listing.category?.trim().toLocaleLowerCase("fi-FI") === "ajovarusteet";
}

function splitLocation(value: string | null | undefined) {
  const parts = (value || "").split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(", "),
      country: parts.at(-1) || "Suomi"
    };
  }

  return {
    city: value || "",
    country: "Suomi"
  };
}

function buildLocation(city: string, country: string) {
  return [city.trim(), country.trim()].filter(Boolean).join(", ");
}

type EditableCommerceSettings = {
  enabled: boolean;
  stockQuantity: string;
  vatRate: string;
  storefrontCategory: string;
  pickupAvailable: boolean;
  shippingAvailable: boolean;
  shippingPriceFi: string;
  shippingPriceSe: string;
  shippingPriceNo: string;
  weightGrams: string;
  packageLengthCm: string;
  packageWidthCm: string;
  packageHeightCm: string;
  maxShippingQuantity: string;
  shippingNotes: string;
};

const defaultEditableCommerceSettings: EditableCommerceSettings = {
  enabled: false,
  stockQuantity: "1",
  vatRate: String(ZERO_VAT_RATE),
  storefrontCategory: "",
  pickupAvailable: true,
  shippingAvailable: false,
  shippingPriceFi: "0",
  shippingPriceSe: "0",
  shippingPriceNo: "0",
  weightGrams: "",
  packageLengthCm: "",
  packageWidthCm: "",
  packageHeightCm: "",
  maxShippingQuantity: "1",
  shippingNotes: ""
};

function decimalInputNumber(value: string) {
  return Number(value.trim().replace(",", "."));
}

function centsInput(value: string) {
  const number = decimalInputNumber(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function optionalDecimalInput(value: string) {
  if (!value.trim()) return null;
  const number = decimalInputNumber(value);
  return Number.isFinite(number) ? number : null;
}

function visibleShippingNotes(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\[\[maskines:no_shipping_cents=\d+\]\]/g, "")
    .trim();
}

function listingCommerceProductId(listing: Listing) {
  const id = listing.translations?._meta?.commerce_product_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function findListingCommerceProduct(listing: Listing, products: Product[]) {
  const linkedId = listingCommerceProductId(listing);
  if (linkedId) {
    const linked = products.find((product) => product.id === linkedId);
    if (linked) return linked;
  }

  // Repair older edits where the commerce reference was accidentally cleared.
  // Require both the exact title and a shared image so two genuinely separate
  // listings with the same name are not merged.
  const listingImages = new Set(getEditableListingImages(listing));
  const candidates = products.filter((product) =>
    product.name.trim() === listing.title.trim() &&
    product.image_urls.some((image) => listingImages.has(image))
  );
  const listingTime = new Date(listing.created_at).getTime();
  return candidates.sort((left, right) =>
    Math.abs(new Date(left.created_at).getTime() - listingTime) -
    Math.abs(new Date(right.created_at).getTime() - listingTime)
  )[0] ?? null;
}

function EditablePresetInput({
  value,
  options,
  placeholder,
  ariaLabel,
  required = false,
  invalid = false,
  onChange
}: {
  value: string;
  options: string[];
  placeholder: string;
  ariaLabel: string;
  required?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="own-listing-preset-input"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid}
        required={required}
        autoComplete="off"
      />
      <button
        type="button"
        className="own-listing-preset-toggle"
        aria-label={`Avaa ${ariaLabel.toLowerCase()}vaihtoehdot`}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && options.length > 0 ? (
        <div className="own-listing-preset-menu" role="listbox" aria-label={`${ariaLabel}vaihtoehdot`}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              className={option === value ? "is-selected" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
              {option === value ? <Check size={15} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getEditableListingImages(
  listing: Pick<Listing, "image_url" | "image_urls">
) {
  const extraImages =
    Array.isArray(listing.image_urls)
      ? listing.image_urls
      : typeof (listing.image_urls as unknown) === "string"
      ? [listing.image_urls as unknown as string]
      : [];

  return Array.from(
    new Set(
      [
        listing.image_url,
        ...extraImages
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    )
  );
}

function getListingMainImage(
  listing: Pick<Listing, "image_url" | "image_urls">
) {
  return getEditableListingImages(listing)[0] ?? fallbackListingImage;
}

const LISTING_DESCRIPTION_METADATA_LABELS = new Set(
  [
    "Ajoneuvo",
    "Ajoneuvotyyppi",
    "Merkki",
    "Malli",
    "Vuosimalli",
    "Toimitustapa",
    "Ajokilometrit",
    "Käyttötunnit",
    "Rekisteritunnus",
    "Moottorin tyyppi",
    "Moottoritilavuus",
    "Moottorin malli",
    "Vetotapa",
    "Tieliikennekelpoisuus",
    "Lisävarusteet",
    "Ajoneuvon väri",
    "Kategoria",
    "Alakategoria",
    "Kunto",
    "Osan tarkka malli",
    "Varaosanumero"
  ].map((label) => label.toLocaleLowerCase("fi-FI"))
);

function isDescriptionMetadataLine(line: string) {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex < 0) return false;

  const label = line
    .slice(0, separatorIndex)
    .trim()
    .toLocaleLowerCase("fi-FI");

  return LISTING_DESCRIPTION_METADATA_LABELS.has(label);
}

function getUserWrittenDescription(description: string) {
  return (description || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !isDescriptionMetadataLine(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mergeListingDescriptionMetadata(
  originalDescription: string,
  userDescription: string
) {
  const metadata = (originalDescription || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => isDescriptionMetadataLine(line.trim()))
    .map((line) => line.trim());

  return [metadata.join("\n"), userDescription.trim()]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeVehicleToken(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getVehicleGroupKey(
  item: Pick<Listing | SoldListing, "brand" | "model" | "year" | "vehicle_type">
) {
  const key = [
    normalizeVehicleToken(item.vehicle_type),
    normalizeVehicleToken(item.brand),
    normalizeVehicleToken(item.model),
    normalizeVehicleToken(item.year)
  ].join("|");

  return key.replace(/\|/g, "") ? key : "";
}

function getListingPublicationGroupId(listing: Pick<Listing, "translations">) {
  const groupId = listing.translations?._meta?.publication_group_id;
  return typeof groupId === "string" ? groupId.trim() : "";
}

function isMultiListing(listing: Pick<Listing, "listing_mode" | "translations">) {
  return (
    listing.listing_mode === "multiple" ||
    listing.translations?._meta?.listing_mode === "multiple" ||
    Boolean(getListingPublicationGroupId(listing))
  );
}

function getVehicleGroupTitle(
  item: Pick<Listing | SoldListing, "title" | "brand" | "model" | "year" | "vehicle_type">
) {
  const makeModel = [item.brand, item.model]
    .filter((value) => value && !/^\d{4}$/.test(String(value).trim()))
    .join(" ")
    .trim();
  const vehicleTitle = [makeModel, item.year].filter(Boolean).join(" ").trim();
  if (makeModel) return vehicleTitle;

  const titleCandidate = (item.title || "")
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);

  if (titleCandidate && !/^\d{4}$/.test(titleCandidate)) {
    return titleCandidate;
  }

  return item.vehicle_type || "Multi-ilmoitus";
}

function isWithinHours(value: string | null | undefined, hours: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= hours * 60 * 60 * 1000;
}

function getErrorMessage(error: unknown) {

  if (!error) return "Tuntematon virhe.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Toiminto epäonnistui.";

}

const fallbackListingImage =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3";

const myListingsCachePrefix = "arcticparts:my-listings:";
const removedCompletedGroupsPrefix = "arcticparts:removed-completed-groups:";
const legacyDismissedGroupsPrefix = "arcticparts:dismissed-completed-groups:";
const myListingsStatsHistoryPrefix = "arcticparts:my-listings-stats:";
type StatsRange = "1d" | "7d" | "30d" | "all";
type StatsSnapshot = {
  listings: number;
  newListings: number;
  soldValue: number;
  soldCount: number;
  views: number;
  messages: number;
  unread: number;
  conversations: number;
};
type StatsHistory = Partial<Record<StatsRange, StatsSnapshot>>;

const emptyStatsSnapshot: StatsSnapshot = {
  listings: 0,
  newListings: 0,
  soldValue: 0,
  soldCount: 0,
  views: 0,
  messages: 0,
  unread: 0,
  conversations: 0
};

function myListingsCacheKey(userId: string) {
  return `${myListingsCachePrefix}${userId}`;
}

function compatiblePartListingHref(
  listing: Pick<Listing, "id" | "vehicle_type" | "vehicle_subtype" | "brand" | "model" | "year" | "engine_cc" | "engine_model" | "translations">
) {
  const params = new URLSearchParams({
    addCompatiblePart: "1",
    lockVehicle: "1",
    sourceListing: listing.id
  });
  const publicationGroupId = getListingPublicationGroupId(listing);
  if (publicationGroupId) params.set("publicationGroup", publicationGroupId);

  const vehicleDetails = {
    vehicleType: listing.vehicle_type,
    vehicleSubtype: listing.vehicle_subtype,
    make: listing.brand,
    model: listing.model,
    year: listing.year,
    engineCc: listing.engine_cc,
    engineType: listing.engine_model
  };

  for (const [key, value] of Object.entries(vehicleDetails)) {
    if (typeof value === "string" && value.trim()) params.set(key, value.trim());
  }

  return `/sell?${params.toString()}`;
}

function removedCompletedGroupsKey(userId: string) {
  return `${removedCompletedGroupsPrefix}${userId}`;
}

function myListingsStatsHistoryKey(userId: string) {
  return `${myListingsStatsHistoryPrefix}${userId}`;
}

function readCachedMyListings(userId: string) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(myListingsCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Listing[];
  } catch {
    return [];
  }
}

function writeCachedMyListings(userId: string, nextListings: Listing[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      myListingsCacheKey(userId),
      JSON.stringify(nextListings.slice(0, 80))
    );
  } catch {
    // Cache is only a speed boost, so storage failures can be ignored.
  }
}

function readRemovedCompletedGroupKeys(userId: string) {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw =
      window.localStorage.getItem(removedCompletedGroupsKey(userId)) ??
      window.localStorage.getItem(`${legacyDismissedGroupsPrefix}${userId}`);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function writeRemovedCompletedGroupKeys(userId: string, keys: Set<string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      removedCompletedGroupsKey(userId),
      JSON.stringify(Array.from(keys))
    );
  } catch {
    // Removing the summary must never affect persisted sales data.
  }
}

function normalizeStatsSnapshot(value: unknown): StatsSnapshot {
  if (!value || typeof value !== "object") return emptyStatsSnapshot;
  const record = value as Partial<Record<keyof StatsSnapshot, unknown>>;
  return {
    listings: Number(record.listings) || 0,
    newListings: Number(record.newListings) || 0,
    soldValue: Number(record.soldValue) || 0,
    soldCount: Number(record.soldCount) || 0,
    views: Number(record.views) || 0,
    messages: Number(record.messages) || 0,
    unread: Number(record.unread) || 0,
    conversations: Number(record.conversations) || 0
  };
}

function mergeStatsSnapshots(current: StatsSnapshot, previous?: StatsSnapshot): StatsSnapshot {
  const old = previous ?? emptyStatsSnapshot;
  return {
    // These are current, non-cumulative values. Keeping their historical
    // maximum made deleted/expired listings remain visible in the summary.
    listings: current.listings,
    newListings: current.newListings,
    soldValue: Math.max(current.soldValue, old.soldValue),
    soldCount: Math.max(current.soldCount, old.soldCount),
    views: Math.max(current.views, old.views),
    messages: Math.max(current.messages, old.messages),
    unread: Math.max(current.unread, old.unread),
    conversations: Math.max(current.conversations, old.conversations)
  };
}

function readMyListingsStatsHistory(userId: string): StatsHistory {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(myListingsStatsHistoryKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      (["1d", "7d", "30d", "all"] as const).map((range) => [
        range,
        normalizeStatsSnapshot((parsed as StatsHistory)[range])
      ])
    ) as StatsHistory;
  } catch {
    return {};
  }
}

function writeMyListingsStatsHistory(userId: string, history: StatsHistory) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(myListingsStatsHistoryKey(userId), JSON.stringify(history));
  } catch {
    // Stats are also derived from persisted sales where possible.
  }
}

export default function MyListingsPage() {
  const { locale, t } = useLanguage();
  const taxonomy = useTaxonomy();
  const allCategories = useMemo(() => categoriesAsRecord(taxonomy), [taxonomy]);
  const categoriesByVehicle = useMemo(() => {
    const out: Record<string, Record<string, string[]>> = {};
    for (const vehicle of taxonomy.vehicles) {
      out[vehicle.key] = buildVehicleCategoriesFromTaxonomy(taxonomy, vehicle.key);
    }
    return out;
  }, [taxonomy]);
  const pageText = {
    management: {
      fi: "Ilmoitusten hallinta",
      en: "Listing management",
      sv: "Annonshantering",
      no: "Annonseadministrasjon",
    }[locale],
    managementHelp: {
      fi: "Muokkaa, avaa tai poista omia myynti-ilmoituksiasi.",
      en: "Edit, open or delete your own sales listings.",
      sv: "Redigera, öppna eller ta bort dina egna försäljningsannonser.",
      no: "Rediger, åpne eller slett dine egne salgsannonser.",
    }[locale],
    loginToView: {
      fi: "Kirjaudu sisään nähdäksesi omat ilmoituksesi.",
      en: "Log in to view your listings.",
      sv: "Logga in för att se dina annonser.",
      no: "Logg inn for å se annonsene dine.",
    }[locale],
    noListings: {
      fi: "Sinulla ei ole vielä ilmoituksia.",
      en: "You do not have any listings yet.",
      sv: "Du har inga annonser ännu.",
      no: "Du har ingen annonser ennå.",
    }[locale],
    noSubcategory: {
      fi: "Ei alakategoriaa",
      en: "No subcategory",
      sv: "Ingen underkategori",
      no: "Ingen underkategori",
    }[locale],
    imageUrl: {
      fi: "Kuvan osoite",
      en: "Image URL",
      sv: "Bildadress",
      no: "Bildeadresse",
    }[locale],
    save: { fi: "Tallenna", en: "Save", sv: "Spara",
      no: "Lagre",
    }[locale],
    cancel: { fi: "Peruuta", en: "Cancel", sv: "Avbryt",
      no: "Avbryt",
    }[locale],
    edit: { fi: "Muokkaa", en: "Edit", sv: "Redigera",
      no: "Rediger",
    }[locale],
    delete: { fi: "Poista", en: "Delete", sv: "Ta bort",
      no: "Slett",
    }[locale],
    views: { fi: "katselua", en: "views", sv: "visningar",
      no: "visninger",
    }[locale],
    tabs: {
      fi: { all: "Kaikki", active: "Aktiiviset", hidden: "Piilotetut", sold: "Myydyt" },
      en: { all: "All", active: "Active", hidden: "Hidden", sold: "Sold" },
      sv: { all: "Alla", active: "Aktiva", hidden: "Dolda", sold: "Sålda" },
      no: { all: "Alle", active: "Aktive", hidden: "Skjulte", sold: "Solgte" },
    }[locale],
    group: {
      fi: { edit: "Muokkaa ilmoituksia", ready: "Valmis multi-ilmoitus", listed: "myynnissä", sold: "myyty", messages: "viestiä", estimate: "Arvio yhteensä", received: "Saatu jo", sellMore: "Myy lisää", open: "Avaa osat", close: "Sulje osat", allSold: "Kaikki myyty", remove: "Poista koonti" },
      en: { edit: "Manage listings", ready: "Completed multi-listing", listed: "for sale", sold: "sold", messages: "messages", estimate: "Estimated total", received: "Received", sellMore: "Sell more", open: "Open parts", close: "Close parts", allSold: "All sold", remove: "Remove group" },
      sv: { edit: "Hantera annonser", ready: "Färdig multiannons", listed: "till salu", sold: "sålda", messages: "meddelanden", estimate: "Uppskattat totalt", received: "Redan erhållet", sellMore: "Sälj mer", open: "Visa delar", close: "Dölj delar", allSold: "Allt sålt", remove: "Ta bort grupp" },
      no: { edit: "Administrer annonser", ready: "Fullført flerproduktsalg", listed: "til salgs", sold: "solgt", messages: "meldinger", estimate: "Estimert totalt", received: "Mottatt", sellMore: "Selg mer", open: "Vis deler", close: "Skjul deler", allSold: "Alt solgt", remove: "Fjern gruppe" },
    }[locale],
    saving: {
      fi: "Tallennetaan ilmoitusta...",
      en: "Saving listing...",
      sv: "Sparar annons...",
      no: "Lagrer annonse...",
    }[locale],
    updated: {
      fi: "Ilmoitus päivitetty.",
      en: "Listing updated.",
      sv: "Annonsen har uppdaterats.",
      no: "Annonsen er oppdatert.",
    }[locale],
    confirmDelete: {
      fi: "Poistetaanko ilmoitus pysyvästi?",
      en: "Delete this listing permanently?",
      sv: "Ta bort annonsen permanent?",
      no: "Slette annonsen permanent?",
    }[locale],
    deleting: {
      fi: "Poistetaan ilmoitusta...",
      en: "Deleting listing...",
      sv: "Tar bort annons...",
      no: "Sletter annonse...",
    }[locale],
    deleted: {
      fi: "Ilmoitus poistettu.",
      en: "Listing deleted.",
      sv: "Annonsen har tagits bort.",
      no: "Annonsen er slettet.",
    }[locale]
  };

  const [user, setUser] =
    useState<User | null>(null);

  const [listings, setListings] =
    useState<Listing[]>([]);

  const [soldListings, setSoldListings] =
    useState<SoldListing[]>([]);
  const [removedCompletedGroupKeys, setRemovedCompletedGroupKeys] = useState<Set<string>>(() => new Set());
  const [statsHistory, setStatsHistory] = useState<StatsHistory>({});

  const [listingsCacheReady, setListingsCacheReady] =
    useState(false);

  const [status, setStatus] =
    useState("");

  const [editValidationErrors, setEditValidationErrors] =
    useState<Record<string, string>>({});

  const [editingListingId, setEditingListingId] =
    useState<string | null>(null);

  const [listingForm, setListingForm] =
    useState({
      title: "",
      price: "",
      category: "",
      subcategory: "",
      brand: "",
      model: "",
      riding_gear_target: "",
      year: "",
      part_model: "",
      part_number: "",
      location: "",
      location_country: "Suomi",
      location_city: "",
      condition: "Hyvä",
      description: "",
      image_url: "",
      image_urls: [] as string[]
    });

  const [commerceEditSettings, setCommerceEditSettings] =
    useState<EditableCommerceSettings>({ ...defaultEditableCommerceSettings });
  const [commerceEditCompany, setCommerceEditCompany] =
    useState<Company | null>(null);
  const [commerceEditProduct, setCommerceEditProduct] =
    useState<Product | null>(null);
  const [commerceEditEligible, setCommerceEditEligible] =
    useState(false);
  const [commerceEditPaymentReady, setCommerceEditPaymentReady] =
    useState(false);
  const [commerceEditLoading, setCommerceEditLoading] =
    useState(false);
  const commerceEditShippingCountries = commerceEditCompany?.shipping_countries?.length
    ? commerceEditCompany.shipping_countries
    : ["FI"];

  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] =
    useState<Listing | null>(null);

  const [deleteReason, setDeleteReason] =
    useState<"sold" | "other">("other");

  const [buyerCandidates, setBuyerCandidates] =
    useState<ListingBuyerCandidate[]>([]);

  const [selectedConversationId, setSelectedConversationId] =
    useState("");

  const [buyerSelectionMode, setBuyerSelectionMode] =
    useState<"conversation" | "phone" | "other">("conversation");

  const [buyerPhone, setBuyerPhone] =
    useState("");

  const [phoneBuyer, setPhoneBuyer] =
    useState<ReviewBuyerLookup | null>(null);

  const [phoneLookupLoading, setPhoneLookupLoading] =
    useState(false);

  const [phoneLookupStatus, setPhoneLookupStatus] =
    useState("");

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  const [buyerCandidateError, setBuyerCandidateError] =
    useState("");

  const [deleteSubmitting, setDeleteSubmitting] =
    useState(false);

  const [soldPrice, setSoldPrice] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<"all" | "active" | "hidden" | "sold">("all");

  const [sortOrder, setSortOrder] =
    useState<"newest" | "oldest" | "price-desc" | "price-asc" | "views">("newest");

  const [viewMode, setViewMode] =
    useState<"list" | "grid">("list");

  const [expandedGroupKeys, setExpandedGroupKeys] =
    useState<Record<string, boolean>>({});

  const [statsRange, setStatsRange] =
    useState<"1d" | "7d" | "30d" | "all">("7d");

  const [messageCounts, setMessageCounts] =
    useState<Record<string, ListingMessageCount>>({});
  const openedGroupFirstListingIdRef =
    useRef<string | null>(null);
  const listingEditRequestIdRef =
    useRef(0);
  const listingFormDirtyRef =
    useRef(false);
  const commerceEditDirtyRef =
    useRef(false);
  const savingListingRef =
    useRef(false);

  useEffect(() => {

    if (!supabase) return;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        setUser(null);
      });

  }, []);

  useEffect(() => {

    if (!user) {
      setRemovedCompletedGroupKeys(new Set());
      setStatsHistory({});
      return;
    }

    let cancelled = false;
    setRemovedCompletedGroupKeys(readRemovedCompletedGroupKeys(user.id));
    setStatsHistory(readMyListingsStatsHistory(user.id));
    const cachedListings = readCachedMyListings(user.id);

    if (cachedListings.length > 0) {
      setListings(cachedListings.filter((l) => !l.is_sold));
      setListingsCacheReady(true);
    } else {
      setListingsCacheReady(false);
    }

    getListingsBySeller(user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setListingsCacheReady(true);
          return;
        }
        const activeListings = (data ?? []).filter((l) => !l.is_sold);
        setListings(activeListings);
        setListingsCacheReady(true);
        writeCachedMyListings(user.id, activeListings);
      })
      .catch(() => {
        if (cancelled) return;
        setListingsCacheReady(true);
      });

    getMyListingMessageCounts()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return;
        const map: Record<string, ListingMessageCount> = {};
        (data ?? []).forEach((row) => {
          map[row.listing_id] = row;
        });
        setMessageCounts(map);
      })
      .catch(() => undefined);

    getSoldListingsBySeller(user.id)
      .then(({ data }) => {
        if (cancelled) return;
        setSoldListings(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setSoldListings([]);
      });

    return () => {
      cancelled = true;
    };

  }, [user]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const refreshLiveCounts = async () => {
      const [listingResult, messageResult, soldResult] = await Promise.all([
        getListingsBySeller(user.id),
        getMyListingMessageCounts(),
        getSoldListingsBySeller(user.id)
      ]);

      if (cancelled) return;

      if (!listingResult.error) {
        const activeListings = (listingResult.data ?? []).filter((listing) => !listing.is_sold);
        setListings(activeListings);
        setListingsCacheReady(true);
        writeCachedMyListings(user.id, activeListings);
      }

      if (!messageResult.error) {
        const nextMessageCounts: Record<string, ListingMessageCount> = {};
        (messageResult.data ?? []).forEach((row) => {
          nextMessageCounts[row.listing_id] = row;
        });
        setMessageCounts(nextMessageCounts);
      }

      if (!soldResult.error) {
        setSoldListings(soldResult.data ?? []);
      }
    };

    const intervalId = window.setInterval(refreshLiveCounts, 10_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshLiveCounts();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !listingsCacheReady) return;
    writeCachedMyListings(user.id, listings);
  }, [listings, listingsCacheReady, user]);

  useEffect(() => {
    if (!status) return;
    const timeoutId = window.setTimeout(() => setStatus(""), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [status]);

  useEffect(() => {
    if (!deleteTarget) return;

    const scrollY = window.scrollY;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [deleteTarget]);

  async function toggleListingHidden(listing: Listing) {
    const next = !listing.is_hidden;
    setListings((prev) =>
      prev.map((l) =>
        l.id === listing.id ? { ...l, is_hidden: next } : l
      )
    );
    updateCachedListing({ ...listing, is_hidden: next });
    const { error } = await setListingHidden(listing.id, next);
    if (error) {
      setStatus("Näkyvyyden vaihto epäonnistui.");
      updateCachedListing({ ...listing, is_hidden: !next });
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id ? { ...l, is_hidden: !next } : l
        )
      );
      return;
    }
    setStatus("");
  }

  async function loadListingCommerceSettings(listing: Listing, editRequestId: number) {
    setCommerceEditLoading(true);
    setCommerceEditEligible(false);
    setCommerceEditPaymentReady(false);
    setCommerceEditCompany(null);
    setCommerceEditProduct(null);
    setCommerceEditSettings({ ...defaultEditableCommerceSettings });

    try {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;

      const requestInit = {
        cache: "no-store" as const,
        headers: { Authorization: `Bearer ${accessToken}` }
      };
      const [companyResponse, productsResponse] = await Promise.all([
        fetch("/api/commerce/company", requestInit),
        fetch("/api/commerce/products", requestInit)
      ]);
      const companyBody = await companyResponse.json().catch(() => ({})) as { company?: Company };
      const productsBody = await productsResponse.json().catch(() => ({})) as { products?: Product[] };

      if (listingEditRequestIdRef.current !== editRequestId) return;

      const company = companyResponse.ok ? companyBody.company ?? null : null;
      const products = productsResponse.ok && Array.isArray(productsBody.products)
        ? productsBody.products
        : [];
      const eligible = company?.verification_status === "approved";
      const paymentReady = canPublishProduct(company);
      const product = findListingCommerceProduct(listing, products);

      setCommerceEditCompany(company);
      setCommerceEditEligible(eligible);
      setCommerceEditPaymentReady(paymentReady);
      setCommerceEditProduct(product);

      if (!commerceEditDirtyRef.current) {
        setCommerceEditSettings({
          enabled: Boolean(product?.active),
          stockQuantity: product ? String(product.stock_quantity) : "1",
          vatRate: String(product?.vat_rate ?? company?.default_vat_rate ?? ZERO_VAT_RATE).replace(".", ","),
          storefrontCategory: product?.storefront_category ?? "",
          pickupAvailable: product ? product.pickup_available : true,
          shippingAvailable: product ? product.shipping_available : false,
          shippingPriceFi: product?.shipping_price_fi_cents == null
            ? company?.default_shipping_price_fi_cents == null
              ? "0"
              : String(company.default_shipping_price_fi_cents / 100).replace(".", ",")
            : String(product.shipping_price_fi_cents / 100).replace(".", ","),
          shippingPriceSe: product?.shipping_price_se_cents == null
            ? company?.default_shipping_price_se_cents == null
              ? "0"
              : String(company.default_shipping_price_se_cents / 100).replace(".", ",")
            : String(product.shipping_price_se_cents / 100).replace(".", ","),
          shippingPriceNo: product?.shipping_price_no_cents == null
            ? company?.default_shipping_price_no_cents == null
              ? "0"
              : String(company.default_shipping_price_no_cents / 100).replace(".", ",")
            : String(product.shipping_price_no_cents / 100).replace(".", ","),
          weightGrams: product?.weight_grams == null ? "" : String(product.weight_grams),
          packageLengthCm: product?.package_length_cm == null ? "" : String(product.package_length_cm).replace(".", ","),
          packageWidthCm: product?.package_width_cm == null ? "" : String(product.package_width_cm).replace(".", ","),
          packageHeightCm: product?.package_height_cm == null ? "" : String(product.package_height_cm).replace(".", ","),
          maxShippingQuantity: String(product?.max_shipping_quantity ?? 1),
          shippingNotes: visibleShippingNotes(product?.shipping_notes)
        });
      }
    } catch {
      if (listingEditRequestIdRef.current === editRequestId) {
        setCommerceEditEligible(false);
        setCommerceEditPaymentReady(false);
        setCommerceEditCompany(null);
        setCommerceEditProduct(null);
      }
    } finally {
      if (listingEditRequestIdRef.current === editRequestId) {
        setCommerceEditLoading(false);
      }
    }
  }

  function startEditingListing(listing: Listing) {

    const editRequestId = listingEditRequestIdRef.current + 1;
    listingEditRequestIdRef.current = editRequestId;
    listingFormDirtyRef.current = false;
    commerceEditDirtyRef.current = false;
    setEditingListingId(listing.id);
    setEditValidationErrors({});
    setStatus("");

    const listingImages = getEditableListingImages(listing);
    const locationParts = splitLocation(listing.location);

    setListingForm({
      title: listing.title,
      price: String(listing.price),
      category: listing.category ?? "",
      subcategory: listing.subcategory ?? "",
      brand: listing.brand ?? "",
      model: listing.model ?? "",
      riding_gear_target: listing.translations?._meta?.riding_gear_target ?? "",
      year: listing.year ?? "",
      part_model: listing.part_model ?? "",
      part_number: listing.part_number ?? "",
      location: listing.location,
      location_country: locationParts.country,
      location_city: locationParts.city,
      condition: listing.condition,
      description: getUserWrittenDescription(listing.description),
      image_url: listingImages[0] ?? "",
      image_urls: listingImages
    });

    void loadListingCommerceSettings(listing, editRequestId);

    void getListingById(listing.id)
      .then(({ data }) => {
        if (
          !data ||
          listingEditRequestIdRef.current !== editRequestId
        ) return;

        const freshImages = getEditableListingImages(data);
        const freshLocationParts = splitLocation(data.location);

        setListings((prev) =>
          prev.map((item) => item.id === data.id ? data : item)
        );

        // Do not let a slow refresh replace values the seller has already
        // changed while the edit form is open.
        if (!listingFormDirtyRef.current) {
          setListingForm({
            title: data.title,
            price: String(data.price),
            category: data.category ?? "",
            subcategory: data.subcategory ?? "",
            brand: data.brand ?? "",
            model: data.model ?? "",
            riding_gear_target: data.translations?._meta?.riding_gear_target ?? "",
            year: data.year ?? "",
            part_model: data.part_model ?? "",
            part_number: data.part_number ?? "",
            location: data.location,
            location_country: freshLocationParts.country,
            location_city: freshLocationParts.city,
            condition: data.condition,
            description: getUserWrittenDescription(data.description),
            image_url: freshImages[0] ?? "",
            image_urls: freshImages
          });
        }
      })
      .catch(() => {
        // The cached listing is still usable if the fresh fetch fails.
      });

  }

  async function handleListingImageUpload(files: FileList | null | undefined) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;

    const allowedImageTypes =
      new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/heic",
        "image/heif"
      ]);
    const allowedImageExtension =
      /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i;

    const invalidFile =
      selectedFiles.find((file) =>
        file.type.startsWith("video/") ||
        (file.type ? !allowedImageTypes.has(file.type) : !allowedImageExtension.test(file.name))
      );

    if (invalidFile) {
      setStatus("Videoita ei voi julkaista myynti-ilmoitukseen. Valitse kuvatiedosto.");
      return;
    }

    if (!supabase || !user || !editingListingId) {
      setStatus("Kuvan lisääminen epäonnistui. Kirjaudu uudelleen sisään.");
      return;
    }

    listingFormDirtyRef.current = true;
    setStatus("Kuvat muunnetaan 1080p-kokoon ja ladataan...");

    try {
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        const uploadFile = await prepareImageFileTo1080p(file);
        const extension = uploadFile.type === "image/jpeg" ? "jpg" : "webp";
        const path = `${user.id}/${editingListingId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(path, uploadFile, {
            cacheControl: "31536000",
            contentType: uploadFile.type,
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("listing-images")
          .getPublicUrl(path);
        if (data.publicUrl) uploadedUrls.push(data.publicUrl);
      }

      if (uploadedUrls.length > 0) {
        setListingForm((prev) => {
          const nextImages = Array.from(
            new Set([
              ...prev.image_urls,
              ...uploadedUrls
            ])
          );

          return {
            ...prev,
            image_url: prev.image_url || nextImages[0] || "",
            image_urls: nextImages
          };
        });
      }
      setStatus("");
    } catch (error) {
      setStatus(`Kuvan lisääminen epäonnistui: ${getErrorMessage(error)}`);
    }
  }

  function removeListingImage(index: number) {
    listingFormDirtyRef.current = true;
    setEditValidationErrors({});
    setListingForm((prev) => {
      const nextImages =
        prev.image_urls.filter((_, i) => i !== index);

      return {
        ...prev,
        image_url: nextImages[0] ?? "",
        image_urls: nextImages
      };
    });
  }

  function stopEditingListing() {

    listingEditRequestIdRef.current += 1;
    listingFormDirtyRef.current = false;
    commerceEditDirtyRef.current = false;
    setEditingListingId(null);
    setEditValidationErrors({});
    setCommerceEditEligible(false);
    setCommerceEditPaymentReady(false);
    setCommerceEditCompany(null);
    setCommerceEditProduct(null);
    setCommerceEditSettings({ ...defaultEditableCommerceSettings });
    setStatus("");

  }

  function hasMinimumListingPrice(value: string | number | null | undefined) {
    return Number(value) >= 1;
  }

  function normalizeListingPriceInput(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const numeric = Number(digits);
    if (Number.isFinite(numeric) && numeric < 1) return "1";
    return digits;
  }

  function normalizeListingPriceForSave(value: string | number | null | undefined) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 1 ? numeric : 1;
  }

  async function saveListing() {

    if (!editingListingId || savingListingRef.current) return;

    if (commerceEditLoading) {
      setStatus("Odota hetki, myyntitapaa tarkistetaan.");
      return;
    }

    const currentListing =
      listings.find(
        (listing) =>
          listing.id === editingListingId
      );

    if (!currentListing) return;

    const editingVehicleListing = isVehicleListing(currentListing);
    const editingRidingGearListing = isRidingGearListing(currentListing);
    const nextImages = Array.from(
      new Set(
        [
          ...listingForm.image_urls,
          listingForm.image_url
        ]
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
    const validationErrors: Record<string, string> = {};
    const numericYear = Number(listingForm.year);
    const maximumYear = new Date().getFullYear() + 2;

    if (listingForm.title.trim().length < 3) {
      validationErrors.title = "Otsikossa pitää olla vähintään 3 merkkiä.";
    }
    if (editingVehicleListing && !listingForm.brand.trim()) {
      validationErrors.brand = "Merkki puuttuu.";
    }
    if (editingVehicleListing && !listingForm.model.trim()) {
      validationErrors.model = "Malli puuttuu.";
    }
    if (editingRidingGearListing && !listingForm.subcategory.trim()) {
      validationErrors.subcategory = "Ajovarusteen tyyppi puuttuu.";
    }
    if (editingRidingGearListing && !listingForm.brand.trim()) {
      validationErrors.brand = "Merkki puuttuu.";
    }
    if (editingRidingGearListing && !listingForm.model.trim()) {
      validationErrors.model = "Koko puuttuu.";
    }
    if (editingRidingGearListing && !listingForm.riding_gear_target.trim()) {
      validationErrors.ridingGearTarget = "Kohderyhmä puuttuu.";
    }
    if (
      editingVehicleListing &&
      (
        !listingForm.year.trim() ||
        !Number.isInteger(numericYear) ||
        numericYear < 1900 ||
        numericYear > maximumYear
      )
    ) {
      validationErrors.year = `Vuosimallin pitää olla väliltä 1900–${maximumYear}.`;
    }
    if (!hasMinimumListingPrice(listingForm.price)) {
      validationErrors.price = "Hinnan pitää olla vähintään 1 €.";
    }
    if (!editingVehicleListing && !listingForm.category.trim()) {
      validationErrors.category = "Kategoria puuttuu.";
    }
    if (!listingForm.condition.trim()) {
      validationErrors.condition = "Kunto puuttuu.";
    }
    if (!listingForm.location_country.trim()) {
      validationErrors.country = "Maa puuttuu.";
    }
    if (!listingForm.location_city.trim()) {
      validationErrors.city = "Kaupunki puuttuu.";
    }
    if (listingForm.description.trim().length < 10) {
      validationErrors.description = "Kuvauksessa pitää olla vähintään 10 merkkiä.";
    }
    if (nextImages.length === 0) {
      validationErrors.images = "Ilmoituksessa pitää olla vähintään yksi kuva.";
    }
    if (commerceEditEligible && commerceEditSettings.enabled) {
      if (!commerceEditPaymentReady) {
        validationErrors.commercePayment = commerceStatusMessage(commerceEditCompany);
      }
      const stockQuantity = decimalInputNumber(commerceEditSettings.stockQuantity);
      const vatRate = decimalInputNumber(commerceEditSettings.vatRate);
      if (!Number.isInteger(stockQuantity) || stockQuantity < 1) {
        validationErrors.commerceStock = "Maksa verkossa -ilmoitukselle tarvitaan vähintään yhden kappaleen määrä.";
      }
      if (!Number.isFinite(vatRate) || vatRate < ZERO_VAT_RATE || vatRate > 100) {
        validationErrors.commerceVat = "Tarkista verokäsittely.";
      }
      if (!commerceEditSettings.pickupAvailable && !commerceEditSettings.shippingAvailable) {
        validationErrors.commerceDelivery = "Valitse toimitustavaksi nouto tai kuljetus.";
      }
      if (
        commerceEditSettings.shippingAvailable &&
        commerceEditShippingCountries.some((country) => {
          const rawPrice = country === "SE"
            ? commerceEditSettings.shippingPriceSe
            : country === "NO"
              ? commerceEditSettings.shippingPriceNo
              : commerceEditSettings.shippingPriceFi;
          const price = decimalInputNumber(rawPrice);
          return !Number.isFinite(price) || price < 0;
        })
      ) {
        validationErrors.commerceShipping = "Lisää kuljetushinta jokaiselle yrityksen hallinnassa valitulle toimitusmaalle.";
      }
    }

    setEditValidationErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setStatus("Täytä kaikki pakolliset tiedot ennen tallentamista.");
      return;
    }

    if (
      nextImages.some((value) =>
        value.startsWith("data:video/") ||
        value.startsWith("blob:video/") ||
        /\.(mp4|mov|m4v|webm|avi|mkv)(?:$|[?#])/i.test(value)
      )
    ) {
      setEditValidationErrors({
        images: "Video ei kelpaa ilmoituksen kuvaksi. Valitse kuvatiedosto."
      });
      setStatus("Videoita ei voi julkaista myynti-ilmoitukseen. Valitse kuvatiedosto.");
      return;
    }

    savingListingRef.current = true;
    setStatus(pageText.saving);

    const nextMainImage = nextImages[0];
    const nextLocation =
      buildLocation(listingForm.location_city, listingForm.location_country);
    const nextDescription = mergeListingDescriptionMetadata(
      currentListing.description,
      listingForm.description
    );
    const requestedPrice = normalizeListingPriceForSave(listingForm.price);
    let savedCommerceProduct = commerceEditProduct;
    let createdCommerceProductId: string | null = null;

    try {
      if (commerceEditEligible && (commerceEditProduct || commerceEditSettings.enabled)) {
        if (!supabase) throw new Error("Kirjaudu uudelleen sisään.");
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Kirjaudu uudelleen sisään.");

        const shippingAvailable = commerceEditSettings.shippingAvailable;
        const productPayload = {
          name: listingForm.title.trim(),
          description: nextDescription,
          storefront_category: commerceEditProduct?.storefront_category ?? null,
          price_cents: Math.round(requestedPrice * 100),
          seller_target_price_cents: commerceEditCompany?.fee_pricing_strategy === "include"
            ? Math.round(requestedPrice * 100)
            : null,
          vat_rate: decimalInputNumber(commerceEditSettings.vatRate),
          stock_quantity: Math.trunc(decimalInputNumber(commerceEditSettings.stockQuantity)),
          active: commerceEditSettings.enabled,
          image_urls: nextImages,
          pickup_available: commerceEditSettings.pickupAvailable,
          // Nouto-osoite ja -ohjeet hallitaan keskitetysti yrityksen asetuksissa.
          pickup_address_override: null,
          pickup_instructions: null,
          shipping_available: shippingAvailable,
          posti_enabled: shippingAvailable,
          shipping_price_cents: shippingAvailable && commerceEditShippingCountries.includes("FI") ? centsInput(commerceEditSettings.shippingPriceFi) : null,
          shipping_price_fi_cents: shippingAvailable && commerceEditShippingCountries.includes("FI") ? centsInput(commerceEditSettings.shippingPriceFi) : null,
          shipping_price_se_cents: shippingAvailable && commerceEditShippingCountries.includes("SE") ? centsInput(commerceEditSettings.shippingPriceSe) : null,
          shipping_price_no_cents: shippingAvailable && commerceEditShippingCountries.includes("NO") ? centsInput(commerceEditSettings.shippingPriceNo) : null,
          free_shipping_threshold_cents: null,
          weight_grams: shippingAvailable ? optionalDecimalInput(commerceEditSettings.weightGrams) : null,
          package_length_cm: shippingAvailable ? optionalDecimalInput(commerceEditSettings.packageLengthCm) : null,
          package_width_cm: shippingAvailable ? optionalDecimalInput(commerceEditSettings.packageWidthCm) : null,
          package_height_cm: shippingAvailable ? optionalDecimalInput(commerceEditSettings.packageHeightCm) : null,
          max_shipping_quantity: shippingAvailable ? commerceEditProduct?.max_shipping_quantity ?? 1 : 1,
          shipping_notes: shippingAvailable ? commerceEditProduct?.shipping_notes ?? null : null
        };
        const productResponse = await fetch(
          commerceEditProduct
            ? `/api/commerce/products/${commerceEditProduct.id}`
            : "/api/commerce/products",
          {
            method: commerceEditProduct ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify(productPayload)
          }
        );
        const productBody = await productResponse.json().catch(() => ({})) as {
          product?: Product;
          error?: string;
        };
        if (!productResponse.ok || !productBody.product) {
          throw new Error(productBody.error || "Verkko-oston tietojen tallennus epäonnistui.");
        }
        savedCommerceProduct = productBody.product;
        if (!commerceEditProduct) createdCommerceProductId = productBody.product.id;
      }

      const nextTranslations = savedCommerceProduct || editingRidingGearListing
        ? {
            ...(currentListing.translations ?? {}),
            _meta: {
              ...(currentListing.translations?._meta ?? {}),
              ...(savedCommerceProduct ? { commerce_product_id: savedCommerceProduct.id } : {}),
              ...(editingRidingGearListing
                ? {
                    riding_gear_size: listingForm.model.trim(),
                    riding_gear_target: listingForm.riding_gear_target.trim()
                  }
                : {})
            }
          }
        : currentListing.translations ?? null;
      const finalListingPrice = commerceEditSettings.enabled && savedCommerceProduct
        ? savedCommerceProduct.price_cents / 100
        : requestedPrice;

      const { data, error } = await updateListing(
        editingListingId,
        {
          title: listingForm.title.trim(),
          original_language: currentListing.original_language || locale,
          // Keep translation metadata: it contains the one-to-one link to the
          // commerce product. Clearing this was the source of duplicate cards.
          translations: nextTranslations,
          price: finalListingPrice,
          category: listingForm.category,
          subcategory: listingForm.subcategory,
          brand: listingForm.brand.trim(),
          model: listingForm.model.trim(),
          year: listingForm.year.trim(),
          part_model: editingVehicleListing ? null : listingForm.part_model.trim() || null,
          part_number: editingVehicleListing ? null : listingForm.part_number.trim() || null,
          location: nextLocation,
          condition: listingForm.condition,
          description: nextDescription,
          image_url: nextMainImage,
          image_urls: nextImages
        }
      );

      if (error) {
        if (createdCommerceProductId && supabase) {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (accessToken) {
            await fetch(`/api/commerce/products/${createdCommerceProductId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` }
            }).catch(() => undefined);
          }
        }
        throw error;
      }

      if (data) {
        updateCachedListing(data);
        setListings((prev) =>
          prev.map((listing) =>
            listing.id === data.id ? data : listing
          )
        );
      }

      listingEditRequestIdRef.current += 1;
      listingFormDirtyRef.current = false;
      commerceEditDirtyRef.current = false;
      setEditingListingId(null);
      setEditValidationErrors({});
      setStatus(pageText.updated);
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      savingListingRef.current = false;
    }

  }

  async function loadDeleteBuyerCandidates(listing: Listing) {
    if (deleteLoading) return;

    setDeleteLoading(true);
    setBuyerCandidateError("");

    const { data, error } =
      await getListingBuyerCandidates(
        listing.id
      );

    if (error) {
      setBuyerCandidateError(
        `Ostajaehdokkaita ei saatu haettua: ${getErrorMessage(error)}`
      );
    }

    const candidates =
      data ?? [];

    setBuyerCandidates(candidates);
    setSelectedConversationId(
      candidates[0]?.conversation_id ?? ""
    );
    setBuyerSelectionMode(
      candidates.length > 0 ? "conversation" : "phone"
    );
    setDeleteLoading(false);
  }

  async function openDeleteDialog(listing: Listing) {

    // Already sold listings have no remaining listing data – the reason
    // dialog is meaningless. Delete the sold record directly.
    if (listing.is_sold) {
      setStatus(pageText.deleting);
      const { error } = await deleteListing(listing.id);
      if (error) {
        setStatus(getErrorMessage(error));
        return;
      }
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      removeCachedListing(listing.id);
      setStatus(pageText.deleted ?? "Ilmoitus poistettu.");
      return;
    }

    setDeleteTarget(listing);
    // Tavallinen poistaminen toimii heti ilman ostaja- tai myyntitietoja.
    // Käyttäjä voi halutessaan vaihtaa syyksi "Sain myytyä".
    setDeleteReason("other");
    setSoldPrice("");
    setBuyerCandidates([]);
    setSelectedConversationId("");
    setBuyerSelectionMode("conversation");
    setBuyerPhone("");
    setPhoneBuyer(null);
    setPhoneLookupStatus("");
    setDeleteError("");
    setBuyerCandidateError("");
    setDeleteLoading(false);
    setStatus("");

  }

  function closeDeleteDialog() {

    if (deleteSubmitting) return;

    setDeleteTarget(null);
    setDeleteReason("other");
    setBuyerCandidates([]);
    setSelectedConversationId("");
    setBuyerSelectionMode("conversation");
    setBuyerPhone("");
    setPhoneBuyer(null);
    setPhoneLookupLoading(false);
    setPhoneLookupStatus("");
    setDeleteError("");
    setBuyerCandidateError("");
    setDeleteLoading(false);

  }

  async function searchBuyerByPhone() {

    if (!user) return;

    const phone =
      buyerPhone.trim();

    if (!phone) {
      setPhoneLookupStatus("Kirjoita ostajan puhelinnumero.");
      return;
    }

    setPhoneLookupLoading(true);
    setPhoneLookupStatus("Haetaan ostajaa...");
    setPhoneBuyer(null);
    setDeleteError("");

    const { data, error } =
      await findReviewBuyerByPhone(phone);

    setPhoneLookupLoading(false);

    if (error) {
      setPhoneLookupStatus(
        `Ostajaa ei voitu hakea: ${getErrorMessage(error)}`
      );
      return;
    }

    if (!data) {
      setPhoneLookupStatus(
        "Puhelinnumerolla ei löytynyt vahvistettua käyttäjää."
      );
      return;
    }

    if (data.buyer_id === user.id) {
      setPhoneLookupStatus(
        "Et voi lähettää arvostelupyyntöä itsellesi."
      );
      return;
    }

    setPhoneBuyer(data);
    setPhoneLookupStatus(
      `Ostaja löytyi: ${data.buyer_name}`
    );

  }

  async function confirmDeleteListing() {

    if (!deleteTarget || !user) return;

    setDeleteError("");

    const selectedBuyer =
      buyerSelectionMode === "conversation"
        ? buyerCandidates.find(
            (candidate) =>
              candidate.conversation_id === selectedConversationId
          ) ?? null
        : null;

    const phoneBuyerSelection =
      buyerSelectionMode === "phone" && phoneBuyer
        ? {
            conversation_id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `phone-${Date.now()}-${phoneBuyer.buyer_id}`,
            buyer_id:
              phoneBuyer.buyer_id,
            buyer_name:
              phoneBuyer.buyer_name
          }
        : null;

    const reviewBuyer =
      buyerSelectionMode === "other"
        ? null
        : selectedBuyer ?? phoneBuyerSelection;

    if (
      deleteReason === "sold" &&
      buyerSelectionMode !== "other" &&
      !reviewBuyer
    ) {
      setDeleteError(
        "Valitse keskustelu tai hae ostaja puhelinnumerolla."
      );
      return;
    }

    setDeleteSubmitting(true);
    setStatus(pageText.deleting);

    const soldAmount =
      soldPrice.trim()
        ? Number(soldPrice)
        : Number(deleteTarget.price) || 0;

    if (deleteReason === "sold" && (Number.isNaN(soldAmount) || soldAmount < 0)) {
      setDeleteSubmitting(false);
      setStatus("");
      setDeleteError("Syötä myyntihinta numerona tai jätä kenttä tyhjäksi.");
      return;
    }

    if (deleteReason === "sold") {
      const soldRecord = await recordSoldListing(
        deleteTarget,
        soldAmount,
        reviewBuyer?.buyer_id ?? null
      );

      if (soldRecord.error) {
        setDeleteSubmitting(false);
        setStatus("");
        setDeleteError(
          `Myyntiä ei voitu tallentaa tilastoihin: ${getErrorMessage(soldRecord.error)}`
        );
        return;
      }

      removeCachedResource(`seller-profile:${user.id}`);

      const soldData = soldRecord.data;
      if (soldData) {
        setSoldListings((prev) => [
          soldData,
          ...prev.filter((item) => item.id !== soldData.id)
        ]);
      }
    }

    if (
      deleteReason === "sold" &&
      reviewBuyer
    ) {
      const reviewRequest =
        await createPurchaseReviewRequest({
          listing_id: deleteTarget.id,
          conversation_id:
            reviewBuyer.conversation_id,
          buyer_id:
            reviewBuyer.buyer_id,
          seller_id:
            user.id,
          listing_title:
            deleteTarget.title,
          seller_name:
            deleteTarget.seller_name ||
            "Myyjä",
          due_at:
            new Date().toISOString()
        });

      if (reviewRequest.error) {
        setDeleteSubmitting(false);
        setStatus("");
        setDeleteError(
          "Arvostelupyyntöä ei voitu lähettää. Tarkista että tietokanta-SQL on ajettu."
        );
        return;
      }
    }


    const { error } =
      await deleteListing(deleteTarget.id);

    if (error) {
      setDeleteSubmitting(false);
      setStatus("");
      setDeleteError(getErrorMessage(error));
      return;
    }

    setListings((prev) =>
      prev.filter(
        (listing) =>
          listing.id !== deleteTarget.id
      )
    );
    removeCachedListing(deleteTarget.id);

    setStatus(
      deleteReason === "sold"
        ? reviewBuyer
          ? "Ilmoitus poistettu ja ostajalle lähetettiin arvostelupyyntö."
          : "Ilmoitus poistettu myytynä ilman ostajan arvostelupyyntöä."
        : pageText.deleted
    );

    setDeleteSubmitting(false);
    closeDeleteDialog();

  }

  function deleteCompletedGroup(groupKey: string) {
    setRemovedCompletedGroupKeys((previous) => {
      const next = new Set(previous);
      next.add(groupKey);
      if (user) writeRemovedCompletedGroupKeys(user.id, next);
      return next;
    });
    setStatus("Multi-koonti poistettu. Myyntitiedot ja tilastot säilyvät ennallaan.");
  }

  const activeListingsValue =
    listings.reduce((sum, listing) => sum + (Number(listing.price) || 0), 0);

  const currentMonthKey =
    new Date().toISOString().slice(0, 7);

  const totalViews = useMemo(
    () => listings.reduce((sum, l) => sum + (Number(l.view_count) || 0), 0),
    [listings]
  );

  const rangeStart = useMemo(() => {
    if (statsRange === "all") return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (statsRange === "1d") {
      // last 24h
      const now = new Date();
      now.setHours(now.getHours() - 24);
      return now;
    }
    if (statsRange === "7d") d.setDate(d.getDate() - 6);
    if (statsRange === "30d") d.setDate(d.getDate() - 29);
    return d;
  }, [statsRange]);

  const rangeLabel = useMemo(() => {
    switch (statsRange) {
      case "1d": return "viim. 24 h";
      case "7d": return "viim. 7 päivää";
      case "30d": return "viim. 30 päivää";
      default: return "kaikkina aikoina";
    }
  }, [statsRange]);

  const newListingsInRange = useMemo(() => listings.filter(
    (l) => !l.is_hidden && (!rangeStart || (l.created_at && new Date(l.created_at) >= rangeStart))
  ).length, [listings, rangeStart]);

  const soldInRange = useMemo(() => soldListings.filter(
    (l) => !rangeStart || (l.sold_at && new Date(l.sold_at) >= rangeStart)
  ), [soldListings, rangeStart]);

  const soldValueInRange = useMemo(() => soldInRange.reduce(
    (sum, listing) => sum + (Number(listing.sold_price) || 0),
    0
  ), [soldInRange]);

  const totalMessageCount = useMemo(
    () => Object.values(messageCounts).reduce(
      (sum, m) => sum + (Number(m.message_count) || 0),
      0
    ),
    [messageCounts]
  );

  const unreadMessageCount = useMemo(
    () => Object.values(messageCounts).reduce(
      (sum, m) => sum + (Number(m.unread_count) || 0),
      0
    ),
    [messageCounts]
  );

  const listingConversationCount = useMemo(
    () => Object.values(messageCounts).reduce(
      (sum, messageCount) => sum + (Number(messageCount.conversation_count) || 0),
      0
    ),
    [messageCounts]
  );

  const currentStatsSnapshot = useMemo<StatsSnapshot>(() => ({
    listings: listings.filter((listing) => !listing.is_hidden).length,
    newListings: newListingsInRange,
    soldValue: soldValueInRange,
    soldCount: soldInRange.length,
    views: totalViews,
    messages: totalMessageCount,
    unread: unreadMessageCount,
    conversations: listingConversationCount
  }), [
    listingConversationCount,
    listings,
    newListingsInRange,
    soldInRange.length,
    soldValueInRange,
    totalMessageCount,
    totalViews,
    unreadMessageCount
  ]);

  useEffect(() => {
    if (!user) return;

    setStatsHistory((previous) => {
      const merged = mergeStatsSnapshots(currentStatsSnapshot, previous[statsRange]);
      const old = previous[statsRange];
      if (
        old &&
        merged.listings === old.listings &&
        merged.newListings === old.newListings &&
        merged.soldValue === old.soldValue &&
        merged.soldCount === old.soldCount &&
        merged.views === old.views &&
        merged.messages === old.messages &&
        merged.unread === old.unread &&
        merged.conversations === old.conversations
      ) {
        return previous;
      }

      const next = { ...previous, [statsRange]: merged };
      writeMyListingsStatsHistory(user.id, next);
      return next;
    });
  }, [currentStatsSnapshot, statsRange, user]);

  const displayedStats = {
    ...mergeStatsSnapshots(currentStatsSnapshot, statsHistory[statsRange]),
    // Never allow cached history to override live, non-cumulative counts.
    listings: currentStatsSnapshot.listings,
    newListings: currentStatsSnapshot.newListings,
    views: currentStatsSnapshot.views,
    messages: currentStatsSnapshot.messages,
    unread: currentStatsSnapshot.unread,
    conversations: currentStatsSnapshot.conversations
  };

  const visibleListings = listings.filter((l) => !l.is_hidden);
  const hiddenListings = listings.filter((l) => !!l.is_hidden);

  const tabCounts = {
    all: listings.length,
    active: visibleListings.length,
    hidden: hiddenListings.length,
    sold: soldListings.length
  };

  const sortedSoldListings = useMemo(() => {
    const result = soldListings.slice();
    result.sort((left, right) => {
      switch (sortOrder) {
        case "oldest":
          return (left.sold_at || "").localeCompare(right.sold_at || "");
        case "price-desc":
          return (Number(right.sold_price) || 0) - (Number(left.sold_price) || 0);
        case "price-asc":
          return (Number(left.sold_price) || 0) - (Number(right.sold_price) || 0);
        case "views":
        case "newest":
        default:
          return (right.sold_at || "").localeCompare(left.sold_at || "");
      }
    });
    return result;
  }, [soldListings, sortOrder]);

  const filteredListings = useMemo(() => {
    let arr: Listing[] = [];
    if (activeTab === "sold") {
      arr = [];
      return arr;
    } else if (activeTab === "all") {
      arr = listings.slice();
    } else if (activeTab === "active") {
      arr = visibleListings.slice();
    } else if (activeTab === "hidden") {
      arr = hiddenListings.slice();
    } else {
      arr = [];
    }

    const sorted = arr.slice();
    sorted.sort((a, b) => {
      switch (sortOrder) {
        case "oldest":
          return (a.created_at || "").localeCompare(b.created_at || "");
        case "price-desc":
          return (Number(b.price) || 0) - (Number(a.price) || 0);
        case "price-asc":
          return (Number(a.price) || 0) - (Number(b.price) || 0);
        case "views":
          return (Number(b.view_count) || 0) - (Number(a.view_count) || 0);
        case "newest":
        default:
          return (b.created_at || "").localeCompare(a.created_at || "");
      }
    });
    return sorted;
  }, [activeTab, listings, sortOrder]);

  const multiGroups = useMemo(() => {
    if (activeTab === "hidden") return [];

    type MultiGroup = {
      key: string;
      vehicleKey: string;
      title: string;
      active: Listing[];
      sold: SoldListing[];
      completed: boolean;
      hasMultiListing: boolean;
      latestAt: string;
    };

    const groupMap = new Map<string, MultiGroup>();
    const legacyCandidates = new Map<string, Listing[]>();

    const addActiveListing = (key: string, vehicleKey: string, listing: Listing) => {
      const group = groupMap.get(key) ?? {
        key,
        vehicleKey,
        title: getVehicleGroupTitle(listing),
        active: [],
        sold: [],
        completed: false,
        hasMultiListing: true,
        latestAt: listing.created_at || ""
      };
      group.active.push(listing);
      if ((listing.created_at || "") > group.latestAt) group.latestAt = listing.created_at || "";
      groupMap.set(key, group);
    };

    for (const listing of filteredListings) {
      const vehicleKey = getVehicleGroupKey(listing);
      if (!vehicleKey) continue;

      if (isMultiListing(listing)) {
        const publicationGroupId = getListingPublicationGroupId(listing);
        const key = publicationGroupId
          ? `publication:${publicationGroupId}`
          : `vehicle:${vehicleKey}`;
        addActiveListing(key, vehicleKey, listing);
        continue;
      }

      const candidates = legacyCandidates.get(vehicleKey) ?? [];
      candidates.push(listing);
      legacyCandidates.set(vehicleKey, candidates);
    }

    const legacyBatchWindowMs = 15 * 60 * 1000;
    for (const [vehicleKey, candidates] of legacyCandidates.entries()) {
      const sortedCandidates = candidates
        .slice()
        .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      const matchingPublishedGroups = Array.from(groupMap.values()).filter(
        (group) => group.vehicleKey === vehicleKey && group.active.length > 0
      );

      // Translation generation used to replace the whole translations object,
      // which removed publication_group_id from a freshly appended listing.
      // When there is exactly one existing publication for this exact vehicle,
      // recover newer orphaned parts into that publication automatically.
      if (matchingPublishedGroups.length === 1) {
        const matchingGroup = matchingPublishedGroups[0];
        const groupCreatedAt = Math.min(
          ...matchingGroup.active.map((listing) => new Date(listing.created_at || "").getTime())
        );
        const remainingCandidates: Listing[] = [];

        for (const listing of sortedCandidates) {
          const listingCreatedAt = new Date(listing.created_at || "").getTime();
          if (
            Number.isFinite(groupCreatedAt) &&
            Number.isFinite(listingCreatedAt) &&
            listingCreatedAt >= groupCreatedAt
          ) {
            addActiveListing(matchingGroup.key, vehicleKey, listing);
          } else {
            remainingCandidates.push(listing);
          }
        }

        sortedCandidates.splice(0, sortedCandidates.length, ...remainingCandidates);
      }

      let batch: Listing[] = [];

      const flushLegacyBatch = () => {
        if (batch.length < 2) {
          batch = [];
          return;
        }

        const batchAnchor = batch[0]?.created_at || batch[0]?.id || "legacy";
        const key = `legacy:${vehicleKey}:${batchAnchor}`;
        batch.forEach((listing) => addActiveListing(key, vehicleKey, listing));
        batch = [];
      };

      for (const listing of sortedCandidates) {
        const previous = batch.at(-1);
        const previousTime = previous ? new Date(previous.created_at).getTime() : Number.NaN;
        const currentTime = new Date(listing.created_at).getTime();

        if (
          previous &&
          (
            Number.isNaN(previousTime) ||
            Number.isNaN(currentTime) ||
            currentTime - previousTime > legacyBatchWindowMs
          )
        ) {
          flushLegacyBatch();
        }

        batch.push(listing);
      }

      flushLegacyBatch();
    }

    for (const sold of soldListings) {
      const vehicleKey = getVehicleGroupKey(sold);
      if (!vehicleKey) continue;
      const matchingActiveGroups = Array.from(groupMap.values()).filter(
        (group) => group.vehicleKey === vehicleKey && group.active.length > 0
      );

      // Older sold_listings schemas do not have listing_mode. A sold part can
      // still be tied safely to the sole active multi-publication for the same
      // vehicle, as long as that publication existed before the sale.
      if (sold.listing_mode !== "multiple") {
        if (sold.listing_mode === "single" || matchingActiveGroups.length !== 1) continue;

        const soldAt = new Date(sold.sold_at || sold.created_at || "").getTime();
        const groupCreatedAt = Math.min(
          ...matchingActiveGroups[0].active.map((listing) =>
            new Date(listing.created_at || "").getTime()
          )
        );
        if (
          !Number.isFinite(soldAt) ||
          !Number.isFinite(groupCreatedAt) ||
          soldAt < groupCreatedAt
        ) continue;
      }

      const key = matchingActiveGroups.length === 1
        ? matchingActiveGroups[0].key
        : `vehicle:${vehicleKey}`;
      const group = groupMap.get(key) ?? {
        key,
        vehicleKey,
        title: getVehicleGroupTitle(sold),
        active: [],
        sold: [],
        completed: false,
        hasMultiListing: true,
        latestAt: sold.sold_at || sold.created_at || ""
      };
      group.sold.push(sold);
      const soldAt = sold.sold_at || sold.created_at || "";
      if (soldAt > group.latestAt) group.latestAt = soldAt;
      groupMap.set(key, group);
    }

    return Array.from(groupMap.values())
      .map((group) => ({
        ...group,
        completed: group.active.length === 0 && group.sold.length > 0
      }))
      .filter((group) => {
        if (group.completed && removedCompletedGroupKeys.has(group.key)) return false;
        if (!group.hasMultiListing) return false;
        if (group.active.length > 0) return true;
        return group.completed && isWithinHours(group.latestAt, 12);
      })
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [activeTab, filteredListings, removedCompletedGroupKeys, soldListings]);

  const groupedListingIds = useMemo(() => {
    const ids = new Set<string>();
    multiGroups.forEach((group) => group.active.forEach((listing) => ids.add(listing.id)));
    return ids;
  }, [multiGroups]);

  const collapsedGroupedListingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of multiGroups) {
      if (expandedGroupKeys[group.key]) continue;
      group.active.forEach((listing) => ids.add(listing.id));
    }
    return ids;
  }, [expandedGroupKeys, multiGroups]);

  const openedGroup = useMemo(
    () => multiGroups.find((group) => expandedGroupKeys[group.key]) ?? null,
    [expandedGroupKeys, multiGroups]
  );

  useEffect(() => {
    if (!openedGroup || openedGroup.active.length === 0) return;
    const firstListingId = openedGroup.active[0]?.id;
    if (!firstListingId) return;
    if (openedGroupFirstListingIdRef.current === firstListingId) return;
    openedGroupFirstListingIdRef.current = firstListingId;

    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-listing-id="${firstListingId}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [openedGroup]);

  const renderedListings = useMemo(
    () => {
      if (openedGroup) {
        const openedIds = new Set(openedGroup.active.map((listing) => listing.id));
        return filteredListings.filter((listing) => openedIds.has(listing.id));
      }

      return filteredListings.filter((listing) => !collapsedGroupedListingIds.has(listing.id));
    },
    [collapsedGroupedListingIds, filteredListings, openedGroup]
  );

  function formatDateFi(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  }

  const tabs: Array<{ key: typeof activeTab; label: string; count: number }> = [
    { key: "all",     label: pageText.tabs.all,     count: tabCounts.all },
    { key: "active",  label: pageText.tabs.active,  count: tabCounts.active },
    { key: "hidden",  label: pageText.tabs.hidden,  count: tabCounts.hidden },
    { key: "sold",    label: pageText.tabs.sold,    count: tabCounts.sold },
  ];

  const sortLabels: Record<typeof sortOrder, string> = {
    newest: "Uusimmat ensin",
    oldest: "Vanhimmat ensin",
    "price-desc": "Hinta: korkein",
    "price-asc": "Hinta: matalin",
    views: "Eniten katseluja"
  };

  return (

    <main className={`${styles.page} my-listings-page`} data-mode={editingListingId ? "editing" : "management"}>

      {!editingListingId && <header className={styles.header}>

        <div>
          <h1 className={styles.title}>{pageText.management}</h1>
          <p className={styles.subtitle}>{pageText.managementHelp}</p>
        </div>

        {user && (
          <div className={styles.statsRange} role="tablist" aria-label="Tilastojen aikaväli">
            {([
              { key: "1d", label: "1 pv" },
              { key: "7d", label: "7 pv" },
              { key: "30d", label: "1 kk" },
              { key: "all", label: "Kaikki" }
            ] as const).map((r) => (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={statsRange === r.key}
                className={`${styles.statsRangeBtn} ${statsRange === r.key ? styles.statsRangeBtnActive : ""}`}
                onClick={() => setStatsRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

      </header>}

      {user && !editingListingId && (
        <>
        <div className={styles.stats}>

          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={`${styles.statIcon} ${styles.cyan}`}>
                <Tag size={22} />
              </span>
              <div>
                <div className={styles.statValue}>{displayedStats.listings.toLocaleString("fi-FI")}</div>
                <div className={styles.statLabel}><UiText text={"Aktiivista ilmoitusta"} /></div>
              </div>
            </div>
            <div className={styles.statDelta}>
              {displayedStats.newListings.toLocaleString("fi-FI")}<UiText text={" uutta · "} />{rangeLabel}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={`${styles.statIcon} ${styles.green}`}>
                <TrendingUp size={22} />
              </span>
              <div>
                <div className={styles.statValue}>
                  {displayedStats.soldValue.toLocaleString("fi-FI")} €
                </div>
                <div className={styles.statLabel}><UiText text={"Myynti · "} />{rangeLabel}</div>
              </div>
            </div>
            <div className={styles.statDelta}>
              {displayedStats.soldValue.toLocaleString("fi-FI")}<UiText text={" € yhteensä"} /></div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={`${styles.statIcon} ${styles.purple}`}>
                <Eye size={22} />
              </span>
              <div>
                <div className={styles.statValue}>{displayedStats.views.toLocaleString("fi-FI")}</div>
                <div className={styles.statLabel}><UiText text={"Katselukerrat"} /></div>
              </div>
            </div>
            <div className={styles.statDelta}>
              {displayedStats.soldCount.toLocaleString("fi-FI")}<UiText text={" myyntiä · "} />{rangeLabel}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={`${styles.statIcon} ${styles.orange}`}>
                <MessageCircle size={22} />
              </span>
              <div>
                <div className={styles.statValue}>
                  {displayedStats.messages.toLocaleString("fi-FI")}
                </div>
                <div className={styles.statLabel}><UiText text={"Viestit"} /></div>
              </div>
            </div>
            <div className={styles.statDelta}>
              {displayedStats.unread.toLocaleString("fi-FI")}{" "}<UiText text={"lukematta · "} />{displayedStats.conversations.toLocaleString("fi-FI")}<UiText text={" keskustelua"} /></div>
          </div>

        </div>
        </>
      )}

      {!user && (
        <div className="profile-alert" data-app-sheet="true" style={{ maxWidth: 1320, margin: "0 auto 24px" }}>
          <LockKeyhole size={20} />
          <span>{pageText.loginToView}</span>
          <Link href="/auth">{t.login}</Link>
        </div>
      )}

      {user && (
        <section
          className={`${styles.panel} ${editingListingId ? styles.panelEditing : ""}`}
        >

          {!editingListingId && <div className={styles.panelTopbar}>

            <div className={styles.tabs}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

          </div>}

          {!listingsCacheReady && listings.length === 0 ? (
            <div className={styles.emptyState} data-app-sheet aria-busy="true" />
          ) : activeTab === "sold" ? (
            sortedSoldListings.length === 0 ? (
              <div className={styles.emptyState} data-app-sheet>
                <Tag size={28} />
                <span><UiText text={"Myytyjä tuotteita ei ole vielä."} /></span>
              </div>
            ) : (
              <div className={styles.list}>
                {sortedSoldListings.map((sold) => (
                  <article
                    className={styles.row}
                    key={sold.id}
                    data-my-listing-row
                  >
                    {sold.image_url ? (
                      <div className={styles.rowMedia}>
                        <div className={styles.rowImageWrap}>
                          <OptimizedListingImage
                            className={styles.rowImage}
                            src={sold.image_url}
                            alt={sold.title || "Myyty tuote"}
                            sizes="156px"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className={styles.rowBody}>
                      <div className={styles.rowBadges}>
                        <span className={styles.listingTypePill}>
                          {sold.listing_mode === "multiple"
                            ? "Multi-ilmoituksen osa"
                            : "Myyty tuote"}
                        </span>
                        {(sold.subcategory || sold.category) && (
                          <span className={styles.categoryPill}>
                            {translateCategory(locale, sold.subcategory || sold.category || "")}
                          </span>
                        )}
                      </div>
                      <h3 className={styles.rowTitle}>{sold.title || "Myyty tuote"}</h3>
                      <ListingVehicleMeta
                        year={sold.year}
                        brand={sold.brand}
                        model={sold.model}
                        className={styles.rowSubline}
                      />
                    </div>

                    <div className={styles.priceCell}>
                      <small><UiText text={"Toteutunut kauppahinta"} /></small>
                      <span className={styles.price}>{formatPrice(Number(sold.sold_price) || 0)}</span>
                      {Number(sold.price) > 0 && Number(sold.price) !== Number(sold.sold_price) && (
                        <span className={styles.dateText}><UiText text={"Pyyntihinta "} />{formatPrice(Number(sold.price))}</span>
                      )}
                      <span className={`${styles.statusBadge} ${styles.statusSold}`}><UiText text={"Myyty"} /></span>
                      <span className={styles.dateText}><UiText text={"Myyty "} />{formatDateFi(sold.sold_at)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : filteredListings.length === 0 && multiGroups.length === 0 ? (
            <div className={styles.emptyState} data-app-sheet>
              <Tag size={28} />
              <span>{pageText.noListings}</span>
              <Link href="/sell">{t.createListing}</Link>
            </div>
          ) : (
            <div className={styles.list}>

              {!editingListingId && multiGroups
                .filter((group) => !openedGroup || group.key === openedGroup.key)
                .map((group) => {
                const isOpen = !!expandedGroupKeys[group.key];
                const activeValue = group.active.reduce(
                  (sum, listing) => sum + (Number(listing.price) || 0),
                  0
                );
                const soldValue = group.sold.reduce(
                  (sum, listing) => sum + (Number(listing.sold_price) || 0),
                  0
                );
                const originalSoldValue = group.sold.reduce(
                  (sum, listing) => sum + (Number(listing.price) || 0),
                  0
                );
                const estimateValue = activeValue + originalSoldValue;
                const views = group.active.reduce(
                  (sum, listing) => sum + (Number(listing.view_count) || 0),
                  0
                );
                const messages = group.active.reduce(
                  (sum, listing) => sum + (messageCounts[listing.id]?.message_count ?? 0),
                  0
                );

                return (
                  <article
                    className={`${styles.multiGroupRow} ${group.completed ? styles.multiGroupCompleted : ""}`}
                    key={`group-${group.key}`}
                    data-my-listing-row
                  >
                    <div className={styles.multiGroupIcon}>
                      <ClipboardList size={24} />
                    </div>

                    <div className={styles.multiGroupBody}>
                      <span className={styles.multiGroupKicker}>
                        {group.completed ? pageText.group.ready : pageText.group.edit}
                      </span>
                      <h3 className={styles.multiGroupTitle}>{group.title}</h3>
                      <div className={styles.multiGroupMeta}>
                        <span>{group.active.length} {pageText.group.listed}</span>
                        <span>{group.sold.length} {pageText.group.sold}</span>
                        <span>{views} {pageText.views}</span>
                        <span>{messages} {pageText.group.messages}</span>
                      </div>
                    </div>

                    <div className={styles.multiGroupMoney}>
                      <span>
                        <small>{pageText.group.estimate}</small>
                        <strong>{estimateValue.toLocaleString("fi-FI")} €</strong>
                      </span>
                      <span>
                        <small>{pageText.group.received}</small>
                        <strong>{soldValue.toLocaleString("fi-FI")} €</strong>
                      </span>
                    </div>

                    <div className={styles.multiGroupActions}>
                      {group.active.length > 0 ? (
                        <Link
                          className={`${styles.actionBtn} ${styles.groupAddPartButton}`}
                          href={compatiblePartListingHref(group.active[0])}
                          aria-label={`${pageText.group.sellMore}: ${group.title}`}
                        >
                          <PackagePlus size={17} aria-hidden="true" />
                          <span>{pageText.group.sellMore}</span>
                        </Link>
                      ) : null}
                      {group.active.length > 0 ? (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${isOpen ? styles.groupToggleOpen : ""}`}
                          onClick={() =>
                            setExpandedGroupKeys(
                              isOpen
                                ? {}
                                : { [group.key]: true }
                            )
                          }
                        >
                          <ChevronDown size={15} />
                          {isOpen ? pageText.group.close : pageText.group.open}
                        </button>
                      ) : (
                        <span className={`${styles.statusBadge} ${styles.statusSold}`}>
                          {pageText.group.allSold}
                        </span>
                      )}
                      {group.completed && (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionDanger}`}
                          onClick={() => deleteCompletedGroup(group.key)}
                          title="Poistaa multi-koonnin hallintanäkymästä. Myyntitiedot säilyvät tilastoissa."
                        >
                          <Trash2 size={14} />
                          {pageText.group.remove}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {renderedListings
                .filter((listing) => !editingListingId || listing.id === editingListingId)
                .map((listing) => {

                const editing =
                  editingListingId === listing.id;
                const editingVehicleListing = isVehicleListing(listing);
                const editingRidingGearListing = isRidingGearListing(listing);

                const listingCategories =
                  (listing.vehicle_type && categoriesByVehicle[listing.vehicle_type]) ||
                  allCategories;

                const subcategories =
                  listingCategories[listingForm.category] ?? [];

                const listingVehicleType = listing.vehicle_type ?? "";
                const listingVehicleKey = getCategoryVehicleKey(listingVehicleType);
                const listingCommonVehicleKey = getCommonVehicleKey(listingVehicleType);
                const brandOptions = Array.from(
                  new Set([
                    ...(taxonomy.vehicles.find((vehicle) => vehicle.key === listingVehicleType)?.brands ?? []),
                    ...Object.keys(BRAND_MODELS[listingVehicleType] ?? {}),
                    ...Object.keys(BRAND_MODELS[listingVehicleKey] ?? {}),
                    ...Object.keys(COMMON_BRAND_MODELS_BY_VEHICLE[listingCommonVehicleKey] ?? {})
                  ].filter((value) => value && value !== "Kaikki"))
                ).sort((a, b) => a.localeCompare(b, "fi", { sensitivity: "base" }));
                const modelOptions = getBrandModelOptions(listingVehicleType, listingForm.brand);

                const imageCount =
                  (listing.image_urls?.length ?? 0) || (listing.image_url ? 1 : 0);

                const isSold = !!listing.is_sold;
                const isHidden = !!listing.is_hidden;
                const statusLabel = isSold
                  ? "Myyty"
                  : isHidden
                  ? "Piilotettu"
                  : "Aktiivinen";
                const statusCls = isSold
                  ? styles.statusSold
                  : isHidden
                  ? styles.statusHidden
                  : styles.statusActive;
                const dateText = isSold
                  ? `Myyty ${formatDateFi(listing.sold_at ?? listing.created_at)}`
                  : `Lisätty ${formatDateFi(listing.created_at)}`;
                const editImages = Array.from(
                  new Set(
                    [
                      ...(listingForm.image_urls ?? []),
                      listingForm.image_url
                    ].filter(Boolean)
                  )
                );

                return (

                  <article
                    className={styles.row}
                    key={listing.id}
                    data-listing-id={listing.id}
                    data-my-listing-row
                    style={editing ? { display: "block" } : undefined}
                  >

                    {editing ? (

                      <div
                        className={`own-listing-edit ${styles.modernEditForm}${editingVehicleListing ? " is-vehicle-listing" : ""}${editingRidingGearListing ? " is-riding-gear-listing" : ""}`}
                        onChangeCapture={() => {
                          listingFormDirtyRef.current = true;
                          if (Object.keys(editValidationErrors).length > 0) {
                            setEditValidationErrors({});
                          }
                        }}
                      >
                        <header className={styles.modernEditHeader}>
                          <div className={styles.modernEditTitle}>
                            <span><Edit3 size={22} /></span>
                            <div>
                              <small><UiText text={"Ilmoituksen hallinta"} /></small>
                              <h1><UiText text={"Muokkaa ilmoitusta"} /></h1>
                              <p><UiText text={"Kaikki ilmoituksen tiedot ja myyntitapa yhdessä selkeässä näkymässä."} /></p>
                            </div>
                          </div>
                          <div className={styles.modernEditHeaderActions}>
                            <div className={styles.modernEditSaveHint}><Check size={16} /><span><strong><UiText text={"Muutokset ovat hallinnassasi"} /></strong><small><UiText text={"Tallenna vasta, kun kaikki näyttää oikealta."} /></small></span></div>
                          </div>
                        </header>

                        <div className={styles.modernEditColumns}>
                          <div className={styles.modernEditColumn}>
                        <div className="own-listing-section">
                              <span className="own-listing-section-title"><ClipboardList size={18} /><UiText text={" Perustiedot"} /></span>
                              <div className="own-listing-title-fields">
                                <label className="own-listing-field">
                                  <span><UiText text={"Otsikko *"} /></span>
                                  <input
                                    className="own-listing-title-input"
                                    value={listingForm.title}
                                    onChange={(event) =>
                                      setListingForm({
                                        ...listingForm,
                                        title: event.target.value
                                      })
                                    }
                                    placeholder={t.title}
                                    minLength={3}
                                    required
                                    aria-invalid={Boolean(editValidationErrors.title)}
                                  />
                                </label>
                              </div>

                              {editingRidingGearListing ? (
                                <div className="own-listing-grid-3">
                                  <label className="own-listing-field">
                                    <span><UiText text={"Ajovarusteen tyyppi *"} /></span>
                                    <select
                                      value={listingForm.subcategory}
                                      onChange={(event) => setListingForm((current) => ({
                                        ...current,
                                        category: "Ajovarusteet",
                                        subcategory: event.target.value
                                      }))}
                                      required
                                      aria-invalid={Boolean(editValidationErrors.subcategory)}
                                    >
                                      <option value=""><UiText text={"Valitse tyyppi"} /></option>
                                      {RIDING_GEAR_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
                                    </select>
                                  </label>
                                  <label className="own-listing-field">
                                    <span><UiText text={"Merkki *"} /></span>
                                    <EditablePresetInput
                                      value={listingForm.brand}
                                      options={RIDING_GEAR_BRANDS}
                                      ariaLabel="Ajovarusteen merkki"
                                      required
                                      invalid={Boolean(editValidationErrors.brand)}
                                      onChange={(value) => setListingForm((current) => ({ ...current, brand: value }))}
                                      placeholder="Esim. Arai"
                                    />
                                  </label>
                                  <label className="own-listing-field">
                                    <span><UiText text={"Koko *"} /></span>
                                    <EditablePresetInput
                                      value={listingForm.model}
                                      options={RIDING_GEAR_SIZES}
                                      ariaLabel="Ajovarusteen koko"
                                      required
                                      invalid={Boolean(editValidationErrors.model)}
                                      onChange={(value) => setListingForm((current) => ({ ...current, model: value }))}
                                      placeholder="Esim. S tai 140"
                                    />
                                  </label>
                                  <label className="own-listing-field">
                                    <span><UiText text={"Kohderyhmä *"} /></span>
                                    <select
                                      value={listingForm.riding_gear_target}
                                      onChange={(event) => setListingForm((current) => ({
                                        ...current,
                                        riding_gear_target: event.target.value
                                      }))}
                                      required
                                      aria-invalid={Boolean(editValidationErrors.ridingGearTarget)}
                                    >
                                      <option value=""><UiText text={"Valitse kohderyhmä"} /></option>
                                      {RIDING_GEAR_TARGETS.map((value) => <option key={value} value={value}>{value}</option>)}
                                    </select>
                                  </label>
                                </div>
                              ) : (
                                <div className="own-listing-grid-3">
                                  <label className="own-listing-field">
                                    <span>{editingVehicleListing ? "Merkki *" : "Merkki"}</span>
                                    <EditablePresetInput
                                      value={listingForm.brand}
                                      options={brandOptions}
                                      ariaLabel="Merkki"
                                      required={editingVehicleListing}
                                      invalid={Boolean(editValidationErrors.brand)}
                                      onChange={(value) => setListingForm((current) => ({ ...current, brand: value }))}
                                      placeholder="Esim. Yamaha"
                                    />
                                  </label>
                                  <label className="own-listing-field">
                                    <span>{editingVehicleListing ? "Malli *" : "Malli"}</span>
                                    <EditablePresetInput
                                      value={listingForm.model}
                                      options={modelOptions}
                                      ariaLabel="Malli"
                                      required={editingVehicleListing}
                                      invalid={Boolean(editValidationErrors.model)}
                                      onChange={(value) => setListingForm((current) => ({ ...current, model: value }))}
                                      placeholder="Esim. DT"
                                    />
                                  </label>
                                  <label className="own-listing-field">
                                    <span>{editingVehicleListing ? "Vuosimalli *" : "Vuosimalli"}</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="1900"
                                      max={new Date().getFullYear() + 2}
                                      value={listingForm.year}
                                      onChange={(event) => setListingForm((current) => ({ ...current, year: event.target.value }))}
                                      placeholder="Esim. 2020"
                                      required={editingVehicleListing}
                                      aria-invalid={Boolean(editValidationErrors.year)}
                                    />
                                  </label>
                                </div>
                              )}

                              <div className="own-listing-title-fields">
                                <label className="own-listing-field own-listing-price-field">
                                  <span><UiText text={"Hinta *"} /></span>
                                  <div className="own-listing-price-wrap">
                                    <input
                                      className="own-listing-price-input"
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={listingForm.price}
                                      onChange={(event) =>
                                        setListingForm({
                                          ...listingForm,
                                          price: normalizeListingPriceInput(event.target.value)
                                        })
                                      }
                                      placeholder="1"
                                      required
                                      aria-invalid={Boolean(editValidationErrors.price)}
                                    />
                                    <b>€</b>
                                  </div>
                                </label>
                                {!editingVehicleListing && !editingRidingGearListing && (
                                  <>
                                    <label className="own-listing-field">
                                      <span><UiText text={"Osan tarkka malli"} /></span>
                                      <input
                                        className="own-listing-part-input"
                                        value={listingForm.part_model}
                                        onChange={(event) =>
                                          setListingForm({
                                            ...listingForm,
                                            part_model: event.target.value
                                          })
                                        }
                                        placeholder="Stage6, Airsal, Malossi..."
                                      />
                                    </label>
                                    <label className="own-listing-field">
                                      <span><UiText text={"Varaosanumero"} /></span>
                                      <input
                                        className="own-listing-part-input"
                                        value={listingForm.part_number}
                                        onChange={(event) =>
                                          setListingForm({
                                            ...listingForm,
                                            part_number: event.target.value
                                          })
                                        }
                                        placeholder="OEM-numero, jos tiedossa"
                                      />
                                    </label>
                                  </>
                                )}
                              </div>
                            </div>

                        {commerceEditEligible ? (
                          <div className={`own-listing-section ${styles.commerceEditSection}`}>
                            <div className={styles.commerceEditHeading}>
                              <div>
                                <span className="own-listing-section-title"><MessageCircle size={18} /><UiText text={" Myyntitapa"} /></span>
                                <strong><UiText text={"Valitse, miten ostaja tekee kaupan"} /></strong>
                                <small><UiText text={"Valinnan voi vaihtaa myös myöhemmin. Sama ilmoitus säilyy – uutta kopiota ei luoda."} /></small>
                              </div>
                              {commerceEditProduct ? (
                                <span className={styles.commerceLinkedBadge}><UiText text={"Verkkokauppatuote yhdistetty"} /></span>
                              ) : null}
                            </div>

                            <div className={styles.commerceMethodGrid} role="group" aria-label="Myyntitapa">
                              <button
                                type="button"
                                className={!commerceEditSettings.enabled ? styles.commerceMethodSelected : undefined}
                                aria-pressed={!commerceEditSettings.enabled}
                                onClick={() => {
                                  commerceEditDirtyRef.current = true;
                                  setCommerceEditSettings((current) => ({ ...current, enabled: false }));
                                }}
                              >
                                <MessageCircle size={22} aria-hidden="true" />
                                <span><strong><UiText text={"Yhteydenotto"} /></strong><small><UiText text={"Ostaja ottaa sinuun yhteyttä."} /></small></span>
                                {!commerceEditSettings.enabled ? <Check size={17} aria-hidden="true" /> : null}
                              </button>
                              <button
                                type="button"
                                className={commerceEditSettings.enabled ? styles.commerceMethodSelected : undefined}
                                aria-pressed={commerceEditSettings.enabled}
                                disabled={!commerceEditPaymentReady}
                                onClick={() => {
                                  commerceEditDirtyRef.current = true;
                                  setCommerceEditSettings((current) => ({ ...current, enabled: true }));
                                }}
                              >
                                <CreditCard size={22} aria-hidden="true" />
                                <span><strong><UiText text={"Maksa verkossa"} /></strong><small><UiText text={"Ostaja maksaa turvallisesti verkossa."} /></small></span>
                                {commerceEditSettings.enabled ? <Check size={17} aria-hidden="true" /> : null}
                              </button>
                            </div>

                            {!commerceEditPaymentReady ? (
                              <div className={styles.commerceReadinessInfo} role="status">
                                <LockKeyhole size={16} />
                                <span>{commerceStatusMessage(commerceEditCompany)}<UiText text={" Suoraoston voi ottaa käyttöön, kun maksujen vastaanotto on valmis."} /></span>
                              </div>
                            ) : null}

                            {!commerceEditSettings.enabled ? (
                              <div className={styles.commerceContactInfo}>
                                <LockKeyhole size={16} />
                                <span><UiText text={"Yhteystietosi ja viestisi jaetaan ostajalle vasta, kun hän ottaa sinuun yhteyttä."} /></span>
                              </div>
                            ) : null}

                            {commerceEditSettings.enabled ? (
                              <div className={styles.commerceSettingsPanel}>
                                <div className={styles.commerceSettingsIntro}>
                                  <strong><UiText text={"Verkko-oston tiedot"} /></strong>
                                  <small><UiText text={"Täytä määrä, verokanta ja vähintään yksi toimitustapa."} /></small>
                                </div>
                                <div className={styles.commerceFieldsGrid}>
                                  <label className="own-listing-field">
                                    <span><UiText text={"Määrä (kpl) *"} /></span>
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={commerceEditSettings.stockQuantity}
                                      onChange={(event) => setCommerceEditSettings((current) => ({
                                        ...current,
                                        stockQuantity: event.target.value
                                      }))}
                                      aria-invalid={Boolean(editValidationErrors.commerceStock)}
                                    />
                                  </label>
                                  <label className="own-listing-field">
                                    <span><UiText text={"Verokäsittely *"} /></span>
                                    <select
                                      value={decimalInputNumber(commerceEditSettings.vatRate)}
                                      onChange={(event) => setCommerceEditSettings((current) => ({
                                        ...current,
                                        vatRate: event.target.value.replace(".", ",")
                                      }))}
                                      aria-invalid={Boolean(editValidationErrors.commerceVat)}
                                    >
                                      {VAT_RATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                  </label>
                                </div>

                                <div className={styles.commerceDeliveryBlock}>
                                  <span><UiText text={"Toimitustapa *"} /></span>
                                  <div className={styles.commerceDeliveryChoices}>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={commerceEditSettings.pickupAvailable}
                                        onChange={(event) => setCommerceEditSettings((current) => ({
                                          ...current,
                                          pickupAvailable: event.target.checked
                                        }))}
                                      /><UiText text={"Nouto"} /></label>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={commerceEditSettings.shippingAvailable}
                                        onChange={(event) => setCommerceEditSettings((current) => ({
                                          ...current,
                                          shippingAvailable: event.target.checked
                                        }))}
                                      /><UiText text={"Kuljetus (Posti)"} /></label>
                                  </div>
                                </div>

                                {commerceEditSettings.shippingAvailable ? (
                                  <div className={styles.commerceShippingEditor}>
                                    <div className={styles.commerceFieldsGrid}>
                                      {commerceEditShippingCountries.map((country) => {
                                        const field = country === "SE" ? "shippingPriceSe" : country === "NO" ? "shippingPriceNo" : "shippingPriceFi";
                                        const countryName = country === "SE" ? "Ruotsiin" : country === "NO" ? "Norjaan" : "Suomeen";
                                        return (
                                          <label className="own-listing-field" key={country}>
                                            <span><UiText text={"Postikulut "} />{countryName} (€) *</span>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              value={commerceEditSettings[field]}
                                              onChange={(event) => setCommerceEditSettings((current) => ({
                                                ...current,
                                                [field]: event.target.value
                                              }))}
                                              placeholder="0 = maksuton"
                                              aria-invalid={Boolean(editValidationErrors.commerceShipping)}
                                            />
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                          </div>
                          <div className={styles.modernEditColumn}>

                        <div className="own-listing-section">
                          <span className="own-listing-section-title">
                            <Tag size={18} /> {editingVehicleListing || editingRidingGearListing ? "Kunto" : "Luokittelu ja kunto"}
                          </span>
                          <div className="own-listing-grid-3">
                            {!editingVehicleListing && !editingRidingGearListing && <label className="own-listing-field">
                              <span><UiText text={"Kategoria *"} /></span>
                              <select
                                value={listingForm.category}
                                onChange={(event) =>
                                  setListingForm({
                                    ...listingForm,
                                    category: event.target.value,
                                    subcategory: ""
                                  })
                                }
                                required
                                aria-invalid={Boolean(editValidationErrors.category)}
                              >
                                {Object.keys(listingCategories)
                                  .map((category) => (
                                    <option
                                      key={category}
                                      value={category}
                                    >
                                      {translateCategory(locale, category)}
                                    </option>
                                  ))}
                              </select>
                            </label>}

                            {!editingVehicleListing && !editingRidingGearListing && <label className="own-listing-field">
                              <span><UiText text={"Alakategoria"} /></span>
                              <select
                                value={listingForm.subcategory}
                                onChange={(event) =>
                                  setListingForm({
                                    ...listingForm,
                                    subcategory: event.target.value
                                  })
                                }
                              >
                                <option value="">
                                  {pageText.noSubcategory}
                                </option>
                                {subcategories.map(
                                  (subcategory) => (
                                    <option
                                      key={subcategory}
                                      value={subcategory}
                                    >
                                      {translateCategory(locale, subcategory)}
                                    </option>
                                  )
                                )}
                              </select>
                            </label>}

                            <label className="own-listing-field">
                              <span><UiText text={"Kunto *"} /></span>
                              <select
                                value={listingForm.condition}
                                onChange={(event) =>
                                  setListingForm({
                                    ...listingForm,
                                    condition: event.target.value
                                  })
                                }
                                required
                                aria-invalid={Boolean(editValidationErrors.condition)}
                              >
                                {conditions.map(
                                  (condition) => (
                                    <option
                                      key={condition}
                                      value={condition}
                                    >
                                      {condition}
                                    </option>
                                  )
                                )}
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className="own-listing-section">
                          <span className="own-listing-section-title"><MapPin size={18} /><UiText text={" Sijainti"} /></span>
                          <div className="own-listing-location-pair">
                            <label className="own-listing-field">
                              <span><UiText text={"Maa *"} /></span>
                              <input
                                className="own-listing-location-input"
                                value={listingForm.location_country}
                                onChange={(event) => {
                                  const location_country = event.target.value;
                                  setListingForm({
                                    ...listingForm,
                                    location_country,
                                    location: buildLocation(listingForm.location_city, location_country)
                                  });
                                }}
                                placeholder="Maa"
                                required
                                aria-invalid={Boolean(editValidationErrors.country)}
                              />
                            </label>
                            <label className="own-listing-field">
                              <span><UiText text={"Kaupunki *"} /></span>
                              <input
                                className="own-listing-location-input"
                                value={listingForm.location_city}
                                onChange={(event) => {
                                  const location_city = event.target.value;
                                  setListingForm({
                                    ...listingForm,
                                    location_city,
                                    location: buildLocation(location_city, listingForm.location_country)
                                  });
                                }}
                                placeholder="Kaupunki"
                                required
                                aria-invalid={Boolean(editValidationErrors.city)}
                              />
                            </label>
                          </div>
                        </div>

                        <div
                          className={`own-listing-section ${styles.editPhotoSection}`}
                          data-invalid={editValidationErrors.images ? "true" : undefined}
                        >
                          <div className={styles.editPhotoHeader}>
                            <span className="own-listing-section-title"><ImagePlus size={18} /><UiText text={" Kuvat *"} /></span>
                            <span className={styles.editPhotoCount}>
                              {editImages.length}<UiText text={" kuvaa"} /></span>
                          </div>

                          <div className={styles.editPhotoBody}>
                            <label className={styles.editPhotoUploadButton}>
                              <input
                                className={styles.editPhotoInput}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
                                multiple
                                onChange={(event) => {
                                  handleListingImageUpload(event.target.files);
                                  event.currentTarget.value = "";
                                }}
                              />
                              <ImagePlus size={19} />
                              <strong><UiText text={"Lisää kuvia"} /></strong>
                              <span><UiText text={"Valitse tiedostot"} /></span>
                            </label>

                            {editImages.length > 0 ? (
                              <div className={styles.editPhotoGrid}>
                                {editImages.map((img, index) => (
                                  <div key={`${img}-${index}`} className={styles.editPhotoTile}>
                                    <button
                                      type="button"
                                      className={styles.editPhotoPreview}
                                      onClick={() => setPreviewImage(img)}
                                      aria-label={`Avaa kuva ${index + 1}`}
                                    >
                                      <img src={img} alt={`Kuva ${index + 1}`} />
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.editPhotoRemove}
                                      aria-label="Poista kuva"
                                      onClick={() => removeListingImage(index)}
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.editPhotoEmpty}><UiText text={"Ei kuvia lisättynä vielä"} /></div>
                            )}
                          </div>
                        </div>

                        <label className="own-listing-field own-listing-description-field">
                          <span><Edit3 size={18} /><UiText text={" Kuvaus *"} /></span>
                          <textarea
                            value={listingForm.description}
                            onChange={(event) =>
                              setListingForm({
                                ...listingForm,
                                description: event.target.value
                              })
                            }
                            placeholder={
                              editingVehicleListing
                                ? "Kerro ajoneuvon kunnosta, historiasta ja mahdollisista vioista."
                                : "Kerro osan kunnosta, sopivuudesta ja mahdollisista vioista."
                            }
                            minLength={10}
                            required
                            aria-invalid={Boolean(editValidationErrors.description)}
                          />
                        </label>

                          </div>
                        </div>

                        {Object.keys(editValidationErrors).length > 0 ? (
                          <div className="own-listing-validation-summary" role="alert" aria-live="assertive">
                            <strong><UiText text={"Tarkista pakolliset tiedot"} /></strong>
                            <ul>
                              {Object.entries(editValidationErrors).map(([field, message]) => (
                                <li key={field}>{message}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="own-listing-actions">

                          <button
                            type="button"
                            onClick={saveListing}
                          >
                            <Check size={18} />
                            {pageText.save}
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={stopEditingListing}
                          >
                            <X size={18} />
                            {pageText.cancel}
                          </button>

                        </div>

                      </div>

                    ) : (
                      <>
                        <div className={styles.rowMedia}>
                          <div className={styles.rowImageWrap}>
                            <OptimizedListingImage
                              className={styles.rowImage}
                              src={getListingMainImage(listing)}
                              alt={listing.title}
                              sizes="96px"
                            />
                            {imageCount > 0 && (
                              <span className={styles.photoCount}>
                                <ImageIcon size={12} />
                                {imageCount}
                              </span>
                            )}
                          </div>

                        </div>

                        <div className={styles.rowBody}>
                          <div className={styles.rowBadges}>
                            <span className={styles.listingTypePill}>
                              {groupedListingIds.has(listing.id)
                                ? "Multi-ilmoituksen osa"
                                : "Yksittäinen ilmoitus"}
                            </span>

                            {(listing.subcategory || listing.category) && (
                              <span className={styles.categoryPill}>
                                {translateCategory(
                                  locale,
                                  listing.subcategory || listing.category || ""
                                )}
                              </span>
                            )}
                          </div>

                          <h3 className={styles.rowTitle}>{listing.title}</h3>

                          <ListingVehicleMeta
                            year={listing.year}
                            brand={listing.brand}
                            model={listing.model}
                            className={styles.rowSubline}
                          />

                          <div className={styles.rowMeta}>
                            <span>
                              <Eye size={14} />
                              {listing.view_count ?? 0} {pageText.views}
                            </span>
                            <span>
                              <MessageCircle size={14} />
                              {messageCounts[listing.id]?.message_count ?? 0}<UiText text={" viestiä"} />{messageCounts[listing.id]?.unread_count
                                ? ` (${messageCounts[listing.id].unread_count} uutta)`
                                : ""}
                            </span>
                            {listing.is_hidden && (
                              <span style={{ color: "#d88a16" }}>
                                <EyeOff size={14} /><UiText text={"Piilotettu"} /></span>
                            )}
                          </div>

                        </div>

                        <div className={styles.priceCell}>
                          <ListingSalePrice listing={listing} className={styles.price} />
                          <span className={`${styles.statusBadge} ${statusCls}`}>
                            {statusLabel}
                          </span>
                          <span className={styles.dateText}>{dateText}</span>
                        </div>

                        <div className={styles.actions}>
                          {!isSold && (
                            <>
                              <Link
                                className={styles.actionBtn}
                                href={listingPath(listing, locale)}
                              >
                                <ExternalLink size={14} />
                                {t.openListing}
                              </Link>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => startEditingListing(listing)}
                              >
                                <Edit3 size={14} />
                                {pageText.edit}
                              </button>
                            </>
                          )}
                          {!isSold && (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => toggleListingHidden(listing)}
                              title={isHidden ? "Näytä muille" : "Piilota muilta"}
                            >
                              {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                              {isHidden ? "Näytä" : "Piilota"}
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionDanger}`}
                            onClick={() => openDeleteDialog(listing)}
                          >
                            <Trash2 size={14} />
                            {pageText.delete}
                          </button>
                        </div>

                      </>
                    )}

                  </article>

                );

              })}

            </div>
          )}

          {status && (
            <div className={styles.statusMsg}>{status}</div>
          )}

        </section>
      )}

      {previewImage && (
        <div className="part-image-preview-modal" role="dialog" aria-modal="true" aria-label="Kuvan esikatselu">
          <button
            type="button"
            className="part-image-preview-backdrop"
            onClick={() => setPreviewImage(null)}
            aria-label="Sulje kuvan esikatselu"
          />
          <div className="part-image-preview-panel">
            <img src={previewImage} alt="Tuotekuva isona" />
            <button
              type="button"
              className="part-image-preview-close"
              onClick={() => setPreviewImage(null)}
              aria-label="Sulje"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (

        <div className="delete-listing-modal-backdrop">

          <section
            className="delete-listing-modal"
            aria-modal="true"
            role="dialog"
          >

            <div className="delete-listing-modal-heading">
              <span><UiText text={"Poista ilmoitus"} /></span>
              <button
                type="button"
                aria-label="Sulje"
                onClick={closeDeleteDialog}
              >
                <X size={18} />
              </button>
            </div>

            <h2>{deleteTarget.title}</h2>

            <p><UiText text={"Miksi poistat ilmoituksen?"} /></p>

            <div className="delete-reason-options">
              <button
                type="button"
                className={
                  deleteReason === "sold"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setDeleteReason("sold");
                  setDeleteError("");
                  if (buyerCandidates.length === 0) {
                    void loadDeleteBuyerCandidates(deleteTarget);
                  }
                }}
              >
                <Check size={17} /><UiText text={"Sain myytyä"} /></button>

              <button
                type="button"
                className={
                  deleteReason === "other"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setDeleteReason("other")
                }
              >
                <Trash2 size={17} /><UiText text={"Muu syy"} /></button>
            </div>

            {deleteReason === "sold" && (
              <div className="delete-sold-price">
                <label htmlFor="sold-price-input"><UiText text={"Millä hinnalla myit? (€)"} /></label>
                <input
                  id="sold-price-input"
                  type="number"
                  min="0"
                  placeholder={`Pyyntihinta oli ${deleteTarget?.price ?? ""} €`}
                  value={soldPrice}
                  inputMode="numeric"
                  onChange={(e) => setSoldPrice(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}

            {deleteReason === "sold" && (
              <div className="delete-buyer-select">
                <label><UiText text={"Kenelle myit?"} /></label>

                <div className="delete-buyer-mode">
                  <button
                    type="button"
                    className={buyerSelectionMode === "conversation" ? "active" : ""}
                    onClick={() => {
                      setBuyerSelectionMode("conversation");
                      setPhoneLookupStatus("");
                      setPhoneBuyer(null);
                    }}
                  >
                    <MessageCircle size={16} /><UiText text={"Keskustelu"} /></button>
                  <button
                    type="button"
                    className={buyerSelectionMode === "phone" ? "active" : ""}
                    onClick={() => {
                      setBuyerSelectionMode("phone");
                      setDeleteError("");
                    }}
                  >
                    <Phone size={16} /><UiText text={"Puhelinnumero"} /></button>
                  <button
                    type="button"
                    className={buyerSelectionMode === "other" ? "active" : ""}
                    onClick={() => {
                      setBuyerSelectionMode("other");
                      setDeleteError("");
                      setPhoneLookupStatus("");
                      setPhoneBuyer(null);
                    }}
                  >
                    <X size={16} /><UiText text={"Muu"} /></button>
                </div>

                {buyerSelectionMode === "conversation" && (
                  <>
                    {deleteLoading ? (
                      <div className="delete-muted"><UiText text={"Haetaan keskusteluja..."} /></div>
                    ) : buyerCandidates.length > 0 ? (
                      <select
                        id="sold-buyer"
                        value={selectedConversationId}
                        onChange={(event) =>
                          setSelectedConversationId(
                            event.target.value
                          )
                        }
                      >
                        {buyerCandidates.map(
                          (candidate) => (
                            <option
                              key={candidate.conversation_id}
                              value={candidate.conversation_id}
                            >
                              {candidate.buyer_name}
                            </option>
                          )
                        )}
                      </select>
                    ) : (
                      <div className="delete-muted"><UiText text={"Tästä ilmoituksesta ei löytynyt ostajan keskustelua. Voit yhdistää ostajan puhelinnumerolla."} /></div>
                    )}
                  </>
                )}

                {buyerSelectionMode === "phone" && (
                  <div className="delete-phone-lookup">
                    <div className="delete-phone-lookup-row">
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={buyerPhone}
                        onChange={(event) => {
                          setBuyerPhone(sanitizePhoneInput(event.target.value));
                          setPhoneBuyer(null);
                          setPhoneLookupStatus("");
                        }}
                        placeholder="358401234567"
                      />
                      <button
                        type="button"
                        onClick={searchBuyerByPhone}
                        disabled={phoneLookupLoading}
                      >
                        <Search size={16} />
                        {phoneLookupLoading ? "Haetaan..." : "Hae"}
                      </button>
                    </div>
                    {phoneLookupStatus && (
                      <div className={phoneBuyer ? "delete-success" : "delete-muted"}>
                        {phoneLookupStatus}
                      </div>
                    )}
                  </div>
                )}

                {buyerSelectionMode === "other" && (
                  <div className="delete-muted"><UiText text={"Ostajaa ei valita eikä arvostelupyyntöä lähetetä. Ilmoitus poistetaan silti myytynä."} /></div>
                )}

                {buyerCandidateError && (
                  <div className="delete-error">
                    {buyerCandidateError}
                  </div>
                )}

              </div>
            )}

            {deleteError && (
              <div className="delete-error">
                {deleteError}
              </div>
            )}

            <div className="delete-muted"><UiText text={"Ilmoitukseen liittyvissä keskusteluissa voi viestiä vielä 20 päivää poistamisen jälkeen, minkä jälkeen ne poistuvat automaattisesti."} /></div>

            <div className="delete-listing-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeDeleteDialog}
              ><UiText text={"Peruuta"} /></button>

              <button
                type="button"
                className="danger-button"
                onClick={confirmDeleteListing}
                disabled={
                  deleteSubmitting ||
                  deleteLoading ||
                  (
                    deleteReason === "sold" &&
                    buyerSelectionMode !== "other" &&
                    (
                      buyerSelectionMode === "conversation"
                        ? !selectedConversationId
                        : !phoneBuyer
                    )
                  )
                }
              >
                <Trash2 size={17} />
                {deleteSubmitting
                  ? "Poistetaan..."
                  : "Poista ilmoitus"}
              </button>
            </div>

          </section>

        </div>

      )}

    </main>

  );

}
