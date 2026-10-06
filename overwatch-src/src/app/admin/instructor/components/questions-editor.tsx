"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getLegacyAssessmentQuestions, saveLegacyAssessmentQuestions, validateLegacyQuestions,
  type LegacyQuestion,
} from "@/lib/legacy-bridge";
import { legacyWriteErrorMessage } from "@/lib/legacy/bridge";

const LETTERS = ["A", "B", "C", "D"];
const blankQuestion = (): LegacyQuestion => ({ question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" });

interface QuestionsEditorProps {
  assessmentId: string;
  assessmentName: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Multiple-choice question editor for a legacy (EADB) assessment: question
 * text, 4 answers, the correct one, optional explanation. Saving replaces the
 * whole list (the bridge writes assessment_questions + questions_json).
 */
export function QuestionsEditor({ assessmentId, assessmentName, onClose, onSaved }: QuestionsEditorProps) {
  const [questions, setQuestions] = useState<LegacyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const r = await getLegacyAssessmentQuestions(assessmentId);
      if (cancelled) return;
      if (!r.success) alert(legacyWriteErrorMessage("load the questions", r.error));
      setQuestions(r.questions.length ? r.questions.map((q) => ({ ...q, explanation: q.explanation ?? "" })) : [blankQuestion()]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [assessmentId]);

  const update = (i: number, patch: Partial<LegacyQuestion>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setOption = (i: number, k: number, value: string) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, options: q.options.map((o, m) => (m === k ? value : o)) as LegacyQuestion["options"] } : q)));
  const move = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const j = i + d;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function handleSave() {
    const found = validateLegacyQuestions(questions);
    setProblems(found);
    if (found.length) return;
    setSaving(true);
    try {
      const r = await saveLegacyAssessmentQuestions(assessmentId, questions);
      if (!r.success) { alert(legacyWriteErrorMessage("save the questions", r.error)); return; }
      onSaved();
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-3 border-t border-border/40 pt-3" data-testid="questions-editor">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold uppercase text-muted-foreground">Questions for {assessmentName} ({questions.length})</h5>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="h-3.5 w-3.5" /> Close</Button>
      </div>
      {questions.map((q, i) => (
        <div key={i} className="space-y-2 rounded border border-border/40 p-3">
          <div className="flex items-center gap-2">
            <span className="w-6 font-mono text-xs text-muted-foreground">{i + 1}.</span>
            <Input aria-label={`Question ${i + 1}`} placeholder="Question *" value={q.question} onChange={(e) => update(i, { question: e.target.value })} className="h-8 text-sm" />
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 hover:bg-accent/50 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="rounded p-1 hover:bg-accent/50 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} className="rounded p-1 hover:bg-red-500/10" aria-label={`Remove question ${i + 1}`}><Trash2 className="h-3.5 w-3.5 text-red-500/80" /></button>
          </div>
          <div className="grid gap-1.5 pl-8 sm:grid-cols-2">
            {q.options.map((opt, k) => (
              <label key={k} className="flex items-center gap-2 text-xs">
                <input type="radio" name={`correct-${assessmentId}-${i}`} checked={q.correctAnswer === k} onChange={() => update(i, { correctAnswer: k })} aria-label={`Answer ${LETTERS[k]} is correct`} />
                <span className="w-3 font-semibold">{LETTERS[k]}</span>
                <Input aria-label={`Question ${i + 1} answer ${LETTERS[k]}`} placeholder={`Answer ${LETTERS[k]} *`} value={opt} onChange={(e) => setOption(i, k, e.target.value)} className="h-8 text-sm" />
              </label>
            ))}
          </div>
          <div className="pl-8">
            <Input placeholder="Explanation (optional, shown after answering)" value={q.explanation ?? ""} onChange={(e) => update(i, { explanation: e.target.value })} className="h-8 text-xs" />
          </div>
        </div>
      ))}
      {problems.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-red-500" role="alert">{problems.slice(0, 6).map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      <p className="text-[10px] text-muted-foreground">Pick the correct answer with the circle next to it. Saving replaces this assessment&apos;s questions for students.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}><Plus className="h-3.5 w-3.5" /> Add Question</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Questions</Button>
      </div>
    </div>
  );
}
