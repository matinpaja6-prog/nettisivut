import Link from "@/app/components/LocalizedLink";
import { getSeoCollectionCatalog } from "@/lib/server-seo-collections";
import { findSeoCollection } from "@/lib/seo-collection-policy";
import { formatSeoSearchLabel, localizeSeoSearchQuery, seoLocalizedCollectionDescriptorPath,
  type SeoCollectionKind, type SeoSearchLocale } from "@/lib/seo-search";
import styles from "./SeoCollection.module.css";

const headings = {
  fi: { parts: "Selaa varaosia merkin, mallin ja osan mukaan", vehicles: "Selaa ajoneuvoja merkin ja mallin mukaan" },
  en: { parts: "Browse parts by make, model and part type", vehicles: "Browse vehicles by make and model" },
  sv: { parts: "Bläddra bland delar efter märke, modell och deltyp", vehicles: "Bläddra bland fordon efter märke och modell" },
  no: { parts: "Bla gjennom deler etter merke, modell og deltype", vehicles: "Bla gjennom kjøretøy etter merke og modell" }
};

// Real server-rendered links expose the published catalogue to visitors and
// crawlers without requiring them to submit the marketplace search form.
export default async function SeoCollectionDirectory({ kind, locale }: {
  kind: SeoCollectionKind; locale: SeoSearchLocale;
}) {
  const catalog = await getSeoCollectionCatalog();
  const entries = catalog.filter(entry => entry.kind === kind && entry.indexable)
    .map(entry => ({ entry, path: seoLocalizedCollectionDescriptorPath(kind, entry.path, locale),
      label: formatSeoSearchLabel(localizeSeoSearchQuery(entry.query, locale)) }))
    .filter(({ entry, path }) => findSeoCollection(catalog, path, locale)?.path === entry.path)
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  if (!entries.length) return null;
  return <nav className={styles.directory} aria-label={headings[locale][kind]} data-seo-directory={kind}>
    <h2>{headings[locale][kind]}</h2>
    <ul>{entries.map(({ entry, path, label }) => <li key={path}>
      <Link href={path}>{label} <span>({entry.matches.length})</span></Link>
    </li>)}</ul>
  </nav>;
}
