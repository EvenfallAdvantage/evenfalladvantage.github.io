import { create } from "zustand";
import type { ReactNode } from "react";

interface PageHeaderState {
  title: string;
  subtitle: string;
  icon: ReactNode | null;
  actions: ReactNode | null;
  /** >0 while a SubTabList is mounted: it hosts the mobile action inline, so the shell's own action row is hidden. */
  inlineActionHosts: number;
  addInlineActionHost: (delta: 1 | -1) => void;
  setHeader: (title: string, subtitle: string, icon?: ReactNode, actions?: ReactNode) => void;
  clearHeader: () => void;
}

export const usePageHeader = create<PageHeaderState>((set) => ({
  title: "",
  subtitle: "",
  icon: null,
  actions: null,
  inlineActionHosts: 0,
  addInlineActionHost: (delta) => set((st) => ({ inlineActionHosts: Math.max(0, st.inlineActionHosts + delta) })),
  setHeader: (title, subtitle, icon = null, actions = null) =>
    set({ title, subtitle, icon, actions }),
  clearHeader: () =>
    set({ title: "", subtitle: "", icon: null, actions: null }),
}));
