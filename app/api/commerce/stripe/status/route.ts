import { NextResponse } from "next/server";

import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";
import { updateCompanyStripeState } from "@/lib/commerce/stripe-connect";
import { getStripe } from "@/lib/stripe";

function isUnavailableStripeAccount(error: unknown) {
  const value = error as { code?: string; message?: string };
  return value?.code === "resource_missing"
    || value?.code === "account_invalid"
    || /No such account|does not have access to account|access may have been revoked/i.test(value?.message ?? "");
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company?.stripe_account_id) {
      return NextResponse.json({ company, ready: false });
    }
    const stripe = getStripe();
    let account;
    try {
      account = await stripe.accounts.retrieve(company.stripe_account_id);
    } catch (error) {
      if (!isUnavailableStripeAccount(error)) throw error;
      const { data: updated, error: updateError } = await admin.from("companies").update({
        stripe_account_id: null,
        stripe_details_submitted: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_requirements_due: [],
      }).eq("id", company.id).eq("owner_user_id", user.id).select("*").single();
      if (updateError) throw updateError;
      return NextResponse.json({ company: updated, ready: false, reconnectRequired: true });
    }
    const updated = await updateCompanyStripeState(account);
    return NextResponse.json({
      company: updated,
      ready: Boolean(
        updated?.stripe_details_submitted &&
        updated.stripe_charges_enabled &&
        updated.stripe_payouts_enabled
      )
    });
  } catch (error) {
    return errorResponse(error, "Stripe-tilan päivittäminen epäonnistui.");
  }
}
