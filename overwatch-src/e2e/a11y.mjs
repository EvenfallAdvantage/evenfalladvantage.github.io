// Accessibility check (axe-core, WCAG 2.1 A/AA) on 10 key routes as the
// ZZTEST account, desktop + phone, with field mode off and on. Writes are
// blocked like the smoke test. Fails on any "critical" violation; prints
// serious/moderate counts. Results: $A11Y_OUT/a11y.json
// Env: ZZTEST_EMAIL, ZZTEST_PASSWORD, A11Y_BASE (default live app), SMOKE_CHROME (optional).
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

const BASE = (process.env.A11Y_BASE || "https://www.evenfalladvantage.com/overwatch").replace(/\/+$/, "");
const OUT = process.env.A11Y_OUT || "a11y-out";
const EMAIL = process.env.ZZTEST_EMAIL, PASSWORD = process.env.ZZTEST_PASSWORD;
if (!EMAIL || !PASSWORD || !/zztest/i.test(EMAIL)) { console.error("Set ZZTEST_EMAIL (a ZZTEST account) and ZZTEST_PASSWORD."); process.exit(1); }
const ROUTES = (process.env.A11Y_ROUTES || "feed timeclock patrols schedule incidents dictate chat knowledge-base profile more").split(/\s+/);
const READ_RPC = /\/rpc\/(get_|is_|has_|list_|my_|check_|search_|count_|post_order_ack_status)/;
fs.mkdirSync(OUT, { recursive: true });
const report = {}; let critical = 0;

for (const phone of [false, true]) for (const field of [false, true]) {
  const tag = `${phone ? "phone" : "desktop"}${field ? "-field" : ""}`;
  const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROME || undefined });
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1400, height: 900 }, isMobile: phone, hasTouch: phone });
  await ctx.route(/supabase\.co\/(rest|functions|storage)/, (r) => {
    const q = r.request(), m = q.method();
    if (["GET", "HEAD", "OPTIONS"].includes(m) || (m === "POST" && READ_RPC.test(q.url()))) return r.continue();
    return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" });
  });
  if (field) await ctx.addInitScript(() => { try { localStorage.setItem("ow-field-mode", "1"); } catch { /* */ } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?auth=login`); await page.waitForSelector("input[type=password]", { timeout: 120_000 });
  await page.fill("input[type=email]", EMAIL); await page.fill("input[type=password]", PASSWORD); await page.press("input[type=password]", "Enter");
  await page.waitForTimeout(8000);
  for (const route of ROUTES) {
    await page.goto(`${BASE}/${route}/`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const v = r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.length, targets: x.nodes.slice(0, 5).map((n) => String(n.target)) }));
    critical += v.filter((x) => x.impact === "critical").length;
    report[`${tag}:${route}`] = v;
    console.log(tag, route, v.map((x) => `${x.impact}:${x.id}×${x.nodes}`).join(" ") || "clean");
  }
  await browser.close();
}
fs.writeFileSync(`${OUT}/a11y.json`, JSON.stringify(report, null, 1));
if (critical) { console.error(`${critical} critical violation(s)`); process.exit(1); }
