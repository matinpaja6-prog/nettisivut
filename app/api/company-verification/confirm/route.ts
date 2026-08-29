import { after, NextResponse } from "next/server";

import { sendCompanyVerificationReceipt } from "@/lib/company-verification-email";
import { completeCompanyVerificationPayment } from "@/lib/company-verification-payment";
import { normalizeEmailLocale } from "@/lib/email-template";
import { getStripe } from "@/lib/stripe";
import { requireUserFromRequest } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const confirmText = {
  fi: { invalid: "Maksutunniste on virheellinen.", mismatch: "Yritysvahvistuksen maksutiedot eivät täsmää.", wrongUser: "Maksu ei kuulu kirjautuneelle käyttäjälle.", unpaid: "Maksu keskeytyi tai epäonnistui. Yritä maksua uudelleen.", accountMissing: "Yritystiliä ei löytynyt.", failed: "Maksun vahvistaminen epäonnistui." },
  en: { invalid: "The payment ID is invalid.", mismatch: "The company-verification payment details do not match.", wrongUser: "The payment does not belong to the signed-in user.", unpaid: "The payment was cancelled or failed. Please try again.", accountMissing: "The company account was not found.", failed: "Payment confirmation failed." },
  sv: { invalid: "Betalningsidentifieraren är ogiltig.", mismatch: "Betalningsuppgifterna för företagsverifieringen stämmer inte.", wrongUser: "Betalningen tillhör inte den inloggade användaren.", unpaid: "Betalningen avbröts eller misslyckades. Försök igen.", accountMissing: "Företagskontot hittades inte.", failed: "Betalningen kunde inte bekräftas." },
  no: { invalid: "Betalings-ID-en er ugyldig.", mismatch: "Betalingsopplysningene for bedriftsverifiseringen stemmer ikke.", wrongUser: "Betalingen tilhører ikke den innloggede brukeren.", unpaid: "Betalingen ble avbrutt eller mislyktes. Prøv på nytt.", accountMissing: "Bedriftskontoen ble ikke funnet.", failed: "Betalingen kunne ikke bekreftes." }
} as const;

function translatedConfirmError(message: string, locale: keyof typeof confirmText) {
  const copy = confirmText[locale];
  if (message.includes("maksutiedot eivät täsmää")) return copy.mismatch;
  if (message.includes("ei kuulu kirjautuneelle")) return copy.wrongUser;
  if (message.includes("keskeytyi tai epäonnistui")) return copy.unpaid;
  if (message.includes("Yritystiliä ei löytynyt")) return copy.accountMissing;
  return message || copy.failed;
}

export async function POST(request: Request) {
  let requestLocale = normalizeEmailLocale(undefined);
  try {
    const { user } = await requireUserFromRequest(request);
    const body = await request.json().catch(() => ({})) as { sessionId?: string; locale?: unknown };
    requestLocale = normalizeEmailLocale(body.locale ?? user.user_metadata?.locale);
    const sessionId = String(body.sessionId ?? "").trim();

    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      return NextResponse.json({ error: confirmText[requestLocale].invalid }, { status: 400 });
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const profile = await completeCompanyVerificationPayment(session, user.id);
    after(async () => {
      try {
        await sendCompanyVerificationReceipt(session, user.email);
      } catch (receiptError) {
        console.error("Company verification receipt failed", receiptError);
      }
    });
    return NextResponse.json({ paid: true, profile, receiptQueued: true });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    const message = translatedConfirmError(rawMessage, requestLocale);
    const status = /kirjautuminen/i.test(rawMessage) ? 401 : /ei kuulu/i.test(rawMessage) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
