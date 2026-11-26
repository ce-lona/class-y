import { Badge } from "@/components/ui/badge";
import type { BillingDocumentKind, BillingDocumentStatus } from "@/lib/creditNotes";
import { fillTemplate, formatDateDE } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const STYLES: Record<BillingDocumentStatus, string> = {
  open: "bg-link-500/15 text-link-600 dark:text-link-400",
  approved: "bg-success-bg text-success",
  auto_approved: "bg-success-bg text-success",
  correction_requested: "bg-warning-bg text-warning",
  cancelled: "bg-muted text-muted-foreground line-through",
  issued: "bg-success-bg text-success",
  superseded: "bg-muted text-muted-foreground",
};

export function kindLabel(kind: BillingDocumentKind): string {
  return t.creditNotes.kind[kind];
}

export function BillingStatusBadge({
  status,
  reviewDue,
}: {
  status: BillingDocumentStatus;
  reviewDue: string | null;
}) {
  const label =
    status === "open"
      ? reviewDue
        ? fillTemplate(t.creditNotes.status.open, { date: formatDateDE(reviewDue) })
        : t.creditNotes.status.openShort
      : t.creditNotes.status[status];
  return <Badge className={cn("font-medium", STYLES[status])}>{label}</Badge>;
}
