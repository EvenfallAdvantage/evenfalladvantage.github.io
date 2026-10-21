import { describe, expect, it } from "vitest";
import { healthUrl, toSnapshot } from "@/lib/status/health";

describe("status/health", () => {
  it("builds the function URL", () => expect(healthUrl("https://x.supabase.co/")).toBe("https://x.supabase.co/functions/v1/health"));
  it("maps checks to rows", () => {
    const s = toSnapshot({ status: "degraded", checks: { database: { ok: true, ms: 12 }, auth: { ok: false, ms: 5000 }, storage: { ok: true, ms: 40 } }, checked_at: "2026-10-21T22:00:00Z" });
    expect(s.status).toBe("degraded");
    expect(s.components.map((c) => [c.key, c.ok])).toEqual([["website", true], ["database", true], ["auth", false], ["storage", true]]);
  });
  it("unknown when the function is unreachable", () => {
    const s = toSnapshot(null);
    expect(s.status).toBe("unknown");
    expect(s.components.find((c) => c.key === "database")?.ok).toBeNull();
  });
});
