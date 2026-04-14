"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Loader2, GraduationCap, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { MemberProfile, EducationEntry } from "./types";
import { EMPTY_EDU } from "./types";

interface Props {
  mp: MemberProfile;
  onMpChange: (mp: MemberProfile) => void;
}

export function EducationCard({ mp, onMpChange }: Props) {
  const [expanded, setExpanded] = useState<boolean | null>(() => (mp?.education ?? []).length > 0);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<EducationEntry>(EMPTY_EDU);
  const [saving, setSaving] = useState(false);

  if (!mp) return null;

  async function saveEntry() {
    if (!mp?.id || !form.institution.trim()) return;
    setSaving(true);
    try {
      const current: EducationEntry[] = mp.education ?? [];
      let updated: EducationEntry[];
      if (editing === "new") {
        updated = [...current, { ...form }];
      } else if (typeof editing === "number") {
        updated = current.map((e: EducationEntry, i: number) => i === editing ? { ...form } : e);
      } else {
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.from("company_memberships").update({ education: updated }).eq("id", mp.id);
      if (error) throw error;
      onMpChange({ ...mp, education: updated });
      setEditing(null);
      setForm(EMPTY_EDU);
      toast.success("Education updated");
    } catch (err) { console.error(err); toast.error("Failed to save education"); }
    finally { setSaving(false); }
  }

  async function deleteEntry(idx: number) {
    if (!mp?.id) return;
    const current: EducationEntry[] = mp.education ?? [];
    const updated = current.filter((_: EducationEntry, i: number) => i !== idx);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("company_memberships").update({ education: updated }).eq("id", mp.id);
      if (error) throw error;
      onMpChange({ ...mp, education: updated });
      toast.success("Education entry removed");
    } catch (err) { console.error(err); toast.error("Failed to delete education entry"); }
  }

  function renderForm() {
    return (
      <div className="space-y-2 rounded-lg border border-border/40 p-3">
        <Input placeholder="Institution" value={form.institution} onChange={(e) => setForm(p => ({ ...p, institution: e.target.value }))} className="h-8 text-sm" />
        <Input placeholder="Degree / Program" value={form.degree} onChange={(e) => setForm(p => ({ ...p, degree: e.target.value }))} className="h-8 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Start Year" value={form.startYear} onChange={(e) => setForm(p => ({ ...p, startYear: e.target.value }))} className="h-8 text-sm" />
          <Input placeholder="End Year" value={form.endYear} onChange={(e) => setForm(p => ({ ...p, endYear: e.target.value }))} className="h-8 text-sm" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveEntry} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setEditing(null); setForm(EMPTY_EDU); }}>
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
            <GraduationCap className="h-3.5 w-3.5" /> Education
            {(mp.education ?? []).length > 0 && (
              <Badge variant="secondary" className="text-[9px] ml-1">{(mp.education ?? []).length}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {editing === null && (
              <Button
                variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1"
                onClick={(e) => { e.stopPropagation(); setExpanded(true); setEditing("new"); setForm(EMPTY_EDU); }}
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
          {(mp.education ?? []).map((entry: EducationEntry, idx: number) => (
            editing === idx ? (
              <div key={idx}>{renderForm()}</div>
            ) : (
              <div key={idx} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{entry.institution}{entry.degree ? ` — ${entry.degree}` : ""}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {entry.startYear}{entry.endYear ? ` - ${entry.endYear}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditing(idx); setForm(entry); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteEntry(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )
          ))}
          {editing === "new" && renderForm()}
          {(mp.education ?? []).length === 0 && editing === null && (
            <p className="text-[10px] text-muted-foreground text-center py-2">No education entries yet.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
