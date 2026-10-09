"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ErrorLog {
  id: string;
  message: string;
  level: string;
  created_at: string;
  url?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

function ErrorLogList({ companyId }: { companyId: string }) {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    import("@/lib/error-tracker").then(({ getErrorLogs }) => {
      getErrorLogs(companyId, 30).then(setLogs).catch(() => setFailed(true)).finally(() => setLoading(false));
    });
  }, [companyId]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading logs...</p>;
  if (failed) return <p role="alert" className="text-xs text-amber-500">Couldn&apos;t load logs. Reload the page to try again.</p>;
  if (logs.length === 0) return <p className="text-xs text-muted-foreground">No uncaught errors logged.</p>;

  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className="rounded-lg border border-border/40 bg-muted/20 text-xs">
          <button
            aria-expanded={expanded === log.id}
            className="w-full flex min-h-11 items-center gap-2 px-3 py-2 text-left sm:min-h-0 hover:bg-muted/30 transition-colors"
            onClick={() => setExpanded(expanded === log.id ? null : log.id)}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${log.level === "error" ? "bg-red-500" : log.level === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
            <span className="flex-1 min-w-0 truncate font-mono">{log.message}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString()}</span>
          </button>
          {expanded === log.id && (
            <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2">
              {log.url && <div><span className="text-muted-foreground">URL:</span> <span className="font-mono break-all">{log.url}</span></div>}
              {log.stack && <pre className="text-[10px] text-muted-foreground bg-background/50 rounded p-2 overflow-x-auto max-h-[200px] whitespace-pre-wrap">{log.stack}</pre>}
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <pre className="text-[10px] text-muted-foreground bg-background/50 rounded p-2 overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface ErrorLogViewerProps {
  companyId: string;
}

export default function ErrorLogViewer({ companyId }: ErrorLogViewerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> System Logs
        </CardTitle>
        <p className="text-xs text-muted-foreground">The 30 most recent uncaught app errors in this company. Handled errors and server-side failures are not listed here.</p>
      </CardHeader>
      <CardContent>
        <ErrorLogList companyId={companyId} />
      </CardContent>
    </Card>
  );
}
