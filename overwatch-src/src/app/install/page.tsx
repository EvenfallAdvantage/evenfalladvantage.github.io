"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import {
  INSTALL_CONTROL_RELOAD_KEY,
  INSTALL_QUERY,
  activeMembership,
  approvedLogoUrl,
  buildCompanyManifest,
  companyInstallPath,
  companyManifestPath,
  installCompanyIdFromSearch,
  installableCompanies,
  shouldReloadUncontrolledInstall,
  type InstallMembership,
} from "@/lib/pwa-company-install";
import { companySurfaceHex, DEFAULT_BRAND } from "@/lib/brand-utils";
import { rasterizeCompanyIcons } from "@/lib/pwa-company-raster";
import { activateServiceWorkerForInstall, writeCompanyCacheInBrowser } from "@/lib/pwa-company-browser";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function toMembership(companies: ReturnType<typeof useAuthStore.getState>["user"]): InstallMembership[] {
  return (companies?.companies ?? []).map((c) => ({
    companyId: c.companyId,
    companyName: c.companyName,
    companyLogo: c.companyLogo,
    brandColor: c.brandColor,
    status: c.membership?.status ?? "active",
  }));
}

function InstallScreen() {
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const memberships = toMembership(user);
  const listed = installableCompanies(memberships);
  const requested = params.get(INSTALL_QUERY);
  const chosen = activeMembership(memberships, requested);
  const chosenId = chosen?.companyId ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const companyId = installCompanyIdFromSearch(window.location.search);
    let alreadyReloaded = false;
    try {
      alreadyReloaded = sessionStorage.getItem(INSTALL_CONTROL_RELOAD_KEY) === "1";
    } catch {
      alreadyReloaded = true;
    }
    const controlled = Boolean(navigator.serviceWorker?.controller);
    if (controlled) {
      try { sessionStorage.removeItem(INSTALL_CONTROL_RELOAD_KEY); } catch { /* private mode */ }
    }
    if (!shouldReloadUncontrolledInstall({
      pathname: window.location.pathname,
      companyId,
      hasController: controlled,
      alreadyReloaded,
    })) return;
    let cancelled = false;
    activateServiceWorkerForInstall().then((active) => {
      if (cancelled || !active || navigator.serviceWorker.controller) return;
      try { sessionStorage.setItem(INSTALL_CONTROL_RELOAD_KEY, "1"); } catch { /* private mode */ }
      window.location.replace(window.location.href);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const href = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
      if (!chosenId || href !== companyManifestPath(chosenId)) return;
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [chosenId]);

  async function prepare(company: InstallMembership) {
    setBusy(company.companyId);
    setNote(null);
    let useLogo = false;
    let icons: { path: string; blob: Blob }[] = [];
    const logo = approvedLogoUrl(company.companyId, company.companyLogo);
    if (logo) {
      try {
        icons = await rasterizeCompanyIcons(
          company.companyId,
          logo,
          companySurfaceHex(company.brandColor || DEFAULT_BRAND, "dark"),
        );
        useLogo = true;
      } catch {
        useLogo = false;
        setNote(`${company.companyName} has a logo, but it could not be saved as an icon. The Overwatch icon will be used.`);
      }
    }
    const built = buildCompanyManifest(memberships, company.companyId, useLogo);
    if (!built) {
      setBusy(null);
      setNote("That company is not an active membership on this account.");
      return;
    }
    if (!("caches" in window)) {
      setBusy(null);
      setNote("This browser cannot store an install manifest.");
      return;
    }
    await writeCompanyCacheInBrowser(built, useLogo ? icons : []);
    const active = await activateServiceWorkerForInstall();
    if (!active) {
      setBusy(null);
      setNote("This browser has no active service worker, so the company manifest cannot be served. Reload Overwatch and press Install again.");
      return;
    }
    try { sessionStorage.removeItem(INSTALL_CONTROL_RELOAD_KEY); } catch { /* private mode */ }
    // Same tab. A new tab is often uncontrolled, so its first manifest fetch
    // misses the worker and the install dialog keeps the default name.
    window.location.assign(new URL(companyInstallPath(built.companyId), window.location.origin).toString());
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="font-mono text-lg font-bold">Install a company app</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick one active company. That choice is saved as its own install and is not replaced when you switch companies later.
        </p>
      </div>

      {requested && !chosen && (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
          That company is not an active membership on this account.
        </p>
      )}

      {chosen && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Ready for {chosen.companyName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The saved name, icon, and start link stay on this company. The browser menu on this page reads that saved manifest. An Android home-screen app keeps its current name and icon until Chrome refreshes that install, or you remove the icon and install again from this page.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {prompt && (
              <Button type="button" onClick={() => void prompt.prompt()}>
                <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Add {chosen.companyName}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => void prepare(chosen)} disabled={busy === chosen.companyId}>
              {busy === chosen.companyId ? "Saving…" : "Save icon again"}
            </Button>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Android Chrome or Brave: use Add above, or the browser menu (Install app / Add to Home screen) while this page is open.</li>
            <li>iPhone: tap Share, then Add to Home Screen, while this page is open. iOS may still show the Overwatch icon.</li>
            <li>Open the home-screen icon, then switch company inside Overwatch. The home-screen icon should stay the one you just saved.</li>
          </ol>
        </section>
      )}

      {note && <p className="text-sm text-muted-foreground" role="status">{note}</p>}

      <ul className="flex flex-col gap-2">
        {listed.map((company) => (
          <li key={company.companyId} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{company.companyName}</p>
              <p className="text-[11px] text-muted-foreground">
                {approvedLogoUrl(company.companyId, company.companyLogo) ? "Uses the company logo" : "Uses the Overwatch icon"}
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => void prepare(company)} disabled={busy === company.companyId}>
              {busy === company.companyId ? "Saving…" : "Install"}
            </Button>
          </li>
        ))}
      </ul>

      {listed.length === 0 && (
        <p className="text-sm text-muted-foreground">No active company membership is on this account.</p>
      )}
    </div>
  );
}

export default function InstallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <InstallScreen />
    </Suspense>
  );
}
