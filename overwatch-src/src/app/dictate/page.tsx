"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Mic, Loader2, Save, ChevronDown, ChevronUp, User, Clock, Link2, Users, Type as TypeIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { PageShell } from "@/components/layout/page-shell";
import { DictationRecorder } from "@/components/dictation-recorder";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { getIncidents, getForms, createForm, submitForm, getFormSubmissions } from "@/lib/supabase/db";
import { parseInlineTranscript, type SpeakerTurn } from "@/lib/speech/diarize-align";

type Incident = Record<string, unknown> & {
  id: string;
  title: string;
  status: string;
};
type Submission = Record<string, unknown> & {
  id: string;
  data?: {
    transcript?: string;
    /** New: structured speaker turns (present on dictations created with
     * speaker detection enabled). Older rows have only `transcript`. */
    segments?: SpeakerTurn[];
    personType?: string;
    personName?: string;
    linkedIncidentId?: string;
    recordedAt?: string;
    recordedBy?: string;
  };
  created_at: string;
  users?: {
    first_name?: string;
    last_name?: string;
  };
};
type Form = Record<string, unknown> & {
  id: string;
  name: string;
};

const PERSON_TYPES = ["Witness", "Suspect", "Victim", "Reporting Party", "Bystander", "Client", "Employee", "Other"];

export default function DictatePage() {
  const { user, activeCompanyId } = useAuthStore();
  const { confirm, ConfirmDialog } = useConfirmDialog();

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
  /**
   * Structured speaker turns. Populated when the recorder runs
   * diarization successfully. Either co-exists with `transcript` (for
   * round-trip display) or is null (legacy plain-text mode).
   */
  const [speakerTurns, setSpeakerTurns] = useState<SpeakerTurn[] | null>(null);
  /** UI mode for the live transcript editor: bubbles (per-speaker) or
   * plain (single textarea). Defaults to bubbles when segments exist. */
  const [editMode, setEditMode] = useState<"bubbles" | "plain">("plain");
  /** When editing a specific bubble, holds the index of the turn being
   * edited (rest are read-only). null = no bubble in edit mode. */
  const [editingTurnIdx, setEditingTurnIdx] = useState<number | null>(null);

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

  function handleTranscript(text: string, isFinal: boolean, turns?: SpeakerTurn[]) {
    if (isFinal) {
      setTranscript(prev => prev + (prev ? " " : "") + text);
      setInterimText("");
      if (turns && turns.length > 0) {
        // Speaker-aware path — switch the editor to bubble mode so the
        // user sees the speaker labels immediately. Time-offset existing
        // turns by the running transcript length is unnecessary since
        // recorder calls onTranscript once per recording session.
        setSpeakerTurns(turns);
        setEditMode("bubbles");
      }
    } else {
      setInterimText(text);
    }
  }

  /** Switch from bubble view to plain-text editing. The speaker structure
   * is discarded; the user can edit freely as a flat transcript. */
  async function handleFlattenToPlain() {
    if (!speakerTurns) { setEditMode("plain"); return; }
    const ok = await confirm({
      title: "Switch to plain-text editing?",
      description: "Speaker labels (Speaker 1, Speaker 2, etc.) will be preserved inline in the transcript, but the structured speaker view will be cleared. You can still edit the labels manually as [Speaker N] prefixes.",
      confirmLabel: "Switch",
    });
    if (!ok) return;
    setSpeakerTurns(null);
    setEditMode("plain");
    setEditingTurnIdx(null);
  }

  /** Switch from plain-text back to bubble view. Parses the textarea
   * looking for [Speaker N] prefixes. If none found, treats the whole
   * text as one Speaker 1 turn. */
  function handleSwitchToBubbles() {
    const trimmed = transcript.trim();
    if (!trimmed) { setEditMode("bubbles"); return; }
    const parsed = parseInlineTranscript(trimmed);
    setSpeakerTurns(parsed);
    setEditMode("bubbles");
    setEditingTurnIdx(null);
  }

  /** Update one turn's text. Also rewrites the flat `transcript` so the
   * plain-text textarea stays in sync if the user switches modes. */
  function updateTurn(idx: number, patch: Partial<SpeakerTurn>) {
    if (!speakerTurns) return;
    const next = speakerTurns.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    setSpeakerTurns(next);
    setTranscript(next.map(t => `[Speaker ${Number(t.speaker) + 1}] ${t.text}`).join("\n"));
  }

  /** Remove an empty turn — e.g. after the user clears its text. */
  function removeTurn(idx: number) {
    if (!speakerTurns) return;
    const next = speakerTurns.filter((_, i) => i !== idx);
    setSpeakerTurns(next.length > 0 ? next : null);
    setTranscript(next.map(t => `[Speaker ${Number(t.speaker) + 1}] ${t.text}`).join("\n"));
    if (next.length === 0) setEditMode("plain");
  }

  async function handleSave() {
    if (!transcript.trim() || !dictationForm?.id) return;
    setSaving(true);
    try {
      // If the user has been editing in bubble mode, the structured turns
      // are the source of truth. If they switched to plain text, the flat
      // transcript wins and we don't save stale segments.
      const turnsToSave = editMode === "bubbles" && speakerTurns && speakerTurns.length > 0
        ? speakerTurns.filter(t => t.text.trim().length > 0)
        : undefined;
      await submitForm({ formId: dictationForm.id, data: {
        transcript: transcript.trim(),
        ...(turnsToSave ? { segments: turnsToSave } : {}),
        personType, personName: personName.trim() || null,
        linkedIncidentId: linkedIncidentId || null, recordedAt: new Date().toISOString(),
        recordedBy: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
      }});
      setTranscript(""); setInterimText(""); setPersonName(""); setLinkedIncidentId(""); setPersonType("Reporting Party");
      setSpeakerTurns(null); setEditMode("plain"); setEditingTurnIdx(null);
      setTranscripts(await getFormSubmissions(dictationForm.id));
      toast.success("Transcript saved");
    } catch (err) { console.error("Save dictation failed:", err); toast.error("Failed to save transcript"); }
    finally { setSaving(false); }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <PageShell title="REPORTS" subtitle="Voice-to-text report dictation" icon={<Mic className="h-5 w-5" />}>
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">Transcript</label>
                {/* Editor mode switch — only relevant when speaker turns exist */}
                {speakerTurns && speakerTurns.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={editMode === "bubbles" ? handleFlattenToPlain : handleSwitchToBubbles}
                      className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                      title={editMode === "bubbles" ? "Switch to plain-text editing" : "Switch to speaker-bubble view"}
                    >
                      {editMode === "bubbles"
                        ? <><TypeIcon className="h-2.5 w-2.5" /> Edit as plain text</>
                        : <><Users className="h-2.5 w-2.5" /> Edit by speaker</>}
                    </button>
                  </div>
                )}
              </div>

              {editMode === "bubbles" && speakerTurns && speakerTurns.length > 0 ? (
                /* Speaker-bubble view */
                <div className="space-y-2 rounded-md border border-input bg-background/40 p-2 max-h-[400px] overflow-y-auto">
                  {speakerTurns.map((turn, idx) => {
                    const speakerNum = Number(turn.speaker) + 1;
                    const isEditing = editingTurnIdx === idx;
                    return (
                      <SpeakerBubble
                        key={idx}
                        idx={idx}
                        turn={turn}
                        speakerNum={speakerNum}
                        isEditing={isEditing}
                        onStartEdit={() => setEditingTurnIdx(idx)}
                        onStopEdit={() => setEditingTurnIdx(null)}
                        onChange={(text) => updateTurn(idx, { text })}
                        onChangeSpeaker={(newSpeaker) => updateTurn(idx, { speaker: String(newSpeaker - 1) })}
                        onRemove={() => removeTurn(idx)}
                      />
                    );
                  })}
                  <p className="text-[9px] text-muted-foreground/60 px-1 pt-1">
                    Click a bubble to edit its text. Click the speaker label to relabel.
                  </p>
                </div>
              ) : (
                /* Plain-text textarea */
                <>
                  <textarea ref={transcriptRef} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] max-h-[300px] resize-y"
                    placeholder="Transcript will appear here as you speak... You can also type or edit manually."
                    value={transcript + (interimText ? (transcript ? " " : "") + interimText : "")}
                    onChange={e => { setTranscript(e.target.value); setInterimText(""); }} />
                  {interimText && <p className="text-[10px] text-muted-foreground mt-0.5 animate-pulse">Listening...</p>}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={!transcript.trim() || saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Transcript
              </Button>
              {transcript.trim() && (
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => {
                  setTranscript(""); setInterimText("");
                  setSpeakerTurns(null); setEditMode("plain"); setEditingTurnIdx(null);
                }}>Clear</Button>
              )}
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
                          {data.segments && data.segments.length > 0 ? (
                            <SavedTranscriptBubbles segments={data.segments} />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap text-foreground/90">{data.transcript ?? "No transcript content"}</p>
                          )}
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
      <ConfirmDialog />
    </PageShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Speaker bubble components
 * ────────────────────────────────────────────────────────────────────────
 * The same 8 colors used for both live editing and saved-transcript
 * display. The speaker label index (1-based) modulo 8 picks the color.
 */

const SPEAKER_COLORS: Array<{ bg: string; ring: string; text: string }> = [
  { bg: "bg-blue-500/10",    ring: "ring-blue-500/30",    text: "text-blue-400" },
  { bg: "bg-amber-500/10",   ring: "ring-amber-500/30",   text: "text-amber-400" },
  { bg: "bg-emerald-500/10", ring: "ring-emerald-500/30", text: "text-emerald-400" },
  { bg: "bg-fuchsia-500/10", ring: "ring-fuchsia-500/30", text: "text-fuchsia-400" },
  { bg: "bg-cyan-500/10",    ring: "ring-cyan-500/30",    text: "text-cyan-400" },
  { bg: "bg-rose-500/10",    ring: "ring-rose-500/30",    text: "text-rose-400" },
  { bg: "bg-indigo-500/10",  ring: "ring-indigo-500/30",  text: "text-indigo-400" },
  { bg: "bg-teal-500/10",    ring: "ring-teal-500/30",    text: "text-teal-400" },
];

function colorsFor(speakerIdx: number) {
  return SPEAKER_COLORS[Math.abs(speakerIdx) % SPEAKER_COLORS.length];
}

/** A single editable speaker turn in the live-recording view. */
function SpeakerBubble({
  idx, turn, speakerNum, isEditing, onStartEdit, onStopEdit, onChange, onChangeSpeaker, onRemove,
}: {
  idx: number;
  turn: SpeakerTurn;
  speakerNum: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onChange: (text: string) => void;
  onChangeSpeaker: (newSpeaker: number) => void;
  onRemove: () => void;
}) {
  const colors = colorsFor(speakerNum - 1);
  const [speakerInput, setSpeakerInput] = useState(String(speakerNum));
  useEffect(() => { setSpeakerInput(String(speakerNum)); }, [speakerNum]);

  function commitSpeaker() {
    const n = parseInt(speakerInput, 10);
    if (Number.isFinite(n) && n >= 1 && n !== speakerNum) onChangeSpeaker(n);
    else setSpeakerInput(String(speakerNum));
  }

  return (
    <div className={`flex gap-2 items-start rounded-md px-2 py-1.5 ring-1 ${colors.bg} ${colors.ring}`}>
      <input
        type="text"
        inputMode="numeric"
        value={speakerInput}
        onChange={e => setSpeakerInput(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commitSpeaker}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={`w-12 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-transparent px-1 py-0.5 ${colors.text} focus:outline-none focus:ring-1 focus:ring-current text-center`}
        title="Speaker number (relabel by typing a different number)"
        aria-label={`Speaker ${speakerNum}`}
      />
      {isEditing ? (
        <textarea
          autoFocus
          value={turn.text}
          onChange={e => onChange(e.target.value)}
          onBlur={onStopEdit}
          onKeyDown={e => { if (e.key === "Escape") onStopEdit(); }}
          className="flex-1 text-sm bg-transparent resize-none focus:outline-none min-h-[2em]"
          rows={Math.max(1, Math.ceil(turn.text.length / 70))}
          data-bubble-idx={idx}
        />
      ) : (
        <button
          type="button"
          onClick={onStartEdit}
          className="flex-1 text-sm text-left whitespace-pre-wrap hover:bg-background/40 rounded px-1 -mx-1 cursor-text"
          title="Click to edit"
        >
          {turn.text || <span className="text-muted-foreground/50 italic">(empty)</span>}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground/40 hover:text-red-400 text-xs px-1 shrink-0"
        title="Remove this turn"
        aria-label="Remove turn"
      >
        ×
      </button>
    </div>
  );
}

/** Read-only speaker bubbles for the saved-transcripts list. */
function SavedTranscriptBubbles({ segments }: { segments: SpeakerTurn[] }) {
  return (
    <div className="space-y-1.5">
      {segments.map((turn, idx) => {
        const speakerNum = Number(turn.speaker) + 1;
        const colors = colorsFor(speakerNum - 1);
        return (
          <div key={idx} className={`flex gap-2 items-start rounded-md px-2 py-1.5 ring-1 ${colors.bg} ${colors.ring}`}>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${colors.text} shrink-0 mt-0.5`}>
              SPKR&nbsp;{speakerNum}
            </span>
            <p className="flex-1 text-sm whitespace-pre-wrap text-foreground/90">{turn.text}</p>
          </div>
        );
      })}
    </div>
  );
}

