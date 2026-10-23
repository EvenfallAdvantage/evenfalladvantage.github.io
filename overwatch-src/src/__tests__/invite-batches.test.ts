import { describe, it, expect, vi } from "vitest";
import { chunk, runInviteBatches, INVITE_BATCH_SIZE, INVITE_RUN_CAP, type SendBatch } from "@/lib/roster/invite-batches";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);
const okAll: SendBatch = async (batch) => ({ ok: true, results: batch.map((id) => ({ membership_id: id, status: "sent" })) });

describe("invite batching", () => {
  it("chunks into fixed sizes", () => {
    expect(chunk(ids(60), 25).map((c) => c.length)).toEqual([25, 25, 10]);
    expect(() => chunk([1], 0)).toThrow();
  });

  it("sends batches of 25, reports progress, and caps a run", async () => {
    const send = vi.fn(okAll);
    const progress: number[] = [];
    const s = await runInviteBatches(ids(492), send, { onProgress: (p) => progress.push(p.processed) });
    expect(INVITE_BATCH_SIZE).toBe(25);
    expect(send).toHaveBeenCalledTimes(INVITE_RUN_CAP / 25);
    for (const c of send.mock.calls) expect(c[0].length).toBeLessThanOrEqual(25);
    expect(s.total).toBe(INVITE_RUN_CAP);
    expect(s.delivered).toBe(INVITE_RUN_CAP);
    expect(progress).toEqual([25, 50, 75, 100]);
    expect(s.remaining).toEqual([]);
  });

  it("collects per-member failures and missing results without stopping", async () => {
    const send: SendBatch = async (batch) => ({
      ok: true,
      results: batch.slice(1).map((id, i) => ({ membership_id: id, status: i === 0 ? "error" : i === 1 ? "skipped" : "notified", reason: i === 0 ? "bounce" : undefined })),
    });
    const s = await runInviteBatches(ids(30), send);
    expect(s.processed).toBe(30);
    expect(s.skipped).toBe(2);
    expect(s.failed.map((f) => f.reason)).toEqual(expect.arrayContaining(["bounce", "No result returned"]));
    expect(s.failed).toHaveLength(4);
  });

  it("stops on a transport failure and returns the unattempted ids for resume", async () => {
    let n = 0;
    const send: SendBatch = async (batch) => (++n === 2 ? { ok: false, error: "HTTP 546" } : okAll(batch));
    const s = await runInviteBatches(ids(70), send);
    expect(s.delivered).toBe(25);
    expect(s.stoppedError).toBe("HTTP 546");
    expect(s.remaining).toHaveLength(45);
    expect(s.remaining[0]).toBe("m25");
  });

  it("treats a thrown batch as a stop, not a crash", async () => {
    const s = await runInviteBatches(ids(5), async () => { throw new Error("network"); });
    expect(s.stoppedError).toBe("network");
    expect(s.remaining).toHaveLength(5);
  });
});
