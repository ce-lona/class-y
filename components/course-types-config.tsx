"use client";

import { useState } from "react";
import { Building2, Check, Clock, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CourseTypeIcon } from "@/components/course-type-icon";
import {
  NoSearchResults,
  SearchInput,
  StudioFilterChips,
  matchesSearch,
} from "@/components/list-toolbar";
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
        <p className="flex min-w-0 items-center gap-2 font-heading text-base font-bold">
          <CourseTypeIcon courseTypeId={courseType.id} name={courseType.name} />
          <span className="truncate">{courseType.name}</span>
        </p>
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

export function CourseTypesConfig({
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
  const [search, setSearch] = useState("");

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
    courseTypes?.filter(
      (ct) =>
        (studioFilter === "all" || isCourseTypeAvailableInStudio(ct, studioFilter)) &&
        matchesSearch(search, ct.name)
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

      {courseTypes && courseTypes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <StudioFilterChips
            studios={studios}
            value={studioFilter}
            onChange={setStudioFilter}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t.courseTypes.searchPlaceholder}
            className="sm:ml-auto"
          />
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
      ) : courseTypes && courseTypes.length > 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <NoSearchResults
            onReset={() => {
              setSearch("");
              setStudioFilter("all");
            }}
          />
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

