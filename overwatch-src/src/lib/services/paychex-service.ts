/**
 * Paychex Flex Payroll Sync Service
 *
 * Syncs approved timesheets to Paychex Flex via their REST API.
 *
 * AUTH MODEL:
 *   Paychex uses OAuth 2.0 Client Credentials flow:
 *   1. Register an API application in Paychex Developer Portal
 *   2. Receive client_id + client_secret
 *   3. Request access_token via client_credentials grant
 *   In our config schema:
 *     - client_id = Paychex API application client ID
 *     - client_secret = OAuth **access_token** (pre-exchanged; refresh via Edge Function)
 *     - company_id = Paychex company ID (displayId)
 *   For production, implement token refresh via Supabase Edge Functions.
 *
 * API REFERENCE:
 *   Paychex Flex API
 *   Base URL: https://api.paychex.com (prod) or https://api.sandbox.paychex.com (sandbox)
 *   Docs: https://developer.paychex.com/api-documentation
 */

import { getActiveConfig, type ProviderKey } from "./integrations";

interface PaychexConfig {
  client_id: string;
  client_secret: string; // OAuth ACCESS TOKEN (pre-exchanged)
  company_id: string;    // Paychex company displayId
  environment: "sandbox" | "production";
}

function paychexApi(cfg: PaychexConfig): string {
  return cfg.environment === "sandbox"
    ? "https://api.sandbox.paychex.com"
    : "https://api.paychex.com";
}

function paychexHeaders(cfg: PaychexConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${cfg.client_secret}`,
  };
}

async function getPaychexConfig(companyId: string): Promise<PaychexConfig | null> {
  return getActiveConfig<PaychexConfig>(companyId, "paychex" as ProviderKey);
}

// ─── Worker Lookup ────────────────────────────────────────

export interface PaychexWorker {
  workerId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * List active workers from Paychex.
 */
async function getPaychexWorkers(cfg: PaychexConfig): Promise<PaychexWorker[] | null> {
  try {
    const res = await fetch(
      `${paychexApi(cfg)}/companies/${cfg.company_id}/workers?status=ACTIVE`,
      { headers: paychexHeaders(cfg) }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Paychex] Fetch workers failed (${res.status}):`, err);
      return null;
    }
    const data = await res.json();
    const workers = data?.content ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return workers.map((w: any) => {
      const name = w.name ?? {};
      const comms = w.communications ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emailComm = comms.find((c: any) =>
        c.type === "EMAIL" || c.usageType === "WORK"
      ) ?? comms[0];
      return {
        workerId: String(w.workerId ?? ""),
        employeeId: String(w.employeeId ?? w.workerId ?? ""),
        email: String(emailComm?.uri ?? emailComm?.dialNumber ?? ""),
        firstName: String(name.givenName ?? ""),
        lastName: String(name.familyName ?? ""),
      };
    });
  } catch (err) {
    console.error("[Paychex] Network error:", err);
    return null;
  }
}

// ─── Time Entry Sync ──────────────────────────────────────

/**
 * Submit time-off or time entries to Paychex via the Check endpoint.
 * Creates check-level hour entries for payroll processing.
 */
async function submitTimeEntries(
  cfg: PaychexConfig,
  entries: {
    workerId: string;
    date: string;       // YYYY-MM-DD
    hours: number;
    description?: string;
  }[]
): Promise<boolean> {
  // Group entries by worker
  const byWorker = new Map<string, typeof entries>();
  for (const e of entries) {
    const existing = byWorker.get(e.workerId) ?? [];
    existing.push(e);
    byWorker.set(e.workerId, existing);
  }

  // Submit per-worker time entries
  for (const [workerId, workerEntries] of byWorker) {
    const body = {
      data: workerEntries.map(e => ({
        workerId,
        startDate: e.date,
        hours: e.hours,
        earningCode: "REG", // Regular hours
        description: e.description ?? "Synced from Overwatch",
      })),
    };

    try {
      const res = await fetch(
        `${paychexApi(cfg)}/companies/${cfg.company_id}/workers/${workerId}/timeCards`,
        {
          method: "POST",
          headers: paychexHeaders(cfg),
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.text();
        console.error(`[Paychex] Submit time entries failed for ${workerId} (${res.status}):`, err);
        return false;
      }
    } catch (err) {
      console.error("[Paychex] Network error:", err);
      return false;
    }
  }

  return true;
}

/**
 * Sync approved timesheets to Paychex as time card entries.
 * Matches workers by email, batches entries per worker.
 */
export async function syncTimesheetsToPaychex(
  companyId: string,
  timesheets: {
    employeeEmail: string;
    date: string;       // YYYY-MM-DD
    hours: number;
    eventName?: string;
  }[]
): Promise<{ synced: number; errors: string[] }> {
  const cfg = await getPaychexConfig(companyId);
  if (!cfg) {
    return { synced: 0, errors: ["No active Paychex integration"] };
  }

  const errors: string[] = [];

  // Step 1: Look up workers
  const workers = await getPaychexWorkers(cfg);
  if (!workers) {
    return { synced: 0, errors: ["Failed to fetch Paychex workers"] };
  }
  const emailToId = new Map<string, string>();
  for (const w of workers) {
    if (w.email) emailToId.set(w.email.toLowerCase(), w.workerId);
  }

  // Step 2: Build entries per worker
  const validEntries: { workerId: string; date: string; hours: number; description?: string }[] = [];
  for (const ts of timesheets) {
    const wId = emailToId.get(ts.employeeEmail.toLowerCase());
    if (!wId) {
      errors.push(`Worker not found in Paychex: ${ts.employeeEmail}`);
      continue;
    }
    validEntries.push({
      workerId: wId,
      date: ts.date,
      hours: ts.hours,
      description: ts.eventName ? `${ts.eventName} — synced from Overwatch` : undefined,
    });
  }

  if (validEntries.length === 0) {
    return { synced: 0, errors: [...errors, "No matching workers for submitted timesheets"] };
  }

  // Step 3: Submit
  const ok = await submitTimeEntries(cfg, validEntries);
  if (!ok) {
    errors.push("Failed to submit time entries to Paychex");
    return { synced: 0, errors };
  }

  return { synced: validEntries.length, errors };
}

/**
 * Verify Paychex connection by fetching company info.
 */
export async function verifyPaychexConnection(companyId: string): Promise<{
  connected: boolean;
  companyName?: string;
  workerCount?: number;
}> {
  const cfg = await getPaychexConfig(companyId);
  if (!cfg) return { connected: false };

  try {
    const res = await fetch(
      `${paychexApi(cfg)}/companies/${cfg.company_id}`,
      { headers: paychexHeaders(cfg) }
    );
    if (!res.ok) return { connected: false };
    const data = await res.json();
    const workers = await getPaychexWorkers(cfg);
    return {
      connected: true,
      companyName: data?.content?.legalName ?? data?.content?.displayName,
      workerCount: workers?.length ?? 0,
    };
  } catch {
    return { connected: false };
  }
}
