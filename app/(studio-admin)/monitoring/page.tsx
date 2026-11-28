"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, List, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStudioFilter } from "@/hooks/useStudioFilter";
import { PeriodControl } from "@/components/period-control";
import { DEFAULT_PERIOD, getRange, type Period } from "@/lib/period";
import { useCompanyMonitoring } from "@/hooks/useMonitoring";
import {
  summarizeByTrainer,
  type MonitoringRow,
  type MonitoringStatus,
} from "@/lib/monitoring";
import {
  fillTemplate,
  formatShortDayMonth,
  formatTimeShort,
  getInitials,
  getIsoWeekday,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { SearchInput, matchesSearch } from "@/components/list-toolbar";
import { t } from "@/i18n/de";

type MonitoringTab = "courses" | "trainers";


const statusStyles: Record<MonitoringStatus, { badge: string; dot: string }> = {
  completed: {
    badge: "bg-success-bg text-success",
    dot: "bg-success",
  },
  overdue: {
    badge: "bg-warning-bg text-warning",
    dot: "bg-warning",
  },
  planned: {
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/70",
  },
  cancelled: {
    badge: "bg-destructive-bg text-destructive",
    dot: "bg-destructive",
  },
};

function MonitoringStatusBadge({ status }: { status: MonitoringStatus }) {
  const style = statusStyles[status];
  return (
    <Badge className={cn("gap-1.5", style.badge)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden="true" />
      <span>{t.monitoring.status[status]}</span>
    </Badge>
  );
}

function formatCurrencyDE(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function formatHoursDE(minutes: number): string {
  const hours = minutes / 60;
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: hours % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(hours)} ${t.monitoring.hoursUnit}`;
}

function formatCourseDateCell(row: MonitoringRow): string {
  const wd =
    t.plans.weekdaysShort[getIsoWeekday(row.course_date) as keyof typeof t.plans.weekdaysShort];
  return `${wd} ${formatShortDayMonth(row.course_date)} · ${formatTimeShort(row.start_time)}`;
}

type StatusFilter = "all" | MonitoringStatus | "substitutions";
const STATUS_FILTERS: StatusFilter[] = ["all", "completed", "overdue", "planned", "cancelled", "substitutions"];

function isStatusFilter(value: string | null): value is StatusFilter {
  return !!value && (STATUS_FILTERS as string[]).includes(value);
}

const chipLabel: Record<StatusFilter, string> = {
  all: t.courses.chipAll,
  completed: t.courses.chipCompleted,
  overdue: t.courses.chipOverdue,
  planned: t.courses.chipPlanned,
  cancelled: t.courses.chipCancelled,
  substitutions: t.courses.chipSubstitutions,
};

const chipDot: Partial<Record<StatusFilter, string>> = {
  completed: "bg-success",
  overdue: "bg-warning",
  planned: "bg-muted-foreground",
  cancelled: "bg-destructive",
  substitutions: "bg-link-500",
};

export default function MonitoringPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{t.common.loading}</p>}>
      <CoursesView />
    </Suspense>
  );
}

/** „Kurse“ (bisher Monitoring): Status-Chips mit Zahlen, Zeitraum-Steuerung, Kurse | Pro Trainer:in. */
function CoursesView() {
  const searchParams = useSearchParams();
  const { companyId, queryStudioId, scopeLabel } = useStudioFilter();

  const statusParam = searchParams.get("status");
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [kpiFilter, setKpiFilter] = useState<StatusFilter>(
    isStatusFilter(statusParam) ? statusParam : "all"
  );
  const [tab, setTab] = useState<MonitoringTab>(
    searchParams.get("view") === "trainers" ? "trainers" : "courses"
  );
  const [search, setSearch] = useState("");

  const range = useMemo(() => getRange(period), [period]);
  const { data: rows, isLoading, isError } = useCompanyMonitoring({
    companyId,
    from: range.from,
    to: range.to,
    studioId: queryStudioId,
  });

  const allRows = useMemo(() => rows ?? [], [rows]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: allRows.length,
      completed: 0,
      overdue: 0,
      planned: 0,
      cancelled: 0,
      substitutions: 0,
    };
    for (const r of allRows) {
      c[r.status] += 1;
      if (r.is_substitution) c.substitutions += 1;
    }
    return c;
  }, [allRows]);

  const filteredRows = useMemo(() => {
    let result = allRows;
    if (kpiFilter === "substitutions") result = result.filter((r) => r.is_substitution);
    else if (kpiFilter !== "all") result = result.filter((r) => r.status === kpiFilter);
    result = result.filter((r) =>
      matchesSearch(
        search,
        r.course_type_name,
        r.trainer_name,
        r.trainer_email,
        r.studio_name,
        r.scheduled_trainer_name,
        r.notes
      )
    );
    // Noch nicht bestätigte (überfällige) Kurse zuerst, damit sie geprüft werden.
    return [...result].sort((a, b) => {
      const aOver = a.status === "overdue" ? 0 : 1;
      const bOver = b.status === "overdue" ? 0 : 1;
      return aOver - bOver;
    });
  }, [allRows, kpiFilter, search]);

  const trainerSummaries = useMemo(
    () =>
      summarizeByTrainer(allRows).filter((tr) =>
        matchesSearch(search, tr.trainer_name, tr.trainer_email)
      ),
    [allRows, search]
  );

  const trainerTotals = useMemo(() => {
    let completed = 0;
    let overdue = 0;
    let substitutions = 0;
    let minutes = 0;
    let estimatedTotal = 0;
    let hasAnyEstimate = false;

    for (const tr of trainerSummaries) {
      completed += tr.completedCount;
      overdue += tr.overdueCount;
      substitutions += tr.substitutionCount;
      minutes += tr.completedMinutes;
      if (tr.estimatedAmount != null) {
        estimatedTotal += tr.estimatedAmount;
        hasAnyEstimate = true;
      }
    }
    return { completed, overdue, substitutions, minutes, estimatedTotal, hasAnyEstimate };
  }, [trainerSummaries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="min-w-64 flex-1">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">{t.courses.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fillTemplate(t.courses.subtitle, { scope: scopeLabel })}
          </p>
        </div>
        <PeriodControl value={period} onChange={setPeriod} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div role="group" aria-label={t.monitoring.colStatus} className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((id) => {
            const active = kpiFilter === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTab("courses");
                  setKpiFilter(id);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground/80 hover:border-muted-foreground"
                )}
              >
                {chipDot[id] && (
                  <span className={cn("size-2 rounded-full", chipDot[id])} aria-hidden="true" />
                )}
                <span>{chipLabel[id]}</span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    active ? "text-background/75" : "text-muted-foreground"
                  )}
                >
                  {counts[id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t.monitoring.searchPlaceholder}
          />
          <div role="tablist" className="inline-flex rounded-[9px] border border-border bg-card p-0.5">
            {(
              [
                { key: "courses", label: t.courses.viewCourses, Icon: List },
                { key: "trainers", label: t.courses.viewTrainers, Icon: Users },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
                  tab === key
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      {tab === "courses" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>
          ) : isError ? (
            <p className="p-6 text-sm text-destructive">{t.common.error}</p>
          ) : filteredRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.monitoring.colDate}</TableHead>
                  <TableHead>{t.monitoring.colCourse}</TableHead>
                  <TableHead>{t.monitoring.colStudio}</TableHead>
                  <TableHead>{t.monitoring.colTrainer}</TableHead>
                  <TableHead>{t.monitoring.colStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.row_key}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatCourseDateCell(row)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-foreground">
                            {row.course_type_name}
                          </span>
                          {row.is_ad_hoc && (
                            <Badge variant="outline" className="text-[11px]">
                              {t.trainer.adHocBadge}
                            </Badge>
                          )}
                        </div>
                        {row.notes && (
                          <p className="max-w-xs truncate text-xs text-muted-foreground">
                            {row.notes}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0 text-muted-foreground/70" />
                        <span>{row.studio_name}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
                          {getInitials(row.trainer_name, row.trainer_email)}
                        </span>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">
                            {row.trainer_name || row.trainer_email}
                          </span>
                          {row.is_substitution && (
                            <span className="ml-1.5 text-xs font-semibold text-link-600 dark:text-link-400">
                              (
                              {row.scheduled_trainer_name
                                ? `${t.trainer.substitutionFor} ${row.scheduled_trainer_name}`
                                : t.trainer.substitutionBadge}
                              )
                            </span>
                          )}
                          {row.pending_substitute_name && (
                            <span className="mt-0.5 block text-xs font-semibold text-warning">
                              {t.monitoring.pendingSubstitutionBadge}: {row.pending_substitute_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <MonitoringStatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <LayoutGrid className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {kpiFilter === "all" && !search.trim()
                  ? t.monitoring.emptyCourses
                  : t.monitoring.emptyFilter}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>
            ) : isError ? (
              <p className="p-6 text-sm text-destructive">{t.common.error}</p>
            ) : trainerSummaries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.monitoring.colTrainer}</TableHead>
                    <TableHead className="text-right">{t.monitoring.colCompleted}</TableHead>
                    <TableHead className="text-right">{t.monitoring.colOverdue}</TableHead>
                    <TableHead className="text-right">{t.monitoring.colSubstitutions}</TableHead>
                    <TableHead className="text-right">{t.monitoring.colHours}</TableHead>
                    <TableHead className="text-right">{t.monitoring.colEstimate}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainerSummaries.map((tr) => {
                    const employmentLabel = tr.employment_type
                      ? t.contracts.employmentTypes[
                          tr.employment_type as keyof typeof t.contracts.employmentTypes
                        ] ?? tr.employment_type
                      : null;

                    return (
                      <TableRow key={tr.trainer_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
                              {getInitials(tr.trainer_name, tr.trainer_email)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">
                                {tr.trainer_name || tr.trainer_email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {employmentLabel ?? tr.trainer_email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-success tabular-nums">
                          {tr.completedCount}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            tr.overdueCount > 0 ? "text-warning" : "text-muted-foreground"
                          )}
                        >
                          {tr.overdueCount}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {tr.substitutionCount}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatHoursDE(tr.completedMinutes)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {tr.estimatedAmount != null ? (
                            tr.isFixedRate ? (
                              <span>
                                {t.contracts.rateModels.fixed} ·{" "}
                                {formatCurrencyDE(tr.estimatedAmount)}
                              </span>
                            ) : (
                              formatCurrencyDE(tr.estimatedAmount)
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">{t.monitoring.totalRow}</TableCell>
                    <TableCell className="text-right font-bold text-success tabular-nums">
                      {trainerTotals.completed}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {trainerTotals.overdue}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {trainerTotals.substitutions}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatHoursDE(trainerTotals.minutes)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {trainerTotals.hasAnyEstimate
                        ? formatCurrencyDE(trainerTotals.estimatedTotal)
                        : "—"}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            ) : (
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <Users className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t.monitoring.emptyTrainers}</p>
              </div>
            )}
          </div>

          {trainerSummaries.length > 0 && (
            <p className="text-xs text-muted-foreground">{t.monitoring.estimateHint}</p>
          )}
        </div>
      )}
    </div>
  );
}
