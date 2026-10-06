// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setVisibleInterval } from "@/lib/visible-interval";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("setVisibleInterval", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks like setInterval while visible", () => {
    const fn = vi.fn();
    const stop = setVisibleInterval(fn, 1000);
    vi.advanceTimersByTime(3000);
    expect(fn).toHaveBeenCalledTimes(3);
    stop();
  });

  it("pauses while hidden and refreshes once on return", () => {
    const fn = vi.fn();
    const stop = setVisibleInterval(fn, 1000);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    expect(fn).toHaveBeenCalledTimes(2); // immediate catch-up
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(3);
    stop();
  });

  it("does not catch up when refreshOnVisible is false", () => {
    const fn = vi.fn();
    const stop = setVisibleInterval(fn, 1000, { refreshOnVisible: false });
    setVisibility("hidden");
    vi.advanceTimersByTime(5000);
    setVisibility("visible");
    expect(fn).not.toHaveBeenCalled();
    stop();
  });

  it("does not start when created in a hidden tab, starts when shown", () => {
    setVisibility("hidden");
    const fn = vi.fn();
    const stop = setVisibleInterval(fn, 1000, { refreshOnVisible: false });
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    setVisibility("visible");
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
  });

  it("cleanup stops ticking and removes the listener", () => {
    const fn = vi.fn();
    const stop = setVisibleInterval(fn, 1000);
    stop();
    vi.advanceTimersByTime(5000);
    setVisibility("hidden");
    setVisibility("visible");
    expect(fn).not.toHaveBeenCalled();
  });
});
