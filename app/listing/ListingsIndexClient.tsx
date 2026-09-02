"use client";

// The route-level server component provides the initial public inventory so
// listing links and text are present before client-side hydration.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/app/components/LocalizedLink";

import { Clock3, Heart, UserRound } from "lucide-react";
import OptimizedListingImage, { fallbackListingImage } from "@/app/components/OptimizedListingImage";
import ListingVehicleMeta from "@/app/components/ListingVehicleMeta";
import ListingSalePrice from "@/app/components/ListingSalePrice";
import { translateCategory, useLanguage, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { formatLocationWithCountry, getCountryFlagFromLocation } from "@/lib/country-flags";

import {
  fallbackListings,
  formatPrice,
  getListingImageAlt,
  type Listing
} from "@/lib/listings";

import { getListings, supabase } from "@/lib/supabase";
import { readCachedListings, writeCachedListings } from "@/lib/client-listings-cache";
import { listingPath, listingUrlId, profilePath } from "@/lib/routes";

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
  en: { Moottorikelkka: "Snowmobile", "Mönkijä": "ATV", Motocross: "Motocross", Mopot: "Moped" },
  sv: { Moottorikelkka: "Snöskoter", "Mönkijä": "ATV", Motocross: "Motocross", Mopot: "Moped" },
  no: { Moottorikelkka: "Snøscooter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
};

export default function ListingsIndexPage({
  initialListings = []
}: {
  initialListings?: Listing[];
}) {
  const { locale, t } = useLanguage();
  const [listings, setListings] =
    useState<Listing[]>(
      initialListings.length > 0 ? initialListings : fallbackListings
    );
  const [, setLoading] = useState(true);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const favoritesHydrated = useRef(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(Boolean(data.session?.user));
    }).catch(() => setIsLoggedIn(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => subscription.unsubscribe();
  }, []);

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
    const initialPublicListings =
      initialListings.filter((listing) => !listing.is_hidden && !listing.is_sold);

    if (cachedListings.length > 0) {
      setListings(cachedListings);
      setLoading(false);
    } else if (initialPublicListings.length > 0) {
      setListings(initialPublicListings);
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
  }, [initialListings]);

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
    <main className={`${homeStyles.shell} listing-index-page`}>
      <div className={homeStyles.container} style={{ paddingTop: 18 }}>
        <div className={homeStyles.cardsGrid}>
          {sorted.map((listing) => {
            const isFavorite = favorites.includes(listing.id);
            const countryFlag = getCountryFlagFromLocation(listing.location, t.country);

            return (
              <article
                key={listing.id}
                data-listing-card="true"
                className={homeStyles.card}
              >

                <div className={`${homeStyles.cardImage} ${homeStyles.listingCardImage}`} data-listing-card-image="true">
                  <OptimizedListingImage
                    src={listingImageSrc(listing)}
                    alt={getListingImageAlt(listing, getListingTitle(listing))}
                  />
                  {isLoggedIn && <button
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
                  </button>}
                </div>

                <div className={homeStyles.cardBody} data-listing-card-body="true">
                  <div className={homeStyles.badgeRow}>
                    {listing.category ? (
                      <span className={homeStyles.badge}>{translateCategory(locale, listing.category ?? "")}</span>
                    ) : null}
                    {listing.subcategory ? (
                      <span className={homeStyles.badge}>{translateCategory(locale, listing.subcategory)}</span>
                    ) : null}
                  </div>
                  <ListingSalePrice listing={listing} className={homeStyles.cardPrice} />
                  <h3 className={homeStyles.cardTitle}>{getListingTitle(listing)}</h3>
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
                      <Clock3 size={14} />
                      {formatDate(listing.created_at)}
                    </span>
                  </div>

                  <div className={homeStyles.sellerRow}>
                    <Link
                      href={
                        listing.seller_id
                          ? profilePath(listing.seller_id, listing.company_name || listing.seller_name, locale)
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
                        <strong data-person-name data-no-auto-translate translate="no">{listing.seller_name}</strong>
                        <small>{t.viewProfile}</small>
                      </span>
                    </Link>
                  </div>
                </div>
                <Link
                  className={homeStyles.cardLink}
                  href={listingPath(listing, locale)}
                  aria-label={`${t.openListing} ${getListingTitle(listing)}`}
                />
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
