"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

type BirthDateFieldProps = {
  disabled?: boolean;
  label?: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
};

type DatePartKey = "day" | "month" | "year";

type DatePartOption = {
  label: string;
  value: string;
};

const months = [
  "Tammikuu",
  "Helmikuu",
  "Maaliskuu",
  "Huhtikuu",
  "Toukokuu",
  "Kesäkuu",
  "Heinäkuu",
  "Elokuu",
  "Syyskuu",
  "Lokakuu",
  "Marraskuu",
  "Joulukuu"
];

const currentYear = new Date().getFullYear();
const minYear = currentYear - 100;
const yearOptions: DatePartOption[] = Array.from(
  { length: currentYear - minYear + 1 },
  (_, index) => {
    const year = String(currentYear - index);
    return { label: year, value: year };
  }
);

function parseDate(value: string) {
  const [year = "", month = "", day = ""] = value.split("-");
  return { day, month, year };
}

function daysInMonth(year: string, month: string) {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

function formatDate(year: string, month: string, day: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isCompleteDate(year: string, month: string, day: string) {
  const numericYear = Number(year);
  const numericDay = Number(day);

  return (
    year.length === 4 &&
    numericYear >= minYear &&
    numericYear <= currentYear &&
    Boolean(month) &&
    numericDay >= 1 &&
    numericDay <= daysInMonth(year, month)
  );
}

function DatePartSelect({
  disabled,
  label,
  onChange,
  onOpen,
  open,
  options,
  placeholder,
  value
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  onOpen: (open: boolean) => void;
  open: boolean;
  options: DatePartOption[];
  placeholder: string;
  value: string;
}) {
  const selected = options.find((option) => option.value === value);

  function choose(nextValue: string) {
    onChange(nextValue);
    onOpen(false);
  }

  return (
    <span
      className={`date-part-select${open ? " is-open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={value ? "date-part-button" : "date-part-button is-placeholder"}
        disabled={disabled}
        onClick={() => onOpen(!open)}
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open ? (
        <span className="date-part-menu" role="listbox" aria-label={label}>
          <button
            type="button"
            className={!value ? "date-part-option is-active" : "date-part-option"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose("")}
            role="option"
            aria-selected={!value}
          >
            {placeholder}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? "date-part-option is-active" : "date-part-option"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function BirthDateField({
  disabled = false,
  label = "Syntymäaika",
  onChange,
  required = false,
  value
}: BirthDateFieldProps) {
  const [parts, setParts] = useState(() => parseDate(value));
  const [openPart, setOpenPart] = useState<DatePartKey | null>(null);

  useEffect(() => {
    if (value) setParts(parseDate(value));
  }, [value]);

  const maxDays = daysInMonth(parts.year, parts.month);
  const dayOptions: DatePartOption[] = Array.from({ length: maxDays }, (_, index) => {
    const day = String(index + 1);
    return { label: day, value: day };
  });
  const monthOptions: DatePartOption[] = months.map((month, index) => ({
    label: month,
    value: String(index + 1)
  }));

  function updatePart(key: DatePartKey, nextValue: string) {
    const next = { ...parts, [key]: nextValue };
    const nextMaxDays = daysInMonth(next.year, next.month);

    if (Number(next.day) > nextMaxDays) {
      next.day = String(nextMaxDays);
    }

    setParts(next);

    if (isCompleteDate(next.year, next.month, next.day)) {
      onChange(formatDate(next.year, next.month, next.day));
      return;
    }

    onChange("");
  }

  return (
    <label className={`date-field${openPart ? " is-open" : ""}`}>
      <span>{label}</span>
      <div className="date-field-control" data-required={required ? "true" : undefined}>
        <CalendarDays size={18} aria-hidden="true" />
        <DatePartSelect
          disabled={disabled}
          label="Päivä"
          open={openPart === "day"}
          onOpen={(open) => setOpenPart(open ? "day" : null)}
          options={dayOptions}
          placeholder="Pv"
          value={parts.day ? String(Number(parts.day)) : ""}
          onChange={(nextValue) => updatePart("day", nextValue)}
        />
        <DatePartSelect
          disabled={disabled}
          label="Kuukausi"
          open={openPart === "month"}
          onOpen={(open) => setOpenPart(open ? "month" : null)}
          options={monthOptions}
          placeholder="Kuukausi"
          value={parts.month ? String(Number(parts.month)) : ""}
          onChange={(nextValue) => updatePart("month", nextValue)}
        />
        <DatePartSelect
          disabled={disabled}
          label="Vuosi"
          open={openPart === "year"}
          onOpen={(open) => setOpenPart(open ? "year" : null)}
          options={yearOptions}
          placeholder="Vuosi"
          value={parts.year}
          onChange={(nextValue) => updatePart("year", nextValue)}
        />
      </div>
    </label>
  );
}
