import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionUser, CompanyContext } from "@/types";

interface AuthState {
  user: SessionUser | null;
  activeCompanyId: string | null;
  isLoading: boolean;

  setUser: (user: SessionUser | null) => void;
  setActiveCompany: (companyId: string) => void;
  getActiveCompany: () => CompanyContext | null;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      activeCompanyId: null,
      isLoading: true,

      setUser: (user) => {
        const persisted = get().activeCompanyId;
        const validIds = user?.companies?.map((c) => c.companyId) ?? [];
        const resolvedId =
          (persisted && validIds.includes(persisted))
            ? persisted
            : user?.activeCompanyId && validIds.includes(user.activeCompanyId)
              ? user.activeCompanyId
              : validIds[0] ?? null;
        set({ user, activeCompanyId: resolvedId, isLoading: false });
      },

      setActiveCompany: (companyId) => set({ activeCompanyId: companyId }),

      getActiveCompany: () => {
        const { user, activeCompanyId } = get();
        if (!user || !activeCompanyId) return null;
        return (
          user.companies.find((c) => c.companyId === activeCompanyId) ?? null
        );
      },

      clearSession: () =>
        set({ user: null, activeCompanyId: null, isLoading: false }),
    }),
    {
      name: "overwatch-auth",
      partialize: (state) => ({ activeCompanyId: state.activeCompanyId }),
    }
  )
);
