"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Search, Copy, Check, Loader2, Clock, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyMembers, getCompanyDetails, getCompanyTimesheets, approveTimesheet, updateMemberRole, removeMember } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sheet = any;

export default function AdminStaffPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"roster" | "timesheets">("roster");
  const [timesheets, setTimesheets] = useState<Sheet[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const [m, company, ts] = await Promise.all([
        getCompanyMembers(activeCompanyId),
        getCompanyDetails(activeCompanyId),
        getCompanyTimesheets(activeCompanyId),
      ]);
      setMembers(m);
      setJoinCode(company?.join_code ?? "");
      setTimesheets(ts.filter((t: Sheet) => t.clock_out));
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    setChangingRole(membershipId);
    try { await updateMemberRole(membershipId, newRole); await load(); }
    catch (err) { console.error(err); }
    finally { setChangingRole(null); }
  }

  async function handleRemoveMember(membershipId: string, name: string) {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    setRemovingMember(membershipId);
    try { await removeMember(membershipId); await load(); }
    catch (err) { console.error(err); }
    finally { setRemovingMember(null); }
  }

  async function handleApprove(id: string) {
    setApproving(id);
    try { await approveTimesheet(id); await load(); }
    catch (err) { console.error(err); }
    finally { setApproving(null); }
  }

  const filtered = members.filter((m: Member) => {
    const name = `${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const pendingSheets = timesheets.filter((t: Sheet) => !t.approved);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><Users className="h-5 w-5 sm:h-6 sm:w-6" /> PERSONNEL</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage team members and timesheets</p>
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

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          <button onClick={() => setTab("roster")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === "roster" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            Roster ({members.length})
          </button>
          <button onClick={() => setTab("timesheets")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === "timesheets" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            Timesheets {pendingSheets.length > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-amber-500/20 text-amber-600">{pendingSheets.length}</Badge>}
          </button>
        </div>

        {tab === "roster" && (
          <>
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
                      <div className="relative">
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          disabled={changingRole === m.id || m.role === "owner"}
                          className="h-6 appearance-none rounded border border-border/40 bg-background px-2 pr-5 text-[10px] font-medium capitalize cursor-pointer disabled:opacity-50"
                        >
                          {["owner", "admin", "manager", "staff"].map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                      </div>
                      <Badge variant={m.status === "active" ? "default" : "outline"} className="text-[10px] capitalize">{m.status}</Badge>
                      {m.role !== "owner" && (
                        <button onClick={() => handleRemoveMember(m.id, `${u?.first_name} ${u?.last_name}`)} disabled={removingMember === m.id}
                          className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Remove member">
                          {removingMember === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "timesheets" && (
          <>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : timesheets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No timesheets yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">Timesheets will appear here as your team clocks in and out.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {timesheets.map((t: Sheet) => {
                  const hrs = ((new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime()) / 3600000).toFixed(1);
                  const u = t.users;
                  return (
                    <div key={t.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-xs font-bold text-green-600">
                        {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{u?.first_name} {u?.last_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.clock_in).toLocaleDateString()} · {new Date(t.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(t.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold">{hrs}h</span>
                      {t.approved ? (
                        <Badge className="text-[10px] bg-green-500/15 text-green-600">Approved</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => handleApprove(t.id)} disabled={approving === t.id}>
                          {approving === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
