"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import {
  INSTALL_CONTROL_ONCE_KEY,
  INSTALL_QUERY,
  activeMembership,
  approvedLogoUrl,
  buildCompanyManifest,
  companyInstallPath,
  companyManifestPath,
  installCompanyIdFromSearch,
  installableCompanies,
  shouldNavigateToPublishManifest,
  type InstallMembership,
} from "@/lib/pwa-company-install";
import { companySurfaceHex, DEFAULT_BRAND } from "@/lib/brand-utils";
import { rasterizeCompanyIcons } from "@/lib/pwa-company-raster";
import { companyManifestIsCached, waitForActiveServiceWorker, writeCompanyCacheInBrowser } from "@/lib/pwa-company-browser";
import { INSTALL_TIMEOUT_MESSAGE, INSTALL_WORKER_MESSAGE } from "@/lib/pwa-company-finalize";

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
  const [readyToInstall, setReadyToInstall] = useState(false);

  useEffect(() => {
    const companyId = installCompanyIdFromSearch(window.location.search);
    if (!companyId) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const manifestHref = () => document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null;
      if (manifestHref() === companyManifestPath(companyId)) {
        try { sessionStorage.removeItem(INSTALL_CONTROL_ONCE_KEY); } catch { /* private mode */ }
        setReadyToInstall(true);
        return;
      }
      setReadyToInstall(false);
      const cacheReady = await companyManifestIsCached(companyId);
      if (cancelled) return;
      let alreadyNavigated = false;
      try { alreadyNavigated = sessionStorage.getItem(INSTALL_CONTROL_ONCE_KEY) === companyId; } catch { alreadyNavigated = true; }
      if (!shouldNavigateToPublishManifest({
        pathname: window.location.pathname,
        companyId,
        manifestHref: manifestHref(),
        cacheReady,
        alreadyNavigated,
      })) {
        if (!cacheReady) {
          setNote("This company app is not stored in this browser yet. Press Install, then use the browser menu on the page that opens.");
        }
        return;
      }
      const active = await waitForActiveServiceWorker();
      if (cancelled) return;
      if (manifestHref() === companyManifestPath(companyId)) {
        setReadyToInstall(true);
        return;
      }
      if (!active) {
        setNote(INSTALL_WORKER_MESSAGE);
        return;
      }
      try { sessionStorage.setItem(INSTALL_CONTROL_ONCE_KEY, companyId); } catch { /* private mode */ }
      window.location.replace(window.location.href);
    })();
    return () => { cancelled = true; };
  }, [requested]);

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
    try {
      await prepareCompany(company);
    } catch {
      setBusy(null);
      setNote(INSTALL_TIMEOUT_MESSAGE);
    }
  }

  async function prepareCompany(company: InstallMembership) {
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
    const active = await waitForActiveServiceWorker();
    if (!active) {
      setBusy(null);
      setNote(INSTALL_WORKER_MESSAGE);
      return;
    }
    const manifestHref = document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null;
    // clients.claim() can set the controller while this wait is in progress.
    // The boot observer is still removing links on this document, so a
    // controller alone is not a parsed company manifest. Navigate unless
    // this document already has that company's link.
    if (!shouldNavigateToPublishManifest({
      pathname: window.location.pathname,
      companyId: built.companyId,
      manifestHref,
      cacheReady: true,
      alreadyNavigated: false,
    })) {
      setBusy(null);
      setReadyToInstall(true);
      return;
    }
    const next = companyInstallPath(built.companyId);
    window.location.assign(new URL(next, window.location.origin).toString());
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
            {readyToInstall && prompt && (
              <Button type="button" onClick={() => void prompt.prompt()}>
                <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Add {chosen.companyName}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => void prepare(chosen)} disabled={busy === chosen.companyId}>
              {busy === chosen.companyId ? "Saving…" : "Save icon again"}
            </Button>
          </div>
          {readyToInstall ? (
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Android Chrome or Brave: use Add above, or the browser menu (Install app / Add to Home screen) while this page is open.</li>
            <li>iPhone: tap Share, then Add to Home Screen, while this page is open. iOS may still show the Overwatch icon.</li>
            <li>Open the home-screen icon, then switch company inside Overwatch. The home-screen icon should stay the one you just saved.</li>
          </ol>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Press Install. The browser menu can install this company only after that page is being served by the app worker.</p>
          )}
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
