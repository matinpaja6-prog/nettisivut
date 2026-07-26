import { NextResponse } from "next/server";

import { listingLocales, type ListingLocale } from "@/lib/listing-translations";
import type { ListingTranslations } from "@/lib/listings";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const languageNames: Record<ListingLocale, string> = {
  fi: "Finnish",
  en: "English",
  sv: "Swedish"
};

type TranslateRequest = {
  listingId?: string;
  title?: string;
  description?: string;
  sourceLanguage?: ListingLocale;
};

type NormalizedTranslateInput = Required<Omit<TranslateRequest, "listingId">>;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

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
  sellerId: string;
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
      .eq("id", input.listingId)
      .eq("seller_id", input.sellerId);

    return !error;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Kirjautuminen vaaditaan." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: callerAuth, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerAuth.user) {
    return NextResponse.json({ error: "Istunto ei ole voimassa." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as TranslateRequest;
  const listingId =
    typeof body.listingId === "string" ? body.listingId.trim() : undefined;

  if (listingId && !UUID_PATTERN.test(listingId)) {
    return NextResponse.json({ error: "Virheellinen ilmoituksen tunniste." }, { status: 400 });
  }

  const input: NormalizedTranslateInput = {
    title: String(body.title ?? "").trim(),
    description: String(body.description ?? "").trim(),
    sourceLanguage: body.sourceLanguage && listingLocales.includes(body.sourceLanguage)
      ? body.sourceLanguage
      : "fi"
  };

  if (input.title.length > 220 || input.description.length > 10_000) {
    return NextResponse.json({ error: "Käännettävä teksti on liian pitkä." }, { status: 413 });
  }

  if (listingId) {
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("seller_id")
      .eq("id", listingId)
      .maybeSingle<{ seller_id: string }>();

    if (listingError || !listing) {
      return NextResponse.json({ error: "Ilmoitusta ei löytynyt." }, { status: 404 });
    }

    if (listing.seller_id !== callerAuth.user.id) {
      return NextResponse.json({ error: "Ei oikeutta muokata tätä ilmoitusta." }, { status: 403 });
    }
  }

  if (!input.title && !input.description) {
    const translations = emptyTranslations(input);
    const saved = await saveListingTranslations({
      listingId,
      sellerId: callerAuth.user.id,
      sourceLanguage: input.sourceLanguage,
      translations
    });
    return NextResponse.json({ translations, saved });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const translations = emptyTranslations(input);
    const saved = await saveListingTranslations({
      listingId,
      sellerId: callerAuth.user.id,
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
    "Return only valid JSON with keys fi, en, sv. Each value must contain title and description.",
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
      listingId,
      sellerId: callerAuth.user.id,
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
    listingId,
    sellerId: callerAuth.user.id,
    sourceLanguage: input.sourceLanguage,
    translations
  });

  return NextResponse.json({ translations, saved });
}
