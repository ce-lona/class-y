"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
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
import { useActiveCoursePlan } from "@/hooks/useCoursePlans";
import { createStudioSchema, type CreateStudioInput } from "@/lib/validators";
import { formatAddress } from "@/lib/address";
import type { Studio } from "@/lib/studios";
import { t } from "@/i18n/de";

function PlanStatusBadge({ studioId }: { studioId: string }) {
  const { data: plan, isLoading } = useActiveCoursePlan(studioId);

  if (isLoading) return null;

  if (!plan) {
    return (
      <Badge className="bg-warning-bg text-warning">{t.studioAdmin.noActivePlan}</Badge>
    );
  }

  const since = new Date(plan.valid_from).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });

  return (
    <Badge className="bg-success-bg text-success">
      {t.studioAdmin.activePlanSince} {since}
    </Badge>
  );
}

function StudioRow({ studio }: { studio: Studio }) {
  return (
    <TableRow>
      <TableCell>
        <Link href={`/studios/${studio.id}`} className="font-semibold hover:underline">
          {studio.name}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatAddress(studio)}</TableCell>
      <TableCell>
        <PlanStatusBadge studioId={studio.id} />
      </TableCell>
      <TableCell className="text-muted-foreground">—</TableCell>
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
    reset();
    setFormOpen(false);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="font-heading text-[28px] font-extrabold">{t.studios.title}</h1>
        <Button onClick={() => setFormOpen((open) => !open)}>
          <Plus className="size-4" />
          {t.studios.new}
        </Button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mb-6 space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">{t.studios.name}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <AddressFields register={register} control={control} />

          {createStudio.isError && (
            <p className="text-sm text-destructive">{t.studios.createError}</p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {t.studios.create}
          </Button>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-5 text-muted-foreground">{t.common.loading}</p>
        ) : studios && studios.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.studios.name}</TableHead>
                <TableHead>{t.studioAdmin.address}</TableHead>
                <TableHead>{t.studioAdmin.currentPlan}</TableHead>
                <TableHead>{t.studioAdmin.trainerCount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studios.map((studio) => (
                <StudioRow key={studio.id} studio={studio} />
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-muted-foreground">{t.studios.empty}</p>
        )}
      </div>
    </div>
  );
}
