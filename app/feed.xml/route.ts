import { listingPath, listingUrlId } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListings } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function validDate(value?: string | null) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  const { data } = await getListings({
    includeOptionalFields: false,
    enrichSellerProfiles: false
  });
  const listings = data
    .filter((listing) => !listing.is_hidden && !listing.is_sold)
    .sort((left, right) =>
      (validDate(right.created_at)?.getTime() ?? 0) -
      (validDate(left.created_at)?.getTime() ?? 0)
    )
    .slice(0, 100);

  const lastBuildDate = validDate(listings[0]?.created_at) ?? new Date();
  const items = listings.map((listing) => {
    const url = absoluteSiteUrl(listingPath(listing));
    const publishedAt = validDate(listing.created_at) ?? lastBuildDate;
    const vehicle = [listing.brand, listing.model, listing.year].filter(Boolean).join(" ");
    const description = [
      vehicle,
      listing.category,
      listing.subcategory,
      listing.description
    ].filter(Boolean).join(" – ").slice(0, 1_000);

    return `
    <item>
      <title>${escapeXml(listing.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${publishedAt.toUTCString()}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Maskines – uusimmat ilmoitukset</title>
    <link>${escapeXml(absoluteSiteUrl("/"))}</link>
    <description>Pohjoismaisen Maskines-markkinapaikan uusimmat aktiiviset ajoneuvo- ja varaosailmoitukset.</description>
    <language>fi-FI</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(absoluteSiteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "X-Robots-Tag": "noindex, follow"
    }
  });
}
