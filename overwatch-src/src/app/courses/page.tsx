"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import {
  Video, BookOpen, Clock, Loader2, CheckCircle2,
  GraduationCap, BarChart3, ShoppingCart, XCircle, Star, DollarSign,
  Copy, Users, ExternalLink, Mic, MicOff, VideoOff, LogOut, Check, Link2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { getUserPayments } from "@/lib/supabase/db";
import { getLegacyCourses } from "@/lib/legacy-bridge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Course = any;

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-600",
  intermediate: "bg-blue-500/15 text-blue-600",
  advanced: "bg-purple-500/15 text-purple-600",
  expert: "bg-red-500/15 text-red-600",
};

// Normalize legacy course rows to the shape expected by the UI
function normalizeCourse(row: Record<string, unknown>): Course {
  return {
    ...row,
    title: (row.course_name as string) || (row.title as string) || "Untitled",
    difficulty_level: ((row.difficulty_level as string) || "beginner").toLowerCase(),
    price: (row.price as number) ?? 0,
    duration_hours: (row.duration_hours as number) ?? 1,
    is_active: row.is_active !== false,
  };
}

type SessionState = "setup" | "live" | "ended";
type PageTab = "courses" | "conference";

function CoursesContent() {
  const user = useAuthStore((s) => s.user);
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const searchParams = useSearchParams();
  const [pageTab, setPageTab] = useState<PageTab>("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasedCourses, setPurchasedCourses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // ── Conference state ──
  const [sessionState, setSessionState] = useState<SessionState>("setup");
  const [roomUrl, setRoomUrl] = useState("");
  const [instructorName, setInstructorName] = useState(
    user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : ""
  );
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sessionState === "live") {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionState]);

  function fmtDuration(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function startSession() { if (!roomUrl.trim()) return; setSessionState("live"); setDuration(0); }
  function endSession() { setSessionState("ended"); if (timerRef.current) clearInterval(timerRef.current); }
  function resetSession() { setSessionState("setup"); setDuration(0); setRoomUrl(""); }
  function copyStudentLink() {
    const link = requirePassword ? `${roomUrl}?password=${password}` : roomUrl;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const status = searchParams.get("status");

  const loadData = useCallback(async () => {
    try {
      const [rawCourses, payments] = await Promise.all([
        getLegacyCourses().catch(() => []),
        getUserPayments().catch(() => []),
      ]);
      setCourses(rawCourses.map(normalizeCourse));
      const purchased = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of payments as any[]) {
        if (p.status === "completed" && p.course_id) purchased.add(p.course_id);
      }
      setPurchasedCourses(purchased);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handlePurchase(course: Course) {
    setPurchasing(course.id);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          courseTitle: course.title,
          priceInCents: Math.round(course.price * 100),
          userId: user?.id || "",
          companyId: activeCompanyId && activeCompanyId !== "pending" ? activeCompanyId : "",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned:", data);
      }
    } catch (err) { console.error("Purchase error:", err); }
    finally { setPurchasing(null); }
  }

  const totalCourses = courses.length;
  const ownedCount = purchasedCourses.size;

  return (
    <>
      <div className="space-y-6">
        {/* Status banners from Stripe redirect */}
        {status === "success" && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Payment successful! You&apos;ve been enrolled in the course.
          </div>
        )}
        {status === "cancelled" && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2 text-sm text-amber-600">
            <XCircle className="h-4 w-4" /> Payment was cancelled. No charges were made.
          </div>
        )}

        {/* Header + Tabs */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <Video className="h-5 w-5 sm:h-6 sm:w-6" /> COURSES
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Professional security training courses</p>
          <div className="flex items-center gap-1 mt-3 border-b border-border/40">
            <button onClick={() => setPageTab("courses")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${pageTab === "courses" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <ShoppingCart className="h-3.5 w-3.5 inline mr-1.5" />Courses
            </button>
            <button onClick={() => setPageTab("conference")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${pageTab === "conference" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Video className="h-3.5 w-3.5 inline mr-1.5" />Conference
            </button>
          </div>
        </div>

        {pageTab === "courses" && <>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono">{totalCourses}</p>
            <p className="text-[10px] text-muted-foreground">Available</p>
          </CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono text-green-500">{ownedCount}</p>
            <p className="text-[10px] text-muted-foreground">Purchased</p>
          </CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono text-primary">
              {courses.filter((c: Course) => c.is_required).length}
            </p>
            <p className="text-[10px] text-muted-foreground">Required</p>
          </CardContent></Card>
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No courses available</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Your organization hasn&apos;t published any courses yet. Admins can create courses from the training admin panel.
            </p>
          </div>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course: Course) => {
              const owned = purchasedCourses.has(course.id);
              const diffColor = DIFFICULTY_COLORS[course.difficulty_level] || DIFFICULTY_COLORS.beginner;
              return (
                <Card key={course.id} className={`border-border/40 overflow-hidden ${owned ? "border-green-500/20" : ""}`}>
                  {/* Color strip */}
                  <div className={`h-1 ${course.is_required ? "bg-amber-500" : "bg-primary/40"}`} />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold leading-tight">{course.title}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={`text-[9px] ${diffColor}`}>{course.difficulty_level}</Badge>
                          {course.is_required && <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Required</Badge>}
                          {owned && <Badge className="text-[9px] bg-green-500/15 text-green-600">Purchased</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold font-mono">${course.price}</p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">{course.description}</p>

                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.duration_hours}h</span>
                      <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {course.difficulty_level}</span>
                      <span className="flex items-center gap-1"><Star className="h-3 w-3" /> Certificate</span>
                    </div>

                    {owned ? (
                      <Button size="sm" className="w-full gap-1.5" variant="outline" disabled>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                      </Button>
                    ) : course.price === 0 ? (
                      <Button size="sm" className="w-full gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5" /> Enroll Free
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full gap-1.5"
                        onClick={() => handlePurchase(course)}
                        disabled={purchasing === course.id}>
                        {purchasing === course.id ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing...</>
                        ) : (
                          <><ShoppingCart className="h-3.5 w-3.5" /> Purchase &amp; Enroll</>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )
        )}

        {/* Info */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Payment Info</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>- Payments are securely processed by <strong>Stripe</strong></p>
              <p>- <strong>Online portion only</strong> — prices listed cover the classroom/theory modules</p>
              <p>- To receive your final certification, you must also complete in-person practical training with a <strong>licensed Evenfall Advantage instructor</strong></p>
              <p>- Instructor fees are paid separately and vary by location</p>
              <p>- Course materials are accessible immediately after purchase</p>
              <p>- Company admins can bulk-enroll team members separately</p>
            </div>
          </CardContent>
        </Card>
        </>}

        {/* ── Conference Tab ── */}
        {pageTab === "conference" && (
          sessionState === "ended" ? (
            <div className="max-w-md mx-auto space-y-4 text-center pt-6">
              <div className="h-16 w-16 rounded-full mx-auto bg-green-500/15 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold font-mono">SESSION ENDED</h2>
              <p className="text-sm text-muted-foreground">
                Session duration: <strong className="font-mono">{fmtDuration(duration)}</strong>
              </p>
              <Button onClick={resetSession} className="gap-1.5">
                <Video className="h-4 w-4" /> Start New Session
              </Button>
            </div>
          ) : sessionState === "live" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <h2 className="text-lg font-bold font-mono">LIVE SESSION</h2>
                  <Badge className="bg-red-500/15 text-red-500 text-xs font-mono">{fmtDuration(duration)}</Badge>
                </div>
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={endSession}>
                  <LogOut className="h-3.5 w-3.5" /> End Session
                </Button>
              </div>
              <Card className="border-border/40 overflow-hidden">
                <div className="aspect-video bg-black relative">
                  <iframe src={roomUrl} allow="camera; microphone; fullscreen; display-capture"
                    className="w-full h-full border-0" title="Training Session" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    <Button size="sm" variant={muted ? "destructive" : "secondary"} className="h-9 w-9 p-0 rounded-full"
                      onClick={() => setMuted(!muted)}>
                      {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant={camOff ? "destructive" : "secondary"} className="h-9 w-9 p-0 rounded-full"
                      onClick={() => setCamOff(!camOff)}>
                      {camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-border/40"><CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Users className="h-3 w-3" /> Instructor</p>
                  <p className="text-sm font-semibold">{instructorName || "Instructor"}</p>
                </CardContent></Card>
                <Card className="border-border/40"><CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Duration</p>
                  <p className="text-sm font-semibold font-mono">{fmtDuration(duration)}</p>
                </CardContent></Card>
              </div>
              <Card className="border-border/40"><CardContent className="p-4">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Student Join Link</p>
                <div className="flex gap-2">
                  <Input readOnly value={requirePassword ? `${roomUrl}?password=${password}` : roomUrl} className="text-xs font-mono" />
                  <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={copyStudentLink}>
                    {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </Button>
                </div>
              </CardContent></Card>
            </div>
          ) : (
            <div className="max-w-xl mx-auto space-y-6">
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Room URL *</label>
                    <Input placeholder="https://your-domain.daily.co/room-name" value={roomUrl}
                      onChange={(e) => setRoomUrl(e.target.value)} />
                    <p className="text-[10px] text-muted-foreground mt-1">Paste your Daily.co or video conference room URL</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Instructor Name</label>
                    <Input value={instructorName} onChange={(e) => setInstructorName(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="reqPw" checked={requirePassword}
                      onChange={(e) => setRequirePassword(e.target.checked)}
                      className="h-4 w-4 rounded border-border" />
                    <label htmlFor="reqPw" className="text-xs font-semibold">Require Password</label>
                  </div>
                  {requirePassword && (
                    <div>
                      <label className="text-xs font-semibold mb-1 block">Room Password</label>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                  )}
                  <Button className="w-full gap-1.5" onClick={startSession} disabled={!roomUrl.trim()}>
                    <Video className="h-4 w-4" /> Start Session
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Quick Start</h3>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>1. Create a room at <a href="https://dashboard.daily.co" target="_blank" rel="noopener noreferrer" className="text-primary underline">Daily.co</a> or your video provider</p>
                    <p>2. Paste the room URL above</p>
                    <p>3. Click <strong>Start Session</strong> to go live</p>
                    <p>4. Share the student join link with trainees</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <a href="https://dashboard.daily.co" target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                        <ExternalLink className="h-3 w-3" /> Open Daily.co Dashboard
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        )}
      </div>
    </>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></>}>
      <CoursesContent />
    </Suspense>
  );
}
