"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Keep keyboard focus inside a custom modal (WCAG 2.1.2 / 2.4.3):
 * moves focus in on open, wraps Tab / Shift+Tab, closes on Escape and
 * returns focus to the element that opened it.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const opener = document.activeElement as HTMLElement | null;
    const items = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!root.contains(document.activeElement)) (items()[0] ?? root).focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onEscape) { e.stopPropagation(); onEscape(); return; }
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) { e.preventDefault(); root?.focus(); return; }
      const first = list[0], last = list[list.length - 1];
      const cur = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (cur === first || !root?.contains(cur))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (cur === last || !root?.contains(cur))) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [ref, active, onEscape]);
}
