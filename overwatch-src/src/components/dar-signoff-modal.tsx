"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileSignature, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateDAR, signDAR, darSummaryLines, type DailyActivityReport } from "@/lib/supabase/db-dar";
import { parseUTC } from "@/lib/parse-utc";

/**
 * Shown right after an online clock-out: the officer reviews the generated
 * Daily Activity Report, adds a short summary and signs it. "Later" closes it.
 */
export function DarSignoffModal({ open, onClose, timesheetId, companyId, userId, defaultName }: {
  open: boolean;
  onClose: () => void;
  timesheetId: string | null;
  companyId: string | null;
  userId: string | null;
  defaultName: string;
}) {
  const [report, setReport] = useState<DailyActivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [name, setName] = useState(defaultName);
  const [certify, setCertify] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !timesheetId) return;
    // Parent remounts this per timesheet (key), so state starts fresh.
    generateDAR(timesheetId).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false));
  }, [open, timesheetId]);

  async function sign() {
    if (!timesheetId || !companyId || !userId) return;
    setSaving(true);
    const r = await signDAR({ companyId, timesheetId, userId, summary, signedName: name, report });
    setSaving(false);
    if (r.ok) { toast.success("Shift notes signed"); onClose(); return; }
    if (r.reason === "already_signed") { toast.info("Shift notes for this shift are already signed"); onClose(); return; }
    if (r.reason === "not_enabled") { toast.error("Shift notes aren't turned on for this company yet"); onClose(); return; }
    toast.error("Couldn't save your shift notes. Try again.");
  }

  const canSign = certify && name.trim().length >= 2 && !saving && !!report;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" /> Shift Notes</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your shift…</div>
        ) : !report ? (
          <p className="py-4 text-sm text-muted-foreground">Couldn&apos;t load this shift&apos;s activity. You can add shift notes later from Watch Log.</p>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-semibold">{report.eventName || "Shift"}</div>
              <div className="text-xs text-muted-foreground">{parseUTC(report.clockIn).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – {parseUTC(report.clockOut).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
              <ul className="mt-2 flex flex-wrap gap-1.5">{darSummaryLines(report).map((l) => <li key={l} className="rounded bg-muted px-2 py-0.5 text-xs">{l}</li>)}</ul>
            </div>
            {report.entries.length > 0 && (
              <ol className="max-h-40 space-y-1 overflow-y-auto rounded border border-border/50 p-2 text-xs">
                {report.entries.map((e, i) => (
                  <li key={i} className="flex gap-2"><span className="w-16 shrink-0 tabular-nums text-muted-foreground">{parseUTC(e.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span>{e.description}</span></li>
                ))}
              </ol>
            )}
            <label className="block text-sm font-medium" htmlFor="dar-summary">Shift notes</label>
            <Textarea id="dar-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} rows={4} placeholder="Quiet shift, all doors secured at close…" />
            <label className="block text-sm font-medium" htmlFor="dar-name">Sign with your name</label>
            <input id="dar-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" />
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={certify} onChange={(e) => setCertify(e.target.checked)} />
              <span>I confirm these shift notes are accurate to the best of my knowledge.</span>
            </label>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="h-11" onClick={onClose}>Later</Button>
          <Button className="h-11" disabled={!canSign} onClick={sign}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign Shift Notes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
