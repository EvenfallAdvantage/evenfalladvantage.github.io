import { describe, it, expect } from "vitest";
import { newDraft, quickTitle, quickDescription, defaultSeverity, saveDraft, loadDraft, clearDraft, hasContent, formatGps } from "@/lib/incidents/quick-draft";

class Mem implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe("quick incident draft", () => {
  it("defaults severity by type", () => {
    expect(defaultSeverity("fire")).toBe("critical");
    expect(defaultSeverity("medical")).toBe("high");
    expect(defaultSeverity("nope")).toBe("low");
  });
  it("builds title and description with time and GPS", () => {
    const d = { ...newDraft(new Date("2026-10-19T20:00:00Z")), type: "trespass", note: "Male climbed east fence\nleft on foot", lat: 34.05221, lng: -118.24371, accuracy: 8.4 };
    expect(quickTitle(d)).toBe("Trespass: Male climbed east fence");
    expect(quickTitle({ ...d, note: "" })).toBe("Trespass reported");
    expect(formatGps(d)).toBe("GPS 34.05221, -118.24371 (±8 m)");
    expect(quickDescription(d)).toContain("GPS 34.05221");
  });
  it("autosaves, restores and expires drafts", () => {
    const s = new Mem(); const now = Date.parse("2026-10-19T20:00:00Z");
    const d = { ...newDraft(new Date(now)), type: "theft" };
    saveDraft("c1", d, s);
    expect(loadDraft("c1", now + 1000, s)?.type).toBe("theft");
    expect(hasContent(loadDraft("c1", now, s))).toBe(true);
    expect(loadDraft("c1", now + 25 * 3600e3, s)).toBeNull();
    saveDraft("c1", d, s); clearDraft("c1", s);
    expect(loadDraft("c1", now, s)).toBeNull();
    expect(hasContent(newDraft())).toBe(false);
  });
});
