"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useCompanies, useCreateCompany } from "@/hooks/useCompanies";
import {
  createCompanySchema,
  countryOptions,
  type CreateCompanyInput,
} from "@/lib/validators";
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

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="street">{t.companies.street}</Label>
            <Input id="street" {...register("street")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="house_number">{t.companies.houseNumber}</Label>
            <Input id="house_number" {...register("house_number")} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="postal_code">{t.companies.postalCode}</Label>
            <Input id="postal_code" {...register("postal_code")} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="city">{t.companies.city}</Label>
            <Input id="city" {...register("city")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="country">{t.companies.country}</Label>
          <Controller
            control={control}
            name="country"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="country" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      countryOptions.find((option) => option.value === value)?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {countryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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
                {(company.street || company.city) && (
                  <p className="text-sm text-muted-foreground">
                    {[
                      [company.street, company.house_number].filter(Boolean).join(" "),
                      [company.postal_code, company.city].filter(Boolean).join(" "),
                      company.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
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
