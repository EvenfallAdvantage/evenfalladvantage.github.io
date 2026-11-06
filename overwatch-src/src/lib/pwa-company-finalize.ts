import { OVERWATCH_ICONS } from "@/lib/pwa-install-policy";
import {
  companyInstallPath,
  companyManifestPath,
  type BuiltCompanyManifest,
} from "@/lib/pwa-company-install";

/**
 * One budget for worker control and every proving fetch. Not a poll.
 * finalizeCompanyInstallInBrowser applies it with an AbortSignal, including
 * the manifest and icon requests.
 */
export const COMPANY_INSTALL_READY_MS = 8000;

export const INSTALL_CACHE_MESSAGE =
  "The company manifest is not in this browser's cache yet. Stay on this page and press Install again. Overwatch was not installed.";
export const INSTALL_WORKER_MESSAGE =
  "This browser's service worker is not controlling this page yet, so the company manifest cannot be served. Stay on this page, reload Overwatch yourself, and press Install again. Overwatch was not installed.";
export const INSTALL_MANIFEST_MESSAGE =
  "The manifest served for that company did not match the one just saved. Stay on this page and press Install again. Overwatch was not installed.";
export const INSTALL_ICON_MESSAGE =
  "A saved icon for that company was not served from its cache. Stay on this page and press Install again. Overwatch was not installed.";
export const INSTALL_TIMEOUT_MESSAGE =
  "Saving the company install took too long. Stay on this page and press Install again. Overwatch was not installed.";

const SHARED_ICON_SRCS = new Set<string>(OVERWATCH_ICONS.map((icon) => icon.src));

export function iconSrcAllowedForCompany(src: string, companyId: string): boolean {
  const id = companyId.toLowerCase();
  const own = `/overwatch/pwa/${id}/`;
  if (src.startsWith(own)) {
    const file = src.slice(own.length);
    return file === "icon-192.png" || file === "icon-512.png" || file === "icon-maskable-192.png" || file === "icon-maskable-512.png";
  }
  return SHARED_ICON_SRCS.has(src);
}

export type ManifestProbe = {
  status: number;
  contentType: string | null;
  text: string;
};

export type IconProbe = {
  src: string;
  status: number;
  contentType: string | null;
  bytes: Uint8Array;
};

export type FinalizeAssessment =
  | { ok: true }
  | { ok: false; code: "not-cached" | "not-controlling" | "manifest" | "icon"; message: string };

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let i = 0; i < left.byteLength; i += 1) if (left[i] !== right[i]) return false;
  return true;
}

/**
 * Decides whether the selected company's install URL may be opened.
 * A miss, a worker that is not controlling, or a body that is not this
 * company's cached manifest never becomes a navigation. The shared
 * Overwatch manifest is not a successful result.
 */
export function assessCompanyInstallFetch(input: {
  built: BuiltCompanyManifest;
  storedIcons: { path: string; bytes: Uint8Array }[];
  cacheReady: boolean;
  controlling: boolean;
  manifest: ManifestProbe | null;
  icons: IconProbe[];
}): FinalizeAssessment {
  if (!input.cacheReady) return { ok: false, code: "not-cached", message: INSTALL_CACHE_MESSAGE };
  if (!input.controlling) return { ok: false, code: "not-controlling", message: INSTALL_WORKER_MESSAGE };
  const manifest = input.manifest;
  if (!manifest || manifest.status !== 200 || !manifest.contentType?.includes("application/manifest+json")) {
    return { ok: false, code: "manifest", message: INSTALL_MANIFEST_MESSAGE };
  }
  let parsed: BuiltCompanyManifest["body"];
  try {
    parsed = JSON.parse(manifest.text) as BuiltCompanyManifest["body"];
  } catch {
    return { ok: false, code: "manifest", message: INSTALL_MANIFEST_MESSAGE };
  }
  const expected = input.built.body;
  if (parsed.name !== expected.name || parsed.id !== expected.id || parsed.start_url !== expected.start_url) {
    return { ok: false, code: "manifest", message: INSTALL_MANIFEST_MESSAGE };
  }
  if (parsed.theme_color !== expected.theme_color || parsed.background_color !== expected.background_color) {
    return { ok: false, code: "manifest", message: INSTALL_MANIFEST_MESSAGE };
  }
  if (parsed.id !== `/overwatch/pwa/${input.built.companyId}/`) {
    return { ok: false, code: "manifest", message: INSTALL_MANIFEST_MESSAGE };
  }
  if (!Array.isArray(parsed.icons) || parsed.icons.length !== expected.icons.length) {
    return { ok: false, code: "manifest", message: INSTALL_MANIFEST_MESSAGE };
  }
  for (let i = 0; i < expected.icons.length; i += 1) {
    const src = parsed.icons[i]?.src;
    if (src !== expected.icons[i].src || !iconSrcAllowedForCompany(src, input.built.companyId)) {
      return { ok: false, code: "manifest", message: INSTALL_MANIFEST_MESSAGE };
    }
  }
  if (input.icons.length !== expected.icons.length) {
    return { ok: false, code: "icon", message: INSTALL_ICON_MESSAGE };
  }
  for (let i = 0; i < expected.icons.length; i += 1) {
    const probe = input.icons[i];
    const src = expected.icons[i].src;
    if (!probe || probe.src !== src || probe.status !== 200 || !probe.contentType?.startsWith("image/")) {
      return { ok: false, code: "icon", message: INSTALL_ICON_MESSAGE };
    }
    const own = src.startsWith(`/overwatch/pwa/${input.built.companyId}/`);
    if (own) {
      if (!probe.contentType.includes("image/png")) return { ok: false, code: "icon", message: INSTALL_ICON_MESSAGE };
      const stored = input.storedIcons.find((icon) => icon.path === src);
      if (!stored || !sameBytes(probe.bytes, stored.bytes)) return { ok: false, code: "icon", message: INSTALL_ICON_MESSAGE };
    }
  }
  return { ok: true };
}

export function companyInstallUrlIfVerified(assessment: FinalizeAssessment, companyId: string): string | null {
  if (!assessment.ok) return null;
  if (companyManifestPath(companyId) !== `/overwatch/pwa/${companyId.toLowerCase()}/manifest.webmanifest`) return null;
  return companyInstallPath(companyId);
}
