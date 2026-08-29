import { NextResponse } from "next/server";

import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";
import { updateCompanyStripeState } from "@/lib/commerce/stripe-connect";
import { normalizeCountryCode } from "@/lib/country-code";
import { absoluteStripeConnectUrl } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe";

function isUnavailableStripeAccount(error: unknown) {
  const value = error as { code?: string; message?: string };
  return value?.code === "resource_missing"
    || value?.code === "account_invalid"
    || /No such account|does not have access to account|access may have been revoked/i.test(value?.message ?? "");
}

function stripeConnectError(error: unknown) {
  const value = error as { code?: string; message?: string };
  if (value?.code === "accounts_v2_access_blocked") {
    return new Error("Stripe Connectin Accounts v2 ei ole vielä käytössä tällä Stripe-tilillä. Ota Accounts v2 käyttöön Stripe Dashboardin Connect-asetuksista ja yritä uudelleen.");
  }
  if (/no longer recommends Accounts v1|feat_accounts_v1_support/i.test(value?.message ?? "")) {
    return new Error("Stripe Connect -tilin luontitapa ei ole käytettävissä tällä Stripe-tilillä. Uusi Accounts v2 -yhteys on nyt käytössä; päivitä sivu ja yritä uudelleen.");
  }
  if (/Phone number must follow the format/i.test(value?.message ?? "")) {
    return new Error("Stripe ei hyväksynyt puhelinnumeroa. Puhelinnumero annetaan jatkossa suoraan Stripen turvallisessa vahvistuslomakkeessa; yritä yhdistämistä uudelleen.");
  }
  return error instanceof Error
    ? error
    : new Error("Stripe-yhdistämisen aloittaminen epäonnistui.");
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) {
      return NextResponse.json({ error: "Täytä yritysprofiili ennen Stripe-yhdistämistä." }, { status: 400 });
    }
    if (!new Set(["pending", "approved"]).has(company.verification_status)) {
      return NextResponse.json(
        { error: "Lähetä yritysprofiili ensin Maskinesin tarkistettavaksi." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const country = normalizeCountryCode(company.country);
    if (!country) {
      return NextResponse.json(
        { error: "Maa pitää antaa kaksikirjaimisena maakoodina, esimerkiksi FI." },
        { status: 400 }
      );
    }
    let accountId = company.stripe_account_id;
    let usesAccountsV2 = false;
    if (accountId) {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        usesAccountsV2 = account.metadata?.maskines_connect_api === "v2";
        await updateCompanyStripeState(account);
      } catch (error) {
        if (!isUnavailableStripeAccount(error)) throw error;
        accountId = null;
        const { error: clearError } = await admin.from("companies").update({
          stripe_account_id: null,
          stripe_details_submitted: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
          stripe_requirements_due: [],
        }).eq("id", company.id).eq("owner_user_id", user.id);
        if (clearError) throw clearError;
      }
    }
    if (!accountId) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: company.email,
        display_name: company.name,
        dashboard: "express",
        defaults: {
          currency: "eur",
          locales: [country === "FI" ? "fi-FI" : country === "SE" ? "sv-SE" : country === "NO" ? "nb-NO" : "en"],
          profile: {
            doing_business_as: company.name,
            product_description: "Ajoneuvojen ja varaosien myynti Maskines-markkinapaikalla",
            ...(company.website ? { business_url: company.website } : {})
          },
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application"
          }
        },
        identity: {
          country: country.toLowerCase(),
          entity_type: "company",
          business_details: {
            registered_name: company.name
          }
        },
        configuration: {
          merchant: {
            capabilities: {
              card_payments: { requested: true }
            }
          },
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true }
              }
            }
          }
        },
        include: ["configuration.merchant", "configuration.recipient", "identity", "requirements"],
        metadata: {
          maskines_company_id: company.id,
          maskines_owner_user_id: company.owner_user_id,
          maskines_connect_api: "v2"
        }
      });
      accountId = account.id;
      usesAccountsV2 = true;
      const { error } = await admin
        .from("companies")
        .update({ stripe_account_id: accountId, country })
        .eq("id", company.id)
        .eq("owner_user_id", user.id);
      if (error) throw error;
    }

    const refreshUrl = absoluteStripeConnectUrl("/yritys/stripe/palaa?refresh=1");
    const returnUrl = absoluteStripeConnectUrl("/yritys/stripe/palaa");
    const link = usesAccountsV2
      ? await stripe.v2.core.accountLinks.create({
          account: accountId,
          use_case: {
            type: "account_onboarding",
            account_onboarding: {
              configurations: ["merchant", "recipient"],
              refresh_url: refreshUrl,
              return_url: returnUrl,
              collection_options: {
                fields: "eventually_due",
                future_requirements: "include"
              }
            }
          }
        })
      : await stripe.accountLinks.create({
          account: accountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: "account_onboarding",
          collection_options: { fields: "eventually_due" }
        });

    return NextResponse.json({ url: link.url });
  } catch (error) {
    return errorResponse(stripeConnectError(error), "Stripe-yhdistämisen aloittaminen epäonnistui.");
  }
}
