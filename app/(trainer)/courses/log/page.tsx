"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Clock,
  MapPin,
  Repeat,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  useLogCourseSession,
  useTrainerStudios,
  useTrainerStudioSlots,
} from "@/hooks/useCourseSessions";
import { useCourseTypes } from "@/hooks/useCourseTypes";
import { isCourseTypeAvailableInStudio } from "@/lib/courseTypes";
import {
  addMinutesToTime,
  formatTimeShort,
  getCourseTypeAccent,
  getIsoWeekday,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { CourseTypeIcon } from "@/components/course-type-icon";
import { t } from "@/i18n/de";

type LogMode = "planned" | "adhoc";

export default function LogCoursePage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const { data: studios, isLoading: studiosLoading } = useTrainerStudios();
  const { data: studioSlots, isLoading: slotsLoading } = useTrainerStudioSlots();
  const logSession = useLogCourseSession();

  const [mode, setMode] = useState<LogMode>("planned");
  const [date, setDate] = useState(todayISO());
  const [showAllWeekdays, setShowAllWeekdays] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  // Ad-hoc fields
  const [studioId, setStudioId] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("18:00");
  const [endTime, setEndTime] = useState<string>("19:00");
  const [courseTypeId, setCourseTypeId] = useState<string>("");
  const [isSubstitution, setIsSubstitution] = useState<boolean>(false);

  // Shared fields
  const [status, setStatus] = useState<"completed" | "cancelled">("completed");
  const [notes, setNotes] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveStudio =
    studios?.find((st) => st.studio_id === studioId) ?? studios?.[0] ?? null;
  const effectiveStudioId = effectiveStudio?.studio_id ?? "";

  const { data: allCourseTypes } = useCourseTypes(effectiveStudio?.company_id ?? "", { approvedOnly: true });
  const courseTypes = allCourseTypes?.filter((ct) =>
    isCourseTypeAvailableInStudio(ct, effectiveStudioId)
  );
  const effectiveCourseType =
    courseTypes?.find((ct) => ct.id === courseTypeId) ?? courseTypes?.[0] ?? null;
  const effectiveCourseTypeId = effectiveCourseType?.id ?? "";

  const selectedWeekday = getIsoWeekday(date);
  const visibleSlots = (studioSlots ?? []).filter((sl) =>
    showAllWeekdays ? true : sl.weekday === selectedWeekday
  );
  const activeSlot =
    visibleSlots.find((sl) => sl.slot_id === selectedSlotId) ?? visibleSlots[0] ?? null;

  function handleCourseTypeChange(nextId: string | null) {
    if (!nextId) return;
    setCourseTypeId(nextId);
    const ct = courseTypes?.find((item) => item.id === nextId);
    if (ct) {
      setEndTime(addMinutesToTime(startTime, ct.default_duration_min));
    }
  }

  function handleStartTimeChange(nextStart: string) {
    setStartTime(nextStart);
    if (effectiveCourseType && nextStart) {
      setEndTime(addMinutesToTime(nextStart, effectiveCourseType.default_duration_min));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    try {
      if (mode === "planned") {
        if (!activeSlot) {
          setErrorMsg(t.trainer.noSlotsForDay);
          return;
        }
        const sub = activeSlot.scheduled_trainer_id !== session?.user.id;
        await logSession.mutateAsync({
          studio_id: activeSlot.studio_id,
          course_plan_slot_id: activeSlot.slot_id,
          course_type_id: activeSlot.course_type_id,
          date,
          start_time: formatTimeShort(activeSlot.start_time),
          end_time: formatTimeShort(activeSlot.end_time),
          is_substitution: sub,
          status,
          notes,
        });
      } else {
        if (!effectiveStudioId || !effectiveCourseTypeId) {
          setErrorMsg(t.trainer.saveError);
          return;
        }
        if (!startTime || !endTime || endTime <= startTime) {
          setErrorMsg(t.plans.invalidTimeRange);
          return;
        }
        await logSession.mutateAsync({
          studio_id: effectiveStudioId,
          course_plan_slot_id: null,
          course_type_id: effectiveCourseTypeId,
          date,
          start_time: startTime,
          end_time: endTime,
          is_substitution: isSubstitution,
          status,
          notes,
        });
      }

      router.push("/courses");
    } catch (error) {
      console.error(error);
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      setErrorMsg(code === "23505" ? t.trainer.duplicateError : t.trainer.saveError);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/courses"
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          <span>{t.trainer.backToCourses}</span>
        </Link>
        <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
          {t.trainer.logTitle}
        </h1>
      </div>

      {/* Mode Switcher: Geplanter Kurs (inkl. spontane Vertretung) vs. Ad-hoc */}
      <div
        role="tablist"
        className="grid grid-cols-2 rounded-xl border border-border bg-muted/60 p-1 md:max-w-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "planned"}
          onClick={() => {
            setErrorMsg(null);
            setMode("planned");
          }}
          className={cn(
            "rounded-lg py-2 text-sm font-semibold transition-colors",
            mode === "planned"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.trainer.modePlanned}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "adhoc"}
          onClick={() => {
            setErrorMsg(null);
            setMode("adhoc");
          }}
          className={cn(
            "rounded-lg py-2 text-sm font-semibold transition-colors",
            mode === "adhoc"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.trainer.modeAdHoc}
        </button>
      </div>

      {studiosLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : !studios || studios.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {t.trainer.noStudiosYet}
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        >
          {mode === "planned" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="log-date">{t.trainer.date}</Label>
                <Input
                  id="log-date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedSlotId("");
                  }}
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t.trainer.selectSlotHint}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAllWeekdays((v) => !v)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {showAllWeekdays
                      ? t.trainer.showSelectedWeekday
                      : t.trainer.showAllWeekdays}
                  </button>
                </div>

                {slotsLoading ? (
                  <p className="text-sm text-muted-foreground">{t.common.loading}</p>
                ) : visibleSlots.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {visibleSlots.map((sl) => {
                      const isSub = sl.scheduled_trainer_id !== session?.user.id;
                      const selected = activeSlot?.slot_id === sl.slot_id;
                      const accent = getCourseTypeAccent(sl.course_type_id);
                      return (
                        <button
                          key={sl.slot_id}
                          type="button"
                          onClick={() => setSelectedSlotId(sl.slot_id)}
                          className={cn(
                            "w-full rounded-xl border border-l-4 p-3.5 text-left transition-all",
                            accent.border,
                            selected
                              ? "border-primary bg-primary-50/70 ring-2 ring-primary/20 dark:bg-primary-950/50"
                              : "border-border bg-background/50 hover:border-primary-300"
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-heading text-sm font-bold text-foreground">
                              <CourseTypeIcon
                                courseTypeId={sl.course_type_id}
                                name={sl.course_type_name}
                                variant="plain"
                              />
                              {sl.course_type_name}
                            </span>
                            {isSub ? (
                              <Badge className="gap-1 bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
                                <Repeat className="size-3" />
                                <span>
                                  {t.trainer.substitutionFor} {sl.scheduled_trainer_name}
                                </span>
                              </Badge>
                            ) : (
                              <Badge variant="outline">{t.trainer.ownSlotLabel}</Badge>
                            )}
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock className="size-3" />
                              <span>
                                {t.plans.weekdaysShort[
                                  sl.weekday as keyof typeof t.plans.weekdaysShort
                                ]}
                                , {formatTimeShort(sl.start_time)}–{formatTimeShort(sl.end_time)}
                              </span>
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              <span>{sl.studio_name}</span>
                            </span>
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                    <p>{t.trainer.noSlotsForDay}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {!showAllWeekdays && (studioSlots?.length ?? 0) > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAllWeekdays(true)}
                        >
                          {t.trainer.showAllWeekdays}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMode("adhoc")}
                      >
                        {t.trainer.modeAdHoc}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="adhoc-studio">{t.trainer.studio}</Label>
                <Select
                  value={effectiveStudioId}
                  onValueChange={(v) => {
                    if (!v) return;
                    setStudioId(v);
                    setCourseTypeId("");
                  }}
                >
                  <SelectTrigger id="adhoc-studio" className="w-full">
                    <SelectValue placeholder={t.trainer.selectStudio}>
                      {(value: string) =>
                        studios.find((s) => s.studio_id === value)?.studio_name ??
                        t.trainer.selectStudio
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {studios.map((s) => (
                      <SelectItem key={s.studio_id} value={s.studio_id}>
                        {s.studio_name} ({s.company_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adhoc-date">{t.trainer.date}</Label>
                <Input
                  id="adhoc-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="adhoc-start">{t.trainer.startTime}</Label>
                  <Input
                    id="adhoc-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adhoc-end">{t.trainer.endTime}</Label>
                  <Input
                    id="adhoc-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adhoc-course-type">{t.trainer.courseType}</Label>
                <Select
                  value={effectiveCourseTypeId}
                  onValueChange={handleCourseTypeChange}
                  disabled={!courseTypes || courseTypes.length === 0}
                >
                  <SelectTrigger id="adhoc-course-type" className="w-full">
                    <SelectValue placeholder={t.trainer.selectCourseType}>
                      {(value: string) =>
                        courseTypes?.find((ct) => ct.id === value)?.name ??
                        t.trainer.selectCourseType
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(courseTypes ?? []).map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.name} ({ct.default_duration_min} {t.courseTypes.minutesUnit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label
                htmlFor="adhoc-substitution"
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background/60 p-3.5"
              >
                <input
                  id="adhoc-substitution"
                  type="checkbox"
                  checked={isSubstitution}
                  onChange={(e) => setIsSubstitution(e.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <span className="text-sm font-medium">{t.trainer.wasSubstitution}</span>
              </label>
            </div>
          )}

          {/* Status & Notizen */}
          <div className="space-y-4 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label>{t.trainer.statusLabel}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("completed")}
                  className={cn(
                    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors",
                    status === "completed"
                      ? "border-success bg-success-bg text-success"
                      : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Check className="size-4" />
                  <span>{t.trainer.statusCompleted}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("cancelled")}
                  className={cn(
                    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors",
                    status === "cancelled"
                      ? "border-destructive bg-destructive-bg text-destructive"
                      : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <XCircle className="size-4" />
                  <span>{t.trainer.statusCancelled}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-notes">{t.trainer.notes}</Label>
              <textarea
                id="log-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.trainer.notesPlaceholder}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive-bg px-3.5 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <Button
              type="submit"
              size="lg"
              disabled={
                logSession.isPending ||
                (mode === "planned" ? !activeSlot : !effectiveStudioId || !effectiveCourseTypeId)
              }
              className="h-11 w-full gap-2"
            >
              <Check className="size-4" />
              <span>{t.trainer.saveCourse}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/courses")}
              className="w-full"
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
