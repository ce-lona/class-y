"use client";

import { SupportInbox } from "@/components/help/support-inbox";
import { SupportRecipientsCard } from "@/components/help/support-recipients-card";
import { PlatformPage } from "@/components/platform/platform-page";
import { t } from "@/i18n/de";

export default function SupportPage() {
  return (
    <PlatformPage title={t.shell.support}>
      <div className="flex max-w-5xl flex-col gap-6">
        <SupportInbox />
        <SupportRecipientsCard />
      </div>
    </PlatformPage>
  );
}
