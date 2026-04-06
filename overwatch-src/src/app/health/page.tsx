"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Health check page for uptime monitoring.
 * GET /overwatch/health/
 *
 * Uptime monitors (UptimeRobot, Pingdom, etc.) can check this page.
 * - Renders "OK" in the page title when healthy (monitor checks for keyword)
 * - Renders "DEGRADED" when DB is unreachable
 *
 * The page also returns a JSON-like status in the body for human readers.
 */
export default function HealthPage() {
  const [status, setStatus] = useState<"checking" | "ok" | "degraded">("checking");
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    async function check() {
      const start = performance.now();
      const ts = new Date().toISOString();
      setTimestamp(ts);

      try {
        const supabase = createClient();
        const { error: dbError } = await supabase
          .from("companies")
          .select("id")
          .limit(1)
          .maybeSingle();

        const latency = Math.round(performance.now() - start);
        setDbLatency(latency);

        if (dbError) {
          setStatus("degraded");
          setError(dbError.message);
          document.title = "DEGRADED | Overwatch Health";
        } else {
          setStatus("ok");
          setError(null);
          document.title = "OK | Overwatch Health";
        }
      } catch (err: unknown) {
        const latency = Math.round(performance.now() - start);
        setDbLatency(latency);
        setStatus("degraded");
        setError(err instanceof Error ? err.message : "Unknown error");
        document.title = "DEGRADED | Overwatch Health";
      }
    }

    check();
    // Re-check every 30 seconds
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ fontFamily: "monospace", padding: 40, background: "#0a0f1a", color: "#e0e0e0", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 14, marginBottom: 20, color: "#888" }}>OVERWATCH HEALTH CHECK</h1>
      <pre style={{ fontSize: 13, lineHeight: 1.8 }}>
{`{
  "status": "${status}",
  "database": "${status === "ok" ? "connected" : status === "degraded" ? "error" : "checking"}",
  "latency_ms": ${dbLatency ?? "null"},${error ? `\n  "error": "${error}",` : ""}
  "timestamp": "${timestamp}",
  "version": "overwatch-v9"
}`}
      </pre>
      <div style={{ marginTop: 30, fontSize: 11, color: "#555" }}>
        Auto-refreshes every 30 seconds. Use keyword monitoring for &quot;OK&quot; in page title.
      </div>
    </div>
  );
}
