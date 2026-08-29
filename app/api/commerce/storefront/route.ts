import { NextResponse } from "next/server";

import { getPublicStorefront } from "@/lib/commerce/public-storefront";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sellerId = new URL(request.url).searchParams.get("seller_id")?.trim() ?? "";
  if (!sellerId) return NextResponse.json({ storefront: null });

  try {
    return NextResponse.json({ storefront: await getPublicStorefront(sellerId) });
  } catch (error) {
    console.error("Public storefront load failed", error);
    return NextResponse.json({ storefront: null });
  }
}
