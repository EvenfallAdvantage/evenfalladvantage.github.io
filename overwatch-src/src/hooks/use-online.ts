"use client";

/**
 * useOnline - reactive online/offline status.
 *
 *
 * Subscribes to the browser's online/offline events and reports the
 * current state. SSR-safe: returns `true` on the server (we assume an
 * online environment when rendering at build time).
 *
 * React-Compiler-safe: side effects only inside useEffect; setState
 * happens in event handlers, never during the render pass.
 */

import { useEffect, useState } from "react";

export function useOnline(): boolean {
  // Initialize from navigator.onLine where available. Default to true so
  // the optimistic write wrappers don't queue on SSR / first paint.
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
