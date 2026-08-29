import type Stripe from "stripe";
import { NextResponse } from "next/server";

import {
  COMPANY_VERIFICATION_PAYMENT_KIND,
  completeCompanyVerificationPayment
} from "@/lib/company-verification-payment";
import { sendCompanyVerificationReceipt } from "@/lib/company-verification-email";
import { completePaidCheckoutSession } from "@/lib/commerce/complete-paid-checkout";
import { updateCompanyStripeState } from "@/lib/commerce/stripe-connect";
import { recoverSellerTransfers } from "@/lib/commerce/stripe-transfer-recovery";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function recordEvent(event: Stripe.Event) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      type: event.type,
      connected_account_id: event.account ?? null,
      processing_status: "processing"
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await admin
      .from("stripe_webhook_events")
      .select("processing_status")
      .eq("stripe_event_id", event.id)
      .maybeSingle<{ processing_status: string }>();
    if (existingError) throw existingError;
    if (existing?.processing_status !== "failed") return false;
    const { error: retryError } = await admin
      .from("stripe_webhook_events")
      .update({ processing_status: "processing", error_message: null, processed_at: null })
      .eq("stripe_event_id", event.id);
    if (retryError) throw retryError;
    return true;
  }
  if (error) throw error;
  return Boolean(data);
}

async function finishEvent(eventId: string, status: "completed" | "ignored" | "failed", error?: unknown) {
  const admin = getSupabaseAdmin();
  await admin.from("stripe_webhook_events").update({
    processing_status: status,
    processed_at: new Date().toISOString(),
    error_message: error ? String(error instanceof Error ? error.message : error).slice(0, 2000) : null
  }).eq("stripe_event_id", eventId);
}

function relationId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function updateOrderByPaymentIntent(
  paymentIntentId: string | null,
  values: Record<string, unknown>,
  orderId?: string | null
) {
  const admin = getSupabaseAdmin();
  let query = admin.from("orders").update(values);
  query = orderId ? query.eq("id", orderId) : query.eq("stripe_payment_intent_id", paymentIntentId ?? "");
  const { error } = await query;
  if (error) throw error;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secrets = Array.from(new Set([
    process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim()
  ].filter((value): value is string => Boolean(value))));
  if (!signature || !secrets.length) {
    return NextResponse.json({ error: "Webhookin allekirjoitusasetukset puuttuvat." }, { status: 400 });
  }

  let event: Stripe.Event | null = null;
  try {
    const payload = await request.text();
    for (const secret of secrets) {
      try {
        event = getStripe().webhooks.constructEvent(payload, signature, secret);
        break;
      } catch {
        // Sama reitti vastaanottaa sekä alustatilin että Connect-tilien tapahtumat.
      }
    }
    if (!event) throw new Error("Webhook signature did not match configured endpoints.");
  } catch (error) {
    console.error("Stripe webhook signature failed", error);
    return NextResponse.json({ error: "Virheellinen Stripe webhook -allekirjoitus." }, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") {
        if (await recordEvent(event)) await finishEvent(event.id, "ignored", "Checkout Session ei ollut vielä maksettu.");
        return NextResponse.json({ received: true, ignored: true });
      }
      if (session.metadata?.kind === COMPANY_VERIFICATION_PAYMENT_KIND) {
        if (!(await recordEvent(event))) {
          return NextResponse.json({ received: true, duplicate: true });
        }
        await completeCompanyVerificationPayment(session);
        try {
          await sendCompanyVerificationReceipt(session);
        } catch (receiptError) {
          console.error("Company verification receipt failed", receiptError);
        }
        await finishEvent(event.id, "completed");
        return NextResponse.json({ received: true });
      }
      await completePaidCheckoutSession({
        session,
        eventId: event.id,
        eventType: event.type,
        connectedAccountId: event.account ?? null,
      });
      return NextResponse.json({ received: true });
    }

    if (event.type === "checkout.session.async_payment_failed") {
      if (!(await recordEvent(event))) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      const session = event.data.object as Stripe.Checkout.Session;
      const checkoutGroupId = session.metadata?.checkout_group_id;
      const orderId = session.metadata?.order_id;
      const failure = "Viivästetty Stripe-maksu epäonnistui.";
      const admin = getSupabaseAdmin();
      if (checkoutGroupId) {
        const { error: groupError } = await admin.from("checkout_groups").update({
          payment_status: "failed",
          payment_error: failure,
        }).eq("id", checkoutGroupId).neq("payment_status", "paid");
        if (groupError) throw groupError;
        const { error: orderError } = await admin.from("orders").update({
          payment_status: "failed",
          payment_error: failure,
        }).eq("checkout_group_id", checkoutGroupId).neq("payment_status", "paid");
        if (orderError) throw orderError;
      } else if (orderId) {
        await updateOrderByPaymentIntent(null, {
          payment_status: "failed",
          payment_error: failure,
        }, orderId);
      }
      await finishEvent(event.id, "completed");
      return NextResponse.json({ received: true });
    }

    if (!(await recordEvent(event))) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === "account.updated") {
      await updateCompanyStripeState(event.data.object as Stripe.Account);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = relationId(charge.payment_intent);
      if (paymentIntentId) {
        await recoverSellerTransfers({
          paymentIntentId,
          chargeAmountCents: charge.amount,
          recoveryAmountCents: charge.amount_refunded,
          reason: "refund",
          orderId: charge.metadata?.order_id,
        });
      }
      await updateOrderByPaymentIntent(
        paymentIntentId,
        {
          payment_status: charge.amount_refunded >= charge.amount ? "refunded" : "partially_refunded",
          fulfillment_status: "attention"
        },
        charge.metadata?.order_id
      );
    } else if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = relationId(dispute.payment_intent);
      const charge = typeof dispute.charge === "string"
        ? await getStripe().charges.retrieve(dispute.charge)
        : dispute.charge;
      if (paymentIntentId && charge) {
        await recoverSellerTransfers({
          paymentIntentId,
          chargeAmountCents: charge.amount,
          recoveryAmountCents: dispute.amount,
          reason: "dispute",
        });
      }
      await updateOrderByPaymentIntent(paymentIntentId, {
        payment_status: "disputed",
        fulfillment_status: "attention",
        payment_error: `Stripe-riitautus ${dispute.id}`
      });
    } else {
      await finishEvent(event.id, "ignored");
      return NextResponse.json({ received: true, ignored: true });
    }
    await finishEvent(event.id, "completed");
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook ${event.id} failed`, error);
    await getSupabaseAdmin().from("stripe_webhook_events").upsert({
      stripe_event_id: event.id,
      type: event.type,
      connected_account_id: event.account ?? null,
      processing_status: "failed",
      processed_at: new Date().toISOString(),
      error_message: String(error instanceof Error ? error.message : error).slice(0, 2000)
    }, { onConflict: "stripe_event_id" });
    return NextResponse.json({ error: "Webhookin käsittely epäonnistui." }, { status: 500 });
  }
}
