"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);

  // Capture the install prompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show if user hasn't dismissed before
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Listen for app installed
    window.addEventListener("appinstalled", () => {
      setShowInstall(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Listen for service worker updates
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version available
            setShowUpdate(true);
          }
        });
      });
    });

    // Also check for waiting worker on page load
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) setShowUpdate(true);
    });
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowInstall(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  }, []);

  const handleUpdate = useCallback(() => {
    setShowUpdate(false);
    window.location.reload();
  }, []);

  if (!showInstall && !showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm">
      {showUpdate && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-lg shadow-black/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <RefreshCw className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">Update Available</p>
            <p className="text-[10px] text-muted-foreground">Tap to refresh and get the latest version</p>
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={handleUpdate}>Update</Button>
        </div>
      )}

      {showInstall && !showUpdate && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-lg shadow-black/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">Install Overwatch</p>
            <p className="text-[10px] text-muted-foreground">Add to home screen for quick access</p>
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={handleInstall}>Install</Button>
          <button onClick={handleDismiss} className="p-1 text-muted-foreground/50 hover:text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
