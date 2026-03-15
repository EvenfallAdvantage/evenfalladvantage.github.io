import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
      <div className="relative text-center max-w-md">
        <Image src="/images/logo-shield.png" alt="Overwatch" width={48} height={48} className="rounded-xl mx-auto mb-6" style={{ width: 48, height: "auto" }} />
        <p className="text-8xl font-bold font-mono bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">404</p>
        <h1 className="text-xl font-bold font-mono mb-2">SECTOR NOT FOUND</h1>
        <p className="text-sm text-white/40 mb-8">The requested area is outside our operational perimeter. It may have been moved or decommissioned.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/feed" className="inline-flex items-center gap-2 bg-white text-black font-semibold px-6 py-2.5 rounded-xl hover:bg-white/90 transition-all text-sm">
            Return to Base
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 border border-white/20 text-white/70 px-6 py-2.5 rounded-xl hover:bg-white/5 transition-all text-sm">
            Landing Page
          </Link>
        </div>
        <p className="mt-10 text-[10px] text-white/20 font-mono uppercase tracking-widest">Overwatch Security Platform</p>
      </div>
    </div>
  );
}
