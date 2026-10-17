import { describe, it, expect } from "vitest";
import { cctvAckKey, hasCctvAck, recordCctvAck, gateCctvEnable, CCTV_ACK_VERSION } from "@/lib/map/cctv-ack";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("cctv-ack", () => {
  it("keys per user and version", () => {
    expect(cctvAckKey("u1")).toBe(`overwatch-cctv-ack-v${CCTV_ACK_VERSION}-u1`);
    expect(cctvAckKey(null)).toBe(`overwatch-cctv-ack-v${CCTV_ACK_VERSION}-anon`);
    expect(cctvAckKey("u1")).not.toBe(cctvAckKey("u2"));
  });

  it("records and reads an ack per user", () => {
    const s = mem();
    expect(hasCctvAck(s, "u1")).toBe(false);
    recordCctvAck(s, "u1", new Date("2026-10-17T16:00:00Z"));
    expect(hasCctvAck(s, "u1")).toBe(true);
    expect(hasCctvAck(s, "u2")).toBe(false);
    expect(s.m.get(cctvAckKey("u1"))).toBe("2026-10-17T16:00:00.000Z");
  });

  it("tolerates missing or throwing storage", () => {
    expect(hasCctvAck(null, "u1")).toBe(false);
    const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(hasCctvAck(bad, "u1")).toBe(false);
    expect(() => recordCctvAck(bad, "u1")).not.toThrow();
  });

  it("blocks first enable without ack", () => {
    const r = gateCctvEnable({ cctv: false, x: 1 }, { cctv: true, x: 2 }, false);
    expect(r.needsAck).toBe(true);
    expect(r.next).toEqual({ cctv: false, x: 2 });
  });

  it("allows enable with ack, and never blocks other transitions", () => {
    expect(gateCctvEnable({ cctv: false }, { cctv: true }, true)).toEqual({ next: { cctv: true }, needsAck: false });
    expect(gateCctvEnable({ cctv: true }, { cctv: true }, false).needsAck).toBe(false);
    expect(gateCctvEnable({ cctv: true }, { cctv: false }, false).needsAck).toBe(false);
    expect(gateCctvEnable({ cctv: false }, { cctv: false }, false).needsAck).toBe(false);
  });
});
