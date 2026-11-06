import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  assessCompanyInstallFetch,
  companyInstallUrlIfVerified,
  INSTALL_CACHE_MESSAGE,
  INSTALL_ICON_MESSAGE,
  INSTALL_MANIFEST_MESSAGE,
  INSTALL_WORKER_MESSAGE,
  type IconProbe,
  type ManifestProbe,
} from "@/lib/pwa-company-finalize";
import { buildCompanyManifest, companyManifestPath, type InstallMembership } from "@/lib/pwa-company-install";

const rootDir = path.resolve(__dirname, "../..");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOGO = `https://abc.supabase.co/storage/v1/object/public/company-logos/${A}/mark.png`;
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const OTHER_PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 9, 9, 9]);

function membership(id: string, name: string, logo: string | null): InstallMembership {
  return { companyId: id, companyName: name, companyLogo: logo, brandColor: "#102030", status: "active" };
}

const builtA = buildCompanyManifest([membership(A, "Northstar Recruitment", LOGO)], A, true)!;
const builtB = buildCompanyManifest([membership(B, "Harbor Watch", null)], B, false)!;

function probeManifest(body: unknown, status = 200, contentType: string | null = "application/manifest+json"): ManifestProbe {
  return { status, contentType, text: JSON.stringify(body) };
}

function probeIcon(src: string, bytes: Uint8Array, status = 200, contentType: string | null = "image/png"): IconProbe {
  return { src, status, contentType, bytes };
}

function storedFor(built: typeof builtA, bytes: Uint8Array) {
  return built.icons.filter((icon) => icon.src.startsWith(`/overwatch/pwa/${built.companyId}/`)).map((icon) => ({ path: icon.src, bytes }));
}

type Hit = { contentType: string; text?: string; bytes?: Uint8Array };
type SwApi = { matchCompanyPwaPath: (pathname: string) => { companyId: string; file: string } | null; manifestBodyMatchesCompany: (text: string, companyId: string) => boolean };

function loadSw(): SwApi {
  const src = fs.readFileSync(path.join(rootDir, "public/pwa-company-cache.js"), "utf8");
  const sandbox: { self: { owCompanyPwa?: SwApi } } = { self: {} };
  vm.runInNewContext(src, sandbox);
  return sandbox.self.owCompanyPwa as SwApi;
}

/**
 * Same routing rules as the service worker: an uncontrolled document or an
 * inactive worker never reads the company cache. A controlled fetch reads
 * only that URL's company bucket, and a manifest body for a different id is a 404.
 */
function createCompanyRoute(sw: SwApi) {
  const buckets = new Map<string, Map<string, Hit>>();
  let active = false;
  let controlled = false;
  let commit: Promise<void> = Promise.resolve();
  return {
    setWorker(next: { active?: boolean; controlled?: boolean }) {
      if (next.active !== undefined) active = next.active;
      if (next.controlled !== undefined) controlled = next.controlled;
    },
    holdCommit() {
      let release: () => void = () => {};
      commit = new Promise((resolve) => { release = resolve; });
      return release;
    },
    async put(companyId: string, path: string, hit: Hit) {
      const pending = commit;
      await pending;
      if (!buckets.has(companyId)) buckets.set(companyId, new Map());
      buckets.get(companyId)!.set(path, hit);
    },
    fetch(pathname: string) {
      if (!active || !controlled) return { status: 404, contentType: "text/plain", via: "network" as const, text: "missing", bytes: undefined as Uint8Array | undefined };
      const match = sw.matchCompanyPwaPath(pathname.split("?")[0]);
      if (!match) return { status: 404, contentType: "text/plain", via: "network" as const, text: "missing", bytes: undefined as Uint8Array | undefined };
      const hit = buckets.get(match.companyId)?.get(pathname.split("?")[0]);
      if (!hit) return { status: 404, contentType: "text/plain", via: "service-worker" as const, text: "Not found", bytes: undefined as Uint8Array | undefined };
      if (match.file === "manifest.webmanifest" && !sw.manifestBodyMatchesCompany(hit.text || "", match.companyId)) {
        return { status: 404, contentType: "text/plain", via: "service-worker" as const, text: "Not found", bytes: undefined as Uint8Array | undefined };
      }
      return { status: 200, contentType: hit.contentType, via: "service-worker" as const, text: hit.text, bytes: hit.bytes };
    },
  };
}

describe("company install finalization", () => {
  const sw = loadSw();
  const route = createCompanyRoute(sw);

  it("does not navigate when the cache commit has not happened yet", async () => {
    const release = route.holdCommit();
    const pending = route.put(A, builtA.manifestPath, { contentType: "application/manifest+json", text: JSON.stringify(builtA.body) });
    route.setWorker({ active: true, controlled: true });
    const early = route.fetch(builtA.manifestPath);
    expect(early.status).toBe(404);
    expect(early.text).not.toContain("Northstar Recruitment");
    const blocked = assessCompanyInstallFetch({
      built: builtA,
      storedIcons: storedFor(builtA, PNG),
      cacheReady: false,
      controlling: true,
      manifest: null,
      icons: [],
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.message).toBe(INSTALL_CACHE_MESSAGE);
    expect(companyInstallUrlIfVerified(blocked, A)).toBeNull();
    release();
    await pending;
    const late = route.fetch(builtA.manifestPath);
    expect(late.status).toBe(200);
    expect(late.via).toBe("service-worker");
    expect(late.text).toContain("Northstar Recruitment");
  });

  it("keeps an uncontrolled document on the network miss even after the cache is full", async () => {
    route.setWorker({ active: true, controlled: false });
    await route.put(A, builtA.manifestPath, { contentType: "application/manifest+json", text: JSON.stringify(builtA.body) });
    const missed = route.fetch(`${builtA.manifestPath}?cache=1`);
    expect(missed.via).toBe("network");
    expect(missed.status).toBe(404);
    const assessment = assessCompanyInstallFetch({
      built: builtA,
      storedIcons: storedFor(builtA, PNG),
      cacheReady: true,
      controlling: false,
      manifest: null,
      icons: [],
    });
    expect(assessment).toEqual({ ok: false, code: "not-controlling", message: INSTALL_WORKER_MESSAGE });
    expect(companyInstallUrlIfVerified(assessment, A)).toBeNull();
  });

  it("navigates only when the controlled fetch matches the selected company", () => {
    route.setWorker({ active: true, controlled: true });
    const served = route.fetch(companyManifestPath(A.toUpperCase()));
    expect(served.status).toBe(200);
    const parsed = JSON.parse(served.text || "{}") as { name: string; theme_color: string; background_color: string };
    expect(parsed.name).toBe(builtA.name);
    expect(parsed.theme_color).toBe(builtA.themeColor);
    expect(parsed.background_color).toBe(builtA.body.background_color);
    const icons = builtA.icons.map((icon) => probeIcon(icon.src, PNG));
    const ok = assessCompanyInstallFetch({
      built: builtA,
      storedIcons: storedFor(builtA, PNG),
      cacheReady: true,
      controlling: true,
      manifest: probeManifest(builtA.body),
      icons,
    });
    expect(ok).toEqual({ ok: true });
    expect(companyInstallUrlIfVerified(ok, A)).toBe(`/overwatch/install/?company=${A}`);
  });

  it("rejects a stale manifest, another company's icon, and recolored bytes", async () => {
    const stale = { ...builtA.body, id: `/overwatch/pwa/${B}/`, start_url: `/overwatch/?ow_company=${B}` };
    await route.put(A, builtA.manifestPath, { contentType: "application/manifest+json", text: JSON.stringify(stale) });
    route.setWorker({ active: true, controlled: true });
    expect(route.fetch(builtA.manifestPath).status).toBe(404);
    expect(route.fetch(`/overwatch/pwa/${B}/icon-192.png`).status).toBe(404);
    await route.put(A, builtA.icons[0].src, { contentType: "image/png", bytes: PNG });
    expect(route.fetch(builtA.icons[0].src).bytes).toEqual(PNG);
    expect(route.fetch(`/overwatch/pwa/${B}/icon-192.png`).status).toBe(404);

    const wrongBytes = assessCompanyInstallFetch({
      built: builtA,
      storedIcons: storedFor(builtA, PNG),
      cacheReady: true,
      controlling: true,
      manifest: probeManifest(builtA.body),
      icons: builtA.icons.map((icon) => probeIcon(icon.src, OTHER_PNG)),
    });
    expect(wrongBytes).toEqual({ ok: false, code: "icon", message: INSTALL_ICON_MESSAGE });

    const shared = assessCompanyInstallFetch({
      built: builtA,
      storedIcons: storedFor(builtA, PNG),
      cacheReady: true,
      controlling: true,
      manifest: probeManifest({ ...builtA.body, name: "Overwatch", id: "/overwatch/" }),
      icons: builtA.icons.map((icon) => probeIcon(icon.src, PNG)),
    });
    expect(shared).toEqual({ ok: false, code: "manifest", message: INSTALL_MANIFEST_MESSAGE });
    expect(companyInstallUrlIfVerified(shared, A)).toBeNull();
    expect(builtB.icons.every((icon) => icon.src.startsWith("/overwatch/images/"))).toBe(true);
    expect(JSON.stringify(builtA.body)).not.toContain(B);
  });

  it("does not treat a non-manifest response as success", () => {
    const html = assessCompanyInstallFetch({
      built: builtA,
      storedIcons: storedFor(builtA, PNG),
      cacheReady: true,
      controlling: true,
      manifest: { status: 404, contentType: "text/plain", text: "Not found" },
      icons: [],
    });
    expect(html.ok).toBe(false);
    if (!html.ok) expect(html.code).toBe("manifest");
  });
});
