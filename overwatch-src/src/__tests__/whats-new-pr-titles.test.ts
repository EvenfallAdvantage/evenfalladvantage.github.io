import { describe, it, expect } from "vitest";
import { matchReleaseCommitSubject } from "@/lib/releases";
import { matchReleaseCommitSubject as buildMatch } from "../../scripts/generate-releases.mjs";

const KEEP = [
  "UX: phone bars, Armory → Tools, Invoices → Command, Swaps in Approvals (#234)",
  "Personnel: merge Timesheets, Corrections and Leave into one Approvals tab (#228)",
  "HQ Config: show Feature Visibility to admins, not just owners (#236)",
  "feat(whats-new): wider auto icon map (#226)",
];
const DROP = [
  "chore(deps,security): resolve 7 Dependabot alerts (#217)",
  "Merge pull request #215 from x/y",
  "docs: readme (#9)",
  "UX: no PR number",
];

describe.each([["live", matchReleaseCommitSubject], ["build", buildMatch]])("%s parser", (_n, fn) => {
  it.each(KEEP)("keeps %s", (s) => expect(fn(s)).not.toBeNull());
  it.each(DROP)("drops %s", (s) => expect(fn(s)).toBeNull());
  it("keeps the area prefix in the description", () => {
    expect(fn(KEEP[0])?.desc).toBe("UX: phone bars, Armory → Tools, Invoices → Command, Swaps in Approvals");
  });
});
