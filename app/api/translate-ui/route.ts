import { NextResponse } from "next/server";

type UiLocale = "en" | "sv" | "no" | "et";

const localeNames: Record<UiLocale, string> = {
  en: "English",
  sv: "Swedish",
  no: "Norwegian",
  et: "Estonian"
};

type TranslateUiRequest = {
  targetLocale?: string;
  texts?: unknown;
};

const memoryCache = new Map<string, string>();

function isUiLocale(value: unknown): value is UiLocale {
  return value === "en" || value === "sv" || value === "no" || value === "et";
}

function normalizeTexts(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length >= 2 && item.length <= 500)
    )
  ).slice(0, 80);
}

function identityResult(texts: string[]) {
  return Object.fromEntries(texts.map((text) => [text, text]));
}

function normalizeResult(texts: string[], value: unknown) {
  const fallback = identityResult(texts);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const raw = value as Record<string, unknown>;

  return Object.fromEntries(
    texts.map((text) => {
      const translated = raw[text];
      return [text, typeof translated === "string" && translated.trim() ? translated.trim() : fallback[text]];
    })
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as TranslateUiRequest;

  if (!isUiLocale(body.targetLocale)) {
    return NextResponse.json({ translations: {} });
  }

  const texts = normalizeTexts(body.texts);
  if (texts.length === 0) {
    return NextResponse.json({ translations: {} });
  }

  const cachedTranslations: Record<string, string> = {};
  const missing = texts.filter((text) => {
    const key = `${body.targetLocale}:${text}`;
    const cached = memoryCache.get(key);

    if (cached) {
      cachedTranslations[text] = cached;
      return false;
    }

    return true;
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || missing.length === 0) {
    return NextResponse.json({
      translations: {
        ...identityResult(missing),
        ...cachedTranslations
      },
      warning: apiKey ? undefined : "OPENAI_API_KEY puuttuu."
    });
  }

  const prompt = [
    `Translate each UI string to ${localeNames[body.targetLocale]}.`,
    "The source text may be Finnish, English, Swedish, Norwegian or Estonian.",
    "If a string is already in the target language, return it unchanged.",
    "Preserve brand names, model names, part numbers, measurements, prices, email addresses, URLs, punctuation and placeholders.",
    "Return only valid JSON where each original string is a key and the translated string is the value.",
    JSON.stringify(missing)
  ].join("\n");

  try {
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
      return NextResponse.json({
        translations: {
          ...identityResult(missing),
          ...cachedTranslations
        },
        warning: "Käännöspalvelu ei vastannut."
      });
    }

    const data = await response.json();
    const output =
      data.output_text ??
      data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
        ?.map((item: { text?: string }) => item.text ?? "")
        ?.join("");

    const parsed = output ? JSON.parse(output) : null;
    const translated = normalizeResult(missing, parsed);

    for (const [source, translation] of Object.entries(translated)) {
      memoryCache.set(`${body.targetLocale}:${source}`, translation);
    }

    return NextResponse.json({
      translations: {
        ...translated,
        ...cachedTranslations
      }
    });
  } catch {
    return NextResponse.json({
      translations: {
        ...identityResult(missing),
        ...cachedTranslations
      },
      warning: "Käännöspalvelu ei onnistunut."
    });
  }
}
