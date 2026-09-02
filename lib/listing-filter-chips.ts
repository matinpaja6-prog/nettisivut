import type { AppliedListingFilters } from "./database-listing-filters";
import { parseLocationFilter } from "./location-filter";

type Field = keyof AppliedListingFilters;
type Locale = "fi" | "en" | "sv" | "no";
type Group = { id: string; fields: Field[]; labels: [string, string, string, string]; reset?: Field[] };
const groups: Group[] = [
  { id: "query", fields: ["query"], labels: ["Haku", "Search", "Sökning", "Søk"] },
  { id: "category", fields: ["category", "subcategory"], labels: ["Kategoria", "Category", "Kategori", "Kategori"] },
  { id: "vehicle", fields: ["vehicleType", "vehicleSubtype"], labels: ["Ajoneuvo", "Vehicle", "Fordon", "Kjøretøy"], reset: ["selectedBrand", "modelQuery", "garageFilterId"] },
  { id: "brand", fields: ["selectedBrand"], labels: ["Merkki", "Brand", "Märke", "Merke"], reset: ["modelQuery", "garageFilterId"] },
  { id: "model", fields: ["modelQuery"], labels: ["Malli", "Model", "Modell", "Modell"], reset: ["garageFilterId"] },
  { id: "identifier", fields: ["identifierQuery"], labels: ["Osanumero", "Part number", "Artikelnummer", "Delenummer"] },
  { id: "location", fields: ["locationQuery"], labels: ["Sijainti", "Location", "Plats", "Sted"] },
  { id: "year", fields: ["yearQuery", "yearMinQuery", "yearMaxQuery"], labels: ["Vuosi", "Year", "År", "År"] },
  { id: "engine", fields: ["engineCcQuery", "engineModelQuery", "vehicleEngineKindQuery", "vehicleDriveTypeQuery", "vehicleRoadLegalQuery"], labels: ["Tekniikka", "Specifications", "Teknik", "Teknikk"] },
  { id: "usage", fields: ["vehicleMileageMinQuery", "vehicleMileageMaxQuery", "vehicleHoursMinQuery", "vehicleHoursMaxQuery"], labels: ["Käyttö", "Usage", "Användning", "Bruk"] },
  { id: "registration", fields: ["vehicleRegistrationQuery"], labels: ["Rekisteritunnus", "Registration", "Registrering", "Registrering"] },
  { id: "accessories", fields: ["vehicleAccessoriesQuery"], labels: ["Varusteet", "Accessories", "Utrustning", "Utstyr"] },
  { id: "colors", fields: ["vehicleColorsQuery"], labels: ["Värit", "Colours", "Färger", "Farger"] },
  { id: "vat", fields: ["vehicleVatDeductibleQuery"], labels: ["ALV-vähennyskelpoinen", "VAT deductible", "Avdragsgill moms", "Fradragsberettiget MVA"] },
  { id: "tax", fields: ["vehicleTaxFreeQuery"], labels: ["Veroton", "Tax free", "Skattefri", "Avgiftsfri"] },
  { id: "track", fields: ["trackMatDimensionQuery"], labels: ["Telamatto", "Track", "Drivmatta", "Belte"] },
  { id: "price", fields: ["minPrice", "maxPrice"], labels: ["Hinta", "Price", "Pris", "Pris"] },
  { id: "garage", fields: ["garageFilterId"], labels: ["Tallin ajoneuvo", "Garage vehicle", "Garagefordon", "Garasjekjøretøy"] },
  { id: "gear", fields: ["gearTypeQuery"], labels: ["Ajovaruste", "Riding gear", "Körutrustning", "Kjøreutstyr"] },
  { id: "gear-brand", fields: ["gearBrandOptionsQuery", "gearBrandQuery"], labels: ["Tuotemerkki", "Gear brand", "Varumärke", "Varemerke"] },
  { id: "size", fields: ["gearSizeOptionsQuery", "gearSizeQuery"], labels: ["Koko", "Size", "Storlek", "Størrelse"] },
  { id: "condition", fields: ["gearConditionQuery"], labels: ["Kunto", "Condition", "Skick", "Tilstand"] },
  { id: "target", fields: ["gearTargetQuery"], labels: ["Käyttäjäryhmä", "Fit", "Målgrupp", "Målgruppe"] },
  { id: "seller", fields: ["sellerType"], labels: ["Myyjä", "Seller", "Säljare", "Selger"] }
];

function isSet(key: Field, value: AppliedListingFilters[Field]) {
  if (key === "selectedBrand") return Boolean(value && value !== "Kaikki");
  if (key === "maxPrice") return typeof value === "number" && value < 100000;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

export function listingFilterChips(filters: AppliedListingFilters, locale: Locale) {
  const languageIndex = ["fi", "en", "sv", "no"].indexOf(locale);
  return groups.filter(group => group.fields.some(key => isSet(key, filters[key]))).map(group => {
    const values = group.fields.filter(key => isSet(key, filters[key])).flatMap(key => {
      const value = filters[key];
      if (key === "locationQuery" && typeof value === "string" && value.startsWith("location:v1:")) {
        const location = parseLocationFilter(value);
        const countryNames = { FI: ["Suomi", "Finland", "Finland", "Finland"], SE: ["Ruotsi", "Sweden", "Sverige", "Sverige"], NO: ["Norja", "Norway", "Norge", "Norge"] };
        return [...location.countries.map(code => countryNames[code as keyof typeof countryNames]?.[languageIndex] || code),
          ...location.regions, ...location.municipalities].map(name => name.replace(/^(SE|NO)\|/, ""));
      }
      return typeof value === "boolean" || key === "garageFilterId" ? [] : Array.isArray(value) ? value : [String(value)];
    });
    const value = group.id === "price"
      ? `${filters.minPrice || 0}–${filters.maxPrice < 100000 ? filters.maxPrice : "∞"} €`
      : [...new Set(values)].join(" / ");
    return { id: group.id, label: group.labels[languageIndex], value };
  });
}

export function removeListingFilter(filters: AppliedListingFilters, id: string): AppliedListingFilters {
  const group = groups.find(group => group.id === id);
  if (!group) return filters;
  return Object.fromEntries(Object.entries(filters).map(([key, value]) => {
    if (![...group.fields, ...(group.reset ?? [])].includes(key as Field)) return [key, value];
    return [key, key === "selectedBrand" ? "Kaikki" : key === "maxPrice" ? 100000
      : Array.isArray(value) ? [] : typeof value === "boolean" ? false : typeof value === "number" ? 0 : ""];
  })) as AppliedListingFilters;
}
