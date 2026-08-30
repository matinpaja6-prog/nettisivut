import "server-only";

import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RefundableOrder = {
  id: string;
  company_id: string;
  total_cents: number;
  stripe_processing_fee_cents: number | null;
};

export async function recordSellerCancelledRefundFeeDebt(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;
  if (!paymentIntentId) return {
    recordedCents: 0,
    orderIds: [] as string[],
    recoveries: [] as Array<{ orderId: string; orderTotalCents: number; refundAmountCents: number }>,
  };

  const refunds = await getStripe().refunds.list({ charge: charge.id, limit: 100 });
  const companyRefunds = refunds.data.filter((refund) =>
    refund.metadata?.maskines_fee_responsibility === "company"
    && Boolean(refund.metadata?.order_id)
    && !new Set(["failed", "canceled"]).has(refund.status ?? "")
  );
  if (!companyRefunds.length) return {
    recordedCents: 0,
    orderIds: [] as string[],
    recoveries: [] as Array<{ orderId: string; orderTotalCents: number; refundAmountCents: number }>,
  };

  const orderIds = Array.from(new Set(
    companyRefunds.map((refund) => refund.metadata?.order_id ?? "").filter(Boolean)
  ));
  const admin = getSupabaseAdmin();
  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id,company_id,total_cents,stripe_processing_fee_cents")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .in("id", orderIds)
    .returns<RefundableOrder[]>();
  if (ordersError) throw ordersError;
  const ordersById = new Map((orders ?? []).map((order) => [order.id, order]));

  let recordedCents = 0;
  for (const refund of companyRefunds) {
    const order = ordersById.get(refund.metadata?.order_id ?? "");
    if (!order || !order.stripe_processing_fee_cents || order.total_cents <= 0) continue;
    const requestedAmount = Math.min(
      order.stripe_processing_fee_cents,
      Math.round(order.stripe_processing_fee_cents * refund.amount / order.total_cents),
    );
    if (requestedAmount <= 0) continue;

    const { data, error } = await admin.rpc("record_company_payment_fee_debt", {
      target_company_id: order.company_id,
      target_order_id: order.id,
      target_stripe_charge_id: charge.id,
      target_stripe_refund_id: refund.id,
      requested_amount_cents: requestedAmount,
      target_reason: "seller_cancelled_refund",
    });
    if (error) throw error;
    recordedCents += Math.max(0, Number(data) || 0);
  }

  const refundAmountsByOrder = new Map<string, number>();
  for (const refund of companyRefunds) {
    const orderId = refund.metadata?.order_id ?? "";
    if (!ordersById.has(orderId)) continue;
    refundAmountsByOrder.set(orderId, (refundAmountsByOrder.get(orderId) ?? 0) + refund.amount);
  }

  return {
    recordedCents,
    orderIds: Array.from(ordersById.keys()),
    recoveries: Array.from(refundAmountsByOrder, ([orderId, refundAmountCents]) => ({
      orderId,
      orderTotalCents: ordersById.get(orderId)!.total_cents,
      refundAmountCents,
    })),
  };
}

export async function reserveCompanyPaymentFeeDebt(
  companyId: string,
  orderId: string,
  maximumWithholdingCents: number,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "reserve_company_payment_fee_debt",
    {
      target_company_id: companyId,
      target_order_id: orderId,
      maximum_withholding_cents: Math.max(0, Math.trunc(maximumWithholdingCents)),
    },
  );
  if (error) throw error;
  return Math.max(0, Number(data) || 0);
}

export async function releaseCompanyPaymentFeeDebtReservation(
  companyId: string,
  orderId: string,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "release_company_payment_fee_debt_reservation",
    {
      target_company_id: companyId,
      target_order_id: orderId,
    },
  );
  if (error) throw error;
  return Math.max(0, Number(data) || 0);
}
