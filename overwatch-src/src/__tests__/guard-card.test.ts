import { describe, it, expect } from "vitest";
import { guardCardStatus } from "@/lib/compliance/guard-card";

describe("guardCardStatus", () => {
  const start = "2026-11-01T16:00:00Z";
  it("missing when no expiry", () => expect(guardCardStatus(null, start)).toBe("missing"));
  it("expired when it expires before the shift", () => expect(guardCardStatus("2026-10-31 00:00:00", start)).toBe("expired"));
  it("expiring within 30 days", () => expect(guardCardStatus("2026-11-20 00:00:00", start)).toBe("expiring"));
  it("valid beyond 30 days", () => expect(guardCardStatus("2027-06-01 00:00:00", start)).toBe("valid"));
});
