"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import OptimizedListingImage from "@/app/components/OptimizedListingImage";
import { translateCategory, useLanguage } from "@/lib/i18n";
import { listingPath, listingUrlId } from "@/lib/routes";
import { sanitizePhoneInput } from "@/lib/phone-input";

import {
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ClipboardList,
  Edit3,
  Eye,
  EyeOff,
  ImageIcon,
  ImagePlus,
  LayoutGrid,
  List as ListIcon,
  LockKeyhole,
  MessageCircle,
  MoreVertical,
  Phone,
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
  getConversationCountForUser,
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

import styles from "./my-listings.module.css";

import {
  conditions,
  formatPrice,
  type Listing,
  type SoldListing
} from "@/lib/listings";
import { buildVehicleCategoriesFromTaxonomy, categoriesAsRecord } from "@/lib/taxonomy";
import { useTaxonomy } from "@/app/components/TaxonomyProvider";

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

function getUserWrittenDescription(description: string) {
  const lines = (description || "").replace(/\r\n/g, "\n").split("\n");
  let index = 0;
  let removedVehicleInfo = false;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (/^(Ajoneuvo|Merkki|Malli|Vuosimalli):/i.test(line)) {
      removedVehicleInfo = true;
      index += 1;
      continue;
    }

    if (removedVehicleInfo && line.length === 0) {
      index += 1;
      continue;
    }

    break;
  }

  return lines.slice(index).join("\n").trimStart();
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
const dismissedCompletedGroupsPrefix = "arcticparts:dismissed-completed-groups:";
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

function dismissedCompletedGroupsKey(userId: string) {
  return `${dismissedCompletedGroupsPrefix}${userId}`;
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

function readDismissedCompletedGroupKeys(userId: string) {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(dismissedCompletedGroupsKey(userId));
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function writeDismissedCompletedGroupKeys(userId: string, keys: Set<string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      dismissedCompletedGroupsKey(userId),
      JSON.stringify(Array.from(keys))
    );
  } catch {
    // This only controls local UI visibility; sales history stays in the database.
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
    listings: Math.max(current.listings, old.listings),
    newListings: Math.max(current.newListings, old.newListings),
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
      et: "Kuulutuste haldus"
    }[locale],
    managementHelp: {
      fi: "Muokkaa, avaa tai poista omia myynti-ilmoituksiasi.",
      en: "Edit, open or delete your own sales listings.",
      sv: "Redigera, öppna eller ta bort dina egna försäljningsannonser.",
      no: "Rediger, åpne eller slett dine egne salgsannonser.",
      et: "Muuda, ava või kustuta oma müügikuulutusi."
    }[locale],
    loginToView: {
      fi: "Kirjaudu sisään nähdäksesi omat ilmoituksesi.",
      en: "Log in to view your listings.",
      sv: "Logga in för att se dina annonser.",
      no: "Logg inn for å se annonsene dine.",
      et: "Logi sisse, et näha oma kuulutusi."
    }[locale],
    noListings: {
      fi: "Sinulla ei ole vielä ilmoituksia.",
      en: "You do not have any listings yet.",
      sv: "Du har inga annonser ännu.",
      no: "Du har ingen annonser ennå.",
      et: "Sul pole veel ühtegi kuulutust."
    }[locale],
    noSubcategory: {
      fi: "Ei alakategoriaa",
      en: "No subcategory",
      sv: "Ingen underkategori",
      no: "Ingen underkategori",
      et: "Alamkategooriat pole"
    }[locale],
    imageUrl: {
      fi: "Kuvan osoite",
      en: "Image URL",
      sv: "Bildadress",
      no: "Bildeadresse",
      et: "Pildi aadress"
    }[locale],
    save: { fi: "Tallenna", en: "Save", sv: "Spara", no: "Lagre", et: "Salvesta" }[locale],
    cancel: { fi: "Peruuta", en: "Cancel", sv: "Avbryt", no: "Avbryt", et: "Tühista" }[locale],
    edit: { fi: "Muokkaa", en: "Edit", sv: "Redigera", no: "Rediger", et: "Muuda" }[locale],
    delete: { fi: "Poista", en: "Delete", sv: "Ta bort", no: "Slett", et: "Kustuta" }[locale],
    views: { fi: "katselua", en: "views", sv: "visningar", no: "visninger", et: "vaatamist" }[locale],
    saving: {
      fi: "Tallennetaan ilmoitusta...",
      en: "Saving listing...",
      sv: "Sparar annons...",
      no: "Lagrer annonse...",
      et: "Kuulutust salvestatakse..."
    }[locale],
    updated: {
      fi: "Ilmoitus päivitetty.",
      en: "Listing updated.",
      sv: "Annonsen har uppdaterats.",
      no: "Annonsen er oppdatert.",
      et: "Kuulutus uuendatud."
    }[locale],
    confirmDelete: {
      fi: "Poistetaanko ilmoitus pysyvästi?",
      en: "Delete this listing permanently?",
      sv: "Ta bort annonsen permanent?",
      no: "Slette annonsen permanent?",
      et: "Kustuta kuulutus jäädavalt?"
    }[locale],
    deleting: {
      fi: "Poistetaan ilmoitusta...",
      en: "Deleting listing...",
      sv: "Tar bort annons...",
      no: "Sletter annonse...",
      et: "Kuulutust kustutatakse..."
    }[locale],
    deleted: {
      fi: "Ilmoitus poistettu.",
      en: "Listing deleted.",
      sv: "Annonsen har tagits bort.",
      no: "Annonsen er slettet.",
      et: "Kuulutus kustutatud."
    }[locale]
  };

  const [user, setUser] =
    useState<User | null>(null);

  const [listings, setListings] =
    useState<Listing[]>([]);

  const [soldListings, setSoldListings] =
    useState<SoldListing[]>([]);
  const [dismissedCompletedGroupKeys, setDismissedCompletedGroupKeys] = useState<Set<string>>(() => new Set());
  const [statsHistory, setStatsHistory] = useState<StatsHistory>({});

  const [listingsCacheReady, setListingsCacheReady] =
    useState(false);

  const [status, setStatus] =
    useState("");

  const [editingListingId, setEditingListingId] =
    useState<string | null>(null);

  const [listingForm, setListingForm] =
    useState({
      title: "",
      price: "",
      category: "",
      subcategory: "",
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

  const [conversationCount, setConversationCount] =
    useState(0);

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const [expandedGroupKeys, setExpandedGroupKeys] =
    useState<Record<string, boolean>>({});

  const [statsRange, setStatsRange] =
    useState<"1d" | "7d" | "30d" | "all">("7d");

  const [messageCounts, setMessageCounts] =
    useState<Record<string, ListingMessageCount>>({});
  const openedGroupFirstListingIdRef =
    useRef<string | null>(null);

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
      setDismissedCompletedGroupKeys(new Set());
      setStatsHistory({});
      return;
    }

    let cancelled = false;
    setDismissedCompletedGroupKeys(readDismissedCompletedGroupKeys(user.id));
    setStatsHistory(readMyListingsStatsHistory(user.id));
    const cachedListings = readCachedMyListings(user.id);

    if (cachedListings.length > 0) {
      setListings(cachedListings.filter((l) => !l.is_sold));
      setListingsCacheReady(true);
    } else {
      setListingsCacheReady(false);
    }

    getListingsBySeller(user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const activeListings = (data ?? []).filter((l) => !l.is_sold);
        setListings(activeListings);
        setListingsCacheReady(true);
        writeCachedMyListings(user.id, activeListings);
      })
      .catch(() => {
        if (cancelled) return;
        setListings([]);
        setListingsCacheReady(true);
      });

    getConversationCountForUser(user.id)
      .then(({ count }) => {
        if (cancelled) return;
        setConversationCount(count);
      })
      .catch(() => {
        if (!cancelled) setConversationCount(0);
      });

    getMyListingMessageCounts()
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, ListingMessageCount> = {};
        (data ?? []).forEach((row) => {
          map[row.listing_id] = row;
        });
        setMessageCounts(map);
      })
      .catch(() => {
        if (!cancelled) setMessageCounts({});
      });

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
    if (!user || !listingsCacheReady) return;
    writeCachedMyListings(user.id, listings);
  }, [listings, listingsCacheReady, user]);

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
    setStatus(next ? "Ilmoitus piilotettu muilta." : "Ilmoitus jälleen näkyvissä.");
    setOpenMenuId(null);
  }

  function startEditingListing(listing: Listing) {

    setEditingListingId(listing.id);
    setStatus("");

    const listingImages = getEditableListingImages(listing);
    const locationParts = splitLocation(listing.location);

    setListingForm({
      title: listing.title,
      price: String(listing.price),
      category: listing.category ?? "",
      subcategory: listing.subcategory ?? "",
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

    void getListingById(listing.id)
      .then(({ data }) => {
        if (!data) return;

        const freshImages = getEditableListingImages(data);
        const freshLocationParts = splitLocation(data.location);

        setListings((prev) =>
          prev.map((item) => item.id === data.id ? data : item)
        );

        setListingForm({
          title: data.title,
          price: String(data.price),
          category: data.category ?? "",
          subcategory: data.subcategory ?? "",
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
      })
      .catch(() => {
        // The cached listing is still usable if the fresh fetch fails.
      });

  }

  function handleListingImageUpload(files: FileList | null | undefined) {
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

    const reads = selectedFiles.map((file) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Kuvan lukeminen epäonnistui."));
          }
        };
        reader.onerror = () => reject(new Error("Kuvan lukeminen epäonnistui."));
        reader.readAsDataURL(file);
      })
    );

    void Promise.all(reads)
      .then((results) => {
        setListingForm((prev) => {
          const nextImages = Array.from(
            new Set([
              ...prev.image_urls,
              ...results
            ])
          );

          return {
            ...prev,
            image_url: prev.image_url || nextImages[0] || "",
            image_urls: nextImages
          };
        });
      })
      .catch(() => {
        setStatus("Kuvan lisääminen epäonnistui.");
      });
  }

  function removeListingImage(index: number) {
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

    setEditingListingId(null);
    setStatus("");

  }

  function hasMinimumListingPrice(value: string | number | null | undefined) {
    return Number(value) >= 1;
  }

  function normalizeListingPriceInput(value: string) {
    if (value.trim() === "") return "";
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric < 1) return "1";
    return value;
  }

  function normalizeListingPriceForSave(value: string | number | null | undefined) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 1 ? numeric : 1;
  }

  async function saveListing() {

    if (!editingListingId) return;

    const currentListing =
      listings.find(
        (listing) =>
          listing.id === editingListingId
      );

    if (!currentListing) return;

    setStatus(pageText.saving);

    if (!hasMinimumListingPrice(listingForm.price)) {
      setStatus("Hinnan pitää olla vähintään 1 €.");
      return;
    }

    const nextImages = listingForm.image_urls.filter(Boolean);

    if (
      nextImages.some((value) =>
        value.startsWith("data:video/") ||
        value.startsWith("blob:video/") ||
        /\.(mp4|mov|m4v|webm|avi|mkv)(?:$|[?#])/i.test(value)
      )
    ) {
      setStatus("Videoita ei voi julkaista myynti-ilmoitukseen. Valitse kuvatiedosto.");
      return;
    }

    const nextMainImage =
      nextImages[0] ||
      listingForm.image_url ||
      fallbackListingImage;
    const nextLocation =
      buildLocation(listingForm.location_city, listingForm.location_country) || listingForm.location;

    const { data, error } =
      await updateListing(
        editingListingId,
        {
          title: listingForm.title,
          original_language: currentListing.original_language || locale,
          translations: null,
          price: normalizeListingPriceForSave(listingForm.price),
          category: listingForm.category,
          subcategory: listingForm.subcategory,
          part_model: listingForm.part_model.trim() || null,
          part_number: listingForm.part_number.trim() || null,
          location: nextLocation,
          condition: listingForm.condition,
          description: listingForm.description,
          image_url: nextMainImage,
          image_urls: nextImages
        }
      );

    if (error) {
      setStatus(getErrorMessage(error));
      return;
    }

    if (data) {
      setListings((prev) =>
        prev.map((listing) =>
          listing.id === data.id
            ? data
            : listing
        )
      );
    }

    setEditingListingId(null);
    setStatus(pageText.updated);

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
    setDeleteReason("sold");
    setSoldPrice("");
    setBuyerCandidates([]);
    setSelectedConversationId("");
    setBuyerSelectionMode("conversation");
    setBuyerPhone("");
    setPhoneBuyer(null);
    setPhoneLookupStatus("");
    setDeleteError("");
    setBuyerCandidateError("");
    setDeleteLoading(true);
    setStatus("");

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
      setStatus(getErrorMessage(error));
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

  async function dismissCompletedGroup(groupKey: string) {
    setDismissedCompletedGroupKeys((prev) => {
      const next = new Set(prev);
      next.add(groupKey);
      if (user) {
        writeDismissedCompletedGroupKeys(user.id, next);
      }
      return next;
    });
    setStatus("Multi-koonti piilotettu. Myyntisumma säilyy tilastoissa.");
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
    (l) => !rangeStart || (l.created_at && new Date(l.created_at) >= rangeStart)
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

  const currentStatsSnapshot = useMemo<StatsSnapshot>(() => ({
    listings: listings.length,
    newListings: newListingsInRange,
    soldValue: soldValueInRange,
    soldCount: soldInRange.length,
    views: totalViews,
    messages: totalMessageCount,
    unread: unreadMessageCount,
    conversations: conversationCount
  }), [
    conversationCount,
    listings.length,
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

  const displayedStats = mergeStatsSnapshots(
    currentStatsSnapshot,
    statsHistory[statsRange]
  );

  const visibleListings = listings.filter((l) => !l.is_hidden);
  const hiddenListings = listings.filter((l) => !!l.is_hidden);

  const tabCounts = {
    all: listings.length,
    active: visibleListings.length,
    hidden: hiddenListings.length,
    sold: 0
  };

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

    const groupMap = new Map<string, {
      key: string;
      title: string;
      active: Listing[];
      sold: SoldListing[];
      completed: boolean;
      hasMultiListing: boolean;
      latestAt: string;
    }>();

    for (const listing of filteredListings) {
      if (listing.listing_mode !== "multiple") continue;

      const key = getVehicleGroupKey(listing);
      if (!key) continue;
      const group = groupMap.get(key) ?? {
        key,
        title: getVehicleGroupTitle(listing),
        active: [],
        sold: [],
        completed: false,
        hasMultiListing: listing.listing_mode === "multiple",
        latestAt: listing.created_at || ""
      };
      group.active.push(listing);
      group.hasMultiListing ||= listing.listing_mode === "multiple";
      if ((listing.created_at || "") > group.latestAt) group.latestAt = listing.created_at || "";
      groupMap.set(key, group);
    }

    for (const sold of soldListings) {
      if (sold.listing_mode !== "multiple") continue;

      const key = getVehicleGroupKey(sold);
      if (!key) continue;
      const group = groupMap.get(key) ?? {
        key,
        title: getVehicleGroupTitle(sold),
        active: [],
        sold: [],
        completed: false,
        hasMultiListing: sold.listing_mode === "multiple",
        latestAt: sold.sold_at || sold.created_at || ""
      };
      group.sold.push(sold);
      group.hasMultiListing ||= sold.listing_mode === "multiple";
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
        if (group.completed && dismissedCompletedGroupKeys.has(group.key)) return false;
        if (!group.hasMultiListing) return false;
        if (group.active.length > 0) return true;
        return group.completed && isWithinHours(group.latestAt, 12);
      })
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [activeTab, dismissedCompletedGroupKeys, filteredListings, soldListings]);

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
    { key: "all",     label: "Kaikki",     count: tabCounts.all },
    { key: "active",  label: "Aktiiviset", count: tabCounts.active },
    { key: "hidden",  label: "Piilotetut", count: tabCounts.hidden },
  ];

  const sortLabels: Record<typeof sortOrder, string> = {
    newest: "Uusimmat ensin",
    oldest: "Vanhimmat ensin",
    "price-desc": "Hinta: korkein",
    "price-asc": "Hinta: matalin",
    views: "Eniten katseluja"
  };

  return (

    <main className={`${styles.page} my-listings-page`}>

      <header className={styles.header}>

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

      </header>

      {user && (
        <>
        <div className={styles.stats}>

          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={`${styles.statIcon} ${styles.cyan}`}>
                <Tag size={22} />
              </span>
              <div>
                <div className={styles.statValue}>{displayedStats.listings.toLocaleString("fi-FI")}</div>
                <div className={styles.statLabel}>Aktiivista ilmoitusta</div>
              </div>
            </div>
            <div className={styles.statDelta}>
              <ArrowUp size={14} />
              {displayedStats.newListings.toLocaleString("fi-FI")} uutta · {rangeLabel}
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
                <div className={styles.statLabel}>Myynti · {rangeLabel}</div>
              </div>
            </div>
            <div className={styles.statDelta}>
              <ArrowUp size={14} />
              {displayedStats.soldValue.toLocaleString("fi-FI")} € yhteensä
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={`${styles.statIcon} ${styles.purple}`}>
                <Eye size={22} />
              </span>
              <div>
                <div className={styles.statValue}>{displayedStats.views.toLocaleString("fi-FI")}</div>
                <div className={styles.statLabel}>Katselukerrat</div>
              </div>
            </div>
            <div className={styles.statDelta}>
              <ArrowUp size={14} />
              {displayedStats.soldCount.toLocaleString("fi-FI")} myyntiä · {rangeLabel}
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
                <div className={styles.statLabel}>Viestit</div>
              </div>
            </div>
            <div className={styles.statDelta}>
              <ArrowUp size={14} />
              {displayedStats.unread.toLocaleString("fi-FI")}{" "}
              lukematta · {displayedStats.conversations.toLocaleString("fi-FI")} keskustelua
            </div>
          </div>

        </div>
        </>
      )}

      {!user && (
        <div className="profile-alert" style={{ maxWidth: 1320, margin: "0 auto 24px" }}>
          <LockKeyhole size={20} />
          <span>{pageText.loginToView}</span>
          <Link href="/auth">{t.login}</Link>
        </div>
      )}

      {user && (
        <section className={styles.panel}>

          <div className={styles.panelTopbar}>

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

          </div>

          {!listingsCacheReady && listings.length === 0 ? (
            <div className={styles.emptyState} aria-busy="true" />
          ) : filteredListings.length === 0 && multiGroups.length === 0 ? (
            <div className={styles.emptyState}>
              <Tag size={28} />
              <span>{pageText.noListings}</span>
              <Link href="/sell">{t.createListing}</Link>
            </div>
          ) : (
            <div className={styles.list}>

              {multiGroups.map((group) => {
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
                  >
                    <div className={styles.multiGroupIcon}>
                      <ClipboardList size={24} />
                    </div>

                    <div className={styles.multiGroupBody}>
                      <span className={styles.multiGroupKicker}>
                        {group.completed ? "Valmis multi-ilmoitus" : "Muokkaa ilmoituksia"}
                      </span>
                      <h3 className={styles.multiGroupTitle}>{group.title}</h3>
                      <div className={styles.multiGroupMeta}>
                        <span>{group.active.length} myynnissä</span>
                        <span>{group.sold.length} myyty</span>
                        <span>{views} katselua</span>
                        <span>{messages} viestiä</span>
                      </div>
                    </div>

                    <div className={styles.multiGroupMoney}>
                      <span>
                        <small>Arvio yhteensä</small>
                        <strong>{estimateValue.toLocaleString("fi-FI")} €</strong>
                      </span>
                      <span>
                        <small>Saatu jo</small>
                        <strong>{soldValue.toLocaleString("fi-FI")} €</strong>
                      </span>
                    </div>

                    <div className={styles.multiGroupActions}>
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
                          {isOpen ? "Sulje osat" : "Avaa osat"}
                        </button>
                      ) : (
                        <span className={`${styles.statusBadge} ${styles.statusSold}`}>
                          Kaikki myyty
                        </span>
                      )}
                      {group.completed && (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionDanger}`}
                          onClick={() => dismissCompletedGroup(group.key)}
                          title="Koonti piilotetaan pysyvästi tästä näkymästä. Myyntisumma säilyy tilastoissa."
                        >
                          <Trash2 size={14} />
                          Poista koonti
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {renderedListings.map((listing) => {

                const editing =
                  editingListingId === listing.id;

                const listingCategories =
                  (listing.vehicle_type && categoriesByVehicle[listing.vehicle_type]) ||
                  allCategories;

                const subcategories =
                  listingCategories[listingForm.category] ?? [];

                const imageCount =
                  (listing.image_urls?.length ?? 0) || (listing.image_url ? 1 : 0);

                const vehicleSubline = [
                  listing.brand,
                  listing.model,
                  listing.year
                ]
                  .filter(Boolean)
                  .join(" ");

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
                    style={editing ? { display: "block" } : undefined}
                  >

                    {editing ? (

                      <div className="own-listing-edit">
                        <div className="own-listing-edit-head">
                          <div>
                            <span>Muokkaa ilmoitusta</span>
                            <strong>{listing.title}</strong>
                          </div>
                          <small>Tallenna muutokset vasta kun tiedot näyttävät oikeilta.</small>
                        </div>

                        {(() => {
                          const sepIdx = listingForm.title.indexOf(" - ");
                          const partName = sepIdx >= 0 ? listingForm.title.slice(0, sepIdx) : listingForm.title;
                          const lockedSuffix = sepIdx >= 0 ? listingForm.title.slice(sepIdx + 3) : "";
                          return (
                            <div className="own-listing-section">
                              <span className="own-listing-section-title">Perustiedot</span>
                              <div className="own-listing-title-fields">
                                <label className="own-listing-field">
                                  <span>Otsikko</span>
                                  <input
                                    className="own-listing-title-input"
                                    value={partName}
                                    onChange={(event) =>
                                      setListingForm({
                                        ...listingForm,
                                        title: lockedSuffix
                                          ? `${event.target.value} - ${lockedSuffix}`
                                          : event.target.value
                                      })
                                    }
                                    placeholder={t.title}
                                  />
                                </label>
                                {lockedSuffix && (
                                  <label className="own-listing-field">
                                    <span>Ajoneuvo</span>
                                    <input
                                      className="own-listing-locked-input"
                                      value={lockedSuffix}
                                      readOnly
                                      disabled
                                      aria-label="Merkki, malli ja vuosimalli (ei muokattavissa)"
                                    />
                                  </label>
                                )}
                              </div>

                              <div className="own-listing-title-fields">
                                <label className="own-listing-field own-listing-price-field">
                                  <span>Hinta</span>
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
                                    />
                                    <b>€</b>
                                  </div>
                                </label>
                                <label className="own-listing-field">
                                  <span>Osan tarkka malli</span>
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
                                  <span>Varaosanumero</span>
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
                              </div>
                            </div>
                          );
                        })()}

                        <div className="own-listing-section">
                          <span className="own-listing-section-title">Luokittelu ja kunto</span>
                          <div className="own-listing-grid-3">
                            <label className="own-listing-field">
                              <span>Kategoria</span>
                              <select
                                value={listingForm.category}
                                onChange={(event) =>
                                  setListingForm({
                                    ...listingForm,
                                    category: event.target.value,
                                    subcategory: ""
                                  })
                                }
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
                            </label>

                            <label className="own-listing-field">
                              <span>Alakategoria</span>
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
                            </label>

                            <label className="own-listing-field">
                              <span>Kunto</span>
                              <select
                                value={listingForm.condition}
                                onChange={(event) =>
                                  setListingForm({
                                    ...listingForm,
                                    condition: event.target.value
                                  })
                                }
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
                          <span className="own-listing-section-title">Sijainti</span>
                          <div className="own-listing-location-pair">
                            <label className="own-listing-field">
                              <span>Maa</span>
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
                              />
                            </label>
                            <label className="own-listing-field">
                              <span>Kaupunki</span>
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
                              />
                            </label>
                          </div>
                        </div>

                        <div className={`own-listing-section ${styles.editPhotoSection}`}>
                          <div className={styles.editPhotoHeader}>
                            <span className="own-listing-section-title">Kuvat</span>
                            <span className={styles.editPhotoCount}>
                              {editImages.length} kuvaa
                            </span>
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
                              <strong>Lisää kuvia</strong>
                              <span>Valitse tiedostot</span>
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
                              <div className={styles.editPhotoEmpty}>
                                Ei kuvia lisättynä vielä
                              </div>
                            )}
                          </div>
                        </div>

                        <label className="own-listing-field own-listing-description-field">
                          <span>Kuvaus</span>
                          <textarea
                            value={listingForm.description}
                            onChange={(event) =>
                              setListingForm({
                                ...listingForm,
                                description: event.target.value
                              })
                            }
                            placeholder="Kerro osan kunnosta, sopivuudesta ja mahdollisista vioista."
                          />
                        </label>

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

                          <div className={styles.rowMeta}>
                            <span>
                              <Eye size={14} />
                              {listing.view_count ?? 0} {pageText.views}
                            </span>
                            <span>
                              <MessageCircle size={14} />
                              {messageCounts[listing.id]?.message_count ?? 0} viestiä
                              {messageCounts[listing.id]?.unread_count
                                ? ` (${messageCounts[listing.id].unread_count} uutta)`
                                : ""}
                            </span>
                            {listing.is_hidden && (
                              <span style={{ color: "#fbbf24" }}>
                                <EyeOff size={14} />
                                Piilotettu
                              </span>
                            )}
                          </div>
                        </div>

                        <div className={styles.rowBody}>
                          <div className={styles.rowBadges}>
                            <span className={styles.listingTypePill}>
                              Yksittäinen ilmoitus
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

                          {vehicleSubline && (
                            <span className={styles.rowSubline}>{vehicleSubline}</span>
                          )}

                        </div>

                        <div className={styles.priceCell}>
                          <span className={styles.price}>
                            {formatPrice(listing.price)}
                          </span>
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
                                href={listingPath(listingUrlId(listing), locale)}
                              >
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

                        <button
                          type="button"
                          className={styles.kebab}
                          aria-label="Lisätoiminnot"
                          onClick={() =>
                            setOpenMenuId(openMenuId === listing.id ? null : listing.id)
                          }
                        >
                          <MoreVertical size={18} />
                        </button>
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
              <span>Poista ilmoitus</span>
              <button
                type="button"
                aria-label="Sulje"
                onClick={closeDeleteDialog}
              >
                <X size={18} />
              </button>
            </div>

            <h2>{deleteTarget.title}</h2>

            <p>
              Miksi poistat ilmoituksen?
            </p>

            <div className="delete-reason-options">
              <button
                type="button"
                className={
                  deleteReason === "sold"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setDeleteReason("sold")
                }
              >
                <Check size={17} />
                Sain myytyä
              </button>

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
                <Trash2 size={17} />
                Muu syy
              </button>
            </div>

            {deleteReason === "sold" && (
              <div className="delete-sold-price">
                <label htmlFor="sold-price-input">
                  Millä hinnalla myit? (€)
                </label>
                <input
                  id="sold-price-input"
                  type="number"
                  min="0"
                  placeholder={`Pyyntihinta oli ${deleteTarget?.price ?? ""} €`}
                  value={soldPrice}
                  onChange={(e) => setSoldPrice(e.target.value)}
                />
              </div>
            )}

            {deleteReason === "sold" && (
              <div className="delete-buyer-select">
                <label>
                  Kenelle myit?
                </label>

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
                    <MessageCircle size={16} />
                    Keskustelu
                  </button>
                  <button
                    type="button"
                    className={buyerSelectionMode === "phone" ? "active" : ""}
                    onClick={() => {
                      setBuyerSelectionMode("phone");
                      setDeleteError("");
                    }}
                  >
                    <Phone size={16} />
                    Puhelinnumero
                  </button>
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
                    <X size={16} />
                    Muu
                  </button>
                </div>

                {buyerSelectionMode === "conversation" && (
                  <>
                    {deleteLoading ? (
                      <div className="delete-muted">
                        Haetaan keskusteluja...
                      </div>
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
                      <div className="delete-muted">
                        Tästä ilmoituksesta ei löytynyt ostajan keskustelua. Voit yhdistää ostajan puhelinnumerolla.
                      </div>
                    )}
                  </>
                )}

                {buyerSelectionMode === "phone" && (
                  <div className="delete-phone-lookup">
                    <div className="delete-phone-lookup-row">
                      <input
                        type="tel"
                        inputMode="tel"
                        pattern="[+0-9]*"
                        value={buyerPhone}
                        onChange={(event) => {
                          setBuyerPhone(sanitizePhoneInput(event.target.value));
                          setPhoneBuyer(null);
                          setPhoneLookupStatus("");
                        }}
                        placeholder="+358401234567"
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
                  <div className="delete-muted">
                    Ostajaa ei valita eikä arvostelupyyntöä lähetetä. Ilmoitus poistetaan silti myytynä.
                  </div>
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

            <div className="delete-listing-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeDeleteDialog}
              >
                Peruuta
              </button>

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
