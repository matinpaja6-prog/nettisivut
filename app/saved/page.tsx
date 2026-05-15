"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { translateCategory, useLanguage, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";

import { ArrowLeft, Heart, MapPin, Tag, UserRound } from "lucide-react";

import type { Listing } from "@/lib/listings";
import { formatPrice } from "@/lib/listings";
import {
  getListings,
  getSavedListingIds,
  saveListing,
  unsaveListing
} from "@/lib/supabase";

import styles from "../page.module.css";

const fallbackCardImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dbeafe"/><stop offset="1" stop-color="#bfdbfe"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1e3a8a" font-family="Segoe UI,Arial,sans-serif" font-size="36">Kuva ei saatavilla</text></svg>`
  );

function safeImageSrc(src: string | undefined | null) {
  if (!src) return fallbackCardImage;
  return src;
}

function listingImageSrc(listing: Listing) {
  return safeImageSrc(
    listing.image_url ||
      listing.image_urls?.find(Boolean) ||
      null
  );
}

function readSavedIds(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem("savedListings") || "[]");
    return Array.isArray(saved) ? saved.filter((x) => typeof x === "string") : [];
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

export default function SavedListingsPage() {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);

  useEffect(() => {
    setSavedIds(readSavedIds());
    getSavedListingIds()
      .then(({ data }) => {
        if (data.length > 0) {
          localStorage.setItem("savedListings", JSON.stringify(data));
          setSavedIds(data);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let mounted = true;
    getListings()
      .then(({ data }) => {
        if (mounted && data) setAllListings(data);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const savedListings = useMemo(() => {
    const set = new Set(savedIds);
    return allListings.filter((l) => set.has(l.id));
  }, [allListings, savedIds]);

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

  function toggleFavorite(event: React.MouseEvent, id: string) {
    event.preventDefault();
    event.stopPropagation();
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("savedListings", JSON.stringify(next));
      } catch {}
      void (
        prev.includes(id)
          ? unsaveListing(id)
          : saveListing(id)
      );
      return next;
    });
  }

  return (
    <main className={`${styles.shell} saved-page`}>
      <div className={styles.container} style={{ paddingTop: 18 }}>
        <div className="saved-topbar">
          <Link href="/" className="saved-back">
            <ArrowLeft size={18} />
            {t.back}
          </Link>
          <LanguageSwitcher />
        </div>

        <header className="saved-hero">
          <div className="saved-hero-icon">
            <Heart size={22} />
          </div>
          <div className="saved-hero-copy">
            <h1>{t.savedListings}</h1>
            <p>{savedIds.length} {savedIds.length === 1 ? "ilmoitus tallennettuna" : "ilmoitusta tallennettuna"}</p>
          </div>
        </header>

        {savedIds.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>{t.noListings}</strong>
            <span>Paina sydäntä ilmoituksessa tallentaaksesi sen.</span>
            <Link className={styles.menuLink} href="/">
              <Tag size={16} />
              {t.viewAll}
            </Link>
          </div>
        ) : null}

        <div className={styles.cardsGrid}>
          {savedListings.map((listing) => {
            const isFavorite = savedIds.includes(listing.id);

            return (
              <article
                key={listing.id}
                className={styles.card}
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

                <div className={`${styles.cardImage} ${styles.listingCardImage}`}>
                  <img
                    src={listingImageSrc(listing)}
                    alt={getListingTitle(listing)}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      const img = event.currentTarget;
                      img.onerror = null;
                      img.src = fallbackCardImage;
                    }}
                  />
                  <button
                    onClick={(e) => toggleFavorite(e, listing.id)}
                    className={`${styles.favoriteButton} ${
                      isFavorite ? styles.favoriteButtonActive : ""
                    }`}
                    type="button"
                    aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                  >
                    <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                  </button>
                </div>

                <div className={styles.cardBody}>
                  <p className={styles.cardPrice}>{formatPrice(listing.price)}</p>
                  <div className={styles.badgeRow}>
                    {listing.category ? <span className={styles.badge}>{translateCategory(locale, listing.category ?? "")}</span> : null}
                    {listing.subcategory ? <span className={styles.badge}>{translateCategory(locale, listing.subcategory)}</span> : null}
                  </div>
                  <h3 className={styles.cardTitle}>{getListingTitle(listing)}</h3>
                  <div className={styles.cardMetaRow}>
                    <span>
                      <MapPin size={14} />
                      {t.country}, {listing.location}
                    </span>
                  </div>
                  <div className={styles.sellerRow}>
                    <Link
                      href={listing.seller_id ? `/seller/${listing.seller_id}` : "#"}
                      className={styles.sellerLink}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!listing.seller_id) e.preventDefault();
                      }}
                    >
                      <span className={styles.sellerAvatar}>
                        <UserRound size={15} />
                      </span>
                      <span className={styles.sellerText}>
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
