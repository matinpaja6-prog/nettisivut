import { NextResponse } from "next/server";

import { normalizedDiscountCode } from "@/lib/commerce/discounts";
import type { CompanyDiscountCode } from "@/lib/commerce/types";
import { errorResponse, getOwnedCompany, integer, normalizeText, requireCommerceUser } from "@/lib/commerce/server";

function dateOrNull(value: unknown) {
  const raw = normalizeText(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("Päivämäärä ei ole kelvollinen.");
  return date.toISOString();
}

export async function GET(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) return NextResponse.json({ discounts: [] });
    const { data, error } = await admin.from("company_discount_codes").select("*")
      .eq("company_id", company.id).order("created_at", { ascending: false }).returns<CompanyDiscountCode[]>();
    if (error) throw error;
    return NextResponse.json({ discounts: data ?? [] });
  } catch (error) {
    return errorResponse(error, "Alennuskoodien lataaminen epäonnistui.");
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) return NextResponse.json({ error: "Yritysprofiilia ei löytynyt." }, { status: 404 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const code = normalizedDiscountCode(body.code);
    const type = body.discount_type === "fixed" ? "fixed" : "percent";
    const inputValue = Number(body.value);
    const discountValue = type === "percent" ? Math.round(inputValue * 100) : Math.round(inputValue * 100);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return NextResponse.json({ error: "Koodi saa sisältää 3–40 kirjainta, numeroa, viivaa tai alaviivaa." }, { status: 400 });
    if (!Number.isFinite(discountValue) || discountValue <= 0 || (type === "percent" && discountValue > 10000)) {
      return NextResponse.json({ error: type === "percent" ? "Prosentin pitää olla 0–100." : "Anna kelvollinen euromääräinen alennus." }, { status: 400 });
    }
    const startsAt = dateOrNull(body.starts_at);
    const expiresAt = dateOrNull(body.expires_at);
    if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) return NextResponse.json({ error: "Päättymisajan pitää olla alkamisajan jälkeen." }, { status: 400 });
    const maximumUses = body.maximum_uses === null || body.maximum_uses === "" ? null : integer(body.maximum_uses, 1, 1_000_000);
    const { data, error } = await admin.from("company_discount_codes").insert({
      company_id: company.id,
      code,
      name: normalizeText(body.name, 120),
      discount_type: type,
      discount_value: discountValue,
      minimum_order_cents: Math.max(0, Math.round(Number(body.minimum_order_euros || 0) * 100)),
      maximum_uses: maximumUses,
      starts_at: startsAt,
      expires_at: expiresAt,
      active: body.active !== false
    }).select("*").single<CompanyDiscountCode>();
    if (error) throw error;
    return NextResponse.json({ discount: data }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Alennuskoodin luominen epäonnistui.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) return NextResponse.json({ error: "Yritysprofiilia ei löytynyt." }, { status: 404 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const id = normalizeText(body.id, 80);
    if (!id) return NextResponse.json({ error: "Alennuskoodi puuttuu." }, { status: 400 });
    const updates: Record<string, unknown> = {};
    if (typeof body.active === "boolean") updates.active = body.active;
    if (body.maximum_uses !== undefined) updates.maximum_uses = body.maximum_uses === null || body.maximum_uses === "" ? null : integer(body.maximum_uses, 1, 1_000_000);
    if (body.expires_at !== undefined) updates.expires_at = dateOrNull(body.expires_at);
    const { data, error } = await admin.from("company_discount_codes").update(updates)
      .eq("id", id).eq("company_id", company.id).select("*").single<CompanyDiscountCode>();
    if (error) throw error;
    return NextResponse.json({ discount: data });
  } catch (error) {
    return errorResponse(error, "Alennuskoodin päivittäminen epäonnistui.");
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) return NextResponse.json({ error: "Yritysprofiilia ei löytynyt." }, { status: 404 });
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const { error } = await admin.from("company_discount_codes").delete().eq("id", id).eq("company_id", company.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Alennuskoodin poistaminen epäonnistui.");
  }
}
