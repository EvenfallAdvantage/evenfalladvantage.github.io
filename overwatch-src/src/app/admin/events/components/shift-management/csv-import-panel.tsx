"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getEventShifts, bulkCreateShifts } from "@/lib/supabase/db";
import { type Shift, type Member } from "../shared";
import { localToUTC } from "@/lib/timezone";
import {
  parseCSVRaw,
  SHIFT_FIELDS,
  suggestShiftMapping,
  applyShiftMapping,
  validateShiftRows,
  type ShiftImportRow,
} from "@/lib/csv-import";

interface CsvImportPanelProps {
  eventId: string;
  companyId: string;
  members: Member[];
  eventTimezone?: string;
  onShiftsChange: (shifts: Shift[]) => void;
  onClose: () => void;
}

export function CsvImportPanel({
  eventId,
  companyId,
  members,
  eventTimezone,
  onShiftsChange,
  onClose,
}: CsvImportPanelProps) {
  /* ── CSV Import state ── */
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string | null>>({});
  const [csvStep, setCsvStep] = useState<"upload" | "map" | "preview">("upload");
  const [csvPreview, setCsvPreview] = useState<{ valid: ShiftImportRow[]; errors: { line: number; message: string }[] } | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── CSV Import handlers ── */

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseCSVRaw(text);
      if (result.errors.length > 0 && result.rows.length === 0) {
        toast.error("Failed to parse CSV: " + result.errors[0].message);
        return;
      }
      setCsvHeaders(result.headers);
      setCsvRows(result.rows);
      setCsvMapping(suggestShiftMapping(result.headers));
      setCsvStep("map");
    };
    reader.readAsText(file);
    // reset input so same file can be re-selected
    e.target.value = "";
  }

  function handleCsvMappingConfirm() {
    const mapped = applyShiftMapping(csvRows, csvHeaders, csvMapping);
    const result = validateShiftRows(mapped);
    setCsvPreview(result);
    setCsvStep("preview");
  }

  async function handleCsvImport() {
    if (!csvPreview || csvPreview.valid.length === 0) return;
    setCsvImporting(true);
    try {
      // Build email-to-userId lookup from members
      const emailToUserId = new Map<string, string>();
      for (const m of members) {
        if (m.users?.email && m.users?.id) {
          emailToUserId.set(m.users.email.toLowerCase(), m.users.id);
        }
      }

      const shiftData = csvPreview.valid.map((r) => {
        // Parse date + time → local datetime string → UTC
        const startLocal = `${r.date}T${r.start_time}`;
        const endLocal = `${r.date}T${r.end_time}`;
        const startUTC = eventTimezone ? localToUTC(startLocal, eventTimezone) : new Date(startLocal).toISOString();
        const endUTC = eventTimezone ? localToUTC(endLocal, eventTimezone) : new Date(endLocal).toISOString();

        // Resolve staff email to user ID
        let assignedUserId: string | null = null;
        if (r.staff_email) {
          assignedUserId = emailToUserId.get(r.staff_email.toLowerCase()) ?? null;
        }

        return {
          start_time: startUTC,
          end_time: endUTC,
          role: r.role,
          assigned_user_id: assignedUserId,
          notes: r.notes,
        };
      });

      const result = await bulkCreateShifts(eventId, companyId, shiftData);
      if (result.errors.length > 0) {
        toast.error(`Imported ${result.created} shifts with ${result.errors.length} error(s)`);
      } else {
        toast.success(`Successfully imported ${result.created} shift${result.created !== 1 ? "s" : ""}`);
      }
      onShiftsChange(await getEventShifts(eventId));
      // Reset import state
      onClose();
      setCsvStep("upload");
      setCsvHeaders([]);
      setCsvRows([]);
      setCsvMapping({});
      setCsvPreview(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to import shifts");
    } finally {
      setCsvImporting(false);
    }
  }

  return (
    <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-primary/[0.02]">
      <input type="file" accept=".csv,text/csv" ref={fileInputRef} onChange={handleCsvFile} className="hidden" />

      {csvStep === "upload" && (
        <div className="text-center py-4">
          <Upload className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground mb-2">Upload a CSV file with shift data</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
            Choose CSV File
          </Button>
          <p className="text-[10px] text-muted-foreground/60 mt-2">Required columns: Date, Start Time, End Time</p>
        </div>
      )}

      {csvStep === "map" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Map CSV Columns</p>
            <span className="text-[10px] text-muted-foreground">{csvRows.length} row{csvRows.length !== 1 ? "s" : ""} found</span>
          </div>
          <div className="space-y-1.5">
            {SHIFT_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <label className="text-[10px] font-medium w-32 shrink-0">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={csvMapping[field.key] ?? ""}
                  onChange={(e) => setCsvMapping({ ...csvMapping, [field.key]: e.target.value || null })}
                  className="flex-1 h-7 rounded border border-border bg-background px-2 text-xs"
                >
                  <option value="">— Skip —</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs" onClick={handleCsvMappingConfirm}
              disabled={!csvMapping.date || !csvMapping.start_time || !csvMapping.end_time}>
              Preview Import
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {csvStep === "preview" && csvPreview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Import Preview</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{csvPreview.valid.length} valid</Badge>
              {csvPreview.errors.length > 0 && <Badge variant="destructive" className="text-[10px]">{csvPreview.errors.length} error{csvPreview.errors.length !== 1 ? "s" : ""}</Badge>}
            </div>
          </div>
          {csvPreview.errors.length > 0 && (
            <div className="rounded border border-red-500/20 bg-red-500/[0.04] p-2 space-y-0.5 max-h-24 overflow-y-auto">
              {csvPreview.errors.slice(0, 10).map((e, i) => (
                <p key={i} className="text-[10px] text-red-500">Line {e.line}: {e.message}</p>
              ))}
              {csvPreview.errors.length > 10 && <p className="text-[10px] text-red-500/60">...and {csvPreview.errors.length - 10} more</p>}
            </div>
          )}
          {csvPreview.valid.length > 0 && (
            <div className="rounded border border-border/30 overflow-hidden max-h-40 overflow-y-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 font-semibold">Date</th>
                    <th className="text-left px-2 py-1 font-semibold">Start</th>
                    <th className="text-left px-2 py-1 font-semibold">End</th>
                    <th className="text-left px-2 py-1 font-semibold">Role</th>
                    <th className="text-left px-2 py-1 font-semibold">Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.valid.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t border-border/10">
                      <td className="px-2 py-1">{r.date}</td>
                      <td className="px-2 py-1">{r.start_time}</td>
                      <td className="px-2 py-1">{r.end_time}</td>
                      <td className="px-2 py-1">{r.role ?? "—"}</td>
                      <td className="px-2 py-1">{r.staff_email ?? r.staff_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvPreview.valid.length > 10 && <p className="text-center text-[10px] text-muted-foreground py-1">...and {csvPreview.valid.length - 10} more</p>}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleCsvImport}
              disabled={csvPreview.valid.length === 0 || csvImporting}>
              {csvImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Import {csvPreview.valid.length} Shift{csvPreview.valid.length !== 1 ? "s" : ""}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCsvStep("map")}>Back</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
