/**
 * Invoice Management System
 *
 * Persistent invoicing with bill rates, timesheet-based generation,
 * status tracking, and payment link integration.
 *
 * Table: invoices (must be created via SQL migration)
 *   id, company_id, invoice_number, client_name, client_email,
 *   event_id, status, subtotal, tax_rate, tax_amount, total,
 *   due_date, paid_date, notes, line_items (jsonb), created_at
 *
 * Table: bill_rates (extends events/memberships)
 *   Adds bill_rate column to events table (client-facing rate)
 *   Pay cascade: member bill_rate → event bill_rate → company default_bill_rate
 */

import { createClient } from "./client";
import { ts } from "./db-helpers";
import { logDbReadError } from "./db-error";

export type InvoiceStatus = "draft" | "sent" | "viewed" | "paid" | "overdue" | "cancelled";

export interface InvoiceLineItem {
  description: string;
  quantity: number;      // hours or units
  rate: number;          // bill rate per unit
  amount: number;        // quantity * rate
  staffName?: string;
  date?: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  eventId: string | null;
  eventName: string | null;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  dueDate: string | null;
  paidDate: string | null;
  notes: string;
  lineItems: InvoiceLineItem[];
  createdAt: string;
}

// ─── CRUD ─────────────────────────────────────────────────

/**
 * Create a new invoice.
 */
export async function createInvoice(
  companyId: string,
  params: {
    invoiceNumber: string;
    clientName: string;
    clientEmail?: string;
    eventId?: string;
    lineItems: InvoiceLineItem[];
    taxRate?: number;
    dueDate?: string;
    notes?: string;
  }
): Promise<string | null> {
  const supabase = createClient();
  const id = crypto.randomUUID();
  const subtotal = params.lineItems.reduce((sum, li) => sum + li.amount, 0);
  const taxRate = params.taxRate ?? 0;
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  const { error } = await supabase
    .from("invoices")
    .insert({
      id,
      company_id: companyId,
      invoice_number: params.invoiceNumber,
      client_name: params.clientName,
      client_email: params.clientEmail ?? "",
      event_id: params.eventId ?? null,
      status: "draft",
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      due_date: params.dueDate ?? null,
      paid_date: null,
      notes: params.notes ?? "",
      line_items: params.lineItems,
      ...ts(),
    });

  if (error) {
    console.error("[Invoices] Create failed:", error.message);
    return null;
  }
  return id;
}

/**
 * Update invoice status.
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  paidDate?: string
): Promise<boolean> {
  const supabase = createClient();
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "paid" && paidDate) update.paid_date = paidDate;
  const { error } = await supabase.from("invoices").update(update).eq("id", invoiceId);
  return !error;
}

/**
 * Delete a draft invoice.
 */
export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId).eq("status", "draft");
  return !error;
}

// ─── Queries ──────────────────────────────────────────────

/**
 * Get all invoices for a company.
 */
export async function getCompanyInvoices(companyId: string): Promise<Invoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, events(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) { logDbReadError("invoices", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((inv: any) => ({
    id: inv.id,
    companyId: inv.company_id,
    invoiceNumber: inv.invoice_number,
    clientName: inv.client_name,
    clientEmail: inv.client_email ?? "",
    eventId: inv.event_id,
    eventName: inv.events?.name ?? null,
    status: inv.status,
    subtotal: Number(inv.subtotal),
    taxRate: Number(inv.tax_rate),
    taxAmount: Number(inv.tax_amount),
    total: Number(inv.total),
    dueDate: inv.due_date,
    paidDate: inv.paid_date,
    notes: inv.notes ?? "",
    lineItems: inv.line_items ?? [],
    createdAt: inv.created_at,
  }));
}

/**
 * Get next invoice number for a company (auto-increment).
 */
export async function getNextInvoiceNumber(companyId: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1);

  const last = data?.[0]?.invoice_number ?? "INV-0000";
  const match = last.match(/(\d+)$/);
  const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
  return `INV-${String(nextNum).padStart(4, "0")}`;
}

// ─── Generate from Timesheets ─────────────────────────────

/**
 * Generate invoice line items from approved timesheets for an event.
 * Uses bill_rate from event (or company default) for pricing.
 */
export async function generateInvoiceFromTimesheets(
  companyId: string,
  eventId: string
): Promise<{ lineItems: InvoiceLineItem[]; clientName: string; eventName: string } | null> {
  const supabase = createClient();

  // Get event details + bill rate
  const { data: event } = await supabase
    .from("events")
    .select("name, client_name, bill_rate")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  // Get company default bill rate
  const { data: company } = await supabase
    .from("companies")
    .select("default_bill_rate, default_pay_rate")
    .eq("id", companyId)
    .maybeSingle();

  const billRate = Number(event.bill_rate)
    || Number(company?.default_bill_rate)
    || Number(company?.default_pay_rate) * 1.5  // default markup over company pay rate
    || 25; // fallback

  // Get approved timesheets for this event
  const { data: timesheets } = await supabase
    .from("timesheets")
    .select("user_id, clock_in, clock_out, users!timesheets_user_id_fkey(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("event_id", eventId)
    .eq("approved", true)
    .not("clock_out", "is", null)
    .order("clock_in");

  if (!timesheets?.length) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems: InvoiceLineItem[] = (timesheets as any[]).map((ts) => {
    const hours = (new Date(ts.clock_out).getTime() - new Date(ts.clock_in).getTime()) / 3600000;
    const roundedHours = Math.round(hours * 100) / 100;
    const staffName = ts.users ? `${ts.users.first_name} ${ts.users.last_name}` : "Staff";
    const date = new Date(ts.clock_in).toISOString().split("T")[0];
    return {
      description: `Security services — ${staffName}`,
      quantity: roundedHours,
      rate: billRate,
      amount: Math.round(roundedHours * billRate * 100) / 100,
      staffName,
      date,
    };
  });

  return {
    lineItems,
    clientName: event.client_name ?? "",
    eventName: event.name ?? "",
  };
}
