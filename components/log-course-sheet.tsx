"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogCourseForm } from "@/components/log-course-form";
import { useLogCourseStore } from "@/store/logCourseStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

/** „Kurs eintragen“: Drawer rechts auf dem Desktop, Bottom-Sheet auf dem Telefon. */
export function LogCourseSheet() {
  const open = useLogCourseStore((s) => s.open);
  const setOpen = useLogCourseStore((s) => s.setOpen);
  const mobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;
  const close = () => setOpen(false);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t.trainer.logTitle}>
      <div className="fixed inset-0 bg-neutral-950/30" aria-hidden="true" onClick={close} />
      <div
        data-testid="log-course-sheet"
        className={cn(
          "fixed flex flex-col bg-card shadow-xl motion-safe:animate-in",
          mobile
            ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[22px] motion-safe:slide-in-from-bottom-8"
            : "inset-y-0 right-0 w-full max-w-[480px] border-l border-border motion-safe:slide-in-from-right-6",
        )}
      >
        {mobile && <div className="mx-auto mt-2 mb-1 h-[5px] w-10 rounded-full bg-border" aria-hidden="true" />}
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="font-heading text-lg font-bold">{t.trainer.logTitle}</h2>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label={t.common.close}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-[max(env(safe-area-inset-bottom),16px)]">
          <LogCourseForm embedded onDone={close} onCancel={close} />
        </div>
      </div>
    </div>
  );
}
