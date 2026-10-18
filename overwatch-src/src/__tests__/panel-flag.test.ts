import { describe, expect, it } from "vitest";
import { readPanelV2Choice, resolvePanelV2, writePanelV2Choice } from "@/lib/map/panel-flag";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("panel v2 flag", () => {
  it("is on by default", () => {
    expect(resolvePanelV2(null, null)).toBe(true);
  });
  it("company default applies when the user has not chosen", () => {
    expect(resolvePanelV2(null, false)).toBe(false);
  });
  it("the user's choice wins and is per user", () => {
    const s = mem();
    writePanelV2Choice(s, "u1", false);
    expect(readPanelV2Choice(s, "u1")).toBe(false);
    expect(readPanelV2Choice(s, "u2")).toBe(null);
    expect(resolvePanelV2(readPanelV2Choice(s, "u1"), true)).toBe(false);
    writePanelV2Choice(s, "u1", null);
    expect(readPanelV2Choice(s, "u1")).toBe(null);
  });
  it("survives missing storage", () => {
    expect(readPanelV2Choice(null, "u")).toBe(null);
    expect(() => writePanelV2Choice(undefined, "u", true)).not.toThrow();
  });
});
