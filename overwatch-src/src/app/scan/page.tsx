"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera, XCircle, LogIn, LogOut,
  ChevronDown, ChevronUp, Users, Clock, WifiOff, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import {
  lookupBadge, isUserClockedIn, qrClockIn, qrClockOut,
  getClockedInStaff, massClockOut,
} from "@/lib/supabase/db-badges";
import { getEvents } from "@/lib/supabase/db-operations";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

// ── Types ──

type ScanResult = {
  status: "success" | "error" | "ignored";
  action: "clock_in" | "clock_out";
  name: string;
  avatarUrl: string | null;
  message: string;
} | null;

type ClockedInEntry = {
  id: string;
  user_id: string;
  clock_in: string;
  event_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: any;
};

type QueuedScan = {
  uid: string;
  cid: string;
  bn: string;
  ts: number;
  eventId: string | null;
};

// ── Audio Feedback ──

function playTone(type: "in" | "out" | "error" | "ignored") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.3;
    if (type === "in") {
      osc.frequency.value = 880;
    } else if (type === "out") {
      osc.frequency.value = 440;
    } else if (type === "ignored") {
      osc.frequency.value = 300;
      gain.gain.value = 0.15;
    } else {
      osc.frequency.value = 200;
    }
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    navigator.vibrate?.(type === "error" ? 400 : 200);
  } catch { /* audio not available */ }
}

// ── Constants ──

const RESULT_DISPLAY_MS = 1500;
const PER_BADGE_COOLDOWN_MS = 30_000;
const CLOCKED_IN_REFRESH_MS = 10_000;
const EVENT_STORAGE_KEY = "scan-selected-event";

// ── Component ──

export default function ScanPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const setHeader = usePageHeader((s) => s.setHeader);

  useEffect(() => {
    setHeader("MASS CLOCK", "Scan badges for rapid clock in/out");
  }, [setHeader]);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const lastScanRef = useRef("");

  // Per-badge cooldown map: qrData → timestamp of last scan
  const badgeCooldownRef = useRef<Map<string, number>>(new Map());

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [scanCount, setScanCount] = useState(0);

  // Event selector
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventName, setSelectedEventName] = useState<string>("No event selected");

  // Live clocked-in panel
  const [clockedIn, setClockedIn] = useState<ClockedInEntry[]>([]);
  const [showClockedIn, setShowClockedIn] = useState(true);
  const [clockingOutAll, setClockingOutAll] = useState(false);

  // Offline queue
  const [offlineQueue, setOfflineQueue] = useState<QueuedScan[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // ── jsQR dynamic import ──
  const jsQRRef = useRef<((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null>(null);

  useEffect(() => {
    import("jsqr").then((mod) => { jsQRRef.current = mod.default; });
  }, []);

  // ── Load events for selector ──
  useEffect(() => {
    if (!activeCompanyId) return;
    getEvents(activeCompanyId).then((evts) => {
      const active = evts.filter((e: { status: string }) => e.status !== "closed" && e.status !== "cancelled");
      setEvents(active);
      // Restore last selected event
      const saved = localStorage.getItem(EVENT_STORAGE_KEY);
      if (saved) {
        const match = active.find((e: { id: string }) => e.id === saved);
        if (match) {
          setSelectedEventId(match.id);
          setSelectedEventName(match.name);
        }
      }
    });
  }, [activeCompanyId]);

  // ── Load clocked-in staff ──
  const refreshClockedIn = useCallback(async () => {
    if (!activeCompanyId) return;
    const data = await getClockedInStaff(activeCompanyId);
    setClockedIn(data);
  }, [activeCompanyId]);

  useEffect(() => { void refreshClockedIn(); }, [refreshClockedIn]);

  // Auto-refresh every 10s
  useEffect(() => {
    const iv = setInterval(refreshClockedIn, CLOCKED_IN_REFRESH_MS);
    return () => clearInterval(iv);
  }, [refreshClockedIn]);

  // ── Online/offline detection ──
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    setIsOnline(navigator.onLine);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // ── Retry offline queue when back online ──
  useEffect(() => {
    if (!isOnline || offlineQueue.length === 0 || !activeCompanyId) return;
    (async () => {
      const queue = [...offlineQueue];
      setOfflineQueue([]);
      let retried = 0;
      for (const item of queue) {
        try {
          await qrClockIn(item.uid, item.cid, item.eventId ?? undefined);
          retried++;
        } catch {
          // If retry fails, put it back
          setOfflineQueue((prev) => [...prev, item]);
        }
      }
      if (retried > 0) {
        toast.success(`Retried ${retried} queued scan${retried > 1 ? "s" : ""}`);
        refreshClockedIn();
      }
    })();
  }, [isOnline, offlineQueue, activeCompanyId, selectedEventId, refreshClockedIn]);

  // ── Camera controls ──

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

  // ── Scan handler ──

  async function handleScan(qrData: string) {
    if (processing || !activeCompanyId) return;

    // Per-badge cooldown check
    const lastScanTime = badgeCooldownRef.current.get(qrData);
    if (lastScanTime && Date.now() - lastScanTime < PER_BADGE_COOLDOWN_MS) {
      const secsLeft = Math.ceil((PER_BADGE_COOLDOWN_MS - (Date.now() - lastScanTime)) / 1000);
      setResult({ status: "ignored", action: "clock_in", name: "", avatarUrl: null, message: `Already scanned — wait ${secsLeft}s` });
      playTone("ignored");
      setTimeout(() => { lastScanRef.current = ""; setResult(null); }, RESULT_DISPLAY_MS);
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const lookup = await lookupBadge(qrData);
      if (!lookup) {
        setResult({ status: "error", action: "clock_in", name: "", avatarUrl: null, message: "Invalid or revoked badge" });
        playTone("error");
        setProcessing(false);
        setTimeout(() => { lastScanRef.current = ""; setResult(null); }, RESULT_DISPLAY_MS);
        return;
      }

      const { badge, user } = lookup;
      const name = `${user.first_name} ${user.last_name}`.trim();

      // Verify badge belongs to the scanner's active company
      if (badge.company_id !== activeCompanyId) {
        setResult({ status: "error", action: "clock_in", name, avatarUrl: user.avatar_url, message: `Wrong company badge` });
        playTone("error");
        setProcessing(false);
        setTimeout(() => { lastScanRef.current = ""; setResult(null); }, RESULT_DISPLAY_MS);
        return;
      }

      const clockedInNow = await isUserClockedIn(badge.user_id, activeCompanyId);

      if (clockedInNow) {
        await qrClockOut(badge.user_id, activeCompanyId);
        setResult({ status: "success", action: "clock_out", name, avatarUrl: user.avatar_url, message: `${name} clocked out` });
        playTone("out");
      } else {
        await qrClockIn(badge.user_id, activeCompanyId, selectedEventId ?? undefined);
        setResult({ status: "success", action: "clock_in", name, avatarUrl: user.avatar_url, message: `${name} clocked in` });
        playTone("in");
      }

      // Record this badge in cooldown map
      badgeCooldownRef.current.set(qrData, Date.now());
      setScanCount((c) => c + 1);
      refreshClockedIn();

      setTimeout(() => { lastScanRef.current = ""; setResult(null); }, RESULT_DISPLAY_MS);
    } catch (err) {
      // Only queue offline if actually offline — otherwise show the real error
      if (!navigator.onLine) {
        try {
          const parsed = JSON.parse(qrData);
          if (parsed.uid && parsed.cid) {
            setOfflineQueue((prev) => [...prev, { uid: parsed.uid, cid: parsed.cid, bn: parsed.bn, ts: Date.now(), eventId: selectedEventId }]);
            badgeCooldownRef.current.set(qrData, Date.now());
            setResult({ status: "success", action: "clock_in", name: parsed.bn || "Unknown", avatarUrl: null, message: `Queued — will retry when online` });
            playTone("in");
            setScanCount((c) => c + 1);
          } else {
            throw new Error("invalid qr");
          }
        } catch {
          setResult({ status: "error", action: "clock_in", name: "", avatarUrl: null, message: "Scan failed — no connection" });
          playTone("error");
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = err instanceof Error ? err.message : typeof err === "object" && err !== null ? (err as any).message ?? JSON.stringify(err) : String(err);
        const msg = raw.includes("row-level") || raw.includes("policy") ? "Permission denied — check your role" : raw;
        setResult({ status: "error", action: "clock_in", name: "", avatarUrl: null, message: msg });
        playTone("error");
      }
      setTimeout(() => { lastScanRef.current = ""; setResult(null); }, RESULT_DISPLAY_MS);
    }

    setProcessing(false);
  }

  // ── Event selection handler ──
  function handleEventChange(eventId: string) {
    if (eventId === "__none__") {
      setSelectedEventId(null);
      setSelectedEventName("No event selected");
      localStorage.removeItem(EVENT_STORAGE_KEY);
    } else {
      const ev = events.find((e) => e.id === eventId);
      setSelectedEventId(eventId);
      setSelectedEventName(ev?.name ?? "Unknown");
      localStorage.setItem(EVENT_STORAGE_KEY, eventId);
    }
  }

  // ── Mass clock-out handler ──
  async function handleMassClockOut() {
    if (!activeCompanyId) return;
    const count = clockedIn.length;
    if (!confirm(`Clock out all ${count} staff${selectedEventName !== "No event selected" ? ` for ${selectedEventName}` : ""}?`)) return;
    setClockingOutAll(true);
    try {
      const result = await massClockOut(activeCompanyId, selectedEventId);
      toast.success(`Clocked out ${result} staff`);
      refreshClockedIn();
    } catch {
      toast.error("Mass clock-out failed");
    }
    setClockingOutAll(false);
  }

  // ── Render ──

  return (
    <div className="max-w-lg mx-auto space-y-4">

      {/* Offline banner */}
      {(!isOnline || offlineQueue.length > 0) && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2">
          <WifiOff className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            {!isOnline ? "Offline" : "Back online"}{" "}
            {offlineQueue.length > 0 && `— ${offlineQueue.length} scan${offlineQueue.length > 1 ? "s" : ""} queued`}
          </p>
        </div>
      )}

      {/* Event selector */}
      <div className="rounded-lg border border-border/30 p-3">
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Event / Operation</label>
        <select
          value={selectedEventId ?? "__none__"}
          onChange={(e) => handleEventChange(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="__none__">No event (general clock)</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        {!selectedEventId && events.length > 0 && (
          <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Select an event so timesheets group correctly
          </p>
        )}
      </div>

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
            result.status === "success"
              ? result.action === "clock_in" ? "bg-green-900/80" : "bg-amber-900/80"
              : result.status === "ignored" ? "bg-zinc-900/80" : "bg-red-900/80"
          }`}>
            {result.avatarUrl && (
              <Avatar className="h-16 w-16 mb-3 border-2 border-white/30">
                <AvatarImage src={result.avatarUrl} />
                <AvatarFallback className="text-lg">{result.name[0]}</AvatarFallback>
              </Avatar>
            )}
            {result.status === "success" ? (
              result.action === "clock_in" ? (
                <LogIn className="h-10 w-10 text-green-400 mb-2" />
              ) : (
                <LogOut className="h-10 w-10 text-amber-400 mb-2" />
              )
            ) : result.status === "ignored" ? (
              <Clock className="h-10 w-10 text-zinc-400 mb-2" />
            ) : (
              <XCircle className="h-10 w-10 text-red-400 mb-2" />
            )}
            <p className="text-white font-semibold text-lg text-center px-4">{result.message}</p>
            <p className="text-white/50 text-xs mt-1">{new Date().toLocaleTimeString()}</p>
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

      {/* ── Live Clocked-In Panel ── */}
      <div className="rounded-lg border border-border/30 overflow-hidden">
        <button
          onClick={() => setShowClockedIn(!showClockedIn)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Currently Clocked In</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
              {clockedIn.length}
            </span>
          </div>
          {showClockedIn ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showClockedIn && (
          <div className="border-t border-border/30">
            {clockedIn.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No staff currently clocked in</p>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto divide-y divide-border/20">
                  {clockedIn.map((entry) => {
                    const u = entry.users;
                    const name = `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() || "Unknown";
                    const clockInDate = new Date(entry.clock_in);
                    const elapsedMs = Date.now() - clockInDate.getTime();
                    const hrs = Math.floor(elapsedMs / 3600000);
                    const mins = Math.floor((elapsedMs % 3600000) / 60000);
                    return (
                      <div key={entry.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm font-medium">{name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            In at {clockInDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Mass clock-out button */}
                <div className="p-3 border-t border-border/30">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={handleMassClockOut}
                    disabled={clockingOutAll}
                  >
                    {clockingOutAll ? (
                      <Clock className="h-3.5 w-3.5 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="h-3.5 w-3.5 mr-2" />
                    )}
                    Clock Out All ({clockedIn.length})
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
