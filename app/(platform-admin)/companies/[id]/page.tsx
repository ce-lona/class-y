"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useCompany } from "@/hooks/useCompanies";
import { useStudios, useCreateStudio } from "@/hooks/useStudios";
import { createStudioSchema, type CreateStudioInput } from "@/lib/validators";
import { t } from "@/i18n/de";

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const {
    data: isPlatformAdmin,
    isLoading: roleLoading,
    isError: roleError,
  } = useIsPlatformAdmin();
  const { data: company, isLoading: companyLoading } = useCompany(id);
  const { data: studios, isLoading: studiosLoading } = useStudios(id);
  const createStudio = useCreateStudio(id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudioInput>({ resolver: zodResolver(createStudioSchema) });

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace("/login");
    }
  }, [sessionLoading, session, router]);

  async function onSubmit(values: CreateStudioInput) {
    await createStudio.mutateAsync({ company_id: id, ...values });
    reset();
  }

  if (sessionLoading || roleLoading || companyLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (roleError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-destructive">{t.common.error}</p>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">{t.companies.unauthorized}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/companies" className="text-sm text-muted-foreground underline">
          {t.studios.back}
        </Link>
        <h1 className="text-2xl font-semibold">{company?.name}</h1>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">{t.studios.title}</h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t.studios.name}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">{t.studios.address}</Label>
            <Input id="address" {...register("address")} />
          </div>

          {createStudio.isError && (
            <p className="text-sm text-destructive">{t.studios.createError}</p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {t.studios.create}
          </Button>
        </form>

        <div className="space-y-2">
          {studiosLoading ? (
            <p className="text-muted-foreground">{t.common.loading}</p>
          ) : studios && studios.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border">
              {studios.map((studio) => (
                <li key={studio.id} className="p-3">
                  <p className="font-medium">{studio.name}</p>
                  {studio.address && (
                    <p className="text-sm text-muted-foreground">{studio.address}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t.studios.empty}</p>
          )}
        </div>
      </div>
    </div>
  );
}
