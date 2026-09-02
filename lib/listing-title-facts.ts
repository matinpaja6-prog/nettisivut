type DetailValues = {
  isVehicle: boolean;
  category: string;
  mileage: string;
  operatingHours: string;
};

type DetailLabels = {
  category: string;
  mileage: string;
  operatingHours: string;
  notSpecified: string;
};

/** Values already include their units, shared with the listing's basic facts. */
export function listingTitleDetailFacts(values: DetailValues, labels: DetailLabels) {
  if (values.isVehicle) {
    const usage = [
      { label: labels.mileage, value: values.mileage.trim() },
      { label: labels.operatingHours, value: values.operatingHours.trim() }
    ].filter(fact => fact.value !== "");
    if (usage.length > 0) return usage;
  }
  return [{ label: labels.category, value: values.category || labels.notSpecified }];
}
