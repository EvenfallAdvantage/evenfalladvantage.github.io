import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

import { logDbReadError } from "@/lib/supabase/db-error";

describe("logDbReadError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const origWindow = globalThis.window;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockToastError.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    // Restore original window state
    if (origWindow === undefined) {
      // @ts-expect-error - restoring undefined window
      delete globalThis.window;
    } else {
      globalThis.window = origWindow;
    }
  });

  it("calls console.error with [DB] prefix and context", () => {
    logDbReadError("members", new Error("timeout"));
    expect(consoleErrorSpy).toHaveBeenCalledWith("[DB] members:", "timeout");
  });

  it("converts non-Error values to string", () => {
    logDbReadError("incidents", "something broke");
    expect(consoleErrorSpy).toHaveBeenCalledWith("[DB] incidents:", "something broke");
  });

  it("converts object errors to string", () => {
    logDbReadError("shifts", { code: 42 });
    expect(consoleErrorSpy).toHaveBeenCalledWith("[DB] shifts:", "[object Object]");
  });

  it("does NOT call toast when window is undefined (SSR)", () => {
    // Ensure window is truly undefined (node env default)
    // @ts-expect-error - intentionally removing window for SSR test
    delete globalThis.window;

    logDbReadError("test-context", new Error("fail"));

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("DOES call toast when window is defined (browser)", () => {
    // Simulate browser: define window on globalThis
    // @ts-expect-error - simulating browser environment
    globalThis.window = {};

    logDbReadError("patrols", new Error("network error"));

    expect(mockToastError).toHaveBeenCalledWith(
      "Failed to load patrols",
      expect.objectContaining({
        description: "Please try refreshing the page.",
        duration: 5000,
      }),
    );
  });

  it("passes correct context in toast message", () => {
    // Simulate browser
    // @ts-expect-error - simulating browser environment
    globalThis.window = {};

    logDbReadError("timesheets", new Error("db down"));

    expect(mockToastError).toHaveBeenCalledTimes(1);
    const firstArg = mockToastError.mock.calls[0][0];
    expect(firstArg).toBe("Failed to load timesheets");
  });
});
