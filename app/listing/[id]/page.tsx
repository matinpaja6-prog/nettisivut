"use client";

import type { MouseEvent, TouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import OptimizedListingImage from "@/app/components/OptimizedListingImage";
import homeStyles from "@/app/page.module.css";

import {
  Building2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Mail,
  MapPin,
  Globe2,
  Package,
  ShieldCheck,
  Phone,
  Heart,
  LockKeyhole,
  Share2,
  Star,
  UserRound,
  X,
  ZoomIn
} from "lucide-react";

import {
  fallbackListings,
  formatPrice,
  getListingPartNumber,
  type Listing
} from "@/lib/listings";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { readCachedListing, readCachedListings, writeCachedListings } from "@/lib/client-listings-cache";
import { useLanguage, translateCategory, type Locale } from "@/lib/i18n";
import { formatLocationWithCountry, getCountryFlagFromLocation } from "@/lib/country-flags";

import { trackListingView, setRecoUserId } from "@/lib/recommendations";

import {
  getSavedListingIds,
  getListingById,
  getListingDisplayNumber,
  getListings,
  incrementListingView,
  saveListing,
  supabase,
  trackUserActivity,
  unsaveListing
} from "@/lib/supabase";

const listingUiText = {
  fi: {
    loading: "Ladataan...",
    notFound: "Ei löytynyt",
    linkCopied: "Linkki kopioitu!",
    back: "Takaisin",
    forSale: "Myynnissä",
    part: "Varaosa",
    updated: "Päivitetty",
    imageSingular: "kuva",
    imagePlural: "kuvaa",
    share: "Jaa",
    saved: "Tallennettu",
    save: "Tallenna",
    description: "Kuvaus",
    basicInfo: "Perustiedot",
    additionalInfo: "Lisätiedot",
    noDescription: "Ei kuvausta.",
    vehicle: "Ajoneuvo",
    partNumber: "Varaosanumero",
    brand: "Merkki",
    model: "Malli",
    brandModel: "Merkki ja malli",
    year: "Vuosimalli",
    condition: "Kunto",
    location: "Sijainti",
    notSpecified: "Ei ilmoitettu",
    seller: "Myyjä",
    fallbackSeller: "Myyjä",
    verified: "Tunnistettu",
    sellers: "Myyjät",
    map: "Kartta",
    website: "WWW-sivut",
    openSellerProfile: (name: string) => `Avaa myyjän ${name} julkinen profiili`,
    viewProfile: "Katso profiili",
    contactHeading: "Kysyttävää kohteesta?",
    sendMessage: "Lähetä viesti",
    fetchingPhone: "Haetaan numeroa...",
    showPhone: "Näytä numero",
    missingPhone: "Numero puuttuu",
    loginContact: "Kirjaudu nähdäksesi yhteystiedot"
  },
  en: {
    loading: "Loading...",
    notFound: "Not found",
    linkCopied: "Link copied!",
    back: "Back",
    forSale: "For sale",
    part: "Part",
    updated: "Updated",
    imageSingular: "image",
    imagePlural: "images",
    share: "Share",
    saved: "Saved",
    save: "Save",
    description: "Description",
    basicInfo: "Basic information",
    additionalInfo: "Additional details",
    noDescription: "No description.",
    vehicle: "Vehicle",
    partNumber: "Part number",
    brand: "Brand",
    model: "Model",
    brandModel: "Brand and model",
    year: "Year",
    condition: "Condition",
    location: "Location",
    notSpecified: "Not specified",
    seller: "Seller",
    fallbackSeller: "Seller",
    verified: "Verified",
    sellers: "Sellers",
    map: "Map",
    website: "Website",
    openSellerProfile: (name: string) => `Open ${name}'s public seller profile`,
    viewProfile: "View profile",
    contactHeading: "Questions about this listing?",
    sendMessage: "Send message",
    fetchingPhone: "Fetching number...",
    showPhone: "Show number",
    missingPhone: "Number missing",
    loginContact: "Log in to see contact details"
  },
  sv: {
    loading: "Laddar...",
    notFound: "Hittades inte",
    linkCopied: "Länken kopierad!",
    back: "Tillbaka",
    forSale: "Till salu",
    part: "Reservdel",
    updated: "Uppdaterad",
    imageSingular: "bild",
    imagePlural: "bilder",
    share: "Dela",
    saved: "Sparad",
    save: "Spara",
    description: "Beskrivning",
    basicInfo: "Grunduppgifter",
    additionalInfo: "Tilläggsinformation",
    noDescription: "Ingen beskrivning.",
    vehicle: "Fordon",
    partNumber: "Artikelnummer",
    brand: "Märke",
    model: "Modell",
    brandModel: "Märke och modell",
    year: "Årsmodell",
    condition: "Skick",
    location: "Plats",
    notSpecified: "Ej angivet",
    seller: "Säljare",
    fallbackSeller: "Säljare",
    verified: "Verifierad",
    sellers: "Säljare",
    map: "Karta",
    website: "Webbplats",
    openSellerProfile: (name: string) => `Öppna ${name}s offentliga säljarprofil`,
    viewProfile: "Visa profil",
    contactHeading: "Frågor om annonsen?",
    sendMessage: "Skicka meddelande",
    fetchingPhone: "Hämtar nummer...",
    showPhone: "Visa nummer",
    missingPhone: "Nummer saknas",
    loginContact: "Logga in för att se kontaktuppgifter"
  },
  no: {
    loading: "Laster...",
    notFound: "Ikke funnet",
    linkCopied: "Lenken er kopiert!",
    back: "Tilbake",
    forSale: "Til salgs",
    part: "Del",
    updated: "Oppdatert",
    imageSingular: "bilde",
    imagePlural: "bilder",
    share: "Del",
    saved: "Lagret",
    save: "Lagre",
    description: "Beskrivelse",
    basicInfo: "Grunnopplysninger",
    additionalInfo: "Tilleggsinformasjon",
    noDescription: "Ingen beskrivelse.",
    vehicle: "Kjøretøy",
    partNumber: "Delenummer",
    brand: "Merke",
    model: "Modell",
    brandModel: "Merke og modell",
    year: "Årsmodell",
    condition: "Tilstand",
    location: "Sted",
    notSpecified: "Ikke oppgitt",
    seller: "Selger",
    fallbackSeller: "Selger",
    verified: "Verifisert",
    sellers: "Selgere",
    map: "Kart",
    website: "Nettside",
    openSellerProfile: (name: string) => `Åpne den offentlige selgerprofilen til ${name}`,
    viewProfile: "Vis profil",
    contactHeading: "Spørsmål om annonsen?",
    sendMessage: "Send melding",
    fetchingPhone: "Henter nummer...",
    showPhone: "Vis nummer",
    missingPhone: "Nummer mangler",
    loginContact: "Logg inn for å se kontaktopplysninger"
  },
  et: {
    loading: "Laadin...",
    notFound: "Ei leitud",
    linkCopied: "Link kopeeritud!",
    back: "Tagasi",
    forSale: "Müügis",
    part: "Varuosa",
    updated: "Uuendatud",
    imageSingular: "pilt",
    imagePlural: "pilti",
    share: "Jaga",
    saved: "Salvestatud",
    save: "Salvesta",
    description: "Kirjeldus",
    basicInfo: "Põhiandmed",
    additionalInfo: "Lisainfo",
    noDescription: "Kirjeldus puudub.",
    vehicle: "Sõiduk",
    partNumber: "Varuosanumber",
    brand: "Mark",
    model: "Mudel",
    brandModel: "Mark ja mudel",
    year: "Aasta",
    condition: "Seisukord",
    location: "Asukoht",
    notSpecified: "Pole märgitud",
    seller: "Müüja",
    fallbackSeller: "Müüja",
    verified: "Kinnitatud",
    sellers: "Müüjad",
    map: "Kaart",
    website: "Veebileht",
    openSellerProfile: (name: string) => `Ava müüja ${name} avalik profiil`,
    viewProfile: "Vaata profiili",
    contactHeading: "Küsimusi kuulutuse kohta?",
    sendMessage: "Saada sõnum",
    fetchingPhone: "Laadin numbrit...",
    showPhone: "Näita numbrit",
    missingPhone: "Number puudub",
    loginContact: "Kontaktandmete nägemiseks logi sisse"
  }
} satisfies Record<Locale, Record<string, string | ((name: string) => string)>>;

const conditionLabels: Record<Locale, Record<string, string>> = {
  fi: {},
  en: { Hyvä: "Good", Uusi: "New", "Kuin uusi": "Like new", Tyydyttävä: "Fair", Heikko: "Poor" },
  sv: { Hyvä: "Bra", Uusi: "Ny", "Kuin uusi": "Som ny", Tyydyttävä: "Godtagbar", Heikko: "Dålig" },
  no: { Hyvä: "God", Uusi: "Ny", "Kuin uusi": "Som ny", Tyydyttävä: "Greit", Heikko: "Dårlig" },
  et: { Hyvä: "Hea", Uusi: "Uus", "Kuin uusi": "Nagu uus", Tyydyttävä: "Rahuldav", Heikko: "Kehv" }
};

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function getSimilarListingScore(current: Listing, candidate: Listing) {
  let score = 0;

  if (normalizeComparable(current.subcategory) && normalizeComparable(current.subcategory) === normalizeComparable(candidate.subcategory)) score += 5;
  if (normalizeComparable(current.category) && normalizeComparable(current.category) === normalizeComparable(candidate.category)) score += 3;
  if (normalizeComparable(current.vehicle_type) && normalizeComparable(current.vehicle_type) === normalizeComparable(candidate.vehicle_type)) score += 2;
  if (normalizeComparable(current.brand) && normalizeComparable(current.brand) === normalizeComparable(candidate.brand)) score += 1;
  if (normalizeComparable(current.model) && normalizeComparable(current.model) === normalizeComparable(candidate.model)) score += 1;
  if (normalizeComparable(current.year) && normalizeComparable(current.year) === normalizeComparable(candidate.year)) score += 1;

  return score;
}

const dateLocales: Record<Locale, string> = {
  fi: "fi-FI",
  en: "en-US",
  sv: "sv-SE",
  no: "nb-NO",
  et: "et-EE"
};

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(dateLocales[locale], {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(date);
}

function isListingNew(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;

  return Date.now() - created < 24 * 60 * 60 * 1000;
}

function listingImageSrc(listing: Listing) {
  return (
    listing.image_url ||
    listing.image_urls?.find(Boolean) ||
    null
  );
}

function readSavedListingIds() {
  try {
    const savedListings = JSON.parse(
      localStorage.getItem("savedListings") || "[]"
    );

    return Array.isArray(savedListings)
      ? savedListings.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function formatLocation(value: string | null | undefined) {
  return (value || "")
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : "";
    })
    .filter(Boolean)
    .join(", ");
}

export default function ListingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLanguage();
  const ui = listingUiText[locale];
  const fallbackCountry = locale === "et" ? "Soome" : locale === "fi" ? "Suomi" : "Finland";

  const [listing, setListing] =
    useState<Listing | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [activeImage, setActiveImage] =
    useState<string | null>(null);

  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  const [basicInfoOpen, setBasicInfoOpen] =
    useState(false);

  const [additionalInfoOpen, setAdditionalInfoOpen] =
    useState(true);

  const [showPhone, setShowPhone] =
    useState(false);

  const [sellerPhone, setSellerPhone] =
    useState("");

  const [sellerWebsite, setSellerWebsite] =
    useState<string | null>(null);

  const [sellerBusinessId, setSellerBusinessId] =
    useState<string | null>(null);

  const [sellerProfileAvatarUrl, setSellerProfileAvatarUrl] =
    useState<string | null>(null);

  const [sellerAccountType, setSellerAccountType] =
    useState<"company" | "private" | null>(null);

  const [sellerProfileCreatedAt, setSellerProfileCreatedAt] =
    useState<string | null>(null);

  const [sellerReviewAverage, setSellerReviewAverage] =
    useState<number | null>(null);

  const [sellerReviewCount, setSellerReviewCount] =
    useState<number | null>(null);

  const [sellerSoldCount, setSellerSoldCount] =
    useState<number | null>(null);

  const [phoneLoading, setPhoneLoading] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [savedListingIds, setSavedListingIds] =
    useState<string[]>([]);

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const [listingDisplayNumber, setListingDisplayNumber] =
    useState<number | null>(null);

  const [similarListings, setSimilarListings] =
    useState<Listing[]>([]);

  const swipeStartXRef =
    useRef<number | null>(null);

  const swipeMovedRef =
    useRef(false);

  const sellerIdForPublicStats =
    listing?.seller_id ?? null;

  useEffect(() => {
    if (!previewImage) return;

    const scrollY = window.scrollY;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    }

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setIsLoggedIn(Boolean(data.session?.user));
          setRecoUserId(data.session?.user?.id ?? null);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoggedIn(false);
          setRecoUserId(null);
        }
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(Boolean(session?.user));
        setRecoUserId(session?.user?.id ?? null);
        if (!session?.user) {
          setShowPhone(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    setListingDisplayNumber(null);

    const cached =
      readCachedListing(params.id);
    const fallback =
      fallbackListings.find(
        (i) => i.id === params.id
      ) ?? null;
    const initialListing = cached ?? fallback;

    if (initialListing) {
      setListing(initialListing);
      setLoading(false);
    }

    getListingById(params.id)
      .then(({ data }) => {
        if (mounted) {
          const resolved = data ?? fallback;
          setListing(resolved);
          trackListingView(resolved);
          if (resolved) {
            void trackUserActivity({
              vehicle_type: resolved.vehicle_type,
              brand: resolved.brand,
              model: resolved.model,
              category: resolved.category
            });
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setListing(fallback);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!supabase || !sellerIdForPublicStats) {
      setSellerWebsite(null);
      setSellerBusinessId(null);
      setSellerProfileAvatarUrl(null);
      setSellerAccountType(null);
      setSellerProfileCreatedAt(null);
      setSellerReviewAverage(null);
      setSellerReviewCount(null);
      setSellerSoldCount(null);
      return;
    }

    let mounted = true;

    async function loadSellerWebsite() {
      try {
        const [
          profileResult,
          reviewsResult,
          soldListingsResult,
          legacySoldListingsResult
        ] = await Promise.all([
          supabase!
            .from("profiles")
            .select("company_website,business_id,account_type,created_at,avatar_url")
            .eq("id", sellerIdForPublicStats)
            .maybeSingle<{
              company_website?: string | null;
              business_id?: string | null;
              account_type?: "company" | "private" | null;
              created_at?: string | null;
              avatar_url?: string | null;
            }>(),
          supabase!
            .from("seller_reviews")
            .select("rating")
            .eq("seller_id", sellerIdForPublicStats)
            .returns<Array<{ rating: number | null }>>(),
          supabase!
            .from("sold_listings")
            .select("id", { count: "exact", head: true })
            .eq("seller_id", sellerIdForPublicStats),
          supabase!
            .from("listings")
            .select("id", { count: "exact", head: true })
            .eq("seller_id", sellerIdForPublicStats)
            .eq("is_sold", true)
        ]);

        if (!mounted) return;
        const data = profileResult.data;
        const ratings =
          reviewsResult.error
            ? null
            : (reviewsResult.data ?? [])
              .map((review) => Number(review.rating))
              .filter((rating) => Number.isFinite(rating));
        const soldListingsCount =
          !soldListingsResult.error && typeof soldListingsResult.count === "number"
            ? soldListingsResult.count
            : null;
        const legacySoldListingsCount =
          !legacySoldListingsResult.error && typeof legacySoldListingsResult.count === "number"
            ? legacySoldListingsResult.count
            : null;

        setSellerWebsite(data?.company_website?.trim() || null);
        setSellerBusinessId(data?.business_id?.trim() || null);
        setSellerProfileAvatarUrl(data?.avatar_url?.trim() || null);
        setSellerAccountType(data?.account_type ?? null);
        setSellerProfileCreatedAt(data?.created_at ?? null);
        setSellerReviewCount(ratings ? ratings.length : null);
        setSellerReviewAverage(
          ratings && ratings.length > 0
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : null
        );
        setSellerSoldCount(
          soldListingsCount !== null
            ? Math.max(soldListingsCount, legacySoldListingsCount ?? 0)
            : legacySoldListingsCount && legacySoldListingsCount > 0
              ? legacySoldListingsCount
              : null
        );
      } catch {
        if (mounted) {
          setSellerWebsite(null);
          setSellerBusinessId(null);
          setSellerProfileAvatarUrl(null);
          setSellerAccountType(null);
          setSellerProfileCreatedAt(null);
          setSellerReviewAverage(null);
          setSellerReviewCount(null);
          setSellerSoldCount(null);
        }
      }
    }

    void loadSellerWebsite();

    return () => {
      mounted = false;
    };
  }, [sellerIdForPublicStats]);

  useEffect(() => {
    if (!listing) {
      setSimilarListings([]);
      return;
    }

    const currentListing = listing;
    let mounted = true;

    async function loadSimilarListings() {
      const cachedListings = readCachedListings();
      const { data } = cachedListings.length > 0
        ? { data: cachedListings }
        : await getListings({
            includeOptionalFields: false,
            limit: 240
          });
      const source = data.length > 0 ? data : fallbackListings;

      if (data.length > 0) {
        writeCachedListings(data);
      }

      const ranked = source
        .filter((candidate) =>
          candidate.id !== currentListing.id &&
          !candidate.is_sold &&
          !candidate.is_hidden
        )
        .map((candidate) => ({
          candidate,
          score: getSimilarListingScore(currentListing, candidate)
        }))
        .filter(({ score }) => score >= 5)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(b.candidate.created_at).getTime() - new Date(a.candidate.created_at).getTime();
        })
        .slice(0, 4)
        .map(({ candidate }) => candidate);

      if (mounted) {
        setSimilarListings(ranked);
      }
    }

    void loadSimilarListings();

    return () => {
      mounted = false;
    };
  }, [listing]);

  useEffect(() => {
    if (!listing?.id) {
      return;
    }

    const storageKey =
      `listing-viewed:${listing.id}`;

    const viewedAt =
      typeof window !== "undefined"
        ? Number(sessionStorage.getItem(storageKey) || 0)
        : 0;

    if (
      typeof window !== "undefined" &&
      Date.now() - viewedAt < 5000
    ) {
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        storageKey,
        String(Date.now())
      );
    }

    void incrementListingView(listing.id);
  }, [listing?.id]);

  const gallery = useMemo(() => {
    if (!listing) return [];

    const seen = new Set<string>();
    return [
      listing.image_url,
      ...(listing.image_urls ?? [])
    ]
      .filter(Boolean)
      .filter((url) => {
        const normalized = String(url).split("?")[0].trim();
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      }) as string[];
  }, [listing]);

  useEffect(() => {
    if (gallery.length) {
      setActiveImage(gallery[0]);
    }
  }, [gallery]);

  const activeImageIndex =
    activeImage ? gallery.indexOf(activeImage) : -1;
  const activeImageNumber =
    activeImageIndex >= 0 ? activeImageIndex + 1 : 1;

  const switchGalleryImage = (direction: 1 | -1) => {
    if (gallery.length < 2) return;

    const currentIndex =
      activeImageIndex >= 0 ? activeImageIndex : 0;
    const nextIndex =
      (currentIndex + direction + gallery.length) % gallery.length;
    const nextImage = gallery[nextIndex];

    setActiveImage(nextImage);

    if (previewImage) {
      setPreviewImage(nextImage);
    }
  };

  const startImageSwipe = (event: TouchEvent) => {
    swipeStartXRef.current =
      event.touches[0]?.clientX ?? null;
  };

  const finishImageSwipe = (event: TouchEvent) => {
    const startX = swipeStartXRef.current;

    if (startX === null) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const distance = endX - startX;

    swipeStartXRef.current = null;

    if (Math.abs(distance) < 38) return;

    swipeMovedRef.current = true;
    switchGalleryImage(distance < 0 ? 1 : -1);
  };

  useEffect(() => {
    if (!listing) return;

    let mounted = true;

    getListingDisplayNumber(listing.created_at, listing.listing_number)
      .then((number) => {
        if (mounted) {
          setListingDisplayNumber(number);
        }
      })
      .catch(() => {
        if (mounted) {
          setListingDisplayNumber(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [listing]);

  useEffect(() => {
    if (!listing) return;

    const localSavedIds = readSavedListingIds();
    setSavedListingIds(localSavedIds);
    setSaved(localSavedIds.includes(listing.id));
    getSavedListingIds()
      .then(({ data }) => {
        if (data.length > 0) {
          localStorage.setItem("savedListings", JSON.stringify(data));
          setSavedListingIds(data);
          setSaved(data.includes(listing.id));
        }
      })
      .catch(() => undefined);
  }, [listing]);

  useEffect(() => {
    function syncSavedState() {
      if (!listing) return;
      const localSavedIds = readSavedListingIds();
      setSavedListingIds(localSavedIds);
      setSaved(localSavedIds.includes(listing.id));
    }

    window.addEventListener("focus", syncSavedState);
    window.addEventListener("storage", syncSavedState);

    return () => {
      window.removeEventListener("focus", syncSavedState);
      window.removeEventListener("storage", syncSavedState);
    };
  }, [listing]);

  function toggleSave() {
    if (!listing) return;

    const savedListings = readSavedListingIds();
    const isCurrentlySaved =
      saved || savedListings.includes(listing.id);

    const updated = isCurrentlySaved
      ? savedListings.filter((id) => id !== listing.id)
      : [...savedListings, listing.id];

    localStorage.setItem(
      "savedListings",
      JSON.stringify(updated)
    );

    setSaved(updated.includes(listing.id));
    setSavedListingIds(updated);

    void (
      isCurrentlySaved
        ? unsaveListing(listing.id)
        : saveListing(listing.id)
    );
  }

  function toggleSimilarSave(
    event: MouseEvent<HTMLButtonElement>,
    listingId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    const savedListings = readSavedListingIds();
    const isCurrentlySaved = savedListings.includes(listingId);
    const updated = isCurrentlySaved
      ? savedListings.filter((id) => id !== listingId)
      : [...savedListings, listingId];

    localStorage.setItem("savedListings", JSON.stringify(updated));
    setSavedListingIds(updated);

    if (listing?.id === listingId) {
      setSaved(updated.includes(listingId));
    }

    void (
      isCurrentlySaved
        ? unsaveListing(listingId)
        : saveListing(listingId)
    );
  }

  function openSimilarListing(listingId: string) {
    router.push(`/listing/${listingId}`);
  }

  async function shareListing() {
    if (!listing) return;

    const url = window.location.href;
    const listingText = getLocalizedListingText(listing, locale);

    if (navigator.share) {
      try {
        await navigator.share({
          title: listingText.title,
          text: listingText.title,
          url
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert(ui.linkCopied);
    }
  }

  async function handleShowPhone() {
    if (!listing) return;

    if (listing.seller_phone) {
      setSellerPhone(listing.seller_phone);
      setShowPhone(true);
      return;
    }

    if (!supabase || !listing.seller_id) {
      setSellerPhone("");
      setShowPhone(true);
      return;
    }

    setPhoneLoading(true);

    const { data } =
      await supabase
        .from("profiles")
        .select("phone")
        .eq("id", listing.seller_id)
        .maybeSingle<{ phone?: string | null }>();

    const nextPhone =
      data?.phone || "";

    setSellerPhone(nextPhone);
    setListing({
      ...listing,
      seller_phone:
        nextPhone || null
    });
    setShowPhone(true);
    setPhoneLoading(false);
  }

  if (loading) {
    return (
      <div className="loading">
        {ui.loading}
      </div>
    );
  }

  if (!listing) {
    return <div>{ui.notFound}</div>;
  }

  const sellerProfileId =
    listing.seller_id || listing.user_id;
  const sellerHref =
    sellerProfileId
      ? `/seller/${sellerProfileId}?returnTo=${encodeURIComponent(`/listing/${params.id}`)}`
      : "#";
  const isCompanySeller =
    Boolean(listing.company_name);
  const sellerDisplayName =
    listing.company_name || listing.seller_name || ui.fallbackSeller;
  const companySellerNames =
    isCompanySeller &&
    listing.seller_name &&
    listing.seller_name !== listing.company_name
      ? listing.seller_name
      : "";
  const sellerInitial =
    (sellerDisplayName || "M").trim().slice(0, 1).toUpperCase();
  const sellerWebsiteUrl = (() => {
    const trimmed = sellerWebsite?.trim();
    if (!trimmed) return null;
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(href);
      return {
        href: url.toString(),
        label: url.hostname.replace(/^www\./i, "")
      };
    } catch {
      return null;
    }
  })();
  const vehicleTypeMap: Record<Locale, Record<string, string>> = {
    fi: {},
    en: { Moottorikelkka: "Snowmobile", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
    sv: { Moottorikelkka: "Snöskoter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
    no: { Moottorikelkka: "Snøscooter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
    et: { Moottorikelkka: "Mootorsaan", Mönkijä: "ATV", Motocross: "Motokross", Mopot: "Mopeed" }
  };
  const baseListingText = getLocalizedListingText(listing, locale);
  const listingPartNumber = getListingPartNumber(listing);
  const translateConditionLabel = (value: string | null | undefined) =>
    value ? conditionLabels[locale][value] ?? value : ui.notSpecified;
  const translateVehicleTypeLabel = (value: string | null | undefined) =>
    value ? vehicleTypeMap[locale]?.[value] ?? value : ui.notSpecified;
  const listingBrandModel =
    [listing.brand, listing.model]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ");
  const listingLocation = formatLocation(formatLocationWithCountry(listing.location, fallbackCountry));
  const sellerMemberYear =
    sellerProfileCreatedAt
      ? new Date(sellerProfileCreatedAt).getFullYear()
      : null;
  const hasSellerReviewStats = sellerReviewCount !== null;
  const hasSellerSoldStats = sellerSoldCount !== null;
  const sellerStatsCount =
    Number(hasSellerReviewStats) + Number(hasSellerSoldStats);
  const sellerAccountTypeLabel =
    sellerAccountType === "company"
      ? "Yritys"
      : sellerAccountType === "private"
        ? "Yksityinen myyjä"
        : null;
  const showSellerBusinessId = sellerAccountType !== "private";
  const listingText = (() => {
    if (locale === "fi") return baseListingText;
    const leaf = listing.subcategory?.split("/").map((p) => p.trim()).filter(Boolean).at(-1);
    const isGenerated = leaf && listing.vehicle_type &&
      listing.title.trim().toLowerCase() === `${leaf} - ${listing.vehicle_type}`.trim().toLowerCase();
    if (!isGenerated) return baseListingText;
    const tSub = translateCategory(locale, listing.subcategory ?? "");
    const tLeaf = tSub.split("/").map((p) => p.trim()).filter(Boolean).at(-1) || translateCategory(locale, leaf);
    const tVehicle = vehicleTypeMap[locale]?.[listing.vehicle_type ?? ""] ?? listing.vehicle_type ?? "";
    return { ...baseListingText, title: `${tLeaf} - ${tVehicle}`.trim() };
  })();
  const descriptionWithoutVehicleMeta =
    (listingText.description || "")
      .replace(/^(?:Ajoneuvo:[^\n]*\n?)?(?:Merkki:[^\n]*\n?)?(?:Malli:[^\n]*\n?)?(?:Vuosimalli:[^\n]*\n?)?/i, "")
      .replace(/Ajoneuvo:\s*\S+\s+Merkki:\s*[^\s]+(?:\s+\S+)?\s+Malli:\s*[^\s]+(?:\s+\S+)*?\s+Vuosimalli:\s*\d+\s*/i, "")
      .trim();
  const listingDeliveryMethod =
    descriptionWithoutVehicleMeta.match(/(?:^|\n)Toimitustapa:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const listingVehicleSubtype =
    listing.vehicle_subtype?.trim() ||
    descriptionWithoutVehicleMeta.match(/(?:^|\n)Ajoneuvotyyppi:\s*([^\n]+)/i)?.[1]?.trim() ||
    "";
  const listingDescription =
    descriptionWithoutVehicleMeta
      .replace(/(?:^|\n)Ajoneuvotyyppi:\s*[^\n]+/i, "")
      .replace(/(?:^|\n)Toimitustapa:\s*[^\n]+/i, "")
      .trim() || ui.noDescription;
  const sellerAvatarUrl = listing.seller_avatar_url || sellerProfileAvatarUrl;

  return (
    <main className="page listing-detail-page">
      <div className="container">

        <section className="layout">

          {/* LEFT */}

          <div className="main">

            <div className="title-row">

              <div className="title-left">
                <span className="mobile-listing-id">
                  <span>ID {listingDisplayNumber ?? "..."}</span>
                </span>

                <h1>{listingText.title}</h1>

              </div>

              <div className="mobile-title-actions">
                <span className="mobile-title-price">{formatPrice(listing.price)}</span>
                <button
                  onClick={shareListing}
                  className="icon-btn"
                  title={ui.share}
                  aria-label={ui.share}
                >
                  <Share2 size={20} />
                </button>

                <button
                  onClick={toggleSave}
                  className={`icon-btn ${
                    saved ? "icon-saved" : ""
                  }`}
                  title={saved ? ui.saved : ui.save}
                  aria-label={saved ? ui.saved : ui.save}
                >
                  <Heart
                    size={20}
                    fill={
                      saved
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              </div>

            </div>

            {/* IMAGE */}

            <div className="desktop-image-meta">
              <span>
                {ui.updated} {formatDate(listing.created_at, locale)}
              </span>
              <span className="dot">•</span>
              <span className="desktop-meta-location">
                {listingLocation}
                <MapPin size={15} />
              </span>
              <strong>ID {listingDisplayNumber ?? "..."}</strong>
            </div>

            <div className="image-wrapper">

              {activeImage && (
                <button
                  type="button"
                  className="main-img-button"
                  onClick={() => {
                    if (swipeMovedRef.current) {
                      swipeMovedRef.current = false;
                      return;
                    }

                    setPreviewImage(activeImage);
                  }}
                  onTouchStart={startImageSwipe}
                  onTouchEnd={finishImageSwipe}
                  aria-label="Avaa kuva suurempana"
                >
                  <span className="listing-image-soft-bg" aria-hidden="true">
                    <OptimizedListingImage
                      src={activeImage}
                      alt=""
                      decorative
                      sizes="(max-width: 900px) 100vw, 760px"
                    />
                  </span>
                  <OptimizedListingImage
                    src={activeImage}
                    className="main-img"
                    alt={listingText.title}
                    priority
                    sizes="(max-width: 900px) 100vw, 760px"
                  />
                </button>
              )}

              <div className="image-badge">
                {activeImageNumber}/{gallery.length}
              </div>

              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    className="gallery-arrow gallery-arrow-left"
                    onClick={() => switchGalleryImage(-1)}
                    aria-label="Edellinen kuva"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    className="gallery-arrow gallery-arrow-right"
                    onClick={() => switchGalleryImage(1)}
                    aria-label="Seuraava kuva"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}

              {activeImage && (
                <button
                  type="button"
                  className="image-zoom-button"
                  onClick={() => setPreviewImage(activeImage)}
                  aria-label="Avaa kuva suurempana"
                >
                  <ZoomIn size={20} />
                </button>
              )}

              <div className="mobile-image-actions">
                <button
                  onClick={shareListing}
                  className="icon-btn"
                  title={ui.share}
                >
                  <Share2 size={20} />
                </button>

                <button
                  onClick={toggleSave}
                  className={`icon-btn ${
                    saved ? "icon-saved" : ""
                  }`}
                  title={saved ? ui.saved : ui.save}
                >
                  <Heart
                    size={20}
                    fill={
                      saved
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              </div>

              {gallery.length > 1 && (
                <div className="mobile-image-thumbs" aria-label="Ilmoituksen kuvat">
                  {gallery.map((url, index) => (
                    <button
                      key={`${url}-mobile-${index}`}
                      type="button"
                      className={activeImage === url ? "active" : ""}
                      onClick={() => setActiveImage(url)}
                      aria-label={`Kuva ${index + 1}/${gallery.length}`}
                    >
                      <OptimizedListingImage
                        src={url}
                        alt=""
                        decorative
                        sizes="72px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {gallery.length > 0 && (
              <div className="desktop-image-thumbs" aria-label="Ilmoituksen kuvat">
                {gallery.map((url, index) => (
                  <button
                    key={`${url}-desktop-${index}`}
                    type="button"
                    className={activeImage === url ? "active" : ""}
                    onClick={() => setActiveImage(url)}
                    aria-label={`Kuva ${index + 1}/${gallery.length}`}
                  >
                    <OptimizedListingImage
                      src={url}
                      alt=""
                      decorative
                      sizes="120px"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* PRICE + ACTIONS ROW */}

            <div className="price-actions-row">

              <div className="image-actions">

                <span className="price-stack">
                  <span className="price-display">
                    {formatPrice(listing.price)}
                  </span>
                  <span className="price-subline">
                  </span>
                </span>

                <div className="listing-bottom-actions">
                  <button
                    onClick={shareListing}
                    className="icon-btn"
                    title={ui.share}
                    aria-label={ui.share}
                  >
                    <Share2 size={20} />
                  </button>

                  <button
                    onClick={toggleSave}
                    className={`icon-btn ${
                      saved ? "icon-saved" : ""
                    }`}
                    title={saved ? ui.saved : ui.save}
                    aria-label={saved ? ui.saved : ui.save}
                  >
                    <Heart
                      size={20}
                      fill={
                        saved
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                </div>

              </div>

            </div>

            {/* DETAILS */}

            <div className="description-card listing-facts-card">

              <button
                type="button"
                className="listing-section-toggle"
                aria-expanded={additionalInfoOpen}
                onClick={() => setAdditionalInfoOpen((open) => !open)}
              >
                <span>{ui.description}</span>
                {additionalInfoOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              <div className={additionalInfoOpen ? "listing-section-content" : "listing-section-content is-collapsed"}>
                <p>{listingDescription}</p>
              </div>

            </div>

            <div className="description-card listing-extra-card">

              <button
                type="button"
                className="listing-section-toggle"
                aria-expanded={basicInfoOpen}
                onClick={() => setBasicInfoOpen((open) => !open)}
              >
                <span>{ui.basicInfo}</span>
                {basicInfoOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              <div className={basicInfoOpen ? "listing-section-content" : "listing-section-content is-collapsed"}>

              <div className="listing-fact-grid">
                <span>
                  <strong>{ui.vehicle}</strong>
                  {translateVehicleTypeLabel(listing.vehicle_type)}
                </span>
                <span>
                  <strong>Ajoneuvotyyppi</strong>
                  {listingVehicleSubtype || ui.notSpecified}
                </span>
                {listingPartNumber && (
                  <span>
                    <strong>{ui.partNumber}</strong>
                    {listingPartNumber}
                  </span>
                )}
                <span>
                  <strong>{ui.brandModel}</strong>
                  {listingBrandModel || ui.notSpecified}
                </span>
                <span>
                  <strong>{ui.year}</strong>
                  {listing.year || ui.notSpecified}
                </span>
                <span>
                  <strong>{ui.condition}</strong>
                  {translateConditionLabel(listing.condition)}
                </span>
                <span>
                  <strong>Toimitus</strong>
                  {listingDeliveryMethod || ui.notSpecified}
                </span>
              </div>

              </div>

            </div>

          </div>

          {/* RIGHT */}

          <aside className="sidebar">

            {/* SELLER */}

            <div className="seller-card">

              <div className="seller-card-body seller-card-panel">
                <div className="seller-card-top">
                  {sellerAccountTypeLabel ? (
                    <div className="seller-type-corner">
                      <ShieldCheck size={14} />
                      <strong>{sellerAccountTypeLabel}</strong>
                    </div>
                  ) : (
                    <div className="seller-card-label">{ui.seller}</div>
                  )}
                  <Link
                    href={sellerHref}
                    className="seller-profile-btn seller-profile-btn-top"
                    aria-label={ui.openSellerProfile(sellerDisplayName)}
                  >
                    <UserRound size={18} />
                    {ui.viewProfile}
                    <ChevronRight size={14} />
                  </Link>
                </div>

                <div className="seller-identity-row">
                  <div className="seller-avatar-detail">
                    {sellerAvatarUrl
                      ? <img src={sellerAvatarUrl} alt="" className="seller-avatar-img" referrerPolicy="no-referrer" />
                      : sellerInitial}
                  </div>

                  <div className="seller-info">

                    <div className="seller-name-row">
                      <strong>{sellerDisplayName}</strong>
                      {listing.seller_phone_verified && (
                        <span className="verified-chip"><ShieldCheck size={11} /> {ui.verified}{locale === "fi" ? " myyjä" : ""}</span>
                      )}
                    </div>

                  </div>
                </div>

                <div className="seller-card-actions">
                  {sellerWebsiteUrl && (
                    <a
                      className="seller-action-link seller-website"
                      href={sellerWebsiteUrl.href}
                      target="_blank"
                      rel="noreferrer"
                      title={sellerWebsiteUrl.label}
                    >
                      <Globe2 size={16} />
                      {ui.website}
                    </a>
                  )}
                </div>
                <div className="seller-meta-rows">
                  <div className="seller-meta-row">
                    <UserRound size={14} />
                    <span>{ui.seller}:</span>
                    <strong>{companySellerNames || sellerDisplayName}</strong>
                  </div>
                  {showSellerBusinessId && (
                    <div className="seller-meta-row">
                      <Building2 size={14} />
                      <span>Y-tunnus:</span>
                      <strong>{sellerBusinessId || ui.notSpecified}</strong>
                    </div>
                  )}
                  {listingLocation && (
                    <div className="seller-meta-row">
                      <MapPin size={14} />
                      <span>Sijainti:</span>
                      <strong>{listingLocation}</strong>
                    </div>
                  )}
                  {sellerMemberYear && (
                    <div className="seller-meta-row">
                      <UserRound size={14} />
                      <span>Jäsenenä vuodesta:</span>
                      <strong>{sellerMemberYear}</strong>
                    </div>
                  )}
                </div>
                {(hasSellerReviewStats || hasSellerSoldStats) && (
                  <div
                    className={`seller-stats-row${sellerStatsCount === 1 ? " seller-stats-row-single" : ""}`}
                    aria-label="Myyjän arviot ja kaupat"
                  >
                    {hasSellerReviewStats && (
                      <div className="seller-stat seller-stat-rating">
                        <Star size={18} />
                        <span>
                          <strong>
                            {sellerReviewAverage !== null
                              ? sellerReviewAverage.toFixed(1)
                              : "Ei arvioita"}
                          </strong>
                          <small>
                            {sellerReviewCount === 1
                              ? "1 arvio"
                              : `${sellerReviewCount} arviota`}
                          </small>
                        </span>
                      </div>
                    )}
                    {hasSellerSoldStats && (
                      <div className="seller-stat seller-stat-sales">
                        <Package size={18} />
                        <span>
                          <strong>{sellerSoldCount}</strong>
                          <small>
                            {sellerSoldCount === 1
                              ? "Onnistunut kauppa"
                              : "Onnistunutta kauppaa"}
                          </small>
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="seller-divider" />
                <div className="seller-contact-merged">
                  {isLoggedIn ? (
                    <>
                      <Link
                        href={`/messages/${listing.id}`}
                        className="message-btn"
                      >
                        <Mail size={20} />
                        {ui.sendMessage}
                      </Link>
                      {!showPhone ? (
                        <button
                          className="phone-btn"
                          onClick={handleShowPhone}
                          disabled={phoneLoading}
                        >
                          <Phone size={20} />
                          {phoneLoading
                            ? ui.fetchingPhone
                            : ui.showPhone}
                        </button>
                      ) : (
                        <a
                          href={`tel:${
                            sellerPhone ||
                            listing.seller_phone ||
                            ""
                          }`}
                          className="phone-number"
                        >
                          {sellerPhone ||
                            listing.seller_phone ||
                            ui.missingPhone}
                        </a>
                      )}
                    </>
                  ) : (
                    <Link
                      href="/auth"
                      className="login-contact"
                    >
                      <LockKeyhole size={20} />
                      {ui.loginContact}
                    </Link>
                  )}
                </div>
              </div>

            </div>

            {/* CONTACT */}

            <div className="contact-card" style={{ display: "none" }}>

              <h3>
                {ui.contactHeading}
              </h3>

              {isLoggedIn ? (
                <>
                  {!showPhone ? (

                    <button
                      className="phone-btn"
                      onClick={handleShowPhone}
                      disabled={phoneLoading}
                    >
                      <Phone size={20} />
                      {phoneLoading
                        ? ui.fetchingPhone
                        : ui.showPhone}
                    </button>

                  ) : (

                    <a
                      href={`tel:${
                        sellerPhone ||
                        listing.seller_phone ||
                        ""
                      }`}
                      className="phone-number"
                    >
                      {sellerPhone ||
                        listing.seller_phone ||
                        ui.missingPhone}
                    </a>

                  )}
                  <Link
                    href={`/messages/${listing.id}`}
                    className="message-btn"
                  >
                    <Mail size={20} />
                    {ui.sendMessage}
                  </Link>
                </>
              ) : (
                <Link
                  href="/auth"
                  className="login-contact"
                >
                  <LockKeyhole size={20} />
                  {ui.loginContact}
                </Link>
              )}

            </div>

          </aside>

        </section>

        {similarListings.length > 0 && (
          <section className="similar-listings-section" aria-label="Samanlaisia tuotteita myynnissä">
            <div className="similar-listings-head">
              <span>{ui.forSale}</span>
              <h2>Samanlaisia tuotteita</h2>
            </div>
            <div className={`${homeStyles.cardsGrid} similar-home-grid`}>
              {similarListings.map((item) => {
                const itemText = getLocalizedListingText(item, locale);
                const itemImageSrc = listingImageSrc(item);
                const isFavorite = savedListingIds.includes(item.id);
                const countryFlag = getCountryFlagFromLocation(item.location, fallbackCountry);
                return (
                  <article
                    key={item.id}
                    className={`${homeStyles.card} similar-home-card`}
                    role="link"
                    tabIndex={0}
                    aria-label={`Avaa ilmoitus ${itemText.title}`}
                    onClick={() => openSimilarListing(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openSimilarListing(item.id);
                      }
                    }}
                  >
                    <div className={`${homeStyles.cardImage} ${homeStyles.listingCardImage}`}>
                      <span className={homeStyles.cardImageBlur} aria-hidden="true">
                        <OptimizedListingImage src={itemImageSrc} alt="" decorative />
                      </span>
                      <OptimizedListingImage
                        src={itemImageSrc}
                        alt={itemText.title}
                      />
                      {isListingNew(item.created_at) && (
                        <span className={homeStyles.newBadge} aria-label="Uusi">
                          Uusi
                        </span>
                      )}
                      <button
                        onClick={(event) => toggleSimilarSave(event, item.id)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        className={`${homeStyles.favoriteButton} ${
                          isFavorite ? homeStyles.favoriteButtonActive : ""
                        }`}
                        type="button"
                        aria-label={isFavorite ? "Poista suosikeista" : "Lisää suosikkeihin"}
                      >
                        <Heart
                          size={14}
                          fill={isFavorite ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                    <div className={homeStyles.cardBody}>
                      <p className={homeStyles.cardPrice}>{formatPrice(item.price)}</p>
                      <h3 className={homeStyles.cardTitle}>{itemText.title}</h3>
                      <div className={homeStyles.cardMetaRow}>
                        <span className={homeStyles.cardLocationMeta}>
                          {countryFlag ? (
                            <img
                              className={homeStyles.listingCountryFlag}
                              src={countryFlag.src}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                            />
                          ) : (
                            <MapPin size={14} />
                          )}
                          {formatLocation(formatLocationWithCountry(item.location, fallbackCountry))}
                        </span>
                        <span>
                          <Clock3 size={14} />
                          {formatDate(item.created_at, locale)}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {previewImage && (
        <div
          className="listing-image-preview"
          role="dialog"
          aria-modal="true"
          aria-label="Kuvan esikatselu"
        >
          <button
            type="button"
            className="listing-image-preview-backdrop"
            onClick={() => setPreviewImage(null)}
            aria-label="Sulje kuvan esikatselu"
          />
          <div className="listing-image-preview-panel">
            <OptimizedListingImage
              src={previewImage}
              alt={listingText.title}
              priority
              sizes="96vw"
              onTouchStart={startImageSwipe}
              onTouchEnd={finishImageSwipe}
            />
            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  className="listing-image-preview-arrow listing-image-preview-arrow-left"
                  onClick={() => switchGalleryImage(-1)}
                  aria-label="Edellinen kuva"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  className="listing-image-preview-arrow listing-image-preview-arrow-right"
                  onClick={() => switchGalleryImage(1)}
                  aria-label="Seuraava kuva"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
            <button
              type="button"
              className="listing-image-preview-close"
              onClick={() => setPreviewImage(null)}
              aria-label="Sulje"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`

        .page {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 900px 500px at 10% 0%, rgba(14, 165, 233, 0.18), transparent 60%),
            radial-gradient(ellipse 700px 400px at 90% 5%, rgba(34, 211, 238, 0.13), transparent 58%),
            radial-gradient(ellipse 600px 600px at 50% 80%, rgba(3, 105, 161, 0.12), transparent 65%),
            linear-gradient(160deg, #0b1a2f 0%, #0d2240 40%, #071526 100%);
        }

        .container {
          max-width: 1560px;
          margin: 0 auto;
          padding: 28px clamp(18px, 3vw, 36px) 58px;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(310px, 360px);
          gap: 28px;
          align-items: start;
        }

        .main {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(100, 116, 139, 0.14);
          border-radius: 28px;
          padding: 32px;
          box-shadow:
            0 28px 90px rgba(0, 8, 24, 0.42),
            0 0 0 1px rgba(14, 165, 233, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 26px;
        }

        .listing-kicker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 18px 0 0;
        }

        .listing-kicker span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(100, 116, 139, 0.1);
          border: 1px solid rgba(100, 116, 139, 0.18);
          color: #374151;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .title-left {
          flex: 1;
          min-width: 0;
        }

        .title-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
          flex-shrink: 0;
        }

        .title-actions {
          display: flex;
          gap: 8px;
        }

        .icon-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        }

        .icon-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
        }

        .icon-btn.icon-saved {
          background: rgba(255, 122, 26, 0.12);
          border-color: rgba(255, 122, 26, 0.38);
          color: #e85a00;
        }

        .title-row h1 {
          font-size: clamp(1.5rem, 2.5vw, 2rem);
          line-height: 1.3;
          margin: 0;
          font-weight: 800;
          max-width: 100%;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .sub-info {
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(11, 26, 58, 0.7);
          font-size: 15px;
          font-weight: 750;
          flex-wrap: wrap;
        }

        .location {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .dot {
          font-size: 18px;
        }

        .listing-id {
          color: rgba(11, 26, 58, 0.6);
          font-size: 15px;
          font-weight: 750;
        }

        .mobile-listing-id {
          display: none;
        }

        .mobile-listing-id strong,
        .mobile-image-actions {
          display: none;
        }

        .image-wrapper {
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid rgba(100, 116, 139, 0.14);
          box-shadow: 0 22px 70px rgba(5, 24, 46, 0.12);
          position: relative;
          background: #e2e8f0;
        }

        .desktop-image-meta {
          align-items: center;
          color: rgba(11, 26, 58, 0.72);
          display: flex;
          font-size: 15px;
          font-weight: 750;
          gap: 10px;
          margin: 0 4px 10px;
        }

        .desktop-image-meta strong {
          color: #071827;
          font-size: 16px;
          font-weight: 950;
          margin-left: auto;
          white-space: nowrap;
        }

        .desktop-meta-location {
          align-items: center;
          display: inline-flex;
          gap: 5px;
        }

        .image-wrapper::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 -90px 80px rgba(6, 26, 46, 0.18);
        }

        .main-img-button {
          background: transparent;
          border: 0;
          cursor: zoom-in;
          display: block;
          margin: 0;
          padding: 0;
          width: 100%;
        }

        .main-img-button:focus-visible {
          outline: 3px solid rgba(255, 154, 36, 0.82);
          outline-offset: -6px;
        }

        .image-badge {
          position: absolute;
          left: 16px;
          bottom: 16px;
          z-index: 2;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(100, 116, 139, 0.22);
          color: #374151;
          font-size: 13px;
          font-weight: 950;
          backdrop-filter: blur(10px);
        }

        .image-zoom-button {
          align-items: center;
          background: rgba(5, 18, 32, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: 999px;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          height: 40px;
          justify-content: center;
          position: absolute;
          right: 14px;
          top: 14px;
          width: 40px;
          z-index: 3;
        }

        .price-actions-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 16px;
        }

        .image-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .main-img {
          width: 100%;
          height: clamp(360px, 48vw, 560px);
          object-fit: cover;
          display: block;
        }

        .listing-image-preview {
          align-items: center;
          display: flex;
          inset: var(--topbar-h, 64px) 0 0;
          justify-content: center;
          padding: 22px;
          position: fixed;
          z-index: 9999;
        }

        .listing-image-preview-backdrop {
          background: rgba(0, 8, 20, 0.82);
          border: 0;
          cursor: zoom-out;
          inset: 0;
          position: absolute;
        }

        .listing-image-preview-panel {
          background: rgba(5, 20, 38, 0.96);
          border: 1px solid rgba(151, 178, 205, 0.28);
          border-radius: 12px;
          box-shadow: 0 28px 86px rgba(0, 8, 20, 0.62);
          max-height: min(calc(100dvh - var(--topbar-h, 64px) - 44px), 820px);
          max-width: min(94vw, 1120px);
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        .listing-image-preview-panel img {
          display: block;
          max-height: min(calc(100dvh - var(--topbar-h, 64px) - 44px), 820px);
          max-width: min(94vw, 1120px);
          object-fit: contain;
          width: 100%;
        }

        .listing-image-preview-close {
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          height: 26px;
          justify-content: center;
          position: absolute;
          right: 10px;
          top: 8px;
          width: 26px;
        }

        .listing-image-preview-close:hover {
          color: #ffb45f;
        }

        .thumbs {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-top: 20px;
        }

        .thumbs img {
          width: 100%;
          height: 80px;
          border-radius: 14px;
          object-fit: cover;
          cursor: pointer;
          border: 3px solid transparent;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
        }

        .thumbs img:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15);
        }

        .thumbs img.active {
          border-color: #64748b;
          box-shadow: 0 10px 28px rgba(100, 116, 139, 0.22);
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .price-display {
          font-size: 1.6rem;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1;
          padding: 0 6px 0 0;
        }

        .action-btn {
          height: 52px;
          padding: 0 24px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.9));
          display: flex;
          align-items: center;
          gap: 12px;
          color: #0f172a;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
        }

        .action-btn:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.95));
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.15);
        }

        .action-btn.saved {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15));
          border-color: rgba(16, 185, 129, 0.3);
          color: #059669;
        }

        .description-card {
          margin-top: 32px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(100, 116, 139, 0.12);
          border-radius: 24px;
          padding: 36px;
          box-shadow: 0 20px 70px rgba(5, 24, 46, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .listing-section-toggle {
          align-items: center;
          background: transparent;
          border: 0;
          color: #0f172a;
          cursor: pointer;
          display: flex;
          font: inherit;
          font-size: 1.5rem;
          font-weight: 800;
          justify-content: space-between;
          letter-spacing: 0;
          margin: 0;
          padding: 0;
          text-align: left;
          width: 100%;
        }

        .listing-section-toggle svg {
          flex: 0 0 auto;
        }

        .listing-section-content.is-collapsed {
          display: none;
        }

        .description-card p {
          color: rgba(15, 23, 42, 0.75);
          line-height: 1.7;
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 0;
          white-space: pre-line;
        }

        .listing-fact-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 26px;
        }

        .listing-fact-grid span {
          display: grid;
          gap: 6px;
          border-radius: 16px;
          padding: 14px;
          background: rgba(218, 249, 255, 0.46);
          border: 1px solid rgba(8, 121, 149, 0.12);
          color: #547083;
          font-weight: 800;
        }

        .listing-fact-grid strong {
          color: #087995;
          font-size: 12px;
          text-transform: uppercase;
        }

        .sidebar {
          position: sticky;
          top: 20px;
        }

        .seller-card,
        .contact-card {
          background:
            radial-gradient(360px 140px at 100% 0%, rgba(201, 247, 255, 0.28), transparent 70%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 253, 255, 0.94));
          border: 1px solid rgba(8, 121, 149, 0.14);
          border-radius: 24px;
          padding: 28px;
          margin-bottom: 24px;
          box-shadow: 0 24px 80px rgba(5, 24, 46, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .seller-card {
          overflow: hidden;
          padding: 0;
          background:
            radial-gradient(380px 180px at 100% 0%, rgba(73, 199, 216, 0.36), transparent 66%),
            linear-gradient(145deg, #061827 0%, #0b3550 54%, #087995 100%);
          border-color: rgba(201, 247, 255, 0.24);
          color: #ffffff;
        }

        .seller-card h2,
        .contact-card h3 {
          margin: 0 0 20px;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .seller-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 18px 0;
        }

        .seller-card-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(201, 247, 255, 0.72);
          margin: 0;
        }

        .seller-card-body {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 14px 14px 12px;
          min-height: 86px;
          padding: 13px 14px;
          position: relative;
        }

        .seller-card-link {
          border: 1px solid rgba(201, 247, 255, 0.16);
          border-radius: 18px;
          background: transparent;
          color: inherit;
          text-decoration: none;
          transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
        }

        .seller-card-link:hover {
          background: rgba(201, 247, 255, 0.08);
          border-color: rgba(201, 247, 255, 0.34);
          transform: translateY(-1px);
        }

        .seller-avatar-detail {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(145deg, #d9fbff 0%, #6ed2e4 45%, #0a4462 100%);
          border: 2px solid rgba(8, 121, 149, 0.22);
          box-shadow:
            0 0 0 2px #ffffff,
            0 6px 18px rgba(8, 121, 149, 0.18);
          color: #061a2e;
          font-size: 1.4rem;
          font-weight: 950;
          flex: none;
        }

        .seller-info {
          flex: 1;
          min-width: 0;
        }

        .seller-name-row {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .seller-name-row strong {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .verified-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10.5px;
          font-weight: 700;
          color: #087995;
          background: rgba(8, 121, 149, 0.08);
          border: 1px solid rgba(8, 121, 149, 0.18);
          border-radius: 99px;
          padding: 2px 7px;
          white-space: nowrap;
        }

        .seller-card .verified-chip {
          color: #dffaff;
          background: rgba(201, 247, 255, 0.12);
          border-color: rgba(201, 247, 255, 0.26);
        }
        .seller-meta-rows {
          display: grid;
          gap: 10px;
          margin-top: 12px;
          color: rgba(228, 237, 249, 0.9);
        }
        .seller-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 650;
        }
        .seller-meta-row strong {
          color: #ffffff;
          font-weight: 800;
        }
        .seller-contact-merged {
          display: grid;
          gap: 12px;
          margin-top: 14px;
        }

        .seller-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: transparent;
          padding: 0;
          display: block;
          border-radius: 50%;
        }

        .seller-profile-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 32px;
          padding: 0 10px 0 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(218, 249, 255, 0.9));
          border: 1px solid rgba(201, 247, 255, 0.42);
          color: #06445f;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
          box-shadow:
            0 10px 24px rgba(0, 10, 24, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.72);
        }

        .seller-profile-btn:hover {
          background: #ffffff;
          border-color: rgba(201, 247, 255, 0.48);
          transform: translateY(-1px);
        }

        .seller-employee-name {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          color: rgba(223, 250, 255, 0.78);
          font-size: 12px;
          font-weight: 850;
          min-width: 0;
        }

        .seller-employee-name strong {
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .seller-location {
          margin-top: 5px;
          color: rgba(223, 250, 255, 0.72);
          font-size: 14px;
          font-weight: 750;
        }

        .seller-card-arrow {
          color: rgba(223, 250, 255, 0.76);
          flex: none;
        }

        .message-btn,
        .phone-btn,
        .phone-number,
        .login-contact {
          width: 100%;
          height: 66px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 850;
          text-decoration: none;
          margin-top: 16px;
          transition: all 0.2s ease;
        }

        .message-btn,
        .phone-btn,
        .login-contact {
          background: linear-gradient(135deg, #071827 0%, #0b5d82 48%, #49c7d8 100%);
          color: white;
          border: 1px solid rgba(201, 247, 255, 0.36);
          cursor: pointer;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        }

        .message-btn:hover,
        .phone-btn:hover,
        .login-contact:hover {
          transform: translateY(-1px);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.22);
        }

        .phone-number {
          background: linear-gradient(135deg, #087995 0%, #49c7d8 100%);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        }

        @media (max-width: 1100px) {

          .layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: static;
          }

          .title-row {
            flex-direction: column;
          }

          .title-row h1 {
            font-size: 2.7rem;
          }

          .main-img {
            height: 420px;
          }

        }

        @media (max-width: 640px) {

          .container {
            padding: 12px;
          }

          .main {
            padding: 18px;
          }

          .listing-fact-grid {
            grid-template-columns: 1fr;
          }

          .title-row h1 {
            font-size: 2rem;
          }

          .main-img {
            height: 260px;
          }

          .thumbs img {
            width: 90px;
            height: 70px;
          }

          .price-actions-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .action-buttons {
            width: 100%;
            justify-content: space-between;
          }

          .action-btn {
            flex: 1;
            justify-content: center;
          }

        }

        /* Final listing detail skin: match main page, keep portrait photos fully visible. */
        .page {
          background:
            radial-gradient(760px 320px at 88% -8%, rgba(255, 122, 26, 0.12), transparent 62%),
            radial-gradient(680px 300px at 8% 0%, rgba(64, 216, 255, 0.08), transparent 68%),
            #0b1118 !important;
          color: #f4f8fc !important;
        }

        .container {
          width: min(1320px, calc(100vw - 32px)) !important;
          max-width: none !important;
          padding: clamp(18px, 3vw, 34px) 0 88px !important;
        }

        .layout {
          grid-template-columns: minmax(0, 1fr) minmax(280px, 330px) !important;
          gap: 18px !important;
        }

        .main {
          background:
            radial-gradient(680px 260px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98)) !important;
          border: 1px solid rgba(151, 178, 205, 0.2) !important;
          border-radius: 20px !important;
          box-shadow: 0 24px 70px rgba(0, 7, 18, 0.34), inset 0 1px 0 rgba(255,255,255,0.05) !important;
          padding: clamp(18px, 3vw, 28px) !important;
        }

        .title-row {
          margin-bottom: 18px !important;
        }

        .title-row h1 {
          color: #ffffff !important;
          font-size: clamp(1.55rem, 2.4vw, 2.15rem) !important;
          font-weight: 950 !important;
          line-height: 1.12 !important;
        }

        .sub-info,
        .desktop-image-meta,
        .listing-id {
          color: rgba(226, 244, 255, 0.68) !important;
          font-size: 13px !important;
        }

        .desktop-image-meta strong {
          color: #ffb45f !important;
        }

        .listing-kicker span {
          background: rgba(255, 122, 26, 0.12) !important;
          border-color: rgba(255, 122, 26, 0.3) !important;
          color: #ffd1a3 !important;
        }

        .image-wrapper {
          background: #06111f !important;
          border: 1px solid rgba(151, 178, 205, 0.2) !important;
          border-radius: 18px !important;
          box-shadow: 0 18px 54px rgba(0, 7, 18, 0.28) !important;
        }

        .main-img-button {
          position: relative !important;
          min-height: clamp(360px, 52vw, 620px) !important;
          overflow: hidden !important;
          background: #06111f !important;
        }

        .listing-image-soft-bg {
          position: absolute !important;
          inset: 0 !important;
          display: block !important;
          overflow: hidden !important;
          pointer-events: none !important;
        }

        .listing-image-soft-bg img {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          object-fit: cover !important;
          filter: blur(22px) saturate(0.85) brightness(0.56) !important;
          transform: scale(1.08) !important;
          opacity: 0.8 !important;
        }

        .listing-image-soft-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(3, 12, 24, 0.28);
        }

        .main-img {
          position: relative !important;
          z-index: 1 !important;
          width: 100% !important;
          height: clamp(360px, 52vw, 620px) !important;
          object-fit: contain !important;
          object-position: center center !important;
          background: transparent !important;
        }

        .image-wrapper::after {
          z-index: 2 !important;
          box-shadow: inset 0 -90px 80px rgba(0, 7, 18, 0.22) !important;
        }

        .image-badge,
        .gallery-arrow,
        .image-zoom-button {
          z-index: 4 !important;
        }

        .image-badge {
          background: rgba(3, 12, 24, 0.72) !important;
          border-color: rgba(151, 178, 205, 0.24) !important;
          color: #ffffff !important;
        }

        .price-actions-row {
          align-items: center !important;
          margin-top: 16px !important;
        }

        .price-display {
          color: #ffffff !important;
          font-size: clamp(1.8rem, 3vw, 2.35rem) !important;
          font-weight: 950 !important;
        }

        .icon-btn {
          background: rgba(12, 28, 46, 0.86) !important;
          border-color: rgba(151, 178, 205, 0.22) !important;
          color: #f4f8fc !important;
          box-shadow: none !important;
        }

        .icon-btn.icon-saved {
          background: rgba(255, 122, 26, 0.16) !important;
          border-color: rgba(255, 122, 26, 0.48) !important;
          color: #ffb45f !important;
        }

        .thumbs {
          display: flex !important;
          gap: 10px !important;
          margin-top: 14px !important;
          overflow-x: auto !important;
          padding-bottom: 2px !important;
        }

        .thumbs img,
        .mobile-image-thumbs img {
          width: 82px !important;
          height: 64px !important;
          flex: 0 0 auto !important;
          border: 2px solid rgba(151, 178, 205, 0.2) !important;
          border-radius: 12px !important;
          background: #06111f !important;
          object-fit: contain !important;
          padding: 2px !important;
        }

        .thumbs img.active,
        .mobile-image-thumbs button.active img {
          border-color: rgba(255, 122, 26, 0.72) !important;
          box-shadow: 0 0 0 2px rgba(255, 122, 26, 0.16) !important;
        }

        .description-card,
        .listing-facts-card,
        .listing-extra-card,
        .contact-card,
        .seller-card {
          background:
            radial-gradient(520px 220px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98)) !important;
          border: 1px solid rgba(151, 178, 205, 0.2) !important;
          border-radius: 18px !important;
          box-shadow: 0 18px 46px rgba(0, 7, 18, 0.28), inset 0 1px 0 rgba(255,255,255,0.04) !important;
          color: #f4f8fc !important;
        }

        .description-card {
          margin-top: 18px !important;
          padding: 0 !important;
          overflow: hidden !important;
        }

        .listing-section-toggle {
          min-height: 58px !important;
          padding: 0 18px !important;
          background: rgba(3, 12, 24, 0.22) !important;
          border: 0 !important;
          color: #ffffff !important;
          font-size: 1rem !important;
          font-weight: 950 !important;
        }

        .listing-section-content {
          padding: 16px 18px 18px !important;
        }

        .description-card p {
          color: rgba(226, 244, 255, 0.74) !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          line-height: 1.65 !important;
          margin: 0 !important;
        }

        .listing-fact-grid {
          gap: 10px !important;
          margin: 0 !important;
        }

        .listing-fact-grid span {
          min-height: 74px !important;
          background: rgba(3, 12, 24, 0.38) !important;
          border: 1px solid rgba(151, 178, 205, 0.16) !important;
          border-radius: 14px !important;
          color: rgba(226, 244, 255, 0.82) !important;
        }

        .listing-fact-grid strong {
          color: #ffb45f !important;
          font-size: 11px !important;
          letter-spacing: 0.06em !important;
        }

        .seller-card {
          overflow: hidden !important;
          padding: 0 !important;
        }

        .seller-profile-btn {
          background: rgba(255, 122, 26, 0.14) !important;
          border-color: rgba(255, 122, 26, 0.34) !important;
          color: #ffd1a3 !important;
          box-shadow: none !important;
        }

        .contact-card {
          padding: 18px !important;
        }

        .contact-card h3 {
          color: #ffffff !important;
          font-size: 16px !important;
          margin-bottom: 14px !important;
        }

        .message-btn,
        .phone-btn,
        .login-contact {
          min-height: 50px !important;
          height: auto !important;
          border-radius: 12px !important;
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%) !important;
          border-color: rgba(255, 210, 165, 0.58) !important;
          box-shadow: 0 16px 34px rgba(255, 122, 26, 0.22) !important;
          font-size: 14px !important;
        }

        @media (max-width: 1100px) {
          .layout {
            grid-template-columns: 1fr !important;
          }

          .sidebar {
            position: static !important;
          }
        }

        @media (max-width: 640px) {
          .container {
            width: min(100% - 24px, 1320px) !important;
            padding-top: 14px !important;
          }

          .main {
            display: flex !important;
            flex-direction: column !important;
            padding: 14px !important;
            border-radius: 18px !important;
          }

          .image-wrapper {
            order: 1 !important;
            margin-bottom: 14px !important;
          }

          .title-row {
            order: 2 !important;
            margin-bottom: 8px !important;
          }

          .desktop-image-meta {
            order: 3 !important;
            margin: 0 0 14px !important;
          }

          .price-actions-row {
            order: 4 !important;
            margin-top: 8px !important;
            margin-bottom: 14px !important;
          }

          .thumbs {
            order: 5 !important;
            margin-top: 0 !important;
            margin-bottom: 16px !important;
          }

          .listing-facts-card {
            order: 6 !important;
          }

          .listing-extra-card {
            order: 7 !important;
          }

          .mobile-listing-id {
            align-items: center !important;
            color: rgba(226, 244, 255, 0.74) !important;
            display: flex !important;
            font-size: 13px !important;
            font-weight: 900 !important;
            justify-content: space-between !important;
            gap: 12px !important;
            margin-bottom: 6px !important;
            width: 100% !important;
          }

          .mobile-listing-id strong {
            color: #ffffff !important;
            display: inline-flex !important;
            flex: 0 0 auto !important;
            font-size: 1.15rem !important;
            font-weight: 950 !important;
            line-height: 1 !important;
          }

          .title-row h1 {
            font-size: 1.45rem !important;
          }

          .sub-info,
          .desktop-image-meta {
            gap: 7px !important;
            font-size: 12px !important;
          }

          .desktop-image-meta {
            align-items: center !important;
            border-bottom: 1px solid rgba(151, 178, 205, 0.22) !important;
            display: flex !important;
            flex-wrap: wrap !important;
            line-height: 1.35 !important;
            padding-bottom: 12px !important;
          }

          .desktop-image-meta strong {
            display: none !important;
          }

          .image-badge {
            bottom: auto !important;
            left: 10px !important;
            min-height: 28px !important;
            padding: 0 8px !important;
            top: 10px !important;
          }

          .mobile-image-actions {
            bottom: 12px !important;
            display: flex !important;
            gap: 10px !important;
            position: absolute !important;
            right: 12px !important;
            z-index: 5 !important;
          }

          .mobile-image-actions .icon-btn {
            backdrop-filter: blur(10px) !important;
            background: rgba(3, 12, 24, 0.76) !important;
            border-color: rgba(255, 255, 255, 0.28) !important;
            border-radius: 999px !important;
            height: 42px !important;
            width: 42px !important;
          }

          .main-img-button,
          .main-img {
            height: min(72vh, 520px) !important;
            min-height: 340px !important;
          }

          .price-actions-row {
            display: none !important;
          }

          .image-actions {
            width: 100% !important;
            justify-content: space-between !important;
          }

          .price-display {
            font-size: 2rem !important;
          }

          .listing-fact-grid {
            grid-template-columns: 1fr !important;
          }
        }

        /* Sidebar final polish: force the contact links to render as real buttons. */
        .listing-detail-page .sidebar {
          background:
            radial-gradient(280px 180px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 72%),
            linear-gradient(180deg, rgba(13, 28, 45, 0.96), rgba(7, 20, 34, 0.96)) !important;
          border: 1px solid rgba(151, 178, 205, 0.22) !important;
          border-radius: 18px !important;
          box-shadow: 0 18px 48px rgba(0, 6, 16, 0.22) !important;
          display: grid !important;
          gap: 22px !important;
          padding: 22px !important;
        }

        .listing-detail-page .seller-card,
        .listing-detail-page .contact-card {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        .listing-detail-page .seller-card {
          padding: 0 !important;
        }

        .listing-detail-page .seller-card-header {
          justify-content: flex-start !important;
          padding: 0 !important;
        }

        .listing-detail-page .seller-card-label {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          color: #ffb45f !important;
          display: block !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          letter-spacing: 0.08em !important;
          line-height: 1 !important;
          margin: 3px 0 7px !important;
          padding: 0 !important;
          transform: translateY(4px) !important;
        }

        .listing-detail-page .seller-card-body {
          align-items: center !important;
          display: grid !important;
          grid-template-columns: 64px minmax(0, 1fr) !important;
          gap: 12px !important;
          margin: 16px 0 0 !important;
          min-height: 96px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-profile-btn {
          align-items: center !important;
          background:
            linear-gradient(180deg, rgba(17, 39, 61, 0.98), rgba(8, 24, 42, 0.98)) !important;
          border: 1px solid rgba(255, 122, 26, 0.42) !important;
          border-radius: 13px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
          color: #ffffff !important;
          display: flex !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          gap: 8px !important;
          height: 46px !important;
          justify-content: center !important;
          margin: 8px 0 0 !important;
          padding: 0 14px !important;
          text-decoration: none !important;
          width: 100% !important;
        }

        .listing-detail-page .seller-profile-btn svg {
          color: #ffb45f !important;
          height: 16px !important;
          width: 16px !important;
        }

        .listing-detail-page .seller-profile-btn:hover {
          border-color: rgba(255, 154, 36, 0.72) !important;
          filter: brightness(1.05) !important;
          transform: translateY(-1px) !important;
        }

        .listing-detail-page .seller-avatar-detail {
          width: 64px !important;
          height: 64px !important;
          border-radius: 18px !important;
          border: 1px solid rgba(255, 122, 26, 0.34) !important;
          box-shadow: 0 14px 28px rgba(0, 7, 18, 0.22) !important;
          background: rgba(3, 12, 24, 0.54) !important;
        }

        .listing-detail-page .seller-avatar-img {
          border-radius: 18px !important;
          object-fit: cover !important;
        }

        .listing-detail-page .seller-name-row strong {
          color: #ffffff !important;
          display: block !important;
          font-size: 17px !important;
          font-weight: 950 !important;
          max-width: 100% !important;
          white-space: normal !important;
        }

        .listing-detail-page .seller-card .verified-chip {
          background: transparent !important;
          border: 0 !important;
          color: #4ade80 !important;
          padding: 0 !important;
        }

        .listing-detail-page .seller-card .verified-chip svg {
          color: #22c55e !important;
          filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.28)) !important;
        }

        .listing-detail-page .seller-location {
          color: rgba(226, 244, 255, 0.72) !important;
          font-size: 13px !important;
          font-weight: 850 !important;
        }

        .listing-detail-page .seller-website {
          align-items: center !important;
          color: #7dd3fc !important;
          display: inline-flex !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          gap: 6px !important;
          margin-top: 6px !important;
          max-width: 100% !important;
        }

        .listing-detail-page .seller-website svg {
          color: #ffb45f !important;
          flex: 0 0 auto !important;
        }

        .listing-detail-page .seller-card-arrow {
          color: #ffb45f !important;
        }

        .listing-detail-page .contact-card {
          display: grid !important;
          gap: 10px !important;
          margin-top: 4px !important;
          padding: 0 !important;
        }

        .listing-detail-page .contact-card h3 {
          color: #ffffff !important;
          font-size: 17px !important;
          font-weight: 950 !important;
          line-height: 1.15 !important;
          margin: 0 0 2px !important;
        }

        .listing-detail-page .contact-card .message-btn,
        .listing-detail-page .contact-card .phone-btn,
        .listing-detail-page .contact-card .login-contact,
        .listing-detail-page .contact-card .phone-number {
          align-items: center !important;
          border-radius: 13px !important;
          box-sizing: border-box !important;
          display: flex !important;
          gap: 9px !important;
          height: 54px !important;
          justify-content: center !important;
          margin: 0 !important;
          min-height: 54px !important;
          padding: 0 16px !important;
          text-align: center !important;
          text-decoration: none !important;
          width: 100% !important;
        }

        .listing-detail-page .contact-card .message-btn {
          background:
            linear-gradient(180deg, rgba(20, 42, 64, 0.96), rgba(10, 27, 45, 0.96)) !important;
          border: 1px solid rgba(151, 178, 205, 0.36) !important;
          color: #ffffff !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          box-shadow:
            0 10px 24px rgba(0, 6, 16, 0.18),
            inset 0 1px 0 rgba(255,255,255,0.06) !important;
        }

        .listing-detail-page .contact-card .phone-btn,
        .listing-detail-page .contact-card .login-contact {
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%) !important;
          border: 1px solid rgba(255, 210, 165, 0.62) !important;
          color: #ffffff !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          box-shadow: 0 16px 34px rgba(255, 122, 26, 0.22) !important;
        }

        .listing-detail-page .contact-card .message-btn svg,
        .listing-detail-page .contact-card .phone-btn svg,
        .listing-detail-page .contact-card .login-contact svg,
        .listing-detail-page .contact-card .phone-number svg {
          flex: 0 0 auto !important;
          height: 18px !important;
          width: 18px !important;
        }

        .listing-detail-page .contact-card .message-btn:hover,
        .listing-detail-page .contact-card .phone-btn:hover,
        .listing-detail-page .contact-card .login-contact:hover {
          filter: brightness(1.05) !important;
          transform: translateY(-1px) !important;
        }

        .similar-listings-section {
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          margin: 30px 0 72px;
          padding: 0;
        }

        .similar-listings-head {
          align-items: baseline;
          background: transparent;
          border-bottom: 1px solid rgba(255, 122, 26, 0.62);
          display: grid;
          gap: 12px;
          grid-template-columns: auto 1fr;
          margin: 0;
          padding: 16px 18px;
        }

        .similar-listings-head span {
          color: #ffb45f;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .similar-listings-head h2 {
          color: #ffffff;
          font-size: 20px;
          font-weight: 950;
          justify-self: end;
          line-height: 1.1;
          margin: 0;
        }

        .similar-listings-grid {
          display: grid;
          gap: 0;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          padding: 16px 0 0;
        }

        .similar-listing-card {
          background: transparent;
          border: 0;
          border-left: 1px solid rgba(255, 122, 26, 0.62);
          border-radius: 0;
          color: #ffffff;
          display: grid;
          grid-template-rows: 158px 1fr;
          overflow: hidden;
          padding: 0 14px;
          text-decoration: none;
          transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }

        .similar-listing-card:first-child {
          border-left: 0;
          padding-left: 0;
        }

        .similar-listing-card:last-child {
          padding-right: 0;
        }

        .similar-listing-card:hover {
          border-color: rgba(255, 184, 93, 0.95);
          box-shadow: none;
          transform: translateY(-2px);
        }

        .similar-listing-image {
          background: #06111f;
          border: 1px solid rgba(255, 122, 26, 0.26);
          display: block;
          overflow: hidden;
          position: relative;
        }

        .similar-listing-image::after {
          border: 1px solid rgba(255, 255, 255, 0.08);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
        }

        .similar-listing-image img {
          display: block;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .similar-listing-body {
          display: grid;
          gap: 8px;
          padding: 14px;
          min-height: 136px;
        }

        .similar-listing-body strong {
          color: #ffffff;
          font-size: 23px;
          font-weight: 950;
          line-height: 1;
        }

        .similar-listing-title {
          color: #ffffff;
          display: -webkit-box;
          font-size: 14px;
          font-weight: 950;
          line-height: 1.18;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .similar-listing-meta {
          align-items: center;
          color: rgba(226, 244, 255, 0.68);
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          font-size: 12px;
          font-weight: 800;
        }

        @media (max-width: 640px) {
          .listing-detail-page .seller-card-body {
            grid-template-columns: 58px minmax(0, 1fr) !important;
          }

          .listing-detail-page .sidebar {
            padding: 18px !important;
          }

          .listing-detail-page .seller-avatar-detail {
            width: 58px !important;
            height: 58px !important;
          }

          .similar-listings-section {
            margin: 22px 0 48px;
          }

          .similar-listings-head {
            align-items: flex-start;
            display: grid;
            gap: 6px;
            grid-template-columns: 1fr;
            padding: 14px;
          }

          .similar-listings-head h2 {
            justify-self: start;
          }

          .similar-listings-grid {
            gap: 10px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            padding: 14px 0 0;
          }

          .similar-listing-card,
          .similar-listing-card:first-child,
          .similar-listing-card:last-child {
            border-left: 0;
            padding: 0;
          }

          .similar-listing-card:nth-child(odd) {
            border-right: 1px solid rgba(255, 122, 26, 0.62);
            padding-right: 10px;
          }

          .similar-listing-card:nth-child(even) {
            padding-left: 10px;
          }

          .similar-listing-card {
            grid-template-columns: 1fr;
            grid-template-rows: 118px 1fr;
            min-height: 250px;
          }

          .similar-listing-image {
            border-bottom: 1px solid rgba(255, 122, 26, 0.42);
            border-right: 0;
          }

          .similar-listing-body {
            gap: 6px;
            min-height: 132px;
            padding: 10px;
          }

          .similar-listing-body strong {
            font-size: 20px;
          }

          .similar-listing-title {
            font-size: 12px;
          }

          .similar-listing-meta {
            font-size: 10px;
            gap: 5px;
          }
        }

        /* Final gallery arrow placement: centered on both sides of the image. */
        .listing-detail-page .image-wrapper .gallery-arrow {
          align-items: center !important;
          background: rgba(3, 12, 24, 0.76) !important;
          border: 1px solid rgba(151, 178, 205, 0.28) !important;
          border-radius: 999px !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: inline-flex !important;
          height: 46px !important;
          justify-content: center !important;
          padding: 0 !important;
          position: absolute !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          width: 46px !important;
          z-index: 6 !important;
        }

        .listing-detail-page .image-wrapper .gallery-arrow-left {
          left: 18px !important;
        }

        .listing-detail-page .image-wrapper .gallery-arrow-right {
          right: 18px !important;
        }

        .listing-detail-page .image-wrapper .gallery-arrow:hover {
          background: rgba(255, 122, 26, 0.92) !important;
          border-color: rgba(255, 208, 164, 0.8) !important;
        }

        @media (max-width: 640px) {
          .listing-detail-page .image-wrapper .gallery-arrow {
            height: 38px !important;
            top: 44% !important;
            width: 38px !important;
          }

          .listing-detail-page .image-wrapper .gallery-arrow-left {
            left: 10px !important;
          }

          .listing-detail-page .image-wrapper .gallery-arrow-right {
            right: 10px !important;
          }

          .listing-detail-page .mobile-image-thumbs {
            gap: 6px !important;
            padding: 7px 8px !important;
          }

          .listing-detail-page .mobile-image-thumbs button {
            height: 54px !important;
            min-width: 42px !important;
            width: 42px !important;
          }

          .listing-detail-page .mobile-image-thumbs img {
            border-radius: 7px !important;
            height: 54px !important;
            padding: 1px !important;
            width: 42px !important;
          }
        }

        /* Final similar listings image lock: every card keeps the same image size. */
        .listing-detail-page .similar-listing-card {
          grid-template-rows: 168px minmax(132px, auto) !important;
          min-height: 0 !important;
        }

        .listing-detail-page .similar-listing-image {
          aspect-ratio: 16 / 10 !important;
          display: block !important;
          height: 168px !important;
          max-height: 168px !important;
          min-height: 168px !important;
          overflow: hidden !important;
          position: relative !important;
          width: 100% !important;
        }

        .listing-detail-page .similar-listing-image img {
          display: block !important;
          height: 100% !important;
          inset: 0 !important;
          object-fit: cover !important;
          object-position: center !important;
          position: absolute !important;
          width: 100% !important;
        }

        .listing-detail-page .listing-image-preview-arrow {
          align-items: center !important;
          background: rgba(3, 12, 24, 0.78) !important;
          border: 1px solid rgba(151, 178, 205, 0.28) !important;
          border-radius: 999px !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: inline-flex !important;
          height: 46px !important;
          justify-content: center !important;
          padding: 0 !important;
          position: absolute !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          width: 46px !important;
          z-index: 3 !important;
        }

        .listing-detail-page .listing-image-preview-arrow-left {
          left: 14px !important;
        }

        .listing-detail-page .listing-image-preview-arrow-right {
          right: 14px !important;
        }

        .listing-detail-page .listing-image-preview-arrow:hover {
          background: rgba(255, 122, 26, 0.92) !important;
          border-color: rgba(255, 208, 164, 0.8) !important;
        }

        @media (max-width: 640px) {
          .listing-detail-page .similar-listing-card {
            grid-template-rows: 118px minmax(132px, auto) !important;
          }

          .listing-detail-page .similar-listing-image {
            height: 118px !important;
            max-height: 118px !important;
            min-height: 118px !important;
          }

          .listing-detail-page .listing-image-preview-arrow {
            height: 38px !important;
            width: 38px !important;
          }

          .listing-detail-page .listing-image-preview-arrow-left {
            left: 8px !important;
          }

          .listing-detail-page .listing-image-preview-arrow-right {
            right: 8px !important;
          }
        }

        /* Final no-outline pass: remove the visible page/card edge borders. */
        .listing-detail-page .container,
        .listing-detail-page .layout,
        .listing-detail-page .main,
        .listing-detail-page .sidebar,
        .listing-detail-page .seller-card,
        .listing-detail-page .seller-card-header,
        .listing-detail-page .seller-card-body,
        .listing-detail-page .contact-card,
        .listing-detail-page .description-card,
        .listing-detail-page .listing-facts-card,
        .listing-detail-page .listing-extra-card,
        .listing-detail-page .similar-listings-section {
          border: 0 !important;
          border-color: transparent !important;
          box-shadow: none !important;
          outline: 0 !important;
        }

        .listing-detail-page .main,
        .listing-detail-page .sidebar,
        .listing-detail-page .seller-card,
        .listing-detail-page .contact-card {
          background-clip: padding-box !important;
        }

        .listing-detail-page .sidebar,
        .listing-detail-page .seller-card,
        .listing-detail-page .seller-card-body,
        .listing-detail-page .seller-info,
        .listing-detail-page .contact-card {
          text-align: center !important;
        }

        .listing-detail-page .seller-card-body,
        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row,
        .listing-detail-page .seller-employee-name,
        .listing-detail-page .seller-location,
        .listing-detail-page .seller-website,
        .listing-detail-page .verified-chip,
        .listing-detail-page .seller-profile-btn,
        .listing-detail-page .contact-card h3,
        .listing-detail-page .contact-card .message-btn,
        .listing-detail-page .contact-card .phone-btn,
        .listing-detail-page .contact-card .phone-number,
        .listing-detail-page .contact-card .login-contact {
          align-items: center !important;
          justify-content: center !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        @media (min-width: 761px) {
          .listing-detail-page .layout {
            grid-template-columns: minmax(0, 1fr) minmax(300px, 360px) !important;
          }

          .listing-detail-page .sidebar {
            bottom: auto !important;
            left: auto !important;
            max-height: calc(100vh - 104px) !important;
            overflow: auto !important;
            position: fixed !important;
            right: max(20px, calc((100vw - 1320px) / 2 + 20px)) !important;
            scrollbar-width: none !important;
            top: 86px !important;
            width: clamp(300px, 24vw, 360px) !important;
            z-index: 30 !important;
          }

          .listing-detail-page .sidebar::-webkit-scrollbar {
            display: none !important;
          }
        }

        .listing-detail-page .seller-profile-btn,
        .listing-detail-page .contact-card .message-btn,
        .listing-detail-page .contact-card .phone-btn,
        .listing-detail-page .contact-card .login-contact,
        .listing-detail-page .gallery-arrow,
        .listing-detail-page .listing-image-preview-arrow,
        .listing-detail-page .mobile-image-thumbs button {
          box-shadow: none !important;
        }

        /* Keep the seller panel in the page flow and center its contents. */
        @media (min-width: 761px) {
          .listing-detail-page .sidebar {
            left: auto !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            right: auto !important;
            top: auto !important;
            width: auto !important;
            z-index: auto !important;
          }
        }

        .listing-detail-page .seller-card-body,
        .listing-detail-page .seller-card-link {
          grid-template-columns: 1fr !important;
        }

        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row {
          width: 100% !important;
        }

        .listing-detail-page .seller-profile-btn {
          align-self: center !important;
          border-radius: 999px !important;
          display: inline-flex !important;
          margin: 16px auto 0 !important;
          min-height: 42px !important;
          padding: 0 18px !important;
          width: min(100%, 230px) !important;
        }

        .listing-detail-page .seller-card-link {
          width: 100% !important;
        }

        .listing-detail-page .seller-profile-btn {
          grid-area: profile !important;
          height: 38px !important;
          margin: 4px auto 0 !important;
          min-height: 38px !important;
          width: min(100%, 220px) !important;
        }

        @media (min-width: 641px) {
          .listing-detail-page .desktop-image-meta {
            box-sizing: border-box !important;
            margin: 0 0 12px !important;
            padding-inline: clamp(28px, 3.6vw, 56px) !important;
            width: 100% !important;
          }

          .listing-detail-page .desktop-image-meta strong {
            margin-left: auto !important;
          }

          .listing-detail-page .image-badge {
            bottom: auto !important;
            left: clamp(28px, 3.6vw, 54px) !important;
            top: 18px !important;
          }

          .listing-detail-page .image-zoom-button {
            right: clamp(28px, 3.6vw, 54px) !important;
            top: 18px !important;
          }

          .listing-detail-page .image-wrapper .gallery-arrow-left {
            left: clamp(28px, 3.6vw, 54px) !important;
          }

          .listing-detail-page .image-wrapper .gallery-arrow-right {
            right: clamp(28px, 3.6vw, 54px) !important;
          }
        }

        @media (max-width: 420px) {
          .listing-detail-page .seller-card-link {
            padding: 16px !important;
          }
        }

        /* Seller profile card match to reference */
        .listing-detail-page .sidebar {
          background: transparent !important;
          padding: 0 !important;
          gap: 0 !important;
        }

        .listing-detail-page .seller-card {
          border-radius: 34px !important;
          border: 1px solid rgba(136, 177, 220, 0.28) !important;
          background:
            radial-gradient(120% 100% at 50% 0%, rgba(20, 61, 120, 0.34), rgba(5, 24, 52, 0.95) 66%),
            linear-gradient(180deg, rgba(7, 29, 56, 0.98), rgba(5, 23, 46, 0.98)) !important;
          box-shadow:
            0 30px 80px rgba(1, 10, 24, 0.56),
            inset 0 1px 0 rgba(195, 227, 255, 0.2) !important;
          overflow: hidden !important;
        }

        .listing-detail-page .seller-card-body.seller-card-panel {
          display: grid !important;
          grid-template-columns: 86px minmax(0, 1fr) !important;
          gap: 14px !important;
          padding: 18px 18px !important;
          margin: 0 !important;
        }

        .listing-detail-page .seller-card-top {
          grid-column: 1 / -1 !important;
          display: flex !important;
          justify-content: flex-end !important;
          margin-bottom: 4px !important;
        }

        .listing-detail-page .seller-profile-btn {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: rgba(230, 241, 255, 0.84) !important;
          font-size: 17px !important;
          font-weight: 700 !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          width: auto !important;
        }

        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 86px !important;
          height: 86px !important;
          border-radius: 14px !important;
          border: 0 !important;
          background: #ffffff !important;
        }

        .listing-detail-page .seller-name-row strong {
          font-size: clamp(26px, 5.5vw, 48px) !important;
          line-height: 1.06 !important;
          font-weight: 900 !important;
          letter-spacing: -0.02em !important;
          word-break: break-word !important;
        }

        .listing-detail-page .seller-card .verified-chip {
          color: #46e58f !important;
          font-size: 18px !important;
          font-weight: 800 !important;
          gap: 8px !important;
        }

        .listing-detail-page .seller-meta-rows {
          grid-column: 1 / -1 !important;
          border-top: 1px solid rgba(146, 180, 214, 0.28) !important;
          margin-top: 8px !important;
          padding-top: 22px !important;
          gap: 14px !important;
        }

        .listing-detail-page .seller-meta-row {
          justify-content: flex-start !important;
          font-size: 18px !important;
          color: rgba(219, 231, 245, 0.76) !important;
        }

        .listing-detail-page .seller-meta-row strong {
          font-size: clamp(20px, 4.6vw, 36px) !important;
          font-weight: 850 !important;
          color: #ffffff !important;
        }

        .listing-detail-page .seller-contact-merged {
          grid-column: 1 / -1 !important;
          margin-top: 18px !important;
          gap: 14px !important;
        }

        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          width: 100% !important;
          height: 54px !important;
          min-height: 54px !important;
          border-radius: 16px !important;
          font-size: 16px !important;
          font-weight: 850 !important;
        }

        .listing-detail-page .contact-card {
          display: none !important;
        }

        .listing-detail-page .seller-contact-merged .message-btn {
          background: linear-gradient(90deg, #ff9b1d 0%, #ff5f00 100%) !important;
          border: 1px solid rgba(255, 185, 101, 0.62) !important;
          color: #ffffff !important;
        }

        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          background: rgba(7, 31, 58, 0.72) !important;
          border: 2px solid #ff9c26 !important;
          color: #f4f8ff !important;
        }

        /* Hard final override for seller card layout integrity */
        .listing-detail-page .seller-card-body.seller-card-panel {
          display: block !important;
          padding: 20px 16px !important;
        }

        .listing-detail-page .seller-card-top {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 14px !important;
        }

        .listing-detail-page .seller-identity-row {
          display: grid !important;
          grid-template-columns: 72px minmax(0, 1fr) !important;
          gap: 12px !important;
          align-items: center !important;
        }

        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row {
          display: block !important;
          text-align: left !important;
          width: 100% !important;
          min-width: 0 !important;
        }

        .listing-detail-page .seller-name-row strong {
          display: block !important;
          font-size: 22px !important;
          line-height: 1.15 !important;
          white-space: normal !important;
          word-break: normal !important;
          overflow-wrap: anywhere !important;
          max-width: 100% !important;
        }

        .listing-detail-page .seller-card .verified-chip {
          display: inline-flex !important;
          margin-top: 4px !important;
          font-size: 14px !important;
        }

        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 72px !important;
          height: 72px !important;
          border-radius: 12px !important;
        }

        .listing-detail-page .seller-meta-rows {
          margin-top: 14px !important;
          padding-top: 12px !important;
          border-top: 1px solid rgba(146, 180, 214, 0.28) !important;
          display: grid !important;
          gap: 8px !important;
        }

        .listing-detail-page .seller-meta-row {
          display: flex !important;
          justify-content: flex-start !important;
          align-items: baseline !important;
          gap: 6px !important;
          font-size: 14px !important;
        }

        .listing-detail-page .seller-meta-row strong {
          font-size: 14px !important;
          line-height: 1.3 !important;
        }

        .listing-detail-page .seller-contact-merged {
          margin-top: 14px !important;
          display: grid !important;
          gap: 10px !important;
        }

        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          height: 48px !important;
          min-height: 48px !important;
          border-radius: 14px !important;
          font-size: 15px !important;
          padding: 0 12px !important;
        }

        .listing-detail-page .similar-home-grid {
          margin-top: 18px !important;
        }

        .listing-detail-page .similar-home-card {
          min-width: 0 !important;
        }

        .listing-detail-page .container::before,
        .listing-detail-page .container::after,
        .listing-detail-page .layout::before,
        .listing-detail-page .layout::after,
        .listing-detail-page .main::before,
        .listing-detail-page .main::after,
        .listing-detail-page .sidebar::before,
        .listing-detail-page .sidebar::after {
          background: none !important;
          border: 0 !important;
          box-shadow: none !important;
          content: none !important;
          display: none !important;
        }

        /* Force unified seller panel background with no inner color bars. */
        .listing-detail-page .seller-card-body.seller-card-panel,
        .listing-detail-page .seller-card-body.seller-card-panel:hover,
        .listing-detail-page .seller-identity-row,
        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row,
        .listing-detail-page .seller-employee-name,
        .listing-detail-page .seller-address,
        .listing-detail-page .seller-card-actions {
          background: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .listing-detail-page .seller-card {
          background: #06203a !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .listing-detail-page .sidebar,
        .listing-detail-page .contact-card,
        .listing-detail-page .seller-card,
        .listing-detail-page .seller-card-body,
        .listing-detail-page .seller-card-body.seller-card-panel,
        .listing-detail-page .seller-identity-row,
        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row,
        .listing-detail-page .seller-employee-name,
        .listing-detail-page .seller-address,
        .listing-detail-page .seller-card-actions {
          background: #06203a !important;
          background-image: none !important;
          border-color: transparent !important;
          box-shadow: none !important;
        }

        /* Reference-match seller card (final) */
        .listing-detail-page .seller-card {
          border-radius: 42px !important;
          border: 1px solid rgba(173, 205, 238, 0.35) !important;
          background:
            radial-gradient(120% 140% at 15% 0%, rgba(72, 115, 172, 0.35), transparent 45%),
            radial-gradient(120% 140% at 100% 100%, rgba(0, 57, 122, 0.2), transparent 55%),
            linear-gradient(180deg, #052247 0%, #021735 100%) !important;
          box-shadow:
            0 24px 70px rgba(0, 8, 20, 0.48),
            inset 0 1px 0 rgba(215, 235, 255, 0.22) !important;
          overflow: hidden !important;
        }
        .listing-detail-page .seller-card-body.seller-card-panel {
          display: block !important;
          padding: 26px 22px 24px !important;
        }
        .listing-detail-page .seller-card-top {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 18px !important;
        }
        .listing-detail-page .seller-card-label {
          color: #ffb255 !important;
          font-size: 34px !important;
          font-weight: 900 !important;
          letter-spacing: 0 !important;
          margin: 0 !important;
          transform: none !important;
        }
        .listing-detail-page .seller-profile-btn {
          background: transparent !important;
          border: 0 !important;
          color: rgba(228, 237, 248, 0.92) !important;
          font-size: 26px !important;
          font-weight: 700 !important;
          padding: 0 !important;
        }
        .listing-detail-page .seller-identity-row {
          display: grid !important;
          grid-template-columns: 140px minmax(0, 1fr) !important;
          gap: 22px !important;
          align-items: center !important;
        }
        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 140px !important;
          height: 140px !important;
          border-radius: 20px !important;
          background: #fff !important;
        }
        .listing-detail-page .seller-name-row strong {
          font-size: 48px !important;
          line-height: 1.05 !important;
          font-weight: 900 !important;
          letter-spacing: -0.02em !important;
          white-space: normal !important;
          word-break: normal !important;
          overflow-wrap: anywhere !important;
        }
        .listing-detail-page .seller-card .verified-chip {
          color: #46ec95 !important;
          font-size: 20px !important;
          font-weight: 800 !important;
          gap: 8px !important;
          margin-top: 8px !important;
        }
        .listing-detail-page .seller-meta-rows {
          border-top: 1px solid rgba(174, 202, 231, 0.32) !important;
          margin-top: 14px !important;
          padding-top: 20px !important;
          gap: 14px !important;
        }
        .listing-detail-page .seller-meta-row {
          font-size: 22px !important;
          color: rgba(218, 229, 243, 0.8) !important;
          gap: 10px !important;
        }
        .listing-detail-page .seller-meta-row strong {
          color: #fff !important;
          font-size: 22px !important;
          font-weight: 800 !important;
        }
        .listing-detail-page .seller-divider {
          margin: 18px 0 !important;
          border-color: rgba(174, 202, 231, 0.26) !important;
        }
        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number {
          height: 64px !important;
          min-height: 64px !important;
          border-radius: 20px !important;
          font-size: 18px !important;
          font-weight: 850 !important;
        }
        .listing-detail-page .seller-contact-merged .message-btn {
          background: linear-gradient(90deg, #ff9b1f 0%, #ff6300 100%) !important;
          border: 1px solid rgba(255, 180, 84, 0.58) !important;
          color: #fff !important;
        }
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number {
          background: rgba(0, 26, 58, 0.65) !important;
          border: 2px solid #ff961f !important;
          color: #eef3fa !important;
        }
        .listing-detail-page .contact-card { display: none !important; }

        @media (min-width: 761px) {
          .listing-detail-page .sidebar {
            max-width: 920px !important;
            width: 100% !important;
            margin: 0 auto !important;
          }
          .listing-detail-page .seller-card-body.seller-card-panel {
            padding: 54px 54px 46px !important;
          }
          .listing-detail-page .seller-card-top {
            margin-bottom: 34px !important;
          }
          .listing-detail-page .seller-card-label {
            display: none !important;
          }
          .listing-detail-page .seller-profile-btn {
            font-size: 48px !important;
          }
          .listing-detail-page .seller-identity-row {
            grid-template-columns: 248px minmax(0, 1fr) !important;
            gap: 32px !important;
          }
          .listing-detail-page .seller-avatar-detail,
          .listing-detail-page .seller-avatar-img {
            width: 248px !important;
            height: 248px !important;
            border-radius: 30px !important;
          }
          .listing-detail-page .seller-name-row strong {
            font-size: 74px !important;
            line-height: 1.03 !important;
          }
          .listing-detail-page .seller-card .verified-chip {
            font-size: 56px !important;
          }
          .listing-detail-page .seller-divider {
            margin: 40px 0 28px !important;
          }
          .listing-detail-page .seller-meta-row {
            font-size: 56px !important;
            gap: 16px !important;
          }
          .listing-detail-page .seller-meta-row strong {
            font-size: 56px !important;
          }
          .listing-detail-page .seller-contact-merged {
            margin-top: 36px !important;
            gap: 20px !important;
          }
          .listing-detail-page .seller-contact-merged .message-btn,
          .listing-detail-page .seller-contact-merged .phone-btn,
          .listing-detail-page .seller-contact-merged .phone-number {
            height: 136px !important;
            min-height: 136px !important;
            border-radius: 32px !important;
            font-size: 64px !important;
          }
        }

        @media (max-width: 760px) {
          .listing-detail-page .seller-card { border-radius: 22px !important; }
          .listing-detail-page .seller-card-body.seller-card-panel { padding: 16px !important; }
          .listing-detail-page .seller-card-label { font-size: 28px !important; }
          .listing-detail-page .seller-profile-btn { font-size: 15px !important; }
          .listing-detail-page .seller-identity-row { grid-template-columns: 72px minmax(0, 1fr) !important; gap: 10px !important; }
          .listing-detail-page .seller-avatar-detail,
          .listing-detail-page .seller-avatar-img { width: 72px !important; height: 72px !important; border-radius: 12px !important; }
          .listing-detail-page .seller-name-row strong { font-size: 18px !important; line-height: 1.08 !important; max-width: 160px !important; }
          .listing-detail-page .seller-card .verified-chip { font-size: 14px !important; margin-top: 4px !important; }
          .listing-detail-page .seller-meta-rows { margin-top: 10px !important; padding-top: 14px !important; }
          .listing-detail-page .seller-meta-row { font-size: 12px !important; gap: 6px !important; }
          .listing-detail-page .seller-meta-row strong { font-size: 12px !important; }
          .listing-detail-page .seller-contact-merged .message-btn,
          .listing-detail-page .seller-contact-merged .phone-btn,
          .listing-detail-page .seller-contact-merged .phone-number { height: 54px !important; min-height: 54px !important; border-radius: 16px !important; font-size: 14px !important; }
          .listing-detail-page .seller-divider { margin: 14px 0 !important; }
        }

        /* Seller card final reference lock */
        .listing-detail-page .sidebar {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          padding: 0 !important;
          max-width: 380px !important;
          width: 100% !important;
          margin: 0 !important;
        }

        .listing-detail-page .seller-card {
          border: 1px solid rgba(139, 178, 219, 0.34) !important;
          border-radius: 30px !important;
          background:
            radial-gradient(120% 120% at 8% 0%, rgba(79, 119, 164, 0.32), transparent 45%),
            radial-gradient(100% 90% at 100% 100%, rgba(0, 55, 115, 0.18), transparent 55%),
            linear-gradient(180deg, #062447 0%, #031935 100%) !important;
          box-shadow:
            0 22px 54px rgba(0, 8, 22, 0.48),
            inset 0 1px 0 rgba(220, 238, 255, 0.18) !important;
          overflow: hidden !important;
        }

        .listing-detail-page .seller-card-body.seller-card-panel {
          background: transparent !important;
          display: block !important;
          padding: 28px 26px 26px !important;
        }

        .listing-detail-page .seller-card-top {
          display: flex !important;
          justify-content: flex-end !important;
          align-items: center !important;
          margin: 0 0 30px !important;
        }

        .listing-detail-page .seller-card-label {
          display: none !important;
        }

        .listing-detail-page .seller-profile-btn {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          width: auto !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: rgba(226, 236, 249, 0.86) !important;
          font-size: 18px !important;
          font-weight: 650 !important;
          line-height: 1 !important;
        }

        .listing-detail-page .seller-profile-btn svg {
          color: rgba(226, 236, 249, 0.84) !important;
          width: 22px !important;
          height: 22px !important;
        }

        .listing-detail-page .seller-identity-row {
          display: grid !important;
          grid-template-columns: 92px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 22px !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 92px !important;
          height: 92px !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          border: 0 !important;
          box-shadow: 0 14px 26px rgba(0, 8, 20, 0.22) !important;
          object-fit: cover !important;
        }

        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          text-align: left !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-name-row strong {
          display: block !important;
          max-width: 100% !important;
          color: #ffffff !important;
          font-size: 30px !important;
          font-weight: 900 !important;
          letter-spacing: 0 !important;
          line-height: 1.08 !important;
          white-space: normal !important;
          word-break: normal !important;
          overflow-wrap: anywhere !important;
          text-align: left !important;
        }

        .listing-detail-page .seller-card .verified-chip {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 8px !important;
          margin: 10px 0 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: #45e78c !important;
          font-size: 17px !important;
          font-weight: 800 !important;
          line-height: 1.15 !important;
          text-align: left !important;
        }

        .listing-detail-page .seller-card .verified-chip svg {
          width: 22px !important;
          height: 22px !important;
          color: #43e789 !important;
          fill: #43e789 !important;
          stroke: #062447 !important;
          stroke-width: 3 !important;
        }

        .listing-detail-page .seller-meta-rows {
          display: grid !important;
          gap: 18px !important;
          margin: 34px 0 0 !important;
          padding: 26px 0 0 !important;
          border-top: 1px solid rgba(177, 203, 230, 0.3) !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-meta-row {
          display: grid !important;
          grid-template-columns: 32px auto 1fr !important;
          align-items: center !important;
          gap: 10px !important;
          color: rgba(219, 229, 242, 0.78) !important;
          font-size: 20px !important;
          font-weight: 650 !important;
          line-height: 1.2 !important;
          text-align: left !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-meta-row svg {
          width: 24px !important;
          height: 24px !important;
          color: rgba(219, 229, 242, 0.82) !important;
        }

        .listing-detail-page .seller-meta-row strong {
          color: #ffffff !important;
          font-size: 20px !important;
          font-weight: 800 !important;
          line-height: 1.2 !important;
          white-space: normal !important;
        }

        .listing-detail-page .seller-divider {
          display: none !important;
        }

        .listing-detail-page .seller-contact-merged {
          display: grid !important;
          gap: 14px !important;
          margin: 34px 0 0 !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 16px !important;
          width: 100% !important;
          height: 62px !important;
          min-height: 62px !important;
          margin: 0 !important;
          padding: 0 18px !important;
          border-radius: 16px !important;
          box-shadow: none !important;
          font-size: 22px !important;
          font-weight: 800 !important;
          letter-spacing: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          text-align: center !important;
        }

        .listing-detail-page .seller-contact-merged .message-btn {
          background: linear-gradient(90deg, #ff991f 0%, #ff5f00 100%) !important;
          border: 1px solid rgba(255, 181, 91, 0.7) !important;
          color: #ffffff !important;
        }

        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          background: transparent !important;
          border: 2px solid #ff9418 !important;
          color: #f6f8fc !important;
        }

        .listing-detail-page .seller-contact-merged svg {
          width: 26px !important;
          height: 26px !important;
          flex: 0 0 auto !important;
        }

        .listing-detail-page .contact-card {
          display: none !important;
        }

        @media (max-width: 420px) {
          .listing-detail-page .sidebar {
            max-width: 100% !important;
          }

          .listing-detail-page .seller-card {
            border-radius: 24px !important;
          }

          .listing-detail-page .seller-card-body.seller-card-panel {
            padding: 24px 22px 22px !important;
          }

          .listing-detail-page .seller-card-top {
            margin-bottom: 26px !important;
          }

          .listing-detail-page .seller-profile-btn {
            font-size: 15px !important;
          }

          .listing-detail-page .seller-profile-btn svg {
            width: 18px !important;
            height: 18px !important;
          }

          .listing-detail-page .seller-identity-row {
            grid-template-columns: 72px minmax(0, 1fr) !important;
            gap: 18px !important;
          }

          .listing-detail-page .seller-avatar-detail,
          .listing-detail-page .seller-avatar-img {
            width: 72px !important;
            height: 72px !important;
            border-radius: 14px !important;
          }

          .listing-detail-page .seller-name-row strong {
            font-size: 34px !important;
          }

          .listing-detail-page .seller-card .verified-chip {
            font-size: 22px !important;
          }

          .listing-detail-page .seller-card .verified-chip svg {
            width: 18px !important;
            height: 18px !important;
          }

          .listing-detail-page .seller-meta-row {
            grid-template-columns: 26px auto 1fr !important;
            font-size: 17px !important;
          }

          .listing-detail-page .seller-meta-row strong {
            font-size: 17px !important;
          }

          .listing-detail-page .seller-contact-merged .message-btn,
          .listing-detail-page .seller-contact-merged .phone-btn,
          .listing-detail-page .seller-contact-merged .phone-number,
          .listing-detail-page .seller-contact-merged .login-contact {
            height: 58px !important;
            min-height: 58px !important;
            font-size: 19px !important;
          }
        }
      `}</style>
      <style jsx global>{`
        .listing-detail-page .sidebar {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          padding: 0 !important;
          max-width: 380px !important;
          width: 100% !important;
          margin: 0 !important;
        }

        .listing-detail-page .seller-card {
          border: 1px solid rgba(139, 178, 219, 0.34) !important;
          border-radius: 30px !important;
          background:
            radial-gradient(120% 120% at 8% 0%, rgba(79, 119, 164, 0.32), transparent 45%),
            radial-gradient(100% 90% at 100% 100%, rgba(0, 55, 115, 0.18), transparent 55%),
            linear-gradient(180deg, #062447 0%, #031935 100%) !important;
          box-shadow:
            0 22px 54px rgba(0, 8, 22, 0.48),
            inset 0 1px 0 rgba(220, 238, 255, 0.18) !important;
          overflow: hidden !important;
        }

        .listing-detail-page .seller-card-body.seller-card-panel {
          background: transparent !important;
          display: block !important;
          padding: 30px 28px 28px !important;
        }

        .listing-detail-page .seller-card-top {
          display: flex !important;
          justify-content: flex-end !important;
          align-items: center !important;
          margin: 0 0 30px !important;
        }

        .listing-detail-page .seller-card-label {
          display: none !important;
        }

        .listing-detail-page .seller-profile-btn {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          width: auto !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: rgba(226, 236, 249, 0.88) !important;
          font-size: 18px !important;
          font-weight: 650 !important;
          line-height: 1 !important;
        }

        .listing-detail-page .seller-profile-btn svg {
          color: rgba(226, 236, 249, 0.86) !important;
          width: 24px !important;
          height: 24px !important;
        }

        .listing-detail-page .seller-identity-row {
          display: grid !important;
          grid-template-columns: 96px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 24px !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-avatar-detail,
        .listing-detail-page .seller-avatar-img {
          width: 96px !important;
          height: 96px !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          border: 0 !important;
          box-shadow: 0 14px 26px rgba(0, 8, 20, 0.22) !important;
          object-fit: cover !important;
        }

        .listing-detail-page .seller-info,
        .listing-detail-page .seller-name-row {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          text-align: left !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-name-row strong {
          display: block !important;
          max-width: 100% !important;
          color: #ffffff !important;
          font-size: 30px !important;
          font-weight: 900 !important;
          letter-spacing: 0 !important;
          line-height: 1.08 !important;
          white-space: normal !important;
          word-break: normal !important;
          overflow-wrap: anywhere !important;
          text-align: left !important;
        }

        .listing-detail-page .seller-card .verified-chip {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 8px !important;
          margin: 10px 0 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: #45e78c !important;
          font-size: 17px !important;
          font-weight: 800 !important;
          line-height: 1.15 !important;
          text-align: left !important;
        }

        .listing-detail-page .seller-card .verified-chip svg {
          width: 22px !important;
          height: 22px !important;
          color: #43e789 !important;
          fill: #43e789 !important;
          stroke: #062447 !important;
          stroke-width: 3 !important;
        }

        .listing-detail-page .seller-meta-rows {
          display: grid !important;
          gap: 18px !important;
          margin: 34px 0 0 !important;
          padding: 26px 0 0 !important;
          border-top: 1px solid rgba(177, 203, 230, 0.3) !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-meta-row {
          display: grid !important;
          grid-template-columns: 32px auto 1fr !important;
          align-items: center !important;
          gap: 10px !important;
          color: rgba(219, 229, 242, 0.78) !important;
          font-size: 20px !important;
          font-weight: 650 !important;
          line-height: 1.2 !important;
          text-align: left !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-meta-row svg {
          width: 24px !important;
          height: 24px !important;
          color: rgba(219, 229, 242, 0.82) !important;
        }

        .listing-detail-page .seller-meta-row strong {
          color: #ffffff !important;
          font-size: 20px !important;
          font-weight: 800 !important;
          line-height: 1.2 !important;
          white-space: normal !important;
        }

        .listing-detail-page .seller-divider {
          display: none !important;
        }

        .listing-detail-page .seller-contact-merged {
          display: grid !important;
          gap: 14px !important;
          margin: 34px 0 0 !important;
          background: transparent !important;
        }

        .listing-detail-page .seller-contact-merged .message-btn,
        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 16px !important;
          width: 100% !important;
          height: 62px !important;
          min-height: 62px !important;
          margin: 0 !important;
          padding: 0 18px !important;
          border-radius: 16px !important;
          box-shadow: none !important;
          font-size: 22px !important;
          font-weight: 800 !important;
          letter-spacing: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          text-align: center !important;
        }

        .listing-detail-page .seller-contact-merged .message-btn {
          background: linear-gradient(90deg, #ff991f 0%, #ff5f00 100%) !important;
          border: 1px solid rgba(255, 181, 91, 0.7) !important;
          color: #ffffff !important;
        }

        .listing-detail-page .seller-contact-merged .phone-btn,
        .listing-detail-page .seller-contact-merged .phone-number,
        .listing-detail-page .seller-contact-merged .login-contact {
          background: transparent !important;
          border: 2px solid #ff9418 !important;
          color: #f6f8fc !important;
        }

        .listing-detail-page .seller-contact-merged svg {
          width: 26px !important;
          height: 26px !important;
          flex: 0 0 auto !important;
        }

        .listing-detail-page .contact-card {
          display: none !important;
        }

        @media (max-width: 420px) {
          .listing-detail-page .seller-card {
            border-radius: 24px !important;
          }

          .listing-detail-page .seller-card-body.seller-card-panel {
            padding: 24px 22px 22px !important;
          }

          .listing-detail-page .seller-card-top {
            margin-bottom: 26px !important;
          }

          .listing-detail-page .seller-profile-btn {
            font-size: 15px !important;
          }

          .listing-detail-page .seller-profile-btn svg {
            width: 18px !important;
            height: 18px !important;
          }

          .listing-detail-page .seller-identity-row {
            grid-template-columns: 72px minmax(0, 1fr) !important;
            gap: 18px !important;
          }

          .listing-detail-page .seller-avatar-detail,
          .listing-detail-page .seller-avatar-img {
            width: 72px !important;
            height: 72px !important;
            border-radius: 14px !important;
          }

          .listing-detail-page .seller-name-row strong {
            font-size: 30px !important;
          }

          .listing-detail-page .seller-card .verified-chip {
            font-size: 16px !important;
          }

          .listing-detail-page .seller-card .verified-chip svg {
            width: 18px !important;
            height: 18px !important;
          }

          .listing-detail-page .seller-meta-row {
            grid-template-columns: 26px auto 1fr !important;
            font-size: 17px !important;
          }

          .listing-detail-page .seller-meta-row strong {
            font-size: 17px !important;
          }

          .listing-detail-page .seller-contact-merged .message-btn,
          .listing-detail-page .seller-contact-merged .phone-btn,
          .listing-detail-page .seller-contact-merged .phone-number,
          .listing-detail-page .seller-contact-merged .login-contact {
            height: 58px !important;
            min-height: 58px !important;
            font-size: 19px !important;
          }
        }

        main.listing-detail-page .seller-card .seller-card-top a.seller-profile-btn.seller-profile-btn-top {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          width: auto !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          color: rgba(226, 236, 249, 0.88) !important;
          font-size: 18px !important;
          font-weight: 650 !important;
          line-height: 1 !important;
        }

        main.listing-detail-page .seller-card .seller-card-top a.seller-profile-btn.seller-profile-btn-top svg {
          color: rgba(226, 236, 249, 0.86) !important;
          width: 24px !important;
          height: 24px !important;
        }

        @media (min-width: 900px) {
          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            grid-template-columns: minmax(0, 1fr) minmax(320px, 350px) !important;
            align-items: start !important;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar {
            max-width: 350px !important;
            width: 100% !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card {
            border-radius: 24px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-body.seller-card-panel {
            padding: 18px 20px 18px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-top.seller-card-top {
            margin: 0 0 14px !important;
          }

          .listing-detail-page .seller-profile-btn,
          main.listing-detail-page .seller-card .seller-card-top a.seller-profile-btn.seller-profile-btn-top {
            background: transparent !important;
            background-image: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: rgba(226, 236, 249, 0.88) !important;
            font-size: 14px !important;
            font-weight: 650 !important;
            padding: 0 !important;
            width: auto !important;
          }

          .listing-detail-page .seller-profile-btn svg,
          main.listing-detail-page .seller-card .seller-card-top a.seller-profile-btn.seller-profile-btn-top svg {
            width: 18px !important;
            height: 18px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-identity-row.seller-identity-row {
            grid-template-columns: 70px minmax(0, 1fr) !important;
            gap: 14px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-detail.seller-avatar-detail,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-img.seller-avatar-img {
            width: 70px !important;
            height: 70px !important;
            border-radius: 14px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-name-row.seller-name-row strong {
            font-size: 22px !important;
            line-height: 1.08 !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
            font-size: 14px !important;
            margin-top: 6px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip svg {
            width: 16px !important;
            height: 16px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows {
            gap: 7px !important;
            margin-top: 16px !important;
            padding-top: 0 !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row {
            grid-template-columns: 24px auto 1fr !important;
            gap: 8px !important;
            font-size: 14px !important;
            line-height: 1.05 !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row svg {
            width: 18px !important;
            height: 18px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row strong {
            font-size: 14px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged {
            gap: 10px !important;
            margin-top: 18px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact {
            height: 42px !important;
            min-height: 42px !important;
            border-radius: 12px !important;
            font-size: 15px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged svg {
            width: 19px !important;
            height: 19px !important;
          }
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows,
        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows {
          border-top: 0 !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row::before,
        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row::after,
        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows::before,
        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows::after {
          display: none !important;
          content: none !important;
        }

        @media (max-width: 420px) {
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-name-row.seller-name-row strong {
            font-size: 30px !important;
            line-height: 1.08 !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
            font-size: 16px !important;
            line-height: 1.15 !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip svg {
            width: 18px !important;
            height: 18px !important;
          }
        }

        /* Listing page reference polish, Finnish content only */
        main.listing-detail-page {
          background:
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 10px),
            radial-gradient(900px 520px at 18% 0%, rgba(20, 72, 122, 0.3), transparent 64%),
            linear-gradient(180deg, #06111e 0%, #020912 100%) !important;
        }

        main.listing-detail-page .container {
          max-width: 1240px !important;
          padding: 22px 20px 54px !important;
        }

        body main.page.listing-detail-page.listing-detail-page section.layout.layout {
          grid-template-columns: minmax(0, 780px) minmax(320px, 350px) !important;
          gap: 18px !important;
          justify-content: center !important;
        }

        main.listing-detail-page .main {
          background:
            radial-gradient(100% 80% at 10% 0%, rgba(33, 81, 130, 0.34), transparent 56%),
            linear-gradient(180deg, #061d39 0%, #031425 100%) !important;
          border: 1px solid rgba(128, 167, 210, 0.28) !important;
          border-radius: 22px !important;
          box-shadow: 0 24px 58px rgba(0, 8, 20, 0.38) !important;
          overflow: hidden !important;
          padding: 26px !important;
        }

        main.listing-detail-page .listing-featured-pill {
          align-items: center !important;
          border: 1px solid rgba(255, 141, 24, 0.72) !important;
          border-radius: 999px !important;
          color: #ff9a1f !important;
          display: inline-flex !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          gap: 8px !important;
          margin: 0 0 12px !important;
          padding: 6px 12px !important;
          text-transform: uppercase !important;
          width: fit-content !important;
        }

        main.listing-detail-page .listing-featured-pill svg {
          width: 14px !important;
          height: 14px !important;
        }

        main.listing-detail-page .title-row {
          margin-bottom: 18px !important;
        }

        main.listing-detail-page .title-row h1 {
          color: #ffffff !important;
          font-size: 30px !important;
          font-weight: 900 !important;
          letter-spacing: 0 !important;
          line-height: 1.1 !important;
        }

        main.listing-detail-page .desktop-image-meta {
          color: rgba(230, 239, 249, 0.86) !important;
          font-size: 14px !important;
          font-weight: 750 !important;
          margin: 0 0 18px !important;
          padding: 0 !important;
        }

        main.listing-detail-page .desktop-image-meta strong {
          color: #ffae52 !important;
          font-size: 14px !important;
          font-weight: 900 !important;
        }

        main.listing-detail-page .image-wrapper {
          background: #111923 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          margin: 0 -26px !important;
        }

        main.listing-detail-page .main-img-button,
        main.listing-detail-page .main-img {
          height: min(54vh, 520px) !important;
          min-height: 420px !important;
        }

        main.listing-detail-page .desktop-image-thumbs {
          display: flex !important;
          gap: 12px !important;
          margin: -86px 0 18px !important;
          padding: 0 18px !important;
          position: relative !important;
          z-index: 8 !important;
        }

        main.listing-detail-page .desktop-image-thumbs button {
          background: rgba(8, 18, 32, 0.78) !important;
          border: 1px solid rgba(147, 176, 209, 0.32) !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          height: 72px !important;
          overflow: hidden !important;
          padding: 0 !important;
          width: 118px !important;
        }

        main.listing-detail-page .desktop-image-thumbs button.active {
          border-color: #ff9418 !important;
        }

        main.listing-detail-page .desktop-image-thumbs img {
          height: 100% !important;
          object-fit: cover !important;
          width: 100% !important;
        }

        main.listing-detail-page .price-actions-row {
          border-bottom: 1px solid rgba(150, 181, 215, 0.24) !important;
          margin: 0 -26px !important;
          padding: 20px 26px !important;
        }

        main.listing-detail-page .price-display {
          color: #ffffff !important;
          font-size: 32px !important;
          font-weight: 950 !important;
        }

        main.listing-detail-page .description-card {
          background: transparent !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(150, 181, 215, 0.2) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          margin: 0 -26px !important;
          padding: 0 26px !important;
        }

        main.listing-detail-page .listing-section-toggle {
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          min-height: 44px !important;
          padding: 0 !important;
        }

        main.listing-detail-page .listing-section-content {
          color: rgba(235, 243, 252, 0.9) !important;
          padding: 0 0 20px !important;
        }

        main.listing-detail-page .listing-fact-grid span {
          background: rgba(255, 255, 255, 0.04) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          color: rgba(235, 243, 252, 0.9) !important;
        }

        main.listing-detail-page .listing-fact-grid strong {
          color: rgba(255, 255, 255, 0.62) !important;
        }

        @media (max-width: 900px) {
          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            grid-template-columns: 1fr !important;
          }

          main.listing-detail-page .main {
            padding: 18px !important;
          }

          main.listing-detail-page .image-wrapper,
          main.listing-detail-page .price-actions-row,
          main.listing-detail-page .description-card {
            margin-left: -18px !important;
            margin-right: -18px !important;
          }

          main.listing-detail-page .desktop-image-thumbs {
            display: none !important;
          }

          main.listing-detail-page .main-img-button,
          main.listing-detail-page .main-img {
            height: min(62vh, 520px) !important;
            min-height: 320px !important;
          }
        }

        /* Final listing page reference v2 */
        html,
        body {
          background: #030b14 !important;
          overflow-x: hidden !important;
        }

        body main.page.listing-detail-page.listing-detail-page {
          color: #f8fbff !important;
          overflow-x: hidden !important;
        }

        body main.page.listing-detail-page.listing-detail-page .container.container {
          box-sizing: border-box !important;
          max-width: 1220px !important;
          padding: 20px 20px 52px !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page section.layout.layout {
          display: grid !important;
          gap: 18px !important;
          grid-template-columns: minmax(0, 760px) minmax(320px, 350px) !important;
          justify-content: center !important;
          max-width: 1128px !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main.main {
          background:
            radial-gradient(820px 420px at 12% 0%, rgba(37, 86, 137, 0.34), transparent 58%),
            linear-gradient(180deg, #061d39 0%, #031426 100%) !important;
          border: 1px solid rgba(121, 157, 198, 0.28) !important;
          border-radius: 20px !important;
          box-shadow: 0 24px 68px rgba(0, 6, 16, 0.42) !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          padding: 24px 26px 0 !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-featured-pill.listing-featured-pill {
          border-color: rgba(255, 139, 23, 0.82) !important;
          color: #ff9c25 !important;
          font-size: 12px !important;
          height: 30px !important;
          margin-bottom: 12px !important;
          padding: 0 13px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .title-row.title-row {
          margin: 0 0 24px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .title-row.title-row h1 {
          color: #ffffff !important;
          font-size: 31px !important;
          font-weight: 950 !important;
          line-height: 1.08 !important;
          margin: 0 !important;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
          color: rgba(232, 241, 251, 0.9) !important;
          font-size: 14px !important;
          font-weight: 800 !important;
          gap: 14px !important;
          margin: 0 0 22px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta strong {
          color: #ffae52 !important;
          font-size: 14px !important;
          font-weight: 950 !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
          background: #101820 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          margin: 0 -26px !important;
          overflow: hidden !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
        body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
          height: 520px !important;
          min-height: 520px !important;
          max-height: 520px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
          object-fit: cover !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-badge.image-badge {
          background: rgba(4, 12, 22, 0.78) !important;
          border: 1px solid rgba(219, 232, 247, 0.26) !important;
          color: #ffffff !important;
          left: 24px !important;
          top: 18px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-zoom-button.image-zoom-button {
          background: rgba(4, 12, 22, 0.72) !important;
          border: 1px solid rgba(219, 232, 247, 0.32) !important;
          color: #ffffff !important;
          right: 24px !important;
          top: 18px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
          display: flex !important;
          gap: 12px !important;
          margin: -84px 0 16px !important;
          padding: 0 18px !important;
          position: relative !important;
          z-index: 8 !important;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs button {
          background: rgba(5, 14, 26, 0.86) !important;
          border: 1px solid rgba(139, 169, 205, 0.36) !important;
          border-radius: 8px !important;
          box-shadow: none !important;
          height: 74px !important;
          width: 124px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs button.active {
          border-color: #ff9418 !important;
        }

        body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
          border-bottom: 1px solid rgba(139, 169, 205, 0.24) !important;
          margin: 0 -26px !important;
          padding: 20px 26px 18px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-actions.image-actions {
          justify-content: space-between !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .price-display.price-display {
          color: #ffffff !important;
          font-size: 34px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
        }

        body main.page.listing-detail-page.listing-detail-page .icon-btn.icon-btn {
          background: rgba(7, 20, 36, 0.84) !important;
          border: 1px solid rgba(148, 180, 215, 0.3) !important;
          border-radius: 10px !important;
          color: #ffffff !important;
        }

        body main.page.listing-detail-page.listing-detail-page .description-card.description-card {
          background: transparent !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(139, 169, 205, 0.22) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          margin: 0 -26px !important;
          padding: 0 26px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-section-toggle.listing-section-toggle {
          background: transparent !important;
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          min-height: 46px !important;
          padding: 0 !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-section-content.listing-section-content {
          color: rgba(237, 244, 252, 0.92) !important;
          padding-bottom: 22px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid {
          gap: 10px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid span {
          background: rgba(255, 255, 255, 0.04) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          color: #ffffff !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-extra-card.listing-extra-card::after,
        body main.page.listing-detail-page.listing-detail-page .listing-facts-card.listing-facts-card::after {
          content: none !important;
          display: none !important;
        }

        @media (max-width: 1100px) {
          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            grid-template-columns: minmax(0, 1fr) !important;
            max-width: 780px !important;
          }
        }

        @media (max-width: 760px) {
          body main.page.listing-detail-page.listing-detail-page .container.container {
            padding: 14px 12px 42px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .main.main {
            border-radius: 16px !important;
            padding: 18px 18px 0 !important;
          }

          body main.page.listing-detail-page.listing-detail-page .title-row.title-row h1 {
            font-size: 24px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper,
          body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row,
          body main.page.listing-detail-page.listing-detail-page .description-card.description-card {
            margin-left: -18px !important;
            margin-right: -18px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
          body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
            height: 330px !important;
            min-height: 330px !important;
            max-height: 330px !important;
          }
        }

        /* Final reference match: page scale and section proportions */
        @media (min-width: 1101px) {
          body main.page.listing-detail-page.listing-detail-page .container.container {
            max-width: 1240px !important;
            padding: 20px 20px 54px !important;
          }

          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            gap: 18px !important;
            grid-template-columns: 780px 390px !important;
            max-width: 1188px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .main.main {
            border-radius: 20px !important;
            padding: 26px 26px 0 !important;
          }

          body main.page.listing-detail-page.listing-detail-page .title-row.title-row h1 {
            font-size: 32px !important;
            line-height: 1.08 !important;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
            margin-bottom: 20px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
            margin-left: -26px !important;
            margin-right: -26px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
          body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
            height: 520px !important;
            min-height: 520px !important;
            max-height: 520px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
            display: flex !important;
            gap: 12px !important;
            margin: -86px 0 16px !important;
            padding: 0 18px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs button {
            height: 74px !important;
            width: 124px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
            margin-left: -26px !important;
            margin-right: -26px !important;
            padding: 20px 26px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .price-stack.price-stack {
            display: grid !important;
            gap: 6px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .price-display.price-display {
            font-size: 34px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .price-subline.price-subline {
            color: rgba(229, 239, 250, 0.78) !important;
            display: block !important;
            font-size: 14px !important;
            font-weight: 650 !important;
          }

          body main.page.listing-detail-page.listing-detail-page .description-card.description-card {
            margin-left: -26px !important;
            margin-right: -26px !important;
            padding-left: 26px !important;
            padding-right: 26px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-section-content.listing-section-content p {
            color: rgba(238, 245, 253, 0.94) !important;
            font-size: 15px !important;
            line-height: 1.55 !important;
            max-width: 600px !important;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar {
            max-width: 390px !important;
            width: 390px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card {
            border-radius: 20px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-body.seller-card-panel {
            padding: 32px 26px 28px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-top.seller-card-top {
            margin-bottom: 26px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-identity-row.seller-identity-row {
            grid-template-columns: 102px minmax(0, 1fr) !important;
            gap: 22px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-detail.seller-avatar-detail,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-img.seller-avatar-img {
            width: 102px !important;
            height: 102px !important;
            border-radius: 16px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-name-row.seller-name-row strong {
            font-size: 26px !important;
            line-height: 1.1 !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
            font-size: 16px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows {
            gap: 16px !important;
            margin-top: 30px !important;
            padding-top: 0 !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row {
            font-size: 16px !important;
            grid-template-columns: 26px auto 1fr !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row strong {
            font-size: 16px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged {
            gap: 14px !important;
            margin-top: 30px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact {
            height: 56px !important;
            min-height: 56px !important;
            border-radius: 10px !important;
            font-size: 18px !important;
          }
        }

        /* Final reference match v3: responsive scale parity */
        @media (min-width: 760px) and (max-width: 1100px) {
          body main.page.listing-detail-page.listing-detail-page .container.container {
            max-width: 940px !important;
            padding: 18px 18px 48px !important;
          }

          body main.page.listing-detail-page.listing-detail-page section.layout.layout {
            display: grid !important;
            gap: 14px !important;
            grid-template-columns: minmax(0, 560px) 300px !important;
            justify-content: center !important;
            max-width: 874px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .main.main {
            border-radius: 16px !important;
            padding: 24px 20px 0 !important;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-featured-pill.listing-featured-pill {
            font-size: 11px !important;
            height: 26px !important;
            margin-bottom: 10px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .title-row.title-row h1 {
            font-size: 28px !important;
            line-height: 1.08 !important;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
            font-size: 13px !important;
            margin-bottom: 18px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
            margin-left: -20px !important;
            margin-right: -20px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
          body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
            height: 420px !important;
            min-height: 420px !important;
            max-height: 420px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
            margin: -72px 0 14px !important;
            padding: 0 14px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs button {
            height: 62px !important;
            width: 98px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
            margin-left: -20px !important;
            margin-right: -20px !important;
            padding: 18px 20px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .price-display.price-display {
            font-size: 30px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .description-card.description-card {
            margin-left: -20px !important;
            margin-right: -20px !important;
            padding-left: 20px !important;
            padding-right: 20px !important;
          }

          body main.page.listing-detail-page.listing-detail-page aside.sidebar.sidebar {
            max-width: 300px !important;
            width: 300px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card {
            border-radius: 16px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-body.seller-card-panel {
            padding: 22px 18px 22px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-card-top.seller-card-top {
            margin-bottom: 20px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-identity-row.seller-identity-row {
            grid-template-columns: 82px minmax(0, 1fr) !important;
            gap: 16px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-detail.seller-avatar-detail,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-avatar-img.seller-avatar-img {
            width: 82px !important;
            height: 82px !important;
            border-radius: 14px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-name-row.seller-name-row strong {
            font-size: 22px !important;
            line-height: 1.08 !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
            font-size: 14px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-rows.seller-meta-rows {
            gap: 12px !important;
            margin-top: 24px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-meta-row.seller-meta-row strong {
            font-size: 14px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged {
            gap: 12px !important;
            margin-top: 24px !important;
          }

          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number,
          main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact {
            height: 50px !important;
            min-height: 50px !important;
            border-radius: 10px !important;
            font-size: 15px !important;
          }
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stats-row.seller-stats-row {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 1fr 1fr !important;
          margin: 22px 0 0 !important;
          padding: 0 !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-type-corner.seller-type-corner {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: rgba(221, 233, 247, 0.86) !important;
          display: inline-flex !important;
          font-size: 13px !important;
          font-weight: 800 !important;
          gap: 7px !important;
          justify-self: start !important;
          line-height: 1 !important;
          min-width: 0 !important;
          margin-right: auto !important;
          white-space: nowrap !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-type-corner.seller-type-corner svg {
          color: rgba(221, 233, 247, 0.9) !important;
          flex: 0 0 auto !important;
          height: 15px !important;
          width: 15px !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-type-corner.seller-type-corner strong {
          color: #ffffff !important;
          font-weight: 900 !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stats-row.seller-stats-row.seller-stats-row-single {
          grid-template-columns: 1fr !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat {
          align-items: center !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
          display: flex !important;
          gap: 10px !important;
          min-width: 0 !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat svg {
          flex: 0 0 auto !important;
          height: 21px !important;
          width: 21px !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat-rating svg {
          color: #ff9418 !important;
          fill: #ff9418 !important;
          stroke: #ff9418 !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat-sales svg {
          color: #f7fbff !important;
          fill: none !important;
          stroke: #f7fbff !important;
          stroke-width: 2.2 !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat span {
          display: grid !important;
          gap: 2px !important;
          min-width: 0 !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat strong {
          color: #ffffff !important;
          font-size: 18px !important;
          font-weight: 900 !important;
          line-height: 1 !important;
        }

        main.listing-detail-page.listing-detail-page .seller-card.seller-card .seller-stat.seller-stat small {
          color: rgba(238, 246, 255, 0.78) !important;
          font-size: 11px !important;
          font-weight: 650 !important;
          line-height: 1.1 !important;
          white-space: nowrap !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main.main {
          background: #062142 !important;
          background-image: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page .title-row.title-row {
          align-items: flex-start !important;
          display: flex !important;
          gap: 16px !important;
          justify-content: space-between !important;
          margin-bottom: 24px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-featured-pill.listing-featured-pill {
          display: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-top-actions.listing-top-actions {
          display: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions {
          align-items: center !important;
          display: flex !important;
          flex: 0 0 auto !important;
          gap: 10px !important;
          justify-content: flex-end !important;
          margin-left: auto !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn {
          align-items: center !important;
          background: #082449 !important;
          border: 1px solid rgba(160, 190, 226, 0.34) !important;
          border-radius: 10px !important;
          box-shadow: none !important;
          color: rgba(239, 246, 255, 0.92) !important;
          display: inline-flex !important;
          height: 40px !important;
          justify-content: center !important;
          min-height: 40px !important;
          padding: 0 !important;
          width: 40px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn:hover {
          background: #0a2b56 !important;
          border-color: rgba(196, 216, 240, 0.48) !important;
        }

        body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row,
        body main.page.listing-detail-page.listing-detail-page .description-card.description-card,
        body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
          background: #062142 !important;
          background-image: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
          border-top: 0 !important;
          border-bottom: 1px solid rgba(150, 181, 215, 0.2) !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
          background: #062142 !important;
          background-image: none !important;
          box-sizing: border-box !important;
          padding: 0 !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-actions.image-actions {
          align-items: center !important;
          display: flex !important;
          gap: 16px !important;
          justify-content: space-between !important;
        }

        body main.page.listing-detail-page.listing-detail-page .price-stack.price-stack {
          margin-right: 0 !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-section-content.listing-section-content,
        body main.page.listing-detail-page.listing-detail-page .listing-section-content.listing-section-content p,
        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid,
        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid span {
          background: #062142 !important;
          background-color: #062142 !important;
          background-image: none !important;
          box-shadow: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid span {
          border: 1px solid rgba(150, 181, 215, 0.2) !important;
          border-radius: 10px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-extra-card.listing-extra-card,
        body main.page.listing-detail-page.listing-detail-page .listing-facts-card.listing-facts-card {
          background: #062142 !important;
          background-image: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
          background: #062142 !important;
          background-image: none !important;
        }

        body:has(main.listing-detail-page.listing-detail-page) .universal-app-topbar {
          border-radius: 0 !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main.main,
        body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card {
          border-radius: 10px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper,
        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
        body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
          border-radius: 0 !important;
          overflow: hidden !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button {
          background: #062142 !important;
          box-sizing: border-box !important;
          display: block !important;
          max-width: none !important;
          padding: 0 !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
          display: block !important;
          object-fit: cover !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-image-soft-bg.listing-image-soft-bg {
          display: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper::after {
          content: none !important;
          display: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button > img.main-img.main-img {
          height: 100% !important;
          max-width: none !important;
          min-width: 100% !important;
          object-fit: cover !important;
          object-position: center center !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button {
          line-height: 0 !important;
          overflow: hidden !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-badge.image-badge {
          left: 12px !important;
          top: 12px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-zoom-button.image-zoom-button {
          right: 12px !important;
          top: 12px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .mobile-image-actions.mobile-image-actions {
          display: none !important;
        }

        body main.page.listing-detail-page.listing-detail-page .image-wrapper.image-wrapper {
          background: #06111f !important;
          border-left: 0 !important;
          border-right: 0 !important;
          box-sizing: border-box !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button {
          align-items: center !important;
          background: #06111f !important;
          display: flex !important;
          justify-content: center !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button > img.main-img.main-img {
          display: block !important;
          height: 520px !important;
          max-height: 520px !important;
          max-width: 100% !important;
          min-height: 520px !important;
          min-width: 0 !important;
          object-fit: contain !important;
          object-position: center center !important;
          width: 100% !important;
        }

        body main.page.listing-detail-page.listing-detail-page .desktop-image-thumbs.desktop-image-thumbs {
          background: #06111f !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: 14px !important;
          padding-right: 14px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-image-preview.listing-image-preview {
          align-items: center !important;
          inset: var(--topbar-h, 64px) 0 0 !important;
          padding: 18px 22px 22px !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-image-preview-panel.listing-image-preview-panel {
          max-height: min(calc(100dvh - var(--topbar-h, 64px) - 40px), 820px) !important;
          max-width: min(94vw, 1120px) !important;
        }

        body main.page.listing-detail-page.listing-detail-page .listing-image-preview-panel.listing-image-preview-panel img {
          max-height: min(calc(100dvh - var(--topbar-h, 64px) - 40px), 820px) !important;
          object-fit: contain !important;
        }

        body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip {
          color: #dbeafe !important;
        }

        body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card .verified-chip.verified-chip svg {
          color: #8fbfff !important;
          fill: none !important;
          stroke: #8fbfff !important;
        }

        @media (max-width: 760px) {
          body main.page.listing-detail-page.listing-detail-page .container.container {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .main.main,
          body main.page.listing-detail-page.listing-detail-page .seller-card.seller-card {
            border-radius: 8px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .title-row.title-row {
            margin-bottom: 14px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            line-height: 1.25 !important;
            margin-bottom: 12px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .image-actions.image-actions {
            align-items: center !important;
            display: grid !important;
            gap: 12px !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
          }

          body main.page.listing-detail-page.listing-detail-page .price-actions-row.price-actions-row {
            padding-bottom: 16px !important;
            padding-top: 16px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .price-display.price-display {
            font-size: 28px !important;
            line-height: 1 !important;
          }

          body main.page.listing-detail-page.listing-detail-page .price-subline.price-subline {
            font-size: 11px !important;
            line-height: 1.25 !important;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions {
            display: flex !important;
            gap: 8px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn {
            border-radius: 8px !important;
            height: 38px !important;
            min-height: 38px !important;
            width: 38px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .main-img-button.main-img-button,
          body main.page.listing-detail-page.listing-detail-page .main-img.main-img {
            height: 280px !important;
            min-height: 280px !important;
            max-height: 280px !important;
          }

          body main.page.listing-detail-page.listing-detail-page .listing-fact-grid.listing-fact-grid {
            grid-template-columns: 1fr !important;
          }
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
          aspect-ratio: auto !important;
          box-sizing: border-box !important;
          height: auto !important;
          min-height: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          padding: 0 !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
          box-sizing: border-box !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          max-width: none !important;
          min-width: 100% !important;
          width: 100% !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta) {
          align-items: center !important;
          box-sizing: border-box !important;
          display: grid !important;
          grid-template-columns: auto auto auto minmax(0, 1fr) auto !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta > span:first-child) {
          grid-column: 1 !important;
          margin-left: 0 !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta strong) {
          grid-column: 5 !important;
          grid-row: 1 !important;
          margin-left: auto !important;
          margin-right: clamp(18px, 2.6vw, 30px) !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta strong),
        body main.page.listing-detail-page.listing-detail-page .desktop-image-meta.desktop-image-meta strong {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          outline: 0 !important;
          padding: 0 !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
          align-items: center !important;
          gap: 8px !important;
          justify-content: flex-start !important;
          margin: -64px 0 10px !important;
          padding: 0 18px !important;
          pointer-events: none !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button) {
          background: rgba(4, 13, 25, 0.48) !important;
          border: 1px solid rgba(255, 148, 24, 0.72) !important;
          border-radius: 6px !important;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28) !important;
          height: 42px !important;
          overflow: hidden !important;
          pointer-events: auto !important;
          width: 68px !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs img) {
          height: 100% !important;
          object-fit: cover !important;
          width: 100% !important;
        }

        @media (min-width: 641px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            background: #06111f !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button) {
            align-items: center !important;
            background: #06111f !important;
            display: flex !important;
            justify-content: center !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            height: 100% !important;
            object-fit: contain !important;
            object-position: center center !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            background: #062142 !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.14) !important;
            display: flex !important;
            gap: 10px !important;
            justify-content: flex-start !important;
            margin: 0 -26px 0 !important;
            overflow: hidden !important;
            padding: 14px 26px 16px !important;
            pointer-events: auto !important;
            scrollbar-width: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button) {
            background: rgba(2, 10, 20, 0.56) !important;
            border: 1px solid rgba(143, 191, 255, 0.32) !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            flex: 1 1 0 !important;
            height: clamp(44px, 8vw, 70px) !important;
            max-width: 94px !important;
            min-width: 0 !important;
            width: auto !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button.active) {
            border-color: #ff8a1c !important;
            box-shadow: 0 0 0 1px rgba(255, 138, 28, 0.24) !important;
          }
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-subline.price-subline) {
          display: none !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
          display: flex !important;
          justify-content: flex-end !important;
          padding-bottom: 18px !important;
          padding-top: 16px !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-actions.image-actions) {
          align-items: center !important;
          display: flex !important;
          gap: 18px !important;
          justify-content: flex-end !important;
          width: auto !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-stack.price-stack) {
          align-items: flex-end !important;
          text-align: right !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions) {
          display: flex !important;
          gap: 10px !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.icon-btn.icon-btn.icon-saved) {
          background: rgba(255, 122, 26, 0.18) !important;
          border-color: #ff8a1c !important;
          color: #ff8a1c !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.icon-btn.icon-btn.icon-saved svg) {
          color: #ff8a1c !important;
          fill: #ff8a1c !important;
          stroke: #ff8a1c !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow.gallery-arrow) {
          align-items: center !important;
          background: rgba(3, 12, 24, 0.74) !important;
          border: 1px solid rgba(255, 255, 255, 0.28) !important;
          border-radius: 999px !important;
          color: #ffffff !important;
          display: inline-flex !important;
          height: 42px !important;
          justify-content: center !important;
          position: absolute !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          width: 42px !important;
          z-index: 9 !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-left.gallery-arrow-left) {
          left: 14px !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-right.gallery-arrow-right) {
          right: 14px !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip) {
          color: #32f58a !important;
        }

        :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip svg) {
          color: #32f58a !important;
          fill: none !important;
          stroke: #32f58a !important;
        }

        @media (max-width: 760px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta) {
            display: flex !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta > span:first-child) {
            margin-left: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            margin: -56px 0 8px !important;
            padding-left: 12px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button) {
            height: 38px !important;
            width: 62px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            justify-content: stretch !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-actions.image-actions) {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-stack.price-stack) {
            align-items: flex-start !important;
            text-align: left !important;
          }
        }

        @media (max-width: 640px) {
          :global(body) {
            background: #07111c !important;
          }

          :global(body:has(main.listing-detail-page.listing-detail-page) .universal-app-topbar) {
            background: #07111c !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.12) !important;
            border-radius: 0 !important;
            height: 76px !important;
            padding: 12px 12px !important;
          }

          :global(body:has(main.listing-detail-page.listing-detail-page) .universal-return-button) {
            height: 44px !important;
            min-width: 44px !important;
            overflow: hidden !important;
            padding: 0 !important;
            width: 44px !important;
          }

          :global(body:has(main.listing-detail-page.listing-detail-page) .universal-return-button span) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) {
            background: #07111c !important;
            padding: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.container.container) {
            max-width: 460px !important;
            padding: 16px 10px 36px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.layout.layout) {
            display: flex !important;
            flex-direction: column !important;
            gap: 18px !important;
            max-width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main.main) {
            background: #062142 !important;
            border: 1px solid rgba(75, 139, 205, 0.58) !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            padding: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            border: 0 !important;
            border-radius: 0 !important;
            margin: 0 !important;
            order: 1 !important;
            overflow: hidden !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img.main-img) {
            height: clamp(280px, 70vw, 340px) !important;
            max-height: 340px !important;
            min-height: 280px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-badge.image-badge) {
            background: rgba(3, 12, 24, 0.82) !important;
            border: 1px solid rgba(255, 255, 255, 0.24) !important;
            border-radius: 6px !important;
            font-size: 12px !important;
            font-weight: 950 !important;
            left: 10px !important;
            min-height: 24px !important;
            padding: 0 7px !important;
            top: 10px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-zoom-button.image-zoom-button) {
            height: 42px !important;
            right: 12px !important;
            top: 12px !important;
            width: 42px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row) {
            background: #04182d !important;
            border: 1px solid rgba(143, 191, 255, 0.16) !important;
            border-left: 0 !important;
            border-right: 0 !important;
            margin: 0 !important;
            order: 2 !important;
            padding: 16px 18px 14px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-left.title-left) {
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id) {
            align-items: baseline !important;
            color: #d7e5f7 !important;
            display: flex !important;
            font-size: 12px !important;
            font-weight: 900 !important;
            gap: 8px !important;
            justify-content: flex-start !important;
            margin: 0 0 5px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id strong) {
            color: #ffffff !important;
            display: inline-flex !important;
            font-size: 20px !important;
            font-weight: 950 !important;
            line-height: 1 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row h1) {
            color: #ffffff !important;
            font-size: 24px !important;
            font-weight: 950 !important;
            letter-spacing: -0.03em !important;
            line-height: 1.08 !important;
            margin: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta) {
            align-items: center !important;
            background: #062142 !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.2) !important;
            color: #dbeafe !important;
            display: flex !important;
            flex-wrap: wrap !important;
            font-size: 14px !important;
            font-weight: 900 !important;
            gap: 8px !important;
            line-height: 1.3 !important;
            margin: 0 !important;
            order: 3 !important;
            padding: 18px 18px 12px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta strong) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            background: #062142 !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.16) !important;
            display: block !important;
            margin: 0 !important;
            order: 4 !important;
            padding: 20px 18px 18px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-actions.image-actions) {
            align-items: center !important;
            display: flex !important;
            justify-content: space-between !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-stack.price-stack) {
            align-items: flex-start !important;
            text-align: left !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-display.price-display) {
            color: #ffffff !important;
            font-size: 28px !important;
            font-weight: 950 !important;
            line-height: 1 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions) {
            display: flex !important;
            gap: 10px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn) {
            background: #08284e !important;
            border: 1px solid rgba(143, 191, 255, 0.42) !important;
            border-radius: 8px !important;
            height: 40px !important;
            width: 40px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card) {
            background: #062142 !important;
            border: 0 !important;
            margin: 0 !important;
            order: 5 !important;
            padding: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle) {
            border-bottom: 1px solid rgba(143, 191, 255, 0.16) !important;
            min-height: 62px !important;
            padding: 0 18px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content) {
            padding: 16px 18px 22px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(aside.sidebar.sidebar) {
            margin: 0 !important;
            max-width: none !important;
            position: static !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card) {
            background: #0a2b56 !important;
            border: 1px solid rgba(75, 139, 205, 0.56) !important;
            border-radius: 18px !important;
            box-shadow: none !important;
            margin: 0 !important;
            overflow: hidden !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-body.seller-card-panel) {
            padding: 28px 26px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-top.seller-card-top) {
            align-items: center !important;
            display: flex !important;
            justify-content: space-between !important;
            margin: 0 0 28px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-corner.seller-type-corner) {
            font-size: 16px !important;
            gap: 8px !important;
            position: static !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-profile-btn-top.seller-profile-btn-top) {
            background: transparent !important;
            border: 0 !important;
            color: #dbeafe !important;
            gap: 10px !important;
            padding: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-identity-row.seller-identity-row) {
            align-items: center !important;
            display: grid !important;
            gap: 18px !important;
            grid-template-columns: 72px minmax(0, 1fr) !important;
            margin-bottom: 30px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-detail.seller-avatar-detail),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-img.seller-avatar-img) {
            border-radius: 10px !important;
            height: 64px !important;
            width: 64px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name-row.seller-name-row strong) {
            color: #ffffff !important;
            font-size: 28px !important;
            line-height: 1.05 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip) {
            color: #dbeafe !important;
            font-size: 16px !important;
            margin-top: 10px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-rows.seller-meta-rows) {
            gap: 16px !important;
            margin-top: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row) {
            color: #cbd9ec !important;
            font-size: 18px !important;
            grid-template-columns: 26px auto minmax(0, 1fr) !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row strong) {
            color: #ffffff !important;
            font-size: 18px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-stats-row.seller-stats-row) {
            border-top: 0 !important;
            margin: 24px 0 0 !important;
            padding: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-divider.seller-divider) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged) {
            gap: 14px !important;
            margin-top: 28px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact) {
            border-radius: 14px !important;
            font-size: 20px !important;
            height: 62px !important;
            min-height: 62px !important;
          }
        }

        @media (max-width: 640px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main.main),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span) {
            background: #062142 !important;
            background-color: #062142 !important;
            background-image: none !important;
            box-shadow: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card) {
            border-color: rgba(143, 191, 255, 0.14) !important;
          }

          :global(body) {
            background:
              radial-gradient(circle at 50% -8%, rgba(28, 89, 143, 0.28), transparent 42%),
              #050d17 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) {
            background: transparent !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.container.container) {
            max-width: 430px !important;
            padding: 12px 8px 36px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main.main) {
            background:
              linear-gradient(180deg, rgba(9, 47, 88, 0.98), rgba(3, 23, 43, 0.98)) !important;
            border: 1px solid rgba(76, 144, 214, 0.62) !important;
            border-radius: 20px !important;
            overflow: hidden !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            background: #06111f !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.18) !important;
            margin: 0 !important;
            order: 1 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img.main-img) {
            height: clamp(410px, 105vw, 560px) !important;
            max-height: 560px !important;
            min-height: 410px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img.main-img) {
            object-fit: contain !important;
            object-position: center center !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-image-soft-bg.listing-image-soft-bg) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs) {
            align-items: center !important;
            bottom: 10px !important;
            display: grid !important;
            gap: 6px !important;
            grid-auto-flow: column !important;
            grid-auto-columns: minmax(34px, 1fr) !important;
            left: 12px !important;
            overflow-x: visible !important;
            padding: 0 0 2px !important;
            position: absolute !important;
            right: 12px !important;
            scrollbar-width: none !important;
            z-index: 8 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs::-webkit-scrollbar) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs button) {
            background: rgba(2, 10, 20, 0.72) !important;
            border: 1px solid rgba(143, 191, 255, 0.35) !important;
            border-radius: 7px !important;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35) !important;
            height: clamp(32px, 10vw, 48px) !important;
            max-width: 52px !important;
            min-width: 0 !important;
            overflow: hidden !important;
            padding: 0 !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs button.active) {
            border-color: #ff8a1c !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs img) {
            height: 100% !important;
            object-fit: cover !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-badge.image-badge) {
            background: rgba(2, 10, 20, 0.86) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            border-radius: 999px !important;
            font-size: 16px !important;
            height: 42px !important;
            left: 20px !important;
            padding: 0 14px !important;
            top: 22px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-zoom-button.image-zoom-button) {
            background: rgba(2, 10, 20, 0.78) !important;
            border-radius: 999px !important;
            height: 46px !important;
            right: 20px !important;
            top: 22px !important;
            width: 46px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-actions.mobile-image-actions) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row) {
            background:
              linear-gradient(180deg, rgba(3, 25, 47, 0.98), rgba(4, 31, 58, 0.98)) !important;
            border: 0 !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.16) !important;
            display: grid !important;
            gap: 18px !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            margin: 0 !important;
            padding: 26px 24px 22px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id) {
            color: #c9d8eb !important;
            display: block !important;
            font-size: 15px !important;
            font-weight: 850 !important;
            letter-spacing: 0.01em !important;
            margin: 0 0 12px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id strong) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row h1) {
            font-size: 30px !important;
            line-height: 1.08 !important;
            max-width: 92% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions) {
            align-items: center !important;
            display: flex !important;
            gap: 10px !important;
            grid-column: 1 / -1 !important;
            justify-content: space-between !important;
            margin-top: 6px !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-price.mobile-title-price) {
            color: #ffffff !important;
            display: inline-flex !important;
            flex: 1 1 auto !important;
            font-size: 34px !important;
            font-weight: 950 !important;
            letter-spacing: -0.04em !important;
            line-height: 1 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions .icon-btn.icon-btn) {
            background: rgba(6, 35, 67, 0.92) !important;
            border: 1px solid rgba(143, 191, 255, 0.34) !important;
            border-radius: 10px !important;
            color: #ffffff !important;
            height: 52px !important;
            width: 52px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta) {
            background: transparent !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.16) !important;
            color: #d9e6f7 !important;
            font-size: 16px !important;
            font-weight: 750 !important;
            gap: 12px !important;
            padding: 20px 24px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-meta.desktop-image-meta .dot) {
            color: rgba(217, 230, 247, 0.62) !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-display.price-display) {
            font-size: 34px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn) {
            background: rgba(6, 35, 67, 0.92) !important;
            border-color: rgba(143, 191, 255, 0.34) !important;
            border-radius: 10px !important;
            height: 52px !important;
            width: 52px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions .icon-btn.icon-btn.icon-saved) {
            color: #ff8a1c !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card) {
            background: #062142 !important;
            border: 0 !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.14) !important;
            box-shadow: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle) {
            background: #062142 !important;
            border: 0 !important;
            color: #ffffff !important;
            font-size: 18px !important;
            min-height: 56px !important;
            outline: none !important;
            padding: 0 24px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:hover),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:active) {
            background: #062142 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-extra-card.listing-extra-card) {
            margin-top: -8px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus-visible) {
            box-shadow: inset 0 0 0 1px rgba(143, 191, 255, 0.22) !important;
            outline: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle svg),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:hover svg),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus svg),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle svg path) {
            color: #ffffff !important;
            stroke: #ffffff !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content) {
            background: #062142 !important;
            color: #d9e6f7 !important;
            font-size: 17px !important;
            line-height: 1.65 !important;
            padding: 0 24px 28px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid) {
            display: grid !important;
            gap: 16px !important;
            grid-template-columns: 1fr !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span) {
            align-items: center !important;
            background: transparent !important;
            border: 0 !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.1) !important;
            border-radius: 0 !important;
            display: grid !important;
            gap: 10px !important;
            grid-template-columns: minmax(145px, 0.8fr) minmax(0, 1fr) !important;
            padding: 0 0 15px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid span:last-child) {
            border-bottom: 0 !important;
            padding-bottom: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-fact-grid.listing-fact-grid strong) {
            color: #aebfd5 !important;
            font-size: 16px !important;
            hyphens: none !important;
            overflow-wrap: normal !important;
            text-transform: none !important;
            white-space: normal !important;
            word-break: normal !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(aside.sidebar.sidebar) {
            margin-top: 18px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card) {
            background:
              linear-gradient(145deg, rgba(11, 47, 89, 0.98), rgba(3, 22, 41, 0.99)) !important;
            border-radius: 18px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-body.seller-card-panel) {
            padding: 24px 18px 28px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-top.seller-card-top) {
            margin-bottom: 28px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-identity-row.seller-identity-row) {
            grid-template-columns: 98px minmax(0, 1fr) !important;
            gap: 18px !important;
            margin-bottom: 34px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-detail.seller-avatar-detail),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-img.seller-avatar-img) {
            border-radius: 14px !important;
            height: 92px !important;
            width: 92px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name-row.seller-name-row strong) {
            font-size: 25px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip) {
            color: #32f58a !important;
            font-size: 18px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-chip.verified-chip svg) {
            color: #32f58a !important;
            stroke: #32f58a !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row) {
            font-size: 17px !important;
            grid-template-columns: 28px 82px minmax(0, 1fr) !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row strong) {
            font-size: 17px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact) {
            border-radius: 10px !important;
            font-size: 17px !important;
            height: 54px !important;
            min-height: 54px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged svg) {
            height: 19px !important;
            width: 19px !important;
          }
        }

        @media (min-width: 641px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content p) {
            background: #062142 !important;
            background-color: #062142 !important;
            background-image: none !important;
            box-shadow: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            border-bottom: 0 !important;
            margin-bottom: 0 !important;
            padding-bottom: 10px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            background: transparent !important;
            border-bottom: 0 !important;
            border-top: 0 !important;
            margin-top: -94px !important;
            padding-bottom: 18px !important;
            padding-top: 20px !important;
            pointer-events: none !important;
            position: relative !important;
            z-index: 12 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row .icon-btn.icon-btn) {
            pointer-events: auto !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.description-card.description-card) {
            border: 0 !important;
            margin-top: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle) {
            border-bottom: 1px solid rgba(143, 191, 255, 0.12) !important;
            outline: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-content.listing-section-content) {
            border: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-section-toggle.listing-section-toggle:focus-visible) {
            box-shadow: none !important;
            outline: none !important;
          }
        }

        @media (min-width: 641px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs) {
            background: rgba(3, 13, 24, 0.78) !important;
            backdrop-filter: blur(8px) !important;
            border-bottom: 1px solid rgba(143, 191, 255, 0.12) !important;
            gap: 8px !important;
            margin: -68px -26px 0 !important;
            padding: 8px 12px 9px !important;
            position: relative !important;
            z-index: 8 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button) {
            background: rgba(226, 232, 240, 0.2) !important;
            border: 1px solid rgba(203, 213, 225, 0.42) !important;
            border-radius: 5px !important;
            height: 52px !important;
            max-width: 86px !important;
            overflow: hidden !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs button.active) {
            border-color: #ff8a1c !important;
            box-shadow: inset 0 0 0 1px rgba(255, 138, 28, 0.45) !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.desktop-image-thumbs.desktop-image-thumbs img) {
            filter: saturate(0.82) contrast(1.04) !important;
            object-fit: cover !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-actions-row.price-actions-row) {
            background: #062142 !important;
            border: 0 !important;
            margin: 0 -26px !important;
            padding: 16px 26px 18px !important;
            pointer-events: auto !important;
            position: relative !important;
            z-index: 1 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-actions.image-actions) {
            align-items: center !important;
            display: flex !important;
            justify-content: space-between !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-stack.price-stack) {
            align-items: flex-start !important;
            display: grid !important;
            gap: 7px !important;
            grid-template-columns: auto auto !important;
            text-align: left !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.fair-price-badge.fair-price-badge) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.fair-price-badge.fair-price-badge svg) {
            color: #32f58a !important;
            stroke: #32f58a !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.price-subline.price-subline) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-bottom-actions.listing-bottom-actions) {
            display: flex !important;
            gap: 10px !important;
          }
        }

        @media (max-width: 640px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main.main) {
            background: #062142 !important;
            border-color: rgba(76, 144, 214, 0.42) !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            background: #06111f !important;
            border: 1px solid rgba(76, 144, 214, 0.42) !important;
            border-radius: 16px 16px 0 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
            position: relative !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button) {
            align-items: center !important;
            background: #06111f !important;
            display: flex !important;
            justify-content: center !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            height: clamp(300px, 82vw, 430px) !important;
            max-height: 430px !important;
            min-height: 300px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            object-fit: contain !important;
            object-position: center center !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.listing-image-soft-bg.listing-image-soft-bg),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-badge.image-badge) {
            background: rgba(0, 0, 0, 0.72) !important;
            border: 0 !important;
            border-radius: 0 !important;
            color: #ffffff !important;
            font-size: 13px !important;
            font-weight: 900 !important;
            height: 24px !important;
            left: 0 !important;
            min-height: 24px !important;
            padding: 0 7px !important;
            top: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-zoom-button.image-zoom-button) {
            align-items: center !important;
            background: rgba(0, 0, 0, 0.62) !important;
            border: 1px solid rgba(255, 255, 255, 0.16) !important;
            border-radius: 999px !important;
            color: #ffffff !important;
            height: 42px !important;
            justify-content: center !important;
            padding: 0 !important;
            right: 12px !important;
            top: 12px !important;
            width: 42px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-actions.mobile-image-actions) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow.gallery-arrow) {
            background: rgba(2, 10, 20, 0.62) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            height: 38px !important;
            opacity: 0.92 !important;
            width: 38px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-left.gallery-arrow-left) {
            left: 12px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-right.gallery-arrow-right) {
            right: 12px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row) {
            padding-top: 18px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row h1) {
            font-size: clamp(24px, 7vw, 30px) !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions) {
            margin-top: 14px !important;
          }
        }

        @media (max-width: 640px) {
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper) {
            background: #06111f !important;
            border: 1px solid rgba(76, 144, 214, 0.42) !important;
            border-radius: 16px 16px 0 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button) {
            background: #06111f !important;
            padding: 0 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            height: clamp(315px, 86vw, 430px) !important;
            max-height: 430px !important;
            min-height: 315px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.main-img-button.main-img-button > img.main-img.main-img) {
            background: #06111f !important;
            object-fit: contain !important;
            object-position: center center !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-actions.mobile-image-actions) {
            display: none !important;
            visibility: hidden !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs) {
            align-items: center !important;
            background: rgba(2, 12, 24, 0.86) !important;
            border-top: 1px solid rgba(143, 191, 255, 0.14) !important;
            bottom: 0 !important;
            display: flex !important;
            gap: 6px !important;
            left: 0 !important;
            overflow-x: auto !important;
            padding: 7px 10px 8px !important;
            position: absolute !important;
            right: 0 !important;
            scrollbar-width: none !important;
            z-index: 12 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs::-webkit-scrollbar) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs button) {
            aspect-ratio: 1.18 / 1 !important;
            background: rgba(255, 255, 255, 0.08) !important;
            border: 1px solid rgba(203, 213, 225, 0.32) !important;
            border-radius: 5px !important;
            flex: 1 1 0 !important;
            height: 46px !important;
            max-width: 68px !important;
            min-width: 44px !important;
            overflow: hidden !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs button.active) {
            border-color: #ff8a1c !important;
            box-shadow: inset 0 0 0 1px rgba(255, 138, 28, 0.5) !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-image-thumbs.mobile-image-thumbs img) {
            height: 100% !important;
            object-fit: cover !important;
            width: 100% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-badge.image-badge) {
            border-radius: 999px !important;
            left: 10px !important;
            top: 10px !important;
            z-index: 13 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-zoom-button.image-zoom-button) {
            height: 38px !important;
            right: 10px !important;
            top: 10px !important;
            width: 38px !important;
            z-index: 13 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow.gallery-arrow) {
            background: rgba(2, 10, 20, 0.68) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28) !important;
            height: 36px !important;
            width: 36px !important;
            z-index: 13 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-left.gallery-arrow-left) {
            left: 10px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.image-wrapper.image-wrapper .gallery-arrow-right.gallery-arrow-right) {
            right: 10px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row) {
            border-bottom: 1px solid rgba(143, 191, 255, 0.14) !important;
            background: #062142 !important;
            display: block !important;
            padding: 18px 22px 20px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id) {
            align-items: center !important;
            color: rgba(226, 232, 240, 0.9) !important;
            display: inline-flex !important;
            font-size: 13px !important;
            font-weight: 900 !important;
            gap: 6px !important;
            letter-spacing: 0.01em !important;
            margin: 0 0 8px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-listing-id.mobile-listing-id strong) {
            display: none !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.title-row.title-row h1) {
            font-size: clamp(22px, 6vw, 28px) !important;
            line-height: 1.08 !important;
            max-width: 92% !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions) {
            align-items: center !important;
            display: flex !important;
            gap: 10px !important;
            justify-content: flex-start !important;
            margin-top: 16px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-price.mobile-title-price) {
            font-size: clamp(28px, 7.4vw, 34px) !important;
            line-height: 1 !important;
            margin-right: auto !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.mobile-title-actions.mobile-title-actions .icon-btn.icon-btn) {
            border-radius: 10px !important;
            height: 44px !important;
            min-width: 44px !important;
            width: 44px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card) {
            padding: 18px 18px 24px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-card-top.seller-card-top) {
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 18px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-type-badge.seller-type-badge),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-profile-link.seller-profile-link) {
            font-size: 15px !important;
            line-height: 1.1 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-main.seller-main) {
            gap: 16px !important;
            grid-template-columns: 92px minmax(0, 1fr) !important;
            margin-bottom: 28px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-logo.seller-logo) {
            height: 84px !important;
            width: 84px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name.seller-name),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card h2) {
            font-size: 25px !important;
            line-height: 1.08 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .verified-text.verified-text),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-verified.seller-verified) {
            color: #32f58a !important;
            font-size: 17px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta.seller-meta) {
            gap: 14px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row) {
            column-gap: 12px !important;
            grid-template-columns: 26px 86px minmax(0, 1fr) !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row span),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-meta-row.seller-meta-row strong) {
            font-size: 16px !important;
            line-height: 1.15 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-stats.seller-stats) {
            margin: 24px 0 24px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .message-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .login-contact) {
            height: 54px !important;
            min-height: 54px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-detail.seller-avatar-detail),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-avatar-img.seller-avatar-img) {
            border-radius: 12px !important;
            height: 72px !important;
            width: 72px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-name-row.seller-name-row strong) {
            font-size: 22px !important;
            line-height: 1.08 !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-profile-btn-top.seller-profile-btn-top) {
            border-radius: 9px !important;
            font-size: 12px !important;
            gap: 5px !important;
            min-height: 32px !important;
            padding: 0 8px !important;
            white-space: nowrap !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-profile-btn-top.seller-profile-btn-top svg) {
            height: 14px !important;
            width: 14px !important;
          }

          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-btn),
          :global(body) :global(main.page.listing-detail-page.listing-detail-page) :global(.seller-card.seller-card .seller-contact-merged.seller-contact-merged .phone-number) {
            background: linear-gradient(180deg, rgba(5, 25, 46, 0.98), rgba(3, 15, 30, 0.98)) !important;
            border: 1px solid rgba(255, 122, 26, 0.82) !important;
            border-radius: 12px !important;
            color: #ffffff !important;
            font-size: 14px !important;
            font-weight: 950 !important;
          }
        }

      `}</style>
    </main>
  );
}
