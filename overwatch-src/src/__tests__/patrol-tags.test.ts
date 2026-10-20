import { describe, it, expect } from "vitest";
import { parseCheckpointPayload, checkpointUrl, verifyScanPosition, tourProgress } from "@/lib/patrol/checkpoint-code";

describe("checkpoint tags", () => {
  it("round-trips the printed URL and accepts raw codes", () => {
    const u = checkpointUrl("https://evenfalladvantage.com/", "CP-1A2B3C4D");
    expect(u).toBe("https://evenfalladvantage.com/overwatch/patrols/?cp=CP-1A2B3C4D");
    expect(parseCheckpointPayload(u)).toBe("CP-1A2B3C4D");
    expect(parseCheckpointPayload(" cp-1a2b3c4d ")).toBe("CP-1A2B3C4D");
    expect(parseCheckpointPayload("https://x.test/?q=1")).toBeNull();
    expect(parseCheckpointPayload("hello world")).toBeNull();
    expect(parseCheckpointPayload("")).toBeNull();
  });
  it("verifies scan position against the pinned spot", () => {
    const cp = { lat: 34.0522, lng: -118.2437 };
    expect(verifyScanPosition(cp, { lat: 34.0523, lng: -118.2437, accuracy: 5 })).toMatchObject({ verified: true });
    expect(verifyScanPosition(cp, { lat: 34.06, lng: -118.2437, accuracy: 5 }).verified).toBe(false);
    expect(verifyScanPosition({ location_lat: 34.0522, location_lng: -118.2437 }, { lat: 34.0522, lng: -118.2437 }).verified).toBe(true);
    expect(verifyScanPosition({}, { lat: 1, lng: 1 })).toEqual({ verified: null, distance: null });
    expect(verifyScanPosition(cp, null).verified).toBeNull();
  });
  it("tracks tour progress, next stop and out-of-order scans", () => {
    const cps = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];
    const since = new Date("2026-10-19T00:00:00Z");
    const logs = [
      { checkpoint_id: "c", scanned_at: "2026-10-19T10:00:00Z" },
      { checkpoint_id: "a", scanned_at: "2026-10-19T10:05:00Z" },
      { checkpoint_id: "b", scanned_at: "2026-10-18T10:00:00Z" },
    ];
    const t = tourProgress({ checkpoint_ids: ["a", "b", "c", "zz"] }, cps, logs, since);
    expect(t.total).toBe(3);
    expect(t.done).toBe(2);
    expect(t.nextId).toBe("b");
    expect(t.stops.find((s) => s.id === "c")?.outOfOrder).toBe(true);
  });
});
