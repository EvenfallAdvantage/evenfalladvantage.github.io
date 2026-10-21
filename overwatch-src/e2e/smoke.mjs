// Nightly smoke: log in as the ZZTEST Field QA account and open every
// signed-in route on desktop and phone. All Supabase WRITES are blocked and
// stubbed (only GET/HEAD/OPTIONS and read-only RPCs pass), so nothing changes
// in production and nobody is notified.
//
// Fails (exit 1) on uncaught page errors or visible error text
// ("Something went wrong", "Failed to load", …). Screenshots + results.json
// go to $SMOKE_OUT (default ./smoke-out) and are uploaded as CI artifacts.
//
// Env: ZZTEST_EMAIL, ZZTEST_PASSWORD (repo secrets, set by the owner),
//      SMOKE_BASE (default the live app), SMOKE_ROUTES (space-separated, optional).
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.SMOKE_BASE || "https://www.evenfalladvantage.com/overwatch").replace(/\/+$/, "");
const OUT = process.env.SMOKE_OUT || "smoke-out";
const EMAIL = process.env.ZZTEST_EMAIL, PASSWORD = process.env.ZZTEST_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("ZZTEST_EMAIL / ZZTEST_PASSWORD not set; skipping."); process.exit(process.env.CI ? 1 : 0); }
if (!/zztest/i.test(EMAIL)) { console.error("Refusing to run: smoke account must be a ZZTEST account."); process.exit(1); }

export const ROUTES = (process.env.SMOKE_ROUTES || [
  "feed", "timeclock", "patrols", "schedule", "tasks", "chat", "incidents", "dictate", "report", "forms",
  "notifications", "profile", "more", "directory", "teams", "time-off", "knowledge-base", "state-laws",
  "geo-risk", "certifications", "academy", "courses", "quizzes", "training/scenarios", "updates", "scan",
  "site-assessment", "invoices", "careers", "health",
  "admin/staff", "admin/events", "admin/analytics", "admin/settings", "admin/security", "admin/training",
  "admin/health", "admin/instructor", "admin/questions",
].join(" ")).split(/\s+/).filter(Boolean)
  // "reports" is not a route (GitHub Pages 404); the sidebar's Reports is /incidents.
  .map((r) => (r === "reports" ? "incidents" : r));

const ERROR_TEXT = /something went wrong|error loading|failed to load|application error|unhandled runtime error/i;
// Known noise we don't fail on (GPU in headless, extension-less push, etc.).
const IGNORE = /GPU stall|WebGL|ResizeObserver loop|Notification permission|push service/i;
const READ_RPC = /\/rpc\/(get_|is_|has_|list_|my_|check_|search_|count_|post_order_ack_status)/;

fs.mkdirSync(OUT, { recursive: true });
const summary = { base: BASE, startedAt: new Date().toISOString(), failures: [], results: {} };

for (const phone of [false, true]) {
  const tag = phone ? "phone" : "desktop";
  const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROME || undefined, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1400, height: 900 }, isMobile: phone, hasTouch: phone,
    timezoneId: "America/Los_Angeles", geolocation: { latitude: 34.0537, longitude: -118.2428 }, permissions: ["geolocation"],
  });
  // Optional Cloudflare WAF bypass for CI runners (GitHub IPs get the "Just a moment..."
  // bot challenge). SMOKE_CF_HEADER = "Header-Name: value", stored as a repo secret and
  // matched by a Cloudflare custom "Skip" rule. Only sent to the site's own host.
  const cfHeader = process.env.SMOKE_CF_HEADER?.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
  if (cfHeader) {
    const host = new URL(BASE).host;
    await ctx.route((u) => u.host === host, (r) => r.continue({ headers: { ...r.request().headers(), [cfHeader[1].toLowerCase()]: cfHeader[2] } }));
  }
  const blocked = [];
  await ctx.route(/supabase\.co\/(rest|functions|storage)/, (r) => {
    const q = r.request(), m = q.method();
    if (["GET", "HEAD", "OPTIONS"].includes(m) || (m === "POST" && READ_RPC.test(q.url()))) return r.continue();
    blocked.push(`${m} ${q.url().split("?")[0].replace(/^.*supabase\.co/, "")}`);
    return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" });
  });
  const page = await ctx.newPage();
  let errs = [];
  page.on("pageerror", (e) => errs.push(`pageerror ${String(e).slice(0, 200)}`));

  // Same route + selectors as the working local login (/?auth=login, input[type=password]).
  // Retry once, and on failure save a screenshot + page diagnostics (never the credentials)
  // to $SMOKE_OUT so the CI artifact shows what the runner actually got.
  let loginReady = false, navStatus = null;
  for (let attempt = 1; attempt <= 2 && !loginReady; attempt++) {
    try {
      const resp = await page.goto(`${BASE}/?auth=login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      navStatus = resp?.status() ?? null;
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      await page.waitForSelector("input[type=password]", { timeout: 60_000 });
      loginReady = true;
    } catch (e) {
      console.error(`${tag}: login form not found (attempt ${attempt}): ${String(e).split("\n")[0]}`);
    }
  }
  if (!loginReady) {
    await page.screenshot({ path: `${OUT}/${tag}-login-failure.png`, fullPage: true }).catch(() => {});
    const diag = await page.evaluate(() => ({ title: document.title, text: document.body?.innerText?.replace(/\s+/g, " ").slice(0, 600) ?? "" })).catch(() => ({}));
    summary.results[`${tag}:login`] = { url: page.url(), status: navStatus, ...diag, pageErrors: [...new Set(errs)].slice(0, 10) };
    summary.failures.push(`${tag}: login form never appeared (HTTP ${navStatus}, title "${diag.title ?? ""}")` + (/just a moment|security verification/i.test(`${diag.title} ${diag.text}`) ? " - blocked by Cloudflare bot challenge; set SMOKE_CF_HEADER + a Cloudflare Skip rule" : ""));
    console.error(`${tag}: url=${page.url()} status=${navStatus} title=${JSON.stringify(diag.title ?? "")}`);
    console.error(`${tag}: body=${JSON.stringify(diag.text ?? "")}`);
    await browser.close();
    continue;
  }
  await page.fill("input[type=email]", EMAIL);
  await page.fill("input[type=password]", PASSWORD);
  await page.press("input[type=password]", "Enter");
  await page.waitForTimeout(8000);
  if (await page.locator("input[type=password]").count()) {
    await page.screenshot({ path: `${OUT}/${tag}-login-rejected.png` }).catch(() => {});
    summary.failures.push(`${tag}: login failed`); await browser.close(); continue;
  }

  for (const route of ROUTES) {
    errs = [];
    const t0 = Date.now();
    try {
      await page.goto(`${BASE}/${route}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    } catch (e) { errs.push(`nav ${String(e).slice(0, 120)}`); }
    await page.waitForTimeout(2000);
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    const notFound = /^\s*404\b/.test(text) || /File not found|This page could not be found/i.test(text);
    const errorText = notFound ? "404 not found" : text.match(new RegExp(`.{0,60}(${ERROR_TEXT.source}).{0,60}`, "i"))?.[0] ?? null;
    const pageErrors = [...new Set(errs)].filter((e) => !IGNORE.test(e));
    await page.screenshot({ path: `${OUT}/${tag}-${route.replace(/\//g, "_")}.png` });
    summary.results[`${tag}:${route}`] = { ms: Date.now() - t0, url: page.url().replace(BASE, ""), pageErrors, errorText };
    if (pageErrors.length || errorText) summary.failures.push(`${tag}:${route} ${errorText ?? pageErrors[0]}`);
    console.log(`${pageErrors.length || errorText ? "FAIL" : "ok  "} ${tag} ${route} ${Date.now() - t0}ms`);
  }
  summary[`blocked_${tag}`] = [...new Set(blocked)];
  await browser.close();
}

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(summary, null, 1));
if (summary.failures.length) {
  console.error(`\n${summary.failures.length} failure(s):\n` + summary.failures.join("\n"));
  process.exit(1);
}
console.log("\nSmoke passed.");
