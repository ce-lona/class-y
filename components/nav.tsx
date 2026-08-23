"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useIsPlatformAdmin } from "@/hooks/useRoles";
import { useMyCompany } from "@/hooks/useCompanyAdmins";
import { signOut } from "@/lib/auth";
import { t } from "@/i18n/de";

export function Nav() {
  const session = useAuthStore((state) => state.session);
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { data: myCompany } = useMyCompany();

  if (!session) return null;

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <Link href="/" className="text-xl">
        <Logo aria-hidden="true" />
        <span className="sr-only">{t.common.appName}</span>
      </Link>

      <nav className="flex items-center gap-4">
        {isPlatformAdmin && (
          <Link href="/companies" className="text-sm text-muted-foreground hover:underline">
            {t.companies.title}
          </Link>
        )}
        {myCompany && (
          <Link href="/studios" className="text-sm text-muted-foreground hover:underline">
            {t.studios.title}
          </Link>
        )}
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          {t.auth.logout}
        </Button>
      </nav>
    </header>
  );
}
