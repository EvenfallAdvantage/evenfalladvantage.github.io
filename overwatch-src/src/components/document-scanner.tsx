"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCcw, Check, FlipHorizontal, Zap, ZapOff, Sun, Contrast, Move } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

type Corners = { tl: [number, number]; tr: [number, number]; br: [number, number]; bl: [number, number] };

/* ── Perspective transform (4-point → rectangle) ─────────── */
function perspectiveTransform(
  srcCtx: CanvasRenderingContext2D,
  srcW: number,
  srcH: number,
  corners: { tl: [number, number]; tr: [number, number]; br: [number, number]; bl: [number, number] },
  outW: number,
  outH: number,
): ImageData {
  const src = srcCtx.getImageData(0, 0, srcW, srcH);
  const dst = new ImageData(outW, outH);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const u = x / outW;
      const v = y / outH;
      // Bilinear interpolation of corner positions
      const sx =
        (1 - u) * (1 - v) * corners.tl[0] +
        u * (1 - v) * corners.tr[0] +
        u * v * corners.br[0] +
        (1 - u) * v * corners.bl[0];
      const sy =
        (1 - u) * (1 - v) * corners.tl[1] +
        u * (1 - v) * corners.tr[1] +
        u * v * corners.br[1] +
        (1 - u) * v * corners.bl[1];
      const si = (Math.round(sy) * srcW + Math.round(sx)) * 4;
      const di = (y * outW + x) * 4;
      dst.data[di] = src.data[si] ?? 0;
      dst.data[di + 1] = src.data[si + 1] ?? 0;
      dst.data[di + 2] = src.data[si + 2] ?? 0;
      dst.data[di + 3] = 255;
    }
  }
  return dst;
}

/* ── Edge detection with Gaussian blur + better validation ── */
function detectDocumentEdges(
  ctx: CanvasRenderingContext2D, w: number, h: number,
): Corners | null {
  const img = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = img.data[i * 4] * 0.299 + img.data[i * 4 + 1] * 0.587 + img.data[i * 4 + 2] * 0.114;
  }

  // 3×3 Gaussian blur to reduce noise before Sobel
  const blurred = new Float32Array(w * h);
  const k = [1, 2, 1, 2, 4, 2, 1, 2, 1]; // kernel (sum=16)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++)
        for (let kx = -1; kx <= 1; kx++)
          sum += gray[(y + ky) * w + (x + kx)] * k[(ky + 1) * 3 + (kx + 1)];
      blurred[y * w + x] = sum / 16;
    }
  }

  // Sobel on blurred image
  const edges = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -blurred[(y - 1) * w + (x - 1)] + blurred[(y - 1) * w + (x + 1)] +
        -2 * blurred[y * w + (x - 1)] + 2 * blurred[y * w + (x + 1)] +
        -blurred[(y + 1) * w + (x - 1)] + blurred[(y + 1) * w + (x + 1)];
      const gy =
        -blurred[(y - 1) * w + (x - 1)] - 2 * blurred[(y - 1) * w + x] - blurred[(y - 1) * w + (x + 1)] +
        blurred[(y + 1) * w + (x - 1)] + 2 * blurred[(y + 1) * w + x] + blurred[(y + 1) * w + (x + 1)];
      edges[y * w + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }

  // Collect strong edge points (skip border region to avoid frame edges)
  const margin = Math.round(Math.min(w, h) * 0.03);
  const threshold = 80;
  const step = 4;
  const edgePoints: [number, number][] = [];
  for (let y = margin; y < h - margin; y += step) {
    for (let x = margin; x < w - margin; x += step) {
      if (edges[y * w + x] > threshold) edgePoints.push([x, y]);
    }
  }
  if (edgePoints.length < 30) return null;

  // Find extreme points per quadrant (distance from respective corner)
  const cx = w / 2, cy = h / 2;
  let bestTL: [number, number] = [cx, cy], bestTR: [number, number] = [cx, cy];
  let bestBL: [number, number] = [cx, cy], bestBR: [number, number] = [cx, cy];
  let dTL = Infinity, dTR = Infinity, dBL = Infinity, dBR = Infinity;

  for (const [px, py] of edgePoints) {
    if (px < cx && py < cy) { const d = px + py; if (d < dTL) { dTL = d; bestTL = [px, py]; } }
    if (px >= cx && py < cy) { const d = (w - px) + py; if (d < dTR) { dTR = d; bestTR = [px, py]; } }
    if (px < cx && py >= cy) { const d = px + (h - py); if (d < dBL) { dBL = d; bestBL = [px, py]; } }
    if (px >= cx && py >= cy) { const d = (w - px) + (h - py); if (d < dBR) { dBR = d; bestBR = [px, py]; } }
  }

  // Validate: quad area must be ≥ 8% of frame
  const area = 0.5 * Math.abs(
    (bestTR[0] - bestTL[0]) * (bestBL[1] - bestTL[1]) -
    (bestBL[0] - bestTL[0]) * (bestTR[1] - bestTL[1]),
  ) + 0.5 * Math.abs(
    (bestBR[0] - bestTR[0]) * (bestBL[1] - bestTR[1]) -
    (bestBL[0] - bestTR[0]) * (bestBR[1] - bestTR[1]),
  );
  if (area < w * h * 0.08) return null;

  // Validate: all sides must be ≥ 10% of respective dimension
  const minSideW = w * 0.1, minSideH = h * 0.1;
  const topW = Math.hypot(bestTR[0] - bestTL[0], bestTR[1] - bestTL[1]);
  const botW = Math.hypot(bestBR[0] - bestBL[0], bestBR[1] - bestBL[1]);
  const leftH = Math.hypot(bestBL[0] - bestTL[0], bestBL[1] - bestTL[1]);
  const rightH = Math.hypot(bestBR[0] - bestTR[0], bestBR[1] - bestTR[1]);
  if (topW < minSideW || botW < minSideW || leftH < minSideH || rightH < minSideH) return null;

  // Validate convexity: cross product of consecutive edges must all be same sign
  const pts = [bestTL, bestTR, bestBR, bestBL];
  let positive = 0, negative = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], c = pts[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross > 0) positive++; else if (cross < 0) negative++;
  }
  if (positive > 0 && negative > 0) return null;

  return { tl: bestTL, tr: bestTR, br: bestBR, bl: bestBL };
}

/* ── Temporal smoothing for live detection ──────────────── */
const SMOOTH_FRAMES = 6;
const SMOOTH_ALPHA = 0.35; // weight for newest frame
function smoothCorners(
  history: Corners[],
  newest: Corners,
): Corners {
  history.push(newest);
  if (history.length > SMOOTH_FRAMES) history.shift();
  if (history.length === 1) return newest;

  // Exponential moving average — newest frames weighted more
  const blend = (key: keyof Corners): [number, number] => {
    let totalW = 0;
    let sx = 0, sy = 0;
    for (let i = 0; i < history.length; i++) {
      const w = Math.pow(SMOOTH_ALPHA, history.length - 1 - i);
      sx += history[i][key][0] * w;
      sy += history[i][key][1] * w;
      totalW += w;
    }
    return [sx / totalW, sy / totalW];
  };
  return { tl: blend("tl"), tr: blend("tr"), br: blend("br"), bl: blend("bl") };
}

/* ── Image enhancement (contrast + sharpening) ──────────── */
function enhanceDocument(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // Auto-levels: find min/max brightness
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  const range = max - min || 1;

  // Contrast stretch + brightness boost
  const factor = 1 + level * 0.4; // 0 = none, 1 = moderate, 2 = strong
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = ((d[i + c] - min) / range) * 255;
      v = ((v - 128) * factor) + 128;
      d[i + c] = Math.max(0, Math.min(255, v));
    }
  }
  ctx.putImageData(img, 0, 0);

  // Unsharp mask (lightweight)
  if (level >= 1) {
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.15 * level;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

/* ── Component ──────────────────────────────────────────── */
export default function DocumentScanner({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const cornerHistoryRef = useRef<Corners[]>([]);

  const [phase, setPhase] = useState<"camera" | "adjust" | "review">("camera");
  const [rawImage, setRawImage] = useState<string | null>(null); // uncropped full frame
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // final cropped
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [enhanceLevel, setEnhanceLevel] = useState(1);
  const [detected, setDetected] = useState(false); // whether live detection found something
  const [adjustCorners, setAdjustCorners] = useState<Corners | null>(null);
  const [dragging, setDragging] = useState<keyof Corners | null>(null);
  const [rawW, setRawW] = useState(0);
  const [rawH, setRawH] = useState(0);
  const [, setTick] = useState(0); // force re-render when adjust image loads
  const [error, setError] = useState("");
  const adjustImgRef = useRef<HTMLImageElement>(null);

  // ── Start camera ──
  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 16 / 9 },
          // @ts-expect-error - focusMode not in TS MediaTrackConstraints types
          focusMode: { ideal: "continuous" },
          whiteBalanceMode: { ideal: "continuous" },
        },
        audio: false,
      });
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() as Record<string, unknown> | undefined;
      setHasTorch(!!caps?.torch);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please grant camera permission.");
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const newVal = !torch;
    try {
      // @ts-expect-error - torch not in standard TS MediaTrackConstraints types
      await track.applyConstraints({ advanced: [{ torch: newVal }] });
      setTorch(newVal);
    } catch { /* no torch support */ }
  }

  async function flipCamera() {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    await startCamera(newFacing);
  }

  // ── Live edge detection with temporal smoothing ──
  useEffect(() => {
    if (phase !== "camera") return;
    let running = true;
    cornerHistoryRef.current = [];
    let noDetectCount = 0;

    function drawOverlay() {
      if (!running) return;
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || video.readyState < 2) {
        animRef.current = requestAnimationFrame(drawOverlay);
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      overlay.width = overlay.clientWidth;
      overlay.height = overlay.clientHeight;
      const ctx = overlay.getContext("2d");
      if (!ctx) { animRef.current = requestAnimationFrame(drawOverlay); return; }

      const tmp = document.createElement("canvas");
      const scale = 0.25;
      tmp.width = Math.round(vw * scale);
      tmp.height = Math.round(vh * scale);
      const tmpCtx = tmp.getContext("2d")!;
      tmpCtx.drawImage(video, 0, 0, tmp.width, tmp.height);

      const raw = detectDocumentEdges(tmpCtx, tmp.width, tmp.height);

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (raw) {
        noDetectCount = 0;
        const smoothed = smoothCorners(cornerHistoryRef.current, raw);
        setDetected(true);

        const sx = overlay.width / vw;
        const sy = overlay.height / vh;
        const invScale = 1 / scale;

        const pts = [smoothed.tl, smoothed.tr, smoothed.br, smoothed.bl].map(
          ([x, y]) => [x * invScale * sx, y * invScale * sy] as [number, number],
        );

        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.closePath();
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(34,197,94,0.08)";
        ctx.fill();

        pts.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = "#22c55e";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      } else {
        noDetectCount++;
        // Only clear detected state after several consecutive misses to avoid flicker
        if (noDetectCount > 5) {
          setDetected(false);
          cornerHistoryRef.current = [];
        }
      }

      animRef.current = requestAnimationFrame(drawOverlay);
    }

    animRef.current = requestAnimationFrame(drawOverlay);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [phase]);

  // ── Capture → go to adjust phase with raw image ──
  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, vw, vh);

    // Save raw (uncropped) image
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setRawImage(rawDataUrl);
    setRawW(vw);
    setRawH(vh);

    // Detect corners on full-res for the adjustment UI
    const tmpCanvas = document.createElement("canvas");
    const scale = 0.25;
    tmpCanvas.width = Math.round(vw * scale);
    tmpCanvas.height = Math.round(vh * scale);
    const tmpCtx = tmpCanvas.getContext("2d")!;
    tmpCtx.drawImage(video, 0, 0, tmpCanvas.width, tmpCanvas.height);
    const smallCorners = detectDocumentEdges(tmpCtx, tmpCanvas.width, tmpCanvas.height);

    const invScale = 1 / scale;
    if (smallCorners) {
      setAdjustCorners({
        tl: [smallCorners.tl[0] * invScale, smallCorners.tl[1] * invScale],
        tr: [smallCorners.tr[0] * invScale, smallCorners.tr[1] * invScale],
        br: [smallCorners.br[0] * invScale, smallCorners.br[1] * invScale],
        bl: [smallCorners.bl[0] * invScale, smallCorners.bl[1] * invScale],
      });
    } else {
      // Default corners: 10% inset rectangle
      const m = 0.1;
      setAdjustCorners({
        tl: [vw * m, vh * m],
        tr: [vw * (1 - m), vh * m],
        br: [vw * (1 - m), vh * (1 - m)],
        bl: [vw * m, vh * (1 - m)],
      });
    }

    setPhase("adjust");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }

  // ── Retake ──
  function handleRetake() {
    setRawImage(null);
    setCapturedImage(null);
    setAdjustCorners(null);
    setPhase("camera");
    cornerHistoryRef.current = [];
    startCamera(facingMode);
  }

  // ── Apply crop from adjusted corners → go to review ──
  function handleApplyCrop() {
    if (!rawImage || !adjustCorners) return;
    const img = new Image();
    img.onload = () => {
      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      const srcCtx = srcCanvas.getContext("2d")!;
      srcCtx.drawImage(img, 0, 0);

      const topW = Math.hypot(adjustCorners.tr[0] - adjustCorners.tl[0], adjustCorners.tr[1] - adjustCorners.tl[1]);
      const botW = Math.hypot(adjustCorners.br[0] - adjustCorners.bl[0], adjustCorners.br[1] - adjustCorners.bl[1]);
      const leftH = Math.hypot(adjustCorners.bl[0] - adjustCorners.tl[0], adjustCorners.bl[1] - adjustCorners.tl[1]);
      const rightH = Math.hypot(adjustCorners.br[0] - adjustCorners.tr[0], adjustCorners.br[1] - adjustCorners.tr[1]);
      const outW = Math.round(Math.max(topW, botW));
      const outH = Math.round(Math.max(leftH, rightH));

      const corrected = perspectiveTransform(srcCtx, img.width, img.height, adjustCorners, outW, outH);
      const outCanvas = document.createElement("canvas");
      outCanvas.width = outW;
      outCanvas.height = outH;
      const outCtx = outCanvas.getContext("2d")!;
      outCtx.putImageData(corrected, 0, 0);

      enhanceDocument(outCtx, outW, outH, enhanceLevel);
      setCapturedImage(outCanvas.toDataURL("image/jpeg", 0.92));
      setPhase("review");
    };
    img.src = rawImage;
  }

  // ── Confirm → create File ──
  function handleConfirm() {
    if (!capturedImage) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      c.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `cert_scan_${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      }, "image/jpeg", 0.92);
    };
    img.src = capturedImage;
  }

  // ── Corner dragging helpers for adjust phase ──
  function handlePointerDown(e: React.PointerEvent) {
    const imgEl = adjustImgRef.current;
    if (!imgEl || !adjustCorners || !rawW) return;
    const rect = imgEl.getBoundingClientRect();
    const scaleX = rect.width / rawW;
    const scaleY = rect.height / rawH;
    const hitRadius = 30;
    const keys: (keyof Corners)[] = ["tl", "tr", "br", "bl"];
    for (const key of keys) {
      const cx = rect.left + adjustCorners[key][0] * scaleX;
      const cy = rect.top + adjustCorners[key][1] * scaleY;
      if (Math.hypot(e.clientX - cx, e.clientY - cy) < hitRadius) {
        setDragging(key);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging || !adjustCorners || !adjustImgRef.current || !rawW) return;
    const rect = adjustImgRef.current.getBoundingClientRect();
    const scaleX = rawW / rect.width;
    const scaleY = rawH / rect.height;
    const nx = Math.max(0, Math.min(rawW, (e.clientX - rect.left) * scaleX));
    const ny = Math.max(0, Math.min(rawH, (e.clientY - rect.top) * scaleY));
    setAdjustCorners({ ...adjustCorners, [dragging]: [nx, ny] });
  }

  function handlePointerUp() {
    setDragging(null);
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-white mb-4">{error}</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  // ── Camera phase ──
  if (phase === "camera") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
          <button onClick={onClose} className="text-white p-1"><X className="h-6 w-6" /></button>
          <span className="text-white text-sm font-medium">Scan Document</span>
          <div className="flex gap-3">
            {hasTorch && (
              <button onClick={toggleTorch} className="text-white p-1">
                {torch ? <Zap className="h-5 w-5 text-yellow-400" /> : <ZapOff className="h-5 w-5" />}
              </button>
            )}
            <button onClick={flipCamera} className="text-white p-1">
              <FlipHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
          />
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          <div className="absolute top-4 left-0 right-0 flex justify-center">
            <span className={`text-xs px-3 py-1 rounded-full backdrop-blur-sm ${detected ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/70"}`}>
              {detected ? "Document detected — tap capture" : "Position document in frame"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 px-4 py-5 bg-black/80">
          <button
            onClick={handleCapture}
            className="h-16 w-16 rounded-full border-4 border-white flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <div className={`h-12 w-12 rounded-full ${detected ? "bg-green-500" : "bg-white"} transition-colors`} />
          </button>
        </div>
      </div>
    );
  }

  // ── Adjust phase: drag corners on raw image ──
  if (phase === "adjust" && rawImage && adjustCorners) {
    // We render the raw image + an SVG overlay with draggable corner handles
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-black/80">
          <button onClick={handleRetake} className="text-white flex items-center gap-1 text-sm">
            <RotateCcw className="h-4 w-4" /> Retake
          </button>
          <span className="text-white text-sm font-medium">Adjust Corners</span>
          <button onClick={handleApplyCrop} className="text-green-400 flex items-center gap-1 text-sm font-semibold">
            <Check className="h-4 w-4" /> Crop
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-2"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={adjustImgRef}
            src={rawImage}
            alt="Adjust crop"
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
            onLoad={() => setTick(t => t + 1)}
          />
          {/* SVG overlay for corners */}
          {adjustImgRef.current && rawW > 0 && (() => {
            const rect = adjustImgRef.current!.getBoundingClientRect();
            const parentRect = adjustImgRef.current!.parentElement!.getBoundingClientRect();
            const scaleX = rect.width / rawW;
            const scaleY = rect.height / rawH;
            const offX = rect.left - parentRect.left;
            const offY = rect.top - parentRect.top;

            const pts = (["tl", "tr", "br", "bl"] as const).map(k => ({
              key: k,
              x: offX + adjustCorners[k][0] * scaleX,
              y: offY + adjustCorners[k][1] * scaleY,
            }));

            return (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                {/* Dimmed area outside the quad */}
                <defs>
                  <mask id="cropMask">
                    <rect width="100%" height="100%" fill="white" />
                    <polygon
                      points={pts.map(p => `${p.x},${p.y}`).join(" ")}
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#cropMask)" />

                {/* Green quad outline */}
                <polygon
                  points={pts.map(p => `${p.x},${p.y}`).join(" ")}
                  fill="rgba(34,197,94,0.06)"
                  stroke="#22c55e"
                  strokeWidth="2"
                />

                {/* Edge midpoint lines for visual guidance */}
                {pts.map((p, i) => {
                  const next = pts[(i + 1) % 4];
                  return (
                    <line key={i}
                      x1={p.x} y1={p.y} x2={next.x} y2={next.y}
                      stroke="#22c55e" strokeWidth="2" strokeDasharray="6 3"
                    />
                  );
                })}

                {/* Corner handles */}
                {pts.map(p => (
                  <g key={p.key}>
                    <circle cx={p.x} cy={p.y} r="14" fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth="2" />
                    <circle cx={p.x} cy={p.y} r="5" fill="#22c55e" />
                    <circle cx={p.x} cy={p.y} r="3" fill="white" />
                  </g>
                ))}
              </svg>
            );
          })()}
        </div>

        <div className="flex items-center justify-center gap-4 px-4 py-3 bg-black/80">
          <Move className="h-4 w-4 text-white/40" />
          <span className="text-white/60 text-xs">Drag corners to fit document edges</span>
        </div>
      </div>
    );
  }

  // ── Review phase: show cropped document ──
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button onClick={() => { setCapturedImage(null); setPhase("adjust"); }} className="text-white flex items-center gap-1 text-sm">
          <RotateCcw className="h-4 w-4" /> Adjust
        </button>
        <span className="text-white text-sm font-medium">Review</span>
        <button onClick={handleConfirm} className="text-green-400 flex items-center gap-1 text-sm font-semibold">
          <Check className="h-4 w-4" /> Use Photo
        </button>
      </div>

      <div className="flex-1 relative overflow-auto flex items-center justify-center p-4">
        {capturedImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedImage} alt="Captured document" className="max-w-full max-h-full object-contain rounded-lg" />
        )}
      </div>

      <div className="flex items-center justify-center gap-4 px-4 py-4 bg-black/80">
        <span className="text-white/50 text-xs">Enhance:</span>
        {[0, 1, 2].map((lvl) => (
          <button
            key={lvl}
            onClick={() => {
              setEnhanceLevel(lvl);
              // Re-crop from raw with new enhancement
              if (!rawImage || !adjustCorners) return;
              const img = new Image();
              img.onload = () => {
                const srcCanvas = document.createElement("canvas");
                srcCanvas.width = img.width; srcCanvas.height = img.height;
                const srcCtx = srcCanvas.getContext("2d")!;
                srcCtx.drawImage(img, 0, 0);

                const topW = Math.hypot(adjustCorners.tr[0] - adjustCorners.tl[0], adjustCorners.tr[1] - adjustCorners.tl[1]);
                const botW = Math.hypot(adjustCorners.br[0] - adjustCorners.bl[0], adjustCorners.br[1] - adjustCorners.bl[1]);
                const leftH = Math.hypot(adjustCorners.bl[0] - adjustCorners.tl[0], adjustCorners.bl[1] - adjustCorners.tl[1]);
                const rightH = Math.hypot(adjustCorners.br[0] - adjustCorners.tr[0], adjustCorners.br[1] - adjustCorners.tr[1]);
                const outW = Math.round(Math.max(topW, botW));
                const outH = Math.round(Math.max(leftH, rightH));

                const corrected = perspectiveTransform(srcCtx, img.width, img.height, adjustCorners, outW, outH);
                const outCanvas = document.createElement("canvas");
                outCanvas.width = outW; outCanvas.height = outH;
                const outCtx = outCanvas.getContext("2d")!;
                outCtx.putImageData(corrected, 0, 0);
                if (lvl > 0) enhanceDocument(outCtx, outW, outH, lvl);
                setCapturedImage(outCanvas.toDataURL("image/jpeg", 0.92));
              };
              img.src = rawImage;
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors ${
              enhanceLevel === lvl ? "bg-white text-black" : "bg-white/10 text-white"
            }`}
          >
            {lvl === 0 && <><Sun className="h-3 w-3" /> Off</>}
            {lvl === 1 && <><Contrast className="h-3 w-3" /> Auto</>}
            {lvl === 2 && <><Contrast className="h-3 w-3" /> Strong</>}
          </button>
        ))}
      </div>
    </div>
  );
}
