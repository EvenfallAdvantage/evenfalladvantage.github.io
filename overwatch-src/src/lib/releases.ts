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
        tryHref: "/intel",
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
        tryHref: "/intel",
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
