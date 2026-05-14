"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Heart, MapPin, Tag, UserRound } from "lucide-react";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { translateCategory, useLanguage, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";

import {
  fallbackListings,
  formatPrice,
  type Listing
} from "@/lib/listings";

import { getListings } from "@/lib/supabase";

import homeStyles from "../page.module.css";

const fallbackCardImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dbeafe"/><stop offset="1" stop-color="#bfdbfe"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1e3a8a" font-family="Segoe UI,Arial,sans-serif" font-size="36">Kuva ei saatavilla</text></svg>`
  );

function safeImageSrc(src: string | undefined | null) {
  if (!src) return fallbackCardImage;
  if (src.startsWith("data:image/") && src.length > 250_000) {
    return fallbackCardImage;
  }
  return src;
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

    setLoading(true);

    getListings()
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          return;
        }

        if (mounted && data) {
          setListings(data);
        }
      })
      .catch((err) => {
        console.error(err);
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

            return (
              <article
                key={listing.id}
                className={homeStyles.card}
                role="link"
                tabIndex={0}
                aria-label={`${t.openListing} ${getListingTitle(listing)}`}
                onClick={() => router.push(`/listing/${listing.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/listing/${listing.id}`);
                  }
                }}
              >

                <div className={`${homeStyles.cardImage} ${homeStyles.listingCardImage}`}>
                  <img
                    src={listingImageSrc(listing)}
                    alt={getListingTitle(listing)}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      const img = event.currentTarget;
                      console.warn("Listing image failed to load:", img.src);
                      img.onerror = null;
                      img.src = fallbackCardImage;
                    }}
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
                    <span>
                      <MapPin size={14} />
                      {t.country}, {listing.location}
                    </span>
                  </div>

                  <div className={homeStyles.sellerRow}>
                    <Link
                      href={
                        listing.seller_id
                          ? `/seller/${listing.seller_id}`
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
