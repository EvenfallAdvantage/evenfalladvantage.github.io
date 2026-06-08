"use client";

/**
 * Service worker registration - mounted once near the top of the
 * dashboard shell. Guards on `'serviceWorker' in navigator` so it's a
 * no-op in browsers without SW support.
 *
 * Phase 8 / HALO_PARITY_PLAN.md
 *
 * Why a client component: SW registration MUST run in the browser, not at
 * build time. We use a useEffect so registration happens once per mount,
 * not during render.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";

const SW_PATH = "/sw.js"; // resolved by Next at runtime against basePath

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Build-time basePath is exposed via process.env.NEXT_PUBLIC_BASE_PATH or
    // can be derived from window.location. Use the latter to avoid coupling
    // to env-var plumbing.
    const basePath = window.location.pathname.startsWith("/overwatch")
      ? "/overwatch"
      : "";

    void navigator.serviceWorker
      .register(`${basePath}${SW_PATH}`, { scope: `${basePath}/` })
      .catch((err) => logger.swallow("sw:register", err, "warn"));
  }, []);

  return null;
}
