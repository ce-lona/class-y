"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrainerBottomNav } from "@/components/trainer-bottom-nav";
import { useAuthStore } from "@/store/authStore";
import { t } from "@/i18n/de";

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login");
    }
  }, [isLoading, session, router]);

  if (isLoading || !session) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 bg-background px-4 pt-6 pb-24 sm:px-6 sm:pt-8 md:pb-12">
      {children}
      <TrainerBottomNav />
    </div>
  );
}
