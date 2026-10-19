/**
 * Automatic performance governor for the Cesium map.
 *
 * Samples frame intervals only while the map is actively animating (camera
 * moving or a tracked target being followed). Under requestRenderMode an idle
 * map draws few frames on purpose, so idle gaps are never counted.
 *
 * Level 0 = full quality. Level 1 = 75 % resolution, bloom/sharpen off, fewer
 * 3D models. Level 2 = 50 % resolution, coarser terrain tiles, only the
 * tracked model. Steps down when the average is below 30 fps; steps back up
 * after sustained > 50 fps, with hysteresis so it doesn't oscillate.
 */
export const LOW_FPS = 30;
export const RECOVER_FPS = 50;
/** Evaluate after this many frames, or sooner once MIN_WINDOW_MS of frames are in (very slow GPUs). */
const WINDOW = 60;
const MIN_FRAMES = 5;
const MIN_WINDOW_MS = 2_000;
/** Longer gaps are pauses (tab hidden, camera settled between moves), not frames. */
const MAX_INTERVAL_MS = 1_000;
const DOWN_COOLDOWN_MS = 4_000;
const UP_COOLDOWN_MS = 20_000;
export const MAX_LEVEL = 2;

export const LEVEL_SETTINGS = [
  { resolutionScale: 1, effects: true, globeSse: null as number | null },
  { resolutionScale: 0.75, effects: false, globeSse: null as number | null },
  { resolutionScale: 0.5, effects: false, globeSse: 4 },
] as const;

export class PerfGovernor {
  level = 0;
  private samples: number[] = [];
  private lastChange = -Infinity;
  private pausedUntil = 0;

  /** Feed one frame interval. Returns the new level when it changes, else null. */
  sample(intervalMs: number, nowMs: number): number | null {
    if (nowMs < this.pausedUntil) return null;
    if (!(intervalMs > 0) || intervalMs > MAX_INTERVAL_MS) return null;
    this.samples.push(intervalMs);
    const sum = this.samples.reduce((a, b) => a + b, 0);
    if (this.samples.length < WINDOW && !(this.samples.length >= MIN_FRAMES && sum >= MIN_WINDOW_MS)) return null;
    const mean = sum / this.samples.length;
    this.samples = [];
    const fps = 1000 / mean;
    if (fps < LOW_FPS && this.level < MAX_LEVEL && nowMs - this.lastChange >= DOWN_COOLDOWN_MS) return this.set(this.level + 1, nowMs);
    if (fps > RECOVER_FPS && this.level > 0 && nowMs - this.lastChange >= UP_COOLDOWN_MS) return this.set(this.level - 1, nowMs);
    return null;
  }

  /** Reset to full quality and stop adjusting for `pauseMs` (user override). */
  reset(nowMs: number, pauseMs = 120_000): number {
    this.pausedUntil = nowMs + pauseMs;
    this.samples = [];
    return this.set(0, nowMs);
  }

  private set(level: number, nowMs: number): number {
    this.level = level;
    this.lastChange = nowMs;
    this.samples = [];
    return level;
  }
}
