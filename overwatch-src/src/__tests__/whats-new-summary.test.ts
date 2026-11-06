// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  GENERATED_RELEASES,
  RELEASES,
  filterReleaseHighlightsForRole,
  firstTopLevelClause,
  highlightDedupeKey,
  mergeReleases,
  parseGitHubCommitsToReleases,
  visibleHighlightSummary,
  visibleHighlightTitle,
  type ReleaseHighlight,
  type ReleaseNote,
} from "@/lib/releases";
import {
  firstTopLevelClause as buildFirstTopLevelClause,
  formatCommitTitleAndSummary,
  parseGitLogToReleases,
} from "../../scripts/generate-releases.mjs";
import { ChangelogHighlightLine } from "@/components/updates/whats-new-modal";

const BRIEFINGS = "UX: Briefings uses the Comms tab row (Incidents-style tabs; Scanner stays)";
const BRIEFINGS_CUT = "UX: Briefings uses the Comms tab row (Incidents-style tabs";
const NESTED = "Keep alerts (outer [inner; still inside] tail)";
const AFTER_GROUP = "Show status (alpha; beta); then the real tail";

function highlight(id: string): ReleaseHighlight {
  const found = GENERATED_RELEASES.flatMap((r) => r.highlights).find((h) => h.id === id);
  if (!found) throw new Error(`missing generated highlight ${id}`);
  return found;
}

function lineText(node: HTMLElement): string {
  return (node.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("visibleHighlightSummary", () => {
  it("drops screenshot duplicates that add no words beyond the title", () => {
    const dupes: Array<[string, string]> = [
      [
        "What's New: dedupe PRs across sources, consistent UTC (Zulu) dates",
        "What's New: dedupe PRs across sources, consistent UTC (Zulu) dates.",
      ],
      [
        "Invoices: save per company, status list, client read access",
        "Invoices: save per company, status list, client read access.",
      ],
      [
        "UX: restore dashboard section gaps, roomier cards, title-subtitle gap",
        "UX: restore dashboard section gaps, roomier cards, title-subtitle gap.",
      ],
      [
        "UX: drop leftover Clock/Mass Clock tab row from /patrols",
        "UX: drop leftover Clock/Mass Clock tab row from /patrols.",
      ],
      [
        "UX: per-tab page headings across multi-tab screens",
        "UX: per-tab page headings across multi-tab screens.",
      ],
      [
        "UX: each Comms tab gets its own heading",
        "UX: each Comms tab gets its own heading.",
      ],
      [
        "UX: page action sits right-aligned just below the tabs on phones",
        "UX: page action sits right-aligned just below the tabs on phones.",
      ],
    ];
    for (const [title, summary] of dupes) {
      expect(visibleHighlightSummary(title, summary), title).toBe("");
      expect(visibleHighlightTitle(title, summary)).toBe(title);
    }
  });

  it("treats case, whitespace, and punctuation-only differences as duplicates", () => {
    expect(visibleHighlightSummary("Invoices: save per company", "Invoices: save per company.")).toBe("");
    expect(visibleHighlightSummary("Invoices: save per company", "invoices: save per company!")).toBe("");
    expect(visibleHighlightSummary("Hello, world", "Hello world")).toBe("");
    expect(visibleHighlightSummary("Hello  world", "hello world…")).toBe("");
    expect(visibleHighlightSummary("What's New: dedupe PRs", "What’s New: dedupe PRs.")).toBe("");
    expect(visibleHighlightSummary("Ship v2.14", "ship v2.14.")).toBe("");
    expect(visibleHighlightSummary("from /patrols", "from /patrols.")).toBe("");
    expect(visibleHighlightSummary("", "   ")).toBe("");
    expect(visibleHighlightSummary("Export", "...")).toBe("");
  });

  it("keeps distinct meaningful descriptions verbatim", () => {
    for (const rel of RELEASES) {
      for (const h of rel.highlights) {
        expect(visibleHighlightSummary(h.title, h.summary), h.title).toBe(h.summary);
      }
    }
    const original = "Export the overnight CSV, including the break column.";
    expect(visibleHighlightSummary("Export", original)).toBe(original);
    expect(visibleHighlightSummary("Ship v2", "Ship v2.14 now.")).toBe("Ship v2.14 now.");
    expect(visibleHighlightSummary("Add roads", "Add roads and a live legend.")).toBe(
      "Add roads and a live legend.",
    );
    expect(visibleHighlightSummary("Price $5", "Price5")).toBe("Price5");
    expect(visibleHighlightSummary("Price $5", "Price 5.")).toBe("Price 5.");
    expect(visibleHighlightSummary("Re-sign", "Resign the roster.")).toBe("Resign the roster.");
    expect(visibleHighlightSummary("Price $5", "Price $5.")).toBe("");
    expect(visibleHighlightSummary("Re-sign", "Re-sign.")).toBe("");
  });

  it("shows only the genuine tail after a repeated title and a separator", () => {
    expect(visibleHighlightSummary("Export", "Export: overnight CSV is in the staff folder.")).toBe(
      "overnight CSV is in the staff folder.",
    );
    expect(visibleHighlightSummary("Export", "Export — overnight CSV is included.")).toBe(
      "overnight CSV is included.",
    );
    expect(visibleHighlightSummary("Export", "Export. Overnight CSV is included.")).toBe(
      "Overnight CSV is included.",
    );
    expect(visibleHighlightSummary("Export", "Export: ; overnight CSV.")).toBe("overnight CSV.");

    const built = formatCommitTitleAndSummary(
      "feat",
      "roster",
      "link rostered agents by verified email; fix false expired on set-password; batch bulk invites",
    );
    expect(built.title).toBe("Roster: Link rostered agents by verified email");
    expect(built.summary).toContain("fix false expired on set-password");
    expect(visibleHighlightSummary(built.title, built.summary)).toBe(
      "fix false expired on set-password; batch bulk invites.",
    );

    const liveRoster = parseGitHubCommitsToReleases([
      {
        sha: "81dc880a11223344",
        commit: {
          message:
            "feat(roster): link rostered agents by verified email; fix false expired on set-password; batch bulk invites",
          author: { date: "2026-10-23T12:00:00Z" },
        },
      },
    ])[0].highlights[0];
    expect(liveRoster.title).toBe(built.title);
    expect(visibleHighlightSummary(liveRoster.title, liveRoster.summary)).toBe(
      "fix false expired on set-password; batch bulk invites.",
    );
  });

  it("keeps a semicolon inside brackets in the title on both parsers", () => {
    const cases: Array<[string, string]> = [
      [BRIEFINGS, BRIEFINGS],
      [NESTED, NESTED],
      ["Route [alpha; beta] stays whole", "Route [alpha; beta] stays whole"],
      ["Note {alpha; beta} stays whole", "Note {alpha; beta} stays whole"],
      ["Mix (a [b; c] d) stays whole", "Mix (a [b; c] d) stays whole"],
      [AFTER_GROUP, "Show status (alpha; beta)"],
      ["Outer (inner); next clause", "Outer (inner)"],
    ];
    for (const [input, clause] of cases) {
      expect(firstTopLevelClause(input), input).toBe(clause);
      expect(buildFirstTopLevelClause(input), input).toBe(clause);
    }

    const built = formatCommitTitleAndSummary("feat", "", BRIEFINGS);
    const live = parseGitHubCommitsToReleases([
      {
        sha: "9e9c7684aabbccdd",
        commit: {
          message: `${BRIEFINGS} (#239)`,
          author: { date: "2026-11-01T12:00:00Z" },
        },
      },
    ])[0].highlights[0];
    const fromLog = (
      parseGitLogToReleases(`9e9c7684aabbccdd\t2026-11-01\t${BRIEFINGS} (#239)`) as ReleaseNote[]
    )[0].highlights[0];

    expect(built.title).toBe(BRIEFINGS);
    expect(live.title).toBe(BRIEFINGS);
    expect(fromLog.title).toBe(BRIEFINGS);
    expect(live.id).toBe("gh-9e9c7684");
    expect(fromLog.id).toBe("git-9e9c7684");
    expect(live.pr).toBe(239);
    expect(fromLog.pr).toBe(239);
    expect(highlightDedupeKey(live)).toBe("pr:239");
    expect(highlightDedupeKey(fromLog)).toBe(highlightDedupeKey(live));
    expect(visibleHighlightSummary(live.title, live.summary)).toBe("");
    expect(visibleHighlightTitle(live.title, live.summary)).toBe(BRIEFINGS);

    const legacySummary = `${BRIEFINGS}.`;
    expect(visibleHighlightTitle(BRIEFINGS_CUT, legacySummary)).toBe(BRIEFINGS);
    expect(visibleHighlightSummary(BRIEFINGS_CUT, legacySummary)).toBe("");
    expect(visibleHighlightSummary(BRIEFINGS_CUT, legacySummary)).not.toBe("Scanner stays).");

    const nestedCut = "Keep alerts (outer [inner";
    const nestedSummary = `${NESTED}.`;
    expect(visibleHighlightTitle(nestedCut, nestedSummary)).toBe(NESTED);
    expect(visibleHighlightSummary(nestedCut, nestedSummary)).toBe("");

    const grouped = formatCommitTitleAndSummary("feat", "", AFTER_GROUP);
    expect(grouped.title).toBe("Show status (alpha; beta)");
    expect(visibleHighlightSummary(grouped.title, grouped.summary)).toBe("then the real tail.");

    const legacyRelease: ReleaseNote = {
      id: "git-2026-11-01",
      date: "Nov 1, 2026",
      version: "git-2026.11.01",
      title: BRIEFINGS_CUT,
      tier: "major",
      highlights: [
        {
          id: "git-9e9c7684",
          pr: 239,
          title: BRIEFINGS_CUT,
          summary: legacySummary,
          roles: ["all"],
        },
      ],
    };
    const merged = mergeReleases([], [legacyRelease], [
      {
        id: "git-2026-11-01",
        date: "Nov 1, 2026",
        version: "git-2026.11.01",
        title: live.title,
        tier: "minor",
        highlights: [live],
      },
    ]);
    const kept = merged.flatMap((r) => r.highlights).filter((h) => h.pr === 239);
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe("git-9e9c7684");
  });

  it("does not drop distinct entries, dates, or role filtering", () => {
    const nov2 = GENERATED_RELEASES.find((r) => r.id === "git-2026-11-02");
    expect(nov2?.date).toBe("Nov 2, 2026");
    expect(nov2?.highlights.map((h) => h.id)).toEqual(["git-9956a03e", "git-a3216fa5"]);

    const oct28 = GENERATED_RELEASES.find((r) => r.id === "git-2026-10-28");
    expect(oct28).toBeTruthy();
    const timesheets = "git-0c91d17d";
    expect(filterReleaseHighlightsForRole(oct28!, "staff").map((h) => h.id)).not.toContain(timesheets);
    expect(filterReleaseHighlightsForRole(oct28!, "admin").map((h) => h.id)).toContain(timesheets);
    expect(visibleHighlightSummary(highlight(timesheets).title, highlight(timesheets).summary)).toBe("");
  });
});

describe("ChangelogHighlightLine", () => {
  afterEach(() => cleanup());

  it("renders screenshot rows once, with the full Briefings sentence and the Timeclock link", () => {
    const dedupe: ReleaseHighlight = {
      id: "dedupe",
      title: "What's New: dedupe PRs across sources, consistent UTC (Zulu) dates",
      summary: "What's New: dedupe PRs across sources, consistent UTC (Zulu) dates.",
      roles: ["all"],
      icon: "Megaphone",
    };
    const invoices: ReleaseHighlight = {
      id: "invoices",
      title: "Invoices: save per company, status list, client read access",
      summary: "Invoices: save per company, status list, client read access.",
      roles: ["all"],
    };
    const clock: ReleaseHighlight = {
      id: "clock",
      title: "UX: drop leftover Clock/Mass Clock tab row from /patrols",
      summary: "UX: drop leftover Clock/Mass Clock tab row from /patrols.",
      roles: ["all"],
      tryHref: "/timeclock",
      tryLabel: "Open Timeclock",
      icon: "Coffee",
    };
    const briefings: ReleaseHighlight = {
      id: "briefings",
      title: BRIEFINGS_CUT,
      summary: `${BRIEFINGS}.`,
      roles: ["all"],
      tryHref: "/patrols",
      tryLabel: "Open Patrols",
      icon: "MessageSquare",
    };
    const onTry = vi.fn();

    const { container } = render(
      createElement(
        "div",
        null,
        createElement(ChangelogHighlightLine, { highlight: dedupe }),
        createElement(ChangelogHighlightLine, { highlight: invoices }),
        createElement(ChangelogHighlightLine, { highlight: clock, onTry }),
        createElement(ChangelogHighlightLine, { highlight: briefings }),
      ),
    );
    const text = lineText(container);
    expect(text.match(/dedupe PRs across sources/g)).toHaveLength(1);
    expect(text.match(/save per company, status list, client read access/g)).toHaveLength(1);
    expect(text.match(/Clock\/Mass Clock/g)).toHaveLength(1);
    expect(text).not.toContain("patrols.");
    expect(text).toContain(BRIEFINGS);
    expect(text).not.toContain("Scanner stays).");
    expect(text.match(/Scanner stays/g)).toHaveLength(1);
    expect(text.match(/Incidents-style tabs/g)).toHaveLength(1);

    expect(screen.queryByTestId("whats-new-changelog-detail-dedupe")).toBeNull();
    expect(screen.queryByTestId("whats-new-changelog-detail-invoices")).toBeNull();
    expect(screen.queryByTestId("whats-new-changelog-detail-clock")).toBeNull();
    expect(screen.queryByTestId("whats-new-changelog-detail-briefings")).toBeNull();
    expect(screen.getByRole("button", { name: /Open Patrols/ })).toBeTruthy();

    const cta = screen.getByRole("button", { name: /Open Timeclock/ });
    expect(cta.className).toContain("underline");
    expect(container.querySelector(".min-w-0.flex-1")).not.toBeNull();
    fireEvent.click(cta);
    expect(onTry).toHaveBeenCalledWith(clock);
  });

  it("keeps a CTA when the summary is blank or only punctuation", () => {
    const blank: ReleaseHighlight = {
      id: "blank-cta",
      title: "UX: drop leftover Clock/Mass Clock tab row from /patrols",
      summary: "   ",
      roles: ["all"],
      tryHref: "/timeclock",
      tryLabel: "Open Timeclock",
      icon: "Coffee",
    };
    const punct: ReleaseHighlight = {
      ...blank,
      id: "punct-cta",
      summary: "UX: drop leftover Clock/Mass Clock tab row from /patrols.",
    };
    render(
      createElement(
        "div",
        null,
        createElement(ChangelogHighlightLine, { highlight: blank }),
        createElement(ChangelogHighlightLine, { highlight: punct }),
      ),
    );
    expect(screen.getAllByRole("button", { name: /Open Timeclock/ })).toHaveLength(2);
    expect(screen.queryByTestId("whats-new-changelog-detail-blank-cta")).toBeNull();
    expect(screen.queryByTestId("whats-new-changelog-detail-punct-cta")).toBeNull();
    for (const row of screen.getAllByTestId(/whats-new-changelog-item-/)) {
      expect(lineText(row)).not.toMatch(/patrols\s*:/);
      expect(lineText(row).match(/Clock\/Mass Clock/g)).toHaveLength(1);
    }
  });

  it("preserves a meaningful summary, including when that row also has a CTA", () => {
    const roads = RELEASES[0].highlights.find((h) => h.id === "roads-and-cameras-traffic");
    if (!roads) throw new Error("missing roads highlight");
    render(createElement(ChangelogHighlightLine, { highlight: roads }));
    expect(screen.getByRole("button", { name: /Open Tactical Map/ })).toBeTruthy();
    const detail = screen.getByTestId(`whats-new-changelog-detail-${roads.id}`);
    expect(detail.textContent).toBe(roads.summary);
    expect(lineText(detail.parentElement as HTMLElement)).toContain(`${roads.title}: ${roads.summary}`);
  });

  it("omits the link when the highlight has no CTA", () => {
    const invite = RELEASES[1].highlights.find((h) => h.id === "one-click-invite-password-setup");
    if (!invite) throw new Error("missing invite highlight");
    expect(invite.tryHref).toBeUndefined();
    render(createElement(ChangelogHighlightLine, { highlight: invite }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByTestId(`whats-new-changelog-detail-${invite.id}`).textContent).toBe(invite.summary);
  });
});
