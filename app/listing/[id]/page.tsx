"use client";

import type { TouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import OptimizedListingImage from "@/app/components/OptimizedListingImage";

import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Mail,
  MapPin,
  Globe2,
  ShieldCheck,
  Phone,
  Heart,
  LockKeyhole,
  Share2,
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
import { useLanguage, translateCategory, type Locale } from "@/lib/i18n";

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
  const { locale } = useLanguage();
  const ui = listingUiText[locale];

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
    useState(false);

  const [showPhone, setShowPhone] =
    useState(false);

  const [sellerPhone, setSellerPhone] =
    useState("");

  const [sellerWebsite, setSellerWebsite] =
    useState<string | null>(null);

  const [phoneLoading, setPhoneLoading] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

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

  useEffect(() => {
    if (!previewImage) return;

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
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

    const fallback =
      fallbackListings.find(
        (i) => i.id === params.id
      ) ?? null;

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
    if (!supabase || !listing?.seller_id) {
      setSellerWebsite(null);
      return;
    }

    let mounted = true;

    async function loadSellerWebsite() {
      try {
        const { data } = await supabase!
          .from("profiles")
          .select("company_website")
          .eq("id", listing!.seller_id)
          .maybeSingle<{ company_website?: string | null }>();

        if (!mounted) return;
        setSellerWebsite(data?.company_website?.trim() || null);
      } catch {
        if (mounted) setSellerWebsite(null);
      }
    }

    void loadSellerWebsite();

    return () => {
      mounted = false;
    };
  }, [listing?.seller_id]);

  useEffect(() => {
    if (!listing) {
      setSimilarListings([]);
      return;
    }

    const currentListing = listing;
    let mounted = true;

    async function loadSimilarListings() {
      const { data } = await getListings();
      const source = data.length > 0 ? data : fallbackListings;

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
    if (!params.id) {
      return;
    }

    const storageKey =
      `listing-viewed:${params.id}`;

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

    void incrementListingView(params.id);
  }, [params.id]);

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

    getListingDisplayNumber(listing.created_at)
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

    setSaved(readSavedListingIds().includes(listing.id));
    getSavedListingIds()
      .then(({ data }) => {
        if (data.length > 0) {
          localStorage.setItem("savedListings", JSON.stringify(data));
          setSaved(data.includes(listing.id));
        }
      })
      .catch(() => undefined);
  }, [listing]);

  useEffect(() => {
    function syncSavedState() {
      if (!listing) return;
      setSaved(readSavedListingIds().includes(listing.id));
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

    void (
      isCurrentlySaved
        ? unsaveListing(listing.id)
        : saveListing(listing.id)
    );
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
  const companySellerLabel =
    companySellerNames.includes(",") ? ui.sellers : ui.seller;
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
  const listingLocation = formatLocation(listing.location);
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
  const listingDescription =
    (listingText.description || "")
      .replace(/^(?:Ajoneuvo:[^\n]*\n?)?(?:Merkki:[^\n]*\n?)?(?:Malli:[^\n]*\n?)?(?:Vuosimalli:[^\n]*\n?)?/i, "")
      .replace(/Ajoneuvo:\s*\S+\s+Merkki:\s*[^\s]+(?:\s+\S+)?\s+Malli:\s*[^\s]+(?:\s+\S+)*?\s+Vuosimalli:\s*\d+\s*/i, "")
      .trim() || ui.noDescription;

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
                  <strong>{formatPrice(listing.price)}</strong>
                </span>

                <h1>{listingText.title}</h1>

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

            {/* PRICE + ACTIONS ROW */}

            <div className="price-actions-row">

              <div className="image-actions">

                <span className="price-display">
                  {formatPrice(listing.price)}
                </span>

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

            </div>

            {/* DETAILS */}

            <div className="description-card listing-facts-card">

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
                {listing.vehicle_type && (
                  <span>
                    <strong>{ui.vehicle}</strong>
                    {translateVehicleTypeLabel(listing.vehicle_type)}
                  </span>
                )}
                {listingPartNumber && (
                  <span>
                    <strong>{ui.partNumber}</strong>
                    {listingPartNumber}
                  </span>
                )}
                {listingBrandModel && (
                  <span>
                    <strong>{ui.brandModel}</strong>
                    {listingBrandModel}
                  </span>
                )}
                {listing.year && (
                  <span>
                    <strong>{ui.year}</strong>
                    {listing.year}
                  </span>
                )}
                <span>
                  <strong>{ui.condition}</strong>
                  {translateConditionLabel(listing.condition)}
                </span>
                <span>
                  <strong>{ui.location}</strong>
                  {listingLocation || ui.notSpecified}
                </span>
              </div>

              </div>

            </div>

            <div className="description-card listing-extra-card">

              <button
                type="button"
                className="listing-section-toggle"
                aria-expanded={additionalInfoOpen}
                onClick={() => setAdditionalInfoOpen((open) => !open)}
              >
                <span>{ui.additionalInfo}</span>
                {additionalInfoOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              <div className={additionalInfoOpen ? "listing-section-content" : "listing-section-content is-collapsed"}>
                <p>{listingDescription}</p>
              </div>

            </div>

          </div>

          {/* RIGHT */}

          <aside className="sidebar">

            {/* SELLER */}

            <div className="seller-card">

              <Link
                href={sellerHref}
                className="seller-card-body seller-card-link"
                aria-label={ui.openSellerProfile(sellerDisplayName)}
              >

                <div className="seller-avatar-detail">
                  {listing.seller_avatar_url
                    ? <img src={listing.seller_avatar_url} alt="" className="seller-avatar-img" referrerPolicy="no-referrer" />
                    : sellerInitial}
                </div>

                <div className="seller-info">

                  <div className="seller-card-label">{ui.seller}</div>

                  <div className="seller-name-row">
                    <strong>{sellerDisplayName}</strong>
                    {listing.seller_phone_verified && (
                      <span className="verified-chip"><ShieldCheck size={11} /> {ui.verified}</span>
                    )}
                  </div>

                  {isCompanySeller && (
                    <div className="seller-employee-name">
                      <UserRound size={13} />
                      <span>{companySellerLabel}</span>
                      {companySellerNames && <strong>{companySellerNames}</strong>}
                    </div>
                  )}

                  {listingLocation && (
                    <div className="seller-location">{listingLocation}</div>
                  )}

                  {sellerWebsiteUrl && (
                    <span className="seller-website">
                      <Globe2 size={13} />
                      {sellerWebsiteUrl.label}
                    </span>
                  )}

                </div>

              </Link>

              <Link href={sellerHref} className="seller-profile-btn">
                {ui.viewProfile}
                <ChevronRight size={14} />
              </Link>

            </div>

            {/* CONTACT */}

            <div className="contact-card">

              <h3>
                {ui.contactHeading}
              </h3>

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

          </aside>

        </section>

        {similarListings.length > 0 && (
          <section className="similar-listings-section" aria-label="Samanlaisia tuotteita myynnissä">
            <div className="similar-listings-head">
              <span>{ui.forSale}</span>
              <h2>Samanlaisia tuotteita</h2>
            </div>
            <div className="similar-listings-grid">
              {similarListings.map((item) => {
                const itemText = getLocalizedListingText(item, locale);
                return (
                  <Link key={item.id} href={`/listing/${item.id}`} className="similar-listing-card">
                    <span className="similar-listing-image">
                      <OptimizedListingImage
                        src={item.image_url}
                        alt=""
                        decorative
                        sizes="140px"
                      />
                    </span>
                    <span className="similar-listing-body">
                      <strong>{formatPrice(item.price)}</strong>
                      <span className="similar-listing-title">{itemText.title}</span>
                      <span className="similar-listing-meta">
                        {formatLocation(item.location)}
                        <span>•</span>
                        {formatDate(item.created_at, locale)}
                      </span>
                    </span>
                  </Link>
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
          inset: 0;
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
          max-height: min(86vh, 820px);
          max-width: min(94vw, 1120px);
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        .listing-image-preview-panel img {
          display: block;
          max-height: min(86vh, 820px);
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

      `}</style>
    </main>
  );
}
