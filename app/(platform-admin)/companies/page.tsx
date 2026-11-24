"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronRight, MapPin, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/address-fields";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useCompanies, useCreateCompany } from "@/hooks/useCompanies";
import { createCompanySchema, type CreateCompanyInput } from "@/lib/validators";
import { formatAddress } from "@/lib/address";
import { t } from "@/i18n/de";

export default function CompaniesPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const {
    data: isPlatformAdmin,
    isLoading: roleLoading,
    isError: roleError,
  } = useIsPlatformAdmin();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const createCompany = useCreateCompany();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: { country: "DE" },
  });

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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
            {t.companies.title}
          </h1>
          {companies && (
            <Badge variant="secondary" className="font-semibold">
              {companies.length}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t.companies.subtitle}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <Building2 className="size-4 text-primary" />
            <h2 className="font-heading text-base font-bold">{t.companies.listTitle}</h2>
          </div>

          {companiesLoading ? (
            <p className="p-5 text-sm text-muted-foreground">{t.common.loading}</p>
          ) : companies && companies.length > 0 ? (
            <ul className="divide-y divide-border">
              {companies.map((company) => {
                const formatted = formatAddress(company);
                return (
                  <li key={company.id}>
                    <Link
                      href={`/companies/${company.id}`}
                      className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
                          <Building2 className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold group-hover:text-primary">
                            {company.name}
                          </p>
                          {formatted && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span className="truncate">{formatted}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <Building2 className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t.companies.empty}</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
              <Plus className="size-4" />
            </div>
            <h2 className="font-heading text-base font-bold">{t.companies.newTitle}</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t.companies.name}</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <AddressFields register={register} control={control} />

            {createCompany.isError && (
              <p className="text-sm text-destructive">{t.companies.createError}</p>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full gap-1.5">
              <Plus className="size-4" />
              <span>{t.companies.create}</span>
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
