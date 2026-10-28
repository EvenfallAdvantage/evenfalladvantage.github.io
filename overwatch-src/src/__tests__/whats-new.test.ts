// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RELEASES,
  buildRollUpHighlights,
  filterReleaseHighlightsForRole,
  getStorageKeyForRelease,
  getUnseenReleases,
  isRoleEligibleForHighlight,
  isSuppressedWhatsNewRoute,
  markLatestReleaseSeen,
  readLastSeenReleaseId,
  shouldAutoOpenWhatsNew,
  parseGitHubCommitsToReleases,
  mergeReleases,
  fetchLatestGitHubReleases,
  type ReleaseNote,
} from "@/lib/releases";
import { MapLegalFooter } from "@/components/tactical-map/map-legal-footer";

describe("What's New release manifest & role filtering", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("orders releases newest-first with October 2026 major and minor releases", () => {
    expect(RELEASES.length).toBeGreaterThanOrEqual(2);
    expect(RELEASES[0].id).toBe("2026-10-28-roads-and-breaks");
    expect(RELEASES[0].tier).toBe("major");
    expect(RELEASES[1].id).toBe("2026-10-27-onboarding-and-intake");
    expect(RELEASES[1].tier).toBe("minor");
  });

  it("never points any highlight tryHref to the removed /intel route", () => {
    for (const rel of RELEASES) {
      for (const h of rel.highlights) {
        if (h.tryHref) {
          expect(h.tryHref).not.toBe("/intel");
          expect(h.tryHref.startsWith("/intel/")).toBe(false);
        }
      }
    }
    const v214 = RELEASES.find((r) => r.id === "2026-10-28-roads-and-breaks");
    expect(v214?.highlights.find((h) => h.id === "roads-and-cameras-traffic")?.tryHref).toBe("/schedule");
    expect(v214?.highlights.find((h) => h.id === "streamlined-tactical-map-hud")?.tryHref).toBe("/schedule");
  });

  it("parses GitHub commits into minor release notes, merges without duplicating curated dates, and falls back gracefully on error", async () => {
    const parsed = parseGitHubCommitsToReleases([
      {
        sha: "abcdef123456",
        commit: {
          message: "feat(schedule): add daily imagery date selector",
          author: { date: "2026-10-26T14:00:00Z" },
        },
      },
      {
        sha: "999999123456",
        commit: {
          message: "chore: release Overwatch",
          author: { date: "2026-10-26T15:00:00Z" },
        },
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].tier).toBe("minor");
    expect(parsed[0].highlights[0].tryHref).toBe("/schedule");

    const merged = mergeReleases(RELEASES, parsed);
    expect(merged.some((r) => r.id === parsed[0].id)).toBe(true);

    const fallback = await fetchLatestGitHubReleases({
      fetchImpl: async () => {
        throw new Error("network error");
      },
    });
    expect(fallback).toEqual([]);
  });

  it("filters highlights by role (field staff vs supervisor/admin)", () => {
    // Field staff sees "all" and "field", but NOT "supervisor" or "admin"
    expect(isRoleEligibleForHighlight("staff", ["all"])).toBe(true);
    expect(isRoleEligibleForHighlight("staff", ["field"])).toBe(true);
    expect(isRoleEligibleForHighlight("staff", ["supervisor", "admin"])).toBe(false);
    expect(isRoleEligibleForHighlight("breaker", ["supervisor", "admin"])).toBe(false);

    // Supervisors (manager/lead) see "all" and "supervisor", not admin-only
    expect(isRoleEligibleForHighlight("manager", ["supervisor"])).toBe(true);
    expect(isRoleEligibleForHighlight("lead", ["supervisor", "admin"])).toBe(true);
    expect(isRoleEligibleForHighlight("manager", ["admin"])).toBe(false);

    // Admins & owners see "all", "supervisor", and "admin"
    expect(isRoleEligibleForHighlight("admin", ["admin"])).toBe(true);
    expect(isRoleEligibleForHighlight("owner", ["supervisor", "admin"])).toBe(true);

    const majorRelease = RELEASES[0];
    const staffHighlights = filterReleaseHighlightsForRole(majorRelease, "staff");
    const adminHighlights = filterReleaseHighlightsForRole(majorRelease, "admin");

    expect(staffHighlights.some((h) => h.id === "ops-planning-quick-fill-count")).toBe(false);
    expect(adminHighlights.some((h) => h.id === "ops-planning-quick-fill-count")).toBe(true);
  });

  it("rolls up multiple missed releases into ONE view capped at 4 highlights", () => {
    const fiveReleases: ReleaseNote[] = [
      ...RELEASES,
      {
        id: "2026-10-20-r3",
        date: "Oct 20, 2026",
        version: "v2.12",
        title: "Release 3",
        tier: "major",
        highlights: [
          { id: "h-r3-1", title: "R3 H1", summary: "Summary 1", roles: ["all"] },
          { id: "h-r3-2", title: "R3 H2", summary: "Summary 2", roles: ["all"] },
        ],
      },
      {
        id: "2026-10-15-r4",
        date: "Oct 15, 2026",
        version: "v2.11",
        title: "Release 4",
        tier: "minor",
        highlights: [
          { id: "h-r4-1", title: "R4 H1", summary: "Summary 3", roles: ["all"] },
        ],
      },
      {
        id: "2026-10-10-r5",
        date: "Oct 10, 2026",
        version: "v2.10",
        title: "Release 5",
        tier: "major",
        highlights: [
          { id: "h-r5-1", title: "R5 H1", summary: "Summary 4", roles: ["all"] },
        ],
      },
    ];

    const rollUpAdmin = buildRollUpHighlights({
      lastSeenId: null,
      userRole: "admin",
      maxHighlights: 4,
      releases: fiveReleases,
    });

    expect(rollUpAdmin.unseenReleaseCount).toBe(5);
    expect(rollUpAdmin.badgeLabel).toBe("5 updates since your last visit");
    expect(rollUpAdmin.highlights).toHaveLength(4);

    // For field staff on the 2 default releases, "ops-planning-quick-fill-count" and "mobile-friendly-timesheets"
    // are filtered out, so field staff sees the 3 field-eligible highlights from v2.14 + 1 from v2.13 = 4 total
    const rollUpStaff = buildRollUpHighlights({
      lastSeenId: null,
      userRole: "staff",
      maxHighlights: 4,
      releases: RELEASES,
    });
    expect(rollUpStaff.unseenReleaseCount).toBe(2);
    expect(rollUpStaff.highlights.map((h) => h.id)).toEqual([
      "roads-and-cameras-traffic",
      "compact-meal-rest-breaks",
      "streamlined-tactical-map-hud",
      "one-click-invite-password-setup",
    ]);
  });

  it("never auto-opens on /timeclock, /scan, /login, /register, or /auth routes", () => {
    expect(isSuppressedWhatsNewRoute("/timeclock")).toBe(true);
    expect(isSuppressedWhatsNewRoute("/overwatch/timeclock")).toBe(true);
    expect(isSuppressedWhatsNewRoute("/scan")).toBe(true);
    expect(isSuppressedWhatsNewRoute("/overwatch/scan")).toBe(true);
    expect(isSuppressedWhatsNewRoute("/login")).toBe(true);
    expect(isSuppressedWhatsNewRoute("/register")).toBe(true);
    expect(isSuppressedWhatsNewRoute("/auth/callback")).toBe(true);
    expect(isSuppressedWhatsNewRoute("/feed")).toBe(false);
    expect(isSuppressedWhatsNewRoute("/intel")).toBe(false);

    expect(
      shouldAutoOpenWhatsNew({
        lastSeenId: null,
        pathname: "/timeclock",
        userRole: "staff",
      }),
    ).toBe(false);

    expect(
      shouldAutoOpenWhatsNew({
        lastSeenId: null,
        pathname: "/scan",
        userRole: "staff",
      }),
    ).toBe(false);

    expect(
      shouldAutoOpenWhatsNew({
        lastSeenId: null,
        pathname: "/feed",
        userRole: "staff",
      }),
    ).toBe(true);
  });

  it("does not auto-open when only minor releases are unseen", () => {
    const minorOnly: ReleaseNote[] = [RELEASES[1]];
    expect(
      shouldAutoOpenWhatsNew({
        lastSeenId: null,
        pathname: "/feed",
        userRole: "admin",
        releases: minorOnly,
      }),
    ).toBe(false);
  });

  it("marks the latest release ID as seen in localStorage and suppresses subsequent auto-open", () => {
    const userId = "user-123";
    expect(readLastSeenReleaseId(userId)).toBeNull();

    const marked = markLatestReleaseSeen(userId, RELEASES);
    expect(marked).toBe("2026-10-28-roads-and-breaks");
    expect(localStorage.getItem(getStorageKeyForRelease(userId))).toBe(
      "2026-10-28-roads-and-breaks",
    );
    expect(readLastSeenReleaseId(userId)).toBe("2026-10-28-roads-and-breaks");
    expect(getUnseenReleases(readLastSeenReleaseId(userId), RELEASES)).toHaveLength(0);
    expect(
      shouldAutoOpenWhatsNew({
        lastSeenId: readLastSeenReleaseId(userId),
        pathname: "/feed",
        userRole: "admin",
      }),
    ).toBe(false);
  });
});

describe("MapLegalFooter compact right-aligned pill", () => {
  it("separates Cesium bottom-left credit slot from the bottom-right attribution pill and shows concise credits", () => {
    let opened = false;
    const ref = { current: null as HTMLDivElement | null };
    render(
      createElement(MapLegalFooter, {
        creditRef: (el) => {
          ref.current = el;
        },
        onOpenSources: () => {
          opened = true;
        },
        osmBuildings: true,
        traffic: true,
        ais: true,
        models: true,
      }),
    );

    const creditSlot = screen.getByTestId("cesium-credit-slot");
    const pill = screen.getByTestId("map-legal-footer");
    expect(creditSlot.className).toContain("left-0");
    expect(pill.className).toContain("bottom-1");
    expect(pill.className).toContain("right-2");

    expect(screen.getByTestId("osm-buildings-attribution").textContent).toContain("© OSM");
    expect(screen.getByTestId("traffic-attribution").textContent).toContain("© TomTom");
    expect(screen.getByTestId("ais-attribution").textContent).toContain("AIS:");
    expect(screen.getByTestId("models-attribution").textContent).toContain("CC BY 4.0");

    fireEvent.click(screen.getByTestId("map-sources-button"));
    expect(opened).toBe(true);
  });
});
