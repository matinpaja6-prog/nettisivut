import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { sendGmailMessage } from "@/lib/gmail";
import { getListingPartNumber, type Listing } from "@/lib/listings";
import {
  notificationEmailLocale,
  searchAlertEmail
} from "@/lib/notification-emails";
import { listingPath, listingUrlId, pagePath } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";
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

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
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

export async function POST(request: Request) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY puuttuu, hakuvahteja ei voi käsitellä serveriltä." },
      { status: 500 }
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Kirjautuminen vaaditaan." }, { status: 401 });
  }

  const { data: callerAuth, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerAuth.user) {
    return NextResponse.json({ error: "Istunto ei ole voimassa." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { listingId?: unknown };
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) {
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

  if (listing.seller_id !== callerAuth.user.id) {
    return NextResponse.json({ error: "Ei oikeutta käsitellä tätä ilmoitusta." }, { status: 403 });
  }

  const { data: alerts, error: alertsError } = await admin
    .from("search_alerts")
    .select("*")
    .eq("is_active", true)
    .returns<SearchAlert[]>();

  if (alertsError) {
    return NextResponse.json({ error: alertsError.message }, { status: 500 });
  }

  const listingUrl = absoluteSiteUrl(listingPath(listingUrlId(listing)));
  const results: NotifyResult[] = [];

  for (const alert of alerts ?? []) {
    if (!matchesAlert(alert, listing)) continue;

    let notificationCreated = false;
    const { data: existing } = await admin
      .from("alert_notifications")
      .select("id")
      .eq("alert_id", alert.id)
      .eq("listing_id", listing.id)
      .maybeSingle<Pick<AlertNotification, "id">>();

    if (!existing) {
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

      notificationCreated = true;
    }

    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(alert.user_id);
    const user = userData.user;
    const email = userData.user?.email;

    if (userError || !email) {
      results.push({
        alertId: alert.id,
        notificationCreated,
        emailSent: false,
        error: userError?.message ?? "Käyttäjän sähköpostia ei löytynyt"
      });
      continue;
    }

    if (user?.user_metadata?.search_alert_email_notifications === false) {
      results.push({
        alertId: alert.id,
        notificationCreated,
        emailSent: false
      });
      continue;
    }

    const storedMarkers =
      user?.user_metadata?.search_alert_email_markers;
    const markers =
      storedMarkers &&
      typeof storedMarkers === "object" &&
      !Array.isArray(storedMarkers)
        ? storedMarkers as Record<string, string>
        : {};
    const markerKey = `${alert.id}:${listing.id}`;

    if (markers[markerKey]) {
      results.push({
        alertId: alert.id,
        notificationCreated,
        emailSent: false
      });
      continue;
    }

    const locale = notificationEmailLocale(user?.user_metadata?.locale);
    const localizedListingUrl = absoluteSiteUrl(
      listingPath(listingUrlId(listing), locale)
    );
    const settingsUrl = absoluteSiteUrl(pagePath("settings", locale));
    const emailContent = searchAlertEmail({
      locale,
      alertLabel: alert.label,
      listingTitle: listing.title,
      price: listing.price,
      listingUrl: localizedListingUrl || listingUrl,
      settingsUrl
    });

    try {
      await sendGmailMessage({
        to: email,
        ...emailContent
      });

      const recentMarkers = Object.fromEntries(
        Object.entries(markers).slice(-99)
      );
      await admin.auth.admin.updateUserById(alert.user_id, {
        user_metadata: {
          ...user?.user_metadata,
          search_alert_email_markers: {
            ...recentMarkers,
            [markerKey]: new Date().toISOString()
          }
        }
      });

      results.push({
        alertId: alert.id,
        notificationCreated,
        emailSent: true
      });
    } catch (emailError) {
      results.push({
        alertId: alert.id,
        notificationCreated,
        emailSent: false,
        error:
          emailError instanceof Error
            ? emailError.message
            : "Gmail-lähetys epäonnistui."
      });
    }
  }

  return NextResponse.json({
    ok: true,
    matched: results.length,
    notifications: results.filter((result) => result.notificationCreated).length,
    emails: results.filter((result) => result.emailSent).length
  });
}
