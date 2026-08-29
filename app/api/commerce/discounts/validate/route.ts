import { NextResponse } from "next/server";

import { discountCodeAmount, normalizedDiscountCode } from "@/lib/commerce/discounts";
import type { CompanyDiscountCode } from "@/lib/commerce/types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const companyId = String(body.companyId ?? "").trim();
    const codeValue = normalizedDiscountCode(body.code);
    const subtotal = Math.max(0, Math.round(Number(body.subtotalCents) || 0));
    if (!companyId || !codeValue) return NextResponse.json({ error: "Anna alennuskoodi." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from("company_discount_codes").select("*")
      .eq("company_id", companyId).eq("code", codeValue).maybeSingle<CompanyDiscountCode>();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Alennuskoodia ei löytynyt." }, { status: 404 });
    const amount = discountCodeAmount(data, subtotal);
    if (amount <= 0) return NextResponse.json({ error: "Alennuskoodi ei ole voimassa tai tilauksen ehdot eivät täyty." }, { status: 400 });
    return NextResponse.json({ code: data.code, amountCents: amount, label: data.discount_type === "percent" ? `${data.discount_value / 100} %` : `${(data.discount_value / 100).toFixed(2)} €` });
  } catch (error) {
    console.error("Discount validation failed", error);
    return NextResponse.json({ error: "Alennuskoodin tarkistaminen epäonnistui." }, { status: 500 });
  }
}
