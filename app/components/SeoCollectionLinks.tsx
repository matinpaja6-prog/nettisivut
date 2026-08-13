import Link from "next/link";

import type { Listing } from "@/lib/listings";
import { buildSeoCollectionLinks, formatSeoSearchLabel } from "@/lib/seo-search";

export default function SeoCollectionLinks({ listings }: { listings: Listing[] }) {
  const collections = buildSeoCollectionLinks(listings).slice(0, 48);
  if (collections.length === 0) return null;

  return (
    <nav
      aria-labelledby="seo-collections-heading"
      style={{ maxWidth: 1180, margin: "32px auto", padding: "0 20px" }}
    >
      <h2 id="seo-collections-heading" style={{ margin: "0 0 14px" }}>
        Selaa ajoneuvoja ja varaosia mallin mukaan
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {collections.map((collection) => (
          <Link
            key={`${collection.kind}:${collection.path}`}
            href={collection.path}
            style={{
              border: "1px solid var(--border, #d0d5dd)",
              borderRadius: 999,
              padding: "8px 12px",
              color: "inherit",
              textDecoration: "none"
            }}
          >
            {formatSeoSearchLabel(collection.query)}{" "}
            {collection.kind === "vehicles" ? "ajoneuvot" : "varaosat"} ({collection.count})
          </Link>
        ))}
      </div>
    </nav>
  );
}
