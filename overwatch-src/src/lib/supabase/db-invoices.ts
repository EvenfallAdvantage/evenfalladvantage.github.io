/**
 * Invoice Management System
 *
 * Persistent invoicing with bill rates, timesheet-based generation,
 * status tracking, and payment link integration.
 *
 * Table: invoices (RLS: owner/admin/manager full; client role reads sent+ only)
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
import { formatMemberName } from "@/lib/format-names";

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
  /** Free-form header fields (sender/client address, terms, logo…). */
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
}

export const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "viewed", "paid", "overdue", "cancelled"];

/** Statuses a client-role member may read (mirrors invoices_select_client RLS). */
export const CLIENT_VISIBLE_STATUSES: InvoiceStatus[] = ["sent", "viewed", "paid", "overdue"];

/** Mirrors invoices_delete RLS: owners/admins only, drafts only. */
export function canDeleteInvoice(role: string | null | undefined, status: InvoiceStatus): boolean {
  return (role === "owner" || role === "admin") && status === "draft";
}

/** Per company + user key for unsaved local autosave, so nothing crosses companies. */
export function invoiceAutosaveKey(companyId: string, userId: string): string {
  return `overwatch_invoice_autosave:${companyId}:${userId}`;
}

export interface InvoiceSaveParams {
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  eventId?: string;
  lineItems: InvoiceLineItem[];
  taxRate?: number;
  dueDate?: string;
  notes?: string;
  details?: Record<string, unknown>;
}

function computeTotals(lineItems: InvoiceLineItem[], taxRatePct: number) {
  const subtotal = Math.round(lineItems.reduce((sum, li) => sum + li.amount, 0) * 100) / 100;
  const taxAmount = Math.round(subtotal * taxRatePct) / 100;
  return { subtotal, taxAmount, total: Math.round((subtotal + taxAmount) * 100) / 100 };
}

/**
 * Update an existing invoice's contents (totals recomputed).
 */
export async function updateInvoice(invoiceId: string, params: InvoiceSaveParams): Promise<boolean> {
  const supabase = createClient();
  const taxRate = params.taxRate ?? 0;
  const { subtotal, taxAmount, total } = computeTotals(params.lineItems, taxRate);
  const { error } = await supabase
    .from("invoices")
    .update({
      invoice_number: params.invoiceNumber,
      client_name: params.clientName,
      client_email: params.clientEmail ?? "",
      event_id: params.eventId ?? null,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      due_date: params.dueDate || null,
      notes: params.notes ?? "",
      line_items: params.lineItems,
      details: params.details ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (error) console.error("[Invoices] Update failed:", error.message);
  return !error;
}

// ─── CRUD ─────────────────────────────────────────────────

/**
 * Create a new invoice.
 */
export async function createInvoice(
  companyId: string,
  params: InvoiceSaveParams
): Promise<string | null> {
  const supabase = createClient();
  const id = crypto.randomUUID();
  const taxRate = params.taxRate ?? 0;
  const { subtotal, taxAmount, total } = computeTotals(params.lineItems, taxRate);

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
      due_date: params.dueDate || null,
      paid_date: null,
      notes: params.notes ?? "",
      line_items: params.lineItems,
      details: params.details ?? {},
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
    details: inv.details ?? {},
    createdAt: inv.created_at,
    updatedAt: inv.updated_at ?? null,
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
    .select("user_id, clock_in, clock_out, users!timesheets_user_id_fkey(first_name, last_name, callsign)")
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
    const staffName = formatMemberName(ts.users ?? {}) || "Staff";
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
