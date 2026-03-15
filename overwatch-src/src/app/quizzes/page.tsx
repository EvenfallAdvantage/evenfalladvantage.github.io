"use client";

import { useEffect, useState, useCallback } from "react";
import { Target, Plus, Loader2, ChevronLeft, CheckCircle2, XCircle, Play, Trash2, PencilLine, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getQuizzes, createQuiz, submitQuizAttempt, getUserQuizAttempts, deleteQuiz, updateQuiz } from "@/lib/supabase/db";

type Question = { id: string; text: string; options: string[]; correctIndex: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quiz = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Attempt = any;

export default function QuizzesPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = ["owner", "admin", "manager"].includes(activeCompany?.role ?? "");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPassScore, setNewPassScore] = useState("70");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [taking, setTaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState<string | null>(null);
  // Question builder
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savingQs, setSavingQs] = useState(false);
  // Quiz taking
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setQuizzes(await getQuizzes(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newTitle.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createQuiz({ companyId: activeCompanyId, title: newTitle.trim(), description: newDesc.trim() || undefined, passingScore: parseInt(newPassScore) || 70 });
      setNewTitle(""); setNewDesc(""); setNewPassScore("70"); setShowCreate(false); await load();
    } catch (err) { console.error("Create quiz failed:", err); }
    finally { setCreating(false); }
  }

  async function handleDeleteQuiz(quizId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this drill and all attempt history?")) return;
    setDeletingQuiz(quizId);
    try { await deleteQuiz(quizId); await load(); }
    catch (err) { console.error(err); }
    finally { setDeletingQuiz(null); }
  }

  async function selectQuiz(q: Quiz) {
    setSelected(q);
    setTaking(false);
    setShowResults(false);
    setAnswers({});
    setEditingQuestions(false);
    try { setAttempts(await getUserQuizAttempts(q.id)); } catch { setAttempts([]); }
  }

  function startEditing() {
    if (!selected) return;
    setQuestions((selected.questions ?? []).map((q: Question, i: number) => ({ ...q, id: q.id || `q${i}` })));
    setEditingQuestions(true);
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { id: crypto.randomUUID(), text: "", options: ["", "", "", ""], correctIndex: 0 }]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function updateQuestion(id: string, field: string, value: string | number) {
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, [field]: value } : q));
  }

  function updateOption(qId: string, optIdx: number, value: string) {
    setQuestions((prev) => prev.map((q) => q.id === qId ? { ...q, options: q.options.map((o, i) => i === optIdx ? value : o) } : q));
  }

  async function saveQuestions() {
    if (!selected) return;
    setSavingQs(true);
    try {
      const updated = await updateQuiz(selected.id, { questions });
      setSelected(updated);
      setEditingQuestions(false);
      await load();
    } catch (err) { console.error(err); }
    finally { setSavingQs(false); }
  }

  function startQuiz() {
    setTaking(true);
    setShowResults(false);
    setAnswers({});
  }

  async function handleSubmitQuiz() {
    if (!selected) return;
    const qs: Question[] = selected.questions ?? [];
    if (qs.length === 0) {
      // No questions - mark complete
      setSubmitting(true);
      try {
        await submitQuizAttempt({ quizId: selected.id, answers: { completed: true }, score: 100, passed: true });
        setTaking(false);
        setAttempts(await getUserQuizAttempts(selected.id));
      } catch (err) { console.error(err); }
      finally { setSubmitting(false); }
      return;
    }
    // Score the quiz
    let correct = 0;
    for (const q of qs) {
      if (answers[q.id] === q.correctIndex) correct++;
    }
    const score = Math.round((correct / qs.length) * 100);
    const passed = score >= (selected.passing_score ?? 70);
    setSubmitting(true);
    try {
      await submitQuizAttempt({ quizId: selected.id, answers, score, passed });
      setShowResults(true);
      setAttempts(await getUserQuizAttempts(selected.id));
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  }

  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a: Attempt) => a.score ?? 0)) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            {selected && (
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs text-primary hover:underline mb-1">
                <ChevronLeft className="h-3 w-3" /> All Drills
              </button>
            )}
            <h1 className="text-2xl font-bold tracking-tight font-mono">
              {selected ? selected.title : "DRILLS"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selected ? (selected.description || "Complete this training drill") : "Training assessments and readiness checks"}
            </p>
          </div>
          {!selected && isAdmin && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New Drill
            </Button>
          )}
        </div>

        {showCreate && !selected && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
            <Input placeholder="Drill title *" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <div className="flex gap-2 items-center">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Pass score:</label>
              <Input type="number" min="0" max="100" value={newPassScore} onChange={(e) => setNewPassScore(e.target.value)} className="w-20 h-8 text-sm" />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {selected ? (
          <div className="space-y-4">
            {/* Drill info */}
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
                  <Target className="h-7 w-7 text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">Pass: {selected.passing_score}%</Badge>
                    {bestScore !== null && (
                      <Badge className={`text-[10px] ${bestScore >= (selected.passing_score ?? 70) ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
                        Best: {bestScore}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {attempts.length} attempt{attempts.length !== 1 ? "s" : ""} recorded
                  </p>
                </div>
              </div>

              {/* Admin: Edit questions */}
              {isAdmin && !taking && !editingQuestions && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
                  <PencilLine className="h-3.5 w-3.5" /> Edit Questions ({(selected.questions ?? []).length})
                </Button>
              )}

              {editingQuestions && (
                <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Questions</p>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={addQuestion}>
                      <Plus className="h-3 w-3" /> Add Question
                    </Button>
                  </div>
                  {questions.map((q, qi) => (
                    <div key={q.id} className="space-y-2 rounded-lg border border-border/50 bg-card p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">Q{qi + 1}</span>
                        <Input value={q.text} onChange={(e) => updateQuestion(q.id, "text", e.target.value)} placeholder="Question text..." className="flex-1 h-8 text-sm" />
                        <button onClick={() => removeQuestion(q.id)} className="text-muted-foreground/50 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2 ml-6">
                          <button
                            onClick={() => updateQuestion(q.id, "correctIndex", oi)}
                            className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                              q.correctIndex === oi ? "border-green-500 bg-green-500" : "border-border hover:border-green-500/50"
                            }`}
                          >
                            {q.correctIndex === oi && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </button>
                          <Input value={opt} onChange={(e) => updateOption(q.id, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className="flex-1 h-7 text-xs" />
                        </div>
                      ))}
                      <p className="ml-6 text-[10px] text-muted-foreground">Click the circle to mark the correct answer</p>
                    </div>
                  ))}
                  {questions.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No questions yet. Add one above.</p>}
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5" onClick={saveQuestions} disabled={savingQs}>
                      {savingQs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Questions
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingQuestions(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Take quiz */}
              {taking && !showResults ? (
                <div className="space-y-4">
                  {(selected.questions ?? []).length === 0 ? (
                    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <p className="text-sm font-medium">Drill in progress...</p>
                      <p className="text-xs text-muted-foreground">Review the material, then mark complete.</p>
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-1.5" onClick={handleSubmitQuiz} disabled={submitting}>
                          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Mark Complete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setTaking(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(selected.questions as Question[]).map((q, qi) => (
                        <div key={q.id} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
                          <p className="text-sm font-semibold"><span className="text-muted-foreground font-mono mr-1">Q{qi + 1}.</span> {q.text}</p>
                          <div className="space-y-1.5">
                            {q.options.map((opt, oi) => (
                              <button key={oi} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                                className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                                  answers[q.id] === oi ? "border-primary bg-primary/10 font-medium" : "border-border/50 hover:bg-accent/30"
                                }`}>
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono font-bold">
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button className="gap-1.5" onClick={handleSubmitQuiz}
                          disabled={submitting || Object.keys(answers).length < (selected.questions as Question[]).length}>
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Submit Answers
                        </Button>
                        <Button variant="ghost" onClick={() => setTaking(false)}>Cancel</Button>
                      </div>
                    </>
                  )}
                </div>
              ) : taking && showResults ? (
                <div className="space-y-3">
                  {(selected.questions as Question[]).map((q, qi) => {
                    const userAnswer = answers[q.id];
                    const isCorrect = userAnswer === q.correctIndex;
                    return (
                      <div key={q.id} className={`rounded-xl border p-4 space-y-1 ${isCorrect ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                        <div className="flex items-center gap-2">
                          {isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                          <p className="text-sm font-semibold">Q{qi + 1}. {q.text}</p>
                        </div>
                        <p className="text-xs ml-6">Your answer: <span className={isCorrect ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{q.options[userAnswer] ?? "No answer"}</span></p>
                        {!isCorrect && <p className="text-xs ml-6 text-green-600">Correct: {q.options[q.correctIndex]}</p>}
                      </div>
                    );
                  })}
                  <Button variant="outline" onClick={() => { setTaking(false); setShowResults(false); setAnswers({}); }}>Done</Button>
                </div>
              ) : !editingQuestions ? (
                <Button className="gap-2" onClick={startQuiz}>
                  <Play className="h-4 w-4" /> Start Drill
                </Button>
              ) : null}
            </div>

            {/* Previous attempts */}
            {attempts.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Attempt History</h3>
                <div className="space-y-2">
                  {attempts.map((a: Attempt) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-4 py-3">
                      {a.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                      <div className="flex-1">
                        <span className="text-sm font-mono font-semibold">{a.score}%</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(a.completed_at ?? a.started_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Badge className={`text-[10px] ${a.passed ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
                        {a.passed ? "Passed" : "Failed"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Target className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No drills configured</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {isAdmin ? "Create your first drill to assess team readiness." : "Your organization hasn't set up any drills yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q: Quiz) => (
              <div key={q.id} onClick={() => selectQuiz(q)}
                className="rounded-xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:border-amber-500/30 hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                    <Target className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{q.title}</p>
                    {q.description && <p className="text-xs text-muted-foreground truncate">{q.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">Pass: {q.passing_score}%</p>
                  </div>
                  {isAdmin && (
                    <button onClick={(e) => handleDeleteQuiz(q.id, e)} disabled={deletingQuiz === q.id}
                      className="rounded-md p-1 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-500 z-10" title="Delete drill">
                      {deletingQuiz === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
