"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useCompanies, useCreateCompany } from "@/hooks/useCompanies";
import { createCompanySchema, type CreateCompanyInput } from "@/lib/validators";
import { t } from "@/i18n/de";

export default function CompaniesPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { data: isPlatformAdmin, isLoading: roleLoading } = useIsPlatformAdmin();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const createCompany = useCreateCompany();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyInput>({ resolver: zodResolver(createCompanySchema) });

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace("/login");
    }
  }, [sessionLoading, session, router]);

  async function onSubmit(values: CreateCompanyInput) {
    await createCompany.mutateAsync(values);
    reset();
  }

  if (sessionLoading || roleLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
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
      <h1 className="text-2xl font-semibold">{t.companies.title}</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t.companies.name}</Label>
          <Input id="name" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="billing_address">{t.companies.billingAddress}</Label>
          <Input id="billing_address" {...register("billing_address")} />
        </div>

        {createCompany.isError && (
          <p className="text-sm text-destructive">{t.companies.createError}</p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {t.companies.create}
        </Button>
      </form>

      <div className="space-y-2">
        {companiesLoading ? (
          <p className="text-muted-foreground">{t.common.loading}</p>
        ) : companies && companies.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border">
            {companies.map((company) => (
              <li key={company.id} className="p-3">
                <p className="font-medium">{company.name}</p>
                {company.billing_address && (
                  <p className="text-sm text-muted-foreground">
                    {company.billing_address}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t.companies.empty}</p>
        )}
      </div>
    </div>
  );
}
