/**
 * Tests for the offline mutation queue. Uses fake-indexeddb to simulate
 * browser IndexedDB in the Node vitest environment.
 *
 * Each test calls `_resetOfflineDb()` so the openDB cached promise is
 * cleared between cases. We also delete the fake DB to ensure isolated
 * starts.
 */

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";

import {
  enqueue,
  getAll,
  getPending,
  getErrors,
  markDone,
  bumpAttempt,
  retry,
  remove,
  clear,
  clearDone,
} from "@/lib/offline/queue";
import { _resetOfflineDb, DB_NAME, openOfflineDb } from "@/lib/offline/db";

async function deleteDb() {
  // fake-indexeddb provides indexedDB on globalThis.
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve(); // proceed; another tab would have closed
    req.onerror = () => reject(req.error);
  });
}

beforeEach(async () => {
  await _resetOfflineDb();
  await deleteDb();
});

// ---------------------------------------------------------------------------
// enqueue + getAll + getPending
// ---------------------------------------------------------------------------

describe("enqueue()", () => {
  it("persists a row with status=pending and attempts=0 by default", async () => {
    const id = await enqueue({
      kind: "incident.create",
      payload: { title: "Sample" },
    });

    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id,
      kind: "incident.create",
      payload: { title: "Sample" },
      status: "pending",
      attempts: 0,
    });
    expect(all[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns a stable id that can be used to look the row up later", async () => {
    const id = await enqueue({
      kind: "task.create",
      payload: { title: "Patrol" },
    });
    const db = await openOfflineDb();
    const row = await db.get("mutations", id);
    expect(row?.kind).toBe("task.create");
  });

  it("accepts a caller-provided id (used by optimistic wrappers)", async () => {
    const id = await enqueue({
      id: "fixed-id-123",
      kind: "incident.create",
      payload: {},
    });
    expect(id).toBe("fixed-id-123");
  });

  it("can persist optional label and lastError fields", async () => {
    const id = await enqueue({
      kind: "incident.create",
      payload: {},
      label: "Patrol the perimeter",
    });
    const rows = await getAll();
    expect(rows.find((r) => r.id === id)?.label).toBe("Patrol the perimeter");
  });
});

// ---------------------------------------------------------------------------
// getPending - ordering + filtering
// ---------------------------------------------------------------------------

describe("getPending()", () => {
  it("returns rows in creation order (oldest first)", async () => {
    const first = await enqueue({
      kind: "incident.create",
      payload: { n: 1 },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const second = await enqueue({
      kind: "incident.create",
      payload: { n: 2 },
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    const pending = await getPending();
    expect(pending.map((r) => r.id)).toEqual([first, second]);
  });

  it("excludes done and error rows", async () => {
    const a = await enqueue({ kind: "incident.create", payload: {} });
    const b = await enqueue({ kind: "incident.create", payload: {} });
    await enqueue({ kind: "incident.create", payload: {} });

    await markDone(a);
    await bumpAttempt(b, "fail", 1); // single attempt -> immediately error

    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// markDone, bumpAttempt, retry, remove
// ---------------------------------------------------------------------------

describe("markDone()", () => {
  it("flips status from pending to done and clears lastError", async () => {
    const id = await enqueue({ kind: "incident.create", payload: {} });
    await bumpAttempt(id, "transient network error");
    await markDone(id);

    const row = (await getAll()).find((r) => r.id === id);
    expect(row?.status).toBe("done");
    expect(row?.lastError).toBeUndefined();
  });

  it("is a no-op for unknown ids", async () => {
    await markDone("does-not-exist");
    expect(await getAll()).toHaveLength(0);
  });
});

describe("bumpAttempt()", () => {
  it("increments attempts and stores lastError", async () => {
    const id = await enqueue({ kind: "incident.create", payload: {} });
    const after = await bumpAttempt(id, "fetch failed");
    expect(after?.attempts).toBe(1);
    expect(after?.lastError).toBe("fetch failed");
    expect(after?.status).toBe("pending");
  });

  it("marks as error after maxAttempts is reached", async () => {
    const id = await enqueue({ kind: "incident.create", payload: {} });
    let row;
    for (let i = 0; i < 5; i++) {
      row = await bumpAttempt(id, `fail ${i + 1}`);
    }
    expect(row?.attempts).toBe(5);
    expect(row?.status).toBe("error");
  });

  it("uses a custom maxAttempts when provided", async () => {
    const id = await enqueue({ kind: "incident.create", payload: {} });
    const r = await bumpAttempt(id, "fail", 1);
    expect(r?.status).toBe("error");
  });

  it("returns undefined for unknown ids", async () => {
    const r = await bumpAttempt("missing", "x");
    expect(r).toBeUndefined();
  });
});

describe("retry()", () => {
  it("resets an errored row back to pending with 0 attempts", async () => {
    const id = await enqueue({ kind: "incident.create", payload: {} });
    await bumpAttempt(id, "fail", 1); // immediately errors
    await retry(id);
    const row = (await getAll()).find((r) => r.id === id);
    expect(row?.status).toBe("pending");
    expect(row?.attempts).toBe(0);
    expect(row?.lastError).toBeUndefined();
  });
});

describe("remove()", () => {
  it("hard-deletes a single mutation by id", async () => {
    const id = await enqueue({ kind: "incident.create", payload: {} });
    await remove(id);
    expect(await getAll()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getErrors, clearDone, clear
// ---------------------------------------------------------------------------

describe("getErrors()", () => {
  it("returns only error-status rows", async () => {
    const a = await enqueue({ kind: "incident.create", payload: {} });
    const b = await enqueue({ kind: "incident.create", payload: {} });
    await enqueue({ kind: "incident.create", payload: {} });

    await bumpAttempt(a, "fail", 1);
    await markDone(b);

    const errs = await getErrors();
    expect(errs).toHaveLength(1);
    expect(errs[0].id).toBe(a);
  });
});

describe("clearDone()", () => {
  it("removes done rows older than the cutoff", async () => {
    const longAgo = await enqueue({
      kind: "incident.create",
      payload: {},
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    });
    const recent = await enqueue({
      kind: "incident.create",
      payload: {},
      createdAt: new Date().toISOString(),
    });
    await markDone(longAgo);
    await markDone(recent);

    const removed = await clearDone(24 * 60 * 60 * 1000);

    expect(removed).toBe(1);
    const rows = await getAll();
    expect(rows.map((r) => r.id)).toEqual([recent]);
  });

  it("leaves pending and error rows alone", async () => {
    const pending = await enqueue({ kind: "incident.create", payload: {} });
    const errored = await enqueue({ kind: "incident.create", payload: {} });
    await bumpAttempt(errored, "fail", 1);
    const removed = await clearDone();
    expect(removed).toBe(0);
    const all = await getAll();
    expect(all.map((r) => r.id).sort()).toEqual([pending, errored].sort());
  });
});

describe("clear()", () => {
  it("wipes everything", async () => {
    await enqueue({ kind: "incident.create", payload: {} });
    await enqueue({ kind: "task.create", payload: {} });
    await clear();
    expect(await getAll()).toHaveLength(0);
  });
});
