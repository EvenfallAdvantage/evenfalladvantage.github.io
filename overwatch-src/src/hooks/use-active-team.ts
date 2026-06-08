"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useActiveTeam — persisted per-company "currently selected team" filter.
 *
 * Stored in localStorage as `overwatch:active-team:<companyId>` so that each
 * company has its own remembered team. Returns null when nothing is selected.
 *
 * Designed to be React-Compiler-safe: localStorage reads happen at mount or
 * when the companyId changes via a useRef-guarded effect that does NOT call
 * setState unless the stored value differs from current state.
 */
export function useActiveTeam(
  companyId: string | null | undefined,
): [string | null, (teamId: string | null) => void] {
  const [teamId, setTeamId] = useState<string | null>(null);
  const lastLoadedFor = useRef<string | null>(null);
  const storageKey = companyId ? `overwatch:active-team:${companyId}` : null;

  useEffect(() => {
    if (lastLoadedFor.current === companyId) return;
    lastLoadedFor.current = companyId ?? null;

    if (!storageKey) {
      // Clearing happens only when company changes; safe to ignore noise.
      if (teamId !== null) setTeamId(null);
      return;
    }

    try {
      const stored = window.localStorage.getItem(storageKey);
      const next = stored || null;
      if (next !== teamId) setTeamId(next);
    } catch {
      // localStorage unavailable; treat as no selection.
    }
    // teamId is intentionally omitted so we only re-read when companyId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, storageKey]);

  const update = useCallback(
    (next: string | null) => {
      setTeamId(next);
      if (!storageKey) return;
      try {
        if (next) {
          window.localStorage.setItem(storageKey, next);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch {
        // Best effort.
      }
    },
    [storageKey],
  );

  return [teamId, update];
}
