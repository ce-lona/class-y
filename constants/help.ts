import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarRange,
  FileSignature,
  KeyRound,
  LayoutGrid,
  Palette,
  Receipt,
  Repeat,
  Rocket,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { HelpRole } from "@/hooks/useWorkspace";
import { t } from "@/i18n/de";

const steps = t.help.tour.steps;

export interface TourStep {
  /** data-tour-Attribut des Navigationseintrags, auf den der Schritt zeigt. */
  target: string;
  title: string;
  text: string;
}

export const TOURS: Record<HelpRole, TourStep[]> = {
  admin: [
    { target: "/monitoring", ...steps.monitoring },
    { target: "/plans", ...steps.plans },
    { target: "/studios", ...steps.studios },
    { target: "/trainers", ...steps.trainers },
    { target: "/billing", ...steps.billing },
    { target: "/help", ...steps.help },
  ],
  coordinator: [
    { target: "/monitoring", ...steps.monitoring },
    { target: "/plans", ...steps.plans },
    { target: "/trainers", ...steps.trainersCoordinator },
    { target: "/billing", ...steps.billing },
    { target: "/help", ...steps.help },
  ],
  trainer: [
    { target: "/courses", ...steps.courses },
    { target: "/courses/log", ...steps.log },
    { target: "/courses/billing", ...steps.trainerBilling },
    { target: "/profile", ...steps.profile },
    { target: "/help", ...steps.help },
  ],
  platform: [
    { target: "/companies", ...steps.companies },
    { target: "/settings", ...steps.platformSettings },
    { target: "/help", ...steps.help },
  ],
};

type ChapterKey = keyof typeof t.help.handbook.chapters;

export interface HandbookChapter {
  id: ChapterKey;
  roles: HelpRole[];
  icon: LucideIcon;
  /**
   * Bildschirmfoto pro Schritt (Dateiname ohne .png in public/handbook/), erzeugt von
   * e2e/handbook.spec.ts. null = Schritt ohne Bild.
   */
  shots: (string | null)[];
}

export const HANDBOOK: HandbookChapter[] = [
  { id: "start", roles: ["admin", "coordinator", "trainer"], icon: Rocket, shots: ["login", "workspace-switch", "help"] },
  { id: "studios", roles: ["admin"], icon: Building2, shots: ["studios", null] },
  { id: "trainers", roles: ["admin"], icon: Users, shots: ["trainers", "trainers-offer", null] },
  { id: "plans", roles: ["admin", "coordinator"], icon: Calendar, shots: ["plans", null, null] },
  { id: "monitoring", roles: ["admin", "coordinator"], icon: LayoutGrid, shots: ["monitoring", null] },
  { id: "billingCompany", roles: ["admin", "coordinator"], icon: Receipt, shots: ["billing", null] },
  { id: "courseTypes", roles: ["admin"], icon: Palette, shots: ["settings"] },
  { id: "privacy", roles: ["admin"], icon: ShieldCheck, shots: ["privacy", null] },
  { id: "contract", roles: ["trainer"], icon: FileSignature, shots: ["profile-contracts", null] },
  { id: "courses", roles: ["trainer"], icon: CalendarCheck, shots: ["courses", null, "courses-log"] },
  { id: "substitution", roles: ["trainer"], icon: Repeat, shots: [null, null] },
  { id: "schedule", roles: ["trainer"], icon: CalendarRange, shots: ["schedule"] },
  { id: "billingTrainer", roles: ["trainer"], icon: Receipt, shots: ["courses-billing"] },
  { id: "password", roles: ["admin", "coordinator", "trainer"], icon: KeyRound, shots: ["forgot-password"] },
];

/** Plattform-Admins sehen alle Kapitel (Vorschau dessen, was Kund:innen sehen). */
export function chaptersForRole(role: HelpRole): HandbookChapter[] {
  return role === "platform" ? HANDBOOK : HANDBOOK.filter((c) => c.roles.includes(role));
}
