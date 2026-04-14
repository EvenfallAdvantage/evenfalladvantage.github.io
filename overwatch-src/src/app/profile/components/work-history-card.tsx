"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Loader2, Briefcase, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { MemberProfile, WorkHistoryEntry } from "./types";
import { EMPTY_WORK } from "./types";

interface Props {
  mp: MemberProfile;
  onMpChange: (mp: MemberProfile) => void;
}

export function WorkHistoryCard({ mp, onMpChange }: Props) {
  const [expanded, setExpanded] = useState<boolean | null>(() => (mp?.work_history ?? []).length > 0);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<WorkHistoryEntry>(EMPTY_WORK);
  const [saving, setSaving] = useState(false);

  if (!mp) return null;

  async function saveEntry() {
    if (!mp?.id || !form.employer.trim()) return;
    setSaving(true);
    try {
      const current: WorkHistoryEntry[] = mp.work_history ?? [];
      let updated: WorkHistoryEntry[];
      if (editing === "new") {
        updated = [...current, { ...form }];
      } else if (typeof editing === "number") {
        updated = current.map((e: WorkHistoryEntry, i: number) => i === editing ? { ...form } : e);
      } else {
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.from("company_memberships").update({ work_history: updated }).eq("id", mp.id);
      if (error) throw error;
      onMpChange({ ...mp, work_history: updated });
      setEditing(null);
      setForm(EMPTY_WORK);
      toast.success("Work history updated");
    } catch (err) { console.error(err); toast.error("Failed to save work history"); }
    finally { setSaving(false); }
  }

  async function deleteEntry(idx: number) {
    if (!mp?.id) return;
    const current: WorkHistoryEntry[] = mp.work_history ?? [];
    const updated = current.filter((_: WorkHistoryEntry, i: number) => i !== idx);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("company_memberships").update({ work_history: updated }).eq("id", mp.id);
      if (error) throw error;
      onMpChange({ ...mp, work_history: updated });
      toast.success("Work history entry removed");
    } catch (err) { console.error(err); toast.error("Failed to delete work history entry"); }
  }

  function renderForm() {
    return (
      <div className="space-y-2 rounded-lg border border-border/40 p-3">
        <Input placeholder="Employer" value={form.employer} onChange={(e) => setForm(p => ({ ...p, employer: e.target.value }))} className="h-8 text-sm" />
        <Input placeholder="Job Title" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} className="h-8 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <Input type="month" placeholder="Start Date" value={form.startDate} onChange={(e) => setForm(p => ({ ...p, startDate: e.target.value }))} className="h-8 text-sm" />
          <Input type="month" placeholder="End Date" value={form.endDate} onChange={(e) => setForm(p => ({ ...p, endDate: e.target.value }))} className="h-8 text-sm" />
        </div>
        <Input placeholder="Description" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} className="h-8 text-sm" />
        <div className="flex gap-2">
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveEntry} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setEditing(null); setForm(EMPTY_WORK); }}>
            <X className="h-3 w-3" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Work History
            {(mp.work_history ?? []).length > 0 && (
              <Badge variant="secondary" className="text-[9px] ml-1">{(mp.work_history ?? []).length}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {editing === null && (
              <Button
                variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1"
                onClick={(e) => { e.stopPropagation(); setExpanded(true); setEditing("new"); setForm(EMPTY_WORK); }}
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            )}
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 pt-0">
          {(mp.work_history ?? []).map((entry: WorkHistoryEntry, idx: number) => (
            editing === idx ? (
              <div key={idx}>{renderForm()}</div>
            ) : (
              <div key={idx} className="flex items-start gap-3 rounded-lg border border-border/40 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{entry.title}{entry.employer ? ` at ${entry.employer}` : ""}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {entry.startDate}{entry.endDate ? ` - ${entry.endDate}` : " - Present"}
                  </p>
                  {entry.description && <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>}
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => { setEditing(idx); setForm(entry); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive shrink-0" onClick={() => deleteEntry(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )
          ))}
          {editing === "new" && renderForm()}
          {(mp.work_history ?? []).length === 0 && editing === null && (
            <p className="text-[10px] text-muted-foreground text-center py-2">No work history entries yet.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
