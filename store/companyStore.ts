import { create } from "zustand";

const STORAGE_KEY = "class-y:selected-company";

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface CompanyState {
  /** Gewählte Company im Admin-Bereich, wenn jemand in mehreren Companies Admin ist. */
  selectedCompanyId: string | null;
  selectCompany: (id: string) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  selectedCompanyId: readStored(),
  selectCompany: (id) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore storage errors
    }
    set({ selectedCompanyId: id });
  },
}));
