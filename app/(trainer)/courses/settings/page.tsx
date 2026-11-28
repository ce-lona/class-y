"use client";

import { AppearanceSettingsCard } from "@/components/appearance-settings-card";
import { t } from "@/i18n/de";

export default function TrainerSettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-[28px] font-extrabold tracking-tight">
          {t.settings.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.settings.trainerSubtitle}</p>
      </div>
      <AppearanceSettingsCard />
    </div>
  );
}
