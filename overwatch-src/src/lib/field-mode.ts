/**
 * "Large text / field mode": bigger base text (112.5%), a 13 px floor on the
 * tiny text sizes, and higher-contrast muted text. Stored per device.
 */
export const FIELD_MODE_KEY = "ow-field-mode";
export const FIELD_MODE_CLASS = "ow-field-mode";

export function getFieldMode(): boolean {
  try { return localStorage.getItem(FIELD_MODE_KEY) === "1"; } catch { return false; }
}

export function setFieldMode(on: boolean): void {
  try { localStorage.setItem(FIELD_MODE_KEY, on ? "1" : "0"); } catch { /* private mode */ }
  if (typeof document !== "undefined") document.documentElement.classList.toggle(FIELD_MODE_CLASS, on);
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
export function subscribeFieldMode(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Inline <head> snippet so the class is set before first paint (no flash). */
export const FIELD_MODE_BOOT = `try{if(localStorage.getItem("${FIELD_MODE_KEY}")==="1")document.documentElement.classList.add("${FIELD_MODE_CLASS}")}catch(e){}`;
