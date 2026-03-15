"use client";

import { useEffect } from "react";
import Image from "next/image";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Overwatch error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
      <div className="relative text-center max-w-md">
        <Image src="/images/logo-shield.png" alt="Overwatch" width={48} height={48} className="rounded-xl mx-auto mb-6" style={{ width: 48, height: "auto" }} />
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs text-red-400 mb-6">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          System Anomaly Detected
        </div>
        <h1 className="text-xl font-bold font-mono mb-2">OPERATIONAL ERROR</h1>
        <p className="text-sm text-white/40 mb-2">An unexpected fault occurred in the system.</p>
        {error.digest && (
          <p className="text-[10px] font-mono text-white/20 mb-6">Ref: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={reset} className="inline-flex items-center gap-2 bg-white text-black font-semibold px-6 py-2.5 rounded-xl hover:bg-white/90 transition-all text-sm">
            Retry Operation
          </button>
          <a href="/feed" className="inline-flex items-center gap-2 border border-white/20 text-white/70 px-6 py-2.5 rounded-xl hover:bg-white/5 transition-all text-sm">
            Return to Base
          </a>
        </div>
        <p className="mt-10 text-[10px] text-white/20 font-mono uppercase tracking-widest">Overwatch Security Platform</p>
      </div>
    </div>
  );
}
