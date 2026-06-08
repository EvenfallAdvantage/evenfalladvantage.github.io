// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useOnline } from "@/hooks/use-online";

describe("useOnline()", () => {
  it("returns navigator.onLine on first render", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
  });

  it("flips to false when the offline event fires", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
  });

  it("flips back to true when the online event fires", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("removes listeners on unmount (no setState after teardown)", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnline());
    unmount();
    // Both listeners should have been removed.
    const calls = removeSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain("online");
    expect(calls).toContain("offline");
    removeSpy.mockRestore();
  });
});
