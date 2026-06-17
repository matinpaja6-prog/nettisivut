"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OptimizedListingImage, { fallbackListingImage } from "@/app/components/OptimizedListingImage";
import marketplaceStyles from "@/app/page.module.css";
import { translateCategory, useLanguage, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";

import { ArrowRight, Clock3, Heart, Search, Tag } from "lucide-react";

import type { Listing } from "@/lib/listings";
import { formatPrice } from "@/lib/listings";
import { formatLocationWithCountry, getCountryFlagFromLocation } from "@/lib/country-flags";
import {
  getListingsByIds,
  getSavedListingIds,
  saveListing,
  unsaveListing
} from "@/lib/supabase";
import { readCachedListings } from "@/lib/client-listings-cache";
import { listingPath } from "@/lib/routes";

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

    if (savedIds.length === 0) {
      setAllListings([]);
      setListingsLoading(false);
      return () => {
        mounted = false;
      };
    }

    const cachedListings = readCachedListings();
    const savedIdSet = new Set(savedIds);
    const cachedSavedListings =
      cachedListings.filter((listing) => savedIdSet.has(listing.id));

    if (cachedSavedListings.length > 0) {
      setAllListings(cachedSavedListings);
      setListingsLoading(false);
    } else {
      setListingsLoading(true);
    }

    getListingsByIds(savedIds)
      .then(({ data }) => {
        if (mounted && data) {
          setAllListings(data);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setListingsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [savedIds]);

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

  function formatDate(date: string) {
    const locales: Record<Locale, string> = {
      fi: "fi-FI",
      en: "en-US",
      sv: "sv-SE",
      no: "nb-NO",
      et: "et-EE"
    };

    return new Date(date).toLocaleDateString(locales[locale]);
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
            <div className="saved-empty-orbit" aria-hidden="true">
              <span className="saved-orbit-ring" />
              <span className="saved-orbit-ring" />
              <span className="saved-orbit-ring" />
              <span className="saved-orbit-dot" />
              <span className="saved-orbit-dot" />
              <span className="saved-orbit-dot" />
              <div className="saved-empty-icon">
                <Heart size={38} />
              </div>
            </div>
            <strong>{t.noListings}</strong>
            <span>Paina ilmoituksen sydäntä, niin se näkyy täällä myöhemmin.</span>
            <Link className="saved-empty-link" href="/">
              <Search size={16} />
              {t.viewAll}
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : listingsLoading ? (
          <div className={`${marketplaceStyles.cardsGrid} saved-grid`} aria-label="Ladataan tallennettuja ilmoituksia">
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
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div className={`${marketplaceStyles.cardsGrid} saved-grid`}>
            {savedListings.map((listing) => {
              const isFavorite = savedIds.includes(listing.id);
              const countryFlag = getCountryFlagFromLocation(listing.location, t.country);

              return (
                <article
                  key={listing.id}
                  className={`${marketplaceStyles.card} saved-card`}
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

                  <div className={`${marketplaceStyles.cardImage} ${marketplaceStyles.listingCardImage} saved-card-image`}>
                    <span className={marketplaceStyles.cardImageBlur} aria-hidden="true">
                      <OptimizedListingImage
                        src={listingImageSrc(listing)}
                        alt=""
                        decorative
                      />
                    </span>
                    <OptimizedListingImage
                      src={listingImageSrc(listing)}
                      alt={getListingTitle(listing)}
                    />
                    {isListingNew(listing.created_at) && (
                      <span className={`${marketplaceStyles.newBadge} saved-new-badge`} aria-label="Uusi">
                        Uusi
                      </span>
                    )}
                    <button
                      onClick={(e) => toggleFavorite(e, listing.id)}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className={`${marketplaceStyles.favoriteButton} ${
                        isFavorite ? marketplaceStyles.favoriteButtonActive : ""
                      } saved-favorite ${isFavorite ? "is-active" : ""}`}
                      type="button"
                      aria-label={isFavorite ? t.removeFavorite : t.addFavorite}
                    >
                      <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <div className={`${marketplaceStyles.cardBody} saved-card-body`}>
                    <p className={marketplaceStyles.cardPrice}>{formatPrice(listing.price)}</p>
                    <h3 className={marketplaceStyles.cardTitle}>{getListingTitle(listing)}</h3>
                    <div className={`${marketplaceStyles.cardMetaRow} saved-meta`}>
                      <span className={marketplaceStyles.cardLocationMeta}>
                        {countryFlag ? (
                          <img
                            className={`${marketplaceStyles.listingCountryFlag} saved-country-flag`}
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
          background: var(--listing-card-bg, var(--site-card, #0e1721));
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
          background: color-mix(in srgb, var(--listing-card-bg, var(--site-card, #0e1721)) 92%, #ffffff 8%);
        }

        .saved-meta {
          color: rgba(226, 244, 255, 0.66);
          font-size: 11px;
          font-weight: 750;
        }

        .saved-meta span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .saved-country-flag {
          width: 18px;
          height: 13px;
          flex: 0 0 auto;
          border-radius: 2px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.28);
          object-fit: cover;
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

        body .saved-page.saved-shell {
          min-height: 100vh !important;
          padding: 24px 0 88px !important;
          background:
            radial-gradient(820px 460px at 78% 42%, rgba(18, 63, 104, 0.2), transparent 70%),
            radial-gradient(620px 340px at 15% 16%, rgba(19, 73, 119, 0.18), transparent 72%),
            linear-gradient(180deg, #030b17 0%, #071322 48%, #06111e 100%) !important;
          color: #f8fbff !important;
        }

        body .saved-page .saved-container {
          width: min(1298px, calc(100vw - 238px)) !important;
          gap: 47px !important;
          margin: 0 auto !important;
        }

        body .saved-page .saved-hero {
          min-height: 174px !important;
          padding: 36px 36px 36px 37px !important;
          border: 1px solid rgba(185, 204, 222, 0.27) !important;
          border-radius: 25px !important;
          background:
            radial-gradient(520px 260px at 4% 0%, rgba(35, 95, 139, 0.52), transparent 72%),
            radial-gradient(720px 320px at 100% 0%, rgba(147, 91, 48, 0.12), transparent 75%),
            linear-gradient(145deg, rgba(14, 33, 53, 0.96), rgba(12, 22, 36, 0.97)) !important;
          box-shadow:
            0 26px 60px rgba(0, 8, 20, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.07) !important;
        }

        body .saved-page .saved-hero-main {
          gap: 25px !important;
        }

        body .saved-page .saved-hero-icon {
          width: 78px !important;
          height: 78px !important;
          border-radius: 17px !important;
          color: #ffffff !important;
          background:
            radial-gradient(circle at 32% 22%, rgba(255, 255, 255, 0.28), transparent 32%),
            linear-gradient(135deg, #ffad29 0%, #ff7114 52%, #ed5100 100%) !important;
          border: 1px solid rgba(255, 201, 143, 0.35) !important;
          box-shadow:
            0 0 34px rgba(255, 116, 20, 0.54),
            0 16px 28px rgba(0, 0, 0, 0.26),
            inset 0 1px 0 rgba(255, 255, 255, 0.26) !important;
        }

        body .saved-page .saved-hero-icon svg {
          width: 40px !important;
          height: 40px !important;
        }

        body .saved-page .saved-hero-copy span {
          margin-bottom: 9px !important;
          color: #ff8a1a !important;
          font-size: 16px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
        }

        body .saved-page .saved-hero-copy h1 {
          margin: 0 !important;
          color: #ffffff !important;
          font-size: clamp(34px, 2.65vw, 40px) !important;
          line-height: 1.02 !important;
          letter-spacing: 0 !important;
          text-shadow: 0 12px 26px rgba(0, 8, 20, 0.38) !important;
        }

        body .saved-page .saved-hero-copy p {
          margin-top: 9px !important;
          color: rgba(222, 235, 245, 0.76) !important;
          font-size: 16px !important;
          font-weight: 750 !important;
        }

        body .saved-page .saved-hero-stat {
          min-width: 110px !important;
          min-height: 101px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(185, 204, 222, 0.16) !important;
          background: linear-gradient(180deg, rgba(31, 48, 68, 0.66), rgba(20, 34, 50, 0.55)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 16px 30px rgba(0, 8, 20, 0.14) !important;
        }

        body .saved-page .saved-hero-stat strong {
          color: #ffffff !important;
          font-size: 34px !important;
          line-height: 1 !important;
        }

        body .saved-page .saved-hero-stat span {
          margin-top: 5px !important;
          color: #ffd48d !important;
          font-size: 13px !important;
        }

        body .saved-page .saved-empty {
          min-height: 536px !important;
          gap: 14px !important;
          padding: 48px 28px !important;
          border: 1px dashed rgba(171, 196, 220, 0.42) !important;
          border-radius: 27px !important;
          background:
            radial-gradient(680px 320px at 50% 36%, rgba(17, 67, 111, 0.3), transparent 72%),
            linear-gradient(180deg, rgba(7, 25, 43, 0.56), rgba(5, 18, 31, 0.34)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03) !important;
        }

        body .saved-page .saved-empty-orbit {
          position: relative !important;
          width: 230px !important;
          height: 230px !important;
          display: grid !important;
          place-items: center !important;
          margin: 0 0 -2px !important;
        }

        body .saved-page .saved-orbit-ring {
          position: absolute !important;
          inset: 50% auto auto 50% !important;
          border: 1px solid rgba(255, 122, 24, 0.22) !important;
          border-radius: 999px !important;
          transform: translate(-50%, -50%) !important;
        }

        body .saved-page .saved-orbit-ring:nth-child(1) {
          width: 116px !important;
          height: 116px !important;
        }

        body .saved-page .saved-orbit-ring:nth-child(2) {
          width: 154px !important;
          height: 154px !important;
          border-color: rgba(255, 122, 24, 0.16) !important;
        }

        body .saved-page .saved-orbit-ring:nth-child(3) {
          width: 192px !important;
          height: 192px !important;
          border-color: rgba(255, 122, 24, 0.1) !important;
        }

        body .saved-page .saved-orbit-dot {
          position: absolute !important;
          width: 6px !important;
          height: 6px !important;
          border-radius: 999px !important;
          background: #ff7a1a !important;
          box-shadow: 0 0 12px rgba(255, 122, 24, 0.95) !important;
        }

        body .saved-page .saved-orbit-dot:nth-child(4) {
          left: 23px !important;
          top: 111px !important;
        }

        body .saved-page .saved-orbit-dot:nth-child(5) {
          right: 34px !important;
          top: 30px !important;
        }

        body .saved-page .saved-orbit-dot:nth-child(6) {
          right: 38px !important;
          top: 141px !important;
        }

        body .saved-page .saved-empty-icon {
          width: 78px !important;
          height: 78px !important;
          border-radius: 16px !important;
          z-index: 1 !important;
          background:
            radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.25), transparent 34%),
            linear-gradient(135deg, #ffaa28 0%, #ff7215 54%, #ef5200 100%) !important;
          border: 1px solid rgba(255, 201, 143, 0.34) !important;
          box-shadow:
            0 0 34px rgba(255, 116, 20, 0.46),
            0 18px 30px rgba(0, 8, 20, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.26) !important;
        }

        body .saved-page .saved-empty strong {
          color: #ffffff !important;
          font-size: 32px !important;
          line-height: 1.15 !important;
          letter-spacing: 0 !important;
          text-shadow: 0 12px 28px rgba(0, 8, 20, 0.44) !important;
        }

        body .saved-page .saved-empty > span {
          color: rgba(222, 235, 245, 0.75) !important;
          font-size: 17px !important;
          font-weight: 750 !important;
          max-width: 520px !important;
        }

        body .saved-page .saved-empty-link {
          min-height: 57px !important;
          margin-top: 5px !important;
          padding: 0 20px !important;
          border-radius: 11px !important;
          border: 1px solid rgba(255, 201, 143, 0.46) !important;
          background: linear-gradient(135deg, #ff981f 0%, #ff6c12 52%, #ef5200 100%) !important;
          color: #ffffff !important;
          font-size: 17px !important;
          font-weight: 950 !important;
          gap: 13px !important;
          box-shadow:
            0 0 30px rgba(255, 116, 20, 0.34),
            0 15px 28px rgba(0, 8, 20, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.22) !important;
        }

        @media (max-width: 720px) {
          body .saved-page.saved-shell {
            padding: 14px 0 74px !important;
          }

          body .saved-page .saved-container {
            width: min(100% - 24px, 1160px) !important;
            gap: 18px !important;
          }

          body .saved-page .saved-hero {
            min-height: 0 !important;
            padding: 20px !important;
          }

          body .saved-page .saved-hero-main {
            gap: 14px !important;
          }

          body .saved-page .saved-hero-icon {
            width: 54px !important;
            height: 54px !important;
          }

          body .saved-page .saved-hero-icon svg {
            width: 28px !important;
            height: 28px !important;
          }

          body .saved-page .saved-hero-copy h1 {
            font-size: clamp(27px, 8vw, 34px) !important;
          }

          body .saved-page .saved-hero-copy p {
            font-size: 14px !important;
          }

          body .saved-page .saved-hero-stat {
            min-height: 58px !important;
            min-width: 100% !important;
            padding: 0 16px !important;
          }

          body .saved-page .saved-empty {
            min-height: 430px !important;
            padding: 32px 18px !important;
          }

          body .saved-page .saved-empty-orbit {
            width: 170px !important;
            height: 170px !important;
          }

          body .saved-page .saved-orbit-ring:nth-child(1) {
            width: 92px !important;
            height: 92px !important;
          }

          body .saved-page .saved-orbit-ring:nth-child(2) {
            width: 124px !important;
            height: 124px !important;
          }

          body .saved-page .saved-orbit-ring:nth-child(3) {
            width: 154px !important;
            height: 154px !important;
          }

          body .saved-page .saved-empty-icon {
            width: 68px !important;
            height: 68px !important;
          }

          body .saved-page .saved-empty strong {
            font-size: 26px !important;
          }

          body .saved-page .saved-empty > span {
            font-size: 15px !important;
          }

          body .saved-page .saved-empty-link {
            min-height: 50px !important;
            font-size: 15px !important;
          }

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

          .saved-meta {
            font-size: 10px;
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

        /* Match the front page favorite heart: orange, round, and clearly active. */
        body .saved-page .saved-card-image .saved-favorite,
        body .saved-page .saved-card-image [class*="favoriteButton"].saved-favorite {
          align-items: center !important;
          background: rgba(3, 19, 38, 0.72) !important;
          border: 1px solid rgba(226, 232, 240, 0.72) !important;
          border-radius: 999px !important;
          box-shadow:
            0 10px 24px rgba(0, 10, 24, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.14) !important;
          color: #ffffff !important;
          display: inline-flex !important;
          height: 34px !important;
          justify-content: center !important;
          line-height: 0 !important;
          padding: 0 !important;
          right: 10px !important;
          top: 10px !important;
          transform: none !important;
          width: 34px !important;
        }

        body .saved-page .saved-card-image .saved-favorite:hover,
        body .saved-page .saved-card-image [class*="favoriteButton"].saved-favorite:hover {
          background: rgba(255, 107, 22, 0.92) !important;
          border-color: rgba(255, 210, 168, 0.9) !important;
          color: #ffffff !important;
          transform: translateY(-1px) scale(1.03) !important;
        }

        body .saved-page .saved-card-image .saved-favorite.is-active,
        body .saved-page .saved-card-image [class*="favoriteButtonActive"].saved-favorite,
        body .saved-page .saved-card-image [class*="favoriteButtonActive"].saved-favorite:hover {
          background: linear-gradient(135deg, #ffae3d 0%, #ff7a1f 48%, #e85a00 100%) !important;
          border-color: rgba(255, 210, 168, 0.9) !important;
          box-shadow:
            0 12px 28px rgba(255, 107, 22, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.28) !important;
          color: #ffffff !important;
        }

        body .saved-page .saved-card-image .saved-favorite svg,
        body .saved-page .saved-card-image [class*="favoriteButton"].saved-favorite svg {
          display: block !important;
          fill: currentColor !important;
          height: 17px !important;
          margin: 0 !important;
          stroke-width: 2.4 !important;
          width: 17px !important;
        }

        body .saved-page .saved-empty-icon {
          background: linear-gradient(135deg, #ffae3d 0%, #ff7a1f 48%, #e85a00 100%) !important;
          color: #ffffff !important;
        }

        body .saved-page .saved-card-image .saved-new-badge,
        body .saved-page .saved-card-image [class*="newBadge"].saved-new-badge {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
          border: 1px solid rgba(187, 247, 208, 0.72) !important;
          box-shadow:
            0 3px 9px rgba(22, 163, 74, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.25) !important;
          color: #ffffff !important;
        }

        @media (max-width: 640px) {
          body .saved-page .saved-card-image .saved-favorite,
          body .saved-page .saved-card-image [class*="favoriteButton"].saved-favorite {
            height: 30px !important;
            right: 7px !important;
            top: 7px !important;
            width: 30px !important;
          }

          body .saved-page .saved-card-image .saved-favorite svg,
          body .saved-page .saved-card-image [class*="favoriteButton"].saved-favorite svg {
            height: 15px !important;
            width: 15px !important;
          }
        }

        /* Follow the admin appearance base/background color. Keep this last so it wins old page gradients. */
        body:has(.saved-page),
        html body:has(.saved-page) {
          background: var(--site-bg, var(--bg, #0b1118)) !important;
          background-image: none !important;
        }

        html body .saved-page.saved-shell,
        html body .saved-page {
          background: var(--site-bg, var(--bg, #0b1118)) !important;
          background-image: none !important;
        }
      `}</style>
    </main>
  );
}
