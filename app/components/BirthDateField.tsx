"use client";

import { useEffect, useMemo, useState } from "react";
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
const years = Array.from({ length: 101 }, (_, index) => String(currentYear - index));

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
  const days = useMemo(() => Array.from({ length: maxDays }, (_, index) => String(index + 1)), [maxDays]);

  function updatePart(key: "day" | "month" | "year", nextValue: string) {
    const next = { ...parts, [key]: nextValue };
    const nextMaxDays = daysInMonth(next.year, next.month);

    if (Number(next.day) > nextMaxDays) {
      next.day = String(nextMaxDays);
    }

    setParts(next);

    if (next.year && next.month && next.day) {
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
        <select
          aria-label="Päivä"
          disabled={disabled}
          required={required}
          value={parts.day ? String(Number(parts.day)) : ""}
          onChange={(event) => updatePart("day", event.target.value)}
        >
          <option value="">Pv</option>
          {days.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
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
        <select
          aria-label="Vuosi"
          disabled={disabled}
          required={required}
          value={parts.year}
          onChange={(event) => updatePart("year", event.target.value)}
        >
          <option value="">Vuosi</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
