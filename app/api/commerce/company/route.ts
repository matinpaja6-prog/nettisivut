import { NextResponse } from "next/server";

import type { Company } from "@/lib/commerce/types";
import {
  COMPANY_MODERN_COLUMNS,
  cleanStorefrontCategories,
  companyRecord,
  isMissingCompanyColumn
} from "@/lib/commerce/company-record";
import { companyProfileErrors } from "@/lib/commerce/validation";
import { normalizeCountryCode } from "@/lib/country-code";
import { isFeeEstimateMethod } from "@/lib/commerce/fees";
import { VAT_RATE_OPTIONS, ZERO_VAT_RATE } from "@/lib/commerce/vat";
import {
  errorResponse,
  normalizeMultiline,
  normalizeText,
  optionalText,
  requireCommerceUser
} from "@/lib/commerce/server";

type CompanyBody = Partial<Company> & { action?: "submit-verification" };

function imageUrl(value: unknown) {
  const url = optionalText(value, 1000);
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function colorValue(value: unknown) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "#ff6500";
}

function defaultVatRate(value: unknown) {
  const rate = Number(value);
  return VAT_RATE_OPTIONS.some((option) => option.value === rate) ? rate : ZERO_VAT_RATE;
}

async function ensureCompany(
  admin: Awaited<ReturnType<typeof requireCommerceUser>>["admin"],
  userId: string,
  userEmail: string
) {
  const { data: existing, error: existingError } = await admin
    .from("companies")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle<Record<string, unknown>>();
  if (existingError) throw existingError;
  const normalizedExisting = existing ? companyRecord(existing) : null;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("account_type,company_name,business_id,company_website,email,phone,address,postal_code,city,country,first_name,last_name,bio,company_verified_at")
    .eq("id", userId)
    .maybeSingle<Record<string, string | null>>();
  if (profileError) throw profileError;
  if (profile?.account_type !== "company") {
    throw new Error("Yrityksen hallinta on käytettävissä vain yritystileille.");
  }
  if (!profile.company_verified_at) {
    throw new Error("Vahvista yritys ennen Yrityksen hallinnan käyttöä.");
  }

  // The original Maskines company verification lives on profiles. Keep the
  // commerce company in sync so an already approved company does not need a
  // second manual approval in the new sales dashboard.
  if (
    normalizedExisting &&
    profile.company_verified_at &&
    normalizedExisting.verification_status !== "approved" &&
    normalizedExisting.verification_status !== "suspended"
  ) {
    const { data: synced, error: syncError } = await admin
      .from("companies")
      .update({
        verification_status: "approved",
        verification_notes: null,
        verified_at: profile.company_verified_at
      })
      .eq("id", normalizedExisting.id)
      .eq("owner_user_id", userId)
      .select("*")
      .single<Record<string, unknown>>();
    if (syncError) throw syncError;
    return companyRecord(synced);
  }
  if (normalizedExisting) return normalizedExisting;

  const { data, error } = await admin
    .from("companies")
    .insert({
      owner_user_id: userId,
      name: profile.company_name ?? "",
      business_id: profile.business_id ?? "",
      address_line: profile.address ?? "",
      postal_code: profile.postal_code ?? "",
      city: profile.city ?? "",
      country: normalizeCountryCode(profile.country, "FI"),
      email: profile.email || userEmail,
      phone: profile.phone ?? "",
      contact_person: [profile.first_name, profile.last_name].filter(Boolean).join(" "),
      website: profile.company_website,
      description: profile.bio ?? "",
      verification_status: profile.company_verified_at ? "approved" : "draft",
      verified_at: profile.company_verified_at
    })
    .select("*")
    .single<Record<string, unknown>>();
  if (error) throw error;
  return companyRecord(data);
}

export async function GET(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await ensureCompany(admin, user.id, user.email ?? "");
    return NextResponse.json({
      company: {
        ...company,
        default_vat_rate: defaultVatRate(user.user_metadata?.commerce_default_vat_rate ?? company.default_vat_rate)
      }
    });
  } catch (error) {
    return errorResponse(error, "Yritystietojen lataaminen epäonnistui.");
  }
}

export async function PUT(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const current = await ensureCompany(admin, user.id, user.email ?? "");
    const body = (await request.json().catch(() => ({}))) as CompanyBody;

    if (body.action === "submit-verification") {
      const errors = companyProfileErrors(current);
      if (errors.length) {
        return NextResponse.json({ error: errors[0], errors }, { status: 400 });
      }
      if (current.verification_status === "suspended") {
        return NextResponse.json(
          { error: "Keskeytettyä yritystä ei voi lähettää uudelleen tarkistettavaksi." },
          { status: 403 }
        );
      }

      const { data, error } = await admin
        .from("companies")
        .update({ verification_status: "pending", verification_notes: null })
        .eq("id", current.id)
        .eq("owner_user_id", user.id)
        .select("*")
        .single<Record<string, unknown>>();
      if (error) throw error;
      return NextResponse.json({ company: companyRecord(data) });
    }

    const next = {
      name: normalizeText(body.name, 160),
      business_id: normalizeText(body.business_id, 80),
      vat_id: optionalText(body.vat_id, 80),
      address_line: normalizeText(body.address_line, 180),
      postal_code: normalizeText(body.postal_code, 40),
      city: normalizeText(body.city, 100),
      country: normalizeCountryCode(body.country, "FI"),
      email: normalizeText(body.email, 180).toLowerCase(),
      phone: normalizeText(body.phone, 40),
      contact_person: normalizeText(body.contact_person, 160),
      website: optionalText(body.website, 240),
      description: normalizeMultiline(body.description, 3000),
      shipping_price_strategy: body.shipping_price_strategy === "sum" ? "sum" : "max",
      default_shipping_price_fi_cents: body.default_shipping_price_fi_cents === null || body.default_shipping_price_fi_cents === undefined
        ? null
        : Math.max(0, Math.min(1_000_000, Math.round(Number(body.default_shipping_price_fi_cents) || 0))),
      default_shipping_price_se_cents: body.default_shipping_price_se_cents === null || body.default_shipping_price_se_cents === undefined
        ? null
        : Math.max(0, Math.min(1_000_000, Math.round(Number(body.default_shipping_price_se_cents) || 0))),
      default_shipping_price_no_cents: body.default_shipping_price_no_cents == null ? null : Math.max(0, Math.min(1_000_000, Math.round(Number(body.default_shipping_price_no_cents) || 0))),
      shipping_countries: Array.from(new Set((Array.isArray(body.shipping_countries) ? body.shipping_countries : ["FI"]).map((country) => String(country).toUpperCase()).filter((country) => ["FI", "SE", "NO"].includes(country)))),
      posti_enabled: body.posti_enabled !== false,
      pickup_email_message: normalizeMultiline(body.pickup_email_message, 1800),
      fee_pricing_strategy: body.fee_pricing_strategy === "include" ? "include" : "deduct",
      fee_estimate_method: isFeeEstimateMethod(body.fee_estimate_method)
        ? body.fee_estimate_method
        : "card_standard",
      default_vat_rate: defaultVatRate(body.default_vat_rate),
      banner_image_url: imageUrl(body.banner_image_url),
      social_share_image_url: imageUrl(body.social_share_image_url),
      storefront_headline: normalizeText(body.storefront_headline, 180),
      storefront_categories: cleanStorefrontCategories(body.storefront_categories),
      storefront_promo_enabled: body.storefront_promo_enabled === true,
      storefront_promo_title: normalizeText(body.storefront_promo_title, 120),
      storefront_promo_subtitle: normalizeText(body.storefront_promo_subtitle, 180),
      storefront_promo_image_url: imageUrl(body.storefront_promo_image_url),
      storefront_promo_background_color: colorValue(body.storefront_promo_background_color),
      free_shipping_threshold_cents: body.free_shipping_threshold_cents === null || body.free_shipping_threshold_cents === undefined
        ? null
        : Math.max(0, Math.round(Number(body.free_shipping_threshold_cents) || 0))
    };
    const identityChanged = next.name !== current.name ||
      next.business_id !== current.business_id ||
      next.vat_id !== current.vat_id;
    const verification_status = identityChanged && current.verification_status !== "suspended"
      ? "draft"
      : current.verification_status;

    let { data, error } = await admin
      .from("companies")
      .update({ ...next, verification_status })
      .eq("id", current.id)
      .eq("owner_user_id", user.id)
      .select("*")
      .single<Record<string, unknown>>();
    let warning = "";
    if (error && isMissingCompanyColumn(error) && /default_vat_rate/i.test(error.message ?? "")) {
      const { default_vat_rate: _defaultVatRate, ...compatibleNext } = next;
      void _defaultVatRate;
      const compatibleResult = await admin
        .from("companies")
        .update({ ...compatibleNext, verification_status })
        .eq("id", current.id)
        .eq("owner_user_id", user.id)
        .select("*")
        .single<Record<string, unknown>>();
      data = compatibleResult.data;
      error = compatibleResult.error;
    }
    if (error && isMissingCompanyColumn(error)) {
      const legacyNext = Object.fromEntries(
        Object.entries(next).filter(([key]) => !COMPANY_MODERN_COLUMNS.includes(key as typeof COMPANY_MODERN_COLUMNS[number]))
      );
      const legacyResult = await admin
        .from("companies")
        .update({ ...legacyNext, verification_status })
        .eq("id", current.id)
        .eq("owner_user_id", user.id)
        .select("*")
        .single<Record<string, unknown>>();
      data = legacyResult.data;
      error = legacyResult.error;
      warning = "Perustiedot tallennettiin. Aja uusimmat commerce-migraatiot, jotta kuva-, kategoria-, kulu- ja noutoviestiasetukset tallentuvat.";
    }
    if (error) throw error;

    // Keep the existing public company profile in sync with the commerce
    // dashboard. Visual storefront fields stay on companies and are exposed by
    // the public storefront endpoint.
    const profileUpdate: Record<string, unknown> = {
      company_name: next.name,
      business_id: next.business_id,
      company_website: next.website,
      bio: next.description,
      phone: next.phone,
      address: next.address_line,
      postal_code: next.postal_code,
      city: next.city,
      country: next.country
    };
    if (identityChanged) profileUpdate.company_verified_at = null;
    const { error: profileError } = await admin.from("profiles").update(profileUpdate).eq("id", user.id);
    if (profileError) console.error("Company public profile sync failed", profileError);

    const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        commerce_default_vat_rate: next.default_vat_rate
      }
    });
    if (metadataError) console.error("Company VAT default metadata sync failed", metadataError);

    return NextResponse.json({
      company: { ...companyRecord(data!), default_vat_rate: next.default_vat_rate },
      warning: warning || undefined
    });
  } catch (error) {
    return errorResponse(error, "Yritystietojen tallentaminen epäonnistui.");
  }
}
