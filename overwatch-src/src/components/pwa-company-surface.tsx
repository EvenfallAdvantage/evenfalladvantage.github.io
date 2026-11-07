"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useActiveCompany } from "@/stores/auth-store";
import { companySurfaceHex, DEFAULT_BRAND } from "@/lib/brand-utils";
import {
  SURFACE_COMPANY_KEY,
  SHARED_MANIFEST_PATH,
  activeMembership,
  approvedLogoUrl,
  buildCompanyManifest,
  companyIconPath,
  companyManifestPath,
  isInstallDocumentPath,
  type InstallMembership,
} from "@/lib/pwa-company-install";
import { rasterizeCompanyIcons } from "@/lib/pwa-company-raster";
import { waitForActiveServiceWorker, writeCompanyCacheInBrowser } from "@/lib/pwa-company-browser";

const SURFACE_NAME_KEY = "overwatch:pwa-surface-name";
const SURFACE_ONCE_KEY = "overwatch:pwa-surface-control-once";
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
  const icon = useLogo ? companyIconPath(companyId, "icon-192.png") : GENERIC_TOUCH_ICON;
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
  } catch { /* private mode */ }
}

/**
 * The browser menu on a signed-in page reads this document, not /install.
 * Publish the active company's name and icon only after its cache is stored
 * and this document is controlled. No company context leaves the generic
 * Overwatch manifest, title, and shield icons in place.
 */
export function CompanyInstallSurface() {
  const path = usePathname();
  const company = useActiveCompany();
  const companyId = company?.companyId ?? null;
  const companyName = company?.companyName ?? null;
  const companyLogo = company?.companyLogo ?? null;
  const brandColor = company?.brandColor ?? null;
  const status = company?.membership.status ?? null;

  useEffect(() => {
    if (isInstallDocumentPath(path || "")) return;
    const membership: InstallMembership | null = companyId
      ? {
          companyId,
          companyName: companyName || "Overwatch",
          companyLogo,
          brandColor,
          status,
        }
      : null;
    if (!membership || !activeMembership([membership], membership.companyId)) {
      restoreGenericSurface();
      return;
    }
    const published = membership;
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
      const active = await waitForActiveServiceWorker();
      if (cancelled || !active) return;
      try {
        sessionStorage.setItem(SURFACE_COMPANY_KEY, built.companyId);
        sessionStorage.setItem(SURFACE_NAME_KEY, built.name);
      } catch { /* private mode */ }
      if (!navigator.serviceWorker.controller) {
        let already = false;
        try { already = sessionStorage.getItem(SURFACE_ONCE_KEY) === built.companyId; } catch { already = true; }
        if (already) return;
        try { sessionStorage.setItem(SURFACE_ONCE_KEY, built.companyId); } catch { /* private mode */ }
        window.location.replace(window.location.href);
        return;
      }
      applyCompanySurface(built.companyId, built.name, useLogo);
    })();
    return () => { cancelled = true; };
  }, [path, companyId, companyName, companyLogo, brandColor, status]);

  return null;
}
