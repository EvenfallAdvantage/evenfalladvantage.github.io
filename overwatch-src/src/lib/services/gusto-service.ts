/**
 * Gusto Payroll Sync Service
 *
 * Syncs approved timesheets to Gusto payroll via their Embedded API.
 *
 * AUTH MODEL:
 *   Gusto uses OAuth 2.0 Authorization Code flow:
 *   1. Admin completes OAuth consent → receives authorization code
 *   2. Exchange code for access_token + refresh_token (server-side)
 *   3. Store the access_token in integration config
 *   In our config schema:
 *     - client_id = OAuth application client ID
 *     - client_secret = OAuth **access_token** (NOT the app secret)
 *     - company_uuid = Gusto company UUID
 *   For production, implement token refresh via Supabase Edge Functions.
 *
 * API REFERENCE:
 *   Gusto Embedded Payroll API v2024-03-01
 *   Base URL: https://api.gusto-demo.com (sandbox) or https://api.gusto.com (prod)
 *   Docs: https://docs.gusto.com/embedded-payroll/reference
 */

import { getGustoConfig } from "./integrations";

type GustoCfg = {
  client_id: string;
  client_secret: string; // This is the OAuth ACCESS TOKEN
  company_uuid: string;
  sync_frequency: string;
};

function gustoApi(cfg: GustoCfg): string {
  // Use demo API if UUID looks like a test/demo account
  return cfg.company_uuid.startsWith("demo-") ? "https://api.gusto-demo.com" : "https://api.gusto.com";
}

function gustoHeaders(cfg: GustoCfg): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${cfg.client_secret}`,
    "X-Gusto-API-Version": "2024-03-01",
  };
}

// ─── Employee Lookup ──────────────────────────────────────

export interface GustoEmployee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

async function getGustoEmployees(cfg: GustoCfg): Promise<GustoEmployee[] | null> {
  try {
    const res = await fetch(`${gustoApi(cfg)}/v1/companies/${cfg.company_uuid}/employees`, {
      headers: gustoHeaders(cfg),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Gusto] Fetch employees failed (${res.status}):`, err);
      return null;
    }
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((e: any) => ({
      id: String(e.uuid || e.id),
      email: String(e.email || e.home_email || e.work_email || ""),
      firstName: String(e.first_name || ""),
      lastName: String(e.last_name || ""),
    }));
  } catch (err) {
    console.error("[Gusto] Network error:", err);
    return null;
  }
}

// ─── Payroll Sync ─────────────────────────────────────────

/**
 * Get unprocessed payrolls for a company.
 * Returns the payroll objects that can accept hour entries.
 */
async function getUnprocessedPayrolls(cfg: GustoCfg): Promise<{ payroll_id: string; pay_period: { start_date: string; end_date: string } }[]> {
  try {
    const res = await fetch(
      `${gustoApi(cfg)}/v1/companies/${cfg.company_uuid}/payrolls?processed=false`,
      { headers: gustoHeaders(cfg) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((p: any) => ({
      payroll_id: String(p.payroll_uuid || p.uuid || p.id),
      pay_period: p.pay_period,
    }));
  } catch {
    return [];
  }
}

/**
 * Update employee hours on an unprocessed payroll.
 * This is the correct endpoint for submitting worked hours to Gusto.
 * PUT /v1/companies/{company_uuid}/payrolls/{payroll_id}
 */
async function updatePayrollHours(
  cfg: GustoCfg,
  payrollId: string,
  employeeCompensations: { employeeUuid: string; hours: number }[]
): Promise<boolean> {
  // Build the compensation update payload per Gusto API spec
  const body = {
    employee_compensations: employeeCompensations.map(ec => ({
      employee_uuid: ec.employeeUuid,
      fixed_compensations: [],
      hourly_compensations: [{
        name: "Regular Hours",
        hours: String(ec.hours),
        job_uuid: null, // null = default job
      }],
    })),
  };

  try {
    const res = await fetch(
      `${gustoApi(cfg)}/v1/companies/${cfg.company_uuid}/payrolls/${payrollId}`,
      {
        method: "PUT",
        headers: gustoHeaders(cfg),
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Gusto] Update payroll failed (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Gusto] Network error:", err);
    return false;
  }
}

/**
 * Sync approved timesheets to the current unprocessed Gusto payroll.
 * Matches employees by email, finds the correct pay period, and
 * submits aggregated hours per employee.
 */
export async function syncTimesheetsToGusto(
  companyId: string,
  timesheets: {
    employeeEmail: string;
    date: string;       // YYYY-MM-DD
    hours: number;
  }[]
): Promise<{ synced: number; errors: string[] }> {
  const cfg = await getGustoConfig(companyId) as GustoCfg | null;
  if (!cfg) {
    return { synced: 0, errors: ["No active Gusto integration"] };
  }

  const errors: string[] = [];

  // Step 1: Look up employees
  const employees = await getGustoEmployees(cfg);
  if (!employees) {
    return { synced: 0, errors: ["Failed to fetch Gusto employees"] };
  }
  const emailToUuid = new Map<string, string>();
  for (const emp of employees) {
    if (emp.email) emailToUuid.set(emp.email.toLowerCase(), emp.id);
  }

  // Step 2: Get unprocessed payrolls
  const payrolls = await getUnprocessedPayrolls(cfg);
  if (payrolls.length === 0) {
    return { synced: 0, errors: ["No unprocessed payrolls found in Gusto"] };
  }

  // Step 3: Match timesheets to payroll periods and aggregate hours per employee
  const payroll = payrolls[0]; // Use the most current unprocessed payroll
  const hoursByEmployee = new Map<string, number>();

  for (const ts of timesheets) {
    const uuid = emailToUuid.get(ts.employeeEmail.toLowerCase());
    if (!uuid) {
      errors.push(`Employee not found in Gusto: ${ts.employeeEmail}`);
      continue;
    }
    // Check if timesheet date falls within the payroll period
    if (payroll.pay_period) {
      if (ts.date < payroll.pay_period.start_date || ts.date > payroll.pay_period.end_date) {
        errors.push(`Timesheet date ${ts.date} for ${ts.employeeEmail} outside payroll period (${payroll.pay_period.start_date} to ${payroll.pay_period.end_date})`);
        continue;
      }
    }
    hoursByEmployee.set(uuid, (hoursByEmployee.get(uuid) || 0) + ts.hours);
  }

  if (hoursByEmployee.size === 0) {
    return { synced: 0, errors: [...errors, "No matching timesheets for current payroll period"] };
  }

  // Step 4: Submit aggregated hours to Gusto payroll
  const compensations = Array.from(hoursByEmployee.entries()).map(([employeeUuid, hours]) => ({
    employeeUuid,
    hours,
  }));

  const ok = await updatePayrollHours(cfg, payroll.payroll_id, compensations);
  if (!ok) {
    errors.push("Failed to update payroll hours in Gusto");
    return { synced: 0, errors };
  }

  return { synced: hoursByEmployee.size, errors };
}

/**
 * Get Gusto company info (for verifying connection).
 */
export async function verifyGustoConnection(companyId: string): Promise<{ connected: boolean; companyName?: string; employeeCount?: number }> {
  const cfg = await getGustoConfig(companyId) as GustoCfg | null;
  if (!cfg) return { connected: false };

  try {
    const res = await fetch(`${gustoApi(cfg)}/v1/companies/${cfg.company_uuid}`, {
      headers: gustoHeaders(cfg),
    });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    // Also fetch employee count
    const employees = await getGustoEmployees(cfg);
    return {
      connected: true,
      companyName: data.name ?? data.trade_name,
      employeeCount: employees?.length ?? 0,
    };
  } catch {
    return { connected: false };
  }
}
