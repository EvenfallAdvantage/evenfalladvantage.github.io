import { describe, it, expect } from "vitest";
import { flapDelays, FLAP_MAX_TOTAL_MS, FLAP_CHAR_MS, FLAP_STAGGER_MS } from "@/components/tactical-map/split-flap";
import { overlayOf, setOverlay, MOBILE_OVERLAYS, CLASSIC_HIDDEN_KEYS } from "@/lib/map/layer-registry";
import { SCOPE_EFFECT, SONAR_EFFECT } from "@/components/tactical-map/effects";
import { DEFAULT_LAYERS } from "@/components/tactical-map/map-layers-panel";

describe("split-flap", () => {
  it("staggers short strings at the nominal step", () => { expect(flapDelays(3)).toEqual([0, FLAP_STAGGER_MS, 2 * FLAP_STAGGER_MS]); });
  it("compresses long strings to the cascade cap", () => {
    const d = flapDelays(60);
    expect(d[59] + FLAP_CHAR_MS).toBeLessThanOrEqual(FLAP_MAX_TOTAL_MS);
  });
  it("handles empty", () => { expect(flapDelays(0)).toEqual([]); });
});

describe("screen overlays", () => {
  it("is a single choice", () => {
    const base = { ...DEFAULT_LAYERS } as never;
    expect(overlayOf(base)).toBe("none");
    const s = setOverlay(base, "sonar");
    expect(overlayOf(s)).toBe("sonar");
    expect(overlayOf(setOverlay(s, "scope"))).toBe("scope");
    expect((setOverlay(s, "scope") as { sonarSweep: boolean }).sonarSweep).toBe(false);
  });
  it("keeps the animated sonar off phones and out of the classic panel", () => {
    expect(MOBILE_OVERLAYS).not.toContain("sonar");
    expect(CLASSIC_HIDDEN_KEYS).toContain("sonarSweep");
  });
  it("only the sonar animates", () => { expect(SONAR_EFFECT.animated).toBe(true); expect(SCOPE_EFFECT.animated).toBe(false); });
});
