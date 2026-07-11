"use client";

import { subcategoryGroups } from "@/lib/listings";
import {
  BRAND_MODELS,
  CC_OPTIONS,
  COMMON_BRAND_MODELS_BY_VEHICLE,
  DEFAULT_CC_OPTIONS,
  ENGINE_MODELS,
  VEHICLE_SUBTYPE_OPTIONS,
  getBrandModelOptions,
  getCategoryVehicleKey,
  getCommonVehicleKey,
  getModelEngineOptions
} from "@/app/components/CategoryDrawer";

export const MARKETPLACE_YEAR_FILTER_MIN = 1980;

export function getMarketplaceYearFilterMax() {
  return new Date().getFullYear() + 1;
}

export function uniqueMarketplaceOptions(values: Array<string | number | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "fi", { numeric: true, sensitivity: "base" }));
}

export function buildMarketplaceYearOptions() {
  const years: string[] = [];
  for (let year = getMarketplaceYearFilterMax(); year >= MARKETPLACE_YEAR_FILTER_MIN; year -= 1) {
    years.push(String(year));
  }
  return years;
}

export function buildMarketplaceCategorySource({
  vehicleType,
  vehicleCategories,
  allVehicleCategories
}: {
  vehicleType: string;
  vehicleCategories: Record<string, Record<string, readonly string[]>>;
  allVehicleCategories: Record<string, readonly string[]>;
}) {
  if (!vehicleType) return allVehicleCategories;
  const vehicleKey = getCategoryVehicleKey(vehicleType);
  return vehicleCategories[vehicleType] ?? vehicleCategories[vehicleKey] ?? allVehicleCategories;
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

export function buildMarketplaceFilterOptions({
  taxonomyVehicles,
  vehicleBrands,
  vehicleCategories,
  allVehicleCategories,
  vehicleType,
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
  brand: string;
  model: string;
  category: string;
  subcategoryParent: string;
}) {
  const vehicle = vehicleType || "";
  const vehicleKey = getCategoryVehicleKey(vehicle);
  const commonVehicleKey = getCommonVehicleKey(vehicle);
  const taxonomyBrandValues = vehicle ? (vehicleBrands[vehicle] ?? []) : Object.values(vehicleBrands).flat();
  const brands = uniqueMarketplaceOptions([
    ...taxonomyBrandValues.filter((item) => item !== "Kaikki"),
    ...Object.keys(BRAND_MODELS[vehicle] ?? {}),
    ...Object.keys(BRAND_MODELS[vehicleKey] ?? {}),
    ...Object.keys(COMMON_BRAND_MODELS_BY_VEHICLE[commonVehicleKey] ?? {}),
    ...(!vehicle ? Object.values(BRAND_MODELS).flatMap((modelsByBrand) => Object.keys(modelsByBrand)) : []),
    ...(!vehicle ? Object.values(COMMON_BRAND_MODELS_BY_VEHICLE).flatMap((modelsByBrand) => Object.keys(modelsByBrand)) : [])
  ]);
  const categorySource = buildMarketplaceCategorySource({ vehicleType: vehicle, vehicleCategories, allVehicleCategories });
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
  const engineFallback = brand ? (ENGINE_MODELS[vehicle]?.[brand] ?? ENGINE_MODELS[vehicleKey]?.[brand] ?? []) : [];

  return {
    vehicleTypes: taxonomyVehicles.map((item) => item.key).filter(Boolean),
    vehicleSubtypes: vehicle
      ? (VEHICLE_SUBTYPE_OPTIONS[vehicle] ?? VEHICLE_SUBTYPE_OPTIONS[vehicleKey] ?? [])
      : uniqueMarketplaceOptions(Object.values(VEHICLE_SUBTYPE_OPTIONS).flat()),
    brands,
    models: brand ? getBrandModelOptions(vehicle, brand) : [],
    years: buildMarketplaceYearOptions(),
    engineCcs: vehicle ? (CC_OPTIONS[vehicle] ?? CC_OPTIONS[vehicleKey] ?? DEFAULT_CC_OPTIONS) : DEFAULT_CC_OPTIONS,
    engineModels: getModelEngineOptions(vehicle, brand, model, engineFallback),
    categories: Object.keys(categorySource),
    subcategoryGroups: subcategoryGroupsForCategory,
    subcategoryParents,
    subcategories,
    categorySource
  };
}
