import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type VisitorLocale = "fi" | "en" | "sv" | "no" | "et";
type PreferenceStore = Record<string, VisitorLocale>;

const LOCALES = new Set<VisitorLocale>(["fi", "en", "sv", "no", "et"]);
const STORE_PATH = path.join(process.cwd(), ".visitor-language-preferences.json");

function getVisitorIp(requestHeaders: Headers) {
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("cf-connecting-ip") ||
    "local-development"
  );
}

function isVisitorLocale(value: unknown): value is VisitorLocale {
  return typeof value === "string" && LOCALES.has(value as VisitorLocale);
}

async function readStore(): Promise<PreferenceStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => isVisitorLocale(value))
    ) as PreferenceStore;
  } catch {
    return {};
  }
}

async function writeStore(store: PreferenceStore) {
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function getFingerprint() {
  const requestHeaders = await headers();
  const visitorIp = getVisitorIp(requestHeaders);
  return createHash("sha256")
    .update(`${process.env.VISITOR_LANGUAGE_SALT ?? "arctic-parts-language"}:${visitorIp}`)
    .digest("hex")
    .slice(0, 24);
}

export async function GET() {
  const fingerprint = await getFingerprint();
  const store = await readStore();

  return NextResponse.json(
    { fingerprint, selectedLocale: store[fingerprint] ?? null },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const locale = body?.locale;

  if (!isVisitorLocale(locale)) {
    return NextResponse.json(
      { error: "Invalid locale" },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const fingerprint = await getFingerprint();
  const store = await readStore();
  store[fingerprint] = locale;
  await writeStore(store);

  return NextResponse.json(
    { fingerprint, selectedLocale: locale },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
