import { NextResponse } from "next/server";

import { cleanProductBody } from "@/lib/commerce/product-input";
import type { Company, Product } from "@/lib/commerce/types";
import { productPublicationErrors } from "@/lib/commerce/validation";
import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";
import { commerceSetupErrors } from "@/lib/commerce/publication-readiness";
import { LEGACY_ZERO_VAT_RATE, normalizedVatRate, ZERO_VAT_RATE } from "@/lib/commerce/vat";

function missingModernProductColumn(error: unknown) {
  const record = error as { code?: string; message?: string } | null;
  return /seller_target_price_cents|storefront_category|shipping_price_fi_cents|shipping_price_se_cents/i.test(record?.message ?? "");
}

function missingNorwayShippingColumn(error: unknown) {
  const record = error as { message?: string } | null;
  return /shipping_price_no_cents/i.test(record?.message ?? "");
}

function oldVatRateConstraint(error: unknown) {
  const record = error as { message?: string } | null;
  return /products_vat_rate_check/i.test(record?.message ?? "");
}

function normalizedProduct(product: Product) {
  return { ...product, vat_rate: normalizedVatRate(product.vat_rate) };
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
    const compatibleNext = { ...next } as Record<string, unknown>;
    let data: Product | null = null;
    let error: unknown = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await admin
        .from("products")
        .update(compatibleNext)
        .eq("id", id)
        .eq("company_id", company.id)
        .select("*")
        .single<Product>();
      data = result.data;
      error = result.error;
      if (!error) break;
      if (compatibleNext.vat_rate === ZERO_VAT_RATE && oldVatRateConstraint(error)) {
        compatibleNext.vat_rate = LEGACY_ZERO_VAT_RATE;
        continue;
      }
      if (missingNorwayShippingColumn(error)) {
        delete compatibleNext.shipping_price_no_cents;
        continue;
      }
      if (missingModernProductColumn(error)) {
        delete compatibleNext.seller_target_price_cents;
        delete compatibleNext.storefront_category;
        delete compatibleNext.shipping_price_fi_cents;
        delete compatibleNext.shipping_price_se_cents;
        continue;
      }
      break;
    }
    if (error) throw error;
    return NextResponse.json({ product: normalizedProduct(data!) });
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
