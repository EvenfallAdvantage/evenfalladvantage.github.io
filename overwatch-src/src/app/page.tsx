import Link from "next/link";
import Image from "next/image";
import {
  Shield, Radio, GraduationCap, MapPin, FileText,
  BarChart3, Users, Clock, Video, BookOpen,
  ChevronRight, Zap, Lock, Globe,
} from "lucide-react";

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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Image src="/images/logo-shield.png" alt="Overwatch" width={32} height={32} className="rounded-lg" style={{ width: 32, height: "auto" }} />
            <span className="font-mono text-lg font-bold tracking-tight">OVERWATCH</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5">
              Sign In
            </Link>
            <Link href="/register" className="text-sm font-medium bg-white text-black px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Grid BG */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-blue-500/8 via-transparent to-transparent rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/60">
            <Lock className="h-3 w-3" /> Military-Grade Security Workforce Platform
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight font-mono leading-[1.1] mb-6">
            <span className="text-white">COMMAND</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">YOUR FORCE</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/50 leading-relaxed mb-10">
            Overwatch unifies workforce management, training, compliance, and field operations
            into one tactical platform built for security professionals.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register" className="inline-flex items-center gap-2 bg-white text-black font-semibold px-8 py-3 rounded-xl hover:bg-white/90 transition-all text-sm">
              Deploy Now <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 border border-white/20 text-white/80 px-8 py-3 rounded-xl hover:bg-white/5 transition-all text-sm">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold font-mono bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{s.value}</p>
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
              <div key={f.title} className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-white/10 hover:bg-white/[0.04] transition-all">
                <f.icon className="h-8 w-8 text-blue-400/80 mb-4" />
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
            <Link href="/register" className="inline-flex items-center gap-2 bg-white text-black font-semibold px-8 py-3 rounded-xl hover:bg-white/90 transition-all text-sm">
              Create Free Account <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/images/logo-shield.png" alt="Overwatch" width={20} height={20} className="rounded" style={{ width: 20, height: "auto" }} />
            <span className="font-mono text-xs text-white/40">OVERWATCH — Powered by Evenfall Advantage LLC</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <Link href="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-white/60 transition-colors">Register</Link>
            <Link href="/join" className="hover:text-white/60 transition-colors">Join Company</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
