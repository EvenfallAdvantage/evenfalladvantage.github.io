import { describe, expect, it, vi } from "vitest";
import { createGeocoder, MIN_INTERVAL_MS, normalizeNominatim, normalizePhoton } from "@/lib/map/geocode";

const photonBody = { features: [
  { geometry: { coordinates: [-73.9855, 40.758] }, properties: { name: "Times Square", city: "New York", state: "New York", country: "United States", extent: [-73.99, 40.76, -73.98, 40.75] } },
  { geometry: {}, properties: { name: "broken" } },
] };
const nomBody = [{ lat: "48.8584", lon: "2.2945", display_name: "Eiffel Tower, Paris, France", name: "Eiffel Tower", boundingbox: ["48.857", "48.859", "2.293", "2.296"] }];
const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as Response;

describe("geocode normalizers", () => {
  it("normalizes Photon features and extents to [s,w,n,e]", () => {
    const r = normalizePhoton(photonBody);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ label: "Times Square", lat: 40.758, lng: -73.9855, source: "photon", bbox: [40.75, -73.99, 40.76, -73.98] });
    expect(r[0].detail).toContain("New York");
  });
  it("normalizes Nominatim rows", () => {
    expect(normalizeNominatim(nomBody)[0]).toMatchObject({ label: "Eiffel Tower", detail: "Paris, France", lat: 48.8584, lng: 2.2945, bbox: [48.857, 2.293, 48.859, 2.296] });
    expect(normalizeNominatim({})).toEqual([]);
  });
});

describe("createGeocoder", () => {
  it("throttles upstream calls to one per second and caches", async () => {
    let t = 0;
    const waits: number[] = [];
    const fetchImpl = vi.fn(async () => ok(photonBody));
    const g = createGeocoder({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; } });
    await g.search("times square");
    await g.search("Times Square"); // cache hit
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await g.search("central park");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([MIN_INTERVAL_MS]);
    const url = String((fetchImpl.mock.calls as unknown as [string][])[0][0]);
    expect(url).toMatch(/^https:\/\/photon\.komoot\.io\/api\/\?q=times%20square&limit=5/);
  });
  it("falls back to Nominatim when Photon fails or is empty", async () => {
    let t = 0;
    const fetchImpl = vi.fn(async (url: string) => (url.includes("photon") ? ({ ok: false, status: 503 } as Response) : ok(nomBody)));
    const g = createGeocoder({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => t, sleep: async (ms) => { t += ms; } });
    const { results, error } = await g.search("eiffel tower");
    expect(results[0].source).toBe("nominatim");
    expect(error).toBeUndefined();
    expect(String((fetchImpl.mock.calls as unknown as [string][])[1][0])).toContain("nominatim.openstreetmap.org/search?q=eiffel%20tower&format=jsonv2&limit=5");
  });
  it("reports an error when both providers fail, and ignores tiny queries", async () => {
    const g = createGeocoder({ fetchImpl: (async () => { throw new Error("down"); }) as unknown as typeof fetch, sleep: async () => {} });
    expect((await g.search("x")).results).toEqual([]);
    const r = await g.search("somewhere");
    expect(r.results).toEqual([]);
    expect(r.error).toMatch(/unavailable/);
  });
});
