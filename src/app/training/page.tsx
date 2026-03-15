"use client";

import { GraduationCap, BookOpen, Target, CalendarOff, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard-layout";

const SECTIONS = [
  {
    title: "Field Manual",
    description: "SOPs, protocols, and reference materials",
    href: "/knowledge-base",
    icon: BookOpen,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Drills",
    description: "Training assessments and readiness checks",
    href: "/quizzes",
    icon: Target,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    title: "Leave Requests",
    description: "Request and track leave days",
    href: "/time-off",
    icon: CalendarOff,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
];

export default function TrainingPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training & Readiness</h1>
          <p className="text-sm text-muted-foreground">
            Courses, certifications, SOPs, and leave management
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {SECTIONS.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="group h-full cursor-pointer border-border/40 transition-all hover:border-primary/30 hover:shadow-lg hover:-translate-y-1">
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${section.bg} transition-transform group-hover:scale-110`}>
                    <section.icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold flex items-center gap-1">
                      {section.title}
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Progress placeholder */}
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-semibold">Your Training Progress</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Assigned courses, certification status, and completion history will appear here as your organization sets up training programs.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
