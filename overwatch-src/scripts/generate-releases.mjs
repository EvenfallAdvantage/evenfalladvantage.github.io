#!/usr/bin/env node
/**
 * Build-time changelog generator for Overwatch What's New.
 *
 * Parses recent conventional commits (`feat(...)`, `fix(...)`, `perf(...)`) from
 * `git log` grouped by date (`YYYY-MM-DD`), inferring role eligibility, release
 * tier, icon, and safe valid `tryHref` routes, and writes the result to
 * `src/lib/generated-releases.json`.
 *
 * Falls back gracefully (preserving existing JSON or writing `[]`) when `.git`
 * is unavailable (e.g. shallow archive export).
 */

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../src/lib/generated-releases.json");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MARKETING_ONLY_SCOPES = new Set(["home", "westwood", "marketing", "landing"]);

/**
 * Format YYYY-MM-DD as "Oct 28, 2026".
 * @param {string} isoDate
 */
export function formatReleaseDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return isoDate;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  const monthName = MONTHS[monthIdx] ?? m[2];
  return `${monthName} ${day}, ${year}`;
}

/**
 * Infer route link, label, icon, and role eligibility from commit scope + subject.
 * @param {string} scope
 * @param {string} description
 */
export function inferHighlightMeta(scope, description) {
  const combined = `${scope} ${description}`.toLowerCase();

  /** @type {Array<"all" | "field" | "supervisor" | "admin">} */
  let roles = ["all"];
  if (/\b(admin|ops-planning|quick-fill|intake|timesheets?|roster|staff-mgmt)\b/.test(combined)) {
    roles = ["supervisor", "admin"];
  }

  /** @type {string | undefined} */
  let tryHref;
  /** @type {string | undefined} */
  let tryLabel;
  let icon = "Sparkles";

  if (/\b(map|traffic|cctv|layers|cesium|radar|hazard|aircraft|symbology|gnss|raws)\b/.test(combined)) {
    tryHref = "/schedule";
    tryLabel = "Open Tactical Map";
    icon = /\b(traffic|road|cctv)\b/.test(combined) ? "Car" : "Compass";
  } else if (/\b(timeclock|break|meal|rest|clock)\b/.test(combined)) {
    tryHref = "/timeclock";
    tryLabel = "Open Timeclock";
    icon = "Coffee";
  } else if (/\b(timesheets?|staff|roster)\b/.test(combined)) {
    tryHref = "/admin/staff";
    tryLabel = "Open Staff";
    icon = "Smartphone";
  } else if (/\b(events?|shifts?|ops|intake|quick-fill)\b/.test(combined)) {
    tryHref = "/admin/events";
    tryLabel = "Open Ops Planning";
    icon = "Layers";
  } else if (/\b(invite|auth|login|password|key)\b/.test(combined)) {
    icon = "KeyRound";
  }

  return { roles, tryHref, tryLabel, icon };
}

/**
 * Clean a commit description into a user-friendly title + summary.
 * @param {string} type
 * @param {string} scope
 * @param {string} rawDesc
 */
export function formatCommitTitleAndSummary(type, scope, rawDesc) {
  const cleaned = rawDesc.replace(/\s*\(#\d+\)\s*$/, "").trim();
  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  const scopeLabel = scope
    ? scope
        .replace(/[-_,]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : type === "feat"
      ? "Feature Update"
      : type === "perf"
        ? "Performance Upgrade"
        : "Reliability Fix";

  const firstClause = capitalized.split(/[;]/)[0].trim();
  const title = scope ? `${scopeLabel}: ${firstClause}` : firstClause;
  const summary = capitalized.endsWith(".") ? capitalized : `${capitalized}.`;
  return { title, summary };
}

/**
 * Parse git log lines (`<sha>\t<YYYY-MM-DD>\t<subject>`) into ReleaseNote entries.
 * @param {string} logText
 */
export function parseGitLogToReleases(logText) {
  const lines = logText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  /** @type {Map<string, { date: string; hasFeat: boolean; highlights: Array<any> }>} */
  const byDate = new Map();
  const seenTitles = new Set();

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const [sha, isoDate, ...subjectParts] = parts;
    const subject = subjectParts.join("\t").trim();

    const match = /^(feat|fix|perf)(?:\(([^)]+)\))?!?:\s*(.+)$/i.exec(subject);
    if (!match) continue;

    const type = match[1].toLowerCase();
    const scope = (match[2] ?? "").trim();
    const desc = match[3].trim();
    if (!desc) continue;
    if (scope && MARKETING_ONLY_SCOPES.has(scope.toLowerCase())) continue;

    const dedupeKey = `${isoDate}:${desc.toLowerCase()}`;
    if (seenTitles.has(dedupeKey)) continue;
    seenTitles.add(dedupeKey);

    const { title, summary } = formatCommitTitleAndSummary(type, scope, desc);
    const { roles, tryHref, tryLabel, icon } = inferHighlightMeta(scope, desc);

    const highlight = {
      id: `git-${sha.slice(0, 8)}`,
      title,
      summary,
      roles,
      ...(tryHref ? { tryHref, tryLabel } : {}),
      icon,
    };

    const group = byDate.get(isoDate) ?? {
      date: isoDate,
      hasFeat: false,
      highlights: [],
    };
    if (type === "feat") group.hasFeat = true;
    if (group.highlights.length < 8) {
      group.highlights.push(highlight);
    }
    byDate.set(isoDate, group);
  }

  const sortedDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
  return sortedDates.slice(0, 10).map((isoDate) => {
    const group = byDate.get(isoDate);
    const tier = group.hasFeat ? "major" : "minor";
    const leadTitle = group.highlights[0]?.title ?? "Overwatch Platform Updates";
    return {
      id: `git-${isoDate}`,
      date: formatReleaseDate(isoDate),
      version: `git-${isoDate.replace(/-/g, ".")}`,
      title: group.highlights.length > 1 ? `${leadTitle} & ${group.highlights.length - 1} more` : leadTitle,
      tier,
      highlights: group.highlights,
    };
  });
}

export function generateReleasesFile(outputPath = OUTPUT_PATH) {
  mkdirSync(dirname(outputPath), { recursive: true });
  try {
    const logText = execSync('git log -n 80 --date=short --pretty=format:"%H%x09%ad%x09%s"', {
      cwd: resolve(__dirname, "../.."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const releases = parseGitLogToReleases(logText);
    writeFileSync(outputPath, `${JSON.stringify(releases, null, 2)}\n`, "utf8");
    return releases;
  } catch {
    try {
      return JSON.parse(readFileSync(outputPath, "utf8"));
    } catch {
      writeFileSync(outputPath, "[]\n", "utf8");
      return [];
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateReleasesFile();
}
