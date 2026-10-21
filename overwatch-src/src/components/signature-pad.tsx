"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Pt = { x: number; y: number };
export interface SignaturePadHandle { toDataUrl: () => string | null; clear: () => void; isEmpty: () => boolean }

/**
 * Draw-a-signature canvas: finger, mouse or stylus (Pointer Events), with
 * Undo (last stroke) and Clear. `touch-action: none` keeps the page from
 * scrolling while signing on a phone. Exports a trimmed-to-canvas PNG.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void; height?: number; label?: string }>(
  function SignaturePad({ onChange, height = 160, label = "Draw your signature" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokes = useRef<Pt[][]>([]);
    const drawing = useRef<Pt[] | null>(null);
    const undone = useRef<Pt[][]>([]);
    const [count, setCount] = useState(0);
    const [redoCount, setRedoCount] = useState(0);

    const redraw = useCallback(() => {
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#111827"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const s of [...strokes.current, ...(drawing.current ? [drawing.current] : [])]) {
        if (!s.length) continue;
        ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
        if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y + 0.1);
        for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
        ctx.stroke();
      }
    }, []);

    useEffect(() => {
      const c = canvasRef.current; if (!c) return;
      const fit = () => {
        const dpr = window.devicePixelRatio || 1; const r = c.getBoundingClientRect();
        c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr)); redraw();
      };
      fit();
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null; ro?.observe(c);
      return () => ro?.disconnect();
    }, [redraw]);

    const changed = () => { setCount(strokes.current.length); setRedoCount(undone.current.length); onChange?.(strokes.current.length === 0); };
    const pt = (e: React.PointerEvent<HTMLCanvasElement>): Pt => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    useImperativeHandle(ref, () => ({
      isEmpty: () => strokes.current.length === 0,
      clear: () => { strokes.current = []; undone.current = []; redraw(); changed(); },
      toDataUrl: () => (strokes.current.length && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null),
    }));

    return (
      <div className="space-y-2">
        <div className="relative rounded-md border border-input bg-white">
          <canvas ref={canvasRef} aria-label={label} role="img" data-testid="signature-pad"
            className="block w-full cursor-crosshair rounded-md" style={{ height, touchAction: "none" }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = [pt(e)]; redraw(); }}
            onPointerMove={(e) => { if (!drawing.current) return; drawing.current.push(pt(e)); redraw(); }}
            onPointerUp={() => { if (drawing.current) { strokes.current.push(drawing.current); undone.current = []; drawing.current = null; redraw(); changed(); } }}
            onPointerCancel={() => { drawing.current = null; redraw(); }} />
          {count === 0 && <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-gray-400">{label}</span>}
          <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-gray-300" />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="h-10" disabled={!count}
            onClick={() => { const s = strokes.current.pop(); if (s) undone.current.push(s); redraw(); changed(); }}><Undo2 className="mr-1 h-4 w-4" /> Undo</Button>
          <Button type="button" variant="outline" size="sm" className="h-10" disabled={!redoCount}
            onClick={() => { const s = undone.current.pop(); if (s) strokes.current.push(s); redraw(); changed(); }}><Redo2 className="mr-1 h-4 w-4" /> Redo</Button>
          <Button type="button" variant="outline" size="sm" className="h-10" disabled={!count}
            onClick={() => { strokes.current = []; undone.current = []; redraw(); changed(); }}><Eraser className="mr-1 h-4 w-4" /> Clear</Button>
        </div>
      </div>
    );
  });
