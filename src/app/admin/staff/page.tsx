"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Search, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyMembers, getCompanyDetails } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

export default function AdminStaffPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const [m, company] = await Promise.all([
        getCompanyMembers(activeCompanyId),
        getCompanyDetails(activeCompanyId),
      ]);
      setMembers(m);
      setJoinCode(company?.join_code ?? "");
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filtered = members.filter((m: Member) => {
    const name = `${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Personnel</h1>
            <p className="text-sm text-muted-foreground">Manage team members and assignments</p>
          </div>
          {joinCode && (
            <Button size="sm" variant="outline" className="gap-1.5 font-mono" onClick={copyCode}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {joinCode}
            </Button>
          )}
        </div>

        {joinCode && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-2 text-xs text-muted-foreground">
            Share the code <span className="font-mono font-bold text-foreground">{joinCode}</span> with team members so they can join your organization.
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search personnel..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{members.length === 0 ? "No personnel yet" : "No matches"}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {members.length === 0 ? "Share your company code to recruit team members." : "Try a different search."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m: Member) => {
              const u = m.users;
              return (
                <div key={m.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{u?.first_name} {u?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{u?.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize">{m.role}</Badge>
                  <Badge variant={m.status === "active" ? "default" : "outline"} className="text-[10px] capitalize">{m.status}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
