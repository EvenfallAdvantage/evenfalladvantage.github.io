import { describe, it, expect } from "vitest";
import { mergeReleases, parseGitHubCommitsToReleases, utcIsoDate, highlightDedupeKey, type ReleaseNote } from "@/lib/releases";
import { parseGitLogToReleases } from "../../scripts/generate-releases.mjs";

const SHA = "a3216fa5679d723ea0488fc947531c3bb9de8046";
const SUBJECT = "Invoices: save per company, status list, client read access (#244)";

describe("What's New UTC days + cross-source dedupe", () => {
  it("groups by UTC (Zulu) day", () => {
    expect(utcIsoDate("2026-11-01T23:22:00-05:00")).toBe("2026-11-02");
  });

  it("build-time parser records the PR number", () => {
    const rel = parseGitLogToReleases(`${SHA}\t2026-11-02\t${SUBJECT}`) as ReleaseNote[];
    expect(rel[0].highlights[0].pr).toBe(244);
  });

  it("a PR appears once even when sources put it on different days", () => {
    const build = parseGitLogToReleases(`${SHA}\t2026-11-01\t${SUBJECT}\nbbbbbbbb11111111\t2026-11-01\tUX: other thing (#243)`) as ReleaseNote[];
    const live = parseGitHubCommitsToReleases([{ sha: SHA, commit: { message: SUBJECT, author: { date: "2026-11-02T04:18:30Z" } } }]);
    expect(live[0].highlights[0].pr).toBe(244);
    const merged = mergeReleases([], build, live);
    const all = merged.flatMap((r) => r.highlights).filter((h) => h.pr === 244);
    expect(all).toHaveLength(1);
  });

  it("falls back to short SHA across git-/gh- id prefixes", () => {
    const base = { title: "x", summary: "x", roles: ["all" as const] };
    expect(highlightDedupeKey({ ...base, id: "git-a3216fa5" })).toBe(highlightDedupeKey({ ...base, id: "gh-a3216fa5", title: "y" }));
  });
});
