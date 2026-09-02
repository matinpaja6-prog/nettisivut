import type { MetadataRoute } from "next";

/** Every alternate has its own URL entry and the same reciprocal hreflang set. */
export function expandSitemapLanguages(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const result = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of entries) {
    // Translated search slugs can collide. Keep the first group owning a URL,
    // and do not point a later group at an alternate that cannot reciprocate.
    const languages = Object.fromEntries(Object.entries(entry.alternates?.languages || {})
      .filter(([,href]) => typeof href === "string" && !result.has(href)));
    const alternates = Object.entries(languages)
      .filter(([language]) => language !== "x-default")
      .map(([,href]) => href as string);
    for (const url of new Set([entry.url,...alternates])) {
      if (!result.has(url)) result.set(url,{
        ...entry,url,
        ...(entry.alternates ? {alternates:{languages}} : {})
      });
    }
  }
  return [...result.values()];
}
