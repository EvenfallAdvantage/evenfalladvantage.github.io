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
 * Match a commit subject as a release highlight. Conventional feat/fix/perf commits match
 * directly; squash-merged PR titles ("Some feature (#224)") that are not chore/docs/ci/etc.
 * are treated as feat so every merged PR shows up in What's New.
 */
export function matchReleaseCommitSubject(subject) {
  const conv = /^(feat|fix|perf)(?:\(([^)]+)\))?!?:\s*(.+)$/i.exec(subject);
  if (conv) return { type: conv[1].toLowerCase(), scope: (conv[2] ?? "").trim(), desc: conv[3].replace(/\s*\(#\d+\)\s*$/, "").trim() };
  if (!/\(#\d+\)\s*$/.test(subject)) return null;
  // Non-release conventional types. Any other "Area: ..." prefix (UX:, Personnel:, HQ Config:)
  // is a plain PR title and stays in, with the prefix kept as part of the title.
  if (/^(chore|docs|ci|test|tests|build|style|refactor|revert|merge|wip|release|deps)\b/i.test(subject)) return null;
  return { type: "feat", scope: "", desc: subject.replace(/\s*\(#\d+\)\s*$/, "").trim() };
}

/** Extended icon rules after the core checks; keep in sync with src/lib/releases.ts. */
const EXTENDED_ICON_RULES = [
  [/\b(training|de-?escalation|scenarios?|courses?|lessons?|quiz(zes)?|certifications?)\b/, "GraduationCap", "/training/scenarios", "Open Training"],
  [/\b(a11y|accessibility|aria|screen ?readers?|contrast|hit areas?|keyboard)\b/, "Accessibility"],
  [/\b(security|dependabot|cve|vuln(erabilit(y|ies))?|codeql|secrets?|xss|csp|sanitiz\w*|toctou)\b/, "ShieldCheck"],
  [/(what'?s[\s-]new|\bchangelog\b|\breleases?\b)/, "Megaphone"],
  [/\b(perf|performance|faster|speed|latency|lazy|cach(e|ing)|optimi[sz]\w*)\b/, "Gauge"],
  [/\b(audio|tts|voice|sound)\b/, "Volume2"],
  [/\b(images?|photos?|pictures?|avatars?)\b/, "Image"],
  [/\b(notifications?|alerts?|push|reminders?)\b/, "Bell"],
  [/\b(chat|messages?|messaging|radio|comms)\b/, "MessageSquare"],
  [/\b(reports?|exports?|pdf|csv|docs?)\b/, "FileText"],
  [/\b(fix(es|ed)?|bugs?|crash(es)?|regressions?)\b/, "Wrench"],
];

/** @param {string} combined */
export function inferExtendedIcon(combined) {
  for (const [re, icon, tryHref, tryLabel] of EXTENDED_ICON_RULES) {
    if (re.test(combined)) return tryHref ? { icon, tryHref, tryLabel } : { icon };
  }
  return { icon: "Sparkles" };
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
  } else {
    ({ icon, tryHref, tryLabel } = { tryHref, tryLabel, ...inferExtendedIcon(combined) });
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

    const match = matchReleaseCommitSubject(subject);
    if (!match) continue;

    const { type, scope, desc } = match;
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
