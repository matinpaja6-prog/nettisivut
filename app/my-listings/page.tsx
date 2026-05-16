"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { translateCategory, useLanguage } from "@/lib/i18n";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

import {
  ArrowUp,
  Award,
  Bell,
  Car,
  Check,
  DoorOpen,
  Edit3,
  Eye,
  EyeOff,
  ArrowLeft,
  Heart,
  Home,
  ImageIcon,
  ImagePlus,
  LockKeyhole,
  Mail,
  MessageCircle,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Store,
  Tag,
  TrendingUp,
  Trash2,
  UserRound,
  X
} from "lucide-react";

import type { User } from "@supabase/supabase-js";

import {
  createPurchaseReviewRequest,
  deleteListing,
  findReviewBuyerByPhone,
  getConversationSummaries,
  getListingBuyerCandidates,
  getListingsBySeller,
  getCurrentUserIsAdmin,
  getMyListingMessageCounts,
  recordSoldListing,
  setListingHidden,
  signOut,
  supabase,
  updateListing,
  type ListingBuyerCandidate,
  type ListingMessageCount,
  type ReviewBuyerLookup
} from "@/lib/supabase";

import styles from "./my-listings.module.css";
import topStyles from "../page.module.css";

import {
  categories,
  conditions,
  formatPrice,
  getListingPartNumber,
  type Listing
} from "@/lib/listings";

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

export default function MyListingsPage() {
  const { locale, t } = useLanguage();
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

  const [sortOrder] =
    useState<"newest" | "oldest" | "price-desc" | "price-asc" | "views">("newest");

  const [conversationCount, setConversationCount] =
    useState(0);

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const [profileMenu, setProfileMenu] =
    useState(false);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [statsRange, setStatsRange] =
    useState<"1d" | "7d" | "30d" | "all">("7d");

  const [messageCounts, setMessageCounts] =
    useState<Record<string, ListingMessageCount>>({});

  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [profileMenuPos, setProfileMenuPos] =
    useState<{ top: number; right: number } | null>(null);

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

    getListingsBySeller(user.id)
      .then(({ data }) => {
        setListings((data ?? []).filter((l) => !l.is_sold));
      })
      .catch(() => {
        setListings([]);
      });

    getConversationSummaries(user.id)
      .then(({ data }) => {
        setConversationCount((data ?? []).length);
      })
      .catch(() => setConversationCount(0));

    getMyListingMessageCounts()
      .then(({ data }) => {
        const map: Record<string, ListingMessageCount> = {};
        (data ?? []).forEach((row) => {
          map[row.listing_id] = row;
        });
        setMessageCounts(map);
      })
      .catch(() => setMessageCounts({}));

    getCurrentUserIsAdmin()
      .then((result) => {
        if (typeof result === "boolean") setIsAdmin(result);
        else if (result && typeof result === "object" && "data" in result)
          setIsAdmin(!!(result as { data?: boolean }).data);
      })
      .catch(() => setIsAdmin(false));

  }, [user]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!profileMenu) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        profileMenuRef.current?.contains(target) ||
        profileButtonRef.current?.contains(target)
      ) {
        return;
      }
      setProfileMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileMenu]);

  function toggleProfileMenu() {
    if (profileMenu) {
      setProfileMenu(false);
      return;
    }
    const rect = profileButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setProfileMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
    setProfileMenu(true);
  }

  async function handleSignOut() {
    setProfileMenu(false);
    setUser(null);
    try {
      sessionStorage.removeItem("home_return_state_v1");
      sessionStorage.removeItem("home_return_pending_v1");
    } catch {}
    await signOut();
    if (typeof window !== "undefined") window.location.href = "/";
  }

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

  async function saveListing() {

    if (!editingListingId) return;

    const currentListing =
      listings.find(
        (listing) =>
          listing.id === editingListingId
      );

    if (!currentListing) return;

    setStatus(pageText.saving);

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
          price: Number(listingForm.price),
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

  const visibleListings = useMemo(
    () => listings.filter((l) => !l.is_hidden),
    [listings]
  );
  const hiddenListings = useMemo(
    () => listings.filter((l) => !!l.is_hidden),
    [listings]
  );

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
  }, [activeTab, hiddenListings, listings, sortOrder, visibleListings]);

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

  const pääsivuLabel = { fi: "Pääsivu", en: "Home", sv: "Hem", no: "Hjem", et: "Avaleht" }[locale];
  const cancelLabel = { fi: "Peruuta", en: "Cancel", sv: "Avbryt", no: "Avbryt", et: "Tühista" }[locale];

  return (

    <main className={styles.page}>

      <div className={`${topStyles.heroWrap} ${styles.slimHero}`}>
        <div className={`${topStyles.container} ${topStyles.topbar}`}>
          <Link
            href="/"
            className={topStyles.topButton}
            aria-label={cancelLabel}
          >
            <ArrowLeft size={14} />
            <span className={topStyles.topButtonLabel}>{cancelLabel}</span>
          </Link>
          <div style={{ flex: 1 }} />
          <div className={topStyles.topActions} suppressHydrationWarning>
            {user ? (
              <Link
                href="/sell"
                className={`${topStyles.topButton} ${topStyles.topButtonSolid}`}
              >
                <Plus size={14} />
                <span className={topStyles.topButtonLabel}>{t.createListing}</span>
              </Link>
            ) : (
              <button
                type="button"
                className={`${topStyles.topButton} ${topStyles.topButtonSolid}`}
                disabled
                suppressHydrationWarning
              >
                <Plus size={14} />
                <span className={topStyles.topButtonLabel}>{t.createListing}</span>
              </button>
            )}

            <Link
              href="/messages"
              className={`${topStyles.notificationButton} ${styles.topbarGrayButton}`}
              aria-label={t.messages}
            >
              <Bell size={17} />
              {conversationCount > 0 && (
                <span className={topStyles.notificationBadge}>
                  {conversationCount > 9 ? "9+" : conversationCount}
                </span>
              )}
            </Link>

            {user ? (
              <div
                className={topStyles.topbarProfileWrap}
                style={{ position: "relative", zIndex: 9999 }}
              >
                <button
                  ref={profileButtonRef}
                  onClick={toggleProfileMenu}
                  className={`${topStyles.topButton} ${topStyles.topButtonSolid} ${styles.topbarGrayButton} ${styles.topbarGrayProfile}`}
                  aria-haspopup="menu"
                  aria-expanded={profileMenu}
                  type="button"
                >
                  <UserRound size={14} />
                  <span className={topStyles.topButtonLabel}>{t.profile}</span>
                </button>
              </div>
            ) : (
              <Link
                href="/auth"
                className={`${topStyles.topButton} ${topStyles.topbarProfileWrap} ${styles.topbarGrayButton} ${styles.topbarGrayProfile}`}
              >
                <LockKeyhole size={14} />
                {t.profile}
              </Link>
            )}

            <LanguageSwitcher />
          </div>
        </div>
      </div>

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

      {profileMenu && profileMenuPos && typeof window !== "undefined" &&
        createPortal(
          <div
            ref={profileMenuRef}
            className={styles.profileMenu}
            role="menu"
            style={{ top: profileMenuPos.top, right: profileMenuPos.right }}
          >
            <Link href="/profile" className={styles.profileMenuLink} role="menuitem" onClick={() => setProfileMenu(false)}>
              <UserRound size={16} /> {t.editProfile}
            </Link>
            <Link href="/" className={styles.profileMenuLink} role="menuitem" onClick={() => setProfileMenu(false)}>
              <Home size={16} /> {pääsivuLabel}
            </Link>
            <Link href="/garage" className={styles.profileMenuLink} role="menuitem" onClick={() => setProfileMenu(false)}>
              <Car size={16} /> {t.garageTitle}
            </Link>
            <Link href="/messages" className={styles.profileMenuLink} role="menuitem" onClick={() => setProfileMenu(false)}>
              <Mail size={16} /> {t.messages}
            </Link>
            <Link href="/saved" className={styles.profileMenuLink} role="menuitem" onClick={() => setProfileMenu(false)}>
              <Heart size={16} /> {t.savedListings}
            </Link>
            <Link href="/search-alerts" className={styles.profileMenuLink} role="menuitem" onClick={() => setProfileMenu(false)}>
              <Bell size={16} /> {t.saTitle}
            </Link>
            <Link href="/rewards" className={styles.profileMenuLink} role="menuitem" onClick={() => setProfileMenu(false)}>
              <Award size={16} /> {t.rewards}
            </Link>
            <Link href="/shop" className={styles.profileMenuLink} role="menuitem" onClick={() => setProfileMenu(false)}>
              <Store size={16} /> {t.shop}
            </Link>
            {isAdmin && (
              <Link href="/admin" className={styles.profileMenuLink} role="menuitem" onClick={() => setProfileMenu(false)}>
                <LockKeyhole size={16} /> Admin
              </Link>
            )}
            <button
              type="button"
              className={styles.profileMenuSignOut}
              onClick={handleSignOut}
            >
              <DoorOpen size={16} /> {t.signOut}
            </button>
          </div>,
          document.body
        )}

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

          {filteredListings.length === 0 ? (
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

                const subcategories =
                  categories[
                    listingForm.category as keyof typeof categories
                  ] ?? [];

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

                        {(() => {
                          const sepIdx = listingForm.title.indexOf(" - ");
                          const partName = sepIdx >= 0 ? listingForm.title.slice(0, sepIdx) : listingForm.title;
                          const lockedSuffix = sepIdx >= 0 ? listingForm.title.slice(sepIdx + 3) : "";
                          return (
                            <div className="own-listing-title-fields">
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
                              {lockedSuffix && (
                                <input
                                  className="own-listing-locked-input"
                                  value={lockedSuffix}
                                  readOnly
                                  disabled
                                  aria-label="Merkki, malli ja vuosimalli (ei muokattavissa)"
                                />
                              )}
                            </div>
                          );
                        })()}

                        <input
                          className="own-listing-price-input"
                          type="number"
                          value={listingForm.price}
                          onChange={(event) =>
                            setListingForm({
                              ...listingForm,
                              price: event.target.value
                            })
                          }
                          placeholder={t.price}
                        />

                        <input
                          className="own-listing-part-input"
                          value={listingForm.part_number}
                          onChange={(event) =>
                            setListingForm({
                              ...listingForm,
                              part_number: event.target.value
                            })
                          }
                          placeholder="Varaosanumero / OEM-numero"
                        />

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
                          {Object.keys(categories)
                            .filter(
                              (category) =>
                                category !== "Kaikki"
                            )
                            .map((category) => (
                              <option
                                key={category}
                                value={category}
                              >
                                {translateCategory(locale, category)}
                              </option>
                            ))}
                        </select>

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

                        <div className="own-listing-location-pair">
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
                        </div>

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
                                <img src={img} alt={`Kuva ${index + 1}`} />
                                <button
                                  type="button"
                                  aria-label="Poista kuva"
                                  onClick={() => removeListingImage(index)}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <textarea
                          value={listingForm.description}
                          onChange={(event) =>
                            setListingForm({
                              ...listingForm,
                              description: event.target.value
                            })
                          }
                          placeholder={t.description}
                        />

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
                            <img
                              className={styles.rowImage}
                              src={listing.image_url}
                              alt={listing.title}
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
                  style={{ marginTop: 6, width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "0.95rem" }}
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
