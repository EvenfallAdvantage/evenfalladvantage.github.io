/**
 * Compliance & Certification Management
 *
 * Handles certification expiry tracking, compliance reporting,
 * and shift-gating based on required qualifications.
 */

import { createClient } from "./client";
// ensureInternalUser available for future per-user compliance checks
import { logDbReadError } from "./db-error";

// ─── Expiry Alerts ────────────────────────────────────────

export interface ExpiringCert {
  certId: string;
  userId: string;
  userName: string;
  certType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: "expiring_soon" | "expired";
}

/**
 * Get all certifications expiring within N days for a company.
 * Returns sorted by most urgent first.
 */
export async function getExpiringCertifications(
  companyId: string,
  daysThreshold = 90
): Promise<ExpiringCert[]> {
  const supabase = createClient();

  // Get active members
  const { data: members, error: memErr } = await supabase
    .from("company_memberships")
    .select("user_id, users(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("status", "active");
  if (memErr) { logDbReadError("compliance:members", memErr); return []; }
  if (!members?.length) return [];

  const userIds = members.map((m: { user_id: string }) => m.user_id);
  const userMap: Record<string, string> = {};
  for (const m of members) {
    const u = (m as unknown as { users: { first_name: string; last_name: string } | null }).users;
    userMap[m.user_id] = u ? `${u.first_name} ${u.last_name}` : "Unknown";
  }

  // Get certs with expiry dates
  const { data: certs, error: certErr } = await supabase
    .from("certifications")
    .select("id, user_id, cert_type, expiry_date, status")
    .in("user_id", userIds)
    .not("expiry_date", "is", null)
    .order("expiry_date", { ascending: true });
  if (certErr) { logDbReadError("compliance:certs", certErr); return []; }

  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  return (certs ?? [])
    .filter((c: { expiry_date: string }) => new Date(c.expiry_date) <= thresholdDate)
    .map((c: { id: string; user_id: string; cert_type: string; expiry_date: string }) => {
      const expiry = new Date(c.expiry_date);
      const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return {
        certId: c.id,
        userId: c.user_id,
        userName: userMap[c.user_id] ?? "Unknown",
        certType: c.cert_type,
        expiryDate: c.expiry_date,
        daysUntilExpiry: daysUntil,
        status: daysUntil <= 0 ? "expired" as const : "expiring_soon" as const,
      };
    });
}

// ─── Compliance Summary ───────────────────────────────────

export interface ComplianceSummary {
  totalStaff: number;
  fullyCompliant: number;
  expiringSoon: number;   // within 90 days
  expired: number;
  noCerts: number;
  byType: { certType: string; total: number; valid: number; expiring: number; expired: number }[];
}

/**
 * Get a compliance summary for the entire company.
 */
export async function getComplianceSummary(companyId: string): Promise<ComplianceSummary> {
  const supabase = createClient();

  const { data: members } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");
  const totalStaff = members?.length ?? 0;

  if (!members?.length) {
    return { totalStaff: 0, fullyCompliant: 0, expiringSoon: 0, expired: 0, noCerts: 0, byType: [] };
  }

  const userIds = members.map((m: { user_id: string }) => m.user_id);
  const { data: certs } = await supabase
    .from("certifications")
    .select("user_id, cert_type, expiry_date, status")
    .in("user_id", userIds);

  const now = new Date();
  const soon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const usersWithCerts = new Set<string>();
  const usersWithExpired = new Set<string>();
  const usersWithExpiring = new Set<string>();
  const byType = new Map<string, { total: number; valid: number; expiring: number; expired: number }>();

  for (const c of certs ?? []) {
    usersWithCerts.add(c.user_id);
    const type = c.cert_type;
    if (!byType.has(type)) byType.set(type, { total: 0, valid: 0, expiring: 0, expired: 0 });
    const entry = byType.get(type)!;
    entry.total++;

    if (c.expiry_date) {
      const expiry = new Date(c.expiry_date);
      if (expiry < now) {
        entry.expired++;
        usersWithExpired.add(c.user_id);
      } else if (expiry <= soon) {
        entry.expiring++;
        usersWithExpiring.add(c.user_id);
      } else {
        entry.valid++;
      }
    } else {
      entry.valid++; // No expiry = perpetual
    }
  }

  const noCerts = totalStaff - usersWithCerts.size;
  const fullyCompliant = totalStaff - usersWithExpired.size - usersWithExpiring.size - noCerts;

  return {
    totalStaff,
    fullyCompliant: Math.max(0, fullyCompliant),
    expiringSoon: usersWithExpiring.size,
    expired: usersWithExpired.size,
    noCerts,
    byType: Array.from(byType.entries()).map(([certType, stats]) => ({ certType, ...stats })),
  };
}

// ─── Shift Qualification Check ────────────────────────────

/**
 * Check if a user has the required certifications for a shift/event.
 * Returns { qualified: true } or { qualified: false, missing: [...] }.
 */
export async function checkShiftQualification(
  userId: string,
  requiredCertTypes: string[]
): Promise<{ qualified: boolean; missing: string[] }> {
  if (!requiredCertTypes.length) return { qualified: true, missing: [] };

  const supabase = createClient();
  const { data: certs } = await supabase
    .from("certifications")
    .select("cert_type, expiry_date")
    .eq("user_id", userId)
    .in("cert_type", requiredCertTypes);

  const now = new Date();
  const validTypes = new Set(
    (certs ?? [])
      .filter((c: { expiry_date: string | null }) => !c.expiry_date || new Date(c.expiry_date) > now)
      .map((c: { cert_type: string }) => c.cert_type)
  );

  const missing = requiredCertTypes.filter(t => !validTypes.has(t));
  return { qualified: missing.length === 0, missing };
}
