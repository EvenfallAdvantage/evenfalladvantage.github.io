/**
 * Centralized logger for Overwatch.
 *
 * Provides structured, leveled logging that replaces raw console calls
 * and eliminates silent empty `catch {}` blocks.
 *
 * Levels:
 *  - trace:  Cesium entity cleanup, DOM stop() calls — expected failures
 *  - debug:  localStorage caches, optional data loads, fallback paths
 *  - warn:   User-visible data loads that silently fail (admin tabs, feeds)
 *  - error:  Unexpected failures that should be investigated
 *
 * In production, trace and debug are suppressed unless
 * `localStorage.getItem("overwatch-debug") === "1"`.
 */

type LogLevel = "trace" | "debug" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): number {
  if (typeof window === "undefined") return LEVEL_ORDER.warn;
  try {
    if (localStorage.getItem("overwatch-debug") === "1") return LEVEL_ORDER.trace;
  } catch {
    // localStorage may be unavailable (private browsing, SSR)
  }
  return process.env.NODE_ENV === "development" ? LEVEL_ORDER.debug : LEVEL_ORDER.warn;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= getMinLevel();
}

/**
 * Log a swallowed error from a catch block.
 *
 * Usage:
 * ```ts
 * try { viewer.entities.removeById(id); } catch (e) { logger.swallow("cesium-layers:remove", e); }
 * ```
 */
function swallow(context: string, err?: unknown, level: LogLevel = "trace"): void {
  if (!shouldLog(level)) return;
  const message = err instanceof Error ? err.message : err != null ? String(err) : "";
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.debug;
  method(`[${context}]`, message || "(swallowed)");
}

/** Log at trace level — expected cleanup failures */
function trace(context: string, ...args: unknown[]): void {
  if (!shouldLog("trace")) return;
  console.debug(`[${context}]`, ...args);
}

/** Log at debug level — optional loads, fallbacks */
function debug(context: string, ...args: unknown[]): void {
  if (!shouldLog("debug")) return;
  console.debug(`[${context}]`, ...args);
}

/** Log at warn level — user-visible silent failures */
function warn(context: string, ...args: unknown[]): void {
  if (!shouldLog("warn")) return;
  console.warn(`[${context}]`, ...args);
}

/** Log at error level — unexpected failures */
function error(context: string, ...args: unknown[]): void {
  if (!shouldLog("error")) return;
  console.error(`[${context}]`, ...args);
}

export const logger = { swallow, trace, debug, warn, error } as const;
