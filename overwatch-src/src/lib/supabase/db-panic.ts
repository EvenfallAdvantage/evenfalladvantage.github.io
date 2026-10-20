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
import { formatMemberName } from "@/lib/format-names";

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
  return (await triggerPanicAlertDetailed(companyId)).id;
}

/**
 * Same as triggerPanicAlert, but reports whether the alert was QUEUED because
 * the phone has no connection. A queued alert is sent (same id, original
 * time and GPS) by the offline sync as soon as the connection returns.
 */
export async function triggerPanicAlertDetailed(companyId: string): Promise<{ id: string | null; queued: boolean }> {
  const userId = await ensureInternalUser();
  if (!userId) return { id: null, queued: false };

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
    const msg = String(error.message ?? "").toLowerCase();
    const offline = (typeof navigator !== "undefined" && !navigator.onLine) || msg.includes("fetch") || msg.includes("network") || msg.includes("load failed");
    if (offline) {
      const { enqueue } = await import("@/lib/offline/queue");
      await enqueue({ kind: "panic.trigger", label: "SOS alert", payload: { id, companyId, userId, lat, lng, accuracy, createdAt: new Date().toISOString() } });
      return { id, queued: true };
    }
    console.error("[Panic] Failed to create alert:", error.message);
    return { id: null, queued: false };
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
              actionUrl: `/feed/?panic=${id}`,
              critical: true,
            }
          ).catch(() => {});
        }
      });
  }).catch(() => {});

  return { id, queued: false };
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
    .select("*, users!panic_alerts_user_id_fkey(first_name, last_name, callsign)")
    .eq("company_id", companyId)
    .in("status", ["active", "acknowledged"])
    .order("created_at", { ascending: false });

  if (error) { logDbReadError("panic:active", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((a: any) => ({
    id: a.id,
    userId: a.user_id,
    userName: formatMemberName(a.users ?? {}) || "Unknown",
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
    .select("*, users!panic_alerts_user_id_fkey(first_name, last_name, callsign)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { logDbReadError("panic:history", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((a: any) => ({
    id: a.id,
    userId: a.user_id,
    userName: formatMemberName(a.users ?? {}) || "Unknown",
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

// ─── SOS hardening (live location, self-cancel, escalation, realtime) ───

/**
 * Sender marks their own active alert as a false alarm ("I'm safe").
 * Needs the `panic_update_own` policy from migration 20261019200000_sos_hardening.
 */
export async function cancelOwnPanicAlert(alertId: string): Promise<boolean> {
  const userId = await ensureInternalUser();
  if (!userId) return false;
  const supabase = createClient();
  const { error } = await supabase
    .from("panic_alerts")
    .update({ status: "false_alarm", updated_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("user_id", userId)
    .in("status", ["active", "acknowledged"]);
  return !error;
}

/** Append one live-location point for an active alert (sender only). */
export async function recordPanicLocation(
  alertId: string, companyId: string, pos: { lat: number; lng: number; accuracy: number | null },
): Promise<boolean> {
  const userId = await ensureInternalUser();
  if (!userId) return false;
  const supabase = createClient();
  const { error } = await supabase.from("panic_alert_locations").insert({
    alert_id: alertId, company_id: companyId, user_id: userId,
    lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy,
  });
  if (error) logDbReadError("panic:location", error);
  return !error;
}

export interface PanicTrailPoint { lat: number; lng: number; accuracy: number | null; recordedAt: string }

/** Latest live-location points for an alert, newest first. */
export async function getPanicTrail(alertId: string, limit = 30): Promise<PanicTrailPoint[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("panic_alert_locations")
    .select("lat, lng, accuracy, recorded_at")
    .eq("alert_id", alertId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) { logDbReadError("panic:trail", error); return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({ lat: p.lat, lng: p.lng, accuracy: p.accuracy, recordedAt: p.recorded_at }));
}

/** Status of one alert (sender polls this to learn it was acknowledged). */
export async function getPanicAlertStatus(alertId: string): Promise<AlertStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("panic_alerts").select("status").eq("id", alertId).maybeSingle();
  if (error) { logDbReadError("panic:status", error); return null; }
  return (data as { status?: AlertStatus } | null)?.status ?? null;
}

/**
 * Escalate an alert nobody acknowledged. The `.eq("escalated", false)` guard
 * makes this first-writer-wins when several supervisors are online; only the
 * client whose update matched a row sends the owner/admin notification.
 */
export async function escalatePanicAlert(alertId: string, companyId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("panic_alerts")
    .update({ escalated: true, updated_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("status", "active")
    .eq("escalated", false)
    .select("id");
  if (error || !data?.length) return false;
  const { dispatchToMany } = await import("@/lib/services/notification-dispatcher");
  const { data: owners } = await supabase
    .from("company_memberships").select("user_id")
    .eq("company_id", companyId).in("role", ["owner", "admin"]);
  if (owners?.length) {
    await dispatchToMany(companyId, (owners as { user_id: string }[]).map((m) => ({ userId: m.user_id })), {
      title: "SOS ESCALATED",
      body: "An SOS alert has not been acknowledged for over a minute. Respond now.",
      type: "panic_alert", actionUrl: `/feed/?panic=${alertId}`, critical: true,
    }).catch(() => {});
  }
  return true;
}

/**
 * Realtime subscription to panic_alerts for a company. Needs panic_alerts in
 * the supabase_realtime publication (same migration); callers also poll, so
 * this is an accelerator, not a dependency.
 */
export function subscribePanicAlerts(companyId: string, onChange: () => void): () => void {
  const supabase = createClient();
  const ch = supabase
    .channel(`panic-${companyId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "panic_alerts", filter: `company_id=eq.${companyId}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/** Offline replay of a queued SOS (called by lib/offline/sync). Idempotent by id. */
export async function replayQueuedPanicAlert(p: { id: string; companyId: string; userId: string; lat: number | null; lng: number | null; accuracy: number | null; createdAt: string }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("panic_alerts").insert({
    id: p.id, user_id: p.userId, company_id: p.companyId, lat: p.lat, lng: p.lng, accuracy: p.accuracy,
    status: "active", acknowledged_by: null, acknowledged_at: null, escalated: false,
    created_at: p.createdAt, updated_at: new Date().toISOString(),
  });
  if (error && (error as { code?: string }).code !== "23505") throw new Error(error.message);
  if (error) return; // already delivered on an earlier attempt
  const { dispatchToMany } = await import("@/lib/services/notification-dispatcher");
  const { data } = await supabase.from("company_memberships").select("user_id").eq("company_id", p.companyId).in("role", ["owner", "admin", "manager"]);
  if (data?.length) {
    await dispatchToMany(p.companyId, (data as { user_id: string }[]).map((m) => ({ userId: m.user_id })), {
      title: "SOS ALERT (sent after signal loss)",
      body: `Triggered ${new Date(p.createdAt).toLocaleTimeString()} while the officer had no connection. Respond immediately.`,
      type: "panic_alert", actionUrl: `/feed/?panic=${p.id}`, critical: true,
    }).catch(() => {});
  }
}
