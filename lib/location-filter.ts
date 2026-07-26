import {
  FINLAND_MUNICIPALITIES,
  FINLAND_MUNICIPALITIES_BY_REGION
} from "@/lib/finland-locations";

export type LocationFilterSelection = {
  countries: string[];
  regions: string[];
  municipalities: string[];
};

export type LocationCountryOption = {
  value: string;
  label: string;
  aliases: string[];
};

export const LOCATION_COUNTRIES: LocationCountryOption[] = [
  { value: "FI", label: "Suomi", aliases: ["Suomi", "Finland"] },
  { value: "SE", label: "Ruotsi", aliases: ["Ruotsi", "Sverige", "Sweden"] },
  { value: "DE", label: "Saksa", aliases: ["Saksa", "Deutschland", "Germany"] },
  { value: "NO", label: "Norja", aliases: ["Norja", "Norge", "Norway"] },
  { value: "DK", label: "Tanska", aliases: ["Tanska", "Danmark", "Denmark"] },
  { value: "EE", label: "Viro", aliases: ["Viro", "Eesti", "Estonia"] }
];

const LOCATION_FILTER_PREFIX = "location:v1:";
const EMPTY_LOCATION_SELECTION: LocationFilterSelection = {
  countries: [],
  regions: [],
  municipalities: []
};

function normalizeLocationText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsLocationTerm(location: string, term: string) {
  const normalizedLocation = ` ${normalizeLocationText(location)} `;
  const normalizedTerm = normalizeLocationText(term);
  return Boolean(normalizedTerm) && normalizedLocation.includes(` ${normalizedTerm} `);
}

const normalizedFinnishMunicipalities = FINLAND_MUNICIPALITIES.map((municipality) =>
  normalizeLocationText(municipality)
);

export function countryFlagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/g, (letter) =>
      String.fromCodePoint(127397 + letter.charCodeAt(0))
    );
}

export function parseLocationFilter(value: string): LocationFilterSelection {
  if (!value.startsWith(LOCATION_FILTER_PREFIX)) return EMPTY_LOCATION_SELECTION;

  try {
    const parsed = JSON.parse(value.slice(LOCATION_FILTER_PREFIX.length)) as Partial<LocationFilterSelection>;
    return {
      countries: Array.isArray(parsed.countries) ? parsed.countries.filter(Boolean) : [],
      regions: Array.isArray(parsed.regions) ? parsed.regions.filter(Boolean) : [],
      municipalities: Array.isArray(parsed.municipalities) ? parsed.municipalities.filter(Boolean) : []
    };
  } catch {
    return EMPTY_LOCATION_SELECTION;
  }
}

export function serializeLocationFilter(selection: LocationFilterSelection) {
  if (
    selection.countries.length === 0 &&
    selection.regions.length === 0 &&
    selection.municipalities.length === 0
  ) {
    return "";
  }

  return `${LOCATION_FILTER_PREFIX}${JSON.stringify(selection)}`;
}

export function listingMatchesLocationFilter(location: string, filterValue: string) {
  if (!filterValue.trim()) return true;

  if (!filterValue.startsWith(LOCATION_FILTER_PREFIX)) {
    return normalizeLocationText(location).includes(normalizeLocationText(filterValue));
  }

  const selection = parseLocationFilter(filterValue);
  const selectedRegionMunicipalities = selection.regions.flatMap(
    (region) => FINLAND_MUNICIPALITIES_BY_REGION[region] ?? []
  );
  const specificFinnishTerms = [
    ...selection.regions,
    ...selectedRegionMunicipalities,
    ...selection.municipalities
  ];
  const hasSpecificFinlandFilter = specificFinnishTerms.length > 0;
  const matchesSpecificFinland = specificFinnishTerms.some((term) =>
    containsLocationTerm(location, term)
  );
  const normalizedLocation = normalizeLocationText(location);
  const isFinnishLocation =
    LOCATION_COUNTRIES.find((country) => country.value === "FI")?.aliases.some((alias) =>
      containsLocationTerm(location, alias)
    ) ||
    normalizedFinnishMunicipalities.some((municipality) =>
      ` ${normalizedLocation} `.includes(` ${municipality} `)
    );

  if (selection.countries.length === 0) {
    return hasSpecificFinlandFilter ? matchesSpecificFinland : true;
  }

  return selection.countries.some((countryCode) => {
    if (countryCode === "FI") {
      return Boolean(isFinnishLocation) && (
        !hasSpecificFinlandFilter || matchesSpecificFinland
      );
    }

    const country = LOCATION_COUNTRIES.find((item) => item.value === countryCode);
    return country?.aliases.some((alias) => containsLocationTerm(location, alias)) ?? false;
  });
}
