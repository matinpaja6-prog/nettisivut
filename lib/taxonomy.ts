import { supabase } from "@/lib/supabase";
import {
  categories as defaultCategories,
  isVehiclePartAllowed,
  subcategoryGroups as defaultSubcategoryGroups
} from "@/lib/listings";

/* =========================
   TYPES
========================= */

export type VehicleEntry = {
  /** Internal key, e.g. "Moottorikelkka". Used as vehicle_type value in DB. */
  key: string;
  /** Singular label shown in sell page card. */
  label: string;
  /** Plural label shown in front-page filter pill. */
  pillLabel: string;
  /** Short descriptive blurb for sell card. */
  desc: string;
  /** Image path for sell-page card. */
  image: string;
  /** Brand list. First item is rendered as "Kaikki" virtual entry where needed. */
  brands: string[];
};

export type CategoryEntry = {
  key: string;
  subcategories: string[];
  /** Vehicle keys this category applies to. Empty/undefined = all vehicles. */
  vehicleKeys?: string[];
  /**
   * Per-subcategory vehicle restriction. Maps subcategory string (full
   * "Group / Leaf" form, or the group name to apply to all its leaves)
   * to the allowed vehicle keys. Empty list = hidden everywhere.
   * Missing key = falls back to category's vehicleKeys + hardcoded defaults.
   */
  subcategoryVehicleKeys?: Record<string, string[]>;
};

export type SiteTaxonomy = {
  vehicles: VehicleEntry[];
  /** Ordered top-level categories with their full leaf list. */
  categories: CategoryEntry[];
  /** Optional subcategory grouping per top-level category. */
  subcategoryGroups: Record<string, Record<string, string[]>>;
};

/* =========================
   DEFAULTS (mirror current hardcoded shape)
========================= */

export const DEFAULT_VEHICLES: VehicleEntry[] = [
  {
    key: "Moottorikelkka",
    label: "Moottorikelkka",
    pillLabel: "Moottorikelkat",
    desc: "Kelkat, telastot, moottorit",
    image: "/vehicles/moottorikelkka.png",
    brands: ["Lynx", "Ski-Doo", "Polaris", "Arctic Cat"]
  },
  {
    key: "Mönkijä",
    label: "Mönkijä",
    pillLabel: "Mönkijät",
    desc: "ATV ja UTV osat",
    image: "/vehicles/monkija.png",
    brands: ["Can-Am", "Polaris", "Yamaha", "Honda", "CFMOTO"]
  },
  {
    key: "Motocross",
    label: "Motocross",
    pillLabel: "Motocross",
    desc: "Crossi ja enduro",
    image: "/vehicles/motocross.png",
    brands: ["KTM", "Yamaha", "Honda", "Kawasaki", "Husqvarna", "Suzuki", "GasGas", "Beta", "Sherco", "TM"]
  },
  {
    key: "Mopo",
    label: "Mopo",
    pillLabel: "Mopot",
    desc: "Mopot ja piikit",
    image: "/vehicles/mopot.png",
    brands: ["Yamaha", "Honda", "Derbi", "Rieju", "KTM", "Aprilia"]
  }
];

export const DEFAULT_TAXONOMY: SiteTaxonomy = {
  vehicles: DEFAULT_VEHICLES,
  categories: Object.entries(defaultCategories)
    .filter(([key]) => key !== "Kaikki")
    .map(([key, subs]) => ({ key, subcategories: [...(subs as readonly string[])] })),
  subcategoryGroups: JSON.parse(JSON.stringify(defaultSubcategoryGroups))
};

export const TAXONOMY_EVENT = "arctic-taxonomy-changed";

/* =========================
   FETCH / SAVE
========================= */

function mergeWithDefaults(data: Partial<SiteTaxonomy> | null | undefined): SiteTaxonomy {
  if (!data) return DEFAULT_TAXONOMY;
  const merged: SiteTaxonomy = {
    vehicles:
      Array.isArray(data.vehicles) && data.vehicles.length > 0
        ? (data.vehicles as VehicleEntry[]).map((v) => ({
            key: v.key,
            label: v.label || v.key,
            pillLabel: v.pillLabel || v.label || v.key,
            desc: v.desc || "",
            image: v.image || "",
            brands: Array.isArray(v.brands) ? v.brands.filter(Boolean) : []
          }))
        : DEFAULT_TAXONOMY.vehicles,
    categories:
      Array.isArray(data.categories) && data.categories.length > 0
        ? data.categories.map((c) => ({
            key: c.key,
            subcategories: Array.isArray(c.subcategories) ? c.subcategories.filter(Boolean) : [],
            vehicleKeys: Array.isArray((c as CategoryEntry).vehicleKeys)
              ? (c as CategoryEntry).vehicleKeys!.filter(Boolean)
              : undefined,
            subcategoryVehicleKeys:
              (c as CategoryEntry).subcategoryVehicleKeys &&
              typeof (c as CategoryEntry).subcategoryVehicleKeys === "object"
                ? (c as CategoryEntry).subcategoryVehicleKeys
                : undefined
          }))
        : DEFAULT_TAXONOMY.categories,
    subcategoryGroups:
      data.subcategoryGroups && typeof data.subcategoryGroups === "object"
        ? (data.subcategoryGroups as Record<string, Record<string, string[]>>)
        : DEFAULT_TAXONOMY.subcategoryGroups
  };

  const frameCategory = merged.categories.find((cat) => cat.key === "Runko & katteet");
  if (frameCategory && !frameCategory.subcategories.includes("Tunnelit / Takarunko")) {
    const frontFrameIndex = frameCategory.subcategories.indexOf("Tunnelit / Eturunko");
    const insertAt = frontFrameIndex === -1 ? frameCategory.subcategories.length : frontFrameIndex + 1;
    frameCategory.subcategories.splice(insertAt, 0, "Tunnelit / Takarunko");
  }

  const frameGroups = merged.subcategoryGroups["Runko & katteet"];
  const frameGroup = frameGroups?.Runko;
  if (Array.isArray(frameGroup) && !frameGroup.includes("Tunnelit / Takarunko")) {
    const frontFrameIndex = frameGroup.indexOf("Tunnelit / Eturunko");
    const insertAt = frontFrameIndex === -1 ? frameGroup.length : frontFrameIndex + 1;
    frameGroup.splice(insertAt, 0, "Tunnelit / Takarunko");
  }

  return merged;
}

export async function fetchSiteTaxonomy(): Promise<SiteTaxonomy> {
  if (!supabase) return DEFAULT_TAXONOMY;
  const { data, error } = await supabase
    .from("site_taxonomy")
    .select("data")
    .eq("id", "global")
    .maybeSingle();
  if (error || !data) return DEFAULT_TAXONOMY;
  return mergeWithDefaults(data.data as Partial<SiteTaxonomy>);
}

export async function saveSiteTaxonomy(
  taxonomy: SiteTaxonomy
): Promise<{ error: unknown }> {
  if (!supabase) return { error: new Error("Supabase ei ole konfiguroitu.") };
  const previous = await fetchSiteTaxonomy();
  // Try UPDATE first (singleton row should exist from migration).
  const { data: updateResult, error: updateError } = await supabase
    .from("site_taxonomy")
    .update({
      data: taxonomy,
      updated_at: new Date().toISOString()
    })
    .eq("id", "global")
    .select("id");
  let error: unknown = updateError;
  if (!updateError && (!updateResult || updateResult.length === 0)) {
    // Row doesn't exist yet — try INSERT.
    const { error: insertError } = await supabase
      .from("site_taxonomy")
      .insert({
        id: "global",
        data: taxonomy,
        updated_at: new Date().toISOString()
      });
    error = insertError;
  }
  if (error) {
    console.error("[taxonomy] save failed:", error);
  } else if (typeof window !== "undefined") {
    const cascadeError = await cascadeTaxonomyRenames(previous, taxonomy);
    if (cascadeError) {
      console.error("[taxonomy] cascade rename failed:", cascadeError);
    }
    window.dispatchEvent(new CustomEvent(TAXONOMY_EVENT));
  }
  return { error };
}

function collectRenameMap(previous: SiteTaxonomy, next: SiteTaxonomy) {
  const categoryRenames = new Map<string, string>();
  const subcategoryRenames = new Map<string, string>();
  const maxCategories = Math.min(previous.categories.length, next.categories.length);

  for (let i = 0; i < maxCategories; i += 1) {
    const oldCategory = previous.categories[i];
    const newCategory = next.categories[i];
    if (
      oldCategory?.key &&
      newCategory?.key &&
      oldCategory.key !== newCategory.key
    ) {
      categoryRenames.set(oldCategory.key, newCategory.key);
    }

    const maxSubs = Math.min(
      oldCategory?.subcategories.length ?? 0,
      newCategory?.subcategories.length ?? 0
    );
    for (let j = 0; j < maxSubs; j += 1) {
      const oldSub = oldCategory.subcategories[j];
      const newSub = newCategory.subcategories[j];
      if (oldSub && newSub && oldSub !== newSub) {
        subcategoryRenames.set(oldSub, newSub);
      }
    }
  }

  return { categoryRenames, subcategoryRenames };
}

async function cascadeTaxonomyRenames(
  previous: SiteTaxonomy,
  next: SiteTaxonomy
): Promise<unknown> {
  if (!supabase) return null;
  const { categoryRenames, subcategoryRenames } = collectRenameMap(previous, next);
  const errors: unknown[] = [];

  for (const [oldValue, newValue] of categoryRenames) {
    const { error: listingError } = await supabase
      .from("listings")
      .update({ category: newValue })
      .eq("category", oldValue);
    if (listingError) errors.push(listingError);

    const { error: soldError } = await supabase
      .from("sold_listings")
      .update({ category: newValue })
      .eq("category", oldValue);
    if (soldError) errors.push(soldError);

    const { error: alertError } = await supabase
      .from("search_alerts")
      .update({ category: newValue })
      .eq("category", oldValue);
    if (alertError) errors.push(alertError);
  }

  for (const [oldValue, newValue] of subcategoryRenames) {
    const { error: listingError } = await supabase
      .from("listings")
      .update({ subcategory: newValue })
      .eq("subcategory", oldValue);
    if (listingError) errors.push(listingError);

    const { error: soldError } = await supabase
      .from("sold_listings")
      .update({ subcategory: newValue })
      .eq("subcategory", oldValue);
    if (soldError) errors.push(soldError);

    const { error: alertError } = await supabase
      .from("search_alerts")
      .update({ subcategory: newValue })
      .eq("subcategory", oldValue);
    if (alertError) errors.push(alertError);
  }

  return errors.length > 0 ? errors : null;
}

/* =========================
   DERIVED ACCESSORS
========================= */

export function categoriesAsRecord(
  taxonomy: SiteTaxonomy
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of taxonomy.categories) {
    out[c.key] = [...c.subcategories];
  }
  return out;
}

export function vehicleBrandsRecord(
  taxonomy: SiteTaxonomy
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const v of taxonomy.vehicles) {
    out[v.key] = ["Kaikki", ...v.brands];
  }
  return out;
}

export function categoryAppliesToVehicle(
  cat: CategoryEntry,
  vehicleKey: string
): boolean {
  // No vehicleKeys filter = applies to all vehicles.
  if (!cat.vehicleKeys || cat.vehicleKeys.length === 0) return true;
  return cat.vehicleKeys.includes(vehicleKey);
}

export function subcategoryAppliesToVehicle(
  cat: CategoryEntry,
  sub: string,
  vehicleKey: string
): boolean {
  const map = cat.subcategoryVehicleKeys;
  if (map) {
    const exact = map[sub];
    if (Array.isArray(exact)) {
      return exact.length === 0 ? false : exact.includes(vehicleKey);
    }
    const slashIdx = sub.indexOf(" / ");
    if (slashIdx !== -1) {
      const groupName = sub.slice(0, slashIdx).trim();
      const groupOverride = map[groupName];
      if (Array.isArray(groupOverride)) {
        return groupOverride.length === 0 ? false : groupOverride.includes(vehicleKey);
      }
    }
  }
  return isVehiclePartAllowed(vehicleKey, cat.key, sub);
}

export function buildVehicleCategoriesFromTaxonomy(
  taxonomy: SiteTaxonomy,
  vehicleKey: string
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const cat of taxonomy.categories) {
    if (!categoryAppliesToVehicle(cat, vehicleKey)) continue;
    const filtered = cat.subcategories.filter((sub) =>
      subcategoryAppliesToVehicle(cat, sub, vehicleKey)
    );
    if (filtered.length > 0) out[cat.key] = filtered;
  }
  return out;
}

export function buildSubcategoryGroupsForVehicle(
  taxonomy: SiteTaxonomy,
  vehicleKey: string
): Record<string, Record<string, string[]>> {
  const allowed = buildVehicleCategoriesFromTaxonomy(taxonomy, vehicleKey);
  const out: Record<string, Record<string, string[]>> = {};
  for (const [cat, groups] of Object.entries(taxonomy.subcategoryGroups)) {
    if (!allowed[cat]) continue;
    const allowedSubs = new Set(allowed[cat]);
    const newGroups: Record<string, string[]> = {};
    for (const [group, items] of Object.entries(groups)) {
      const arr = Array.isArray(items) ? items : [];
      if (arr.length === 0) {
        // Group itself is the leaf; keep only if it is in allowedSubs.
        if (allowedSubs.has(group)) newGroups[group] = [];
      } else {
        const kept = arr.filter((item) => allowedSubs.has(item));
        if (kept.length > 0) newGroups[group] = kept;
      }
    }
    if (Object.keys(newGroups).length > 0) out[cat] = newGroups;
  }
  return out;
}
