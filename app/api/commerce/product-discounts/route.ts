import { NextResponse } from "next/server";

import type { Product } from "@/lib/commerce/types";
import { errorResponse, getOwnedCompany, normalizeText, requireCommerceUser } from "@/lib/commerce/server";

function optionalDate(value: unknown) {
  const raw = normalizeText(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("Päivämäärä ei ole kelvollinen.");
  return date.toISOString();
}

type DiscountProduct = Pick<Product, "id" | "name" | "price_cents">;
type LinkedListing = {
  id: string;
  title: string;
  price: number;
  translations: Record<string, unknown> | null;
};

async function syncListingSaleMetadata(
  admin: Awaited<ReturnType<typeof requireCommerceUser>>["admin"],
  ownerUserId: string,
  products: Product[]
) {
  if (!products.length) return;
  const byId = new Map(products.map((product) => [product.id, product]));
  const { data: listings, error } = await admin
    .from("listings")
    .select("id,title,price,translations")
    .eq("seller_id", ownerUserId)
    .returns<LinkedListing[]>();
  if (error) throw error;

  await Promise.all((listings ?? []).map(async (listing) => {
    const translations = { ...(listing.translations ?? {}) } as Record<string, unknown>;
    const currentMeta = translations._meta && typeof translations._meta === "object"
      ? translations._meta as Record<string, unknown>
      : {};
    const linkedId = normalizeText(currentMeta.commerce_product_id, 80);
    const product = byId.get(linkedId) ?? products.find((item) => (
      item.name === listing.title && item.price_cents === Math.round(Number(listing.price) * 100)
    ));
    if (!product) return;

    translations._meta = {
      ...currentMeta,
      commerce_product_id: product.id,
      sale_price_cents: product.sale_price_cents,
      sale_starts_at: product.sale_starts_at,
      sale_ends_at: product.sale_ends_at
    };
    const { error: updateError } = await admin.from("listings").update({ translations }).eq("id", listing.id);
    if (updateError) throw updateError;
  }));
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) return NextResponse.json({ error: "Yritysprofiilia ei löytynyt." }, { status: 404 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const requestedIds = Array.isArray(body.product_ids)
      ? body.product_ids.map((id) => normalizeText(id, 80)).filter(Boolean)
      : [normalizeText(body.id, 80)].filter(Boolean);
    const productIds = [...new Set(requestedIds)].slice(0, 250);
    if (!productIds.length) return NextResponse.json({ error: "Valitse vähintään yksi tuote." }, { status: 400 });

    const remove = body.remove === true || body.sale_price_euros === null || body.sale_price_euros === "";
    const startsAt = remove ? null : optionalDate(body.sale_starts_at);
    const endsAt = remove ? null : optionalDate(body.sale_ends_at);
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return NextResponse.json({ error: "Päättymisajan pitää olla alkamisajan jälkeen." }, { status: 400 });
    }

    const { data: currentProducts, error: currentError } = await admin
      .from("products")
      .select("id,name,price_cents")
      .eq("company_id", company.id)
      .in("id", productIds)
      .returns<DiscountProduct[]>();
    if (currentError) throw currentError;
    if (!currentProducts?.length) return NextResponse.json({ error: "Valittuja tuotteita ei löytynyt." }, { status: 404 });

    const percentage = Number(body.discount_percent);
    const legacySalePrice = body.sale_price_euros == null || body.sale_price_euros === ""
      ? null
      : Math.round(Number(body.sale_price_euros) * 100);
    if (!remove && body.discount_percent != null && (!Number.isFinite(percentage) || percentage <= 0 || percentage >= 100)) {
      return NextResponse.json({ error: "Alennusprosentin pitää olla 1–99 %." }, { status: 400 });
    }
    if (!remove && body.discount_percent == null && (legacySalePrice == null || !Number.isFinite(legacySalePrice) || legacySalePrice < 0)) {
      return NextResponse.json({ error: "Alennushinta ei ole kelvollinen." }, { status: 400 });
    }

    const updatedProducts = await Promise.all(currentProducts.map(async (product) => {
      const salePrice = remove
        ? null
        : body.discount_percent != null
          ? Math.max(1, Math.round(product.price_cents * (100 - percentage) / 100))
          : legacySalePrice;
      if (salePrice != null && salePrice >= product.price_cents) throw new Error("Alennushinnan pitää olla normaalihintaa pienempi.");
      const { data, error } = await admin.from("products").update({
        sale_price_cents: salePrice,
        sale_starts_at: salePrice == null ? null : startsAt,
        sale_ends_at: salePrice == null ? null : endsAt
      }).eq("id", product.id).eq("company_id", company.id).select("*").single<Product>();
      if (error) throw error;
      return data;
    }));

    await syncListingSaleMetadata(admin, company.owner_user_id, updatedProducts);
    return NextResponse.json({ products: updatedProducts, product: updatedProducts[0] ?? null });
  } catch (error) {
    return errorResponse(error, "Tuotealennuksen tallentaminen epäonnistui.");
  }
}
