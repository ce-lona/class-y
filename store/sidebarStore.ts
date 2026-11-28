import { create } from "zustand";

const STORAGE_KEY = "class-y:sidebar-collapsed";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface SidebarState {
  /** Von Hand eingeklappt (64 px). Unter 900 px ist die Sidebar immer eingeklappt. */
  collapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: readStored(),
  toggle: () => {
    const next = !get().collapsed;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore storage errors
    }
    set({ collapsed: next });
  },
}));
