"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, Plus, Loader2, BookOpen, Users, Calendar,
  ClipboardCheck, Save, X, Pencil, Trash2, ChevronDown, ChevronUp,
  Clock, CheckCircle2, XCircle, AlertTriangle, FileText,
  UserCheck, UserX, Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { canManageLegacyCourses, type CompanyRole } from "@/lib/permissions";
import {
  getLegacyCourses, getLegacyModules, getLegacySlides, getLegacyAssessments,
  getLegacyStudents, getLegacyClasses, getLegacyProgress,
  createLegacyCourse, updateLegacyCourse,
  createLegacyModule,
  createLegacySlide, deleteLegacySlide,
  createLegacyAssessment, updateLegacyAssessment,
  createLegacyClass, updateLegacyClass,
  getClassEnrollments, markAttendance, getClassAttendance,
  issueLegacyCertificate,
  type LegacyCourse, type LegacyModule, type LegacySlide,
  type LegacyAssessment, type LegacyScheduledClass, type LegacyStudent,
  type LegacyModuleProgress, type ClassEnrollmentRow, type ClassAttendanceRow,
} from "@/lib/legacy-bridge";
import { ensureInstructorLinked } from "@/lib/account-linker";

type Tab = "courses" | "modules" | "classes" | "students" | "assessments";

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
    { id: "modules", label: "Modules", icon: FileText },
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
      {tab === "modules" && <ModulesTab />}
      {tab === "classes" && <ClassesTab instructorId={instructorId} />}
      {tab === "students" && <StudentsTab instructorId={instructorId} />}
      {tab === "assessments" && <AssessmentsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COURSES TAB
// ═══════════════════════════════════════════════════════

function CoursesTab() {
  const [courses, setCourses] = useState<LegacyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // New course fields
  const [nCode, setNCode] = useState("");
  const [nName, setNName] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nPrice, setNPrice] = useState("0");
  const [nHours, setNHours] = useState("");
  const [nDiff, setNDiff] = useState("Beginner");
  // Edit fields
  const [eName, setEName] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eHours, setEHours] = useState("");
  const [eActive, setEActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCourses(await getLegacyCourses(true)); } catch (err) { console.error("Instructor HQ: load courses error:", err); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!nCode.trim() || !nName.trim()) return;
    setSaving(true);
    try {
      await createLegacyCourse({
        course_code: nCode.trim(),
        course_name: nName.trim(),
        description: nDesc.trim() || undefined,
        price: parseFloat(nPrice) || 0,
        duration_hours: parseFloat(nHours) || undefined,
        difficulty_level: nDiff,
      });
      setShowNew(false); setNCode(""); setNName(""); setNDesc(""); setNPrice("0"); setNHours("");
      await load();
    } catch (err) { console.error(err); alert("Failed to create course"); }
    finally { setSaving(false); }
  }

  function startEdit(c: LegacyCourse) {
    setEditId(c.id); setEName(c.course_name); setEDesc(c.description ?? "");
    setEPrice(String(c.price)); setEHours(String(c.duration_hours ?? ""));
    setEActive(c.is_active);
  }

  async function handleUpdate() {
    if (!editId) return;
    setSaving(true);
    try {
      await updateLegacyCourse(editId, {
        course_name: eName.trim(),
        description: eDesc.trim(),
        price: parseFloat(ePrice) || 0,
        duration_hours: parseFloat(eHours) || undefined,
        is_active: eActive,
      });
      setEditId(null); await load();
    } catch (err) { console.error(err); alert("Failed to update"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{courses.length} courses in catalog</p>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5" /> New Course</Button>
      </div>

      {showNew && (
        <Card className="border-primary/30"><CardContent className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold">New Course</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Course Code *" value={nCode} onChange={(e) => setNCode(e.target.value)} />
            <Input placeholder="Course Name *" value={nName} onChange={(e) => setNName(e.target.value)} />
          </div>
          <Input placeholder="Description" value={nDesc} onChange={(e) => setNDesc(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Price ($)" type="number" value={nPrice} onChange={(e) => setNPrice(e.target.value)} />
            <Input placeholder="Duration (hours)" type="number" value={nHours} onChange={(e) => setNHours(e.target.value)} />
            <select value={nDiff} onChange={(e) => setNDiff(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {["Beginner","Intermediate","Advanced","Expert"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}><X className="h-3.5 w-3.5" /> Cancel</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {courses.map((c) => (
          <Card key={c.id} className="border-border/40">
            <CardContent className="p-4">
              {editId === c.id ? (
                <div className="space-y-2">
                  <Input value={eName} onChange={(e) => setEName(e.target.value)} />
                  <Input value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Description" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input type="number" value={ePrice} onChange={(e) => setEPrice(e.target.value)} placeholder="Price" />
                    <Input type="number" value={eHours} onChange={(e) => setEHours(e.target.value)} placeholder="Hours" />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={eActive} onChange={(e) => setEActive(e.target.checked)} /> Active
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdate} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
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
                  <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">No courses yet. Create your first course above.</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODULES TAB
// ═══════════════════════════════════════════════════════

function ModulesTab() {
  const [modules, setModules] = useState<LegacyModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [slides, setSlides] = useState<LegacySlide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(false);
  // New module
  const [nCode, setNCode] = useState("");
  const [nName, setNName] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nDuration, setNDuration] = useState("30");
  // New slide
  const [showNewSlide, setShowNewSlide] = useState(false);
  const [nsTitle, setNsTitle] = useState("");
  const [nsContent, setNsContent] = useState("");
  const [savingSlide, setSavingSlide] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setModules(await getLegacyModules()); } catch {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleExpand(moduleId: string) {
    if (expandedId === moduleId) { setExpandedId(null); return; }
    setExpandedId(moduleId);
    setSlidesLoading(true);
    try { setSlides(await getLegacySlides(moduleId)); } catch {}
    finally { setSlidesLoading(false); }
  }

  async function handleCreateModule() {
    if (!nCode.trim() || !nName.trim()) return;
    setSaving(true);
    try {
      await createLegacyModule({
        module_code: nCode.trim(), module_name: nName.trim(),
        description: nDesc.trim() || undefined,
        duration_minutes: parseInt(nDuration) || 30,
      });
      setShowNew(false); setNCode(""); setNName(""); setNDesc(""); setNDuration("30");
      await load();
    } catch { alert("Failed to create module"); }
    finally { setSaving(false); }
  }

  async function handleCreateSlide() {
    if (!expandedId || !nsTitle.trim()) return;
    setSavingSlide(true);
    try {
      await createLegacySlide({
        module_id: expandedId, title: nsTitle.trim(),
        content_html: nsContent.trim() || undefined,
        slide_number: slides.length + 1,
      });
      setShowNewSlide(false); setNsTitle(""); setNsContent("");
      setSlides(await getLegacySlides(expandedId));
    } catch { alert("Failed to create slide"); }
    finally { setSavingSlide(false); }
  }

  async function handleDeleteSlide(slideId: string) {
    if (!confirm("Delete this slide?") || !expandedId) return;
    await deleteLegacySlide(slideId);
    setSlides(await getLegacySlides(expandedId));
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{modules.length} training modules</p>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5" /> New Module</Button>
      </div>

      {showNew && (
        <Card className="border-primary/30"><CardContent className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold">New Module</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Module Code *" value={nCode} onChange={(e) => setNCode(e.target.value)} />
            <Input placeholder="Module Name *" value={nName} onChange={(e) => setNName(e.target.value)} />
          </div>
          <Input placeholder="Description" value={nDesc} onChange={(e) => setNDesc(e.target.value)} />
          <Input placeholder="Duration (minutes)" type="number" value={nDuration} onChange={(e) => setNDuration(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateModule} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {modules.map((m) => (
          <Card key={m.id} className="border-border/40">
            <CardContent className="p-0">
              <button onClick={() => toggleExpand(m.id)} className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/30 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{m.module_name}</h4>
                    <Badge className="text-[9px]">{m.module_code}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                    {m.duration_minutes && <span><Clock className="h-2.5 w-2.5 inline mr-0.5" />{m.duration_minutes}m</span>}
                    <span>{m.difficulty_level}</span>
                  </div>
                </div>
                {expandedId === m.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedId === m.id && (
                <div className="border-t border-border/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase">Slides</h5>
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => setShowNewSlide(true)}>
                      <Plus className="h-3 w-3" /> Add Slide
                    </Button>
                  </div>
                  {slidesLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (
                    <div className="space-y-1.5">
                      {slides.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 rounded border border-border/30 px-3 py-1.5 text-xs">
                          <span className="font-mono text-muted-foreground w-6">{s.slide_number}.</span>
                          <span className="flex-1 truncate">{s.title}</span>
                          <button onClick={() => handleDeleteSlide(s.id)} className="text-muted-foreground/50 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      ))}
                      {slides.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No slides yet</p>}
                    </div>
                  )}
                  {showNewSlide && (
                    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <Input placeholder="Slide Title *" value={nsTitle} onChange={(e) => setNsTitle(e.target.value)} className="h-8 text-sm" />
                      <textarea placeholder="HTML Content (optional)" value={nsContent} onChange={(e) => setNsContent(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={handleCreateSlide} disabled={savingSlide}>
                          {savingSlide ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewSlide(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
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
