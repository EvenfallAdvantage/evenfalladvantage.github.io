"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

export type SignaturePadHandle = { clear: () => void; toDataUrl: () => string | null; isEmpty: () => boolean };

/** Finger/stylus signature pad (pointer events, high-DPI canvas, white ink on transparent → exported on white). */
export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number; onChange?: (empty: boolean) => void }>(
  function SignaturePad({ height = 180, onChange }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [empty, setEmpty] = useState(true);

    useEffect(() => {
      const c = canvas.current!; const dpr = window.devicePixelRatio || 1;
      const resize = () => {
        const w = c.clientWidth; c.width = w * dpr; c.height = height * dpr;
        const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.4; ctx.strokeStyle = "#111";
        setEmpty(true); onChange?.(true);
      };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(c); return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [height]);

    function pos(e: React.PointerEvent) { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function down(e: React.PointerEvent) { canvas.current!.setPointerCapture(e.pointerId); drawing.current = true; last.current = pos(e); dot(last.current); }
    function dot(p: { x: number; y: number }) { const ctx = canvas.current!.getContext("2d")!; ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = "#111"; ctx.fill(); mark(); }
    function move(e: React.PointerEvent) {
      if (!drawing.current || !last.current) return;
      const p = pos(e); const ctx = canvas.current!.getContext("2d")!;
      ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last.current = p; mark();
    }
    function up() { drawing.current = false; last.current = null; }
    function mark() { if (empty) { setEmpty(false); onChange?.(false); } }

    useImperativeHandle(ref, () => ({
      clear() { const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange?.(true); },
      isEmpty: () => empty,
      toDataUrl() {
        if (empty) return null;
        const c = canvas.current!; const out = document.createElement("canvas");
        // Downscale to 1x and flatten on white so the PNG stays small (< 300 KB DB limit).
        out.width = c.clientWidth; out.height = height; const ctx = out.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height); ctx.drawImage(c, 0, 0, out.width, out.height);
        return out.toDataURL("image/png");
      },
    }), [empty, height, onChange]);

    return (
      <div className="relative rounded-xl border-2 border-dashed border-border bg-white" style={{ height }}>
        <canvas ref={canvas} className="h-full w-full touch-none" style={{ height }} aria-label="Signature pad"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} data-testid="signature-pad" />
        {empty && <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-gray-400">Sign here with your finger</span>}
        <span className="pointer-events-none absolute bottom-8 left-4 right-4 border-b border-gray-300" />
      </div>
    );
  },
);
