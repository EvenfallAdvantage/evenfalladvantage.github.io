"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth-provider";
import { SecurityProvider } from "@/components/security-provider";
import BrandThemeProvider from "@/components/brand-theme-provider";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { installGlobalErrorHandlers } from "@/lib/error-tracker";
import { useAuthStore } from "@/stores/auth-store";
import { useState, useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/overwatch/sw.js").catch(() => {});
    }
    // Install global error tracking
    installGlobalErrorHandlers();
  }, []);

  // Expose auth store for error tracker context (non-reactive, just a reference)
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      (window as any).__OVERWATCH_AUTH_STORE__ = {
        user: state.user,
        activeCompanyId: state.activeCompanyId,
      };
    });
    return unsub;
  }, []);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrandThemeProvider />
          <SecurityProvider>
            <TooltipProvider delay={0}>
              {children}
              <Toaster richColors position="top-right" />
              <PwaInstallPrompt />
            </TooltipProvider>
          </SecurityProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
