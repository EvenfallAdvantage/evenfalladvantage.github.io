"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCcw, Check, FlipHorizontal, Zap, ZapOff, Sun, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

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

/* ── Simple edge detection to find document rectangle ───── */
function detectDocumentEdges(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): { tl: [number, number]; tr: [number, number]; br: [number, number]; bl: [number, number] } | null {
  const img = ctx.getImageData(0, 0, w, h);
  const gray = new Uint8Array(w * h);

  // Convert to grayscale
  for (let i = 0; i < w * h; i++) {
    gray[i] = Math.round(
      img.data[i * 4] * 0.299 + img.data[i * 4 + 1] * 0.587 + img.data[i * 4 + 2] * 0.114,
    );
  }

  // Sobel edge detection
  const edges = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)] +
        -2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)] +
        -gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
      const gy =
        -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)] +
        gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
      edges[y * w + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }

  // Find edge points along scan lines, collect strong edges
  const threshold = 60;
  const edgePoints: [number, number][] = [];
  const step = 4;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (edges[y * w + x] > threshold) edgePoints.push([x, y]);
    }
  }

  if (edgePoints.length < 20) return null;

  // Find convex hull approximation via extreme points per quadrant
  const cx = w / 2;
  const cy = h / 2;
  let bestTL: [number, number] = [w, h], bestTR: [number, number] = [0, h];
  let bestBL: [number, number] = [w, 0], bestBR: [number, number] = [0, 0];
  let dTL = Infinity, dTR = Infinity, dBL = Infinity, dBR = Infinity;

  for (const [px, py] of edgePoints) {
    if (px < cx && py < cy) {
      const d = px + py;
      if (d < dTL) { dTL = d; bestTL = [px, py]; }
    }
    if (px >= cx && py < cy) {
      const d = (w - px) + py;
      if (d < dTR) { dTR = d; bestTR = [px, py]; }
    }
    if (px < cx && py >= cy) {
      const d = px + (h - py);
      if (d < dBL) { dBL = d; bestBL = [px, py]; }
    }
    if (px >= cx && py >= cy) {
      const d = (w - px) + (h - py);
      if (d < dBR) { dBR = d; bestBR = [px, py]; }
    }
  }

  // Validate: corners should form a reasonable quadrilateral
  const minArea = w * h * 0.05;
  const area = 0.5 * Math.abs(
    (bestTR[0] - bestTL[0]) * (bestBL[1] - bestTL[1]) -
    (bestBL[0] - bestTL[0]) * (bestTR[1] - bestTL[1]),
  ) + 0.5 * Math.abs(
    (bestBR[0] - bestTR[0]) * (bestBL[1] - bestTR[1]) -
    (bestBL[0] - bestTR[0]) * (bestBR[1] - bestTR[1]),
  );

  if (area < minArea) return null;

  return { tl: bestTL, tr: bestTR, br: bestBR, bl: bestBL };
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

  const [phase, setPhase] = useState<"camera" | "review">("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [enhanceLevel, setEnhanceLevel] = useState(1);
  const [corners, setCorners] = useState<ReturnType<typeof detectDocumentEdges>>(null);
  const [error, setError] = useState("");

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

      // Check torch capability
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

  // ── Torch toggle ──
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

  // ── Flip camera ──
  async function flipCamera() {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    await startCamera(newFacing);
  }

  // ── Live edge detection overlay ──
  useEffect(() => {
    if (phase !== "camera") return;
    let running = true;

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

      // Draw scaled video to offscreen canvas for analysis
      const tmp = document.createElement("canvas");
      const scale = 0.25; // analyze at quarter res for speed
      tmp.width = Math.round(vw * scale);
      tmp.height = Math.round(vh * scale);
      const tmpCtx = tmp.getContext("2d")!;
      tmpCtx.drawImage(video, 0, 0, tmp.width, tmp.height);

      const detected = detectDocumentEdges(tmpCtx, tmp.width, tmp.height);
      setCorners(detected);

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (detected) {
        // Scale corners back to overlay dimensions
        const sx = overlay.width / vw;
        const sy = overlay.height / vh;
        const invScale = 1 / scale;

        const pts = [detected.tl, detected.tr, detected.br, detected.bl].map(
          ([x, y]) => [x * invScale * sx, y * invScale * sy] as [number, number],
        );

        // Green document outline
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.closePath();
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(34,197,94,0.08)";
        ctx.fill();

        // Corner dots
        pts.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = "#22c55e";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }

      animRef.current = requestAnimationFrame(drawOverlay);
    }

    animRef.current = requestAnimationFrame(drawOverlay);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [phase]);

  // ── Capture ──
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

    // If edges detected, do perspective correction
    const detected = detectDocumentEdges(ctx, vw, vh);
    if (detected) {
      // Scale corners from detection resolution — we drew at full res here
      const tmpCanvas = document.createElement("canvas");
      const scale = 0.25;
      tmpCanvas.width = Math.round(vw * scale);
      tmpCanvas.height = Math.round(vh * scale);
      const tmpCtx = tmpCanvas.getContext("2d")!;
      tmpCtx.drawImage(video, 0, 0, tmpCanvas.width, tmpCanvas.height);
      const smallCorners = detectDocumentEdges(tmpCtx, tmpCanvas.width, tmpCanvas.height);

      if (smallCorners) {
        const invScale = 1 / scale;
        const fullCorners = {
          tl: [smallCorners.tl[0] * invScale, smallCorners.tl[1] * invScale] as [number, number],
          tr: [smallCorners.tr[0] * invScale, smallCorners.tr[1] * invScale] as [number, number],
          br: [smallCorners.br[0] * invScale, smallCorners.br[1] * invScale] as [number, number],
          bl: [smallCorners.bl[0] * invScale, smallCorners.bl[1] * invScale] as [number, number],
        };

        // Calculate output dimensions from corner distances
        const topW = Math.hypot(fullCorners.tr[0] - fullCorners.tl[0], fullCorners.tr[1] - fullCorners.tl[1]);
        const botW = Math.hypot(fullCorners.br[0] - fullCorners.bl[0], fullCorners.br[1] - fullCorners.bl[1]);
        const leftH = Math.hypot(fullCorners.bl[0] - fullCorners.tl[0], fullCorners.bl[1] - fullCorners.tl[1]);
        const rightH = Math.hypot(fullCorners.br[0] - fullCorners.tr[0], fullCorners.br[1] - fullCorners.tr[1]);
        const outW = Math.round(Math.max(topW, botW));
        const outH = Math.round(Math.max(leftH, rightH));

        const corrected = perspectiveTransform(ctx, vw, vh, fullCorners, outW, outH);
        canvas.width = outW;
        canvas.height = outH;
        ctx.putImageData(corrected, 0, 0);
      }
    }

    // Apply enhancement
    enhanceDocument(ctx, canvas.width, canvas.height, enhanceLevel);

    setCapturedImage(canvas.toDataURL("image/jpeg", 0.92));
    setPhase("review");

    // Stop camera stream while reviewing
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }

  // ── Retake ──
  function handleRetake() {
    setCapturedImage(null);
    setPhase("camera");
    startCamera(facingMode);
  }

  // ── Confirm → create File and pass up ──
  function handleConfirm() {
    if (!capturedImage) return;
    // Apply current enhancement level to captured image
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      enhanceDocument(ctx, c.width, c.height, enhanceLevel);

      c.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `cert_scan_${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      }, "image/jpeg", 0.92);
    };
    img.src = capturedImage;
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
        {/* Top bar */}
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

        {/* Video + overlay */}
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
          {/* Guide text */}
          <div className="absolute top-4 left-0 right-0 flex justify-center">
            <span className={`text-xs px-3 py-1 rounded-full backdrop-blur-sm ${corners ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/70"}`}>
              {corners ? "Document detected — tap capture" : "Position document in frame"}
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-center gap-6 px-4 py-5 bg-black/80">
          <button
            onClick={handleCapture}
            className="h-16 w-16 rounded-full border-4 border-white flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <div className={`h-12 w-12 rounded-full ${corners ? "bg-green-500" : "bg-white"} transition-colors`} />
          </button>
        </div>
      </div>
    );
  }

  // ── Review phase ──
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button onClick={handleRetake} className="text-white flex items-center gap-1 text-sm">
          <RotateCcw className="h-4 w-4" /> Retake
        </button>
        <span className="text-white text-sm font-medium">Review</span>
        <button onClick={handleConfirm} className="text-green-400 flex items-center gap-1 text-sm font-semibold">
          <Check className="h-4 w-4" /> Use Photo
        </button>
      </div>

      {/* Image preview */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center p-4">
        {capturedImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedImage} alt="Captured document" className="max-w-full max-h-full object-contain rounded-lg" />
        )}
      </div>

      {/* Enhancement controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 bg-black/80">
        <span className="text-white/50 text-xs">Enhance:</span>
        {[0, 1, 2].map((lvl) => (
          <button
            key={lvl}
            onClick={() => {
              setEnhanceLevel(lvl);
              // Re-enhance from original capture
              if (!capturedImage) return;
              const img = new Image();
              img.onload = () => {
                const c = document.createElement("canvas");
                c.width = img.width; c.height = img.height;
                const ctx = c.getContext("2d")!;
                ctx.drawImage(img, 0, 0);
                if (lvl > 0) enhanceDocument(ctx, c.width, c.height, lvl);
                setCapturedImage(c.toDataURL("image/jpeg", 0.92));
              };
              img.src = capturedImage;
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
