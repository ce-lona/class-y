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
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudioScheduleSection } from "@/components/studio-schedule-section";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useStudios } from "@/hooks/useStudios";
import {
  useCourseTypes,
  useCreateCourseType,
  useDeleteCourseType,
  useUpdateCourseType,
} from "@/hooks/useCourseTypes";
import type { CourseType } from "@/lib/courseTypes";
import { getCourseTypeAccent } from "@/lib/format";
import { courseTypeSchema, type CourseTypeFormInput } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

function CourseTypeCard({
  courseType,
  companyId,
  onDeleteError,
}: {
  courseType: CourseType;
  companyId: string;
  onDeleteError: (message: string | null) => void;
}) {
  const updateCourseType = useUpdateCourseType(companyId);
  const deleteCourseType = useDeleteCourseType(companyId);
  const [editing, setEditing] = useState(false);
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

  async function onSubmit(values: CourseTypeFormInput) {
    onDeleteError(null);
    await updateCourseType.mutateAsync({
      id: courseType.id,
      name: values.name,
      default_duration_min: Number(values.default_duration_min),
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
        "flex items-center justify-between gap-3 rounded-xl border border-border border-l-[3px] bg-card p-4 transition-colors hover:border-primary-300 dark:hover:border-primary-700",
        accent.border
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="truncate font-heading text-base font-bold">{courseType.name}</p>
        <Badge variant="secondary" className="gap-1 font-medium">
          <Clock className="size-3" />
          <span>
            {courseType.default_duration_min} {t.courseTypes.minutesUnit}
          </span>
        </Badge>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${courseType.name} ${t.studioAdmin.edit}`}
          onClick={() => {
            onDeleteError(null);
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
    </div>
  );
}

function CourseTypesTab({ companyId }: { companyId: string }) {
  const { data: courseTypes, isLoading } = useCourseTypes(companyId);
  const createCourseType = useCreateCourseType(companyId);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseTypeFormInput>({
    resolver: zodResolver(courseTypeSchema),
    defaultValues: { name: "", default_duration_min: "60" },
  });

  async function onSubmit(values: CourseTypeFormInput) {
    setDeleteError(null);
    await createCourseType.mutateAsync({
      name: values.name,
      default_duration_min: Number(values.default_duration_min),
    });
    reset({ name: "", default_duration_min: "60" });
    setFormOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-bold">{t.courseTypes.title}</h2>
            {courseTypes && (
              <Badge variant="secondary" className="font-semibold">
                {courseTypes.length}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t.courseTypes.subtitle}</p>
        </div>

        <Button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setFormOpen((open) => !open);
          }}
          className="gap-1.5"
        >
          {formOpen ? <X className="size-4" /> : <Plus className="size-4" />}
          <span>{t.courseTypes.new}</span>
        </Button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="grid items-end gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_180px_auto]"
        >
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

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {t.courseTypes.create}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset({ name: "", default_duration_min: "60" });
                setFormOpen(false);
              }}
            >
              {t.common.cancel}
            </Button>
          </div>

          {createCourseType.isError && (
            <p className="text-sm text-destructive sm:col-span-3">
              {t.courseTypes.createError}
            </p>
          )}
        </form>
      )}

      {deleteError && (
        <div className="rounded-xl bg-destructive-bg px-4 py-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : courseTypes && courseTypes.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courseTypes.map((ct) => (
            <CourseTypeCard
              key={ct.id}
              courseType={ct}
              companyId={companyId}
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

  const activeStudio =
    (studioParam ? studios?.find((s) => s.id === studioParam) : null) ?? studios?.[0] ?? null;

  function setTab(next: PlansTab) {
    const params = new URLSearchParams();
    if (next === "types") params.set("tab", "types");
    if (activeStudio && next === "schedules") params.set("studio", activeStudio.id);
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
        <CourseTypesTab companyId={companyId} />
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
            {studios.map((studio) => {
              const selected = studio.id === activeStudio?.id;
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

          {activeStudio && (
            <StudioScheduleSection
              key={activeStudio.id}
              studioId={activeStudio.id}
              companyId={companyId}
            />
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
