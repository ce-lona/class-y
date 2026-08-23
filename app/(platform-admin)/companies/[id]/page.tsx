"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/address-fields";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useCompany } from "@/hooks/useCompanies";
import { useStudios, useCreateStudio } from "@/hooks/useStudios";
import { useCompanyAdmins, useAddCompanyAdmin } from "@/hooks/useCompanyAdmins";
import {
  createStudioSchema,
  type CreateStudioInput,
  addCompanyAdminSchema,
  type AddCompanyAdminInput,
} from "@/lib/validators";
import { formatAddress } from "@/lib/address";
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
  const { data: companyAdmins, isLoading: companyAdminsLoading } = useCompanyAdmins(id);
  const addCompanyAdmin = useAddCompanyAdmin(id);

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
    try {
      await addCompanyAdmin.mutateAsync(values.email);
      resetAdmin();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.message === "user_not_found"
          ? t.companyAdmins.userNotFound
          : t.companyAdmins.addError;
      setAdminError("email", { message });
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/companies" className="text-sm text-muted-foreground underline">
          {t.studios.back}
        </Link>
        <h1 className="text-2xl font-semibold">{company?.name}</h1>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">{t.companyAdmins.title}</h2>

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
          <Button type="submit" disabled={isSubmittingAdmin}>
            {t.companyAdmins.add}
          </Button>
        </form>

        <div className="space-y-2">
          {companyAdminsLoading ? (
            <p className="text-muted-foreground">{t.common.loading}</p>
          ) : companyAdmins && companyAdmins.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border">
              {companyAdmins.map((admin) => (
                <li key={admin.user_id} className="p-3">
                  <p className="font-medium">{admin.full_name || admin.email}</p>
                  {admin.full_name && (
                    <p className="text-sm text-muted-foreground">{admin.email}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t.companyAdmins.empty}</p>
          )}
        </div>
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

          <AddressFields register={register} control={control} />

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
                  {formatAddress(studio) && (
                    <p className="text-sm text-muted-foreground">
                      {formatAddress(studio)}
                    </p>
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
