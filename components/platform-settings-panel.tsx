"use client";

import { PlatformAdminsCard } from "@/components/platform-admins-card";
import { SupportInbox } from "@/components/help/support-inbox";
import { SupportRecipientsCard } from "@/components/help/support-recipients-card";

/** Plattform-Einstellungen (nur Plattform-Admins), Reiter „Plattform“ unter /settings. */
export function PlatformSettingsPanel() {
  return (
    <div className="flex flex-col gap-6">
      <PlatformAdminsCard />
      <SupportRecipientsCard />
      <SupportInbox />
    </div>
  );
}
