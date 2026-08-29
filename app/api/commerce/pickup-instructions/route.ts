import { NextResponse } from "next/server";

import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";
import {
  defaultReturnPolicy,
  normalizeReturnPolicy,
  RETURN_LANGUAGES,
  type ReturnLanguage,
  type ReturnPolicy
} from "@/lib/commerce/returns";

const LANGUAGE_NAMES: Record<ReturnLanguage, string> = {
  fi: "Finnish",
  en: "English",
  sv: "Swedish",
  no: "Norwegian Bokmål"
};

function isReturnLanguage(value: unknown): value is ReturnLanguage {
  return typeof value === "string" && RETURN_LANGUAGES.includes(value as ReturnLanguage);
}

async function translatePickupInstructions(message: string, sourceLanguage: ReturnLanguage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Automaattinen käännöspalvelu ei ole käytössä.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4.1-mini",
      input: [
        "Translate this customer pickup instruction into Finnish, English, Swedish and Norwegian Bokmål.",
        "Preserve addresses, opening hours, phone numbers, order instructions and paragraph breaks exactly in meaning. Do not add information.",
        "Return only valid JSON with string keys fi, en, sv and no.",
        `Source language: ${LANGUAGE_NAMES[sourceLanguage]}`,
        `Text: ${message}`
      ].join("\n"),
      text: { format: { type: "json_object" } }
    })
  });
  if (!response.ok) throw new Error("Nouto-ohjeen automaattinen kääntäminen epäonnistui. Yritä hetken kuluttua uudelleen.");
  const data = await response.json();
  const output = data.output_text
    ?? data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
      ?.map((item: { text?: string }) => item.text ?? "")
      ?.join("");
  let parsed: Record<string, unknown>;
  try { parsed = output ? JSON.parse(output) as Record<string, unknown> : {}; }
  catch { throw new Error("Käännöspalvelu palautti virheellisen vastauksen."); }
  const translations = Object.fromEntries(RETURN_LANGUAGES.map((language) => {
    const translated = String(parsed[language] ?? "").trim().slice(0, 1800);
    if (!translated) throw new Error(`Nouto-ohjeen ${language.toUpperCase()}-käännös puuttuu.`);
    return [language, translated];
  })) as Record<ReturnLanguage, string>;
  translations[sourceLanguage] = message;
  return translations;
}

export async function PUT(request: Request) {
  try {
    const { admin, user } = await requireCommerceUser(request);
    const company = await getOwnedCompany(user);
    if (!company) return NextResponse.json({ error: "Yritysprofiilia ei löytynyt." }, { status: 404 });
    const body = await request.json().catch(() => ({})) as { message?: unknown; source_language?: unknown };
    const message = String(body.message ?? "").replace(/\u0000/g, "").trim().slice(0, 1800);
    const sourceLanguage = isReturnLanguage(body.source_language) ? body.source_language : "fi";
    if (!message) return NextResponse.json({ error: "Kirjoita nouto-ohje ennen tallentamista." }, { status: 400 });
    let pickupTranslations: Record<ReturnLanguage, string> | null = null;
    let warning = "";
    try {
      pickupTranslations = await translatePickupInstructions(message, sourceLanguage);
    } catch {
      warning = "Nouto-ohje tallennettiin, mutta automaattinen käännös epäonnistui. Yritä tallentaa myöhemmin uudelleen.";
    }

    const { data: stored, error: readError } = await admin
      .from("company_return_policies")
      .select("*")
      .eq("company_id", company.id)
      .maybeSingle<ReturnPolicy>();
    if (readError) throw readError;
    const policy = stored ? normalizeReturnPolicy(stored, company) : defaultReturnPolicy(company);
    if (pickupTranslations) {
      for (const language of RETURN_LANGUAGES) {
        policy.translations[language].pickup_instructions = pickupTranslations[language];
      }
    } else {
      policy.translations[sourceLanguage].pickup_instructions = message;
    }
    const { data, error } = await admin
      .from("company_return_policies")
      .upsert({ ...policy, updated_at: new Date().toISOString() }, { onConflict: "company_id" })
      .select("*")
      .single<ReturnPolicy>();
    if (error) throw error;
    return NextResponse.json({ policy: normalizeReturnPolicy(data, company), warning: warning || undefined });
  } catch (error) {
    return errorResponse(error, "Nouto-ohjeen tallentaminen epäonnistui.");
  }
}
