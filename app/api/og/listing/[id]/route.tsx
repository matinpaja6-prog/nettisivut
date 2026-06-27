import { ImageResponse } from "next/og";

import { formatPrice } from "@/lib/listings";
import { listingNumberUrlId, listingPath } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getListingById, getListingDisplayNumber } from "@/lib/supabase";

const imageSize = {
  width: 1200,
  height: 630
};

function cleanText(value?: string | null, fallback = "") {
  return String(value ?? fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function firstListingImage(listing: {
  image_url?: string | null;
  image_urls?: string[] | null;
}) {
  return (
    listing.image_urls?.find((url) => cleanText(url)) ||
    cleanText(listing.image_url) ||
    absoluteSiteUrl("/maskines-share-logo.png")
  );
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}...` : value;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const decodedId = decodeURIComponent(id);
  const { data: listing } = await getListingById(decodedId);

  if (!listing) {
    return new ImageResponse(
      (
        <div
          style={{
            alignItems: "center",
            background: "#06111f",
            color: "#f8fafc",
            display: "flex",
            fontSize: 58,
            fontWeight: 900,
            height: "100%",
            justifyContent: "center",
            width: "100%"
          }}
        >
          Maskines
        </div>
      ),
      imageSize
    );
  }

  const displayNumber = await getListingDisplayNumber(listing.created_at, listing.listing_number);
  const urlId = listingNumberUrlId(displayNumber) || listing.id;
  const title = cleanText(listing.title, "Ilmoitus");
  const price = formatPrice(Number(listing.price) || 0);
  const vehicle = [listing.brand, listing.model, listing.year]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .join(" ");
  const location = cleanText(listing.location);
  const description = truncate(cleanText(listing.description), 140);
  const imageUrl = firstListingImage(listing);
  const publicUrl = absoluteSiteUrl(listingPath(urlId));

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #03101e 0%, #071827 55%, #0b2236 100%)",
          color: "#f8fafc",
          display: "flex",
          height: "100%",
          padding: 40,
          position: "relative",
          width: "100%"
        }}
      >
        <div
          style={{
            background: "rgba(255, 122, 26, 0.95)",
            height: 8,
            left: 0,
            position: "absolute",
            top: 0,
            width: "100%"
          }}
        />
        <div
          style={{
            border: "1px solid rgba(226, 232, 240, 0.22)",
            borderRadius: 28,
            display: "flex",
            height: 550,
            overflow: "hidden",
            position: "relative",
            width: 680
          }}
        >
          <img
            src={imageUrl}
            style={{
              filter: "blur(18px) brightness(0.55) saturate(1.12)",
              height: "112%",
              left: "-6%",
              objectFit: "cover",
              position: "absolute",
              top: "-6%",
              width: "112%"
            }}
          />
          <div
            style={{
              background: "rgba(3, 12, 24, 0.34)",
              display: "flex",
              height: "100%",
              padding: 18,
              position: "relative",
              width: "100%"
            }}
          >
            <img
              src={imageUrl}
              style={{
                borderRadius: 18,
                height: "100%",
                objectFit: "contain",
                width: "100%"
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            justifyContent: "center",
            paddingLeft: 36,
            width: 420
          }}
        >
          <div style={{ color: "#ff9824", fontSize: 30, fontWeight: 950 }}>
            Maskines
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: 38,
              fontWeight: 950,
              lineHeight: 1.04,
              maxHeight: 122,
              overflow: "hidden"
            }}
          >
            {truncate(title, 48)}
          </div>
          <div
            style={{
              color: "#ffb45f",
              fontSize: 44,
              fontWeight: 950,
              lineHeight: 1
            }}
          >
            {price}
          </div>
          <div
            style={{
              color: "#cbd5e1",
              display: "flex",
              flexDirection: "column",
              fontSize: 25,
              fontWeight: 800,
              gap: 9,
              lineHeight: 1.16
            }}
          >
            {vehicle ? <div>{truncate(vehicle, 46)}</div> : null}
            {location ? <div>{truncate(location, 46)}</div> : null}
          </div>
          {description ? (
            <div
              style={{
                color: "#e2e8f0",
                fontSize: 23,
                fontWeight: 700,
                lineHeight: 1.22
              }}
            >
              {description}
            </div>
          ) : null}
          <div
            style={{
              color: "#94a3b8",
              fontSize: 21,
              fontWeight: 800,
              marginTop: 8
            }}
          >
            {publicUrl.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>
    ),
    imageSize
  );
}
