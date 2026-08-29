import { NextResponse } from "next/server";

type UiLocale = "en" | "sv" | "no";

type TranslateUiRequest = {
  targetLocale?: string;
  texts?: unknown;
};

const memoryCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 4_000;
const MAX_BATCH_CHARACTERS = 4_000;

function isUiLocale(value: unknown): value is UiLocale {
  return value === "en" || value === "sv" || value === "no";
}

function normalizeTexts(value: unknown) {
  if (!Array.isArray(value)) return [];

  const unique = Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length >= 2 && item.length <= 500)
    )
  ).slice(0, 40);

  let characters = 0;
  return unique.filter((item) => {
    if (characters + item.length > MAX_BATCH_CHARACTERS) return false;
    characters += item.length;
    return true;
  });
}

function cacheTranslation(key: string, value: string) {
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (typeof oldestKey === "string") memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, value);
}

async function translateWithGoogle(text: string, targetLocale: UiLocale) {
  const query = new URLSearchParams({
    client: "gtx",
    // Application copy is authored in Finnish. An explicit source language
    // prevents brand names and already-localized fragments from being
    // reinterpreted as another language by automatic detection.
    sl: "fi",
    tl: targetLocale,
    dt: "t",
    q: text
  });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000)
  });

  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.[0]?.map((part: unknown[]) => part?.[0] ?? "").join("").trim() || null;
}

async function translateBatchWithOpenAi(texts: string[], targetLocale: UiLocale) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || texts.length === 0) return {} as Record<string, string>;
  const language = targetLocale === "sv" ? "Swedish" : targetLocale === "no" ? "Norwegian Bokmål" : "English";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4.1-mini",
      input: [
        `Translate each Finnish marketplace UI string into ${language}.`,
        "Preserve placeholders, numbers, currencies, brand names, punctuation and capitalization. Do not omit, combine or explain any item.",
        "Return only JSON with a translations array in exactly the same order and length as the input array.",
        `Input: ${JSON.stringify(texts)}`
      ].join("\n"),
      text: { format: { type: "json_object" } }
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000)
  });
  if (!response.ok) return {} as Record<string, string>;
  const data = await response.json();
  const output = data.output_text
    ?? data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? []).map((item: { text?: string }) => item.text ?? "").join("");
  try {
    const parsed = JSON.parse(output || "{}") as { translations?: unknown };
    const translatedItems = parsed.translations;
    if (!Array.isArray(translatedItems) || translatedItems.length !== texts.length) return {} as Record<string, string>;
    return Object.fromEntries(texts.flatMap((source, index) => {
      const value = translatedItems[index];
      const translated = typeof value === "string" ? value.trim() : "";
      return translated && translated !== source ? [[source, translated]] : [];
    }));
  } catch {
    return {} as Record<string, string>;
  }
}

async function translateMissingWithFallback(texts: string[], targetLocale: UiLocale) {
  const output = await translateBatchWithOpenAi(texts, targetLocale);
  const missingTexts = texts.filter((text) => !output[text]);
  let cursor = 0;

  async function worker() {
    while (cursor < missingTexts.length) {
      const text = missingTexts[cursor++];
      try {
        const translated = await translateWithGoogle(text, targetLocale);
        if (translated && translated !== text) output[text] = translated;
      } catch {
        // Leave failed items uncached so a later request can retry them.
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, missingTexts.length) }, worker));
  return output;
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

  if (missing.length === 0) {
    return NextResponse.json({
      translations: cachedTranslations
    });
  }

  const translated = await translateMissingWithFallback(missing, body.targetLocale);
  for (const [source, translation] of Object.entries(translated)) {
    cacheTranslation(`${body.targetLocale}:${source}`, translation);
  }
  return NextResponse.json({
    translations: { ...translated, ...cachedTranslations }
  });
}
