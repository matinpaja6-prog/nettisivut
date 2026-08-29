import { absoluteSiteUrl } from "@/lib/site-url";

// Keep a standard sitemap index at a stable public URL. The current
// marketplace fits comfortably in one child sitemap; when the catalogue grows
// beyond the per-sitemap limit, more child sitemaps can be added here without
// changing the URL submitted to Google Search Console.
export function GET() {
  const sitemapUrl = absoluteSiteUrl("/sitemap.xml");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${sitemapUrl}</loc>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600"
    }
  });
}
