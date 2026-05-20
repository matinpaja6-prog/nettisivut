"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OptimizedListingImage from "@/app/components/OptimizedListingImage";
import { translateCategory, useLanguage } from "@/lib/i18n";

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
  getListingBuyerCandidates,
  getListingsBySeller,
  getMyListingMessageCounts,
  recordSoldListing,
  setListingHidden,
  supabase,
  updateListing,
  type ListingBuyerCandidate,
  type ListingMessageCount,
  type ReviewBuyerLookup
} from "@/lib/supabase";

import styles from "./my-listings.module.css";

import {
  conditions,
  formatPrice,
  getListingPartNumber,
  type Listing
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

function myListingsCacheKey(userId: string) {
  return `${myListingsCachePrefix}${userId}`;
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

  const [statsRange, setStatsRange] =
    useState<"1d" | "7d" | "30d" | "all">("7d");

  const [messageCounts, setMessageCounts] =
    useState<Record<string, ListingMessageCount>>({});

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

    if (!user) return;

    let cancelled = false;
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

    return () => {
      cancelled = true;
    };

  }, [user]);

  useEffect(() => {
    if (!user || !listingsCacheReady) return;
    writeCachedMyListings(user.id, listings);
  }, [listings, listingsCacheReady, user]);

  async function toggleListingHidden(listing: Listing) {
    const next = !listing.is_hidden;
    setListings((prev) =>
      prev.map((l) =>
        l.id === listing.id ? { ...l, is_hidden: next } : l
      )
    );
    const { error } = await setListingHidden(listing.id, next);
    if (error) {
      setStatus("Näkyvyyden vaihto epäonnistui.");
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

    const listingImages = Array.from(
      new Set(
        [
          listing.image_url,
          ...(listing.image_urls ?? [])
        ].filter(Boolean)
      )
    );
    const locationParts = splitLocation(listing.location);

    setListingForm({
      title: listing.title,
      price: String(listing.price),
      category: listing.category ?? "",
      subcategory: listing.subcategory ?? "",
      part_number: listing.part_number ?? "",
      location: listing.location,
      location_country: locationParts.country,
      location_city: locationParts.city,
      condition: listing.condition,
      description: listing.description,
      image_url: listingImages[0] ?? "",
      image_urls: listingImages
    });

  }

  function handleListingImageUpload(file: File | undefined) {
    if (!file) return;

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

    if (
      file.type.startsWith("video/") ||
      (file.type ? !allowedImageTypes.has(file.type) : !allowedImageExtension.test(file.name))
    ) {
      setStatus("Videoita ei voi julkaista myynti-ilmoitukseen. Valitse kuvatiedosto.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result === "string") {
        setListingForm((prev) => {
          const nextImages = [...prev.image_urls, result];

          return {
            ...prev,
            image_url: prev.image_url || result,
            image_urls: nextImages
          };
        });
      }
    };

    reader.readAsDataURL(file);
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

  const soldInRange = useMemo(() => [] as Listing[], []);

  const soldValueInRange = useMemo(() => soldInRange.reduce(
    (sum) => sum,  // no sold tracking
    0
  ), [soldInRange]);

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

    <main className={styles.page}>

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
                <div className={styles.statValue}>{listings.length.toLocaleString("fi-FI")}</div>
                <div className={styles.statLabel}>Aktiivista ilmoitusta</div>
              </div>
            </div>
            <div className={styles.statDelta}>
              <ArrowUp size={14} />
              {newListingsInRange} uutta · {rangeLabel}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={`${styles.statIcon} ${styles.green}`}>
                <TrendingUp size={22} />
              </span>
              <div>
                <div className={styles.statValue}>
                  {soldValueInRange.toLocaleString("fi-FI")} €
                </div>
                <div className={styles.statLabel}>Myynti · {rangeLabel}</div>
              </div>
            </div>
            <div className={styles.statDelta}>
              <ArrowUp size={14} />
              {soldValueInRange.toLocaleString("fi-FI")} € yhteensä
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={`${styles.statIcon} ${styles.purple}`}>
                <Eye size={22} />
              </span>
              <div>
                <div className={styles.statValue}>{totalViews.toLocaleString("fi-FI")}</div>
                <div className={styles.statLabel}>Katselukerrat</div>
              </div>
            </div>
            <div className={styles.statDelta}>
              <ArrowUp size={14} />
              {soldInRange.length} myyntiä · {rangeLabel}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHead}>
              <span className={`${styles.statIcon} ${styles.orange}`}>
                <MessageCircle size={22} />
              </span>
              <div>
                <div className={styles.statValue}>
                  {Object.values(messageCounts).reduce(
                    (sum, m) => sum + (Number(m.message_count) || 0),
                    0
                  )}
                </div>
                <div className={styles.statLabel}>Viestit</div>
              </div>
            </div>
            <div className={styles.statDelta}>
              <ArrowUp size={14} />
              {Object.values(messageCounts).reduce(
                (sum, m) => sum + (Number(m.unread_count) || 0),
                0
              )}{" "}
              lukematta · {conversationCount} keskustelua
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
            <div className={styles.emptyState}>
              <Tag size={28} />
              <span>Ladataan omia ilmoituksia...</span>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className={styles.emptyState}>
              <Tag size={28} />
              <span>{pageText.noListings}</span>
              <Link href="/sell">{t.createListing}</Link>
            </div>
          ) : (
            <div className={styles.list}>

              {filteredListings.map((listing) => {

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

                return (

                  <article
                    className={styles.row}
                    key={listing.id}
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

                        <div className="own-listing-section">
                          <span className="own-listing-section-title">Kuvat</span>
                          <div className="own-listing-image-editor">
                            <label className="upload-box own-listing-upload-box">
                              <ImagePlus size={24} />
                              <strong>Lisää kuva</strong>
                              <span>PNG, JPG, WEBP</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
                                onChange={(event) => {
                                  handleListingImageUpload(event.target.files?.[0]);
                                  event.currentTarget.value = "";
                                }}
                              />
                            </label>

                            <div className="image-grid own-listing-image-grid">
                              {listingForm.image_urls.map((img, index) => (
                                <div key={`${img}-${index}`} className="img-box own-listing-img-box">
                                  <button
                                    type="button"
                                    className="image-open-btn"
                                    onClick={() => setPreviewImage(img)}
                                    aria-label={`Avaa kuva ${index + 1}`}
                                  >
                                    <img src={img} alt={`Kuva ${index + 1}`} />
                                  </button>
                                  <button
                                    type="button"
                                    className="image-remove-btn"
                                    aria-label="Poista kuva"
                                    onClick={() => removeListingImage(index)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
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
                              src={listing.image_url}
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
                          {(listing.subcategory || listing.category) && (
                            <span className={styles.categoryPill}>
                              {translateCategory(
                                locale,
                                listing.subcategory || listing.category || ""
                              )}
                            </span>
                          )}

                          <h3 className={styles.rowTitle}>{listing.title}</h3>

                          {vehicleSubline && (
                            <span className={styles.rowSubline}>{vehicleSubline}</span>
                          )}
                          {getListingPartNumber(listing) && (
                            <span className={styles.rowSubline}>
                              OEM {getListingPartNumber(listing)}
                            </span>
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
                                href={`/listing/${listing.id}`}
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
                        value={buyerPhone}
                        onChange={(event) => {
                          setBuyerPhone(event.target.value);
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
