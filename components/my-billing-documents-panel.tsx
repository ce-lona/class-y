"use client";

import { useState } from "react";
import { Check, Download, FileText, MessageSquare, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { BillingStatusBadge, kindLabel } from "@/components/billing-status-badge";
import { downloadBillingDocumentPdf } from "@/components/billing-documents-panel";
import {
  useApproveBillingDocument,
  useCommentBillingDocument,
  useMyBillingDocuments,
} from "@/hooks/useCreditNotes";
import { creditNoteErrorCode, type MyBillingDocument } from "@/lib/creditNotes";
import { formatEuro, formatMonthDE } from "@/lib/billingExport";
import { fillTemplate as fill, formatDateDE } from "@/lib/format";
import { t } from "@/i18n/de";

const C = t.creditNotes;

function documentTitle(d: MyBillingDocument): string {
  return `${kindLabel(d.kind)} ${d.number ?? fill(C.version, { version: d.version })}`;
}

function CommentDrawer({
  document,
  onClose,
}: {
  document: MyBillingDocument | null;
  onClose: () => void;
}) {
  const comment = useCommentBillingDocument();
  const [body, setBody] = useState("");
  const isCredit = document?.kind === "credit_note";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!document || !body.trim()) return;
    try {
      await comment.mutateAsync({ id: document.id, body: body.trim() });
      setBody("");
      onClose();
    } catch {
      // Fehler wird unten angezeigt.
    }
  }

  const errorKey = comment.isError ? (creditNoteErrorCode(comment.error) as keyof typeof C.errors) : null;

  return (
    <Drawer
      open={!!document}
      onClose={onClose}
      title={isCredit ? C.correctionTitle : C.commentTitle}
      description={isCredit ? C.correctionHint : C.commentHint}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {document && (
          <p className="text-sm text-muted-foreground">
            {documentTitle(document)} · {document.company_name} · {formatMonthDE(document.month.slice(0, 7))}
          </p>
        )}
        <div className="grid gap-2">
          <Label htmlFor="billing-comment">{C.commentLabel}</Label>
          <textarea
            id="billing-comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={C.commentPlaceholder}
            rows={5}
            maxLength={2000}
            className="min-h-28 w-full resize-y rounded-lg border border-neutral-300 bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:border-input dark:bg-input/30"
          />
        </div>
        {errorKey && <p className="text-sm text-destructive">{C.errors[errorKey]}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={!body.trim() || comment.isPending}>
            {C.send}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function amountLabel(d: MyBillingDocument): string {
  return formatEuro(Number(d.gross));
}

/** Abrechnung → „Gutschriften & Nachweise“ für Trainer:innen. */
export function MyBillingDocumentsPanel({ companyId }: { companyId?: string }) {
  const { data, isLoading, isError } = useMyBillingDocuments();
  const approve = useApproveBillingDocument();
  const [commenting, setCommenting] = useState<MyBillingDocument | null>(null);
  const [pdfError, setPdfError] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (isError) return <p className="text-sm text-destructive">{t.common.error}</p>;

  const all = (data ?? []).filter((d) => !companyId || d.company_id === companyId);
  const open = all.filter((d) => d.kind === "credit_note" && d.status === "open");
  const rest = all.filter((d) => !(d.kind === "credit_note" && d.status === "open"));

  async function onPdf(d: MyBillingDocument) {
    setPdfError(false);
    try {
      await downloadBillingDocumentPdf(d.id);
    } catch {
      setPdfError(true);
    }
  }

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/40">
          <Receipt className="size-5" />
        </div>
        <p className="text-sm text-muted-foreground">{C.myEmpty}</p>
      </div>
    );
  }

  const approveErrorKey = approve.isError
    ? (creditNoteErrorCode(approve.error) as keyof typeof C.errors)
    : null;

  return (
    <div className="space-y-6">
      {open.map((d) => (
        <section
          key={d.id}
          className="rounded-xl border border-primary/40 bg-card p-5 sm:p-6"
          data-testid="open-credit-note"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold tracking-wide text-primary uppercase">
                {fill(C.reviewTitle, { date: d.review_due ? formatDateDE(d.review_due) : "" })}
              </p>
              <h2 className="font-heading text-lg font-bold">
                {documentTitle(d)}
                {d.replaces_number && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {fill(C.replaces, { number: d.replaces_number })}
                  </span>
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                {[d.company_name, d.studio_name, formatMonthDE(d.month.slice(0, 7))].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="text-right">
              <p className="font-heading text-2xl font-extrabold tabular-nums">{amountLabel(d)}</p>
              <p className="text-xs text-muted-foreground">
                {C.cols.courses}: {d.course_count}
              </p>
            </div>
          </div>
          {d.review_due && (
            <p className="mt-3 text-sm text-muted-foreground">
              {fill(C.reviewHint, { date: formatDateDE(d.review_due) })}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="gap-1.5"
              disabled={approve.isPending}
              onClick={() => approve.mutate(d.id)}
              data-testid="approve-credit-note"
            >
              <Check className="size-4" />
              <span>{C.approve}</span>
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => setCommenting(d)}>
              <MessageSquare className="size-4" />
              <span>{C.requestCorrection}</span>
            </Button>
            <Button variant="ghost" className="gap-1.5" onClick={() => onPdf(d)}>
              <Download className="size-4" />
              <span>{C.downloadPdf}</span>
            </Button>
          </div>
          {approveErrorKey && <p className="mt-3 text-sm text-destructive">{C.errors[approveErrorKey]}</p>}
        </section>
      ))}

      {rest.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h2 className="font-heading text-lg font-bold">{C.allDocuments}</h2>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rest.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
                data-testid="my-billing-document"
              >
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span>{documentTitle(d)}</span>
                    <BillingStatusBadge status={d.status} reviewDue={d.review_due} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[d.company_name, d.studio_name, formatMonthDE(d.month.slice(0, 7))]
                      .filter(Boolean)
                      .join(" · ")}
                    {" · "}
                    <span className="tabular-nums">{amountLabel(d)}</span>
                  </p>
                  {d.last_comment && (
                    <p className="text-xs text-muted-foreground">{fill(C.lastComment, { text: d.last_comment })}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {((d.kind === "statement" && d.status === "issued") ||
                    (d.kind === "credit_note" &&
                      (d.status === "approved" || d.status === "auto_approved"))) && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCommenting(d)}>
                      <MessageSquare className="size-3.5" />
                      <span>{d.kind === "statement" ? C.addComment : C.requestCorrection}</span>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onPdf(d)}>
                    <Download className="size-3.5" />
                    <span>{C.downloadPdf}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pdfError && <p className="text-sm text-destructive">{C.errors.generic}</p>}

      <CommentDrawer document={commenting} onClose={() => setCommenting(null)} />
    </div>
  );
}
