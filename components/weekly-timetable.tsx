"use client";

import { useState } from "react";
import { Building2, Clock, MapPin, Pencil, Trash2 } from "lucide-react";
import { formatTimeShort, getCourseTypeAccent, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CourseTypeIcon } from "@/components/course-type-icon";
import { t } from "@/i18n/de";

export interface TimetableSlot {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  course_type_id: string;
  course_type_name: string;
  trainer_id: string;
  trainer_name: string | null;
  trainer_email: string;
  studio_name?: string | null;
  company_name?: string | null;
  /** Für kombinierte Ansichten: Studio und ursprüngliche Slot-ID, um zum Bearbeiten zu springen. */
  studio_id?: string;
  source_slot_id?: string;
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function sortSlots(slots: TimetableSlot[]): TimetableSlot[] {
  return [...slots].sort((a, b) => {
    const startCmp = formatTimeShort(a.start_time).localeCompare(formatTimeShort(b.start_time));
    if (startCmp !== 0) return startCmp;
    return formatTimeShort(a.end_time).localeCompare(formatTimeShort(b.end_time));
  });
}

function SlotCard({
  slot,
  onRemove,
  onEdit,
  isEditing,
  hideTrainer,
}: {
  slot: TimetableSlot;
  onRemove?: (id: string) => void;
  onEdit?: (slot: TimetableSlot) => void;
  isEditing?: boolean;
  hideTrainer?: boolean;
}) {
  const accent = getCourseTypeAccent(slot.course_type_id);
  const displayName = slot.trainer_name || slot.trainer_email;

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border border-l-[3px] bg-background/60 p-2.5 transition-colors hover:border-primary-300 dark:bg-card/80 dark:hover:border-primary-700",
        accent.border,
        isEditing && "ring-2 ring-primary ring-offset-1 ring-offset-card"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-tight text-muted-foreground tabular-nums">
          <Clock className="size-3 shrink-0" />
          <span>
            {formatTimeShort(slot.start_time)}–{formatTimeShort(slot.end_time)}
          </span>
        </span>
        {(onEdit || onRemove) && (
          <span className="flex items-center gap-0.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(slot)}
                aria-label={`${slot.course_type_name} ${t.plans.editSlot}`}
                title={t.plans.editSlot}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-primary-50 hover:text-primary dark:hover:bg-primary-900/40"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(slot.id)}
                aria-label={t.plans.removeSlot}
                title={t.plans.removeSlot}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive-bg hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </span>
        )}
      </div>

      <p className="mt-1 flex items-start gap-1.5 font-heading text-sm font-bold leading-snug text-foreground">
        <CourseTypeIcon
          courseTypeId={slot.course_type_id}
          name={slot.course_type_name}
          variant="plain"
          className="mt-0.5"
        />
        <span className="min-w-0">{slot.course_type_name}</span>
      </p>

      {!hideTrainer && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
            {getInitials(slot.trainer_name, slot.trainer_email)}
          </span>
          <span className="truncate text-xs text-muted-foreground">{displayName}</span>
        </div>
      )}

      {(slot.company_name || slot.studio_name) && (
        <div className="mt-2 space-y-0.5 border-t border-border/70 pt-1.5 text-[11px] text-muted-foreground">
          {slot.company_name && (
            <p className="flex items-center gap-1 truncate font-semibold text-foreground/85">
              <Building2 className="size-3 shrink-0 text-primary" />
              <span className="truncate">{slot.company_name}</span>
            </p>
          )}
          {slot.studio_name && (
            <p className="flex items-center gap-1 truncate">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{slot.studio_name}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function WeeklyTimetable({
  slots,
  onRemoveSlot,
  onEditSlot,
  editingSlotId,
  hideTrainer = false,
}: {
  slots: TimetableSlot[];
  onRemoveSlot?: (id: string) => void;
  onEditSlot?: (slot: TimetableSlot) => void;
  editingSlotId?: string | null;
  hideTrainer?: boolean;
}) {
  const firstDayWithSlots = WEEKDAYS.find((day) => slots.some((s) => s.weekday === day)) ?? 1;
  const [selectedDay, setSelectedDay] = useState<number>(firstDayWithSlots);

  const byDay = new Map<number, TimetableSlot[]>();
  for (const day of WEEKDAYS) {
    byDay.set(day, sortSlots(slots.filter((s) => s.weekday === day)));
  }

  const mobileDaySlots = byDay.get(selectedDay) ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Desktop: 7-Spalten-Wochenplan (Mo–So) */}
      <div className="hidden lg:grid lg:grid-cols-7 lg:divide-x lg:divide-border">
        {WEEKDAYS.map((day) => {
          const daySlots = byDay.get(day) ?? [];
          return (
            <div key={day} className="flex min-w-0 flex-col">
              <div className="flex items-center justify-between gap-1 border-b border-border bg-muted/35 px-3 py-2.5">
                <span className="font-heading text-xs font-bold tracking-wide text-foreground uppercase">
                  {t.plans.weekdays[day]}
                </span>
                {daySlots.length > 0 && (
                  <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] leading-none font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
                    {daySlots.length}
                  </span>
                )}
              </div>

              <div className="flex min-h-[210px] flex-1 flex-col gap-2 p-2.5">
                {daySlots.length > 0 ? (
                  daySlots.map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      onRemove={onRemoveSlot}
                      onEdit={onEditSlot}
                      isEditing={editingSlotId === slot.id}
                      hideTrainer={hideTrainer}
                    />
                  ))
                ) : (
                  <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground/50">
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile / Tablet: Tages-Tabs Mo–So */}
      <div className="lg:hidden">
        <div className="grid grid-cols-7 gap-1 border-b border-border bg-muted/35 p-2">
          {WEEKDAYS.map((day) => {
            const count = (byDay.get(day) ?? []).length;
            const active = selectedDay === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{t.plans.weekdaysShort[day]}</span>
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    count === 0
                      ? "bg-transparent"
                      : active
                        ? "bg-primary-foreground"
                        : "bg-primary"
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-bold">
              {t.plans.weekdays[selectedDay as keyof typeof t.plans.weekdays]}
            </h3>
            <span className="text-xs text-muted-foreground">
              {mobileDaySlots.length}{" "}
              {mobileDaySlots.length === 1 ? t.plans.courseSingular : t.plans.coursesPerWeek}
            </span>
          </div>

          {mobileDaySlots.length > 0 ? (
            <div className="space-y-2.5">
              {mobileDaySlots.map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  onRemove={onRemoveSlot}
                  onEdit={onEditSlot}
                  isEditing={editingSlotId === slot.id}
                  hideTrainer={hideTrainer}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              {t.plans.noCoursesOnDay}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
