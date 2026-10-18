/**
 * Integration check for aircraft interpolation: drive AircraftTrack the way
 * use-aircraft-layer does (feed poll every 15 s, render every 66 ms) against
 * a simulated "true" flight, and assert the drawn position glides — no snaps
 * on fix arrival, stays near the truth, and coasts/stops sanely on feed loss.
 */
import { describe, expect, it } from "vitest";
import { AircraftTrack, MAX_COAST_SEC, distanceM, type AircraftFix } from "@/lib/map/aircraft-motion";
import { fixTimeMs } from "@/components/tactical-map/hooks/use-aircraft-layer";

const POLL_MS = 15_000;   // use-aircraft-layer: setVisibleInterval(fetchOpenSky, 15000)
const FRAME_MS = 66;      // MOTION_FRAME_MS
const T0 = 1_792_000_000_000;

/**
 * Truth: analytic flight in a local east/north plane (independent of the code
 * under test) — straight at `speed` on `track`, then a constant-rate turn.
 */
const R_EARTH = 6_371_008.8;
function truth(tMs: number, opts: { speed: number; track: number; turnDegPerSec?: number; turnAtMs?: number }): AircraftFix {
  const { speed, track, turnDegPerSec = 0, turnAtMs = Infinity } = opts;
  const rad = Math.PI / 180;
  const tStraight = (Math.min(tMs, turnAtMs) - T0) / 1000;
  let e = speed * tStraight * Math.sin(track * rad);
  let n = speed * tStraight * Math.cos(track * rad);
  let hdg = track;
  if (tMs > turnAtMs && turnDegPerSec) {
    const w = turnDegPerSec * rad, tt = (tMs - turnAtMs) / 1000, h0 = track * rad;
    e += (speed / w) * (Math.cos(h0) - Math.cos(h0 + w * tt));
    n += (speed / w) * (Math.sin(h0 + w * tt) - Math.sin(h0));
    hdg = track + turnDegPerSec * tt;
  }
  const lat0 = 34, lng0 = -118;
  return {
    lat: lat0 + (n / R_EARTH) / rad,
    lng: lng0 + (e / (R_EARTH * Math.cos(lat0 * rad))) / rad,
    altM: 9_000, speedMps: speed, trackDeg: ((hdg % 360) + 360) % 360, vsMps: 0, tMs,
  };
}

/** Run the poll/render loop; feed fixes are `latencyMs` old when they arrive. */
function simulate(durationMs: number, opts: Parameters<typeof truth>[1], latencyMs = 2_000, dropFromMs = Infinity) {
  let track: AircraftTrack | null = null;
  let last: { lat: number; lng: number } | null = null;
  let maxStepM = 0, maxErrM = 0;
  const errs: number[] = [];
  for (let now = T0 + latencyMs; now <= T0 + durationMs; now += FRAME_MS) {
    const sincePoll = (now - T0 - latencyMs) % POLL_MS;
    if (sincePoll < FRAME_MS && now < T0 + dropFromMs) {
      const f = truth(now - latencyMs, opts);
      const fix = { ...f, tMs: fixTimeMs(Math.floor(f.tMs / 1000), now) };
      if (track) track.update(fix, now); else track = new AircraftTrack(fix);
    }
    if (!track) continue;
    const p = track.position(now);
    if (last) maxStepM = Math.max(maxStepM, distanceM(last, p));
    last = p;
    if (now < T0 + dropFromMs) {
      const err = distanceM(p, truth(now, opts));
      errs.push(err); maxErrM = Math.max(maxErrM, err);
    }
  }
  return { track: track!, maxStepM, maxErrM, meanErrM: errs.reduce((a, b) => a + b, 0) / errs.length, last: last! };
}

describe("aircraft interpolation (poll + render loop)", () => {
  it("glides a straight flight with no per-frame jumps and stays on the truth", () => {
    const speed = 230; // ~450 kt
    const r = simulate(5 * 60_000, { speed, track: 75 });
    // one frame of travel is ~15 m; allow 2x for blend easing, never a snap
    expect(r.maxStepM).toBeLessThan(speed * (FRAME_MS / 1000) * 2);
    // feed latency is compensated by dead reckoning from the fix time
    expect(r.maxErrM).toBeLessThan(400);
    expect(r.meanErrM).toBeLessThan(150);
  });

  it("absorbs a turn by blending, not snapping", () => {
    const speed = 120;
    const r = simulate(4 * 60_000, { speed, track: 0, turnDegPerSec: 3, turnAtMs: T0 + 60_000 });
    // A 3°/s turn makes dead reckoning drift up to ~900 m between 15 s fixes.
    // Drawn in one frame that is a visible snap; spread over the blend window
    // it stays well under 120 m per frame (one frame of travel is ~8 m).
    expect(r.maxStepM).toBeLessThan(120);
    expect(r.maxErrM).toBeLessThan(speed * POLL_MS / 1000); // never a full poll interval behind
  });

  it("coasts for at most MAX_COAST_SEC after the feed drops, then holds", () => {
    const speed = 200;
    const dropAt = 60_000;
    const r = simulate(dropAt + 5 * 60_000, { speed, track: 180 }, 2_000, dropAt);
    const lastFix = r.track.fix;
    const coast = distanceM(lastFix, r.last);
    expect(coast).toBeLessThanOrEqual(speed * MAX_COAST_SEC + 1);
    expect(coast).toBeGreaterThan(speed * MAX_COAST_SEC * 0.95);
    expect(r.track.isStale(T0 + dropAt + 5 * 60_000)).toBe(true);
  });

  it("treats implausible feed timestamps as 'now' (no projection into the future or far past)", () => {
    const now = T0;
    expect(fixTimeMs(0, now)).toBe(now);
    expect(fixTimeMs((now + 60_000) / 1000, now)).toBe(now);
    expect(fixTimeMs((now - 11 * 60_000) / 1000, now)).toBe(now);
    expect(fixTimeMs((now - 3_000) / 1000, now)).toBe(now - 3_000);
    expect(fixTimeMs(now - 3_000, now)).toBe(now - 3_000);
  });
});
