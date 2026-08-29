import { NextResponse } from "next/server";

import type { Company, Product } from "@/lib/commerce/types";
import { productPublicationErrors } from "@/lib/commerce/validation";
import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";
import { cleanProductBody } from "@/lib/commerce/product-input";
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
    return NextResponse.json({ products: (data ?? []).map(normalizedProduct) });
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

    const compatibleProduct = { ...product, company_id: company.id } as Record<string, unknown>;
    let data: Product | null = null;
    let error: unknown = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await admin.from("products").insert(compatibleProduct).select("*").single<Product>();
      data = result.data;
      error = result.error;
      if (!error) break;
      if (compatibleProduct.vat_rate === ZERO_VAT_RATE && oldVatRateConstraint(error)) {
        compatibleProduct.vat_rate = LEGACY_ZERO_VAT_RATE;
        continue;
      }
      if (missingNorwayShippingColumn(error)) {
        delete compatibleProduct.shipping_price_no_cents;
        continue;
      }
      if (missingModernProductColumn(error)) {
        delete compatibleProduct.seller_target_price_cents;
        delete compatibleProduct.storefront_category;
        delete compatibleProduct.shipping_price_fi_cents;
        delete compatibleProduct.shipping_price_se_cents;
        continue;
      }
      break;
    }
    if (error) throw error;
    return NextResponse.json({ product: normalizedProduct(data!) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Tuotteen tallentaminen epäonnistui.");
  }
}
