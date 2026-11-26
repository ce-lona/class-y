"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { GuidedTour } from "@/components/help/guided-tour";
import { useAuthStore } from "@/store/authStore";
import { useTourStore } from "@/store/tourStore";
import { useMyProfile } from "@/hooks/useProfile";
import { useMarkOnboardingSeen } from "@/hooks/useSupport";
import { useWorkspace } from "@/hooks/useWorkspace";
import { t } from "@/i18n/de";

// Auf diesen Seiten nie den Willkommens-Dialog zeigen (Login, Passwort, Rechtstexte).
const quietPrefixes = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/impressum",
  "/datenschutz",
  "/agb",
];

/** E2E-Tests setzen dieses Flag, damit der Dialog bestehende Abläufe nicht überdeckt. */
export const SKIP_ONBOARDING_STORAGE_KEY = "class-y:e2e-skip-onboarding";

function onboardingSkipped(): boolean {
  try {
    return window.localStorage.getItem(SKIP_ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function WelcomeDialog() {
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const tourRole = useTourStore((s) => s.role);
  const startTour = useTourStore((s) => s.start);
  const notify = useTourStore((s) => s.notify);
  const { data: profile } = useMyProfile();
  const { helpRole, isLoading } = useWorkspace();
  const markSeen = useMarkOnboardingSeen();
  const startRef = useRef<HTMLButtonElement>(null);

  const quiet = quietPrefixes.some((p) => pathname?.startsWith(p));
  const open =
    !!session &&
    !quiet &&
    !onboardingSkipped() &&
    !isLoading &&
    !!profile &&
    !!helpRole &&
    !tourRole &&
    !(profile.onboarding_seen ?? []).includes(helpRole);

  useEffect(() => {
    if (open) startRef.current?.focus();
  }, [open]);

  if (!open || !helpRole) return null;

  const firstName = profile.full_name?.trim().split(/\s+/)[0];
  const nameSuffix = firstName ? `, ${firstName}` : "";
  const text = (helpRole === "trainer" ? t.help.welcome.textTrainer : t.help.welcome.textAdmin).replace(
    "{name}",
    nameSuffix,
  );

  function later() {
    markSeen.mutate(helpRole!);
    notify(t.help.welcome.laterToast);
  }

  function start() {
    markSeen.mutate(helpRole!);
    startTour(helpRole!);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="grid w-full max-w-md gap-4 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
      >
        <Logo className="text-3xl" aria-hidden="true" />
        <h2 id="welcome-title" className="font-heading text-xl font-extrabold">
          {t.help.welcome.title}
        </h2>
        <p>{text}</p>
        <p className="text-sm text-muted-foreground">{t.help.welcome.hint}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={later}>
            {t.help.welcome.later}
          </Button>
          <Button ref={startRef} type="button" onClick={start}>
            {t.help.welcome.start}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Notice() {
  const notice = useTourStore((s) => s.notice);
  const notify = useTourStore((s) => s.notify);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => notify(null), 3500);
    return () => window.clearTimeout(id);
  }, [notice, notify]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-[80] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-lg md:bottom-6"
    >
      {notice}
    </div>
  );
}

/** Willkommens-Dialog beim ersten Login pro Rolle, Rundgang und Hinweise. */
export function OnboardingHost() {
  return (
    <>
      <WelcomeDialog />
      <GuidedTour />
      <Notice />
    </>
  );
}
