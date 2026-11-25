"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, MapPin, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddressFields } from "@/components/address-fields";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useStudios, useCreateStudio } from "@/hooks/useStudios";
import { useActiveCoursePlan, usePlanSlots } from "@/hooks/useCoursePlans";
import { createStudioSchema, type CreateStudioInput } from "@/lib/validators";
import { formatAddress } from "@/lib/address";
import type { Studio } from "@/lib/studios";
import { t } from "@/i18n/de";

function PlanStatusBadge({ studioId }: { studioId: string }) {
  const { data: plan, isLoading } = useActiveCoursePlan(studioId);

  if (isLoading) return null;

  if (!plan) {
    return (
      <Badge className="gap-1.5 bg-warning-bg text-warning">
        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
        <span>{t.studioAdmin.noActivePlan}</span>
      </Badge>
    );
  }

  const since = new Date(plan.valid_from).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });

  return (
    <Badge className="gap-1.5 bg-success-bg text-success">
      <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
      <span>
        {t.studioAdmin.activePlanSince} {since}
      </span>
    </Badge>
  );
}

function StudioTrainerCount({ studioId }: { studioId: string }) {
  const { data: plan } = useActiveCoursePlan(studioId);
  const { data: slots } = usePlanSlots(plan?.id);

  if (!plan || !slots || slots.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const uniqueCount = new Set(slots.map((s) => s.trainer_id)).size;
  return <span className="font-medium text-foreground">{uniqueCount}</span>;
}

function StudioRow({ studio }: { studio: Studio }) {
  const addr = formatAddress(studio);
  return (
    <TableRow className="group">
      <TableCell>
        <Link
          href={`/studios/${studio.id}`}
          className="inline-flex items-center gap-2.5 font-semibold hover:text-primary"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
            <Building2 className="size-4" />
          </span>
          <span>{studio.name}</span>
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {addr ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground/70" />
            <span>{addr}</span>
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <PlanStatusBadge studioId={studio.id} />
      </TableCell>
      <TableCell>
        <StudioTrainerCount studioId={studio.id} />
      </TableCell>
      <TableCell className="w-8 text-right">
        <ChevronRight
          aria-hidden="true"
          className="inline-block size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        />
      </TableCell>
    </TableRow>
  );
}

export default function StudiosPage() {
  const { data: company } = useMyCompany();
  const { data: studios, isLoading } = useStudios(company?.id ?? "");
  const createStudio = useCreateStudio(company?.id ?? "");
  const [formOpen, setFormOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudioInput>({
    resolver: zodResolver(createStudioSchema),
    defaultValues: { country: "DE" },
  });

  async function onSubmit(values: CreateStudioInput) {
    if (!company) return;
    await createStudio.mutateAsync({ company_id: company.id, ...values });
    reset({ country: "DE" });
    setFormOpen(false);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
              {t.studios.title}
            </h1>
            {studios && (
              <Badge variant="secondary" className="font-semibold">
                {studios.length}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.studios.subtitle}</p>
        </div>

        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          <span>{t.studios.new}</span>
        </Button>
      </div>

      <Drawer
        open={formOpen}
        onClose={() => {
          reset({ country: "DE" });
          setFormOpen(false);
        }}
        title={t.studios.new}
        description={t.studios.subtitle}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t.studios.name}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <AddressFields register={register} control={control} />

          {createStudio.isError && (
            <p className="text-sm text-destructive">{t.studios.createError}</p>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {t.studios.create}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset({ country: "DE" });
                setFormOpen(false);
              }}
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </Drawer>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>
        ) : studios && studios.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.studios.name}</TableHead>
                <TableHead>{t.studioAdmin.address}</TableHead>
                <TableHead>{t.studioAdmin.currentPlan}</TableHead>
                <TableHead>{t.studioAdmin.trainerCount}</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {studios.map((studio) => (
                <StudioRow key={studio.id} studio={studio} />
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center gap-2.5 p-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
              <Building2 className="size-5" />
            </div>
            <p className="font-medium">{t.studios.empty}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t.studios.emptyHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
