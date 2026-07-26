import {
  FINLAND_MUNICIPALITIES,
  FINLAND_MUNICIPALITIES_BY_REGION,
  FINLAND_REGIONS
} from "@/lib/finland-locations";
import {
  SWEDEN_COUNTIES,
  SWEDEN_MUNICIPALITIES,
  SWEDEN_MUNICIPALITIES_BY_COUNTY
} from "@/lib/sweden-locations";

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
  { value: "SE", label: "Sverige", aliases: ["Ruotsi", "Sverige", "Sweden"] }
];

const LOCATION_FILTER_PREFIX = "location:v1:";
const SWEDEN_LOCATION_PREFIX = "SE|";
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
const normalizedFinnishRegions = FINLAND_REGIONS.map((region) =>
  normalizeLocationText(region)
);
const normalizedSwedishMunicipalities = SWEDEN_MUNICIPALITIES.map((municipality) =>
  normalizeLocationText(municipality)
);
const normalizedSwedishCounties = SWEDEN_COUNTIES.map((county) =>
  normalizeLocationText(county)
);

export function toSwedenLocationValue(locationName: string) {
  return `${SWEDEN_LOCATION_PREFIX}${locationName}`;
}

export function getSwedenLocationName(value: string) {
  return value.startsWith(SWEDEN_LOCATION_PREFIX)
    ? value.slice(SWEDEN_LOCATION_PREFIX.length)
    : null;
}

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
      countries: Array.isArray(parsed.countries)
        ? parsed.countries.filter((country) => country === "FI" || country === "SE")
        : [],
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
  const selectedFinnishRegions = selection.regions.filter(
    (region) => !getSwedenLocationName(region)
  );
  const selectedSwedishCounties = selection.regions
    .map(getSwedenLocationName)
    .filter((county): county is string => Boolean(county));
  const selectedFinnishMunicipalities = selection.municipalities.filter(
    (municipality) => !getSwedenLocationName(municipality)
  );
  const selectedSwedishMunicipalities = selection.municipalities
    .map(getSwedenLocationName)
    .filter((municipality): municipality is string => Boolean(municipality));
  const selectedRegionMunicipalities = selectedFinnishRegions.flatMap(
    (region) => FINLAND_MUNICIPALITIES_BY_REGION[region] ?? []
  );
  const selectedCountyMunicipalities = selectedSwedishCounties.flatMap(
    (county) => SWEDEN_MUNICIPALITIES_BY_COUNTY[county] ?? []
  );
  const specificFinnishTerms = [
    ...selectedFinnishRegions,
    ...selectedRegionMunicipalities,
    ...selectedFinnishMunicipalities
  ];
  const specificSwedishTerms = [
    ...selectedSwedishCounties,
    ...selectedCountyMunicipalities,
    ...selectedSwedishMunicipalities
  ];
  const hasSpecificFinlandFilter = specificFinnishTerms.length > 0;
  const hasSpecificSwedenFilter = specificSwedishTerms.length > 0;
  const matchesSpecificFinland = specificFinnishTerms.some((term) =>
    containsLocationTerm(location, term)
  );
  const matchesSpecificSweden = specificSwedishTerms.some((term) =>
    containsLocationTerm(location, term)
  );
  const normalizedLocation = normalizeLocationText(location);
  const isFinnishLocation =
    LOCATION_COUNTRIES.find((country) => country.value === "FI")?.aliases.some((alias) =>
      containsLocationTerm(location, alias)
    ) ||
    normalizedFinnishMunicipalities.some((municipality) =>
      ` ${normalizedLocation} `.includes(` ${municipality} `)
    ) ||
    normalizedFinnishRegions.some((region) =>
      ` ${normalizedLocation} `.includes(` ${region} `)
    );
  const isSwedishLocation =
    LOCATION_COUNTRIES.find((country) => country.value === "SE")?.aliases.some((alias) =>
      containsLocationTerm(location, alias)
    ) ||
    normalizedSwedishMunicipalities.some((municipality) =>
      ` ${normalizedLocation} `.includes(` ${municipality} `)
    ) ||
    normalizedSwedishCounties.some((county) =>
      ` ${normalizedLocation} `.includes(` ${county} `)
    );

  if (selection.countries.length === 0) {
    if (hasSpecificFinlandFilter || hasSpecificSwedenFilter) {
      return matchesSpecificFinland || matchesSpecificSweden;
    }
    return true;
  }

  return selection.countries.some((countryCode) => {
    if (countryCode === "FI") {
      return Boolean(isFinnishLocation) && (
        !hasSpecificFinlandFilter || matchesSpecificFinland
      );
    }

    if (countryCode === "SE") {
      return Boolean(isSwedishLocation) && (
        !hasSpecificSwedenFilter || matchesSpecificSweden
      );
    }

    const country = LOCATION_COUNTRIES.find((item) => item.value === countryCode);
    return country?.aliases.some((alias) => containsLocationTerm(location, alias)) ?? false;
  });
}
