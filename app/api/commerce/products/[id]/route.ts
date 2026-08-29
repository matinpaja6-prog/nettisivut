import { NextResponse } from "next/server";

import { cleanProductBody } from "@/lib/commerce/product-input";
import type { Company, Product } from "@/lib/commerce/types";
import { productPublicationErrors } from "@/lib/commerce/validation";
import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";
import { commerceSetupErrors } from "@/lib/commerce/publication-readiness";

function missingModernProductColumn(error: unknown) {
  const record = error as { code?: string; message?: string } | null;
  return /seller_target_price_cents|storefront_category|shipping_price_fi_cents|shipping_price_se_cents/i.test(record?.message ?? "");
}

function missingNorwayShippingColumn(error: unknown) {
  const record = error as { message?: string } | null;
  return /shipping_price_no_cents/i.test(record?.message ?? "");
}

async function ownedProduct(request: Request, id: string) {
  const { admin, user } = await requireCommerceUser(request);
  const company = await getOwnedCompany(user) as Company | null;
  if (!company) throw new Error("Yritysprofiilia ei löytynyt.");
  const { data, error } = await admin
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle<Product>();
  if (error) throw error;
  if (!data) throw new Error("Tuotetta ei löytynyt.");
  return { admin, company, product: data };
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, company } = await ownedProduct(request, id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const next = cleanProductBody(body, company);
    if (!next.name) return NextResponse.json({ error: "Tuotteen nimi puuttuu." }, { status: 400 });
    if (next.active) {
      const errors = [...productPublicationErrors(next, company), ...await commerceSetupErrors(admin, company, next)];
      if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }
    let { data, error } = await admin
      .from("products")
      .update(next)
      .eq("id", id)
      .eq("company_id", company.id)
      .select("*")
      .single<Product>();
    if (error && missingNorwayShippingColumn(error)) {
      const compatibleNext = { ...next } as Record<string, unknown>;
      delete compatibleNext.shipping_price_no_cents;
      const compatibleResult = await admin.from("products").update(compatibleNext).eq("id", id).eq("company_id", company.id).select("*").single<Product>();
      data = compatibleResult.data;
      error = compatibleResult.error;
    }
    if (error && missingModernProductColumn(error)) {
      const legacyNext = { ...next } as Record<string, unknown>;
      delete legacyNext.seller_target_price_cents;
      delete legacyNext.storefront_category;
      delete legacyNext.shipping_price_fi_cents;
      delete legacyNext.shipping_price_se_cents;
      const legacyResult = await admin
        .from("products")
        .update(legacyNext)
        .eq("id", id)
        .eq("company_id", company.id)
        .select("*")
        .single<Product>();
      data = legacyResult.data;
      error = legacyResult.error;
    }
    if (error) throw error;
    return NextResponse.json({ product: data });
  } catch (error) {
    return errorResponse(error, "Tuotteen päivittäminen epäonnistui.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { admin, company, product } = await ownedProduct(request, id);
    const { count, error: orderError } = await admin
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);
    if (orderError) throw orderError;
    if ((count ?? 0) > 0) {
      const { data, error } = await admin
        .from("products")
        .update({ active: false })
        .eq("id", product.id)
        .eq("company_id", company.id)
        .select("*")
        .single<Product>();
      if (error) throw error;
      return NextResponse.json({ product: data, archived: true });
    }
    const { error } = await admin.from("products").delete().eq("id", id).eq("company_id", company.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Tuotteen poistaminen epäonnistui.");
  }
}
