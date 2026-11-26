"use client";

import { forwardRef, useRef, useState } from "react";
import { AlertTriangle, CircleCheck, ImagePlus, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSendSupportMessage } from "@/hooks/useSupport";
import type { HelpRole } from "@/hooks/useWorkspace";
import {
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_TYPES,
  SUPPORT_MESSAGE_MAX_LENGTH,
  type SupportTopic,
} from "@/lib/support";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const TOPICS: SupportTopic[] = ["question", "problem", "idea", "other"];

function errorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  if (code === "rate_limited") return t.help.contact.errors.rate_limited;
  if (code === "attachment_too_large") return t.help.contact.attachmentTooLarge;
  if (code === "attachment_type") return t.help.contact.attachmentType;
  return t.help.contact.errors.generic;
}

export const ContactForm = forwardRef<HTMLTextAreaElement, { role: HelpRole; email: string }>(
  function ContactForm({ role, email }, messageRef) {
    const send = useSendSupportMessage();
    const fileRef = useRef<HTMLInputElement>(null);
    const [topic, setTopic] = useState<SupportTopic>("question");
    const [message, setMessage] = useState("");
    const [includeTechInfo, setIncludeTechInfo] = useState(true);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [sendError, setSendError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    function pickFile(file: File | undefined) {
      setFieldError(null);
      if (!file) return setAttachment(null);
      if (!SUPPORT_ATTACHMENT_TYPES.includes(file.type)) {
        setFieldError(t.help.contact.attachmentType);
      } else if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
        setFieldError(t.help.contact.attachmentTooLarge);
      } else {
        setAttachment(file);
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
    }

    async function onSubmit(e: React.FormEvent) {
      e.preventDefault();
      setSendError(null);
      const trimmed = message.trim();
      if (!trimmed) return setFieldError(t.help.contact.messageRequired);
      if (trimmed.length > SUPPORT_MESSAGE_MAX_LENGTH) return setFieldError(t.help.contact.messageTooLong);
      setFieldError(null);
      try {
        await send.mutateAsync({ topic, message: trimmed, role, includeTechInfo, attachment });
        setSent(true);
      } catch (err) {
        console.error(err);
        setSendError(errorMessage(err));
      }
    }

    function reset() {
      setSent(false);
      setMessage("");
      setAttachment(null);
      setTopic("question");
    }

    if (sent) {
      return (
        <div className="grid justify-items-start gap-3" role="status">
          <span className="flex size-10 items-center justify-center rounded-full bg-success-bg text-success">
            <CircleCheck className="size-5" />
          </span>
          <h2 className="font-heading text-lg font-bold">{t.help.contact.sentTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {t.help.contact.sentText.replace("{email}", email)}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            {t.help.contact.newMessage}
          </Button>
        </div>
      );
    }

    return (
      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Mail className="size-5 text-primary" />
            {t.help.contact.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t.help.contact.subtitle.replace("{email}", email)}
          </p>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t.help.contact.topic}</legend>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((id) => (
              <label
                key={id}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  topic === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <input
                  type="radio"
                  name="support-topic"
                  value={id}
                  checked={topic === id}
                  onChange={() => setTopic(id)}
                  className="sr-only"
                />
                {t.help.contact.topics[id]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-2">
          <Label htmlFor="support-message">{t.help.contact.message}</Label>
          <textarea
            ref={messageRef}
            id="support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.help.contact.messagePlaceholder}
            rows={6}
            maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
            aria-invalid={fieldError === t.help.contact.messageRequired || undefined}
            className="min-h-32 w-full resize-y rounded-lg border border-neutral-300 bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:border-input dark:bg-input/30"
          />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium">
            {t.help.contact.attachment}{" "}
            <span className="font-normal text-muted-foreground">{t.help.contact.optional}</span>
          </span>
          {attachment ? (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <ImagePlus className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t.help.contact.removeAttachment}
                onClick={() => {
                  setAttachment(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <X />
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 justify-self-start rounded-lg border border-dashed border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
              <ImagePlus className="size-4" />
              {t.help.contact.attachment}
              <input
                ref={fileRef}
                type="file"
                accept={SUPPORT_ATTACHMENT_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>
          )}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeTechInfo}
            onChange={(e) => setIncludeTechInfo(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>{t.help.contact.tech}</span>
        </label>

        {(fieldError || sendError) && (
          <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{fieldError ?? sendError}</span>
          </p>
        )}

        <div>
          <Button type="submit" disabled={send.isPending}>
            <Mail className="size-4" />
            {send.isPending ? t.help.contact.sending : t.help.contact.send}
          </Button>
        </div>
      </form>
    );
  },
);
