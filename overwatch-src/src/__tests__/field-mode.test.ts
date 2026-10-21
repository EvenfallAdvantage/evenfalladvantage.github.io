import { describe, it, expect, vi } from "vitest";
const store = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
const cls = new Set<string>();
vi.stubGlobal("document", { documentElement: { classList: { toggle: (c: string, on: boolean) => (on ? cls.add(c) : cls.delete(c)), add: (c: string) => cls.add(c) } } });
import { getFieldMode, setFieldMode, subscribeFieldMode, FIELD_MODE_BOOT, FIELD_MODE_CLASS } from "@/lib/field-mode";

describe("field mode", () => {
  it("persists, toggles the html class and notifies", () => {
    const cb = vi.fn(); const off = subscribeFieldMode(cb);
    expect(getFieldMode()).toBe(false);
    setFieldMode(true);
    expect(getFieldMode()).toBe(true); expect(cls.has(FIELD_MODE_CLASS)).toBe(true); expect(cb).toHaveBeenCalledTimes(1);
    setFieldMode(false); off(); setFieldMode(true);
    expect(cb).toHaveBeenCalledTimes(2);
  });
  it("boot snippet applies the class from storage", () => {
    cls.clear(); store.set("ow-field-mode", "1");
    new Function(FIELD_MODE_BOOT)();
    expect(cls.has(FIELD_MODE_CLASS)).toBe(true);
  });
});
