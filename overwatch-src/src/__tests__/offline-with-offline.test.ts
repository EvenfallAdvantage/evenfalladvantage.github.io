/**
 * Tests for the optimistic write wrappers.
 *
 * Strategy: mock both `@/lib/supabase/db` and the queue helpers. Control
 * `navigator.onLine` to flip offline/online and verify the right path
 * fires.
 */

import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/db", () => ({
  createIncident: vi.fn(),
  updateIncident: vi.fn(),
  setIncidentStatus: vi.fn(),
  addIncidentUpdate: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  setTaskStatus: vi.fn(),
  addTaskComment: vi.fn(),
  submitPublicReport: vi.fn(),
}));

import {
  createIncidentOffline,
  updateIncidentOffline,
  setIncidentStatusOffline,
  addIncidentUpdateOffline,
  createTaskOffline,
  updateTaskOffline,
  setTaskStatusOffline,
  addTaskCommentOffline,
  submitPublicReportOffline,
  isPendingSync,
} from "@/lib/offline/with-offline";
import * as db from "@/lib/supabase/db";
import { getAll, clear } from "@/lib/offline/queue";
import { _resetOfflineDb, DB_NAME } from "@/lib/offline/db";

const mocked = {
  createIncident: vi.mocked(db.createIncident),
  updateIncident: vi.mocked(db.updateIncident),
  setIncidentStatus: vi.mocked(db.setIncidentStatus),
  addIncidentUpdate: vi.mocked(db.addIncidentUpdate),
  createTask: vi.mocked(db.createTask),
  updateTask: vi.mocked(db.updateTask),
  setTaskStatus: vi.mocked(db.setTaskStatus),
  addTaskComment: vi.mocked(db.addTaskComment),
  submitPublicReport: vi.mocked(db.submitPublicReport),
};

function setOnline(value: boolean) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: value },
  });
}

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
  setOnline(true);
  await _resetOfflineDb();
  await deleteDb();
});

// ---------------------------------------------------------------------------
// Online path - live call goes through
// ---------------------------------------------------------------------------

describe("when online", () => {
  it("createIncidentOffline calls the live function and returns its result", async () => {
    mocked.createIncident.mockResolvedValueOnce({ id: "i-1" });
    const res = await createIncidentOffline("c1", { title: "x" });
    expect(mocked.createIncident).toHaveBeenCalledWith("c1", { title: "x" });
    expect(res).toEqual({ id: "i-1" });
    expect(await getAll()).toHaveLength(0);
  });

  it("createTaskOffline calls the live function and returns its result", async () => {
    mocked.createTask.mockResolvedValueOnce({ id: "t-1" });
    const res = await createTaskOffline("c1", { title: "patrol" });
    expect(mocked.createTask).toHaveBeenCalledWith("c1", { title: "patrol" });
    expect(res).toEqual({ id: "t-1" });
  });

  it("rethrows non-network errors instead of queueing", async () => {
    mocked.updateIncident.mockRejectedValueOnce(new Error("permission denied"));
    await expect(updateIncidentOffline("i-1", { title: "x" })).rejects.toThrow("permission denied");
    expect(await getAll()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Offline path - navigator.onLine = false
// ---------------------------------------------------------------------------

describe("when offline (navigator.onLine = false)", () => {
  beforeEach(() => setOnline(false));

  it("createIncidentOffline does NOT call the live function and queues", async () => {
    const res = await createIncidentOffline("c1", { title: "Stadium incident" });
    expect(mocked.createIncident).not.toHaveBeenCalled();
    expect(isPendingSync(res)).toBe(true);
    const queued = await getAll();
    expect(queued).toHaveLength(1);
    expect(queued[0].kind).toBe("incident.create");
    expect(queued[0].label).toBe("Stadium incident");
  });

  it("addIncidentUpdateOffline queues a comment", async () => {
    const res = await addIncidentUpdateOffline("i-1", "hello", "note");
    expect(mocked.addIncidentUpdate).not.toHaveBeenCalled();
    expect(isPendingSync(res)).toBe(true);
    expect((await getAll())[0].kind).toBe("incident.comment");
  });

  it("createTaskOffline queues with label", async () => {
    await createTaskOffline("c1", { title: "Patrol the perimeter" });
    const queued = await getAll();
    expect(queued[0].label).toBe("Patrol the perimeter");
  });

  it("submitPublicReportOffline queues a public report", async () => {
    await submitPublicReportOffline("link-1", "c1", { body: "anon" });
    const queued = await getAll();
    expect(queued[0].kind).toBe("public_report.submit");
  });
});

// ---------------------------------------------------------------------------
// Network-error path - online flag is true but fetch fails like network
// ---------------------------------------------------------------------------

describe("when fetch fails with a network-like error", () => {
  it("queues the mutation and returns an optimistic record", async () => {
    mocked.updateTask.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const res = await updateTaskOffline("t-1", { title: "new" });
    expect(isPendingSync(res)).toBe(true);
    const queued = await getAll();
    expect(queued).toHaveLength(1);
    expect(queued[0].kind).toBe("task.update");
  });

  it("treats 'NetworkError when attempting to fetch resource' as offline (Firefox)", async () => {
    mocked.setIncidentStatus.mockRejectedValueOnce(
      new TypeError("NetworkError when attempting to fetch resource"),
    );
    const res = await setIncidentStatusOffline("i-1", "resolved");
    expect(isPendingSync(res)).toBe(true);
  });

  it("treats 'Load failed' as offline (Safari)", async () => {
    mocked.setTaskStatus.mockRejectedValueOnce(new TypeError("Load failed"));
    const res = await setTaskStatusOffline("t-1", "done");
    expect(isPendingSync(res)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isPendingSync type guard
// ---------------------------------------------------------------------------

describe("isPendingSync()", () => {
  it("returns true for an optimistic record", () => {
    expect(isPendingSync({ __pendingSync: true, __mutationId: "x" })).toBe(true);
  });

  it("returns false for normal values", () => {
    expect(isPendingSync({ id: "i-1" })).toBe(false);
    expect(isPendingSync(null)).toBe(false);
    expect(isPendingSync(undefined)).toBe(false);
    expect(isPendingSync("string")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Higher-level wrapping
// ---------------------------------------------------------------------------

describe("addTaskCommentOffline", () => {
  it("forwards the type parameter to the live call when online", async () => {
    mocked.addTaskComment.mockResolvedValueOnce(null);
    await addTaskCommentOffline("t-1", "hi", "status_change");
    expect(mocked.addTaskComment).toHaveBeenCalledWith("t-1", "hi", "status_change");
  });

  it("preserves the type parameter in the queued payload when offline", async () => {
    setOnline(false);
    await addTaskCommentOffline("t-1", "hi", "status_change");
    const queued = await getAll();
    expect(queued[0].payload).toMatchObject({
      taskId: "t-1",
      content: "hi",
      type: "status_change",
    });
  });
});

// ---------------------------------------------------------------------------
// clear is here so the file references it (sanity helper)
// ---------------------------------------------------------------------------

describe("clear() (sanity)", () => {
  it("removes everything", async () => {
    setOnline(false);
    await createIncidentOffline("c1", { title: "x" });
    await clear();
    expect(await getAll()).toHaveLength(0);
  });
});
