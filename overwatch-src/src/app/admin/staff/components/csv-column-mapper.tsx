"use client";

import { useState, useMemo } from "react";
import { Check, AlertTriangle, X, ArrowRight, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STAFF_FIELDS, suggestMapping } from "@/lib/csv-import";

interface CSVColumnMapperProps {
  csvHeaders: string[];
  csvPreviewRows: string[][]; // first 3 rows
  onConfirm: (mapping: Record<string, string | null>) => void;
  onCancel: () => void;
}

export function CSVColumnMapper({ csvHeaders, csvPreviewRows, onConfirm, onCancel }: CSVColumnMapperProps) {
  const autoMapping = useMemo(() => suggestMapping(csvHeaders), [csvHeaders]);
  const [mapping, setMapping] = useState<Record<string, string | null>>(autoMapping);

  const requiredMissing = STAFF_FIELDS.filter((f) => f.required && !mapping[f.key]);
  const canConfirm = requiredMissing.length === 0;

  function handleChange(fieldKey: string, value: string) {
    setMapping((prev) => ({ ...prev, [fieldKey]: value || null }));
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Table2 className="h-4 w-4" /> Map CSV Columns
        </p>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Match your CSV columns to the required fields. We auto-matched what we could.
      </p>

      {/* Mapping table */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Our Field</th>
              <th className="px-3 py-2 text-center font-medium w-8"></th>
              <th className="px-3 py-2 text-left font-medium">Your CSV Column</th>
              <th className="px-3 py-2 text-center font-medium w-8">Status</th>
            </tr>
          </thead>
          <tbody>
            {STAFF_FIELDS.map((field) => {
              const selected = mapping[field.key];
              const isAutoMatched = selected && autoMapping[field.key] === selected;
              const isMissing = field.required && !selected;

              return (
                <tr key={field.key} className="border-t border-border/30">
                  <td className="px-3 py-2">
                    <span className="font-medium">{field.label}</span>
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </td>
                  <td className="px-1 py-2 text-center">
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 mx-auto" />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={selected ?? ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className={`w-full h-7 rounded border bg-background px-2 text-xs cursor-pointer ${
                        isMissing
                          ? "border-red-500/50 text-red-500"
                          : "border-border/40"
                      }`}
                    >
                      <option value="">(skip)</option>
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {selected ? (
                      <Check className={`h-3.5 w-3.5 mx-auto ${isAutoMatched ? "text-green-500" : "text-blue-500"}`} />
                    ) : isMissing ? (
                      <AlertTriangle className="h-3.5 w-3.5 mx-auto text-red-500" />
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Validation warning */}
      {requiredMissing.length > 0 && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Required field{requiredMissing.length > 1 ? "s" : ""} not mapped:{" "}
            {requiredMissing.map((f) => f.label).join(", ")}
          </span>
        </div>
      )}

      {/* CSV Preview */}
      {csvPreviewRows.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            CSV Preview (first {csvPreviewRows.length} row{csvPreviewRows.length !== 1 ? "s" : ""})
          </p>
          <div className="max-h-32 overflow-auto rounded border border-border/40">
            <table className="w-full text-[10px]">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {csvHeaders.map((h) => (
                    <th key={h} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreviewRows.map((row, i) => (
                  <tr key={i} className="border-t border-border/30">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1 text-muted-foreground whitespace-nowrap max-w-[150px] truncate">
                        {cell || <span className="text-muted-foreground/30">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-green-500" /> Auto-matched
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-blue-500" /> Manually set
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-red-500" /> Required
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <Badge variant="outline" className="text-[10px]">
          {csvHeaders.length} columns detected
        </Badge>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs h-7 gap-1.5"
            disabled={!canConfirm}
            onClick={() => onConfirm(mapping)}
          >
            <Check className="h-3 w-3" /> Apply Mapping
          </Button>
        </div>
      </div>
    </div>
  );
}
