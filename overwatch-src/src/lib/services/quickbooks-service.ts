/**
 * QuickBooks Payroll Sync Service
 *
 * Syncs approved timesheets to QuickBooks Online via their Payroll API.
 *
 * AUTH MODEL:
 *   QuickBooks uses OAuth 2.0 Authorization Code flow:
 *   1. Admin completes OAuth consent → receives authorization code
 *   2. Exchange code for access_token + refresh_token (server-side)
 *   3. Store the access_token in integration config
 *   In our config schema:
 *     - client_id = OAuth application client ID
 *     - client_secret = OAuth **access_token** (NOT the app secret)
 *     - realm_id = QuickBooks company ID (realmId from OAuth redirect)
 *   For production, implement token refresh via Supabase Edge Functions.
 *
 * API REFERENCE:
 *   QuickBooks Online Accounting API v3
 *   Base URL: https://quickbooks.api.intuit.com (prod) or https://sandbox-quickbooks.api.intuit.com (sandbox)
 *   Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities
 */

import { getActiveConfig, type ProviderKey } from "./integrations";

interface QBConfig {
  client_id: string;
  client_secret: string; // OAuth ACCESS TOKEN
  realm_id: string;      // QuickBooks company ID
  environment: "sandbox" | "production";
}

function qbApi(cfg: QBConfig): string {
  return cfg.environment === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
}

function qbHeaders(cfg: QBConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${cfg.client_secret}`,
  };
}

async function getQBConfig(companyId: string): Promise<QBConfig | null> {
  return getActiveConfig<QBConfig>(companyId, "quickbooks" as ProviderKey);
}

// ─── Employee Lookup ──────────────────────────────────────

export interface QBEmployee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

async function getQBEmployees(cfg: QBConfig): Promise<QBEmployee[] | null> {
  try {
    const query = encodeURIComponent("SELECT * FROM Employee WHERE Active = true MAXRESULTS 1000");
    const res = await fetch(
      `${qbApi(cfg)}/v3/company/${cfg.realm_id}/query?query=${query}`,
      { headers: qbHeaders(cfg) }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[QuickBooks] Fetch employees failed (${res.status}):`, err);
      return null;
    }
    const data = await res.json();
    const employees = data?.QueryResponse?.Employee ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return employees.map((e: any) => ({
      id: String(e.Id),
      email: String(e.PrimaryEmailAddr?.Address ?? ""),
      firstName: String(e.GivenName ?? ""),
      lastName: String(e.FamilyName ?? ""),
      displayName: String(e.DisplayName ?? ""),
    }));
  } catch (err) {
    console.error("[QuickBooks] Network error:", err);
    return null;
  }
}

// ─── Time Activity Sync ───────────────────────────────────

/**
 * Create a TimeActivity entry in QuickBooks for tracked hours.
 * TimeActivity is the QBO equivalent of a timesheet entry.
 */
async function createTimeActivity(
  cfg: QBConfig,
  entry: {
    employeeId: string;
    date: string;       // YYYY-MM-DD
    hours: number;
    description?: string;
  }
): Promise<boolean> {
  const totalMinutes = Math.round(entry.hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  const body = {
    NameOf: "Employee",
    EmployeeRef: { value: entry.employeeId },
    TxnDate: entry.date,
    Hours: h,
    Minutes: m,
    Description: entry.description ?? "Synced from Overwatch timesheets",
    HourlyRate: undefined, // Let QBO use employee's default rate
  };

  try {
    const res = await fetch(
      `${qbApi(cfg)}/v3/company/${cfg.realm_id}/timeactivity`,
      {
        method: "POST",
        headers: qbHeaders(cfg),
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[QuickBooks] Create TimeActivity failed (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[QuickBooks] Network error:", err);
    return false;
  }
}

/**
 * Sync approved timesheets to QuickBooks as TimeActivity entries.
 * Matches employees by email, creates individual time entries per day.
 */
export async function syncTimesheetsToQuickBooks(
  companyId: string,
  timesheets: {
    employeeEmail: string;
    date: string;       // YYYY-MM-DD
    hours: number;
    eventName?: string;
  }[]
): Promise<{ synced: number; errors: string[] }> {
  const cfg = await getQBConfig(companyId);
  if (!cfg) {
    return { synced: 0, errors: ["No active QuickBooks integration"] };
  }

  const errors: string[] = [];

  // Step 1: Look up employees
  const employees = await getQBEmployees(cfg);
  if (!employees) {
    return { synced: 0, errors: ["Failed to fetch QuickBooks employees"] };
  }
  const emailToId = new Map<string, string>();
  for (const emp of employees) {
    if (emp.email) emailToId.set(emp.email.toLowerCase(), emp.id);
  }

  // Step 2: Create TimeActivity entries
  let synced = 0;
  for (const ts of timesheets) {
    const qbId = emailToId.get(ts.employeeEmail.toLowerCase());
    if (!qbId) {
      errors.push(`Employee not found in QuickBooks: ${ts.employeeEmail}`);
      continue;
    }
    const ok = await createTimeActivity(cfg, {
      employeeId: qbId,
      date: ts.date,
      hours: ts.hours,
      description: ts.eventName ? `${ts.eventName} — synced from Overwatch` : undefined,
    });
    if (ok) {
      synced++;
    } else {
      errors.push(`Failed to sync entry for ${ts.employeeEmail} on ${ts.date}`);
    }
  }

  return { synced, errors };
}

/**
 * Verify QuickBooks connection by fetching company info.
 */
export async function verifyQuickBooksConnection(companyId: string): Promise<{
  connected: boolean;
  companyName?: string;
  employeeCount?: number;
}> {
  const cfg = await getQBConfig(companyId);
  if (!cfg) return { connected: false };

  try {
    const res = await fetch(
      `${qbApi(cfg)}/v3/company/${cfg.realm_id}/companyinfo/${cfg.realm_id}`,
      { headers: qbHeaders(cfg) }
    );
    if (!res.ok) return { connected: false };
    const data = await res.json();
    const employees = await getQBEmployees(cfg);
    return {
      connected: true,
      companyName: data?.CompanyInfo?.CompanyName,
      employeeCount: employees?.length ?? 0,
    };
  } catch {
    return { connected: false };
  }
}
