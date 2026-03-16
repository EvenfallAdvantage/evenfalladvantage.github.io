"use client";

import { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Settings, FileText, Activity, FolderOpen, Loader2, Clock } from "lucide-react";
import Link from "next/link";
import { updateUserProfile, getUserFormSubmissions, getRecentTimesheets, getUserQuizAttempts } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sub = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Attempt = any;

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<Sub[]>([]);
  const [timesheets, setTimesheets] = useState<Sheet[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<Attempt[]>([]);
  const [tabLoaded, setTabLoaded] = useState<Record<string, boolean>>({});

  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  function startEdit() {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setPhone(user?.phone ?? "");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateUserProfile({ firstName, lastName, phone });
      if (user) setUser({ ...user, firstName, lastName, phone });
      setEditing(false);
    } catch (err) { console.error("Save profile failed:", err); }
    finally { setSaving(false); }
  }

  const loadSubmissions = useCallback(async () => {
    if (tabLoaded.submissions) return;
    try { setSubmissions(await getUserFormSubmissions()); } catch {}
    setTabLoaded((p) => ({ ...p, submissions: true }));
  }, [tabLoaded.submissions]);

  const loadActivity = useCallback(async () => {
    if (tabLoaded.activity) return;
    try {
      const [ts, qa] = await Promise.all([getRecentTimesheets(10), getUserQuizAttempts()]);
      setTimesheets(ts.filter((t: Sheet) => t.clock_out));
      setQuizAttempts(qa);
    } catch {}
    setTabLoaded((p) => ({ ...p, activity: true }));
  }, [tabLoaded.activity]);

  function onTabChange(val: string) {
    if (val === "submissions") loadSubmissions();
    if (val === "activity") loadActivity();
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-lg font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">
                {user?.firstName ?? "Your"} {user?.lastName ?? "Name"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs capitalize">
                  {activeCompany?.role ?? "Staff"}
                </Badge>
              </div>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          {/* Personal Details */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Personal details</CardTitle>
              {!editing && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {editing ? (
                <>
                  <div>
                    <span className="text-muted-foreground text-xs">First name</span>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Last name</span>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Email</span>
                    <p className="font-medium truncate text-muted-foreground">{user?.email ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Phone</span>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-8 text-sm" placeholder="(555) 123-4567" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditing(false)}>
                      <X className="h-3 w-3" /> Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-muted-foreground text-xs">First name</span>
                    <p className="font-medium">{user?.firstName ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Last name</span>
                    <p className="font-medium">{user?.lastName ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Email</span>
                    <p className="font-medium truncate">{user?.email ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Phone</span>
                    <p className="font-medium">{user?.phone ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Nickname / Callsign</span>
                    <p className="font-medium">{activeCompany?.membership?.nickname ?? "—"}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
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
                        const hrs = ((new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime()) / 3600000).toFixed(1);
                        return (
                          <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                            <Clock className="h-4 w-4 text-green-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">Shift — {hrs}h</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(t.clock_in).toLocaleDateString()}</p>
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
        </div>
      </div>
    </>
  );
}
