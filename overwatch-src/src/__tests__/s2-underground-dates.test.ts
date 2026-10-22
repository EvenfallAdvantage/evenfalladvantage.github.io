import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  S2_LAYERS, parseLinkedPostDate, resolveSourceTime, resolveFeatureTime,
  formatResolvedTime, isDateOnlyMs, buildS2Description, recordFirstSeen,
} from "@/components/tactical-map/s2-underground";

const kinetic = S2_LAYERS.find(l => l.id === "s2-kinetic-30d")!;
const tipline = S2_LAYERS.find(l => l.id === "s2-tipline")!;

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

beforeEach(() => { vi.stubGlobal("localStorage", memStorage()); });

describe("S2 timestamps", () => {
  it("decodes X status IDs to the exact post time", () => {
    const d = parseLinkedPostDate("https://x.com/LAPDCentral/status/1932824534106906640");
    expect(d?.dateOnly).toBe(false);
    expect(new Date(d!.ms).toISOString().slice(0, 10)).toBe("2025-06-11");
  });

  it("reads /YYYY/MM/DD/ dates from news URLs", () => {
    const d = parseLinkedPostDate("https://www.azfamily.com/2026/02/06/least-1-trooper-shot/");
    expect(d).toEqual({ ms: Date.UTC(2026, 1, 6), dateOnly: true });
    expect(parseLinkedPostDate("https://apnews.com/article/thailand-crash")).toBeNull();
  });

  it("recognises tipline DateOfEvent and its time-of-day", () => {
    const t = resolveSourceTime({ DateOfEvent: 1681084800000, TimeOfEvent: "09:00:00", DateOfReport: 1746576000000 }, tipline);
    expect(t).toMatchObject({ source: "event", field: "DateOfEvent", dateOnly: true, timeOfDay: "09:00:00" });
  });

  it("does not shift midnight-UTC dates to the previous day", () => {
    expect(isDateOnlyMs(1792281600000)).toBe(true);
    expect(formatResolvedTime({ ms: 1792281600000, dateOnly: true })).toMatch(/18/);
  });

  it("falls back to the earliest linked post, then first seen", () => {
    const linked = resolveSourceTime({ Date: null, Research: "https://x.com/a/status/2012639414334480600", Research2: "https://x.com/b/status/2008964151910314356" }, kinetic);
    expect(linked?.source).toBe("linked-post");
    expect(linked?.field).toBe("Research2");

    const feat = { lat: 0, lng: 0, layerId: kinetic.id, properties: { OBJECTID: 428, Date: null } };
    const first = resolveFeatureTime(feat, kinetic, 1000);
    expect(first).toEqual({ ms: 1000, source: "first-seen", dateOnly: false });
    expect(resolveFeatureTime(feat, kinetic, 5000)?.ms).toBe(1000); // stable
    expect(recordFirstSeen("x:1", 7)).toBe(7);
  });

  it("labels fallbacks clearly in the popup", () => {
    const html = buildS2Description({ lat: 0, lng: 0, layerId: kinetic.id, properties: { OBJECTID: 1, Date: null, Research: "https://x.com/a/status/2012639414334480600" } }, kinetic);
    expect(html).toContain("Linked post dated:");
    const html2 = buildS2Description({ lat: 0, lng: 0, layerId: kinetic.id, properties: { OBJECTID: 2, Date: null } }, kinetic);
    expect(html2).toContain("First seen:");
    expect(html2).toContain("source gave no date");
  });
});
