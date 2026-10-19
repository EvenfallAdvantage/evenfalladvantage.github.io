import { describe, expect, it, vi } from "vitest";
import { fetchAircraftTrace, splitTraceSegments, type TracePoint } from "@/lib/map/aircraft-trace";
import { nearbyContacts, compass } from "@/lib/map/nearby-contacts";

vi.mock("@/lib/intel-client", () => ({ getAccessToken: async () => null }));

describe("splitTraceSegments", () => {
  it("breaks on long gaps and implausible jumps, drops 1-point segments", () => {
    const m = 60_000;
    const pts: TracePoint[] = [
      [0, 40, -74, 1000], [m, 40.01, -74, 1000], [2 * m, 40.02, -74, null],
      [30 * m, 40.1, -74, 0], // 28 min gap → new segment of 1 point (dropped)
      [60 * m, 41, -74, 0], [61 * m, 41.01, -74, 0],
      [62 * m, 45, -74, 0], [63 * m, 45.01, -74, 0], // 440 km jump
    ];
    const segs = splitTraceSegments(pts);
    expect(segs.map((s) => s.length)).toEqual([3, 2, 2]);
  });
});

describe("fetchAircraftTrace", () => {
  it("calls the proxy trace endpoint and filters bad points", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ points: [[1, 40, -74, 100], [2, 999, 0, 0], "x"] }) }) as unknown as Response);
    const r = await fetchAircraftTrace("A1B21F", { fetchImpl: fetchImpl as unknown as typeof fetch, token: "t", baseUrl: "https://x.supabase.co" });
    expect(r.points).toEqual([[1, 40, -74, 100]]);
    const [url, init] = (fetchImpl.mock.calls as unknown as [string, RequestInit][])[0];
    expect(url).toBe("https://x.supabase.co/functions/v1/opensky-proxy?trace=a1b21f");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
  });
  it("degrades gracefully", async () => {
    expect((await fetchAircraftTrace("nope", {})).points).toEqual([]);
    const r = await fetchAircraftTrace("a1b21f", { fetchImpl: (async () => ({ ok: false, status: 400 })) as unknown as typeof fetch, token: null, baseUrl: "" });
    expect(r).toEqual({ points: [], error: "history unavailable (400)" });
    const r2 = await fetchAircraftTrace("a1b21f", { fetchImpl: (async () => { throw new Error("x"); }) as unknown as typeof fetch, token: null, baseUrl: "" });
    expect(r2.points).toEqual([]);
  });
});

describe("nearbyContacts", () => {
  const base = { callsign: "", altitude: 3000 };
  const list = [
    { ...base, icao24: "aaa111", lat: 40.5, lng: -74 },   // ~55 km N
    { ...base, icao24: "bbb222", lat: 40.1, lng: -74 },   // ~11 km N
    { ...base, icao24: "ccc333", lat: 44, lng: -74 },     // ~445 km, out
    { ...base, icao24: "ddd444", lat: 40, lng: -73, emergency: true }, // ~85 km E, emergency first
    { ...base, icao24: "self00", lat: 40, lng: -74 },
  ];
  it("filters to 250 km, excludes self, sorts emergencies then distance", () => {
    const r = nearbyContacts({ lat: 40, lng: -74 }, list, "self00");
    expect(r.map((c) => c.item.icao24)).toEqual(["ddd444", "bbb222", "aaa111"]);
    expect(compass(r[1].bearingDeg)).toBe("N");
    expect(compass(r[0].bearingDeg)).toBe("E");
  });
});
