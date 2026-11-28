"use client";

import { Palette } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { t } from "@/i18n/de";

/** Hell/Dunkel/System, gespeichert pro Browser (next-themes). In den Einstellungen jeder Rolle. */
export function AppearanceSettingsCard() {
  return (
    <section
      aria-labelledby="appearance-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex items-start gap-3">
        <Palette className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <h2 id="appearance-title" className="font-heading text-lg font-bold">
            {t.appearance.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.appearance.hint}</p>
        </div>
      </div>
      <ThemeToggle withLabels className="self-start sm:self-auto" />
    </section>
  );
}
