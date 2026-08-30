import "server-only";

import type { Company, Product, ProductDraft } from "@/lib/commerce/types";
import { normalizeReturnPolicy, RETURN_LANGUAGES, type ReturnPolicy } from "@/lib/commerce/returns";
import type { requireCommerceUser } from "@/lib/commerce/server";

type CommerceAdmin = Awaited<ReturnType<typeof requireCommerceUser>>["admin"];

export async function commerceSetupErrors(
  admin: CommerceAdmin,
  company: Company,
  product: Partial<Product | ProductDraft>
) {
  const errors: string[] = [];
  const { data, error } = await admin
    .from("company_return_policies")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle<ReturnPolicy>();
  if (error) throw error;

  if (!data) {
    errors.push("Täytä ja julkaise palautusohjeet ennen suoramaksutuotteen julkaisemista.");
  } else {
    const policy = normalizeReturnPolicy(data, company);
    const contactReady = policy.enabled && Boolean(
      policy.recipient_name && policy.address_line && policy.postal_code && policy.city && policy.email
    );
    const returnTextsReady = RETURN_LANGUAGES.some((language) =>
      Boolean(policy.translations[language]?.instructions?.trim())
    );
    if (!contactReady || !returnTextsReady) {
      errors.push("Kirjoita ja tallenna 14 päivän palautusoikeus ennen suoramaksutuotteen julkaisemista.");
    }
    const hasSavedPickupMessage = Boolean(company.pickup_email_message?.trim());
    const hasAllPickupTranslations = RETURN_LANGUAGES.every((language) =>
      policy.translations[language]?.pickup_instructions?.trim()
    );
    if (product.pickup_available && !hasSavedPickupMessage && !hasAllPickupTranslations) {
      errors.push("Täytä ja tallenna nouto-ohje automaattisine käännöksineen ennen noutotuotteen julkaisemista.");
    }
  }

  if (product.shipping_available) {
    const selectedCountries = company.shipping_countries ?? [];
    if (!company.posti_enabled || selectedCountries.length === 0) {
      errors.push("Valitse Posti ja vähintään yksi toimitusmaa ennen postitettavan tuotteen julkaisemista.");
    }
    const prices: Record<string, number | null> = {
      FI: company.default_shipping_price_fi_cents,
      SE: company.default_shipping_price_se_cents,
      NO: company.default_shipping_price_no_cents
    };
    if (selectedCountries.some((country) => prices[country] == null)) {
      errors.push("Täytä postikulun hinta jokaiselle valitulle toimitusmaalle ennen tuotteen julkaisemista.");
    }
  }

  return errors;
}
