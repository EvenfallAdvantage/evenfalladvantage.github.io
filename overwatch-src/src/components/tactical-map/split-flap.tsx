"use client";

/**
 * Split-flap (departure-board) text: when the string changes, each character
 * flips over left to right. Modelled on gods-eye-view's src/splitFlap.js (MIT):
 * CSS-only motion, one cascade per change, capped total duration, and the
 * element's textContent is always the settled string (the old glyphs are CSS
 * generated content). Reduced-motion users get an instant swap.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";

export const FLAP_CHAR_MS = 190;
export const FLAP_STAGGER_MS = 26;
export const FLAP_MAX_TOTAL_MS = 620;

/** Per-column start delay (ms), compressed so long strings still finish within FLAP_MAX_TOTAL_MS. */
export function flapDelays(length: number): number[] {
  if (length <= 0) return [];
  const budget = Math.max(0, FLAP_MAX_TOTAL_MS - FLAP_CHAR_MS);
  const step = length > 1 ? Math.min(FLAP_STAGGER_MS, budget / (length - 1)) : 0;
  return Array.from({ length }, (_, i) => Math.round(i * step));
}

const STYLE = `
@keyframes ow-flap-in { 0% { transform: rotateX(-90deg); opacity: .2 } 60% { transform: rotateX(8deg); opacity: 1 } 100% { transform: rotateX(0) } }
@keyframes ow-flap-out { 0% { transform: rotateX(0); opacity: 1 } 100% { transform: rotateX(90deg); opacity: 0 } }
.ow-flap-cell { position: relative; display: inline-block; white-space: pre; perspective: 200px; }
.ow-flap-cell[data-flap] > span { display: inline-block; transform-origin: 50% 55%; animation: ow-flap-in ${FLAP_CHAR_MS}ms cubic-bezier(.2,.75,.25,1) both; animation-delay: var(--ow-flap-delay); }
.ow-flap-cell[data-flap]::before { content: attr(data-flap-prev); position: absolute; left: 0; top: 0; transform-origin: 50% 55%; animation: ow-flap-out ${Math.round(FLAP_CHAR_MS * 0.55)}ms ease-in both; animation-delay: var(--ow-flap-delay); }
@media (prefers-reduced-motion: reduce) { .ow-flap-cell[data-flap] > span, .ow-flap-cell[data-flap]::before { animation: none; } .ow-flap-cell[data-flap]::before { content: none; } }
`;
let styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.dataset.owFlap = "1";
  el.textContent = STYLE;
  document.head.appendChild(el);
}

export function SplitFlapText({ text, className, title }: { text: string; className?: string; title?: string }) {
  const [state, setState] = useState<{ cur: string; prev: string; gen: number }>({ cur: text, prev: text, gen: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { injectStyle(); }, []);
  useEffect(() => {
    if (text === state.cur) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a text change starts one flap cascade
    setState((s) => ({ cur: text, prev: s.cur, gen: s.gen + 1 }));
    if (timer.current) clearTimeout(timer.current);
    const total = FLAP_MAX_TOTAL_MS + 80;
    timer.current = setTimeout(() => setState((s) => ({ ...s, prev: s.cur })), total);
  }, [text, state.cur]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flapping = state.prev !== state.cur;
  const n = Math.max(state.cur.length, flapping ? state.prev.length : 0);
  const delays = flapDelays(n);
  const chars = Array.from({ length: n }, (_, i) => state.cur[i] ?? "");
  return (
    <span className={className} title={title} data-testid="split-flap" aria-label={text}>
      {chars.map((ch, i) => {
        const prev = state.prev[i] ?? " ";
        const changed = flapping && prev !== (ch || " ");
        return (
          <span
            key={changed ? `${state.gen}-${i}` : `s-${i}`}
            className="ow-flap-cell"
            aria-hidden="true"
            {...(changed ? { "data-flap": "1", "data-flap-prev": prev } : {})}
            style={{ "--ow-flap-delay": `${delays[i]}ms` } as CSSProperties}
          ><span>{ch}</span></span>
        );
      })}
    </span>
  );
}
