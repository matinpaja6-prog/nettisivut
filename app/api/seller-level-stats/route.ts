import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sellerIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sellerId = new URL(request.url).searchParams.get("sellerId")?.trim() ?? "";

  if (!sellerIdPattern.test(sellerId)) {
    return NextResponse.json({ error: "Virheellinen myyjätunnus." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Tilastopalvelua ei ole määritetty." }, { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const [
    activeResult,
    activeMultiResult,
    soldResult,
    soldMultiResult,
    reviewsGivenResult,
    reviewsReceivedResult,
    profileResult
  ] = await Promise.all([
    admin.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", sellerId),
    admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId)
      .eq("listing_mode", "multiple"),
    admin.from("sold_listings").select("id", { count: "exact", head: true }).eq("seller_id", sellerId),
    admin
      .from("sold_listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId)
      .eq("listing_mode", "multiple"),
    admin
      .from("seller_reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_id", sellerId),
    admin
      .from("seller_reviews")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId),
    admin
      .from("profiles")
      .select("phone_verified_at")
      .eq("id", sellerId)
      .maybeSingle<{ phone_verified_at: string | null }>()
  ]);

  const requiredError =
    activeResult.error ??
    soldResult.error ??
    reviewsGivenResult.error ??
    reviewsReceivedResult.error ??
    profileResult.error;

  if (requiredError) {
    console.error("Seller level stats query failed", requiredError);
    return NextResponse.json({ error: "Tilastoja ei voitu hakea." }, { status: 500 });
  }

  const activeCount = activeResult.count ?? 0;
  const soldCount = soldResult.count ?? 0;
  const activeMultiCount = activeMultiResult.error ? 0 : activeMultiResult.count ?? 0;
  const soldMultiCount = soldMultiResult.error ? 0 : soldMultiResult.count ?? 0;
  const multiListingsCreated = activeMultiCount + soldMultiCount;

  return NextResponse.json(
    {
      listings_created: activeCount + soldCount,
      single_listings_created: Math.max(0, activeCount + soldCount - multiListingsCreated),
      multi_listings_created: multiListingsCreated,
      sold_count: soldCount,
      reviews_given: reviewsGivenResult.count ?? 0,
      reviews_received: reviewsReceivedResult.count ?? 0,
      phone_verified: Boolean(profileResult.data?.phone_verified_at)
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
