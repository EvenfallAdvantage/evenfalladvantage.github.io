"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ErrorBoundary } from "@/components/error-boundary";
import Image from "next/image";
import {
  Shield, Radio, GraduationCap, MapPin,
  BarChart3, Users, Clock, BookOpen,
  ChevronRight, Zap, Lock, Globe,
  X, Phone, Mail, ArrowRight, Loader2,
  UserPlus, QrCode, Crosshair, AlertTriangle, FileText, Award, Eye, EyeOff,
} from "lucide-react";
import dynamic from "next/dynamic";
import { TOSModal } from "@/components/terms-of-service";
import { PrivacyPolicyModal } from "@/components/privacy-policy-modal";
import { JoinCompanyModal } from "@/components/join-company-modal";

const MobileHeroRadar = dynamic(() => import("@/components/mobile-hero-radar"), { ssr: false });
const TacticalGlobe = dynamic(() => import("@/components/tactical-globe").then((m) => m.TacticalGlobe), {
  ssr: false,
  loading: () => <div style={{ height: "clamp(160px, 22vw, 280px)" }} />,
});
import { createClient } from "@/lib/supabase/client";
import { registerUserInDB, joinCompanyByCode } from "@/lib/supabase/db";
import { useAuthStore } from "@/stores/auth-store";
import { checkPasswordStrength } from "@/lib/security";
import { formatPhone } from "@/lib/format-phone";
import { logSecurityEvent, checkLoginAttempts, recordFailedAttempt, clearLoginAttempts } from "@/lib/security/audit";
import { logger } from "@/lib/logger";

const FEATURES = [
  { icon: Crosshair, title: "Patrol Operations", desc: "QR checkpoint scanning, geofenced patrol routes, GPS-verified activity logs, real-time officer tracking, and daily activity report generation" },
  { icon: Clock, title: "Time & Attendance", desc: "GPS-verified clock in/out, mass badge scanning, break tracking (CA compliant), geofence enforcement, and multi-provider payroll sync" },
  { icon: AlertTriangle, title: "Incident Command", desc: "Real-time incident reporting with severity tiers, photo/video evidence with SHA-256 chain-of-custody, and SOS panic alerts" },
  { icon: Radio, title: "Encrypted Comms", desc: "AES-256 encrypted team channels with WhatsApp & Signal bridging, broadcast alerts with acknowledgment tracking, and read receipts" },
  { icon: GraduationCap, title: "Academy LMS", desc: "Interactive slideshow courses, timed quizzes with question banks, certification tracking with expiry alerts, and compliance dashboards" },
  { icon: Zap, title: "De-escalation Sims", desc: "Branching dialogue scenarios with real-time emotional tension meters, performance scoring, and scenario outcome tracking" },
  { icon: Shield, title: "Site Assessment", desc: "7-section security evaluations with risk matrix scoring, auto-generated recommendations, multi-page PDF reports, and CSV exports" },
  { icon: MapPin, title: "Geo-Risk Intel", desc: "FBI UCR crime data for any US location with composite risk scoring, threat heat mapping, and historical trend analysis" },
  { icon: UserPlus, title: "Hire-to-Deploy Pipeline", desc: "Public apply form, CSV bulk import, Checkr background checks, DocuSign e-sign, Airtable sync, and auto-onboarding checklists" },
  { icon: Users, title: "Smart Scheduling", desc: "Shift templates with recurrence, auto-fill with availability + cert + OT constraints, shift swap marketplace, and overtime detection" },
  { icon: QrCode, title: "Asset & Equipment", desc: "QR-coded asset tracking with checkout/checkin logs, assignment history, and batch management across multiple sites" },
  { icon: Globe, title: "State Laws DB", desc: "All 50 states — licensing, training hours, use-of-force doctrine, citizen's arrest, weapons regs, statutes, and regulatory agency links" },
  { icon: BarChart3, title: "Analytics & Reports", desc: "KPI dashboards, compliance tracking, overtime alerts, incident analytics, weekly trends, and auto-generated daily activity reports" },
  { icon: FileText, title: "Invoicing System", desc: "Persistent invoicing with bill rates, timesheet-to-invoice generation, status tracking, and client portal for payment visibility" },
  { icon: BookOpen, title: "Client Portal", desc: "Authenticated read-only portal for clients — view operations, incidents, invoices, and daily activity reports with one-click access" },
  { icon: Award, title: "Certifications Hub", desc: "Guard card and license tracking with expiry alerts, compliance dashboard, shift qualification gating, and auto-generated PDF certificates" },
];

const STATS = [
  { value: "25+", label: "Operations Modules" },
  { value: "50", label: "States Updated 2026" },
  { value: "14", label: "Integrations" },
  { value: "24/7", label: "Operational Uptime" },
];

function LoginModal({ open, onClose, onSwitchToRegister, onSwitchToJoin }: { open: boolean; onClose: () => void; onSwitchToRegister: () => void; onSwitchToJoin: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handlePhoneLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { allowed } = await checkLoginAttempts(phone);
      if (!allowed) {
        setError("Too many attempts. Account locked for 15 minutes.");
        logSecurityEvent({ event_type: "security.lockout", outcome: "blocked", metadata: { method: "phone", identifier: phone } });
        return;
      }
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`,
      });
      if (otpError) throw otpError;
      router.push(`/verify?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      recordFailedAttempt(phone);
      logSecurityEvent({ event_type: "auth.login.failed", outcome: "failure", metadata: { method: "phone" } });
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally { setLoading(false); }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { allowed } = await checkLoginAttempts(email);
      if (!allowed) {
        setError("Too many attempts. Account locked for 15 minutes.");
        logSecurityEvent({ event_type: "security.lockout", outcome: "blocked", metadata: { method: "email", identifier: email } });
        return;
      }
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clearLoginAttempts(email);
      logSecurityEvent({ event_type: "auth.login.success", user_id: data.user?.id, outcome: "success", metadata: { method: "email" } });
      window.location.href = `${window.location.origin}/overwatch/feed`;
    } catch (err) {
      recordFailedAttempt(email);
      logSecurityEvent({ event_type: "auth.login.failed", outcome: "failure", metadata: { method: "email" } });
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl border border-[#dd8c33]/30 bg-[#0f1a2e] p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white"><X className="h-5 w-5" /></button>

        <div className="flex flex-col items-center mb-5">
          <Image src="/images/overwatch_logo.png?v=2" alt="Overwatch" width={64} height={64} style={{ width: 64, height: "auto" }} />
          <h2 className="mt-2 text-lg font-bold font-mono text-white">SIGN IN</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 rounded-lg bg-white/5 p-1">
          <button onClick={() => { setTab("phone"); setError(""); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${tab === "phone" ? "bg-[#dd8c33] text-white shadow" : "text-white/50 hover:text-white"}`}>
            <Phone className="h-3.5 w-3.5" /> Phone
          </button>
          <button onClick={() => { setTab("email"); setError(""); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${tab === "email" ? "bg-[#dd8c33] text-white shadow" : "text-white/50 hover:text-white"}`}>
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
        </div>

        {tab === "phone" ? (
          <form onSubmit={handlePhoneLogin} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Phone number</label>
              <div className="flex gap-2">
                <span className="flex h-9 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/50">US +1</span>
                <input type="tel" inputMode="tel" placeholder="(555) 123-4567" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} required
                  className="flex-1 h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 focus:ring-1 focus:ring-[#dd8c33]/20 placeholder:text-white/30" />
              </div>
              <p className="text-[10px] text-white/30 mt-1">We&apos;ll text you a verification code</p>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="submit" disabled={loading || !phone}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#dd8c33] text-white font-semibold text-sm hover:bg-[#c47a2a] disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Verify
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Email</label>
              <input type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 focus:ring-1 focus:ring-[#dd8c33]/20 placeholder:text-white/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Password</label>
              <div className="relative">
                <input type={showLoginPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                  className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 pr-9 text-sm text-white outline-none focus:border-[#dd8c33]/50 focus:ring-1 focus:ring-[#dd8c33]/20 placeholder:text-white/30" />
                <button type="button" onClick={() => setShowLoginPw(!showLoginPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showLoginPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="submit" disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#dd8c33] text-white font-semibold text-sm hover:bg-[#c47a2a] disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Sign In
            </button>
            <div className="text-right">
              <Link href="/auth/reset" onClick={onClose} className="text-[10px] text-white/40 hover:text-[#dd8c33] transition-colors">Forgot password?</Link>
            </div>
          </form>
        )}

        <div className="mt-4 text-center space-y-2">
          <p className="text-xs text-white/40">Don&apos;t have an account? <button onClick={() => { onClose(); onSwitchToRegister(); }} className="text-[#dd8c33] hover:underline font-medium">Create one</button></p>
          <p className="text-xs text-white/30"><button onClick={() => { onClose(); onSwitchToJoin(); }} className="hover:text-white/50">Have a company code? Join here</button></p>
        </div>
      </div>
    </div>
  );
}

function RegisterModal({ open, onClose, onSwitchToLogin, joinCode = "" }: { open: boolean; onClose: () => void; onSwitchToLogin: () => void; joinCode?: string }) {
  const { clearSession } = useAuthStore();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setRegPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [step, setStep] = useState<"info" | "company" | "done">(joinCode ? "info" : "info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [useJoinCode, setUseJoinCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState(joinCode);
  const pwCheck = password.length > 0 ? checkPasswordStrength(password) : null;
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  if (!open) return null;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const supabase = createClient();

      // SECURITY: Sign out any existing session before creating a new account
      await supabase.auth.signOut();
      clearSession();

      const effectiveJoinCode = joinCode || joinCodeInput;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { first_name: firstName, last_name: lastName, phone: phone || null, company_name: effectiveJoinCode ? "" : companyName, join_code: effectiveJoinCode || null, tos_accepted_at: new Date().toISOString() },
          emailRedirectTo: `${window.location.origin}/overwatch/auth/callback/`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.user && !data.session) {
        // Email confirmation required — persist join code for after verification
        if (effectiveJoinCode && data.user) {
          localStorage.setItem("pending_join", JSON.stringify({
            code: effectiveJoinCode, supabaseId: data.user.id,
            email: data.user.email, phone: phone || null, firstName, lastName,
          }));
        }
        setStep("done");
        return;
      }

      // Session available — create DB records now
      if (data.user) {
        try {
          if (effectiveJoinCode) {
            await joinCompanyByCode({
              supabaseId: data.user.id, email: data.user.email,
              phone: phone || null, firstName, lastName, joinCode: effectiveJoinCode,
            });
          } else {
            await registerUserInDB({
              supabaseId: data.user.id, email: data.user.email,
              phone: phone || null, firstName, lastName, companyName,
            });
          }
        } catch (dbErr) {
          console.warn("DB registration deferred:", dbErr);
        }
      }

      window.location.href = `${window.location.origin}/overwatch/feed`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  const strengthColors: Record<string, string> = { weak: "bg-red-500 w-1/5", fair: "bg-orange-500 w-2/5", good: "bg-yellow-500 w-3/5", strong: "bg-green-500 w-4/5", military: "bg-emerald-400 w-full" };
  const infoValid = firstName && lastName && email && password && confirmPassword && password === confirmPassword && (pwCheck?.valid ?? false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl border border-[#dd8c33]/30 bg-[#0f1a2e] p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white"><X className="h-5 w-5" /></button>

        <div className="flex flex-col items-center mb-5">
          <Image src="/images/overwatch_logo.png?v=2" alt="Overwatch" width={64} height={64} style={{ width: 64, height: "auto" }} />
          <h2 className="mt-2 text-lg font-bold font-mono text-white">CREATE ACCOUNT</h2>
          {joinCode && <p className="text-[10px] text-[#dd8c33] mt-1 font-mono">JOIN CODE: {joinCode}</p>}
        </div>

        {step === "done" ? (
          <div className="text-center space-y-3 py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center"><ArrowRight className="h-5 w-5 text-green-400" /></div>
            <p className="text-sm text-white/70">Check your email at <strong className="text-white">{email}</strong> to confirm your account.</p>
            <button onClick={onSwitchToLogin} className="text-xs text-[#dd8c33] hover:underline">Back to Sign In</button>
          </div>
        ) : step === "info" ? (
          <form onSubmit={(e) => { e.preventDefault(); if (joinCode) { handleRegister(e); } else { setStep("company"); } }} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-white/60 block mb-1">First name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                  className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 placeholder:text-white/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 block mb-1">Last name</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                  className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 placeholder:text-white/30" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Email</label>
              <input type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 placeholder:text-white/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Phone (optional)</label>
              <input type="tel" inputMode="tel" placeholder="(555) 123-4567" value={phone} onChange={e => setRegPhone(formatPhone(e.target.value))}
                className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 placeholder:text-white/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} placeholder="Min 12 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={12} autoComplete="new-password"
                  className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 pr-9 text-sm text-white outline-none focus:border-[#dd8c33]/50 placeholder:text-white/30" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {pwCheck && (
                <div className="mt-1.5">
                  <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full transition-all ${strengthColors[pwCheck.strength] ?? ""}`} /></div>
                  <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wider">{pwCheck.strength}</p>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Confirm Password</label>
              <div className="relative">
                <input type={showConfirmPw ? "text" : "password"} placeholder="Re-enter password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={12} autoComplete="new-password"
                  className={`w-full h-9 rounded-lg border bg-white/5 px-3 pr-9 text-sm text-white outline-none placeholder:text-white/30 ${!passwordsMatch ? "border-red-500/50 focus:border-red-500/70" : "border-white/10 focus:border-[#dd8c33]/50"}`} />
                <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {!passwordsMatch && <p className="text-[10px] text-red-400 mt-1">Passwords do not match</p>}
            </div>
            <button type="submit" disabled={!infoValid || loading}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#dd8c33] text-white font-semibold text-sm hover:bg-[#c47a2a] disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : joinCode ? "Create Account & Join" : <>Continue <ArrowRight className="h-4 w-4" /></>}
            </button>
            <div className="text-center">
              <button type="button" onClick={onSwitchToLogin} className="text-xs text-white/40 hover:text-white/60">Already have an account? <span className="text-[#dd8c33]">Sign in</span></button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            {useJoinCode ? (
              <>
                <div>
                  <label className="text-xs font-medium text-white/60 block mb-1">Company code</label>
                  <input type="text" placeholder="e.g. S7WJ7V" value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())} required
                    className="w-full h-10 rounded-lg border border-[#dd8c33]/30 bg-[#dd8c33]/10 px-3 text-sm text-white font-mono text-center tracking-widest outline-none focus:border-[#dd8c33]/50 placeholder:text-white/30" />
                  <p className="text-[10px] text-white/30 mt-1">Enter the code provided by your manager or company admin.</p>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={tosAccepted} onChange={(e) => setTosAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-white/20" />
                  <span className="text-[11px] text-white/50 leading-tight">
                    I have read and agree to the{" "}
                    <button type="button" onClick={() => setShowTos(true)} className="text-[#dd8c33] hover:underline font-medium">Terms of Service</button>
                  </span>
                </label>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setUseJoinCode(false); setJoinCodeInput(""); }}
                    className="flex-1 h-10 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors">Back</button>
                  <button type="submit" disabled={loading || !joinCodeInput || !tosAccepted}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-[#dd8c33] text-white font-semibold text-sm hover:bg-[#c47a2a] disabled:opacity-50 transition-colors">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Join Company <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-white/60 block mb-1">Company name</label>
                  <input type="text" placeholder="e.g. Apex Security Services" value={companyName} onChange={e => setCompanyName(e.target.value)} required
                    className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 placeholder:text-white/30" />
                  <p className="text-[10px] text-white/30 mt-1">This creates a new company. To join an existing one, use a company code.</p>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={tosAccepted} onChange={(e) => setTosAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-white/20" />
                  <span className="text-[11px] text-white/50 leading-tight">
                    I have read and agree to the{" "}
                    <button type="button" onClick={() => setShowTos(true)} className="text-[#dd8c33] hover:underline font-medium">Terms of Service</button>
                  </span>
                </label>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("info")}
                    className="flex-1 h-10 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors">Back</button>
                  <button type="submit" disabled={loading || !companyName || !tosAccepted}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-[#dd8c33] text-white font-semibold text-sm hover:bg-[#c47a2a] disabled:opacity-50 transition-colors">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Deploy <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
                <div className="text-center">
                  <button type="button" onClick={() => setUseJoinCode(true)} className="text-xs text-white/30 hover:text-white/50">Have a company code? Join here</button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
      <TOSModal open={showTos} onClose={() => setShowTos(false)} />
    </div>
  );
}

const INTEGRATIONS_LOGOS = [
  { name: "WhatsApp", src: "/images/integrations/whatsapp.png", alt: "WhatsApp Business", url: "https://business.whatsapp.com" },
  { name: "Signal", src: "/images/integrations/signal.png", alt: "Signal", url: "https://signal.org" },
  { name: "Twilio", src: "/images/integrations/twilio.jpeg", alt: "Twilio", url: "https://www.twilio.com" },
  { name: "Checkr", src: "/images/integrations/checkr.jpeg", alt: "Checkr", url: "https://checkr.com" },
  { name: "Gusto", src: "/images/integrations/gusto.jpeg", alt: "Gusto", url: "https://gusto.com" },
  { name: "QuickBooks", src: "/images/integrations/quickbooks.png", alt: "QuickBooks Online", url: "https://quickbooks.intuit.com" },
  { name: "ADP", src: "/images/integrations/adp.jpeg", alt: "ADP Workforce Now", url: "https://www.adp.com" },
  { name: "DocuSign", src: "/images/integrations/docusign.jpeg", alt: "DocuSign", url: "https://www.docusign.com" },
  { name: "OneSignal", src: "/images/integrations/onesignal.jpeg", alt: "OneSignal", url: "https://onesignal.com" },
  { name: "Airtable", src: "/images/integrations/airtable.jpeg", alt: "Airtable", url: "https://airtable.com" },
  { name: "Fillout", src: "/images/integrations/fillout.png", alt: "Fillout", url: "https://www.fillout.com" },
  { name: "Paychex", src: "/images/integrations/paychex.jpeg", alt: "Paychex Flex", url: "https://www.paychex.com" },
  { name: "Stripe", src: "/images/integrations/stripe.jpeg", alt: "Stripe", url: "https://stripe.com" },
  { name: "Supabase", src: "/images/integrations/supabase.jpeg", alt: "Supabase", url: "https://supabase.com" },
];

function FeatureCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const cardWidth = 260 + 12; // w-[260px] + gap-3 (12px)
      const idx = Math.round(el.scrollLeft / cardWidth);
      setActiveIdx(Math.min(idx, FEATURES.length - 1));
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="sm:hidden -mx-6 px-6">
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="flex-none w-[260px] snap-start rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <f.icon className="h-7 w-7 text-[#dd8c33]/80 mb-3" />
            <h3 className="text-sm font-bold mb-1">{f.title}</h3>
            <p className="text-[11px] text-white/40 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-2">
        {FEATURES.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              scrollRef.current?.scrollTo({ left: i * (260 + 12), behavior: "smooth" });
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIdx ? "w-6 bg-[#dd8c33]" : "w-3 bg-white/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b1422]" />}>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const searchParams = useSearchParams();
  const authParam = searchParams.get("auth");
  const codeParam = searchParams.get("code") ?? "";
  const [loginOpen, setLoginOpen] = useState(authParam === "login");
  const [registerOpen, setRegisterOpen] = useState(authParam === "register" || !!codeParam);
  const [tosOpen, setTosOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState(codeParam);
  const [partners, setPartners] = useState<{ name: string; logo_url: string | null; website_url: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc("get_partner_companies");
        if (data?.length) setPartners(data);
      } catch (e) { logger.swallow("landing:load-partners", e, "debug"); }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b1422] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0b1422]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Image src="/images/overwatch_logo.png?v=2" alt="Overwatch" width={54} height={54} className="w-8 sm:w-[54px] h-auto" />
            <span className="font-mono text-xl sm:text-3xl font-bold tracking-tight leading-none">OVERWATCH</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setLoginOpen(true)} className="text-xs sm:text-sm text-white/60 hover:text-white transition-colors px-2 sm:px-3 py-1.5">
              Sign In
            </button>
            <button onClick={() => setRegisterOpen(true)} className="text-xs sm:text-sm font-medium bg-[#dd8c33] text-white px-3 sm:px-4 py-1.5 rounded-lg hover:bg-[#c47a2a] transition-colors whitespace-nowrap">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-44 pb-24">
        <div className="absolute inset-0 z-[15] pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-[#dd8c33]/8 via-transparent to-transparent rounded-full blur-3xl" />
        {/* Desktop: 3D Globe */}
        <div className="hidden md:block"><ErrorBoundary fallback={<div style={{ height: "clamp(160px, 22vw, 280px)" }} />}><TacticalGlobe /></ErrorBoundary></div>
        {/* Mobile: Animated Radar Grid — centered behind hero text */}
        <div className="md:hidden absolute inset-x-0 z-10 flex items-center justify-center" style={{ top: "15%" }}>
          <MobileHeroRadar />
        </div>

        <div className="relative z-20 mx-auto max-w-4xl px-6 text-center pointer-events-none">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dd8c33]/20 bg-[#dd8c33]/10 px-4 py-1.5 text-xs text-[#dd8c33]" style={{ textShadow: '0 0 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <Lock className="h-3 w-3" /> Military-Grade Security Workforce Platform
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight font-mono leading-[1.1] mb-6">
            <span className="text-white">COMMAND</span>
            <br />
            <span className="bg-gradient-to-r from-[#dd8c33] via-[#f0a84a] to-[#dd8c33] bg-clip-text text-transparent">YOUR FORCE</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60 leading-relaxed mb-10" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.95), 0 0 30px rgba(0,0,0,0.7)' }}>
            Overwatch unifies workforce management, training, compliance, and field operations
            into one tactical platform built for security professionals.
          </p>
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <button onClick={() => setRegisterOpen(true)} className="pointer-events-auto inline-flex items-center gap-2 bg-[#dd8c33] text-white font-semibold px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl hover:bg-[#c47a2a] transition-all text-sm">
              Deploy Now <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={() => setLoginOpen(true)} className="pointer-events-auto inline-flex items-center gap-2 border border-[#dd8c33]/30 text-white/80 px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl hover:bg-[#dd8c33]/10 transition-all text-sm">
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative z-40 border-y border-white/5 bg-[#0b1422]">
        <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold font-mono bg-gradient-to-r from-[#dd8c33] to-[#f0a84a] bg-clip-text text-transparent">{s.value}</p>
              <p className="text-xs text-white/40 mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-24 bg-[#0b1422]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-mono tracking-tight mb-4">FULL-SPECTRUM OPERATIONS</h2>
            <p className="text-white/40 max-w-xl mx-auto">Everything your security operation needs — from applicant intake to field deployment — in one platform.</p>
          </div>
          {/* Desktop: grid layout */}
          <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-[#dd8c33]/20 hover:bg-[#dd8c33]/5 transition-all">
                <f.icon className="h-8 w-8 text-[#dd8c33]/80 mb-4" />
                <h3 className="text-sm font-bold mb-1">{f.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          {/* Mobile: horizontal scroll carousel */}
          <FeatureCarousel />
        </div>
      </section>

      {/* Integrations */}
      <section className="relative z-10 py-16 border-t border-white/5 bg-[#0b1422]">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight mb-3">INTEGRATES WITH YOUR STACK</h2>
            <p className="text-white/40 max-w-lg mx-auto text-sm">Connect Overwatch with the tools your team already uses — or go fully native.</p>
          </div>
          {/* Row 1: first 7 */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-5 sm:gap-6 justify-items-center max-w-3xl mx-auto">
            {INTEGRATIONS_LOGOS.slice(0, 7).map((int) => (
              <a key={int.name} href={int.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group">
                <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/5 group-hover:border-[#dd8c33]/30 group-hover:bg-[#dd8c33]/5 transition-all overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={int.src} alt={int.alt} className="h-full w-full object-cover" />
                </div>
                <span className="text-[10px] text-white/30 font-medium group-hover:text-white/50 transition-colors">{int.name}</span>
              </a>
            ))}
          </div>
          {/* Row 2: remaining 7, centered */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-5 sm:gap-6 justify-items-center max-w-3xl mx-auto mt-6">
            {INTEGRATIONS_LOGOS.slice(7).map((int) => (
              <a key={int.name} href={int.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group">
                <div className="h-14 w-14 rounded-xl bg-white/5 border border-white/5 group-hover:border-[#dd8c33]/30 group-hover:bg-[#dd8c33]/5 transition-all overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={int.src} alt={int.alt} className="h-full w-full object-cover" />
                </div>
                <span className="text-[10px] text-white/30 font-medium group-hover:text-white/50 transition-colors">{int.name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      {partners.length > 0 && (
        <section className="relative py-16 border-t border-white/5">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
          <div className="relative mx-auto max-w-5xl px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight mb-3">TRUSTED BY SECURITY PROFESSIONALS</h2>
              <p className="text-white/40 max-w-lg mx-auto text-sm">Companies already using Overwatch to command their operations.</p>
            </div>
            <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, black 10%, black 90%, transparent)" }}>
              <div className="flex animate-[scroll_30s_linear_infinite] gap-10 w-max">
                {[...partners, ...partners].map((p, i) => {
                  const badge = (
                    <div title={p.name} className="shrink-0">
                      {p.logo_url ? (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 overflow-hidden p-1 hover:border-[#dd8c33]/30 hover:bg-white/10 transition-all">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.logo_url} alt={p.name} className="h-12 w-12 object-contain" />
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#dd8c33]/10 border border-[#dd8c33]/20 hover:border-[#dd8c33]/40 hover:bg-[#dd8c33]/15 transition-all">
                          <span className="text-xl font-bold font-mono text-[#dd8c33]/70">{p.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                  );
                  return p.website_url ? (
                    <a key={`${p.name}-${i}`} href={p.website_url} target="_blank" rel="noopener noreferrer">
                      {badge}
                    </a>
                  ) : (
                    <div key={`${p.name}-${i}`}>{badge}</div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-mono tracking-tight mb-4">READY TO DEPLOY?</h2>
          <p className="text-white/40 mb-8 max-w-lg mx-auto">Join security companies already using Overwatch to manage their workforce, training, and operations.</p>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setRegisterOpen(true)} className="inline-flex items-center gap-2 bg-[#dd8c33] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#c47a2a] transition-all text-sm">
              Create Free Account <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/5 bg-[#070d18]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="relative mx-auto max-w-6xl px-6 py-12">
          {/* Footer nav columns */}
          <div className="grid gap-8 grid-cols-2 sm:grid-cols-3 mb-10">
            {/* Platform links */}
            <div className="flex flex-col items-center sm:items-start gap-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Platform</h4>
              <button onClick={() => setLoginOpen(true)} className="text-xs text-white/40 hover:text-[#dd8c33] transition-colors">Sign In</button>
              <button onClick={() => setRegisterOpen(true)} className="text-xs text-white/40 hover:text-[#dd8c33] transition-colors">Create Account</button>
              <button onClick={() => setJoinOpen(true)} className="text-xs text-white/40 hover:text-[#dd8c33] transition-colors">Join a Company</button>
            </div>

            {/* Legal links */}
            <div className="flex flex-col items-center sm:items-start gap-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Legal</h4>
              <button onClick={() => setTosOpen(true)} className="text-xs text-white/40 hover:text-[#dd8c33] transition-colors">Terms of Service</button>
              <button onClick={() => setPrivacyOpen(true)} className="text-xs text-white/40 hover:text-[#dd8c33] transition-colors">Privacy Policy</button>
              <a href="mailto:contact@evenfalladvantage.com" className="text-xs text-white/40 hover:text-[#dd8c33] transition-colors">Contact</a>
            </div>

            {/* Branding — desktop only, subtle */}
            <div className="hidden sm:flex flex-col items-start gap-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Powered By</h4>
              <a href="https://www.evenfalladvantage.com" target="_blank" rel="noopener noreferrer">
                <Image src="/images/logo.png" alt="Evenfall Advantage" width={120} height={36} className="w-[100px] h-auto opacity-40 hover:opacity-70 transition-opacity" />
              </a>
            </div>
          </div>

          {/* Compliance Badges */}
          <div className="border-t border-white/5 pt-6 pb-4">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {[
                { label: "SOC 2", sub: "Type I Ready", href: "https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2", icon: (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                )},
                { label: "CCPA", sub: "Compliant", href: "https://oag.ca.gov/privacy/ccpa", icon: (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                )},
                { label: "AES-256", sub: "Encrypted", href: "https://en.wikipedia.org/wiki/Advanced_Encryption_Standard", icon: (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                )},
                { label: "TLS 1.2+", sub: "Enforced", href: "https://en.wikipedia.org/wiki/Transport_Layer_Security", icon: (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                )},
                { label: "WCAG", sub: "2.2 AA", href: "https://www.w3.org/WAI/standards-guidelines/wcag/", icon: (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                )},
                { label: "99.5%", sub: "Uptime SLA", href: "https://en.wikipedia.org/wiki/Service-level_agreement", icon: (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                )},
              ].map((badge) => (
                <a
                  key={badge.label}
                  href={badge.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-white/30 hover:text-white/50 hover:border-white/10 hover:bg-white/[0.04] transition-all group"
                >
                  <span className="text-[#dd8c33]/50 group-hover:text-[#dd8c33]/80 transition-colors">{badge.icon}</span>
                  <span className="flex flex-col leading-none">
                    <span className="text-[10px] font-bold font-mono tracking-wider">{badge.label}</span>
                    <span className="text-[8px] text-white/50 group-hover:text-white/60">{badge.sub}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[10px] text-white/50 font-mono">&copy; {new Date().getFullYear()} Evenfall Advantage LLC. All rights reserved.</p>
            <p className="text-[10px] text-white/50 font-mono">Built with purpose. Deployed with precision.</p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSwitchToRegister={() => { setLoginOpen(false); setRegisterOpen(true); }} onSwitchToJoin={() => { setLoginOpen(false); setJoinOpen(true); }} />
      <RegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} onSwitchToLogin={() => { setRegisterOpen(false); setLoginOpen(true); }} joinCode={pendingJoinCode} />
      <TOSModal open={tosOpen} onClose={() => setTosOpen(false)} />
      <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <JoinCompanyModal open={joinOpen} onClose={() => setJoinOpen(false)} onSwitchToRegister={(code?: string) => { setJoinOpen(false); if (code) setPendingJoinCode(code); setRegisterOpen(true); }} onSwitchToLogin={() => { setJoinOpen(false); setLoginOpen(true); }} />
    </div>
  );
}
