"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, Plus, Loader2, BookOpen, Users, Calendar,
  ClipboardCheck, Save, X, Pencil, Trash2, ChevronDown, ChevronUp,
  Clock, CheckCircle2, XCircle, AlertTriangle, FileText,
  UserCheck, UserX, Award, ExternalLink, Image, Type, Video,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { canManageLegacyCourses, type CompanyRole } from "@/lib/permissions";
import {
  getLegacyCourses, getLegacyCourseModules, getLegacyModules, getLegacySlides, getLegacyAssessments,
  getLegacyStudents, getLegacyClasses, getLegacyProgress,
  createLegacyCourse, updateLegacyCourse,
  createLegacyModule,
  createLegacySlide, updateLegacySlide, deleteLegacySlide,
  updateLegacyModule,
  createLegacyAssessment, updateLegacyAssessment,
  createLegacyClass, updateLegacyClass,
  getClassEnrollments, markAttendance, getClassAttendance,
  issueLegacyCertificate,
  type LegacyCourse, type LegacyModule, type LegacySlide, type LegacyCourseModule,
  type LegacyAssessment, type LegacyScheduledClass, type LegacyStudent,
  type LegacyModuleProgress, type ClassEnrollmentRow, type ClassAttendanceRow,
} from "@/lib/legacy-bridge";
import { ensureInstructorLinked } from "@/lib/account-linker";

type Tab = "courses" | "classes" | "students" | "assessments";

export default function InstructorHQPage() {
  const user = useAuthStore((s) => s.user);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const role = (activeCompany?.role ?? "staff") as CompanyRole;
  const isProvider = activeCompany?.isTrainingProvider ?? false;
  const hasAccess = isProvider && canManageLegacyCourses(role);

  const [tab, setTab] = useState<Tab>("courses");
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const linkInstructor = useCallback(async () => {
    if (!user?.email || !hasAccess) return;
    setLinking(true);
    try {
      const id = await ensureInstructorLinked({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
      setInstructorId(id);
    } catch {}
    finally { setLinking(false); }
  }, [user, hasAccess]);

  useEffect(() => { linkInstructor(); }, [linkInstructor]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h2 className="text-lg font-bold">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Instructor HQ is only available to instructors, admins, and owners of the training provider company.
        </p>
      </div>
    );
  }

  if (linking) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Linking instructor account...</p>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "classes", label: "Classes", icon: Calendar },
    { id: "students", label: "Students", icon: Users },
    { id: "assessments", label: "Assessments", icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" /> INSTRUCTOR HQ
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Legacy course management for Evenfall Advantage</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/40 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "courses" && <CoursesTab />}
      {tab === "classes" && <ClassesTab instructorId={instructorId} />}
      {tab === "students" && <StudentsTab instructorId={instructorId} />}
      {tab === "assessments" && <AssessmentsTab />}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// SLIDES PANEL (helper for CoursesTab)
// ═══════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
function SlidesPanel({ slides, slidesLoading, editSlide, previewSlide, SLIDE_TYPES, esTitle, setEsTitle, esContent, setEsContent, esType, setEsType, esImage, setEsImage, savingSlideEdit, handleUpdateSlide, setEditSlide, startEditSlide, handleDeleteSlide, setPreviewSlide, showNewSlide, setShowNewSlide, nsTitle, setNsTitle, nsContent, setNsContent, nsType, setNsType, nsImage, setNsImage, savingSlide, handleCreateSlide }: any) {
  return (
    <div className="border-t border-border/20 px-3 py-2.5 ml-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Slides</span>
        <Button size="sm" variant="outline" className="gap-1 text-[10px] h-6 px-2" onClick={() => { setShowNewSlide(true); setEditSlide(null); setPreviewSlide(null); }}><Plus className="h-2.5 w-2.5" /> Add Slide</Button>
      </div>
      {slidesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : (
        <div className="space-y-1">
          {slides.map((s: any) => (
            <div key={s.id} className={`flex items-center gap-2 rounded border px-2.5 py-1 text-xs cursor-pointer transition-colors ${editSlide?.id === s.id ? "border-[#dd8c33]/50 bg-[#dd8c33]/5" : previewSlide?.id === s.id ? "border-primary/30 bg-primary/5" : "border-border/30 hover:border-border/60"}`}>
              <span className="font-mono text-muted-foreground w-5">{s.slide_number}.</span>
              <span className="flex-1 truncate" onClick={() => { setPreviewSlide(previewSlide?.id === s.id ? null : s); setEditSlide(null); }}>{s.title}</span>
              <div className="flex items-center gap-0.5">
                {s.slide_type && s.slide_type !== "text" && <Badge className="text-[8px] h-4 px-1">{s.slide_type}</Badge>}
                <button onClick={() => startEditSlide(s)} className="p-0.5 text-muted-foreground/50 hover:text-[#dd8c33]"><Pencil className="h-3 w-3" /></button>
                <button onClick={() => handleDeleteSlide(s.id)} className="p-0.5 text-muted-foreground/50 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
          {slides.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-1">No slides yet</p>}
        </div>
      )}
      {previewSlide && !editSlide && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h6 className="text-xs font-semibold">{previewSlide.title}</h6>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => startEditSlide(previewSlide)}><Pencil className="h-2.5 w-2.5" /> Edit</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setPreviewSlide(null)}><X className="h-2.5 w-2.5" /></Button>
            </div>
          </div>
          {previewSlide.image_url && <img src={previewSlide.image_url} alt="" className="rounded max-h-40 object-contain" />}
          {previewSlide.content ? (
            <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: previewSlide.content }} />
          ) : <p className="text-[10px] text-muted-foreground italic">No content</p>}
        </div>
      )}
      {editSlide && (
        <div className="rounded-lg border border-[#dd8c33]/30 bg-[#dd8c33]/5 p-3 space-y-2">
          <h6 className="text-[10px] font-semibold uppercase text-[#dd8c33]">Edit Slide #{editSlide.slide_number}</h6>
          <Input value={esTitle} onChange={(e: any) => setEsTitle(e.target.value)} placeholder="Slide Title" className="h-8 text-sm" />
          <div className="flex gap-1.5">
            {SLIDE_TYPES.map((t: any) => (
              <button key={t.value} onClick={() => setEsType(t.value)} className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] border transition-colors ${esType === t.value ? "border-[#dd8c33] bg-[#dd8c33]/10 text-[#dd8c33]" : "border-border/30 text-muted-foreground hover:border-border/60"}`}>
                <t.icon className="h-3 w-3" /> {t.label}
              </button>
            ))}
          </div>
          {(esType === "image" || esType === "mixed") && <Input value={esImage} onChange={(e: any) => setEsImage(e.target.value)} placeholder="Image URL" className="h-8 text-sm" />}
          <textarea value={esContent} onChange={(e: any) => setEsContent(e.target.value)} placeholder="HTML content" className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono min-h-[80px]" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleUpdateSlide} disabled={savingSlideEdit}>{savingSlideEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditSlide(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {showNewSlide && !editSlide && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <h6 className="text-[10px] font-semibold uppercase text-primary">New Slide</h6>
          <Input value={nsTitle} onChange={(e: any) => setNsTitle(e.target.value)} placeholder="Slide Title *" className="h-8 text-sm" />
          <div className="flex gap-1.5">
            {SLIDE_TYPES.map((t: any) => (
              <button key={t.value} onClick={() => setNsType(t.value)} className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] border transition-colors ${nsType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:border-border/60"}`}>
                <t.icon className="h-3 w-3" /> {t.label}
              </button>
            ))}
          </div>
          {(nsType === "image" || nsType === "mixed") && <Input value={nsImage} onChange={(e: any) => setNsImage(e.target.value)} placeholder="Image URL" className="h-8 text-sm" />}
          <textarea value={nsContent} onChange={(e: any) => setNsContent(e.target.value)} placeholder="HTML content" className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono min-h-[60px]" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleCreateSlide} disabled={savingSlide}>{savingSlide ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Create</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewSlide(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COURSES TAB (Course → Modules → Slides hierarchy)
// ═══════════════════════════════════════════════════════

function CoursesTab() {
  const [courses, setCourses] = useState<LegacyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [xCourseId, setXCourseId] = useState<string | null>(null);
  const [courseModules, setCourseModules] = useState<LegacyCourseModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [xModuleId, setXModuleId] = useState<string | null>(null);
  const [slides, setSlides] = useState<LegacySlide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(false);
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
  const [showNewSlide, setShowNewSlide] = useState(false);
  const [nsTitle, setNsTitle] = useState(""); const [nsContent, setNsContent] = useState("");
  const [nsType, setNsType] = useState("text"); const [nsImage, setNsImage] = useState("");
  const [savingSlide, setSavingSlide] = useState(false);
  const [editSlide, setEditSlide] = useState<LegacySlide | null>(null);
  const [esTitle, setEsTitle] = useState(""); const [esContent, setEsContent] = useState("");
  const [esType, setEsType] = useState("text"); const [esImage, setEsImage] = useState("");
  const [savingSlideEdit, setSavingSlideEdit] = useState(false);
  const [previewSlide, setPreviewSlide] = useState<LegacySlide | null>(null);

  function generateCourseCode(name: string): string {
    const skip = new Set(["a","an","the","of","and","&","for","in","on","to","with"]);
    const words = name.trim().split(/\s+/).filter(w => !skip.has(w.toLowerCase()));
    const initials = words.map(w => w[0]?.toUpperCase() ?? "").join("");
    const slug = (initials || "CRS") + "-" + new Date().getFullYear();
    return slug.toLowerCase();
  }

  const SLIDE_TYPES = [
    { value: "text", label: "Text", icon: Type },
    { value: "image", label: "Image", icon: Image },
    { value: "video", label: "Video", icon: Video },
    { value: "mixed", label: "Mixed", icon: FileText },
  ];

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try { setCourses(await getLegacyCourses(true)); } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadCourses(); }, [loadCourses]);

  async function toggleCourse(id: string) {
    if (xCourseId === id) { setXCourseId(null); setXModuleId(null); return; }
    setXCourseId(id); setXModuleId(null); setEditModId(null);
    setModulesLoading(true);
    try { setCourseModules(await getLegacyCourseModules(id)); } catch {}
    finally { setModulesLoading(false); }
  }
  async function toggleModule(id: string) {
    if (xModuleId === id) { setXModuleId(null); setEditSlide(null); setPreviewSlide(null); return; }
    setXModuleId(id); setEditSlide(null); setPreviewSlide(null);
    setSlidesLoading(true);
    try { setSlides(await getLegacySlides(id)); } catch {}
    finally { setSlidesLoading(false); }
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
  async function handleCreateSlide() {
    if (!xModuleId || !nsTitle.trim()) return; setSavingSlide(true);
    try {
      await createLegacySlide({ module_id: xModuleId, title: nsTitle.trim(), content_html: nsContent.trim() || undefined, slide_number: slides.length + 1, slide_type: nsType || "text", image_url: nsImage.trim() || undefined });
      setShowNewSlide(false); setNsTitle(""); setNsContent(""); setNsType("text"); setNsImage("");
      setSlides(await getLegacySlides(xModuleId));
    } catch { alert("Failed to create slide"); } finally { setSavingSlide(false); }
  }
  function startEditSlide(s: LegacySlide) {
    setEditSlide(s); setPreviewSlide(null);
    setEsTitle(s.title || ""); setEsContent(s.content || ""); setEsType(s.slide_type || "text"); setEsImage(s.image_url || "");
  }
  async function handleUpdateSlide() {
    if (!editSlide || !xModuleId) return; setSavingSlideEdit(true);
    try {
      await updateLegacySlide(editSlide.id, { title: esTitle.trim(), content_html: esContent, slide_type: esType, image_url: esImage.trim() || undefined });
      setEditSlide(null); setSlides(await getLegacySlides(xModuleId));
    } catch { alert("Failed to update slide"); } finally { setSavingSlideEdit(false); }
  }
  async function handleDeleteSlide(slideId: string) {
    if (!confirm("Delete this slide?") || !xModuleId) return;
    await deleteLegacySlide(slideId); if (editSlide?.id === slideId) setEditSlide(null);
    setSlides(await getLegacySlides(xModuleId));
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{courses.length} courses</p>
        <div className="flex gap-2">
          <a href="../../admin/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#dd8c33] transition-colors">
            <ExternalLink className="h-3 w-3" /> Legacy Editor
          </a>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5" /> New Course</Button>
        </div>
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
                              <SlidesPanel slides={slides} slidesLoading={slidesLoading} editSlide={editSlide} previewSlide={previewSlide} SLIDE_TYPES={SLIDE_TYPES} esTitle={esTitle} setEsTitle={setEsTitle} esContent={esContent} setEsContent={setEsContent} esType={esType} setEsType={setEsType} esImage={esImage} setEsImage={setEsImage} savingSlideEdit={savingSlideEdit} handleUpdateSlide={handleUpdateSlide} setEditSlide={setEditSlide} startEditSlide={startEditSlide} handleDeleteSlide={handleDeleteSlide} setPreviewSlide={setPreviewSlide} showNewSlide={showNewSlide} setShowNewSlide={setShowNewSlide} nsTitle={nsTitle} setNsTitle={setNsTitle} nsContent={nsContent} setNsContent={setNsContent} nsType={nsType} setNsType={setNsType} nsImage={nsImage} setNsImage={setNsImage} savingSlide={savingSlide} handleCreateSlide={handleCreateSlide} />
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

// ═══════════════════════════════════════════════════════
// CLASSES TAB
// ═══════════════════════════════════════════════════════

function ClassesTab({ instructorId }: { instructorId: string | null }) {
  const [classes, setClasses] = useState<LegacyScheduledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<ClassEnrollmentRow[]>([]);
  const [attendance, setAttendance] = useState<ClassAttendanceRow[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);
  // New class
  const [ncName, setNcName] = useState("");
  const [ncDate, setNcDate] = useState("");
  const [ncStart, setNcStart] = useState("09:00");
  const [ncEnd, setNcEnd] = useState("17:00");
  const [ncLocation, setNcLocation] = useState("");
  const [ncMax, setNcMax] = useState("20");

  const load = useCallback(async () => {
    setLoading(true);
    try { setClasses(await getLegacyClasses(instructorId ?? undefined)); } catch {}
    finally { setLoading(false); }
  }, [instructorId]);
  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!ncName.trim() || !ncDate || !instructorId) return;
    setSaving(true);
    try {
      await createLegacyClass({
        instructor_id: instructorId, class_name: ncName.trim(),
        scheduled_date: ncDate, start_time: ncStart, end_time: ncEnd,
        location: ncLocation.trim() || undefined, max_students: parseInt(ncMax) || 20,
      });
      setShowNew(false); setNcName(""); setNcDate(""); setNcLocation("");
      await load();
    } catch { alert("Failed to create class"); }
    finally { setSaving(false); }
  }

  async function toggleExpand(classId: string) {
    if (expandedId === classId) { setExpandedId(null); return; }
    setExpandedId(classId);
    setEnrollLoading(true);
    try {
      const [e, a] = await Promise.all([getClassEnrollments(classId), getClassAttendance(classId)]);
      setEnrollments(e); setAttendance(a);
    } catch {}
    finally { setEnrollLoading(false); }
  }

  async function handleMarkAttendance(classId: string, studentId: string, status: "present" | "absent" | "late") {
    await markAttendance(classId, studentId, status);
    setAttendance(await getClassAttendance(classId));
  }

  async function handleCancelClass(classId: string) {
    if (!confirm("Cancel this class?")) return;
    await updateLegacyClass(classId, { status: "cancelled" });
    await load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{classes.length} upcoming classes</p>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)} disabled={!instructorId}>
          <Plus className="h-3.5 w-3.5" /> Schedule Class
        </Button>
      </div>

      {showNew && (
        <Card className="border-primary/30"><CardContent className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold">Schedule New Class</h3>
          <Input placeholder="Class Name *" value={ncName} onChange={(e) => setNcName(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-3">
            <div><label className="text-[10px] text-muted-foreground">Date</label><Input type="date" value={ncDate} onChange={(e) => setNcDate(e.target.value)} className="h-8" /></div>
            <div><label className="text-[10px] text-muted-foreground">Start</label><Input type="time" value={ncStart} onChange={(e) => setNcStart(e.target.value)} className="h-8" /></div>
            <div><label className="text-[10px] text-muted-foreground">End</label><Input type="time" value={ncEnd} onChange={(e) => setNcEnd(e.target.value)} className="h-8" /></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Location" value={ncLocation} onChange={(e) => setNcLocation(e.target.value)} />
            <Input placeholder="Max Students" type="number" value={ncMax} onChange={(e) => setNcMax(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {classes.map((cls) => {
          const enrolled = cls.enrollments?.[0]?.count ?? 0;
          const isCancelled = cls.status === "cancelled";
          return (
            <Card key={cls.id} className={`border-border/40 ${isCancelled ? "opacity-50" : ""}`}>
              <CardContent className="p-0">
                <button onClick={() => toggleExpand(cls.id)} className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/30 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{cls.class_name}</h4>
                      {isCancelled && <Badge className="text-[9px] bg-red-500/15 text-red-500">Cancelled</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span><Calendar className="h-2.5 w-2.5 inline mr-0.5" />{cls.scheduled_date}</span>
                      <span>{cls.start_time}{cls.end_time ? ` - ${cls.end_time}` : ""}</span>
                      {cls.location && <span>{cls.location}</span>}
                      <span><Users className="h-2.5 w-2.5 inline mr-0.5" />{enrolled}/{cls.max_students ?? "∞"}</span>
                    </div>
                  </div>
                  {expandedId === cls.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expandedId === cls.id && (
                  <div className="border-t border-border/40 p-4 space-y-3">
                    {enrollLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (
                      <>
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase">Enrolled Students & Attendance</h5>
                        {enrollments.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">No students enrolled</p>
                        ) : (
                          <div className="space-y-1.5">
                            {enrollments.map((e) => {
                              const att = attendance.find((a) => a.student_id === e.student_id);
                              return (
                                <div key={e.student_id} className="flex items-center gap-2 rounded border border-border/30 px-3 py-1.5 text-xs">
                                  <span className="flex-1">{e.student?.first_name} {e.student?.last_name}</span>
                                  {att ? (
                                    <Badge className={`text-[9px] ${att.status === "present" ? "bg-green-500/15 text-green-600" : att.status === "late" ? "bg-amber-500/15 text-amber-600" : "bg-red-500/15 text-red-600"}`}>{att.status}</Badge>
                                  ) : (
                                    <div className="flex gap-1">
                                      <button onClick={() => handleMarkAttendance(cls.id, e.student_id, "present")} className="rounded px-1.5 py-0.5 text-[9px] bg-green-500/10 text-green-600 hover:bg-green-500/20" title="Present"><UserCheck className="h-3 w-3" /></button>
                                      <button onClick={() => handleMarkAttendance(cls.id, e.student_id, "late")} className="rounded px-1.5 py-0.5 text-[9px] bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" title="Late"><Clock className="h-3 w-3" /></button>
                                      <button onClick={() => handleMarkAttendance(cls.id, e.student_id, "absent")} className="rounded px-1.5 py-0.5 text-[9px] bg-red-500/10 text-red-600 hover:bg-red-500/20" title="Absent"><UserX className="h-3 w-3" /></button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {!isCancelled && (
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => handleCancelClass(cls.id)}>
                            <XCircle className="h-3 w-3" /> Cancel Class
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {classes.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No classes scheduled.</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// STUDENTS TAB
// ═══════════════════════════════════════════════════════

function StudentsTab({ instructorId }: { instructorId: string | null }) {
  const [students, setStudents] = useState<LegacyStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<LegacyModuleProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  // Certificate issuance
  const [showCert, setShowCert] = useState<string | null>(null);
  const [certName, setCertName] = useState("");
  const [certType, setCertType] = useState("course_completion");
  const [certState, setCertState] = useState("");
  const [issuingCert, setIssuingCert] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStudents(await getLegacyStudents()); } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleExpand(studentId: string) {
    if (expandedId === studentId) { setExpandedId(null); return; }
    setExpandedId(studentId);
    setProgressLoading(true);
    try { setProgress(await getLegacyProgress(studentId)); } catch {}
    finally { setProgressLoading(false); }
  }

  async function handleIssueCert(studentId: string) {
    if (!certName.trim() || !instructorId) return;
    setIssuingCert(true);
    try {
      await issueLegacyCertificate({
        student_id: studentId, issued_by: instructorId,
        certificate_type: certType, certificate_name: certName.trim(),
        state_issued: certState.trim() || undefined,
      });
      setShowCert(null); setCertName(""); setCertState("");
      alert("Certificate issued successfully!");
    } catch { alert("Failed to issue certificate"); }
    finally { setIssuingCert(false); }
  }

  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.first_name.toLowerCase().includes(q) || s.last_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <p className="text-sm text-muted-foreground">{filtered.length} students</p>
      </div>

      <div className="space-y-1.5">
        {filtered.slice(0, 50).map((s) => (
          <Card key={s.id} className="border-border/40">
            <CardContent className="p-0">
              <button onClick={() => toggleExpand(s.id)} className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                  <p className="text-[10px] text-muted-foreground">{s.email}</p>
                </div>
                {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedId === s.id && (
                <div className="border-t border-border/40 p-4 space-y-3">
                  {progressLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (
                    <>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase">Module Progress</h5>
                      {progress.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No progress recorded</p>
                      ) : (
                        <div className="space-y-1.5">
                          {progress.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs">
                              {p.status === "completed" ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-border shrink-0" />}
                              <span className="flex-1 truncate">{p.training_modules?.module_name ?? p.module_id}</span>
                              <span className="font-mono text-muted-foreground">{p.progress_percentage}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="pt-2 border-t border-border/30">
                        {showCert === s.id ? (
                          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                            <Input placeholder="Certificate Name *" value={certName} onChange={(e) => setCertName(e.target.value)} className="h-8 text-sm" />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <select value={certType} onChange={(e) => setCertType(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                                <option value="course_completion">Course Completion</option>
                                <option value="guard_card">Guard Card</option>
                                <option value="firearms">Firearms</option>
                                <option value="cpr_first_aid">CPR/First Aid</option>
                                <option value="other">Other</option>
                              </select>
                              <Input placeholder="State (optional)" value={certState} onChange={(e) => setCertState(e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleIssueCert(s.id)} disabled={issuingCert}>
                                {issuingCert ? <Loader2 className="h-3 w-3 animate-spin" /> : <Award className="h-3 w-3" />} Issue
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCert(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowCert(s.id)} disabled={!instructorId}>
                            <Award className="h-3 w-3" /> Issue Certificate
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length > 50 && <p className="text-xs text-muted-foreground text-center">Showing first 50 of {filtered.length} results. Use search to narrow down.</p>}
        {filtered.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No students found.</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ASSESSMENTS TAB
// ═══════════════════════════════════════════════════════

function AssessmentsTab() {
  const [assessments, setAssessments] = useState<LegacyAssessment[]>([]);
  const [modules, setModules] = useState<LegacyModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // New assessment
  const [naName, setNaName] = useState("");
  const [naModuleId, setNaModuleId] = useState("");
  const [naQuestions, setNaQuestions] = useState("10");
  const [naPassing, setNaPassing] = useState("70");
  // Edit
  const [eaName, setEaName] = useState("");
  const [eaModuleId, setEaModuleId] = useState("");
  const [eaQuestions, setEaQuestions] = useState("");
  const [eaPassing, setEaPassing] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, m] = await Promise.all([getLegacyAssessments(), getLegacyModules()]);
      setAssessments(a); setModules(m);
    } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!naName.trim()) return;
    setSaving(true);
    try {
      await createLegacyAssessment({
        assessment_name: naName.trim(),
        module_id: naModuleId || undefined,
        total_questions: parseInt(naQuestions) || 10,
        passing_score: parseInt(naPassing) || 70,
      });
      setShowNew(false); setNaName(""); setNaModuleId(""); setNaQuestions("10"); setNaPassing("70");
      await load();
    } catch { alert("Failed to create assessment"); }
    finally { setSaving(false); }
  }

  function startEdit(a: LegacyAssessment) {
    setEditId(a.id); setEaName(a.assessment_name);
    setEaModuleId(a.module_id ?? ""); setEaQuestions(String(a.total_questions));
    setEaPassing(String(a.passing_score));
  }

  async function handleUpdate() {
    if (!editId) return;
    setSaving(true);
    try {
      await updateLegacyAssessment(editId, {
        assessment_name: eaName.trim(),
        module_id: eaModuleId || null,
        total_questions: parseInt(eaQuestions) || 10,
        passing_score: parseInt(eaPassing) || 70,
      });
      setEditId(null); await load();
    } catch { alert("Failed to update"); }
    finally { setSaving(false); }
  }

  const moduleMap = new Map(modules.map((m) => [m.id, m.module_name]));

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{assessments.length} assessments</p>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5" /> New Assessment</Button>
      </div>

      {showNew && (
        <Card className="border-primary/30"><CardContent className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold">New Assessment</h3>
          <Input placeholder="Assessment Name *" value={naName} onChange={(e) => setNaName(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={naModuleId} onChange={(e) => setNaModuleId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">No linked module</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
            </select>
            <Input placeholder="Total Questions" type="number" value={naQuestions} onChange={(e) => setNaQuestions(e.target.value)} />
            <Input placeholder="Passing Score (%)" type="number" value={naPassing} onChange={(e) => setNaPassing(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {assessments.map((a) => (
          <Card key={a.id} className="border-border/40">
            <CardContent className="p-4">
              {editId === a.id ? (
                <div className="space-y-2">
                  <Input value={eaName} onChange={(e) => setEaName(e.target.value)} />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select value={eaModuleId} onChange={(e) => setEaModuleId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">No linked module</option>
                      {modules.map((m) => <option key={m.id} value={m.id}>{m.module_name}</option>)}
                    </select>
                    <Input type="number" value={eaQuestions} onChange={(e) => setEaQuestions(e.target.value)} placeholder="Questions" />
                    <Input type="number" value={eaPassing} onChange={(e) => setEaPassing(e.target.value)} placeholder="Passing %" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdate} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm">{a.assessment_name}</h4>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{a.total_questions} questions</span>
                      <span>Pass: {a.passing_score}%</span>
                      {a.module_id && <span>Module: {moduleMap.get(a.module_id) ?? "Unknown"}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {assessments.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No assessments yet.</div>}
      </div>
    </div>
  );
}
