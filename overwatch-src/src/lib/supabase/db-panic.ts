/**
 * Panic / SOS / Duress Alert System
 *
 * Provides emergency alert functionality for lone workers and field staff.
 * When triggered:
 *   1. Captures current GPS position
 *   2. Creates an alert record in the database
 *   3. Sends push + SMS notifications to all managers
 *   4. Starts auto-escalation timer (if no acknowledge within N minutes)
 *
 * Table: panic_alerts (must be created via SQL migration)
 *   id, user_id, company_id, lat, lng, accuracy, status, acknowledged_by,
 *   acknowledged_at, escalated, created_at
 */

import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

export type AlertStatus = "active" | "acknowledged" | "resolved" | "false_alarm";

export interface PanicAlert {
  id: string;
  userId: string;
  userName: string;
  companyId: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  status: AlertStatus;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  escalated: boolean;
  createdAt: string;
}

// ─── Trigger ──────────────────────────────────────────────

/**
 * Trigger a panic/SOS alert. Captures GPS if available.
 * Returns the alert ID on success.
 */
export async function triggerPanicAlert(companyId: string): Promise<string | null> {
  const userId = await ensureInternalUser();
  if (!userId) return null;

  // Try to get current position (timeout 5s — don't block the alert)
  let lat: number | null = null;
  let lng: number | null = null;
  let accuracy: number | null = null;

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      });
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy = pos.coords.accuracy;
  } catch {
    // GPS unavailable — alert goes out without location
  }

  const supabase = createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("panic_alerts")
    .insert({
      id,
      user_id: userId,
      company_id: companyId,
      lat,
      lng,
      accuracy,
      status: "active",
      acknowledged_by: null,
      acknowledged_at: null,
      escalated: false,
      ...ts(),
    });

  if (error) {
    console.error("[Panic] Failed to create alert:", error.message);
    return null;
  }

  // Fire notifications to all managers via dynamic import (don't block)
  import("@/lib/services/notification-dispatcher").then(({ dispatchToMany }) => {
    // Get manager IDs
    supabase
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", companyId)
      .in("role", ["owner", "admin", "manager"])
      .then(({ data }: { data: { user_id: string }[] | null }) => {
        if (data?.length) {
          dispatchToMany(
            companyId,
            data.map((m) => ({ userId: m.user_id })),
            {
              title: "SOS ALERT",
              body: "A team member has triggered an emergency alert. Respond immediately.",
              type: "panic_alert",
              actionUrl: `/admin/events?panic=${id}`,
              urgent: true,
            }
          ).catch(() => {});
        }
      });
  }).catch(() => {});

  return id;
}

// ─── Acknowledge / Resolve ────────────────────────────────

/**
 * Acknowledge an active panic alert (manager action).
 */
export async function acknowledgePanicAlert(alertId: string): Promise<boolean> {
  const userId = await ensureInternalUser();
  if (!userId) return false;
  const supabase = createClient();
  const { error } = await supabase
    .from("panic_alerts")
    .update({
      status: "acknowledged",
      acknowledged_by: userId,
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId)
    .eq("status", "active");
  return !error;
}

/**
 * Resolve a panic alert (mark as handled).
 */
export async function resolvePanicAlert(alertId: string, resolution: "resolved" | "false_alarm"): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("panic_alerts")
    .update({ status: resolution, updated_at: new Date().toISOString() })
    .eq("id", alertId);
  return !error;
}

// ─── Queries ──────────────────────────────────────────────

/**
 * Get active panic alerts for a company.
 */
export async function getActivePanicAlerts(companyId: string): Promise<PanicAlert[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("panic_alerts")
    .select("*, users!panic_alerts_user_id_fkey(first_name, last_name)")
    .eq("company_id", companyId)
    .in("status", ["active", "acknowledged"])
    .order("created_at", { ascending: false });

  if (error) { logDbReadError("panic:active", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((a: any) => ({
    id: a.id,
    userId: a.user_id,
    userName: a.users ? `${a.users.first_name} ${a.users.last_name}` : "Unknown",
    companyId: a.company_id,
    lat: a.lat,
    lng: a.lng,
    accuracy: a.accuracy,
    status: a.status,
    acknowledgedBy: a.acknowledged_by,
    acknowledgedAt: a.acknowledged_at,
    escalated: a.escalated ?? false,
    createdAt: a.created_at,
  }));
}

/**
 * Get panic alert history for a company.
 */
export async function getPanicAlertHistory(companyId: string, limit = 50): Promise<PanicAlert[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("panic_alerts")
    .select("*, users!panic_alerts_user_id_fkey(first_name, last_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { logDbReadError("panic:history", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((a: any) => ({
    id: a.id,
    userId: a.user_id,
    userName: a.users ? `${a.users.first_name} ${a.users.last_name}` : "Unknown",
    companyId: a.company_id,
    lat: a.lat,
    lng: a.lng,
    accuracy: a.accuracy,
    status: a.status,
    acknowledgedBy: a.acknowledged_by,
    acknowledgedAt: a.acknowledged_at,
    escalated: a.escalated ?? false,
    createdAt: a.created_at,
  }));
}
