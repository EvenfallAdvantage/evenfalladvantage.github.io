"use client";

/**
 * SyncIndicator - small floating chip showing offline / pending / errored
 * status. Hidden when fully online with nothing to sync.
 *
 * Phase 8 / HALO_PARITY_PLAN.md
 *
 * Mount once near the top of the dashboard shell. Drives auto-drain via
 * `useSync()`.
 */

import { useState } from "react";
import { CloudOff, RefreshCw, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSync } from "@/hooks/use-sync";
import Link from "next/link";

export function SyncIndicator() {
  const sync = useSync();
  const [dismissed, setDismissed] = useState(false);

  // Nothing to show.
  if (sync.online && sync.pending === 0 && sync.errors === 0 && !sync.draining) {
    return null;
  }

  if (dismissed && sync.online && sync.errors === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs shadow-md backdrop-blur"
      style={{ maxWidth: 360 }}
    >
      {!sync.online ? (
        <>
          <CloudOff className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-medium">Offline</span>
          {sync.pending > 0 && (
            <span className="text-muted-foreground">
              {sync.pending} pending
            </span>
          )}
        </>
      ) : sync.draining ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
          <span className="font-medium">Syncing...</span>
        </>
      ) : sync.errors > 0 ? (
        <>
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          <span className="font-medium text-red-600">
            {sync.errors} sync {sync.errors === 1 ? "issue" : "issues"}
          </span>
          <Link
            href="/admin/security"
            className="text-muted-foreground underline hover:text-foreground"
          >
            review
          </Link>
        </>
      ) : sync.pending > 0 ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-medium">
            {sync.pending} pending
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px]"
            onClick={() => void sync.drainNow()}
            disabled={sync.draining}
          >
            sync now
          </Button>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="font-medium">Synced</span>
        </>
      )}

      {sync.online && (
        <button
          type="button"
          className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
