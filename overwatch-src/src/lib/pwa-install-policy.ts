/**
 * Installed-PWA icon policy.
 *
 * Choice implemented: the public manifest stays the default Overwatch icons
 * for every company. An install does not capture a client logo, and switching
 * the active company does not rewrite icons.
 *
 * Why not a per-company icon:
 * - The site is a static Next export. One manifest URL is fetched with no
 *   session, so it cannot vary by membership.
 * - Company logos are stored in the public `company-logos` bucket, addressed
 *   by company id. Putting that URL on the unauthenticated manifest would
 *   publish the company id and the logo to anyone who can request the file.
 * - Chrome refreshes a home-screen icon when manifest icons change. Binding
 *   the icon to `overwatch-auth`'s activeCompanyId would replace the installed
 *   icon on an ordinary company switch. The icon is an install-time choice;
 *   this build does not snapshot one, so it stays the Overwatch default.
 *
 * What does follow the active company: the Android system navigation bar.
 * `theme-color` and the document background (`--background`) update when the
 * active company changes. That channel is not the icon.
 *
 * Start URL stays `/overwatch/`. A logged-out launch has no company in the
 * path. After sign-in the existing persisted activeCompanyId selects the
 * company the membership allows. No company-specific start path is introduced.
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
