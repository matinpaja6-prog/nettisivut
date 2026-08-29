import { NextResponse } from "next/server";

import {
  COMPANY_VERIFICATION_CURRENCY,
  COMPANY_VERIFICATION_PAYMENT_KIND,
  COMPANY_VERIFICATION_PRICE_CENTS
} from "@/lib/company-verification-payment";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe";
import { requireUserFromRequest } from "@/lib/supabase-admin";
import { normalizeEmailLocale } from "@/lib/email-template";
import { profileRootPath } from "@/lib/routes";
import {
  missingCompanyVerificationFields,
  type CompanyVerificationRequiredField
} from "@/lib/company-verification-requirements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKOUT_ATTEMPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const checkoutText = {
  fi: { invalidAttempt: "Maksuyrityksen tunniste puuttuu. Yritä uudelleen.", companyOnly: "Vahvistus on saatavilla vain yritystilille.", alreadyVerified: "Yritys on jo vahvistettu.", pending: "Yrityksen vahvistuspyyntö odottaa jo käsittelyä.", missingDetails: "Täytä ja tallenna kaikki pakolliset yritystiedot ennen vahvistusta.", productName: "Maskines yritysvahvistus", productDescription: "Yritystietojen tarkistus", embeddedMissing: "Upotetun maksusivun tietoja ei voitu muodostaa.", failed: "Maksuun siirtyminen epäonnistui." },
  en: { invalidAttempt: "The payment attempt ID is missing. Please try again.", companyOnly: "Verification is available only for company accounts.", alreadyVerified: "The company is already verified.", pending: "The company verification request is already awaiting review.", missingDetails: "Complete and save all required company details before verification.", productName: "Maskines company verification", productDescription: "Review of company details", embeddedMissing: "The embedded payment page could not be created.", failed: "Could not continue to payment." },
  sv: { invalidAttempt: "Identifieraren för betalningsförsöket saknas. Försök igen.", companyOnly: "Verifiering är endast tillgänglig för företagskonton.", alreadyVerified: "Företaget är redan verifierat.", pending: "Företagets verifieringsbegäran väntar redan på granskning.", missingDetails: "Fyll i och spara alla obligatoriska företagsuppgifter före verifieringen.", productName: "Maskines företagsverifiering", productDescription: "Granskning av företagsuppgifter", embeddedMissing: "Den inbäddade betalningssidan kunde inte skapas.", failed: "Det gick inte att fortsätta till betalningen." },
  no: { invalidAttempt: "ID-en for betalingsforsøket mangler. Prøv på nytt.", companyOnly: "Verifisering er bare tilgjengelig for bedriftskontoer.", alreadyVerified: "Bedriften er allerede verifisert.", pending: "Bedriftens verifiseringsforespørsel venter allerede på kontroll.", missingDetails: "Fyll inn og lagre alle obligatoriske bedriftsopplysninger før verifisering.", productName: "Maskines bedriftsverifisering", productDescription: "Kontroll av bedriftsopplysninger", embeddedMissing: "Den innebygde betalingssiden kunne ikke opprettes.", failed: "Kunne ikke fortsette til betaling." }
} as const;

export async function POST(request: Request) {
  let requestLocale = normalizeEmailLocale(undefined);
  try {
    const { admin, user } = await requireUserFromRequest(request);
    const body = await request.json().catch(() => ({})) as { attemptId?: unknown; locale?: unknown };
    const attemptId = typeof body.attemptId === "string" ? body.attemptId.trim() : "";
    const locale = normalizeEmailLocale(body.locale ?? user.user_metadata?.locale);
    requestLocale = locale;
    const copy = checkoutText[locale];

    if (!CHECKOUT_ATTEMPT_ID_PATTERN.test(attemptId)) {
      return NextResponse.json({ error: copy.invalidAttempt }, { status: 400 });
    }

    const { data: profile, error } = await admin
      .from("profiles")
      .select("account_type,company_name,business_id,email,phone,public_address,bio,address,postal_code,city,country,company_verified_at,company_verification_requested_at")
      .eq("id", user.id)
      .maybeSingle<{
        account_type: string | null;
        company_name: string | null;
        business_id: string | null;
        email: string | null;
        phone: string | null;
        public_address: string | null;
        bio: string | null;
        address: string | null;
        postal_code: string | null;
        city: string | null;
        country: string | null;
        company_verified_at: string | null;
        company_verification_requested_at: string | null;
      }>();

    if (error) throw error;
    if (!profile || profile.account_type !== "company") {
      return NextResponse.json({ error: copy.companyOnly }, { status: 403 });
    }
    if (profile.company_verified_at) {
      return NextResponse.json({ error: copy.alreadyVerified }, { status: 409 });
    }
    if (profile.company_verification_requested_at) {
      return NextResponse.json({ error: copy.pending }, { status: 409 });
    }
    const missingFields = missingCompanyVerificationFields(profile);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: copy.missingDetails, missingFields: missingFields satisfies CompanyVerificationRequiredField[] },
        { status: 400 }
      );
    }

    const companyName = profile.company_name!.trim();
    const businessId = profile.business_id!.trim();

    const metadata = {
      kind: COMPANY_VERIFICATION_PAYMENT_KIND,
      user_id: user.id,
      company_name: companyName.slice(0, 160),
      business_id: businessId.slice(0, 80),
      locale
    };
    const returnUrl = absoluteSiteUrl(
      `${profileRootPath(locale)}?companyVerification=success&session_id={CHECKOUT_SESSION_ID}#tilin-turvallisuus`
    );
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        ui_mode: "embedded_page",
        customer_email: user.email ?? undefined,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: COMPANY_VERIFICATION_CURRENCY,
            unit_amount: COMPANY_VERIFICATION_PRICE_CENTS,
            product_data: {
              name: copy.productName,
              description: `${copy.productDescription}: ${profile.company_name}`
            }
          }
        }],
        metadata,
        payment_intent_data: {
          receipt_email: user.email ?? undefined,
          metadata
        },
        return_url: returnUrl,
        locale: locale === "no" ? "nb" : locale
      },
      { idempotencyKey: `company-verification-v3-embedded:${user.id}:${attemptId}` }
    );

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
    if (!session.client_secret || !publishableKey) {
      throw new Error(copy.embeddedMissing);
    }

    return NextResponse.json({
      clientSecret: session.client_secret,
      publishableKey
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : checkoutText[requestLocale].failed;
    const status = /kirjautuminen/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
