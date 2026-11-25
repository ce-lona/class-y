"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  CalendarRange,
  Check,
  Clock,
  FileText,
  MapPin,
  Plus,
  Repeat,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { useMyContracts } from "@/hooks/useContracts";
import {
  useDeleteCourseSession,
  useLogCourseSession,
  useMyCourseSessions,
  useTrainerStudioSlots,
} from "@/hooks/useCourseSessions";
import {
  useCancelSubstitutionRequest,
  useCompanyColleagues,
  useMySubstitutions,
  useRequestSubstitution,
  useRespondSubstitution,
} from "@/hooks/useSubstitutions";
import type { MyCourseSession, TrainerStudioSlot } from "@/lib/courseSessions";
import type { MySubstitution } from "@/lib/substitutions";
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
  outgoingSubstitution: MySubstitution | null;
  incomingAcceptedSubstitution: MySubstitution | null;
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

function SubstitutionRequestDrawer({
  item,
  currentUserId,
  onClose,
}: {
  item: WeekSlotOccurrence | null;
  currentUserId: string;
  onClose: () => void;
}) {
  const companyId = item?.slot.company_id ?? "";
  const { data: colleagues, isLoading } = useCompanyColleagues(companyId);
  const requestSub = useRequestSubstitution();
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eligibleColleagues = (colleagues ?? []).filter((c) => c.trainer_id !== currentUserId);
  const effectiveTrainerId =
    selectedTrainerId || eligibleColleagues[0]?.trainer_id || "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !effectiveTrainerId) return;
    setErrorMsg(null);
    try {
      await requestSub.mutateAsync({
        slotId: item.slot.slot_id,
        date: item.isoDate,
        substituteTrainerId: effectiveTrainerId,
        notes,
      });
      setSelectedTrainerId("");
      setNotes("");
      onClose();
    } catch (error) {
      console.error(error);
      setErrorMsg(t.trainer.substitutionRequestError);
    }
  }

  return (
    <Drawer
      open={Boolean(item)}
      onClose={() => {
        setErrorMsg(null);
        onClose();
      }}
      title={t.trainer.substitutionRequestTitle}
      description={
        item
          ? `${item.slot.course_type_name} · ${formatDateDE(item.isoDate)}, ${formatTimeShort(item.slot.start_time)}–${formatTimeShort(item.slot.end_time)} · ${item.slot.company_name} · ${item.slot.studio_name}`
          : undefined
      }
    >
      {item && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="rounded-xl border border-border bg-muted/35 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {t.trainer.substitutionRequestHint}
          </p>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : eligibleColleagues.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {t.trainer.substitutionNoColleagues}
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="sub-colleague">{t.trainer.substitutionSelectColleague}</Label>
                <Select
                  value={effectiveTrainerId}
                  onValueChange={(v) => v && setSelectedTrainerId(v)}
                >
                  <SelectTrigger id="sub-colleague" className="w-full">
                    <SelectValue placeholder={t.trainer.substitutionSelectPlaceholder}>
                      {(value: string) =>
                        eligibleColleagues.find((c) => c.trainer_id === value)?.display_name ??
                        t.trainer.substitutionSelectPlaceholder
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleColleagues.map((colleague) => (
                      <SelectItem key={colleague.trainer_id} value={colleague.trainer_id}>
                        {colleague.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sub-notes">{t.trainer.notes}</Label>
                <Input
                  id="sub-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.trainer.notesPlaceholder}
                />
              </div>
            </>
          )}

          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button
              type="submit"
              disabled={requestSub.isPending || eligibleColleagues.length === 0}
              className="flex-1 gap-1.5"
            >
              <Repeat className="size-4" />
              <span>{t.trainer.substitutionSendRequest}</span>
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

function PlannedCourseCard({
  item,
  highlighted = false,
  onLogged,
  onRequestSubstitute,
}: {
  item: WeekSlotOccurrence;
  highlighted?: boolean;
  onLogged: (error: string | null) => void;
  onRequestSubstitute: (item: WeekSlotOccurrence) => void;
}) {
  const logSession = useLogCourseSession();
  const cancelSub = useCancelSubstitutionRequest();
  const [cancelling, setCancelling] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const accent = getCourseTypeAccent(item.slot.course_type_id);

  const dayLabel = item.isToday
    ? t.trainer.today
    : `${t.plans.weekdaysShort[item.slot.weekday as keyof typeof t.plans.weekdaysShort]}, ${formatShortDayMonth(item.isoDate)}`;

  const isIncomingAccepted = Boolean(item.incomingAcceptedSubstitution);
  const outgoing = item.outgoingSubstitution;
  const isRelievedBySubstitute = outgoing?.status === "accepted";
  const isPendingSubstitute = outgoing?.status === "pending";
  const isDeclinedSubstitute = outgoing?.status === "declined";

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
        is_substitution: isIncomingAccepted,
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

  async function handleWithdrawSubstitution() {
    if (!outgoing) return;
    onLogged(null);
    try {
      await cancelSub.mutateAsync(outgoing.id);
    } catch (error) {
      console.error(error);
      onLogged(t.trainer.respondSubstitutionError);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-xs transition-colors sm:p-5",
        highlighted
          ? "border-primary bg-primary text-primary-foreground"
          : cn("border-border border-l-4 bg-card", accent.border)
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {highlighted && (
            <p className="mb-1 text-xs font-semibold text-primary-foreground/80">
              {t.trainer.nextCourseToday}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "font-heading text-base font-bold",
                highlighted ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {item.slot.course_type_name}
            </h2>
            {isIncomingAccepted && item.incomingAcceptedSubstitution && (
              <Badge
                className={cn(
                  "gap-1",
                  highlighted
                    ? "bg-white/20 text-primary-foreground"
                    : "bg-link-500/15 text-link-600 dark:text-link-400"
                )}
              >
                <Repeat className="size-3" />
                <span>
                  {t.trainer.substitutionFor}{" "}
                  {item.incomingAcceptedSubstitution.original_trainer_name}
                </span>
              </Badge>
            )}
            {item.isToday && !item.session && !highlighted && !isRelievedBySubstitute && (
              <Badge className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
                {t.trainer.today}
              </Badge>
            )}
          </div>
          <p
            className={cn(
              "mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm",
              highlighted ? "text-primary-foreground/85" : "text-muted-foreground"
            )}
          >
            <span className="inline-flex items-center gap-1 font-medium tabular-nums">
              <Clock className="size-3.5" />
              <span>
                {dayLabel}, {formatTimeShort(item.slot.start_time)}–
                {formatTimeShort(item.slot.end_time)}
              </span>
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5",
                highlighted
                  ? "bg-white/15 text-primary-foreground"
                  : "bg-muted/70 text-foreground"
              )}
            >
              <Building2 className="size-3 shrink-0" />
              <span>{item.slot.company_name}</span>
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1",
                highlighted ? "text-primary-foreground/85" : "text-muted-foreground"
              )}
            >
              <MapPin className="size-3 shrink-0" />
              <span>{item.slot.studio_name}</span>
            </span>
          </div>
        </div>

        {item.session ? (
          <SessionStatusBadge status={item.session.status} />
        ) : isRelievedBySubstitute && outgoing ? (
          <Badge className="gap-1 bg-link-500/15 text-link-600 dark:text-link-400">
            <Repeat className="size-3" />
            <span>
              {t.trainer.substitutionAcceptedBadge} {outgoing.substitute_trainer_name}
            </span>
          </Badge>
        ) : isPendingSubstitute && outgoing ? (
          <Badge className="gap-1 bg-warning-bg text-warning">
            <Repeat className="size-3" />
            <span>
              {t.trainer.substitutionPendingBadge}: {outgoing.substitute_trainer_name}
            </span>
          </Badge>
        ) : null}
      </div>

      {isDeclinedSubstitute && outgoing && !item.session && (
        <p className="mt-2.5 rounded-lg bg-destructive-bg px-3 py-2 text-xs font-medium text-destructive">
          {t.trainer.substitutionDeclinedHint} {outgoing.substitute_trainer_name}
        </p>
      )}

      {isPendingSubstitute && outgoing && !item.session && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning-bg px-3.5 py-2.5 text-xs text-warning">
          <span className="font-medium">
            {t.trainer.substitutionPendingBadge} ({outgoing.substitute_trainer_name})
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cancelSub.isPending}
            onClick={handleWithdrawSubstitution}
            className="h-7 text-xs"
          >
            {t.trainer.substitutionWithdraw}
          </Button>
        </div>
      )}

      {item.session?.notes && (
        <p className="mt-2.5 rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          {item.session.notes}
        </p>
      )}

      {!item.session && !isRelievedBySubstitute && !isPendingSubstitute && (
        <div className="mt-4 space-y-2.5">
          {cancelling ? (
            <div className="space-y-2.5 rounded-xl border border-border bg-card p-3 text-foreground">
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
                variant={highlighted ? "secondary" : "default"}
                disabled={logSession.isPending}
                onClick={() => submitStatus("completed")}
                className={cn(
                  "h-11 flex-1 gap-2",
                  highlighted && "bg-white text-primary-800 hover:bg-white/90"
                )}
              >
                <Check className="size-4" />
                <span>{t.trainer.markCompleted}</span>
              </Button>
              {!isIncomingAccepted && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={logSession.isPending}
                  onClick={() => onRequestSubstitute(item)}
                  className={cn(
                    "h-11 gap-1.5",
                    highlighted &&
                      "border-white/30 bg-white/15 text-primary-foreground hover:bg-white/25"
                  )}
                >
                  <Repeat
                    className={cn(
                      "size-4",
                      highlighted ? "text-primary-foreground" : "text-link-600 dark:text-link-400"
                    )}
                  />
                  <span>{t.trainer.markSubstituted}</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={logSession.isPending}
                onClick={() => setCancelling(true)}
                className={cn(
                  "h-11 gap-1.5",
                  highlighted &&
                    "border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20"
                )}
              >
                <XCircle
                  className={cn(
                    "size-4",
                    highlighted ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                />
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
  const { data: mySubstitutions } = useMySubstitutions();
  const deleteSession = useDeleteCourseSession();
  const respondSub = useRespondSubstitution();

  const [tab, setTab] = useState<CoursesTab>("upcoming");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [studioFilter, setStudioFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [subDrawerItem, setSubDrawerItem] = useState<WeekSlotOccurrence | null>(null);

  const hasActiveContract = (myContracts ?? []).some((c) => c.status === "active");
  const weekDays = getCurrentWeekDays();
  const weekStart = weekDays[0].isoDate;
  const weekEnd = weekDays[6].isoDate;
  const weekRangeLabel = `${formatShortDayMonth(weekStart)} – ${formatShortDayMonth(weekEnd)}`;

  const incomingPendingRequests = (mySubstitutions ?? []).filter(
    (s) => s.direction === "incoming" && s.status === "pending"
  );

  const ownSlots = (studioSlots ?? []).filter(
    (sl) => sl.scheduled_trainer_id === session?.user.id
  );

  // Filter-Optionen aus eigenen Slots, Vertretungen & erfassten Kursen sammeln
  const companyMap = new Map<string, string>();
  const studioEntries: { id: string; name: string; companyId: string }[] = [];
  const seenStudios = new Set<string>();

  for (const sl of ownSlots) {
    companyMap.set(sl.company_id, sl.company_name);
    if (!seenStudios.has(sl.studio_id)) {
      seenStudios.add(sl.studio_id);
      studioEntries.push({ id: sl.studio_id, name: sl.studio_name, companyId: sl.company_id });
    }
  }
  for (const sub of mySubstitutions ?? []) {
    companyMap.set(sub.company_id, sub.company_name);
    if (!seenStudios.has(sub.studio_id)) {
      seenStudios.add(sub.studio_id);
      studioEntries.push({ id: sub.studio_id, name: sub.studio_name, companyId: sub.company_id });
    }
  }
  for (const ms of mySessions ?? []) {
    companyMap.set(ms.company_id, ms.company_name);
    if (!seenStudios.has(ms.studio_id)) {
      seenStudios.add(ms.studio_id);
      studioEntries.push({ id: ms.studio_id, name: ms.studio_name, companyId: ms.company_id });
    }
  }

  const companies = Array.from(companyMap.entries()).sort((a, b) => a[1].localeCompare(b[1], "de"));
  const studios = studioEntries
    .filter((st) => companyFilter === "all" || st.companyId === companyFilter)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const showFilterBar = companies.length > 1 || studios.length > 1;

  // Für jeden Tag der aktuellen Woche die geplanten eigenen Slots + angenommene Vertretungen sammeln
  const weekOccurrences: WeekSlotOccurrence[] = [];
  const addedKeys = new Set<string>();

  for (const day of weekDays) {
    const daySlots = ownSlots.filter(
      (sl) =>
        sl.weekday === day.weekday &&
        sl.plan_valid_from <= day.isoDate &&
        (companyFilter === "all" || sl.company_id === companyFilter) &&
        (studioFilter === "all" || sl.studio_id === studioFilter)
    );
    for (const slot of daySlots) {
      const key = `${slot.slot_id}-${day.isoDate}`;
      addedKeys.add(key);
      const existing =
        (mySessions ?? []).find(
          (s) => s.course_plan_slot_id === slot.slot_id && s.date === day.isoDate
        ) ?? null;

      // Neueste ausgehende Vertretung für diesen Termin finden (accepted/pending priorisiert)
      const outgoingList = (mySubstitutions ?? []).filter(
        (sub) =>
          sub.direction === "outgoing" &&
          sub.course_plan_slot_id === slot.slot_id &&
          sub.date === day.isoDate &&
          sub.status !== "cancelled"
      );
      const outgoing =
        outgoingList.find((sub) => sub.status === "accepted") ??
        outgoingList.find((sub) => sub.status === "pending") ??
        outgoingList[0] ??
        null;

      weekOccurrences.push({
        key,
        slot,
        isoDate: day.isoDate,
        isToday: day.isToday,
        session: existing,
        outgoingSubstitution: outgoing,
        incomingAcceptedSubstitution: null,
      });
    }
  }

  // Angenommene eingehende Vertretungen dieser Woche mit in die Wochenliste aufnehmen
  const incomingAcceptedThisWeek = (mySubstitutions ?? []).filter(
    (sub) =>
      sub.direction === "incoming" &&
      sub.status === "accepted" &&
      sub.date >= weekStart &&
      sub.date <= weekEnd &&
      (companyFilter === "all" || sub.company_id === companyFilter) &&
      (studioFilter === "all" || sub.studio_id === studioFilter)
  );

  for (const sub of incomingAcceptedThisWeek) {
    const key = `${sub.course_plan_slot_id}-${sub.date}`;
    if (addedKeys.has(key)) continue;
    addedKeys.add(key);
    const existing =
      (mySessions ?? []).find(
        (s) => s.course_plan_slot_id === sub.course_plan_slot_id && s.date === sub.date
      ) ?? null;
    const isToday = weekDays.some((d) => d.isoDate === sub.date && d.isToday);

    weekOccurrences.push({
      key,
      slot: {
        slot_id: sub.course_plan_slot_id,
        studio_id: sub.studio_id,
        studio_name: sub.studio_name,
        company_id: sub.company_id,
        company_name: sub.company_name,
        course_plan_id: "",
        plan_valid_from: sub.date,
        weekday: sub.weekday,
        start_time: sub.start_time,
        end_time: sub.end_time,
        course_type_id: sub.course_type_id,
        course_type_name: sub.course_type_name,
        scheduled_trainer_id: sub.original_trainer_id,
        scheduled_trainer_name: sub.original_trainer_name,
      },
      isoDate: sub.date,
      isToday,
      session: existing,
      outgoingSubstitution: null,
      incomingAcceptedSubstitution: sub,
    });
  }

  const sortedWeek = [...weekOccurrences].sort((a, b) => {
    if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
    const dateCmp = a.isoDate.localeCompare(b.isoDate);
    if (dateCmp !== 0) return dateCmp;
    return formatTimeShort(a.slot.start_time).localeCompare(formatTimeShort(b.slot.start_time));
  });

  const filteredSessions = (mySessions ?? []).filter((s) => {
    if (companyFilter !== "all" && s.company_id !== companyFilter) return false;
    if (studioFilter !== "all" && s.studio_id !== studioFilter) return false;
    return true;
  });

  const firstUnloggedTodayKey =
    sortedWeek.find(
      (item) =>
        item.isToday &&
        !item.session &&
        item.outgoingSubstitution?.status !== "accepted" &&
        item.outgoingSubstitution?.status !== "pending"
    )?.key ?? null;

  async function handleUndo(sessionId: string) {
    setActionError(null);
    try {
      await deleteSession.mutateAsync(sessionId);
    } catch (error) {
      console.error(error);
      setActionError(t.trainer.deleteError);
    }
  }

  async function handleRespond(assignmentId: string, decision: "accepted" | "declined") {
    setActionError(null);
    try {
      await respondSub.mutateAsync({ assignmentId, decision });
    } catch (error) {
      console.error(error);
      setActionError(t.trainer.respondSubstitutionError);
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

        <div className="flex items-center gap-2">
          <Link
            href="/courses/schedule"
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "gap-1.5")}
          >
            <CalendarRange className="size-4" />
            <span>{t.trainer.navSchedule}</span>
          </Link>
          <Link
            href="/courses/log"
            className={cn(buttonVariants({ size: "default" }), "gap-1.5")}
          >
            <Plus className="size-4" />
            <span>{t.trainer.logCourse}</span>
          </Link>
        </div>
      </div>

      {/* Eingehende offene Vertretungsanfragen (immer pending bis zur Annahme) */}
      {incomingPendingRequests.length > 0 && (
        <section className="space-y-2.5 rounded-2xl border border-warning/35 bg-warning-bg p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-warning">
            <Repeat className="size-4 shrink-0" />
            <span>
              {t.trainer.incomingRequestsTitle} ({incomingPendingRequests.length})
            </span>
          </div>

          <div className="space-y-2.5">
            {incomingPendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-border bg-card p-3.5 text-foreground"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-heading text-sm font-bold">{req.course_type_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatDateDE(req.date)}, {formatTimeShort(req.start_time)}–
                      {formatTimeShort(req.end_time)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-0.5 text-foreground">
                        <Building2 className="size-3 shrink-0" />
                        <span>{req.company_name}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        <span>{req.studio_name}</span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.trainer.incomingRequestFor}{" "}
                      <strong className="font-semibold text-foreground">
                        {req.original_trainer_name}
                      </strong>
                    </p>
                    {req.notes && (
                      <p className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                        {req.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={respondSub.isPending}
                    onClick={() => handleRespond(req.id, "accepted")}
                    className="flex-1 gap-1.5"
                  >
                    <Check className="size-3.5" />
                    <span>{t.trainer.acceptSubstitution}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={respondSub.isPending}
                    onClick={() => handleRespond(req.id, "declined")}
                    className="gap-1.5"
                  >
                    <X className="size-3.5" />
                    <span>{t.trainer.declineSubstitution}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showFilterBar && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3.5">
          {companies.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                <Building2 className="size-3.5" />
                <span>{t.trainer.filterCompany}:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setCompanyFilter("all");
                  setStudioFilter("all");
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  companyFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {t.trainer.filterAll}
              </button>
              {companies.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCompanyFilter(id);
                    setStudioFilter("all");
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                    companyFilter === id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {studios.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                <MapPin className="size-3.5" />
                <span>{t.trainer.filterStudio}:</span>
              </span>
              <button
                type="button"
                onClick={() => setStudioFilter("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  studioFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {t.trainer.filterAll}
              </button>
              {studios.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStudioFilter(st.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                    studioFilter === st.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {st.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
          {filteredSessions.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none font-bold text-foreground">
              {filteredSessions.length}
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
              <PlannedCourseCard
                key={item.key}
                item={item}
                highlighted={item.key === firstUnloggedTodayKey}
                onLogged={setActionError}
                onRequestSubstitute={setSubDrawerItem}
              />
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
      ) : filteredSessions.length > 0 ? (
        <ul className="space-y-3">
          {filteredSessions.map((s) => {
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
                  <div className="min-w-0 space-y-1.5">
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
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-0.5 text-foreground">
                        <Building2 className="size-3 shrink-0" />
                        <span>{s.company_name}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        <span>{s.studio_name}</span>
                      </span>
                    </div>
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

      <SubstitutionRequestDrawer
        item={subDrawerItem}
        currentUserId={session?.user.id ?? ""}
        onClose={() => setSubDrawerItem(null)}
      />
    </div>
  );
}
