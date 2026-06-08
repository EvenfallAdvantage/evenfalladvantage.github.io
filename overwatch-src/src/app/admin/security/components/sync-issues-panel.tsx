"use client";

/**
 * SyncIssuesPanel - lists mutations that failed enough times to be marked
 * `error` by the sync engine. Lets the user retry or dismiss each one.
 *
 * Phase 8 / HALO_PARITY_PLAN.md
 *
 * Mounts inside the Security Center (per-company audit viewer). Hidden
 * when there are no errored rows.
 */

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getErrors, retry, remove, type QueuedMutation } from "@/lib/offline/queue";
import { drainQueue } from "@/lib/offline/sync";
import { logger } from "@/lib/logger";

export function SyncIssuesPanel() {
  const [rows, setRows] = useState<QueuedMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const errs = await getErrors();
      setRows(errs);
    } catch (e) {
      logger.swallow("sync-issues:load", e, "warn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRetry(row: QueuedMutation) {
    setBusy(row.id);
    try {
      await retry(row.id);
      const result = await drainQueue();
      if (result.succeeded > 0) {
        toast.success("Retried and synced");
      } else if (result.errored > 0) {
        toast.error("Retry failed again");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDismiss(row: QueuedMutation) {
    setBusy(row.id);
    try {
      await remove(row.id);
      toast.success("Dismissed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dismiss failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <Card className="border-red-500/30">
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-semibold text-red-600">
            Sync issues
            <Badge variant="outline" className="ml-2 text-[10px]">{rows.length}</Badge>
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          These offline writes failed to sync after several attempts. Retry or dismiss
          each below. Dismissing discards the change.
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rows.map((row) => (
            <div key={row.id} className="rounded-md border bg-card p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[11px] font-semibold">{row.kind}</span>
                    <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                      attempts {row.attempts}
                    </Badge>
                  </div>
                  {row.label && (
                    <p className="text-xs">{row.label}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono">
                    queued {new Date(row.createdAt).toLocaleString()}
                  </p>
                  {row.lastError && (
                    <p className="text-[11px] text-red-600 mt-1 font-mono">
                      {row.lastError}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetry(row)}
                    disabled={busy === row.id}
                    className="h-7 gap-1.5 text-xs"
                  >
                    {busy === row.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(row)}
                    disabled={busy === row.id}
                    className="h-7 gap-1.5 text-xs text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
