"use client";

import { Inbox, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRecentSupportMessages } from "@/hooks/useSupport";
import type { SupportMailStatus } from "@/lib/support";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const statusClass: Record<SupportMailStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-success-bg text-success",
  failed: "bg-destructive-bg text-destructive",
  not_configured: "bg-warning-bg text-warning",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Letzte Nachrichten aus dem Kontaktformular, als Sicherheitsnetz zum Mailversand. */
export function SupportInbox() {
  const { data: messages, isLoading, isError } = useRecentSupportMessages();

  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Inbox className="size-5 text-primary" />
          {t.help.inbox.title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.help.inbox.hint}</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : isError ? (
        <p className="text-sm text-destructive">{t.common.error}</p>
      ) : !messages?.length ? (
        <p className="text-sm text-muted-foreground">{t.help.inbox.empty}</p>
      ) : (
        <ul className="grid gap-3">
          {messages.map((m) => (
            <li key={m.id} className="grid gap-2 rounded-xl border border-border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-semibold">{m.sender_name || m.sender_email || "–"}</span>
                  {m.sender_name && m.sender_email && (
                    <span className="text-muted-foreground"> · {m.sender_email}</span>
                  )}
                </p>
                <span className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{t.help.contact.topics[m.topic]}</Badge>
                <Badge variant="outline">{t.help.roles[m.role]}</Badge>
                <Badge className={cn(statusClass[m.mail_status])}>{t.help.inbox.status[m.mail_status]}</Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.message}</p>
              {m.attachment_name && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Paperclip className="size-3.5" />
                  {t.help.inbox.attachment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
