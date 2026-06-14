"use client";

import { useEffect, useRef } from "react";
import { getGlobalAnalyserNode } from "@/hooks/use-sdr";

const COLORS = [
  [0, 0, 0],
  [0, 0, 80],
  [0, 60, 180],
  [0, 160, 200],
  [0, 220, 100],
  [180, 240, 0],
  [240, 200, 0],
  [240, 120, 0],
  [220, 40, 0],
  [200, 0, 0],
  [160, 0, 40],
];

function magnitudeToColor(val: number): [number, number, number] {
  const idx = val * (COLORS.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, COLORS.length - 1);
  const frac = idx - lo;
  return [
    Math.round(COLORS[lo][0] + (COLORS[hi][0] - COLORS[lo][0]) * frac),
    Math.round(COLORS[lo][1] + (COLORS[hi][1] - COLORS[lo][1]) * frac),
    Math.round(COLORS[lo][2] + (COLORS[hi][2] - COLORS[lo][2]) * frac),
  ] as [number, number, number];
}

export function Waterfall({ height = 160 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const imageDataRef = useRef<ImageData | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let width = canvas.width;
    let running = true;

    const draw = () => {
      if (!running) return;
      const analyser = getGlobalAnalyserNode();
      if (!analyser) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      if (!imageDataRef.current || imageDataRef.current.width !== width) {
        imageDataRef.current = ctx.createImageData(width, height);
      }

      const imgData = imageDataRef.current;

      // Shift image data down by one row
      for (let y = height - 1; y > 0; y--) {
        for (let x = 0; x < width; x++) {
          const src = ((y - 1) * width + x) * 4;
          const dst = (y * width + x) * 4;
          imgData.data[dst] = imgData.data[src];
          imgData.data[dst + 1] = imgData.data[src + 1];
          imgData.data[dst + 2] = imgData.data[src + 2];
          imgData.data[dst + 3] = 255;
        }
      }

      // Draw new row at top
      for (let x = 0; x < width; x++) {
        const bin = Math.floor((x / width) * bufferLength);
        const [r, g, b] = magnitudeToColor(dataArray[bin] / 255);
        const idx = x * 4;
        imgData.data[idx] = r;
        imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = 255;
      }

      ctx.putImageData(imgData, 0, 0);
      animRef.current = requestAnimationFrame(draw);
    };

    // Resize observer
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.round(rect.width * dpr);
      canvas.width = width;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.height = `${height}px`;
      imageDataRef.current = null;
    });
    ro.observe(canvas.parentElement ?? canvas);

    draw();

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg bg-black"
      style={{ height: `${height}px`, imageRendering: "pixelated" }}
    />
  );
}
