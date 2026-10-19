import { describe, expect, it } from "vitest";
import { PerfGovernor } from "@/lib/map/perf-governor";
import { classifyAircraft } from "@/lib/map/aircraft-class";
import { CLASS_MODEL, modelHeadingDeg, selectModelIds } from "@/lib/map/contact-models";

function feed(g: PerfGovernor, ms: number, n: number, t0: number) {
  let t = t0; let last: number | null = null;
  for (let i = 0; i < n; i++) { t += ms; const r = g.sample(ms, t); if (r != null) last = r; }
  return { t, last };
}

describe("PerfGovernor", () => {
  it("steps down below 30 fps with a cooldown, and never past level 2", () => {
    const g = new PerfGovernor();
    let { t, last } = feed(g, 50, 60, 0); // 20 fps
    expect(last).toBe(1);
    ({ t, last } = feed(g, 50, 30, t)); // within the 4 s cooldown → no change
    expect(g.level).toBe(1);
    ({ t } = feed(g, 50, 120, t + 5000));
    expect(g.level).toBe(2);
    feed(g, 50, 240, t + 10_000);
    expect(g.level).toBe(2);
  });
  it("ignores idle gaps and recovers only after sustained high fps", () => {
    const g = new PerfGovernor();
    feed(g, 1500, 300, 0); // idle requestRenderMode gaps → ignored
    expect(g.level).toBe(0);
    const { t } = feed(g, 40, 60, 0);
    expect(g.level).toBe(1);
    feed(g, 16, 60, t + 1000); // too soon
    expect(g.level).toBe(1);
    feed(g, 16, 60, t + 25_000);
    expect(g.level).toBe(0);
  });
  it("reacts within ~2 s on very slow GPUs (2-3 fps)", () => {
    const g = new PerfGovernor();
    feed(g, 400, 5, 0);
    expect(g.level).toBe(1);
  });
  it("reset restores full quality and pauses adjustments", () => {
    const g = new PerfGovernor();
    const { t } = feed(g, 50, 60, 0);
    expect(g.reset(t)).toBe(0);
    feed(g, 50, 120, t);
    expect(g.level).toBe(0);
  });
});

describe("aircraft class → model", () => {
  it("classifies common type designators", () => {
    expect(classifyAircraft({ typeCode: "C172" })).toBe("light");
    expect(classifyAircraft({ typeCode: "B738" })).toBe("airliner");
    expect(classifyAircraft({ typeCode: "AT76" })).toBe("turboprop");
    expect(classifyAircraft({ typeCode: "B06" })).toBe("helicopter");
    expect(classifyAircraft({ typeCode: "B789" })).toBe("widebody");
    expect(classifyAircraft({})).toBe("airliner");
    expect(CLASS_MODEL[classifyAircraft({ typeCode: "C172" })]).toBe("c172.glb");
  });
  it("offsets heading by 180° (model nose is −X)", () => {
    expect(modelHeadingDeg(0)).toBe(180);
    expect(modelHeadingDeg(270)).toBe(90);
  });
});

describe("selectModelIds", () => {
  const cam = { lat: 40, lng: -74, heightM: 5000 };
  const items = Array.from({ length: 40 }, (_, i) => ({ id: `plane-${i}`, lat: 40 + i * 0.01, lng: -74, altM: 5000 }));
  it("picks nearest within range, capped by governor level, tracked first", () => {
    const full = selectModelIds(cam, items, "plane-39", 0);
    expect(full[0]).toBe("plane-39");
    expect(full.length).toBe(24);
    expect(full[1]).toBe("plane-0");
    expect(selectModelIds(cam, items, null, 1)).toHaveLength(8);
    expect(selectModelIds(cam, items, "plane-5", 2)).toEqual(["plane-5"]);
  });
  it("only the tracked model when the camera is high", () => {
    expect(selectModelIds({ ...cam, heightM: 200_000 }, items, "plane-3")).toEqual(["plane-3"]);
    expect(selectModelIds({ ...cam, heightM: 200_000 }, items, null)).toEqual([]);
  });
});
