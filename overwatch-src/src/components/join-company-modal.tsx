"use client";

import { useState } from "react";
import Image from "next/image";
import { UserPlus, Loader2, X, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { joinCompanyByCode } from "@/lib/supabase/db";

interface JoinCompanyModalProps {
  open: boolean;
  onClose: () => void;
  onSwitchToRegister: (code?: string) => void;
  onSwitchToLogin?: () => void;
}

export function JoinCompanyModal({ open, onClose, onSwitchToRegister, onSwitchToLogin }: JoinCompanyModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in — open register modal with code preserved
        onClose();
        onSwitchToRegister(code.trim().toUpperCase());
        return;
      }

      // Logged in — join directly
      await joinCompanyByCode({
        supabaseId: user.id,
        email: user.email,
        phone: null,
        firstName: user.user_metadata?.first_name ?? "",
        lastName: user.user_metadata?.last_name ?? "",
        joinCode: code.trim().toUpperCase(),
      });

      window.location.href = `${window.location.origin}/overwatch/feed`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join company");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-[#dd8c33]/30 bg-[#0f1a2e] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center mb-5">
          <Image src="/images/overwatch_logo.png?v=2" alt="Overwatch" width={64} height={64} style={{ width: 64, height: "auto" }} />
          <h2 className="mt-2 text-lg font-bold font-mono text-white">JOIN A COMPANY</h2>
          <p className="mt-1 text-xs text-white/50 text-center">Enter the company code provided by your manager</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-white/60 block mb-1">Company Code</label>
            <input
              type="text"
              placeholder="e.g. ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white uppercase tracking-wider font-mono outline-none focus:border-[#dd8c33]/50 focus:ring-1 focus:ring-[#dd8c33]/20 placeholder:text-white/60 placeholder:normal-case placeholder:tracking-normal placeholder:font-sans"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#dd8c33] text-white font-semibold text-sm hover:bg-[#c47a2a] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Join Company
          </button>
        </form>

        <div className="mt-4 text-center space-y-1">
          <p className="text-xs text-white/40">
            Don&apos;t have a code?{" "}
            <button
              onClick={() => {
                onClose();
                onSwitchToRegister();
              }}
              className="text-[#dd8c33] hover:underline font-medium"
            >
              Create a new company
            </button>
          </p>
          {onSwitchToLogin && (
            <p className="text-xs text-white/30">
              <button onClick={() => { onClose(); onSwitchToLogin(); }} className="hover:text-white/50">
                &larr; Back to sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
