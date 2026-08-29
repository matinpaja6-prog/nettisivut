import { notFound, redirect } from "next/navigation";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Company } from "@/lib/commerce/types";
import { isStripeReady } from "@/lib/commerce/validation";
import { profilePath } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductRecord = {
  id: string;
  company_id: string;
  name: string;
  price_cents: number;
};

type CompanyRecord = {
  owner_user_id: string;
  name: string;
  verification_status: Company["verification_status"];
  stripe_account_id: string | null;
  stripe_details_submitted: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
};

type ListingRecord = {
  id: string;
};

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = decodeURIComponent(id);
  const admin = getSupabaseAdmin();

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,company_id,name,price_cents")
    .eq("id", productId)
    .eq("active", true)
    .gt("stock_quantity", 0)
    .maybeSingle<ProductRecord>();

  if (productError || !product) notFound();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("owner_user_id,name,verification_status,stripe_account_id,stripe_details_submitted,stripe_charges_enabled,stripe_payouts_enabled")
    .eq("id", product.company_id)
    .maybeSingle<CompanyRecord>();

  if (companyError || !company || company.verification_status !== "approved" || !isStripeReady(company)) {
    notFound();
  }

  const { data: linkedListing } = await admin
    .from("listings")
    .select("id")
    .contains("translations", { _meta: { commerce_product_id: product.id } })
    .or("is_hidden.is.null,is_hidden.eq.false")
    .or("is_sold.is.null,is_sold.eq.false")
    .limit(1)
    .maybeSingle<ListingRecord>();

  if (linkedListing) redirect(`/listing/${encodeURIComponent(linkedListing.id)}`);

  const { data: matchingListing } = await admin
    .from("listings")
    .select("id")
    .eq("seller_id", company.owner_user_id)
    .eq("title", product.name)
    .eq("price", product.price_cents / 100)
    .or("is_hidden.is.null,is_hidden.eq.false")
    .or("is_sold.is.null,is_sold.eq.false")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ListingRecord>();

  if (matchingListing) redirect(`/listing/${encodeURIComponent(matchingListing.id)}`);

  redirect(profilePath(company.owner_user_id, company.name, "fi"));
}
