/**
 * Shared public manifest.
 *
 * /overwatch/manifest.json is the default Overwatch install. It is never
 * rewritten for a company. A company install is a separate manifest URL
 * produced by src/lib/pwa-company-install.ts and stored only in that
 * company's cache.
 *
 * The live theme-color meta still follows the active company surface.
 * That does not change an installed company's cached icons.
 */

export const OVERWATCH_ICONS = [
  { src: "/overwatch/images/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/overwatch/images/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/overwatch/images/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: "/overwatch/images/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
] as const;

export const PWA_START_URL = "/overwatch/";
export const PWA_SCOPE = "/overwatch/";

export type InstallIconInput = {
  /** Set only by an explicit install confirmation. A company switch leaves this null. */
  explicitInstallCompanyId: string | null;
  activeCompanyId: string | null;
  /** Membership logo reference. Never copied into the public manifest. */
  logoUrl: string | null;
  /** Reserved for a future same-origin opaque snapshot. Not produced today. */
  logoSameOriginOpaque: boolean;
};

export type InstallIconDecision = {
  icons: typeof OVERWATCH_ICONS;
  manifestCompanyId: null;
  rewriteManifest: false;
  usedClientLogo: false;
  startUrl: typeof PWA_START_URL;
};

export function selectInstallIcons(_input: InstallIconInput): InstallIconDecision {
  return {
    icons: OVERWATCH_ICONS,
    manifestCompanyId: null,
    rewriteManifest: false,
    usedClientLogo: false,
    startUrl: PWA_START_URL,
  };
}
