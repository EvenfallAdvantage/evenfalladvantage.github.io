/**
 * Offline mutation queue - IndexedDB schema + open helper.
 *
 *
 * One object store `mutations` keyed by `id`. Each row is a
 * `QueuedMutation` describing one offline write that the sync engine will
 * replay against the live `db-*` functions once connectivity is restored.
 *
 * Why IndexedDB and not localStorage:
 *   - localStorage is synchronous and capped at ~5 MB. Photo evidence
 *     attached to incident-create payloads can blow past that.
 *   - IndexedDB is async, structured, and supports indexes (we read by
 *     status to drain only pending rows).
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type MutationStatus = "pending" | "done" | "error";

/**
 * Kinds map 1:1 to a `db-*` write function so the sync engine can dispatch
 * with a single switch statement. Adding a new kind requires:
 *   1. Add the literal here.
 *   2. Add a dispatch arm in `sync.ts`.
 *   3. Add an optimistic wrapper if appropriate.
 */
export type MutationKind =
  | "incident.create"
  | "incident.update"
  | "incident.status"
  | "incident.transfer"
  | "incident.comment"
  | "task.create"
  | "task.update"
  | "task.status"
  | "task.transfer"
  | "task.comment"
  | "task.checklist.add"
  | "task.checklist.toggle"
  | "public_report.submit";

/**
 * Generic shape: each kind's payload mirrors the arguments of the matching
 * `db-*` function. We keep this loose (`unknown` per field) at the queue
 * layer; the sync dispatcher narrows per-kind.
 */
export interface QueuedMutation {
  id: string;
  kind: MutationKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload is dispatcher-narrowed
  payload: any;
  createdAt: string;
  attempts: number;
  status: MutationStatus;
  /** Last error message captured by the sync engine for failed attempts. */
  lastError?: string;
  /** Optional human-readable label for the UI (e.g. "Patrol the perimeter"). */
  label?: string;
}

export interface OfflineDb extends DBSchema {
  mutations: {
    key: string;
    value: QueuedMutation;
    indexes: {
      by_status: MutationStatus;
      by_created_at: string;
    };
  };
}

const DB_NAME = "overwatch-offline";
const DB_VERSION = 1;
const STORE = "mutations" as const;

let dbPromise: Promise<IDBPDatabase<OfflineDb>> | null = null;

export function openOfflineDb(): Promise<IDBPDatabase<OfflineDb>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("by_status", "status");
          store.createIndex("by_created_at", "createdAt");
        }
      },
      blocked() {
        // Another tab is holding the old version open; we don't expect this
        // in practice since v1 is the only version. Log so we notice if a
        // future migration runs into this.
        console.warn("[offline-db] upgrade blocked by another tab");
      },
      blocking() {
        /* close on demand if another tab tries to upgrade */
      },
    });
  }
  return dbPromise;
}

/**
 * Used by tests to wipe the singleton between cases. Also closes any open
 * IDBPDatabase so the next deleteDatabase call is not blocked by an active
 * connection.
 */
export async function _resetOfflineDb(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      /* db may already be closed */
    }
  }
  dbPromise = null;
}

export { DB_NAME, DB_VERSION, STORE };
