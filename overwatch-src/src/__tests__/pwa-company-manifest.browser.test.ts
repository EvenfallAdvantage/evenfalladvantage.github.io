import { describe, it, expect } from "vitest";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { AddressInfo } from "node:net";
import type { Page } from "playwright-core";
import {
  LAUNCH_QUERY,
  PWA_LAUNCH_BOOT,
  SHARED_MANIFEST_PATH,
  buildCompanyManifest,
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

type AppManifest = { url?: string; data?: string; errors?: { message: string }[] };

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
});
