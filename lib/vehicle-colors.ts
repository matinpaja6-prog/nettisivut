export type VehicleColorOption = {
  label: string;
  swatch: string;
};

export const VEHICLE_COLOR_OPTIONS: readonly VehicleColorOption[] = [
  { label: "Beige", swatch: "#d6b37a" },
  { label: "Harmaa", swatch: "#a8adb1" },
  { label: "Hopea", swatch: "linear-gradient(145deg, #8d9499, #ffffff 48%, #aab0b4)" },
  { label: "Keltainen", swatch: "#f2c500" },
  { label: "Kupari", swatch: "linear-gradient(145deg, #ffc14d, #bf7100)" },
  { label: "Musta", swatch: "#35383b" },
  { label: "Oranssi", swatch: "#ff7613" },
  { label: "Punainen", swatch: "#ef3e43" },
  { label: "Ruskea", swatch: "#8b5d17" },
  { label: "Sininen", swatch: "#2f69cc" },
  { label: "Turkoosi", swatch: "#05bdd2" },
  { label: "Valkoinen", swatch: "linear-gradient(145deg, #ffffff, #e1e4e6)" },
  { label: "Vihre\u00e4", swatch: "#64a91f" },
  { label: "Violetti", swatch: "#7b4ce1" },
  { label: "Muu", swatch: "linear-gradient(145deg, #f7f7f7, #d8dde0)" }
] as const;

export const VEHICLE_COLORS_DESCRIPTION_LABEL = "Ajoneuvon v\u00e4ri";

type VehicleColorLocale = "fi" | "en" | "sv" | "no";

const VEHICLE_COLOR_TRANSLATIONS: Record<Exclude<VehicleColorLocale, "fi">, Record<string, string>> = {
  en: {
    Beige: "Beige", Harmaa: "Gray", Hopea: "Silver", Keltainen: "Yellow", Kupari: "Copper",
    Musta: "Black", Oranssi: "Orange", Punainen: "Red", Ruskea: "Brown", Sininen: "Blue",
    Turkoosi: "Turquoise", Valkoinen: "White", "Vihre\u00e4": "Green", Violetti: "Purple", Muu: "Other"
  },
  sv: {
    Beige: "Beige", Harmaa: "Gr\u00e5", Hopea: "Silver", Keltainen: "Gul", Kupari: "Koppar",
    Musta: "Svart", Oranssi: "Orange", Punainen: "R\u00f6d", Ruskea: "Brun", Sininen: "Bl\u00e5",
    Turkoosi: "Turkos", Valkoinen: "Vit", "Vihre\u00e4": "Gr\u00f6n", Violetti: "Lila", Muu: "Annan"
  },
  no: {
    Beige: "Beige", Harmaa: "Gr\u00e5", Hopea: "S\u00f8lv", Keltainen: "Gul", Kupari: "Kobber",
    Musta: "Svart", Oranssi: "Oransje", Punainen: "R\u00f8d", Ruskea: "Brun", Sininen: "Bl\u00e5",
    Turkoosi: "Turkis", Valkoinen: "Hvit", "Vihre\u00e4": "Gr\u00f8nn", Violetti: "Lilla", Muu: "Annen"
  }
};

export function translateVehicleColor(locale: VehicleColorLocale, value: string) {
  if (locale === "fi") return value;
  return VEHICLE_COLOR_TRANSLATIONS[locale][value] ?? value;
}

export function readVehicleColors(description: string | null | undefined): string[] {
  if (!description) return [];
  const label = VEHICLE_COLORS_DESCRIPTION_LABEL.toLocaleLowerCase("fi-FI");
  const line = description
    .split(/\r?\n/)
    .find((item) => item.trim().toLocaleLowerCase("fi-FI").startsWith(`${label}:`));
  if (!line) return [];

  return line
    .slice(line.indexOf(":") + 1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
