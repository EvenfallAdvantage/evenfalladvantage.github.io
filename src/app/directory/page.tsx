"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Search, Mail, Phone, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyMembers } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

export default function DirectoryPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const data = await getCompanyMembers(activeCompanyId);
      setMembers(data);
    } catch {
      // DB may not be ready
    }
  }, [activeCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = members.filter((m: Member) => {
    const name = `${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const sel = selected?.users;
  const selInitials = sel
    ? (sel.first_name?.[0] ?? "") + (sel.last_name?.[0] ?? "")
    : "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono uppercase">Roster</h1>
          <p className="text-sm text-muted-foreground">
            Personnel directory and contact info
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <div className="space-y-3 rounded-xl border border-border/50 bg-card p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search roster..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {filtered.length} member{filtered.length !== 1 ? "s" : ""}
            </div>
            <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
              {filtered.map((m: Member) => {
                const u = m.users;
                const initials =
                  (u?.first_name?.[0] ?? "") + (u?.last_name?.[0] ?? "");
                const isActive = selected?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                      isActive ? "bg-primary/10 text-primary" : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="truncate block">
                        {u?.first_name} {u?.last_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {m.role}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {members.length === 0
                    ? "No personnel yet. Invite team members to get started."
                    : "No matches found."}
                </p>
              )}
            </div>
          </div>

          {selected && sel ? (
            <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
                  {selInitials}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {sel.first_name} {sel.last_name}
                  </h2>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs capitalize">
                      <Shield className="h-3 w-3 mr-1" />
                      {selected.role}
                    </Badge>
                    {selected.title && (
                      <Badge variant="outline" className="text-xs">
                        {selected.title}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 text-sm">
                {sel.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${sel.email}`} className="hover:text-foreground">
                      {sel.email}
                    </a>
                  </div>
                )}
                {sel.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${sel.phone}`} className="hover:text-foreground">
                      {sel.phone}
                    </a>
                  </div>
                )}
                {selected.nickname && (
                  <div>
                    <span className="text-xs text-muted-foreground">Callsign</span>
                    <p className="font-medium">{selected.nickname}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Select from the roster</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Click a team member to view their profile and contact info
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
