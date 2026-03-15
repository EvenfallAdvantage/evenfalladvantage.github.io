"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HelpCircle, Plus, Trash2, Loader2, Pencil, Save,
  Filter, BookOpen, CheckCircle2, Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import {
  getAssessmentQuestions, createAssessmentQuestion,
  updateAssessmentQuestion, deleteAssessmentQuestion,
  getQuestionCategories, getTrainingModules,
} from "@/lib/supabase/db";
import type { AssessmentQuestion, TrainingModule } from "@/types";

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;
const TYPE_OPTIONS = ["multiple_choice", "true_false", "short_answer"] as const;

const DIFF_COLORS: Record<string, string> = {
  easy: "bg-green-500/15 text-green-600",
  medium: "bg-amber-500/15 text-amber-600",
  hard: "bg-red-500/15 text-red-600",
};

export default function QuestionBankPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterModule, setFilterModule] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");

  // New question form
  const [showNew, setShowNew] = useState(false);
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState<string>("multiple_choice");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newCorrect, setNewCorrect] = useState("");
  const [newExplanation, setNewExplanation] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("medium");
  const [newCategory, setNewCategory] = useState("");
  const [newModuleId, setNewModuleId] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrect, setEditCorrect] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editModuleId, setEditModuleId] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const [qs, mods, cats] = await Promise.all([
        getAssessmentQuestions(activeCompanyId, {
          moduleId: filterModule || undefined,
          category: filterCategory || undefined,
          difficulty: filterDifficulty || undefined,
        }),
        getTrainingModules(activeCompanyId),
        getQuestionCategories(activeCompanyId),
      ]);
      setQuestions(qs as AssessmentQuestion[]);
      setModules(mods as TrainingModule[]);
      setCategories(cats);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeCompanyId, filterModule, filterCategory, filterDifficulty]);

  useEffect(() => { load(); }, [load]);

  function resetNewForm() {
    setNewText(""); setNewType("multiple_choice"); setNewOptions(["", "", "", ""]);
    setNewCorrect(""); setNewExplanation(""); setNewDifficulty("medium");
    setNewCategory(""); setNewModuleId(""); setShowNew(false);
  }

  async function handleCreate() {
    if (!activeCompanyId || !newText.trim() || !newCorrect.trim()) return;
    setSaving(true);
    try {
      const opts = newType === "true_false" ? ["True", "False"]
        : newType === "multiple_choice" ? newOptions.filter((o) => o.trim())
        : [];
      await createAssessmentQuestion(activeCompanyId, {
        questionText: newText.trim(),
        questionType: newType,
        options: opts,
        correctAnswer: newCorrect.trim(),
        explanation: newExplanation.trim() || undefined,
        difficulty: newDifficulty,
        category: newCategory.trim() || undefined,
        moduleId: newModuleId || undefined,
      });
      resetNewForm();
      await load();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  function startEdit(q: AssessmentQuestion) {
    setEditingId(q.id);
    setEditText(q.question_text);
    setEditOptions([...(q.options || [])]);
    setEditCorrect(q.correct_answer);
    setEditExplanation(q.explanation ?? "");
    setEditDifficulty(q.difficulty);
    setEditCategory(q.category ?? "");
    setEditModuleId(q.module_id ?? "");
  }

  async function handleUpdate() {
    if (!editingId || !editText.trim()) return;
    setEditSaving(true);
    try {
      await updateAssessmentQuestion(editingId, {
        question_text: editText.trim(),
        options: editOptions.filter((o) => o.trim()),
        correct_answer: editCorrect.trim(),
        explanation: editExplanation.trim() || null,
        difficulty: editDifficulty,
        category: editCategory.trim() || null,
        module_id: editModuleId || null,
      });
      setEditingId(null);
      await load();
    } catch (err) { console.error(err); }
    finally { setEditSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this question?")) return;
    try { await deleteAssessmentQuestion(id); await load(); }
    catch (err) { console.error(err); }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><HelpCircle className="h-6 w-6" /> QUESTION BANK</h1>
            <p className="text-sm text-muted-foreground">
              Reusable assessment questions — import into any drill
            </p>
          </div>
          <Button onClick={() => setShowNew(true)} className="gap-1.5" disabled={showNew}>
            <Plus className="h-4 w-4" /> New Question
          </Button>
        </div>

        {/* Filters */}
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
            {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
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
          <span className="ml-auto text-xs text-muted-foreground font-mono">{questions.length} questions</span>
        </div>

        {/* New question form */}
        {showNew && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Create Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Question Text *</label>
                <textarea value={newText} onChange={(e) => setNewText(e.target.value)}
                  placeholder="Enter the question..."
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select value={newType} onChange={(e) => {
                    setNewType(e.target.value);
                    if (e.target.value === "true_false") { setNewOptions(["True", "False"]); setNewCorrect("True"); }
                    else if (e.target.value === "short_answer") { setNewOptions([]); }
                    else { setNewOptions(["", "", "", ""]); }
                  }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Difficulty</label>
                  <select value={newDifficulty} onChange={(e) => setNewDifficulty(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Module (optional)</label>
                  <select value={newModuleId} onChange={(e) => setNewModuleId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="">None</option>
                    {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
                  </select>
                </div>
              </div>

              {newType === "multiple_choice" && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Options</label>
                  {newOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        onClick={() => setNewCorrect(opt)}
                        className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                          newCorrect === opt && opt.trim() ? "border-green-500 bg-green-500" : "border-border hover:border-green-500/50"
                        }`}
                      >
                        {newCorrect === opt && opt.trim() && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </button>
                      <Input value={opt} onChange={(e) => {
                        const updated = [...newOptions];
                        updated[i] = e.target.value;
                        setNewOptions(updated);
                      }} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="h-8 text-sm" />
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground ml-7">Click the circle to mark the correct answer</p>
                </div>
              )}

              {newType === "true_false" && (
                <div className="flex gap-3">
                  {["True", "False"].map((v) => (
                    <button key={v} onClick={() => setNewCorrect(v)}
                      className={`flex-1 rounded-lg border px-4 py-2 text-sm transition-colors ${
                        newCorrect === v ? "border-green-500 bg-green-500/10 text-green-600 font-semibold" : "border-border"
                      }`}>{v}</button>
                  ))}
                </div>
              )}

              {newType === "short_answer" && (
                <div>
                  <label className="text-xs text-muted-foreground">Correct Answer *</label>
                  <Input value={newCorrect} onChange={(e) => setNewCorrect(e.target.value)} placeholder="Expected answer" />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Category (optional)</label>
                  <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Use of Force, Radio Comms" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Explanation (shown after answering)</label>
                  <Input value={newExplanation} onChange={(e) => setNewExplanation(e.target.value)} placeholder="Why this is the correct answer..." />
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={!newText.trim() || !newCorrect.trim() || saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ml-1">Create</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={resetNewForm}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Question list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
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
                  {editingId === q.id ? (
                    <div className="space-y-2">
                      <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[50px]" />
                      <div className="space-y-1">
                        {editOptions.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <button onClick={() => setEditCorrect(opt)}
                              className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                                editCorrect === opt ? "border-green-500 bg-green-500" : "border-border"
                              }`}>
                              {editCorrect === opt && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                            </button>
                            <Input value={opt} onChange={(e) => {
                              const u = [...editOptions]; u[i] = e.target.value; setEditOptions(u);
                            }} className="h-7 text-xs" />
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)} placeholder="Explanation" className="h-7 text-xs" />
                        <select value={editDifficulty} onChange={(e) => setEditDifficulty(e.target.value)} className="h-7 rounded border text-xs px-2">
                          {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select value={editModuleId} onChange={(e) => setEditModuleId(e.target.value)} className="h-7 rounded border text-xs px-2">
                          <option value="">No module</option>
                          {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-6 text-xs" onClick={handleUpdate} disabled={editSaving}>
                          {editSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
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
                          {q.category && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Tag className="h-2.5 w-2.5" /> {q.category}
                            </span>
                          )}
                          {q.training_module && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <BookOpen className="h-2.5 w-2.5" /> {q.training_module.module_name}
                            </span>
                          )}
                        </div>
                        {q.explanation && (
                          <p className="mt-1 text-[10px] text-muted-foreground italic">💡 {q.explanation}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(q)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => handleDelete(q.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
