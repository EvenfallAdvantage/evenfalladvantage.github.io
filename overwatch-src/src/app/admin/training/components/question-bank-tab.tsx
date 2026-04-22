"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Trash2, Pencil, Save, HelpCircle, Filter, BookOpen,
  CheckCircle2, Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getAssessmentQuestions, createAssessmentQuestion, updateAssessmentQuestion, deleteAssessmentQuestion,
  getQuestionCategories,
} from "@/lib/supabase/db";
import type { TrainingModule, AssessmentQuestion } from "@/types";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

const Q_DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;
const Q_TYPE_OPTIONS = ["multiple_choice", "true_false", "short_answer"] as const;
const DIFF_COLORS: Record<string, string> = {
  easy: "bg-green-500/15 text-green-600",
  medium: "bg-amber-500/15 text-amber-600",
  hard: "bg-red-500/15 text-red-600",
};

interface QuestionBankTabProps {
  activeCompanyId: string | null;
  modules: TrainingModule[];
  showNewQ: boolean;
  setShowNewQ: (v: boolean) => void;
}

export function QuestionBankTab({ activeCompanyId, modules, showNewQ, setShowNewQ }: QuestionBankTabProps) {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [filterModule, setFilterModule] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [newQText, setNewQText] = useState("");
  const [newQType, setNewQType] = useState<string>("multiple_choice");
  const [newQOptions, setNewQOptions] = useState(["", "", "", ""]);
  const [newQCorrect, setNewQCorrect] = useState("");
  const [newQExplanation, setNewQExplanation] = useState("");
  const [newQDifficulty, setNewQDifficulty] = useState("medium");
  const [newQCategory, setNewQCategory] = useState("");
  const [newQModuleId, setNewQModuleId] = useState("");
  const [qSaving, setQSaving] = useState(false);
  const [editQId, setEditQId] = useState<string | null>(null);
  const [editQText, setEditQText] = useState("");
  const [editQOptions, setEditQOptions] = useState<string[]>([]);
  const [editQCorrect, setEditQCorrect] = useState("");
  const [editQExplanation, setEditQExplanation] = useState("");
  const [editQDifficulty, setEditQDifficulty] = useState("");
  const [editQCategory, setEditQCategory] = useState("");
  const [editQModuleId, setEditQModuleId] = useState("");
  const [editQSaving, setEditQSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const loadQuestions = useCallback(async () => {
    if (!activeCompanyId) return;
    setQLoading(true);
    try {
      const [qs, cats] = await Promise.all([
        getAssessmentQuestions(activeCompanyId, {
          moduleId: filterModule || undefined,
          category: filterCategory || undefined,
          difficulty: filterDifficulty || undefined,
        }),
        getQuestionCategories(activeCompanyId),
      ]);
      setQuestions(qs as AssessmentQuestion[]);
      setCategories(cats as string[]);
    } catch (err) { console.error(err); }
    finally { setQLoading(false); }
  }, [activeCompanyId, filterModule, filterCategory, filterDifficulty]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  function resetNewQ() {
    setNewQText(""); setNewQType("multiple_choice"); setNewQOptions(["", "", "", ""]);
    setNewQCorrect(""); setNewQExplanation(""); setNewQDifficulty("medium");
    setNewQCategory(""); setNewQModuleId(""); setShowNewQ(false);
  }

  async function handleCreateQ() {
    if (!activeCompanyId || !newQText.trim() || !newQCorrect.trim()) return;
    setQSaving(true);
    try {
      const opts = newQType === "true_false" ? ["True", "False"]
        : newQType === "multiple_choice" ? newQOptions.filter((o) => o.trim()) : [];
      await createAssessmentQuestion(activeCompanyId, {
        questionText: newQText.trim(), questionType: newQType, options: opts,
        correctAnswer: newQCorrect.trim(), explanation: newQExplanation.trim() || undefined,
        difficulty: newQDifficulty, category: newQCategory.trim() || undefined,
        moduleId: newQModuleId || undefined,
      });
      resetNewQ();
      await loadQuestions();
    } catch (err) { console.error(err); }
    finally { setQSaving(false); }
  }

  function startEditQ(q: AssessmentQuestion) {
    setEditQId(q.id); setEditQText(q.question_text); setEditQOptions([...(q.options || [])]);
    setEditQCorrect(q.correct_answer); setEditQExplanation(q.explanation ?? "");
    setEditQDifficulty(q.difficulty); setEditQCategory(q.category ?? ""); setEditQModuleId(q.module_id ?? "");
  }

  async function handleUpdateQ() {
    if (!editQId || !editQText.trim()) return;
    setEditQSaving(true);
    try {
      await updateAssessmentQuestion(editQId, {
        question_text: editQText.trim(), options: editQOptions.filter((o) => o.trim()),
        correct_answer: editQCorrect.trim(), explanation: editQExplanation.trim() || null,
        difficulty: editQDifficulty, category: editQCategory.trim() || null, module_id: editQModuleId || null,
      });
      setEditQId(null);
      await loadQuestions();
    } catch (err) { console.error(err); }
    finally { setEditQSaving(false); }
  }

  async function handleDeleteQ(id: string) {
    if (!await confirm({ description: "Delete this question?", variant: "destructive" })) return;
    try { await deleteAssessmentQuestion(id); await loadQuestions(); }
    catch (err) { console.error(err); }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
          <option value="">All Modules</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
        </select>
        <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
          <option value="">All Difficulties</option>
          {Q_DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterModule || filterDifficulty || filterCategory) && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
            setFilterModule(""); setFilterDifficulty(""); setFilterCategory("");
          }}>Clear</Button>
        )}
        <span className="text-xs text-muted-foreground font-mono">{questions.length} questions</span>
      </div>

      {/* New question form */}
      {showNewQ && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Create Question</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="qbank-question-text" className="text-xs text-muted-foreground">Question Text *</label>
              <textarea id="qbank-question-text" value={newQText} onChange={(e) => setNewQText(e.target.value)} placeholder="Enter the question..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="qbank-question-type" className="text-xs text-muted-foreground">Type</label>
                <select id="qbank-question-type" value={newQType} onChange={(e) => {
                  setNewQType(e.target.value);
                  if (e.target.value === "true_false") { setNewQOptions(["True", "False"]); setNewQCorrect("True"); }
                  else if (e.target.value === "short_answer") { setNewQOptions([]); }
                  else { setNewQOptions(["", "", "", ""]); }
                }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  {Q_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="qbank-difficulty" className="text-xs text-muted-foreground">Difficulty</label>
                <select id="qbank-difficulty" value={newQDifficulty} onChange={(e) => setNewQDifficulty(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  {Q_DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="qbank-module" className="text-xs text-muted-foreground">Module (optional)</label>
                <select id="qbank-module" value={newQModuleId} onChange={(e) => setNewQModuleId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">None</option>
                  {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
                </select>
              </div>
            </div>
            {newQType === "multiple_choice" && (
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Options</span>
                {newQOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button onClick={() => setNewQCorrect(opt)}
                      className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                        newQCorrect === opt && opt.trim() ? "border-green-500 bg-green-500" : "border-border hover:border-green-500/50"
                      }`}>
                      {newQCorrect === opt && opt.trim() && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </button>
                    <Input value={opt} onChange={(e) => {
                      const u = [...newQOptions]; u[i] = e.target.value; setNewQOptions(u);
                    }} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="h-8 text-sm" />
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground ml-7">Click the circle to mark the correct answer</p>
              </div>
            )}
            {newQType === "true_false" && (
              <div className="flex gap-3">
                {["True", "False"].map((v) => (
                  <button key={v} onClick={() => setNewQCorrect(v)}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm transition-colors ${
                      newQCorrect === v ? "border-green-500 bg-green-500/10 text-green-600 font-semibold" : "border-border"
                    }`}>{v}</button>
                ))}
              </div>
            )}
            {newQType === "short_answer" && (
              <div>
                <label htmlFor="qbank-correct-answer" className="text-xs text-muted-foreground">Correct Answer *</label>
                <Input id="qbank-correct-answer" value={newQCorrect} onChange={(e) => setNewQCorrect(e.target.value)} placeholder="Expected answer" />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="qbank-category" className="text-xs text-muted-foreground">Category (optional)</label>
                <Input id="qbank-category" value={newQCategory} onChange={(e) => setNewQCategory(e.target.value)} placeholder="e.g. Use of Force, Radio Comms" />
              </div>
              <div>
                <label htmlFor="qbank-explanation" className="text-xs text-muted-foreground">Explanation (shown after answering)</label>
                <Input id="qbank-explanation" value={newQExplanation} onChange={(e) => setNewQExplanation(e.target.value)} placeholder="Why this is the correct answer..." />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateQ} disabled={!newQText.trim() || !newQCorrect.trim() || qSaving}>
                {qSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="ml-1">Create</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={resetNewQ}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question list */}
      {qLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : questions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <HelpCircle className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No questions yet. Create your first one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <Card key={q.id} className="border-border/40">
              <CardContent className="p-3">
                {editQId === q.id ? (
                  <div className="space-y-2">
                    <textarea value={editQText} onChange={(e) => setEditQText(e.target.value)}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[50px]" />
                    <div className="space-y-1">
                      {editQOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <button onClick={() => setEditQCorrect(opt)}
                            className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                              editQCorrect === opt ? "border-green-500 bg-green-500" : "border-border"
                            }`}>
                            {editQCorrect === opt && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                          </button>
                          <Input value={opt} onChange={(e) => {
                            const u = [...editQOptions]; u[i] = e.target.value; setEditQOptions(u);
                          }} className="h-7 text-xs" />
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input value={editQExplanation} onChange={(e) => setEditQExplanation(e.target.value)} placeholder="Explanation" className="h-7 text-xs" />
                      <select value={editQDifficulty} onChange={(e) => setEditQDifficulty(e.target.value)} className="h-7 rounded border text-xs px-2">
                        {Q_DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <select value={editQModuleId} onChange={(e) => setEditQModuleId(e.target.value)} className="h-7 rounded border text-xs px-2">
                        <option value="">No module</option>
                        {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-6 text-xs" onClick={handleUpdateQ} disabled={editQSaving}>
                        {editQSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditQId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{q.question_text}</p>
                      {q.options && q.options.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {q.options.map((opt: string, i: number) => (
                            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${
                              opt === q.correct_answer ? "bg-green-500/15 text-green-600 font-semibold" : "bg-muted text-muted-foreground"
                            }`}>{opt}</span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge className={`text-[9px] ${DIFF_COLORS[q.difficulty] ?? ""}`}>{q.difficulty}</Badge>
                        <Badge variant="secondary" className="text-[9px]">{q.question_type.replace("_", " ")}</Badge>
                        {q.category && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Tag className="h-2.5 w-2.5" /> {q.category}</span>}
                        {q.training_module && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><BookOpen className="h-2.5 w-2.5" /> {q.training_module.module_name}</span>}
                      </div>
                      {q.explanation && <p className="mt-1 text-[10px] text-muted-foreground italic">&#x1F4A1; {q.explanation}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditQ(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => handleDeleteQ(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog />
    </>
  );
}
