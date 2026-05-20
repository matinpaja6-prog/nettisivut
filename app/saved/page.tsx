"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OptimizedListingImage, { fallbackListingImage } from "@/app/components/OptimizedListingImage";
import { translateCategory, useLanguage, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";

import { Heart, MapPin, Search, Tag, UserRound } from "lucide-react";

import type { Listing } from "@/lib/listings";
import { formatPrice } from "@/lib/listings";
import {
  getListings,
  getSavedListingIds,
  saveListing,
  unsaveListing
} from "@/lib/supabase";

const fallbackCardImage = fallbackListingImage;

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

function isListingNew(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created < 24 * 60 * 60 * 1000;
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
  const [listingsLoading, setListingsLoading] = useState(true);

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
    setListingsLoading(true);
    getListings()
      .then(({ data }) => {
        if (mounted && data) setAllListings(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setListingsLoading(false);
      });
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
    <main className="saved-page saved-shell">
      <div className="saved-container">
        <header className="saved-hero">
          <div className="saved-hero-main">
            <div className="saved-hero-icon">
              <Heart size={24} fill="currentColor" />
            </div>
            <div className="saved-hero-copy">
              <span>Tallessa</span>
              <h1>{t.savedListings}</h1>
              <p>Kaikki suosikit yhdessä paikassa, valmiina kun palaat vertailemaan.</p>
            </div>
          </div>
          <div className="saved-hero-stat">
            <strong>{savedIds.length}</strong>
            <span>{savedIds.length === 1 ? "ilmoitus" : "ilmoitusta"}</span>
          </div>
        </header>

        {savedIds.length === 0 ? (
          <div className="saved-empty">
            <div className="saved-empty-icon">
              <Heart size={28} />
            </div>
            <strong>{t.noListings}</strong>
            <span>Paina ilmoituksen sydäntä, niin se näkyy täällä myöhemmin.</span>
            <Link className="saved-empty-link" href="/">
              <Search size={16} />
              {t.viewAll}
            </Link>
          </div>
        ) : listingsLoading ? (
          <div className="saved-grid" aria-label="Ladataan tallennettuja ilmoituksia">
            {[0, 1, 2].map((item) => (
              <div className="saved-card saved-card-skeleton" key={item}>
                <div className="saved-card-image" />
                <div className="saved-card-body">
                  <span />
                  <strong />
                  <p />
                </div>
              </div>
            ))}
          </div>
        ) : savedListings.length === 0 ? (
          <div className="saved-empty">
            <div className="saved-empty-icon">
              <Tag size={28} />
            </div>
            <strong>Tallennettuja ilmoituksia ei löytynyt</strong>
            <span>Osa suosikeista on voitu poistaa tai myydä. Lisää uusia ilmoituksia selaamalla etusivua.</span>
            <Link className="saved-empty-link" href="/">
              <Search size={16} />
              {t.viewAll}
            </Link>
          </div>
        ) : (
          <div className="saved-grid">
            {savedListings.map((listing) => {
              const isFavorite = savedIds.includes(listing.id);

              return (
                <article
                  key={listing.id}
                  className="saved-card"
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

                  <div className="saved-card-image">
                    <OptimizedListingImage
                      src={listingImageSrc(listing)}
                      alt={getListingTitle(listing)}
                    />
                    {isListingNew(listing.created_at) && (
                      <span className="saved-new-badge" aria-label="Uusi">
                        Uusi
                      </span>
                    )}
                    <button
                      onClick={(e) => toggleFavorite(e, listing.id)}
                      className={`saved-favorite ${isFavorite ? "is-active" : ""}`}
                      type="button"
                      aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                    >
                      <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <div className="saved-card-body">
                    <div className="saved-card-topline">
                      <strong>{formatPrice(listing.price)}</strong>
                      {listing.condition ? <span>{listing.condition}</span> : null}
                    </div>
                    <h2>{getListingTitle(listing)}</h2>
                    <div className="saved-meta">
                      <span>
                        <MapPin size={14} />
                        {t.country}, {listing.location}
                      </span>
                    </div>
                    <div className="saved-seller">
                      <Link
                        href={listing.seller_id ? `/seller/${listing.seller_id}` : "#"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!listing.seller_id) e.preventDefault();
                        }}
                      >
                        <span className="saved-seller-avatar">
                          <UserRound size={15} />
                        </span>
                        <span>
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
        )}
      </div>

      <style>{`
        .saved-shell {
          min-height: 100vh;
          padding: clamp(18px, 3vw, 34px) 0 88px;
          background:
            radial-gradient(760px 320px at 88% -8%, rgba(255, 122, 26, 0.12), transparent 62%),
            radial-gradient(680px 300px at 8% 0%, rgba(64, 216, 255, 0.08), transparent 68%),
            #0b1118 !important;
          color: #f4f8fc;
        }

        .saved-container {
          width: min(1160px, calc(100vw - 32px));
          margin: 0 auto;
          display: grid;
          gap: 22px;
        }

        .saved-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: clamp(22px, 4vw, 34px);
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 24px;
          background:
            radial-gradient(680px 240px at 96% 0%, rgba(255, 122, 26, 0.2), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98));
          box-shadow: 0 24px 70px rgba(0, 7, 18, 0.34), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .saved-hero-main {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .saved-hero-icon,
        .saved-empty-icon {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          color: #fff;
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%);
          box-shadow: 0 16px 34px rgba(255, 122, 26, 0.24);
        }

        .saved-hero-copy {
          min-width: 0;
        }

        .saved-hero-copy span {
          display: block;
          margin-bottom: 5px;
          color: #ffb45f;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .saved-hero h1 {
          margin: 0;
          color: #fff;
          font-size: clamp(2rem, 5vw, 3.4rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 0.95;
        }

        .saved-hero p {
          margin: 8px 0 0;
          max-width: 540px;
          color: rgba(226, 244, 255, 0.72);
          font-size: 14px;
          font-weight: 750;
        }

        .saved-hero-stat {
          min-width: 112px;
          min-height: 82px;
          border: 0;
          border-radius: 0;
          background: transparent;
          display: grid;
          place-items: center;
          align-content: center;
          color: #fff;
        }

        .saved-hero-stat strong {
          font-size: 30px;
          line-height: 1;
          font-weight: 950;
        }

        .saved-hero-stat span {
          color: #ffd1a3;
          font-size: 12px;
          font-weight: 900;
        }

        .saved-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }

        .saved-card {
          overflow: hidden;
          border-radius: 12px;
          border: 1px solid rgba(255, 122, 26, 0.48);
          background: #071f38;
          box-shadow: none;
          cursor: pointer;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          min-height: 100%;
          transition: transform 0.16s, border-color 0.16s, box-shadow 0.16s;
        }

        .saved-card:hover,
        .saved-card:focus-visible {
          transform: none;
          border-color: rgba(255, 122, 26, 0.78);
          box-shadow: 0 0 0 1px rgba(255, 122, 26, 0.12);
          outline: none;
        }

        .saved-card-image {
          position: relative;
          aspect-ratio: 1 / 0.82;
          background: #071f38;
          border-bottom: 1px solid rgba(147, 197, 253, 0.16);
          overflow: hidden;
        }

        .saved-card-image img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform 0.25s;
        }

        .saved-card:hover .saved-card-image img {
          transform: none;
        }

        .saved-favorite {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 36px;
          height: 36px;
          border: 1px solid rgba(255,255,255,0.42);
          border-radius: 999px;
          background: rgba(5, 13, 24, 0.78);
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.28);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          backdrop-filter: blur(10px);
        }

        .saved-favorite.is-active {
          background: rgba(255, 122, 26, 0.92);
          border-color: rgba(255, 224, 194, 0.78);
          box-shadow: 0 12px 24px rgba(255, 122, 26, 0.22);
        }

        .saved-new-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          border-radius: 999px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: 1px solid rgba(187, 247, 208, 0.72);
          box-shadow: 0 10px 20px rgba(22, 163, 74, 0.22);
          color: #ffffff;
          font-size: 10px;
          font-weight: 950;
          line-height: 1;
          padding: 5px 8px;
          text-transform: uppercase;
        }

        .saved-card-body {
          padding: 12px;
          display: grid;
          gap: 8px;
          flex: 1 1 auto;
        }

        .saved-card-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .saved-card-topline strong {
          color: #fff;
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.03em;
          line-height: 1;
        }

        .saved-card-topline span {
          border: 1px solid rgba(255, 122, 26, 0.28);
          border-radius: 999px;
          background: rgba(255, 122, 26, 0.1);
          color: #ffd1a3;
          font-size: 10px;
          font-weight: 900;
          line-height: 1;
          padding: 5px 7px;
        }

        .saved-card h2 {
          margin: 0;
          color: #fff;
          display: -webkit-box;
          font-size: 14px;
          font-weight: 950;
          letter-spacing: -0.02em;
          line-height: 1.14;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
          line-clamp: 3;
          overflow: hidden;
        }

        .saved-meta,
        .saved-seller small {
          color: rgba(226, 244, 255, 0.66);
          font-size: 11px;
          font-weight: 750;
        }

        .saved-meta span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .saved-seller {
          margin-top: auto;
          padding-top: 9px;
          border-top: 1px solid rgba(151, 178, 205, 0.14);
        }

        .saved-seller a {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: inherit;
          text-decoration: none;
        }

        .saved-seller-avatar {
          display: none;
        }

        .saved-seller strong,
        .saved-seller small {
          display: block;
        }

        .saved-seller strong {
          color: #fff;
          font-size: 12px;
          font-weight: 900;
        }

        .saved-empty {
          min-height: 330px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 12px;
          text-align: center;
          padding: 34px;
          border: 1px dashed rgba(151, 178, 205, 0.24);
          border-radius: 24px;
          background:
            radial-gradient(460px 200px at 50% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            rgba(13, 29, 46, 0.52);
        }

        .saved-empty strong {
          color: #fff;
          font-size: 22px;
          font-weight: 950;
        }

        .saved-empty span {
          max-width: 420px;
          color: rgba(226, 244, 255, 0.72);
          font-size: 14px;
          font-weight: 750;
        }

        .saved-empty-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 42px;
          margin-top: 6px;
          padding: 0 16px;
          border-radius: 13px;
          border: 1px solid rgba(255, 210, 165, 0.58);
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%);
          color: #fff;
          font-weight: 950;
          text-decoration: none;
          box-shadow: 0 16px 34px rgba(255, 122, 26, 0.22);
        }

        .saved-card-skeleton {
          cursor: default;
          pointer-events: none;
        }

        .saved-card-skeleton .saved-card-image,
        .saved-card-skeleton .saved-card-body span,
        .saved-card-skeleton .saved-card-body strong,
        .saved-card-skeleton .saved-card-body p {
          border-radius: 14px;
          background: linear-gradient(90deg, rgba(151,178,205,0.08), rgba(151,178,205,0.16), rgba(151,178,205,0.08));
          background-size: 220% 100%;
          animation: savedPulse 1.4s ease-in-out infinite;
        }

        .saved-card-skeleton .saved-card-body span {
          width: 42%;
          height: 18px;
        }

        .saved-card-skeleton .saved-card-body strong {
          width: 74%;
          height: 24px;
        }

        .saved-card-skeleton .saved-card-body p {
          width: 56%;
          height: 16px;
          margin: 0;
        }

        @keyframes savedPulse {
          0% { background-position: 0% 50%; }
          100% { background-position: -220% 50%; }
        }

        @media (max-width: 720px) {
          .saved-shell {
            padding-top: 14px;
          }

          .saved-container {
            width: min(100% - 24px, 1160px);
            gap: 16px;
          }

          .saved-hero {
            align-items: flex-start;
            flex-direction: column;
            border-radius: 20px;
            padding: 20px;
          }

          .saved-hero-main {
            align-items: flex-start;
          }

          .saved-hero-icon {
            width: 50px;
            height: 50px;
            border-radius: 16px;
          }

          .saved-hero-stat {
            min-height: 52px;
            width: 100%;
            grid-template-columns: auto auto;
            justify-content: space-between;
            padding: 0;
          }

          .saved-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .saved-card {
            border-radius: 12px;
          }

          .saved-card-image {
            aspect-ratio: 1 / 1;
          }

          .saved-favorite {
            height: 26px;
            right: 5px;
            top: 5px;
            width: 26px;
          }

          .saved-favorite svg {
            height: 12px;
            width: 12px;
          }

          .saved-new-badge {
            top: 7px;
            left: 7px;
            font-size: 9px;
            padding: 4px 7px;
          }

          .saved-card-body {
            gap: 7px;
            padding: 10px;
          }

          .saved-card-topline {
            align-items: flex-start;
            gap: 6px;
          }

          .saved-card-topline strong {
            font-size: clamp(17px, 5vw, 21px);
            line-height: 1;
          }

          .saved-card-topline span {
            font-size: 9.5px;
            padding: 5px 7px;
          }

          .saved-card h2 {
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
            display: -webkit-box;
            font-size: 12.5px;
            line-clamp: 3;
            line-height: 1.13;
            overflow: hidden;
          }

          .saved-meta,
          .saved-seller small {
            font-size: 10px;
          }

          .saved-seller {
            padding-top: 7px;
          }

          .saved-seller-avatar {
            display: none;
          }

          .saved-seller strong {
            font-size: 11px;
          }
        }

        @media (max-width: 360px) {
          .saved-container {
            width: min(100% - 18px, 1160px);
          }

          .saved-grid {
            gap: 8px;
          }
        }
      `}</style>
    </main>
  );
}
