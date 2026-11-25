"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Calendar } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StudioScheduleSection } from "@/components/studio-schedule-section";
import { WeeklyTimetable, type TimetableSlot } from "@/components/weekly-timetable";
import { CourseTypeIcon } from "@/components/course-type-icon";
import { SearchInput, matchesSearch } from "@/components/list-toolbar";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useStudios } from "@/hooks/useStudios";
import { useCompanyActiveSlots } from "@/hooks/useCoursePlans";
import type { Studio } from "@/lib/studios";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

function AllStudiosTimetable({
  companyId,
  studios,
  onEditSlot,
}: {
  companyId: string;
  studios: Studio[];
  onEditSlot: (studioId: string, slotId: string) => void;
}) {
  const { data: slots, isLoading } = useCompanyActiveSlots(companyId, studios);
  const [courseTypeFilter, setCourseTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const uniqueCourseTypes = Array.from(
    new Map((slots ?? []).map((s) => [s.course_type_id, s.course_type_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], "de"));

  const filtered: TimetableSlot[] = (slots ?? [])
    .filter((s) => courseTypeFilter === "all" || s.course_type_id === courseTypeFilter)
    .filter((s) =>
      matchesSearch(search, s.course_type_name, s.trainer_name, s.trainer_email, s.studio_name)
    )
    .map((s) => ({
      id: `${s.studio_id}-${s.id}`,
      weekday: s.weekday,
      start_time: s.start_time,
      end_time: s.end_time,
      course_type_id: s.course_type_id,
      course_type_name: s.course_type_name,
      trainer_id: s.trainer_id,
      trainer_name: s.trainer_name,
      trainer_email: s.trainer_email,
      studio_name: s.studio_name,
      studio_id: s.studio_id,
      source_slot_id: s.id,
    }));

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">{t.plans.allStudiosHint}</p>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t.monitoring.searchPlaceholder}
          />
          <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
            {filtered.length}{" "}
            {filtered.length === 1 ? t.plans.courseSingular : t.plans.coursesPerWeek}
          </span>
        </div>
      </div>

      {uniqueCourseTypes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCourseTypeFilter("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              courseTypeFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {t.plans.allCourseTypes}
          </button>
          {uniqueCourseTypes.map(([id, name]) => {
            const selected = courseTypeFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCourseTypeFilter(selected ? "all" : id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <CourseTypeIcon courseTypeId={id} name={name} variant="plain" inverted={selected} />
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length > 0 ? (
        <WeeklyTimetable
          slots={filtered}
          onEditSlot={(slot) => {
            if (slot.studio_id && slot.source_slot_id) {
              onEditSlot(slot.studio_id, slot.source_slot_id);
            }
          }}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-10 text-center">
          <Calendar className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t.plans.emptyAllStudios}</p>
        </div>
      )}
    </div>
  );
}

function PlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: company } = useMyCompany();
  const companyId = company?.id ?? "";
  const { data: studios, isLoading: studiosLoading } = useStudios(companyId);

  const studioParam = searchParams.get("studio");
  const editSlotParam = searchParams.get("editSlot");

  const showAllStudiosOption = (studios?.length ?? 0) > 1;
  const isAllStudios = showAllStudiosOption && studioParam === "all";
  const activeStudio = isAllStudios
    ? null
    : (studioParam ? studios?.find((s) => s.id === studioParam) : null) ?? studios?.[0] ?? null;

  function selectStudio(studioId: string) {
    router.replace(`/plans?studio=${studioId}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-heading text-[28px] font-extrabold tracking-tight">{t.plans.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.plans.subtitle}</p>
      </div>

      {studiosLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : !studios || studios.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
            <Building2 className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">{t.plans.noStudios}</p>
          <Link href="/studios" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t.plans.goToStudios}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {showAllStudiosOption && (
              <button
                type="button"
                onClick={() => selectStudio("all")}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  isAllStudios
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Calendar className="size-4" />
                <span>{t.plans.allStudios}</span>
              </button>
            )}
            {studios.map((studio) => {
              const selected = !isAllStudios && studio.id === activeStudio?.id;
              return (
                <button
                  key={studio.id}
                  type="button"
                  onClick={() => selectStudio(studio.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Building2 className="size-4" />
                  <span>{studio.name}</span>
                </button>
              );
            })}
          </div>

          {isAllStudios ? (
            <AllStudiosTimetable
              companyId={companyId}
              studios={studios}
              onEditSlot={(studioId, slotId) =>
                router.push(`/plans?studio=${studioId}&editSlot=${slotId}`, { scroll: false })
              }
            />
          ) : (
            activeStudio && (
              <StudioScheduleSection
                key={`${activeStudio.id}-${editSlotParam ?? ""}`}
                studioId={activeStudio.id}
                companyId={companyId}
                initialEditSlotId={editSlotParam}
                onEditDone={() => {
                  if (editSlotParam) selectStudio(activeStudio.id);
                }}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      }
    >
      <PlansContent />
    </Suspense>
  );
}
