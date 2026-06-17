"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Clock3, Heart, Tag, UserRound } from "lucide-react";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import OptimizedListingImage, { fallbackListingImage } from "@/app/components/OptimizedListingImage";
import { translateCategory, useLanguage, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { formatLocationWithCountry, getCountryFlagFromLocation } from "@/lib/country-flags";

import {
  fallbackListings,
  formatPrice,
  type Listing
} from "@/lib/listings";

import { getListings } from "@/lib/supabase";
import { readCachedListings, writeCachedListings } from "@/lib/client-listings-cache";
import { listingPath, profilePath } from "@/lib/routes";

import homeStyles from "../page.module.css";

const fallbackCardImage = fallbackListingImage;

function safeImageSrc(src: string | undefined | null) {
  if (!src) return fallbackCardImage;
  return src;
}

function getClientErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error ?? "Tuntematon virhe");
}

function listingImageSrc(listing: Listing) {
  return safeImageSrc(
    listing.image_url ||
      listing.image_urls?.find(Boolean) ||
      null
  );
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

const vehicleTypeTranslations: Record<Locale, Record<string, string>> = {
  fi: {},
  en: { Moottorikelkka: "Snowmobile", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
  sv: { Moottorikelkka: "Snöskoter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
  no: { Moottorikelkka: "Snøscooter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
  et: { Moottorikelkka: "Mootorsaan", Mönkijä: "ATV", Motocross: "Motokross", Mopot: "Mopeed" }
};

export default function ListingsIndexPage() {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const [listings, setListings] =
    useState<Listing[]>(fallbackListings);
  const [loading, setLoading] = useState(true);

  const [favorites, setFavorites] = useState<string[]>([]);
  const favoritesHydrated = useRef(false);

  useEffect(() => {
    try {
      setFavorites(readSavedListingIds());
    } catch {}
    favoritesHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!favoritesHydrated.current) return;
    try {
      localStorage.setItem("savedListings", JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    let mounted = true;
    const cachedListings = readCachedListings();

    if (cachedListings.length > 0) {
      setListings(cachedListings);
      setLoading(false);
    } else {
      setLoading(true);
    }

    getListings({
      includeOptionalFields: false,
      limit: 240
    })
      .then(({ data, error }) => {
        if (error) {
          console.warn("Ilmoitusten lataus epaonnistui.", getClientErrorMessage(error));
          return;
        }

        if (mounted && data && (data.length > 0 || cachedListings.length === 0)) {
          setListings(data);
          writeCachedListings(data);
        }
      })
      .catch((err) => {
        console.warn("Ilmoitusten lataus epaonnistui.", getClientErrorMessage(err));
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const sorted = useMemo(() => {
    return [...listings].sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );
  }, [listings]);

  function getListingTitle(listing: Listing): string {
    const localized = getLocalizedListingText(listing, locale);
    if (locale === "fi") return localized.title;
    const leafSubcategory = listing.subcategory?.split("/").map((p) => p.trim()).filter(Boolean).at(-1);
    const isGenerated =
      leafSubcategory &&
      listing.vehicle_type &&
      listing.title.trim().toLowerCase() === `${leafSubcategory} - ${listing.vehicle_type}`.trim().toLowerCase();
    if (!isGenerated) return localized.title;
    const translatedSub = translateCategory(locale, listing.subcategory ?? "");
    const translatedLeaf = translatedSub.split("/").map((p) => p.trim()).filter(Boolean).at(-1) || translateCategory(locale, leafSubcategory);
    const translatedVehicle = vehicleTypeTranslations[locale]?.[listing.vehicle_type ?? ""] ?? listing.vehicle_type ?? "";
    return `${translatedLeaf} - ${translatedVehicle}`.trim();
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("fi-FI", {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    }).format(new Date(value));
  }

  function toggleFavorite(
    event: React.MouseEvent,
    listingId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    setFavorites((prev) => {
      const current = prev.length > 0 ? prev : readSavedListingIds();
      const next = current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId];

      try {
        localStorage.setItem("savedListings", JSON.stringify(next));
      } catch {}

      return next;
    });
  }

  return (
    <main className={homeStyles.shell}>
      <div className={homeStyles.container} style={{ paddingTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              fontWeight: 950,
              color: "#0b1a3a"
            }}
          >
            <Tag size={16} />
            {t.back}
          </Link>
          <LanguageSwitcher />
        </div>

        <div style={{ height: 14 }} />

        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 950,
            color: "#0b1a3a"
          }}
        >
          {t.viewAll}
        </h1>

        <div style={{ height: 14 }} />

        {loading ? (
          <div className={homeStyles.emptyState}>
            <strong>Ladataan ilmoituksia...</strong>
          </div>
        ) : null}

        <div className={homeStyles.cardsGrid}>
          {sorted.map((listing) => {
            const isFavorite = favorites.includes(listing.id);
            const countryFlag = getCountryFlagFromLocation(listing.location, t.country);

            return (
              <article
                key={listing.id}
                className={homeStyles.card}
                role="link"
                tabIndex={0}
                aria-label={`${t.openListing} ${getListingTitle(listing)}`}
                onClick={() => router.push(listingPath(listing.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(listingPath(listing.id));
                  }
                }}
              >

                <div className={`${homeStyles.cardImage} ${homeStyles.listingCardImage}`}>
                  <OptimizedListingImage
                    src={listingImageSrc(listing)}
                    alt={getListingTitle(listing)}
                  />
                  <button
                    onClick={(e) => toggleFavorite(e, listing.id)}
                    className={`${homeStyles.favoriteButton} ${
                      isFavorite ? homeStyles.favoriteButtonActive : ""
                    }`}
                    type="button"
                    aria-label={
                      isFavorite ? t.removeFavorite : t.addFavorite
                    }
                  >
                    <Heart
                      size={14}
                      fill={isFavorite ? "currentColor" : "none"}
                    />
                  </button>
                </div>

                <div className={homeStyles.cardBody}>
                  <div className={homeStyles.badgeRow}>
                    {listing.category ? (
                      <span className={homeStyles.badge}>{translateCategory(locale, listing.category ?? "")}</span>
                    ) : null}
                    {listing.subcategory ? (
                      <span className={homeStyles.badge}>{translateCategory(locale, listing.subcategory)}</span>
                    ) : null}
                  </div>
                  <p className={homeStyles.cardPrice}>{formatPrice(listing.price)}</p>
                  <h3 className={homeStyles.cardTitle}>{getListingTitle(listing)}</h3>
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
                      ) : null}
                      {formatLocationWithCountry(listing.location, t.country)}
                    </span>
                    <span>
                      <Clock3 size={14} />
                      {formatDate(listing.created_at)}
                    </span>
                  </div>

                  <div className={homeStyles.sellerRow}>
                    <Link
                      href={
                        listing.seller_id
                          ? profilePath(listing.seller_id, listing.company_name || listing.seller_name)
                          : "#"
                      }
                      className={homeStyles.sellerLink}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!listing.seller_id) e.preventDefault();
                      }}
                    >
                      <span className={homeStyles.sellerAvatar}>
                        <UserRound size={15} />
                      </span>
                      <span className={homeStyles.sellerText}>
                        <strong>{listing.seller_name}</strong>
                        <small>{t.viewProfile}</small>
                      </span>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
