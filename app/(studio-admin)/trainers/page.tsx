"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Send, Users } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContractStatusBadge,
  formatContractTerms,
  formatContractValidity,
} from "@/components/contract-status-badge";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { useCompanyContracts, useEndContract, useOfferContract } from "@/hooks/useContracts";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  employmentTypeOptions,
  offerContractSchema,
  parseRateAmount,
  rateModelOptions,
  suggestEmailTypo,
  type OfferContractFormInput,
} from "@/lib/validators";
import { t } from "@/i18n/de";

type ContractFilter = "activeOpen" | "active" | "pending" | "archived" | "all";

export default function TrainersPage() {
  const { data: company } = useMyCompany();
  const companyId = company?.id ?? "";
  const { data: contracts, isLoading, isError } = useCompanyContracts(companyId);
  const offer = useOfferContract(companyId);
  const end = useEndContract(companyId);

  const [formOpen, setFormOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContractFilter>("activeOpen");

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OfferContractFormInput>({
    resolver: zodResolver(offerContractSchema),
    defaultValues: { employmentType: "freelancer", rateModel: "per_course" },
  });

  const watchedEmail = useWatch({ control, name: "email" }) ?? "";
  const emailSuggestion = suggestEmailTypo(watchedEmail);

  async function onSubmit(values: OfferContractFormInput) {
    if (!company) return;
    setSuccess(null);
    try {
      const result = await offer.mutateAsync({
        companyId: company.id,
        email: values.email,
        employmentType: values.employmentType,
        rateModel: values.rateModel,
        rateAmount: parseRateAmount(values.rateAmount),
        validFrom: values.validFrom,
        validTo: values.validTo || null,
      });
      setSuccess(result.invited ? t.contracts.invited : t.contracts.offered);
      reset();
      setFormOpen(false);
      if (filter === "archived") {
        setFilter("activeOpen");
      }
    } catch (error) {
      console.error(error);
      setError("email", { message: t.contracts.offerError });
    }
  }

  const counts = {
    activeOpen:
      contracts?.filter((c) => c.status === "active" || c.status === "pending").length ?? 0,
    active: contracts?.filter((c) => c.status === "active").length ?? 0,
    pending: contracts?.filter((c) => c.status === "pending").length ?? 0,
    archived:
      contracts?.filter((c) => c.status === "ended" || c.status === "declined").length ?? 0,
    all: contracts?.length ?? 0,
  };

  const filteredContracts =
    contracts?.filter((c) => {
      if (filter === "activeOpen") return c.status === "active" || c.status === "pending";
      if (filter === "active") return c.status === "active";
      if (filter === "pending") return c.status === "pending";
      if (filter === "archived") return c.status === "ended" || c.status === "declined";
      return true;
    }) ?? [];

  const filterTabs: { id: ContractFilter; label: string; count: number }[] = [
    { id: "activeOpen", label: t.contracts.filters.activeOpen, count: counts.activeOpen },
    { id: "active", label: t.contracts.filters.active, count: counts.active },
    { id: "pending", label: t.contracts.filters.pending, count: counts.pending },
    { id: "archived", label: t.contracts.filters.archived, count: counts.archived },
    { id: "all", label: t.contracts.filters.all, count: counts.all },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
              {t.trainers.title}
            </h1>
            {contracts && (
              <Badge variant="secondary" className="font-semibold">
                {counts.activeOpen}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.trainers.subtitle}</p>
        </div>

        <Button
          onClick={() => {
            setSuccess(null);
            setFormOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          <span>{t.contracts.offerTitle}</span>
        </Button>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-bg px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Drawer
        open={formOpen}
        onClose={() => {
          reset();
          setFormOpen(false);
        }}
        title={t.contracts.offerTitle}
        description={t.contracts.companyHint}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contract-email">{t.contracts.email}</Label>
            <Input id="contract-email" type="email" {...register("email")} />
            {emailSuggestion && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>
                    {t.contracts.emailTypoHint}{" "}
                    <strong className="font-semibold">{emailSuggestion}</strong>?
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setValue("email", emailSuggestion, { shouldValidate: true })}
                  className="shrink-0 font-bold underline hover:opacity-80"
                >
                  {t.contracts.emailTypoFix}
                </button>
              </div>
            )}
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contract-employment">{t.contracts.employmentType}</Label>
              <Controller
                control={control}
                name="employmentType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="contract-employment" className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          employmentTypeOptions.find((option) => option.value === value)?.label
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {employmentTypeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contract-model">{t.contracts.rateModel}</Label>
              <Controller
                control={control}
                name="rateModel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="contract-model" className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          rateModelOptions.find((option) => option.value === value)?.label
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {rateModelOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contract-amount">{t.contracts.rateAmount}</Label>
            <Input id="contract-amount" inputMode="decimal" {...register("rateAmount")} />
            {errors.rateAmount && (
              <p className="text-sm text-destructive">{errors.rateAmount.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contract-from">{t.contracts.validFrom}</Label>
              <Input id="contract-from" type="date" {...register("validFrom")} />
              {errors.validFrom && (
                <p className="text-sm text-destructive">{errors.validFrom.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contract-to">{t.contracts.validTo}</Label>
              <Input id="contract-to" type="date" {...register("validTo")} />
              {errors.validTo && (
                <p className="text-sm text-destructive">{errors.validTo.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1 gap-1.5">
              <Send className="size-4" />
              <span>{t.contracts.offer}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setFormOpen(false);
              }}
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </Drawer>

      {contracts && contracts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filterTabs.map((tab) => {
            const selected = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                    selected ? "bg-primary-foreground/20" : "bg-muted text-foreground"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>
        ) : isError ? (
          <p className="p-6 text-sm text-destructive">{t.common.error}</p>
        ) : contracts && contracts.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 p-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
              <Users className="size-5" />
            </div>
            <p className="font-medium">{t.contracts.companyEmpty}</p>
          </div>
        ) : filteredContracts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-3.5">{t.trainers.tableTrainer}</TableHead>
                <TableHead className="px-3">{t.trainers.tableContract}</TableHead>
                <TableHead className="hidden px-3 lg:table-cell">
                  {t.trainers.tableValidity}
                </TableHead>
                <TableHead className="px-3">{t.trainers.tableStatus}</TableHead>
                <TableHead className="px-3.5 text-right">{t.trainers.tableAction}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-[240px] whitespace-normal px-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
                        {getInitials(c.trainer_name, c.trainer_email)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {c.trainer_name || c.trainer_email}
                        </p>
                        {c.trainer_name && (
                          <p className="truncate text-xs text-muted-foreground">
                            {c.trainer_email}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal px-3 text-muted-foreground">
                    <p className="font-medium text-foreground">{formatContractTerms(c)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground lg:hidden">
                      {formatContractValidity(c)}
                    </p>
                  </TableCell>
                  <TableCell className="hidden whitespace-normal px-3 text-muted-foreground lg:table-cell">
                    {formatContractValidity(c)}
                  </TableCell>
                  <TableCell className="px-3">
                    <ContractStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="px-3.5 text-right">
                    {c.status === "active" || c.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={end.isPending}
                        onClick={() => end.mutate(c.id)}
                      >
                        {c.status === "pending" ? t.contracts.withdraw : t.contracts.end}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
              <Users className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              {filter === "activeOpen"
                ? t.trainers.emptyActiveOpen
                : t.contracts.companyFilterEmpty}
            </p>
            {filter === "activeOpen" && counts.archived > 0 && (
              <Button variant="outline" size="sm" onClick={() => setFilter("archived")}>
                {t.trainers.showArchive} ({counts.archived})
              </Button>
            )}
          </div>
        )}
      </div>

      {end.isError && <p className="text-sm text-destructive">{t.contracts.endError}</p>}
    </div>
  );
}
