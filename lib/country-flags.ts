export type CountryFlagInfo = {
  code: string;
  label: string;
  src: string;
};

const REGION_CODES = [
  "AC", "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS",
  "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH",
  "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW",
  "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM",
  "CN", "CO", "CP", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DG",
  "DJ", "DK", "DM", "DO", "DZ", "EA", "EC", "EE", "EG", "EH", "ER", "ES",
  "ET", "EU", "EZ", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD",
  "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS",
  "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "IC", "ID",
  "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO",
  "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA",
  "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP",
  "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC",
  "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA",
  "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW",
  "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE",
  "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST",
  "SV", "SX", "SY", "SZ", "TA", "TC", "TD", "TF", "TG", "TH", "TJ", "TK",
  "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM",
  "UN", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF",
  "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW"
] as const;

const REGION_CODE_SET = new Set<string>(REGION_CODES);
const DISPLAY_NAME_LOCALES = [
  "fi",
  "en",
  "sv",
  "no",
  "nb",
  "da",
  "et",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl"
];

const COUNTRY_ALIASES: Record<string, string> = {
  ahvenanmaa: "AX",
  aland: "AX",
  britain: "GB",
  englanti: "GB",
  eesti: "EE",
  estonia: "EE",
  finland: "FI",
  finnland: "FI",
  norja: "NO",
  norge: "NO",
  ruotsi: "SE",
  saksa: "DE",
  soome: "FI",
  suomi: "FI",
  tanska: "DK",
  uk: "GB",
  usa: "US",
  viro: "EE",
  yhdysvallat: "US"
};

let countryNameIndex: Map<string, string> | null = null;

function normalizeCountryName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addCountryName(index: Map<string, string>, name: string, code: string) {
  const normalized = normalizeCountryName(name);
  if (normalized && !index.has(normalized)) {
    index.set(normalized, code);
  }
}

function getCountryNameIndex() {
  if (countryNameIndex) return countryNameIndex;

  const index = new Map<string, string>();

  for (const [name, code] of Object.entries(COUNTRY_ALIASES)) {
    addCountryName(index, name, code);
  }

  for (const code of REGION_CODES) {
    addCountryName(index, code, code);
  }

  if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
    for (const locale of DISPLAY_NAME_LOCALES) {
      const displayNames = new Intl.DisplayNames([locale], { type: "region" });
      for (const code of REGION_CODES) {
        const name = displayNames.of(code);
        if (name) addCountryName(index, name, code);
      }
    }
  }

  countryNameIndex = index;
  return index;
}

function matchCountryCode(candidate: string) {
  const trimmed = candidate.trim();
  const upper = trimmed.toUpperCase();

  if (/^[A-Z]{2}$/.test(upper) && REGION_CODE_SET.has(upper)) {
    return upper;
  }

  return getCountryNameIndex().get(normalizeCountryName(trimmed)) ?? null;
}

export function getCountryFlagFromLocation(
  location: string | null | undefined,
  fallbackCountry?: string | null
): CountryFlagInfo | null {
  const source = [location, fallbackCountry].filter(Boolean).join(", ");
  if (!source.trim()) return null;

  const candidates = source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reverse();

  for (const candidate of candidates) {
    const code = matchCountryCode(candidate);
    if (code) return buildCountryFlagInfo(code);
  }

  for (const token of source.split(/[\s,;/|]+/)) {
    const code = matchCountryCode(token);
    if (code) return buildCountryFlagInfo(code);
  }

  return null;
}

export function buildCountryFlagInfo(code: string): CountryFlagInfo | null {
  const upper = code.trim().toUpperCase();
  if (!REGION_CODE_SET.has(upper)) return null;

  return {
    code: upper,
    label: upper,
    src: `https://flagcdn.com/24x18/${upper.toLowerCase()}.png`
  };
}
