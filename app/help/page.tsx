"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/help/contact-form";
import { Handbook } from "@/components/help/handbook";
import { TOURS } from "@/constants/help";
import { useAuthStore } from "@/store/authStore";
import { useTourStore } from "@/store/tourStore";
import { useWorkspace } from "@/hooks/useWorkspace";
import { t } from "@/i18n/de";

export default function HelpPage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useAuthStore();
  const { helpRole, isLoading } = useWorkspace();
  const startTour = useTourStore((s) => s.start);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sessionLoading && !session) router.replace("/login");
  }, [sessionLoading, session, router]);

  if (sessionLoading || !session || isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  // Ohne Rolle (z.B. Trainer:in vor Annahme des ersten Vertrags) gilt die Trainer-Hilfe.
  const role = helpRole ?? "trainer";
  const tour = TOURS[role];
  const email = session.user.email ?? "";

  function focusContact() {
    const el = messageRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">{t.help.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.help.subtitle}</p>
        </div>
        {role === "platform" && <Badge variant="secondary">{t.help.previewBadge}</Badge>}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <Handbook role={role} onContact={focusContact} />
        </section>

        <div className="grid gap-5">
          <section className="grid gap-3 rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6">
            <div>
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                <Play className="size-5" />
                {t.help.tour.cardTitle} {t.help.tour.roles[role]}
              </h2>
              <p className="mt-0.5 text-sm text-primary-foreground/80">
                {t.help.tour.cardHint.replace("{count}", String(tour.length))}
              </p>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {tour.map((s) => (
                <li key={s.target} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                  {s.title}
                </li>
              ))}
            </ul>
            <div>
              <Button
                type="button"
                className="bg-white/15 text-primary-foreground hover:bg-white/25"
                onClick={() => {
                  window.scrollTo({ top: 0 });
                  startTour(role);
                }}
              >
                <Play className="size-4" />
                {t.help.tour.start}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <ContactForm ref={messageRef} role={role} email={email} />
          </section>
        </div>
      </div>
    </div>
  );
}
