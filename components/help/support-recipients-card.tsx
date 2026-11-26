"use client";

import { useState } from "react";
import { AlertTriangle, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAddSupportRecipient,
  useRemoveSupportRecipient,
  useSupportRecipients,
} from "@/hooks/useSupport";
import { t } from "@/i18n/de";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function recipientError(err: unknown): string {
  const code = (err as { message?: string } | null)?.message ?? "";
  const errors = t.help.recipients.errors;
  return code in errors ? errors[code as keyof typeof errors] : errors.generic;
}

export function SupportRecipientsCard() {
  const { data: recipients, isLoading } = useSupportRecipients();
  const add = useAddSupportRecipient();
  const remove = useRemoveSupportRecipient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) return setError(t.help.recipients.errors.invalid_email);
    if (recipients?.includes(value)) return setError(t.help.recipients.errors.already_exists);
    try {
      await add.mutateAsync(value);
      setEmail("");
    } catch (err) {
      setError(recipientError(err));
    }
  }

  async function onRemove(value: string) {
    setError(null);
    try {
      await remove.mutateAsync(value);
    } catch (err) {
      setError(recipientError(err));
    }
  }

  const list = recipients ?? [];
  const onlyOne = list.length <= 1;

  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Mail className="size-5 text-primary" />
          {t.help.recipients.title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.help.recipients.hint}</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : list.length === 0 ? (
        <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">{t.help.recipients.empty}</p>
      ) : (
        <ul className="grid gap-2" aria-label={t.help.recipients.title}>
          {list.map((r) => (
            <li key={r} className="flex items-center gap-2.5 rounded-xl border border-border py-1.5 pr-1.5 pl-3">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 text-sm break-all">{r}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t.help.recipients.remove.replace("{email}", r)}
                title={onlyOne ? t.help.recipients.lastRecipient : undefined}
                disabled={onlyOne || remove.isPending}
                onClick={() => onRemove(r)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form className="flex flex-wrap gap-2" onSubmit={onAdd} noValidate>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.help.recipients.placeholder}
          aria-label={t.help.recipients.emailLabel}
          autoComplete="off"
          className="min-w-52 flex-1"
        />
        <Button type="submit" variant="outline" disabled={add.isPending}>
          {t.help.recipients.add}
        </Button>
      </form>

      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">{t.help.recipients.replyHint}</p>
    </section>
  );
}
