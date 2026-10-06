"use client";

import { useEffect, useState } from "react";
import { resolveStorageUrl } from "@/lib/supabase/db-helpers";

/**
 * Resolve a stored file reference (legacy public URL or "bucket/path") to a
 * loadable URL. certifications and operation-maps are private buckets, so
 * their old public URLs are swapped for signed URLs. Returns null while
 * resolving or if signing fails.
 */
export function useSignedStorageUrl(ref: string | null | undefined, expiresIn = 3600): string | null {
  const [resolved, setResolved] = useState<{ ref: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    resolveStorageUrl(ref, expiresIn).then((url) => {
      if (!cancelled) setResolved({ ref, url });
    });
    return () => { cancelled = true; };
  }, [ref, expiresIn]);

  if (!ref || !resolved || resolved.ref !== ref) return null;
  return resolved.url;
}
