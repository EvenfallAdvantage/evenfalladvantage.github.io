"use client";

import { useEffect } from "react";
import { useActiveCompany, useAuthStore } from "@/stores/auth-store";
import { companySurfaceHex, DEFAULT_BRAND } from "@/lib/brand-utils";
import {
  LAUNCH_SESSION_KEY,
  SURFACE_COMPANY_KEY,
  SHARED_MANIFEST_PATH,
  COMPANY_ICON_REVISION,
  activeMembership,
  approvedLogoUrl,
  buildCompanyManifest,
  companyIconSrc,
  companyManifestPath,
  installedLaunchCompanyId,
  isInstallDocumentPath,
  publishedSurfaceIsCurrent,
  type InstallMembership,
} from "@/lib/pwa-company-install";
import { rasterizeCompanyIcons } from "@/lib/pwa-company-raster";
import { waitForActiveServiceWorker, writeCompanyCacheInBrowser } from "@/lib/pwa-company-browser";
import type { CompanyContext } from "@/types";

const SURFACE_NAME_KEY = "overwatch:pwa-surface-name";
const SURFACE_ICON_REVISION_KEY = "overwatch:pwa-surface-icon-revision";
const GENERIC_TITLE = "Overwatch";
const GENERIC_TOUCH_ICON = "/overwatch/images/apple-touch-icon.png?v=2";
const GENERIC_FAVICON = "/overwatch/favicon.png?v=2";
const GENERIC_ICON_192 = "/overwatch/images/icon-192.png?v=2";

function setMeta(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function setLink(selector: string, href: string, create: () => HTMLLinkElement) {
  const link = document.querySelector(selector);
  if (link) {
    link.setAttribute("href", href);
    return;
  }
  const created = create();
  created.setAttribute("href", href);
  document.head.appendChild(created);
}

function setManifest(href: string) {
  const links = [...document.querySelectorAll('link[rel="manifest"]')];
  const [keep, ...rest] = links;
  for (const extra of rest) extra.remove();
  if (keep) {
    keep.setAttribute("href", href);
    return;
  }
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = href;
  document.head.appendChild(link);
}

/** Shortcut dialogs read these. The manifest is a second read. Both follow the same company. */
export function applyCompanySurface(companyId: string, companyName: string, useLogo: boolean) {
  const icon = useLogo ? companyIconSrc(companyId, "icon-192.png") : GENERIC_TOUCH_ICON;
  setMeta("apple-mobile-web-app-title", companyName);
  setMeta("application-name", companyName);
  setManifest(companyManifestPath(companyId));
  setLink('link[rel="apple-touch-icon"]', icon, () => {
    const link = document.createElement("link");
    link.rel = "apple-touch-icon";
    return link;
  });
  if (useLogo) {
    setLink('link[rel="icon"][sizes="32x32"]', icon, () => {
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      return link;
    });
    setLink('link[rel="icon"][sizes="192x192"]', icon, () => {
      const link = document.createElement("link");
      link.rel = "icon";
      link.sizes = "192x192";
      link.type = "image/png";
      return link;
    });
  }
}

export function restoreGenericSurface() {
  setMeta("apple-mobile-web-app-title", GENERIC_TITLE);
  setMeta("application-name", GENERIC_TITLE);
  setManifest(SHARED_MANIFEST_PATH);
  setLink('link[rel="apple-touch-icon"]', GENERIC_TOUCH_ICON, () => {
    const link = document.createElement("link");
    link.rel = "apple-touch-icon";
    return link;
  });
  setLink('link[rel="icon"][sizes="32x32"]', GENERIC_FAVICON, () => {
    const link = document.createElement("link");
    link.rel = "icon";
    return link;
  });
  setLink('link[rel="icon"][sizes="192x192"]', GENERIC_ICON_192, () => {
    const link = document.createElement("link");
    link.rel = "icon";
    link.sizes = "192x192";
    return link;
  });
  try {
    sessionStorage.removeItem(SURFACE_COMPANY_KEY);
    sessionStorage.removeItem(SURFACE_NAME_KEY);
    sessionStorage.removeItem(SURFACE_ICON_REVISION_KEY);
  } catch { /* private mode */ }
}

function toMembership(company: CompanyContext): InstallMembership {
  return {
    companyId: company.companyId,
    companyName: company.companyName,
    companyLogo: company.companyLogo,
    brandColor: company.brandColor,
    status: company.membership?.status ?? "active",
  };
}

function sessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function manifestHref(): string {
  return document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
}

/** The worker can become active after the short budget if its script was slow to arrive. */
function waitForController(ms: number): Promise<boolean> {
  if (navigator.serviceWorker.controller) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (controlled: boolean) => {
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      resolve(controlled);
    };
    const onChange = () => {
      if (navigator.serviceWorker.controller) finish(true);
    };
    const timer = window.setTimeout(() => finish(Boolean(navigator.serviceWorker.controller)), ms);
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
  });
}

/**
 * The browser menu reads this document. An installed launch (`?ow_company=` or
 * the launch session) stays that company when the signed-in company changes
 * and when the user signs out. With no launch, the active company is published
 * after its cache is stored and this document is controlled. This does not
 * navigate; a reload would drop whatever the person is editing.
 */
export function CompanyInstallSurface() {
  const company = useActiveCompany();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const companyId = company?.companyId ?? null;

  useEffect(() => {
    if (isInstallDocumentPath(window.location.pathname)) return;
    const launchId = installedLaunchCompanyId(window.location.search, sessionGet);
    const companies = (useAuthStore.getState().user?.companies ?? []).map(toMembership);
    const launch = launchId ? activeMembership(companies, launchId) : null;
    const active = !launchId && companyId ? activeMembership(companies, companyId) : null;
    const target = launch ?? active;
    if (launchId && !target) return;
    if (!target) {
      restoreGenericSurface();
      return;
    }
    if (publishedSurfaceIsCurrent({
      manifestHref: manifestHref(),
      surfaceCompanyId: sessionGet(SURFACE_COMPANY_KEY),
      storedRevision: sessionGet(SURFACE_ICON_REVISION_KEY),
      companyId: target.companyId,
    })) {
      return;
    }
    const published = target;
    let cancelled = false;
    void (async () => {
      let useLogo = false;
      let icons: { path: string; blob: Blob }[] = [];
      const logo = approvedLogoUrl(published.companyId, published.companyLogo);
      if (logo) {
        try {
          icons = await rasterizeCompanyIcons(
            published.companyId,
            logo,
            companySurfaceHex(published.brandColor || DEFAULT_BRAND, "dark"),
          );
          useLogo = true;
        } catch {
          useLogo = false;
        }
      }
      if (cancelled) return;
      const built = buildCompanyManifest([published], published.companyId, useLogo);
      if (!built || !("caches" in window)) return;
      await writeCompanyCacheInBrowser(built, useLogo ? icons : []);
      if (cancelled) return;
      if (!("serviceWorker" in navigator)) return;
      await waitForActiveServiceWorker();
      if (cancelled) return;
      const controlled = navigator.serviceWorker.controller ? true : await waitForController(20_000);
      if (cancelled || !controlled) return;
      try {
        sessionStorage.setItem(SURFACE_COMPANY_KEY, built.companyId);
        sessionStorage.setItem(SURFACE_NAME_KEY, built.name);
        sessionStorage.setItem(SURFACE_ICON_REVISION_KEY, COMPANY_ICON_REVISION);
        if (launchId) sessionStorage.setItem(LAUNCH_SESSION_KEY, launchId);
      } catch { /* private mode */ }
      applyCompanySurface(built.companyId, built.name, useLogo);
    })();
    return () => { cancelled = true; };
  }, [userId, companyId]);

  return null;
}
