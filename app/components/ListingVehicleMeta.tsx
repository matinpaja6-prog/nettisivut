import styles from "./ListingVehicleMeta.module.css";

type ListingVehicleMetaProps = {
  year?: string | number | null;
  brand?: string | null;
  model?: string | null;
  className?: string;
  compact?: boolean;
};

export default function ListingVehicleMeta({
  year,
  brand,
  model,
  className = "",
  compact = false
}: ListingVehicleMetaProps) {
  const values = [brand, model, year]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (values.length === 0) return null;

  return (
    <span
      className={`${styles.root}${compact ? ` ${styles.compact}` : ""}${className ? ` ${className}` : ""}`}
      data-listing-vehicle-meta="true"
      aria-label={values.join(", ")}
    >
      {values.map((value, index) => (
        <span key={`${value}-${index}`}>{value}</span>
      ))}
    </span>
  );
}
