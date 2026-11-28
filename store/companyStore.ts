import { create } from "zustand";

const STORAGE_KEY = "class-y:selected-company";
const PINS_KEY = "class-y:company-pins";
const RECENT_KEY = "class-y:company-recent";
const MAX_RECENT = 8;

function readSession(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function readList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeList(key: string, value: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher nicht verfügbar (privates Fenster o. ä.): nur für diese Sitzung merken
  }
}

interface CompanyState {
  /** Gewählte Company im Admin-Bereich, wenn jemand in mehreren Companies Admin ist. */
  selectedCompanyId: string | null;
  /** Angepinnte Companies (Stern im Company-Wechsler), dauerhaft in diesem Browser. */
  pinnedCompanyIds: string[];
  /** Zuletzt geöffnete Companies, neueste zuerst. */
  recentCompanyIds: string[];
  selectCompany: (id: string) => void;
  togglePin: (id: string) => void;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  selectedCompanyId: readSession(STORAGE_KEY),
  pinnedCompanyIds: readList(PINS_KEY),
  recentCompanyIds: readList(RECENT_KEY),
  selectCompany: (id) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore storage errors
    }
    const recent = [id, ...get().recentCompanyIds.filter((x) => x !== id)].slice(0, MAX_RECENT);
    writeList(RECENT_KEY, recent);
    set({ selectedCompanyId: id, recentCompanyIds: recent });
  },
  togglePin: (id) => {
    const pins = get().pinnedCompanyIds;
    const next = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id];
    writeList(PINS_KEY, next);
    set({ pinnedCompanyIds: next });
  },
}));
