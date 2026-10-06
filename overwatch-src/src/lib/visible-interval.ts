/**
 * setInterval that pauses while the tab is hidden.
 *
 * Polling timers keep firing in background tabs (and in installed PWAs that
 * are backgrounded), which costs battery, data and Supabase/edge quota for
 * data nobody is looking at. This helper stops the interval when
 * `document.visibilityState` becomes "hidden" and restarts it when the tab is
 * visible again. If at least one tick was missed while hidden, `fn` runs
 * immediately on return so the screen is fresh.
 *
 * Drop-in replacement:
 *   const id = setInterval(load, 15_000);  return () => clearInterval(id);
 * becomes
 *   const stop = setVisibleInterval(load, 15_000);  return stop;
 *
 * Do NOT use for timers that must keep running in the background (GPS
 * location reporting, security idle-lock, active camera scanning).
 */
export function setVisibleInterval(
  fn: () => void,
  ms: number,
  options: { refreshOnVisible?: boolean } = {},
): () => void {
  const { refreshOnVisible = true } = options;

  // SSR / non-DOM environments: behave like a plain interval.
  if (typeof document === "undefined") {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }

  let id: ReturnType<typeof setInterval> | null = null;
  let lastRun = Date.now();

  const tick = () => {
    lastRun = Date.now();
    fn();
  };
  const start = () => {
    if (id === null) id = setInterval(tick, ms);
  };
  const stop = () => {
    if (id !== null) {
      clearInterval(id);
      id = null;
    }
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      stop();
    } else {
      if (refreshOnVisible && id === null && Date.now() - lastRun >= ms) tick();
      start();
    }
  };

  if (document.visibilityState !== "hidden") start();
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
