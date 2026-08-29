import { NextResponse } from "next/server";

import type { Company, Product } from "@/lib/commerce/types";
import { productPublicationErrors } from "@/lib/commerce/validation";
import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";
import { cleanProductBody } from "@/lib/commerce/product-input";
import { commerceSetupErrors } from "@/lib/commerce/publication-readiness";

function missingModernProductColumn(error: unknown) {
  const record = error as { code?: string; message?: string } | null;
  return /seller_target_price_cents|storefront_category|shipping_price_fi_cents|shipping_price_se_cents/i.test(record?.message ?? "");
}

function missingNorwayShippingColumn(error: unknown) {
  const record = error as { message?: string } | null;
  return /shipping_price_no_cents/i.test(record?.message ?? "");
}

export async function GET(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) return NextResponse.json({ products: [] });
    const { data, error } = await admin
      .from("products")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .returns<Product[]>();
    if (error) throw error;
    return NextResponse.json({ products: data ?? [] });
  } catch (error) {
    return errorResponse(error, "Tuotteiden lataaminen epäonnistui.");
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user) as Company | null;
    if (!company) {
      return NextResponse.json({ error: "Täytä yritysprofiili ensin." }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const product = cleanProductBody(body, company);
    if (!product.name) {
      return NextResponse.json({ error: "Tuotteen nimi puuttuu." }, { status: 400 });
    }
    if (product.active) {
      const errors = [...productPublicationErrors(product, company), ...await commerceSetupErrors(admin, company, product)];
      if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    let { data, error } = await admin
      .from("products")
      .insert({ ...product, company_id: company.id })
      .select("*")
      .single<Product>();
    if (error && missingNorwayShippingColumn(error)) {
      const compatibleProduct = { ...product } as Record<string, unknown>;
      delete compatibleProduct.shipping_price_no_cents;
      const compatibleResult = await admin.from("products").insert({ ...compatibleProduct, company_id: company.id }).select("*").single<Product>();
      data = compatibleResult.data;
      error = compatibleResult.error;
    }
    if (error && missingModernProductColumn(error)) {
      const legacyProduct = { ...product } as Record<string, unknown>;
      delete legacyProduct.seller_target_price_cents;
      delete legacyProduct.storefront_category;
      delete legacyProduct.shipping_price_fi_cents;
      delete legacyProduct.shipping_price_se_cents;
      const legacyResult = await admin
        .from("products")
        .insert({ ...legacyProduct, company_id: company.id })
        .select("*")
        .single<Product>();
      data = legacyResult.data;
      error = legacyResult.error;
    }
    if (error) throw error;
    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Tuotteen tallentaminen epäonnistui.");
  }
}
