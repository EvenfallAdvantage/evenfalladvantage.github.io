"use client";

import { useEffect, useState, useCallback } from "react";
import {
  GraduationCap, Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  FileText, Pencil, Save, X, ArrowUp, ArrowDown, Clock,
  HelpCircle, Filter, BookOpen, CheckCircle2, Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import {
  getTrainingModules, createTrainingModule, updateTrainingModule, deleteTrainingModule,
  getModuleSlides, createModuleSlide, updateModuleSlide, deleteModuleSlide, reorderModuleSlides,
  getAssessmentQuestions, createAssessmentQuestion, updateAssessmentQuestion, deleteAssessmentQuestion,
  getQuestionCategories,
} from "@/lib/supabase/db";
import type { TrainingModule, ModuleSlide, AssessmentQuestion } from "@/types";

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Critical", "Essential"];
const Q_DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;
const Q_TYPE_OPTIONS = ["multiple_choice", "true_false", "short_answer"] as const;
const DIFF_COLORS: Record<string, string> = {
  easy: "bg-green-500/15 text-green-600",
  medium: "bg-amber-500/15 text-amber-600",
  hard: "bg-red-500/15 text-red-600",
};

export default function AdminTrainingPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [tab, setTab] = useState<"modules" | "questions">("modules");

  // ── Modules state ──
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [slides, setSlides] = useState<ModuleSlide[]>([]);
  const [loadingSlides, setLoadingSlides] = useState(false);

  // ── Question Bank state ──
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [filterModule, setFilterModule] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [showNewQ, setShowNewQ] = useState(false);
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

  // New module form
  const [showNewModule, setShowNewModule] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDuration, setNewDuration] = useState("60");
  const [newDifficulty, setNewDifficulty] = useState("Intermediate");
  const [newRequired, setNewRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit module
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("");

  // New slide form
  const [showNewSlide, setShowNewSlide] = useState(false);
  const [newSlideTitle, setNewSlideTitle] = useState("");
  const [newSlideContent, setNewSlideContent] = useState("");
  const [newSlideImage, setNewSlideImage] = useState("");
  const [savingSlide, setSavingSlide] = useState(false);

  // Edit slide
  const [editingSlide, setEditingSlide] = useState<string | null>(null);
  const [editSlideTitle, setEditSlideTitle] = useState("");
  const [editSlideContent, setEditSlideContent] = useState("");
  const [editSlideImage, setEditSlideImage] = useState("");

  const loadModules = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const data = await getTrainingModules(activeCompanyId);
      setModules(data as TrainingModule[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadModules(); }, [loadModules]);

  async function loadSlides(moduleId: string) {
    setLoadingSlides(true);
    try {
      const data = await getModuleSlides(moduleId);
      setSlides(data as ModuleSlide[]);
    } catch (err) { console.error(err); }
    finally { setLoadingSlides(false); }
  }

  function toggleExpand(moduleId: string) {
    if (expandedModule === moduleId) {
      setExpandedModule(null);
      setSlides([]);
    } else {
      setExpandedModule(moduleId);
      loadSlides(moduleId);
    }
    setEditingModule(null);
    setEditingSlide(null);
    setShowNewSlide(false);
  }

  async function handleCreateModule() {
    if (!activeCompanyId || !newCode.trim() || !newName.trim()) return;
    setSaving(true);
    try {
      await createTrainingModule(activeCompanyId, {
        moduleCode: newCode.trim(),
        moduleName: newName.trim(),
        description: newDesc.trim() || undefined,
        durationMinutes: parseInt(newDuration) || 60,
        difficultyLevel: newDifficulty,
        isRequired: newRequired,
        displayOrder: modules.length,
      });
      setNewCode(""); setNewName(""); setNewDesc(""); setNewDuration("60");
      setNewDifficulty("Intermediate"); setNewRequired(false); setShowNewModule(false);
      await loadModules();
    } catch (err) { console.error(err); alert("Failed to create module. Code may already exist."); }
    finally { setSaving(false); }
  }

  async function handleUpdateModule(moduleId: string) {
    setSaving(true);
    try {
      await updateTrainingModule(moduleId, {
        module_name: editName,
        description: editDesc || null,
        duration_minutes: parseInt(editDuration) || 60,
        difficulty_level: editDifficulty,
      });
      setEditingModule(null);
      await loadModules();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleDeleteModule(moduleId: string) {
    if (!confirm("Delete this module and ALL its slides? This cannot be undone.")) return;
    try {
      await deleteTrainingModule(moduleId);
      if (expandedModule === moduleId) { setExpandedModule(null); setSlides([]); }
      await loadModules();
    } catch (err) { console.error(err); }
  }

  async function handleCreateSlide() {
    if (!expandedModule || !newSlideTitle.trim()) return;
    setSavingSlide(true);
    try {
      await createModuleSlide(expandedModule, {
        title: newSlideTitle.trim(),
        contentHtml: newSlideContent,
        imageUrl: newSlideImage.trim() || undefined,
        sortOrder: slides.length,
      });
      setNewSlideTitle(""); setNewSlideContent(""); setNewSlideImage(""); setShowNewSlide(false);
      await loadSlides(expandedModule);
      await loadModules();
    } catch (err) { console.error(err); }
    finally { setSavingSlide(false); }
  }

  async function handleUpdateSlide(slideId: string) {
    setSavingSlide(true);
    try {
      await updateModuleSlide(slideId, {
        title: editSlideTitle,
        content_html: editSlideContent,
        image_url: editSlideImage || null,
      });
      setEditingSlide(null);
      if (expandedModule) await loadSlides(expandedModule);
    } catch (err) { console.error(err); }
    finally { setSavingSlide(false); }
  }

  async function handleDeleteSlide(slideId: string) {
    if (!confirm("Delete this slide?")) return;
    try {
      await deleteModuleSlide(slideId);
      if (expandedModule) await loadSlides(expandedModule);
      await loadModules();
    } catch (err) { console.error(err); }
  }

  async function handleMoveSlide(slideId: string, direction: "up" | "down") {
    const idx = slides.findIndex((s) => s.id === slideId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= slides.length) return;
    const reordered = slides.map((s, i) => ({
      id: s.id,
      sortOrder: i === idx ? swapIdx : i === swapIdx ? idx : i,
    }));
    try {
      await reorderModuleSlides(reordered);
      if (expandedModule) await loadSlides(expandedModule);
    } catch (err) { console.error(err); }
  }

  function startEditModule(mod: TrainingModule) {
    setEditingModule(mod.id);
    setEditName(mod.module_name);
    setEditDesc(mod.description ?? "");
    setEditDuration(String(mod.duration_minutes));
    setEditDifficulty(mod.difficulty_level);
  }

  function startEditSlide(slide: ModuleSlide) {
    setEditingSlide(slide.id);
    setEditSlideTitle(slide.title);
    setEditSlideContent(slide.content_html);
    setEditSlideImage(slide.image_url ?? "");
  }

  // ── Question Bank functions ──
  const loadQuestions = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
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
      setCategories(cats);
    } catch (err) { console.error(err); }
    finally { setQLoading(false); }
  }, [activeCompanyId, filterModule, filterCategory, filterDifficulty]);

  useEffect(() => { if (tab === "questions") loadQuestions(); }, [tab, loadQuestions]);

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
    if (!confirm("Delete this question?")) return;
    try { await deleteAssessmentQuestion(id); await loadQuestions(); }
    catch (err) { console.error(err); }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header + Tabs */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" /> TRAINING ADMIN</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4">Manage training modules, slides, and assessment questions</p>
          <div className="flex items-center gap-1 border-b border-border/40">
            <button onClick={() => setTab("modules")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "modules" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <GraduationCap className="h-3.5 w-3.5 inline mr-1.5" />Modules
            </button>
            <button onClick={() => setTab("questions")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "questions" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <HelpCircle className="h-3.5 w-3.5 inline mr-1.5" />Question Bank
            </button>
          </div>
        </div>

        {/* ═══ MODULES TAB ═══ */}
        {tab === "modules" && <>
        <div className="flex justify-end">
          <Button onClick={() => setShowNewModule(true)} className="gap-1.5" disabled={showNewModule}>
            <Plus className="h-4 w-4" /> New Module
          </Button>
        </div>

        {/* New module form */}
        {showNewModule && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Create Training Module</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Module Code *</label>
                  <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. radio-comms" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Module Name *</label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Radio Communications" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief description of the module" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-muted-foreground">Duration (min)</label>
                  <Input type="number" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Difficulty</label>
                  <select value={newDifficulty} onChange={(e) => setNewDifficulty(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
                    Required
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateModule} disabled={!newCode.trim() || !newName.trim() || saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ml-1">Create</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewModule(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Module list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : modules.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No training modules yet. Create your first one above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {modules.map((mod) => (
              <Card key={mod.id} className={`border-border/40 ${expandedModule === mod.id ? "border-primary/30" : ""}`}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleExpand(mod.id)}>
                  <GraduationCap className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editingModule === mod.id ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm" />
                        <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="h-7 text-sm" />
                        <div className="flex gap-2">
                          <Input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className="h-7 text-sm w-20" />
                          <select value={editDifficulty} onChange={(e) => setEditDifficulty(e.target.value)}
                            className="h-7 rounded border text-sm px-2">
                            {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <Button size="sm" className="h-7" onClick={() => handleUpdateModule(mod.id)} disabled={saving}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingModule(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{mod.module_name}</span>
                          <Badge variant="secondary" className="text-[9px] font-mono">{mod.module_code}</Badge>
                          {mod.is_required && <Badge className="text-[9px] bg-red-500/10 text-red-500">Required</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" /> {mod.duration_minutes}m
                          <span className="text-border">·</span>
                          <FileText className="h-3 w-3" /> {mod.slide_count ?? 0} slides
                          <span className="text-border">·</span>
                          {mod.difficulty_level}
                        </div>
                      </>
                    )}
                  </div>
                  {editingModule !== mod.id && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditModule(mod)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => handleDeleteModule(mod.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {expandedModule === mod.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                {/* Expanded slides panel */}
                {expandedModule === mod.id && (
                  <div className="border-t border-border/30 px-4 py-3 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">SLIDES</span>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowNewSlide(true)} disabled={showNewSlide}>
                        <Plus className="h-3 w-3" /> Add Slide
                      </Button>
                    </div>

                    {loadingSlides ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : slides.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No slides yet. Add your first slide above.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {slides.map((slide, idx) => (
                          <div key={slide.id} className="flex items-start gap-2 rounded-lg border border-border/40 bg-card p-2.5">
                            <span className="text-[10px] font-mono text-muted-foreground mt-1 w-5 text-center shrink-0">{idx + 1}</span>
                            {editingSlide === slide.id ? (
                              <div className="flex-1 space-y-2">
                                <Input value={editSlideTitle} onChange={(e) => setEditSlideTitle(e.target.value)} placeholder="Slide title" className="h-7 text-sm" />
                                <textarea value={editSlideContent} onChange={(e) => setEditSlideContent(e.target.value)} placeholder="HTML content"
                                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px] font-mono" />
                                <Input value={editSlideImage} onChange={(e) => setEditSlideImage(e.target.value)} placeholder="Image URL (optional)" className="h-7 text-sm" />
                                <div className="flex gap-1.5">
                                  <Button size="sm" className="h-6 text-xs" onClick={() => handleUpdateSlide(slide.id)} disabled={savingSlide}>
                                    {savingSlide ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingSlide(null)}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{slide.title}</p>
                                {slide.content_html && (
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                    {slide.content_html.replace(/<[^>]*>/g, "").slice(0, 80)}
                                  </p>
                                )}
                              </div>
                            )}
                            {editingSlide !== slide.id && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleMoveSlide(slide.id, "up")} disabled={idx === 0}>
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleMoveSlide(slide.id, "down")} disabled={idx === slides.length - 1}>
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditSlide(slide)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => handleDeleteSlide(slide.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* New slide form */}
                    {showNewSlide && (
                      <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                        <Input value={newSlideTitle} onChange={(e) => setNewSlideTitle(e.target.value)} placeholder="Slide title *" className="h-8 text-sm" />
                        <textarea value={newSlideContent} onChange={(e) => setNewSlideContent(e.target.value)} placeholder="Slide HTML content"
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px] font-mono" />
                        <Input value={newSlideImage} onChange={(e) => setNewSlideImage(e.target.value)} placeholder="Image URL (optional)" className="h-8 text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleCreateSlide} disabled={!newSlideTitle.trim() || savingSlide}>
                            {savingSlide ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add Slide"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowNewSlide(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        </>}

        {/* ═══ QUESTION BANK TAB ═══ */}
        {tab === "questions" && <>
        <div className="flex items-center justify-between">
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
          <Button onClick={() => setShowNewQ(true)} className="gap-1.5" disabled={showNewQ}>
            <Plus className="h-4 w-4" /> New Question
          </Button>
        </div>

        {/* New question form */}
        {showNewQ && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Create Question</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Question Text *</label>
                <textarea value={newQText} onChange={(e) => setNewQText(e.target.value)} placeholder="Enter the question..."
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select value={newQType} onChange={(e) => {
                    setNewQType(e.target.value);
                    if (e.target.value === "true_false") { setNewQOptions(["True", "False"]); setNewQCorrect("True"); }
                    else if (e.target.value === "short_answer") { setNewQOptions([]); }
                    else { setNewQOptions(["", "", "", ""]); }
                  }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {Q_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Difficulty</label>
                  <select value={newQDifficulty} onChange={(e) => setNewQDifficulty(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {Q_DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Module (optional)</label>
                  <select value={newQModuleId} onChange={(e) => setNewQModuleId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="">None</option>
                    {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
                  </select>
                </div>
              </div>
              {newQType === "multiple_choice" && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Options</label>
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
                  <label className="text-xs text-muted-foreground">Correct Answer *</label>
                  <Input value={newQCorrect} onChange={(e) => setNewQCorrect(e.target.value)} placeholder="Expected answer" />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Category (optional)</label>
                  <Input value={newQCategory} onChange={(e) => setNewQCategory(e.target.value)} placeholder="e.g. Use of Force, Radio Comms" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Explanation (shown after answering)</label>
                  <Input value={newQExplanation} onChange={(e) => setNewQExplanation(e.target.value)} placeholder="Why this is the correct answer..." />
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
                        {q.explanation && <p className="mt-1 text-[10px] text-muted-foreground italic">💡 {q.explanation}</p>}
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
        </>}
      </div>
    </>
  );
}
