"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  FlaskConical,
  MapPin,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/address-fields";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useCompany } from "@/hooks/useCompanies";
import { useStudios, useCreateStudio } from "@/hooks/useStudios";
import {
  useCompanyAdmins,
  useAddCompanyAdmin,
  useCreateTestAdmin,
} from "@/hooks/useCompanyAdmins";
import {
  createStudioSchema,
  type CreateStudioInput,
  addCompanyAdminSchema,
  type AddCompanyAdminInput,
  createTestAdminSchema,
  type CreateTestAdminInput,
} from "@/lib/validators";
import { CompanyOffboardingCard } from "@/components/privacy/company-offboarding-card";
import { CompanyPrivacyPanel } from "@/components/privacy/company-privacy-panel";
import { formatAddress } from "@/lib/address";
import { getInitials } from "@/lib/format";
import { t } from "@/i18n/de";

const isDev = process.env.NODE_ENV === "development";

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
  const { data: companyAdmins, isLoading: companyAdminsLoading } = useCompanyAdmins(id);
  const addCompanyAdmin = useAddCompanyAdmin(id);
  const createTestAdmin = useCreateTestAdmin(id);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [testAdminSuccess, setTestAdminSuccess] = useState<string | null>(null);

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

  const {
    register: registerAdmin,
    handleSubmit: handleSubmitAdmin,
    reset: resetAdmin,
    setError: setAdminError,
    formState: { errors: adminErrors, isSubmitting: isSubmittingAdmin },
  } = useForm<AddCompanyAdminInput>({ resolver: zodResolver(addCompanyAdminSchema) });

  const {
    register: registerTestAdmin,
    handleSubmit: handleSubmitTestAdmin,
    reset: resetTestAdmin,
    setError: setTestAdminError,
    formState: { errors: testAdminErrors, isSubmitting: isSubmittingTestAdmin },
  } = useForm<CreateTestAdminInput>({ resolver: zodResolver(createTestAdminSchema) });

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace("/login");
    }
  }, [sessionLoading, session, router]);

  async function onSubmit(values: CreateStudioInput) {
    await createStudio.mutateAsync({ company_id: id, ...values });
    reset();
  }

  async function onSubmitAdmin(values: AddCompanyAdminInput) {
    setAdminSuccess(null);
    try {
      const result = await addCompanyAdmin.mutateAsync(values.email);
      setAdminSuccess(result.invited ? t.companyAdmins.invited : t.companyAdmins.added);
      resetAdmin();
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : undefined;
      setAdminError("email", {
        message: detail ? `${t.companyAdmins.addError} (${detail})` : t.companyAdmins.addError,
      });
    }
  }

  async function onSubmitTestAdmin(values: CreateTestAdminInput) {
    setTestAdminSuccess(null);
    try {
      await createTestAdmin.mutateAsync(values);
      setTestAdminSuccess(t.companyAdmins.testAdminCreated);
      resetTestAdmin();
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : undefined;
      setTestAdminError("email", {
        message: detail
          ? `${t.companyAdmins.testAdminError} (${detail})`
          : t.companyAdmins.testAdminError,
      });
    }
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

  const companyAddress = company ? formatAddress(company) : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <div>
        <Link
          href="/companies"
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          <span>{t.studios.back}</span>
        </Link>

        <h1 className="font-heading text-2xl font-extrabold tracking-tight">
          {company?.name}
        </h1>
        {companyAddress && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span>{companyAddress}</span>
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
                <Users className="size-4" />
              </div>
              <h2 className="font-heading text-lg font-bold">{t.companyAdmins.title}</h2>
            </div>
            {companyAdmins && (
              <Badge variant="secondary" className="font-semibold">
                {companyAdmins.length}
              </Badge>
            )}
          </div>

          <form onSubmit={handleSubmitAdmin(onSubmitAdmin)} noValidate className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="admin-email" className="sr-only">
                {t.companyAdmins.email}
              </Label>
              <Input
                id="admin-email"
                type="email"
                placeholder={t.companyAdmins.email}
                {...registerAdmin("email")}
              />
              {adminErrors.email && (
                <p className="text-sm text-destructive">{adminErrors.email.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isSubmittingAdmin} className="shrink-0 gap-1.5">
              <UserPlus className="size-4" />
              <span>{t.companyAdmins.add}</span>
            </Button>
          </form>

          {adminSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-success-bg px-3 py-2 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{adminSuccess}</span>
            </div>
          )}

          {companyAdminsLoading ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : companyAdmins && companyAdmins.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {companyAdmins.map((admin) => (
                <li key={admin.user_id} className="flex items-center gap-3 p-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
                    {getInitials(admin.full_name, admin.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {admin.full_name || admin.email}
                    </p>
                    {admin.full_name && (
                      <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              {t.companyAdmins.empty}
            </p>
          )}

          {isDev && (
            <div className="rounded-lg border border-dashed border-border bg-background/60 p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <FlaskConical className="size-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{t.companyAdmins.testAdminTitle}</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{t.companyAdmins.testAdminHint}</p>

              <form
                onSubmit={handleSubmitTestAdmin(onSubmitTestAdmin)}
                noValidate
                className="flex flex-wrap gap-2"
              >
                <div className="min-w-44 flex-1 space-y-1.5">
                  <Label htmlFor="test-admin-email" className="sr-only">
                    {t.companyAdmins.email}
                  </Label>
                  <Input
                    id="test-admin-email"
                    type="email"
                    placeholder={t.companyAdmins.email}
                    {...registerTestAdmin("email")}
                  />
                  {testAdminErrors.email && (
                    <p className="text-sm text-destructive">{testAdminErrors.email.message}</p>
                  )}
                </div>
                <div className="min-w-36 flex-1 space-y-1.5">
                  <Label htmlFor="test-admin-password" className="sr-only">
                    {t.auth.password}
                  </Label>
                  <Input
                    id="test-admin-password"
                    type="password"
                    placeholder={t.auth.password}
                    {...registerTestAdmin("password")}
                  />
                  {testAdminErrors.password && (
                    <p className="text-sm text-destructive">{testAdminErrors.password.message}</p>
                  )}
                </div>
                <Button type="submit" variant="outline" disabled={isSubmittingTestAdmin}>
                  {t.companyAdmins.testAdminCreate}
                </Button>
              </form>

              {testAdminSuccess && (
                <p className="mt-2 text-sm text-success">{testAdminSuccess}</p>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
                <Building2 className="size-4" />
              </div>
              <h2 className="font-heading text-lg font-bold">{t.studios.title}</h2>
            </div>
            {studios && (
              <Badge variant="secondary" className="font-semibold">
                {studios.length}
              </Badge>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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

            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              <Plus className="size-4" />
              <span>{t.studios.create}</span>
            </Button>
          </form>

          <div className="border-t border-border pt-4">
            {studiosLoading ? (
              <p className="text-sm text-muted-foreground">{t.common.loading}</p>
            ) : studios && studios.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {studios.map((studio) => {
                  const addr = formatAddress(studio);
                  return (
                    <li key={studio.id} className="flex items-center gap-3 p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/40">
                        <Building2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{studio.name}</p>
                        {addr && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{addr}</span>
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {t.studios.empty}
              </p>
            )}
          </div>
        </section>
      </div>

      {company && <CompanyOffboardingCard company={company} />}
      {company && <CompanyPrivacyPanel companyId={company.id} companyName={company.name} />}
    </div>
  );
}
