"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getLegacyClient } from "@/lib/legacy-bridge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Globe,
  Server,
  RefreshCw,
} from "lucide-react";

type ServiceStatus = {
  name: string;
  region: string;
  status: "checking" | "healthy" | "degraded" | "down";
  latencyMs: number | null;
  detail: string;
  checkedAt: string | null;
};

const INITIAL_SERVICES: ServiceStatus[] = [
  { name: "Overwatch Supabase", region: "us-east-1", status: "checking", latencyMs: null, detail: "Auth + DB", checkedAt: null },
  { name: "Overwatch PostgREST", region: "us-east-1", status: "checking", latencyMs: null, detail: "REST API", checkedAt: null },
  { name: "Legacy Supabase", region: "us-east-1", status: "checking", latencyMs: null, detail: "Training DB", checkedAt: null },
  { name: "Static Assets (GH Pages)", region: "global-cdn", status: "checking", latencyMs: null, detail: "CDN delivery", checkedAt: null },
];

async function pingService(fn: () => Promise<void>): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  try {
    await fn();
    return { ok: true, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

export default function HealthPage() {
  const [services, setServices] = useState<ServiceStatus[]>(INITIAL_SERVICES);
  const [running, setRunning] = useState(false);

  async function runChecks() {
    setRunning(true);
    const now = new Date().toISOString();
    const updated = [...INITIAL_SERVICES];

    // 1. Overwatch Supabase Auth
    const ow = createClient();
    const authResult = await pingService(async () => {
      const { error } = await ow.auth.getSession();
      if (error) throw error;
    });
    updated[0] = {
      ...updated[0],
      status: authResult.ok ? "healthy" : "down",
      latencyMs: authResult.ms,
      checkedAt: now,
      detail: authResult.ok ? `Auth OK (${authResult.ms}ms)` : "Auth unreachable",
    };

    // 2. Overwatch PostgREST (query a small table)
    const restResult = await pingService(async () => {
      const { error } = await ow
        .from("companies")
        .select("id", { count: "exact", head: true })
        .limit(1);
      if (error) throw error;
    });
    updated[1] = {
      ...updated[1],
      status: restResult.ok ? "healthy" : (restResult.ms < 5000 ? "degraded" : "down"),
      latencyMs: restResult.ms,
      checkedAt: now,
      detail: restResult.ok ? `REST OK (${restResult.ms}ms)` : "PostgREST error",
    };

    // 3. Legacy Supabase
    const legacy = getLegacyClient();
    const legacyResult = await pingService(async () => {
      const { error } = await legacy
        .from("training_modules")
        .select("id", { count: "exact", head: true })
        .limit(1);
      if (error) throw error;
    });
    updated[2] = {
      ...updated[2],
      status: legacyResult.ok ? "healthy" : "down",
      latencyMs: legacyResult.ms,
      checkedAt: now,
      detail: legacyResult.ok ? `Legacy DB OK (${legacyResult.ms}ms)` : "Legacy unreachable",
    };

    // 4. Static assets (fetch a known asset)
    const cdnResult = await pingService(async () => {
      const resp = await fetch("/overwatch/_next/static/chunks/webpack.js", { method: "HEAD", cache: "no-store" });
      if (!resp.ok) throw new Error("CDN fetch failed");
    });
    updated[3] = {
      ...updated[3],
      status: cdnResult.ok ? "healthy" : "degraded",
      latencyMs: cdnResult.ms,
      checkedAt: now,
      detail: cdnResult.ok ? `CDN OK (${cdnResult.ms}ms)` : "Asset fetch failed",
    };

    setServices(updated);
    setRunning(false);
  }

  const didRun = useRef(false);
  useEffect(() => {
    if (!didRun.current) {
      didRun.current = true;
      runChecks();
    }
  });

  const overallStatus = services.every((s) => s.status === "healthy")
    ? "ALL SYSTEMS OPERATIONAL"
    : services.some((s) => s.status === "down")
      ? "SERVICE DISRUPTION"
      : services.some((s) => s.status === "checking")
        ? "CHECKING..."
        : "DEGRADED PERFORMANCE";

  const statusColor = overallStatus === "ALL SYSTEMS OPERATIONAL"
    ? "text-green-500"
    : overallStatus === "CHECKING..."
      ? "text-amber-400"
      : "text-red-500";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> System Health
          </h1>
          <p className={`text-sm font-mono font-semibold mt-1 ${statusColor}`}>
            {overallStatus}
          </p>
        </div>
        <button
          onClick={runChecks}
          disabled={running}
          className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-md hover:bg-primary/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${running ? "animate-spin" : ""}`} />
          {running ? "Checking..." : "Re-check"}
        </button>
      </div>

      {/* Service Cards */}
      <div className="grid gap-3">
        {services.map((svc) => {
          const Icon = svc.name.includes("Legacy") ? Database
            : svc.name.includes("Static") ? Globe
              : svc.name.includes("PostgREST") ? Server
                : Database;
          const StatusIcon = svc.status === "healthy" ? CheckCircle2
            : svc.status === "checking" ? Clock
              : XCircle;
          const statusColorMap = {
            healthy: "text-green-500",
            checking: "text-amber-400 animate-pulse",
            degraded: "text-amber-500",
            down: "text-red-500",
          };

          return (
            <Card key={svc.name} className="border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{svc.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{svc.region}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{svc.detail}</p>
                    {svc.latencyMs !== null && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {svc.latencyMs}ms
                      </p>
                    )}
                  </div>
                  <StatusIcon className={`h-5 w-5 ${statusColorMap[svc.status]}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Environment Info */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Environment</h2>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-mono">GitHub Pages (static)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Framework</span>
              <span className="font-mono">Next.js 16 (export)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overwatch DB</span>
              <span className="font-mono">nneueuvyeohwnspbwfub</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Legacy DB</span>
              <span className="font-mono">vaagvairvwmgyzsmymhs</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Latency Chart (simple bar) */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Latency (ms)</h2>
          {services.filter((s) => s.latencyMs !== null).map((svc) => {
            const maxMs = Math.max(...services.map((s) => s.latencyMs ?? 0), 1);
            const pct = Math.min(100, ((svc.latencyMs ?? 0) / maxMs) * 100);
            const barColor = (svc.latencyMs ?? 0) < 200 ? "bg-green-500" : (svc.latencyMs ?? 0) < 500 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={svc.name}>
                <div className="flex items-center justify-between text-[10px] mb-0.5">
                  <span className="text-muted-foreground">{svc.name}</span>
                  <span className="font-mono">{svc.latencyMs}ms</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
