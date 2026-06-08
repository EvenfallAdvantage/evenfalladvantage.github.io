/**
 * Offline mutation queue - public API.
 *
 * Phase 8 / HALO_PARITY_PLAN.md
 *
 * Thin functional layer over `openOfflineDb()` for the optimistic write
 * wrappers and the sync engine.
 */

import { openOfflineDb, STORE, type MutationKind, type QueuedMutation } from "./db";

/**
 * Add a new mutation to the queue. Returns the assigned id so the caller
 * can echo it back to the UI for "pending sync" indicators.
 */
export async function enqueue(
  mutation: Omit<QueuedMutation, "id" | "createdAt" | "attempts" | "status"> & {
    id?: string;
    createdAt?: string;
    attempts?: number;
    status?: QueuedMutation["status"];
  },
): Promise<string> {
  const db = await openOfflineDb();
  const id = mutation.id ?? crypto.randomUUID();
  const row: QueuedMutation = {
    id,
    kind: mutation.kind,
    payload: mutation.payload,
    createdAt: mutation.createdAt ?? new Date().toISOString(),
    attempts: mutation.attempts ?? 0,
    status: mutation.status ?? "pending",
    label: mutation.label,
    lastError: mutation.lastError,
  };
  await db.put(STORE, row);
  return id;
}

/**
 * Return every queued mutation regardless of status. Useful for the
 * "sync issues" UI.
 */
export async function getAll(): Promise<QueuedMutation[]> {
  const db = await openOfflineDb();
  return db.getAll(STORE);
}

/**
 * Pending mutations only, sorted by creation time (oldest first). The sync
 * engine drains in this order so causally-related writes (create then
 * update) replay correctly.
 */
export async function getPending(): Promise<QueuedMutation[]> {
  const db = await openOfflineDb();
  const rows = await db.getAllFromIndex(STORE, "by_status", "pending");
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

/**
 * Return mutations whose status is `error` so the UI can surface a banner.
 */
export async function getErrors(): Promise<QueuedMutation[]> {
  const db = await openOfflineDb();
  return db.getAllFromIndex(STORE, "by_status", "error");
}

/**
 * Mark a mutation as successfully synced. We keep the row around briefly
 * so the UI can show "synced just now" toasts, then GC happens via
 * `clearDone` after a TTL.
 */
export async function markDone(id: string): Promise<void> {
  const db = await openOfflineDb();
  const row = await db.get(STORE, id);
  if (!row) return;
  await db.put(STORE, { ...row, status: "done", lastError: undefined });
}

/**
 * Increment the attempts counter, optionally capture an error message, and
 * mark `error` after `maxAttempts`.
 */
export async function bumpAttempt(
  id: string,
  lastError: string,
  maxAttempts = 5,
): Promise<QueuedMutation | undefined> {
  const db = await openOfflineDb();
  const row = await db.get(STORE, id);
  if (!row) return undefined;
  const nextAttempts = row.attempts + 1;
  const next: QueuedMutation = {
    ...row,
    attempts: nextAttempts,
    lastError,
    status: nextAttempts >= maxAttempts ? "error" : "pending",
  };
  await db.put(STORE, next);
  return next;
}

/**
 * Force a mutation back to pending after the user resolved whatever was
 * wrong (e.g. signed in again, fixed a typo on the optimistic record).
 */
export async function retry(id: string): Promise<void> {
  const db = await openOfflineDb();
  const row = await db.get(STORE, id);
  if (!row) return;
  await db.put(STORE, { ...row, status: "pending", attempts: 0, lastError: undefined });
}

/**
 * Hard-delete a single mutation. Used when the user dismisses an
 * unresolvable error.
 */
export async function remove(id: string): Promise<void> {
  const db = await openOfflineDb();
  await db.delete(STORE, id);
}

/**
 * Wipe the entire store. Test-only helper - never call from production code.
 */
export async function clear(): Promise<void> {
  const db = await openOfflineDb();
  await db.clear(STORE);
}

/**
 * Garbage-collect `done` rows older than `olderThanMs`. Default 24 h.
 */
export async function clearDone(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openOfflineDb();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const tx = db.transaction(STORE, "readwrite");
  const index = tx.store.index("by_status");
  let removed = 0;
  let cursor = await index.openCursor("done");
  while (cursor) {
    if (cursor.value.createdAt < cutoff) {
      await cursor.delete();
      removed++;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return removed;
}

export type { MutationKind, QueuedMutation };
