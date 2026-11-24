"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, Check, Info, Plus, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeeklyTimetable, type TimetableSlot } from "@/components/weekly-timetable";
import { useCourseTypes } from "@/hooks/useCourseTypes";
import { useCompanyActiveTrainers, usePublishCoursePlan } from "@/hooks/useCoursePlans";
import type { CoursePlan, PlanSlotDetailed } from "@/lib/coursePlans";
import { addMinutesToTime, formatTimeShort, todayISO } from "@/lib/format";
import { t } from "@/i18n/de";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function CoursePlanEditor({
  studioId,
  companyId,
  existingPlan,
  existingSlots,
  onCancel,
  onPublished,
}: {
  studioId: string;
  companyId: string;
  existingPlan: CoursePlan | null;
  existingSlots: PlanSlotDetailed[];
  onCancel: () => void;
  onPublished: () => void;
}) {
  const { data: courseTypes, isLoading: typesLoading } = useCourseTypes(companyId);
  const { data: trainers, isLoading: trainersLoading } = useCompanyActiveTrainers(companyId);
  const publishPlan = usePublishCoursePlan(studioId);

  const defaultValidFrom =
    existingPlan && existingPlan.valid_from > todayISO() ? existingPlan.valid_from : todayISO();

  const [validFrom, setValidFrom] = useState(defaultValidFrom);
  const [draftSlots, setDraftSlots] = useState<TimetableSlot[]>(() =>
    existingSlots.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      start_time: formatTimeShort(s.start_time),
      end_time: formatTimeShort(s.end_time),
      course_type_id: s.course_type_id,
      course_type_name: s.course_type_name,
      trainer_id: s.trainer_id,
      trainer_name: s.trainer_name,
      trainer_email: s.trainer_email,
    }))
  );

  const [weekday, setWeekday] = useState<string>("1");
  const [startTime, setStartTime] = useState<string>("18:00");
  const [endTime, setEndTime] = useState<string>("19:00");
  const [courseTypeId, setCourseTypeId] = useState<string>("");
  const [trainerId, setTrainerId] = useState<string>("");
  const [slotError, setSlotError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const selectedCourseType =
    courseTypes?.find((ct) => ct.id === courseTypeId) ?? courseTypes?.[0] ?? null;
  const effectiveCourseTypeId = courseTypeId || selectedCourseType?.id || "";

  const selectedTrainer =
    trainers?.find((tr) => tr.trainer_id === trainerId) ?? trainers?.[0] ?? null;
  const effectiveTrainerId = trainerId || selectedTrainer?.trainer_id || "";

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
    if (selectedCourseType && nextStart) {
      setEndTime(addMinutesToTime(nextStart, selectedCourseType.default_duration_min));
    }
  }

  function handleAddSlot() {
    setSlotError(null);
    setPublishError(null);

    if (!effectiveCourseTypeId || !selectedCourseType) {
      setSlotError(t.plans.missingCourseTypes);
      return;
    }
    if (!effectiveTrainerId || !selectedTrainer) {
      setSlotError(t.plans.missingTrainers);
      return;
    }
    if (!startTime || !endTime || endTime <= startTime) {
      setSlotError(t.plans.invalidTimeRange);
      return;
    }

    setDraftSlots((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        weekday: Number(weekday),
        start_time: startTime,
        end_time: endTime,
        course_type_id: selectedCourseType.id,
        course_type_name: selectedCourseType.name,
        trainer_id: selectedTrainer.trainer_id,
        trainer_name: selectedTrainer.full_name,
        trainer_email: selectedTrainer.email,
      },
    ]);
  }

  function handleRemoveSlot(id: string) {
    setDraftSlots((prev) => prev.filter((s) => s.id !== id));
  }

  async function handlePublish() {
    setPublishError(null);
    if (!validFrom) {
      setPublishError(t.plans.validFromRequired);
      return;
    }
    if (draftSlots.length === 0) {
      setPublishError(t.plans.slotsRequired);
      return;
    }

    try {
      await publishPlan.mutateAsync({
        validFrom,
        slots: draftSlots.map((s) => ({
          weekday: s.weekday,
          start_time: s.start_time,
          end_time: s.end_time,
          course_type_id: s.course_type_id,
          trainer_id: s.trainer_id,
        })),
      });
      onPublished();
    } catch (error) {
      console.error(error);
      setPublishError(t.plans.publishError);
    }
  }

  const noCourseTypes = !typesLoading && (courseTypes?.length ?? 0) === 0;
  const noTrainers = !trainersLoading && (trainers?.length ?? 0) === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-primary-200 bg-primary-50/70 p-4 dark:border-primary-800 dark:bg-primary-950/50">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="max-w-2xl text-sm text-foreground">{t.plans.versionBanner}</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="plan-valid-from" className="text-xs">
              {t.plans.validFrom}
            </Label>
            <Input
              id="plan-valid-from"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-40"
            />
          </div>

          <Button
            type="button"
            onClick={handlePublish}
            disabled={publishPlan.isPending || draftSlots.length === 0}
            className="gap-1.5"
          >
            <Check className="size-4" />
            <span>{existingPlan ? t.plans.publishPlan : t.plans.publishFirstPlan}</span>
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className="gap-1.5">
            <X className="size-4" />
            <span>{t.common.cancel}</span>
          </Button>
        </div>
      </div>

      {publishError && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive-bg px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{publishError}</span>
        </div>
      )}

      {(noCourseTypes || noTrainers) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>
              {noCourseTypes ? t.plans.missingCourseTypes : t.plans.missingTrainers}
            </span>
          </div>
          <Link
            href={noCourseTypes ? "/plans?tab=types" : "/trainers"}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {noCourseTypes ? t.plans.goToCourseTypes : t.plans.goToTrainers}
          </Link>
        </div>
      )}

      {/* Quick-Add-Leiste zum Hinzufügen eines Slots */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3.5 flex items-center gap-2">
          <Plus className="size-4 text-primary" />
          <h3 className="font-heading text-sm font-bold">{t.plans.addSlotTitle}</h3>
        </div>

        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[135px_108px_108px_1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="slot-weekday">{t.plans.weekday}</Label>
            <Select value={weekday} onValueChange={(v) => v && setWeekday(v)}>
              <SelectTrigger id="slot-weekday" className="w-full">
                <SelectValue>
                  {(value: string) =>
                    t.plans.weekdays[Number(value) as keyof typeof t.plans.weekdays]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {t.plans.weekdays[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slot-start">{t.plans.startTime}</Label>
            <Input
              id="slot-start"
              type="time"
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slot-end">{t.plans.endTime}</Label>
            <Input
              id="slot-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slot-course-type">{t.plans.courseType}</Label>
            <Select
              value={effectiveCourseTypeId}
              onValueChange={handleCourseTypeChange}
              disabled={noCourseTypes}
            >
              <SelectTrigger id="slot-course-type" className="w-full">
                <SelectValue placeholder={t.plans.selectCourseType}>
                  {(value: string) =>
                    courseTypes?.find((ct) => ct.id === value)?.name ?? t.plans.selectCourseType
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

          <div className="space-y-1.5">
            <Label htmlFor="slot-trainer">{t.plans.trainer}</Label>
            <Select
              value={effectiveTrainerId}
              onValueChange={(v) => v && setTrainerId(v)}
              disabled={noTrainers}
            >
              <SelectTrigger id="slot-trainer" className="w-full">
                <SelectValue placeholder={t.plans.selectTrainer}>
                  {(value: string) => {
                    const tr = trainers?.find((item) => item.trainer_id === value);
                    return tr ? tr.full_name || tr.email : t.plans.selectTrainer;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(trainers ?? []).map((tr) => (
                  <SelectItem key={tr.trainer_id} value={tr.trainer_id}>
                    {tr.full_name ? `${tr.full_name} (${tr.email})` : tr.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleAddSlot}
            disabled={noCourseTypes || noTrainers}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>{t.plans.addSlot}</span>
          </Button>
        </div>

        {slotError && <p className="mt-2.5 text-sm text-destructive">{slotError}</p>}
      </div>

      {/* Live-Vorschau als 7-Spalten-Stundenplan mit Entfernen-Icons */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <Calendar className="size-3.5 text-primary" />
            <span>{t.plans.editPreviewHint}</span>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {draftSlots.length}{" "}
            {draftSlots.length === 1 ? t.plans.courseSingular : t.plans.coursesPerWeek}
          </span>
        </div>

        <WeeklyTimetable slots={draftSlots} onRemoveSlot={handleRemoveSlot} />
      </div>
    </div>
  );
}
