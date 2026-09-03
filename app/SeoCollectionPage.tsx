import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import Link from "@/app/components/LocalizedLink";
import OptimizedListingImage from "@/app/components/OptimizedListingImage";
import CollectionPrice from "@/app/components/CollectionPrice";
import styles from "@/app/components/SeoCollection.module.css";
import { collectionIndexing, findSeoCollection } from "@/lib/seo-collection-policy";
import { collectionData } from "@/lib/server-seo-collections";
import { formatSeoSearchLabel, localizeSeoSearchQuery, seoLocalizedCollectionDescriptorPath, seoLocalizedCollectionRoot, type SeoCollectionKind, type SeoSearchLocale } from "@/lib/seo-search";
import { listingPath } from "@/lib/routes";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { absoluteSiteUrl } from "@/lib/site-url";
import { glossaryTitle } from "@/lib/part-glossary";

const copy = {
  fi: { home: "Etusivu", parts: "Varaosat", vehicles: "Ajoneuvot", sale: "myynnissä", count: "ilmoitusta", intro: "Vertaa ilmoitusten kuvia, hintoja ja sijainteja. Tarkista sopivuus ja kunto ilmoituksesta tai myyjältä ennen ostamista.", refine: "Rajaa hakua", all: "Näytä koko osasto", related: "Samankaltaiset haut" },
  en: { home: "Home", parts: "Spare parts", vehicles: "Vehicles", sale: "for sale", count: "listings", intro: "Compare listing photos, prices and locations. Check compatibility and condition in the listing or with the seller before buying.", refine: "Refine search", all: "View entire category", related: "Related searches" },
  sv: { home: "Hem", parts: "Reservdelar", vehicles: "Fordon", sale: "till salu", count: "annonser", intro: "Jämför bilder, priser och platser. Kontrollera passform och skick i annonsen eller med säljaren före köp.", refine: "Förfina sökningen", all: "Visa hela kategorin", related: "Relaterade sökningar" },
  no: { home: "Hjem", parts: "Reservedeler", vehicles: "Kjøretøy", sale: "til salgs", count: "annonser", intro: "Sammenlign bilder, priser og steder. Kontroller kompatibilitet og tilstand i annonsen eller med selgeren før kjøp.", refine: "Avgrens søket", all: "Vis hele kategorien", related: "Relaterte søk" }
};

export async function seoCollectionMetadata(segments: string[], kind: SeoCollectionKind, locale: SeoSearchLocale): Promise<Metadata> {
  const { catalog, entry } = await collectionData(segments, kind, locale);
  const t = copy[locale];
  const label = formatSeoSearchLabel(localizeSeoSearchQuery(entry.query, locale));
  const title = `${label} – ${t[kind]} ${t.sale} | Maskines`;
  const description = `${label}: ${entry.matches.length} ${t.count}. ${t.intro}`;
  const policy = collectionIndexing(entry, catalog, locale);
  const canonical = absoluteSiteUrl(policy.canonicalPath);
  return {
    title: { absolute: title }, description,
    robots: { index: policy.index, follow: true },
    alternates: { canonical, languages: policy.languages ? Object.fromEntries(Object.entries(policy.languages).map(([language, path]) => [language, absoluteSiteUrl(path)])) : {} },
    openGraph: { type: "website", siteName: "Maskines", title, description, url: canonical, locale: { fi: "fi_FI", en: "en_GB", sv: "sv_SE", no: "nb_NO" }[locale] }
  };
}

export default async function SeoCollectionPage({ segments, kind, locale }: { segments: string[]; kind: SeoCollectionKind; locale: SeoSearchLocale }) {
  const { catalog, entry, path } = await collectionData(segments, kind, locale);
  const ownPath = seoLocalizedCollectionDescriptorPath(kind, entry.path, locale);
  if (path !== ownPath) permanentRedirect(ownPath);
  const t = copy[locale];
  const label = formatSeoSearchLabel(localizeSeoSearchQuery(entry.query, locale));
  const title = `${label} – ${t[kind]} ${t.sale}`;
  const home = locale === "fi" ? "/" : `/${locale}`;
  const root = seoLocalizedCollectionRoot(kind, locale);
  const matches = [...entry.matches].sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const searchHref = `${home}?q=${encodeURIComponent(entry.query)}&market=${kind}`;
  const related = catalog.filter(row => row.indexable && row.kind === kind && row.path !== entry.path &&
    findSeoCollection(catalog, seoLocalizedCollectionDescriptorPath(kind,row.path,locale), locale)?.path === row.path &&
    row.matches.some(item => matches.some(match => match.id === item.id))).slice(0, 8);
  const structured = {
    "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: title, url: absoluteSiteUrl(ownPath), inLanguage: locale === "no" ? "nb" : locale,
        mainEntity: { "@type": "ItemList", numberOfItems: matches.length, itemListElement: matches.map((listing,index) => ({
          "@type": "ListItem", position:index+1, name:getLocalizedListingText(listing,locale).title, url:absoluteSiteUrl(listingPath(listing,locale))
        })) } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type":"ListItem", position:1, name:t.home, item:absoluteSiteUrl(home) },
        { "@type":"ListItem", position:2, name:t[kind], item:absoluteSiteUrl(root) },
        { "@type":"ListItem", position:3, name:label, item:absoluteSiteUrl(ownPath) }
      ] }
    ]
  };
  return <main className={styles.page} data-seo-collection={entry.path} data-collection-search-href={searchHref}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html:JSON.stringify(structured).replace(/</g,"\\u003c") }} />
    <nav className={styles.breadcrumb} aria-label={{ fi:"Murupolku", en:"Breadcrumb", sv:"Brödsmulor", no:"Brødsmuler" }[locale]}><Link href={home}>{t.home}</Link><span aria-hidden="true">/</span><Link href={root}>{t[kind]}</Link><span aria-hidden="true">/</span><span aria-current="page">{label}</span></nav>
    <h1 className={styles.heading}>{title}</h1>
    <p className={styles.count}>{matches.length} {t.count}</p>
    <p className={styles.intro}>{t.intro}</p>
    <div className={styles.actions}><Link href={searchHref}>{t.refine}</Link><Link href={root}>{t.all}</Link></div>
    <ul className={styles.grid}>
      {matches.map((listing,index) => {
        const text = getLocalizedListingText(listing, locale);
        return <li key={listing.id}><Link href={listingPath(listing,locale)} className={styles.card}>
          <OptimizedListingImage src={listing.image_url} alt={text.title} className={styles.image} priority={index < 2} sizes="(max-width: 640px) 47vw, (max-width: 960px) 31vw, 280px" />
          <div className={styles.body}><span className={styles.meta}>{[listing.brand,listing.model,listing.year].filter(Boolean).join(" · ")}</span><h2 className={styles.title}>{text.title}</h2>
            {kind === "parts" && <span className={styles.meta}>{[
              glossaryTitle(listing.subcategory?.split("/").at(-1)?.trim() || listing.category || "", locale),
              listing.part_model
            ].filter(Boolean).join(" · ")}</span>}
            <CollectionPrice listing={{ price:listing.price, translations:listing.translations }} />
            <span className={styles.location}>{listing.location}</span>
          </div>
        </Link></li>;
      })}
    </ul>
    {related.length > 0 && <section className={styles.related}><h2>{t.related}</h2><ul>{related.map(row => <li key={row.path}><Link href={seoLocalizedCollectionDescriptorPath(kind,row.path,locale)}>{formatSeoSearchLabel(localizeSeoSearchQuery(row.query,locale))} ({row.matches.length})</Link></li>)}</ul></section>}
  </main>;
}
