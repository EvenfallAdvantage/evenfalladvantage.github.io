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

describe("S2 popup date fields", () => {
  it("renders tipline DateOfEvent as a date, not a number, and merges it into When", () => {
    const html = buildS2Description({ lat: 0, lng: 0, layerId: tipline.id, properties: {
      OBJECTID: 5, EventType: "SMARMSAttack", DateOfEvent: 1745625600000, DateOfReport: 1746576000000, TimeOfEvent: null,
    } }, tipline);
    expect(html).not.toMatch(/1,745,625,600,000|1745625600000|1,746,576,000,000/);
    expect(html).toContain("When:");
    expect(html).not.toContain("date not reported");
    expect(html).not.toContain("Date Of Event:");
    expect(html).toMatch(/Date Of Report: .*2025/);
    expect(html).toMatch(/26/);
  });

  it("detects date-named epoch fields not in the known list", () => {
    const html = buildS2Description({ lat: 0, lng: 0, layerId: kinetic.id, properties: {
      OBJECTID: 9, Date: 1792281600000, LastUpdateDate: 1792300000123, FriendlyKilled: 4,
    } }, kinetic);
    expect(html).not.toMatch(/1,792,300,000,123/);
    expect(html).toMatch(/Last Update Date: .*\d{4}/);
    expect(html).toContain("<b>4</b>");
  });
});

describe("S2 tipline age limit", () => {
  it("applies a 30-day window on the event date and drops undated items", async () => {
    expect(tipline.defaultAgeHours).toBe(30 * 24);
    const now = Date.now();
    const fc = { features: [
      { geometry: { type: "Point", coordinates: [1, 2] }, properties: { OBJECTID: 1, DateOfEvent: now - 2 * 86_400_000 } },
      { geometry: { type: "Point", coordinates: [1, 2] }, properties: { OBJECTID: 2, DateOfEvent: 1745625600000 } },
      { geometry: { type: "Point", coordinates: [1, 2] }, properties: { OBJECTID: 3, DateOfEvent: null } },
    ] };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => fc })));
    const { fetchS2LayerFeatures } = await import("@/components/tactical-map/s2-underground");
    const out = await fetchS2LayerFeatures(tipline);
    expect(out.map(f => f.properties.OBJECTID)).toEqual([1]);
    const k = await fetchS2LayerFeatures(kinetic);
    expect(k).toHaveLength(3); // kinetic (field "Date") sees all as undated and keeps them
    expect(k[2].time?.source).toBe("first-seen");
  });
});
