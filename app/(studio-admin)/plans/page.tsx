"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Calendar,
  Check,
  Clock,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudioScheduleSection } from "@/components/studio-schedule-section";
import { WeeklyTimetable, type TimetableSlot } from "@/components/weekly-timetable";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useStudios } from "@/hooks/useStudios";
import { useCompanyActiveSlots } from "@/hooks/useCoursePlans";
import {
  useCourseTypes,
  useCreateCourseType,
  useDeleteCourseType,
  useUpdateCourseType,
} from "@/hooks/useCourseTypes";
import { isCourseTypeAvailableInStudio, type CourseType } from "@/lib/courseTypes";
import type { Studio } from "@/lib/studios";
import { getCourseTypeAccent } from "@/lib/format";
import { courseTypeSchema, type CourseTypeFormInput } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

function StudioScopePicker({
  studios,
  restricted,
  selectedStudioIds,
  onRestrictedChange,
  onToggleStudio,
  scopeError,
}: {
  studios: Studio[];
  restricted: boolean;
  selectedStudioIds: string[];
  onRestrictedChange: (next: boolean) => void;
  onToggleStudio: (studioId: string) => void;
  scopeError?: string | null;
}) {
  if (studios.length === 0) return null;

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-muted/35 p-3.5">
      <p className="text-xs font-bold text-foreground">{t.courseTypes.studioScopeLabel}</p>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
        <input
          type="radio"
          checked={!restricted}
          onChange={() => onRestrictedChange(false)}
          className="size-3.5 accent-primary"
        />
        <span>{t.courseTypes.allStudios}</span>
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
        <input
          type="radio"
          checked={restricted}
          onChange={() => onRestrictedChange(true)}
          className="size-3.5 accent-primary"
        />
        <span>{t.courseTypes.selectedStudiosOnly}</span>
      </label>

      {restricted && (
        <div className="space-y-1.5 pl-5 pt-1">
          {studios.map((studio) => (
            <label
              key={studio.id}
              className="flex cursor-pointer items-center gap-2 text-xs text-foreground"
            >
              <input
                type="checkbox"
                checked={selectedStudioIds.includes(studio.id)}
                onChange={() => onToggleStudio(studio.id)}
                className="size-3.5 rounded accent-primary"
              />
              <span>{studio.name}</span>
            </label>
          ))}
        </div>
      )}

      {scopeError && <p className="text-xs text-destructive">{scopeError}</p>}
    </div>
  );
}

function CourseTypeCard({
  courseType,
  companyId,
  studios,
  canEdit,
  onDeleteError,
}: {
  courseType: CourseType;
  companyId: string;
  studios: Studio[];
  canEdit: boolean;
  onDeleteError: (message: string | null) => void;
}) {
  const updateCourseType = useUpdateCourseType(companyId);
  const deleteCourseType = useDeleteCourseType(companyId);
  const [editing, setEditing] = useState(false);
  const [restricted, setRestricted] = useState(courseType.studio_ids.length > 0);
  const [selectedStudioIds, setSelectedStudioIds] = useState<string[]>(courseType.studio_ids);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const accent = getCourseTypeAccent(courseType.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseTypeFormInput>({
    resolver: zodResolver(courseTypeSchema),
    defaultValues: {
      name: courseType.name,
      default_duration_min: String(courseType.default_duration_min),
    },
  });

  function toggleStudio(studioId: string) {
    setScopeError(null);
    setSelectedStudioIds((prev) =>
      prev.includes(studioId) ? prev.filter((id) => id !== studioId) : [...prev, studioId]
    );
  }

  async function onSubmit(values: CourseTypeFormInput) {
    onDeleteError(null);
    setScopeError(null);
    if (restricted && selectedStudioIds.length === 0) {
      setScopeError(t.courseTypes.selectAtLeastOneStudio);
      return;
    }
    await updateCourseType.mutateAsync({
      id: courseType.id,
      name: values.name,
      default_duration_min: Number(values.default_duration_min),
      studio_ids: restricted ? selectedStudioIds : [],
    });
    setEditing(false);
  }

  async function handleDelete() {
    onDeleteError(null);
    try {
      await deleteCourseType.mutateAsync(courseType.id);
    } catch (error) {
      console.error(error);
      onDeleteError(t.courseTypes.deleteError);
    }
  }

  const studioNames = courseType.studio_ids
    .map((id) => studios.find((s) => s.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  if (editing) {
    return (
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-3 rounded-xl border border-primary-300 bg-card p-4"
      >
        <div className="space-y-1">
          <Label htmlFor={`ct-name-${courseType.id}`}>{t.courseTypes.name}</Label>
          <Input id={`ct-name-${courseType.id}`} {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`ct-dur-${courseType.id}`}>{t.courseTypes.duration}</Label>
          <Input
            id={`ct-dur-${courseType.id}`}
            type="number"
            min={5}
            max={480}
            {...register("default_duration_min")}
          />
          {errors.default_duration_min && (
            <p className="text-xs text-destructive">{errors.default_duration_min.message}</p>
          )}
        </div>

        <StudioScopePicker
          studios={studios}
          restricted={restricted}
          selectedStudioIds={selectedStudioIds}
          onRestrictedChange={(next) => {
            setRestricted(next);
            setScopeError(null);
          }}
          onToggleStudio={toggleStudio}
          scopeError={scopeError}
        />

        {updateCourseType.isError && (
          <p className="text-xs text-destructive">{t.courseTypes.updateError}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1">
            <Check className="size-3.5" />
            <span>{t.common.save}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              reset({
                name: courseType.name,
                default_duration_min: String(courseType.default_duration_min),
              });
              setRestricted(courseType.studio_ids.length > 0);
              setSelectedStudioIds(courseType.studio_ids);
              setScopeError(null);
              setEditing(false);
            }}
          >
            {t.common.cancel}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border border-border border-l-[3px] bg-card p-4 transition-colors hover:border-primary-300 dark:hover:border-primary-700",
        accent.border
      )}
    >
      <div className="min-w-0 space-y-2">
        <p className="truncate font-heading text-base font-bold">{courseType.name}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="gap-1 font-medium">
            <Clock className="size-3" />
            <span>
              {courseType.default_duration_min} {t.courseTypes.minutesUnit}
            </span>
          </Badge>
          <Badge variant="outline" className="gap-1 font-medium text-muted-foreground">
            <Building2 className="size-3" />
            <span className="truncate">
              {studioNames.length === 0 ? t.courseTypes.studioBadgeAll : studioNames.join(", ")}
            </span>
          </Badge>
        </div>
      </div>

      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${courseType.name} ${t.studioAdmin.edit}`}
            onClick={() => {
              onDeleteError(null);
              setRestricted(courseType.studio_ids.length > 0);
              setSelectedStudioIds(courseType.studio_ids);
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${courseType.name} ${t.courseTypes.delete}`}
            disabled={deleteCourseType.isPending}
            onClick={handleDelete}
            className="text-muted-foreground hover:bg-destructive-bg hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function CourseTypesTab({
  companyId,
  studios,
  canEdit,
}: {
  companyId: string;
  studios: Studio[];
  canEdit: boolean;
}) {
  const { data: courseTypes, isLoading } = useCourseTypes(companyId);
  const createCourseType = useCreateCourseType(companyId);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [studioFilter, setStudioFilter] = useState<string>("all");

  // Drawer scope state
  const [restricted, setRestricted] = useState(false);
  const [selectedStudioIds, setSelectedStudioIds] = useState<string[]>([]);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseTypeFormInput>({
    resolver: zodResolver(courseTypeSchema),
    defaultValues: { name: "", default_duration_min: "60" },
  });

  function resetDrawer() {
    reset({ name: "", default_duration_min: "60" });
    setRestricted(false);
    setSelectedStudioIds([]);
    setScopeError(null);
    setFormOpen(false);
  }

  function toggleStudio(studioId: string) {
    setScopeError(null);
    setSelectedStudioIds((prev) =>
      prev.includes(studioId) ? prev.filter((id) => id !== studioId) : [...prev, studioId]
    );
  }

  async function onSubmit(values: CourseTypeFormInput) {
    setDeleteError(null);
    setScopeError(null);
    if (restricted && selectedStudioIds.length === 0) {
      setScopeError(t.courseTypes.selectAtLeastOneStudio);
      return;
    }
    await createCourseType.mutateAsync({
      name: values.name,
      default_duration_min: Number(values.default_duration_min),
      studio_ids: restricted ? selectedStudioIds : [],
    });
    resetDrawer();
  }

  const visibleCourseTypes =
    courseTypes?.filter((ct) =>
      studioFilter === "all" ? true : isCourseTypeAvailableInStudio(ct, studioFilter)
    ) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-bold">{t.courseTypes.title}</h2>
            {courseTypes && (
              <Badge variant="secondary" className="font-semibold">
                {visibleCourseTypes.length}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t.courseTypes.subtitle}</p>
        </div>

        {canEdit && (
          <Button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setFormOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>{t.courseTypes.new}</span>
          </Button>
        )}
      </div>

      {studios.length > 1 && courseTypes && courseTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStudioFilter("all")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              studioFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{t.courseTypes.studioFilterAll}</span>
          </button>
          {studios.map((studio) => {
            const selected = studioFilter === studio.id;
            return (
              <button
                key={studio.id}
                type="button"
                onClick={() => setStudioFilter(studio.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Building2 className="size-3.5" />
                <span>{studio.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <Drawer
        open={formOpen}
        onClose={resetDrawer}
        title={t.courseTypes.new}
        description={t.courseTypes.subtitle}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="course-type-name">{t.courseTypes.name}</Label>
            <Input id="course-type-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-type-duration">{t.courseTypes.duration}</Label>
            <Input
              id="course-type-duration"
              type="number"
              min={5}
              max={480}
              {...register("default_duration_min")}
            />
            {errors.default_duration_min && (
              <p className="text-sm text-destructive">{errors.default_duration_min.message}</p>
            )}
          </div>

          <StudioScopePicker
            studios={studios}
            restricted={restricted}
            selectedStudioIds={selectedStudioIds}
            onRestrictedChange={(next) => {
              setRestricted(next);
              setScopeError(null);
            }}
            onToggleStudio={toggleStudio}
            scopeError={scopeError}
          />

          {createCourseType.isError && (
            <p className="text-sm text-destructive">{t.courseTypes.createError}</p>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {t.courseTypes.create}
            </Button>
            <Button type="button" variant="outline" onClick={resetDrawer}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </Drawer>

      {deleteError && (
        <div className="rounded-xl bg-destructive-bg px-4 py-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : visibleCourseTypes.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCourseTypes.map((ct) => (
            <CourseTypeCard
              key={ct.id}
              courseType={ct}
              companyId={companyId}
              studios={studios}
              canEdit={canEdit}
              onDeleteError={setDeleteError}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
            <Tag className="size-5" />
          </div>
          <p className="font-medium">{t.courseTypes.empty}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t.courseTypes.emptyHint}</p>
        </div>
      )}
    </div>
  );
}

function AllStudiosTimetable({
  companyId,
  studios,
}: {
  companyId: string;
  studios: Studio[];
}) {
  const { data: slots, isLoading } = useCompanyActiveSlots(companyId, studios);
  const [courseTypeFilter, setCourseTypeFilter] = useState<string>("all");

  const uniqueCourseTypes = Array.from(
    new Map((slots ?? []).map((s) => [s.course_type_id, s.course_type_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], "de"));

  const filtered: TimetableSlot[] = (slots ?? [])
    .filter((s) => courseTypeFilter === "all" || s.course_type_id === courseTypeFilter)
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
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {filtered.length}{" "}
          {filtered.length === 1 ? t.plans.courseSingular : t.plans.coursesPerWeek}
        </span>
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
            const accent = getCourseTypeAccent(id);
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
                <span
                  className={cn("size-2 rounded-full", selected ? "bg-primary-foreground" : accent.dot)}
                  aria-hidden="true"
                />
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length > 0 ? (
        <WeeklyTimetable slots={filtered} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-10 text-center">
          <Calendar className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t.plans.emptyAllStudios}</p>
        </div>
      )}
    </div>
  );
}

type PlansTab = "schedules" | "types";

function PlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: company } = useMyCompany();
  const companyId = company?.id ?? "";
  const { data: studios, isLoading: studiosLoading } = useStudios(companyId);

  const tabParam = searchParams.get("tab");
  const activeTab: PlansTab = tabParam === "types" ? "types" : "schedules";
  const studioParam = searchParams.get("studio");

  const showAllStudiosOption = (studios?.length ?? 0) > 1;
  const isAllStudios = showAllStudiosOption && studioParam === "all";
  const activeStudio = isAllStudios
    ? null
    : (studioParam ? studios?.find((s) => s.id === studioParam) : null) ?? studios?.[0] ?? null;

  function setTab(next: PlansTab) {
    const params = new URLSearchParams();
    if (next === "types") params.set("tab", "types");
    if (next === "schedules") {
      if (isAllStudios) params.set("studio", "all");
      else if (activeStudio) params.set("studio", activeStudio.id);
    }
    const qs = params.toString();
    router.replace(qs ? `/plans?${qs}` : "/plans", { scroll: false });
  }

  function selectStudio(studioId: string) {
    router.replace(`/plans?studio=${studioId}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
            {t.plans.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.plans.subtitle}</p>
        </div>

        <div role="tablist" className="inline-flex rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "schedules"}
            onClick={() => setTab("schedules")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              activeTab === "schedules"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calendar className="size-4" />
            <span>{t.plans.tabSchedules}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "types"}
            onClick={() => setTab("types")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              activeTab === "types"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Tag className="size-4" />
            <span>{t.plans.tabCourseTypes}</span>
          </button>
        </div>
      </div>

      {activeTab === "types" ? (
        <CourseTypesTab
          companyId={companyId}
          studios={studios ?? []}
          canEdit={company?.role !== "coordinator"}
        />
      ) : studiosLoading ? (
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
            <AllStudiosTimetable companyId={companyId} studios={studios} />
          ) : (
            activeStudio && (
              <StudioScheduleSection
                key={activeStudio.id}
                studioId={activeStudio.id}
                companyId={companyId}
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
