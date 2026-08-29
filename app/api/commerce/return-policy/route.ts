import { NextResponse } from "next/server";
import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";
import {
  defaultReturnPolicy,
  normalizeReturnPolicy,
  RETURN_LANGUAGES,
  type ReturnLanguage,
  type ReturnPolicy,
  type ReturnTranslation
} from "@/lib/commerce/returns";

const RETURN_LANGUAGE_NAMES: Record<ReturnLanguage, string> = {
  en: "English",
  fi: "Finnish",
  sv: "Swedish",
  no: "Norwegian Bokmål"
};

function isReturnLanguage(value: unknown): value is ReturnLanguage {
  return typeof value === "string" && RETURN_LANGUAGES.includes(value as ReturnLanguage);
}

function normalizeTranslatedPolicy(value: unknown, sourceLanguage: ReturnLanguage, source: ReturnTranslation, existing: ReturnPolicy["translations"]) {
  if (!value || typeof value !== "object") throw new Error("Käännöspalvelu palautti virheellisen vastauksen.");
  const raw = value as Record<string, unknown>;
  const fields: Array<keyof ReturnTranslation> = ["instructions", "conditions", "packing", "exclusions"];
  const translations = Object.fromEntries(RETURN_LANGUAGES.map((language) => {
    const item = raw[language];
    if (!item || typeof item !== "object") throw new Error(`Käännös puuttuu kielelle ${language.toUpperCase()}.`);
    const translated = Object.fromEntries(fields.map((field) => {
      const text = String((item as Record<string, unknown>)[field] ?? "").trim();
      if (source[field] && !text) throw new Error(`Käännöksen kenttä ${field} puuttuu kieleltä ${language.toUpperCase()}.`);
      return [field, text.slice(0, 4000)];
    })) as ReturnTranslation;
    return [language, translated];
  })) as Record<ReturnLanguage, ReturnTranslation>;
  for (const language of RETURN_LANGUAGES) {
    translations[language].pickup_instructions = existing[language]?.pickup_instructions ?? "";
  }
  translations[sourceLanguage] = source;
  return translations;
}

async function translateReturnPolicy(sourceLanguage: ReturnLanguage, source: ReturnTranslation, existing: ReturnPolicy["translations"]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Automaattinen käännöspalvelu ei ole käytössä. OPENAI_API_KEY puuttuu.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4.1-mini",
      input: [
        "Translate these ecommerce return-policy texts into Finnish, English, Swedish and Norwegian Bokmål.",
        "Preserve legal meaning, paragraph breaks, numbers, product names and company names. Do not add new terms or explanations.",
        "Return only valid JSON with keys fi, en, sv and no. Every language must contain instructions, conditions, packing and exclusions string keys. Preserve empty optional fields as empty strings.",
        `Source language: ${RETURN_LANGUAGE_NAMES[sourceLanguage]}`,
        `Source JSON: ${JSON.stringify(source)}`
      ].join("\n"),
      text: { format: { type: "json_object" } }
    })
  });
  if (!response.ok) throw new Error("Palautustekstien automaattinen kääntäminen epäonnistui. Yritä hetken kuluttua uudelleen.");

  const data = await response.json();
  const output = data.output_text
    ?? data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
      ?.map((item: { text?: string }) => item.text ?? "")
      ?.join("");
  let parsed: unknown;
  try { parsed = output ? JSON.parse(output) : null; }
  catch { throw new Error("Käännöspalvelu palautti virheellisen vastauksen."); }
  return normalizeTranslatedPolicy(parsed, sourceLanguage, source, existing);
}

export async function GET(request: Request) {
  try { const { admin, user } = await requireCommerceUser(request); const company = await getOwnedCompany(user); if (!company) throw new Error("Yritysprofiilia ei löytynyt.");
    const { data, error } = await admin.from("company_return_policies").select("*").eq("company_id", company.id).maybeSingle<ReturnPolicy>();
    if (error) throw error; return NextResponse.json({ policy: data ? normalizeReturnPolicy(data, company) : defaultReturnPolicy(company) });
  } catch (error) { return errorResponse(error, "Palautusohjeiden lataaminen epäonnistui."); }
}

export async function PUT(request: Request) {
  try { const { admin, user } = await requireCommerceUser(request); const company = await getOwnedCompany(user); if (!company) throw new Error("Yritysprofiilia ei löytynyt.");
    const body = await request.json().catch(() => ({})) as Partial<ReturnPolicy> & { source_language?: string };
    const sourceLanguage = isReturnLanguage(body.source_language) ? body.source_language : "fi";
    const policy = normalizeReturnPolicy(body, company);
    if (!policy.recipient_name || !policy.address_line || !policy.postal_code || !policy.city || !policy.email) return NextResponse.json({ error: "Täytä vastaanottaja, palautusosoite ja sähköposti." }, { status: 400 });
    const source = policy.translations[sourceLanguage];
    const sourceComplete = Boolean(source?.instructions);
    let warning = "";
    if (sourceComplete) {
      try {
        policy.translations = await translateReturnPolicy(sourceLanguage, source, policy.translations);
      } catch {
        warning = "Palautustekstit tallennettiin, mutta automaattinen käännös epäonnistui. Yritä tallentaa myöhemmin uudelleen.";
      }
    } else {
      warning = "Palautustekstien luonnos tallennettiin. Kirjoita 14 päivän palautusoikeus ennen suoramyynnin käyttöönottoa.";
    }
    const { data, error } = await admin.from("company_return_policies").upsert({ ...policy, updated_at: new Date().toISOString() }, { onConflict: "company_id" }).select("*").single<ReturnPolicy>();
    if (error) throw error; return NextResponse.json({ policy: normalizeReturnPolicy(data, company), warning: warning || undefined });
  } catch (error) { return errorResponse(error, "Palautusohjeiden tallentaminen epäonnistui."); }
}
