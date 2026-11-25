"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronRight, MapPin, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/address-fields";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useCompanies, useCreateCompany } from "@/hooks/useCompanies";
import { createCompanySchema, type CreateCompanyInput } from "@/lib/validators";
import { formatAddress } from "@/lib/address";
import { getInitials } from "@/lib/format";
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
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    reset({ country: "DE" });
    setDrawerOpen(false);
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
      <div className="flex flex-wrap items-start justify-between gap-4">
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

        <Button onClick={() => setDrawerOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          <span>{t.companies.newTitle}</span>
        </Button>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => {
          reset({ country: "DE" });
          setDrawerOpen(false);
        }}
        title={t.companies.newTitle}
        description={t.companies.subtitle}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t.companies.name}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <AddressFields register={register} control={control} />

          {createCompany.isError && (
            <p className="text-sm text-destructive">{t.companies.createError}</p>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1 gap-1.5">
              <Plus className="size-4" />
              <span>{t.companies.create}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset({ country: "DE" });
                setDrawerOpen(false);
              }}
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </Drawer>

      {companiesLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : companies && companies.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {companies.map((company) => {
            const formatted = formatAddress(company);
            return (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary-300 dark:hover:border-primary-700"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
                    {getInitials(company.name, null)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-bold group-hover:text-primary">
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
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-10 text-center">
          <Building2 className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t.companies.empty}</p>
        </div>
      )}
    </div>
  );
}
