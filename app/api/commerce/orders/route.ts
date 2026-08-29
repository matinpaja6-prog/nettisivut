import { NextResponse } from "next/server";

import type { Company, Order, OrderItem } from "@/lib/commerce/types";
import { sendFulfillmentUpdateEmail } from "@/lib/commerce/emails";
import { errorResponse, getOwnedCompany, normalizeText, requireCommerceUser } from "@/lib/commerce/server";

const FULFILLMENT_STATUSES = new Set([
  "unfulfilled", "processing", "awaiting_tracking", "ready_for_pickup", "shipped", "completed", "cancelled", "attention"
]);

async function findBuyerUserId(
  admin: Awaited<ReturnType<typeof requireCommerceUser>>["admin"],
  order: Order
) {
  if (order.customer_user_id) return order.customer_user_id;

  const wantedEmail = order.customer_email.trim().toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const buyer = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === wantedEmail);
    if (buyer) return buyer.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function sendMaskinesTrackingMessage(
  admin: Awaited<ReturnType<typeof requireCommerceUser>>["admin"],
  order: Order,
  company: Company
) {
  const buyerId = await findBuyerUserId(admin, order);
  if (!buyerId || buyerId === company.owner_user_id) {
    throw new Error("Ostajan Maskines-käyttäjätiliä ei löytynyt.");
  }

  const firstItem = order.order_items?.[0];
  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .upsert({
      listing_id: order.id,
      buyer_id: buyerId,
      seller_id: company.owner_user_id,
      listing_title: `Tilaus ${order.order_number}`,
      listing_image_url: firstItem?.image_url_snapshot ?? null,
      listing_price: order.total_cents / 100,
      listing_seller_name: company.name,
      expires_at: null
    }, { onConflict: "listing_id,buyer_id,seller_id" })
    .select("id")
    .single<{ id: string }>();
  if (conversationError) throw conversationError;

  const carrier = "Posti";
  const trackingUrl = order.posti_tracking_url || `https://www.posti.fi/fi/seuranta#/lahetys/${encodeURIComponent(order.posti_tracking_code ?? "")}`;
  const productNames = (order.order_items ?? []).map((item) => item.product_name).filter(Boolean).join(", ");
  const content = [
    `Hei ${order.customer_name}! Tilauksesi ${order.order_number} on lähetetty.`,
    productNames ? `Tuotteet: ${productNames}.` : "",
    `${carrier} – seurantakoodi: ${order.posti_tracking_code}.`,
    `Seuraa lähetystä: ${trackingUrl}`,
    `Terveisin ${company.name}`
  ].filter(Boolean).join("\n\n");

  const { error: messageError } = await admin.from("messages").insert({
    conversation_id: conversation.id,
    listing_id: order.id,
    sender_id: company.owner_user_id,
    receiver_id: buyerId,
    content
  });
  if (messageError) throw messageError;
}

export async function GET(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const notificationsOnly = new URL(request.url).searchParams.get("summary") === "notifications";
    const company = await getOwnedCompany(user);
    if (!company) {
      return NextResponse.json(
        notificationsOnly ? { orders: [], companyId: null } : { orders: [] },
        notificationsOnly ? { headers: { "Cache-Control": "no-store, max-age=0" } } : undefined
      );
    }
    if (notificationsOnly) {
      const { data, error } = await admin
        .from("orders")
        .select("id,order_number,customer_name,total_cents,payment_status,fulfillment_status,paid_at,created_at")
        .eq("company_id", company.id)
        .eq("payment_status", "paid")
        .in("fulfillment_status", ["unfulfilled", "attention"])
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return NextResponse.json(
        { orders: data ?? [], companyId: company.id },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }
    const { data, error } = await admin
      .from("orders")
      .select("*,order_items(*)")
      .eq("company_id", company.id)
      .in("payment_status", ["paid", "processing_error", "refunded", "partially_refunded", "disputed"])
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<Order[]>();
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] });
  } catch (error) {
    return errorResponse(error, "Tilausten lataaminen epäonnistui.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) throw new Error("Yritysprofiilia ei löytynyt.");
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const id = normalizeText(body.id, 80);
    const fulfillmentStatus = normalizeText(body.fulfillment_status, 40);
    if (!id || !FULFILLMENT_STATUSES.has(fulfillmentStatus)) {
      return NextResponse.json({ error: "Tilauksen toimitustila on virheellinen." }, { status: 400 });
    }
    const trackingCode = normalizeText(body.posti_tracking_code, 120) || null;
    const explicitTrackingUrl = normalizeText(body.posti_tracking_url, 500) || null;
    const labelUrl = normalizeText(body.shipping_label_url, 500) || null;
    const { data: current, error: currentError } = await admin
      .from("orders")
      .select("*,order_items(*)")
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle<Order>();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: "Tilausta ei löytynyt." }, { status: 404 });
    if (!['paid', 'partially_refunded'].includes(current.payment_status)) {
      return NextResponse.json({ error: "Vain maksetun tilauksen toimitustilaa voi muuttaa." }, { status: 409 });
    }
    const trackingUrl = explicitTrackingUrl || (trackingCode
      ? `https://www.posti.fi/fi/seuranta#/lahetys/${encodeURIComponent(trackingCode)}`
      : null);

    if (fulfillmentStatus === "shipped" && current.shipping_method === "pickup") {
      return NextResponse.json({ error: "Noutotilausta ei voi merkitä lähetetyksi." }, { status: 400 });
    }
    if (fulfillmentStatus === "shipped" && !trackingCode) {
      return NextResponse.json({ error: "Lisää kuljetusyhtiön seurantakoodi ennen lähetetyksi merkitsemistä." }, { status: 400 });
    }
    const explicitNotification = body.send_notification === true;
    const shouldSendTracking = fulfillmentStatus === "shipped" && Boolean(trackingCode) && (
      current.fulfillment_status !== "shipped" ||
      current.posti_tracking_code !== trackingCode ||
      (explicitNotification && !current.tracking_email_sent_at)
    );
    const shouldSendPickupReady = fulfillmentStatus === "ready_for_pickup" && (
      current.fulfillment_status !== "ready_for_pickup" ||
      (explicitNotification && !current.pickup_ready_email_sent_at)
    );
    const { data, error } = await admin
      .from("orders")
      .update({
        fulfillment_status: fulfillmentStatus,
        posti_tracking_code: trackingCode,
        posti_tracking_url: trackingUrl,
        shipping_label_url: labelUrl
      })
      .eq("id", id)
      .eq("company_id", company.id)
      .select("*,order_items(*)")
      .single<Order>();
    if (error) throw error;

    let notificationSent = false;
    let maskinesMessageSent = false;
    let warning = "";
    if (shouldSendTracking || shouldSendPickupReady) {
      if (shouldSendTracking) {
        try {
          await sendMaskinesTrackingMessage(admin, data, company as Company);
          maskinesMessageSent = true;
        } catch (messageError) {
          console.error(`Order ${id} Maskines message failed`, messageError);
          warning = `Tilaus tallennettiin, mutta Maskines-viesti epäonnistui: ${String(messageError instanceof Error ? messageError.message : messageError).slice(0, 240)}`;
        }
      }
      try {
        await sendFulfillmentUpdateEmail({
          order: data,
          items: (data.order_items ?? []) as OrderItem[],
          company: company as Company,
          kind: shouldSendTracking ? "shipped" : "ready_for_pickup"
        });
        notificationSent = true;
        const timestampField = shouldSendTracking ? "tracking_email_sent_at" : "pickup_ready_email_sent_at";
        const { data: timestamped, error: timestampError } = await admin
          .from("orders")
          .update({ [timestampField]: new Date().toISOString() })
          .eq("id", id)
          .eq("company_id", company.id)
          .select("*,order_items(*)")
          .single<Order>();
        if (!timestampError && timestamped) return NextResponse.json({ order: timestamped, notificationSent, maskinesMessageSent, warning: warning || undefined });
        if (timestampError) warning = [warning, "Seurantaviesti lähetettiin, mutta lähetysaikaa ei voitu tallentaa. Aja uusin toimitusmigraatio."].filter(Boolean).join(" ");
      } catch (emailError) {
        console.error(`Order ${id} fulfillment email failed`, emailError);
        warning = [warning, `Ostajan sähköposti epäonnistui: ${String(emailError instanceof Error ? emailError.message : emailError).slice(0, 300)}`].filter(Boolean).join(" ");
      }
    }
    return NextResponse.json({ order: data, notificationSent, maskinesMessageSent, warning: warning || undefined });
  } catch (error) {
    return errorResponse(error, "Tilauksen päivittäminen epäonnistui.");
  }
}
