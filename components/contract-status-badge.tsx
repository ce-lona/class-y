import { Badge } from "@/components/ui/badge";
import type { ContractStatus } from "@/lib/contracts";
import { formatDateDE } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const statusStyles: Record<ContractStatus, { badge: string; dot: string }> = {
  pending: {
    badge: "bg-warning-bg text-warning",
    dot: "bg-warning",
  },
  active: {
    badge: "bg-success-bg text-success",
    dot: "bg-success",
  },
  ended: {
    badge: "border border-border bg-muted/60 text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  declined: {
    badge: "bg-destructive-bg text-destructive",
    dot: "bg-destructive",
  },
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const style = statusStyles[status];
  return (
    <Badge className={cn("gap-1.5", style.badge)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden="true" />
      <span>{t.contracts.status[status]}</span>
    </Badge>
  );
}

export function formatContractTerms(c: {
  employment_type: string;
  rate_model: string;
  rate_amount: number;
}) {
  const employment =
    t.contracts.employmentTypes[c.employment_type as keyof typeof t.contracts.employmentTypes] ??
    c.employment_type;
  const model =
    t.contracts.rateModels[c.rate_model as keyof typeof t.contracts.rateModels] ?? c.rate_model;
  const amount = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    Number(c.rate_amount)
  );
  return `${employment} · ${amount} ${model}`;
}

export function formatContractValidity(c: { valid_from: string; valid_to: string | null }) {
  const from = formatDateDE(c.valid_from);
  return c.valid_to
    ? `${t.contracts.validity} ${from} ${t.contracts.until} ${formatDateDE(c.valid_to)}`
    : `${t.contracts.validity} ${from}`;
}
