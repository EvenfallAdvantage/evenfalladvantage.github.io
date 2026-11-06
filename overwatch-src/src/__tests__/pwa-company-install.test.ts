import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  INSTALL_QUERY,
  LAUNCH_QUERY,
  LAUNCH_SESSION_KEY,
  PWA_LAUNCH_BOOT,
  SHARED_MANIFEST_PATH,
  activeMembership,
  approvedLogoUrl,
  buildCompanyManifest,
  companyCacheName,
  companyManifestPath,
  installableCompanies,
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
  const sandbox: { self: { owCompanyPwa?: Record<string, (...args: never[]) => unknown> }; globalThis: object } = {
    self: {},
    globalThis: {},
  };
  vm.runInNewContext(src, sandbox);
  return sandbox.self.owCompanyPwa as {
    companyCacheName: (id: string) => string;
    matchCompanyPwaPath: (pathname: string) => { companyId: string; file: string } | null;
    shouldPreserveCompanyCache: (name: string) => boolean;
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
  function run(href: string, session: Record<string, string> = {}) {
    const store = new Map(Object.entries(session));
    const link = {
      href: SHARED_MANIFEST_PATH,
      setAttribute: (name: string, value: string) => {
        if (name === "href") link.href = value;
      },
    };
    const location = new URL(href);
    const sandbox = {
      location,
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
      },
      document: {
        querySelector: (sel: string) => (sel === 'link[rel="manifest"]' ? link : null),
      },
      decodeURIComponent,
    };
    vm.runInNewContext(PWA_LAUNCH_BOOT, sandbox);
    return { manifest: link.href, session: Object.fromEntries(store) };
  }

  it("pins the launched company manifest and does not retarget it from the install page", () => {
    const launched = run(`https://www.evenfalladvantage.com/overwatch/?${LAUNCH_QUERY}=${A}`);
    expect(launched.manifest).toBe(companyManifestPath(A));
    expect(launched.session[LAUNCH_SESSION_KEY]).toBe(A);

    const stayed = run("https://www.evenfalladvantage.com/overwatch/feed/", { [LAUNCH_SESSION_KEY]: A });
    expect(stayed.manifest).toBe(companyManifestPath(A));
    expect(stayed.session[LAUNCH_SESSION_KEY]).toBe(A);

    const installing = run(`https://www.evenfalladvantage.com/overwatch/install/?${INSTALL_QUERY}=${B}`, { [LAUNCH_SESSION_KEY]: A });
    expect(installing.manifest).toBe(companyManifestPath(B));
    expect(installing.session[LAUNCH_SESSION_KEY]).toBe(A);
  });

  it("ignores a company id that is not a uuid", () => {
    const result = run("https://www.evenfalladvantage.com/overwatch/?ow_company=../manifest.json");
    expect(result.manifest).toBe(SHARED_MANIFEST_PATH);
    expect(result.session[LAUNCH_SESSION_KEY]).toBeUndefined();
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
    expect(api.shouldPreserveCompanyCache(companyCacheName(A))).toBe(true);
    expect(api.shouldPreserveCompanyCache(companyCacheName(B))).toBe(true);
    expect(api.shouldPreserveCompanyCache("overwatch-pages-abc12345")).toBe(false);
    expect(api.shouldPreserveCompanyCache("overwatch-runtime-dev")).toBe(false);
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
