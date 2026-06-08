/**
 * Offline sync engine - drain pending mutations.
 *
 * Phase 8 / HALO_PARITY_PLAN.md
 *
 * On reconnect (or app focus) call `drainQueue()`. It walks pending
 * mutations in `createdAt` order, dispatches each by `kind` to the
 * matching `db-*` function, marks done on success and bumps the attempt
 * counter on failure (capped at 5 by default, after which the row goes
 * to `error` and the user sees it in the sync-issues banner).
 *
 * Last-write-wins via `updated_at`: we don't do client-side conflict
 * detection. If two clients edit the same row offline the most recent
 * `updated_at` wins. This matches the plan's stated strategy.
 */

import {
  getPending,
  markDone,
  bumpAttempt,
  type QueuedMutation,
} from "./queue";
import {
  createIncident,
  createIncidentEnhanced,
  updateIncident,
  setIncidentStatus,
  transferIncident,
  addIncidentUpdate,
  createTask,
  updateTask,
  setTaskStatus,
  transferTask,
  addTaskComment,
  addChecklistItem,
  toggleChecklistItem,
  submitPublicReport,
} from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

export interface DrainResult {
  attempted: number;
  succeeded: number;
  failed: number;
  errored: number;
}

/**
 * Dispatch one mutation to its live `db-*` function. The payload shape
 * mirrors the matching function's arguments. New kinds added to
 * `MutationKind` MUST be handled here or `drainQueue` will mark them as
 * errored after a single attempt.
 */
async function dispatch(mutation: QueuedMutation): Promise<void> {
  const { kind, payload } = mutation;
  switch (kind) {
    case "incident.create": {
      // Two flavors of incident-create exist; payload picks via `enhanced`.
      const p = payload as { companyId: string; params: Record<string, unknown>; enhanced?: boolean };
      if (p.enhanced) {
        await createIncidentEnhanced(p.companyId, p.params as Parameters<typeof createIncidentEnhanced>[1]);
      } else {
        await createIncident(p.companyId, p.params as Parameters<typeof createIncident>[1]);
      }
      return;
    }
    case "incident.update": {
      const p = payload as { incidentId: string; updates: Record<string, unknown> };
      await updateIncident(p.incidentId, p.updates);
      return;
    }
    case "incident.status": {
      const p = payload as { incidentId: string; status: string };
      await setIncidentStatus(p.incidentId, p.status);
      return;
    }
    case "incident.transfer": {
      const p = payload as {
        incidentId: string;
        toTeamId: string | null;
        options?: Parameters<typeof transferIncident>[2];
      };
      await transferIncident(p.incidentId, p.toTeamId, p.options);
      return;
    }
    case "incident.comment": {
      const p = payload as { incidentId: string; content: string; type?: string };
      await addIncidentUpdate(p.incidentId, p.content, p.type);
      return;
    }
    case "task.create": {
      const p = payload as { companyId: string; params: Parameters<typeof createTask>[1] };
      await createTask(p.companyId, p.params);
      return;
    }
    case "task.update": {
      const p = payload as { taskId: string; updates: Parameters<typeof updateTask>[1] };
      await updateTask(p.taskId, p.updates);
      return;
    }
    case "task.status": {
      const p = payload as { taskId: string; status: Parameters<typeof setTaskStatus>[1] };
      await setTaskStatus(p.taskId, p.status);
      return;
    }
    case "task.transfer": {
      const p = payload as {
        taskId: string;
        toTeamId: string | null;
        options?: Parameters<typeof transferTask>[2];
      };
      await transferTask(p.taskId, p.toTeamId, p.options);
      return;
    }
    case "task.comment": {
      const p = payload as {
        taskId: string;
        content: string;
        type?: Parameters<typeof addTaskComment>[2];
      };
      await addTaskComment(p.taskId, p.content, p.type);
      return;
    }
    case "task.checklist.add": {
      const p = payload as { taskId: string; content: string; sortOrder?: number };
      await addChecklistItem(p.taskId, p.content, p.sortOrder);
      return;
    }
    case "task.checklist.toggle": {
      const p = payload as { itemId: string; isDone: boolean };
      await toggleChecklistItem(p.itemId, p.isDone);
      return;
    }
    case "public_report.submit": {
      const p = payload as {
        linkId: string;
        companyId: string;
        payload: Parameters<typeof submitPublicReport>[2];
      };
      await submitPublicReport(p.linkId, p.companyId, p.payload);
      return;
    }
    default: {
      // Force an exhaustiveness check at compile time.
      const _exhaustive: never = kind;
      throw new Error(`Unknown mutation kind: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Drain pending mutations one at a time. Returns aggregate counts.
 *
 * @param opts.maxAttempts Cap for `bumpAttempt` before promoting to `error`.
 *                        Default 5.
 * @param opts.signal     Optional AbortSignal so the UI can cancel a drain
 *                        in progress (e.g. user signed out mid-sync).
 */
export async function drainQueue(opts: {
  maxAttempts?: number;
  signal?: AbortSignal;
} = {}): Promise<DrainResult> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const result: DrainResult = { attempted: 0, succeeded: 0, failed: 0, errored: 0 };

  const pending = await getPending();
  for (const m of pending) {
    if (opts.signal?.aborted) break;
    result.attempted++;
    try {
      await dispatch(m);
      await markDone(m.id);
      result.succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const next = await bumpAttempt(m.id, msg, maxAttempts);
      if (next?.status === "error") {
        result.errored++;
      } else {
        result.failed++;
      }
      logger.swallow("offline-sync:dispatch", err, "warn");
    }
  }

  return result;
}
