import { create } from "zustand";
import type { ReactNode } from "react";

interface PageHeaderState {
  title: string;
  subtitle: string;
  icon: ReactNode | null;
  actions: ReactNode | null;
  setHeader: (title: string, subtitle: string, icon?: ReactNode, actions?: ReactNode) => void;
  clearHeader: () => void;
}

export const usePageHeader = create<PageHeaderState>((set) => ({
  title: "",
  subtitle: "",
  icon: null,
  actions: null,
  setHeader: (title, subtitle, icon = null, actions = null) =>
    set({ title, subtitle, icon, actions }),
  clearHeader: () =>
    set({ title: "", subtitle: "", icon: null, actions: null }),
}));
