import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  INSTALL_QUERY,
  LAUNCH_QUERY,
  LAUNCH_SESSION_KEY,
  SURFACE_COMPANY_KEY,
  PWA_LAUNCH_BOOT,
  SHARED_MANIFEST_PATH,
  activeMembership,
  approvedLogoUrl,
  buildCompanyManifest,
  companyCacheName,
  companyInstallPath,
  companyManifestPath,
  INSTALL_CONTROL_ONCE_KEY,
  installCompanyIdFromSearch,
  installableCompanies,
  shouldNavigateToPublishManifest,
  isInstallDocumentPath,
  launchSessionMayRetargetManifest,
  resolveLaunchCompany,
  storeCompanyManifest,
  type InstallMembership,
} from "@/lib/pwa-company-install";

const rootDir = path.resolve(__dirname, "../..");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function company(over: Partial<InstallMembership> & { companyId: string; companyName: string }): InstallMembership {
  return {
    companyLogo: null,
    brandColor: "#1d3451",
    status: "active",
    ...over,
  };
}

const alpha = company({
  companyId: A,
  companyName: "Alpha Guard",
  companyLogo: `https://abc.supabase.co/storage/v1/object/public/company-logos/${A}/logo.png`,
  brandColor: "#102030",
});
const bravo = company({
  companyId: B,
  companyName: "Bravo Patrol",
  companyLogo: null,
  brandColor: "#080626",
});
const suspended = company({ companyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", companyName: "Closed", status: "suspended" });

function loadSwHelpers() {
  const src = fs.readFileSync(path.join(rootDir, "public/pwa-company-cache.js"), "utf8");
  const sandbox: { self: { owCompanyPwa?: Record<string, (...args: never[]) => unknown> }; globalThis: object; URL: typeof URL } = {
    self: {},
    globalThis: {},
    URL,
  };
  vm.runInNewContext(src, sandbox);
  return sandbox.self.owCompanyPwa as {
    companyCacheName: (id: string) => string;
    matchCompanyPwaPath: (pathname: string) => { companyId: string; file: string } | null;
    shouldPreserveCompanyCache: (name: string) => boolean;
    iconSrcAllowedForCompany: (src: string, companyId: string) => boolean;
    manifestBodyMatchesCompany: (text: string, companyId: string) => boolean;
  };
}

describe("two company manifests stay distinct", () => {
  const companies = [alpha, bravo, suspended];

  it("builds a stable manifest per company and refuses anyone else", () => {
    const first = buildCompanyManifest(companies, A, true);
    const again = buildCompanyManifest(companies, A.toUpperCase(), true);
    const second = buildCompanyManifest(companies, B, true);
    expect(first).not.toBeNull();
    expect(again).not.toBeNull();
    expect(second).not.toBeNull();
    expect(JSON.stringify(first!.body)).toBe(JSON.stringify(again!.body));
    expect(first!.appId).toBe(`/overwatch/pwa/${A}/`);
    expect(second!.appId).toBe(`/overwatch/pwa/${B}/`);
    expect(first!.appId).not.toBe(second!.appId);
    expect(first!.name).toBe("Alpha Guard");
    expect(second!.name).toBe("Bravo Patrol");
    expect(first!.startUrl).toBe(`/overwatch/?${LAUNCH_QUERY}=${A}`);
    expect(second!.startUrl).not.toBe(first!.startUrl);
    expect(first!.cacheName).not.toBe(second!.cacheName);
    expect(first!.usedClientLogo).toBe(true);
    expect(second!.usedClientLogo).toBe(false);
    expect(first!.icons.every((icon) => icon.src.includes(A))).toBe(true);
    expect(second!.icons.every((icon) => icon.src.startsWith("/overwatch/images/"))).toBe(true);
    expect(JSON.stringify(second!.body)).not.toContain(A);
    expect(JSON.stringify(first!.body)).not.toContain(B);
    expect(buildCompanyManifest(companies, suspended.companyId, true)).toBeNull();
    expect(buildCompanyManifest(companies, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", false)).toBeNull();
  });

  it("stores each manifest in its own cache and a later company does not rewrite the first", async () => {
    const buckets = new Map<string, Map<string, string>>();
    const put = async (cacheName: string, file: string, body: string) => {
      if (!buckets.has(cacheName)) buckets.set(cacheName, new Map());
      buckets.get(cacheName)!.set(file, body);
    };
    const savedA = buildCompanyManifest(companies, A, true)!;
    const savedB = buildCompanyManifest(companies, B, false)!;
    await storeCompanyManifest(put, savedA);
    const alphaBytes = buckets.get(savedA.cacheName)!.get(savedA.manifestPath);
    await storeCompanyManifest(put, savedB);
    expect(buckets.get(savedA.cacheName)!.get(savedA.manifestPath)).toBe(alphaBytes);
    expect(buckets.get(savedB.cacheName)!.get(savedB.manifestPath)).toContain("Bravo Patrol");
    expect(buckets.get(savedA.cacheName)!.get(savedA.manifestPath)).toContain("Alpha Guard");
    expect(buckets.has(SHARED_MANIFEST_PATH)).toBe(false);
  });

  it("lists only active memberships and will not launch a company the account is not in", () => {
    const listed = installableCompanies(companies);
    expect(listed.map((c) => c.companyName)).toEqual(["Alpha Guard", "Bravo Patrol"]);
    expect(activeMembership(companies, suspended.companyId)).toBeNull();
    expect(resolveLaunchCompany(companies, A)).toBe(A);
    expect(resolveLaunchCompany(companies, B)).toBe(B);
    expect(resolveLaunchCompany(companies, suspended.companyId)).toBeNull();
    expect(resolveLaunchCompany(companies, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")).toBeNull();
    expect(resolveLaunchCompany([bravo], A)).toBeNull();
  });

  it("accepts only that company's public logo bucket object", () => {
    expect(approvedLogoUrl(A, alpha.companyLogo)).toBe(alpha.companyLogo);
    expect(approvedLogoUrl(A, `https://abc.supabase.co/storage/v1/object/public/company-logos/${B}/logo.png`)).toBeNull();
    expect(approvedLogoUrl(A, "https://evil.example/logo.png")).toBeNull();
    expect(approvedLogoUrl(A, "http://abc.supabase.co/storage/v1/object/public/company-logos/" + A + "/logo.png")).toBeNull();
    expect(approvedLogoUrl(A, null)).toBeNull();
  });
});

describe("launch boot script", () => {
  type LinkEl = {
    parentNode: { children: LinkEl[]; insertBefore: (node: LinkEl, before: LinkEl | null) => void; removeChild: (node: LinkEl) => void } | null;
    attrs: Record<string, string>;
    getAttribute: (name: string) => string | null;
    setAttribute: (name: string, value: string) => void;
  };

  function run(href: string, session: Record<string, string> = {}, options?: { links?: { rel: string; href: string }[]; observe?: boolean; controlling?: boolean }) {
    const store = new Map(Object.entries(session));
    const observers: Array<() => void> = [];
    const head: { children: LinkEl[]; insertBefore: (node: LinkEl, before: LinkEl | null) => void; removeChild: (node: LinkEl) => void } = {
      children: [],
      insertBefore(node, before) {
        if (node.parentNode) node.parentNode.removeChild(node);
        const at = before ? head.children.indexOf(before) : -1;
        if (at >= 0) head.children.splice(at, 0, node);
        else head.children.unshift(node);
        node.parentNode = head;
        queueMicrotask(() => { for (const cb of observers) cb(); });
      },
      removeChild(node) {
        const at = head.children.indexOf(node);
        if (at >= 0) head.children.splice(at, 1);
        node.parentNode = null;
        queueMicrotask(() => { for (const cb of observers) cb(); });
      },
    };
    function makeLink(rel: string, hrefValue: string): LinkEl {
      const el: LinkEl = {
        parentNode: null,
        attrs: { rel, href: hrefValue },
        getAttribute(name) { return el.attrs[name] ?? null; },
        setAttribute(name, value) { el.attrs[name] = value; },
      };
      head.insertBefore(el, null);
      return el;
    }
    for (const item of options?.links ?? [{ rel: "manifest", href: SHARED_MANIFEST_PATH }]) makeLink(item.rel, item.href);
    const location = new URL(href);
    const sandbox: Record<string, unknown> = {
      location,
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
      },
      document: {
        head,
        documentElement: head,
        getElementsByTagName: (name: string) => (name === "link" ? head.children.slice() : []),
        createElement: (name: string) => {
          if (name !== "link") throw new Error(name);
          const el: LinkEl = {
            parentNode: null,
            attrs: {},
            getAttribute(attr) { return el.attrs[attr] ?? null; },
            setAttribute(attr, value) { el.attrs[attr] = value; },
          };
          return el;
        },
      },
      decodeURIComponent,
      queueMicrotask,
      navigator: { serviceWorker: { controller: options?.controlling ? {} : null } },
    };
    if (options?.observe !== false) {
      sandbox.MutationObserver = class {
        cb: () => void;
        constructor(cb: () => void) { this.cb = cb; }
        observe() { observers.push(() => this.cb()); }
      };
    }
    vm.runInNewContext(PWA_LAUNCH_BOOT, sandbox);
    const manifests = () => head.children.filter((el) => (el.getAttribute("rel") || "").split(/\s+/).includes("manifest")).map((el) => el.getAttribute("href"));
    return {
      manifests,
      session: Object.fromEntries(store),
      addManifest(hrefValue: string) { makeLink("manifest", hrefValue); },
      flush: () => new Promise((resolve) => setTimeout(resolve, 0)),
    };
  }

  it("pins the launched company manifest and does not retarget it from the install page", () => {
    const launched = run(`https://www.evenfalladvantage.com/overwatch/?${LAUNCH_QUERY}=${A}`);
    expect(launched.manifests()).toEqual([companyManifestPath(A)]);
    expect(launched.session[LAUNCH_SESSION_KEY]).toBe(A);

    const stayed = run("https://www.evenfalladvantage.com/overwatch/feed/", { [LAUNCH_SESSION_KEY]: A });
    expect(stayed.manifests()).toEqual([companyManifestPath(A)]);
    expect(stayed.session[LAUNCH_SESSION_KEY]).toBe(A);

    const uncontrolled = run(`https://www.evenfalladvantage.com/overwatch/install/?${INSTALL_QUERY}=${B}`, { [LAUNCH_SESSION_KEY]: A });
    expect(uncontrolled.manifests()).toEqual([]);
    expect(uncontrolled.session[LAUNCH_SESSION_KEY]).toBe(A);

    const installing = run(`https://www.evenfalladvantage.com/overwatch/install/?${INSTALL_QUERY}=${B}`, { [LAUNCH_SESSION_KEY]: A }, { controlling: true });
    expect(installing.manifests()).toEqual([companyManifestPath(B)]);
    expect(installing.session[LAUNCH_SESSION_KEY]).toBe(A);
    expect(installing.manifests().some((href) => href === SHARED_MANIFEST_PATH)).toBe(false);
  });

  it("inserts the company manifest only when the install document is controlled", () => {
    const uncontrolled = run(`https://www.evenfalladvantage.com/overwatch/install/?${INSTALL_QUERY}=${A}`, {}, { links: [] });
    expect(uncontrolled.manifests()).toEqual([]);
    const result = run(`https://www.evenfalladvantage.com/overwatch/install/?${INSTALL_QUERY}=${A}`, {}, { links: [], controlling: true });
    expect(result.manifests()).toEqual([companyManifestPath(A)]);
  });

  it("publishes a signed-in company on an app page only while that document is controlled", () => {
    const uncontrolled = run("https://www.evenfalladvantage.com/overwatch/feed/", { [SURFACE_COMPANY_KEY]: A });
    expect(uncontrolled.manifests()).toEqual([SHARED_MANIFEST_PATH]);
    const controlled = run("https://www.evenfalladvantage.com/overwatch/feed/", { [SURFACE_COMPANY_KEY]: A }, { controlling: true });
    expect(controlled.manifests()).toEqual([companyManifestPath(A)]);
    const other = run("https://www.evenfalladvantage.com/overwatch/feed/", { [SURFACE_COMPANY_KEY]: B }, { controlling: true });
    expect(other.manifests()).toEqual([companyManifestPath(B)]);
    expect(other.manifests().some((href) => href?.includes(A))).toBe(false);
    const launched = run(
      "https://www.evenfalladvantage.com/overwatch/feed/",
      { [LAUNCH_SESSION_KEY]: A, [SURFACE_COMPANY_KEY]: B },
      { controlling: true },
    );
    expect(launched.manifests()).toEqual([companyManifestPath(A)]);
  });

  it("restores the shared manifest on the install chooser and leaves other pages alone", () => {
    const chooser = run("https://www.evenfalladvantage.com/overwatch/install/", {}, { links: [] });
    expect(chooser.manifests()).toEqual([SHARED_MANIFEST_PATH]);

    const home = run("https://www.evenfalladvantage.com/overwatch/feed/");
    expect(home.manifests()).toEqual([SHARED_MANIFEST_PATH]);
    expect(home.session[LAUNCH_SESSION_KEY]).toBeUndefined();
  });

  it("drops a shared link added after the company install link", async () => {
    const result = run(`https://www.evenfalladvantage.com/overwatch/install/?${INSTALL_QUERY}=${A}`, {}, { links: [], controlling: true });
    expect(result.manifests()).toEqual([companyManifestPath(A)]);
    result.addManifest(SHARED_MANIFEST_PATH);
    await result.flush();
    expect(result.manifests()).toEqual([companyManifestPath(A)]);
  });

  it("ignores a company id that is not a uuid", () => {
    const result = run("https://www.evenfalladvantage.com/overwatch/?ow_company=../manifest.json");
    expect(result.manifests()).toEqual([SHARED_MANIFEST_PATH]);
    expect(result.session[LAUNCH_SESSION_KEY]).toBeUndefined();
    const install = run("https://www.evenfalladvantage.com/overwatch/install/?company=../manifest.json", {}, { links: [] });
    expect(install.manifests()).toEqual([SHARED_MANIFEST_PATH]);
  });
});

describe("install navigation", () => {
  it("uses the chosen company, not another active membership", () => {
    expect(companyInstallPath(A)).toBe(`/overwatch/install/?${INSTALL_QUERY}=${A}`);
    expect(companyInstallPath(B.toUpperCase())).toBe(`/overwatch/install/?${INSTALL_QUERY}=${B}`);
    expect(installCompanyIdFromSearch(`?${INSTALL_QUERY}=${A}`)).toBe(A);
    expect(installCompanyIdFromSearch(`?${INSTALL_QUERY}=${A.toUpperCase()}&extra=1`)).toBe(A);
    expect(installCompanyIdFromSearch(`?${INSTALL_QUERY}=not-a-uuid`)).toBeNull();
    expect(installCompanyIdFromSearch(`?${LAUNCH_QUERY}=${A}`)).toBeNull();
    expect(installCompanyIdFromSearch(`?foo=1&${INSTALL_QUERY}=${B}`)).toBe(B);
    expect(isInstallDocumentPath("/overwatch/install/")).toBe(true);
    expect(isInstallDocumentPath("/overwatch/feed/")).toBe(false);
    expect(launchSessionMayRetargetManifest("/overwatch/install/")).toBe(false);
    expect(launchSessionMayRetargetManifest("/overwatch/feed/")).toBe(true);
    expect(buildCompanyManifest([alpha, bravo], A, false)!.companyId).toBe(A);
    expect(buildCompanyManifest([alpha, bravo], B, false)!.name).toBe("Bravo Patrol");
    expect(buildCompanyManifest([bravo], A, false)).toBeNull();
  });

  it("navigates when the company link is missing and the cache is stored", () => {
    const base = {
      pathname: "/overwatch/install/",
      companyId: A,
      manifestHref: null as string | null,
      cacheReady: true,
      alreadyNavigated: false,
    };
    expect(shouldNavigateToPublishManifest(base)).toBe(true);
    expect(shouldNavigateToPublishManifest({ ...base, manifestHref: companyManifestPath(A) })).toBe(false);
    expect(shouldNavigateToPublishManifest({ ...base, manifestHref: SHARED_MANIFEST_PATH })).toBe(true);
    expect(shouldNavigateToPublishManifest({ ...base, cacheReady: false })).toBe(false);
    expect(shouldNavigateToPublishManifest({ ...base, alreadyNavigated: true })).toBe(false);
    expect(shouldNavigateToPublishManifest({ ...base, companyId: null })).toBe(false);
    expect(shouldNavigateToPublishManifest({ ...base, pathname: "/overwatch/" })).toBe(false);
    expect(INSTALL_CONTROL_ONCE_KEY).toBe("overwatch:pwa-install-control-once");
  });
});

describe("service worker company cache separation", () => {
  const api = loadSwHelpers();
  const sw = fs.readFileSync(path.join(rootDir, "public/sw.js"), "utf8");

  it("matches the TypeScript paths and leaves the shared manifest alone", () => {
    expect(api.companyCacheName(A)).toBe(companyCacheName(A));
    expect(api.matchCompanyPwaPath(companyManifestPath(A))).toEqual({ companyId: A, file: "manifest.webmanifest" });
    expect(api.matchCompanyPwaPath("/overwatch/manifest.json")).toBeNull();
    expect(api.matchCompanyPwaPath("/overwatch/pwa/not-a-uuid/manifest.webmanifest")).toBeNull();
    expect(api.matchCompanyPwaPath(`/overwatch/pwa/${B}/icon-512.png`)).toEqual({ companyId: B, file: "icon-512.png" });
    expect(api.iconSrcAllowedForCompany(`/overwatch/pwa/${A}/icon-192.png`, A)).toBe(true);
    expect(api.iconSrcAllowedForCompany("/overwatch/images/icon-512.png", A)).toBe(true);
    expect(api.iconSrcAllowedForCompany(`/overwatch/pwa/${B}/icon-512.png`, A)).toBe(false);
    const branded = buildCompanyManifest([alpha], A, true)!;
    expect(api.manifestBodyMatchesCompany(JSON.stringify(branded.body), A)).toBe(true);
    expect(api.manifestBodyMatchesCompany(JSON.stringify({ ...branded.body, id: `/overwatch/pwa/${B}/` }), A)).toBe(false);
    expect(api.manifestBodyMatchesCompany(JSON.stringify({
      ...branded.body,
      icons: [{ src: `/overwatch/pwa/${B}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" }],
    }), A)).toBe(false);
    expect(api.shouldPreserveCompanyCache(companyCacheName(A))).toBe(true);
    expect(api.shouldPreserveCompanyCache(companyCacheName(B))).toBe(true);
    expect(api.shouldPreserveCompanyCache("overwatch-pages-abc12345")).toBe(false);
    expect(api.shouldPreserveCompanyCache("overwatch-runtime-dev")).toBe(false);
  });

  it("does not fall back to the network for a company manifest", () => {
    const start = sw.indexOf("const companyPwa = owCompanyPwa.matchCompanyPwaPath");
    const end = sw.indexOf("if (url.pathname.startsWith(`${BASE_PATH}/api/`))");
    const block = sw.slice(start, end);
    expect(block).toContain("Not found");
    expect(block).toContain("no-store");
    expect(block).not.toContain("fetch(");
    expect(block).not.toContain("manifest.json");
    expect(block).toContain("owCompanyPwa.manifestBodyMatchesCompany");
    expect(sw).not.toContain("serveInstallDocumentBrand");
    expect(sw).not.toContain("installCompanyIdFromUrl");
    expect(sw).toContain("`${BASE_PATH}/install/`");
  });

  it("serves company urls outside the versioned caches and keeps them across activate", () => {
    expect(sw.startsWith('importScripts("pwa-company-cache.js");')).toBe(true);
    const fetchAt = sw.indexOf("owCompanyPwa.matchCompanyPwaPath");
    const sharedAt = sw.indexOf("staleWhileRevalidate");
    expect(fetchAt).toBeGreaterThan(0);
    expect(fetchAt).toBeLessThan(sharedAt);
    expect(sw).toContain("owCompanyPwa.shouldPreserveCompanyCache(k)");
    expect(sw).toContain("owCompanyPwa.companyCacheName(companyPwa.companyId)");
    expect(sw).not.toMatch(/logo_url|supabase|activeCompanyId/);
  });
});
