import { create } from "zustand";

const STORAGE_KEY = "class-y:studio-filter";

/** "all" = alle (bzw. für Studio-Admins: meine) Studios. */
export const ALL_STUDIOS = "all";

function readStored(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

interface StudioFilterState {
  /** Globaler Studio-Filter je Company (Sidebar unter dem Company-Wechsler). */
  byCompany: Record<string, string>;
  setStudio: (companyId: string, studioId: string) => void;
}

export const useStudioFilterStore = create<StudioFilterState>((set, get) => ({
  byCompany: readStored(),
  setStudio: (companyId, studioId) => {
    const next = { ...get().byCompany, [companyId]: studioId };
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
    set({ byCompany: next });
  },
}));
