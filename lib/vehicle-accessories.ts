export const VEHICLE_ACCESSORY_OPTIONS = [
  "12V ulosotto",
  "Astinlaudat",
  "Huoltokirja",
  "Kaatumaraudat",
  "Kahvanl\u00e4mmittimet",
  "Lis\u00e4puskuri",
  "Lohkol\u00e4mmitin",
  "Luistonesto",
  "Lukkiutumattomat jarrut (ABS)",
  "L\u00e4mmitett\u00e4v\u00e4t kahvat matkustajalle",
  "Madallussarja",
  "Matkustajan istuin",
  "Navigaattori",
  "Ohjaustehostin",
  "Penkinl\u00e4mmitin",
  "Peruutusvaihde",
  "Pohjapanssari",
  "Puskulevy",
  "Selk\u00e4noja",
  "Sivulaukut",
  "S\u00e4hk\u00f6k\u00e4ynnistys",
  "Takalaukku",
  "Tavaralaatikko",
  "Telat",
  "Tuulisuoja",
  "Vakionopeuss\u00e4\u00e4din",
  "Vetokoukku",
  "Vinssi"
] as const;

export const VEHICLE_ACCESSORIES_DESCRIPTION_LABEL = "Lis\u00e4varusteet";

type VehicleAccessoryLocale = "fi" | "en" | "sv" | "no";

const VEHICLE_ACCESSORY_TRANSLATIONS: Record<Exclude<VehicleAccessoryLocale, "fi">, Record<string, string>> = {
  en: {
    "12V ulosotto": "12V outlet", Astinlaudat: "Running boards", Huoltokirja: "Service history",
    Kaatumaraudat: "Crash bars", "Kahvanl\u00e4mmittimet": "Heated grips", "Lis\u00e4puskuri": "Additional bumper",
    "Lohkol\u00e4mmitin": "Engine block heater", Luistonesto: "Traction control",
    "Lukkiutumattomat jarrut (ABS)": "Anti-lock brakes (ABS)",
    "L\u00e4mmitett\u00e4v\u00e4t kahvat matkustajalle": "Heated passenger grips", Madallussarja: "Lowering kit",
    "Matkustajan istuin": "Passenger seat", Navigaattori: "Navigator / GPS", Ohjaustehostin: "Power steering",
    "Penkinl\u00e4mmitin": "Seat heater", Peruutusvaihde: "Reverse gear", Pohjapanssari: "Skid plate",
    Puskulevy: "Plow blade", "Selk\u00e4noja": "Backrest", Sivulaukut: "Side cases",
    "S\u00e4hk\u00f6k\u00e4ynnistys": "Electric start", Takalaukku: "Top case", Tavaralaatikko: "Cargo box",
    Telat: "Tracks", Tuulisuoja: "Windshield", "Vakionopeuss\u00e4\u00e4din": "Cruise control",
    Vetokoukku: "Tow hitch", Vinssi: "Winch"
  },
  sv: {
    "12V ulosotto": "12 V-uttag", Astinlaudat: "Fotsteg", Huoltokirja: "Servicebok",
    Kaatumaraudat: "St\u00f6rtb\u00e5gar", "Kahvanl\u00e4mmittimet": "Handtagsv\u00e4rmare", "Lis\u00e4puskuri": "Extra st\u00f6tf\u00e5ngare",
    "Lohkol\u00e4mmitin": "Motorv\u00e4rmare", Luistonesto: "Antispinn", "Lukkiutumattomat jarrut (ABS)": "L\u00e5sningsfria bromsar (ABS)",
    "L\u00e4mmitett\u00e4v\u00e4t kahvat matkustajalle": "Uppv\u00e4rmda passagerarhandtag", Madallussarja: "S\u00e4nkningssats",
    "Matkustajan istuin": "Passagerars\u00e4te", Navigaattori: "Navigator / GPS", Ohjaustehostin: "Servostyrning",
    "Penkinl\u00e4mmitin": "S\u00e4tesv\u00e4rme", Peruutusvaihde: "Backv\u00e4xel", Pohjapanssari: "Haspl\u00e5t",
    Puskulevy: "Plogblad", "Selk\u00e4noja": "Ryggst\u00f6d", Sivulaukut: "Sidov\u00e4skor",
    "S\u00e4hk\u00f6k\u00e4ynnistys": "Elstart", Takalaukku: "Toppbox", Tavaralaatikko: "Lastl\u00e5da",
    Telat: "Band", Tuulisuoja: "Vindruta", "Vakionopeuss\u00e4\u00e4din": "Farth\u00e5llare",
    Vetokoukku: "Dragkrok", Vinssi: "Vinsch"
  },
  no: {
    "12V ulosotto": "12 V-uttak", Astinlaudat: "Fotbrett", Huoltokirja: "Servicebok",
    Kaatumaraudat: "Velteb\u00f8yler", "Kahvanl\u00e4mmittimet": "H\u00e5ndtaksvarmere", "Lis\u00e4puskuri": "Ekstra st\u00f8tfanger",
    "Lohkol\u00e4mmitin": "Motorvarmer", Luistonesto: "Antispinn", "Lukkiutumattomat jarrut (ABS)": "ABS-bremser",
    "L\u00e4mmitett\u00e4v\u00e4t kahvat matkustajalle": "Oppvarmede passasjerh\u00e5ndtak", Madallussarja: "Senkesett",
    "Matkustajan istuin": "Passasjersete", Navigaattori: "Navigasjon / GPS", Ohjaustehostin: "Servostyring",
    "Penkinl\u00e4mmitin": "Setevarme", Peruutusvaihde: "Revers", Pohjapanssari: "Beskyttelsesplate",
    Puskulevy: "Br\u00f8yteskj\u00e6r", "Selk\u00e4noja": "Ryggst\u00f8tte", Sivulaukut: "Sidevesker",
    "S\u00e4hk\u00f6k\u00e4ynnistys": "Elstart", Takalaukku: "Toppboks", Tavaralaatikko: "Lastboks",
    Telat: "Belter", Tuulisuoja: "Vindskjerm", "Vakionopeuss\u00e4\u00e4din": "Cruisekontroll",
    Vetokoukku: "Tilhengerfeste", Vinssi: "Vinsj"
  }
};

export function translateVehicleAccessory(locale: VehicleAccessoryLocale, value: string) {
  if (locale === "fi") return value;
  return VEHICLE_ACCESSORY_TRANSLATIONS[locale][value] ?? value;
}

export function readVehicleAccessories(description: string | null | undefined): string[] {
  if (!description) return [];
  const line = description
    .split(/\r?\n/)
    .find((item) => item.trim().toLocaleLowerCase("fi-FI").startsWith(`${VEHICLE_ACCESSORIES_DESCRIPTION_LABEL.toLocaleLowerCase("fi-FI")}:`));
  if (!line) return [];

  return line
    .slice(line.indexOf(":") + 1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
