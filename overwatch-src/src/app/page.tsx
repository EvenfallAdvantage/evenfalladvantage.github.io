"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Shield, Radio, GraduationCap, MapPin,
  BarChart3, Users, Clock, BookOpen,
  ChevronRight, Zap, Lock, Globe,
  X, Phone, Mail, ArrowRight, Loader2, FileCheck,
  UserPlus, Plug, Smartphone, Crosshair, AlertTriangle, Fingerprint,
} from "lucide-react";
import dynamic from "next/dynamic";
import { TOSModal } from "@/components/terms-of-service";

const TacticalGlobe = dynamic(() => import("@/components/tactical-globe").then((m) => m.TacticalGlobe), {
  ssr: false,
  loading: () => <div style={{ height: "clamp(160px, 22vw, 280px)" }} />,
});
import { createClient } from "@/lib/supabase/client";
import { registerUserInDB, joinCompanyByCode } from "@/lib/supabase/db";
import { useAuthStore } from "@/stores/auth-store";
import { checkPasswordStrength } from "@/lib/security";
import { logSecurityEvent, checkLoginAttempts, recordFailedAttempt, clearLoginAttempts } from "@/lib/security/audit";

const FEATURES = [
  { icon: Crosshair, title: "Patrol Operations", desc: "QR checkpoint scanning, geofenced patrol routes, GPS-verified activity logs, and real-time officer tracking across all active sites" },
  { icon: Clock, title: "Time & Attendance", desc: "GPS-verified clock in/out with kiosk PIN mode, geofencing, break tracking, timesheet corrections, and one-click Gusto payroll sync" },
  { icon: AlertTriangle, title: "Incident Command", desc: "Real-time incident reporting with severity tiers, status escalation, officer assignments, location tagging, and full audit trails" },
  { icon: Radio, title: "Encrypted Comms", desc: "AES-256 encrypted team channels with WhatsApp & Signal bridging, file attachments, reactions, read receipts, and unread tracking" },
  { icon: GraduationCap, title: "Academy LMS", desc: "Interactive slideshow courses, timed quizzes with question banks, certification tracking, state-specific curricula, and completion analytics" },
  { icon: Zap, title: "De-escalation Sims", desc: "Branching dialogue scenarios with real-time emotional tension meters, performance scoring, and scenario outcome tracking" },
  { icon: Shield, title: "Site Assessment", desc: "7-section security evaluations with risk matrix scoring, auto-generated recommendations, multi-page PDF reports, and CSV exports" },
  { icon: MapPin, title: "Geo-Risk Intel", desc: "FBI UCR crime data for any US location with composite risk scoring, threat heat mapping, and historical trend analysis" },
  { icon: UserPlus, title: "Hire-to-Deploy Pipeline", desc: "Public apply form, CSV bulk import, Checkr background checks, DocuSign e-sign, auto-onboarding checklists, and one-click deployment" },
  { icon: Users, title: "Personnel Command", desc: "Full roster management, shift scheduling with conflict detection, leave approvals, role-based access control, and readiness dashboards" },
  { icon: Fingerprint, title: "Military-Grade Security", desc: "AES-256-GCM encryption at rest, session auto-lock, brute-force protection, rate-limited RPCs, RLS policies, and 90-day audit logs" },
  { icon: Globe, title: "State Laws DB", desc: "All 50 states — licensing, training hours, use-of-force doctrine, citizen's arrest, weapons regs, statutes, and regulatory agency links" },
  { icon: BarChart3, title: "Analytics & Reports", desc: "KPI dashboards, incident analytics, personnel stats, weekly trends, org composition charts, and one-click CSV exports" },
  { icon: Plug, title: "12+ Integrations", desc: "Twilio SMS, Checkr background checks, DocuSign e-sign, Gusto payroll, Fillout forms, OneSignal push, WhatsApp, and more" },
  { icon: BookOpen, title: "Knowledge Base", desc: "Searchable field manuals, SOPs, company policies, required reading assignments with completion tracking, and document versioning" },
  { icon: Smartphone, title: "Mobile-First PWA", desc: "Installable app with offline fallback, PWA shortcuts, thumb-optimized navigation, dark/light themes, and sub-second page loads" },
];

const STATS = [
  { value: "20+", label: "Operations Modules" },
  { value: "50", label: "States Updated 2025" },
  { value: "11", label: "Integrations" },
  { value: "24/7", label: "Operational Uptime" },
];

function LoginModal({ open, onClose, onSwitchToRegister }: { open: boolean; onClose: () => void; onSwitchToRegister: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-[#dd8c33]/30 bg-[#0f1a2e] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white"><X className="h-5 w-5" /></button>

        <div className="flex flex-col items-center mb-5">
          <Image src="/images/overwatch_logo.png" alt="Overwatch" width={64} height={64} style={{ width: 64, height: "auto" }} />
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
                <input type="tel" placeholder="(555) 123-4567" value={phone} onChange={e => setPhone(e.target.value)} required
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
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 focus:ring-1 focus:ring-[#dd8c33]/20 placeholder:text-white/30" />
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
          <p className="text-xs text-white/30"><Link href="/join" className="hover:text-white/50">Have a company code? Join here</Link></p>
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
  const [companyName, setCompanyName] = useState("");
  const [step, setStep] = useState<"info" | "company" | "done">(joinCode ? "info" : "info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [useJoinCode, setUseJoinCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState(joinCode);
  const pwCheck = password.length > 0 ? checkPasswordStrength(password) : null;

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
  const infoValid = firstName && lastName && email && password && (pwCheck?.valid ?? false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-[#dd8c33]/30 bg-[#0f1a2e] p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white"><X className="h-5 w-5" /></button>

        <div className="flex flex-col items-center mb-5">
          <Image src="/images/overwatch_logo.png" alt="Overwatch" width={64} height={64} style={{ width: 64, height: "auto" }} />
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
              <input type="tel" placeholder="+1 (555) 123-4567" value={phone} onChange={e => setRegPhone(e.target.value)}
                className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 placeholder:text-white/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">Password</label>
              <input type="password" placeholder="Min 12 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={12} autoComplete="new-password"
                className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#dd8c33]/50 placeholder:text-white/30" />
              {pwCheck && (
                <div className="mt-1.5">
                  <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full transition-all ${strengthColors[pwCheck.strength] ?? ""}`} /></div>
                  <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wider">{pwCheck.strength}</p>
                </div>
              )}
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
  { name: "WhatsApp", src: "/images/integrations/whatsapp.png", alt: "WhatsApp Business" },
  { name: "Signal", src: "/images/integrations/signal.png", alt: "Signal" },
  { name: "Twilio", src: "/images/integrations/twilio.jpeg", alt: "Twilio" },
  { name: "Checkr", src: "/images/integrations/checkr.jpeg", alt: "Checkr" },
  { name: "Gusto", src: "/images/integrations/gusto.jpeg", alt: "Gusto" },
  { name: "DocuSign", src: "/images/integrations/docusign.jpeg", alt: "DocuSign" },
  { name: "OneSignal", src: "/images/integrations/onesignal.jpeg", alt: "OneSignal" },
  { name: "Airtable", src: "/images/integrations/airtable.jpeg", alt: "Airtable" },
  { name: "Fillout", src: "/images/integrations/fillout.png", alt: "Fillout" },
  { name: "Stripe", src: "/images/integrations/stripe.jpeg", alt: "Stripe" },
  { name: "Supabase", src: "/images/integrations/supabase.jpeg", alt: "Supabase" },
];

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
  const [partners, setPartners] = useState<{ name: string; logo_url: string | null; website_url: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc("get_partner_companies");
        if (data?.length) setPartners(data);
      } catch {}
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b1422] text-white">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0b1422]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Image src="/images/overwatch_logo.png" alt="Overwatch" width={54} height={54} style={{ width: 54, height: "auto" }} />
            <span className="font-mono text-3xl font-bold tracking-tight leading-none">OVERWATCH</span>
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
        <TacticalGlobe />

        <div className="relative z-20 mx-auto max-w-4xl px-6 text-center pointer-events-none">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dd8c33]/20 bg-[#dd8c33]/10 px-4 py-1.5 text-xs text-[#dd8c33]">
            <Lock className="h-3 w-3" /> Military-Grade Security Workforce Platform
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight font-mono leading-[1.1] mb-6">
            <span className="text-white">COMMAND</span>
            <br />
            <span className="bg-gradient-to-r from-[#dd8c33] via-[#f0a84a] to-[#dd8c33] bg-clip-text text-transparent">YOUR FORCE</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/50 leading-relaxed mb-10">
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
      <section className="relative z-10 border-y border-white/5 bg-[#0b1422]">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-[#dd8c33]/20 hover:bg-[#dd8c33]/5 transition-all">
                <f.icon className="h-8 w-8 text-[#dd8c33]/80 mb-4" />
                <h3 className="text-sm font-bold mb-1">{f.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="relative z-10 py-16 border-t border-white/5 bg-[#0b1422]">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight mb-3">INTEGRATES WITH YOUR STACK</h2>
            <p className="text-white/40 max-w-lg mx-auto text-sm">Connect Overwatch with the tools your team already uses — or go fully native.</p>
          </div>
          {/* Row 1: first 6 */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-6 sm:gap-8 justify-items-center max-w-2xl mx-auto">
            {INTEGRATIONS_LOGOS.slice(0, 6).map((int) => (
              <div key={int.name} className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 border border-white/5 group-hover:border-[#dd8c33]/30 group-hover:bg-[#dd8c33]/5 transition-all p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={int.src} alt={int.alt} className="h-8 w-8 object-contain" />
                </div>
                <span className="text-[10px] text-white/30 font-medium">{int.name}</span>
              </div>
            ))}
          </div>
          {/* Row 2: remaining 5, centered */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-6 sm:gap-8 justify-items-center max-w-[520px] mx-auto mt-6">
            {INTEGRATIONS_LOGOS.slice(6).map((int) => (
              <div key={int.name} className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 border border-white/5 group-hover:border-[#dd8c33]/30 group-hover:bg-[#dd8c33]/5 transition-all p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={int.src} alt={int.alt} className="h-8 w-8 object-contain" />
                </div>
                <span className="text-[10px] text-white/30 font-medium">{int.name}</span>
              </div>
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
      <footer className="relative border-t border-white/5 py-10">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="relative mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-white/40">Powered by</span>
            <a href="https://www.evenfalladvantage.com" target="_blank" rel="noopener noreferrer">
              <Image src="/images/logo.png" alt="Evenfall Advantage" width={160} height={160} className="w-[80px] sm:w-[160px] h-auto" />
            </a>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <button onClick={() => setLoginOpen(true)} className="hover:text-white/60 transition-colors">Sign In</button>
            <button onClick={() => setRegisterOpen(true)} className="hover:text-white/60 transition-colors">Register</button>
            <Link href="/join" className="hover:text-white/60 transition-colors">Join Company</Link>
            <button onClick={() => setTosOpen(true)} className="hover:text-white/60 transition-colors flex items-center gap-1">
              <FileCheck className="h-3 w-3" /> Terms of Service
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSwitchToRegister={() => { setLoginOpen(false); setRegisterOpen(true); }} />
      <RegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} onSwitchToLogin={() => { setRegisterOpen(false); setLoginOpen(true); }} joinCode={codeParam} />
      <TOSModal open={tosOpen} onClose={() => setTosOpen(false)} />
    </div>
  );
}
