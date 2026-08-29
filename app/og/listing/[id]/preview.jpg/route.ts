import sharp from "sharp";

import { absoluteSiteUrl } from "@/lib/site-url";
import { getListingById } from "@/lib/supabase";

export const runtime = "nodejs";

function cleanImageUrl(value?: string | null) {
  return String(value ?? "").trim();
}

function firstListingImage(listing: {
  image_url?: string | null;
  image_urls?: string[] | null;
}) {
  const candidate =
    listing.image_urls?.find((url) => cleanImageUrl(url)) ||
    cleanImageUrl(listing.image_url);

  if (!candidate) return null;

  try {
    const url = new URL(candidate, absoluteSiteUrl("/"));
    const allowedOrigins = new Set([new URL(absoluteSiteUrl("/")).origin]);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (supabaseUrl) allowedOrigins.add(new URL(supabaseUrl).origin);

    return url.protocol === "https:" && allowedOrigins.has(url.origin)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function logoFallback() {
  return Response.redirect(absoluteSiteUrl("/maskines-brand-share-v2.png"), 307);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { data: listing } = await getListingById(decodeURIComponent(id));

  if (!listing || listing.is_hidden || listing.is_sold) return logoFallback();

  const sourceUrl = firstListingImage(listing);
  if (!sourceUrl) return logoFallback();

  try {
    const sourceResponse = await fetch(sourceUrl, { cache: "force-cache" });
    if (!sourceResponse.ok) return logoFallback();

    const source = Buffer.from(await sourceResponse.arrayBuffer());
    const image = await sharp(source)
      .rotate()
      .resize(1200, 630, {
        fit: "contain",
        background: "#071321"
      })
      .jpeg({
        quality: 78,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();

    return new Response(new Uint8Array(image), {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "Content-Length": String(image.byteLength),
        "Content-Type": "image/jpeg"
      }
    });
  } catch {
    return logoFallback();
  }
}
