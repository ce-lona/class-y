"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Euro, FileSignature, Receipt, Tag, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useStudioFilter } from "@/hooks/useStudioFilter";
import { useCompanyMonitoring } from "@/hooks/useMonitoring";
import { useCompanyContracts } from "@/hooks/useContracts";
import { useCourseTypes } from "@/hooks/useCourseTypes";
import { useBillingComments, useBillingDocuments } from "@/hooks/useCreditNotes";
import { formatMonthDE, getDefaultBillingMonth } from "@/lib/billingExport";
import { getRange, periodLabel, DEFAULT_PERIOD } from "@/lib/period";
import { fillTemplate, formatTimeShort, getCourseTypeAccent, todayISO } from "@/lib/format";
import type { MonitoringRow, MonitoringStatus } from "@/lib/monitoring";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

interface Task {
  id: string;
  tone: "warn" | "err" | "link" | "pri";
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}

const toneClass: Record<Task["tone"], string> = {
  warn: "bg-warning-bg text-warning",
  err: "bg-destructive-bg text-destructive",
  link: "bg-link-500/12 text-link-600 dark:text-link-400",
  pri: "bg-accent text-accent-foreground",
};

const statusBadge: Record<MonitoringStatus, string> = {
  completed: "bg-success-bg text-success",
  overdue: "bg-warning-bg text-warning",
  planned: "bg-muted text-muted-foreground",
  cancelled: "text-muted-foreground line-through",
};

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
      {children}
    </Link>
  );
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2.5 border-b border-border/60 px-4 py-3">
        <h2 className="font-heading text-base font-bold">{title}</h2>
        {meta && <span className="text-[13px] text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/** Übersicht für Company- und Studio-Admins: Wartet auf dich, Heute, Woche je Studio. */
export default function OverviewPage() {
  const { myCompany, isCoordinator } = useWorkspace();
  const { companyId, queryStudioId, scopeLabel, studios, matches } = useStudioFilter();
  const range = useMemo(() => getRange(DEFAULT_PERIOD), []);
  const today = todayISO();
  const billingMonth = getDefaultBillingMonth();

  const { data: rows, isLoading } = useCompanyMonitoring({
    companyId,
    from: range.from,
    to: range.to,
    studioId: queryStudioId,
  });
  const { data: contracts } = useCompanyContracts(companyId || undefined);
  const { data: courseTypes } = useCourseTypes(companyId);
  const { data: documents } = useBillingDocuments(!isCoordinator ? companyId : undefined, billingMonth);
  const { data: comments } = useBillingComments(!isCoordinator ? companyId : undefined, billingMonth);

  const week = useMemo(() => (rows ?? []).filter((r) => matches(r.studio_id)), [rows, matches]);
  const count = (status: MonitoringStatus) => week.filter((r) => r.status === status).length;
  const substitutions = week.filter((r) => r.is_substitution).length;
  const todays = week
    .filter((r) => r.course_date === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const pendingOffers = (contracts ?? []).filter(
    (c) => c.status === "pending" && c.approval_status === "pending_approval",
  );
  const pendingTypes = (courseTypes ?? []).filter(
    (ct) => ct.approval_status === "pending_approval" || !!ct.pending_change,
  );
  const openCorrections = (comments ?? []).filter(
    (c) => c.kind === "correction_request" && !c.resolved_at,
  );

  const tasks: Task[] = [];
  if (!isCoordinator) {
    if (pendingOffers.length === 1) {
      const offer = pendingOffers[0];
      tasks.push({
        id: "offers",
        tone: "warn",
        icon: FileSignature,
        title: fillTemplate(t.overview.pendingOffersOne, {
          name: offer.trainer_name || offer.trainer_email,
        }),
        hint: offer.created_by_name
          ? fillTemplate(t.overview.pendingOffersOneHint, { by: offer.created_by_name })
          : undefined,
        action: <ActionLink href="/team">{t.overview.actionReview}</ActionLink>,
      });
    } else if (pendingOffers.length > 1) {
      tasks.push({
        id: "offers",
        tone: "warn",
        icon: FileSignature,
        title: fillTemplate(t.overview.pendingOffersMany, { count: pendingOffers.length }),
        hint: pendingOffers.map((o) => o.trainer_name || o.trainer_email).join(" · "),
        action: <ActionLink href="/team">{t.overview.actionReview}</ActionLink>,
      });
    }
    for (const ct of pendingTypes) {
      tasks.push({
        id: `type-${ct.id}`,
        tone: "warn",
        icon: Tag,
        title: fillTemplate(t.overview.courseTypeProposal, { name: ct.name }),
        hint: t.overview.courseTypeProposalHint,
        action: (
          <ActionLink href="/settings?section=courseTypes">{t.overview.actionSettings}</ActionLink>
        ),
      });
    }
  } else if (pendingOffers.length > 0) {
    tasks.push({
      id: "own-offers",
      tone: "link",
      icon: Clock,
      title: fillTemplate(t.overview.pendingOwnOffers, { count: pendingOffers.length }),
      hint: t.overview.pendingOwnOffersHint,
    });
  }
  if (count("overdue") > 0) {
    tasks.push({
      id: "overdue",
      tone: "err",
      icon: AlertTriangle,
      title: fillTemplate(t.overview.overdue, { count: count("overdue") }),
      hint: t.overview.overdueHint,
      action: <ActionLink href="/monitoring?status=overdue">{t.overview.actionShow}</ActionLink>,
    });
  }
  if (!isCoordinator) {
    if (openCorrections.length > 0) {
      tasks.push({
        id: "corrections",
        tone: "link",
        icon: Receipt,
        title: fillTemplate(t.overview.corrections, { count: openCorrections.length }),
        hint: t.overview.correctionsHint,
        action: <ActionLink href="/billing">{t.overview.actionBilling}</ActionLink>,
      });
    }
    const monthName = formatMonthDE(billingMonth);
    tasks.push({
      id: "billing",
      tone: "pri",
      icon: Euro,
      title:
        documents && documents.length > 0
          ? fillTemplate(t.overview.billingStatus, { month: monthName })
          : fillTemplate(t.overview.billingNotYet, { month: monthName }),
      hint:
        documents && documents.length > 0
          ? fillTemplate(t.overview.billingStatusHint, { count: documents.length })
          : undefined,
      action: <ActionLink href="/billing">{t.overview.actionBilling}</ActionLink>,
    });
  }

  // Raster „Woche je Studio“: erfasst / geplant je Tag.
  const days = useMemo(() => {
    const start = new Date(`${range.from}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { iso, label: `${t.plans.weekdaysShort[(i + 1) as keyof typeof t.plans.weekdaysShort]} ${d.getDate()}.` };
    });
  }, [range.from]);
  const heatStudios = studios.filter((s) => matches(s.id));

  function cell(studioId: string, iso: string) {
    const list: MonitoringRow[] = week.filter((r) => r.studio_id === studioId && r.course_date === iso);
    const done = list.filter((r) => r.status === "completed").length;
    const bad = list.filter((r) => r.status === "overdue").length;
    const future = iso > today;
    if (list.length === 0) {
      return (
        <div key={iso} className="grid h-[26px] place-items-center rounded-md bg-muted/60 text-xs text-muted-foreground">
          –
        </div>
      );
    }
    const cls = future
      ? "bg-muted text-muted-foreground"
      : bad
        ? "bg-destructive-bg text-destructive"
        : iso === today
          ? "bg-warning-bg text-warning"
          : "bg-success-bg text-success";
    return (
      <div
        key={iso}
        title={`${done} / ${list.length}`}
        className={cn("grid h-[26px] place-items-center rounded-md text-xs font-bold tabular-nums", cls)}
      >
        {future ? list.length : `${done}/${list.length}`}
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  const stat = (href: string, value: number, label: string) => (
    <Link href={href} className="group">
      <b className="text-foreground tabular-nums group-hover:text-primary group-hover:underline">{value}</b>{" "}
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">{t.overview.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fillTemplate(t.overview.subtitle, {
            period: periodLabel(DEFAULT_PERIOD),
            scope: myCompany ? `${myCompany.name} · ${scopeLabel}` : scopeLabel,
          })}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-sm text-muted-foreground" data-testid="overview-stats">
        {stat("/monitoring", week.length, t.overview.statCourses)}
        {stat("/monitoring?status=completed", count("completed"), t.overview.statCompleted)}
        {stat("/monitoring?status=overdue", count("overdue"), t.overview.statOverdue)}
        {stat("/monitoring?status=substitutions", substitutions, t.overview.statSubstitutions)}
        {stat("/monitoring?status=planned", count("planned"), t.overview.statOpen)}
      </div>

      <div className="grid items-start gap-[18px] min-[1100px]:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <div className="flex flex-col gap-[18px]">
          <Panel
            title={t.overview.waitingTitle}
            meta={
              tasks.length === 1
                ? t.overview.waitingCountOne
                : fillTemplate(t.overview.waitingCount, { count: tasks.length })
            }
          >
            {tasks.length === 0 ? (
              <p className="p-7 text-center text-sm text-muted-foreground">{t.overview.waitingEmpty}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {tasks.map((task) => {
                  const Icon = task.icon;
                  return (
                    <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-[9px]", toneClass[task.tone])}>
                        <Icon className="size-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{task.title}</p>
                        {task.hint && <p className="text-[13.5px] text-muted-foreground">{task.hint}</p>}
                      </div>
                      {task.action && <div className="shrink-0">{task.action}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {heatStudios.length > 0 && (
            <Panel title={t.overview.weekTitle} meta={t.overview.weekHint}>
              <div className="overflow-x-auto p-4">
                <div className="grid min-w-[520px] grid-cols-[130px_repeat(7,minmax(0,1fr))] items-center gap-1 text-[13px]">
                  <div />
                  {days.map((d) => (
                    <div key={d.iso} className="text-center text-xs font-bold text-muted-foreground">
                      {d.label}
                    </div>
                  ))}
                  {heatStudios.map((s) => (
                    <div key={s.id} className="contents">
                      <div className="truncate font-semibold">{s.name}</div>
                      {days.map((d) => cell(s.id, d.iso))}
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}
        </div>

        <Panel
          title={fillTemplate(t.overview.todayTitle, { date: todayLabel })}
          meta={fillTemplate(t.overview.todayCount, { count: todays.length })}
        >
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>
          ) : todays.length === 0 ? (
            <p className="p-7 text-center text-sm text-muted-foreground">{t.overview.todayEmpty}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {todays.map((r) => (
                <li key={r.row_key} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5">
                  <span className="font-heading text-[15px] font-bold tabular-nums">
                    {formatTimeShort(r.start_time)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 leading-tight font-semibold">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", getCourseTypeAccent(r.course_type_id ?? r.course_type_name).dot)}
                        aria-hidden="true"
                      />
                      <span className="truncate">{r.course_type_name}</span>
                    </p>
                    <p className="truncate text-[13px] leading-tight text-muted-foreground">
                      {r.studio_name} · {r.trainer_name || r.trainer_email}
                    </p>
                  </div>
                  <span className={cn("rounded-md px-2 py-px text-[12.5px] font-bold whitespace-nowrap", statusBadge[r.status])}>
                    {t.monitoring.status[r.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
