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
  return new Response(null, {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300, must-revalidate",
      Location: absoluteSiteUrl("/maskines-brand-share-v2.png")
    }
  });
}

function removedImageResponse() {
  return new Response("Ilmoituksen kuva on poistettu.", {
    status: 410,
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300, must-revalidate",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive, noimageindex"
    }
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { data: listing } = await getListingById(decodeURIComponent(id));

  if (!listing || listing.is_hidden || listing.is_sold) {
    return removedImageResponse();
  }

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
        "Cache-Control": "public, max-age=300, s-maxage=300, must-revalidate",
        "Content-Length": String(image.byteLength),
        "Content-Type": "image/jpeg"
      }
    });
  } catch {
    return logoFallback();
  }
}
