"use client";

import { useState } from "react";
import { useSdr } from "@/hooks/use-sdr";
import { Radio, Loader2, Wifi, WifiOff, Signal, Ear, CheckCircle, XCircle, Clock, List, X, Radar, AlertTriangle, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Waterfall } from "@/components/waterfall";
import { ScannerTab } from "./scanner-tab";

const FM_BANDS = [
  { min: 25000000, max: 54000000, label: "VHF-Lo", color: "bg-red-500/10 text-red-600" },
  { min: 108000000, max: 174000000, label: "VHF-Hi", color: "bg-green-500/10 text-green-600" },
  { min: 380000000, max: 512000000, label: "UHF", color: "bg-blue-500/10 text-blue-600" },
  { min: 762000000, max: 870000000, label: "800", color: "bg-orange-500/10 text-orange-600" },
];

function getBandLabel(freq: number): { label: string; color: string } | null {
  for (const b of FM_BANDS) {
    if (freq >= b.min && freq <= b.max) return b;
  }
  return null;
}

function formatFreq(hz: number): string {
  if (hz === 0) return "---";
  if (hz >= 1_000_000_000) return (hz / 1_000_000_000).toFixed(3) + " GHz";
  if (hz >= 1_000_000) return (hz / 1_000_000).toFixed(3) + " MHz";
  if (hz >= 1_000) return (hz / 1_000).toFixed(1) + " kHz";
  return hz + " Hz";
}

export function SdrTuner() {
  const sdr = useSdr();
  const [freqDrawer, setFreqDrawer] = useState(false);

  if (!sdr.wasmLoaded && !sdr.wasmError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Loading SDR engine...</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Initializing WASM signal processing module</p>
      </div>
    );
  }

  if (sdr.wasmError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Radio className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">SDR engine unavailable</p>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">{sdr.wasmError}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">The WASM module may need to be rebuilt. See <code className="text-[10px] font-mono bg-muted/30 px-1 py-0.5 rounded">wasm/build-wasm.sh</code></p>
      </div>
    );
  }

  if (!navigator.usb) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <WifiOff className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">WebUSB not supported</p>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">Live SDR tuning requires Chrome or Edge. Open this page in a compatible browser.</p>
      </div>
    );
  }

  const isConnected = sdr.connection === "connected";
  const isConnecting = sdr.connection === "connecting";
  const isError = sdr.connection === "error";
  const hasTune = sdr.frequency > 0;
  const band = hasTune ? getBandLabel(sdr.frequency) : null;

  if (isError) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-xs font-medium text-red-500">Connection Failed</span>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3">
          <p className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap">{sdr.errorMessage || "Unknown error"}</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={sdr.connect}>
          Retry Connect
        </Button>
      </div>
    );
  }

  const platform = navigator.userAgent.toLowerCase().includes("windows") ? "windows" : "other";
  if (platform === "windows" && !isConnecting && !isConnected && !isError && !sdr.companionAvailable) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <WifiOff className="h-4 w-4" />
          <span>Companion app required</span>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="mb-2">The SDR Companion app must be running to use the RTL-SDR dongle on Windows.</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Download the companion app:</li>
            <li className="ml-4">https://github.com/EvenfallAdvantage/evenfalladvantage.github.io/releases/latest</li>
            <li>Run <code className="font-mono bg-muted/50 px-1 py-0.5 rounded">companion/start.cmd</code></li>
            <li>Click &quot;Connect SDR&quot; below</li>
          </ol>
          <a
            href="https://github.com/EvenfallAdvantage/evenfalladvantage.github.io/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Download Companion App
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="flex-1 min-w-0 p-4 space-y-4">

        {/* Connection bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-muted-foreground/40" />
          )}
          <span className={`text-xs font-medium ${isConnected ? "text-green-500" : "text-muted-foreground"}`}>
            {isConnecting ? "Connecting..." : isConnected ? "SDR Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isConnected ? "outline" : "default"}
            className="gap-1.5 text-xs"
            onClick={() => setFreqDrawer(!freqDrawer)}
          >
            {freqDrawer ? <X className="h-3 w-3" /> : <List className="h-3 w-3" />}
            {freqDrawer ? "Close" : "Frequencies"}
          </Button>
          <Button
            size="sm"
            variant={isConnected ? "destructive" : "default"}
            className="gap-1.5 text-xs"
            onClick={isConnected ? sdr.disconnect : sdr.connect}
            disabled={isConnecting}
          >
            {isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : isConnected ? "Disconnect" : "Connect SDR"}
          </Button>
        </div>
      </div>

      {isConnected && (
        <>
          {/* Frequency display */}
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center">
            <div className="text-3xl font-mono font-bold tracking-wider tabular-nums">
              {formatFreq(sdr.frequency)}
            </div>
            {band && (
              <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${band.color}`}>
                {band.label}
              </span>
            )}
            {!hasTune && (
              <p className="text-xs text-muted-foreground mt-1">Click a frequency below to tune</p>
            )}
          </div>

          {/* Signal meter */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Signal className="h-3 w-3" /> Signal
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {(sdr.signalLevel * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                style={{ width: `${Math.min(100, sdr.signalLevel * 200)}%` }}
              />
            </div>
          </div>

          {/* Waterfall */}
          <Waterfall height={120} />

          {/* Controls */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Gain</label>
              <input
                type="range" min="0" max="49" step="1"
                value={sdr.gain}
                onChange={(e) => sdr.setGain(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
              />
              <span className="text-[10px] text-muted-foreground">{sdr.gain.toFixed(0)} dB</span>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Squelch</label>
              <input
                type="range" min="0" max="100" step="1"
                value={sdr.squelch}
                onChange={(e) => sdr.setSquelch(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
              />
              <span className="text-[10px] text-muted-foreground">{sdr.squelch}%</span>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Volume</label>
              <input
                type="range" min="0" max="100" step="1"
                value={Math.round(sdr.volume * 100)}
                onChange={(e) => sdr.setVolume(Number(e.target.value) / 100)}
                className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
              />
              <span className="text-[10px] text-muted-foreground">{Math.round(sdr.volume * 100)}%</span>
            </div>
          </div>

          {/* Mode selector */}
          <div className="flex gap-1">
            {(["fm", "nfm", "am"] as const).map((m) => (
              <button
                key={m}
                onClick={() => sdr.setMode(m)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-medium uppercase transition-colors ${
                  sdr.mode === m
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Device Management */}
          <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-3">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <HardDrive className="h-3 w-3" /> Devices
            </span>

            {sdr.deviceCatalog.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 italic">No SDR devices detected</p>
            )}

            {sdr.deviceCatalog.length === 1 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-2">
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Only 1 SDR detected. Radio and ADSB cannot run simultaneously. Assign the device to either feature.
                </p>
              </div>
            )}

            {/* Radio device selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground w-10 shrink-0">Radio</span>
              <select
                value={sdr.deviceAssignment.radio ?? ""}
                onChange={(e) => sdr.assignDevice("radio", e.target.value ? Number(e.target.value) : null)}
                className="flex-1 rounded-md border border-border/50 bg-background px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— None —</option>
                {sdr.deviceCatalog.map((d) => (
                  <option
                    key={d.index}
                    value={d.index}
                    disabled={sdr.deviceAssignment.adsb === d.index}
                  >
                    {d.index}: {d.manufacturer} {d.product} (SN: {d.serial})
                  </option>
                ))}
              </select>
            </div>

            {/* ADSB device selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground w-10 shrink-0">ADSB</span>
              <select
                value={sdr.deviceAssignment.adsb ?? ""}
                onChange={(e) => sdr.assignDevice("adsb", e.target.value ? Number(e.target.value) : null)}
                className="flex-1 rounded-md border border-border/50 bg-background px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— None —</option>
                {sdr.deviceCatalog.map((d) => (
                  <option
                    key={d.index}
                    value={d.index}
                    disabled={sdr.deviceAssignment.radio === d.index}
                  >
                    {d.index}: {d.manufacturer} {d.product} (SN: {d.serial})
                  </option>
                ))}
              </select>
            </div>

            {/* ADSB start/stop */}
            <div className="flex items-center justify-between pt-1 border-t border-border/20">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <Radar className="h-3 w-3" /> ADSB Tracking
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[8px] font-mono uppercase ${sdr.adsbRunning ? "text-green-500" : "text-muted-foreground/50"}`}>
                  {sdr.adsbRunning ? "Active" : "Inactive"}
                </span>
                {sdr.deviceAssignment.adsb !== null ? (
                  <Button
                    size="sm"
                    variant={sdr.adsbRunning ? "destructive" : "outline"}
                    className="text-[10px] h-7 px-2 gap-1"
                    onClick={() => sdr.adsbRunning ? sdr.adsbStop() : sdr.adsbStart()}
                  >
                    {sdr.adsbRunning ? "Stop" : "Start"}
                  </Button>
                ) : (
                  <span className="text-[9px] text-muted-foreground/50">No device assigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Transcription toggle */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                onClick={() => sdr.setTranscriptionEnabled(!sdr.transcriptionEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  sdr.transcriptionEnabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  sdr.transcriptionEnabled ? "translate-x-[18px]" : "translate-x-[2px]"
                }`} />
              </button>
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <Ear className="h-3 w-3" /> Transcribe
              </span>
            </label>
          </div>

          {/* Transcriptions */}
          {sdr.transcriptionEnabled && sdr.transcriptions.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-muted/10 p-3">
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Transcripts</p>
              {[...sdr.transcriptions].reverse().map((t) => (
                <div key={t.id} className="rounded-md bg-background/50 px-3 py-2 text-[11px] leading-relaxed">
                  <div className="flex items-center gap-2 mb-1">
                    {t.status === "done" && <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />}
                    {t.status === "pending" && <Clock className="h-3 w-3 text-amber-500 shrink-0 animate-pulse" />}
                    {t.status === "error" && <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                    <span className="text-[9px] font-mono text-muted-foreground/50">
                      {formatRelativeTime(t.timestamp)}
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground/50">
                      {t.durationMs > 0 ? `${(t.durationMs / 1000).toFixed(1)}s` : ""}
                    </span>
                  </div>
                  <p className={`${t.status === "pending" ? "text-muted-foreground/40 italic" : t.status === "error" ? "text-red-500" : ""}`}>
                    {t.text || "Transcribing..."}
                  </p>
                </div>
              ))}
            </div>
          )}

          {sdr.errorMessage && (
            <p className="text-[10px] text-red-500 text-center">{sdr.errorMessage}</p>
          )}
        </>
      )}
      </div>

      {/* Frequency drawer */}
      {freqDrawer && (
        <div className="w-80 shrink-0 border-l border-border/50 bg-card overflow-y-auto max-h-[calc(100vh-12rem)] sticky top-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-muted/20">
            <span className="text-xs font-medium">Frequencies</span>
            <button
              onClick={() => setFreqDrawer(false)}
              className="rounded-md p-1 hover:bg-muted/50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ScannerTab />
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return `${Math.round(diff / 3600000)}h ago`;
}
