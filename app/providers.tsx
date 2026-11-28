"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthListener } from "@/hooks/useAuth";
import { AppShell } from "@/components/app-shell/app-shell";
import { OnboardingHost } from "@/components/help/onboarding-host";

function AuthListener() {
  useAuthListener();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener />
      <AppShell>{children}</AppShell>
      <OnboardingHost />
    </QueryClientProvider>
  );
}
