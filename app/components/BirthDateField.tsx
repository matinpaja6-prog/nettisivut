"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";

type BirthDateFieldProps = {
  disabled?: boolean;
  label?: string;
  onChange: (value: string) => void;
  required?: boolean;
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

function cleanNumberInput(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
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

export function BirthDateField({
  disabled = false,
  label = "Syntymäaika",
  onChange,
  required = false,
  value
}: BirthDateFieldProps) {
  const [parts, setParts] = useState(() => parseDate(value));

  useEffect(() => {
    if (value) setParts(parseDate(value));
  }, [value]);

  const maxDays = daysInMonth(parts.year, parts.month);

  function updatePart(key: "day" | "month" | "year", nextValue: string) {
    const cleanedValue = key === "month" ? nextValue : cleanNumberInput(nextValue, key === "year" ? 4 : 2);
    const next = { ...parts, [key]: cleanedValue };
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
    <label className="date-field">
      <span>{label}</span>
      <div className="date-field-control">
        <CalendarDays size={18} aria-hidden="true" />
        <input
          aria-label="Päivä"
          disabled={disabled}
          inputMode="numeric"
          max={maxDays}
          maxLength={2}
          min={1}
          placeholder="Pv"
          required={required}
          value={parts.day ? String(Number(parts.day)) : ""}
          onChange={(event) => updatePart("day", event.target.value)}
        />
        <select
          aria-label="Kuukausi"
          disabled={disabled}
          required={required}
          value={parts.month ? String(Number(parts.month)) : ""}
          onChange={(event) => updatePart("month", event.target.value)}
        >
          <option value="">Kuukausi</option>
          {months.map((month, index) => (
            <option key={month} value={String(index + 1)}>
              {month}
            </option>
          ))}
        </select>
        <input
          aria-label="Vuosi"
          disabled={disabled}
          inputMode="numeric"
          max={currentYear}
          maxLength={4}
          min={minYear}
          placeholder="Vuosi"
          required={required}
          value={parts.year}
          onChange={(event) => updatePart("year", event.target.value)}
        />
      </div>
    </label>
  );
}
