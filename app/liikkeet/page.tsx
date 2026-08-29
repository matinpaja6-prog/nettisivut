import { ArrowRight, MapPin, Package, Search, ShieldCheck, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import styles from "./page.module.css";
import { companyRecord } from "@/lib/commerce/company-record";
import { profilePath } from "@/lib/routes";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const metadata: Metadata = {
  title: "Yritykset | Maskines",
  description: "Tutustu Maskinesin vahvistettuihin yrityksiin ja niiden valikoimiin.",
};

export const revalidate = 300;

type StoresPageProps = {
  searchParams: Promise<{ yritys?: string | string[]; sijainti?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("fi");
}

function formatPlaceName(value: string) {
  const normalized = normalize(value);
  if (!normalized) return "Muu Suomi";
  return normalized.replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("fi"));
}

export default async function StoresPage({ searchParams }: StoresPageProps) {
  const params = await searchParams;
  const companyQuery = firstParam(params.yritys).trim();
  const locationQuery = firstParam(params.sijainti).trim();
  const normalizedCompanyQuery = normalize(companyQuery);
  const normalizedLocationQuery = normalize(locationQuery);
  const admin = getSupabaseAdmin();
  const [{ data: companyRows }, { data: productRows }, { data: listingRows }] = await Promise.all([
    admin.from("companies").select("*").eq("verification_status", "approved").order("name", { ascending: true }),
    admin.from("products").select("id,company_id,name,price_cents,created_at").eq("active", true).gt("stock_quantity", 0),
    admin.from("listings").select("seller_id,title,price,created_at,translations").eq("is_sold", false).eq("is_hidden", false),
  ]);
  const companies = (companyRows ?? []).map((row) => companyRecord(row as Record<string, unknown>));
  const companyByOwnerId = new Map(companies.map((company) => [company.owner_user_id, company]));
  const productCounts = new Map<string, number>();
  const activeProductIds = new Set<string>();
  const productsByCompany = new Map<string, Array<{ name: string; priceCents: number; createdAt: number }>>();
  (productRows ?? []).forEach((row) => {
    const product = row as { id?: string; company_id?: string; name?: string; price_cents?: number; created_at?: string };
    const companyId = String(product.company_id ?? "");
    if (!companyId) return;
    productCounts.set(companyId, (productCounts.get(companyId) ?? 0) + 1);
    if (product.id) activeProductIds.add(String(product.id));
    const products = productsByCompany.get(companyId) ?? [];
    products.push({
      name: normalize(String(product.name ?? "")),
      priceCents: Number(product.price_cents ?? 0),
      createdAt: new Date(String(product.created_at ?? "")).getTime(),
    });
    productsByCompany.set(companyId, products);
  });

  const ordinaryListingCounts = new Map<string, number>();
  (listingRows ?? []).forEach((row) => {
    const listing = row as {
      seller_id?: string;
      title?: string;
      price?: number;
      created_at?: string;
      translations?: { _meta?: { commerce_product_id?: string } } | null;
    };
    const company = companyByOwnerId.get(String(listing.seller_id ?? ""));
    if (!company) return;

    const linkedProductId = String(listing.translations?._meta?.commerce_product_id ?? "");
    if (linkedProductId && activeProductIds.has(linkedProductId)) return;

    // Older immediately purchasable products may not have a saved product ID.
    // They were published beside an equal listing, so match the exact name and
    // price within a short creation-time window to avoid counting them twice.
    const listingTime = new Date(String(listing.created_at ?? "")).getTime();
    const isLegacyProductListing = (productsByCompany.get(company.id) ?? []).some((product) => (
      product.name === normalize(String(listing.title ?? ""))
      && product.priceCents === Math.round(Number(listing.price ?? 0) * 100)
      && Number.isFinite(product.createdAt)
      && Number.isFinite(listingTime)
      && Math.abs(product.createdAt - listingTime) <= 5 * 60 * 1000
    ));
    if (isLegacyProductListing) return;

    ordinaryListingCounts.set(company.id, (ordinaryListingCounts.get(company.id) ?? 0) + 1);
  });

  const totalItemCounts = new Map(companies.map((company) => [
    company.id,
    (productCounts.get(company.id) ?? 0) + (ordinaryListingCounts.get(company.id) ?? 0),
  ]));

  const filteredCompanies = companies.filter((company) => {
    const companyText = normalize([
      company.name,
      company.description,
      company.storefront_headline,
      ...company.storefront_categories,
    ].filter(Boolean).join(" "));
    const locationText = normalize([company.city, company.postal_code, company.address_line].filter(Boolean).join(" "));
    return (!normalizedCompanyQuery || companyText.includes(normalizedCompanyQuery))
      && (!normalizedLocationQuery || locationText.includes(normalizedLocationQuery));
  });

  const locations = Array.from(companies.reduce((groups, company) => {
    const city = formatPlaceName(company.city ?? "");
    const key = normalize(city);
    const current = groups.get(key) ?? { city, companyCount: 0, productCount: 0 };
    current.companyCount += 1;
    current.productCount += totalItemCounts.get(company.id) ?? 0;
    groups.set(key, current);
    return groups;
  }, new Map<string, { city: string; companyCount: number; productCount: number }>()))
    .map(([, location]) => location)
    .sort((a, b) => a.city.localeCompare(b.city, "fi"));

  const hasFilters = Boolean(companyQuery || locationQuery);
  const totalProducts = Array.from(totalItemCounts.values()).reduce((sum, count) => sum + count, 0);

  return (
    <main className={styles.page}>
      <div className={styles.directory}>
        <aside className={styles.searchPanel}>
          <div className={styles.searchHeading}>
            <span><Search size={20} /></span>
            <div>
              <h2>Haku</h2>
              <p>Etsi Maskines-yrityksiä</p>
            </div>
          </div>

          <form className={styles.searchForm} action="/liikkeet">
            <label>
              <span>Yritys</span>
              <input name="yritys" defaultValue={companyQuery} placeholder="Yrityksen nimi tai tuote" />
            </label>
            <label>
              <span>Sijainti</span>
              <input name="sijainti" defaultValue={locationQuery} placeholder="Kunta tai postinumero" />
            </label>
            <button type="submit"><Search size={17} /> Hae yrityksiä</button>
            {hasFilters ? <Link className={styles.clearFilters} href="/liikkeet">Tyhjennä haku</Link> : null}
          </form>

          <div className={styles.searchSummary}>
            <Store size={20} />
            <div>
              <strong>{companies.length} vahvistettua yritystä</strong>
              <span>{totalProducts ? `${totalProducts} tuotetta yrityksiltä` : "Yritysten valikoimat yhdessä paikassa"}</span>
            </div>
          </div>
        </aside>

        <div className={styles.content}>
          <header className={styles.pageHeader}>
            <span className={styles.eyebrow}>MASKINES-YRITYKSET</span>
            <h1>Yritykset</h1>
            <p>Tutustu lähelläsi sijaitseviin yrityksiin ja niiden ajoneuvo-, varaosa- ja tarvikevalikoimiin.</p>
          </header>

          {!hasFilters && locations.length ? (
            <section className={styles.locationSection} aria-labelledby="locations-title">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="locations-title">Yritykset paikkakunnittain</h2>
                  <p>Valitse paikkakunta nähdäksesi alueen yritykset.</p>
                </div>
                <MapPin size={22} />
              </div>
              <div className={styles.locationList}>
                {locations.map((location) => (
                  <Link href={`/liikkeet?sijainti=${encodeURIComponent(location.city)}`} key={location.city}>
                    <span className={styles.locationName}>{location.city}</span>
                    <span className={styles.companyCount}>{location.companyCount} {location.companyCount === 1 ? "yritys" : "yritystä"}</span>
                    <span className={styles.productCount}>{location.productCount} {location.productCount === 1 ? "tuote" : "tuotetta"}<ArrowRight size={16} /></span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.results} aria-labelledby="results-title">
            <div className={styles.resultsHeading}>
              <div>
                <h2 id="results-title">{hasFilters ? "Hakutulokset" : "Kaikki yritykset"}</h2>
                <p>{filteredCompanies.length} {filteredCompanies.length === 1 ? "yritys löytyi" : "yritystä löytyi"}</p>
              </div>
            </div>

            {filteredCompanies.length ? (
              <div className={styles.companyList}>
                {filteredCompanies.map((company) => {
                  const count = totalItemCounts.get(company.id) ?? 0;
                  return (
                    <Link href={profilePath(company.owner_user_id, company.name, "fi")} className={styles.card} key={company.id}>
                      <div className={styles.companyIcon}>
                        <Store size={23} aria-hidden="true" />
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.companyTitle}>
                          <h3>{company.name}</h3>
                          <span className={styles.verified}><ShieldCheck size={14} /> Vahvistettu</span>
                        </div>
                        <p>{company.storefront_headline || company.description || "Tutustu yrityksen tuotteisiin ja valikoimaan."}</p>
                        <span className={styles.location}><MapPin size={14} /> {[company.postal_code, formatPlaceName(company.city ?? "")].filter(Boolean).join(" ") || "Sijainti ei ilmoitettu"}</span>
                      </div>
                      <div className={styles.cardMeta}>
                        <span><Package size={16} /> {count} {count === 1 ? "tuote" : "tuotetta"}</span>
                        <strong>Avaa yritys <ArrowRight size={17} /></strong>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className={styles.empty}>
                <Store size={34} />
                <h3>Yrityksiä ei löytynyt</h3>
                <p>Kokeile toista yrityksen nimeä tai paikkakuntaa.</p>
                {hasFilters ? <Link href="/liikkeet">Näytä kaikki yritykset</Link> : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
