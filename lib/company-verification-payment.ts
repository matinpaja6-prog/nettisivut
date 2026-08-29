import "server-only";

import type Stripe from "stripe";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const COMPANY_VERIFICATION_PRICE_CENTS = 1999;
export const COMPANY_VERIFICATION_CURRENCY = "eur";
export const COMPANY_VERIFICATION_PAYMENT_KIND = "company_verification";

export async function completeCompanyVerificationPayment(
  session: Stripe.Checkout.Session,
  expectedUserId?: string
) {
  const userId = session.metadata?.user_id?.trim() ?? "";
  const correctSession =
    session.metadata?.kind === COMPANY_VERIFICATION_PAYMENT_KIND &&
    session.amount_total === COMPANY_VERIFICATION_PRICE_CENTS &&
    session.currency?.toLowerCase() === COMPANY_VERIFICATION_CURRENCY;

  if (!correctSession || !userId) {
    throw new Error("Yritysvahvistuksen maksutiedot eivät täsmää.");
  }
  if (expectedUserId && expectedUserId !== userId) {
    throw new Error("Maksu ei kuulu kirjautuneelle käyttäjälle.");
  }
  if (session.payment_status !== "paid") {
    throw new Error("Maksu keskeytyi tai epäonnistui. Yritä maksua uudelleen.");
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,account_type,company_verified_at,company_verification_requested_at")
    .eq("id", userId)
    .maybeSingle<{
      id: string;
      account_type: string | null;
      company_verified_at: string | null;
      company_verification_requested_at: string | null;
    }>();

  if (profileError) throw profileError;
  if (!profile || profile.account_type !== "company") {
    throw new Error("Yritystiliä ei löytynyt.");
  }
  if (profile.company_verified_at || profile.company_verification_requested_at) {
    return profile;
  }

  const requestedAt = new Date().toISOString();
  let result = await admin
    .from("profiles")
    .update({
      company_verification_requested_at: requestedAt,
      company_verification_status: "pending",
      company_verification_rejection_reason: null,
      company_verification_decided_at: null,
      company_verification_decided_by: null
    })
    .eq("id", userId)
    .is("company_verified_at", null)
    .is("company_verification_requested_at", null)
    .select("id,account_type,company_verified_at,company_verification_requested_at")
    .single<typeof profile>();

  if (
    result.error &&
    (
      result.error.code === "42703" ||
      result.error.code === "PGRST204" ||
      result.error.message.includes("company_verification_status")
    )
  ) {
    result = await admin
      .from("profiles")
      .update({ company_verification_requested_at: requestedAt })
      .eq("id", userId)
      .is("company_verified_at", null)
      .is("company_verification_requested_at", null)
      .select("id,account_type,company_verified_at,company_verification_requested_at")
      .single<typeof profile>();
  }

  if (result.error) throw result.error;
  return result.data;
}
