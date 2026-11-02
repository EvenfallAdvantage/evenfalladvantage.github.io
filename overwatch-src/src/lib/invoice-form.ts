import type { Invoice, InvoiceSaveParams } from "@/lib/supabase/db-invoices";

export type LineItem = {
  id: number;
  description: string;
  quantity: number;
  rate: number;
};

export type InvoiceData = {
  yourName: string;
  yourBusiness: string;
  yourAddress: string;
  yourCity: string;
  yourState: string;
  yourZip: string;
  yourEmail: string;
  yourPhone: string;
  clientName: string;
  clientCompany: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  notes: string;
  taxRate: string;
};

export const EMPTY_FORM: InvoiceData = {
  yourName: "", yourBusiness: "", yourAddress: "", yourCity: "", yourState: "", yourZip: "",
  yourEmail: "", yourPhone: "",
  clientName: "", clientCompany: "", clientAddress: "", clientCity: "", clientState: "", clientZip: "",
  invoiceNumber: "", invoiceDate: new Date().toISOString().split("T")[0], dueDate: "",
  paymentTerms: "", notes: "", taxRate: "0",
};

/** Header fields kept in invoices.details (the rest map to real columns). */
const DETAIL_FIELDS = [
  "yourName", "yourBusiness", "yourAddress", "yourCity", "yourState", "yourZip", "yourEmail", "yourPhone",
  "clientCompany", "clientAddress", "clientCity", "clientState", "clientZip", "invoiceDate", "paymentTerms",
] as const;

export function toSaveParams(form: InvoiceData, items: LineItem[], logoUrl: string | null): InvoiceSaveParams {
  const details: Record<string, unknown> = {};
  for (const f of DETAIL_FIELDS) details[f] = form[f];
  if (logoUrl) details.logoUrl = logoUrl;
  return {
    invoiceNumber: form.invoiceNumber.trim(),
    clientName: form.clientName,
    lineItems: items.map((i) => ({
      description: i.description, quantity: Number(i.quantity) || 0, rate: Number(i.rate) || 0,
      amount: Math.round((Number(i.quantity) || 0) * (Number(i.rate) || 0) * 100) / 100,
    })),
    taxRate: parseFloat(form.taxRate) || 0,
    dueDate: form.dueDate || undefined,
    notes: form.notes,
    details,
  };
}

export function fromInvoice(inv: Invoice): { form: InvoiceData; items: LineItem[]; logoUrl: string | null } {
  const d = inv.details ?? {};
  const form: InvoiceData = { ...EMPTY_FORM };
  for (const f of DETAIL_FIELDS) if (typeof d[f] === "string") form[f] = d[f] as string;
  form.invoiceNumber = inv.invoiceNumber;
  form.clientName = inv.clientName;
  form.dueDate = inv.dueDate ?? "";
  form.notes = inv.notes ?? "";
  form.taxRate = String(inv.taxRate ?? 0);
  const items = (inv.lineItems ?? []).map((li, idx) => ({ id: idx + 1, description: li.description, quantity: li.quantity, rate: li.rate }));
  return { form, items, logoUrl: typeof d.logoUrl === "string" ? d.logoUrl : null };
}

