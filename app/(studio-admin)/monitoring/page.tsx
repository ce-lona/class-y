"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  LayoutGrid,
  MapPin,
  Repeat,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useStudios } from "@/hooks/useStudios";
import { useCompanyMonitoring } from "@/hooks/useMonitoring";
import {
  getPeriodRange,
  summarizeByTrainer,
  type MonitoringPeriod,
  type MonitoringRow,
  type MonitoringStatus,
} from "@/lib/monitoring";
import {
  formatDateDE,
  formatShortDayMonth,
  formatTimeShort,
  getInitials,
  getIsoWeekday,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

type KpiFilter = "all" | "completed" | "overdue" | "substitutions";
type MonitoringTab = "courses" | "trainers";

const PERIOD_OPTIONS: MonitoringPeriod[] = [
  "this_week",
  "last_week",
  "this_month",
  "last_month",
];

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

export default function MonitoringPage() {
  const { data: company } = useMyCompany();
  const companyId = company?.id ?? "";
  const { data: studios } = useStudios(companyId);

  const [period, setPeriod] = useState<MonitoringPeriod>("this_week");
  const [studioFilter, setStudioFilter] = useState<string>("all");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>("all");
  const [tab, setTab] = useState<MonitoringTab>("courses");

  const range = useMemo(() => getPeriodRange(period), [period]);
  const { data: rows, isLoading, isError } = useCompanyMonitoring({
    companyId,
    from: range.from,
    to: range.to,
    studioId: studioFilter === "all" ? null : studioFilter,
  });

  const allRows = useMemo(() => rows ?? [], [rows]);

  const kpis = useMemo(() => {
    let completed = 0;
    let overdue = 0;
    let substitutions = 0;
    for (const r of allRows) {
      if (r.status === "completed") completed += 1;
      if (r.status === "overdue") overdue += 1;
      if (r.is_substitution) substitutions += 1;
    }
    return {
      total: allRows.length,
      completed,
      overdue,
      substitutions,
    };
  }, [allRows]);

  const filteredRows = useMemo(() => {
    if (kpiFilter === "completed") return allRows.filter((r) => r.status === "completed");
    if (kpiFilter === "overdue") return allRows.filter((r) => r.status === "overdue");
    if (kpiFilter === "substitutions") return allRows.filter((r) => r.is_substitution);
    return allRows;
  }, [allRows, kpiFilter]);

  const trainerSummaries = useMemo(() => summarizeByTrainer(allRows), [allRows]);

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

  const kpiCards: {
    id: KpiFilter;
    label: string;
    value: number;
    icon: typeof Calendar;
    valueClass: string;
    iconClass: string;
  }[] = [
    {
      id: "all",
      label: t.monitoring.kpiTotal,
      value: kpis.total,
      icon: Calendar,
      valueClass: "text-foreground",
      iconClass: "bg-primary-50 text-primary dark:bg-primary-900/40",
    },
    {
      id: "completed",
      label: t.monitoring.kpiCompleted,
      value: kpis.completed,
      icon: CheckCircle2,
      valueClass: "text-success",
      iconClass: "bg-success-bg text-success",
    },
    {
      id: "overdue",
      label: t.monitoring.kpiOverdue,
      value: kpis.overdue,
      icon: AlertTriangle,
      valueClass: kpis.overdue > 0 ? "text-warning" : "text-foreground",
      iconClass: "bg-warning-bg text-warning",
    },
    {
      id: "substitutions",
      label: t.monitoring.kpiSubstitutions,
      value: kpis.substitutions,
      icon: Repeat,
      valueClass: kpis.substitutions > 0 ? "text-link-600 dark:text-link-400" : "text-foreground",
      iconClass: "bg-link-500/10 text-link-600 dark:bg-link-400/15 dark:text-link-400",
    },
  ];

  function toggleKpi(id: KpiFilter) {
    setTab("courses");
    setKpiFilter((prev) => (prev === id ? "all" : id));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header + Filter Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
            {t.monitoring.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateDE(range.from)} – {formatDateDE(range.to)} · {t.monitoring.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={studioFilter} onValueChange={(v) => v && setStudioFilter(v)}>
            <SelectTrigger aria-label={t.monitoring.colStudio} className="min-w-44">
              <SelectValue>
                {(value: string) =>
                  value === "all"
                    ? t.monitoring.allStudios
                    : studios?.find((s) => s.id === value)?.name ?? t.monitoring.allStudios
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.monitoring.allStudios}</SelectItem>
              {(studios ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={(v) => v && setPeriod(v as MonitoringPeriod)}>
            <SelectTrigger aria-label={t.monitoring.periods.this_week} className="min-w-40">
              <SelectValue>
                {(value: string) =>
                  t.monitoring.periods[value as MonitoringPeriod] ?? t.monitoring.periods.this_week
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {t.monitoring.periods[opt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4 Interactive KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const active = tab === "courses" && kpiFilter === card.id && card.id !== "all";
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => toggleKpi(card.id)}
              className={cn(
                "flex flex-col justify-between rounded-xl border bg-card p-4 text-left transition-all hover:border-primary-300 dark:hover:border-primary-700",
                active
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{card.label}</span>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    card.iconClass
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
              </div>
              <span
                className={cn(
                  "mt-2 font-heading text-3xl font-extrabold tabular-nums",
                  card.valueClass
                )}
              >
                {card.value}
              </span>
            </button>
          );
        })}
      </div>

      {/* View Switcher (Kurse | Pro Trainer:in) + Active KPI filter badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "courses"}
            onClick={() => setTab("courses")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              tab === "courses"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-4" />
            <span>{t.monitoring.tabCourses}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "trainers"}
            onClick={() => setTab("trainers")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              tab === "trainers"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-4" />
            <span>{t.monitoring.tabTrainers}</span>
            {trainerSummaries.length > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold",
                  tab === "trainers"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {trainerSummaries.length}
              </span>
            )}
          </button>
        </div>

        {tab === "courses" && kpiFilter !== "all" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setKpiFilter("all")}
            className="gap-1.5"
          >
            <X className="size-3.5" />
            <span>{t.monitoring.resetFilter}</span>
          </Button>
        )}
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
                {kpiFilter === "all" ? t.monitoring.emptyCourses : t.monitoring.emptyFilter}
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
