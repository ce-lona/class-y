import { createClient } from "@/lib/supabase/client";
import { formatDateDE, formatTimeShort, getIsoWeekday, toLocalISO } from "@/lib/format";
import { A4_HEIGHT, PdfDocument } from "@/lib/pdf";
import { t } from "@/i18n/de";

export type BillingScope = "company" | "mine";
export type BillingCategory = "given" | "substitution" | "cancelled" | "not_logged";

export interface BillingRow {
  row_key: string;
  session_id: string | null;
  studio_id: string;
  studio_name: string;
  course_date: string;
  start_time: string;
  end_time: string;
  duration_min: number;
  course_type_name: string;
  trainer_id: string;
  trainer_name: string;
  trainer_email: string;
  trainer_kleinunternehmer: boolean;
  category: BillingCategory;
  substituted_trainer_name: string | null;
  is_ad_hoc: boolean;
  notes: string | null;
  employment_type: string | null;
  rate_model: string | null;
  rate_amount: number | null;
  fee: number | null;
}

export interface BillingCompany {
  company_id: string;
  company_name: string;
}

export interface BillingCounts {
  given: number;
  substitution: number;
  cancelled: number;
  not_logged: number;
  /** Minuten gegebener Kurse (regulär + Vertretung). */
  minutes: number;
  /** Summe der Honorare je Kurs (ohne Festgehalt). */
  fee: number;
  /** Gegebene Kurse ohne gültigen Vertrag am Kurstag. */
  missingRate: number;
}

export interface BillingStudioGroup extends BillingCounts {
  studio_id: string;
  studio_name: string;
  rows: BillingRow[];
}

export interface BillingTrainerGroup extends BillingCounts {
  trainer_id: string;
  trainer_name: string;
  trainer_email: string;
  kleinunternehmer: boolean;
  employment_type: string | null;
  rate_model: string | null;
  rate_amount: number | null;
  /** Festgehalt (monatlich), einmal pro Trainer:in statt pro Kurs. */
  fixedAmount: number | null;
  /** Honorar je Kurs + ggf. Festgehalt. */
  total: number;
  studios: BillingStudioGroup[];
}

export interface BillingSummary extends BillingCounts {
  trainers: BillingTrainerGroup[];
  total: number;
}

// ─────────────────────────────────────────────────────────────────
// Datenzugriff
// ─────────────────────────────────────────────────────────────────

export async function getBillingExport(params: {
  companyId: string;
  month: string;
  scope: BillingScope;
}): Promise<BillingRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_billing_export", {
    target_company_id: params.companyId,
    p_month: params.month,
    p_scope: params.scope,
  });
  if (error) throw error;
  return ((data ?? []) as BillingRow[]).map((row) => ({
    ...row,
    rate_amount: row.rate_amount != null ? Number(row.rate_amount) : null,
    fee: row.fee != null ? Number(row.fee) : null,
    duration_min: Number(row.duration_min) || 0,
  }));
}

export async function getMyBillingCompanies(): Promise<BillingCompany[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_billing_companies");
  if (error) throw error;
  return (data ?? []) as BillingCompany[];
}

// ─────────────────────────────────────────────────────────────────
// Monate & Formatierung
// ─────────────────────────────────────────────────────────────────

/** Erste Tage der letzten `count` Monate inkl. aktuellem Monat, neueste zuerst (YYYY-MM-01). */
export function getRecentMonths(count = 13, now = new Date()): string[] {
  return Array.from({ length: count }, (_, i) =>
    toLocalISO(new Date(now.getFullYear(), now.getMonth() - i, 1))
  );
}

/** Standard: Vormonat, da Abrechnungen meist für den abgeschlossenen Monat erstellt werden. */
export function getDefaultBillingMonth(now = new Date()): string {
  return toLocalISO(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

export function isMonthOpen(month: string, now = new Date()): boolean {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0);
  return toLocalISO(now) <= toLocalISO(lastDay);
}

export function formatMonthDE(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1)
  );
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDecimalDE(value: number, digits = 2): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value);
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(hours);
}

function weekdayShort(isoDate: string): string {
  return t.plans.weekdaysShort[getIsoWeekday(isoDate) as keyof typeof t.plans.weekdaysShort];
}

function rateModelLabel(model: string | null): string {
  if (!model) return "";
  return t.contracts.rateModels[model as keyof typeof t.contracts.rateModels] ?? model;
}

function employmentLabel(type: string | null): string {
  if (!type) return "";
  return t.contracts.employmentTypes[type as keyof typeof t.contracts.employmentTypes] ?? type;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function rowNote(row: BillingRow): string {
  const parts: string[] = [];
  if (row.substituted_trainer_name) {
    parts.push(fill(t.billing.substitutionFor, { name: row.substituted_trainer_name }));
  }
  if (row.is_ad_hoc) parts.push(t.billing.adHoc);
  if ((row.category === "given" || row.category === "substitution") && !row.rate_model) {
    parts.push(t.billing.noContract);
  }
  if (row.notes) parts.push(row.notes);
  return parts.join(" · ");
}

// ─────────────────────────────────────────────────────────────────
// Gruppierung pro Trainer:in → Studio
// ─────────────────────────────────────────────────────────────────

function emptyCounts(): BillingCounts {
  return { given: 0, substitution: 0, cancelled: 0, not_logged: 0, minutes: 0, fee: 0, missingRate: 0 };
}

function addRow(target: BillingCounts, row: BillingRow): void {
  target[row.category] += 1;
  if (row.category === "given" || row.category === "substitution") {
    target.minutes += row.duration_min;
    if (row.fee != null) target.fee += row.fee;
    if (!row.rate_model) target.missingRate += 1;
  }
}

function addCounts(target: BillingCounts, source: BillingCounts): void {
  target.given += source.given;
  target.substitution += source.substitution;
  target.cancelled += source.cancelled;
  target.not_logged += source.not_logged;
  target.minutes += source.minutes;
  target.fee += source.fee;
  target.missingRate += source.missingRate;
}

const byName = (a: string, b: string) => a.localeCompare(b, "de", { sensitivity: "base" });

export function summarizeBilling(rows: BillingRow[]): BillingSummary {
  const trainers = new Map<string, BillingTrainerGroup>();

  for (const row of rows) {
    let trainer = trainers.get(row.trainer_id);
    if (!trainer) {
      trainer = {
        ...emptyCounts(),
        trainer_id: row.trainer_id,
        trainer_name: row.trainer_name,
        trainer_email: row.trainer_email,
        kleinunternehmer: row.trainer_kleinunternehmer,
        employment_type: row.employment_type,
        rate_model: row.rate_model,
        rate_amount: row.rate_amount,
        fixedAmount: null,
        total: 0,
        studios: [],
      };
      trainers.set(row.trainer_id, trainer);
    }
    if (trainer.rate_model == null && row.rate_model != null) {
      trainer.rate_model = row.rate_model;
      trainer.rate_amount = row.rate_amount;
      trainer.employment_type = row.employment_type;
    }
    if (row.rate_model === "fixed" && row.rate_amount != null && trainer.fixedAmount == null) {
      trainer.fixedAmount = row.rate_amount;
    }

    let studio = trainer.studios.find((s) => s.studio_id === row.studio_id);
    if (!studio) {
      studio = { ...emptyCounts(), studio_id: row.studio_id, studio_name: row.studio_name, rows: [] };
      trainer.studios.push(studio);
    }
    studio.rows.push(row);
    addRow(studio, row);
  }

  const summary: BillingSummary = { ...emptyCounts(), trainers: [], total: 0 };

  for (const trainer of trainers.values()) {
    trainer.studios.sort((a, b) => byName(a.studio_name, b.studio_name));
    for (const studio of trainer.studios) {
      studio.rows.sort((a, b) =>
        a.course_date === b.course_date
          ? a.start_time.localeCompare(b.start_time)
          : a.course_date.localeCompare(b.course_date)
      );
      addCounts(trainer, studio);
    }
    trainer.fee = round2(trainer.fee);
    trainer.total = round2(trainer.fee + (trainer.fixedAmount ?? 0));
    addCounts(summary, trainer);
    summary.total += trainer.total;
    summary.trainers.push(trainer);
  }

  summary.trainers.sort((a, b) => byName(a.trainer_name, b.trainer_name));
  summary.fee = round2(summary.fee);
  summary.total = round2(summary.total);
  return summary;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────
// CSV (Semikolon, deutsches Dezimalkomma, UTF-8 mit BOM für Excel)
// ─────────────────────────────────────────────────────────────────

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  return /[";\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(lines: (string | number | null)[][]): string {
  return "﻿" + lines.map((line) => line.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export function buildDetailCsv(summary: BillingSummary): string {
  const c = t.billing.cols;
  const lines: (string | number | null)[][] = [
    [
      c.date, c.weekday, c.start, c.end, c.duration, c.studio, c.course, c.trainer, c.email,
      c.category, c.substitutedTrainer, c.adHoc, c.employment, c.rateModel, c.rate, c.fee, c.notes,
    ],
  ];
  for (const trainer of summary.trainers) {
    for (const studio of trainer.studios) {
      for (const row of studio.rows) {
        lines.push([
          formatDateDE(row.course_date),
          weekdayShort(row.course_date),
          formatTimeShort(row.start_time),
          formatTimeShort(row.end_time),
          row.duration_min,
          row.studio_name,
          row.course_type_name,
          row.trainer_name,
          row.trainer_email,
          t.billing.categories[row.category],
          row.substituted_trainer_name,
          row.is_ad_hoc ? c.yes : c.no,
          employmentLabel(row.employment_type),
          rateModelLabel(row.rate_model),
          row.rate_amount != null ? formatDecimalDE(row.rate_amount) : null,
          row.fee != null ? formatDecimalDE(row.fee) : null,
          row.notes,
        ]);
      }
    }
  }
  return toCsv(lines);
}

export function buildSummaryCsv(summary: BillingSummary): string {
  const c = t.billing.cols;
  const lines: (string | number | null)[][] = [
    [c.trainer, c.email, c.studio, c.given, c.substitution, c.cancelled, c.notLogged, c.hours, c.fee],
  ];
  for (const trainer of summary.trainers) {
    for (const studio of trainer.studios) {
      lines.push([
        trainer.trainer_name,
        trainer.trainer_email,
        studio.studio_name,
        studio.given,
        studio.substitution,
        studio.cancelled,
        studio.not_logged,
        formatDecimalDE(studio.minutes / 60),
        formatDecimalDE(studio.fee),
      ]);
    }
    if (trainer.fixedAmount != null) {
      lines.push([
        trainer.trainer_name, trainer.trainer_email, t.billing.fixedRateRow,
        null, null, null, null, null, formatDecimalDE(trainer.fixedAmount),
      ]);
    }
  }
  lines.push([
    t.billing.totalRow, null, null,
    summary.given, summary.substitution, summary.cancelled, summary.not_logged,
    formatDecimalDE(summary.minutes / 60), formatDecimalDE(summary.total),
  ]);
  return toCsv(lines);
}

// ─────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────

const M_LEFT = 40;
const M_RIGHT = 555;
const BOTTOM = A4_HEIGHT - 60;
const HEADER_FILL = 0.93;
const MUTED = 0.4;

export function buildBillingPdf(
  summary: BillingSummary,
  meta: { month: string; companyName: string; filterLabel?: string | null }
): Uint8Array {
  const pdf = new PdfDocument();
  const monthLabel = formatMonthDE(meta.month);
  const c = t.billing.cols;
  let y = 0;

  const header = () => {
    pdf.text(M_LEFT, 50, fill(t.billing.pdfTitle, { month: monthLabel }), { size: 16, bold: true });
    pdf.text(M_RIGHT, 50, meta.companyName, { size: 10, bold: true, align: "right", maxWidth: 220 });
    pdf.text(M_LEFT, 66, fill(t.billing.generatedAt, { date: formatDateDE(toLocalISO(new Date())) }), {
      size: 8,
      color: MUTED,
    });
    if (meta.filterLabel) {
      pdf.text(M_RIGHT, 66, fill(t.billing.pdfFilter, { filter: meta.filterLabel }), {
        size: 8,
        color: MUTED,
        align: "right",
        maxWidth: 300,
      });
    }
    pdf.line(M_LEFT, 74, M_RIGHT, 74, 0.8, 0.6);
    y = 96;
  };

  const newPage = () => {
    pdf.addPage();
    header();
  };

  const ensureSpace = (needed: number, onBreak?: () => void) => {
    if (y + needed > BOTTOM) {
      newPage();
      onBreak?.();
    }
  };

  // ── Übersicht ────────────────────────────────────────────────
  const ov = { trainer: M_LEFT + 4, studio: 165, given: 305, subst: 345, canc: 390, notLogged: 435, hours: 478, fee: M_RIGHT - 4 };

  const overviewHead = () => {
    pdf.rect(M_LEFT, y - 11, M_RIGHT - M_LEFT, 16, HEADER_FILL);
    pdf.text(ov.trainer, y, c.trainer, { size: 8, bold: true });
    pdf.text(ov.studio, y, c.studio, { size: 8, bold: true });
    pdf.text(ov.given, y, c.givenShort, { size: 8, bold: true, align: "right" });
    pdf.text(ov.subst, y, c.substitutionShort, { size: 8, bold: true, align: "right" });
    pdf.text(ov.canc, y, c.cancelledShort, { size: 8, bold: true, align: "right" });
    pdf.text(ov.notLogged, y, c.notLoggedShort, { size: 8, bold: true, align: "right" });
    pdf.text(ov.hours, y, c.hoursShort, { size: 8, bold: true, align: "right" });
    pdf.text(ov.fee, y, c.feeShort, { size: 8, bold: true, align: "right" });
    y += 18;
  };

  const overviewLine = (
    trainerLabel: string,
    studioLabel: string,
    counts: BillingCounts | null,
    amount: number,
    bold = false
  ) => {
    ensureSpace(14, overviewHead);
    pdf.text(ov.trainer, y, trainerLabel, { size: 8.5, bold, maxWidth: ov.studio - ov.trainer - 8 });
    pdf.text(ov.studio, y, studioLabel, { size: 8.5, bold, maxWidth: ov.given - ov.studio - 24 });
    if (counts) {
      pdf.text(ov.given, y, String(counts.given), { size: 8.5, bold, align: "right" });
      pdf.text(ov.subst, y, String(counts.substitution), { size: 8.5, bold, align: "right" });
      pdf.text(ov.canc, y, String(counts.cancelled), { size: 8.5, bold, align: "right" });
      pdf.text(ov.notLogged, y, String(counts.not_logged), { size: 8.5, bold, align: "right" });
      pdf.text(ov.hours, y, formatHours(counts.minutes), { size: 8.5, bold, align: "right" });
    }
    pdf.text(ov.fee, y, formatEuro(amount), { size: 8.5, bold, align: "right" });
    y += 14;
  };

  header();
  pdf.text(M_LEFT, y, t.billing.pdfOverview, { size: 11, bold: true });
  y += 20;
  overviewHead();

  for (const trainer of summary.trainers) {
    trainer.studios.forEach((studio, idx) => {
      overviewLine(idx === 0 ? trainer.trainer_name : "", studio.studio_name, studio, studio.fee);
    });
    if (trainer.fixedAmount != null) {
      overviewLine("", t.billing.fixedRateRow, null, trainer.fixedAmount);
    }
    if (trainer.studios.length > 1 || trainer.fixedAmount != null) {
      overviewLine("", t.billing.subtotalRow, trainer, trainer.total, true);
    }
    pdf.line(M_LEFT, y - 9, M_RIGHT, y - 9, 0.4, 0.85);
    y += 2;
  }
  ensureSpace(20);
  pdf.line(M_LEFT, y - 9, M_RIGHT, y - 9, 0.8, 0.3);
  y += 2;
  overviewLine(t.billing.totalRow, "", summary, summary.total, true);

  y += 10;
  ensureSpace(30);
  pdf.text(M_LEFT, y, t.billing.pdfDisclaimer, { size: 7.5, color: MUTED, maxWidth: M_RIGHT - M_LEFT });
  y += 11;
  if (summary.trainers.some((tr) => tr.fixedAmount != null)) {
    pdf.text(M_LEFT, y, t.billing.hintFixed, { size: 7.5, color: MUTED, maxWidth: M_RIGHT - M_LEFT });
  }

  // ── Einzelaufstellung pro Trainer:in ─────────────────────────
  const col = { date: M_LEFT + 4, time: 100, course: 165, category: 285, note: 350, duration: 505, fee: M_RIGHT - 4 };

  const detailHead = () => {
    pdf.rect(M_LEFT, y - 11, M_RIGHT - M_LEFT, 16, HEADER_FILL);
    pdf.text(col.date, y, c.date, { size: 8, bold: true });
    pdf.text(col.time, y, c.time, { size: 8, bold: true });
    pdf.text(col.course, y, c.course, { size: 8, bold: true });
    pdf.text(col.category, y, c.category, { size: 8, bold: true });
    pdf.text(col.note, y, c.note, { size: 8, bold: true });
    pdf.text(col.duration, y, c.durationShort, { size: 8, bold: true, align: "right" });
    pdf.text(col.fee, y, c.feeShort, { size: 8, bold: true, align: "right" });
    y += 18;
  };

  for (const trainer of summary.trainers) {
    newPage();
    pdf.text(M_LEFT, y, trainer.trainer_name, { size: 13, bold: true, maxWidth: 330 });
    pdf.text(M_RIGHT, y, formatEuro(trainer.total), { size: 13, bold: true, align: "right" });
    y += 15;
    pdf.text(M_LEFT, y, trainer.trainer_email, { size: 8.5, color: MUTED });
    y += 12;
    const info: string[] = [];
    if (trainer.employment_type) {
      info.push(fill(t.billing.pdfEmployment, { type: employmentLabel(trainer.employment_type) }));
    }
    if (trainer.rate_model) {
      const rate =
        trainer.rate_amount != null
          ? `${formatEuro(trainer.rate_amount)} ${rateModelLabel(trainer.rate_model)}`
          : rateModelLabel(trainer.rate_model);
      info.push(fill(t.billing.pdfRate, { rate }));
    }
    if (trainer.kleinunternehmer) info.push(t.billing.kleinunternehmer);
    if (info.length > 0) {
      pdf.text(M_LEFT, y, info.join("  ·  "), { size: 8.5, color: MUTED, maxWidth: M_RIGHT - M_LEFT });
      y += 12;
    }
    y += 10;

    for (const studio of trainer.studios) {
      ensureSpace(60);
      pdf.text(M_LEFT, y, studio.studio_name, { size: 10.5, bold: true });
      y += 16;
      detailHead();

      for (const row of studio.rows) {
        ensureSpace(13, detailHead);
        const muted = row.category === "cancelled" || row.category === "not_logged";
        const color = muted ? MUTED : 0;
        pdf.text(col.date, y, `${weekdayShort(row.course_date)} ${formatDateDE(row.course_date)}`, { size: 8, color });
        pdf.text(col.time, y, `${formatTimeShort(row.start_time)}–${formatTimeShort(row.end_time)}`, { size: 8, color });
        pdf.text(col.course, y, row.course_type_name, { size: 8, color, maxWidth: col.category - col.course - 6 });
        pdf.text(col.category, y, t.billing.categories[row.category], { size: 8, color, maxWidth: col.note - col.category - 6 });
        pdf.text(col.note, y, rowNote(row), { size: 7.5, color: MUTED, maxWidth: col.duration - col.note - 30 });
        pdf.text(col.duration, y, `${row.duration_min} ${t.billing.minutesUnit}`, { size: 8, color, align: "right" });
        pdf.text(col.fee, y, row.fee != null ? formatEuro(row.fee) : "–", { size: 8, color, align: "right" });
        y += 13;
      }

      ensureSpace(16);
      pdf.line(M_LEFT, y - 9, M_RIGHT, y - 9, 0.4, 0.75);
      y += 2;
      const label = `${t.billing.subtotalRow} ${studio.studio_name}`;
      pdf.text(col.date, y, label, { size: 8.5, bold: true, maxWidth: col.note - col.date });
      pdf.text(
        col.note,
        y,
        `${studio.given + studio.substitution} × · ${formatHours(studio.minutes)} ${t.billing.hoursUnit}`,
        { size: 8, color: MUTED }
      );
      pdf.text(col.fee, y, formatEuro(studio.fee), { size: 8.5, bold: true, align: "right" });
      y += 22;
    }

    if (trainer.fixedAmount != null) {
      ensureSpace(16);
      pdf.text(col.date, y, t.billing.fixedRateRow, { size: 8.5, bold: true });
      pdf.text(col.fee, y, formatEuro(trainer.fixedAmount), { size: 8.5, bold: true, align: "right" });
      y += 18;
    }

    ensureSpace(20);
    pdf.line(M_LEFT, y - 10, M_RIGHT, y - 10, 0.8, 0.3);
    pdf.text(col.date, y + 2, t.billing.totalRow, { size: 10, bold: true });
    pdf.text(col.fee, y + 2, formatEuro(trainer.total), { size: 10, bold: true, align: "right" });
    y += 20;
  }

  // ── Fußzeilen mit Seitenzahlen ───────────────────────────────
  const pages = pdf.pageCount;
  for (let i = 0; i < pages; i++) {
    pdf.goToPage(i);
    pdf.text(M_RIGHT, A4_HEIGHT - 30, fill(t.billing.page, { page: i + 1, pages }), {
      size: 7.5,
      color: MUTED,
      align: "right",
    });
    pdf.text(M_LEFT, A4_HEIGHT - 30, `class-y · ${meta.companyName}`, { size: 7.5, color: MUTED, maxWidth: 300 });
  }

  return pdf.toBytes();
}

// ─────────────────────────────────────────────────────────────────
// Download
// ─────────────────────────────────────────────────────────────────

export function billingFileName(month: string, label: string, suffix: string, ext: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const parts = ["abrechnung", month.slice(0, 7), slug, suffix].filter(Boolean);
  return `${parts.join("_")}.${ext}`;
}

export function downloadFile(content: string | Uint8Array, fileName: string, mimeType: string): void {
  const part: BlobPart = typeof content === "string" ? content : (content.slice().buffer as ArrayBuffer);
  const blob = new Blob([part], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
