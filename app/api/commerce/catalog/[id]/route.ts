import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isStripeReady } from "@/lib/commerce/validation";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("products")
      .select("*,company:companies(*)")
      .eq("id", id)
      .eq("active", true)
      .gt("stock_quantity", 0)
      .maybeSingle();
    if (error) throw error;
    const company = data?.company as Record<string, unknown> | null;
    if (!data || company?.verification_status !== "approved" || !isStripeReady(company)) {
      return NextResponse.json({ error: "Tuotetta ei löytynyt tai se ei ole myynnissä." }, { status: 404 });
    }
    return NextResponse.json({
      product: {
        ...data,
        company: {
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
          free_shipping_threshold_cents: company.free_shipping_threshold_cents,
          posti_enabled: company.posti_enabled === true,
          shipping_countries: Array.isArray(company.shipping_countries)
            ? company.shipping_countries
            : ["FI"]
        }
      }
    });
  } catch (error) {
    console.error("Commerce product failed", error);
    return NextResponse.json({ error: "Tuotteen lataaminen epäonnistui." }, { status: 500 });
  }
}
