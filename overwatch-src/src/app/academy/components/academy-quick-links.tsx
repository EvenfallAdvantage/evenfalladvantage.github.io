"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, FileText, Target, Zap, ShieldCheck, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AcademyQuickLinksProps {
  folderCount: number;
  quizCount: number;
  activeOwCertsCount: number;
  expiringSoonCount: number;
  owProgress: number;
}

export default function AcademyQuickLinks({ folderCount, quizCount, activeOwCertsCount, expiringSoonCount, owProgress }: AcademyQuickLinksProps) {
  return (
    <>
      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/knowledge-base">
          <Card className="group relative h-full cursor-pointer overflow-hidden border-border/40 transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-1">
            <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-blue-500/5 transition-transform group-hover:scale-150" />
            <CardContent className="relative flex items-start gap-4 p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 transition-transform group-hover:scale-110">
                <BookOpen className="h-7 w-7 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base">Field Manual</h3>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">SOPs, protocols, and reference materials</p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-mono"><FileText className="mr-1 h-3 w-3" />{folderCount} {folderCount === 1 ? "section" : "sections"}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/quizzes">
          <Card className="group relative h-full cursor-pointer overflow-hidden border-border/40 transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-1">
            <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-amber-500/5 transition-transform group-hover:scale-150" />
            <CardContent className="relative flex items-start gap-4 p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 transition-transform group-hover:scale-110">
                <Target className="h-7 w-7 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base">Drills</h3>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Training assessments and readiness checks</p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-mono"><Zap className="mr-1 h-3 w-3" />{quizCount} {quizCount === 1 ? "drill" : "drills"} available</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Status cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          <div><p className="text-xs text-muted-foreground">Certifications</p><p className="text-sm font-semibold font-mono">{activeOwCertsCount}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div><p className="text-xs text-muted-foreground">Expiring Soon</p><p className="text-sm font-semibold font-mono">{expiringSoonCount}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <div><p className="text-xs text-muted-foreground">Module Progress</p><p className="text-sm font-semibold font-mono">{owProgress}%</p></div>
        </div>
      </div>
    </>
  );
}
