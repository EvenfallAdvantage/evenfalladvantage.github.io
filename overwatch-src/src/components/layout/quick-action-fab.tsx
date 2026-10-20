"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X, Zap, ScanLine, Clock, ArrowLeftRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const ACTIONS = [
  { href: "/incidents/?quick=1", label: "Quick report", Icon: Zap, cls: "bg-amber-500" },
  { href: "/patrols/", label: "Scan checkpoint", Icon: ScanLine, cls: "bg-emerald-600" },
  { href: "/timeclock/", label: "Clock in / out", Icon: Clock, cls: "bg-sky-600" },
];

// Routes where a floating button would cover the content (the 3D map at "/", chat composer, scanners,
// and the Watch page, whose Clock/Patrols tabs already are these actions and whose Weekly Hours card sat under it).
const HIDE_ON = ["/timeclock", "/admin/operations", "/admin/map", "/geo-risk", "/chat", "/scan", "/dictate", "/auth", "/login"];

/** Thumb-zone "+" for the three things a guard does most. Phone only; side is switchable. */
export function QuickActionFab() {
  const pathname = usePathname() || "";
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  // Menu is "open for this path" so navigating closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenFor((typeof v === "function" ? v(open) : v) ? pathname : null);
  const [left, setLeft] = useState(() => typeof window !== "undefined" && localStorage.getItem("ow-fab-side") === "left");
  if (!activeCompanyId || pathname === "/" || HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  const side = left ? "left-4" : "right-4";
  return (
    <div className="md:hidden" data-testid="quick-fab">
      {open && <button type="button" aria-label="Close quick actions" onClick={() => setOpen(false)} className="fixed inset-0 z-[55] bg-black/40" />}
      <div className={`fixed ${side} z-[56] flex flex-col ${left ? "items-start" : "items-end"} gap-2`} style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px) + 12px)" }}>
        {open && ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className={`flex h-12 items-center gap-2 rounded-full ${a.cls} pl-4 pr-5 text-sm font-semibold text-white shadow-lg`}>
            <a.Icon className="h-5 w-5" />{a.label}
          </Link>
        ))}
        {open && (
          <button type="button" onClick={() => { const v = !left; setLeft(v); localStorage.setItem("ow-fab-side", v ? "left" : "right"); }}
            className="flex h-11 items-center gap-2 rounded-full bg-background/90 px-4 text-xs font-medium shadow">
            <ArrowLeftRight className="h-4 w-4" />Move to {left ? "right" : "left"} hand
          </button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close quick actions" : "Quick actions"}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background/60">
          {open ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
        </button>
      </div>
    </div>
  );
}
