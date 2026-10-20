/**
 * Optimistic write wrappers - try live first, queue on offline failure.
 *
 *
 * Each helper attempts the live `db-*` write. On `TypeError: Failed to
 * fetch` (typical Chromium offline signature) OR when `navigator.onLine`
 * is false BEFORE the call, the helper enqueues the mutation and returns
 * a synthetic optimistic record stamped with `__pendingSync = true` so
 * the UI can show a "pending sync" badge.
 *
 * Callers that need a real returned row (e.g. to navigate to a newly
 * created incident) should NOT use these wrappers - they would race the
 * sync engine. Use them for fire-and-forget writes only.
 */

import {
  createIncident,
  createIncidentEnhanced,
  updateIncident,
  setIncidentStatus,
  addIncidentUpdate,
  createTask,
  updateTask,
  setTaskStatus,
  addTaskComment,
  submitPublicReport,
} from "@/lib/supabase/db";
import { logPatrolScan } from "@/lib/supabase/db-checkpoints";
import { clockIn, clockOut } from "@/lib/supabase/db-timesheets";
import { enqueue } from "./queue";
import type { MutationKind } from "./db";

export interface OptimisticRecord {
  __pendingSync: true;
  __mutationId: string;
}

function isOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return !navigator.onLine;
}

/**
 * Treat any failure that looks like a network error as "offline". This is
 * a best-effort heuristic - browsers don't expose a canonical "fetch
 * failed because offline" error code.
 */
function looksLikeNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    return msg.includes("fetch") || msg.includes("network") || msg.includes("load failed");
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const msg = String((err as { message: unknown }).message).toLowerCase();
    return msg.includes("failed to fetch") || msg.includes("network");
  }
  return false;
}

async function tryOrQueue<T>(
  kind: MutationKind,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload narrowed by kind
  payload: any,
  liveCall: () => Promise<T>,
  optimisticLabel?: string,
  /** Reuse the record's own id as the queue id (lets the UI act on the optimistic row). */
  mutationId?: string,
): Promise<T | OptimisticRecord> {
  if (isOffline()) {
    const id = await enqueue({ id: mutationId, kind, payload, label: optimisticLabel });
    return { __pendingSync: true, __mutationId: id };
  }
  try {
    return await liveCall();
  } catch (err) {
    if (looksLikeNetworkError(err)) {
      const id = await enqueue({ id: mutationId, kind, payload, label: optimisticLabel });
      return { __pendingSync: true, __mutationId: id };
    }
    throw err;
  }
}

// ─── Incidents ─────────────────────────────────────────────

export function createIncidentOffline(
  companyId: string,
  params: Parameters<typeof createIncident>[1],
) {
  return tryOrQueue(
    "incident.create",
    { companyId, params },
    () => createIncident(companyId, params),
    params.title,
  );
}

export function updateIncidentOffline(
  incidentId: string,
  updates: Parameters<typeof updateIncident>[1],
) {
  return tryOrQueue(
    "incident.update",
    { incidentId, updates },
    () => updateIncident(incidentId, updates),
  );
}

export function setIncidentStatusOffline(incidentId: string, status: string) {
  return tryOrQueue(
    "incident.status",
    { incidentId, status },
    () => setIncidentStatus(incidentId, status),
  );
}

export function addIncidentUpdateOffline(
  incidentId: string,
  content: string,
  type?: string,
) {
  return tryOrQueue(
    "incident.comment",
    { incidentId, content, type },
    () => addIncidentUpdate(incidentId, content, type),
  );
}

// ─── Tasks ─────────────────────────────────────────────────

export function createTaskOffline(
  companyId: string,
  params: Parameters<typeof createTask>[1],
) {
  return tryOrQueue(
    "task.create",
    { companyId, params },
    () => createTask(companyId, params),
    params.title,
  );
}

export function updateTaskOffline(
  taskId: string,
  updates: Parameters<typeof updateTask>[1],
) {
  return tryOrQueue(
    "task.update",
    { taskId, updates },
    () => updateTask(taskId, updates),
  );
}

export function setTaskStatusOffline(
  taskId: string,
  status: Parameters<typeof setTaskStatus>[1],
) {
  return tryOrQueue(
    "task.status",
    { taskId, status },
    () => setTaskStatus(taskId, status),
  );
}

export function addTaskCommentOffline(
  taskId: string,
  content: string,
  type?: Parameters<typeof addTaskComment>[2],
) {
  return tryOrQueue(
    "task.comment",
    { taskId, content, type },
    () => addTaskComment(taskId, content, type),
  );
}

// ─── Public reports ────────────────────────────────────────

export function submitPublicReportOffline(
  linkId: string,
  companyId: string,
  payload: Parameters<typeof submitPublicReport>[2],
) {
  return tryOrQueue(
    "public_report.submit",
    { linkId, companyId, payload },
    () => submitPublicReport(linkId, companyId, payload),
  );
}

// ─── Helpers ───────────────────────────────────────────────

// ─── Field actions (patrol scan, clock in/out) ──────────────
// Each captures a client id and the real tap time up front, so a replay
// hours later records when it actually happened and can't double-insert.

export function logPatrolScanOffline(companyId: string, checkpointId: string, params: Omit<NonNullable<Parameters<typeof logPatrolScan>[2]>, "id" | "scannedAt"> = {}) {
  const full = { ...params, id: crypto.randomUUID(), scannedAt: new Date().toISOString() };
  return tryOrQueue("patrol.scan", { companyId, checkpointId, params: full }, () => logPatrolScan(companyId, checkpointId, full), "Checkpoint scan", full.id);
}

export function clockInOffline(params: Omit<NonNullable<Parameters<typeof clockIn>[0]>, "id" | "at"> = {}) {
  const full = { ...params, id: crypto.randomUUID(), at: new Date().toISOString() };
  // Online: no client time, so the server stamps the time and the GPS fix is taken
  // (verified clock, migration 20261020032000). Only the queued replay carries `at`.
  const { at: _at, ...live } = full; void _at;
  return tryOrQueue("timesheet.clock_in", { params: full }, () => clockIn(live), "Clock in", full.id);
}

export function clockOutOffline(timesheetId: string) {
  const at = new Date().toISOString();
  return tryOrQueue("timesheet.clock_out", { timesheetId, at }, () => clockOut(timesheetId), "Clock out");
}

export function createIncidentEnhancedOffline(
  companyId: string,
  params: Parameters<typeof createIncidentEnhanced>[1],
) {
  return tryOrQueue("incident.create", { companyId, params, enhanced: true }, () => createIncidentEnhanced(companyId, params), params.title);
}

export function isPendingSync<T>(
  v: T | OptimisticRecord,
): v is OptimisticRecord {
  return (
    typeof v === "object" &&
    v !== null &&
    "__pendingSync" in v &&
    (v as { __pendingSync?: unknown }).__pendingSync === true
  );
}
