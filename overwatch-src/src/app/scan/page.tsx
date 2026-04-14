"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CheckCircle2, XCircle, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { lookupBadge, isUserClockedIn, qrClockIn, qrClockOut } from "@/lib/supabase/db-badges";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type ScanResult = {
  status: "success" | "error";
  action: "clock_in" | "clock_out";
  name: string;
  avatarUrl: string | null;
  message: string;
} | null;

export default function ScanPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const setHeader = usePageHeader((s) => s.setHeader);

  useEffect(() => {
    setHeader("QR Scanner", "Scan staff badges to clock in/out");
  }, [setHeader]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const lastScanRef = useRef("");

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [scanCount, setScanCount] = useState(0);

  // Dynamically import jsQR (it's a large library)
  const jsQRRef = useRef<((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null>(null);

  useEffect(() => {
    import("jsqr").then((mod) => {
      jsQRRef.current = mod.default;
    });
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      scanningRef.current = true;
      scanLoop();
    } catch {
      setCameraError("Camera access denied. Please allow camera permissions.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scanLoop uses only refs and is stable
  }, []);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  function scanLoop() {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const jsQR = jsQRRef.current;
    if (!video || !canvas || !jsQR || video.readyState < 2) {
      requestAnimationFrame(scanLoop);
      return;
    }

    const ctx = canvas.getContext("2d")!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);

    if (code && code.data && code.data !== lastScanRef.current) {
      lastScanRef.current = code.data;
      handleScan(code.data);
    }

    requestAnimationFrame(scanLoop);
  }

  async function handleScan(qrData: string) {
    if (processing || !activeCompanyId) return;
    setProcessing(true);
    setResult(null);

    try {
      const lookup = await lookupBadge(qrData);
      if (!lookup) {
        setResult({ status: "error", action: "clock_in", name: "", avatarUrl: null, message: "Invalid or revoked badge" });
        setProcessing(false);
        // Reset after 3s to allow re-scan
        setTimeout(() => { lastScanRef.current = ""; setResult(null); }, 3000);
        return;
      }

      const { badge, user } = lookup;
      const name = `${user.first_name} ${user.last_name}`.trim();
      const clockedIn = await isUserClockedIn(badge.user_id, badge.company_id);

      if (clockedIn) {
        await qrClockOut(badge.user_id, badge.company_id);
        setResult({ status: "success", action: "clock_out", name, avatarUrl: user.avatar_url, message: `${name} clocked out` });
      } else {
        await qrClockIn(badge.user_id, badge.company_id);
        setResult({ status: "success", action: "clock_in", name, avatarUrl: user.avatar_url, message: `${name} clocked in` });
      }

      setScanCount((c) => c + 1);

      // Reset after 3s to allow next scan
      setTimeout(() => {
        lastScanRef.current = "";
        setResult(null);
      }, 3000);
    } catch {
      setResult({ status: "error", action: "clock_in", name: "", avatarUrl: null, message: "Scan failed — try again" });
      setTimeout(() => { lastScanRef.current = ""; setResult(null); }, 3000);
    }

    setProcessing(false);
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Camera viewport */}
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black border border-border/30">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlay */}
        {cameraActive && !result && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-white/40 rounded-2xl" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)" }} />
            <span className="absolute bottom-6 text-white/60 text-xs font-mono">
              {processing ? "Processing..." : "Align QR code in frame"}
            </span>
          </div>
        )}

        {/* Result overlay */}
        {result && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${
            result.status === "success" ? "bg-green-900/80" : "bg-red-900/80"
          }`}>
            {result.avatarUrl && (
              <Avatar className="h-16 w-16 mb-3 border-2 border-white/30">
                <AvatarImage src={result.avatarUrl} />
                <AvatarFallback className="text-lg">{result.name[0]}</AvatarFallback>
              </Avatar>
            )}
            {result.status === "success" ? (
              <>
                {result.action === "clock_in" ? (
                  <LogIn className="h-10 w-10 text-green-400 mb-2" />
                ) : (
                  <LogOut className="h-10 w-10 text-amber-400 mb-2" />
                )}
                <CheckCircle2 className="h-6 w-6 text-green-400 mb-1" />
              </>
            ) : (
              <XCircle className="h-10 w-10 text-red-400 mb-2" />
            )}
            <p className="text-white font-semibold text-lg">{result.message}</p>
            <p className="text-white/50 text-xs mt-1">
              {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}

        {/* Camera inactive state */}
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50">
            <Camera className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Camera not active</p>
            {cameraError && <p className="text-red-400 text-xs mt-2 px-4 text-center">{cameraError}</p>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {scanCount > 0 ? `${scanCount} scan${scanCount !== 1 ? "s" : ""} this session` : "Ready to scan"}
          </p>
        </div>
        {!cameraActive ? (
          <Button onClick={startCamera}>
            <Camera className="h-4 w-4 mr-2" /> Start Scanner
          </Button>
        ) : (
          <Button variant="outline" onClick={stopCamera}>
            Stop Scanner
          </Button>
        )}
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-border/30 p-4 space-y-2">
        <h3 className="text-sm font-semibold">How it works</h3>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Click &quot;Start Scanner&quot; to activate the camera</li>
          <li>Hold a staff member&apos;s QR badge in front of the camera</li>
          <li>The system auto-detects the QR code and processes the scan</li>
          <li>If the staff member is clocked in → clocks them out</li>
          <li>If the staff member is clocked out → clocks them in</li>
          <li>A confirmation shows for 3 seconds, then the scanner is ready for the next badge</li>
        </ol>
      </div>
    </div>
  );
}
