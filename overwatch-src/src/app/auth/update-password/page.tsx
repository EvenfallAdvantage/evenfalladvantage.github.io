"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Loader2, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import Image from "next/image";

function checkPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  const pwCheck = password.length > 0 ? checkPasswordStrength(password) : null;
  const mismatch = confirm.length > 0 && password !== confirm;

  // Wait for Supabase to process the recovery token from the URL hash
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
        subscription.unsubscribe();
      }
    });

    // Also check if already authenticated
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      if (!sessionReady) setError("Reset link expired or invalid. Please request a new one.");
    }, 10000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => router.replace("/feed"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1422]">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-[#dd8c33]/30 bg-[#0f1a2e] p-6 shadow-2xl">
        <div className="flex flex-col items-center mb-5">
          <Image src="/images/overwatch_logo.png" alt="Overwatch" width={64} height={64} style={{ width: 64, height: "auto" }} />
          <h2 className="mt-2 text-lg font-bold font-mono text-white">
            {done ? "PASSWORD UPDATED" : "NEW PASSWORD"}
          </h2>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <p className="text-sm text-white">Your password has been updated.</p>
            <p className="text-xs text-white/40">Redirecting to dashboard...</p>
          </div>
        ) : !sessionReady && !error ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-[#dd8c33]" />
            <p className="text-xs text-white/40">Verifying reset link...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">New password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                  className="w-full h-9 rounded-lg border border-white/10 bg-white/5 pl-10 pr-10 text-sm text-white outline-none focus:border-[#dd8c33]/50 focus:ring-1 focus:ring-[#dd8c33]/20 placeholder:text-white/30"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwCheck && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pwCheck.color}`}
                      style={{ width: `${(pwCheck.score / 5) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-white/40">{pwCheck.label}</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Confirm password</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`w-full h-9 rounded-lg border bg-white/5 pl-10 pr-3 text-sm text-white outline-none focus:ring-1 placeholder:text-white/30 ${
                    mismatch
                      ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                      : "border-white/10 focus:border-[#dd8c33]/50 focus:ring-[#dd8c33]/20"
                  }`}
                />
              </div>
              {mismatch && <p className="text-[10px] text-red-400 mt-1">Passwords do not match</p>}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password || !confirm || mismatch || !sessionReady}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#dd8c33] text-white font-semibold text-sm hover:bg-[#c47a2a] disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
