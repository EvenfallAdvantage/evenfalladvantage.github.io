import { describe, it, expect } from "vitest";
import { sha256Hex, hashesMatch, captureMetaFor, shortHash } from "@/lib/evidence/integrity";

describe("evidence integrity", () => {
  it("hashes like sha256sum", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("compares hashes case-insensitively and rejects empties", () => {
    expect(hashesMatch("ABC", "abc")).toBe(true);
    expect(hashesMatch(null, "abc")).toBe(false);
    expect(hashesMatch("abc", "abd")).toBe(false);
  });
  it("stamps camera captures with now + GPS, library files with their own time and no GPS", () => {
    const f = new File(["x"], "a.jpg", { lastModified: Date.parse("2026-10-01T00:00:00Z") });
    const now = Date.parse("2026-10-19T20:00:00Z"); const fix = { lat: 1, lng: 2, accuracy: 3 };
    expect(captureMetaFor(f, "camera", fix, now)).toEqual({ capturedAt: "2026-10-19T20:00:00.000Z", lat: 1, lng: 2, accuracy: 3, source: "camera" });
    expect(captureMetaFor(f, "library", fix, now)).toMatchObject({ capturedAt: "2026-10-01T00:00:00.000Z", lat: null, source: "library" });
    expect(shortHash(null)).toBe("no hash");
  });
});
