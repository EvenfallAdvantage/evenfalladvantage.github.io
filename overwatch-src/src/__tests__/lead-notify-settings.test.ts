import { describe, it, expect } from "vitest";
import { parseNotifyEmails } from "@/app/admin/settings/components/lead-notify-settings";

describe("parseNotifyEmails()", () => {
  it("splits, lowercases and dedupes", () => {
    expect(parseNotifyEmails("Contact@EvenfallAdvantage.com, ops@x.co;contact@evenfalladvantage.com")).toEqual({
      emails: ["contact@evenfalladvantage.com", "ops@x.co"],
      invalid: [],
    });
  });
  it("reports invalid entries", () => {
    expect(parseNotifyEmails("good@x.co not-an-email").invalid).toEqual(["not-an-email"]);
  });
  it("empty input turns notifications off", () => {
    expect(parseNotifyEmails("  ")).toEqual({ emails: [], invalid: [] });
  });
});
