import { databaseLocationGroups } from "./location-filter";

export type AppliedListingFilters = {
  query: string;
  category: string;
  subcategory: string;
  vehicleType: string;
  vehicleSubtype: string;
  selectedBrand: string;
  modelQuery: string;
  identifierQuery: string;
  locationQuery: string;
  yearQuery: string;
  yearMinQuery: string;
  yearMaxQuery: string;
  engineCcQuery: string;
  engineModelQuery: string;
  vehicleMileageMinQuery: string;
  vehicleMileageMaxQuery: string;
  vehicleHoursMinQuery: string;
  vehicleHoursMaxQuery: string;
  vehicleRegistrationQuery: string;
  vehicleEngineKindQuery: string;
  vehicleDriveTypeQuery: string;
  vehicleRoadLegalQuery: string;
  vehicleAccessoriesQuery: string[];
  vehicleColorsQuery: string[];
  vehicleVatDeductibleQuery?: boolean;
  vehicleTaxFreeQuery?: boolean;
  trackMatDimensionQuery: string;
  minPrice: number;
  maxPrice: number;
  garageFilterId: string;
  gearTypeQuery: string[];
  gearBrandOptionsQuery: string[];
  gearSizeOptionsQuery: string[];
  gearBrandQuery: string;
  gearSizeQuery: string;
  gearConditionQuery: string;
  gearTargetQuery: string;
  sellerType: "" | "company" | "private" | "verified-company";
};

export type SearchPredicate = {
  field?: string;
  op?: "words" | "equal" | "compact" | "min" | "max" | "any_token" | "all_tokens" | "location";
  value?: string | number | string[];
  all?: SearchPredicate[];
  any?: SearchPredicate[];
  not?: SearchPredicate;
};
export const DATABASE_LISTING_FILTERS_ENABLED = process.env.NEXT_PUBLIC_MARKETPLACE_DB_FILTERS === "true";
export const searchNormalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

export function buildDatabaseListingFilters(f: AppliedListingFilters, mode: string, options: {
  category?: string; subcategories?: string[]; excludedModelVariants?: string[];
  garage?: { id: string; make?: string; model?: string } | null;
} = {}): SearchPredicate {
  const all: SearchPredicate[] = [];
  const add = (field: string, op: SearchPredicate["op"], value: string | number | string[] | undefined) => {
    if (value !== undefined && value !== "" && (!Array.isArray(value) || value.length)) all.push({field,op,value});
  };
  const anyWords = (field: string, values: string[]) => {
    const choices = values.map(value=>value.trim()).filter(Boolean);
    if (choices.length) all.push({any: choices.map(value=>({field,op:"words",value}))});
  };
  if (mode !== "all") add("kind","equal",mode);
  if (f.minPrice > 0) add("price","min",f.minPrice);
  // 100000 is the UI's unbounded default, not an implicit price ceiling.
  if (f.maxPrice < 100000) add("price","max",f.maxPrice);
  const vehicle = f.vehicleType.replace(/^(Mopot)$/,"Mopo").replace(/^(Moottorikelkat)$/,"Moottorikelkka").replace(/^(Mönkijät)$/,"Mönkijä").replace(/^(Moottoripyörät)$/,"Moottoripyörä");
  add("vehicle_type","equal",vehicle);
  add("vehicle_subtype","words",f.vehicleSubtype);
  add("category","equal",options.category || f.category);
  const leaf = (value: string) => value.split("/").at(-1)?.trim() || "";
  if (f.subcategory) all.push({any: [f.subcategory,...(options.subcategories || [])].map(value=>({field:"subcategory",op:"equal",value:leaf(value)}))});
  if (f.selectedBrand && f.selectedBrand !== "Kaikki") all.push({any:[
    {field:"brand",op:"compact",value:f.selectedBrand},
    {all:[{field:"brand",op:"equal",value:""},{field:"search",op:"words",value:f.selectedBrand}]}
  ]});
  add("model","equal",f.modelQuery);
  if (f.modelQuery && options.excludedModelVariants?.length) all.push({not:{any:options.excludedModelVariants.map(value=>({field:"model_search",op:"words",value}))}});
  add("year","min",f.yearMinQuery || f.yearQuery); add("year","max",f.yearMaxQuery || f.yearQuery);
  if (f.identifierQuery) {
    const id = f.identifierQuery.replace(/\s/g,"").replace(/^(?:id|ilmoitus|#)/i,"");
    all.push({any:[{field:"id",op:"equal",value:id},{field:"listing_number",op:"equal",value:/^\d+$/.test(id) ? String(Number(id)) : id}]});
  }
  if (f.locationQuery.startsWith("location:v1:")) {
    const groups = databaseLocationGroups(f.locationQuery);
    if (groups.length) all.push({any:groups.map(value=>({field:"location",op:"location",value}))});
  } else add("location","words",f.locationQuery);
  add("engine_cc","compact",f.engineCcQuery);
  if (mode !== "vehicles") add("engine_model","words",f.engineModelQuery);
  add("mileage","min",f.vehicleMileageMinQuery); add("mileage","max",f.vehicleMileageMaxQuery);
  add("hours","min",f.vehicleHoursMinQuery); add("hours","max",f.vehicleHoursMaxQuery);
  add("registration","compact",f.vehicleRegistrationQuery);
  add("engine_kind","equal",f.vehicleEngineKindQuery);
  add("drive_type","equal",f.vehicleDriveTypeQuery);
  add("road_legal","equal",f.vehicleRoadLegalQuery);
  add("accessories","all_tokens",f.vehicleAccessoriesQuery);
  add("colors","any_token",f.vehicleColorsQuery);
  if (f.vehicleVatDeductibleQuery) add("vat_deductible","equal","true");
  if (f.vehicleTaxFreeQuery) add("tax_free","equal","true");
  anyWords("model_search",f.trackMatDimensionQuery.split(" / "));
  anyWords("gear_search",f.gearTypeQuery);
  anyWords("gear_search",[...f.gearBrandOptionsQuery,f.gearBrandQuery]);
  anyWords("gear_search",[...f.gearSizeOptionsQuery,f.gearSizeQuery]);
  add("gear_search","words",f.gearTargetQuery);
  add("condition","equal",f.gearConditionQuery);
  if (f.sellerType === "verified-company") add("verified_company","equal","true");
  else if (f.sellerType) add("seller_type","equal",f.sellerType);
  if (f.garageFilterId && options.garage?.id === f.garageFilterId) {
    add("model_search","words",options.garage.make);
    add("model_search","words",options.garage.model);
  }
  return {all};
}
