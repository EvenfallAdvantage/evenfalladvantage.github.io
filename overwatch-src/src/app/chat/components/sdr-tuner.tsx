"use client";

import { useSdr } from "@/hooks/use-sdr";
import { Radio, Loader2, Wifi, WifiOff, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  if (platform === "windows" && !isConnecting && !isConnected && !isError) {
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
            <li className="ml-4">https://github.com/EvenfallAdvantage/evenfalladvantage.github.io</li>
            <li>Run <code className="font-mono bg-muted/50 px-1 py-0.5 rounded">companion/start.cmd</code></li>
            <li>Click &quot;Connect SDR&quot; below</li>
          </ol>
          <a
            href="https://github.com/EvenfallAdvantage/evenfalladvantage.github.io"
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
    <div className="p-4 space-y-4">

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

          {sdr.errorMessage && (
            <p className="text-[10px] text-red-500 text-center">{sdr.errorMessage}</p>
          )}
        </>
      )}
    </div>
  );
}
