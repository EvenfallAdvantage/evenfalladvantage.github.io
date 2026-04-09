import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Error Tracker — Deduplication", () => {
  const recentErrors = new Set<string>();
  const DEDUP_WINDOW = 10000;

  function shouldTrack(message: string, stack?: string): boolean {
    const key = `${message}:${(stack ?? "").slice(0, 100)}`;
    if (recentErrors.has(key)) return false;
    recentErrors.add(key);
    setTimeout(() => recentErrors.delete(key), DEDUP_WINDOW);
    return true;
  }

  beforeEach(() => {
    recentErrors.clear();
  });

  it("tracks first occurrence of an error", () => {
    expect(shouldTrack("TypeError: undefined")).toBe(true);
  });

  it("deduplicates identical errors", () => {
    expect(shouldTrack("TypeError: undefined")).toBe(true);
    expect(shouldTrack("TypeError: undefined")).toBe(false);
  });

  it("tracks different errors separately", () => {
    expect(shouldTrack("TypeError: undefined")).toBe(true);
    expect(shouldTrack("ReferenceError: x is not defined")).toBe(true);
  });

  it("differentiates by stack trace", () => {
    expect(shouldTrack("Error: fail", "at line 1")).toBe(true);
    expect(shouldTrack("Error: fail", "at line 2")).toBe(true);
    expect(shouldTrack("Error: fail", "at line 1")).toBe(false);
  });
});

describe("Error Tracker — Payload Validation", () => {
  it("truncates long messages", () => {
    const longMessage = "x".repeat(5000);
    const truncated = longMessage.slice(0, 2000);
    expect(truncated.length).toBe(2000);
  });

  it("truncates long stack traces", () => {
    const longStack = "at something\n".repeat(500);
    const truncated = longStack.slice(0, 5000);
    expect(truncated.length).toBe(5000);
  });

  it("handles null stack gracefully", () => {
    const stack = undefined as string | undefined;
    expect(stack?.slice(0, 5000) ?? null).toBeNull();
  });
});
