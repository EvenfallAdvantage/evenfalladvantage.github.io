/**
 * Gusto Payroll Sync Service
 *
 * Syncs approved timesheets to Gusto payroll via their REST API.
 * Uses OAuth credentials stored in the company's integration config.
 *
 * NOTE: Gusto OAuth requires a server-side callback to exchange codes
 * for tokens. For the static export, store the access token directly
 * in the config after completing OAuth externally. For production,
 * implement the full OAuth flow via Supabase Edge Functions.
 */

import { getGustoConfig } from "./integrations";

const GUSTO_API = "https://api.gusto.com/v1";

/**
 * Sync a batch of approved timesheets to Gusto.
 * Returns the number of successfully synced entries.
 */
export async function syncTimesheetsToGusto(
  companyId: string,
  timesheets: {
    employeeEmail: string;
    date: string;       // YYYY-MM-DD
    hours: number;
    jobTitle?: string;
  }[]
): Promise<{ synced: number; errors: string[] }> {
  const cfg = await getGustoConfig(companyId);
  if (!cfg) {
    return { synced: 0, errors: ["No active Gusto integration"] };
  }

  const errors: string[] = [];
  let synced = 0;

  // Gusto requires employee IDs — look them up first
  const employees = await getGustoEmployees(cfg);
  if (!employees) {
    return { synced: 0, errors: ["Failed to fetch Gusto employees"] };
  }

  const emailToId = new Map<string, string>();
  for (const emp of employees) {
    if (emp.email) emailToId.set(emp.email.toLowerCase(), emp.id);
  }

  for (const ts of timesheets) {
    const gustoEmpId = emailToId.get(ts.employeeEmail.toLowerCase());
    if (!gustoEmpId) {
      errors.push(`Employee not found in Gusto: ${ts.employeeEmail}`);
      continue;
    }

    try {
      const res = await fetch(`${GUSTO_API}/companies/${cfg.company_uuid}/time_off_activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cfg.client_secret}`, // Access token stored as client_secret
        },
        body: JSON.stringify({
          employee_id: gustoEmpId,
          date: ts.date,
          hours: ts.hours,
        }),
      });

      if (res.ok) {
        synced++;
      } else {
        const err = await res.text();
        errors.push(`Failed for ${ts.employeeEmail}: ${err}`);
      }
    } catch (err) {
      errors.push(`Network error for ${ts.employeeEmail}: ${String(err)}`);
    }
  }

  return { synced, errors };
}

/**
 * Fetch all employees from Gusto for the configured company.
 */
async function getGustoEmployees(cfg: { company_uuid: string; client_secret: string }): Promise<{ id: string; email: string }[] | null> {
  try {
    const res = await fetch(`${GUSTO_API}/companies/${cfg.company_uuid}/employees`, {
      headers: {
        "Authorization": `Bearer ${cfg.client_secret}`,
      },
    });
    if (!res.ok) {
      console.error(`[Gusto] Fetch employees failed (${res.status})`);
      return null;
    }
    const data = await res.json();
    return (data || []).map((e: Record<string, unknown>) => ({
      id: e.id as string,
      email: ((e.home_email || e.work_email || "") as string),
    }));
  } catch (err) {
    console.error("[Gusto] Network error:", err);
    return null;
  }
}

/**
 * Get Gusto company info (for verifying connection).
 */
export async function verifyGustoConnection(companyId: string): Promise<{ connected: boolean; companyName?: string }> {
  const cfg = await getGustoConfig(companyId);
  if (!cfg) return { connected: false };

  try {
    const res = await fetch(`${GUSTO_API}/companies/${cfg.company_uuid}`, {
      headers: {
        "Authorization": `Bearer ${cfg.client_secret}`,
      },
    });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    return { connected: true, companyName: data.name ?? data.trade_name };
  } catch {
    return { connected: false };
  }
}
