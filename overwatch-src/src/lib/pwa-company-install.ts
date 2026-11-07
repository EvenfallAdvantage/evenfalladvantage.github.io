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
/** Active signed-in company whose manifest may be published on app pages. */
export const SURFACE_COMPANY_KEY = "overwatch:pwa-surface-company";
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

/** Static export path for the company chooser. Query is not known at build time. */
export function isInstallDocumentPath(pathname: string): boolean {
  return pathname.endsWith("/install") || pathname.endsWith("/install/");
}

export function installCompanyIdFromSearch(search: string): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const id = new URLSearchParams(query).get(INSTALL_QUERY);
  return isUuid(id) ? id.toLowerCase() : null;
}

export function companyInstallPath(companyId: string): string {
  return `/overwatch/install/?${INSTALL_QUERY}=${companyId.toLowerCase()}`;
}

/**
 * The launch session may retarget the manifest on an installed app's pages.
 * The install document's manifest belongs to ?company=, not to that session
 * and not to whichever company is active in the app.
 */
export function launchSessionMayRetargetManifest(pathname: string): boolean {
  return !isInstallDocumentPath(pathname);
}

/**
 * Installed-app identity. `?ow_company=` wins, then the launch session.
 * Only a uuid is accepted. This is not the company currently selected in the app.
 */
export function installedLaunchCompanyId(
  search: string,
  readSession: (key: string) => string | null,
): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const fromUrl = new URLSearchParams(query).get(LAUNCH_QUERY);
  if (isUuid(fromUrl)) return fromUrl.toLowerCase();
  try {
    const saved = readSession(LAUNCH_SESSION_KEY);
    if (isUuid(saved)) return saved.toLowerCase();
  } catch { /* private mode */ }
  return null;
}

/** Set before the one navigation that publishes the company manifest. */
export const INSTALL_CONTROL_ONCE_KEY = "overwatch:pwa-install-control-once";

/**
 * Publish the company manifest with one navigation when this document does not
 * already have that company's manifest link. A controlling worker is not
 * enough: the install document's boot script removes manifest links until
 * parse time, and clients.claim() can set the controller on that same
 * document without removing the observer. An empty cache does not navigate.
 * A second automatic attempt does not loop. A link that already points at
 * this company is left in place.
 */
export function shouldNavigateToPublishManifest(input: {
  pathname: string;
  companyId: string | null;
  manifestHref: string | null;
  cacheReady: boolean;
  alreadyNavigated: boolean;
}): boolean {
  if (!isInstallDocumentPath(input.pathname)) return false;
  if (!isUuid(input.companyId)) return false;
  if (input.manifestHref === companyManifestPath(input.companyId)) return false;
  if (!input.cacheReady) return false;
  if (input.alreadyNavigated) return false;
  return true;
}

/**
 * Inline head script. Runs while the document is parsing.
 *
 * The previous script only rewrote a manifest link that was already in the
 * tree. Next emits that link from root metadata, often after this script, so
 * the rewrite did not run and Chromium obtained /overwatch/manifest.json
 * (name "Overwatch"). The manifest spec does allow a page to replace the
 * link (https://www.w3.org/TR/appmanifest/, internationalization considerations).
 * This script does not depend on that replacement winning: the exported
 * install document has no manifest link (scripts/strip-install-manifest.mjs).
 * The company URL is inserted only when this document already has a
 * controlling service worker, so the browser's own manifest fetch is not a
 * network 404. A signed-in app page publishes its active company the same
 * way, and only after that company's cache exists. With no company context
 * the shared Overwatch manifest stays.
 *
 * Marker ow-install-manifest is how the export check finds this script.
 */
export const PWA_LAUNCH_BOOT = `(function(){/* ow-install-manifest */
  var KEY=${JSON.stringify(LAUNCH_SESSION_KEY)};
  var SURFACE=${JSON.stringify(SURFACE_COMPANY_KEY)};
  var SHARED=${JSON.stringify(SHARED_MANIFEST_PATH)};
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
  function isInstall(path){
    return path.endsWith("/install")||path.endsWith("/install/");
  }
  function companyHref(id){
    return "/overwatch/pwa/"+id.toLowerCase()+"/manifest.webmanifest";
  }
  function manifestLinks(){
    var found=[];
    var links=document.getElementsByTagName("link");
    for(var i=0;i<links.length;i++){
      var rel=(links[i].getAttribute("rel")||"").toLowerCase();
      if(rel.split(/\\s+/).indexOf("manifest")!==-1)found.push(links[i]);
    }
    return found;
  }
  function controlling(){
    try{return !!(navigator.serviceWorker&&navigator.serviceWorker.controller);}catch(e){return false;}
  }
  function removeManifests(){
    var links=manifestLinks();
    for(var i=0;i<links.length;i++){
      if(links[i].parentNode)links[i].parentNode.removeChild(links[i]);
    }
  }
  function setOnly(href){
    var links=manifestLinks();
    var keep=null;
    for(var i=0;i<links.length;i++){
      if(!keep&&links[i].getAttribute("href")===href)keep=links[i];
    }
    for(var j=0;j<links.length;j++){
      if(links[j]!==keep&&links[j].parentNode)links[j].parentNode.removeChild(links[j]);
    }
    if(keep)return;
    var parent=document.head||document.documentElement;
    if(!parent)return;
    var link=document.createElement("link");
    link.setAttribute("rel","manifest");
    link.setAttribute("href",href);
    parent.insertBefore(link,parent.firstChild);
  }
  function desired(){
    var path=location.pathname||"";
    var search=location.search||"";
    if(isInstall(path)){
      var chosen=param(search,${JSON.stringify(INSTALL_QUERY)});
      if(chosen&&UUID.test(chosen))return controlling()?companyHref(chosen):"strip";
      return SHARED;
    }
    var launch=param(search,${JSON.stringify(LAUNCH_QUERY)});
    if(launch&&UUID.test(launch)){
      try{sessionStorage.setItem(KEY,launch.toLowerCase());}catch(e){}
      return companyHref(launch);
    }
    try{
      var saved=sessionStorage.getItem(KEY);
      if(saved&&UUID.test(saved))return companyHref(saved);
    }catch(e2){}
    if(controlling()){
      try{
        var surface=sessionStorage.getItem(SURFACE);
        if(surface&&UUID.test(surface))return companyHref(surface);
      }catch(e3){}
    }
    return "";
  }
  try{
    var href=desired();
    if(!href)return;
    var path=location.pathname||"";
    var chosen=param(location.search||"",${JSON.stringify(INSTALL_QUERY)});
    var companyInstall=isInstall(path)&&chosen&&UUID.test(chosen);
    if(href==="strip"){
      removeManifests();
      if(companyInstall&&typeof MutationObserver==="function"&&document.head){
        var stripObs=new MutationObserver(function(){ if(manifestLinks().length)removeManifests(); });
        stripObs.observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:["href","rel"]});
      }
      return;
    }
    setOnly(href);
    if(!companyInstall||typeof MutationObserver!=="function"||!document.head)return;
    var lock=companyHref(chosen);
    var obs=new MutationObserver(function(){
      var links=manifestLinks();
      if(links.length===1&&links[0].getAttribute("href")===lock)return;
      setOnly(lock);
    });
    obs.observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:["href","rel"]});
  }catch(e){}
})();`;
