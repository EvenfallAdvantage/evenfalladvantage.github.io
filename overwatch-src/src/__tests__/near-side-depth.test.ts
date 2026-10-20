import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  HORIZON_MARGIN,
  depthTestDisabledAt,
  horizonDepthDistance,
  nearSideDepthDistance,
  nearSideDepthProperty,
} from "@/lib/map/near-side-depth";

const R = 6_371_000;

type V3 = { x: number; y: number; z: number };
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3) => Math.sqrt(dot(a, a));
const onSphere = (latDeg: number, lngDeg: number, r = R): V3 => {
  const la = (latDeg * Math.PI) / 180, lo = (lngDeg * Math.PI) / 180;
  return { x: r * Math.cos(la) * Math.cos(lo), y: r * Math.cos(la) * Math.sin(lo), z: r * Math.sin(la) };
};
/** Geometric truth: a surface point is visible iff the camera is above its tangent plane. */
const visible = (p: V3, cam: V3) => dot(sub(cam, p), p) > 0;

// Tiny deterministic PRNG so the sweep is reproducible.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe("horizonDepthDistance", () => {
  it("matches the tangent-line distance to the horizon", () => {
    // 1.2 km up (city view): ~123.6 km to the horizon.
    expect(horizonDepthDistance(1200, R, 1)).toBeCloseTo(Math.sqrt(1200 * (2 * R + 1200)), 3);
    expect(horizonDepthDistance(1200, R, 1) / 1000).toBeGreaterThan(123);
    expect(horizonDepthDistance(1200, R, 1) / 1000).toBeLessThan(124);
    // Applies the safety margin by default.
    expect(horizonDepthDistance(20_000_000, R)).toBeCloseTo(horizonDepthDistance(20_000_000, R, 1) * HORIZON_MARGIN, 3);
  });

  it("keeps the depth test on (0) for invalid, zero or underground heights", () => {
    expect(horizonDepthDistance(0, R)).toBe(0);
    expect(horizonDepthDistance(-50, R)).toBe(0);
    expect(horizonDepthDistance(Number.NaN, R)).toBe(0);
    expect(horizonDepthDistance(1000, 0)).toBe(0);
    expect(horizonDepthDistance(Number.POSITIVE_INFINITY, R)).toBe(0);
  });

  it("is always finite, so it can never disable the depth test everywhere", () => {
    for (const h of [1, 100, 1e4, 1e6, 2e7, 1e9]) expect(Number.isFinite(horizonDepthDistance(h, R))).toBe(true);
  });
});

describe("far-side occlusion (sphere sweep)", () => {
  const heights = [300, 1200, 15_000, 400_000, 3_000_000, 12_000_000, 25_000_000];

  it("never disables the depth test for a point on the far side of the globe", () => {
    const rand = rng(42);
    for (const h of heights) {
      const cam = onSphere(rand() * 160 - 80, rand() * 360 - 180, R + h);
      for (let i = 0; i < 4000; i++) {
        const p = onSphere(Math.asin(rand() * 2 - 1) * (180 / Math.PI), rand() * 360 - 180);
        if (!visible(p, cam)) {
          expect(depthTestDisabledAt(len(sub(p, cam)), h, R)).toBe(false);
        }
      }
    }
  });

  it("keeps near-side markers on top (depth test disabled) away from the limb", () => {
    const rand = rng(7);
    for (const h of heights) {
      const cam = onSphere(10, 20, R + h);
      const camDir = { x: cam.x / len(cam), y: cam.y / len(cam), z: cam.z / len(cam) };
      // Angle from the sub-camera point to the horizon.
      const horizonAngle = Math.acos(R / (R + h));
      let checked = 0;
      for (let i = 0; i < 4000; i++) {
        const p = onSphere(Math.asin(rand() * 2 - 1) * (180 / Math.PI), rand() * 360 - 180);
        const angle = Math.acos(dot(p, camDir) / R);
        if (angle < horizonAngle * 0.8) {
          checked++;
          expect(depthTestDisabledAt(len(sub(p, cam)), h, R)).toBe(true);
        }
      }
      if (h >= 400_000) expect(checked).toBeGreaterThan(0);
    }
  });

  it("covers the old 'always on top' cases close in: a marker directly below the camera", () => {
    for (const h of [50, 1200, 10_000]) {
      expect(depthTestDisabledAt(h, h, R)).toBe(true);
      // ...and a marker 20 km away at city zoom
      expect(depthTestDisabledAt(20_000, 1200, R)).toBe(true);
    }
  });
});

// Minimal Cesium stand-in: a spherical "ellipsoid" and the bits the module uses.
function fakeCesium() {
  class Cartesian3 { constructor(public x = 0, public y = 0, public z = 0) {} static magnitude(p: V3) { return len(p); } }
  class CallbackProperty { constructor(public fn: () => number, public isConstant: boolean) {} getValue() { return this.fn(); } }
  const ellipsoid = {
    scaleToGeodeticSurface(p: V3, result: V3) { const k = R / len(p); result.x = p.x * k; result.y = p.y * k; result.z = p.z * k; return result; },
  };
  return { Cartesian3, CallbackProperty, Ellipsoid: { WGS84: ellipsoid }, SceneMode: { SCENE3D: 3, SCENE2D: 2, COLUMBUS_VIEW: 1, MORPHING: 0 } };
}
function fakeViewer(height: number, mode = 3) {
  const p = onSphere(40, -74, R + height);
  return { camera: { positionWC: p }, scene: { mode, globe: { ellipsoid: fakeCesium().Ellipsoid.WGS84 } } };
}

describe("nearSideDepthDistance / nearSideDepthProperty", () => {
  it("returns the horizon distance for the current camera height", () => {
    const C = fakeCesium();
    const v = fakeViewer(1200);
    expect(nearSideDepthDistance(v, C)).toBeCloseTo(horizonDepthDistance(1200, R), 0);
  });

  it("tracks the camera when it moves, and caches while it is still", () => {
    const C = fakeCesium();
    const v = fakeViewer(1200);
    const a = nearSideDepthDistance(v, C);
    expect(nearSideDepthDistance(v, C)).toBe(a);
    v.camera.positionWC = onSphere(40, -74, R + 5_000_000);
    expect(nearSideDepthDistance(v, C)).toBeCloseTo(horizonDepthDistance(5_000_000, R), 0);
  });

  it("has no far side to hide in 2D / Columbus view", () => {
    expect(nearSideDepthDistance(fakeViewer(1200, 2), fakeCesium())).toBe(Number.POSITIVE_INFINITY);
    expect(nearSideDepthDistance(fakeViewer(1200, 1), fakeCesium())).toBe(Number.POSITIVE_INFINITY);
  });

  it("falls back to a normal depth test without a camera", () => {
    expect(nearSideDepthDistance({}, fakeCesium())).toBe(0);
    expect(nearSideDepthDistance(undefined, fakeCesium())).toBe(0);
  });

  it("shares one live (non-constant) property per viewer", () => {
    const C = fakeCesium();
    const v = fakeViewer(1200);
    const p1 = nearSideDepthProperty(v, C);
    expect(nearSideDepthProperty(v, C)).toBe(p1);
    expect(p1.isConstant).toBe(false);
    expect(p1.getValue()).toBeCloseTo(horizonDepthDistance(1200, R), 0);
    v.camera.positionWC = onSphere(0, 0, R + 10_000_000);
    expect(p1.getValue()).toBeCloseTo(horizonDepthDistance(10_000_000, R), 0);
    expect(nearSideDepthProperty(fakeViewer(1200), C)).not.toBe(p1);
  });
});

describe("guard: no map marker may disable the depth test unconditionally", () => {
  const root = path.resolve(__dirname, "..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "__tests__" && e.name !== "node_modules") walk(p); }
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
    }
  };
  walk(root);

  it("scans the source tree", () => {
    expect(files.some((f) => f.endsWith(path.join("tactical-map", "hooks", "use-hazards-layer.ts")))).toBe(true);
  });

  it("covers the live ships layer (markers and labels use the near-side rule)", () => {
    const f = files.find((x) => x.endsWith(path.join("tactical-map", "hooks", "use-ships-layer.ts")));
    expect(f).toBeTruthy();
    const src = fs.readFileSync(f!, "utf8");
    // Ships are primitives (BillboardCollection/LabelCollection), which take a number, so the
    // shared per-camera nearSideDepthDistance() is assigned at creation and re-applied on preRender.
    expect((src.match(/disableDepthTestDistance\s*[:=]\s*nearSideDepth(Property|Distance)\(/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(src).toMatch(/preRender\.addEventListener/);
  });

  it("uses nearSideDepthProperty/nearSideDepthDistance instead of Infinity or a fixed distance", () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (f.endsWith(path.join("lib", "map", "near-side-depth.ts"))) continue;
      const lines = fs.readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        const m = line.match(/disableDepthTestDistance\s*[:=]\s*([^,}\n;]+)/);
        if (m && !/nearSideDepth(Property|Distance)\(/.test(m[1])) offenders.push(`${path.relative(root, f)}:${i + 1}: ${m[1].trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
