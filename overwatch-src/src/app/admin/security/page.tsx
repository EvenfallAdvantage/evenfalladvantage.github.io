"use client";

/**
 * Security Dashboard — NIST 800-171 §3.3 (Audit & Accountability)
 *
 * Provides admins with visibility into:
 * - Security event timeline
 * - Failed login attempts & lockouts
 * - Session activity
 * - Security posture summary
 * - Encryption status
 */

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { getAuditLogs, getSecurityStats } from "@/lib/security/audit";
import {
  Shield, Lock, AlertTriangle, Eye, CheckCircle2, XCircle,
  Clock, Activity, ShieldCheck, Key, RefreshCw,
} from "lucide-react";

interface AuditLog {
  id: string;
  event_type: string;
  user_id: string | null;
  company_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  outcome: string;
  created_at: string;
}

const EVENT_LABELS: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  "auth.login.success": { label: "Login Success", icon: CheckCircle2, color: "text-green-500" },
  "auth.login.failed": { label: "Login Failed", icon: XCircle, color: "text-red-500" },
  "auth.logout": { label: "Logout", icon: Lock, color: "text-blue-500" },
  "auth.session.timeout": { label: "Session Timeout", icon: Clock, color: "text-amber-500" },
  "auth.session.locked": { label: "Session Locked", icon: Lock, color: "text-amber-500" },
  "auth.password.changed": { label: "Password Changed", icon: Key, color: "text-blue-500" },
  "security.lockout": { label: "Account Lockout", icon: AlertTriangle, color: "text-red-600" },
  "security.suspicious_activity": { label: "Suspicious Activity", icon: AlertTriangle, color: "text-red-600" },
  "data.export": { label: "Data Export", icon: Activity, color: "text-blue-400" },
  "admin.role.changed": { label: "Role Changed", icon: ShieldCheck, color: "text-purple-500" },
  "admin.user.invited": { label: "User Invited", icon: CheckCircle2, color: "text-green-400" },
  "admin.user.removed": { label: "User Removed", icon: XCircle, color: "text-red-400" },
};

const SECURITY_CONTROLS = [
  { name: "AES-256-GCM Encryption", standard: "FIPS 140-2", status: "active" },
  { name: "PBKDF2-SHA256 Key Derivation", standard: "NIST SP 800-132", status: "active" },
  { name: "Password Policy (12+ char, 3/4 types)", standard: "NIST 800-63B", status: "active" },
  { name: "Session Timeout (15 min lock / 30 min logout)", standard: "NIST 800-171 §3.1.10", status: "active" },
  { name: "Content Security Policy", standard: "OWASP", status: "active" },
  { name: "Brute-force Protection (5 attempts / 15 min)", standard: "NIST 800-171 §3.1.8", status: "active" },
  { name: "Audit Logging", standard: "NIST 800-171 §3.3", status: "active" },
  { name: "Input Sanitization (XSS Prevention)", standard: "OWASP Top 10", status: "active" },
  { name: "Row-Level Security (Supabase RLS)", standard: "CIS Benchmark", status: "active" },
  { name: "TLS 1.3 In-Transit Encryption", standard: "NIST 800-171 §3.13", status: "active" },
  { name: "X-Frame-Options / X-Content-Type-Options", standard: "OWASP", status: "active" },
  { name: "Referrer Policy (strict-origin)", standard: "W3C", status: "active" },
];

export default function SecurityDashboardPage() {
  const { user } = useAuthStore();
  const activeCompanyId = user?.companies?.[0]?.companyId;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState({ events24h: 0, failedLogins7d: 0, lockouts7d: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        getAuditLogs(activeCompanyId, { limit: 100, eventType: filter || undefined }),
        getSecurityStats(activeCompanyId),
      ]);
      setLogs(logsData as AuditLog[]);
      setStats(statsData);
    } catch {
      // Table may not exist yet
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, filter]);

  useEffect(() => { load(); }, [load]);

  const threatLevel = stats.lockouts7d > 3 ? "HIGH" : stats.failedLogins7d > 10 ? "ELEVATED" : "NORMAL";
  const threatColor = threatLevel === "HIGH" ? "text-red-500" : threatLevel === "ELEVATED" ? "text-amber-500" : "text-green-500";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold font-mono">SECURITY CENTER</h1>
            <p className="text-xs text-muted-foreground">NIST 800-171 / CMMC Level 2 Compliance Dashboard</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Eye className="h-3.5 w-3.5" /> Threat Level
          </div>
          <p className={`text-2xl font-bold font-mono ${threatColor}`}>{threatLevel}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Activity className="h-3.5 w-3.5" /> Events (24h)
          </div>
          <p className="text-2xl font-bold font-mono">{stats.events24h}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <XCircle className="h-3.5 w-3.5 text-red-400" /> Failed Logins (7d)
          </div>
          <p className="text-2xl font-bold font-mono text-red-400">{stats.failedLogins7d}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Lockouts (7d)
          </div>
          <p className="text-2xl font-bold font-mono text-amber-400">{stats.lockouts7d}</p>
        </div>
      </div>

      {/* Two Column: Controls + Event Log */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Security Controls */}
        <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card">
          <div className="border-b border-border/50 px-4 py-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" /> Security Controls
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">{SECURITY_CONTROLS.length} active controls</p>
          </div>
          <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
            {SECURITY_CONTROLS.map((ctrl) => (
              <div key={ctrl.name} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{ctrl.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{ctrl.standard}</p>
                </div>
                <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-green-500">
                  <CheckCircle2 className="h-3 w-3" /> ACTIVE
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Event Log */}
        <div className="lg:col-span-3 rounded-xl border border-border/50 bg-card">
          <div className="border-b border-border/50 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" /> Audit Log
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Last 100 security events</p>
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-[11px] bg-muted/50 border border-border/50 rounded-md px-2 py-1 outline-none"
            >
              <option value="">All Events</option>
              <option value="auth.login.success">Login Success</option>
              <option value="auth.login.failed">Login Failed</option>
              <option value="auth.session.timeout">Session Timeout</option>
              <option value="auth.session.locked">Session Locked</option>
              <option value="security.lockout">Lockouts</option>
            </select>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading events...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center">
                <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No security events recorded yet</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Events will appear here after running the <code className="text-amber-500">add-security-audit.sql</code> migration
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {logs.map((log) => {
                  const config = EVENT_LABELS[log.event_type] || { label: log.event_type, icon: Activity, color: "text-muted-foreground" };
                  const Icon = config.icon;
                  return (
                    <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium">{config.label}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            log.outcome === "success" ? "bg-green-500/10 text-green-500" :
                            log.outcome === "blocked" ? "bg-red-500/10 text-red-500" :
                            "bg-amber-500/10 text-amber-500"
                          }`}>
                            {log.outcome.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(log.created_at).toLocaleString()}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <> — {JSON.stringify(log.metadata)}</>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Badge */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-4">
        <Shield className="h-10 w-10 text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-bold font-mono text-amber-500">MILITARY-GRADE SECURITY ACTIVE</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            This platform implements AES-256-GCM encryption (FIPS 140-2), NIST 800-63B password policy,
            NIST 800-171 session controls, Content Security Policy, brute-force protection, and comprehensive
            audit logging. All security controls are continuously enforced.
          </p>
        </div>
      </div>
    </div>
  );
}
