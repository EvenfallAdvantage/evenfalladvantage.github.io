"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/overwatch/auth/update-password/`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1422]">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-[#dd8c33]/30 bg-[#0f1a2e] p-6 shadow-2xl">
        <div className="flex flex-col items-center mb-5">
          <Image src="/images/overwatch_logo.png" alt="Overwatch" width={64} height={64} style={{ width: 64, height: "auto" }} />
          <h2 className="mt-2 text-lg font-bold font-mono text-white">RESET PASSWORD</h2>
          <p className="text-xs text-white/40 mt-1 text-center">Enter your email and we&apos;ll send a reset link</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <div>
              <p className="text-sm text-white font-medium">Check your email</p>
              <p className="text-xs text-white/40 mt-1">
                We sent a password reset link to <span className="text-[#dd8c33]">{email}</span>
              </p>
              <p className="text-xs text-white/30 mt-2">Didn&apos;t receive it? Check spam or try again.</p>
            </div>
            <button onClick={() => { setSent(false); setEmail(""); }}
              className="text-xs text-[#dd8c33] hover:underline font-medium">
              Send again
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="w-full h-9 rounded-lg border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 focus:ring-1 focus:ring-[#dd8c33]/20 placeholder:text-white/30"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#dd8c33] text-white font-semibold text-sm hover:bg-[#c47a2a] disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send Reset Link
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <Link href="/?auth=login" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
