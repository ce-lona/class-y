import { fillTemplate, toLocalISO } from "@/lib/format";
import { t } from "@/i18n/de";

export type PeriodUnit = "week" | "month" | "quarter" | "year" | "custom";

/** Zeitraum relativ zu heute: offset 0 = aktuelle Woche/Monat/…, -1 = davor (unbegrenzt zurück). */
export interface Period {
  unit: PeriodUnit;
  offset: number;
  /** Nur für unit "custom" (ISO-Datum). */
  from?: string;
  to?: string;
}

export const DEFAULT_PERIOD: Period = { unit: "week", offset: 0 };

function mondayOf(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
}

/** ISO-Kalenderwoche nach DIN 1355 / ISO 8601. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function bounds(period: Period, now = new Date()): { start: Date; end: Date } {
  switch (period.unit) {
    case "week": {
      const start = mondayOf(now);
      start.setDate(start.getDate() + 7 * period.offset);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth() + period.offset, 1);
      return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 0) };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3) + period.offset;
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { start, end: new Date(start.getFullYear(), start.getMonth() + 3, 0) };
    }
    case "year": {
      const start = new Date(now.getFullYear() + period.offset, 0, 1);
      return { start, end: new Date(start.getFullYear(), 11, 31) };
    }
    case "custom": {
      const today = toLocalISO(now);
      const from = period.from ?? today;
      const to = period.to && period.to >= from ? period.to : from;
      const [fy, fm, fd] = from.split("-").map(Number);
      const [ty, tm, td] = to.split("-").map(Number);
      return { start: new Date(fy, fm - 1, fd), end: new Date(ty, tm - 1, td) };
    }
  }
}

export function getRange(period: Period, now = new Date()): { from: string; to: string } {
  const { start, end } = bounds(period, now);
  return { from: toLocalISO(start), to: toLocalISO(end) };
}

const dm = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
const dmy = (d: Date) => `${dm(d)}${d.getFullYear()}`;

export function periodLabel(period: Period, now = new Date()): string {
  const { start, end } = bounds(period, now);
  switch (period.unit) {
    case "week": {
      const label = fillTemplate(t.period.weekLabel, {
        week: isoWeek(start),
        from: dm(start),
        to: dm(end),
      });
      return start.getFullYear() === now.getFullYear() ? label : `${label}${end.getFullYear()}`;
    }
    case "month":
      return `${t.period.months[start.getMonth()]} ${start.getFullYear()}`;
    case "quarter":
      return fillTemplate(t.period.quarterLabel, {
        quarter: Math.floor(start.getMonth() / 3) + 1,
        year: start.getFullYear(),
      });
    case "year":
      return String(start.getFullYear());
    case "custom":
      return `${dmy(start)}–${dmy(end)}`;
  }
}
