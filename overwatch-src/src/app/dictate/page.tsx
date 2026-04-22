"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Mic, Loader2, Save, ChevronDown, ChevronUp, User, Clock, Link2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { DictationRecorder } from "@/components/dictation-recorder";
import { getIncidents, getForms, createForm, submitForm, getFormSubmissions } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Incident = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Submission = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Form = any;

const PERSON_TYPES = ["Witness", "Suspect", "Victim", "Reporting Party", "Bystander", "Client", "Employee", "Other"];

export default function DictatePage() {
  const { user, activeCompanyId } = useAuthStore();
  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader("REPORTS", "Voice-to-text report dictation", <Mic className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader]);

  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [dictationForm, setDictationForm] = useState<Form | null>(null);
  const [transcripts, setTranscripts] = useState<Submission[]>([]);

  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [personType, setPersonType] = useState("Reporting Party");
  const [personName, setPersonName] = useState("");
  const [linkedIncidentId, setLinkedIncidentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const transcriptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [transcript, interimText]);

  const load = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      const inc = await getIncidents(activeCompanyId, "all");
      setIncidents(inc);
      const forms = await getForms(activeCompanyId);
      let dictForm = forms.find((f: Form) => f.name === "__dictation__" || f.name === "Dictation (System)");
      if (!dictForm) {
        dictForm = await createForm({ companyId: activeCompanyId, name: "Dictation (System)", description: "Auto-managed form for speech-to-text dictation transcripts" });
      }
      setDictationForm(dictForm);
      if (dictForm?.id) setTranscripts(await getFormSubmissions(dictForm.id));
    } catch (err) { console.error("Load dictation failed:", err); }
    finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  function handleTranscript(text: string, isFinal: boolean) {
    if (isFinal) { setTranscript(prev => prev + (prev ? " " : "") + text); setInterimText(""); }
    else { setInterimText(text); }
  }

  async function handleSave() {
    if (!transcript.trim() || !dictationForm?.id) return;
    setSaving(true);
    try {
      await submitForm({ formId: dictationForm.id, data: {
        transcript: transcript.trim(), personType, personName: personName.trim() || null,
        linkedIncidentId: linkedIncidentId || null, recordedAt: new Date().toISOString(),
        recordedBy: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
      }});
      setTranscript(""); setInterimText(""); setPersonName(""); setLinkedIncidentId(""); setPersonType("Reporting Party");
      setTranscripts(await getFormSubmissions(dictationForm.id));
      toast.success("Transcript saved");
    } catch (err) { console.error("Save dictation failed:", err); toast.error("Failed to save transcript"); }
    finally { setSaving(false); }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-4">
      {/* Report type tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full">
        <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
          <Mic className="h-3.5 w-3.5 text-primary" />
          Dictate
        </div>
        <Link href="/forms" className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors">
          Field Reports
        </Link>
        <Link href="/incidents" className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors">
          Incidents
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Recording Panel */}
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Mic className="h-4 w-4 text-primary" /> New Dictation</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Person Type</label>
                <select value={personType} onChange={e => setPersonType(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  {PERSON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Person Name</label>
                <Input className="mt-1" placeholder="Name of person (optional)" value={personName} onChange={e => setPersonName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Link to Incident</label>
                <select value={linkedIncidentId} onChange={e => setLinkedIncidentId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="">None</option>
                  {incidents.map((inc: Incident) => <option key={inc.id} value={inc.id}>{inc.title} ({inc.status})</option>)}
                </select>
              </div>
            </div>
            <DictationRecorder onTranscript={handleTranscript} />
            <div>
              <label className="text-xs font-medium text-muted-foreground">Transcript</label>
              <textarea ref={transcriptRef} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] max-h-[300px] resize-y"
                placeholder="Transcript will appear here as you speak... You can also type or edit manually."
                value={transcript + (interimText ? (transcript ? " " : "") + interimText : "")}
                onChange={e => { setTranscript(e.target.value); setInterimText(""); }} />
              {interimText && <p className="text-[10px] text-muted-foreground mt-0.5 animate-pulse">Listening...</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={!transcript.trim() || saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Transcript
              </Button>
              {transcript.trim() && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => { setTranscript(""); setInterimText(""); }}>Clear</Button>}
            </div>
          </div>

          {/* Saved Transcripts */}
          {transcripts.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Saved Transcripts ({transcripts.length})
              </h3>
              <div className="space-y-2">
                {transcripts.map((s: Submission) => {
                  const data = s.data ?? {};
                  const isExpanded = expanded === s.id;
                  const linkedInc = data.linkedIncidentId ? incidents.find((i: Incident) => i.id === data.linkedIncidentId) : null;
                  return (
                    <div key={s.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpanded(isExpanded ? null : s.id)}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10"><Mic className="h-4 w-4 text-primary" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{data.personType ?? "Dictation"}{data.personName ? ` — ${data.personName}` : ""}</span>
                            <Badge variant="secondary" className="text-[10px]">{data.personType ?? "Unknown"}</Badge>
                            {linkedInc && <Badge className="text-[9px] bg-amber-500/15 text-amber-600 gap-1"><Link2 className="h-2.5 w-2.5" /> {linkedInc.title}</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{s.users?.first_name} {s.users?.last_name}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(data.recordedAt ?? s.created_at)}</span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </div>
                      {isExpanded && (
                        <div className="border-t border-border/50 px-4 py-3 bg-muted/10">
                          <p className="text-sm whitespace-pre-wrap text-foreground/90">{data.transcript ?? "No transcript content"}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {transcripts.length === 0 && !transcript && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
              <Mic className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No dictations yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">Use the recorder above to capture verbal observations and statements. Transcripts are saved and can be linked to incidents.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
