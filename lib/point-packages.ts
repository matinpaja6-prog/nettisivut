export type PointPackage = {
  id: "points-500" | "points-1200" | "points-3000";
  points: number;
  amount: string;
  currency: "EUR";
  displayPrice: string;
  label: string;
};

export const POINT_PACKAGES: PointPackage[] = [
  { id: "points-500", points: 500, amount: "4.90", currency: "EUR", displayPrice: "4,90 €", label: "Aloituspaketti" },
  { id: "points-1200", points: 1200, amount: "9.90", currency: "EUR", displayPrice: "9,90 €", label: "Suosituin" },
  { id: "points-3000", points: 3000, amount: "19.90", currency: "EUR", displayPrice: "19,90 €", label: "Tehomyyjä" }
];

export function getPointPackage(packageId: string | null | undefined) {
  return POINT_PACKAGES.find((item) => item.id === packageId) ?? null;
}
