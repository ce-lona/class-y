"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Check,
  Clock,
  FileText,
  MapPin,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { useMyContracts } from "@/hooks/useContracts";
import {
  useDeleteCourseSession,
  useLogCourseSession,
  useMyCourseSessions,
  useTrainerStudioSlots,
} from "@/hooks/useCourseSessions";
import type { MyCourseSession, TrainerStudioSlot } from "@/lib/courseSessions";
import {
  formatDateDE,
  formatShortDayMonth,
  formatTimeShort,
  getCourseTypeAccent,
  getCurrentWeekDays,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

type CoursesTab = "upcoming" | "logged";

interface WeekSlotOccurrence {
  key: string;
  slot: TrainerStudioSlot;
  isoDate: string;
  isToday: boolean;
  session: MyCourseSession | null;
}

function SessionStatusBadge({ status }: { status: MyCourseSession["status"] }) {
  if (status === "completed") {
    return (
      <Badge className="gap-1.5 bg-success-bg text-success">
        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        <span>{t.trainer.statusCompleted}</span>
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge className="gap-1.5 bg-destructive-bg text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
        <span>{t.trainer.statusCancelled}</span>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
      <span>{t.trainer.statusPlanned}</span>
    </Badge>
  );
}

function PlannedCourseCard({
  item,
  onLogged,
}: {
  item: WeekSlotOccurrence;
  onLogged: (error: string | null) => void;
}) {
  const logSession = useLogCourseSession();
  const [cancelling, setCancelling] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const accent = getCourseTypeAccent(item.slot.course_type_id);

  const dayLabel = item.isToday
    ? t.trainer.today
    : `${t.plans.weekdaysShort[item.slot.weekday as keyof typeof t.plans.weekdaysShort]}, ${formatShortDayMonth(item.isoDate)}`;

  async function submitStatus(status: "completed" | "cancelled") {
    onLogged(null);
    try {
      await logSession.mutateAsync({
        studio_id: item.slot.studio_id,
        course_plan_slot_id: item.slot.slot_id,
        course_type_id: item.slot.course_type_id,
        date: item.isoDate,
        start_time: formatTimeShort(item.slot.start_time),
        end_time: formatTimeShort(item.slot.end_time),
        is_substitution: false,
        status,
        notes: status === "cancelled" ? cancelNote : null,
      });
      setCancelling(false);
      setCancelNote("");
    } catch (error) {
      console.error(error);
      onLogged(t.trainer.saveError);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border border-l-4 bg-card p-4 shadow-xs transition-colors sm:p-5",
        accent.border
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-bold text-foreground">
              {item.slot.course_type_name}
            </h2>
            {item.isToday && !item.session && (
              <Badge className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
                {t.trainer.today}
              </Badge>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium tabular-nums">
              <Clock className="size-3.5" />
              <span>
                {dayLabel}, {formatTimeShort(item.slot.start_time)}–
                {formatTimeShort(item.slot.end_time)}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              <span>{item.slot.studio_name}</span>
            </span>
          </p>
        </div>

        {item.session && <SessionStatusBadge status={item.session.status} />}
      </div>

      {item.session?.notes && (
        <p className="mt-2.5 rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          {item.session.notes}
        </p>
      )}

      {!item.session && (
        <div className="mt-4 space-y-2.5">
          {cancelling ? (
            <div className="space-y-2.5 rounded-xl border border-border bg-background/60 p-3">
              <Input
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder={t.trainer.cancelNotePlaceholder}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={logSession.isPending}
                  onClick={() => submitStatus("cancelled")}
                  className="gap-1.5"
                >
                  <XCircle className="size-4" />
                  <span>{t.trainer.confirmCancelled}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCancelling(false);
                    setCancelNote("");
                  }}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="lg"
                disabled={logSession.isPending}
                onClick={() => submitStatus("completed")}
                className="h-11 flex-1 gap-2"
              >
                <Check className="size-4" />
                <span>{t.trainer.markCompleted}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={logSession.isPending}
                onClick={() => setCancelling(true)}
                className="h-11 gap-1.5"
              >
                <XCircle className="size-4 text-muted-foreground" />
                <span>{t.trainer.markCancelled}</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrainerCoursesPage() {
  const session = useAuthStore((s) => s.session);
  const { data: myContracts, isLoading: contractsLoading } = useMyContracts();
  const { data: studioSlots, isLoading: slotsLoading } = useTrainerStudioSlots();
  const { data: mySessions, isLoading: sessionsLoading } = useMyCourseSessions();
  const deleteSession = useDeleteCourseSession();

  const [tab, setTab] = useState<CoursesTab>("upcoming");
  const [actionError, setActionError] = useState<string | null>(null);

  const hasActiveContract = (myContracts ?? []).some((c) => c.status === "active");
  const weekDays = getCurrentWeekDays();
  const weekRangeLabel = `${formatShortDayMonth(weekDays[0].isoDate)} – ${formatShortDayMonth(weekDays[6].isoDate)}`;

  const ownSlots = (studioSlots ?? []).filter(
    (sl) => sl.scheduled_trainer_id === session?.user.id
  );

  // Für jeden Tag der aktuellen Woche die geplanten eigenen Slots auflisten
  // (inkl. Zuordnung, ob bereits erfasst).
  const weekOccurrences: WeekSlotOccurrence[] = [];
  for (const day of weekDays) {
    const daySlots = ownSlots.filter(
      (sl) => sl.weekday === day.weekday && sl.plan_valid_from <= day.isoDate
    );
    for (const slot of daySlots) {
      const existing =
        (mySessions ?? []).find(
          (s) => s.course_plan_slot_id === slot.slot_id && s.date === day.isoDate
        ) ?? null;
      weekOccurrences.push({
        key: `${slot.slot_id}-${day.isoDate}`,
        slot,
        isoDate: day.isoDate,
        isToday: day.isToday,
        session: existing,
      });
    }
  }

  // Heute + noch offene Termine zuerst anzeigen
  const sortedWeek = [...weekOccurrences].sort((a, b) => {
    if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
    const dateCmp = a.isoDate.localeCompare(b.isoDate);
    if (dateCmp !== 0) return dateCmp;
    return formatTimeShort(a.slot.start_time).localeCompare(formatTimeShort(b.slot.start_time));
  });

  async function handleUndo(sessionId: string) {
    setActionError(null);
    try {
      await deleteSession.mutateAsync(sessionId);
    } catch (error) {
      console.error(error);
      setActionError(t.trainer.deleteError);
    }
  }

  if (contractsLoading) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (!hasActiveContract) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
            <FileText className="size-5" />
          </div>
          <h1 className="font-heading text-xl font-extrabold">{t.trainer.noActiveContracts}</h1>
          <p className="text-sm text-muted-foreground">{t.trainer.noActiveContractsHint}</p>
          <Link
            href="/settings?tab=contracts"
            className={cn(buttonVariants({ size: "lg" }), "mt-2 w-full")}
          >
            {t.trainer.goToContracts}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
            {t.trainer.title}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t.trainer.thisWeek} · {weekRangeLabel}
          </p>
        </div>

        <Link
          href="/courses/log"
          className={cn(buttonVariants({ size: "default" }), "gap-1.5")}
        >
          <Plus className="size-4" />
          <span>{t.trainer.logCourse}</span>
        </Link>
      </div>

      <div
        role="tablist"
        className="grid grid-cols-2 rounded-xl border border-border bg-muted/60 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "upcoming"}
          onClick={() => setTab("upcoming")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors",
            tab === "upcoming"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>{t.trainer.tabUpcoming}</span>
          {sortedWeek.length > 0 && (
            <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[11px] leading-none font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
              {sortedWeek.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === "logged"}
          onClick={() => setTab("logged")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors",
            tab === "logged"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>{t.trainer.tabLogged}</span>
          {mySessions && mySessions.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none font-bold text-foreground">
              {mySessions.length}
            </span>
          )}
        </button>
      </div>

      {actionError && (
        <div className="rounded-xl bg-destructive-bg px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {tab === "upcoming" ? (
        slotsLoading || sessionsLoading ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : sortedWeek.length > 0 ? (
          <div className="space-y-3">
            {sortedWeek.map((item) => (
              <PlannedCourseCard key={item.key} item={item} onLogged={setActionError} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
              <CalendarCheck className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="font-heading text-base font-bold">{t.trainer.emptyWeek}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{t.trainer.emptyWeekHint}</p>
            </div>
            <Link
              href="/courses/log"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1 gap-1.5")}
            >
              <Plus className="size-4" />
              <span>{t.trainer.logCourse}</span>
            </Link>
          </div>
        )
      ) : sessionsLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : mySessions && mySessions.length > 0 ? (
        <ul className="space-y-3">
          {mySessions.map((s) => {
            const accent = getCourseTypeAccent(s.course_type_id ?? s.id);
            return (
              <li
                key={s.id}
                className={cn(
                  "rounded-2xl border border-border border-l-4 bg-card p-4 shadow-xs",
                  accent.border
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-base font-bold">
                        {s.course_type_name || t.trainer.adHocBadge}
                      </span>
                      <SessionStatusBadge status={s.status} />
                      {s.is_substitution && (
                        <Badge className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
                          {s.scheduled_trainer_name
                            ? `${t.trainer.substitutionFor} ${s.scheduled_trainer_name}`
                            : t.trainer.substitutionBadge}
                        </Badge>
                      )}
                      {!s.course_plan_slot_id && (
                        <Badge variant="outline">{t.trainer.adHocBadge}</Badge>
                      )}
                    </div>

                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="size-3.5" />
                        <span>
                          {formatDateDE(s.date)}, {formatTimeShort(s.start_time)}–
                          {formatTimeShort(s.end_time)}
                        </span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        <span>{s.studio_name}</span>
                      </span>
                    </p>
                  </div>

                  {!s.locked_at && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deleteSession.isPending}
                      onClick={() => handleUndo(s.id)}
                      className="gap-1 text-muted-foreground hover:bg-destructive-bg hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      <span>{t.trainer.undo}</span>
                    </Button>
                  )}
                </div>

                {s.notes && (
                  <p className="mt-2.5 rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                    {s.notes}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">
          <CalendarCheck className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t.trainer.emptyLogged}</p>
        </div>
      )}
    </div>
  );
}
