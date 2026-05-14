import { NextResponse } from "next/server";

import { listingLocales, type ListingLocale } from "@/lib/listing-translations";
import type { ListingTranslations } from "@/lib/listings";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const languageNames: Record<ListingLocale, string> = {
  fi: "Finnish",
  en: "English",
  sv: "Swedish",
  no: "Norwegian",
  et: "Estonian"
};

type TranslateRequest = {
  listingId?: string;
  title?: string;
  description?: string;
  sourceLanguage?: ListingLocale;
};

type NormalizedTranslateInput = Required<Omit<TranslateRequest, "listingId">>;

function emptyTranslations(input: NormalizedTranslateInput): ListingTranslations {
  return Object.fromEntries(
    listingLocales.map((locale) => [
      locale,
      {
        title: input.title,
        description: input.description
      }
    ])
  ) as ListingTranslations;
}

function normalizeTranslations(
  input: NormalizedTranslateInput,
  value: unknown
): ListingTranslations {
  const fallback = emptyTranslations(input);

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const raw = value as Record<string, unknown>;
  const translations: ListingTranslations = {};

  for (const locale of listingLocales) {
    const item = raw[locale];

    translations[locale] =
      item && typeof item === "object"
        ? {
            title:
              typeof (item as Record<string, unknown>).title === "string"
                ? String((item as Record<string, unknown>).title)
                : fallback[locale]?.title,
            description:
              typeof (item as Record<string, unknown>).description === "string"
                ? String((item as Record<string, unknown>).description)
                : fallback[locale]?.description
          }
        : fallback[locale];
  }

  translations[input.sourceLanguage] = {
    title: input.title,
    description: input.description
  };

  return translations;
}

async function saveListingTranslations(input: {
  listingId?: string;
  sourceLanguage: ListingLocale;
  translations: ListingTranslations;
}) {
  if (!input.listingId) return false;

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("listings")
      .update({
        original_language: input.sourceLanguage,
        translations: input.translations
      })
      .eq("id", input.listingId);

    return !error;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as TranslateRequest;
  const input: NormalizedTranslateInput = {
    title: String(body.title ?? "").trim(),
    description: String(body.description ?? "").trim(),
    sourceLanguage: body.sourceLanguage && listingLocales.includes(body.sourceLanguage)
      ? body.sourceLanguage
      : "fi"
  };

  if (!input.title && !input.description) {
    const translations = emptyTranslations(input);
    const saved = await saveListingTranslations({
      listingId: body.listingId,
      sourceLanguage: input.sourceLanguage,
      translations
    });
    return NextResponse.json({ translations, saved });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const translations = emptyTranslations(input);
    const saved = await saveListingTranslations({
      listingId: body.listingId,
      sourceLanguage: input.sourceLanguage,
      translations
    });
    return NextResponse.json({
      translations,
      saved,
      warning: "OPENAI_API_KEY puuttuu, joten käytettiin alkuperäistä tekstiä."
    });
  }

  const prompt = [
    "Translate this marketplace listing into all requested languages.",
    "Preserve brand names, model names, part numbers, measurements, sizes, prices and abbreviations.",
    "Return only valid JSON with keys fi, en, sv, no, et. Each value must contain title and description.",
    `Source language: ${languageNames[input.sourceLanguage]}`,
    `Title: ${input.title}`,
    `Description: ${input.description}`
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4.1-mini",
      input: prompt,
      text: { format: { type: "json_object" } }
    })
  });

  if (!response.ok) {
    const translations = emptyTranslations(input);
    const saved = await saveListingTranslations({
      listingId: body.listingId,
      sourceLanguage: input.sourceLanguage,
      translations
    });
    return NextResponse.json({
      translations,
      saved,
      warning: "Käännöspalvelu ei vastannut, joten käytettiin alkuperäistä tekstiä."
    });
  }

  const data = await response.json();
  const output =
    data.output_text ??
    data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
      ?.map((item: { text?: string }) => item.text ?? "")
      ?.join("");

  let parsed: unknown = null;

  try {
    parsed = output ? JSON.parse(output) : null;
  } catch {
    parsed = null;
  }

  const translations = normalizeTranslations(input, parsed);
  const saved = await saveListingTranslations({
    listingId: body.listingId,
    sourceLanguage: input.sourceLanguage,
    translations
  });

  return NextResponse.json({ translations, saved });
}
