"use client";

import { useEffect, useState, useCallback } from "react";
import {
  GraduationCap, Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  FileText, Pencil, Save, X, ArrowUp, ArrowDown, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import {
  getTrainingModules, createTrainingModule, updateTrainingModule, deleteTrainingModule,
  getModuleSlides, createModuleSlide, updateModuleSlide, deleteModuleSlide, reorderModuleSlides,
} from "@/lib/supabase/db";
import type { TrainingModule, ModuleSlide } from "@/types";

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Critical", "Essential"];

export default function AdminTrainingPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [slides, setSlides] = useState<ModuleSlide[]>([]);
  const [loadingSlides, setLoadingSlides] = useState(false);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">TRAINING ADMIN</h1>
            <p className="text-sm text-muted-foreground">Manage training modules and slide content</p>
          </div>
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
      </div>
    </DashboardLayout>
  );
}
