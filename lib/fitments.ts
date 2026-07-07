import type { Listing } from "./listings";

type VehicleKind = "snowmobile" | "atv" | "motocross" | "moped";
type FitmentAxis = "engine" | "platform" | "wheel" | "vehicle";

export type VehicleFitment = {
  kind: VehicleKind;
  makes: string[];
  models: string[];
  yearFrom: number;
  yearTo: number;
  engineCodes?: string[];
  platformCodes?: string[];
  wheelCodes?: string[];
  aliases?: string[];
};

export type FitmentProfile = {
  kind?: VehicleKind;
  engineCodes: Set<string>;
  platformCodes: Set<string>;
  wheelCodes: Set<string>;
  vehicleCodes: Set<string>;
};

const fitments: VehicleFitment[] = [
  {
    kind: "snowmobile",
    makes: ["Lynx"],
    models: ["Rave", "Rave RE", "Rave RC"],
    yearFrom: 2005,
    yearTo: 2008,
    engineCodes: ["rotax-600-800-powertek"],
    platformCodes: ["lynx-rave-revo-2005-2008"],
    aliases: ["r evo", "revo", "rave rc", "rave re"]
  },
  {
    kind: "snowmobile",
    makes: ["Lynx"],
    models: ["Rave", "Rave RE", "Rave RS"],
    yearFrom: 2009,
    yearTo: 2013,
    engineCodes: ["rotax-600-etec", "rotax-800-etec"],
    platformCodes: ["lynx-rave-rex-2009-2013"],
    aliases: ["rex", "rave re", "rave rs", "600 e-tec", "800 e-tec"]
  },
  {
    kind: "snowmobile",
    makes: ["Lynx"],
    models: ["Rave", "Rave RE"],
    yearFrom: 2014,
    yearTo: 2017,
    engineCodes: ["rotax-600-etec", "rotax-800-etec"],
    platformCodes: ["lynx-rave-rex2-2014-2017"],
    aliases: ["rex2", "rave re", "600 e-tec", "800 e-tec"]
  },
  {
    kind: "snowmobile",
    makes: ["Lynx"],
    models: ["Rave", "Rave RE"],
    yearFrom: 2018,
    yearTo: 2023,
    engineCodes: ["rotax-600r-etec", "rotax-850-etec"],
    platformCodes: ["lynx-rave-radien-2018-2023"],
    aliases: ["radien", "rave re", "600r e-tec", "850 e-tec"]
  },
  {
    kind: "snowmobile",
    makes: ["Lynx"],
    models: ["Rave", "Rave RE", "Rave GLS"],
    yearFrom: 2024,
    yearTo: 2027,
    engineCodes: ["rotax-600r-etec", "rotax-850-etec", "rotax-850-turbo-r"],
    platformCodes: ["lynx-rave-radien2-2024-plus"],
    aliases: ["radien2", "radien 2", "rave re", "rave gls", "600r e-tec", "850 e-tec"]
  },
  {
    kind: "snowmobile",
    makes: ["Lynx"],
    models: ["Xtrim", "Adventure"],
    yearFrom: 2009,
    yearTo: 2017,
    engineCodes: ["rotax-600-etec", "rotax-800-etec"],
    platformCodes: ["lynx-rex-rex2-crossover-2009-2017"],
    aliases: ["rex", "rex2", "600 e-tec", "800 e-tec"]
  },
  {
    kind: "snowmobile",
    makes: ["Lynx"],
    models: ["Shredder", "Xterrain", "Boondocker", "Xtrim"],
    yearFrom: 2018,
    yearTo: 2027,
    engineCodes: ["rotax-600r-etec", "rotax-850-etec"],
    platformCodes: ["lynx-radien-crossover-deepsnow-2018-plus"],
    aliases: ["radien", "radien2", "600r e-tec", "850 e-tec"]
  },
  {
    kind: "snowmobile",
    makes: ["Ski-Doo"],
    models: ["MXZ", "Renegade", "Summit", "Backcountry", "Freeride"],
    yearFrom: 2008,
    yearTo: 2016,
    engineCodes: ["rotax-600-etec", "rotax-800-etec"],
    platformCodes: ["skidoo-xp-xs-xm-2008-2016"],
    aliases: ["xp", "xs", "xm", "600 e-tec", "800 e-tec"]
  },
  {
    kind: "snowmobile",
    makes: ["Ski-Doo"],
    models: ["MXZ", "Renegade", "Summit", "Backcountry", "Freeride"],
    yearFrom: 2017,
    yearTo: 2023,
    engineCodes: ["rotax-600r-etec", "rotax-850-etec"],
    platformCodes: ["skidoo-gen4-2017-2023"],
    aliases: ["gen4", "gen 4", "600r e-tec", "850 e-tec"]
  },
  {
    kind: "snowmobile",
    makes: ["Ski-Doo"],
    models: ["MXZ", "Renegade", "Summit", "Backcountry", "Freeride"],
    yearFrom: 2024,
    yearTo: 2027,
    engineCodes: ["rotax-600r-etec", "rotax-850-etec", "rotax-850-turbo-r"],
    platformCodes: ["skidoo-gen5-2024-plus"],
    aliases: ["gen5", "gen 5", "600r e-tec", "850 e-tec"]
  },
  {
    kind: "snowmobile",
    makes: ["Polaris"],
    models: ["Indy", "Rush", "Switchback", "RMK", "Assault"],
    yearFrom: 2015,
    yearTo: 2020,
    engineCodes: ["polaris-800-cleanfire"],
    platformCodes: ["polaris-axys"],
    aliases: ["800 cleanfire", "800 ho"]
  },
  {
    kind: "snowmobile",
    makes: ["Polaris"],
    models: ["Indy", "RMK", "Khaos", "Switchback", "Matryx", "Assault"],
    yearFrom: 2021,
    yearTo: 2027,
    engineCodes: ["polaris-850-patriot"],
    platformCodes: ["polaris-matryx"],
    aliases: ["850 patriot", "patriot 850"]
  },
  {
    kind: "snowmobile",
    makes: ["Arctic Cat"],
    models: ["ZR", "Riot", "Norseman", "Crossfire"],
    yearFrom: 2006,
    yearTo: 2027,
    engineCodes: ["arctic-cat-suzuki-c-tec"],
    platformCodes: ["arctic-cat-procross"],
    aliases: ["c tec", "procross", "pro cross"]
  },
  {
    kind: "snowmobile",
    makes: ["Arctic Cat"],
    models: ["M"],
    yearFrom: 2005,
    yearTo: 2027,
    engineCodes: ["arctic-cat-m-series"],
    platformCodes: ["arctic-cat-mountain"],
    aliases: ["m series", "mountain cat"]
  },
  {
    kind: "moped",
    makes: ["Yamaha", "MBK", "Aprilia", "Malaguti", "Beta", "Keeway"],
    models: ["Aerox", "Nitro", "SR", "F12", "Ark", "Matrix", "Neos"],
    yearFrom: 1997,
    yearTo: 2013,
    engineCodes: ["minarelli-horizontal-lc"],
    platformCodes: ["scooter-minarelli-horizontal"],
    wheelCodes: ["scooter-12-13"],
    aliases: ["minarelli horizontal", "minarelli vaaka", "aerox nitro", "neos"]
  },
  {
    kind: "moped",
    makes: ["Yamaha", "MBK"],
    models: ["BWS Original", "BW'S Original", "Zuma", "YW50"],
    yearFrom: 2002,
    yearTo: 2011,
    engineCodes: ["minarelli-vertical-ac"],
    platformCodes: ["yamaha-bws-zuma-original-2002-2011"],
    wheelCodes: ["scooter-10-12"],
    aliases: ["zuma 50", "yw50", "bws original", "bw s original", "bws zuma"]
  },
  {
    kind: "moped",
    makes: ["Yamaha", "MBK"],
    models: ["BWS Naked", "BW'S Naked", "Booster Naked", "Stunt Naked"],
    yearFrom: 2003,
    yearTo: 2016,
    engineCodes: ["minarelli-vertical-ac"],
    platformCodes: ["yamaha-bws-booster-naked-2003-2016"],
    wheelCodes: ["scooter-10-12-13"],
    aliases: ["naked", "bws naked", "bw s naked", "booster naked", "stunt naked"]
  },
  {
    kind: "moped",
    makes: ["Yamaha", "MBK"],
    models: ["BWS Next Generation", "BW'S Next Generation", "Booster Next Generation"],
    yearFrom: 1995,
    yearTo: 2009,
    engineCodes: ["minarelli-vertical-ac"],
    platformCodes: ["yamaha-bws-booster-ng-1995-2009"],
    wheelCodes: ["scooter-10-12"],
    aliases: ["bws ng", "bw s ng", "booster ng", "next generation"]
  },
  {
    kind: "moped",
    makes: ["Yamaha", "MBK"],
    models: ["BWS 10", "BW'S 10", "Booster Spirit 10", "Booster 10"],
    yearFrom: 1990,
    yearTo: 2017,
    engineCodes: ["minarelli-vertical-ac"],
    platformCodes: ["yamaha-bws-booster-spirit-10-1990-2017"],
    wheelCodes: ["scooter-10"],
    aliases: ["booster spirit 10", "bws 10", "bw s 10", "10 pouces"]
  },
  {
    kind: "moped",
    makes: ["Yamaha", "MBK"],
    models: ["BWS 12", "BW'S 12", "Booster Spirit 12", "Booster 12"],
    yearFrom: 2001,
    yearTo: 2016,
    engineCodes: ["minarelli-vertical-ac"],
    platformCodes: ["yamaha-bws-booster-spirit-12-2001-2016"],
    wheelCodes: ["scooter-12"],
    aliases: ["booster spirit 12", "bws 12", "bw s 12", "12 pouces"]
  },
  {
    kind: "moped",
    makes: ["Yamaha", "MBK"],
    models: ["Slider", "Stunt"],
    yearFrom: 2006,
    yearTo: 2016,
    engineCodes: ["minarelli-vertical-ac"],
    platformCodes: ["yamaha-slider-mbk-stunt-2006-2016"],
    wheelCodes: ["scooter-12"],
    aliases: ["slider naked", "stunt naked", "ew50"]
  },
  {
    kind: "moped",
    makes: ["Yamaha", "Rieju", "Beta", "Sherco", "Fantic", "HM", "Malaguti", "MBK"],
    models: ["DT", "MRT", "RR", "SM", "SMX", "MRX", "Enduro", "X-limit", "Caballero"],
    yearFrom: 1998,
    yearTo: 2027,
    engineCodes: ["minarelli-am6"],
    platformCodes: ["moped-supermoto-enduro-50"],
    wheelCodes: ["moped-17-21"],
    aliases: ["am6", "minarelli am6", "x limit"]
  },
  {
    kind: "moped",
    makes: ["Derbi", "Aprilia", "Gilera", "Rieju"],
    models: ["Senda", "DRD", "Xtreme", "Racing", "RX", "SX", "SMT", "RCR", "RS"],
    yearFrom: 2000,
    yearTo: 2020,
    engineCodes: ["derbi-euro2-euro3"],
    platformCodes: ["moped-derbi-senda"],
    wheelCodes: ["moped-17-21"],
    aliases: ["derbi euro2", "derbi euro3", "d50b0", "ebe ebs", "derbi senda xtreme racing"]
  },
  {
    kind: "moped",
    makes: ["Beta"],
    models: ["Track"],
    yearFrom: 1998,
    yearTo: 2012,
    engineCodes: ["minarelli-horizontal-ac"],
    platformCodes: ["scooter-minarelli-horizontal"],
    wheelCodes: ["scooter-10-12"],
    aliases: ["beta track", "minarelli horizontal"]
  },
  {
    kind: "atv",
    makes: ["Can-Am", "Bombardier"],
    models: ["Outlander", "Renegade"],
    yearFrom: 2012,
    yearTo: 2027,
    engineCodes: ["rotax-vtwin-650", "rotax-vtwin-800-850-1000"],
    platformCodes: ["canam-g2"],
    wheelCodes: ["atv-4x110-4x137"],
    aliases: ["can-am g2", "outlander g2", "renegade g2", "rotax v-twin"]
  },
  {
    kind: "atv",
    makes: ["Can-Am"],
    models: ["Commander", "Maverick"],
    yearFrom: 2011,
    yearTo: 2027,
    engineCodes: ["rotax-utv-vtwin"],
    platformCodes: ["canam-utv"],
    wheelCodes: ["utv-canam"],
    aliases: ["can-am utv", "commander maverick"]
  },
  {
    kind: "atv",
    makes: ["Polaris"],
    models: ["Sportsman", "Scrambler"],
    yearFrom: 2005,
    yearTo: 2027,
    engineCodes: ["polaris-atv-prostar-single-twin"],
    platformCodes: ["polaris-atv"],
    wheelCodes: ["atv-polaris"],
    aliases: ["polaris atv"]
  },
  {
    kind: "atv",
    makes: ["Polaris"],
    models: ["Ranger", "RZR"],
    yearFrom: 2008,
    yearTo: 2027,
    engineCodes: ["polaris-utv-prostar"],
    platformCodes: ["polaris-utv"],
    wheelCodes: ["utv-polaris"],
    aliases: ["prostar", "polaris utv"]
  },
  {
    kind: "atv",
    makes: ["Yamaha"],
    models: ["Raptor 700", "YFM700R"],
    yearFrom: 2006,
    yearTo: 2027,
    engineCodes: ["yamaha-686-single"],
    platformCodes: ["yamaha-yfm700r"],
    wheelCodes: ["sport-atv-yamaha"],
    aliases: ["raptor 700", "yfm700"]
  },
  {
    kind: "atv",
    makes: ["Yamaha"],
    models: ["Grizzly", "Kodiak"],
    yearFrom: 2016,
    yearTo: 2027,
    engineCodes: ["yamaha-700-utility-single"],
    platformCodes: ["yamaha-utility-atv"],
    wheelCodes: ["utility-atv-yamaha"],
    aliases: ["grizzly 700", "kodiak 700"]
  },
  {
    kind: "atv",
    makes: ["Yamaha"],
    models: ["YFZ450R"],
    yearFrom: 2009,
    yearTo: 2027,
    engineCodes: ["yamaha-yfz450r"],
    platformCodes: ["yamaha-yfz450r"],
    wheelCodes: ["sport-atv-yamaha"],
    aliases: ["yfz 450 r", "yfz450"]
  },
  {
    kind: "atv",
    makes: ["Honda"],
    models: ["TRX", "FourTrax", "Foreman", "Rincon"],
    yearFrom: 2000,
    yearTo: 2027,
    engineCodes: ["honda-atv"],
    platformCodes: ["honda-atv-utility-sport"],
    wheelCodes: ["atv-honda"],
    aliases: ["trx", "fourtrax"]
  },
  {
    kind: "atv",
    makes: ["CFMOTO"],
    models: ["CForce", "UForce", "ZForce"],
    yearFrom: 2010,
    yearTo: 2027,
    engineCodes: ["cfmoto-single-twin"],
    platformCodes: ["cfmoto-atv-utv"],
    wheelCodes: ["atv-utv-cfmoto"],
    aliases: ["c force", "u force", "z force"]
  },
  {
    kind: "motocross",
    makes: ["Honda"],
    models: ["CRF450R", "CRF 450 R"],
    yearFrom: 2009,
    yearTo: 2012,
    engineCodes: ["honda-crf450r-2009-2012"],
    platformCodes: ["honda-crf450r-2009-2012"],
    wheelCodes: ["mx-fullsize-honda"]
  },
  {
    kind: "motocross",
    makes: ["Honda"],
    models: ["CRF250R", "CRF 250 R"],
    yearFrom: 2010,
    yearTo: 2027,
    engineCodes: ["honda-crf250r"],
    platformCodes: ["honda-crf250r"],
    wheelCodes: ["mx-fullsize-honda"]
  },
  {
    kind: "motocross",
    makes: ["Honda"],
    models: ["CRF250X", "CRF 250 X", "CRF450X", "CRF 450 X"],
    yearFrom: 2004,
    yearTo: 2027,
    engineCodes: ["honda-crfx-enduro"],
    platformCodes: ["honda-crfx-enduro"],
    wheelCodes: ["mx-fullsize-honda"]
  },
  {
    kind: "motocross",
    makes: ["Honda"],
    models: ["CRF450R", "CRF 450 R"],
    yearFrom: 2013,
    yearTo: 2016,
    engineCodes: ["honda-crf450r-2013-2016"],
    platformCodes: ["honda-crf450r-2013-2016"],
    wheelCodes: ["mx-fullsize-honda"]
  },
  {
    kind: "motocross",
    makes: ["Honda"],
    models: ["CRF450R", "CRF 450 R"],
    yearFrom: 2017,
    yearTo: 2027,
    engineCodes: ["honda-crf450r-2017-plus"],
    platformCodes: ["honda-crf450r-2017-plus"],
    wheelCodes: ["mx-fullsize-honda"]
  },
  {
    kind: "motocross",
    makes: ["KTM", "Husqvarna", "GasGas"],
    models: ["SX", "SX-F", "SX-F 450", "EXC", "EXC-F", "EXC-F 450", "TC", "FC", "FC 450", "TE", "FE", "FE 450", "MC", "MC-F", "MC 450F", "EC", "EC-F", "EC 450F"],
    yearFrom: 2016,
    yearTo: 2022,
    engineCodes: ["ktm-husky-450-2016-2022"],
    platformCodes: ["ktm-husky-gasgas-2016-2022"],
    wheelCodes: ["mx-fullsize-ktm"]
  },
  {
    kind: "motocross",
    makes: ["KTM", "Husqvarna", "GasGas"],
    models: ["SX", "SX-F", "SX-F 450", "EXC", "EXC-F", "EXC-F 450", "TC", "FC", "FC 450", "TE", "FE", "FE 450", "MC", "MC-F", "MC 450F", "EC", "EC-F", "EC 450F"],
    yearFrom: 2023,
    yearTo: 2027,
    engineCodes: ["ktm-husky-gasgas-450-2023-plus"],
    platformCodes: ["ktm-husky-gasgas-2023-plus"],
    wheelCodes: ["mx-fullsize-ktm"]
  },
  {
    kind: "motocross",
    makes: ["Yamaha"],
    models: ["YZ250F", "YZ450F", "YZ 250 F", "YZ 450 F", "WR450F"],
    yearFrom: 2018,
    yearTo: 2022,
    engineCodes: ["yamaha-yz450f-2018-2022"],
    platformCodes: ["yamaha-yz450f-2018-2022"],
    wheelCodes: ["mx-fullsize-yamaha"]
  },
  {
    kind: "motocross",
    makes: ["Yamaha"],
    models: ["YZ250F", "YZ450F", "YZ 250 F", "YZ 450 F", "WR450F"],
    yearFrom: 2023,
    yearTo: 2027,
    engineCodes: ["yamaha-yz450f-2023-plus"],
    platformCodes: ["yamaha-yz450f-2023-plus"],
    wheelCodes: ["mx-fullsize-yamaha"]
  },
  {
    kind: "motocross",
    makes: ["Yamaha"],
    models: ["YZ125", "YZ250", "YZ 125", "YZ 250"],
    yearFrom: 2005,
    yearTo: 2027,
    engineCodes: ["yamaha-yz-two-stroke"],
    platformCodes: ["yamaha-yz-two-stroke"],
    wheelCodes: ["mx-fullsize-yamaha"]
  },
  {
    kind: "motocross",
    makes: ["Kawasaki"],
    models: ["KX250", "KX450", "KX250F", "KX450F"],
    yearFrom: 2006,
    yearTo: 2027,
    engineCodes: ["kawasaki-kx-four-stroke"],
    platformCodes: ["kawasaki-kx-fullsize"],
    wheelCodes: ["mx-fullsize-kawasaki"]
  }
];

function norm(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00e4\u00e5]/g, "a")
    .replace(/\u00f6/g, "o")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function yearRange(value?: string | null) {
  const matches = [...String(value ?? "").matchAll(/\b(19|20)\d{2}\b/g)]
    .map((match) => Number(match[0]))
    .filter((year) => Number.isFinite(year));

  if (matches.length === 0) return null;

  const from = Math.min(...matches);
  const to = Math.max(...matches);
  return { from, to };
}

function kindFromVehicleType(value?: string | null): VehicleKind | undefined {
  const text = norm(value);
  if (text.includes("moottorikelkka") || text.includes("kelk") || text.includes("snowmobile")) return "snowmobile";
  if (text.includes("monkija") || text.includes("atv") || text.includes("utv")) return "atv";
  if (text.includes("motocross") || text.includes("cross")) return "motocross";
  if (text.includes("mopo") || text.includes("moped") || text.includes("skootter")) return "moped";
  return undefined;
}

function textMatchesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => {
    const normalizedNeedle = norm(needle);
    if (!normalizedNeedle) return false;
    if (normalizedNeedle.length <= 2) {
      return haystack.split(" ").includes(normalizedNeedle);
    }
    return haystack === normalizedNeedle || haystack.includes(normalizedNeedle);
  });
}

function engineMatchesInput(engineText: string, fitment: VehicleFitment) {
  if (!engineText) return true;
  const searchable = [...(fitment.aliases ?? []), ...(fitment.engineCodes ?? [])];
  if (textMatchesAny(engineText, searchable)) return true;

  const engineNumbers = [...engineText.matchAll(/\b\d{2,4}\b/g)].map((match) => match[0]);
  if (engineNumbers.length === 0) return false;

  const searchableText = norm(searchable.join(" "));
  return engineNumbers.some((number) => searchableText.includes(number));
}

function modelMatchesInput(modelText: string, fitment: VehicleFitment) {
  if (!modelText) return true;
  const searchable = [...fitment.models, ...(fitment.aliases ?? [])];
  const searchableText = norm(searchable.join(" "));

  if (modelText.includes("naked") && !searchableText.includes("naked")) return false;
  if ((modelText.includes("original") || modelText.includes("zuma") || modelText.includes("yw50")) && !/(original|zuma|yw50)/.test(searchableText)) {
    return false;
  }
  if ((modelText.includes("next generation") || modelText.includes(" ng ")) && !/(next generation| ng )/.test(` ${searchableText} `)) {
    return false;
  }

  return textMatchesAny(modelText, searchable);
}

function fitmentMatchesInput(
  fitment: VehicleFitment,
  input: { vehicleType?: string | null; brand?: string | null; model?: string | null; year?: string | null; engine?: string | null }
) {
  const inputKind = kindFromVehicleType(input.vehicleType);
  if (inputKind && fitment.kind !== inputKind) return false;

  const make = norm(input.brand);
  const model = norm(input.model);
  const engine = norm(input.engine);
  const years = yearRange(input.year);

  if (make && !textMatchesAny(make, fitment.makes)) return false;
  if (!modelMatchesInput(model, fitment)) return false;
  if (!engineMatchesInput(engine, fitment)) return false;
  if (years && (years.to < fitment.yearFrom || years.from > fitment.yearTo)) return false;

  return Boolean(model || engine || (make && years));
}

function addAll(target: Set<string>, values?: string[]) {
  for (const value of values ?? []) target.add(value);
}

function engineCodesForInput(fitment: VehicleFitment, engineInput?: string | null) {
  const engineCodes = fitment.engineCodes ?? [];
  const engineText = norm(engineInput);
  const engineNumbers = new Set(
    [...engineText.matchAll(/\b\d{2,4}\b/g)].map((match) => match[0])
  );

  if (engineNumbers.size === 0) return engineCodes;

  const matchingCodes = engineCodes.filter((code) => {
    const codeText = norm(code);
    return [...engineNumbers].some((number) => codeText.includes(number));
  });

  return matchingCodes.length > 0 ? matchingCodes : engineCodes;
}

export function buildFitmentProfile(input: {
  vehicleType?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  engine?: string | null;
}): FitmentProfile {
  const profile: FitmentProfile = {
    kind: kindFromVehicleType(input.vehicleType),
    engineCodes: new Set(),
    platformCodes: new Set(),
    wheelCodes: new Set(),
    vehicleCodes: new Set()
  };

  for (const fitment of fitments) {
    if (!fitmentMatchesInput(fitment, input)) continue;
    addAll(profile.engineCodes, engineCodesForInput(fitment, input.engine));
    addAll(profile.platformCodes, fitment.platformCodes);
    addAll(profile.wheelCodes, fitment.wheelCodes);
    profile.vehicleCodes.add(`${fitment.kind}:${fitment.makes.join("|")}:${fitment.models.join("|")}:${fitment.yearFrom}-${fitment.yearTo}`);
  }

  return profile;
}

export function hasFitmentProfile(profile: FitmentProfile) {
  return (
    profile.engineCodes.size > 0 ||
    profile.platformCodes.size > 0 ||
    profile.wheelCodes.size > 0 ||
    profile.vehicleCodes.size > 0
  );
}

function axisForListing(listing: Pick<Listing, "category" | "subcategory" | "title" | "part_model" | "description">): FitmentAxis {
  const text = norm(`
    ${listing.category ?? ""}
    ${listing.subcategory ?? ""}
    ${listing.title ?? ""}
    ${listing.part_model ?? ""}
    ${listing.description ?? ""}
  `);

  if (
    text.includes("moottori") ||
    text.includes("sylinter") ||
    text.includes("manta") ||
    text.includes("kampiaksel") ||
    text.includes("kytkin") ||
    text.includes("variaattor") ||
    text.includes("kaasutin") ||
    text.includes("ruiskutus") ||
    text.includes("ecu") ||
    text.includes("sytytys")
  ) {
    return "engine";
  }

  if (text.includes("rengas") || text.includes("renkaat") || text.includes("vanne") || text.includes("vanteet")) {
    return "wheel";
  }

  if (
    text.includes("alusta") ||
    text.includes("telasto") ||
    text.includes("iskunvaiment") ||
    text.includes("tukivar") ||
    text.includes("runko") ||
    text.includes("kate") ||
    text.includes("katte") ||
    text.includes("katesarja") ||
    text.includes("kuomu") ||
    text.includes("konepelti") ||
    text.includes("muovi") ||
    text.includes("plastic") ||
    text.includes("panel") ||
    text.includes("maski") ||
    text.includes("lokasuoja") ||
    text.includes("lokari") ||
    text.includes("puskuri") ||
    text.includes("tunneli") ||
    text.includes("tunnel") ||
    text.includes("pohjapanssari") ||
    text.includes("astinlauta") ||
    text.includes("penkki") ||
    text.includes("istuin") ||
    text.includes("satula") ||
    text.includes("tankki") ||
    text.includes("tuulilasi") ||
    text.includes("visiiri") ||
    text.includes("valo") ||
    text.includes("umpio") ||
    text.includes("jarru") ||
    text.includes("ohjaus")
  ) {
    return "platform";
  }

  return "vehicle";
}

function profileCodesForAxis(profile: FitmentProfile, axis: FitmentAxis) {
  if (axis === "engine") return profile.engineCodes;
  if (axis === "platform") return profile.platformCodes;
  if (axis === "wheel") return profile.wheelCodes;
  return profile.vehicleCodes;
}

export function listingMatchesCompatibleFitment(
  listing: Pick<
    Listing,
    | "vehicle_type"
    | "brand"
    | "model"
    | "year"
    | "engine_cc"
    | "engine_model"
    | "category"
    | "subcategory"
    | "title"
    | "part_model"
    | "description"
  >,
  selectedProfile: FitmentProfile
) {
  if (!hasFitmentProfile(selectedProfile)) return false;

  const listingProfile = buildFitmentProfile({
    vehicleType: listing.vehicle_type,
    brand: listing.brand,
    model: `${listing.model ?? ""} ${listing.title ?? ""} ${listing.part_model ?? ""} ${listing.description ?? ""}`,
    year: listing.year,
    engine: [listing.engine_model, listing.engine_cc].filter(Boolean).join(" ")
  });

  if (!hasFitmentProfile(listingProfile)) return false;
  if (selectedProfile.kind && listingProfile.kind && selectedProfile.kind !== listingProfile.kind) return false;

  const axis = axisForListing(listing);
  const selectedCodes = profileCodesForAxis(selectedProfile, axis);
  const listingCodes = profileCodesForAxis(listingProfile, axis);

  if (selectedCodes.size === 0 || listingCodes.size === 0) return false;
  for (const code of selectedCodes) {
    if (listingCodes.has(code)) return true;
  }

  return false;
}
