const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  suomi: "FI",
  finland: "FI",
  ruotsi: "SE",
  sverige: "SE",
  sweden: "SE",
  norja: "NO",
  norge: "NO",
  norway: "NO",
  tanska: "DK",
  danmark: "DK",
  denmark: "DK",
  viro: "EE",
  eesti: "EE",
  estonia: "EE",
  islanti: "IS",
  island: "IS",
  iceland: "IS",
  saksa: "DE",
  deutschland: "DE",
  germany: "DE"
};

function countryLookupKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeCountryCode(value: unknown, fallback = "") {
  const raw = String(value ?? "").trim();
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return COUNTRY_NAME_TO_ISO[countryLookupKey(raw)] ?? fallback;
}
