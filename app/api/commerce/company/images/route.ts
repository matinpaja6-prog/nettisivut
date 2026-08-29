import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"]
]);

function imageLimitBytes(kind: "banner" | "share" | "promo") {
  return (kind === "promo" ? 50 : 10) * 1024 * 1024;
}

function invalidImageResponse(kind: "banner" | "share" | "promo") {
  const maxSizeMb = kind === "promo" ? 50 : 10;
  return NextResponse.json({ error: `Kuvan pitää olla JPG-, PNG-, WebP- tai AVIF-tiedosto ja enintään ${maxSizeMb} Mt.` }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) return NextResponse.json({ error: "Yritysprofiilia ei löytynyt." }, { status: 404 });

    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json();
      const kind = body.kind === "share" || body.kind === "promo" ? body.kind : "banner";
      const extension = ALLOWED.get(body.type);
      if (!extension || !Number.isFinite(body.size) || body.size <= 0 || body.size > imageLimitBytes(kind)) {
        return invalidImageResponse(kind);
      }

      const path = `${user.id}/storefront/${kind}-${randomUUID()}.${extension}`;
      const bucket = admin.storage.from("product-images");
      const { data: signedUpload, error: signedUploadError } = await bucket.createSignedUploadUrl(path);
      if (signedUploadError) throw signedUploadError;
      const { data: publicUrl } = bucket.getPublicUrl(path);
      return NextResponse.json({
        path,
        token: signedUpload.token,
        url: publicUrl.publicUrl,
        kind
      });
    }

    const form = await request.formData();
    const file = form.get("image");
    const requestedKind = form.get("kind");
    const kind = requestedKind === "share" || requestedKind === "promo" ? requestedKind : "banner";
    if (!(file instanceof File)) return NextResponse.json({ error: "Valitse kuva." }, { status: 400 });
    const extension = ALLOWED.get(file.type);
    if (!extension || file.size <= 0 || file.size > imageLimitBytes(kind)) {
      return invalidImageResponse(kind);
    }

    const path = `${user.id}/storefront/${kind}-${randomUUID()}.${extension}`;
    const { error } = await admin.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false
    });
    if (error) throw error;
    const { data } = admin.storage.from("product-images").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, kind });
  } catch (error) {
    return errorResponse(error, "Yrityskuvan lataaminen epäonnistui.");
  }
}
