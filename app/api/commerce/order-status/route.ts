import { NextResponse } from "next/server";

import { completePaidCheckoutSession } from "@/lib/commerce/complete-paid-checkout";
import type { Order } from "@/lib/commerce/types";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_STATUS_SELECT = "id,company_id,order_number,payment_status,fulfillment_status,subtotal_cents,vat_cents,total_cents,shipping_method,shipping_price_cents,pickup_point_name,pickup_point_address,seller_name_snapshot,receipt_sent_at,seller_notified_at,paid_at,created_at,order_items(id,product_id,product_name,product_description_snapshot,image_url_snapshot,quantity,unit_price_cents,vat_rate,vat_cents,line_total_cents,pickup_address_snapshot,pickup_instructions_snapshot)";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim();
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Maksuistunto puuttuu." }, { status: 400 });
  }
  try {
    const admin = getSupabaseAdmin();
    const { data: checkoutGroup, error: checkoutGroupError } = await admin
      .from("checkout_groups")
      .select("*")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle<Record<string, unknown>>();
    if (checkoutGroupError) throw checkoutGroupError;
    if (checkoutGroup) {
      let syncPending = false;
      let paymentSession: { status: string | null; paymentStatus: string; clientSecret: string | null } | null = null;
      try {
        const { data: missingSellerNotices, error: missingSellerNoticeError } = await admin
          .from("orders")
          .select("id")
          .eq("checkout_group_id", checkoutGroup.id)
          .is("seller_notified_at", null)
          .limit(1);
        if (missingSellerNoticeError) throw missingSellerNoticeError;
        const notificationsPending = !checkoutGroup.receipt_sent_at || Boolean(missingSellerNotices?.length);
        const { data: paymentOrders, error: paymentOrdersError } = await admin
          .from("orders")
          .select("id,company_id,stripe_transfer_status")
          .eq("checkout_group_id", checkoutGroup.id)
          .limit(2)
          .returns<Array<{ id: string; company_id: string; stripe_transfer_status: string | null }>>();
        if (paymentOrdersError) throw paymentOrdersError;
        const directOrder = paymentOrders?.length === 1 && paymentOrders[0].stripe_transfer_status === "direct_charge"
          ? paymentOrders[0]
          : null;
        const { data: directCompany, error: directCompanyError } = directOrder
          ? await admin.from("companies").select("stripe_account_id").eq("id", directOrder.company_id).maybeSingle<{ stripe_account_id: string | null }>()
          : { data: null, error: null };
        if (directCompanyError) throw directCompanyError;
        const connectedAccountId = directCompany?.stripe_account_id ?? null;
        const session = connectedAccountId
          ? await getStripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount: connectedAccountId })
          : await getStripe().checkout.sessions.retrieve(sessionId);
        paymentSession = {
          status: session.status,
          paymentStatus: session.payment_status,
          clientSecret: session.status === "open" && session.payment_status === "unpaid" ? session.client_secret : null,
        };
        if (session.payment_status === "paid" && (checkoutGroup.payment_status !== "paid" || notificationsPending)) {
          await completePaidCheckoutSession({ session, eventId: `checkout-group-sync:${session.id}`, eventType: "checkout.session.completed.sync", connectedAccountId });
        } else if (session.status === "expired" && checkoutGroup.payment_status === "pending") {
          await admin.from("checkout_groups").update({ payment_status: "cancelled" }).eq("id", checkoutGroup.id);
          await admin.from("orders").update({ payment_status: "cancelled" }).eq("checkout_group_id", checkoutGroup.id);
        }
      } catch (syncError) {
        syncPending = true;
        console.error("Checkout group background sync failed", syncError);
      }
      const { data: refreshedGroup } = await admin.from("checkout_groups").select("*").eq("id", checkoutGroup.id).single<Record<string, unknown>>();
      const { data: groupOrders, error: groupOrdersError } = await admin.from("orders").select(ORDER_STATUS_SELECT)
        .eq("checkout_group_id", checkoutGroup.id).order("created_at").returns<Order[]>();
      if (groupOrdersError) throw groupOrdersError;
      const notificationsPending = !refreshedGroup?.receipt_sent_at || (groupOrders ?? []).some((order) => !order.seller_notified_at);
      return NextResponse.json({
        checkout: refreshedGroup,
        orders: groupOrders ?? [],
        order: groupOrders?.[0] ?? null,
        paymentSession,
        publishableKey: paymentSession?.clientSecret ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : null,
        syncPending: syncPending || notificationsPending,
      });
    }
    const { data: initialOrder, error } = await admin
      .from("orders")
      .select(ORDER_STATUS_SELECT)
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle<Order>();
    if (error) throw error;
    if (!initialOrder) return NextResponse.json({ error: "Tilausta ei löytynyt." }, { status: 404 });

    const needsPaymentSync = initialOrder.payment_status === "pending" || (
      initialOrder.payment_status === "paid" &&
      (!initialOrder.receipt_sent_at || !initialOrder.seller_notified_at)
    );
    if (!needsPaymentSync) return NextResponse.json({ order: initialOrder });

    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("stripe_account_id")
      .eq("id", initialOrder.company_id)
      .maybeSingle<{ stripe_account_id: string | null }>();
    if (companyError) throw companyError;
    if (!company?.stripe_account_id) return NextResponse.json({ order: initialOrder });

    let syncPending = false;
    let paymentSession: { status: string | null; paymentStatus: string; clientSecret: string | null } | null = null;
    try {
      const session = await getStripe().checkout.sessions.retrieve(
        sessionId,
        {},
        { stripeAccount: company.stripe_account_id },
      );
      paymentSession = {
        status: session.status,
        paymentStatus: session.payment_status,
        clientSecret: session.status === "open" && session.payment_status === "unpaid" ? session.client_secret : null,
      };
      if (session.payment_status === "paid") {
        await completePaidCheckoutSession({
          session,
          eventId: `checkout-sync:${session.id}`,
          eventType: "checkout.session.completed.sync",
          connectedAccountId: company.stripe_account_id,
        });
      } else if (session.status === "expired" && initialOrder.payment_status === "pending") {
        await admin.from("orders").update({ payment_status: "cancelled" }).eq("id", initialOrder.id);
      }
    } catch (syncError) {
      syncPending = true;
      console.error("Order background sync failed", syncError);
    }

    const { data: refreshedOrder, error: refreshError } = await admin
      .from("orders")
      .select(ORDER_STATUS_SELECT)
      .eq("id", initialOrder.id)
      .single<Order>();
    if (refreshError) throw refreshError;
    return NextResponse.json({
      order: refreshedOrder,
      paymentSession,
      publishableKey: paymentSession?.clientSecret ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : null,
      syncPending,
    });
  } catch (error) {
    console.error("Order status failed", error);
    return NextResponse.json({ error: "Tilauksen tilan lataaminen epäonnistui." }, { status: 500 });
  }
}
