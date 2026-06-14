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

const URL_PATTERN =
  /https?:\/\/|hxxps?:\/\/|www(?:\.|\s*\[\s*dot\s*\]\s*|\s+dot\s+)|\b[a-z0-9][a-z0-9-]{1,62}(?:\.|\s*\[\s*dot\s*\]\s*|\s+dot\s+)(fi|com|net|org|eu|se|no|de|fr|io|app|shop|store)\b/gi;

const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+\-]+\s*(?:@|\[\s*at\s*\]|\(\s*at\s*\)|\s+at\s+)\s*[a-zA-Z0-9.\-]+\s*(?:\.|\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+)\s*[a-zA-Z]{2,}/gi;

const PHONE_PATTERN =
  /(\+?358[\s().\-]?\d{2,3}[\s().\-]?\d{3,4}[\s().\-]?\d{2,4}|\b0[45]\d[\s().\-]?\d{3}[\s().\-]?\d{2,4}\b|\b\(?\d{2,3}\)?[\s.\-]?\d{3}[\s.\-]\d{2,4}\b)/g;

const CONTACT_INTENT_PATTERN =
  /\b(puh|puhelin|numero|nro|soita|tekstaa|sms|whatsapp|wa|telegram|signal|snap|snapchat|ig|instagram|facebook|fb)\b/i;

const SOCIAL_HANDLE_PATTERN =
  /(^|\s)@[a-z0-9_.-]{3,30}\b/i;

const BUSINESS_KEYWORDS = [
  /\bOy\b/,
  /\bAb\b/,
  /\bLtd\b/,
  /\bGmbH\b/,
  /\bverkkokauppa\b/i,
  /\bnettikauppa\b/i,
  /\bwebshop\b/i,
  /\btilaa netist[aä]\b/i,
  /\btilaa osoitteesta\b/i,
  /\bk[aä]y sivuilla\b/i,
  /\bk[aä]y kaupassa\b/i,
  /\bfacebook.*sivu\b/i,
  /\binstagram.*@\b/i,
  /\bwhatsapp.*ryhm[aä]\b/i,
  /\bota yhteytt[aä].*s[aä]hk[oö]post\b/i,
  /\bl[aä]het[aä].*viesti\b.*\bsivuille\b/i,
  /\bkts?\.\s*profiili\b/i,
  /\bkatso profiili\b/i
];

const SPAM_PATTERNS = [
  /(.)\1{6,}/,
  /[A-ZÄÖÅ\s]{20,}/,
  /\b(klikk|click|klick).*linkk\b/i,
  /\b(voita|win|gewinn)\b.*\b(palkinto|prize|preis)\b/i,
  /\bpyyntihinta\b.*\bnegotiable\b/i
];

const PROHIBITED = [
  /\bkutsun.*verkostoon\b/i,
  /\bjoin.*network\b/i,
  /\bmlm\b/i,
  /\bpyramidi\b/i,
  /\bbitcoin\b/i,
  /\bcrypto\b/i,
  /\bkryptovaluutta\b/i
];

function check(text: string): string[] {
  const issues: string[] = [];
  const compactDigits = text.replace(/\D/g, "");

  if (URL_PATTERN.test(text)) {
    issues.push("Ilmoitus sisaltaa verkko-osoitteen tai linkin. Linkit eivat ole sallittuja.");
    URL_PATTERN.lastIndex = 0;
  }

  if (EMAIL_PATTERN.test(text)) {
    issues.push("Ilmoitus sisaltaa sahkopostiosoitteen. Kayta alustan viestintaa.");
    EMAIL_PATTERN.lastIndex = 0;
  }

  if (PHONE_PATTERN.test(text)) {
    issues.push("Ilmoitus sisaltaa puhelinnumeron. Yhteystiedot loytyvat profiilista.");
    PHONE_PATTERN.lastIndex = 0;
  }

  if (CONTACT_INTENT_PATTERN.test(text) && compactDigits.length >= 7) {
    issues.push("Ilmoitus sisaltaa yhteystietoja. Kayta alustan viestintaa.");
  }

  if (SOCIAL_HANDLE_PATTERN.test(text)) {
    issues.push("Ilmoitus sisaltaa some-kayttajatunnuksen. Linkitys ulkopuolelle ei ole sallittua.");
  }

  for (const pattern of BUSINESS_KEYWORDS) {
    if (pattern.test(text)) {
      issues.push("Ilmoitus vaikuttaa ulkopuoliselta mainokselta.");
      break;
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      issues.push("Ilmoitus sisaltaa roskapostille tyypillisia piirteita.");
      break;
    }
  }

  for (const pattern of PROHIBITED) {
    if (pattern.test(text)) {
      issues.push("Ilmoitus sisaltaa kiellettya sisaltoa.");
      break;
    }
  }

  return issues;
}

export async function POST(req: NextRequest): Promise<NextResponse<ModerationResult>> {
  const body: ModerationInput = await req.json();

  const combined = [
    body.title ?? "",
    body.description ?? "",
    body.location ?? ""
  ].join(" ");

  const reasons = check(combined);

  if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price <= 0) {
    reasons.push("Ilmoituksella taytyy olla hinta. Hinnan taytyy olla vahintaan 1 euro.");
  }

  return NextResponse.json({ allowed: reasons.length === 0, reasons });
}
