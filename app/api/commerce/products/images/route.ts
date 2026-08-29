import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { errorResponse, requireCommerceUser } from "@/lib/commerce/server";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"]
]);

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const form = await request.formData();
    const files = form.getAll("images").filter((item): item is File => item instanceof File).slice(0, 12);
    if (!files.length) return NextResponse.json({ error: "Valitse vähintään yksi kuva." }, { status: 400 });
    if (files.reduce((sum, file) => sum + file.size, 0) > 30 * 1024 * 1024) {
      return NextResponse.json({ error: "Kuvien yhteiskoko saa olla enintään 30 Mt kerralla." }, { status: 400 });
    }

    const urls: string[] = [];
    for (const file of files) {
      const extension = ALLOWED.get(file.type);
      if (!extension || file.size <= 0 || file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Kuvan pitää olla JPG-, PNG-, WebP- tai AVIF-tiedosto ja enintään 10 Mt." }, { status: 400 });
      }
      const path = `${user.id}/${randomUUID()}.${extension}`;
      const { error } = await admin.storage.from("product-images").upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false
      });
      if (error) throw error;
      const { data } = admin.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return NextResponse.json({ urls });
  } catch (error) {
    return errorResponse(error, "Kuvien lataaminen epäonnistui.");
  }
}
