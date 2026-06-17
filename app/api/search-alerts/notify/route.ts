import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getListingPartNumber, type Listing } from "@/lib/listings";
import { listingPath, listingUrlId } from "@/lib/routes";
import type { AlertNotification, SearchAlert } from "@/lib/supabase";

type NotifyResult = {
  alertId: string;
  notificationCreated: boolean;
  emailSent: boolean;
  error?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function parseListingYear(listing: Listing) {
  const text = `${listing.title} ${listing.description ?? ""}`;
  const matches = text.match(/\b(19[5-9]\d|20[0-4]\d)\b/g);
  if (!matches?.length) return null;
  return Number(matches[matches.length - 1]);
}

function matchesAlert(alert: SearchAlert, listing: Listing) {
  if (!alert.is_active) return false;
  if (alert.user_id === listing.seller_id) return false;

  if (alert.vehicle_type && alert.vehicle_type !== listing.vehicle_type) return false;
  if (alert.category && alert.category !== listing.category) return false;
  if (alert.subcategory && alert.subcategory !== listing.subcategory) return false;
  if (alert.condition && alert.condition !== listing.condition) return false;
  if (alert.max_price != null && listing.price > alert.max_price) return false;

  const brand = normalize(listing.brand);
  if (alert.brand && !brand.includes(normalize(alert.brand))) return false;

  const year = parseListingYear(listing);
  if (alert.year_min != null && (year == null || year < alert.year_min)) return false;
  if (alert.year_max != null && (year == null || year > alert.year_max)) return false;

  if (alert.query) {
    const term = normalize(alert.query);
    const haystack = normalize(`${listing.title} ${listing.description ?? ""} ${listing.brand ?? ""} ${getListingPartNumber(listing)}`);
    if (!haystack.includes(term)) return false;
  }

  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendAlertEmail(input: {
  to: string;
  alertLabel: string;
  listing: Listing;
  listingUrl: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return { sent: false, error: "RESEND_API_KEY puuttuu" };
  }

  const from = process.env.ALERT_FROM_EMAIL ?? "KelkkaParts <onboarding@resend.dev>";
  const title = escapeHtml(input.listing.title);
  const alertLabel = escapeHtml(input.alertLabel);
  const listingUrl = escapeHtml(input.listingUrl);
  const price = new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(input.listing.price);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Hakuvahti: ${input.listing.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#f8fafc;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <div style="background:#38bdf8;color:#fff;padding:22px 26px;">
              <h1 style="font-size:20px;line-height:1.25;margin:0;">Hakuvahti löysi uuden ilmoituksen</h1>
            </div>
            <div style="padding:26px;">
              <p style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;margin:0 0 6px;">Hakuvahti</p>
              <p style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 22px;">${alertLabel}</p>
              <div style="background:#f8fafc;border:1px solid #e8edf5;border-radius:12px;padding:18px;margin-bottom:22px;">
                <p style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 8px;">${title}</p>
                <p style="font-size:22px;font-weight:800;color:#38bdf8;margin:0;">${price}</p>
              </div>
              <a href="${listingUrl}" style="display:inline-block;background:#38bdf8;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 22px;">Katso ilmoitus</a>
            </div>
          </div>
        </div>
      `
    })
  });

  if (!response.ok) {
    return { sent: false, error: await response.text() };
  }

  return { sent: true };
}

export async function POST(request: Request) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY puuttuu, hakuvahteja ei voi käsitellä serveriltä." },
      { status: 500 }
    );
  }

  const { listingId } = (await request.json()) as { listingId?: string };
  if (!listingId) {
    return NextResponse.json({ error: "listingId puuttuu" }, { status: 400 });
  }

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle<Listing>();

  if (listingError || !listing) {
    return NextResponse.json(
      { error: listingError?.message ?? "Ilmoitusta ei löytynyt" },
      { status: 404 }
    );
  }

  const { data: alerts, error: alertsError } = await admin
    .from("search_alerts")
    .select("*")
    .eq("is_active", true)
    .returns<SearchAlert[]>();

  if (alertsError) {
    return NextResponse.json({ error: alertsError.message }, { status: 500 });
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const listingUrl = `${origin.replace(/\/$/, "")}${listingPath(listingUrlId(listing))}`;
  const results: NotifyResult[] = [];

  for (const alert of alerts ?? []) {
    if (!matchesAlert(alert, listing)) continue;

    const { data: existing } = await admin
      .from("alert_notifications")
      .select("id")
      .eq("alert_id", alert.id)
      .eq("listing_id", listing.id)
      .maybeSingle<Pick<AlertNotification, "id">>();

    if (existing) {
      results.push({ alertId: alert.id, notificationCreated: false, emailSent: false });
      continue;
    }

    const { error: insertError } = await admin
      .from("alert_notifications")
      .insert({
        user_id: alert.user_id,
        alert_id: alert.id,
        listing_id: listing.id,
        listing_title: listing.title,
        listing_price: listing.price,
        listing_image_url: listing.image_url,
        alert_label: alert.label,
        seen: false
      });

    if (insertError) {
      results.push({
        alertId: alert.id,
        notificationCreated: false,
        emailSent: false,
        error: insertError.message
      });
      continue;
    }

    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(alert.user_id);
    const email = userData.user?.email;

    if (userError || !email) {
      results.push({
        alertId: alert.id,
        notificationCreated: true,
        emailSent: false,
        error: userError?.message ?? "Käyttäjän sähköpostia ei löytynyt"
      });
      continue;
    }

    const emailResult = await sendAlertEmail({
      to: email,
      alertLabel: alert.label,
      listing,
      listingUrl
    });

    results.push({
      alertId: alert.id,
      notificationCreated: true,
      emailSent: emailResult.sent,
      error: emailResult.error
    });
  }

  return NextResponse.json({
    ok: true,
    matched: results.length,
    notifications: results.filter((result) => result.notificationCreated).length,
    emails: results.filter((result) => result.emailSent).length,
    results
  });
}
