import Link from "next/link";

import type { Listing } from "@/lib/listings";
import {
  buildSeoCollectionLinks,
  formatSeoSearchLabel,
  normalizeSeoSearchText,
  type SeoCollectionKind
} from "@/lib/seo-search";

import styles from "./SeoCollectionIntro.module.css";

function relatedCollectionLinks(
  listings: Listing[],
  query: string,
  kind: SeoCollectionKind
) {
  const normalizedQuery = normalizeSeoSearchText(query);
  const queryWords = new Set(normalizedQuery.split(" ").filter(Boolean));

  return buildSeoCollectionLinks(listings)
    .filter((link) => {
      if (link.kind !== kind || normalizeSeoSearchText(link.query) === normalizedQuery) {
        return false;
      }
      const candidate = normalizeSeoSearchText(link.query);
      if (candidate.startsWith(`${normalizedQuery} `) || normalizedQuery.startsWith(`${candidate} `)) {
        return true;
      }
      const sharedWords = candidate.split(" ").filter((word) => queryWords.has(word));
      return sharedWords.length >= Math.min(2, queryWords.size);
    })
    .slice(0, 12);
}

export default function SeoCollectionIntro({
  listings,
  matches,
  query,
  kind
}: {
  listings: Listing[];
  matches: Listing[];
  query: string;
  kind: SeoCollectionKind;
}) {
  const label = formatSeoSearchLabel(query);
  const relatedLinks = relatedCollectionLinks(listings, query, kind);
  const subject = kind === "vehicles" ? "ajoneuvot" : "varaosat";

  return (
    <section className={styles.section} aria-labelledby="seo-collection-title">
      <h1 id="seo-collection-title">{label} {subject} myynnissä</h1>
      <p>
        Löydä {label} {subject} Maskinesista. Vertaa {matches.length} aktiivista ilmoitusta,
        hintoja, kuvia ja myyjiä samassa haussa.
      </p>
      {relatedLinks.length > 0 && (
        <nav className={styles.links} aria-label={`Aiheeseen ${label} liittyvät haut`}>
          {relatedLinks.map((link) => (
            <Link key={link.path} href={link.path}>
              {formatSeoSearchLabel(link.query)} ({link.count})
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
