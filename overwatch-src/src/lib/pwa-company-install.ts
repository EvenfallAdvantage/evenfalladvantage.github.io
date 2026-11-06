/**
 * Explicit per-company PWA install.
 *
 * The shared /overwatch/manifest.json stays the default Overwatch app.
 * Choosing a company writes a different manifest under /overwatch/pwa/{id}/
 * into that company's own cache. Switching the active company does not write
 * that cache. Android may still keep only one home-screen icon per origin;
 * this module does not try to work around that.
 */

import { companySurfaceHex, DEFAULT_BRAND } from "@/lib/brand-utils";
import { OVERWATCH_ICONS } from "@/lib/pwa-install-policy";

export const LAUNCH_QUERY = "ow_company";
export const INSTALL_QUERY = "company";
export const LAUNCH_SESSION_KEY = "overwatch:pwa-launched-company";
export const SHARED_MANIFEST_PATH = "/overwatch/manifest.json";
export const PWA_SCOPE = "/overwatch/";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const COMPANY_ICON_FILES = [
  { file: "icon-192.png", sizes: "192x192", purpose: "any" },
  { file: "icon-512.png", sizes: "512x512", purpose: "any" },
  { file: "icon-maskable-192.png", sizes: "192x192", purpose: "maskable" },
  { file: "icon-maskable-512.png", sizes: "512x512", purpose: "maskable" },
] as const;

export type InstallMembership = {
  companyId: string;
  companyName: string;
  companyLogo: string | null;
  brandColor: string | null;
  status: string | null;
};

export type CompanyManifestIcon = {
  src: string;
  sizes: string;
  type: "image/png";
  purpose: "any" | "maskable";
};

export type BuiltCompanyManifest = {
  companyId: string;
  cacheName: string;
  manifestPath: string;
  startUrl: string;
  appId: string;
  name: string;
  shortName: string;
  themeColor: string;
  usedClientLogo: boolean;
  icons: CompanyManifestIcon[];
  body: {
    id: string;
    name: string;
    short_name: string;
    description: string;
    start_url: string;
    scope: string;
    display: "standalone";
    background_color: string;
    theme_color: string;
    icons: CompanyManifestIcon[];
  };
};

export function isUuid(id: string | null | undefined): id is string {
  return typeof id === "string" && UUID.test(id);
}

export function companyCacheName(companyId: string): string {
  return `overwatch-company-${companyId.toLowerCase()}`;
}

export function companyManifestPath(companyId: string): string {
  return `/overwatch/pwa/${companyId.toLowerCase()}/manifest.webmanifest`;
}

export function companyIconPath(companyId: string, file: string): string {
  return `/overwatch/pwa/${companyId.toLowerCase()}/${file}`;
}

/** Public company-logos object for this company only. Anything else falls back. */
export function approvedLogoUrl(companyId: string, logoUrl: string | null | undefined): string | null {
  if (!logoUrl || !isUuid(companyId)) return null;
  let url: URL;
  try {
    url = new URL(logoUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!url.hostname.endsWith(".supabase.co")) return null;
  const folder = `/storage/v1/object/public/company-logos/${companyId.toLowerCase()}/`;
  if (!url.pathname.toLowerCase().startsWith(folder)) return null;
  if (url.pathname.includes("..")) return null;
  return url.toString();
}

export function isActiveMembership(company: InstallMembership): boolean {
  return isUuid(company.companyId) && (company.status ?? "active") === "active";
}

export function installableCompanies(companies: InstallMembership[]): InstallMembership[] {
  return companies
    .filter(isActiveMembership)
    .slice()
    .sort((a, b) => a.companyName.localeCompare(b.companyName) || a.companyId.localeCompare(b.companyId));
}

export function activeMembership(companies: InstallMembership[], companyId: string | null): InstallMembership | null {
  if (!isUuid(companyId)) return null;
  const want = companyId.toLowerCase();
  const hit = companies.find((c) => c.companyId.toLowerCase() === want);
  if (!hit || !isActiveMembership(hit)) return null;
  return hit;
}

function cleanName(name: string): string {
  const clean = name.replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
  return clean || "Overwatch";
}

export function buildCompanyManifest(companies: InstallMembership[], companyId: string, useLogo: boolean): BuiltCompanyManifest | null {
  const company = activeMembership(companies, companyId);
  if (!company) return null;
  const id = company.companyId.toLowerCase();
  const name = cleanName(company.companyName).slice(0, 45).trim() || "Overwatch";
  const shortName = name.length <= 12 ? name : name.slice(0, 12).trim();
  const surface = companySurfaceHex(company.brandColor || DEFAULT_BRAND, "dark");
  const logoOk = useLogo && approvedLogoUrl(company.companyId, company.companyLogo) !== null;
  const icons: CompanyManifestIcon[] = logoOk
    ? COMPANY_ICON_FILES.map((icon) => ({
        src: companyIconPath(id, icon.file),
        sizes: icon.sizes,
        type: "image/png",
        purpose: icon.purpose,
      }))
    : OVERWATCH_ICONS.map((icon) => ({
        src: icon.src,
        sizes: icon.sizes,
        type: "image/png",
        purpose: icon.purpose,
      }));
  const startUrl = `/overwatch/?${LAUNCH_QUERY}=${id}`;
  const appId = `/overwatch/pwa/${id}/`;
  const body = {
    id: appId,
    name,
    short_name: shortName,
    description: `Overwatch for ${name}`,
    start_url: startUrl,
    scope: PWA_SCOPE,
    display: "standalone" as const,
    background_color: surface,
    theme_color: surface,
    icons,
  };
  return {
    companyId: id,
    cacheName: companyCacheName(id),
    manifestPath: companyManifestPath(id),
    startUrl,
    appId,
    name,
    shortName,
    themeColor: surface,
    usedClientLogo: logoOk,
    icons,
    body,
  };
}

export type CachePut = (cacheName: string, path: string, body: string, contentType: string) => Promise<void>;

/** Writes one company's manifest into that company's cache and no other. */
export async function storeCompanyManifest(put: CachePut, built: BuiltCompanyManifest): Promise<void> {
  await put(built.cacheName, built.manifestPath, JSON.stringify(built.body), "application/manifest+json");
}

/**
 * Start-URL company hint. Returns the membership id only when this account
 * has an active membership. Never returns an id that was merely requested.
 */
export function resolveLaunchCompany(companies: InstallMembership[], requested: string | null): string | null {
  const hit = activeMembership(companies, requested);
  return hit ? hit.companyId : null;
}

export const PWA_LAUNCH_BOOT = `(function(){
  var KEY=${JSON.stringify(LAUNCH_SESSION_KEY)};
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function param(search,name){
    var q=search.charAt(0)==="?"?search.slice(1):search;
    var parts=q.split("&");
    for(var i=0;i<parts.length;i++){
      var pair=parts[i].split("=");
      if(decodeURIComponent(pair[0]||"")===name)return decodeURIComponent((pair.slice(1).join("="))||"");
    }
    return "";
  }
  function setManifest(id){
    var link=document.querySelector('link[rel="manifest"]');
    if(!link)return;
    link.setAttribute("href","/overwatch/pwa/"+id.toLowerCase()+"/manifest.webmanifest");
  }
  try{
    var path=location.pathname||"";
    var search=location.search||"";
    if(path.indexOf("/install")!==-1){
      var chosen=param(search,${JSON.stringify(INSTALL_QUERY)});
      if(chosen&&UUID.test(chosen))setManifest(chosen);
      return;
    }
    var launch=param(search,${JSON.stringify(LAUNCH_QUERY)});
    if(launch&&UUID.test(launch)){
      sessionStorage.setItem(KEY,launch.toLowerCase());
      setManifest(launch);
      return;
    }
    var saved=sessionStorage.getItem(KEY);
    if(saved&&UUID.test(saved))setManifest(saved);
  }catch(e){}
})();`;
