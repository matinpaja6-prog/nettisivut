import "server-only";

import type Stripe from "stripe";

import { sendAuthEmail } from "@/lib/auth-email-sender";
import { closePaidOrderProducts } from "@/lib/commerce/close-paid-products";
import { sendCombinedCheckoutEmail, sendPaidOrderEmails } from "@/lib/commerce/emails";
import { allocateActualStripeFee } from "@/lib/commerce/fees";
import type { Company, Order, OrderItem } from "@/lib/commerce/types";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeEmailLocale } from "@/lib/email-template";

function relationId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function loadPlatformChargeCosts(paymentIntentId: string) {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = typeof paymentIntent.latest_charge === "string"
    ? await stripe.charges.retrieve(paymentIntent.latest_charge, { expand: ["balance_transaction"] })
    : paymentIntent.latest_charge;
  if (!charge) throw new Error("Maksetulta Stripe-maksulta puuttuu veloitus.");

  const balanceTransaction = typeof charge.balance_transaction === "string"
    ? await stripe.balanceTransactions.retrieve(charge.balance_transaction)
    : charge.balance_transaction;
  if (!balanceTransaction) {
    throw new Error("Stripen toteutunut käsittelykulu ei ole vielä saatavilla. Tilitystä yritetään uudelleen.");
  }

  return {
    chargeId: charge.id,
    paymentMethodType: charge.payment_method_details?.type ?? null,
    stripeFeeCents: Math.max(0, balanceTransaction.fee),
  };
}

function warningText(...values: Array<string | null | undefined>) {
  const parts = values
    .flatMap((value) => value?.split(" | ") ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(parts)].join(" | ").slice(0, 2000);
}

function withoutWarnings(value: string | null | undefined, prefixes: string[]) {
  return (value?.split(" | ") ?? [])
    .map((part) => part.trim())
    .filter((part) => part && !prefixes.some((prefix) => part.startsWith(prefix)))
    .join(" | ");
}

const NOTIFICATION_WARNING_PREFIXES = [
  "Sähköposti:",
  "Myyjän tilausvahvistus odottaa uutta yritystä:",
  "Tilaus on maksettu, mutta tilausvahvistuksen lähetys odottaa uutta yritystä:",
];

async function saveActualStripeCosts(
  orderId: string,
  paymentIntentId: string,
  connectedAccountId: string | null,
) {
  if (!connectedAccountId) return;

  try {
    const stripe = getStripe();
    const options = { stripeAccount: connectedAccountId };
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge.balance_transaction"] },
      options,
    );
    const charge = typeof paymentIntent.latest_charge === "string"
      ? await stripe.charges.retrieve(
          paymentIntent.latest_charge,
          { expand: ["balance_transaction"] },
          options,
        )
      : paymentIntent.latest_charge;
    if (!charge) return;

    const balanceTransaction = typeof charge.balance_transaction === "object"
      ? charge.balance_transaction
      : null;
    const stripeFeeDetails = balanceTransaction?.fee_details?.filter(
      (detail) => detail.type === "stripe_fee",
    ) ?? [];
    const detailedStripeFee = stripeFeeDetails.reduce((sum, detail) => sum + detail.amount, 0);
    const fallbackStripeFee = balanceTransaction
      ? Math.max(0, balanceTransaction.fee - (paymentIntent.application_fee_amount ?? 0))
      : null;
    const stripeProcessingFee = detailedStripeFee > 0 ? detailedStripeFee : fallbackStripeFee;

    const { error } = await getSupabaseAdmin().from("orders").update({
      stripe_payment_method_type: charge.payment_method_details?.type ?? null,
      stripe_processing_fee_cents: stripeProcessingFee,
    }).eq("id", orderId);
    if (error) throw error;
  } catch (error) {
    console.error(`Order ${orderId} Stripe fee lookup failed`, error);
  }
}

async function notifyStockProblem(orderId: string, detail: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("orders")
    .select("order_number,customer_email,company:companies(email,name)")
    .eq("id", orderId)
    .maybeSingle<Record<string, unknown>>();
  const company = data?.company as { email?: string; name?: string } | null;
  const recipients = Array.from(new Set([
    company?.email,
    process.env.COMMERCE_ADMIN_EMAIL,
    process.env.CONTACT_TO_EMAIL,
  ].filter((email): email is string => Boolean(email))));
  const message = `Maksu onnistui, mutta tilauksen varastosaldo ei riittänyt.\nTilaus: ${String(data?.order_number ?? orderId)}\n${detail}\nTilaus vaatii välitöntä manuaalista käsittelyä.`;
  await Promise.allSettled(recipients.map((to) => sendAuthEmail({
    to,
    subject: "Maskines-tilaus vaatii käsittelyä",
    text: message,
    html: `<div style="font-family:Arial,sans-serif"><h1>Tilaus vaatii käsittelyä</h1><p>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p></div>`,
    branding: "neutral",
  })));
}

export async function completePaidCheckoutSession(input: {
  session: Stripe.Checkout.Session;
  eventId: string;
  eventType: string;
  connectedAccountId: string | null;
}) {
  const { session, eventId, eventType, connectedAccountId } = input;
  if (session.payment_status !== "paid") return { status: "not_paid" };

  const checkoutGroupId = session.metadata?.checkout_group_id;
  if (checkoutGroupId) {
    return completePaidCheckoutGroup({ session, checkoutGroupId, eventId, eventType });
  }

  const orderId = session.metadata?.order_id;
  if (!orderId) throw new Error("Checkout Sessionilta puuttuu order_id-metadata.");
  const paymentIntentId = relationId(session.payment_intent);
  if (!paymentIntentId) throw new Error("Checkout Sessionilta puuttuu PaymentIntent.");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("maskines_complete_paid_order", {
    target_order_id: orderId,
    target_event_id: eventId,
    target_event_type: eventType,
    target_connected_account_id: connectedAccountId,
    target_payment_intent_id: paymentIntentId,
  });
  if (error) throw error;
  const result = data as { status?: string; message?: string } | null;

  if (result?.status === "stock_shortage") {
    await notifyStockProblem(orderId, result.message ?? "Varastosaldo ei riitä.");
    return result;
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("*,order_items(*)")
    .eq("id", orderId)
    .single<Order>();
  if (orderError) throw orderError;
  order.customer_locale = normalizeEmailLocale(order.customer_locale ?? session.metadata?.locale);

  // A repeated delivery or browser-side recovery may see the event as a
  // duplicate. Continue only when the database already confirms the payment.
  if (order.payment_status !== "paid") return result ?? { status: "ignored" };

  await saveActualStripeCosts(orderId, paymentIntentId, connectedAccountId);

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("*")
    .eq("id", order.company_id)
    .single<Company>();
  if (companyError) throw companyError;
  const orderItems = (order.order_items ?? []) as OrderItem[];

  let productCleanupWarning = "";
  try {
    await closePaidOrderProducts({ order, items: orderItems, company });
  } catch (cleanupError) {
    productCleanupWarning = `Tuotteen myyntitilan päivitys vaatii tarkistuksen: ${String(cleanupError instanceof Error ? cleanupError.message : cleanupError).slice(0, 900)}`;
    console.error(`Order ${orderId} product cleanup failed`, cleanupError);
    await admin.from("orders").update({ fulfillment_status: "attention", payment_error: productCleanupWarning }).eq("id", orderId);
  }

  if (order.receipt_sent_at && order.seller_notified_at) {
    return { status: result?.status ?? "already_paid" };
  }

  try {
    const { data: receipt, error: receiptError } = await admin
      .from("receipts")
      .select("receipt_number")
      .eq("order_id", order.id)
      .single<{ receipt_number: string }>();
    if (receiptError) throw receiptError;

    const emailResult = await sendPaidOrderEmails({
      order,
      items: orderItems,
      company,
      receiptNumber: receipt.receipt_number,
      sendBuyer: !order.receipt_sent_at,
      sendSeller: !order.seller_notified_at,
      customerDelivery: {
        address: [session.customer_details?.address?.line1, session.customer_details?.address?.line2].filter(Boolean).join(", ") || null,
        postalCode: session.customer_details?.address?.postal_code ?? null,
        city: session.customer_details?.address?.city ?? null,
        country: session.customer_details?.address?.country ?? null,
      },
    });
    await admin.from("orders").update({
      receipt_sent_at: emailResult.buyerSent ? new Date().toISOString() : order.receipt_sent_at,
      seller_notified_at: emailResult.sellerSent ? new Date().toISOString() : order.seller_notified_at,
      payment_error: [productCleanupWarning, emailResult.errors.length ? `Sähköposti: ${emailResult.errors.join("; ").slice(0, 1500)}` : ""].filter(Boolean).join(" | ") || null,
    }).eq("id", order.id);
    if (emailResult.buyerSent) {
      await admin.from("receipts").update({ email_sent_at: new Date().toISOString() }).eq("order_id", order.id);
    }
  } catch (notificationError) {
    console.error(`Order ${orderId} notification failed`, notificationError);
    await admin.from("orders").update({
      payment_error: `Maksu käsiteltiin, mutta kuitti-ilmoitus epäonnistui: ${String(notificationError instanceof Error ? notificationError.message : notificationError).slice(0, 1200)}`,
    }).eq("id", orderId);
  }

  return { status: result?.status ?? "paid" };
}

async function completePaidCheckoutGroup(input: {
  session: Stripe.Checkout.Session;
  checkoutGroupId: string;
  eventId: string;
  eventType: string;
}) {
  const paymentIntentId = relationId(input.session.payment_intent);
  if (!paymentIntentId) throw new Error("Checkout Sessionilta puuttuu PaymentIntent.");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("maskines_complete_paid_checkout_group", {
    target_checkout_group_id: input.checkoutGroupId,
    target_event_id: input.eventId,
    target_event_type: input.eventType,
    target_payment_intent_id: paymentIntentId
  });
  if (error) throw error;
  const result = data as { status?: string; message?: string } | null;
  if (result?.status === "stock_shortage") {
    const { data: firstOrder } = await admin.from("orders").select("id").eq("checkout_group_id", input.checkoutGroupId).limit(1).maybeSingle<{ id: string }>();
    if (firstOrder) await notifyStockProblem(firstOrder.id, result.message ?? "Varastosaldo ei riitä.");
    return result;
  }

  const { data: checkout, error: checkoutError } = await admin.from("checkout_groups").select("*").eq("id", input.checkoutGroupId)
    .single<{
      id: string;
      checkout_number: string;
      customer_email: string;
      customer_address: string | null;
      customer_postal_code: string | null;
      customer_city: string | null;
      customer_country: string | null;
      customer_locale?: "fi" | "en" | "sv" | "no" | null;
      payment_status: string;
      receipt_sent_at: string | null;
    }>();
  if (checkoutError) throw checkoutError;
  if (checkout.payment_status !== "paid") return result ?? { status: "ignored" };
  const { data: orders, error: ordersError } = await admin.from("orders").select("*,order_items(*),company:companies(*)")
    .eq("checkout_group_id", input.checkoutGroupId).order("created_at").returns<Array<Order & { company: Company }>>();
  if (ordersError) throw ordersError;

  // The platform charge covers every seller in this checkout. Stripe bills
  // the whole processing fee to Maskines, so allocate the exact fee across
  // orders before transferring anything. This leaves the platform the full
  // configured 1% fee after Stripe's fee has been paid.
  const chargeCosts = await loadPlatformChargeCosts(paymentIntentId);
  const stripeFeeAllocations = allocateActualStripeFee(
    (orders ?? []).map((order) => ({ id: order.id, grossCents: order.total_cents })),
    chargeCosts.stripeFeeCents,
  );
  for (const order of orders ?? []) {
    const allocatedStripeFee = stripeFeeAllocations.get(order.id) ?? 0;
    const sellerTransferCents = order.total_cents - order.maskines_fee_cents - allocatedStripeFee;
    if (sellerTransferCents < 0) {
      throw new Error(`Tilauksen ${order.order_number} summa ei kata Stripe-kulua ja Maskines-komissiota.`);
    }
    order.stripe_processing_fee_cents = allocatedStripeFee;
    order.stripe_payment_method_type = chargeCosts.paymentMethodType;
    order.seller_transfer_cents = sellerTransferCents;
    const { error: feeUpdateError } = await admin.from("orders").update({
      stripe_processing_fee_cents: allocatedStripeFee,
      stripe_payment_method_type: chargeCosts.paymentMethodType,
      seller_transfer_cents: sellerTransferCents,
    }).eq("id", order.id);
    if (feeUpdateError) throw feeUpdateError;
  }

  // Buyer notification is independent of seller payouts. Send it before
  // attempting transfers so an invalid Connect account cannot delay a paid
  // order's confirmation and receipts.
  if (!checkout.receipt_sent_at && orders?.length) {
    try {
      const { data: receipts, error: receiptsError } = await admin
        .from("receipts")
        .select("order_id,receipt_number")
        .in("order_id", orders.map((order) => order.id))
        .returns<Array<{ order_id: string; receipt_number: string }>>();
      if (receiptsError) throw receiptsError;
      const receiptNumbers = new Map((receipts ?? []).map((receipt) => [receipt.order_id, receipt.receipt_number]));
      await sendCombinedCheckoutEmail({
        checkoutNumber: checkout.checkout_number,
        customerEmail: checkout.customer_email,
        customerLocale: normalizeEmailLocale(checkout.customer_locale ?? input.session.metadata?.locale),
        customerDelivery: {
          address: checkout.customer_address,
          postalCode: checkout.customer_postal_code,
          city: checkout.customer_city,
          country: checkout.customer_country,
        },
        orders: orders.map((order) => ({
          order,
          items: (order.order_items ?? []) as OrderItem[],
          company: order.company,
          receiptNumber: receiptNumbers.get(order.id) ?? order.order_number,
        })),
      });
      const now = new Date().toISOString();
      const { error: groupUpdateError } = await admin.from("checkout_groups").update({ receipt_sent_at: now, payment_error: null }).eq("id", input.checkoutGroupId);
      if (groupUpdateError) throw groupUpdateError;
      for (const order of orders) {
        order.receipt_sent_at = now;
        order.payment_error = withoutWarnings(order.payment_error, NOTIFICATION_WARNING_PREFIXES) || null;
        const { error: orderUpdateError } = await admin.from("orders").update({
          receipt_sent_at: now,
          payment_error: order.payment_error,
        }).eq("id", order.id);
        if (orderUpdateError) throw orderUpdateError;
      }
      const { error: receiptUpdateError } = await admin.from("receipts").update({ email_sent_at: now }).in("order_id", orders.map((order) => order.id));
      if (receiptUpdateError) throw receiptUpdateError;
    } catch (notificationError) {
      const message = `Tilaus on maksettu, mutta tilausvahvistuksen lähetys odottaa uutta yritystä: ${String(notificationError instanceof Error ? notificationError.message : notificationError).slice(0, 1000)}`;
      console.error(`Checkout group ${input.checkoutGroupId} buyer notification failed`, notificationError);
      await admin.from("checkout_groups").update({ payment_error: message }).eq("id", input.checkoutGroupId);
      for (const order of orders) {
        await admin.from("orders").update({ payment_error: warningText(order.payment_error, message) }).eq("id", order.id);
      }
    }
  }

  const stripe = getStripe();
  const sourceChargeId = chargeCosts.chargeId;
  for (const order of orders ?? []) {
    order.customer_locale = normalizeEmailLocale(
      order.customer_locale ?? checkout.customer_locale ?? input.session.metadata?.locale
    );
    const company = order.company;
    const items = (order.order_items ?? []) as OrderItem[];
    let processingWarning = order.payment_error ?? "";
    try {
      await closePaidOrderProducts({ order, items, company });
    } catch (cleanupError) {
      processingWarning = warningText(processingWarning, `Tuotteen myyntitilan päivitys vaatii tarkistuksen: ${String(cleanupError instanceof Error ? cleanupError.message : cleanupError).slice(0, 900)}`);
      console.error(`Order ${order.id} product cleanup failed`, cleanupError);
      await admin.from("orders").update({ fulfillment_status: "attention", payment_error: processingWarning }).eq("id", order.id);
    }
    if (!order.seller_notified_at) {
      try {
        const { data: receipt, error: receiptError } = await admin.from("receipts").select("receipt_number").eq("order_id", order.id).maybeSingle<{ receipt_number: string }>();
        if (receiptError) throw receiptError;
        const sent = await sendPaidOrderEmails({
          order,
          items,
          company,
          receiptNumber: receipt?.receipt_number ?? order.order_number,
          sendBuyer: false,
          sendSeller: true,
          customerDelivery: {
            address: checkout.customer_address,
            postalCode: checkout.customer_postal_code,
            city: checkout.customer_city,
            country: checkout.customer_country,
          },
        });
        if (sent.sellerSent) {
          processingWarning = withoutWarnings(processingWarning, NOTIFICATION_WARNING_PREFIXES);
          order.seller_notified_at = new Date().toISOString();
          order.payment_error = processingWarning || null;
          const { error: sellerUpdateError } = await admin.from("orders").update({
            seller_notified_at: order.seller_notified_at,
            payment_error: order.payment_error,
          }).eq("id", order.id);
          if (sellerUpdateError) throw sellerUpdateError;
        }
        if (sent.errors.length) {
          processingWarning = warningText(processingWarning, `Sähköposti: ${sent.errors.join("; ").slice(0, 1500)}`);
          await admin.from("orders").update({ payment_error: processingWarning }).eq("id", order.id);
        }
      } catch (sellerNotificationError) {
        processingWarning = warningText(
          processingWarning,
          `Myyjän tilausvahvistus odottaa uutta yritystä: ${String(sellerNotificationError instanceof Error ? sellerNotificationError.message : sellerNotificationError).slice(0, 1000)}`,
        );
        console.error(`Order ${order.id} seller notification failed`, sellerNotificationError);
        await admin.from("orders").update({ payment_error: processingWarning }).eq("id", order.id);
      }
    }
    // Payout is intentionally last: confirmation emails must not depend on a
    // connected account being valid in the current Stripe environment.
    if (!order.stripe_transfer_id && company.stripe_account_id && (order.seller_transfer_cents ?? 0) > 0) {
      try {
        const transfer = await stripe.transfers.create({
          amount: order.seller_transfer_cents!, currency: "eur", destination: company.stripe_account_id,
          transfer_group: input.checkoutGroupId,
          ...(sourceChargeId ? { source_transaction: sourceChargeId } : {}),
          metadata: { order_id: order.id, checkout_group_id: input.checkoutGroupId }
        }, { idempotencyKey: `checkout-${input.checkoutGroupId}-order-${order.id}` });
        processingWarning = withoutWarnings(processingWarning, ["Myyjän tilitys epäonnistui:"]);
        await admin.from("orders").update({
          stripe_transfer_id: transfer.id,
          stripe_transfer_status: "paid",
          payment_error: processingWarning || null,
        }).eq("id", order.id);
      } catch (transferError) {
        console.error(`Order ${order.id} transfer failed`, transferError);
        const invalidDestination = /no such destination|account.*does not exist|invalid.*account/i.test(String(transferError));
        const payoutMessage = invalidDestination
          ? "Tilitystili pitää yhdistää uudelleen. Maksu on vastaanotettu, mutta tilitys odottaa uusia Stripe Connect -tietoja."
          : "Tilitys odottaa uudelleenkäsittelyä. Maksu on vastaanotettu normaalisti.";
        processingWarning = warningText(processingWarning, payoutMessage);
        await admin.from("orders").update({ stripe_transfer_status: "failed", payment_error: processingWarning }).eq("id", order.id);
        if (invalidDestination) {
          await admin.from("companies").update({ stripe_account_id: null, stripe_details_submitted: false, stripe_charges_enabled: false, stripe_payouts_enabled: false, stripe_requirements_due: ["Yhdistä Stripe Connect uudelleen"] }).eq("id", company.id);
        }
      }
    }
  }
  return { status: result?.status ?? "paid" };
}
