"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, ChevronDown, ExternalLink, Globe2, MapPin, Shield, Star } from "lucide-react";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { formatPrice, type Listing } from "@/lib/listings";
import { useLanguage, translateCategory, type Locale } from "@/lib/i18n";
import { getLocalizedListingText } from "@/lib/listing-translations";
import {
  getListingsBySeller,
  getPublicProfile,
  getReviewsBySeller,
  getCompanySellers,
  ensureListingTranslations,
  isUserAdmin,
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
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
    isUserAdmin(sellerId).then(setIsAdmin).catch(() => setIsAdmin(false));
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
    profile?.phone_verified_at ? verifiedLabels.phone : null,
    isCompany && profile?.business_id ? verifiedLabels.company : null
  ].filter(Boolean);
  const reviewEmptyDescription = {
    fi: `${sellerName} ei ole vielä saanut arvosteluja.`,
    en: `${sellerName} has not received reviews yet.`,
    sv: `${sellerName} har inte fått några recensioner ännu.`,
    no: `${sellerName} har ikke fått anmeldelser ennå.`,
    et: `${sellerName} ei ole veel arvustusi saanud.`
  }[locale];
  const returnTo = searchParams.get("returnTo");
  const backHref =
    returnTo?.startsWith("/listing/")
      ? returnTo
      : "/";

  return (
    <main className="auth-page seller-page">
      <header className="auth-topbar">
        <Link className="back-link" href={backHref}>
          <ArrowLeft size={18} />
          {t.back}
        </Link>
        <LanguageSwitcher />
      </header>

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
              {isAdmin && (
                <span
                  style={{
                    marginLeft: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #087b93, #0a9ab5)",
                    color: "#ffffff",
                    fontSize: "0.7em",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    verticalAlign: "middle",
                    boxShadow: "0 8px 18px rgba(8, 121, 149, 0.32)"
                  }}
                  title="Sivuston ylläpito"
                >
                  <Shield size={12} /> ADMIN
                </span>
              )}
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
                {verificationBadges.map((label) => (
                  <span className="sp-verified" key={label}>
                    <CheckCircle2 size={14} />
                    {label}
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
                  </span>
                  <div className="listing-body">
                    <h3>{getListingTitle(listing)}</h3>
                    <p>{getLocalizedListingText(listing, locale).description}</p>
                    <div className="price-row">
                      <strong>{formatPrice(listing.price)}</strong>
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
    </main>
  );
}
