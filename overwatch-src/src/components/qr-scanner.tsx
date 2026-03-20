"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, X, SwitchCamera, Flashlight, FlashlightOff, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
}

export default function QrScanner({ onScan, onClose, title = "Scan QR / Barcode", hint }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5ScannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const mountedRef = useRef(true);
  const scannedRef = useRef(false);

  // Get the active video track for applying constraints
  const getVideoTrack = useCallback(() => {
    return streamRef.current?.getVideoTracks()[0] ?? null;
  }, []);

  const cleanup = useCallback(() => {
    if (scannerRef.current) {
      clearInterval(scannerRef.current);
      scannerRef.current = null;
    }
    if (html5ScannerRef.current) {
      try { html5ScannerRef.current.stop().catch(() => {}); } catch { /* ignore */ }
      html5ScannerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleDetected = useCallback((value: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    cleanup();
    onScan(value);
  }, [cleanup, onScan]);

  // Apply autofocus, zoom, and detect torch capability after stream starts
  const applyAdvancedConstraints = useCallback(async (track: MediaStreamTrack) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = track.getCapabilities() as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const constraints: any = {};

      // Enable continuous autofocus (critical for close-up QR scanning)
      if (caps.focusMode?.includes("continuous")) {
        constraints.focusMode = "continuous";
      }

      // Apply 2x zoom so small QR codes are readable without getting ultra-close
      if (caps.zoom) {
        const max = caps.zoom.max ?? 1;
        const idealZoom = Math.min(2, max);
        constraints.zoom = idealZoom;
        if (mountedRef.current) {
          setMaxZoom(max);
          setZoomLevel(idealZoom);
        }
      }

      if (Object.keys(constraints).length > 0) {
        await track.applyConstraints({ advanced: [constraints] });
      }

      // Detect torch capability
      if (caps.torch) {
        if (mountedRef.current) setHasTorch(true);
      }
    } catch {
      // Advanced constraints not supported — camera still works
    }
  }, []);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    cleanup();
    setError(null);
    setScanning(false);
    setTorchOn(false);
    setHasTorch(false);
    setZoomLevel(1);
    setMaxZoom(1);
    scannedRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera not supported on this device/browser.");
      return;
    }

    // Check for multiple cameras
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      if (mountedRef.current) setHasMultipleCameras(cameras.length > 1);
    } catch { /* ignore */ }

    // Prefer native BarcodeDetector (Chrome/Edge/Android, Safari 17.2+)
    const hasNative = "BarcodeDetector" in window;

    if (hasNative) {
      try {
        // Request high resolution for better barcode detection
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        if (track) await applyAdvancedConstraints(track);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (mountedRef.current) setScanning(true);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const BD = (window as any).BarcodeDetector;
          const detector = new BD({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"] });
          scannerRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2 || scannedRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue && mountedRef.current) {
                handleDetected(barcodes[0].rawValue);
              }
            } catch { /* frame error */ }
          }, 150);
        }
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        handleCameraError(err as Error);
      }
    } else {
      // Fallback: html5-qrcode manages its own video element
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scannerId = "qr-scanner-fallback";
        if (!document.getElementById(scannerId)) {
          setError("Scanner container missing.");
          return;
        }
        const scanner = new Html5Qrcode(scannerId);
        html5ScannerRef.current = scanner;
        await scanner.start(
          { facingMode: facing },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decodedText: string) => {
            if (mountedRef.current) handleDetected(decodedText);
          },
          () => { /* ignore scan failures */ },
        );
        if (mountedRef.current) setScanning(true);
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        handleCameraError(err as Error);
      }
    }
  }, [cleanup, handleDetected, applyAdvancedConstraints]);

  function handleCameraError(e: Error) {
    if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
      setError("Camera permission denied. Please allow camera access in your browser settings and try again.");
    } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
      setError("No camera found on this device.");
    } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
      setError("Camera is in use by another app. Close other apps using the camera and try again.");
    } else if (e.name === "OverconstrainedError") {
      // Retry without constraint
      navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(async (fallback) => {
        if (!mountedRef.current) { fallback.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = fallback;
        const track = fallback.getVideoTracks()[0];
        if (track) await applyAdvancedConstraints(track);
        if (videoRef.current) {
          videoRef.current.srcObject = fallback;
          await videoRef.current.play();
          setScanning(true);
        }
      }).catch(() => setError("Could not access camera."));
    } else {
      setError(`Camera error: ${e.message || "Unknown error"}`);
    }
  }

  // Toggle torch/flashlight
  async function toggleTorch() {
    const track = getVideoTrack();
    if (!track) return;
    const next = !torchOn;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch { /* torch not supported */ }
  }

  // Adjust zoom
  async function adjustZoom(delta: number) {
    const track = getVideoTrack();
    if (!track) return;
    const next = Math.max(1, Math.min(maxZoom, zoomLevel + delta));
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await track.applyConstraints({ advanced: [{ zoom: next } as any] });
      setZoomLevel(next);
    } catch { /* zoom not supported */ }
  }

  useEffect(() => {
    mountedRef.current = true;
    startCamera(facingMode);
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  function handleSwitchCamera() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  const hasNative = typeof window !== "undefined" && "BarcodeDetector" in window;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {hint && <p className="text-[10px] text-white/60">{hint}</p>}
        </div>
        <div className="flex items-center gap-1">
          {hasTorch && (
            <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 hover:bg-white/10 ${torchOn ? "text-amber-400" : "text-white"}`} onClick={toggleTorch} title="Toggle flashlight">
              {torchOn ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
            </Button>
          )}
          {maxZoom > 1 && (
            <>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white hover:bg-white/10" onClick={() => adjustZoom(-0.5)} disabled={zoomLevel <= 1} title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-[10px] text-white/70 w-8 text-center">{zoomLevel.toFixed(1)}x</span>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white hover:bg-white/10" onClick={() => adjustZoom(0.5)} disabled={zoomLevel >= maxZoom} title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </>
          )}
          {hasMultipleCameras && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white hover:bg-white/10" onClick={handleSwitchCamera} title="Switch camera">
              <SwitchCamera className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white hover:bg-white/10" onClick={() => { cleanup(); onClose(); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <CameraOff className="h-12 w-12 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
            <Button size="sm" variant="outline" className="text-white border-white/30 hover:bg-white/10"
              onClick={() => startCamera(facingMode)}>
              <Camera className="h-3.5 w-3.5 mr-1.5" /> Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Native BarcodeDetector path: we manage the <video> ourselves */}
            {hasNative && (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
            )}
            {/* html5-qrcode fallback: it renders into this div */}
            {!hasNative && (
              <div id="qr-scanner-fallback" className="w-full h-full" />
            )}
            {/* Scan overlay */}
            {scanning && hasNative && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-72 sm:w-80 sm:h-80 relative">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-3 border-r-3 border-emerald-400 rounded-br-xl" />
                  <div className="absolute left-3 right-3 h-0.5 bg-emerald-400/80 animate-pulse" style={{ top: "50%", boxShadow: "0 0 12px rgba(52, 211, 153, 0.7)" }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 bg-black/80 text-center">
        <p className="text-[11px] text-white/50">
          {scanning ? "Hold steady — autofocus enabled" : "Starting camera…"}
        </p>
      </div>
    </div>
  );
}
