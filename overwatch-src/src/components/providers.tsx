"use client";

import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth-provider";
import { SecurityProvider } from "@/components/security-provider";
import BrandThemeProvider from "@/components/brand-theme-provider";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { LazyCommandPalette } from "@/components/command-palette-lazy";
import { installGlobalErrorHandlers } from "@/lib/error-tracker";
import { useAuthStore } from "@/stores/auth-store";
import { logger } from "@/lib/logger";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/overwatch/sw.js").catch((e) => { logger.swallow("sw:register", e, "debug"); });
    }
    // Install global error tracking
    installGlobalErrorHandlers();
  }, []);

  // Expose minimal auth context for error tracker (scoped — no PII)
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      window.__OVERWATCH_AUTH_STORE__ = {
        userId: state.user?.id ?? null,
        activeCompanyId: state.activeCompanyId ?? null,
      };
    });
    return unsub;
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={getQueryClient()}>
        <AuthProvider>
          <BrandThemeProvider />
          <SecurityProvider>
            {/* TooltipProvider lives in DashboardShell: tooltips are only used
                inside the signed-in app, and Base UI's floating/tooltip code
                is a sizeable part of every public page's first load. */}
            {children}
            <Toaster richColors position="top-right" />
            <LazyCommandPalette />
            <PwaInstallPrompt />
          </SecurityProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
