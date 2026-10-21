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
].join(" ")).split(/\s+/).filter(Boolean);

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

  await page.goto(`${BASE}/?auth=login`);
  await page.waitForSelector("input[type=password]", { timeout: 120_000 });
  await page.fill("input[type=email]", EMAIL);
  await page.fill("input[type=password]", PASSWORD);
  await page.press("input[type=password]", "Enter");
  await page.waitForTimeout(8000);
  if (await page.locator("input[type=password]").count()) { summary.failures.push(`${tag}: login failed`); await browser.close(); continue; }

  for (const route of ROUTES) {
    errs = [];
    const t0 = Date.now();
    try {
      await page.goto(`${BASE}/${route}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    } catch (e) { errs.push(`nav ${String(e).slice(0, 120)}`); }
    await page.waitForTimeout(2000);
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    const errorText = text.match(new RegExp(`.{0,60}(${ERROR_TEXT.source}).{0,60}`, "i"))?.[0] ?? null;
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
