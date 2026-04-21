/**
 * ADP Workforce Now Payroll Sync Service
 *
 * Syncs approved timesheets to ADP via their Time & Attendance API.
 *
 * AUTH MODEL:
 *   ADP uses OAuth 2.0 Client Credentials flow with SSL certificate auth:
 *   1. Register an API connection in ADP Marketplace
 *   2. Receive client_id + client_secret
 *   3. Request access_token via client_credentials grant
 *   In our config schema:
 *     - client_id = ADP API connection client ID
 *     - client_secret = OAuth **access_token** (pre-exchanged; token refresh via Edge Function)
 *     - org_oid = ADP organization OID
 *   For production, implement token refresh via Supabase Edge Functions.
 *
 * API REFERENCE:
 *   ADP Workforce Now / Next Gen API
 *   Base URL: https://api.adp.com (prod) or https://api.adp.com/test (sandbox)
 *   Docs: https://developers.adp.com/articles/api/time-attendance-v2
 */

import { getActiveConfig, type ProviderKey } from "./integrations";

interface ADPConfig {
  client_id: string;
  client_secret: string; // OAuth ACCESS TOKEN (pre-exchanged)
  org_oid: string;       // ADP organization OID
  environment: "sandbox" | "production";
}

function adpApi(_cfg: ADPConfig): string {
  return "https://api.adp.com";
}

function adpHeaders(cfg: ADPConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${cfg.client_secret}`,
    "ADP-UserContext": `orgoid=${cfg.org_oid}`,
  };
}

async function getADPConfig(companyId: string): Promise<ADPConfig | null> {
  return getActiveConfig<ADPConfig>(companyId, "adp" as ProviderKey);
}

// ─── Worker Lookup ────────────────────────────────────────

export interface ADPWorker {
  associateOID: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * List active workers from ADP.
 * Uses the Worker Management API endpoint.
 */
async function getADPWorkers(cfg: ADPConfig): Promise<ADPWorker[] | null> {
  try {
    const res = await fetch(
      `${adpApi(cfg)}/hr/v2/workers?$top=100&$filter=workers/workAssignments/assignmentStatus/statusCode/codeValue eq 'A'`,
      { headers: adpHeaders(cfg) }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[ADP] Fetch workers failed (${res.status}):`, err);
      return null;
    }
    const data = await res.json();
    const workers = data?.workers ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return workers.map((w: any) => {
      const person = w.person ?? {};
      const name = person.legalName ?? {};
      const comm = person.communication ?? {};
      const emails = comm.emails ?? [];
      const workEmail = emails.find((e: { nameCode?: { codeValue?: string } }) =>
        e.nameCode?.codeValue === "Work Email"
      ) ?? emails[0];
      return {
        associateOID: String(w.associateOID ?? ""),
        email: String(workEmail?.emailUri ?? ""),
        firstName: String(name.givenName ?? ""),
        lastName: String(name.familyName1 ?? ""),
      };
    });
  } catch (err) {
    console.error("[ADP] Network error:", err);
    return null;
  }
}

// ─── Time Entry Sync ──────────────────────────────────────

/**
 * Submit time entries to ADP via the Time & Attendance API.
 * Creates a time card batch for the specified workers and hours.
 */
async function submitTimeEntries(
  cfg: ADPConfig,
  entries: {
    associateOID: string;
    date: string;       // YYYY-MM-DD
    hours: number;
    description?: string;
  }[]
): Promise<{ success: boolean; batchId?: string }> {
  const body = {
    events: [{
      data: {
        eventContext: {
          worker: { associateOID: entries[0]?.associateOID },
        },
        transform: {
          timeCards: entries.map(e => ({
            associateOID: e.associateOID,
            entryDate: e.date,
            timeDuration: `PT${Math.floor(e.hours)}H${Math.round((e.hours % 1) * 60)}M`,
            payCode: { codeValue: "REG" }, // Regular hours
            comment: { textValue: e.description ?? "Synced from Overwatch" },
          })),
        },
      },
    }],
  };

  try {
    const res = await fetch(
      `${adpApi(cfg)}/time/v2/workers/time-cards/management`,
      {
        method: "POST",
        headers: adpHeaders(cfg),
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[ADP] Submit time entries failed (${res.status}):`, err);
      return { success: false };
    }
    const data = await res.json();
    return { success: true, batchId: data?.confirmMessage?.requestStatusCode?.codeValue };
  } catch (err) {
    console.error("[ADP] Network error:", err);
    return { success: false };
  }
}

/**
 * Sync approved timesheets to ADP as time card entries.
 * Matches workers by email, batches entries per worker.
 */
export async function syncTimesheetsToADP(
  companyId: string,
  timesheets: {
    employeeEmail: string;
    date: string;       // YYYY-MM-DD
    hours: number;
    eventName?: string;
  }[]
): Promise<{ synced: number; errors: string[] }> {
  const cfg = await getADPConfig(companyId);
  if (!cfg) {
    return { synced: 0, errors: ["No active ADP integration"] };
  }

  const errors: string[] = [];

  // Step 1: Look up workers
  const workers = await getADPWorkers(cfg);
  if (!workers) {
    return { synced: 0, errors: ["Failed to fetch ADP workers"] };
  }
  const emailToOID = new Map<string, string>();
  for (const w of workers) {
    if (w.email) emailToOID.set(w.email.toLowerCase(), w.associateOID);
  }

  // Step 2: Group entries by worker and submit
  const entriesByWorker = new Map<string, typeof timesheets>();
  for (const ts of timesheets) {
    const oid = emailToOID.get(ts.employeeEmail.toLowerCase());
    if (!oid) {
      errors.push(`Worker not found in ADP: ${ts.employeeEmail}`);
      continue;
    }
    const existing = entriesByWorker.get(oid) ?? [];
    existing.push(ts);
    entriesByWorker.set(oid, existing);
  }

  let synced = 0;
  for (const [oid, entries] of entriesByWorker) {
    const result = await submitTimeEntries(cfg, entries.map(e => ({
      associateOID: oid,
      date: e.date,
      hours: e.hours,
      description: e.eventName ? `${e.eventName} — synced from Overwatch` : undefined,
    })));
    if (result.success) {
      synced += entries.length;
    } else {
      errors.push(`Failed to sync ${entries.length} entries for worker ${oid}`);
    }
  }

  return { synced, errors };
}

/**
 * Verify ADP connection by fetching organization info.
 */
export async function verifyADPConnection(companyId: string): Promise<{
  connected: boolean;
  orgName?: string;
  workerCount?: number;
}> {
  const cfg = await getADPConfig(companyId);
  if (!cfg) return { connected: false };

  try {
    const workers = await getADPWorkers(cfg);
    if (!workers) return { connected: false };
    return {
      connected: true,
      orgName: cfg.org_oid,
      workerCount: workers.length,
    };
  } catch {
    return { connected: false };
  }
}
