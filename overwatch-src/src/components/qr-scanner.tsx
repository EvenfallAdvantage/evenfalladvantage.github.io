"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, X, SwitchCamera } from "lucide-react";
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
  const mountedRef = useRef(true);
  const scannedRef = useRef(false);

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

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    cleanup();
    setError(null);
    setScanning(false);
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

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
          }, 200);
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
        // Ensure container exists
        if (!document.getElementById(scannerId)) {
          setError("Scanner container missing.");
          return;
        }
        const scanner = new Html5Qrcode(scannerId);
        html5ScannerRef.current = scanner;
        await scanner.start(
          { facingMode: facing },
          { fps: 10, qrbox: { width: 250, height: 250 } },
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
  }, [cleanup, handleDetected]);

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
        <div className="flex items-center gap-2">
          {hasMultipleCameras && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white hover:bg-white/10" onClick={handleSwitchCamera}>
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
                <div className="w-64 h-64 sm:w-72 sm:h-72 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                  <div className="absolute left-2 right-2 h-0.5 bg-emerald-400/80 animate-pulse" style={{ top: "50%", boxShadow: "0 0 8px rgba(52, 211, 153, 0.6)" }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 bg-black/80 text-center">
        <p className="text-[11px] text-white/50">Point camera at a QR code or barcode</p>
      </div>
    </div>
  );
}
