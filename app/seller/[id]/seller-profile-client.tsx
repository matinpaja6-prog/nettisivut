"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CalendarDays, CheckCircle2, ChevronDown, ExternalLink, Globe2, Heart, MapPin, Shield, Star } from "lucide-react";
import { formatPrice, type Listing } from "@/lib/listings";
import { useLanguage, translateCategory, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";
import {
  getListingsBySeller,
  getPublicProfile,
  getReviewsBySeller,
  getCompanySellers,
  ensureListingTranslations,
  type CompanySeller,
  type SellerReview,
  type UserProfile
} from "@/lib/supabase";

type PublicProfile = Pick<
  UserProfile,
  | "id"
  | "account_type"
  | "first_name"
  | "last_name"
  | "full_name"
  | "company_name"
  | "business_id"
  | "company_role"
  | "company_website"
  | "city"
  | "country"
  | "bio"
  | "avatar_url"
  | "created_at"
  | "phone_verified_at"
>;

function formatAccountAge(value: string | undefined, locale: string) {
  if (!value) return "";
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return "";
  return created.toLocaleDateString(
    locale === "fi" ? "fi-FI"
    : locale === "sv" ? "sv-SE"
    : locale === "no" ? "nb-NO"
    : locale === "et" ? "et-EE"
    : "en-GB",
    { day: "numeric", month: "numeric", year: "numeric" }
  );
}

function formatWebsiteUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const href = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(href);
    return {
      href: url.toString(),
      label: url.hostname.replace(/^www\./i, "")
    };
  } catch {
    return null;
  }
}

function formatListingDate(value: string | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(
    locale === "fi" ? "fi-FI"
    : locale === "sv" ? "sv-SE"
    : locale === "no" ? "nb-NO"
    : locale === "et" ? "et-EE"
    : "en-GB"
  );
}

type TabKey = "listings" | "reviews";

const vehicleTypeTranslations: Record<Locale, Record<string, string>> = {
  fi: {},
  en: { Moottorikelkka: "Snowmobile", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
  sv: { Moottorikelkka: "Snöskoter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
  no: { Moottorikelkka: "Snøscooter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
  et: { Moottorikelkka: "Mootorsaan", Mönkijä: "ATV", Motocross: "Motokross", Mopot: "Mopeed" }
};

export default function SellerProfileClient({ sellerId }: { sellerId: string }) {
  const { t, locale } = useLanguage();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [, setCompanySellers] = useState<CompanySeller[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("listings");
  type SortKey = "newest" | "oldest" | "price_asc" | "price_desc";
  const [sort, setSort] = useState<SortKey>("newest");

  function getListingTitle(listing: Listing): string {
    const localized = getLocalizedListingText(listing, locale);
    if (locale === "fi") return localized.title;
    const leaf = listing.subcategory?.split("/").map((p) => p.trim()).filter(Boolean).at(-1);
    if (!leaf) return localized.title;
    const knownVehicleTypes = Object.keys(vehicleTypeTranslations.en);
    const vehicleType = listing.vehicle_type
      ?? knownVehicleTypes.find((vt) => listing.title.toLowerCase().endsWith(` - ${vt.toLowerCase()}`))
      ?? null;
    const expectedFi = vehicleType ? `${leaf} - ${vehicleType}` : leaf;
    const isGenerated = listing.title.trim().toLowerCase() === expectedFi.trim().toLowerCase();
    if (!isGenerated) return localized.title;
    const translatedSub = translateCategory(locale, listing.subcategory ?? "");
    const subParts = translatedSub.split("/").map((p) => p.trim()).filter(Boolean);
    const translatedLeaf = subParts.at(-1) !== leaf ? (subParts.at(-1) ?? leaf) : (translateCategory(locale, leaf) !== leaf ? translateCategory(locale, leaf) : leaf);
    const translatedVehicle = vehicleType ? (vehicleTypeTranslations[locale]?.[vehicleType] ?? vehicleType) : "";
    return (translatedVehicle ? `${translatedLeaf} - ${translatedVehicle}` : translatedLeaf).trim();
  }

  const sortedListings = useMemo(() => {
    const copy = [...listings];
    if (sort === "price_asc")  return copy.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price_desc") return copy.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "oldest")     return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [listings, sort]);

  useEffect(() => {
    if (locale === "fi" || listings.length === 0) return;

    let cancelled = false;
    const visibleListings = listings.slice(0, 12);

    async function translateSellerListings() {
      for (const listing of visibleListings) {
        if (cancelled) return;

        const key = `sp-translation-attempt:${listing.id}:${locale}`;
        if (sessionStorage.getItem(key)) continue;
        sessionStorage.setItem(key, "1");

        const { data } = await ensureListingTranslations(listing);
        if (!cancelled && data?.translations) {
          setListings((current) =>
            current.map((item) =>
              item.id === data.id ? { ...item, ...data } : item
            )
          );
        }
      }
    }

    void translateSellerListings();

    return () => {
      cancelled = true;
    };
  }, [listings, locale]);

  useEffect(() => {
    getPublicProfile(sellerId).then(({ data }) => {
      if (data) {
        setProfile(data);
        if (data.account_type === "company") {
          getCompanySellers(sellerId).then(({ data: sellers }) => {
            if (sellers) setCompanySellers(sellers);
          });
        }
      }
    });
    getListingsBySeller(sellerId).then(({ data }) => {
      if (data) setListings(data);
    });
    getReviewsBySeller(sellerId).then(({ data }) => {
      if (data) setReviews(data);
    });
  }, [sellerId]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [reviews]);

  const sellerName =
    profile?.account_type === "company"
      ? profile.company_name || profile.full_name || listings[0]?.seller_name || t.authCompanyLabel
      :
    profile?.full_name ||
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
    listings[0]?.seller_name ||
    t.sellerProfile;
  const isCompany =
    profile?.account_type === "company";
  const locationFallback = {
    fi: "Sijaintia ei ole asetettu",
    en: "Location not set",
    sv: "Plats har inte angetts",
    no: "Sted er ikke angitt",
    et: "Asukohta pole määratud"
  }[locale];
  const sellerLocation =
    [profile?.city, profile?.country].filter(Boolean).join(", ") || listings[0]?.location || locationFallback;
  const companyWebsite =
    isCompany ? formatWebsiteUrl(profile?.company_website) : null;
  const sellerBio = profile?.bio?.trim() ?? "";
  // Trust score 0-100
  const memberYears = useMemo(() => {
    if (!profile?.created_at) return 0;
    const ms = Date.now() - new Date(profile.created_at).getTime();
    return Math.max(0, ms / (1000 * 60 * 60 * 24 * 365));
  }, [profile?.created_at]);

  const trustScore = useMemo(() => {
    const ratingPart = (averageRating / 5) * 50;
    const reviewPart = Math.min(reviews.length, 20) * 1.5;
    const listingPart = Math.min(listings.length, 10) * 1;
    const agePart = Math.min(memberYears, 5) * 2;
    return Math.round(
      Math.min(100, Math.max(0, ratingPart + reviewPart + listingPart + agePart))
    );
  }, [averageRating, reviews.length, listings.length, memberYears]);

  const trustLabel =
    trustScore >= 80 ? t.spTrustExcellent
    : trustScore >= 60 ? t.spTrustGood
    : trustScore >= 40 ? t.spTrustFair
    : trustScore >= 20 ? t.spTrustNew
    : t.spTrustPoor;

  const memberSince = formatAccountAge(profile?.created_at, locale);
  const memberMonths = useMemo(() => {
    if (!profile?.created_at) return 0;
    const ms = Date.now() - new Date(profile.created_at).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44)));
  }, [profile?.created_at]);

  const verifiedLabels = {
    phone: {
      fi: "Puhelin vahvistettu",
      en: "Phone verified",
      sv: "Telefon verifierad",
      no: "Telefon verifisert",
      et: "Telefon kinnitatud"
    }[locale],
    company: {
      fi: "Yritysprofiili",
      en: "Company profile",
      sv: "Företagsprofil",
      no: "Bedriftsprofil",
      et: "Ettevõtte profiil"
    }[locale]
  };

  const verificationBadges = [
    profile?.phone_verified_at ? { label: verifiedLabels.phone, type: "phone" } : null,
    isCompany && profile?.business_id ? { label: verifiedLabels.company, type: "company" } : null
  ].filter(Boolean) as Array<{ label: string; type: "phone" | "company" }>;
  const reviewEmptyDescription = {
    fi: `${sellerName} ei ole vielä saanut arvosteluja.`,
    en: `${sellerName} has not received reviews yet.`,
    sv: `${sellerName} har inte fått några recensioner ännu.`,
    no: `${sellerName} har ikke fått anmeldelser ennå.`,
    et: `${sellerName} ei ole veel arvustusi saanud.`
  }[locale];
  return (
    <main className="auth-page seller-page">
      <section className="sp-wrap">
        <div className="sp-header">
          <div className="sp-avatar">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" />
              : (
                <span className="sp-avatar-initial">
                  {sellerName.trim().charAt(0).toUpperCase() || "?"}
                </span>
              )
            }
          </div>
          <div className="sp-header-info">
            <h1>
              {sellerName}
            </h1>
            {memberSince && (
              <p className="sp-member-since">{t.spMemberSince.replace("{date}", memberSince)}</p>
            )}
            {sellerLocation && (
              <p className="sp-location">
                <MapPin size={14} />
                {sellerLocation}
              </p>
            )}
            {companyWebsite && (
              <a
                className="sp-website"
                href={companyWebsite.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe2 size={14} />
                {companyWebsite.label}
                <ExternalLink size={13} />
              </a>
            )}
            {verificationBadges.length > 0 && (
              <div className="sp-verified-row" aria-label="Vahvistukset">
                {verificationBadges.map((badge) => (
                  <span className={`sp-verified ${badge.type === "phone" ? "is-phone" : ""}`} key={badge.label}>
                    <CheckCircle2 size={14} />
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
            <div className="sp-trust-row">
              <span className="sp-trust-badge" title={`${t.spTrust} ${trustScore}/100 – ${trustLabel}`}>
                <Shield size={13} />
                <span>{t.spTrust}</span>
                <strong>{trustScore}</strong>
              </span>
              <span className="sp-trust-label">
                {trustLabel}
                {reviews.length > 0 && (
                  <> · {reviews.length} {t.spReviews.toLowerCase()}</>
                )}
              </span>
            </div>
            {sellerBio && (
              <p className="sp-bio">
                {sellerBio}
              </p>
            )}
          </div>

          <div className="sp-trust-breakdown">
            <div className="sp-trust-panel">
              <div className="sp-data-head">
                <Shield className="sp-trust-panel-icon" size={44} />
                <div>
                  <span>Luottamustaso</span>
                  <strong>{trustLabel}</strong>
                </div>
                <span>
                  <strong>{trustScore} / 100</strong>
                  <small>pistettä</small>
                </span>
              </div>
              <div className="sp-trust-meter-head">
                <span>Luottamus</span>
                <strong>{trustScore} %</strong>
              </div>
              <div className="sp-trust-bar">
                <div className="sp-trust-bar-fill" style={{ width: `${trustScore}%` }} />
              </div>
            </div>
            <div className="sp-trust-stats">
              <div>
                <Star size={14} />
                <strong>{reviews.length ? averageRating.toFixed(1) : "–"}</strong>
                <span>{t.spAverage}</span>
              </div>
              <div>
                <strong>{listings.length}</strong>
                <span>{t.spActiveListings}</span>
              </div>
              <div>
                <strong>{listings.length}</strong>
                <span>{t.spListingsTotal}</span>
              </div>
              <div>
                <strong>{reviews.length}</strong>
                <span>{t.spReviewsTotal}</span>
              </div>
              <div>
                <strong>{memberMonths < 12 ? memberMonths : Math.floor(memberYears)}</strong>
                <span>{memberMonths < 12 ? t.spMonthsMember : t.spYearsMember}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sp-tabs">
          <div className="sp-tabs-left">
            <button
              type="button"
              className={`sp-tab${activeTab === "listings" ? " active" : ""}`}
              onClick={() => setActiveTab("listings")}
            >
              {t.spListings} ({listings.length})
            </button>
            <button
              type="button"
              className={`sp-tab${activeTab === "reviews" ? " active" : ""}`}
              onClick={() => setActiveTab("reviews")}
            >
              {t.spReviews} ({reviews.length})
            </button>
          </div>
          {activeTab === "listings" && listings.length > 0 && (
            <div className="sp-sort-wrap">
              <select
                className="sp-sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="newest">{t.spSortNewest}</option>
                <option value="oldest">{t.spSortOldest}</option>
                <option value="price_asc">{t.spSortPriceAsc}</option>
                <option value="price_desc">{t.spSortPriceDesc}</option>
              </select>
              <ChevronDown size={14} className="sp-sort-icon" />
            </div>
          )}
        </div>

        {activeTab === "listings" && (
          listings.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">
                <Building2 size={48} />
              </div>
              <h3>{t.spNoListings}</h3>
              <p>{t.spNoListingsDesc.replace("{name}", sellerName)}</p>
            </div>
          ) : (
            <div className="seller-listing-grid">
              {sortedListings.map((listing) => (
                <Link className="listing-card seller-listing-card" href={`/listing/${listing.id}`} key={listing.id}>
                  <span className="seller-listing-image">
                    <img src={listing.image_url} alt="" />
                    <span className="seller-listing-heart" aria-hidden="true">
                      <Heart size={20} />
                    </span>
                  </span>
                  <div className="listing-body">
                    <strong className="seller-listing-price">{formatPrice(listing.price)}</strong>
                    <h3>{getListingTitle(listing)}</h3>
                    <p>{getLocalizedListingText(listing, locale).description}</p>
                    <div className="seller-listing-meta">
                      <span>
                        <MapPin size={12} />
                        {listing.location}
                      </span>
                      <span>
                        <CalendarDays size={12} />
                        {formatListingDate(listing.created_at, locale)}
                      </span>
                    </div>
                    <div className="price-row">
                      <span>{(t as Record<string,string>)["cond" + (listing.condition === "Hyvä" ? "Good" : listing.condition === "Uusi" ? "New" : listing.condition === "Kuin uusi" ? "LikeNew" : listing.condition === "Tyydyttävä" ? "Fair" : listing.condition === "Heikko" ? "Poor" : "")] || listing.condition}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {activeTab === "reviews" && (
          reviews.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">
                <Star size={48} />
              </div>
              <h3>{t.noReviews}</h3>
              <p>{reviewEmptyDescription}</p>
            </div>
          ) : (
            <div className="review-list">
              {reviews.map((review) => (
                <article className="review-card" key={review.id}>
                  <div className="review-card-head">
                    <strong>{review.reviewer_name}</strong>
                    <span>
                      <Star size={15} />
                      {review.rating}/5
                    </span>
                  </div>
                  <p>{review.comment}</p>
                </article>
              ))}
            </div>
          )
        )}
      </section>

      <style jsx>{`
        .seller-page {
          min-height: 100vh;
          padding: clamp(18px, 3vw, 34px) 0 88px;
          background:
            radial-gradient(760px 320px at 88% -8%, rgba(255, 122, 26, 0.12), transparent 62%),
            radial-gradient(680px 300px at 8% 0%, rgba(64, 216, 255, 0.08), transparent 68%),
            #0b1118 !important;
          color: #f4f8fc;
        }

        .sp-wrap {
          width: min(1180px, calc(100vw - 32px));
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .sp-header {
          display: grid;
          grid-template-columns: 112px minmax(0, 1fr) minmax(280px, 420px);
          gap: 20px;
          align-items: center;
          padding: clamp(22px, 4vw, 34px);
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 24px;
          background:
            radial-gradient(720px 260px at 96% 0%, rgba(255, 122, 26, 0.18), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98));
          box-shadow: 0 24px 70px rgba(0, 7, 18, 0.34), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .sp-avatar {
          width: 104px;
          height: 104px;
          border-radius: 28px;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: rgba(3, 12, 24, 0.58);
          border: 1px solid rgba(255, 122, 26, 0.34);
          box-shadow: 0 18px 40px rgba(0, 7, 18, 0.3);
        }

        .sp-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .sp-avatar-initial {
          color: #fff;
          font-size: 42px;
          font-weight: 950;
        }

        .sp-header-info {
          min-width: 0;
          display: grid;
          gap: 10px;
        }

        .sp-header-info h1 {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin: 0;
          color: #fff;
          font-size: clamp(2rem, 5vw, 3.4rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .sp-member-since,
        .sp-location,
        .sp-website,
        .sp-trust-label {
          margin: 0;
          color: rgba(226, 244, 255, 0.72);
          font-size: 14px;
          font-weight: 750;
        }

        .sp-location,
        .sp-website,
        .sp-verified,
        .sp-trust-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          width: fit-content;
        }

        .sp-website {
          text-decoration: none;
          color: #ffb45f;
        }

        .sp-verified-row,
        .sp-trust-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sp-verified,
        .sp-trust-badge {
          min-height: 30px;
          padding: 0;
          border-radius: 999px;
          border: 0;
          background: transparent;
          color: rgba(226, 244, 255, 0.82);
          font-size: 12px;
          font-weight: 900;
        }

        .sp-verified.is-phone {
          color: #4ade80;
        }

        .sp-verified.is-phone svg {
          color: #22c55e;
          filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.32));
        }

        .sp-trust-badge strong {
          color: #fff;
        }

        .sp-bio {
          max-width: 620px;
          margin: 4px 0 0;
          color: rgba(226, 244, 255, 0.82);
          font-size: 15px;
          font-weight: 650;
          line-height: 1.55;
          white-space: pre-line;
        }

        .sp-trust-breakdown {
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .sp-trust-panel,
        .sp-trust-stats {
          border: 1px solid rgba(151, 178, 205, 0.16);
          border-radius: 18px;
          background: rgba(3, 12, 24, 0.34);
          padding: 16px;
        }

        .sp-data-head {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
        }

        .sp-data-head span,
        .sp-trust-meter-head span,
        .sp-trust-stats span {
          color: rgba(226, 244, 255, 0.66);
          font-size: 12px;
          font-weight: 800;
        }

        .sp-data-head strong,
        .sp-trust-meter-head strong,
        .sp-trust-stats strong {
          display: block;
          color: #fff;
          font-weight: 950;
        }

        .sp-trust-panel-icon {
          color: #ffb45f;
        }

        .sp-trust-meter-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 14px;
        }

        .sp-trust-bar {
          height: 10px;
          margin-top: 8px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(151, 178, 205, 0.18);
        }

        .sp-trust-bar-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(135deg, #ff9a24, #ff6b16);
        }

        .sp-trust-stats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .sp-trust-stats div {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .sp-tabs {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px;
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 18px;
          background: rgba(13, 29, 46, 0.72);
        }

        .sp-tabs-left {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sp-tab {
          min-height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(151, 178, 205, 0.16);
          background: rgba(12, 28, 46, 0.78);
          color: rgba(226, 244, 255, 0.78);
          font-weight: 900;
          cursor: pointer;
        }

        .sp-tab.active {
          background: linear-gradient(135deg, #ff9a24, #ff6b16);
          border-color: rgba(255, 210, 165, 0.62);
          color: #fff;
        }

        .sp-sort-wrap {
          position: relative;
          min-width: 0;
          width: 184px;
          display: flex;
          align-items: center;
        }

        .sp-sort-select {
          width: 100%;
          min-height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(151, 178, 205, 0.22);
          background: rgba(3, 12, 24, 0.62);
          color: #f4f8fc;
          font-weight: 850;
          padding: 0 34px 0 12px;
          appearance: none;
          -webkit-appearance: none;
          background-image: none;
          line-height: 40px;
        }

        .sp-sort-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #ffb45f;
          pointer-events: none;
          z-index: 1;
        }

        .seller-listing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 18px;
          align-items: stretch;
        }

        .seller-listing-card,
        .sp-empty,
        .review-card {
          overflow: hidden;
          border: 1px solid rgba(255, 122, 26, 0.58);
          border-radius: 18px;
          background:
            radial-gradient(420px 160px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98));
          color: #f4f8fc;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(0, 7, 18, 0.24), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .seller-listing-card {
          display: grid !important;
          grid-template-rows: 220px 1fr !important;
          height: 410px !important;
          min-height: 410px !important;
          outline: 1px solid rgba(255, 154, 36, 0.72);
          outline-offset: -1px;
          transition: border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
        }

        .seller-listing-card:hover {
          border-color: rgba(255, 183, 93, 0.95);
          box-shadow: 0 22px 54px rgba(0, 7, 18, 0.3), 0 0 0 1px rgba(255, 154, 36, 0.42);
          transform: translateY(-2px);
        }

        .seller-listing-image {
          display: block !important;
          background: #06111f;
          overflow: hidden;
          border-bottom: 1px solid rgba(255, 122, 26, 0.28);
          height: 220px !important;
          max-height: 220px !important;
          min-height: 220px !important;
          position: relative;
          width: 100% !important;
        }

        .seller-listing-image img {
          width: 100% !important;
          height: 100% !important;
          max-height: 220px !important;
          object-fit: cover !important;
          display: block !important;
        }

        .seller-listing-heart {
          align-items: center;
          background: rgba(9, 23, 38, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.46);
          border-radius: 999px;
          color: #ffffff;
          display: inline-flex;
          height: 34px;
          justify-content: center;
          position: absolute;
          right: 12px;
          top: 12px;
          width: 34px;
          z-index: 2;
        }

        .listing-body {
          display: grid;
          grid-template-rows: auto auto auto 1fr auto;
          gap: 8px;
          padding: 16px;
          min-height: 190px;
          background: #09233d;
        }

        .seller-listing-price {
          color: #ffffff;
          font-size: 2rem;
          font-weight: 950;
          line-height: 1;
        }

        .listing-body h3 {
          margin: 0;
          color: #fff;
          font-size: 16px;
          font-weight: 950;
          line-height: 1.2;
          min-height: 38px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .seller-listing-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          color: rgba(226, 244, 255, 0.72);
          font-size: 12px;
          font-weight: 850;
          line-height: 1.25;
        }

        .seller-listing-meta span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
        }

        .listing-body p {
          margin: 0;
          color: rgba(226, 244, 255, 0.66);
          font-size: 13px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .price-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 0;
        }

        .price-row strong {
          color: #fff;
          font-size: 20px;
          font-weight: 950;
        }

        .price-row span {
          border: 1px solid rgba(255, 122, 26, 0.58);
          border-radius: 999px;
          background: transparent;
          color: #ffb45f;
          font-size: 11px;
          font-weight: 900;
          padding: 5px 8px;
        }

        .sp-empty {
          min-height: 280px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 10px;
          padding: 32px;
          text-align: center;
        }

        .sp-empty-icon {
          color: #ffb45f;
        }

        .sp-empty h3 {
          margin: 0;
          color: #fff;
          font-size: 22px;
          font-weight: 950;
        }

        .sp-empty p,
        .review-card p {
          margin: 0;
          color: rgba(226, 244, 255, 0.7);
        }

        .review-list {
          display: grid;
          gap: 12px;
        }

        .review-card {
          padding: 16px;
        }

        .review-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .review-card-head strong {
          color: #fff;
        }

        .review-card-head span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #ffb45f;
          font-weight: 950;
        }

        @media (max-width: 900px) {
          .sp-header {
            grid-template-columns: 88px minmax(0, 1fr);
          }

          .sp-avatar {
            width: 82px;
            height: 82px;
            border-radius: 22px;
          }

          .sp-trust-breakdown {
            grid-column: 1 / -1;
          }

          .sp-trust-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sp-tabs {
            align-items: stretch;
            flex-direction: column;
          }

          .sp-sort-wrap {
            width: 100%;
            max-width: 220px;
          }
        }

        @media (max-width: 560px) {
          .seller-page {
            padding-top: 14px;
          }

          .sp-wrap {
            width: min(100% - 24px, 1180px);
          }

          .sp-header {
            grid-template-columns: 1fr;
            padding: 20px;
          }

          .sp-header-info h1 {
            font-size: 2rem;
          }

          .sp-avatar {
            width: 76px;
            height: 76px;
          }

          .seller-listing-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .seller-listing-card {
            border-radius: 12px !important;
            grid-template-rows: 118px 1fr !important;
            height: 276px !important;
            min-height: 276px !important;
          }

          .seller-listing-image,
          .seller-listing-image img {
            height: 118px !important;
            max-height: 118px !important;
            min-height: 118px !important;
          }

          .seller-listing-heart {
            height: 30px;
            right: 8px;
            top: 8px;
            width: 30px;
          }

          .listing-body {
            gap: 5px;
            min-height: 158px;
            padding: 10px;
          }

          .seller-listing-price {
            font-size: 1.35rem;
          }

          .listing-body h3 {
            font-size: 13px;
            min-height: 31px;
          }

          .listing-body p {
            display: none;
          }

          .seller-listing-meta {
            gap: 5px;
            font-size: 10px;
          }

          .price-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
          }

          .price-row span {
            font-size: 10px;
            padding: 4px 7px;
          }
        }
      `}</style>
    </main>
  );
}
