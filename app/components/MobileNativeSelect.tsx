"use client";

type MobileNativeSelectOption = {
  value: string;
  label: string;
};

export default function MobileNativeSelect({
  id,
  value,
  options,
  onChange,
  label,
  disabled = false
}: {
  id?: string;
  value: string;
  options: readonly MobileNativeSelectOption[];
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      className="mobile-native-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      disabled={disabled}
      data-no-auto-translate
      translate="no"
    >
      {options.map((option, index) => (
        <option key={`${option.value}-${index}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
