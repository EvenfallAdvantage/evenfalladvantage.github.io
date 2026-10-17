"use client";

import { useState } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { Target, Plus, Loader2, ChevronLeft, CheckCircle2, XCircle, Play, Trash2, PencilLine, Save, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getQuizzes, createQuiz, getUserQuizAttempts, deleteQuiz, getAssessmentQuestions, importQuestionsToQuiz, getTrainingModules, completeModule, getQuizQuestionsForEditing, saveQuizQuestions, type EditableQuizQuestion } from "@/lib/supabase/db";
import { getQuizQuestions, gradeQuiz, type QuizQuestion, type GradeResult } from "@/lib/training/quiz";
import { errorCode, trainingWriteErrorMessage } from "@/lib/training/shared";
import type { TrainingModule } from "@/types";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { toast } from "sonner";

/** Editor row: key is local only (React list key). */
type Question = EditableQuizQuestion & { key: string };
type BankQuestion = { id: string; question_text: string; options: string[]; correct_answer: string; difficulty: string; category: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quiz = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Attempt = any;

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const optionEntries = (q: QuizQuestion) => Object.entries(q.options ?? {}).sort(([a], [b]) => a.localeCompare(b));
const withKeys = (qs: EditableQuizQuestion[]): Question[] => qs.map((q) => ({ ...q, key: crypto.randomUUID() }));

export default function QuizzesPage() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  // Editing needs owner/admin/manager/instructor (training_can_manage on the server).
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");
  const { data: quizzes = [], isLoading: quizLoading, refetch: refetchQuizzes } = useCompanyQuery<Quiz[]>(
    "quizzes", (cid) => getQuizzes(cid)
  );
  const { data: modules = [], isLoading: modLoading } = useCompanyQuery<TrainingModule[]>(
    "training-modules", (cid) => getTrainingModules(cid) as Promise<TrainingModule[]>
  );
  const loading = quizLoading || modLoading;
  const load = async () => { await refetchQuizzes(); };
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPassScore, setNewPassScore] = useState("70");
  const [newModuleId, setNewModuleId] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [taking, setTaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState<string | null>(null);
  // Learner view of the questions (no answers) and the server's grade
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  // Question builder
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savingQs, setSavingQs] = useState(false);
  // Quiz taking: question id -> letter
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  // Import from question bank
  const [showImport, setShowImport] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const [loadingBank, setLoadingBank] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleCreate() {
    if (!newTitle.trim() || !activeCompanyId) return;
    setCreating(true);
    try {
      await createQuiz({ companyId: activeCompanyId, title: newTitle.trim(), description: newDesc.trim() || undefined, passingScore: parseInt(newPassScore) || 70, moduleId: newModuleId || undefined });
      setNewTitle(""); setNewDesc(""); setNewPassScore("70"); setNewModuleId(""); setShowCreate(false); await load();
    } catch (err) { console.error("Create quiz failed:", err); toast.error(trainingWriteErrorMessage("create the drill", errorCode(err as never))); }
    finally { setCreating(false); }
  }

  async function handleDeleteQuiz(quizId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!await confirm({ description: "Delete this drill? Drills that people have already taken can't be deleted.", variant: "destructive", confirmLabel: "Delete" })) return;
    setDeletingQuiz(quizId);
    try { await deleteQuiz(quizId); await load(); }
    catch (err) { console.error(err); toast.error(trainingWriteErrorMessage("delete the drill", errorCode(err as never))); }
    finally { setDeletingQuiz(null); }
  }

  async function loadQuizQuestions(quizId: string) {
    setLoadingQuestions(true); setQuizError(null);
    try { setQuizQuestions(await getQuizQuestions(quizId)); }
    catch (err) { console.error(err); setQuizQuestions([]); setQuizError("Couldn't load this drill's questions."); }
    finally { setLoadingQuestions(false); }
  }

  async function selectQuiz(q: Quiz) {
    setSelected(q);
    setTaking(false);
    setShowResults(false);
    setAnswers({});
    setGrade(null);
    setEditingQuestions(false);
    loadQuizQuestions(q.id);
    try { setAttempts(await getUserQuizAttempts(q.id)); } catch { setAttempts([]); }
  }

  async function startEditing() {
    if (!selected) return;
    try {
      setQuestions(withKeys(await getQuizQuestionsForEditing(selected.id)));
      setEditingQuestions(true);
    } catch (err) { console.error(err); toast.error(trainingWriteErrorMessage("load the questions", errorCode(err as never))); }
  }

  async function openImportPanel() {
    if (!activeCompanyId) return;
    setShowImport(true);
    setLoadingBank(true);
    setSelectedBankIds(new Set());
    try {
      const qs = await getAssessmentQuestions(activeCompanyId);
      setBankQuestions(qs as BankQuestion[]);
    } catch (err) { console.error(err); }
    finally { setLoadingBank(false); }
  }

  function toggleBankQuestion(id: string) {
    setSelectedBankIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (!selected || selectedBankIds.size === 0) return;
    setImporting(true);
    try {
      // Saves any edits first so the import appends to what's on screen.
      await saveQuizQuestions(selected.id, questions);
      await importQuestionsToQuiz(selected.id, [...selectedBankIds]);
      setShowImport(false);
      setQuestions(withKeys(await getQuizQuestionsForEditing(selected.id)));
      await loadQuizQuestions(selected.id);
      await load();
    } catch (err) { console.error(err); toast.error(trainingWriteErrorMessage("import the questions", errorCode(err as never))); }
    finally { setImporting(false); }
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { key: crypto.randomUUID(), question: "", options: ["", "", "", ""], correct: "A" }]);
  }

  function removeQuestion(key: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== key));
  }

  function updateQuestion(key: string, patch: Partial<EditableQuizQuestion>) {
    setQuestions((prev) => prev.map((q) => q.key === key ? { ...q, ...patch } : q));
  }

  function updateOption(key: string, optIdx: number, value: string) {
    setQuestions((prev) => prev.map((q) => q.key === key ? { ...q, options: q.options.map((o, i) => i === optIdx ? value : o) } : q));
  }

  async function saveQuestions() {
    if (!selected) return;
    // Drop empty trailing options; the correct answer must be a filled option.
    const clean = questions.map((q) => {
      const correctIdx = LETTERS.indexOf(q.correct);
      const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      const newIdx = kept.findIndex((x) => x.i === correctIdx);
      return { ...q, options: kept.map((x) => x.o), correct: newIdx >= 0 ? LETTERS[newIdx] : "" };
    });
    const bad = clean.findIndex((q) => !q.question.trim() || q.options.length < 2 || !q.correct);
    if (bad >= 0) { toast.error(`Question ${bad + 1} needs text, at least 2 answers, and a correct answer.`); return; }
    setSavingQs(true);
    try {
      await saveQuizQuestions(selected.id, clean);
      setEditingQuestions(false);
      await loadQuizQuestions(selected.id);
      await load();
    } catch (err) { console.error(err); toast.error(trainingWriteErrorMessage("save the questions", errorCode(err as never))); }
    finally { setSavingQs(false); }
  }

  function startQuiz() {
    setTaking(true);
    setShowResults(false);
    setAnswers({});
    setGrade(null);
  }

  async function handleSubmitQuiz() {
    if (!selected) return;
    setSubmitting(true);
    try {
      // Graded and recorded on the server. A drill with no questions is recorded as acknowledged.
      const outcome = await gradeQuiz(selected.id, answers);
      if (!outcome.ok) {
        toast.error(outcome.message);
        if (outcome.error === "quiz_not_found") { setSelected(null); await load(); }
        return;
      }
      const { result } = outcome;
      if (result.passed && selected.module_id) {
        try { await completeModule(selected.module_id); } catch (err) { console.warn("Auto-complete module failed:", err); }
      }
      if (result.total === 0) setTaking(false);
      else { setGrade(result); setShowResults(true); }
      setAttempts(await getUserQuizAttempts(selected.id));
    } catch (err) { console.error(err); toast.error("Couldn't submit the drill. Please try again."); }
    finally { setSubmitting(false); }
  }

  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a: Attempt) => a.score ?? 0)) : null;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            {selected && (
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs text-primary hover:underline mb-1">
                <ChevronLeft className="h-3 w-3" /> All Drills
              </button>
            )}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
              <Target className="h-5 w-5 sm:h-6 sm:w-6" /> {selected ? selected.title : "DRILLS"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
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
            <div className="flex gap-2 items-center flex-wrap">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Pass score:</label>
              <Input type="number" min="0" max="100" value={newPassScore} onChange={(e) => setNewPassScore(e.target.value)} className="w-20 h-8 text-sm" />
              <span className="text-xs text-muted-foreground">%</span>
              <label className="text-xs text-muted-foreground whitespace-nowrap ml-2">Link to module:</label>
              <select value={newModuleId} onChange={(e) => setNewModuleId(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">None</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
              </select>
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
                  <PencilLine className="h-3.5 w-3.5" /> Edit Questions ({quizQuestions.length})
                </Button>
              )}

              {editingQuestions && (
                <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Questions</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={openImportPanel}>
                        <Download className="h-3 w-3" /> Import from Bank
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={addQuestion}>
                        <Plus className="h-3 w-3" /> Add Question
                      </Button>
                    </div>
                  </div>
                  {showImport && (
                    <div className="space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">Question Bank</p>
                        <span className="text-[10px] text-muted-foreground">{selectedBankIds.size} selected</span>
                      </div>
                      {loadingBank ? (
                        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : bankQuestions.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No questions in the bank yet. Create some in Question Bank admin.</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {bankQuestions.map((bq) => (
                            <label key={bq.id} className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer transition-colors ${
                              selectedBankIds.has(bq.id) ? "border-blue-500/50 bg-blue-500/10" : "border-border/40"
                            }`}>
                              <input type="checkbox" checked={selectedBankIds.has(bq.id)} onChange={() => toggleBankQuestion(bq.id)}
                                className="mt-0.5 rounded" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs leading-tight">{bq.question_text}</p>
                                <div className="flex gap-1 mt-0.5">
                                  <span className="text-[9px] text-muted-foreground">{bq.difficulty}</span>
                                  {bq.category && <span className="text-[9px] text-muted-foreground">· {bq.category}</span>}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-6 text-xs gap-1" onClick={handleImport} disabled={selectedBankIds.size === 0 || importing}>
                          {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          Import {selectedBankIds.size > 0 ? `(${selectedBankIds.size})` : ""}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowImport(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {questions.map((q, qi) => (
                    <div key={q.key} className="space-y-2 rounded-lg border border-border/50 bg-card p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">Q{qi + 1}</span>
                        <Input value={q.question} onChange={(e) => updateQuestion(q.key, { question: e.target.value })} placeholder="Question text..." className="flex-1 h-8 text-sm" />
                        <button onClick={() => removeQuestion(q.key)} className="text-muted-foreground/50 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2 ml-6">
                          <button
                            onClick={() => updateQuestion(q.key, { correct: LETTERS[oi] })}
                            className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                              q.correct === LETTERS[oi] ? "border-green-500 bg-green-500" : "border-border hover:border-green-500/50"
                            }`}
                          >
                            {q.correct === LETTERS[oi] && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </button>
                          <Input value={opt} onChange={(e) => updateOption(q.key, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className="flex-1 h-7 text-xs" />
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
                  {loadingQuestions ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : quizError ? (
                    <p className="text-sm text-red-600">{quizError}</p>
                  ) : quizQuestions.length === 0 ? (
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
                      {quizQuestions.map((q, qi) => (
                        <div key={q.id} className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
                          <p className="text-sm font-semibold"><span className="text-muted-foreground font-mono mr-1">Q{qi + 1}.</span> {q.question_text}</p>
                          <div className="space-y-1.5">
                            {optionEntries(q).map(([letter, opt]) => (
                              <button key={letter} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                                className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                                  answers[q.id] === letter ? "border-primary bg-primary/10 font-medium" : "border-border/50 hover:bg-accent/30"
                                }`}>
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono font-bold">
                                  {letter}
                                </span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button className="gap-1.5" onClick={handleSubmitQuiz}
                          disabled={submitting || Object.keys(answers).length < quizQuestions.length}>
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Submit Answers
                        </Button>
                        <Button variant="ghost" onClick={() => setTaking(false)}>Cancel</Button>
                      </div>
                    </>
                  )}
                </div>
              ) : taking && showResults && grade ? (
                <div className="space-y-3">
                  <div className={`rounded-xl border p-4 ${grade.passed ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                    <p className="text-sm font-semibold">{grade.passed ? "Passed" : "Not passed"}: {grade.score}% ({grade.correct}/{grade.total})</p>
                  </div>
                  {quizQuestions.map((q, qi) => {
                    // Correct answers come back from the server only after grading.
                    const g = grade.questions.find((x) => x.id === q.id);
                    const userAnswer = answers[q.id];
                    const isCorrect = g?.is_correct === true;
                    return (
                      <div key={q.id} className={`rounded-xl border p-4 space-y-1 ${isCorrect ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                        <div className="flex items-center gap-2">
                          {isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                          <p className="text-sm font-semibold">Q{qi + 1}. {q.question_text}</p>
                        </div>
                        <p className="text-xs ml-6">Your answer: <span className={isCorrect ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{(userAnswer && q.options[userAnswer]) ?? "No answer"}</span></p>
                        {!isCorrect && g && <p className="text-xs ml-6 text-green-600">Correct: {q.options[g.correct_answer] ?? g.correct_answer}</p>}
                        {g?.explanation && <p className="text-xs ml-6 text-muted-foreground">{g.explanation}</p>}
                      </div>
                    );
                  })}
                  <Button variant="outline" onClick={() => { setTaking(false); setShowResults(false); setAnswers({}); setGrade(null); }}>Done</Button>
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
                    <p className="text-[10px] text-muted-foreground mt-0.5">Pass: {q.passing_score}%{q.question_count > 0 ? ` · ${q.question_count} Q` : ""}</p>
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
      <ConfirmDialog />
    </>
  );
}
