import "server-only";

import type { PublicStorefront } from "@/lib/commerce/types";
import { companyRecord } from "@/lib/commerce/company-record";
import { resolvePublicProfile } from "@/lib/public-profile-route";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function getPublicStorefront(identifier: string): Promise<PublicStorefront | null> {
  const admin = getSupabaseAdmin();
  const profile = await resolvePublicProfile(identifier);
  if (!profile || profile.accountType !== "company") return null;
  const ownerId = profile.id;

  const { data, error } = await admin
    .from("companies")
    .select("*")
    .eq("owner_user_id", ownerId)
    .maybeSingle<Record<string, unknown>>();
  if (error || !data) return null;
  const company = companyRecord(data);
  return {
    company_id: company.id,
    owner_user_id: company.owner_user_id,
    name: company.name,
    description: company.description,
    business_id: company.business_id,
    address_line: company.address_line,
    postal_code: company.postal_code,
    city: company.city,
    country: company.country,
    email: company.email,
    phone: company.phone,
    contact_person: company.contact_person,
    verified_at: company.verified_at,
    created_at: company.created_at,
    website: company.website,
    banner_image_url: company.banner_image_url,
    social_share_image_url: company.social_share_image_url,
    storefront_headline: company.storefront_headline,
    storefront_categories: company.storefront_categories,
    storefront_promo_enabled: company.storefront_promo_enabled,
    storefront_promo_title: company.storefront_promo_title,
    storefront_promo_subtitle: company.storefront_promo_subtitle,
    storefront_promo_image_url: company.storefront_promo_image_url,
    storefront_promo_background_color: company.storefront_promo_background_color,
    shipping_price_strategy: company.shipping_price_strategy,
    default_shipping_price_fi_cents: company.default_shipping_price_fi_cents,
    default_shipping_price_se_cents: company.default_shipping_price_se_cents,
    default_shipping_price_no_cents: company.default_shipping_price_no_cents,
    posti_enabled: company.posti_enabled,
    shipping_countries: company.shipping_countries,
    pickup_email_message: company.pickup_email_message,
    free_shipping_threshold_cents: company.free_shipping_threshold_cents
  };
}
