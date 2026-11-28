"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronRight, MapPin, Plus, Star } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { fillTemplate, formatDateDE } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Company } from "@/lib/companies";
import { CompanyBadge } from "@/components/app-shell/company-badge";
import { SearchInput, matchesSearch } from "@/components/list-toolbar";
import { useStudioCountsByCompany } from "@/hooks/useStudios";
import { useCompanyStore } from "@/store/companyStore";
import { t } from "@/i18n/de";

type OverviewFilter = "all" | "pinned" | "new" | "deletion";

/** Plattform-Übersicht: alle Companies mit Suche, Filter-Chips und Anheften. */
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
  const { data: studioCounts } = useStudioCountsByCompany(!!isPlatformAdmin);
  const pins = useCompanyStore((s) => s.pinnedCompanyIds);
  const togglePin = useCompanyStore((s) => s.togglePin);
  const selectCompany = useCompanyStore((s) => s.selectCompany);
  const [filter, setFilter] = useState<OverviewFilter>("all");
  const [search, setSearch] = useState("");
  const [monthAgo] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString());
  const filters: { id: OverviewFilter; label: string; fn: (c: Company) => boolean }[] = [
    { id: "all", label: t.platformOverview.filterAll, fn: () => true },
    { id: "pinned", label: t.platformOverview.filterPinned, fn: (c) => pins.includes(c.id) },
    { id: "new", label: t.platformOverview.filterNew, fn: (c) => c.created_at >= monthAgo },
    { id: "deletion", label: t.privacy.offboarding.badge, fn: (c) => !!c.deletion_scheduled_for },
  ];
  const activeFilter = filters.find((f) => f.id === filter) ?? filters[0];
  const visible = (companies ?? [])
    .filter((c) => activeFilter.fn(c) && matchesSearch(search, c.name, c.city))
    .sort(
      (a, b) =>
        Number(pins.includes(b.id)) - Number(pins.includes(a.id)) || a.name.localeCompare(b.name, "de")
    );

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
    <div className="flex w-full max-w-[1480px] flex-1 flex-col gap-4 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">
              {t.platformOverview.title}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {fillTemplate(t.platformOverview.subtitle, { count: companies?.length ?? 0 })}
          </p>
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

      <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-sm text-muted-foreground">
        <span>
          <b className="text-foreground tabular-nums">{companies?.length ?? 0}</b>{" "}
          {t.platformOverview.statCompanies}
        </span>
        <span>
          <b className="text-foreground tabular-nums">
            {Object.values(studioCounts ?? {}).reduce((sum, n) => sum + n, 0)}
          </b>{" "}
          {t.platformOverview.statStudios}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div role="group" className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const selected = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground/80 hover:border-muted-foreground"
                )}
              >
                <span>{f.label}</span>
                <span className={cn("font-bold tabular-nums", selected ? "text-background/75" : "text-muted-foreground")}>
                  {(companies ?? []).filter(f.fn).length}
                </span>
              </button>
            );
          })}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder={t.platformOverview.searchPlaceholder} />
      </div>

      {companiesLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : companies && companies.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr className="text-left text-[12.5px] font-bold text-muted-foreground">
                <th className="w-10 border-b border-border px-3.5 py-2.5" />
                <th className="border-b border-border px-3.5 py-2.5">{t.platformOverview.tableCompany}</th>
                <th className="border-b border-border px-3.5 py-2.5 text-right">{t.platformOverview.tableStudios}</th>
                <th className="border-b border-border px-3.5 py-2.5">{t.platformOverview.tableSince}</th>
                <th className="border-b border-border px-3.5 py-2.5" />
                <th className="border-b border-border px-3.5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((company) => {
                const pinned = pins.includes(company.id);
                const formatted = formatAddress(company);
                return (
                  <tr key={company.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/50">
                    <td className="px-3.5 py-2">
                      <button
                        type="button"
                        onClick={() => togglePin(company.id)}
                        aria-pressed={pinned}
                        aria-label={pinned ? t.switcher.unpin : t.switcher.pin}
                        className={cn(
                          "grid place-items-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                          pinned && "text-[#C98A12] hover:text-[#C98A12]"
                        )}
                      >
                        <Star className={cn("size-4", pinned && "fill-current")} />
                      </button>
                    </td>
                    <td className="px-3.5 py-2">
                      <Link href={`/companies/${company.id}`} className="group flex items-center gap-2.5">
                        <CompanyBadge id={company.id} name={company.name} className="size-7" />
                        <span className="min-w-0">
                          <span className="block font-bold group-hover:text-primary">{company.name}</span>
                          {formatted && (
                            <span className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span className="truncate">{formatted}</span>
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{studioCounts?.[company.id] ?? 0}</td>
                    <td className="px-3.5 py-2 text-[13px] whitespace-nowrap text-muted-foreground">
                      {formatDateDE(company.created_at.slice(0, 10))}
                    </td>
                    <td className="px-3.5 py-2">
                      {company.deletion_scheduled_for && (
                        <span className="rounded-md bg-destructive-bg px-2 py-px text-[12.5px] font-bold whitespace-nowrap text-destructive">
                          {t.privacy.offboarding.badge}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          selectCompany(company.id);
                          router.push("/overview");
                        }}
                        className="gap-1"
                      >
                        {t.platformOverview.open}
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="p-7 text-center text-sm text-muted-foreground">{t.platformOverview.empty}</p>
          )}
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
