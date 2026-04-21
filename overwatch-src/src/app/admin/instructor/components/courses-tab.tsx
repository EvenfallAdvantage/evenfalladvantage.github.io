"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Loader2, Save, X, Pencil, ChevronDown, ChevronUp, Clock, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getLegacyCourses, getLegacyCourseModules,
  createLegacyCourse, updateLegacyCourse,
  createLegacyModule, updateLegacyModule,
  type LegacyCourse, type LegacyModule, type LegacyCourseModule,
} from "@/lib/legacy-bridge";
import { SlidesPanel } from "./slides-panel";
import { logger } from "@/lib/logger";

interface CoursesTabProps {
  triggerNew: number;
}

export function CoursesTab({ triggerNew }: CoursesTabProps) {
  const [courses, setCourses] = useState<LegacyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (triggerNew > 0) setShowNew(true);
  }, [triggerNew]);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [xCourseId, setXCourseId] = useState<string | null>(null);
  const [courseModules, setCourseModules] = useState<LegacyCourseModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [xModuleId, setXModuleId] = useState<string | null>(null);
  const [nCode, setNCode] = useState(""); const [nName, setNName] = useState("");
  const [nDesc, setNDesc] = useState(""); const [nPrice, setNPrice] = useState("0");
  const [nHours, setNHours] = useState(""); const [nDiff, setNDiff] = useState("Beginner");
  const [eCode, setECode] = useState(""); const [eName, setEName] = useState(""); const [eDesc, setEDesc] = useState("");
  const [ePrice, setEPrice] = useState(""); const [eHours, setEHours] = useState("");
  const [eActive, setEActive] = useState(true);
  const [showNewModule, setShowNewModule] = useState(false);
  const [nmCode, setNmCode] = useState(""); const [nmName, setNmName] = useState("");
  const [nmDesc, setNmDesc] = useState(""); const [nmDur, setNmDur] = useState("30");
  const [savingMod, setSavingMod] = useState(false);
  const [editModId, setEditModId] = useState<string | null>(null);
  const [emName, setEmName] = useState(""); const [emDesc, setEmDesc] = useState("");
  const [emDur, setEmDur] = useState(""); const [emDiff, setEmDiff] = useState("");
  const [savingModEdit, setSavingModEdit] = useState(false);

  function generateCourseCode(name: string): string {
    const skip = new Set(["a","an","the","of","and","&","for","in","on","to","with"]);
    const words = name.trim().split(/\s+/).filter(w => !skip.has(w.toLowerCase()));
    const initials = words.map(w => w[0]?.toUpperCase() ?? "").join("");
    const slug = (initials || "CRS") + "-" + new Date().getFullYear();
    return slug.toLowerCase();
  }

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try { setCourses(await getLegacyCourses(true)); } catch (e) { logger.swallow("instructor-courses:load", e, "warn"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadCourses(); }, [loadCourses]);

  async function toggleCourse(id: string) {
    if (xCourseId === id) { setXCourseId(null); setXModuleId(null); return; }
    setXCourseId(id); setXModuleId(null); setEditModId(null);
    setModulesLoading(true);
    try { setCourseModules(await getLegacyCourseModules(id)); } catch (e) { logger.swallow("instructor-courses:load-modules", e, "warn"); }
    finally { setModulesLoading(false); }
  }
  function toggleModule(id: string) {
    if (xModuleId === id) { setXModuleId(null); return; }
    setXModuleId(id);
  }
  async function handleCreateCourse() {
    if (!nCode.trim() || !nName.trim()) return; setSaving(true);
    try {
      await createLegacyCourse({ course_code: nCode.trim(), course_name: nName.trim(), description: nDesc.trim() || undefined, price: parseFloat(nPrice) || 0, duration_hours: parseFloat(nHours) || undefined, difficulty_level: nDiff });
      setShowNew(false); setNCode(""); setNName(""); setNDesc(""); setNPrice("0"); setNHours(""); await loadCourses();
    } catch { alert("Failed to create course"); } finally { setSaving(false); }
  }
  function startEditCourse(c: LegacyCourse) {
    setEditId(c.id); setECode(c.course_code); setEName(c.course_name); setEDesc(c.description ?? "");
    setEPrice(String(c.price)); setEHours(String(c.duration_hours ?? "")); setEActive(c.is_active);
  }
  async function handleUpdateCourse() {
    if (!editId) return; setSaving(true);
    try {
      await updateLegacyCourse(editId, { course_code: eCode.trim(), course_name: eName.trim(), description: eDesc.trim(), price: parseFloat(ePrice) || 0, duration_hours: parseFloat(eHours) || undefined, is_active: eActive });
      setEditId(null); await loadCourses();
    } catch { alert("Failed to update course"); } finally { setSaving(false); }
  }
  async function handleCreateModule() {
    if (!nmCode.trim() || !nmName.trim()) return; setSavingMod(true);
    try {
      await createLegacyModule({ module_code: nmCode.trim(), module_name: nmName.trim(), description: nmDesc.trim() || undefined, duration_minutes: parseInt(nmDur) || 30 });
      setShowNewModule(false); setNmCode(""); setNmName(""); setNmDesc(""); setNmDur("30");
      if (xCourseId) setCourseModules(await getLegacyCourseModules(xCourseId));
    } catch { alert("Failed to create module"); } finally { setSavingMod(false); }
  }
  function startEditModule(m: LegacyModule) {
    setEditModId(m.id); setEmName(m.module_name); setEmDesc(m.description || "");
    setEmDur(String(m.duration_minutes || "")); setEmDiff(m.difficulty_level || "Essential");
  }
  async function handleUpdateModule() {
    if (!editModId) return; setSavingModEdit(true);
    try {
      await updateLegacyModule(editModId, { module_name: emName.trim(), description: emDesc.trim(), duration_minutes: parseInt(emDur) || undefined, difficulty_level: emDiff });
      setEditModId(null);
      if (xCourseId) setCourseModules(await getLegacyCourseModules(xCourseId));
    } catch { alert("Failed to update module"); } finally { setSavingModEdit(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{courses.length} courses</p>
        <a href="../../admin/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#dd8c33] transition-colors">
          <ExternalLink className="h-3 w-3" /> Legacy Editor
        </a>
      </div>
      {showNew && (
        <Card className="border-primary/30"><CardContent className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold">New Course</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Course Code *" value={nCode} onChange={(e) => setNCode(e.target.value)} />
            <Input placeholder="Course Name *" value={nName} onChange={(e) => { setNName(e.target.value); if (!nCode || nCode === generateCourseCode(nName)) setNCode(generateCourseCode(e.target.value)); }} />
          </div>
          <Input placeholder="Description" value={nDesc} onChange={(e) => setNDesc(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Price" type="number" value={nPrice} onChange={(e) => setNPrice(e.target.value)} />
            <Input placeholder="Hours" type="number" value={nHours} onChange={(e) => setNHours(e.target.value)} />
            <select value={nDiff} onChange={(e) => setNDiff(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {["Beginner","Intermediate","Advanced","Expert"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateCourse} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}><X className="h-3.5 w-3.5" /> Cancel</Button>
          </div>
        </CardContent></Card>
      )}
      <div className="space-y-2">
        {courses.map((c) => (
          <Card key={c.id} className="border-border/40">
            <CardContent className="p-0">
              {editId === c.id ? (
                <div className="space-y-2 p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input value={eCode} onChange={(e) => setECode(e.target.value)} placeholder="Course Code" />
                    <Input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Course Name" />
                  </div>
                  <Input value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Description" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input type="number" value={ePrice} onChange={(e) => setEPrice(e.target.value)} placeholder="Price" />
                    <Input type="number" value={eHours} onChange={(e) => setEHours(e.target.value)} placeholder="Hours" />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={eActive} onChange={(e) => setEActive(e.target.checked)} /> Active</label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdateCourse} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => toggleCourse(c.id)} className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/30 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{c.course_name}</h4>
                      <Badge className="text-[9px]">{c.course_code}</Badge>
                      {!c.is_active && <Badge className="text-[9px] bg-red-500/15 text-red-500">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.description || "No description"}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>${c.price}</span>
                      {c.duration_hours && <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {c.duration_hours}h</span>}
                      <span>{c.difficulty_level}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); startEditCourse(c); }} className="p-1 rounded hover:bg-accent/50"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    {xCourseId === c.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
              )}
              {xCourseId === c.id && editId !== c.id && (
                <div className="border-t border-border/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase">Modules ({courseModules.length})</h5>
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => setShowNewModule(true)}><Plus className="h-3 w-3" /> Add Module</Button>
                  </div>
                  {showNewModule && (
                    <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input placeholder="Module Code *" value={nmCode} onChange={(e) => setNmCode(e.target.value)} className="h-8 text-sm" />
                        <Input placeholder="Module Name *" value={nmName} onChange={(e) => setNmName(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <Input placeholder="Description" value={nmDesc} onChange={(e) => setNmDesc(e.target.value)} className="h-8 text-sm" />
                      <Input placeholder="Duration (min)" type="number" value={nmDur} onChange={(e) => setNmDur(e.target.value)} className="h-8 text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={handleCreateModule} disabled={savingMod}>{savingMod ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Create</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewModule(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {modulesLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (
                    <div className="space-y-1.5">
                      {courseModules.map((cm) => {
                        const mod = cm.training_modules;
                        if (!mod) return null;
                        return (
                          <div key={cm.id} className="rounded border border-border/30">
                            {editModId === mod.id ? (
                              <div className="p-3 space-y-2">
                                <Input value={emName} onChange={(e) => setEmName(e.target.value)} placeholder="Module Name" className="h-8 text-sm" />
                                <textarea value={emDesc} onChange={(e) => setEmDesc(e.target.value)} placeholder="Description" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[50px]" />
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <Input type="number" value={emDur} onChange={(e) => setEmDur(e.target.value)} placeholder="Duration (min)" className="h-8 text-sm" />
                                  <select value={emDiff} onChange={(e) => setEmDiff(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                                    <option value="Essential">Essential</option><option value="Critical">Critical</option><option value="Advanced">Advanced</option>
                                  </select>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" className="h-7 text-xs" onClick={handleUpdateModule} disabled={savingModEdit}>{savingModEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save</Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditModId(null)}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => toggleModule(mod.id)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/20 transition-colors text-xs">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-muted-foreground w-5">{cm.module_order}.</span>
                                    <span className="font-medium">{mod.module_name}</span>
                                    <Badge className="text-[8px] h-4">{mod.module_code}</Badge>
                                    {cm.is_required && <Badge className="text-[8px] h-4 bg-amber-500/15 text-amber-600">Required</Badge>}
                                  </div>
                                  <div className="flex items-center gap-2 ml-7 mt-0.5 text-[10px] text-muted-foreground">
                                    {mod.duration_minutes && <span><Clock className="h-2.5 w-2.5 inline mr-0.5" />{mod.duration_minutes}m</span>}
                                    <span>{mod.difficulty_level}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <button onClick={(e) => { e.stopPropagation(); startEditModule(mod); }} className="p-1 rounded hover:bg-accent/50"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                                  {xModuleId === mod.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                </div>
                              </button>
                            )}
                            {xModuleId === mod.id && editModId !== mod.id && (
                              <SlidesPanel moduleId={mod.id} />
                            )}
                          </div>
                        );
                      })}
                      {courseModules.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No modules linked to this course</p>}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No courses yet. Create your first course above.</div>}
      </div>
    </div>
  );
}
