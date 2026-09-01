"use client";

import { filterVehiclePartCategoriesBySubtype, subcategoryGroups } from "@/lib/listings";
import {
  BRAND_MODELS,
  CC_OPTIONS,
  COMMON_BRAND_MODELS_BY_VEHICLE,
  DEFAULT_CC_OPTIONS,
  VEHICLE_SUBTYPE_OPTIONS,
  getBrandModelOptions,
  getCategoryVehicleKey,
  getCommonVehicleKey,
  getModelEngineOptions
} from "@/app/components/CategoryDrawer";
import {
  filterVehicleBrandModelsBySubtype,
  mergeVehicleBrandModels
} from "@/lib/vehicle-subtype-models";

export const MARKETPLACE_YEAR_FILTER_MIN = 1980;

export function getMarketplaceYearFilterMax() {
  return new Date().getFullYear() + 1;
}

export function uniqueMarketplaceOptions(values: Array<string | number | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "fi", { numeric: true, sensitivity: "base" }));
}

const UNIFIED_ALL_CATEGORY_ORDER = [
  "Moottori",
  "Voimansiirto",
  "Polttoainejärjestelmä",
  "Jäähdytysjärjestelmä",
  "Pakoputkisto",
  "Jousitus & ohjaus",
  "Jarrut",
  "Renkaat & vanteet",
  "Telasarjat",
  "Sähköjärjestelmä",
  "Runko & koriosat"
] as const;

function legacyCombinedCategoryTarget(category: string, subcategory: string): string {
  if (category === "Moottori & voimansiirto") {
    const drivetrainPart =
      subcategory === "Kokonainen voimansiirto" ||
      subcategory === "Variaattorin hihnat" ||
      subcategory === "Ketjukotelot" ||
      subcategory === "Ketjut & hihnat" ||
      subcategory.startsWith("Kytkimet / ") ||
      subcategory.startsWith("Variaattorit / ");
    return drivetrainPart ? "Voimansiirto" : "Moottori";
  }

  if (category === "Alusta & telasto") {
    if (subcategory.startsWith("Renkaat & vanteet / ")) return "Renkaat & vanteet";
    if (
      subcategory === "Kokonainen telasto" ||
      subcategory === "Telamatot" ||
      subcategory.startsWith("Telasto / ")
    ) {
      return "Telasarjat";
    }
    return "Jousitus & ohjaus";
  }

  if (category === "Ohjaus & hallintalaitteet") {
    return subcategory.startsWith("Jarrut / ") ? "Jarrut" : "Jousitus & ohjaus";
  }

  if (category === "Sähköjärjestelmät") return "Sähköjärjestelmä";
  if (category === "Moottori") {
    if (subcategory.startsWith("Vaihteisto / ") || subcategory.startsWith("Kytkin / ")) {
      return "Voimansiirto";
    }
    if (subcategory.startsWith("Imu- & polttoaineosat / ")) return "Polttoainejärjestelmä";
    if (subcategory.startsWith("Jäähdytysjärjestelmä / ")) return "Jäähdytysjärjestelmä";
    if (subcategory.startsWith("Pakoputkisto / ")) return "Pakoputkisto";
    return "Moottori";
  }
  if (category === "Jäähdytys & polttoaine") {
    const coolingPart =
      subcategory === "Kokonainen jäähdytysjärjestelmä" ||
      subcategory === "Jäähdyttimet" ||
      subcategory === "Vesipumput" ||
      subcategory === "Letkut";
    return coolingPart ? "Jäähdytysjärjestelmä" : "Polttoainejärjestelmä";
  }
  if (category === "Pakoputkisto") return "Pakoputkisto";
  if (category === "Runko & katteet") return "Runko & koriosat";
  return category;
}

/**
 * Resolve both old snowmobile categories and newer two-wheeler/ATV categories
 * into the same top-level category name. The subcategory is needed to split
 * the old combined categories without dropping any of their parts.
 */
export function getUnifiedAllCategoryName(category: string, subcategory = ""): string {
  return legacyCombinedCategoryTarget(category, subcategory);
}

export function buildUnifiedAllVehicleCategories(
  categories: Record<string, readonly string[]>
): Record<string, readonly string[]> {
  const merged = new Map<string, string[]>(
    UNIFIED_ALL_CATEGORY_ORDER.map((category) => [category, []])
  );

  for (const [category, subcategories] of Object.entries(categories)) {
    for (const subcategory of subcategories) {
      const target = getUnifiedAllCategoryName(category, subcategory);
      const targetSubcategories = merged.get(target) ?? [];
      if (!targetSubcategories.includes(subcategory)) targetSubcategories.push(subcategory);
      merged.set(target, targetSubcategories);
    }
  }

  return Object.fromEntries(
    [...merged.entries()].filter(([, subcategories]) => subcategories.length > 0)
  );
}

export function buildMarketplaceYearOptions() {
  const years: string[] = [];
  for (let year = getMarketplaceYearFilterMax(); year >= MARKETPLACE_YEAR_FILTER_MIN; year -= 1) {
    years.push(String(year));
  }
  return years;
}

const MOTORCYCLE_SUBTYPE_MODELS: Record<string, Record<string, string[]>> = {
  "Naked - moottoripyörä": {
    Aprilia: ["Tuono 125", "Tuono 457", "Tuono 660", "Tuono V4"],
    BMW: ["G 310 R", "F 900 R", "S 1000 R", "M 1000 R"],
    CFMOTO: ["125NK", "300NK", "450NK", "650NK", "800NK"],
    Ducati: ["Monster 696", "Monster 797", "Monster 821", "Monster 937", "Monster 1200", "Streetfighter V2", "Streetfighter V4"],
    Honda: ["CB125R", "CBF125", "MSX125", "CB300R", "CB500F", "CB650R", "CB750 Hornet", "CB1000R"],
    Husqvarna: ["Svartpilen 125", "Vitpilen 125", "Svartpilen 401", "Svartpilen 801", "Vitpilen 401", "Vitpilen 701", "Vitpilen 801"],
    Kawasaki: ["Z125", "Z400", "Z500", "Z650", "Z900", "Z1000", "Z H2"],
    KTM: ["125 Duke", "390 Duke", "690 Duke", "790 Duke", "890 Duke", "990 Duke", "1290 Super Duke R", "1390 Super Duke R"],
    Suzuki: ["GSX-S125", "GSX-8S", "GSX-S750", "GSX-S950", "GSX-S1000", "SV650", "Katana"],
    Triumph: ["Speed 400", "Trident 660", "Street Triple 765", "Speed Triple 1200"],
    Yamaha: ["MT-125", "MT-03", "MT-07", "MT-09", "MT-10", "XSR125", "XSR700", "XSR900"]
  },
  "Sport - moottoripyörä": {
    Aprilia: ["RS 125", "RS 457", "RS 660", "RSV4"],
    BMW: ["S 1000 RR", "M 1000 RR"],
    CFMOTO: ["450SR"],
    Ducati: ["Panigale V2", "Panigale V4", "Supersport 950"],
    Honda: ["CBR125R", "CBR500R", "CBR600RR", "CBR650R", "CBR1000RR"],
    Kawasaki: ["Ninja 125", "Ninja 400", "Ninja 500", "Ninja 650", "Ninja ZX-4R", "Ninja ZX-6R", "Ninja ZX-10R", "Ninja H2"],
    KTM: ["RC 125", "RC 390"],
    Suzuki: ["GSX-R125", "GSX-8R", "GSX-R600", "GSX-R750", "GSX-R1000", "Hayabusa"],
    Triumph: ["Daytona 660"],
    Yamaha: ["YZF-R125", "YZF-R3", "YZF-R6", "YZF-R7", "YZF-R1"]
  },
  "Sport touring - moottoripyörä": {
    BMW: ["F 900 XR", "S 1000 XR", "K 1600 GT"],
    Ducati: ["Multistrada 950", "Multistrada V2", "Multistrada V4", "Supersport 950"],
    Honda: ["NT1100", "VFR800", "VFR1200F"],
    Kawasaki: ["Ninja 1000SX", "Versys 650", "Versys 1000"],
    KTM: ["890 SMT", "1290 Super Duke GT"],
    Triumph: ["Tiger Sport 660"],
    Yamaha: ["Tracer 7", "Tracer 9", "FJR1300", "Niken"]
  },
  "Touring - moottoripyörä": {
    BMW: ["R 1250 RT", "K 1600 GT", "K 1600 GTL"],
    "Harley-Davidson": ["Road King", "Road Glide", "Street Glide"],
    Honda: ["Gold Wing GL1800", "NT1100"],
    Indian: ["Springfield", "Chieftain", "Challenger", "Roadmaster", "Pursuit"],
    Triumph: ["Rocket 3"],
    Yamaha: ["FJR1300"]
  },
  "Adventure - moottoripyörä": {
    AJP: ["PR7 650 Adventure"],
    Aprilia: ["Tuareg 660", "Caponord 1200"],
    BMW: ["G 310 GS", "F 750 GS", "F 800 GS", "F 850 GS", "F 900 GS", "R 1200 GS", "R 1250 GS", "R 1300 GS"],
    CFMOTO: ["450MT", "650MT", "800MT"],
    Ducati: ["Multistrada 950", "Multistrada V2", "Multistrada V4", "DesertX"],
    Honda: ["XL125V Varadero", "NC750X", "Africa Twin CRF1000L", "Africa Twin CRF1100L", "Transalp XL750", "X-ADV"],
    Husqvarna: ["Norden 901"],
    KTM: ["390 Adventure", "790 Adventure", "890 Adventure", "1090 Adventure", "1190 Adventure", "1290 Super Adventure", "1390 Super Adventure"],
    "Royal Enfield": ["Himalayan 411", "Himalayan 450", "Scram 411"],
    Suzuki: ["V-Strom 650", "V-Strom 800", "V-Strom 1000", "V-Strom 1050"],
    Triumph: ["Tiger 850", "Tiger 900", "Tiger 1200", "Scrambler 400 X"],
    Yamaha: ["Ténéré 700"]
  },
  "Enduro - moottoripyörä": {
    Aprilia: ["RX 125"],
    Beta: ["RR 125", "RR 200", "RR 250", "RR 300", "RR 350", "RR 390", "RR 430", "RR 480"],
    Fantic: ["XEF 125", "XEF 250", "XEF 450"],
    GasGas: ["EC 125", "EC 250", "EC 300", "EC 350"],
    Honda: ["CRF300L", "CRF300 Rally"],
    Husqvarna: ["TE 125", "WRE 125", "TE 250", "TE 300", "FE 250", "FE 350", "FE 450", "FE 501", "701 Enduro"],
    KTM: ["125 EXC", "125 EXC Six Days", "150 EXC", "250 EXC", "300 EXC", "350 EXC-F", "450 EXC-F", "500 EXC-F", "690 Enduro R"],
    Sherco: ["SE 250", "SE 300", "SEF 250", "SEF 300", "SEF 450", "SEF 500"],
    Yamaha: ["WR125R"]
  },
  "Supermoto - moottoripyörä": {
    Aprilia: ["SX 125", "Dorsoduro 750", "Dorsoduro 900"],
    Beta: ["RR Motard 125"],
    Fantic: ["XMF 125"],
    GasGas: ["SM 125", "SM 700"],
    Husqvarna: ["SMS 125", "701 Supermoto"],
    KTM: ["690 SMC R"],
    Suzuki: ["DR-Z400SM"],
    Yamaha: ["WR125X"]
  },
  "Cruiser - moottoripyörä": {
    "Harley-Davidson": ["Sportster", "Iron 883", "Forty-Eight", "Nightster", "Sport Glide", "Street Bob", "Fat Bob", "Fat Boy", "Low Rider", "Breakout"],
    Honda: ["CMX500 Rebel", "CMX1100 Rebel"],
    Indian: ["Scout", "Chief"],
    Kawasaki: ["Vulcan S", "Vulcan 900", "Eliminator 500"],
    "Royal Enfield": ["Meteor 350", "Super Meteor 650", "Shotgun 650"],
    Yamaha: ["Bolt"]
  },
  "Custom - moottoripyörä": {
    BMW: ["R nineT"],
    Ducati: ["Diavel", "XDiavel"],
    "Harley-Davidson": ["Sportster", "Forty-Eight", "Street Bob", "Fat Bob", "Fat Boy", "Low Rider", "Breakout"],
    Honda: ["CMX500 Rebel", "CMX1100 Rebel"],
    Indian: ["Scout", "Chief"],
    Triumph: ["Bonneville T100", "Bonneville T120", "Speed Twin 900", "Speed Twin 1200", "Thruxton", "Rocket 3"]
  },
  "Classic / retro - moottoripyörä": {
    Benelli: ["Leoncino 125", "Leoncino 500", "Leoncino 800"],
    BMW: ["R nineT"],
    Brixton: ["Cromwell 125", "Felsberg 125", "Sunray 125", "Crossfire 125"],
    BSA: ["Gold Star 650"],
    Ducati: ["Scrambler 800", "Scrambler 1100"],
    Honda: ["Monkey 125", "Dax 125", "Super Cub C125", "CB1100", "CL500"],
    Kawasaki: ["W800"],
    "Royal Enfield": ["Hunter 350", "Classic 350", "Bullet 350", "Interceptor 650", "Continental GT 650"],
    Triumph: ["Bonneville T100", "Bonneville T120", "Speed Twin 900", "Speed Twin 1200", "Scrambler 900", "Scrambler 1200", "Thruxton"],
    Yamaha: ["XSR125", "XSR700", "XSR900"]
  },
  "Skootteri 125 cm³ ja yli - moottoripyörä": {
    Honda: ["PCX125", "Forza 125", "Forza 350", "Forza 750", "X-ADV"],
    Kymco: ["Agility 125", "People S 125", "Downtown 125", "Downtown 350", "Xciting 400", "AK 550"],
    Piaggio: ["Beverly 300", "Beverly 400", "MP3 300", "MP3 400", "MP3 500", "MP3 530"],
    Suzuki: ["Address 125", "Burgman Street 125", "Burgman 400", "Burgman 650"],
    SYM: ["Jet X 125", "Cruisym 125", "Cruisym 300", "Maxsym 400", "Maxsym TL 508"],
    Vespa: ["Primavera 125", "Sprint 125", "GTS 125", "GTS 300", "GTV 300"],
    Yamaha: ["NMAX 125", "XMAX 125", "XMAX 300", "XMAX 400", "TMAX"],
    Zontes: ["125M", "350E"]
  }
};

function getMotorcycleSubtypeModels(vehicle: string, vehicleSubtype: string) {
  return getCategoryVehicleKey(vehicle) === "Moottoripyörä" && vehicleSubtype
    ? MOTORCYCLE_SUBTYPE_MODELS[vehicleSubtype] ?? null
    : null;
}

function getVehicleSubtypeModels(vehicle: string, vehicleSubtype: string) {
  const motorcycleModels = getMotorcycleSubtypeModels(vehicle, vehicleSubtype);
  if (motorcycleModels) return motorcycleModels;

  const vehicleKey = getCategoryVehicleKey(vehicle);
  return filterVehicleBrandModelsBySubtype(
    vehicleKey,
    vehicleSubtype,
    mergeVehicleBrandModels(
      BRAND_MODELS[vehicle] ?? BRAND_MODELS[vehicleKey],
      COMMON_BRAND_MODELS_BY_VEHICLE[getCommonVehicleKey(vehicle)]
    )
  );
}

export function buildMarketplaceModelOptions({
  vehicle,
  brand,
  vehicleSubtype = ""
}: {
  vehicle: string;
  brand: string;
  vehicleSubtype?: string;
}) {
  const vehicleKey = getCategoryVehicleKey(vehicle);
  const commonVehicleKey = getCommonVehicleKey(vehicle);
  const subtypeModels = getVehicleSubtypeModels(vehicle, vehicleSubtype);

  if (subtypeModels) {
    return uniqueMarketplaceOptions(
      brand ? (subtypeModels[brand] ?? []) : Object.values(subtypeModels).flat()
    );
  }

  if (brand) return getBrandModelOptions(vehicle, brand);

  return uniqueMarketplaceOptions([
    ...(
      vehicle
        ? Object.values(BRAND_MODELS[vehicle] ?? BRAND_MODELS[vehicleKey] ?? {}).flat()
        : Object.values(BRAND_MODELS).flatMap((modelsByBrand) => Object.values(modelsByBrand).flat())
    ),
    ...(
      vehicle
        ? Object.values(COMMON_BRAND_MODELS_BY_VEHICLE[commonVehicleKey] ?? {}).flat()
        : Object.values(COMMON_BRAND_MODELS_BY_VEHICLE).flatMap((modelsByBrand) => Object.values(modelsByBrand).flat())
    )
  ]);
}

export function buildMarketplaceCategorySource({
  vehicleType,
  vehicleSubtype = "",
  vehicleCategories,
  allVehicleCategories
}: {
  vehicleType: string;
  vehicleSubtype?: string;
  vehicleCategories: Record<string, Record<string, readonly string[]>>;
  allVehicleCategories: Record<string, readonly string[]>;
}) {
  // Keep the public filter hierarchy identical to the sell flow. Converting
  // these to broad search buckets hid familiar publishing choices such as
  // "Alusta & telasto" and split its Telasto/Alusta groups apart.
  if (!vehicleType) return allVehicleCategories;
  const vehicleKey = getCategoryVehicleKey(vehicleType);
  const categorySource = vehicleCategories[vehicleType] ?? vehicleCategories[vehicleKey] ?? allVehicleCategories;
  return filterVehiclePartCategoriesBySubtype(categorySource, vehicleKey, vehicleSubtype);
}

export function mergeMarketplaceCategorySources(
  baseCategories: Record<string, readonly string[]>,
  vehicleCategorySources: Record<string, Record<string, readonly string[]>>
) {
  const merged = new Map<string, string[]>();

  const addCategorySource = (source: Record<string, readonly string[]>) => {
    for (const [categoryName, subcategories] of Object.entries(source)) {
      const next = [...(merged.get(categoryName) ?? [])];
      for (const subcategory of subcategories) {
        if (!next.includes(subcategory)) next.push(subcategory);
      }
      merged.set(categoryName, next);
    }
  };

  addCategorySource(baseCategories);
  for (const source of Object.values(vehicleCategorySources)) addCategorySource(source);

  return Object.fromEntries(merged.entries()) as Record<string, readonly string[]>;
}

export function buildMarketplaceSubcategoryGroups({
  category,
  categorySource
}: {
  category: string;
  categorySource: Record<string, readonly string[]>;
}) {
  if (!category) return null;

  const categorySubs = categorySource[category] ?? [];
  const sharedSections = buildMarketplacePartSections(category, categorySubs);
  if (sharedSections.length > 0) {
    return Object.fromEntries(
      sharedSections.map((section) => [section.name, section.subcategories])
    );
  }

  const baseGroups = subcategoryGroups[category];
  const dynamicMap = new Map<string, string[]>();
  const standalone: string[] = [];

  for (const sub of categorySubs) {
    const slashIdx = sub.indexOf(" / ");
    if (slashIdx !== -1) {
      const groupName = sub.slice(0, slashIdx).trim();
      const arr = dynamicMap.get(groupName) ?? [];
      arr.push(sub);
      dynamicMap.set(groupName, arr);
    } else {
      standalone.push(sub);
    }
  }

  const result: Record<string, string[]> = {};
  if (baseGroups) {
    for (const [group, children] of Object.entries(baseGroups)) {
      const allowedChildren = children.filter((child) => categorySubs.includes(child));
      const dynamicExtras = (dynamicMap.get(group) ?? []).filter((child) => !allowedChildren.includes(child));
      const merged = uniqueMarketplaceOptions([...allowedChildren, ...dynamicExtras]);
      const isGroupAllowed = children.length === 0 && categorySubs.includes(group);
      if (merged.length > 0) {
        result[group] = merged;
      } else if (isGroupAllowed) {
        result[group] = [];
      }
      dynamicMap.delete(group);
    }
  }

  for (const [group, children] of dynamicMap.entries()) {
    if (children.length > 0) result[group] = uniqueMarketplaceOptions(children);
  }

  if (!baseGroups) {
    for (const leaf of standalone) {
      if (!result[leaf]) result[leaf] = [];
    }
  } else {
    for (const leaf of standalone) {
      if (!Object.values(result).some((children) => children.includes(leaf))) {
        result[leaf] = [];
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export type MarketplacePartSection = {
  name: string;
  subcategories: string[];
};

function marketplacePartGroupName(category: string, subcategory: string) {
  const firstPart = subcategory.split(" / ")[0]?.trim() || subcategory.trim();
  const normalized = subcategory.toLocaleLowerCase("fi-FI");

  if (normalized.includes("kokonainen moottori")) return "Moottorit";
  if (normalized.includes("kokonainen voimansiirto")) return "Voimansiirto";
  if (normalized.includes("kokonainen kytkin")) return "Kytkimet";
  if (normalized.includes("kokonainen variaattori")) return "Variaattorit";
  if (normalized.includes("kokonainen telasto")) return "Telasto";
  if (normalized.includes("kokonainen alusta")) return "Alusta";
  if (normalized.includes("kokonainen iskunvaimennussarja")) return "Iskunvaimentimet";
  if (normalized.includes("kokonainen ohjaus")) return "Ohjaus";
  if (normalized.includes("kokonainen jarruj")) return "Jarrut";
  if (normalized.includes("kokonainen sukset")) return "Sukset";
  if (normalized.includes("kokonainen sähkö")) return "Sähkö";
  if (normalized.includes("kokonainen jäähdytys")) return "Jäähdytys";
  if (normalized.includes("kokonainen polttoaine")) return "Polttoainejärjestelmä";
  if (normalized.includes("kokonainen pakoputkisto")) return "Pakoputkisto";
  if (normalized.includes("kokonainen runko")) return "Runko";
  if (normalized.includes("kokonainen katesarja")) return "Katteet";

  return firstPart || category;
}

/**
 * The single-listing form, multi-listing form and marketplace filters all use
 * this hierarchy. Keeping the grouping here prevents labels such as Alusta and
 * Telasto from drifting between publishing and searching.
 */
export function buildMarketplacePartSections(
  category: string,
  subcategories: readonly string[]
): MarketplacePartSection[] {
  if (!category || subcategories.length === 0) return [];

  const configuredGroups = subcategoryGroups[category];
  if (!configuredGroups || Object.keys(configuredGroups).length <= 1) return [];

  const available = new Set(subcategories);
  const used = new Set<string>();
  const sections: MarketplacePartSection[] = [];

  for (const [name, configuredSubcategories] of Object.entries(configuredGroups)) {
    const candidates = configuredSubcategories.length > 0
      ? configuredSubcategories
      : [name];
    const matching = candidates.filter((subcategory) => available.has(subcategory));
    if (matching.length === 0) continue;

    matching.forEach((subcategory) => used.add(subcategory));
    sections.push({ name, subcategories: matching });
  }

  for (const subcategory of subcategories) {
    if (used.has(subcategory)) continue;

    const name = marketplacePartGroupName(category, subcategory);
    const existing = sections.find(
      (section) => section.name.toLocaleLowerCase("fi-FI") === name.toLocaleLowerCase("fi-FI")
    );
    if (existing) {
      if (!existing.subcategories.includes(subcategory)) {
        existing.subcategories.push(subcategory);
      }
    } else {
      sections.push({ name, subcategories: [subcategory] });
    }
  }

  return sections;
}

export function buildMarketplaceFilterOptions({
  taxonomyVehicles,
  vehicleBrands,
  vehicleCategories,
  allVehicleCategories,
  vehicleType,
  vehicleSubtype = "",
  brand,
  model,
  category,
  subcategoryParent
}: {
  taxonomyVehicles: Array<{ key: string }>;
  vehicleBrands: Record<string, string[]>;
  vehicleCategories: Record<string, Record<string, readonly string[]>>;
  allVehicleCategories: Record<string, readonly string[]>;
  vehicleType: string;
  vehicleSubtype?: string;
  brand: string;
  model: string;
  category: string;
  subcategoryParent: string;
}) {
  const vehicle = vehicleType || "";
  const vehicleKey = getCategoryVehicleKey(vehicle);
  const commonVehicleKey = getCommonVehicleKey(vehicle);
  const subtypeModels = getVehicleSubtypeModels(vehicle, vehicleSubtype);
  const taxonomyBrandValues = vehicle ? (vehicleBrands[vehicle] ?? []) : Object.values(vehicleBrands).flat();
  const brands = subtypeModels
    ? uniqueMarketplaceOptions(Object.keys(subtypeModels))
    : uniqueMarketplaceOptions([
        ...taxonomyBrandValues.filter((item) => item !== "Kaikki"),
        ...Object.keys(BRAND_MODELS[vehicle] ?? {}),
        ...Object.keys(BRAND_MODELS[vehicleKey] ?? {}),
        ...Object.keys(COMMON_BRAND_MODELS_BY_VEHICLE[commonVehicleKey] ?? {}),
        ...(!vehicle ? Object.values(BRAND_MODELS).flatMap((modelsByBrand) => Object.keys(modelsByBrand)) : []),
        ...(!vehicle ? Object.values(COMMON_BRAND_MODELS_BY_VEHICLE).flatMap((modelsByBrand) => Object.keys(modelsByBrand)) : [])
      ]);
  const categorySource = buildMarketplaceCategorySource({
    vehicleType: vehicle,
    vehicleSubtype,
    vehicleCategories,
    allVehicleCategories
  });
  const subcategoryGroupsForCategory = buildMarketplaceSubcategoryGroups({ category, categorySource });
  const subcategoryParents = category
    ? (subcategoryGroupsForCategory ? Object.keys(subcategoryGroupsForCategory) : categorySource[category] ?? [])
    : [];
  const subcategories = category
    ? (subcategoryGroupsForCategory && subcategoryParent
      ? subcategoryGroupsForCategory[subcategoryParent] ?? []
      : subcategoryParent
        ? (categorySource[category] ?? []).filter((item) => item === subcategoryParent || item.startsWith(`${subcategoryParent} /`))
        : categorySource[category] ?? [])
    : [];
  const models = buildMarketplaceModelOptions({ vehicle, brand, vehicleSubtype });
  const engineModels = getModelEngineOptions(
    vehicle,
    brand,
    model,
    [],
    subtypeModels ?? undefined
  );

  return {
    vehicleTypes: taxonomyVehicles.map((item) => item.key).filter(Boolean),
    vehicleSubtypes: vehicle
      ? (VEHICLE_SUBTYPE_OPTIONS[vehicle] ?? VEHICLE_SUBTYPE_OPTIONS[vehicleKey] ?? [])
      : uniqueMarketplaceOptions(Object.values(VEHICLE_SUBTYPE_OPTIONS).flat()),
    brands,
    models,
    years: buildMarketplaceYearOptions(),
    engineCcs: vehicle ? (CC_OPTIONS[vehicle] ?? CC_OPTIONS[vehicleKey] ?? DEFAULT_CC_OPTIONS) : DEFAULT_CC_OPTIONS,
    engineModels,
    categories: Object.keys(categorySource),
    subcategoryGroups: subcategoryGroupsForCategory,
    subcategoryParents,
    subcategories,
    categorySource
  };
}
