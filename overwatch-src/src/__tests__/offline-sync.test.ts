/**
 * Tests for the offline sync engine.
 *
 * Strategy: stub every `db-*` function on `@/lib/supabase/db` so we can
 * verify the dispatcher routes by `kind`, succeeds-then-marks-done,
 * fails-then-bumps-attempt, and finally promotes to `error` after maxAttempts.
 */

import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/db", () => {
  return {
    createIncident: vi.fn(),
    createIncidentEnhanced: vi.fn(),
    updateIncident: vi.fn(),
    setIncidentStatus: vi.fn(),
    transferIncident: vi.fn(),
    addIncidentUpdate: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    setTaskStatus: vi.fn(),
    transferTask: vi.fn(),
    addTaskComment: vi.fn(),
    addChecklistItem: vi.fn(),
    toggleChecklistItem: vi.fn(),
    submitPublicReport: vi.fn(),
  };
});

import { drainQueue } from "@/lib/offline/sync";
import { enqueue, getAll, getPending, clear } from "@/lib/offline/queue";
import { _resetOfflineDb, DB_NAME } from "@/lib/offline/db";
import * as db from "@/lib/supabase/db";

const mocked = {
  createIncident: vi.mocked(db.createIncident),
  createIncidentEnhanced: vi.mocked(db.createIncidentEnhanced),
  updateIncident: vi.mocked(db.updateIncident),
  setIncidentStatus: vi.mocked(db.setIncidentStatus),
  transferIncident: vi.mocked(db.transferIncident),
  addIncidentUpdate: vi.mocked(db.addIncidentUpdate),
  createTask: vi.mocked(db.createTask),
  updateTask: vi.mocked(db.updateTask),
  setTaskStatus: vi.mocked(db.setTaskStatus),
  transferTask: vi.mocked(db.transferTask),
  addTaskComment: vi.mocked(db.addTaskComment),
  addChecklistItem: vi.mocked(db.addChecklistItem),
  toggleChecklistItem: vi.mocked(db.toggleChecklistItem),
  submitPublicReport: vi.mocked(db.submitPublicReport),
};

async function deleteDb() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await _resetOfflineDb();
  await deleteDb();
});

// ---------------------------------------------------------------------------
// Dispatch routing - one test per kind
// ---------------------------------------------------------------------------

describe("drainQueue() dispatch routing", () => {
  it("dispatches incident.create (legacy)", async () => {
    mocked.createIncident.mockResolvedValueOnce({});
    await enqueue({
      kind: "incident.create",
      payload: { companyId: "c1", params: { title: "x" } },
    });
    const r = await drainQueue();
    expect(mocked.createIncident).toHaveBeenCalledWith("c1", { title: "x" });
    expect(r.succeeded).toBe(1);
  });

  it("dispatches incident.create (enhanced flavor)", async () => {
    mocked.createIncidentEnhanced.mockResolvedValueOnce({});
    await enqueue({
      kind: "incident.create",
      payload: { companyId: "c1", params: { title: "x" }, enhanced: true },
    });
    await drainQueue();
    expect(mocked.createIncidentEnhanced).toHaveBeenCalled();
    expect(mocked.createIncident).not.toHaveBeenCalled();
  });

  it("dispatches incident.update", async () => {
    mocked.updateIncident.mockResolvedValueOnce({});
    await enqueue({
      kind: "incident.update",
      payload: { incidentId: "i1", updates: { title: "new" } },
    });
    await drainQueue();
    expect(mocked.updateIncident).toHaveBeenCalledWith("i1", { title: "new" });
  });

  it("dispatches incident.status", async () => {
    mocked.setIncidentStatus.mockResolvedValueOnce({});
    await enqueue({
      kind: "incident.status",
      payload: { incidentId: "i1", status: "resolved" },
    });
    await drainQueue();
    expect(mocked.setIncidentStatus).toHaveBeenCalledWith("i1", "resolved");
  });

  it("dispatches incident.transfer with options", async () => {
    mocked.transferIncident.mockResolvedValueOnce({});
    await enqueue({
      kind: "incident.transfer",
      payload: {
        incidentId: "i1",
        toTeamId: "t1",
        options: { fromTeamName: "Alpha", toTeamName: "Bravo" },
      },
    });
    await drainQueue();
    expect(mocked.transferIncident).toHaveBeenCalledWith("i1", "t1", {
      fromTeamName: "Alpha",
      toTeamName: "Bravo",
    });
  });

  it("dispatches incident.comment", async () => {
    mocked.addIncidentUpdate.mockResolvedValueOnce({});
    await enqueue({
      kind: "incident.comment",
      payload: { incidentId: "i1", content: "Hello", type: "note" },
    });
    await drainQueue();
    expect(mocked.addIncidentUpdate).toHaveBeenCalledWith("i1", "Hello", "note");
  });

  it("dispatches task.create", async () => {
    mocked.createTask.mockResolvedValueOnce(null);
    await enqueue({
      kind: "task.create",
      payload: { companyId: "c1", params: { title: "patrol" } },
    });
    await drainQueue();
    expect(mocked.createTask).toHaveBeenCalledWith("c1", { title: "patrol" });
  });

  it("dispatches task.update", async () => {
    mocked.updateTask.mockResolvedValueOnce(null);
    await enqueue({
      kind: "task.update",
      payload: { taskId: "t1", updates: { title: "new" } },
    });
    await drainQueue();
    expect(mocked.updateTask).toHaveBeenCalledWith("t1", { title: "new" });
  });

  it("dispatches task.status", async () => {
    mocked.setTaskStatus.mockResolvedValueOnce(null);
    await enqueue({
      kind: "task.status",
      payload: { taskId: "t1", status: "done" },
    });
    await drainQueue();
    expect(mocked.setTaskStatus).toHaveBeenCalledWith("t1", "done");
  });

  it("dispatches task.transfer", async () => {
    mocked.transferTask.mockResolvedValueOnce(null);
    await enqueue({
      kind: "task.transfer",
      payload: { taskId: "t1", toTeamId: null },
    });
    await drainQueue();
    expect(mocked.transferTask).toHaveBeenCalledWith("t1", null, undefined);
  });

  it("dispatches task.comment", async () => {
    mocked.addTaskComment.mockResolvedValueOnce(null);
    await enqueue({
      kind: "task.comment",
      payload: { taskId: "t1", content: "hi", type: "note" },
    });
    await drainQueue();
    expect(mocked.addTaskComment).toHaveBeenCalledWith("t1", "hi", "note");
  });

  it("dispatches task.checklist.add", async () => {
    mocked.addChecklistItem.mockResolvedValueOnce(null);
    await enqueue({
      kind: "task.checklist.add",
      payload: { taskId: "t1", content: "step 1", sortOrder: 0 },
    });
    await drainQueue();
    expect(mocked.addChecklistItem).toHaveBeenCalledWith("t1", "step 1", 0);
  });

  it("dispatches task.checklist.toggle", async () => {
    mocked.toggleChecklistItem.mockResolvedValueOnce(true);
    await enqueue({
      kind: "task.checklist.toggle",
      payload: { itemId: "c1", isDone: true },
    });
    await drainQueue();
    expect(mocked.toggleChecklistItem).toHaveBeenCalledWith("c1", true);
  });

  it("dispatches public_report.submit", async () => {
    mocked.submitPublicReport.mockResolvedValueOnce(null);
    await enqueue({
      kind: "public_report.submit",
      payload: {
        linkId: "l1",
        companyId: "c1",
        payload: { body: "anon report" },
      },
    });
    await drainQueue();
    expect(mocked.submitPublicReport).toHaveBeenCalledWith("l1", "c1", { body: "anon report" });
  });
});

// ---------------------------------------------------------------------------
// Result counts + retry behavior
// ---------------------------------------------------------------------------

describe("drainQueue() result counts", () => {
  it("returns succeeded=N when every dispatch resolves", async () => {
    mocked.createIncident.mockResolvedValue({});
    await enqueue({ kind: "incident.create", payload: { companyId: "c1", params: {} } });
    await enqueue({ kind: "incident.create", payload: { companyId: "c1", params: {} } });
    const r = await drainQueue();
    expect(r).toEqual({ attempted: 2, succeeded: 2, failed: 0, errored: 0 });
  });

  it("returns failed=1 on a single retryable failure", async () => {
    mocked.createIncident.mockRejectedValueOnce(new Error("transient"));
    await enqueue({ kind: "incident.create", payload: { companyId: "c1", params: {} } });
    const r = await drainQueue();
    expect(r).toEqual({ attempted: 1, succeeded: 0, failed: 1, errored: 0 });
    // Row should still be pending with attempts=1.
    const all = await getAll();
    expect(all[0].status).toBe("pending");
    expect(all[0].attempts).toBe(1);
    expect(all[0].lastError).toBe("transient");
  });

  it("promotes a row to error after maxAttempts and counts it as errored", async () => {
    mocked.createIncident.mockRejectedValue(new Error("permanent"));
    await enqueue({ kind: "incident.create", payload: { companyId: "c1", params: {} } });

    // Drain three times with maxAttempts=2 -> 1st: failed, 2nd: errored.
    const r1 = await drainQueue({ maxAttempts: 2 });
    expect(r1).toEqual({ attempted: 1, succeeded: 0, failed: 1, errored: 0 });
    const r2 = await drainQueue({ maxAttempts: 2 });
    expect(r2).toEqual({ attempted: 1, succeeded: 0, failed: 0, errored: 1 });

    // Third drain finds nothing pending - errored rows are not retried.
    const pending = await getPending();
    expect(pending).toHaveLength(0);
  });

  it("processes mixed kinds in createdAt order", async () => {
    mocked.createIncident.mockResolvedValueOnce({});
    mocked.updateIncident.mockResolvedValueOnce({});
    await enqueue({
      kind: "incident.create",
      payload: { companyId: "c1", params: {} },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await enqueue({
      kind: "incident.update",
      payload: { incidentId: "i1", updates: {} },
      createdAt: "2026-01-01T00:00:01.000Z",
    });

    const r = await drainQueue();
    expect(r.succeeded).toBe(2);
    // createIncident should have been called first.
    expect(mocked.createIncident.mock.invocationCallOrder[0]).toBeLessThan(
      mocked.updateIncident.mock.invocationCallOrder[0],
    );
  });

  it("aborts when signal is triggered before next dispatch", async () => {
    mocked.createIncident.mockResolvedValue({});
    await enqueue({ kind: "incident.create", payload: { companyId: "c1", params: {} } });
    await enqueue({ kind: "incident.create", payload: { companyId: "c1", params: {} } });

    const ctrl = new AbortController();
    ctrl.abort();
    const r = await drainQueue({ signal: ctrl.signal });
    expect(r.attempted).toBe(0);
    expect(mocked.createIncident).not.toHaveBeenCalled();
  });
});

describe("drainQueue() integration", () => {
  it("removes nothing for an empty queue and returns zeros", async () => {
    await clear();
    const r = await drainQueue();
    expect(r).toEqual({ attempted: 0, succeeded: 0, failed: 0, errored: 0 });
  });
});
