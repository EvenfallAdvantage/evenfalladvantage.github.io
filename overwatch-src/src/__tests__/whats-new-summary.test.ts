// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  GENERATED_RELEASES,
  RELEASES,
  filterReleaseHighlightsForRole,
  parseGitHubCommitsToReleases,
  visibleHighlightSummary,
  type ReleaseHighlight,
} from "@/lib/releases";
import { formatCommitTitleAndSummary } from "../../scripts/generate-releases.mjs";
import { ChangelogHighlightLine } from "@/components/updates/whats-new-modal";

function highlight(id: string): ReleaseHighlight {
  const found = GENERATED_RELEASES.flatMap((r) => r.highlights).find((h) => h.id === id);
  if (!found) throw new Error(`missing generated highlight ${id}`);
  return found;
}

function lineText(node: HTMLElement): string {
  return (node.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("visibleHighlightSummary", () => {
  it("drops the screenshot duplicates and keeps the Briefings tail", () => {
    const dupes = [
      "git-9956a03e", // What's New: dedupe PRs across sources, consistent UTC (Zulu) dates
      "git-a3216fa5", // Invoices: save per company, status list, client read access
      "git-ae1d61f6", // UX: restore dashboard section gaps…
      "git-7b11062f", // UX: drop leftover Clock/Mass Clock tab row from /patrols
      "git-62121e41", // UX: per-tab page headings across multi-tab screens
      "git-9e77975b", // UX: each Comms tab gets its own heading
      "git-665e0e66", // UX: page action sits right-aligned just below the tabs on phones
    ];
    for (const id of dupes) {
      const h = highlight(id);
      expect(visibleHighlightSummary(h.title, h.summary), h.title).toBe("");
    }

    const briefings = highlight("git-9e9c7684");
    expect(briefings.title).toBe("UX: Briefings uses the Comms tab row (Incidents-style tabs");
    expect(briefings.summary).toBe(
      "UX: Briefings uses the Comms tab row (Incidents-style tabs; Scanner stays).",
    );
    expect(visibleHighlightSummary(briefings.title, briefings.summary)).toBe("Scanner stays).");
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

    const roster = highlight("git-81dc880a");
    expect(roster.title).toBe("Roster: Link rostered agents by verified email");
    expect(visibleHighlightSummary(roster.title, roster.summary)).toBe(
      "fix false expired on set-password; batch bulk invites.",
    );

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

    const live = parseGitHubCommitsToReleases([
      {
        sha: "9e9c7684aabbccdd",
        commit: {
          message: "UX: Briefings uses the Comms tab row (Incidents-style tabs; Scanner stays) (#239)",
          author: { date: "2026-11-01T12:00:00Z" },
        },
      },
    ]);
    const h = live[0].highlights[0];
    expect(h.title).toBe(highlight("git-9e9c7684").title);
    expect(visibleHighlightSummary(h.title, h.summary)).toBe("Scanner stays).");
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

  it("renders screenshot rows once, with the Briefings tail and the Timeclock link", () => {
    const dedupe = highlight("git-9956a03e");
    const invoices = highlight("git-a3216fa5");
    const clock = highlight("git-7b11062f");
    const briefings = highlight("git-9e9c7684");
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
    expect(text).toContain("Scanner stays).");
    expect(text.match(/Incidents-style tabs/g)).toHaveLength(1);

    expect(screen.queryByTestId(`whats-new-changelog-detail-${dedupe.id}`)).toBeNull();
    expect(screen.queryByTestId(`whats-new-changelog-detail-${invoices.id}`)).toBeNull();
    expect(screen.queryByTestId(`whats-new-changelog-detail-${clock.id}`)).toBeNull();
    expect(screen.getByTestId(`whats-new-changelog-detail-${briefings.id}`).textContent).toBe(
      "Scanner stays).",
    );

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
