import "server-only";

import { allocateActualStripeFee } from "@/lib/commerce/fees";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RecoverableOrder = {
  id: string;
  order_number: string;
  stripe_transfer_id: string | null;
  stripe_transfer_status: string | null;
  seller_transfer_cents: number | null;
  payment_error: string | null;
};

function appendWarning(current: string | null, next: string) {
  const parts = (current?.split(" | ") ?? []).map((part) => part.trim()).filter(Boolean);
  if (!parts.includes(next)) parts.push(next);
  return parts.join(" | ").slice(0, 2000);
}

async function paymentOrders(paymentIntentId: string, orderId?: string | null) {
  const admin = getSupabaseAdmin();
  const query = admin.from("orders").select(
    "id,order_number,stripe_transfer_id,stripe_transfer_status,seller_transfer_cents,payment_error",
  );
  const { data, error } = orderId
    ? await query.eq("id", orderId).returns<RecoverableOrder[]>()
    : await query.eq("stripe_payment_intent_id", paymentIntentId).returns<RecoverableOrder[]>();
  if (error) throw error;
  return data ?? [];
}

/**
 * Pulls back the seller share as soon as Stripe reports a refund or dispute.
 * Repeated webhook deliveries are safe: the current reversed amount is read
 * from Stripe and only the missing difference is reversed.
 */
export async function recoverSellerTransfers(input: {
  paymentIntentId: string;
  chargeAmountCents: number;
  recoveryAmountCents: number;
  reason: "refund" | "dispute";
  orderId?: string | null;
}) {
  const orders = await paymentOrders(input.paymentIntentId, input.orderId);
  const transferableOrders = orders.filter(
    (order) => order.stripe_transfer_id && (order.seller_transfer_cents ?? 0) > 0,
  );
  if (!transferableOrders.length) return { recoveredCents: 0, requestedCents: 0 };

  const totalTransferred = transferableOrders.reduce(
    (sum, order) => sum + Math.max(0, order.seller_transfer_cents ?? 0),
    0,
  );
  const chargeAmount = Math.max(1, Math.trunc(input.chargeAmountCents));
  const recoveryAmount = Math.min(chargeAmount, Math.max(0, Math.trunc(input.recoveryAmountCents)));
  const requestedFromSellers = Math.min(
    totalTransferred,
    Math.round(totalTransferred * recoveryAmount / chargeAmount),
  );
  const targets = allocateActualStripeFee(
    transferableOrders.map((order) => ({
      id: order.id,
      grossCents: Math.max(0, order.seller_transfer_cents ?? 0),
    })),
    requestedFromSellers,
  );

  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  let recoveredCents = 0;
  for (const order of transferableOrders) {
    const transferId = order.stripe_transfer_id!;
    const target = targets.get(order.id) ?? 0;
    if (target <= 0) continue;

    const transfer = await stripe.transfers.retrieve(transferId);
    const alreadyReversed = Math.max(0, transfer.amount_reversed ?? 0);
    const missing = Math.max(0, Math.min(target, transfer.amount) - alreadyReversed);
    if (missing > 0) {
      try {
        await stripe.transfers.createReversal(
          transferId,
          {
            amount: missing,
            metadata: {
              order_id: order.id,
              recovery_reason: input.reason,
              payment_intent_id: input.paymentIntentId,
            },
          },
          { idempotencyKey: `${input.reason}-${transferId}-${target}` },
        );
      } catch (error) {
        const failure = input.reason === "refund"
          ? "Myyjän tilityksen takaisinperintä epäonnistui palautuksessa ja vaatii käsittelyä."
          : "Myyjän tilityksen takaisinperintä epäonnistui riitautuksessa ja vaatii käsittelyä.";
        await admin.from("orders").update({
          stripe_transfer_status: "recovery_failed",
          fulfillment_status: "attention",
          payment_error: appendWarning(order.payment_error, failure),
        }).eq("id", order.id);
        throw error;
      }
    }

    const cumulativeReversed = Math.min(transfer.amount, alreadyReversed + missing);
    recoveredCents += Math.min(target, cumulativeReversed);
    const fullReversal = cumulativeReversed >= transfer.amount;
    const message = input.reason === "refund"
      ? "Myyjän tilitys perittiin takaisin ostajalle tehtyä palautusta varten."
      : "Myyjän tilitys perittiin takaisin Stripe-riitautuksen ajaksi.";
    const { error } = await admin.from("orders").update({
      stripe_transfer_status: fullReversal ? "reversed" : "partially_reversed",
      payment_error: appendWarning(order.payment_error, message),
    }).eq("id", order.id);
    if (error) throw error;
  }

  return { recoveredCents, requestedCents: requestedFromSellers };
}
