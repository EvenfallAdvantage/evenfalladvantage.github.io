"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { trackError } from "@/lib/error-tracker";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    trackError({
      level: "error",
      message: `Admin section error: ${error.message}`,
      stack: error.stack,
      metadata: { segment: "admin", digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <div>
        <h2 className="text-lg font-bold mb-1">Admin Error</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Something went wrong in the admin section. This has been logged.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground/40 mt-2">Ref: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
        <Link
          href="/feed"
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feed
        </Link>
      </div>
    </div>
  );
}
