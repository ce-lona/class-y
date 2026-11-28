import { create } from "zustand";

interface LogCourseState {
  /** „Kurs eintragen“ als Drawer (Desktop) bzw. Bottom-Sheet (mobil). */
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useLogCourseStore = create<LogCourseState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
