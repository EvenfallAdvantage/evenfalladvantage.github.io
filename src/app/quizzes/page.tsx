"use client";

import { useEffect, useState, useCallback } from "react";
import { Target, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getQuizzes, createQuiz } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quiz = any;

export default function QuizzesPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = ["owner", "admin", "manager"].includes(activeCompany?.role ?? "");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setQuizzes(await getQuizzes(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newTitle.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createQuiz({ companyId: activeCompanyId, title: newTitle.trim() });
      setNewTitle(""); setShowCreate(false); await load();
    } catch (err) { console.error("Create quiz failed:", err); }
    finally { setCreating(false); }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Drills</h1>
            <p className="text-sm text-muted-foreground">Training assessments and readiness checks</p>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New Drill
            </Button>
          )}
        </div>

        {showCreate && (
          <div className="flex gap-2 rounded-xl border border-primary/30 bg-card p-4">
            <Input placeholder="Drill title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Target className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No drills configured</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {isAdmin ? "Create your first drill to assess team readiness." : "Your organization hasn't set up any drills yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q: Quiz) => (
              <div key={q.id} className="rounded-xl border border-border/50 bg-card p-4 cursor-pointer transition-colors hover:border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                    <Target className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{q.title}</p>
                    {q.description && <p className="text-xs text-muted-foreground truncate">{q.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">Pass: {q.passing_score}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
