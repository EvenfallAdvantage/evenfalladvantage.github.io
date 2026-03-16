"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Plus, Trash2, Save, RotateCcw,
  Building2, User, Hash, Calendar, DollarSign, Percent,
  FileDown, Eye, EyeOff, Upload, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";

type LineItem = {
  id: number;
  description: string;
  quantity: number;
  rate: number;
};

type InvoiceData = {
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

const EMPTY_FORM: InvoiceData = {
  yourName: "", yourBusiness: "", yourAddress: "", yourCity: "", yourState: "", yourZip: "",
  yourEmail: "", yourPhone: "",
  clientName: "", clientCompany: "", clientAddress: "", clientCity: "", clientState: "", clientZip: "",
  invoiceNumber: "", invoiceDate: new Date().toISOString().split("T")[0], dueDate: "",
  paymentTerms: "", notes: "", taxRate: "0",
};

const STORAGE_KEY = "overwatch_invoice_current";

export default function InvoicesPage() {
  const [form, setForm] = useState<InvoiceData>(EMPTY_FORM);
  const [items, setItems] = useState<LineItem[]>([]);
  const [nextId, setNextId] = useState(1);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [generating, setGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.form) setForm(data.form);
        if (data.items) setItems(data.items);
        if (data.nextId) setNextId(data.nextId);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
      }
    } catch {}
  }, []);

  // Save to localStorage on changes
  const save = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, items, nextId, logoUrl }));
    } catch {}
  }, [form, items, nextId, logoUrl]);

  useEffect(() => { save(); }, [save]);

  function updateField(field: keyof InvoiceData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addItem() {
    setItems((prev) => [...prev, { id: nextId, description: "", quantity: 1, rate: 0 }]);
    setNextId((n) => n + 1);
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: number, field: keyof Omit<LineItem, "id">, value: string | number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  function clearForm() {
    if (!confirm("Clear this invoice? This cannot be undone.")) return;
    setForm(EMPTY_FORM);
    setItems([]);
    setNextId(1);
    setLogoUrl(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { alert("File must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setLogoUrl(ev.target?.result as string); };
    reader.readAsDataURL(file);
  }

  // Totals
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.rate, 0);
  const taxRate = parseFloat(form.taxRate) || 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const fmt = (n: number) => n.toFixed(2);

  async function downloadPDF() {
    if (!previewRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(previewRef.current, {
        scale: 2, useCORS: true, logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = 210, pdfH = 297, margin = 10;
      const maxW = pdfW - margin * 2, maxH = pdfH - margin * 2;
      let imgW = canvas.width * 0.264583 / 2;
      let imgH = canvas.height * 0.264583 / 2;
      if (imgW > maxW) { const r = maxW / imgW; imgW = maxW; imgH *= r; }
      if (imgH > maxH) { const r = maxH / imgH; imgH = maxH; imgW *= r; }
      const xOff = (pdfW - imgW) / 2;
      pdf.addImage(imgData, "PNG", xOff, margin, imgW, imgH);
      const invNum = form.invoiceNumber || "invoice";
      pdf.save(`Invoice_${invNum}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Error generating PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><FileText className="h-5 w-5 sm:h-6 sm:w-6" /> INVOICES</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Professional invoicing for 1099 contractors</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{showPreview ? "Hide" : "Show"}</span> Preview
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={clearForm}>
              <RotateCcw className="h-3.5 w-3.5" /> Clear
            </Button>
            <Button size="sm" className="gap-1.5" onClick={downloadPDF} disabled={generating}>
              {generating ? <Save className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              PDF
            </Button>
          </div>
        </div>

        <div className={`grid gap-6 ${showPreview ? "lg:grid-cols-2" : ""}`}>
          {/* Left — Form */}
          <div className="space-y-4">
            {/* Logo Upload */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> Business Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                {logoUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={logoUrl} alt="Logo" className="h-12 max-w-[150px] object-contain rounded" />
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setLogoUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                      <X className="h-3 w-3" /> Remove
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3" /> Upload Logo (PNG, JPG — max 2MB)
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Your Info */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Your Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Full Name *" value={form.yourName} onChange={(e) => updateField("yourName", e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Business Name" value={form.yourBusiness} onChange={(e) => updateField("yourBusiness", e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Address" value={form.yourAddress} onChange={(e) => updateField("yourAddress", e.target.value)} className="h-8 text-sm col-span-2" />
                <Input placeholder="City" value={form.yourCity} onChange={(e) => updateField("yourCity", e.target.value)} className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Input placeholder="State" value={form.yourState} onChange={(e) => updateField("yourState", e.target.value)} className="h-8 text-sm w-20" />
                  <Input placeholder="ZIP" value={form.yourZip} onChange={(e) => updateField("yourZip", e.target.value)} className="h-8 text-sm flex-1" />
                </div>
                <Input placeholder="Email" type="email" value={form.yourEmail} onChange={(e) => updateField("yourEmail", e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Phone" value={form.yourPhone} onChange={(e) => updateField("yourPhone", e.target.value)} className="h-8 text-sm" />
              </CardContent>
            </Card>

            {/* Client Info */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Bill To</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Client Name *" value={form.clientName} onChange={(e) => updateField("clientName", e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Company" value={form.clientCompany} onChange={(e) => updateField("clientCompany", e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Address" value={form.clientAddress} onChange={(e) => updateField("clientAddress", e.target.value)} className="h-8 text-sm col-span-2" />
                <Input placeholder="City" value={form.clientCity} onChange={(e) => updateField("clientCity", e.target.value)} className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Input placeholder="State" value={form.clientState} onChange={(e) => updateField("clientState", e.target.value)} className="h-8 text-sm w-20" />
                  <Input placeholder="ZIP" value={form.clientZip} onChange={(e) => updateField("clientZip", e.target.value)} className="h-8 text-sm flex-1" />
                </div>
              </CardContent>
            </Card>

            {/* Invoice Details */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Hash className="h-4 w-4" /> Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input placeholder="Invoice Number" value={form.invoiceNumber} onChange={(e) => updateField("invoiceNumber", e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input type="date" value={form.invoiceDate} onChange={(e) => updateField("invoiceDate", e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input type="date" placeholder="Due Date" value={form.dueDate} onChange={(e) => updateField("dueDate", e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Percent className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input type="number" min="0" max="100" step="0.01" placeholder="Tax %" value={form.taxRate} onChange={(e) => updateField("taxRate", e.target.value)} className="h-8 text-sm" />
                </div>
                <Input placeholder="Payment Terms (e.g. Net 30)" value={form.paymentTerms} onChange={(e) => updateField("paymentTerms", e.target.value)} className="h-8 text-sm col-span-2" />
                <textarea placeholder="Notes (optional)" value={form.notes} onChange={(e) => updateField("notes", e.target.value)}
                  className="col-span-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px] resize-y" />
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Line Items</CardTitle>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={addItem}>
                    <Plus className="h-3 w-3" /> Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No line items. Click &quot;Add Item&quot; to start.</p>
                )}
                {items.map((item) => (
                  <div key={item.id} className="flex gap-2 items-start rounded-lg border border-border/50 p-2">
                    <div className="flex-1 grid gap-1.5 sm:grid-cols-4">
                      <Input placeholder="Description" value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        className="h-7 text-xs sm:col-span-2" />
                      <Input type="number" placeholder="Qty" min="0.01" step="0.01" value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs" />
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Input type="number" placeholder="Rate" min="0" step="0.01" value={item.rate}
                          onChange={(e) => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-xs font-mono font-semibold w-20 text-right">${fmt(item.quantity * item.rate)}</span>
                      <button onClick={() => removeItem(item.id)} className="text-muted-foreground/50 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Totals */}
                {items.length > 0 && (
                  <div className="border-t border-border/40 pt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-mono">${fmt(subtotal)}</span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                        <span className="font-mono">${fmt(tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold">
                      <span>Total</span>
                      <span className="font-mono">${fmt(total)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right — Live Preview */}
          {showPreview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Live Preview</Badge>
                <span className="text-[10px] text-muted-foreground">This is how your invoice will look</span>
              </div>
              <Card className="border-border/40 overflow-hidden">
                <CardContent className="p-0">
                  <div ref={previewRef} className="bg-white text-black p-8 min-h-[600px]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        {logoUrl && <img src={logoUrl} alt="Logo" className="max-w-[150px] max-h-[80px] object-contain mb-3" />}
                        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">INVOICE</h1>
                        {form.yourBusiness && <p className="text-sm text-gray-500 mt-1">{form.yourBusiness}</p>}
                      </div>
                      <div className="text-right text-sm text-gray-600 space-y-0.5">
                        {form.invoiceNumber && <div><span className="font-semibold text-gray-800">Invoice #:</span> {form.invoiceNumber}</div>}
                        {form.invoiceDate && <div><span className="font-semibold text-gray-800">Date:</span> {form.invoiceDate}</div>}
                        {form.dueDate && <div><span className="font-semibold text-gray-800">Due:</span> {form.dueDate}</div>}
                      </div>
                    </div>

                    {/* Parties */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">From</h3>
                        <div className="text-sm text-gray-700 space-y-0.5">
                          {form.yourName && <div className="font-semibold text-gray-900">{form.yourName}</div>}
                          {form.yourAddress && <div>{form.yourAddress}</div>}
                          {(form.yourCity || form.yourState || form.yourZip) && (
                            <div>{form.yourCity}{form.yourCity && form.yourState ? ", " : ""}{form.yourState} {form.yourZip}</div>
                          )}
                          {form.yourEmail && <div>{form.yourEmail}</div>}
                          {form.yourPhone && <div>{form.yourPhone}</div>}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Bill To</h3>
                        <div className="text-sm text-gray-700 space-y-0.5">
                          {form.clientName && <div className="font-semibold text-gray-900">{form.clientName}</div>}
                          {form.clientCompany && <div>{form.clientCompany}</div>}
                          {form.clientAddress && <div>{form.clientAddress}</div>}
                          {(form.clientCity || form.clientState || form.clientZip) && (
                            <div>{form.clientCity}{form.clientCity && form.clientState ? ", " : ""}{form.clientState} {form.clientZip}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <table className="w-full mb-6 text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-800">
                          <th className="text-left py-2 font-semibold text-gray-800">Description</th>
                          <th className="text-center py-2 font-semibold text-gray-800 w-20">Qty</th>
                          <th className="text-right py-2 font-semibold text-gray-800 w-24">Rate</th>
                          <th className="text-right py-2 font-semibold text-gray-800 w-24">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-xs">No line items</td></tr>
                        ) : (
                          items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-200">
                              <td className="py-2 text-gray-700">{item.description || "—"}</td>
                              <td className="py-2 text-center text-gray-600">{item.quantity}</td>
                              <td className="py-2 text-right text-gray-600">${fmt(item.rate)}</td>
                              <td className="py-2 text-right font-medium text-gray-800">${fmt(item.quantity * item.rate)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Totals */}
                    <div className="flex justify-end mb-8">
                      <div className="w-56 space-y-1 text-sm">
                        <div className="flex justify-between text-gray-600">
                          <span>Subtotal</span><span>${fmt(subtotal)}</span>
                        </div>
                        {taxRate > 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>Tax ({taxRate}%)</span><span>${fmt(tax)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg text-gray-900 border-t-2 border-gray-800 pt-1">
                          <span>Total Due</span><span>${fmt(total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Terms / Notes */}
                    {form.paymentTerms && (
                      <div className="mb-4">
                        <h4 className="text-xs font-bold uppercase text-gray-400 mb-1 tracking-wider">Payment Terms</h4>
                        <p className="text-sm text-gray-600">{form.paymentTerms}</p>
                      </div>
                    )}
                    {form.notes && (
                      <div className="mb-4">
                        <h4 className="text-xs font-bold uppercase text-gray-400 mb-1 tracking-wider">Notes</h4>
                        <p className="text-sm text-gray-600">{form.notes}</p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="border-t border-gray-200 pt-4 mt-8 text-center">
                      <p className="text-xs text-gray-400">Thank you for your business!</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
