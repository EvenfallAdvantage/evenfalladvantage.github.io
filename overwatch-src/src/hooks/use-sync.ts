"use client";

/**
 * useSync - auto-drain pending offline mutations on reconnect / focus.
 *
 *
 * Mounts a small effect that calls `drainQueue()` whenever:
 *   1. The browser fires the `online` event (was offline -> now online).
 *   2. The window receives a `focus` event AND we are online.
 *   3. The hook first mounts AND we are online (catches any queue residue
 *      from a previous session).
 *
 * Returns the live status object so callers (e.g. the global header) can
 * show "syncing 3 pending" or "5 sync issues".
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useOnline } from "@/hooks/use-online";
import { drainQueue, type DrainResult } from "@/lib/offline/sync";
import { getPending, getErrors } from "@/lib/offline/queue";

export interface SyncStatus {
  online: boolean;
  pending: number;
  errors: number;
  draining: boolean;
  lastDrain: DrainResult | null;
  lastDrainAt: string | null;
}

export function useSync(): SyncStatus & { drainNow: () => Promise<void> } {
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState(0);
  const [draining, setDraining] = useState(false);
  const [lastDrain, setLastDrain] = useState<DrainResult | null>(null);
  const [lastDrainAt, setLastDrainAt] = useState<string | null>(null);
  const drainingRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([getPending(), getErrors()]);
      setPending(p.length);
      setErrors(e.length);
    } catch {
      /* idb might not be ready on the very first paint */
    }
  }, []);

  const drainNow = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    setDraining(true);
    try {
      const r = await drainQueue();
      setLastDrain(r);
      setLastDrainAt(new Date().toISOString());
      await refreshCounts();
    } finally {
      drainingRef.current = false;
      setDraining(false);
    }
  }, [refreshCounts]);

  // Refresh counts on mount and whenever we come online.
  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts, online]);

  // Auto-drain when the browser flips online.
  useEffect(() => {
    if (!online) return;
    void drainNow();
  }, [online, drainNow]);

  // Auto-drain on window focus (re-syncs after the user comes back to the tab).
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleFocus() {
      if (online) void drainNow();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [online, drainNow]);

  return {
    online,
    pending,
    errors,
    draining,
    lastDrain,
    lastDrainAt,
    drainNow,
  };
}
