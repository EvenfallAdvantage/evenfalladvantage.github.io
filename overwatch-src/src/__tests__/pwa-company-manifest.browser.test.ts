import { describe, it, expect } from "vitest";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { AddressInfo } from "node:net";
import type { Page } from "playwright-core";
import {
  LAUNCH_QUERY,
  PWA_LAUNCH_BOOT,
  SHARED_MANIFEST_PATH,
  buildCompanyManifest,
  companyCacheName,
  companyIconPath,
  companyIconSrc,
  companyManifestPath,
  type InstallMembership,
} from "@/lib/pwa-company-install";

const rootDir = path.resolve(__dirname, "../..");
const chromeCandidates = [process.env.CHROME_PATH, "/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].filter(
  (item): item is string => Boolean(item),
);
const chromePath = chromeCandidates.find((item) => fs.existsSync(item));

const COMPANY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COMPANY_NAME = "Northstar Recruitment";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

function pageHtml(options: { manifestLink: boolean }): string {
  const link = options.manifestLink
    ? `<link rel="manifest" href="${SHARED_MANIFEST_PATH}">`
    : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Overwatch</title>${link}<script>${PWA_LAUNCH_BOOT}</script></head><body><p>Overwatch</p></body></html>`;
}

function startServer(files: Map<string, { body: Buffer; type: string }>) {
    const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const key = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    const hit = files.get(key);
    if (!hit) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("missing");
      return;
    }
    // Cache-Control: no-store makes Cache.add() in the service worker install
    // handler fail to settle in this Chrome, so the worker never activates.
    res.writeHead(200, { "Content-Type": hit.type });
    res.end(hit.body);
  });
  return new Promise<{ server: http.Server; port: number }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: (server.address() as AddressInfo).port });
    });
  });
}

function solidPng(size: number, rgb: [number, number, number]): Buffer {
  const row = Buffer.alloc(1 + size * 4);
  row[0] = 0;
  for (let x = 0; x < size; x += 1) {
    row[1 + x * 4] = rgb[0];
    row[2 + x * 4] = rgb[1];
    row[3 + x * 4] = rgb[2];
    row[4 + x * 4] = 255;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = zlib.deflateSync(raw);
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const MANIFEST_FAILURES = [
  "manifest-parsing-or-network-error",
  "manifest-missing-name-or-short-name",
  "manifest-display-not-supported",
  "manifest-missing-suitable-icon",
  "no-acceptable-icon",
  "start-url-not-valid",
];

type AppManifest = { url?: string; data?: string; errors?: { message: string }[] };

async function readInstallability(page: Page): Promise<string[]> {
  const client = await page.context().newCDPSession(page);
  const result = await client.send("Page.getInstallabilityErrors") as { installabilityErrors?: { errorId: string }[] };
  return (result.installabilityErrors || []).map((error) => error.errorId);
}

async function readAppManifest(page: Page): Promise<AppManifest> {
  const client = await page.context().newCDPSession(page);
  let last: AppManifest = {};
  for (let attempt = 0; attempt < 10; attempt += 1) {
    last = await Promise.race([
      client.send("Page.getAppManifest") as Promise<AppManifest>,
      new Promise<AppManifest>((resolve) => setTimeout(() => resolve({ errors: [{ message: "cdp-timeout" }] }), 3000)),
    ]);
    if (last.data || last.errors?.some((error) => error.message === "cdp-timeout")) return last;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return last;
}

describe.skipIf(!chromePath)("chromium company manifest", () => {
  it("gives Page.getAppManifest the stored company name and icon, and leaves the default page on Overwatch", async () => {
    const membership: InstallMembership = {
      companyId: COMPANY,
      companyName: COMPANY_NAME,
      companyLogo: `https://abc.supabase.co/storage/v1/object/public/company-logos/${COMPANY}/logo.png`,
      brandColor: "#102030",
      status: "active",
    };
    const built = buildCompanyManifest([membership], COMPANY, true);
    expect(built).not.toBeNull();
    const manifestJson = JSON.stringify(built!.body);
    expect(manifestJson).toContain(COMPANY_NAME);
    expect(manifestJson).not.toContain("supabase");

    const strippedInstall = pageHtml({ manifestLink: false });
    const sharedFirstInstall = pageHtml({ manifestLink: true });
    expect(strippedInstall.includes('rel="manifest"')).toBe(false);
    expect(strippedInstall).toContain("ow-install-manifest");
    expect(sharedFirstInstall.indexOf('rel="manifest"')).toBeLessThan(sharedFirstInstall.indexOf("ow-install-manifest"));

    const files = new Map<string, { body: Buffer; type: string }>([
      ["/overwatch/index.html", { body: Buffer.from(pageHtml({ manifestLink: true })), type: "text/html" }],
      ["/overwatch/install/index.html", { body: Buffer.from(strippedInstall), type: "text/html" }],
      ["/overwatch/manifest.json", { body: fs.readFileSync(path.join(rootDir, "public/manifest.json")), type: "application/manifest+json" }],
      ["/overwatch/sw.js", { body: fs.readFileSync(path.join(rootDir, "public/sw.js")), type: "text/javascript" }],
      ["/overwatch/pwa-company-cache.js", { body: fs.readFileSync(path.join(rootDir, "public/pwa-company-cache.js")), type: "text/javascript" }],
    ]);
    const { server, port } = await startServer(files);
    const origin = `http://127.0.0.1:${port}`;
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    async function openControlled(context: Awaited<ReturnType<typeof browser.newContext>>) {
      const page = await context.newPage();
      await page.goto(`${origin}/overwatch/`, { waitUntil: "domcontentloaded" });
      await page.evaluate(async () => {
        const claimed = new Promise<void>((resolve) => {
          if (navigator.serviceWorker.controller) resolve();
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
        });
        await navigator.serviceWorker.register("/overwatch/sw.js", { scope: "/overwatch/" });
        await navigator.serviceWorker.ready;
        await claimed;
      });
      const defaultManifest = await readAppManifest(page);
      expect(defaultManifest.url).toContain(SHARED_MANIFEST_PATH);
      expect(defaultManifest.data).toContain('"name": "Overwatch"');
      const defaultLinks = await page.locator('link[rel="manifest"]').evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(defaultLinks).toEqual([SHARED_MANIFEST_PATH]);

      await page.evaluate(async ({ cacheName, manifestPath, manifestBody, icons, png }) => {
        const cache = await caches.open(cacheName);
        await cache.put(new URL(manifestPath, location.origin).toString(), new Response(manifestBody, {
          headers: { "Content-Type": "application/manifest+json" },
        }));
        for (const icon of icons) {
          const bytes = Uint8Array.from(png);
          await cache.put(new URL(icon, location.origin).toString(), new Response(bytes, {
            headers: { "Content-Type": "image/png" },
          }));
        }
      }, {
        cacheName: built!.cacheName,
        manifestPath: built!.manifestPath,
        manifestBody: manifestJson,
        icons: built!.icons.map((icon) => icon.src),
        png: Array.from(PNG),
      });
      return page;
    }

    try {
      const context = await browser.newContext();
      await context.addInitScript(() => {
        window.addEventListener("beforeinstallprompt", () => {
          const href = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
          (window as unknown as { __owManifestAtPrompt?: string }).__owManifestAtPrompt = href;
        });
      });
      const page = await openControlled(context);
      await page.goto(`${origin}/overwatch/install/?company=${COMPANY}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction((expected) => {
        const links = Array.from(document.querySelectorAll('link[rel="manifest"]')).map((el) => el.getAttribute("href"));
        return links.length === 1 && links[0] === expected && navigator.serviceWorker.controller !== null;
      }, built!.manifestPath);

      const served = await page.evaluate(async (manifestPath) => {
        const response = await fetch(manifestPath, { cache: "no-store" });
        const body = await response.json() as { name?: string; id?: string; start_url?: string; icons?: { src: string }[] };
        const icon = await fetch(body.icons?.[0]?.src || "", { cache: "no-store" });
        const bytes = Array.from(new Uint8Array(await icon.arrayBuffer()));
        return {
          status: response.status,
          name: body.name,
          id: body.id,
          startUrl: body.start_url,
          iconStatus: icon.status,
          bytes,
          controlled: navigator.serviceWorker.controller !== null,
        };
      }, built!.manifestPath);
      expect(served.controlled).toBe(true);
      expect(served.status).toBe(200);
      expect(served.name).toBe(COMPANY_NAME);
      expect(served.id).toBe(built!.appId);
      expect(served.startUrl).toBe(`/overwatch/?${LAUNCH_QUERY}=${COMPANY}`);
      expect(served.iconStatus).toBe(200);
      expect(Buffer.from(served.bytes)).toEqual(PNG);

      const installed = await readAppManifest(page);
      expect(installed.url).toContain(built!.manifestPath);
      const parsed = JSON.parse(installed.data || "{}") as { name?: string; id?: string; start_url?: string };
      expect(parsed.name).toBe(COMPANY_NAME);
      expect(parsed.id).toContain(`/overwatch/pwa/${COMPANY}/`);
      expect(parsed.start_url).toContain(`${LAUNCH_QUERY}=${COMPANY}`);
      expect(parsed.name).not.toBe("Overwatch");
      const promptHref = await page.evaluate(() => (window as unknown as { __owManifestAtPrompt?: string }).__owManifestAtPrompt || "");
      if (promptHref) expect(promptHref).toBe(built!.manifestPath);

      await page.goto(`${origin}/overwatch/install/?company=${OTHER}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction((expected) => {
        const link = document.querySelector('link[rel="manifest"]');
        return link?.getAttribute("href") === expected;
      }, companyManifestPath(OTHER));
      const wrong = await readAppManifest(page);
      const wrongData = wrong.data || "";
      expect(wrong.url || "").toContain(companyManifestPath(OTHER));
      expect(wrongData).not.toContain(COMPANY_NAME);
      const links = await page.locator('link[rel="manifest"]').evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(links).toEqual([companyManifestPath(OTHER)]);

      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      });
      const phone = await openControlled(mobile);
      await phone.goto(`${origin}/overwatch/install/?company=${COMPANY}`, { waitUntil: "domcontentloaded" });
      await phone.waitForFunction((expected) => document.querySelector('link[rel="manifest"]')?.getAttribute("href") === expected, built!.manifestPath);
      const android = await readAppManifest(phone);
      const androidParsed = JSON.parse(android.data || "{}") as { name?: string; id?: string; start_url?: string };
      expect(android.url).toContain(built!.manifestPath);
      expect(androidParsed.name).toBe(COMPANY_NAME);
      expect(androidParsed.id).toContain(`/overwatch/pwa/${COMPANY}/`);
      expect(androidParsed.start_url).toContain(`${LAUNCH_QUERY}=${COMPANY}`);
      await mobile.close();

      files.set("/overwatch/install/index.html", { body: Buffer.from(sharedFirstInstall), type: "text/html" });
      await page.goto(`${origin}/overwatch/install/?company=${COMPANY}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction((expected) => {
        const found = Array.from(document.querySelectorAll('link[rel="manifest"]')).map((el) => el.getAttribute("href"));
        return found.length === 1 && found[0] === expected;
      }, built!.manifestPath);
      const corrected = await readAppManifest(page);
      const correctedParsed = JSON.parse(corrected.data || "{}") as { name?: string };
      expect(corrected.url).toContain(built!.manifestPath);
      expect(correctedParsed.name).toBe(COMPANY_NAME);
      await context.close();
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  }, 60_000);

  it("serves the branded manifest only after the cache commit and a controlling worker", async () => {
    const membership: InstallMembership = {
      companyId: COMPANY,
      companyName: COMPANY_NAME,
      companyLogo: `https://abc.supabase.co/storage/v1/object/public/company-logos/${COMPANY}/logo.png`,
      brandColor: "#102030",
      status: "active",
    };
    const built = buildCompanyManifest([membership], COMPANY, true)!;
    const stale = { ...built.body, id: `/overwatch/pwa/${OTHER}/`, start_url: `/overwatch/?${LAUNCH_QUERY}=${OTHER}`, name: "Harbor Watch" };
    const files = new Map<string, { body: Buffer; type: string }>([
      ["/overwatch/index.html", { body: Buffer.from(pageHtml({ manifestLink: true })), type: "text/html" }],
      ["/overwatch/manifest.json", { body: fs.readFileSync(path.join(rootDir, "public/manifest.json")), type: "application/manifest+json" }],
      ["/overwatch/sw.js", { body: fs.readFileSync(path.join(rootDir, "public/sw.js")), type: "text/javascript" }],
      ["/overwatch/pwa-company-cache.js", { body: fs.readFileSync(path.join(rootDir, "public/pwa-company-cache.js")), type: "text/javascript" }],
    ]);
    const { server, port } = await startServer(files);
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}/overwatch/`, { waitUntil: "domcontentloaded" });
      const observed = await page.evaluate(async (args) => {
        async function read(url: string) {
          const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
          return {
            status: response.status,
            type: response.headers.get("content-type"),
            text: await response.text(),
            controlled: navigator.serviceWorker.controller !== null,
          };
        }
        const beforeWorker = await read(args.manifestPath);
        const claimed = new Promise<void>((resolve) => {
          if (navigator.serviceWorker.controller) resolve();
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
        });
        await navigator.serviceWorker.register("/overwatch/sw.js", { scope: "/overwatch/" });
        await navigator.serviceWorker.ready;
        await claimed;
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const putTask = (async () => {
          await gate;
          const cache = await caches.open(args.cacheName);
          await cache.put(new URL(args.manifestPath, location.origin).toString(), new Response(args.manifestBody, {
            headers: { "Content-Type": "application/manifest+json" },
          }));
          await cache.put(new URL(args.iconPath, location.origin).toString(), new Response(Uint8Array.from(args.png), {
            headers: { "Content-Type": "image/png" },
          }));
        })();
        const duringCommit = await read(args.manifestPath);
        release();
        await putTask;
        const after = await read(args.manifestPath);
        const queried = await read(`${args.manifestPath}?v=2`);
        const icon = await fetch(args.iconPath, { cache: "no-store", credentials: "same-origin" });
        const versioned = await fetch(args.versionedIcon, { cache: "no-store", credentials: "same-origin" });
        const other = await fetch(args.otherIcon, { cache: "no-store", credentials: "same-origin" });
        const cache = await caches.open(args.cacheName);
        await cache.put(new URL(args.manifestPath, location.origin).toString(), new Response(args.staleBody, {
          headers: { "Content-Type": "application/manifest+json" },
        }));
        const stale = await read(args.manifestPath);
        return {
          beforeWorker,
          duringCommit,
          after,
          queried,
          iconStatus: icon.status,
          iconType: icon.headers.get("content-type"),
          iconBytes: Array.from(new Uint8Array(await icon.arrayBuffer())),
          versionedStatus: versioned.status,
          versionedBytes: Array.from(new Uint8Array(await versioned.arrayBuffer())),
          otherStatus: other.status,
          stale,
          stayed: location.pathname + location.search,
        };
      }, {
        cacheName: companyCacheName(COMPANY),
        manifestPath: built.manifestPath,
        manifestBody: JSON.stringify(built.body),
        iconPath: companyIconPath(COMPANY, "icon-192.png"),
        versionedIcon: companyIconSrc(COMPANY, "icon-192.png"),
        otherIcon: companyIconPath(OTHER, "icon-192.png"),
        png: Array.from(PNG),
        staleBody: JSON.stringify(stale),
      });

      expect(observed.beforeWorker.controlled).toBe(false);
      expect(observed.beforeWorker.status).toBe(404);
      expect(observed.beforeWorker.text).not.toContain(COMPANY_NAME);
      expect(observed.duringCommit.controlled).toBe(true);
      expect(observed.duringCommit.status).toBe(404);
      expect(observed.duringCommit.text).not.toContain(COMPANY_NAME);
      expect(observed.after.status).toBe(200);
      expect(observed.after.type).toContain("application/manifest+json");
      const after = JSON.parse(observed.after.text) as { name: string; id: string; theme_color: string; icons: { src: string }[] };
      expect(after.name).toBe(COMPANY_NAME);
      expect(after.id).toBe(built.appId);
      expect(after.theme_color).toBe(built.themeColor);
      expect(after.icons[0].src).toBe(companyIconSrc(COMPANY, "icon-192.png"));
      expect(observed.queried.status).toBe(200);
      expect(observed.queried.text).toContain(COMPANY_NAME);
      expect(observed.iconStatus).toBe(200);
      expect(observed.iconType).toContain("image/png");
      expect(Buffer.from(observed.iconBytes)).toEqual(PNG);
      expect(observed.versionedStatus).toBe(200);
      expect(Buffer.from(observed.versionedBytes)).toEqual(PNG);
      expect(observed.otherStatus).toBe(404);
      expect(observed.stale.status).toBe(404);
      expect(observed.stale.text).not.toContain("Harbor Watch");
      expect(observed.stayed).toBe("/overwatch/");
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  }, 60_000);

  it("withholds the company manifest until a worker controls the document, then Chrome accepts it", async () => {
    const membership = (id: string, name: string): InstallMembership => ({
      companyId: id,
      companyName: name,
      companyLogo: `https://abc.supabase.co/storage/v1/object/public/company-logos/${id}/logo.png`,
      brandColor: "#102030",
      status: "active",
    });
    const first = buildCompanyManifest([membership(COMPANY, COMPANY_NAME)], COMPANY, true)!;
    const secondName = "Harbor Watch";
    const second = buildCompanyManifest([membership(OTHER, secondName)], OTHER, true)!;
    const blue192 = solidPng(192, [20, 80, 220]);
    const blue512 = solidPng(512, [20, 80, 220]);
    const green192 = solidPng(192, [20, 160, 40]);
    const green512 = solidPng(512, [20, 160, 40]);
    const installHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Overwatch — Security Workforce Management Platform</title><meta name="apple-mobile-web-app-title" content="Overwatch"><link rel="icon" href="/overwatch/favicon.png"><script>${PWA_LAUNCH_BOOT}</script></head><body>install</body></html>`;
    const homeHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Overwatch</title><link rel="manifest" href="/overwatch/manifest.json"><script>${PWA_LAUNCH_BOOT}</script></head><body>home</body></html>`;
    const swSource = fs.readFileSync(path.join(rootDir, "public/sw.js"));
    const files = new Map<string, { body: Buffer; type: string }>([
      ["/overwatch/index.html", { body: Buffer.from(homeHtml), type: "text/html" }],
      ["/overwatch/install/index.html", { body: Buffer.from(installHtml), type: "text/html" }],
      ["/overwatch/manifest.json", { body: fs.readFileSync(path.join(rootDir, "public/manifest.json")), type: "application/manifest+json" }],
      ["/overwatch/favicon.png", { body: Buffer.from([137, 80, 78, 71]), type: "image/png" }],
      ["/overwatch/sw.js", { body: swSource, type: "text/javascript" }],
      ["/overwatch/pwa-company-cache.js", { body: fs.readFileSync(path.join(rootDir, "public/pwa-company-cache.js")), type: "text/javascript" }],
    ]);
    const { server, port } = await startServer(files);
    const origin = `http://127.0.0.1:${port}`;
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const iconFiles = (id: string, small: Buffer, large: Buffer) => [
      [companyIconPath(id, "icon-192.png"), small],
      [companyIconPath(id, "icon-512.png"), large],
      [companyIconPath(id, "icon-maskable-192.png"), small],
      [companyIconPath(id, "icon-maskable-512.png"), large],
    ] as const;
    try {
      const page = await browser.newPage();
      await page.goto(`${origin}/overwatch/install/?company=${COMPANY}`, { waitUntil: "load" });
      const before = await readAppManifest(page);
      const beforeErrors = await readInstallability(page);
      const beforeLinks = await page.locator('link[rel="manifest"]').evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(beforeLinks.some((href) => href?.includes("/overwatch/pwa/"))).toBe(false);
      expect(await page.title()).not.toBe("Company app");
      expect(before.data || "").not.toContain(COMPANY_NAME);
      expect(beforeErrors.some((id) => MANIFEST_FAILURES.includes(id)) || beforeLinks.length === 0).toBe(true);
      await page.evaluate(() => {
        const link = document.createElement("link");
        link.rel = "manifest";
        link.href = "/overwatch/manifest.json";
        document.head.appendChild(link);
      });
      await page.waitForTimeout(100);
      const afterHydration = await page.locator('link[rel="manifest"]').evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(afterHydration).toEqual([]);

      await page.evaluate(async ({ cacheName, manifestPath, manifestBody, icons }) => {
        const cache = await caches.open(cacheName);
        await cache.put(new URL(manifestPath, location.origin).toString(), new Response(manifestBody, {
          headers: { "Content-Type": "application/manifest+json" },
        }));
        for (const icon of icons) {
          await cache.put(new URL(icon.path, location.origin).toString(), new Response(Uint8Array.from(icon.bytes), {
            headers: { "Content-Type": "image/png" },
          }));
        }
        const claimed = new Promise<void>((resolve) => {
          if (navigator.serviceWorker.controller) resolve();
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
        });
        await navigator.serviceWorker.register("/overwatch/sw.js", { scope: "/overwatch/" });
        await navigator.serviceWorker.ready;
        await claimed;
      }, {
        cacheName: companyCacheName(COMPANY),
        manifestPath: first.manifestPath,
        manifestBody: JSON.stringify(first.body),
        icons: iconFiles(COMPANY, blue192, blue512).map(([iconPath, bytes]) => ({ path: iconPath, bytes: Array.from(bytes) })),
      });
      await page.goto(`${origin}/overwatch/install/?company=${COMPANY}`, { waitUntil: "load" });
      const after = await readAppManifest(page);
      const afterErrors = await readInstallability(page);
      const afterBody = JSON.parse(after.data || "{}") as { name?: string; id?: string; start_url?: string; icons?: { src: string; sizes: string; purpose: string }[] };
      expect(after.url).toContain(first.manifestPath);
      expect(afterBody.name).toBe(COMPANY_NAME);
      expect(afterBody.id).toBe(first.appId);
      expect(afterBody.start_url).toContain(`ow_company=${COMPANY}`);
      expect(afterBody.icons?.map((icon) => `${icon.sizes}:${icon.purpose}:${icon.src}`)).toEqual(
        first.icons.map((icon) => `${icon.sizes}:${icon.purpose}:${icon.src}`),
      );
      expect(afterErrors.filter((id) => MANIFEST_FAILURES.includes(id))).toEqual([]);

      await page.evaluate(async ({ cacheName, manifestPath, manifestBody, icons }) => {
        const cache = await caches.open(cacheName);
        await cache.put(new URL(manifestPath, location.origin).toString(), new Response(manifestBody, {
          headers: { "Content-Type": "application/manifest+json" },
        }));
        for (const icon of icons) {
          await cache.put(new URL(icon.path, location.origin).toString(), new Response(Uint8Array.from(icon.bytes), {
            headers: { "Content-Type": "image/png" },
          }));
        }
      }, {
        cacheName: companyCacheName(OTHER),
        manifestPath: second.manifestPath,
        manifestBody: JSON.stringify(second.body),
        icons: iconFiles(OTHER, green192, green512).map(([iconPath, bytes]) => ({ path: iconPath, bytes: Array.from(bytes) })),
      });
      await page.goto(`${origin}/overwatch/install/?company=${OTHER}`, { waitUntil: "load" });
      const other = JSON.parse((await readAppManifest(page)).data || "{}") as { name?: string; icons?: { src: string }[] };
      expect(other.name).toBe(secondName);
      expect(other.icons?.every((icon) => icon.src.includes(OTHER))).toBe(true);
      expect(JSON.stringify(other)).not.toContain(COMPANY_NAME);

      await page.goto(`${origin}/overwatch/`, { waitUntil: "load" });
      const shared = JSON.parse((await readAppManifest(page)).data || "{}") as { name?: string };
      expect(shared.name).toBe("Overwatch");

      files.set("/overwatch/sw.js", { body: Buffer.concat([swSource, Buffer.from("\n// company cache survives an update\n")]), type: "text/javascript" });
      await page.goto(`${origin}/overwatch/install/?company=${COMPANY}`, { waitUntil: "load" });
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      });
      await page.waitForTimeout(500);
      const updated = JSON.parse((await readAppManifest(page)).data || "{}") as { name?: string; id?: string };
      expect(updated.name).toBe(COMPANY_NAME);
      expect(updated.id).toBe(first.appId);
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  }, 60_000);
});
