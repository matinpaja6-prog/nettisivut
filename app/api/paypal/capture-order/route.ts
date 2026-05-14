import { NextResponse } from "next/server";
import { getPointPackage } from "@/lib/point-packages";
import { capturePayPalOrder } from "@/lib/paypal";
import { requireUserFromRequest } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json() as { orderId?: string };

    if (!orderId) {
      return NextResponse.json({ error: "PayPal order id puuttuu." }, { status: 400 });
    }

    const { admin, user } = await requireUserFromRequest(request);
    const purchaseResult = await admin
      .from("point_purchases")
      .select("id, user_id, package_id, points, amount, currency, status")
      .eq("paypal_order_id", orderId)
      .maybeSingle<{
        id: string;
        user_id: string;
        package_id: string;
        points: number;
        amount: string;
        currency: string;
        status: string;
      }>();

    if (purchaseResult.error || !purchaseResult.data) {
      return NextResponse.json({ error: "Maksua ei löytynyt tietokannasta." }, { status: 404 });
    }

    const purchase = purchaseResult.data;

    if (purchase.user_id !== user.id) {
      return NextResponse.json({ error: "Maksu kuuluu eri käyttäjälle." }, { status: 403 });
    }

    if (purchase.status === "completed") {
      return NextResponse.json({ success: true, pointsAdded: 0, alreadyCompleted: true });
    }

    const pointPackage = getPointPackage(purchase.package_id);

    if (!pointPackage) {
      return NextResponse.json({ error: "Tuntematon pistepaketti." }, { status: 400 });
    }

    const capture = await capturePayPalOrder(orderId);
    const unit = capture.purchase_units?.[0];
    const captureItem = unit?.payments?.captures?.[0];

    const completed =
      capture.status === "COMPLETED" &&
      captureItem?.status === "COMPLETED" &&
      captureItem.amount?.currency_code === pointPackage.currency &&
      captureItem.amount?.value === pointPackage.amount &&
      unit?.reference_id === pointPackage.id;

    if (!completed) {
      await admin
        .from("point_purchases")
        .update({ status: "failed" })
        .eq("id", purchase.id);

      return NextResponse.json({ error: "PayPal-maksua ei vahvistettu." }, { status: 400 });
    }

    const rpcResult = await admin.rpc("add_profile_points", {
      p_user_id: user.id,
      p_points: pointPackage.points
    });

    if (rpcResult.error) {
      return NextResponse.json({ error: rpcResult.error.message }, { status: 500 });
    }

    const updateResult = await admin
      .from("point_purchases")
      .update({
        paypal_capture_id: captureItem.id ?? null,
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", purchase.id);

    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      pointsAdded: pointPackage.points,
      points: rpcResult.data
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Maksun vahvistus epäonnistui." },
      { status: 500 }
    );
  }
}
