"use client";

import { Input } from "@/components/ui/input";

interface ApplyCredentialsSectionProps {
  guardCardNumber: string;
  guardCardExpiry: string;
  onChange: (field: string, value: string) => void;
}

export function ApplyCredentialsSection({ guardCardNumber, guardCardExpiry, onChange }: ApplyCredentialsSectionProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">2</span>
        Credentials
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="apply-guard-card-number" className="text-xs text-zinc-400 mb-1 block">Guard Card Number</label>
          <Input id="apply-guard-card-number" value={guardCardNumber} onChange={(e) => onChange("guardCardNumber", e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white" placeholder="GC-12345" />
        </div>
        <div>
          <label htmlFor="apply-guard-card-expiry" className="text-xs text-zinc-400 mb-1 block">Guard Card Expiry</label>
          <Input id="apply-guard-card-expiry" value={guardCardExpiry} onChange={(e) => onChange("guardCardExpiry", e.target.value)}
            type="date" className="bg-zinc-900 border-zinc-700 text-white" />
        </div>
      </div>
    </div>
  );
}
