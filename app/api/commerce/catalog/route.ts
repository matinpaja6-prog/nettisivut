import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isStripeReady } from "@/lib/commerce/validation";

export const dynamic = "force-dynamic";

type PublicCompanyRecord = Record<string, unknown>;

function publicCompany(company: PublicCompanyRecord) {
  return {
    id: company.id,
    owner_user_id: company.owner_user_id,
    name: company.name,
    business_id: company.business_id,
    address_line: "",
    postal_code: "",
    city: "",
    country: "",
    email: company.email,
    phone: company.phone,
    shipping_price_strategy: company.shipping_price_strategy,
    posti_enabled: company.posti_enabled !== false,
    shipping_countries: Array.isArray(company.shipping_countries) ? company.shipping_countries : ["FI"],
    free_shipping_threshold_cents: company.free_shipping_threshold_cents
  };
}

function publicProduct(product: Record<string, unknown>, company: PublicCompanyRecord) {
  return { ...product, company: publicCompany(company) };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 48));
    const sellerId = url.searchParams.get("seller_id")?.trim() ?? "";
    const listingId = url.searchParams.get("listing_id")?.trim() ?? "";
    const admin = getSupabaseAdmin();

    // Older ordinary listings were published before an explicit commerce-product
    // reference was saved in their translations metadata. Resolve those safely by
    // the owning company, exact title and exact price. The closest creation time
    // wins if the company has published two otherwise identical products.
    if (listingId) {
      const { data: listing, error: listingError } = await admin
        .from("listings")
        .select("id,seller_id,title,price,created_at,is_hidden,is_sold,image_url")
        .eq("id", listingId)
        .maybeSingle<{
          id: string;
          seller_id: string | null;
          title: string;
          price: number;
          created_at: string;
          is_hidden: boolean | null;
          is_sold: boolean | null;
          image_url: string | null;
        }>();
      if (listingError) throw listingError;
      if (!listing || !listing.seller_id || listing.is_hidden || listing.is_sold) {
        return NextResponse.json({ product: null });
      }

      const { data: company, error: companyError } = await admin
        .from("companies")
        .select("*")
        .eq("owner_user_id", listing.seller_id)
        .maybeSingle<PublicCompanyRecord>();
      if (companyError) throw companyError;
      if (!company || company.verification_status !== "approved" || !isStripeReady(company)) {
        return NextResponse.json({ product: null });
      }

      const { data: matches, error: productsError } = await admin
        .from("products")
        .select("*")
        .eq("company_id", String(company.id))
        .eq("active", true)
        .gt("stock_quantity", 0)
        .eq("name", listing.title)
        .limit(20);
      if (productsError) throw productsError;

      const listingImages = new Set(
        [listing.image_url]
          .filter((image): image is string => typeof image === "string" && image.trim().length > 0)
      );
      const matchingProducts = (matches ?? []).filter((candidate: Record<string, unknown>) => {
        const exactPrice = Number(candidate.price_cents) === Math.round(Number(listing.price) * 100);
        const productImages = Array.isArray(candidate.image_urls)
          ? candidate.image_urls.filter((image): image is string => typeof image === "string")
          : [];
        return exactPrice || productImages.some((image) => listingImages.has(image));
      });
      const listingTime = new Date(listing.created_at).getTime();
      const product = matchingProducts.sort((left, right) => (
        Math.abs(new Date(String(left.created_at)).getTime() - listingTime) -
        Math.abs(new Date(String(right.created_at)).getTime() - listingTime)
      ))[0] as Record<string, unknown> | undefined;

      return NextResponse.json({
        product: product ? publicProduct(product, company) : null
      });
    }

    let query = admin
      .from("products")
      .select("*,company:companies!inner(*)")
      .eq("active", true)
      .gt("stock_quantity", 0)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (sellerId) query = query.eq("company.owner_user_id", sellerId);
    const { data, error } = await query;
    if (error) throw error;
    const products = (data ?? []).filter((product: Record<string, unknown>) => {
      const company = product.company as Record<string, unknown> | null;
      return company?.verification_status === "approved" && isStripeReady(company);
    }).map((product: Record<string, unknown>) => {
      const company = product.company as Record<string, unknown>;
      return publicProduct(product, company);
    });
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Commerce catalog failed", error);
    return NextResponse.json({ error: "Tuotteiden lataaminen epäonnistui." }, { status: 500 });
  }
}
