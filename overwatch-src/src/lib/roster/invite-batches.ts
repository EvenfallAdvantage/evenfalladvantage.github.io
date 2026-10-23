/**
 * Chunked roster invites. The roster-invite Edge Function handles members
 * sequentially (auth lookup + link generation + email send each), so one
 * request for hundreds of members exceeds the Edge Function wall-clock limit
 * and fails part-way with no report. We send fixed-size batches, report
 * progress, collect per-member failures, and stop cleanly on a transport
 * failure so the admin can resume (already-invited members drop out of the
 * target list on the next run because they have a pending invitation).
 */
export const INVITE_BATCH_SIZE = 25;
/** Per-run cap so a single click stays under consumer SMTP daily limits (e.g. Gmail ~500/day). */
export const INVITE_RUN_CAP = 100;

export interface InviteResult {
  membership_id: string;
  status: string;
  reason?: string;
}

export type SendBatch = (ids: string[]) => Promise<
  { ok: true; results: InviteResult[] } | { ok: false; error: string }
>;

export interface BatchProgress {
  processed: number;
  total: number;
  batch: number;
  batches: number;
}

export interface BatchRunSummary {
  total: number;
  processed: number;
  delivered: number;
  skipped: number;
  failed: { membership_id: string; reason: string }[];
  /** Set when a whole batch request failed; ids from here on were not attempted. */
  stoppedError?: string;
  remaining: string[];
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function runInviteBatches(
  ids: string[],
  sendBatch: SendBatch,
  opts: { batchSize?: number; cap?: number; onProgress?: (p: BatchProgress) => void } = {},
): Promise<BatchRunSummary> {
  const batchSize = opts.batchSize ?? INVITE_BATCH_SIZE;
  const target = ids.slice(0, opts.cap ?? INVITE_RUN_CAP);
  const batches = chunk(target, batchSize);
  const summary: BatchRunSummary = {
    total: target.length, processed: 0, delivered: 0, skipped: 0, failed: [], remaining: [],
  };
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    let res: Awaited<ReturnType<SendBatch>>;
    try {
      res = await sendBatch(batch);
    } catch (err) {
      res = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (!res.ok) {
      summary.stoppedError = res.error;
      summary.remaining = batches.slice(b).flat();
      break;
    }
    const seen = new Set<string>();
    for (const r of res.results) {
      seen.add(r.membership_id);
      if (r.status === "sent" || r.status === "resent" || r.status === "notified") summary.delivered++;
      else if (r.status === "skipped") summary.skipped++;
      else summary.failed.push({ membership_id: r.membership_id, reason: r.reason ?? r.status });
    }
    // Ids the function silently dropped (e.g. not in this company) count as failures.
    for (const id of batch) {
      if (!seen.has(id)) summary.failed.push({ membership_id: id, reason: "No result returned" });
    }
    summary.processed += batch.length;
    opts.onProgress?.({ processed: summary.processed, total: summary.total, batch: b + 1, batches: batches.length });
  }
  return summary;
}
