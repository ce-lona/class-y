"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { t } from "@/i18n/de";

export default function Home() {
  const { session, isLoading } = useAuthStore();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-4xl">
        <Logo aria-hidden="true" />
        <span className="sr-only">{t.common.appName}</span>
      </h1>
      {isLoading ? (
        <p className="text-muted-foreground">{t.common.loading}</p>
      ) : session ? (
        <p className="text-muted-foreground">{session.user.email}</p>
      ) : (
        <Link href="/login" className={buttonVariants()}>
          {t.auth.login}
        </Link>
      )}
    </div>
  );
}
