"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRange, periodLabel, type Period, type PeriodUnit } from "@/lib/period";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const units: { value: PeriodUnit; label: string }[] = [
  { value: "week", label: t.period.week },
  { value: "month", label: t.period.month },
  { value: "quarter", label: t.period.quarter },
  { value: "year", label: t.period.year },
  { value: "custom", label: t.period.custom },
];

/**
 * Zeitraum-Steuerung: Woche/Monat/Quartal/Jahr mit ‹ › (unbegrenzt zurück) oder eigener Zeitraum.
 */
export function PeriodControl({
  value,
  onChange,
  className,
}: {
  value: Period;
  onChange: (period: Period) => void;
  className?: string;
}) {
  function changeUnit(unit: PeriodUnit) {
    if (unit === "custom") {
      const range = getRange(value);
      onChange({ unit, offset: 0, from: range.from, to: range.to });
    } else {
      onChange({ unit, offset: 0 });
    }
  }

  const buttonClass =
    "grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-muted";

  return (
    <div
      role="group"
      aria-label={t.period.label}
      data-testid="period-control"
      className={cn(
        "inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card p-0.5",
        className,
      )}
    >
      <select
        aria-label={t.period.label}
        value={value.unit}
        onChange={(e) => changeUnit(e.target.value as PeriodUnit)}
        className="h-7 w-auto rounded-md border-0 bg-muted px-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {units.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
      {value.unit === "custom" ? (
        <>
          <input
            type="date"
            aria-label={t.period.from}
            value={value.from ?? ""}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
            className="h-7 rounded-md border border-border bg-card px-1.5 text-sm"
          />
          <span className="px-1 text-sm text-muted-foreground">–</span>
          <input
            type="date"
            aria-label={t.period.to}
            value={value.to ?? ""}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
            className="h-7 rounded-md border border-border bg-card px-1.5 text-sm"
          />
        </>
      ) : (
        <>
          <button
            type="button"
            aria-label={t.period.prev}
            onClick={() => onChange({ ...value, offset: value.offset - 1 })}
            className={buttonClass}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            className="px-2 text-sm font-bold whitespace-nowrap tabular-nums"
            data-testid="period-label"
          >
            {periodLabel(value)}
          </span>
          <button
            type="button"
            aria-label={t.period.next}
            onClick={() => onChange({ ...value, offset: value.offset + 1 })}
            className={buttonClass}
          >
            <ChevronRight className="size-4" />
          </button>
          {value.offset !== 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...value, offset: 0 })}
              className={buttonClass}
            >
              {t.period.today}
            </button>
          )}
        </>
      )}
    </div>
  );
}
