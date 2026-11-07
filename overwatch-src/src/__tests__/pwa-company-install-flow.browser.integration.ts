import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { INSTALL_TIMEOUT_MESSAGE } from "@/lib/pwa-company-finalize";

const exportRoot = process.env.PWA_INSTALL_EXPORT || "";
const chromeCandidates = [process.env.CHROME_PATH, "/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].filter(
  (item): item is string => Boolean(item),
);
const chromePath = chromeCandidates.find((item) => fs.existsSync(item));

const COMPANY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COMPANY_NAME = "Northstar Recruitment";
const OTHER_NAME = "Harbor Watch";
const AUTH_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const MANIFEST_FAILURES = [
  "manifest-parsing-or-network-error",
  "manifest-missing-name-or-short-name",
  "manifest-display-not-supported",
  "manifest-missing-suitable-icon",
  "no-acceptable-icon",
  "start-url-not-valid",
];

type AppManifest = { url?: string; data?: string; errors?: { message: string }[] };
type ParsedManifest = {
  name?: string;
  id?: string;
  start_url?: string;
  icons?: { src: string; sizes: string; purpose: string }[];
};

let origin = "";
let server: http.Server | null = null;
let swBody = Buffer.alloc(0);

/** Open once, then fstat and read that descriptor. A path stat followed by a path read can observe two different files. */
function readJsChunk(full: string): { directory: boolean; text: string | null } {
  let fd: number | undefined;
  try {
    fd = fs.openSync(full, "r");
    const stat = fs.fstatSync(fd);
    if (stat.isDirectory()) return { directory: true, text: null };
    if (!stat.isFile() || stat.size === 0 || stat.size > 8_000_000) return { directory: false, text: null };
    const buf = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < buf.length) {
      const count = fs.readSync(fd, buf, offset, buf.length - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    return { directory: false, text: buf.toString("utf8", 0, offset) };
  } catch {
    return { directory: false, text: null };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function findSupabaseHost(dir: string): string {
  const chunks = path.join(dir, "_next/static/chunks");
  const pending = [chunks];
  const pattern = /https:\/\/[a-z0-9-]+\.supabase\.co/;
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    let names: string[];
    try {
      names = fs.readdirSync(current);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name.endsWith(".map")) continue;
      const full = path.join(current, name);
      const chunk = readJsChunk(full);
      if (chunk.directory) {
        pending.push(full);
        continue;
      }
      if (!name.endsWith(".js") || !chunk.text) continue;
      const match = pattern.exec(chunk.text);
      if (match) return match[0];
    }
  }
  throw new Error(`No Supabase host in ${chunks}. Run npm run test:pwa-install so the export is built with a fixture host.`);
}

function contentType(file: string): string {
  if (file.endsWith("manifest.json") || file.endsWith(".webmanifest")) return "application/manifest+json";
  const ext = path.extname(file);
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
    ".ico": "image/x-icon",
  };
  return types[ext] || "application/octet-stream";
}

function resolveOut(pathname: string): string | null {
  let rel = pathname;
  if (rel.startsWith("/overwatch/")) rel = rel.slice("/overwatch".length) || "/";
  else if (rel === "/overwatch") rel = "/";
  const outRoot = path.resolve(exportRoot);
  const file = path.resolve(outRoot, `.${rel}`);
  if (file !== outRoot && !file.startsWith(`${outRoot}${path.sep}`)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    const index = path.join(file, "index.html");
    return fs.existsSync(index) ? index : null;
  }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  return null;
}

function startServer(): Promise<{ server: http.Server; port: number }> {
  const httpServer = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/overwatch/sw.js" || url.pathname === "/sw.js") {
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      res.end(swBody);
      return;
    }
    const file = resolveOut(url.pathname);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("missing");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(file) });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => {
      resolve({ server: httpServer, port: (httpServer.address() as AddressInfo).port });
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
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function jwt(sub: string): string {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 86_400;
  return `${enc({ alg: "none", typ: "JWT" })}.${enc({ sub, exp, role: "authenticated", aal: "aal1" })}.x`;
}

function membership(id: string, name: string, host: string) {
  return {
    id: `membership-${id.slice(0, 8)}`,
    role: "staff",
    nickname: null,
    status: "active",
    company_id: id,
    companies: {
      id,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      logo_url: `${host}/storage/v1/object/public/company-logos/${id}/logo.png`,
      brand_color: "#102030",
      accent_color: "#d59b3c",
      join_code: null,
      settings: {},
      is_training_provider: false,
    },
  };
}

async function installFixtures(context: BrowserContext, supabaseHost: string) {
  const host = new URL(supabaseHost).host.split(".")[0];
  const access = jwt(AUTH_ID);
  const session = {
    access_token: access,
    refresh_token: "pwa-fixture-refresh",
    expires_in: 86_400,
    expires_at: Math.floor(Date.now() / 1000) + 86_400,
    token_type: "bearer",
    user: {
      id: AUTH_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "pwa-fixture@example.com",
      factors: [],
      app_metadata: {},
      user_metadata: {},
    },
  };
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  await context.addCookies([{
    name: `sb-${host}-auth-token`,
    value: encoded,
    url: origin,
    sameSite: "Lax",
  }]);
  const userRow = {
    id: USER_ID,
    supabase_id: AUTH_ID,
    email: "pwa-fixture@example.com",
    phone: null,
    first_name: "Pat",
    last_name: "Fixture",
    callsign: null,
    avatar_url: null,
    is_platform_admin: false,
  };
  const memberships = [membership(COMPANY, COMPANY_NAME, supabaseHost), membership(OTHER, OTHER_NAME, supabaseHost)];
  const logos = new Map<string, Buffer>([
    [COMPANY, solidPng(64, [20, 80, 220])],
    [OTHER, solidPng(64, [20, 160, 40])],
  ]);
  await context.route(/supabase\.co/i, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = request.headers();
    const cors = {
      "access-control-allow-origin": headers.origin || origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": headers["access-control-request-headers"] || "*",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const logo = url.pathname.match(/company-logos\/([0-9a-f-]+)\/logo\.png/i);
    if (logo) {
      const png = logos.get(logo[1].toLowerCase());
      await route.fulfill({
        status: png ? 200 : 404,
        headers: { ...cors, "content-type": "image/png" },
        body: png || Buffer.from("missing"),
      });
      return;
    }
    let body: unknown = [];
    if (url.pathname.includes("/auth/v1/user")) body = session.user;
    else if (url.pathname.includes("/auth/v1/token")) body = { ...session, user: session.user };
    else if (url.pathname.includes("/rest/v1/users")) {
      body = (headers.accept || "").includes("vnd.pgrst.object") ? userRow : [userRow];
    } else if (url.pathname.includes("/rest/v1/company_memberships")) body = memberships;
    else if (url.pathname.includes("/auth/v1/")) body = {};
    await route.fulfill({
      status: 200,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
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

async function readInstallability(page: Page): Promise<string[]> {
  const client = await page.context().newCDPSession(page);
  let last: string[] = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await client.send("Page.getInstallabilityErrors") as { installabilityErrors?: { errorId: string }[] };
    last = (result.installabilityErrors || []).map((error) => error.errorId);
    if (!last.some((id) => MANIFEST_FAILURES.includes(id))) return last;
    await page.waitForTimeout(200);
  }
  return last;
}

function parsed(manifest: AppManifest): ParsedManifest {
  return JSON.parse(manifest.data || "{}") as ParsedManifest;
}

async function manifestLinks(page: Page): Promise<string[]> {
  return page.locator('link[rel="manifest"]').evaluateAll((els) => els.map((el) => el.getAttribute("href") || ""));
}

async function openBuiltInstall(page: Page, companyId: string, companyName: string) {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(msg.text()));
  page.on("pageerror", (error) => logs.push(String(error)));
  await page.goto(`${origin}/overwatch/install/?company=${companyId}`, { waitUntil: "load" });
  try {
    await page.getByText(companyName).first().waitFor({ timeout: 25_000 });
  } catch (error) {
    throw new Error(`Install page at ${page.url()} did not show ${companyName}\n${logs.slice(-30).join("\n")}\n${String(error)}`);
  }
  await page.getByRole("button", { name: "Close What's New" }).click({ timeout: 2_000 }).catch(() => undefined);
}

function installButton(page: Page, companyName: string) {
  return page.locator("li").filter({ hasText: companyName }).getByRole("button", { name: "Install", exact: true });
}

async function launchChrome(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  return chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

describe.skipIf(!chromePath).sequential("built company install flow", () => {
  let supabaseHost = "";

  beforeAll(async () => {
    if (!exportRoot) {
      throw new Error("PWA_INSTALL_EXPORT is unset. From overwatch-src run: npm run test:pwa-install");
    }
    const installHtml = fs.readFileSync(path.join(exportRoot, "install/index.html"), "utf8");
    if (installHtml.includes('rel="manifest"')) throw new Error("export install document still has a manifest link");
    if (!installHtml.includes("ow-install-manifest")) throw new Error("export install document is missing the boot script");
    supabaseHost = findSupabaseHost(exportRoot);
    swBody = fs.readFileSync(path.join(exportRoot, "sw.js"));
    const started = await startServer();
    server = started.server;
    origin = `http://127.0.0.1:${started.port}`;
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("clicks Install on the built page while uncontrolled, then after claim Chrome reads that company", async () => {
    const browser = await launchChrome();
    const context = await browser.newContext();
    let swBlock = Promise.resolve();
    let openSw = () => {};
    const holdServiceWorker = () => {
      let opened = false;
      swBlock = new Promise<void>((resolve) => {
        openSw = () => {
          if (opened) return;
          opened = true;
          resolve();
        };
      });
    };
    holdServiceWorker();
    await context.route("**/sw.js", async (route) => {
      await swBlock;
      await route.continue();
    });
    await installFixtures(context, supabaseHost);
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    try {
      await openBuiltInstall(pageA, COMPANY, COMPANY_NAME);
      await openBuiltInstall(pageB, OTHER, OTHER_NAME);
      expect(await pageA.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(false);
      expect(await pageB.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(false);
      expect((await manifestLinks(pageA)).some((href) => href.includes("/overwatch/pwa/"))).toBe(false);
      expect((await manifestLinks(pageB)).some((href) => href.includes("/overwatch/pwa/"))).toBe(false);
      expect((await readAppManifest(pageA)).data || "").not.toContain(COMPANY_NAME);
      expect((await readInstallability(pageA)).some((id) => MANIFEST_FAILURES.includes(id)) || (await manifestLinks(pageA)).length === 0).toBe(true);

      const navigatedA = pageA.waitForEvent("framenavigated", { timeout: 30_000 });
      await installButton(pageA, COMPANY_NAME).click();
      openSw();
      await navigatedA;
      await pageA.waitForLoadState("load");
      await pageA.waitForFunction(
        (id) => (document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "").includes(id),
        COMPANY,
        { timeout: 10_000 },
      );
      const afterA = parsed(await readAppManifest(pageA));
      expect(afterA.name).toBe(COMPANY_NAME);
      expect(afterA.id).toBe(`/overwatch/pwa/${COMPANY}/`);
      expect(afterA.start_url).toContain(`ow_company=${COMPANY}`);
      expect(afterA.icons?.map((icon) => `${icon.sizes}:${icon.purpose}`).sort()).toEqual([
        "192x192:any",
        "192x192:maskable",
        "512x512:any",
        "512x512:maskable",
      ]);
      expect(afterA.icons?.every((icon) => icon.src.includes(COMPANY))).toBe(true);
      expect((await readInstallability(pageA)).filter((id) => MANIFEST_FAILURES.includes(id))).toEqual([]);

      const save = pageA.getByRole("button", { name: "Save icon again" });
      await save.waitFor({ timeout: 15_000 });
      let reusedNavigation = false;
      const onReuseNav = () => { reusedNavigation = true; };
      pageA.on("framenavigated", onReuseNav);
      await save.click();
      await pageA.waitForTimeout(1500);
      pageA.off("framenavigated", onReuseNav);
      expect(reusedNavigation).toBe(false);
      expect(parsed(await readAppManifest(pageA)).name).toBe(COMPANY_NAME);

      const claimedB = await pageB.evaluate(() => ({
        controlled: Boolean(navigator.serviceWorker.controller),
        href: document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "",
      }));
      expect(claimedB.controlled).toBe(true);
      expect(claimedB.href).not.toContain("/overwatch/pwa/");
      const navigatedB = pageB.waitForEvent("framenavigated", { timeout: 30_000 });
      await installButton(pageB, OTHER_NAME).click();
      await navigatedB;
      await pageB.waitForLoadState("load");
      const afterB = parsed(await readAppManifest(pageB));
      expect(afterB.name).toBe(OTHER_NAME);
      expect(afterB.id).toBe(`/overwatch/pwa/${OTHER}/`);
      expect(afterB.icons?.every((icon) => icon.src.includes(OTHER) && !icon.src.includes(COMPANY))).toBe(true);
      expect(JSON.stringify(afterB)).not.toContain(COMPANY_NAME);
      expect(parsed(await readAppManifest(pageA)).name).toBe(COMPANY_NAME);

      await pageA.reload({ waitUntil: "load" });
      expect(parsed(await readAppManifest(pageA)).name).toBe(COMPANY_NAME);
      expect(parsed(await readAppManifest(pageA)).id).toBe(`/overwatch/pwa/${COMPANY}/`);

      holdServiceWorker();
      await pageA.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      });
      await pageB.close();
      await pageA.close();
      const outside = await context.newPage();
      await outside.goto(`${origin}/`, { waitUntil: "commit" });
      const workerClient = await context.newCDPSession(outside);
      await workerClient.send("ServiceWorker.enable");
      await workerClient.send("ServiceWorker.stopAllWorkers");
      const remaining = await outside.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        return registrations.length;
      });
      expect(remaining).toBe(0);
      await outside.close();
      const warm = await context.newPage();
      await warm.addInitScript(() => {
        const mark = window as unknown as { __bootController?: boolean };
        mark.__bootController = Boolean(navigator.serviceWorker?.controller);
        const seen = Number(sessionStorage.getItem("ow-test-docs") || "0") + 1;
        sessionStorage.setItem("ow-test-docs", String(seen));
      });
      await warm.goto(`${origin}/overwatch/install/?company=${COMPANY}`, { waitUntil: "domcontentloaded" });
      const born = await warm.evaluate(() => ({
        boot: (window as unknown as { __bootController?: boolean }).__bootController === true,
        href: document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "",
      }));
      expect(born.boot).toBe(false);
      expect(born.href).not.toContain("/overwatch/pwa/");
      let automaticNavigations = 0;
      const onAutomatic = () => { automaticNavigations += 1; };
      warm.on("framenavigated", onAutomatic);
      openSw();
      await warm.waitForFunction(
        (id) => (document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "").includes(id),
        COMPANY,
        { timeout: 30_000 },
      );
      await warm.waitForTimeout(1000);
      const documents = await warm.evaluate(() => Number(sessionStorage.getItem("ow-test-docs") || "0"));
      expect(automaticNavigations).toBeGreaterThan(0);
      expect(documents).toBe(2);
      expect(warm.url()).toContain(`/install/?company=${COMPANY}`);
      expect(parsed(await readAppManifest(warm)).name).toBe(COMPANY_NAME);
      expect(parsed(await readAppManifest(warm)).id).toBe(`/overwatch/pwa/${COMPANY}/`);

      swBody = Buffer.concat([swBody, Buffer.from("\n// company cache survives an update\n")]);
      await warm.goto(`${origin}/overwatch/install/?company=${COMPANY}`, { waitUntil: "load" });
      await warm.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      });
      await warm.goto(`${origin}/overwatch/install/?company=${COMPANY}`, { waitUntil: "load" });
      const updated = parsed(await readAppManifest(warm));
      expect(updated.name).toBe(COMPANY_NAME);
      expect(updated.id).toBe(`/overwatch/pwa/${COMPANY}/`);

      await warm.goto(`${origin}/overwatch/`, { waitUntil: "load" });
      expect(parsed(await readAppManifest(warm)).name).toBe("Overwatch");
    } finally {
      openSw();
      await browser.close();
    }
  }, 120_000);

  it("stays manifest-less when the cache is empty or the company cache cannot be written", async () => {
    const browser = await launchChrome();
    const context = await browser.newContext();
    await installFixtures(context, supabaseHost);
    const page = await context.newPage();
    try {
      await openBuiltInstall(page, COMPANY, COMPANY_NAME);
      await page.getByText("not stored in this browser yet").waitFor({ timeout: 10_000 });
      expect((await manifestLinks(page)).some((href) => href.includes("/overwatch/pwa/"))).toBe(false);
      expect((await readAppManifest(page)).data || "").not.toContain(COMPANY_NAME);
      await page.waitForTimeout(1000);
      expect(page.url()).toContain(`/install/?company=${COMPANY}`);
      expect((await manifestLinks(page)).some((href) => href.includes("/overwatch/pwa/"))).toBe(false);

      await page.evaluate(() => {
        const open = CacheStorage.prototype.open;
        CacheStorage.prototype.open = function (name: string) {
          if (String(name).startsWith("overwatch-company-")) return Promise.reject(new Error("quota"));
          return open.call(this, name);
        };
      });
      let navigated = false;
      page.on("framenavigated", () => { navigated = true; });
      await installButton(page, COMPANY_NAME).click();
      await page.getByText(INSTALL_TIMEOUT_MESSAGE).waitFor({ timeout: 10_000 });
      expect(navigated).toBe(false);
      expect((await manifestLinks(page)).some((href) => href.includes("/overwatch/pwa/"))).toBe(false);
      expect((await readAppManifest(page)).data || "").not.toContain(COMPANY_NAME);
    } finally {
      await browser.close();
    }
  }, 90_000);

  it("publishes the signed-in company on the feed the browser menu reads", async () => {
    const browser = await launchChrome();
    const context = await browser.newContext();
    let swBlock = Promise.resolve();
    let openSw = () => {};
    const holdServiceWorker = () => {
      let opened = false;
      swBlock = new Promise<void>((resolve) => {
        openSw = () => {
          if (opened) return;
          opened = true;
          resolve();
        };
      });
    };
    holdServiceWorker();
    await context.route("**/sw.js", async (route) => {
      await swBlock;
      await route.continue();
    });
    await installFixtures(context, supabaseHost);
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/overwatch/feed/`, { waitUntil: "load" });
      await page.getByText(/Welcome/i).first().waitFor({ timeout: 25_000 });
      const before = await page.evaluate(() => ({
        apple: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content") || "",
        touch: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") || "",
        manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "",
        controlled: Boolean(navigator.serviceWorker.controller),
      }));
      expect(before.controlled).toBe(false);
      expect(before.apple).toBe("Overwatch");
      expect(before.manifest).toBe("/overwatch/manifest.json");
      expect(before.touch).not.toContain("/overwatch/pwa/");
      expect(parsed(await readAppManifest(page)).name).toBe("Overwatch");

      openSw();
      await page.waitForFunction(
        (id) => {
          const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content") || "";
          const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
          const touch = document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") || "";
          return apple === "Northstar Recruitment" && manifest.includes(id) && touch.includes(id);
        },
        COMPANY,
        { timeout: 30_000 },
      );
      const after = parsed(await readAppManifest(page));
      expect(after.name).toBe(COMPANY_NAME);
      expect(after.id).toBe(`/overwatch/pwa/${COMPANY}/`);
      expect(after.start_url).toContain(`ow_company=${COMPANY}`);
      expect(after.icons?.every((icon) => icon.src.includes(COMPANY) && !icon.src.includes(OTHER))).toBe(true);
      expect(after.icons?.filter((icon) => icon.purpose === "any").every((icon) => !icon.src.includes("maskable"))).toBe(true);
      expect(after.icons?.filter((icon) => icon.purpose === "maskable").every((icon) => icon.src.includes("maskable"))).toBe(true);
      expect(JSON.stringify(after)).not.toContain(OTHER_NAME);
      const sample = await page.evaluate(async (icons) => {
        async function pixel(src: string) {
          const response = await fetch(src);
          const bitmap = await createImageBitmap(await response.blob());
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas");
          ctx.drawImage(bitmap, 0, 0);
          const at = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
          return {
            status: response.status,
            corner: at(0, 0),
            center: at(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2)),
          };
        }
        const any = icons.find((icon) => icon.purpose === "any" && icon.sizes === "192x192");
        const mask = icons.find((icon) => icon.purpose === "maskable" && icon.sizes === "192x192");
        return { any: any ? await pixel(any.src) : null, mask: mask ? await pixel(mask.src) : null };
      }, after.icons ?? []);
      expect(sample.any?.status).toBe(200);
      expect(sample.any?.corner[3]).toBe(0);
      expect(sample.any?.center[3]).toBe(255);
      expect(sample.any?.center[2]).toBeGreaterThan(150);
      expect(sample.mask?.status).toBe(200);
      expect(sample.mask?.corner[3]).toBe(255);
      expect(sample.mask?.corner[2]).toBeLessThan(80);
      expect(sample.mask?.center[3]).toBe(255);
      expect(sample.mask?.center[2]).toBeGreaterThan(150);
      expect((await readInstallability(page)).filter((id) => MANIFEST_FAILURES.includes(id))).toEqual([]);

      await page.reload({ waitUntil: "load" });
      const reloaded = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "");
      expect(reloaded).toContain(COMPANY);
      expect(parsed(await readAppManifest(page)).name).toBe(COMPANY_NAME);

      const plain = await browser.newContext();
      const home = await plain.newPage();
      await home.goto(`${origin}/overwatch/`, { waitUntil: "load" });
      const generic = await home.evaluate(() => ({
        apple: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content") || "",
        manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "",
      }));
      expect(generic.apple).toBe("Overwatch");
      expect(generic.manifest).toBe("/overwatch/manifest.json");
      expect(parsed(await readAppManifest(home)).name).toBe("Overwatch");
      await plain.close();
    } finally {
      openSw();
      await browser.close();
    }
  }, 120_000);

  it("keeps an installed company when the signed-in company changes, in another tab, and after sign-out", async () => {
    const browser = await launchChrome();
    const context = await browser.newContext();
    await context.addInitScript((activeId) => {
      localStorage.setItem("overwatch-auth", JSON.stringify({ state: { activeCompanyId: activeId }, version: 0 }));
    }, OTHER);
    await installFixtures(context, supabaseHost);
    const launched = await context.newPage();
    const otherTab = await context.newPage();
    try {
      await launched.goto(`${origin}/overwatch/feed/?ow_company=${COMPANY}`, { waitUntil: "load" });
      await launched.waitForFunction(
        (id) => {
          const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content") || "";
          const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
          return apple === "Northstar Recruitment" && manifest.includes(id);
        },
        COMPANY,
        { timeout: 30_000 },
      );
      const launchedManifest = parsed(await readAppManifest(launched));
      expect(launchedManifest.name).toBe(COMPANY_NAME);
      expect(launchedManifest.id).toBe(`/overwatch/pwa/${COMPANY}/`);
      expect(JSON.stringify(launchedManifest)).not.toContain(OTHER_NAME);

      await otherTab.goto(`${origin}/overwatch/feed/`, { waitUntil: "load" });
      await otherTab.waitForFunction(
        (id) => {
          const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content") || "";
          const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
          return apple === "Harbor Watch" && manifest.includes(id);
        },
        OTHER,
        { timeout: 30_000 },
      );
      expect(parsed(await readAppManifest(otherTab)).name).toBe(OTHER_NAME);
      expect(parsed(await readAppManifest(launched)).name).toBe(COMPANY_NAME);

      await launched.goto(`${origin}/overwatch/more/`, { waitUntil: "load" });
      await launched.getByRole("button", { name: "Close What's New" }).click({ timeout: 3_000 }).catch(() => undefined);
      await launched.getByRole("button", { name: "Sign Out" }).click();
      await launched.waitForFunction(() => !location.pathname.includes("/more"), { timeout: 15_000 });
      await launched.goto(`${origin}/overwatch/feed/`, { waitUntil: "domcontentloaded" });
      await launched.waitForFunction(
        (id) => (document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "").includes(id),
        COMPANY,
        { timeout: 15_000 },
      );
      const afterSignOut = parsed(await readAppManifest(launched));
      expect(afterSignOut.name).toBe(COMPANY_NAME);
      expect(afterSignOut.id).toBe(`/overwatch/pwa/${COMPANY}/`);
      expect(parsed(await readAppManifest(otherTab)).name).toBe(OTHER_NAME);
    } finally {
      await browser.close();
    }
  }, 120_000);
});
