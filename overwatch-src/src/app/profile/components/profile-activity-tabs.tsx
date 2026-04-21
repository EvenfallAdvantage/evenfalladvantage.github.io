"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Activity, FolderOpen, Loader2, Clock } from "lucide-react";
import { getUserFormSubmissions, getRecentTimesheets, getUserQuizAttempts } from "@/lib/supabase/db";
import { parseUTC } from "@/lib/parse-utc";
import type { Sub, Sheet, Attempt } from "./types";
import { logger } from "@/lib/logger";

interface Props {
  activeCompanyId: string | null;
}

export function ProfileActivityTabs({ activeCompanyId }: Props) {
  const [submissions, setSubmissions] = useState<Sub[]>([]);
  const [timesheets, setTimesheets] = useState<Sheet[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<Attempt[]>([]);
  const [tabLoaded, setTabLoaded] = useState<Record<string, boolean>>({});

  const loadSubmissions = useCallback(async () => {
    if (tabLoaded.submissions) return;
    try { setSubmissions(await getUserFormSubmissions(activeCompanyId ?? undefined)); } catch (e) { logger.swallow("profile-activity:load-submissions", e, "debug"); }
    setTabLoaded((p) => ({ ...p, submissions: true }));
  }, [tabLoaded.submissions, activeCompanyId]);

  const loadActivity = useCallback(async () => {
    if (tabLoaded.activity) return;
    try {
      const [ts, qa] = await Promise.all([getRecentTimesheets(10, activeCompanyId ?? undefined), getUserQuizAttempts()]);
      setTimesheets(ts.filter((t: Sheet) => t.clock_out));
      setQuizAttempts(qa);
    } catch (e) { logger.swallow("profile-activity:load-activity", e, "warn"); }
    setTabLoaded((p) => ({ ...p, activity: true }));
  }, [tabLoaded.activity, activeCompanyId]);

  function onTabChange(val: string) {
    if (val === "submissions") loadSubmissions();
    if (val === "activity") loadActivity();
  }

  return (
    <Tabs defaultValue="shared" onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="shared" className="gap-1.5 text-xs">
          <FolderOpen className="h-3.5 w-3.5" />
          Shared with me
        </TabsTrigger>
        <TabsTrigger value="submissions" className="gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" />
          My submissions
        </TabsTrigger>
        <TabsTrigger value="activity" className="gap-1.5 text-xs">
          <Activity className="h-3.5 w-3.5" />
          My activity
        </TabsTrigger>
      </TabsList>

      <TabsContent value="shared">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No entries to display</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Shared entries will be displayed here. Your teammates may share
              Forms and checklists entries with you.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="submissions">
        <Card>
          <CardContent className="py-4">
            {!tabLoaded.submissions ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No submissions yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Forms you submit will appear here for tracking.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.map((s: Sub) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                    <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.forms?.name ?? "Form"}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] capitalize">{s.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="activity">
        <Card>
          <CardContent className="py-4">
            {!tabLoaded.activity ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : timesheets.length === 0 && quizAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Your clock-ins, training progress, and other activity will show here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {timesheets.map((t: Sheet) => {
                  const hrs = ((parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000).toFixed(1);
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                      <Clock className="h-4 w-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Shift — {hrs}h</p>
                        <p className="text-[10px] text-muted-foreground">{parseUTC(t.clock_in).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={t.approved ? "default" : "secondary"} className="text-[10px]">
                        {t.approved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                  );
                })}
                {quizAttempts.map((a: Attempt) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                    <Activity className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Drill: {a.quizzes?.title ?? "Quiz"}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(a.started_at).toLocaleDateString()}</p>
                    </div>
                    <Badge className={`text-[10px] ${a.passed ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
                      {a.score}% — {a.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
