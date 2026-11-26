import { create } from "zustand";
import type { HelpRole } from "@/hooks/useWorkspace";

interface TourState {
  /** Rolle des laufenden Rundgangs, null = kein Rundgang aktiv. */
  role: HelpRole | null;
  /** Kurzer Hinweis unten am Bildschirmrand (z.B. nach dem Rundgang). */
  notice: string | null;
  start: (role: HelpRole) => void;
  stop: () => void;
  notify: (notice: string | null) => void;
}

/** Global, damit Willkommens-Dialog und Hilfe-Seite den Rundgang starten können. */
export const useTourStore = create<TourState>((set) => ({
  role: null,
  notice: null,
  start: (role) => set({ role }),
  stop: () => set({ role: null }),
  notify: (notice) => set({ notice }),
}));
