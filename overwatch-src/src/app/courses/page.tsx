"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import {
  BookOpen, Clock, Loader2, CheckCircle2,
  GraduationCap, BarChart3, ShoppingCart, XCircle, Star, DollarSign,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getUserPayments, getCatalogCourses } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Course = any;

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-600",
  intermediate: "bg-blue-500/15 text-blue-600",
  advanced: "bg-purple-500/15 text-purple-600",
  expert: "bg-red-500/15 text-red-600",
};

// Normalize Supabase course rows to a common shape
// Course System schema uses course_name; Overwatch schema uses title
function normalizeCourse(row: Record<string, unknown>): Course {
  return {
    ...row,
    title: (row.title as string) || (row.course_name as string) || "Untitled",
    difficulty_level: ((row.difficulty_level as string) || "beginner").toLowerCase(),
    price: (row.price as number) ?? 0,
    duration_hours: (row.duration_hours as number) ?? 1,
    is_active: row.is_active !== false,
  };
}

function CoursesContent() {
  const user = useAuthStore((s) => s.user);
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasedCourses, setPurchasedCourses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const status = searchParams.get("status");

  const loadData = useCallback(async () => {
    try {
      const [rawCourses, payments] = await Promise.all([
        getCatalogCourses().catch(() => []),
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

        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" /> COURSES
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Professional security training courses</p>
        </div>

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
