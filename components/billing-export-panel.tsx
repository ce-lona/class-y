"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, FileSpreadsheet, FileText, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBillingExport } from "@/hooks/useBillingExport";
import {
  billingFileName,
  buildBillingPdf,
  buildDetailCsv,
  buildSummaryCsv,
  downloadFile,
  formatEuro,
  formatHours,
  formatMonthDE,
  getDefaultBillingMonth,
  getRecentMonths,
  isMonthOpen,
  summarizeBilling,
  type BillingScope,
} from "@/lib/billingExport";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const ALL = "all";

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("not_authorized") ? t.billing.errors.not_authorized : t.billing.errors.generic;
}

export function BillingExportPanel({
  scope,
  companyId,
  companyName,
  extraControls,
}: {
  scope: BillingScope;
  companyId: string;
  companyName: string;
  /** Zusätzliche Auswahl links neben den Filtern, z.B. Company-Wahl für Trainer:innen. */
  extraControls?: ReactNode;
}) {
  const months = useMemo(() => getRecentMonths(13), []);
  const [month, setMonth] = useState<string>(() => getDefaultBillingMonth());
  const [studioFilter, setStudioFilter] = useState<string>(ALL);
  const [trainerFilter, setTrainerFilter] = useState<string>(ALL);

  const { data, isLoading, isError, error } = useBillingExport({ companyId, month, scope });
  const allRows = useMemo(() => data ?? [], [data]);

  const studioOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRows) map.set(r.studio_id, r.studio_name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "de")
    );
  }, [allRows]);

  const trainerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRows) map.set(r.trainer_id, r.trainer_name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "de")
    );
  }, [allRows]);

  // Filter, die im gewählten Monat nicht mehr vorkommen, fallen auf "Alle" zurück.
  const activeStudio = studioOptions.some((s) => s.id === studioFilter) ? studioFilter : ALL;
  const activeTrainer = trainerOptions.some((tr) => tr.id === trainerFilter) ? trainerFilter : ALL;

  const filteredRows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          (activeStudio === ALL || r.studio_id === activeStudio) &&
          (activeTrainer === ALL || r.trainer_id === activeTrainer)
      ),
    [allRows, activeStudio, activeTrainer]
  );

  const summary = useMemo(() => summarizeBilling(filteredRows), [filteredRows]);
  const monthOpen = isMonthOpen(month);
  const hasFixed = summary.trainers.some((tr) => tr.fixedAmount != null);

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      activeStudio === ALL
        ? t.billing.allStudios
        : studioOptions.find((s) => s.id === activeStudio)?.name ?? ""
    );
    if (scope === "company") {
      parts.push(
        activeTrainer === ALL
          ? t.billing.allTrainers
          : trainerOptions.find((tr) => tr.id === activeTrainer)?.name ?? ""
      );
    }
    return parts.filter(Boolean).join(" · ");
  }, [activeStudio, activeTrainer, scope, studioOptions, trainerOptions]);

  const fileLabel = useMemo(() => {
    const parts = [companyName];
    if (scope === "mine" && summary.trainers[0]) parts.push(summary.trainers[0].trainer_name);
    if (activeTrainer !== ALL) parts.push(trainerOptions.find((tr) => tr.id === activeTrainer)?.name ?? "");
    if (activeStudio !== ALL) parts.push(studioOptions.find((s) => s.id === activeStudio)?.name ?? "");
    return parts.filter(Boolean).join("-");
  }, [activeStudio, activeTrainer, companyName, scope, studioOptions, summary.trainers, trainerOptions]);

  const canExport = !isLoading && !isError && filteredRows.length > 0;

  function exportDetailCsv() {
    downloadFile(
      buildDetailCsv(summary),
      billingFileName(month, fileLabel, "kurse", "csv"),
      "text/csv;charset=utf-8"
    );
  }

  function exportSummaryCsv() {
    downloadFile(
      buildSummaryCsv(summary),
      billingFileName(month, fileLabel, "summen", "csv"),
      "text/csv;charset=utf-8"
    );
  }

  function exportPdf() {
    downloadFile(
      buildBillingPdf(summary, { month, companyName, filterLabel }),
      billingFileName(month, fileLabel, "", "pdf"),
      "application/pdf"
    );
  }

  const kpis = [
    { label: t.billing.kpiGiven, value: String(summary.given), className: "text-success" },
    { label: t.billing.kpiSubstitution, value: String(summary.substitution), className: "text-foreground" },
    { label: t.billing.kpiCancelled, value: String(summary.cancelled), className: "text-destructive" },
    { label: t.billing.kpiFee, value: formatEuro(summary.total), className: "text-foreground" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-[28px] font-extrabold tracking-tight">{t.billing.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === "company" ? t.billing.subtitleCompany : t.billing.subtitleTrainer}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {extraControls}

          <Select value={month} onValueChange={(v) => v && setMonth(v)}>
            <SelectTrigger aria-label={t.billing.monthLabel} className="min-w-40">
              <SelectValue>{(value: string) => formatMonthDE(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonthDE(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {studioOptions.length > 1 && (
            <Select value={activeStudio} onValueChange={(v) => v && setStudioFilter(v)}>
              <SelectTrigger aria-label={t.billing.studioLabel} className="min-w-44">
                <SelectValue>
                  {(value: string) =>
                    value === ALL
                      ? t.billing.allStudios
                      : studioOptions.find((s) => s.id === value)?.name ?? t.billing.allStudios
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.billing.allStudios}</SelectItem>
                {studioOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {scope === "company" && trainerOptions.length > 1 && (
            <Select value={activeTrainer} onValueChange={(v) => v && setTrainerFilter(v)}>
              <SelectTrigger aria-label={t.billing.trainerLabel} className="min-w-44">
                <SelectValue>
                  {(value: string) =>
                    value === ALL
                      ? t.billing.allTrainers
                      : trainerOptions.find((tr) => tr.id === value)?.name ?? t.billing.allTrainers
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.billing.allTrainers}</SelectItem>
                {trainerOptions.map((tr) => (
                  <SelectItem key={tr.id} value={tr.id}>
                    {tr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex flex-col rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-semibold text-muted-foreground">{kpi.label}</span>
            <span className={cn("mt-2 font-heading text-2xl font-extrabold tabular-nums sm:text-3xl", kpi.className)}>
              {isLoading ? "–" : kpi.value}
            </span>
          </div>
        ))}
      </div>

      {(monthOpen || summary.not_logged > 0 || summary.missingRate > 0) && !isLoading && !isError && (
        <div className="space-y-2">
          {monthOpen && (
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              {t.billing.warnMonthOpen}
            </p>
          )}
          {summary.not_logged > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {fill(t.billing.warnNotLogged, { count: summary.not_logged })}
            </p>
          )}
          {summary.missingRate > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {fill(t.billing.warnMissingRate, { count: summary.missingRate })}
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>
        ) : isError ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : filteredRows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {allRows.length === 0 ? t.billing.empty : t.billing.emptyFilter}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {scope === "company" && <TableHead>{t.billing.cols.trainer}</TableHead>}
                  <TableHead>{t.billing.cols.studio}</TableHead>
                  <TableHead className="text-right">{t.billing.cols.given}</TableHead>
                  <TableHead className="text-right">{t.billing.cols.substitution}</TableHead>
                  <TableHead className="text-right">{t.billing.cols.cancelled}</TableHead>
                  <TableHead className="text-right">{t.billing.cols.notLogged}</TableHead>
                  <TableHead className="text-right">{t.billing.cols.hours}</TableHead>
                  <TableHead className="text-right">{t.billing.cols.feeShort}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.trainers.flatMap((trainer) => {
                  const lines = trainer.studios.map((studio, idx) => (
                    <TableRow key={`${trainer.trainer_id}:${studio.studio_id}`}>
                      {scope === "company" && (
                        <TableCell className="font-semibold">
                          {idx === 0 ? trainer.trainer_name : ""}
                        </TableCell>
                      )}
                      <TableCell>{studio.studio_name}</TableCell>
                      <TableCell className="text-right tabular-nums text-success">{studio.given}</TableCell>
                      <TableCell className="text-right tabular-nums">{studio.substitution}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {studio.cancelled}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          studio.not_logged > 0 ? "text-warning" : "text-muted-foreground"
                        )}
                      >
                        {studio.not_logged}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatHours(studio.minutes)} {t.billing.hoursUnit}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatEuro(studio.fee)}
                      </TableCell>
                    </TableRow>
                  ));
                  if (trainer.fixedAmount != null) {
                    lines.push(
                      <TableRow key={`${trainer.trainer_id}:fixed`}>
                        {scope === "company" && <TableCell />}
                        <TableCell className="text-muted-foreground" colSpan={6}>
                          {t.billing.fixedRateRow}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatEuro(trainer.fixedAmount)}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return lines;
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold" colSpan={scope === "company" ? 2 : 1}>
                    {t.billing.totalRow}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{summary.given}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{summary.substitution}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{summary.cancelled}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{summary.not_logged}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatHours(summary.minutes)} {t.billing.hoursUnit}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{formatEuro(summary.total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button onClick={exportPdf} disabled={!canExport}>
          <FileText className="size-4" />
          {t.billing.exportPdf}
        </Button>
        <Button variant="outline" onClick={exportDetailCsv} disabled={!canExport}>
          <FileSpreadsheet className="size-4" />
          {t.billing.exportCsv}
        </Button>
        <Button variant="outline" onClick={exportSummaryCsv} disabled={!canExport}>
          <FileSpreadsheet className="size-4" />
          {t.billing.exportCsvSummary}
        </Button>
        <span className="text-xs text-muted-foreground">{t.billing.exportHint}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.billing.hintCancelled}
        {hasFixed ? ` ${t.billing.hintFixed}` : ""}
      </p>
    </div>
  );
}
