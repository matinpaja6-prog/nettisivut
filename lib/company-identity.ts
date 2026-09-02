// Public registered company details checked from PRH on 2026-09-02.
// Source: https://avoindata.prh.fi/opendata-ytj-api/v3/companies?businessId=3576714-8
// This is not a pickup address or a seller's return address.
export const COMPANY_IDENTITY = {
  name: "Arctic Parts Oy",
  businessId: "3576714-8",
  registeredAddress: "Linnuntie 3 A 2, 71800 Siilinjärvi, Finland",
  email: "info@maskines.com",
  checkedAt: "2026-09-02"
} as const;

export const companyIdentityCopy = {
  fi: { operator: "Palvelun ylläpitäjä", businessId: "Y-tunnus", address: "Yrityksen rekisteriosoite", sellerRole: "Tuotteen myyjä nimetään ilmoituksessa ja kassalla. Jos myyjäksi on merkitty Arctic Parts Oy, yhtiö vastaa myös kyseisen kaupan myyjän velvoitteista." },
  en: { operator: "Service operator", businessId: "Business ID", address: "Registered company address", sellerRole: "The product seller is identified in the listing and at checkout. If Arctic Parts Oy is named as the seller, the company is also responsible for the seller's obligations in that sale." },
  sv: { operator: "Tjänstens operatör", businessId: "FO-nummer", address: "Företagets registrerade adress", sellerRole: "Produktens säljare anges i annonsen och i kassan. Om Arctic Parts Oy anges som säljare ansvarar bolaget också för säljarens skyldigheter i det köpet." },
  no: { operator: "Tjenesteoperatør", businessId: "Finsk organisasjonsnummer", address: "Bedriftens registrerte adresse", sellerRole: "Selgeren av produktet er oppgitt i annonsen og i kassen. Hvis Arctic Parts Oy er oppgitt som selger, er selskapet også ansvarlig for selgerens plikter i det kjøpet." }
} as const;
