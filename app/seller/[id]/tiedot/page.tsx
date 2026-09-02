import UiText from "@/app/components/UiText";
import Image from "next/image";
import Link from "@/app/components/LocalizedLink";
import { notFound } from "next/navigation";

import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  Globe2,
  Hash,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Shield,
  ShoppingBag,
  Star,
  Store,
  Truck
} from "lucide-react";

import styles from "@/app/commerce.module.css";
import { getPublicStorefront } from "@/lib/commerce/public-storefront";
import { storefrontMetadata } from "@/lib/commerce/storefront-metadata";
import { isUuidLike, profilePath } from "@/lib/routes";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type PublicCompanyProfile = {
  id: string;
  company_name: string | null;
  business_id: string | null;
  company_website: string | null;
  company_verified_at: string | null;
  public_address: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

type PublicCompanyDetails = {
  id: string;
  name: string;
  business_id: string;
  address_line: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  contact_person: string;
  website: string | null;
  description: string;
  verification_status: string;
  verified_at: string | null;
  storefront_headline: string;
  storefront_categories: string[] | null;
};

type PublicReview = { rating: number };
type PublicStockProduct = {
  stock_quantity: number;
  pickup_available: boolean;
  shipping_available: boolean;
  posti_enabled: boolean;
};

async function resolveOwnerId(identifier: string) {
  if (isUuidLike(identifier)) return identifier;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .or(`public_id.eq.${identifier},username.eq.${identifier}`)
    .maybeSingle<{ id: string }>();
  return data?.id ?? identifier;
}

function websiteUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return { href: url.toString(), label: url.hostname.replace(/^www\./i, "") };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return storefrontMetadata(id);
}

export default async function CompanyInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await resolveOwnerId(id);
  const admin = getSupabaseAdmin();
  const storefront = await getPublicStorefront(ownerId);
  if (!storefront) notFound();

  const [profileResult, companyResult, listingsResult, reviewsResult, productsResult] = await Promise.all([
    admin.from("profiles").select("id,company_name,business_id,company_website,company_verified_at,public_address,phone,city,country,bio,avatar_url,created_at").eq("id", ownerId).maybeSingle<PublicCompanyProfile>(),
    admin.from("companies").select("id,name,business_id,address_line,postal_code,city,country,email,phone,contact_person,website,description,verification_status,verified_at,storefront_headline,storefront_categories").eq("owner_user_id", ownerId).maybeSingle<PublicCompanyDetails>(),
    admin.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", ownerId).eq("is_sold", false).eq("is_hidden", false),
    admin.from("seller_reviews").select("rating").eq("seller_id", ownerId).returns<PublicReview[]>(),
    admin.from("products").select("stock_quantity,pickup_available,shipping_available,posti_enabled").eq("company_id", storefront.company_id).eq("active", true).returns<PublicStockProduct[]>()
  ]);

  const profile = profileResult.data;
  const company = companyResult.data;
  if (!profile || !company || profile.company_verified_at === null || company.verification_status !== "approved") notFound();

  const reviews = reviewsResult.data ?? [];
  const products = productsResult.data ?? [];
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const listingCount = listingsResult.count ?? 0;
  const immediateProductCount = products.length;
  const inventoryCount = products.reduce((sum, product) => sum + Math.max(0, product.stock_quantity), 0) + listingCount;
  const offersPickup = products.some((product) => product.pickup_available);
  const offersShipping = products.some((product) => product.shipping_available && product.posti_enabled);
  const name = company.name || profile.company_name || "Yritys";
  const location = profile.public_address?.trim() || "";
  const website = websiteUrl(company.website || profile.company_website);
  const memberSince = profile.created_at ? new Intl.DateTimeFormat("fi-FI", { month: "long", year: "numeric" }).format(new Date(profile.created_at)) : null;
  const verifiedSince = company.verified_at ? new Intl.DateTimeFormat("fi-FI", { day: "numeric", month: "long", year: "numeric" }).format(new Date(company.verified_at)) : null;
  const categories = Array.from(new Set([...(company.storefront_categories ?? []), ...(storefront.storefront_categories ?? [])])).filter(Boolean);
  const storefrontPath = profilePath(ownerId, name, "fi");

  return (
    <main className={styles.companyInfoPage}>
      <div className={styles.companyInfoShell}>
        <header
          className={styles.companyInfoHero}
          style={storefront.banner_image_url ? { backgroundImage: `linear-gradient(90deg, rgba(5, 17, 30, .96), rgba(5, 17, 30, .58)), url(${JSON.stringify(storefront.banner_image_url)})` } : undefined}
        >
          <div className={styles.companyInfoIdentity}>
            <div className={styles.companyInfoLogo}>{profile.avatar_url ? <Image src={profile.avatar_url} alt={`${name} logo`} width={104} height={104} unoptimized /> : <strong>{name.slice(0, 1).toUpperCase()}</strong>}</div>
            <div><span className={styles.companyInfoKicker}><BadgeCheck size={15} /><UiText text={" Vahvistettu yritys"} /></span><h1>{name}</h1><p>{company.storefront_headline || storefront.storefront_headline || "Luotettava yritys Maskines-markkinapaikalla."}</p></div>
          </div>
          <div className={styles.companyInfoHeroActions}>
            <Link href={storefrontPath}><ArrowLeft size={17} /><UiText text={" Takaisin valikoimaan"} /></Link>
            {website && <a href={website.href} target="_blank" rel="noreferrer"><UiText text={"Verkkosivu "} /><ExternalLink size={15} /></a>}
          </div>
        </header>

        <nav className={styles.companyInfoNavigation} aria-label="Yrityssivun osiot">
          <Link href={storefrontPath}><Store size={17} /><UiText text={" Tuotteet ja valikoima"} /></Link>
          <span><Building2 size={17} /><UiText text={" Yrityksen tiedot"} /></span>
        </nav>

        <section className={styles.companyInfoStats} aria-label="Yrityksen myyntitiedot">
          <article><ShoppingBag size={22} /><span><strong>{listingCount + immediateProductCount}</strong><small><UiText text={"tuotetta ja ilmoitusta"} /></small></span></article>
          <article><PackageCheck size={22} /><span><strong>{inventoryCount}</strong><small><UiText text={"kappaletta saatavilla"} /></small></span></article>
          <article><Star size={22} /><span><strong>{reviews.length ? averageRating.toFixed(1) : "–"}</strong><small>{reviews.length}<UiText text={" asiakasarviota"} /></small></span></article>
          <article><Truck size={22} /><span><strong>{offersPickup && offersShipping ? "Nouto + toimitus" : offersShipping ? "Toimitus" : offersPickup ? "Nouto" : "Sovitaan"}</strong><small><UiText text={"toimitustavat"} /></small></span></article>
        </section>

        <div className={styles.companyInfoGrid}>
          <article className={styles.companyInfoMainCard}>
            <header><span><Building2 size={21} /></span><div><small><UiText text={"Yritysesittely"} /></small><h2><UiText text={"Tietoa yrityksestä"} /></h2></div></header>
            <p>{company.description || profile.bio || "Vahvistettu yritys Maskines-markkinapaikalla."}</p>
            {categories.length > 0 && <div className={styles.companyInfoCategories}><strong><UiText text={"Valikoiman pääkategoriat"} /></strong><div>{categories.map((category) => <span key={category}>{category}</span>)}</div></div>}
            <div className={styles.companyInfoChecks}>
              <span><Shield size={18} /><strong><UiText text={"Yritystiedot tarkistettu"} /></strong><small><UiText text={"Maskines on vahvistanut yrityksen perustiedot."} /></small></span>
              <span><Check size={18} /><strong><UiText text={"Julkinen yritysprofiili"} /></strong><small><UiText text={"Yhteystiedot ja myyjän valikoima ovat yhdessä paikassa."} /></small></span>
            </div>
          </article>

          <aside className={styles.companyInfoSideCards}>
            <article>
              <header><span><Hash size={20} /></span><div><small><UiText text={"Viralliset tiedot"} /></small><h2><UiText text={"Yritystunnisteet"} /></h2></div></header>
              <dl>
                <div><dt><UiText text={"Yrityksen nimi"} /></dt><dd>{name}</dd></div>
                <div><dt><UiText text={"Y-tunnus"} /></dt><dd>{company.business_id || profile.business_id || "Ei ilmoitettu"}</dd></div>
                {memberSince && <div><dt><UiText text={"Maskinesissa"} /></dt><dd>{memberSince}<UiText text={" lähtien"} /></dd></div>}
                {verifiedSince && <div><dt><UiText text={"Vahvistettu"} /></dt><dd>{verifiedSince}</dd></div>}
              </dl>
            </article>

            <article>
              <header><span><MapPin size={20} /></span><div><small><UiText text={"Yhteystiedot"} /></small><h2><UiText text={"Ota yhteyttä yritykseen"} /></h2></div></header>
              <div className={styles.companyInfoContacts}>
                {location && <p><MapPin size={17} /><span>{location}</span></p>}
                {company.phone && <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`}><Phone size={17} /> {company.phone}</a>}
                {company.email && <a href={`mailto:${company.email}`}><Mail size={17} /> {company.email}</a>}
                {website && <a href={website.href} target="_blank" rel="noreferrer"><Globe2 size={17} /> {website.label}</a>}
                {company.contact_person && <p><Building2 size={17} /><span><UiText text={"Yhteyshenkilö: "} />{company.contact_person}</span></p>}
              </div>
            </article>
          </aside>
        </div>

        <section className={styles.companyInfoFooterCta}>
          <div><CalendarDays size={22} /><span><strong><UiText text={"Tutustu yrityksen valikoimaan"} /></strong><small><UiText text={"Katso kaikki heti ostettavat tuotteet ja tavalliset myynti-ilmoitukset."} /></small></span></div>
          <Link href={storefrontPath}><UiText text={"Avaa tuotteet "} /><ExternalLink size={16} /></Link>
        </section>
      </div>
    </main>
  );
}
