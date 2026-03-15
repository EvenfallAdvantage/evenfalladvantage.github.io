"use client";

/**
 * SecurityProvider — NIST 800-171 §3.1.10 (Session Lock)
 *
 * Implements:
 * - Auto-logout after 30 minutes of inactivity
 * - Session lock screen after 15 minutes of inactivity
 * - Activity tracking (mouse, keyboard, touch)
 * - Audit logging of session events
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { SESSION_TIMEOUT_MS, SESSION_TIMEOUT_EXTENDED_MS } from "@/lib/security";
import { logSecurityEvent } from "@/lib/security/audit";
import { Lock, ArrowRight } from "lucide-react";
import Image from "next/image";

const PUBLIC_PATHS = ["/", "/login", "/register", "/verify", "/join"];

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [locked, setLocked] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPublicPage = PUBLIC_PATHS.some((p) => pathname === p || pathname === `${p}/`);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If locked and user interacts, don't auto-unlock — they need to click "Unlock"
  }, []);

  // Track user activity
  useEffect(() => {
    if (isPublicPage || !user) return;

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity));
    };
  }, [isPublicPage, user, resetActivity]);

  // Session timeout check
  useEffect(() => {
    if (isPublicPage || !user) return;

    lockTimerRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;

      if (idle >= SESSION_TIMEOUT_EXTENDED_MS) {
        // Full timeout — log out
        handleForceLogout();
      } else if (idle >= SESSION_TIMEOUT_MS && !locked) {
        // Lock screen
        setLocked(true);
        logSecurityEvent({
          event_type: "auth.session.locked",
          user_id: user.id,
          company_id: user.companies?.[0]?.companyId,
          outcome: "success",
          metadata: { idle_ms: idle },
        });
      }
    }, 10_000); // Check every 10 seconds

    return () => {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicPage, user, locked]);

  async function handleForceLogout() {
    if (user) {
      logSecurityEvent({
        event_type: "auth.session.timeout",
        user_id: user.id,
        company_id: user.companies?.[0]?.companyId,
        outcome: "success",
      });
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleUnlock() {
    lastActivityRef.current = Date.now();
    setLocked(false);
  }

  // Lock screen overlay
  if (locked && !isPublicPage && user) {
    return (
      <>
        {children}
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm mx-4">
            <Image src="/images/overwatch_logo.png" alt="Overwatch" width={80} height={80} style={{ width: 80, height: "auto" }} />
            <div className="flex items-center gap-2 text-amber-500">
              <Lock className="h-5 w-5" />
              <h2 className="text-lg font-bold font-mono">SESSION LOCKED</h2>
            </div>
            <p className="text-sm text-white/50">
              Your session was locked due to inactivity.
              <br />This is a security measure per NIST 800-171 §3.1.10.
            </p>
            <button
              onClick={handleUnlock}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
            >
              <ArrowRight className="h-4 w-4" /> Resume Session
            </button>
            <button
              onClick={handleForceLogout}
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Sign out instead
            </button>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
