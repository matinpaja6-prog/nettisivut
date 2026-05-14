import { NextRequest, NextResponse } from "next/server";

interface ModerationInput {
  title?: string;
  description?: string;
  price?: number;
  location?: string;
}

interface ModerationResult {
  allowed: boolean;
  reasons: string[];
}

// ── Patterns ──────────────────────────────────────────────────────────────────

const URL_PATTERN = /https?:\/\/|www\.\S+|\S+\.(fi|com|net|org|eu|se|no|de|fr)\b/gi;

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi;

// Finnish/Nordic phone numbers: +358..., 040/041/044/045/050 etc, (09) landlines
const PHONE_PATTERN =
  /(\+358[\s\-]?\d{2,3}[\s\-]?\d{3,4}[\s\-]?\d{2,4}|\b0[45]\d[\s\-]?\d{3}[\s\-]?\d{2,4}\b|\b\(?\d{2,3}\)?\s?\d{3}[\s\-]\d{2,4}\b)/g;

// Business advertising keywords (Finnish)
const BUSINESS_KEYWORDS = [
  /\bOy\b/, /\bAb\b/, /\bLtd\b/, /\bGmbH\b/,
  /\bverkkokauppa\b/i, /\bnettikauppa\b/i, /\bwebshop\b/i,
  /\btilaa netist[äa]\b/i, /\btilaa osoitteesta\b/i,
  /\bkäy sivuilla\b/i, /\bkäy kaupassa\b/i,
  /\bfacebook.*sivu\b/i, /\binstagram.*@\b/i,
  /\bwhatsapp.*ryhmä\b/i,
  /\bota yhteyttä.*s[äa]hk[öo]post\b/i,
  /\blähetä.*viesti\b.*\bsivuille\b/i,
  /\bkts?\.\s*profiili\b/i, /\bkatso profiili\b/i,
];

// Spam/scam patterns
const SPAM_PATTERNS = [
  /(.)\1{6,}/,           // same char repeated 7+ times
  /[A-ZÄÖÅ\s]{20,}/,    // 20+ consecutive uppercase chars
  /\b(klikk|click|klick).*linkk\b/i,
  /\b(voita|win|gewinn)\b.*\b(palkinto|prize|preis)\b/i,
  /\bpyyntihinta\b.*\bnegotiable\b/i, // mixing languages suspiciously
];

// Prohibited words / scam indicators
const PROHIBITED = [
  /\bkutsun.*verkostoon\b/i, /\bjoin.*network\b/i,
  /\bmlm\b/i, /\bpyramidi\b/i,
  /\bbitcoin\b/i, /\bcrypto\b/i, /\bkryptovaluutta\b/i,
];

// ── Checker ───────────────────────────────────────────────────────────────────

function check(text: string): string[] {
  const issues: string[] = [];

  if (URL_PATTERN.test(text)) {
    issues.push("Ilmoitus sisältää verkko-osoitteen tai linkin. Linkit eivät ole sallittuja.");
    URL_PATTERN.lastIndex = 0;
  }

  if (EMAIL_PATTERN.test(text)) {
    issues.push("Ilmoitus sisältää sähköpostiosoitteen. Käytä alustan viestintää.");
    EMAIL_PATTERN.lastIndex = 0;
  }

  if (PHONE_PATTERN.test(text)) {
    issues.push("Ilmoitus sisältää puhelinnumeron. Yhteystiedot löytyvät profiilista.");
    PHONE_PATTERN.lastIndex = 0;
  }

  for (const pattern of BUSINESS_KEYWORDS) {
    if (pattern.test(text)) {
      issues.push("Ilmoitus vaikuttaa yrityksen mainokselta. Vain yksityismyynti on sallittua.");
      break;
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      issues.push("Ilmoitus sisältää roskapostille tyypillisiä piirteitä.");
      break;
    }
  }

  for (const pattern of PROHIBITED) {
    if (pattern.test(text)) {
      issues.push("Ilmoitus sisältää kiellettyä sisältöä.");
      break;
    }
  }

  return issues;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<ModerationResult>> {
  const body: ModerationInput = await req.json();

  const combined = [
    body.title ?? "",
    body.description ?? "",
    body.location ?? "",
  ].join(" ");

  const reasons = check(combined);

  // Extra: suspiciously low or zero price with long description (possible bait)
  if (typeof body.price === "number" && body.price === 0 && (body.description?.length ?? 0) > 100) {
    reasons.push("Hinta on 0 € mutta kuvaus on pitkä — tarkista että hinta on oikein.");
  }

  return NextResponse.json({ allowed: reasons.length === 0, reasons });
}
