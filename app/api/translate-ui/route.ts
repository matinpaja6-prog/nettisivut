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
        .filter((item) => item.length >= 2 && item.length <= 280)
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
    sl: "auto",
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

async function translateMissingWithFallback(texts: string[], targetLocale: UiLocale) {
  const output: Record<string, string> = {};
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const text = texts[cursor++];
      try {
        const translated = await translateWithGoogle(text, targetLocale);
        if (translated && translated !== text) output[text] = translated;
      } catch {
        // Leave failed items uncached so a later request can retry them.
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, texts.length) }, worker));
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
