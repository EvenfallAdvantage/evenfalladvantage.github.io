"use client";

import { useRef, useEffect, useCallback } from "react";

/**
 * Animated radar sweep particle grid for the mobile landing page hero.
 * Lightweight 2D canvas — ~200 dots in a circular pattern with a rotating
 * radar sweep that illuminates dots as it passes over them.
 */
export default function MobileHeroRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const visibleRef = useRef(true);
  const accentRef = useRef<string>("");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Resize canvas to match display size
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    // Get brand accent color from CSS variable (cached — avoid getComputedStyle per frame)
    if (!accentRef.current) {
      accentRef.current = getComputedStyle(document.documentElement).getPropertyValue("--brand-accent").trim() || "#dd8c33";
    }
    const accent = accentRef.current;

    // Center of the radar
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.45;

    // Generate dots (stable across frames via seed)
    const dotCount = 180;
    const dots: { x: number; y: number; r: number; angle: number }[] = [];
    for (let i = 0; i < dotCount; i++) {
      const seed = i * 2654435761; // deterministic hash
      const a = ((seed >>> 0) % 36000) / 100 * (Math.PI / 180);
      const dist = ((((seed * 7) >>> 0) % 1000) / 1000) * maxR * 0.95 + maxR * 0.05;
      dots.push({ x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, r: dist, angle: a });
    }

    // Animation state
    const now = performance.now() / 1000;
    const sweepAngle = (now * 0.9) % (Math.PI * 2); // ~4s per rotation
    const sweepWidth = 0.5; // radians of the sweep tail

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw concentric ring guides (very subtle)
    for (let ring = 1; ring <= 3; ring++) {
      const ringR = maxR * (ring / 3);
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,0.03)`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Draw crosshair (very subtle)
    ctx.beginPath();
    ctx.moveTo(cx - maxR * 0.15, cy);
    ctx.lineTo(cx + maxR * 0.15, cy);
    ctx.moveTo(cx, cy - maxR * 0.15);
    ctx.lineTo(cx, cy + maxR * 0.15);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Draw sweep as a filled wedge
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, sweepAngle - sweepWidth, sweepAngle);
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.restore();

    // Sweep line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw dots
    for (const dot of dots) {
      // Calculate angular distance from sweep
      let angleDiff = dot.angle - sweepAngle;
      // Normalize to [0, 2π)
      angleDiff = ((angleDiff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      // Dots recently swept glow bright, then fade
      let brightness = 0.08; // base dim
      if (angleDiff < sweepWidth * 2) {
        brightness = 0.9 * (1 - angleDiff / (sweepWidth * 2));
      } else if (angleDiff > Math.PI * 2 - 0.3) {
        // Just before sweep reaches again — slight anticipation glow
        brightness = 0.15;
      }

      const dotSize = 1.2 + brightness * 1.5;

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = Math.max(0.06, brightness);
      ctx.fill();

      // Glow for bright dots
      if (brightness > 0.3) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dotSize + 3, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.globalAlpha = brightness * 0.15;
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;

    // Center dot (always bright)
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (visibleRef.current) {
      animRef.current = requestAnimationFrame(draw);
    }
  }, []);

  useEffect(() => {
    // Start animation
    animRef.current = requestAnimationFrame(draw);

    // Pause when off-screen
    const canvas = canvasRef.current;
    if (canvas) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          visibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            animRef.current = requestAnimationFrame(draw);
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(canvas);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(animRef.current);
      };
    }

    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-[100vw] h-[420px] opacity-50"
      style={{ touchAction: "none" }}
    />
  );
}
