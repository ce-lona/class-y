"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CalendarRange, MapPin, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { WeeklyTimetable, type TimetableSlot } from "@/components/weekly-timetable";
import { useAuthStore } from "@/store/authStore";
import { useTrainerStudioSlots } from "@/hooks/useCourseSessions";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

export default function TrainerSchedulePage() {
  const session = useAuthStore((s) => s.session);
  const { data: studioSlots, isLoading } = useTrainerStudioSlots();

  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [studioFilter, setStudioFilter] = useState<string>("all");

  const ownSlots = (studioSlots ?? []).filter(
    (sl) => sl.scheduled_trainer_id === session?.user.id
  );

  const companies = Array.from(
    new Map(ownSlots.map((sl) => [sl.company_id, sl.company_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], "de"));

  const studios = Array.from(
    new Map(
      ownSlots
        .filter((sl) => companyFilter === "all" || sl.company_id === companyFilter)
        .map((sl) => [sl.studio_id, sl.studio_name])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], "de"));

  const filteredSlots: TimetableSlot[] = ownSlots
    .filter((sl) => {
      if (companyFilter !== "all" && sl.company_id !== companyFilter) return false;
      if (studioFilter !== "all" && sl.studio_id !== studioFilter) return false;
      return true;
    })
    .map((sl) => ({
      id: sl.slot_id,
      weekday: sl.weekday,
      start_time: sl.start_time,
      end_time: sl.end_time,
      course_type_id: sl.course_type_id,
      course_type_name: sl.course_type_name,
      trainer_id: sl.scheduled_trainer_id,
      trainer_name: sl.scheduled_trainer_name,
      trainer_email: "",
      company_name: sl.company_name,
      studio_name: sl.studio_name,
    }));

  const showFilterBar = companies.length > 1 || studios.length > 1;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            {t.trainer.scheduleTitle}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.trainer.scheduleSubtitle}</p>
        </div>

        <Link
          href="/courses/log"
          className={cn(buttonVariants({ size: "default" }), "gap-1.5")}
        >
          <Plus className="size-4" />
          <span>{t.trainer.logCourse}</span>
        </Link>
      </div>

      {showFilterBar && (
        <div className="space-y-2.5 rounded-xl border border-border bg-card p-4">
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
              {studios.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStudioFilter(id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                    studioFilter === id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : filteredSlots.length > 0 ? (
        <WeeklyTimetable slots={filteredSlots} hideTrainer />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
            <CalendarRange className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            {ownSlots.length === 0 ? t.trainer.emptyWeek : t.trainer.noScheduledCourses}
          </p>
        </div>
      )}
    </div>
  );
}
