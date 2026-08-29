import "server-only";

import type Stripe from "stripe";

import { companyRecord } from "@/lib/commerce/company-record";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export function stripeAccountState(account: Stripe.Account) {
  const requirements = Array.from(new Set([
    ...(account.requirements?.currently_due ?? []),
    ...(account.requirements?.past_due ?? []),
    ...(account.requirements?.pending_verification ?? [])
  ]));

  return {
    stripe_details_submitted: account.details_submitted === true,
    stripe_charges_enabled: account.charges_enabled === true,
    stripe_payouts_enabled: account.payouts_enabled === true,
    stripe_requirements_due: requirements
  };
}

export async function updateCompanyStripeState(account: Stripe.Account) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("companies")
    .update(stripeAccountState(account))
    .eq("stripe_account_id", account.id)
    .select("*")
    .maybeSingle<Record<string, unknown>>();
  if (error) throw error;
  return data ? companyRecord(data) : null;
}
