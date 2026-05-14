import { NextResponse } from "next/server";
import { getPointPackage } from "@/lib/point-packages";
import { createPayPalPointOrder } from "@/lib/paypal";
import { requireUserFromRequest } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { packageId } = await request.json() as { packageId?: string };
    const pointPackage = getPointPackage(packageId);

    if (!pointPackage) {
      return NextResponse.json({ error: "Tuntematon pistepaketti." }, { status: 400 });
    }

    const { admin, user } = await requireUserFromRequest(request);
    const order = await createPayPalPointOrder(pointPackage.id, user.id);

    const { error } = await admin
      .from("point_purchases")
      .insert({
        user_id: user.id,
        paypal_order_id: order.id,
        package_id: pointPackage.id,
        points: pointPackage.points,
        amount: pointPackage.amount,
        currency: pointPackage.currency,
        status: "created"
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Orderin luonti epäonnistui." },
      { status: 500 }
    );
  }
}
