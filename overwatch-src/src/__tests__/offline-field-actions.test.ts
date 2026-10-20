/**
 * Offline field actions: clock in/out, patrol scan and SOS queue with the
 * real tap time + client id, and replay idempotently.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/db", () => ({}));
vi.mock("@/lib/supabase/db-checkpoints", () => ({ logPatrolScan: vi.fn() }));
vi.mock("@/lib/supabase/db-timesheets", () => ({ clockIn: vi.fn(), clockOut: vi.fn() }));
vi.mock("@/lib/supabase/db-panic", () => ({ replayQueuedPanicAlert: vi.fn() }));

import { clockInOffline, clockOutOffline, logPatrolScanOffline, isPendingSync } from "@/lib/offline/with-offline";
import { drainQueue } from "@/lib/offline/sync";
import { enqueue, getAll, clear } from "@/lib/offline/queue";
import { _resetOfflineDb } from "@/lib/offline/db";
import { cachedRead, writeCache, readCache, clearFieldCache } from "@/lib/offline/cached-read";
import { clockIn, clockOut } from "@/lib/supabase/db-timesheets";
import { logPatrolScan } from "@/lib/supabase/db-checkpoints";
import { replayQueuedPanicAlert } from "@/lib/supabase/db-panic";

const store: Record<string, string> = {};
const setOnline = (v: boolean) => vi.stubGlobal("navigator", { onLine: v });

beforeEach(async () => {
  await _resetOfflineDb(); await clear();
  vi.mocked(clockIn).mockReset(); vi.mocked(clockOut).mockReset(); vi.mocked(logPatrolScan).mockReset(); vi.mocked(replayQueuedPanicAlert).mockReset();
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; }, key: (i: number) => Object.keys(store)[i] ?? null, get length() { return Object.keys(store).length; }, clear: () => {},
  });
  setOnline(true);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("offline clock in / out", () => {
  it("queues clock-in with the tap time and replays it later with the same time + id", async () => {
    setOnline(false);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-20T06:00:00Z"));
    const r = await clockInOffline({ companyId: "c1", clockInType: "shift", shiftId: "s1" });
    expect(isPendingSync(r)).toBe(true);
    expect(clockIn).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-20T08:30:00Z"));
    vi.useRealTimers(); setOnline(true);
    const res = await drainQueue();
    expect(res.succeeded).toBe(1);
    const arg = vi.mocked(clockIn).mock.calls[0][0]!;
    expect(arg.at).toBe("2026-10-20T06:00:00.000Z");
    expect(arg.id).toBe((r as { __mutationId: string }).__mutationId);
  });
  it("online clock-in/out sends no client time so the server stamps it and takes GPS", async () => {
    vi.mocked(clockIn).mockResolvedValueOnce({ id: "t1" } as never);
    await clockInOffline({ companyId: "c1" });
    const arg = vi.mocked(clockIn).mock.calls[0][0]!;
    expect(arg.at).toBeUndefined();
    expect(typeof arg.id).toBe("string");
    await clockOutOffline("t1");
    expect(vi.mocked(clockOut).mock.calls[0]).toEqual(["t1"]);
  });
  it("treats a duplicate-key replay as already delivered", async () => {
    setOnline(false);
    await clockInOffline({ companyId: "c1" });
    setOnline(true);
    vi.mocked(clockIn).mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }));
    const res = await drainQueue();
    expect(res).toMatchObject({ succeeded: 1, failed: 0 });
  });
  it("queues clock-out with the tap time", async () => {
    setOnline(false);
    await clockOutOffline("ts-1");
    setOnline(true);
    await drainQueue();
    expect(vi.mocked(clockOut).mock.calls[0][0]).toBe("ts-1");
    expect(typeof vi.mocked(clockOut).mock.calls[0][1]).toBe("string");
  });
  it("falls back to the queue when the live call fails with a network error", async () => {
    vi.mocked(logPatrolScan).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const r = await logPatrolScanOffline("c1", "cp1", { status: "ok" });
    expect(isPendingSync(r)).toBe(true);
    expect((await getAll())[0].kind).toBe("patrol.scan");
  });
});

describe("queued SOS", () => {
  it("replays panic.trigger through replayQueuedPanicAlert", async () => {
    await enqueue({ kind: "panic.trigger", payload: { id: "p1", companyId: "c1", userId: "u1", lat: 1, lng: 2, accuracy: 5, createdAt: "2026-10-20T06:00:00Z" } });
    await drainQueue();
    expect(replayQueuedPanicAlert).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", createdAt: "2026-10-20T06:00:00Z" }));
  });
});

describe("cachedRead", () => {
  it("serves the last good copy offline and when the live read throws", async () => {
    expect(await cachedRead("k", async () => [1, 2])).toEqual([1, 2]);
    setOnline(false);
    const live = vi.fn(async () => [9]);
    expect(await cachedRead("k", live)).toEqual([1, 2]);
    expect(live).not.toHaveBeenCalled();
    setOnline(true);
    expect(await cachedRead("k", async () => { throw new Error("x"); })).toEqual([1, 2]);
    writeCache("other", { a: 1 });
    clearFieldCache();
    expect(readCache("other")).toBeNull();
  });
});
