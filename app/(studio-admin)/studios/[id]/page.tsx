"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  MapPin,
  Pencil,
  Users,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/address-fields";
import { useStudio, useUpdateStudio } from "@/hooks/useStudios";
import { useActiveCoursePlan } from "@/hooks/useCoursePlans";
import { createStudioSchema, type CreateStudioInput } from "@/lib/validators";
import { formatAddress } from "@/lib/address";
import { t } from "@/i18n/de";

function normalizeCountry(country: string | null | undefined): "DE" | "AT" | "CH" {
  return country === "AT" || country === "CH" ? country : "DE";
}

export default function StudioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: studio, isLoading } = useStudio(id);
  const { data: plan } = useActiveCoursePlan(id);
  const updateStudio = useUpdateStudio(id, studio?.company_id);
  const [editing, setEditing] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudioInput>({
    resolver: zodResolver(createStudioSchema),
    defaultValues: { name: "", country: "DE" },
  });

  useEffect(() => {
    if (!studio) return;
    reset({
      name: studio.name,
      street: studio.street ?? "",
      house_number: studio.house_number ?? "",
      postal_code: studio.postal_code ?? "",
      city: studio.city ?? "",
      country: normalizeCountry(studio.country),
    });
  }, [studio, reset]);

  if (isLoading) {
    return <p className="text-muted-foreground">{t.common.loading}</p>;
  }

  if (!studio) return null;

  const createdAt = new Date(studio.created_at).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function onSubmit(values: CreateStudioInput) {
    setSavedNotice(false);
    try {
      await updateStudio.mutateAsync(values);
      setEditing(false);
      setSavedNotice(true);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/studios"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        <span>{t.studioAdmin.backToStudios}</span>
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
            {studio.name}
          </h1>
          {plan ? (
            <Badge className="gap-1.5 bg-success-bg text-success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              <span>
                {t.studioAdmin.activePlanSince}{" "}
                {new Date(plan.valid_from).toLocaleDateString("de-DE")}
              </span>
            </Badge>
          ) : (
            <Badge className="gap-1.5 bg-warning-bg text-warning">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
              <span>{t.studioAdmin.noActivePlan}</span>
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setSavedNotice(false);
            setEditing((open) => !open);
          }}
        >
          {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
          <span>{editing ? t.common.cancel : t.studioAdmin.edit}</span>
        </Button>
      </div>

      {savedNotice && (
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-success-bg px-3.5 py-2.5 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{t.studios.updated}</span>
        </div>
      )}

      {editing ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mb-6 space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="studio-edit-name">{t.studios.name}</Label>
            <Input id="studio-edit-name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <AddressFields register={register} control={control} />

          {updateStudio.isError && (
            <p className="text-sm text-destructive">{t.studios.updateError}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={isSubmitting || updateStudio.isPending}>
              {t.common.save}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mb-7 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
              <MapPin className="size-4" />
            </div>
            <div>
              <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {t.studioAdmin.address}
              </div>
              <div className="text-sm font-medium">{formatAddress(studio) ?? "—"}</div>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
              <CalendarDays className="size-4" />
            </div>
            <div>
              <div className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {t.studioAdmin.createdAt}
              </div>
              <div className="text-sm font-medium">{createdAt}</div>
            </div>
          </div>
        </div>
      )}

      <section className="mb-7 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary" />
          <h2 className="font-heading text-lg font-bold">{t.studioAdmin.currentPlan}</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          {plan ? (
            <p className="text-sm text-muted-foreground">
              {t.studioAdmin.activePlanSince}{" "}
              {new Date(plan.valid_from).toLocaleDateString("de-DE")}
            </p>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Calendar className="size-4 shrink-0 opacity-50" />
              <p>{t.studioAdmin.noCurrentPlan}</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <h2 className="font-heading text-lg font-bold">{t.studioAdmin.trainersAtStudio}</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Users className="size-4 shrink-0 opacity-50" />
            <p>{t.studioAdmin.noTrainers}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
