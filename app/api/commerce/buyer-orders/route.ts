import { NextResponse } from "next/server";

import { errorResponse, requireCommerceUser } from "@/lib/commerce/server";

const BUYER_ORDER_SELECT = `
  id,
  checkout_group_id,
  order_number,
  payment_status,
  fulfillment_status,
  total_cents,
  currency,
  shipping_method,
  shipping_price_cents,
  pickup_point_name,
  pickup_point_address,
  posti_tracking_code,
  posti_tracking_url,
  seller_name_snapshot,
  paid_at,
  created_at,
  order_items(
    id,
    product_id,
    product_name,
    product_description_snapshot,
    image_url_snapshot,
    quantity,
    unit_price_cents,
    line_total_cents,
    pickup_address_snapshot,
    pickup_instructions_snapshot,
    shipping_notes_snapshot
  )
`;

export async function GET(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Käyttäjätililtä puuttuu vahvistettu sähköpostiosoite." },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("orders")
      .select(BUYER_ORDER_SELECT)
      .eq("customer_email", email)
      // Checkout creates a private draft before Stripe opens. It becomes part
      // of the buyer's order history only after Stripe has confirmed payment.
      .not("paid_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({ orders: data ?? [] });
  } catch (error) {
    return errorResponse(error, "Omien tilausten lataaminen epäonnistui.");
  }
}
