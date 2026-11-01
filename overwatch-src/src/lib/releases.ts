import generatedReleasesRaw from "./generated-releases.json";

export type ReleaseRole = "all" | "field" | "supervisor" | "admin";

export interface ReleaseHighlight {
  id: string;
  title: string;
  summary: string;
  roles: ReleaseRole[];
  tryHref?: string;
  tryLabel?: string;
  icon?: string;
}

export interface ReleaseNote {
  id: string;
  date: string;
  version: string;
  title: string;
  tier: "major" | "minor";
  highlights: ReleaseHighlight[];
}

export interface RolledUpHighlight extends ReleaseHighlight {
  releaseId: string;
  releaseVersion: string;
  releaseDate: string;
  releaseTier: "major" | "minor";
}

export const LAST_SEEN_RELEASE_KEY_PREFIX = "overwatch_last_seen_release_v1_";
export const LAST_SEEN_RELEASE_LEGACY_KEY = "overwatch_last_seen_release_id";
export const GITHUB_RELEASES_CACHE_KEY = "overwatch_github_releases_cache_v1";
export const GITHUB_RELEASES_CACHE_TTL_MS = 15 * 60 * 1000;
export const GITHUB_COMMITS_URL =
  "https://api.github.com/repos/EvenfallAdvantage/evenfalladvantage.github.io/commits?per_page=20";

/**
 * Structured Overwatch release manifest (newest first).
 */
export const RELEASES: ReleaseNote[] = [
  {
    id: "2026-10-28-roads-and-breaks",
    date: "Oct 28, 2026",
    version: "v2.14",
    title: "Live Traffic, Compact Break Controls & Streamlined Map",
    tier: "major",
    highlights: [
      {
        id: "roads-and-cameras-traffic",
        title: "Roads & Cameras Layer",
        summary:
          "Live TomTom traffic congestion speeds plus state DOT & 511 road closures, crashes, and work zones under the Roads & Cameras map drawer group.",
        roles: ["all"],
        tryHref: "/schedule",
        tryLabel: "Open Tactical Map",
        icon: "Car",
      },
      {
        id: "compact-meal-rest-breaks",
        title: "One-Tap Meal & Rest Breaks",
        summary:
          "Clock in and log Take Lunch or Take 10 (Rest) right inside the clock pane, with automatic unpaid meal deduction on timesheets.",
        roles: ["all"],
        tryHref: "/timeclock",
        tryLabel: "Open Timeclock",
        icon: "Coffee",
      },
      {
        id: "streamlined-tactical-map-hud",
        title: "Streamlined Tactical Map HUD",
        summary:
          "Live company operational pill (Active Ops, On-Duty Staff, Active Alerts) at top-center and collapsible Measure & Annotate tool menus.",
        roles: ["all"],
        tryHref: "/schedule",
        tryLabel: "View Map",
        icon: "Compass",
      },
      {
        id: "ops-planning-quick-fill-count",
        title: "Ops Planning Multi-Post Quick Fill",
        summary:
          "Set a Count (1–99) in Quick Fill to generate numbered posts (Agent 1 … Agent 10) in one click.",
        roles: ["supervisor", "admin"],
        tryHref: "/admin/events",
        tryLabel: "Open Ops Planning",
        icon: "Layers",
      },
    ],
  },
  {
    id: "2026-10-27-onboarding-and-intake",
    date: "Oct 27, 2026",
    version: "v2.13",
    title: "Direct Roster Invite Links, Mobile Timesheets & Intake Polish",
    tier: "minor",
    highlights: [
      {
        id: "mobile-friendly-timesheets",
        title: "Mobile-Friendly Timesheets",
        summary:
          "Clean vertical card layout on phone screens with break badges and net paid hours.",
        roles: ["supervisor", "admin"],
        tryHref: "/admin/staff",
        tryLabel: "Open Timesheets",
        icon: "Smartphone",
      },
      {
        id: "one-click-invite-password-setup",
        title: "One-Click Invite Password Setup",
        summary:
          "Direct invite links land straight on the password setup screen with automatic email fallback.",
        roles: ["all"],
        icon: "KeyRound",
      },
    ],
  },
];

/**
 * Build-time generated releases parsed from `git log` via `scripts/generate-releases.mjs`.
 */
export const GENERATED_RELEASES: ReleaseNote[] = Array.isArray(generatedReleasesRaw)
  ? (generatedReleasesRaw as ReleaseNote[])
  : [];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MARKETING_ONLY_SCOPES = new Set(["home", "westwood", "marketing", "landing"]);

function formatIsoDateLabel(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) return isoDate;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  return `${MONTHS[monthIdx] ?? m[2]} ${day}, ${year}`;
}

/**
 * Extended icon rules used after the map/timeclock/staff/ops/auth checks, before the
 * Sparkles default. Keep in sync with scripts/generate-releases.mjs.
 */
export const EXTENDED_ICON_RULES: ReadonlyArray<
  readonly [RegExp, string, string?, string?]
> = [
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

export function inferExtendedIcon(
  combined: string,
): { icon: string; tryHref?: string; tryLabel?: string } {
  for (const [re, icon, tryHref, tryLabel] of EXTENDED_ICON_RULES) {
    if (re.test(combined)) return tryHref ? { icon, tryHref, tryLabel } : { icon };
  }
  return { icon: "Sparkles" };
}

function inferCommitMeta(scope: string, description: string): {
  roles: ReleaseRole[];
  tryHref?: string;
  tryLabel?: string;
  icon: string;
} {
  const combined = `${scope} ${description}`.toLowerCase();
  const roles: ReleaseRole[] = /\b(admin|ops-planning|quick-fill|intake|timesheets?|roster|staff-mgmt)\b/.test(
    combined,
  )
    ? ["supervisor", "admin"]
    : ["all"];

  if (/\b(map|schedule|imagery|traffic|cctv|layers|cesium|radar|hazard|aircraft|symbology|gnss|raws)\b/.test(combined)) {
    return {
      roles,
      tryHref: "/schedule",
      tryLabel: "Open Tactical Map",
      icon: /\b(traffic|road|cctv)\b/.test(combined) ? "Car" : "Compass",
    };
  }
  if (/\b(timeclock|break|meal|rest|clock)\b/.test(combined)) {
    return {
      roles,
      tryHref: "/timeclock",
      tryLabel: "Open Timeclock",
      icon: "Coffee",
    };
  }
  if (/\b(timesheets?|staff|roster)\b/.test(combined)) {
    return {
      roles,
      tryHref: "/admin/staff",
      tryLabel: "Open Staff",
      icon: "Smartphone",
    };
  }
  if (/\b(events?|shifts?|ops|intake|quick-fill)\b/.test(combined)) {
    return {
      roles,
      tryHref: "/admin/events",
      tryLabel: "Open Ops Planning",
      icon: "Layers",
    };
  }
  if (/\b(invite|auth|login|password|key)\b/.test(combined)) {
    return { roles, icon: "KeyRound" };
  }
  return { roles, ...inferExtendedIcon(combined) };
}

export interface GitHubCommitPayload {
  sha?: string;
  commit?: {
    message?: string;
    author?: {
      date?: string;
    };
  };
}

/**
 * Match a commit subject as a release highlight. Conventional feat/fix/perf commits match
 * directly; squash-merged PR titles ("Some feature (#224)") that are not chore/docs/ci/etc.
 * are treated as feat so every merged PR shows up in What's New.
 */
export function matchReleaseCommitSubject(
  subject: string,
): { type: string; scope: string; desc: string } | null {
  const conv = /^(feat|fix|perf)(?:\(([^)]+)\))?!?:\s*(.+)$/i.exec(subject);
  if (conv) return { type: conv[1].toLowerCase(), scope: (conv[2] ?? "").trim(), desc: conv[3].replace(/\s*\(#\d+\)\s*$/, "").trim() };
  if (!/\(#\d+\)\s*$/.test(subject)) return null;
  if (/^(chore|docs|ci|test|tests|build|style|refactor|revert|merge)\b/i.test(subject)) return null;
  if (/^[a-z]+(\([^)]*\))?!?:/i.test(subject)) return null;
  return { type: "feat", scope: "", desc: subject.replace(/\s*\(#\d+\)\s*$/, "").trim() };
}

/**
 * Parse GitHub `/commits` API payload into grouped ReleaseNote items.
 */
export function parseGitHubCommitsToReleases(
  commits: readonly GitHubCommitPayload[],
): ReleaseNote[] {
  const byDate = new Map<
    string,
    { isoDate: string; hasFeat: boolean; highlights: ReleaseHighlight[] }
  >();
  const seen = new Set<string>();

  for (const item of commits) {
    const sha = (item.sha ?? "").trim();
    const rawMsg = (item.commit?.message ?? "").trim();
    const firstLine = rawMsg.split(/\r?\n/)[0]?.trim() ?? "";
    const rawDate = (item.commit?.author?.date ?? "").slice(0, 10);
    if (!sha || !firstLine || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) continue;

    const match = matchReleaseCommitSubject(firstLine);
    if (!match) continue;
    const { type, scope, desc } = match;
    if (!desc) continue;
    if (scope && MARKETING_ONLY_SCOPES.has(scope.toLowerCase())) continue;

    const dedupeKey = `${rawDate}:${desc.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const capitalized = desc.charAt(0).toUpperCase() + desc.slice(1);
    const scopeLabel = scope
      ? scope.replace(/[-_,]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "";
    const firstClause = capitalized.split(";")[0].trim();
    const title = scopeLabel ? `${scopeLabel}: ${firstClause}` : firstClause;
    const summary = capitalized.endsWith(".") ? capitalized : `${capitalized}.`;
    const meta = inferCommitMeta(scope, desc);

    const highlight: ReleaseHighlight = {
      id: `gh-${sha.slice(0, 8)}`,
      title,
      summary,
      roles: meta.roles,
      ...(meta.tryHref ? { tryHref: meta.tryHref, tryLabel: meta.tryLabel } : {}),
      icon: meta.icon,
    };

    const group = byDate.get(rawDate) ?? {
      isoDate: rawDate,
      hasFeat: false,
      highlights: [],
    };
    if (type === "feat") group.hasFeat = true;
    if (group.highlights.length < 8) {
      group.highlights.push(highlight);
    }
    byDate.set(rawDate, group);
  }

  return [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((isoDate) => {
      const group = byDate.get(isoDate)!;
      const lead = group.highlights[0]?.title ?? "Overwatch Updates";
      return {
        id: `git-${isoDate}`,
        date: formatIsoDateLabel(isoDate),
        version: `git-${isoDate.replace(/-/g, ".")}`,
        title:
          group.highlights.length > 1
            ? `${lead} & ${group.highlights.length - 1} more`
            : lead,
        tier: "minor" as const,
        highlights: group.highlights,
      };
    });
}

/**
 * Merge curated releases with build-time generated releases and live GitHub commits.
 * Curated releases take precedence on matching dates, while any additional highlights or
 * older/newer date groups from git history are appended cleanly without duplicates.
 */
export function mergeReleases(
  curated: readonly ReleaseNote[],
  ...extraLists: ReadonlyArray<readonly ReleaseNote[]>
): ReleaseNote[] {
  const byDate = new Map<string, ReleaseNote>();
  const order: string[] = [];

  for (const r of curated) {
    byDate.set(r.date, {
      ...r,
      highlights: [...r.highlights],
    });
    order.push(r.date);
  }

  for (const list of extraLists) {
    for (const rel of list) {
      if (!rel || !Array.isArray(rel.highlights) || rel.highlights.length === 0) continue;
      const existing = byDate.get(rel.date);
      if (!existing) {
        byDate.set(rel.date, {
          ...rel,
          highlights: [...rel.highlights],
        });
        order.push(rel.date);
      } else {
        const seenIds = new Set(existing.highlights.map((h) => h.id));
        const seenTitles = new Set(existing.highlights.map((h) => h.title.toLowerCase()));
        for (const h of rel.highlights) {
          if (seenIds.has(h.id) || seenTitles.has(h.title.toLowerCase())) continue;
          seenIds.add(h.id);
          seenTitles.add(h.title.toLowerCase());
          existing.highlights.push(h);
        }
      }
    }
  }

  const merged = order.map((d) => byDate.get(d)!);
  merged.sort((a, b) => releaseDateValue(b.date) - releaseDateValue(a.date));
  return assignSemanticVersions(merged);
}

function releaseDateValue(label: string): number {
  const t = Date.parse(label);
  return Number.isNaN(t) ? 0 : t;
}

const SEMVER_RE = /^v(\d+)\.(\d+)(?:\.(\d+))?$/;

/**
 * Replace auto-generated `git-YYYY.MM.DD` labels with proper `vX.Y` versions.
 * Expects releases sorted newest first. Generated groups newer than the latest curated
 * release continue its minor line (v2.14 -> v2.15, v2.16...); generated groups that fall
 * between curated releases become patch versions of the preceding one (v2.13.1...).
 */
export function assignSemanticVersions(releases: ReleaseNote[]): ReleaseNote[] {
  const firstCurated = [...releases].reverse().find((r) => SEMVER_RE.test(r.version));
  let major = 2;
  let minor = 0;
  if (firstCurated) {
    const m = SEMVER_RE.exec(firstCurated.version)!;
    major = Number(m[1]);
    minor = Math.max(0, Number(m[2]) - 1);
  }
  let patch = 0;
  let newestCuratedIdx = releases.findIndex((r) => SEMVER_RE.test(r.version));
  if (newestCuratedIdx < 0) newestCuratedIdx = releases.length;

  const out = releases.map((r) => ({ ...r }));
  for (let i = out.length - 1; i >= 0; i--) {
    const r = out[i];
    const m = SEMVER_RE.exec(r.version);
    if (m) {
      major = Number(m[1]);
      minor = Number(m[2]);
      patch = Number(m[3] ?? 0);
      continue;
    }
    if (i < newestCuratedIdx) {
      minor += 1;
      patch = 0;
      r.version = `v${major}.${minor}`;
    } else {
      patch += 1;
      r.version = `v${major}.${minor}.${patch}`;
    }
  }
  return out;
}

/**
 * Lightweight client-side fetch that queries GitHub's commits endpoint (cached in
 * sessionStorage for 15 minutes, failing silently to `[]` if offline or rate-limited).
 */
export async function fetchLatestGitHubReleases(options?: {
  signal?: AbortSignal;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<ReleaseNote[]> {
  const store =
    options?.storage !== undefined
      ? options.storage
      : typeof window !== "undefined"
        ? window.sessionStorage
        : null;
  const now = options?.now ?? Date.now();

  if (store) {
    try {
      const raw = store.getItem(GITHUB_RELEASES_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { ts?: number; releases?: ReleaseNote[] };
        if (
          typeof parsed.ts === "number" &&
          now - parsed.ts < GITHUB_RELEASES_CACHE_TTL_MS &&
          Array.isArray(parsed.releases)
        ) {
          return parsed.releases;
        }
      }
    } catch {
      // ignore storage parse errors
    }
  }

  const fetchFn = options?.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fetchFn) return [];

  try {
    const res = await fetchFn(GITHUB_COMMITS_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: options?.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as GitHubCommitPayload[];
    if (!Array.isArray(data)) return [];
    const releases = parseGitHubCommitsToReleases(data);
    if (store) {
      try {
        store.setItem(
          GITHUB_RELEASES_CACHE_KEY,
          JSON.stringify({ ts: now, releases }),
        );
      } catch {
        // ignore quota errors
      }
    }
    return releases;
  } catch {
    return [];
  }
}

export function getStorageKeyForRelease(userId?: string | null): string {
  const cleanId = (userId ?? "").trim() || "anon";
  return `${LAST_SEEN_RELEASE_KEY_PREFIX}${cleanId}`;
}

export function readLastSeenReleaseId(
  userId?: string | null,
  storage?: Pick<Storage, "getItem"> | null,
): string | null {
  const store = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!store) return null;
  try {
    const scoped = store.getItem(getStorageKeyForRelease(userId));
    if (scoped) return scoped;
    if (!userId) {
      return store.getItem(LAST_SEEN_RELEASE_LEGACY_KEY);
    }
    return null;
  } catch {
    return null;
  }
}

export function markLatestReleaseSeen(
  userId?: string | null,
  releases: readonly ReleaseNote[] = RELEASES,
  storage?: Pick<Storage, "setItem"> | null,
): string | null {
  const latestId = releases[0]?.id ?? null;
  if (!latestId) return null;
  const store = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!store) return latestId;
  try {
    store.setItem(getStorageKeyForRelease(userId), latestId);
    store.setItem(LAST_SEEN_RELEASE_LEGACY_KEY, latestId);
  } catch {
    // Ignore storage quota / private mode errors
  }
  return latestId;
}

/**
 * Role mapping:
 * - "all" matches every role.
 * - "admin" matches "owner" and "admin".
 * - "supervisor" matches "owner", "admin", "instructor", "manager", "lead", "supervisor".
 * - "field" matches regular patrollers/staff ("staff", "breaker", "field", "patroller", or unset).
 */
export function isRoleEligibleForHighlight(
  userRole: string | null | undefined,
  highlightRoles: readonly ReleaseRole[],
): boolean {
  if (highlightRoles.includes("all")) return true;
  const normalized = (userRole ?? "staff").toLowerCase().trim();
  const isAdmin = normalized === "owner" || normalized === "admin";
  const isSupervisor =
    isAdmin ||
    normalized === "instructor" ||
    normalized === "manager" ||
    normalized === "lead" ||
    normalized === "supervisor";
  const isField = !isSupervisor;

  if (isAdmin && highlightRoles.includes("admin")) return true;
  if (isSupervisor && highlightRoles.includes("supervisor")) return true;
  if (isField && highlightRoles.includes("field")) return true;
  return false;
}

export function filterReleaseHighlightsForRole(
  release: ReleaseNote,
  userRole?: string | null,
): ReleaseHighlight[] {
  return release.highlights.filter((h) => isRoleEligibleForHighlight(userRole, h.roles));
}

/**
 * Returns all releases newer than `lastSeenId` (assuming `releases` is ordered newest-first).
 */
export function getUnseenReleases(
  lastSeenId: string | null | undefined,
  releases: readonly ReleaseNote[] = RELEASES,
): ReleaseNote[] {
  if (!lastSeenId) return [...releases];
  const idx = releases.findIndex((r) => r.id === lastSeenId);
  if (idx === -1) return [...releases];
  return releases.slice(0, idx);
}

/**
 * Operational / auth routes where a What's New popup must NEVER auto-open
 * so field staff rushing to clock in or scan a checkpoint are never blocked.
 */
const SUPPRESSED_ROUTE_PREFIXES = [
  "/timeclock",
  "/scan",
  "/login",
  "/register",
  "/auth",
];

export function isSuppressedWhatsNewRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  const clean = pathname.replace(/^\/overwatch(?=\/|$)/, "") || "/";
  return SUPPRESSED_ROUTE_PREFIXES.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`),
  );
}

export function shouldAutoOpenWhatsNew(params: {
  lastSeenId: string | null | undefined;
  pathname: string | null | undefined;
  userRole?: string | null;
  releases?: readonly ReleaseNote[];
}): boolean {
  const { lastSeenId, pathname, userRole, releases = RELEASES } = params;
  if (isSuppressedWhatsNewRoute(pathname)) return false;

  const unseen = getUnseenReleases(lastSeenId, releases);
  if (unseen.length === 0) return false;

  const hasMajor = unseen.some((r) => r.tier === "major");
  if (!hasMajor) return false;

  const hasEligibleHighlight = unseen.some(
    (r) => filterReleaseHighlightsForRole(r, userRole).length > 0,
  );
  return hasEligibleHighlight;
}

export function buildRollUpHighlights(params: {
  lastSeenId: string | null | undefined;
  userRole?: string | null;
  maxHighlights?: number;
  releases?: readonly ReleaseNote[];
}): {
  unseenReleaseCount: number;
  unseenMajorCount: number;
  latestRelease: ReleaseNote | null;
  highlights: RolledUpHighlight[];
  badgeLabel: string;
} {
  const {
    lastSeenId,
    userRole,
    maxHighlights = 4,
    releases = RELEASES,
  } = params;

  const unseen = getUnseenReleases(lastSeenId, releases);
  const latestRelease = releases[0] ?? null;

  const allEligible: RolledUpHighlight[] = [];
  for (const rel of unseen) {
    const matching = filterReleaseHighlightsForRole(rel, userRole);
    for (const h of matching) {
      allEligible.push({
        ...h,
        releaseId: rel.id,
        releaseVersion: rel.version,
        releaseDate: rel.date,
        releaseTier: rel.tier,
      });
    }
  }

  const highlights = allEligible.slice(0, Math.max(1, maxHighlights));
  const unseenReleaseCount = unseen.length;
  const unseenMajorCount = unseen.filter((r) => r.tier === "major").length;
  const badgeLabel =
    unseenReleaseCount > 1
      ? `${unseenReleaseCount} updates since your last visit`
      : latestRelease
        ? `${latestRelease.version} · ${latestRelease.date}`
        : "Latest update";

  return {
    unseenReleaseCount,
    unseenMajorCount,
    latestRelease,
    highlights,
    badgeLabel,
  };
}
