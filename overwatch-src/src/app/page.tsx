"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Shield, Radio, GraduationCap, MapPin, FileText,
  BarChart3, Users, Clock, Video, BookOpen,
  ChevronRight, Zap, Lock, Globe,
  X, Phone, Mail, ArrowRight, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  { icon: Radio, title: "Live Comms", desc: "Encrypted team channels with real-time messaging" },
  { icon: GraduationCap, title: "LMS Training", desc: "Slideshow courses, quizzes, and certification tracking" },
  { icon: Shield, title: "Site Assessment", desc: "7-section security evaluations with PDF risk reports" },
  { icon: MapPin, title: "Geo-Risk Intel", desc: "FBI UCR crime data for any US location with risk scoring" },
  { icon: FileText, title: "Invoice Generator", desc: "Professional invoices with line items and PDF export" },
  { icon: Clock, title: "Time Clock", desc: "GPS-verified clock in/out with patrol route logging" },
  { icon: Video, title: "Instructor Room", desc: "Live video training sessions with Daily.co integration" },
  { icon: BookOpen, title: "Course Catalog", desc: "Stripe-powered course enrollment with certificates" },
  { icon: Users, title: "Workforce Mgmt", desc: "Roster, scheduling, leave requests, and shift management" },
  { icon: BarChart3, title: "Incident Reports", desc: "Field reports with custom forms and analytics" },
  { icon: Globe, title: "State Laws DB", desc: "All 50 states — licensing, training, and use-of-force laws" },
  { icon: Zap, title: "De-escalation Sims", desc: "Branching dialogue scenarios with emotional tension meters" },
];

const STATS = [
  { value: "45+", label: "Platform Pages" },
  { value: "50", label: "State Law Database" },
  { value: "6", label: "Training Courses" },
  { value: "24/7", label: "Operational Uptime" },
];

function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`,
      });
      if (otpError) throw otpError;
      router.push(`/verify?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally { setLoading(false); }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push("/feed");
      router.refresh();
    } catch (err) {
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
          </form>
        )}

        <div className="mt-4 text-center space-y-2">
          <p className="text-xs text-white/40">Don&apos;t have an account? <Link href="/register" className="text-[#dd8c33] hover:underline font-medium">Create one</Link></p>
          <p className="text-xs text-white/30"><Link href="/join" className="hover:text-white/50">Have a company code? Join here</Link></p>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b1422] text-white">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0b1422]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Image src="/images/overwatch_logo.png" alt="Overwatch" width={36} height={36} style={{ width: 36, height: "auto" }} />
            <span className="font-mono text-lg font-bold tracking-tight">OVERWATCH</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLoginOpen(true)} className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5">
              Sign In
            </button>
            <Link href="/register" className="text-sm font-medium bg-[#dd8c33] text-white px-4 py-1.5 rounded-lg hover:bg-[#c47a2a] transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-[#dd8c33]/8 via-transparent to-transparent rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <Image src="/images/overwatch_logo.png" alt="Overwatch" width={100} height={100} className="mx-auto mb-6" style={{ width: 100, height: "auto" }} />
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dd8c33]/20 bg-[#dd8c33]/10 px-4 py-1.5 text-xs text-[#dd8c33]">
            <Lock className="h-3 w-3" /> Professional Security Workforce Platform
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
          <div className="flex items-center justify-center gap-4">
            <Link href="/register" className="inline-flex items-center gap-2 bg-[#dd8c33] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#c47a2a] transition-all text-sm">
              Deploy Now <ChevronRight className="h-4 w-4" />
            </Link>
            <button onClick={() => setLoginOpen(true)} className="inline-flex items-center gap-2 border border-[#dd8c33]/30 text-white/80 px-8 py-3 rounded-xl hover:bg-[#dd8c33]/10 transition-all text-sm">
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-white/5 bg-white/[0.02]">
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
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-mono tracking-tight mb-4">FULL-SPECTRUM OPERATIONS</h2>
            <p className="text-white/40 max-w-xl mx-auto">Everything your security operation needs — from onboarding to field deployment — in one platform.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* CTA */}
      <section className="py-20 border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-mono tracking-tight mb-4">READY TO DEPLOY?</h2>
          <p className="text-white/40 mb-8 max-w-lg mx-auto">Join security companies already using Overwatch to manage their workforce, training, and operations.</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register" className="inline-flex items-center gap-2 bg-[#dd8c33] text-white font-semibold px-8 py-3 rounded-xl hover:bg-[#c47a2a] transition-all text-sm">
              Create Free Account <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/images/overwatch_logo.png" alt="Overwatch" width={20} height={20} style={{ width: 20, height: "auto" }} />
            <span className="font-mono text-xs text-white/40">OVERWATCH — Powered by Evenfall Advantage LLC</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <button onClick={() => setLoginOpen(true)} className="hover:text-white/60 transition-colors">Sign In</button>
            <Link href="/register" className="hover:text-white/60 transition-colors">Register</Link>
            <Link href="/join" className="hover:text-white/60 transition-colors">Join Company</Link>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
