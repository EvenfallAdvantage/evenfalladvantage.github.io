"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getLegacyAssessments, getLegacyModules,
  createLegacyAssessment, updateLegacyAssessment,
  type LegacyAssessment, type LegacyModule,
} from "@/lib/legacy-bridge";
import { logger } from "@/lib/logger";

interface AssessmentsTabProps {
  triggerNew: number;
}

export function AssessmentsTab({ triggerNew }: AssessmentsTabProps) {
  const [assessments, setAssessments] = useState<LegacyAssessment[]>([]);
  const [modules, setModules] = useState<LegacyModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (triggerNew > 0) setShowNew(true);
  }, [triggerNew]);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // New assessment
  const [naName, setNaName] = useState("");
  const [naModuleId, setNaModuleId] = useState("");
  const [naQuestions, setNaQuestions] = useState("10");
  const [naPassing, setNaPassing] = useState("70");
  // Edit
  const [eaName, setEaName] = useState("");
  const [eaModuleId, setEaModuleId] = useState("");
  const [eaQuestions, setEaQuestions] = useState("");
  const [eaPassing, setEaPassing] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, m] = await Promise.all([getLegacyAssessments(), getLegacyModules()]);
      setAssessments(a); setModules(m);
    } catch (e) { logger.swallow("instructor-assessments:load", e, "warn"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!naName.trim()) return;
    setSaving(true);
    try {
      await createLegacyAssessment({
        assessment_name: naName.trim(),
        module_id: naModuleId || undefined,
        total_questions: parseInt(naQuestions) || 10,
        passing_score: parseInt(naPassing) || 70,
      });
      setShowNew(false); setNaName(""); setNaModuleId(""); setNaQuestions("10"); setNaPassing("70");
      await load();
    } catch { alert("Failed to create assessment"); }
    finally { setSaving(false); }
  }

  function startEdit(a: LegacyAssessment) {
    setEditId(a.id); setEaName(a.assessment_name);
    setEaModuleId(a.module_id ?? ""); setEaQuestions(String(a.total_questions));
    setEaPassing(String(a.passing_score));
  }

  async function handleUpdate() {
    if (!editId) return;
    setSaving(true);
    try {
      await updateLegacyAssessment(editId, {
        assessment_name: eaName.trim(),
        module_id: eaModuleId || null,
        total_questions: parseInt(eaQuestions) || 10,
        passing_score: parseInt(eaPassing) || 70,
      });
      setEditId(null); await load();
    } catch { alert("Failed to update"); }
    finally { setSaving(false); }
  }

  const moduleMap = new Map(modules.map((m) => [m.id, m.module_name]));

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{assessments.length} assessments</p>
      </div>

      {showNew && (
        <Card className="border-primary/30"><CardContent className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold">New Assessment</h3>
          <Input placeholder="Assessment Name *" value={naName} onChange={(e) => setNaName(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={naModuleId} onChange={(e) => setNaModuleId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">No linked module</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
            </select>
            <Input placeholder="Total Questions" type="number" value={naQuestions} onChange={(e) => setNaQuestions(e.target.value)} />
            <Input placeholder="Passing Score (%)" type="number" value={naPassing} onChange={(e) => setNaPassing(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}><X className="h-3.5 w-3.5" /> Cancel</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {assessments.map((a) => (
          <Card key={a.id} className="border-border/40">
            <CardContent className="p-4">
              {editId === a.id ? (
                <div className="space-y-2">
                  <Input value={eaName} onChange={(e) => setEaName(e.target.value)} />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select value={eaModuleId} onChange={(e) => setEaModuleId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">No linked module</option>
                      {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
                    </select>
                    <Input type="number" value={eaQuestions} onChange={(e) => setEaQuestions(e.target.value)} placeholder="Questions" />
                    <Input type="number" value={eaPassing} onChange={(e) => setEaPassing(e.target.value)} placeholder="Passing %" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdate} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm">{a.assessment_name}</h4>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{a.total_questions} questions</span>
                      <span>Pass: {a.passing_score}%</span>
                      {a.module_id && <span>Module: {moduleMap.get(a.module_id) ?? "Unknown"}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {assessments.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No assessments yet.</div>}
      </div>
    </div>
  );
}
