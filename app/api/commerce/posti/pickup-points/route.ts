import { NextResponse } from "next/server";

type CachedToken = {
  token: string;
  expiresAt: number;
  apiBaseUrl: string;
};

type PostiTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  posti_fi?: {
    targets?: Record<string, { url?: string }>;
  };
};

let cachedToken: CachedToken | null = null;
const cityPostalCodeCache = new Map<string, { postalCode: string; expiresAt: number }>();
const addressCoordinateCache = new Map<string, { coordinates: Coordinates; expiresAt: number }>();
const pickupPointElementCache = new Map<string, { elements: OverpassElement[]; expiresAt: number }>();

type NominatimResult = {
  lat?: string;
  lon?: string;
  address?: {
    postcode?: string;
  };
};

type Coordinates = { latitude: number; longitude: number };
type SupportedCountry = "FI" | "SE" | "NO";

type WfsFeature = {
  properties?: Record<string, unknown>;
};

type WfsResponse = {
  features?: WfsFeature[];
};

type OverpassElement = {
  id?: number;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

function configuredValue(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized.startsWith("REPLACE_WITH_") || normalized.startsWith("your-")) {
    return "";
  }
  return normalized;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function validHttpUrl(value: string, settingName: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
    return url.toString();
  } catch {
    throw new Error(`${settingName} on virheellinen.`);
  }
}

function apiBaseUrlFromToken(body: PostiTokenResponse) {
  const targets = body.posti_fi?.targets ?? {};
  const preferredVersion = configuredValue(process.env.POSTI_API_VERSION) || "2026-04";
  const preferredUrl = targets[preferredVersion]?.url;
  if (preferredUrl) return normalizeBaseUrl(preferredUrl);

  const newestTarget = Object.entries(targets)
    .filter(([, target]) => Boolean(target.url))
    .sort(([left], [right]) => right.localeCompare(left))[0]?.[1]?.url;

  return normalizeBaseUrl(newestTarget || `https://gateway.posti.fi/${preferredVersion}`);
}

const countryDetails: Record<SupportedCountry, { name: string; nominatimCode: string; postalLength: number }> = {
  FI: { name: "Finland", nominatimCode: "fi", postalLength: 5 },
  SE: { name: "Sweden", nominatimCode: "se", postalLength: 5 },
  NO: { name: "Norway", nominatimCode: "no", postalLength: 4 }
};

const localizedCityAliases: Partial<Record<SupportedCountry, Record<string, string>>> = {
  SE: {
    haaparanta: "Haparanda",
    kiiruna: "Kiruna",
    luulaja: "Luleå",
    malmö: "Malmö",
    tukholma: "Stockholm",
    uumaja: "Umeå"
  },
  NO: {
    bergen: "Bergen",
    oslo: "Oslo",
    tromssa: "Tromsø",
    trondheim: "Trondheim"
  }
};

function citySearchName(city: string, country: SupportedCountry) {
  const normalized = city.trim().toLocaleLowerCase("fi-FI");
  return localizedCityAliases[country]?.[normalized] ?? city.trim();
}

function normalizedPostalCode(value: string, country: SupportedCountry) {
  return value.replace(/\D/g, "").slice(0, countryDetails[country].postalLength);
}

function validPostalCode(value: string, country: SupportedCountry) {
  return new RegExp(`^\\d{${countryDetails[country].postalLength}}$`).test(value);
}

async function nordicPostalCodeForCity(city: string, country: Exclude<SupportedCountry, "FI">) {
  const details = countryDetails[country];
  const searchCity = citySearchName(city, country);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: `${searchCity}, ${details.name}`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
    countrycodes: details.nominatimCode,
    email: "info@maskines.com"
  }).toString();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MaskinesMarketplace/1.0 (Nordic pickup point search; info@maskines.com)"
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Kaupunkihakua ei voitu suorittaa.");
  const rows = await response.json().catch(() => []) as NominatimResult[];
  let postalCode = normalizedPostalCode(rows[0]?.address?.postcode ?? "", country);
  const latitude = Number(rows[0]?.lat);
  const longitude = Number(rows[0]?.lon);
  if (!validPostalCode(postalCode, country) && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    reverseUrl.search = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: "jsonv2",
      addressdetails: "1",
      email: "info@maskines.com"
    }).toString();
    const reverseResponse = await fetch(reverseUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MaskinesMarketplace/1.0 (Nordic pickup point search; info@maskines.com)"
      },
      cache: "no-store"
    });
    const reverseRow = reverseResponse.ok
      ? await reverseResponse.json().catch(() => ({})) as NominatimResult
      : {};
    postalCode = normalizedPostalCode(reverseRow.address?.postcode ?? "", country);
  }
  if (!validPostalCode(postalCode, country)) {
    throw new Error(`Kaupungille ${city} ei löytynyt postinumeroa maasta ${country === "SE" ? "Ruotsi" : "Norja"}.`);
  }
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const coordinateKey = `${postalCode} ${searchCity}, ${details.name}`.toLocaleLowerCase("fi-FI");
    addressCoordinateCache.set(coordinateKey, {
      coordinates: { latitude, longitude },
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });
  }
  return postalCode;
}

async function postalCodeForCity(city: string, country: SupportedCountry) {
  const cacheKey = `${country}:${city.toLocaleLowerCase("fi-FI")}`;
  const cached = cityPostalCodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.postalCode;

  if (country !== "FI") {
    const resolvedPostalCode = await nordicPostalCodeForCity(city, country);
    cityPostalCodeCache.set(cacheKey, {
      postalCode: resolvedPostalCode,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });
    return resolvedPostalCode;
  }

  const escapedCity = city.replace(/'/g, "''");
  const municipalityUrl = new URL("https://geo.stat.fi/geoserver/tilastointialueet/wfs");
  municipalityUrl.search = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "tilastointialueet:kunta1000k_2026",
    outputFormat: "application/json",
    propertyName: "kunta,nimi",
    CQL_FILTER: `strToLowerCase(nimi)=strToLowerCase('${escapedCity}')`,
    count: "1"
  }).toString();
  const municipalityResponse = await fetch(municipalityUrl, { cache: "force-cache" });
  if (!municipalityResponse.ok) throw new Error("Kaupunkihakua ei voitu suorittaa.");
  const municipalityBody = await municipalityResponse.json().catch(() => ({})) as WfsResponse;
  const municipalityCode = String(municipalityBody.features?.[0]?.properties?.kunta ?? "").trim();
  if (!municipalityCode) throw new Error(`Kaupunkia ${city} ei löytynyt.`);

  const postalAreasUrl = new URL("https://geo.stat.fi/geoserver/postialue/wfs");
  postalAreasUrl.search = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "postialue:pno_2026",
    outputFormat: "application/json",
    propertyName: "posti_alue,nimi,kunta",
    CQL_FILTER: `kunta='${municipalityCode}'`
  }).toString();
  const postalAreasResponse = await fetch(postalAreasUrl, { cache: "force-cache" });
  if (!postalAreasResponse.ok) throw new Error("Kaupungin postinumeroita ei voitu hakea.");
  const postalAreasBody = await postalAreasResponse.json().catch(() => ({})) as WfsResponse;
  const normalizedCity = city.toLocaleLowerCase("fi-FI");
  const candidates = (postalAreasBody.features ?? []).map((feature) => {
    const postalCode = String(feature.properties?.posti_alue ?? "").trim();
    const name = String(feature.properties?.nimi ?? "").trim();
    const normalizedName = name.toLocaleLowerCase("fi-FI");
    const score = (normalizedName.startsWith(normalizedCity) ? 10 : normalizedName.includes(normalizedCity) ? 7 : 0)
      + (/\bkesk(us|usta)\b/i.test(name) ? 3 : 0);
    return { postalCode, score };
  }).filter((candidate) => /^\d{5}$/.test(candidate.postalCode))
    .sort((left, right) => right.score - left.score || left.postalCode.localeCompare(right.postalCode));
  const resolvedPostalCode = candidates[0]?.postalCode ?? "";

  if (!/^\d{5}$/.test(resolvedPostalCode)) {
    throw new Error(`Kaupungille ${city} ei löytynyt postinumeroa.`);
  }
  cityPostalCodeCache.set(cacheKey, {
    postalCode: resolvedPostalCode,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  });
  return resolvedPostalCode;
}

async function coordinatesForAddress(street: string, postalCode: string, city: string, country: SupportedCountry) {
  const details = countryDetails[country];
  const address = [street, `${postalCode} ${citySearchName(city, country)}`.trim(), details.name].filter(Boolean).join(", ");
  const cacheKey = address.toLocaleLowerCase("fi-FI");
  const cached = addressCoordinateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.coordinates;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
    countrycodes: details.nominatimCode,
    email: "info@maskines.com"
  }).toString();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MaskinesMarketplace/1.0 (pickup distance calculation; info@maskines.com)"
    },
    cache: "no-store"
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []) as NominatimResult[];
  const latitude = Number(rows[0]?.lat);
  const longitude = Number(rows[0]?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const coordinates = { latitude, longitude };
  addressCoordinateCache.set(cacheKey, {
    coordinates,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  });
  return coordinates;
}

function distanceInMeters(origin: Coordinates, destination: Coordinates) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function postiToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken;

  const tokenUrl = validHttpUrl(
    configuredValue(process.env.POSTI_OAUTH_TOKEN_URL) || "https://gateway-auth.posti.fi/api/v1/token",
    "Postin kirjautumisosoite"
  );
  const clientId = configuredValue(process.env.POSTI_CLIENT_ID);
  const clientSecret = configuredValue(process.env.POSTI_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    throw new Error("Postin Pickup Point API -tunnukset puuttuvat.");
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    }),
    cache: "no-store"
  });

  const body = await response.json().catch(() => ({})) as PostiTokenResponse;
  if (!response.ok || !body.access_token) {
    const reason = body.error_description || body.error;
    throw new Error(reason ? `Posti-kirjautuminen epäonnistui: ${reason}` : `Posti-kirjautuminen epäonnistui (${response.status}).`);
  }

  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
    apiBaseUrl: apiBaseUrlFromToken(body)
  };
  return cachedToken;
}

function pickupPointRows(body: unknown, buyerCoordinates: Coordinates | null) {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const rows = Array.isArray(body)
    ? body
    : ([record.pickupPoints, record.locations, record.items, record.results].find(Array.isArray) ?? []);

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const location = row.location && typeof row.location === "object"
      ? row.location as Record<string, unknown>
      : {};
    const legacyAddress = row.address && typeof row.address === "object"
      ? row.address as Record<string, unknown>
      : {};
    const id = String(row.id ?? row.pickupPointId ?? row.pupCode ?? row.locationId ?? "").trim();
    const name = String(row.publicName ?? row.name ?? row.locationName ?? "Postin noutopiste").trim();
    const street = String(location.street ?? legacyAddress.streetAddress ?? legacyAddress.addressLine ?? row.address1 ?? "").trim();
    const postalCode = String(location.postcode ?? legacyAddress.postalCode ?? row.postalCode ?? row.zipCode ?? "").trim();
    const city = String(location.city ?? legacyAddress.city ?? row.city ?? "").trim();
    const specificLocation = String(location.specificLocation ?? "").trim();
    const rawCoordinates = location.coordinates && typeof location.coordinates === "object"
      ? location.coordinates as Record<string, unknown>
      : {};
    const latitude = Number(rawCoordinates.latitude);
    const longitude = Number(rawCoordinates.longitude);
    const pointCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
    const calculatedDistance = buyerCoordinates && pointCoordinates
      ? distanceInMeters(buyerCoordinates, pointCoordinates)
      : null;

    return {
      id,
      name,
      address: [street, `${postalCode} ${city}`.trim(), specificLocation].filter(Boolean).join(", "),
      postalCode,
      city,
      parcelLocker: row.parcelLocker === true,
      // Kun ostajan lähtöosoite tunnetaan, etäisyys lasketaan aina siitä.
      // Palveluntarjoajan distanceInMeters kuvaa muuten haetun postinumeron
      // keskipistettä ja näyttää esimerkiksi Vantaan sisäisiä metrejä.
      distanceInMeters: buyerCoordinates
        ? calculatedDistance
        : (typeof row.distanceInMeters === "number" ? row.distanceInMeters : null)
    };
  }).filter((row) => row.id && row.name && row.address)
    .sort((left, right) => (left.distanceInMeters ?? Number.POSITIVE_INFINITY) - (right.distanceInMeters ?? Number.POSITIVE_INFINITY))
    .slice(0, 30);
}

function bringPickupPointRows(body: unknown) {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const rows = Array.isArray(body)
    ? body
    : ([record.pickupPoint, record.pickupPoints, record.items, record.results].find(Array.isArray) ?? []);

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const id = String(row.id ?? row.unitId ?? row.pickupPointId ?? "").trim();
    const name = String(row.name ?? row.publicName ?? row.description ?? "Posten/Bring noutopiste").trim();
    const street = String(row.visitingAddress ?? row.address ?? row.street ?? "").trim();
    const postalCode = String(row.visitingPostalCode ?? row.postalCode ?? row.zipCode ?? "").trim();
    const city = String(row.visitingCity ?? row.city ?? "").trim();
    const rawType = String(row.type ?? row.pickupPointType ?? "").toLocaleLowerCase("en");
    const distanceInKm = Number(row.distanceInKm);
    const capabilities = Array.isArray(row.capabilities) ? row.capabilities.map(String) : [];

    return {
      id,
      name,
      address: [street, `${postalCode} ${city}`.trim()].filter(Boolean).join(", "),
      postalCode,
      city,
      parcelLocker: rawType.includes("locker") || capabilities.some((value) => /locker|parcelbox/i.test(value)),
      distanceInMeters: Number.isFinite(distanceInKm) ? Math.round(distanceInKm * 1000) : null
    };
  }).filter((row) => row.id && row.name && row.address)
    .sort((left, right) => (left.distanceInMeters ?? Number.POSITIVE_INFINITY) - (right.distanceInMeters ?? Number.POSITIVE_INFINITY))
    .slice(0, 30);
}

function openStreetMapPickupPointRows(
  elements: OverpassElement[],
  searchCoordinates: Coordinates,
  buyerCoordinates: Coordinates | null,
  fallbackPostalCode: string,
  fallbackCity: string
) {
  return elements.map((element) => {
    const tags = element.tags ?? {};
    const latitude = Number(element.lat ?? element.center?.lat);
    const longitude = Number(element.lon ?? element.center?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const parcelLocker = tags.amenity === "parcel_locker" || tags.parcel_locker === "yes";
    const operator = tags.brand || tags.operator || (parcelLocker ? "Posten" : "Posten/Bring");
    const name = tags.name || `${operator} ${parcelLocker ? "pakkeautomat" : "palvelupiste"}`;
    const street = [tags["addr:street"] || tags["contact:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
    const postalCode = tags["addr:postcode"] || tags.postal_code || "";
    const city = tags["addr:city"] || tags["addr:place"] || fallbackCity;
    const coordinates = { latitude, longitude };
    return {
      id: `osm-${element.type || "point"}-${element.id}`,
      name,
      address: [street, `${postalCode || fallbackPostalCode} ${city}`.trim()].filter(Boolean).join(", "),
      postalCode: postalCode || fallbackPostalCode,
      city,
      parcelLocker,
      distanceInMeters: distanceInMeters(buyerCoordinates ?? searchCoordinates, coordinates)
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row?.id && row.name && row.address))
    .sort((left, right) => left.distanceInMeters - right.distanceInMeters)
    .slice(0, 30);
}

async function openStreetMapPickupPoints(
  postalCode: string,
  city: string,
  searchCoordinates: Coordinates,
  buyerCoordinates: Coordinates | null
) {
  const cacheKey = `v2|${postalCode}|${city}|${searchCoordinates.latitude.toFixed(4)}|${searchCoordinates.longitude.toFixed(4)}`.toLocaleLowerCase("fi-FI");
  const cached = pickupPointElementCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return openStreetMapPickupPointRows(cached.elements, searchCoordinates, buyerCoordinates, postalCode, city);
  }
  const query = `[out:json][timeout:18];(
    nwr(around:20000,${searchCoordinates.latitude},${searchCoordinates.longitude})["amenity"~"^(post_office|parcel_locker)$"];
    nwr(around:20000,${searchCoordinates.latitude},${searchCoordinates.longitude})["parcel_locker"="yes"];
  );out center tags;`;
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  const fetchEndpoint = async (endpoint: string) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "MaskinesMarketplace/1.0 (Nordic pickup point search; info@maskines.com)"
      },
      body: new URLSearchParams({ data: query }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json().catch(() => ({})) as { elements?: OverpassElement[] };
    const elements = body.elements ?? [];
    // Ruuhkainen Overpass-peili saattaa palauttaa vajaan tuloksen. Hyväksytään vasta käyttökelpoinen aluehaku.
    if (elements.length < 5) throw new Error("incomplete");
    return elements;
  };

  try {
    // Kaksi julkista peilipalvelinta kilpailee keskenään, jotta ensimmäinen Norja-haku ei jää odottamaan ruuhkaista palvelinta.
    const elements = await Promise.any(endpoints.map(fetchEndpoint));
    pickupPointElementCache.set(cacheKey, { elements, expiresAt: Date.now() + 60 * 60 * 1000 });
    return openStreetMapPickupPointRows(elements, searchCoordinates, buyerCoordinates, postalCode, city);
  } catch {
    throw new Error("Norjan noutopistepalvelu ei vastannut. Yritä hetken kuluttua uudelleen.");
  }
}

async function bringPickupPoints(postalCode: string, street: string) {
  const apiUid = configuredValue(process.env.BRING_API_UID);
  const apiKey = configuredValue(process.env.BRING_API_KEY);
  if (!apiUid || !apiKey) {
    throw new Error("Norjan noutopistehaku vaatii BRING_API_UID- ja BRING_API_KEY-tunnukset.");
  }

  const url = new URL(`https://api.bring.com/pickuppoint/api/pickuppoint/NO/postalCode/${postalCode}`);
  if (street) {
    const streetNumber = street.match(/\b(\d+[A-Za-z]?)\b/)?.[1] ?? "";
    const streetName = street.replace(/\b\d+[A-Za-z]?\b.*$/, "").trim() || street;
    url.searchParams.set("street", streetName);
    if (streetNumber) url.searchParams.set("streetNumber", streetNumber);
  }
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Mybring-API-Uid": apiUid,
      "X-Mybring-API-Key": apiKey,
      "X-Bring-Client-URL": configuredValue(process.env.NEXT_PUBLIC_SITE_URL) || "https://maskines.com"
    },
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const detail = typeof body.message === "string" ? body.message : "";
    throw new Error(detail ? `Bring vastasi virheellä ${response.status}: ${detail}` : `Bring vastasi virheellä ${response.status}.`);
  }
  return bringPickupPointRows(body);
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const requestedCountry = searchParams.get("country")?.trim().toUpperCase() ?? "FI";
  if (!(["FI", "SE", "NO"] as string[]).includes(requestedCountry)) {
    return NextResponse.json({ error: "Valitse maaksi Suomi, Ruotsi tai Norja." }, { status: 400 });
  }
  const country = requestedCountry as SupportedCountry;
  const postalCode = normalizedPostalCode(searchParams.get("postal_code") ?? "", country);
  const street = searchParams.get("street")?.replace(/[<>]/g, "").trim().slice(0, 160) ?? "";
  const city = searchParams.get("city")?.replace(/[<>]/g, "").trim().slice(0, 100) ?? "";
  const requestedOriginCountry = searchParams.get("origin_country")?.trim().toUpperCase() ?? country;
  const originCountry = (["FI", "SE", "NO"] as string[]).includes(requestedOriginCountry)
    ? requestedOriginCountry as SupportedCountry
    : country;
  const originStreet = searchParams.get("origin_street")?.replace(/[<>]/g, "").trim().slice(0, 160) ?? "";
  const originPostalCode = normalizedPostalCode(searchParams.get("origin_postal_code") ?? "", originCountry);
  const originCity = searchParams.get("origin_city")?.replace(/[<>]/g, "").trim().slice(0, 100) ?? "";
  const hasPostalCode = validPostalCode(postalCode, country);
  if (!hasPostalCode && city.length < 2) {
    const digits = countryDetails[country].postalLength;
    return NextResponse.json({ error: `Anna ${digits}-numeroinen postinumero tai kaupungin nimi.` }, { status: 400 });
  }

  try {
    const effectivePostalCode = hasPostalCode ? postalCode : await postalCodeForCity(city, country);
    const hasOriginAddress = Boolean(
      originStreet && originCity && validPostalCode(originPostalCode, originCountry)
    );
    const buyerCoordinates = hasOriginAddress
      ? await coordinatesForAddress(originStreet, originPostalCode, originCity, originCountry)
      : street && hasPostalCode
        ? await coordinatesForAddress(street, postalCode, city, country)
        : null;
    if (country === "NO") {
      const searchCoordinates = await coordinatesForAddress(street, effectivePostalCode, city, country);
      if (!searchCoordinates) throw new Error("Norjan hakualueen sijaintia ei voitu määrittää.");
      const bringConfigured = Boolean(configuredValue(process.env.BRING_API_UID) && configuredValue(process.env.BRING_API_KEY));
      if (bringConfigured) {
        try {
          const bringRows = await bringPickupPoints(effectivePostalCode, street);
          if (bringRows.length) return NextResponse.json({ pickupPoints: bringRows, source: "bring" });
        } catch (error) {
          console.warn("Bring pickup point query failed, using OpenStreetMap fallback", error);
        }
      }
      return NextResponse.json({
        pickupPoints: await openStreetMapPickupPoints(effectivePostalCode, citySearchName(city, country), searchCoordinates, buyerCoordinates),
        source: "openstreetmap"
      });
    }
    const authentication = await postiToken();
    const configuredPickupUrl = configuredValue(process.env.POSTI_PICKUP_POINTS_URL);
    const apiUrl = validHttpUrl(
      configuredPickupUrl || `${authentication.apiBaseUrl}/pickuppoints`,
      "Postin noutopistepalvelun osoite"
    );
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authentication.token}`,
        Accept: "application/json",
        "Accept-Language": "fi",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        searchCriteria: {
          location: {
            ...(street && hasPostalCode ? { street } : {}),
            postcode: effectivePostalCode,
            ...(city ? { city } : {}),
            countryCode: country
          }
        },
        limit: 30
      }),
      cache: "no-store"
    });

    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const detail = typeof body.detail === "string"
        ? body.detail
        : typeof body.message === "string"
          ? body.message
          : "";
      throw new Error(detail ? `Posti vastasi virheellä ${response.status}: ${detail}` : `Posti vastasi virheellä ${response.status}.`);
    }

    return NextResponse.json({ pickupPoints: pickupPointRows(body, buyerCoordinates) });
  } catch (error) {
    console.error("Nordic pickup point query failed", error);
    return NextResponse.json({
      error: "Noutopisteiden haku ei juuri nyt onnistu. Yritä hetken kuluttua uudelleen."
    }, { status: 503 });
  }
}
