"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, CalendarDays, Award, CheckCircle2, Clock,
  Plus, Loader2, ChevronRight, MapPin, UserCheck,
  UserX, RefreshCw, GraduationCap, ArrowLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { ensureInstructorLinked } from "@/lib/account-linker";
import {
  getAllLegacyClasses,
  getLegacyStudents,
  createLegacyClass,
  getClassEnrollments,
  getClassAttendance,
  markAttendance,
  enrollStudentInClass,
  issueLegacyCertificate,
  type LegacyScheduledClass,
  type LegacyStudent,
  type ClassEnrollmentRow,
  type ClassAttendanceRow,
} from "@/lib/legacy-bridge";

type Tab = "classes" | "students" | "certificates";

export default function InstructorManagePage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("classes");
  const [loading, setLoading] = useState(true);
  const [instructorId, setInstructorId] = useState<string | null>(null);

  // Data
  const [classes, setClasses] = useState<LegacyScheduledClass[]>([]);
  const [students, setStudents] = useState<LegacyStudent[]>([]);

  // Class detail
  const [selectedClass, setSelectedClass] = useState<LegacyScheduledClass | null>(null);
  const [classEnrollments, setClassEnrollments] = useState<ClassEnrollmentRow[]>([]);
  const [classAttendance, setClassAttendance] = useState<ClassAttendanceRow[]>([]);
  const [classLoading, setClassLoading] = useState(false);

  // New class form
  const [showNewClass, setShowNewClass] = useState(false);
  const [newClass, setNewClass] = useState({ class_name: "", description: "", scheduled_date: "", start_time: "", end_time: "", location: "", max_students: "20" });
  const [saving, setSaving] = useState(false);

  // Certificate form
  const [certStudent, setCertStudent] = useState("");
  const [certName, setCertName] = useState("");
  const [certType, setCertType] = useState("completion");
  const [certState, setCertState] = useState("");
  const [issuingCert, setIssuingCert] = useState(false);
  const [certSuccess, setCertSuccess] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const iId = await ensureInstructorLinked({
        id: user.id,
        email: user.email,
        firstName: (user as Record<string, unknown>).firstName as string | undefined,
        lastName: (user as Record<string, unknown>).lastName as string | undefined,
      });
      setInstructorId(iId);
      if (iId) {
        const [c, s] = await Promise.all([getAllLegacyClasses(iId), getLegacyStudents()]);
        setClasses(c);
        setStudents(s);
      }
    } catch (err) {
      console.error("Instructor load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function openClassDetail(cls: LegacyScheduledClass) {
    setSelectedClass(cls);
    setClassLoading(true);
    try {
      const [enr, att] = await Promise.all([getClassEnrollments(cls.id), getClassAttendance(cls.id)]);
      setClassEnrollments(enr);
      setClassAttendance(att);
    } catch { /* ignore */ }
    setClassLoading(false);
  }

  async function handleCreateClass() {
    if (!instructorId || !newClass.class_name || !newClass.scheduled_date || !newClass.start_time) return;
    setSaving(true);
    const res = await createLegacyClass({
      instructor_id: instructorId,
      class_name: newClass.class_name,
      description: newClass.description || undefined,
      scheduled_date: newClass.scheduled_date,
      start_time: newClass.start_time,
      end_time: newClass.end_time || undefined,
      location: newClass.location || undefined,
      max_students: parseInt(newClass.max_students) || 20,
    });
    if (res.success) {
      setShowNewClass(false);
      setNewClass({ class_name: "", description: "", scheduled_date: "", start_time: "", end_time: "", location: "", max_students: "20" });
      await loadData();
    }
    setSaving(false);
  }

  async function handleMarkAttendance(classId: string, studentId: string, status: "present" | "absent" | "late" | "excused") {
    await markAttendance(classId, studentId, status);
    if (selectedClass) openClassDetail(selectedClass);
  }

  async function handleEnrollStudent(classId: string, studentId: string) {
    await enrollStudentInClass(classId, studentId);
    if (selectedClass) openClassDetail(selectedClass);
  }

  async function handleIssueCert() {
    if (!instructorId || !certStudent || !certName) return;
    setIssuingCert(true);
    const res = await issueLegacyCertificate({
      student_id: certStudent,
      issued_by: instructorId,
      certificate_type: certType,
      certificate_name: certName,
      state_issued: certState || undefined,
    });
    if (res.success) {
      setCertSuccess(true);
      setCertStudent("");
      setCertName("");
      setCertState("");
      setTimeout(() => setCertSuccess(false), 3000);
    }
    setIssuingCert(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!instructorId) {
    return (
      <div className="text-center py-20 space-y-3">
        <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30" />
        <h2 className="text-lg font-bold">Instructor Access Required</h2>
        <p className="text-sm text-muted-foreground">This feature requires admin or manager role.</p>
      </div>
    );
  }

  // ─── Class Detail View ───
  if (selectedClass) {
    const enrolledIds = new Set(classEnrollments.map((e) => e.student_id));
    const attendanceMap = new Map(classAttendance.map((a) => [a.student_id, a]));
    const unenrolledStudents = students.filter((s) => !enrolledIds.has(s.id));

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedClass(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-bold font-mono">{selectedClass.class_name}</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-3 w-3" /> {selectedClass.scheduled_date}
              <Clock className="h-3 w-3 ml-1" /> {selectedClass.start_time}{selectedClass.end_time ? ` - ${selectedClass.end_time}` : ""}
              {selectedClass.location && <><MapPin className="h-3 w-3 ml-1" /> {selectedClass.location}</>}
            </p>
          </div>
        </div>

        {classLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-border/40"><CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono">{classEnrollments.length}</p>
                <p className="text-[10px] text-muted-foreground">Enrolled</p>
              </CardContent></Card>
              <Card className="border-border/40"><CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono text-green-500">{classAttendance.filter((a) => a.status === "present").length}</p>
                <p className="text-[10px] text-muted-foreground">Present</p>
              </CardContent></Card>
              <Card className="border-border/40"><CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono text-red-500">{classAttendance.filter((a) => a.status === "absent").length}</p>
                <p className="text-[10px] text-muted-foreground">Absent</p>
              </CardContent></Card>
            </div>

            <Card className="border-border/40">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Enrolled Students & Attendance</h3>
                {classEnrollments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No students enrolled yet.</p>
                ) : (
                  <div className="space-y-2">
                    {classEnrollments.map((enr) => {
                      const att = attendanceMap.get(enr.student_id);
                      return (
                        <div key={enr.student_id} className="flex items-center justify-between p-2 rounded-lg border border-border/30">
                          <div>
                            <p className="text-sm font-medium">
                              {enr.student?.first_name} {enr.student?.last_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{enr.student?.email}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {att && (
                              <Badge className={`text-[9px] mr-1 ${att.status === "present" ? "bg-green-500/15 text-green-600" : att.status === "absent" ? "bg-red-500/15 text-red-600" : att.status === "late" ? "bg-amber-500/15 text-amber-600" : "bg-blue-500/15 text-blue-600"}`}>
                                {att.status}
                              </Badge>
                            )}
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-500" title="Present"
                              onClick={() => handleMarkAttendance(selectedClass.id, enr.student_id, "present")}>
                              <UserCheck className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" title="Absent"
                              onClick={() => handleMarkAttendance(selectedClass.id, enr.student_id, "absent")}>
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {unenrolledStudents.length > 0 && (
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Add Students</h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {unenrolledStudents.slice(0, 20).map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                        <p className="text-xs">{s.first_name} {s.last_name} <span className="text-muted-foreground">({s.email})</span></p>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                          onClick={() => handleEnrollStudent(selectedClass.id, s.id)}>
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── Tabs ───
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "classes", label: "Classes", icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: "students", label: "Students", icon: <Users className="h-3.5 w-3.5" /> },
    { id: "certificates", label: "Certificates", icon: <Award className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight font-mono flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> INSTRUCTOR HQ
          </h1>
          <p className="text-xs text-muted-foreground">Manage classes, students, and certifications</p>
        </div>
        <Button size="sm" variant="ghost" className="gap-1" onClick={loadData}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── Classes Tab ─── */}
      {tab === "classes" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{classes.length} classes</p>
            <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowNewClass(!showNewClass)}>
              <Plus className="h-3 w-3" /> New Class
            </Button>
          </div>

          {showNewClass && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">Schedule New Class</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold block mb-1">Class Name *</label>
                    <Input placeholder="e.g. Unarmed Guard Core - Session 5" value={newClass.class_name}
                      onChange={(e) => setNewClass({ ...newClass, class_name: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1">Date *</label>
                    <Input type="date" value={newClass.scheduled_date}
                      onChange={(e) => setNewClass({ ...newClass, scheduled_date: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1">Start Time *</label>
                    <Input type="time" value={newClass.start_time}
                      onChange={(e) => setNewClass({ ...newClass, start_time: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1">End Time</label>
                    <Input type="time" value={newClass.end_time}
                      onChange={(e) => setNewClass({ ...newClass, end_time: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1">Location</label>
                    <Input placeholder="Room / Address" value={newClass.location}
                      onChange={(e) => setNewClass({ ...newClass, location: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1">Max Students</label>
                    <Input type="number" value={newClass.max_students}
                      onChange={(e) => setNewClass({ ...newClass, max_students: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1">Description</label>
                    <Input placeholder="Optional notes" value={newClass.description}
                      onChange={(e) => setNewClass({ ...newClass, description: e.target.value })} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="gap-1 text-xs" onClick={handleCreateClass} disabled={saving || !newClass.class_name || !newClass.scheduled_date || !newClass.start_time}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Create
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowNewClass(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {classes.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-8 text-center">
                <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold">No classes yet</p>
                <p className="text-xs text-muted-foreground">Schedule your first class above</p>
              </CardContent>
            </Card>
          ) : (
            classes.map((cls) => {
              const isPast = new Date(cls.scheduled_date) < new Date();
              const enrollCount = Array.isArray(cls.enrollments) && cls.enrollments[0] ? (cls.enrollments[0] as { count: number }).count : 0;
              return (
                <Card key={cls.id} className={`border-border/40 hover:border-primary/30 cursor-pointer transition-all ${isPast ? "opacity-60" : ""}`}
                  onClick={() => openClassDetail(cls)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{cls.class_name}</h3>
                        <Badge className={`text-[9px] ${cls.status === "scheduled" ? "bg-blue-500/15 text-blue-600" : cls.status === "completed" ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                          {cls.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><CalendarDays className="h-3 w-3" /> {cls.scheduled_date}</span>
                        <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {cls.start_time}</span>
                        {cls.location && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {cls.location}</span>}
                        <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {enrollCount}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ─── Students Tab ─── */}
      {tab === "students" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{students.length} students in legacy system</p>
          {students.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-8 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold">No students found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {students.map((s) => (
                <Card key={s.id} className="border-border/40">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.email}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Certificates Tab ─── */}
      {tab === "certificates" && (
        <div className="space-y-4">
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Award className="h-4 w-4" /> Issue Certificate</h3>
              {certSuccess && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <p className="text-xs text-green-600 font-medium">Certificate issued successfully!</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold block mb-1">Student *</label>
                  <select value={certStudent} onChange={(e) => setCertStudent(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs">
                    <option value="">Select student...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.email})</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold block mb-1">Certificate Name *</label>
                  <Input placeholder="e.g. Unarmed Guard Core Completion" value={certName}
                    onChange={(e) => setCertName(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold block mb-1">Type</label>
                  <select value={certType} onChange={(e) => setCertType(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs">
                    <option value="completion">Completion</option>
                    <option value="training">Training</option>
                    <option value="license">License</option>
                    <option value="certification">Certification</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold block mb-1">State</label>
                  <Input placeholder="e.g. FL, TX" value={certState}
                    onChange={(e) => setCertState(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <Button size="sm" className="gap-1 text-xs" onClick={handleIssueCert}
                disabled={issuingCert || !certStudent || !certName}>
                {issuingCert ? <Loader2 className="h-3 w-3 animate-spin" /> : <Award className="h-3 w-3" />}
                Issue Certificate
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
