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
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getUserPayments } from "@/lib/supabase/db";

type Course = {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_hours: number;
  difficulty_level: string;
  is_required: boolean;
  thumbnail_url: string | null;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-600",
  intermediate: "bg-blue-500/15 text-blue-600",
  advanced: "bg-purple-500/15 text-purple-600",
  expert: "bg-red-500/15 text-red-600",
};

// Demo courses for the catalog — in production these come from Supabase
const DEMO_COURSES: Course[] = [
  {
    id: "course-guard-fundamentals",
    title: "Security Guard Fundamentals",
    description: "Complete foundational course covering patrol techniques, report writing, legal authority, and professional conduct. Required for all new security professionals.",
    price: 49.99,
    duration_hours: 8,
    difficulty_level: "beginner",
    is_required: true,
    thumbnail_url: null,
  },
  {
    id: "course-use-of-force",
    title: "Use of Force Continuum",
    description: "Comprehensive training on the use of force continuum, legal considerations, documentation requirements, and de-escalation techniques that align with state regulations.",
    price: 79.99,
    duration_hours: 6,
    difficulty_level: "intermediate",
    is_required: true,
    thumbnail_url: null,
  },
  {
    id: "course-emergency-response",
    title: "Emergency Response & Crisis Management",
    description: "Advanced training in emergency procedures, crisis communication, evacuation protocols, and coordination with law enforcement and emergency services.",
    price: 99.99,
    duration_hours: 10,
    difficulty_level: "advanced",
    is_required: false,
    thumbnail_url: null,
  },
  {
    id: "course-event-security",
    title: "Event Security Operations",
    description: "Specialized training for large venue and event security including crowd management, VIP protection, access control, and incident response at scale.",
    price: 129.99,
    duration_hours: 12,
    difficulty_level: "advanced",
    is_required: false,
    thumbnail_url: null,
  },
  {
    id: "course-surveillance",
    title: "Surveillance & CCTV Operations",
    description: "Technical training on surveillance systems, CCTV monitoring, suspicious behavior identification, and evidence preservation for investigations.",
    price: 59.99,
    duration_hours: 4,
    difficulty_level: "intermediate",
    is_required: false,
    thumbnail_url: null,
  },
  {
    id: "course-firearms",
    title: "Armed Security Certification Prep",
    description: "Preparation course for armed security certification covering firearms safety, marksmanship fundamentals, legal liability, and weapons retention.",
    price: 199.99,
    duration_hours: 16,
    difficulty_level: "expert",
    is_required: false,
    thumbnail_url: null,
  },
];

function CoursesContent() {
  const user = useAuthStore((s) => s.user);
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const searchParams = useSearchParams();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasedCourses, setPurchasedCourses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const status = searchParams.get("status");

  const loadPayments = useCallback(async () => {
    try {
      const payments = await getUserPayments();
      const purchased = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of payments as any[]) {
        if (p.status === "completed" && p.course_id) purchased.add(p.course_id);
      }
      setPurchasedCourses(purchased);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

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

  const totalCourses = DEMO_COURSES.length;
  const ownedCount = purchasedCourses.size;

  return (
    <DashboardLayout>
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
          <h1 className="text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> COURSE CATALOG
          </h1>
          <p className="text-sm text-muted-foreground">Professional security training courses with certification</p>
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
              {DEMO_COURSES.filter((c) => c.is_required).length}
            </p>
            <p className="text-[10px] text-muted-foreground">Required</p>
          </CardContent></Card>
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {DEMO_COURSES.map((course) => {
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
        )}

        {/* Info */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Payment Info</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>- Payments are securely processed by <strong>Stripe</strong></p>
              <p>- All purchases include a certificate of completion</p>
              <p>- Courses are accessible immediately after purchase</p>
              <p>- Company admins can bulk-enroll team members separately</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></DashboardLayout>}>
      <CoursesContent />
    </Suspense>
  );
}
