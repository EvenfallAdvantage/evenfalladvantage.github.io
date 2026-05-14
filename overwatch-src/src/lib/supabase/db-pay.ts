import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";

/**
 * Get the effective pay rate for a user, resolving the cascade:
 * member override → company default
 *
 * Pay is per-employee (member override or company default). Operations no longer
 * carry their own pay rate — set per-member rates via the staff roster.
 */
export async function getEffectivePayRate(
  userId: string,
  companyId: string,
  _eventId?: string | null,  // kept for backward compat; ignored
): Promise<number | null> {
  const supabase = createClient();

  // 1. Check member override
  const { data: membership } = await supabase
    .from("company_memberships")
    .select("pay_rate_override")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (membership?.pay_rate_override != null) return Number(membership.pay_rate_override);

  // 2. Company default
  const { data: company } = await supabase
    .from("companies")
    .select("default_pay_rate")
    .eq("id", companyId)
    .maybeSingle();
  if (company?.default_pay_rate != null) return Number(company.default_pay_rate);

  return null;
}

/**
 * Update a member's pay rate override
 */
export async function updateMemberPayRate(
  membershipId: string,
  payRate: number | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("company_memberships")
    .update({ pay_rate_override: payRate, updated_at: new Date().toISOString() })
    .eq("id", membershipId);
  if (error) throw error;
}

/**
 * Update a company's default pay rate
 */
export async function updateCompanyDefaultPayRate(
  companyId: string,
  payRate: number | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("companies")
    .update({ default_pay_rate: payRate })
    .eq("id", companyId);
  if (error) throw error;
}

/**
 * Get pay summary for the current user — their timesheets with calculated pay
 */
export async function getMyPaySummary(companyId: string): Promise<{
  timesheets: {
    id: string;
    clock_in: string;
    clock_out: string;
    event_name: string | null;
    hours: number;
    rate: number | null;
    pay: number | null;
  }[];
  totalHours: number;
  totalPay: number;
  effectiveRate: number | null;
}> {
  const userId = await ensureInternalUser();
  if (!userId) return { timesheets: [], totalHours: 0, totalPay: 0, effectiveRate: null };

  const supabase = createClient();
  
  // Get member override rate
  const { data: membership } = await supabase
    .from("company_memberships")
    .select("pay_rate_override")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  const memberRate = membership?.pay_rate_override != null ? Number(membership.pay_rate_override) : null;
  
  // Get company default
  const { data: company } = await supabase
    .from("companies")
    .select("default_pay_rate")
    .eq("id", companyId)
    .maybeSingle();
  const companyRate = company?.default_pay_rate != null ? Number(company.default_pay_rate) : null;

  // Get recent closed timesheets with event info
  const { data: sheets } = await supabase
    .from("timesheets")
    .select("id, clock_in, clock_out, event_id, events(name)")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .not("clock_out", "is", null)
    .order("clock_in", { ascending: false })
    .limit(100);

  let totalHours = 0;
  let totalPay = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timesheets = (sheets ?? []).map((s: any) => {
    const hours = (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3600000;
    // Resolve rate: member override → company default
    const rate = memberRate ?? companyRate;
    const pay = rate != null ? Math.round(hours * rate * 100) / 100 : null;

    totalHours += hours;
    if (pay != null) totalPay += pay;

    return {
      id: s.id,
      clock_in: s.clock_in,
      clock_out: s.clock_out,
      event_name: s.events?.name ?? null,
      hours: Math.round(hours * 100) / 100,
      rate,
      pay,
    };
  });

  return {
    timesheets,
    totalHours: Math.round(totalHours * 100) / 100,
    totalPay: Math.round(totalPay * 100) / 100,
    effectiveRate: memberRate ?? companyRate,
  };
}
