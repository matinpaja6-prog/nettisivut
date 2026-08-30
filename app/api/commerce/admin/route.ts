import { NextResponse } from "next/server";

import type { Company } from "@/lib/commerce/types";
import { companyProfileErrors } from "@/lib/commerce/validation";
import { errorResponse, normalizeMultiline, normalizeText, requireAdminUser } from "@/lib/commerce/server";

export async function GET(request: Request) {
  try {
    const { admin } = await requireAdminUser(request);
    const [companies, products, orders, events, paymentFeeAdjustments] = await Promise.all([
      admin.from("companies").select("*").order("created_at", { ascending: false }).limit(500),
      admin.from("products").select("id,company_id,name,price_cents,stock_quantity,active,pickup_available,shipping_available,posti_enabled,created_at").order("created_at", { ascending: false }).limit(300),
      admin.from("orders").select("id,company_id,order_number,payment_status,fulfillment_status,total_cents,shipping_method,payment_error,created_at").order("created_at", { ascending: false }).limit(300),
      admin.from("stripe_webhook_events").select("*").in("processing_status", ["failed", "processing"]).order("created_at", { ascending: false }).limit(200),
      admin.from("company_payment_fee_adjustments")
        .select("id,company_id,order_id,stripe_charge_id,stripe_refund_id,amount_cents,reason,created_at,order:orders(order_number,total_cents)")
        .order("created_at", { ascending: false })
        .limit(500)
    ]);
    const error = companies.error || products.error || orders.error || events.error || paymentFeeAdjustments.error;
    if (error) throw error;
    return NextResponse.json({
      companies: companies.data ?? [],
      products: products.data ?? [],
      orders: orders.data ?? [],
      webhookEvents: events.data ?? [],
      paymentFeeAdjustments: paymentFeeAdjustments.data ?? []
    });
  } catch (error) {
    return errorResponse(error, "Yritysmyynnin admin-tietojen lataaminen epäonnistui.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requireAdminUser(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const companyId = normalizeText(body.companyId, 80);
    const status = normalizeText(body.verificationStatus, 30);
    const notes = normalizeMultiline(body.verificationNotes, 3000) || null;
    const adminNotes = normalizeMultiline(body.adminNotes, 5000) || null;
    if (!companyId || !new Set(["draft", "pending", "approved", "rejected", "suspended"]).has(status)) {
      return NextResponse.json({ error: "Yrityksen tila on virheellinen." }, { status: 400 });
    }
    const { data: current, error: currentError } = await admin
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle<Company>();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: "Yritystä ei löytynyt." }, { status: 404 });
    if (status === "approved") {
      const errors = companyProfileErrors(current);
      if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }
    const verified = status === "approved";
    const { data, error } = await admin
      .from("companies")
      .update({
        verification_status: status,
        verification_notes: notes,
        admin_notes: adminNotes,
        verified_at: verified ? new Date().toISOString() : null,
        verified_by_admin_id: verified ? user.id : null
      })
      .eq("id", companyId)
      .select("*")
      .single<Company>();
    if (error) throw error;

    if (!verified) {
      const { error: productError } = await admin
        .from("products")
        .update({ active: false })
        .eq("company_id", companyId)
        .eq("active", true);
      if (productError) throw productError;
    }
    return NextResponse.json({ company: data });
  } catch (error) {
    return errorResponse(error, "Yrityksen vahvistustilan päivittäminen epäonnistui.");
  }
}
