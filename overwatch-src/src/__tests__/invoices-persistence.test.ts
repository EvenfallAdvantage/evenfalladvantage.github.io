import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { canDeleteInvoice, invoiceAutosaveKey, CLIENT_VISIBLE_STATUSES } from "@/lib/supabase/db-invoices";
import { EMPTY_FORM, toSaveParams, fromInvoice } from "@/lib/invoice-form";

describe("invoice delete permission mirrors RLS", () => {
  it("owners/admins may delete drafts only", () => {
    expect(canDeleteInvoice("owner", "draft")).toBe(true);
    expect(canDeleteInvoice("admin", "draft")).toBe(true);
    expect(canDeleteInvoice("admin", "sent")).toBe(false);
    expect(canDeleteInvoice("owner", "paid")).toBe(false);
  });
  it("managers and below never may", () => {
    for (const r of ["manager", "lead", "staff", "client", null]) expect(canDeleteInvoice(r, "draft")).toBe(false);
  });
});

describe("autosave key", () => {
  it("is scoped per company and user", () => {
    expect(invoiceAutosaveKey("c1", "u1")).not.toBe(invoiceAutosaveKey("c2", "u1"));
    expect(invoiceAutosaveKey("c1", "u1")).not.toBe(invoiceAutosaveKey("c1", "u2"));
  });
});

describe("form <-> invoice mapping", () => {
  it("round-trips header fields, items, totals inputs and logo", () => {
    const form = { ...EMPTY_FORM, invoiceNumber: " INV-0007 ", clientName: "Acme", clientCity: "Austin", yourBusiness: "Evenfall", taxRate: "8.25", dueDate: "2026-12-01", notes: "Net 30" };
    const items = [{ id: 1, description: "Guard", quantity: 10, rate: 32.5 }];
    const p = toSaveParams(form, items, "data:image/png;base64,x");
    expect(p.invoiceNumber).toBe("INV-0007");
    expect(p.lineItems[0].amount).toBe(325);
    expect(p.taxRate).toBe(8.25);
    const back = fromInvoice({
      id: "i", companyId: "c", invoiceNumber: p.invoiceNumber, clientName: p.clientName, clientEmail: "",
      eventId: null, eventName: null, status: "draft", subtotal: 325, taxRate: 8.25, taxAmount: 26.81, total: 351.81,
      dueDate: "2026-12-01", paidDate: null, notes: "Net 30", lineItems: p.lineItems, details: p.details ?? {},
      createdAt: "", updatedAt: null,
    });
    expect(back.form.clientCity).toBe("Austin");
    expect(back.form.yourBusiness).toBe("Evenfall");
    expect(back.form.taxRate).toBe("8.25");
    expect(back.items[0]).toMatchObject({ description: "Guard", quantity: 10, rate: 32.5 });
    expect(back.logoUrl).toBe("data:image/png;base64,x");
  });
});

describe("client RLS migration", () => {
  const dir = join(__dirname, "../../supabase/migrations");
  const sql = readFileSync(join(dir, "20261102040000_invoices_client_read_and_details.sql"), "utf8");
  it("adds a client select policy limited to issued statuses", () => {
    expect(sql).toMatch(/CREATE POLICY invoices_select_client/);
    expect(sql).toMatch(/'client'/);
    for (const st of CLIENT_VISIBLE_STATUSES) expect(sql).toContain(`'${st}'`);
    expect(sql).not.toContain("'draft'");
    expect(sql).not.toMatch(/DROP POLICY[^;]*mfa_required_all/);
  });
  it("page no longer uses the unscoped localStorage key for drafts", () => {
    const page = readFileSync(join(__dirname, "../app/invoices/page.tsx"), "utf8");
    expect(page).not.toMatch(/setItem\("overwatch_invoice_current"/);
  });
});
