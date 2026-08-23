"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { signOut } from "@/lib/auth";
import { t } from "@/i18n/de";

export default function Home() {
  const { session, isLoading } = useAuthStore();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">{t.common.appName}</h1>
      {isLoading ? (
        <p className="text-muted-foreground">{t.common.loading}</p>
      ) : session ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-muted-foreground">{session.user.email}</p>
          <Button onClick={() => signOut()}>{t.auth.logout}</Button>
        </div>
      ) : (
        <Link href="/login" className={buttonVariants()}>
          {t.auth.login}
        </Link>
      )}
    </div>
  );
}
