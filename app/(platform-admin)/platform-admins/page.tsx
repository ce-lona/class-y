"use client";

import { PlatformAdminsCard } from "@/components/platform-admins-card";
import { PlatformPage } from "@/components/platform/platform-page";
import { t } from "@/i18n/de";

export default function PlatformAdminsPage() {
  return (
    <PlatformPage title={t.shell.platformAdmins}>
      <div className="max-w-4xl">
        <PlatformAdminsCard />
      </div>
    </PlatformPage>
  );
}
