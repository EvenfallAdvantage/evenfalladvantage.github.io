"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Save, Calendar, Users, Clock, XCircle, ChevronDown, ChevronUp,
  UserCheck, UserX,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getLegacyClasses, createLegacyClass, updateLegacyClass,
  getClassEnrollments, markAttendance, getClassAttendance,
  type LegacyScheduledClass, type ClassEnrollmentRow, type ClassAttendanceRow,
} from "@/lib/legacy-bridge";
import { logger } from "@/lib/logger";

interface ClassesTabProps {
  instructorId: string | null;
  triggerNew: number;
}

export function ClassesTab({ instructorId, triggerNew }: ClassesTabProps) {
  const [classes, setClasses] = useState<LegacyScheduledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (triggerNew > 0) setShowNew(true);
  }, [triggerNew]);
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
    try { setClasses(await getLegacyClasses(instructorId ?? undefined)); } catch (e) { logger.swallow("instructor-classes:load", e, "warn"); }
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
    } catch (e) { logger.swallow("instructor-classes:load-enrollments", e, "warn"); }
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
                      <span><Users className="h-2.5 w-2.5 inline mr-0.5" />{enrolled}/{cls.max_students ?? "\u221E"}</span>
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
