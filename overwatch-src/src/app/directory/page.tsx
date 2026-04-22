"use client";

import { useEffect, useState } from "react";
import { Users, Search, Mail, Phone, Shield, EyeOff } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getCompanyMembers } from "@/lib/supabase/db";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { getQueryClient } from "@/lib/query-client";

type MemberUser = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; avatar_url: string | null };
type Member = { id: string; role: string; nickname: string | null; status: string; title: string | null; hide_contact_roster: boolean; users: MemberUser | null };

export default function DirectoryPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);

  // React Query — auto-caches, auto-retries, invalidates on company switch
  const { data: members = [] } = useCompanyQuery(
    "directory-members",
    async (cid) => (await getCompanyMembers(cid)) as unknown as Member[],
  );

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);

  // Realtime — roster updates when members join/leave/change roles
  useEffect(() => {
    if (!activeCompanyId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`directory-${activeCompanyId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "company_members",
        filter: `company_id=eq.${activeCompanyId}`,
      }, () => {
        // Invalidate the React Query cache so it refetches
        getQueryClient().invalidateQueries({ queryKey: ["directory-members", activeCompanyId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeCompanyId]);

  const filtered = members.filter((m) => {
    const name = `${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const sel = selected?.users;
  const selInitials = sel
    ? (sel.first_name?.[0] ?? "") + (sel.last_name?.[0] ?? "")
    : "";

  return (
    <PageShell title="DIRECTORY" subtitle="Personnel directory and contact info" icon={<Users className="h-5 w-5" />}>
      <div className="space-y-6">
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
              {filtered.map((m) => {
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
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={u?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
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
                <Avatar className="h-16 w-16">
                  <AvatarImage src={sel?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
                    {selInitials}
                  </AvatarFallback>
                </Avatar>
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
                {selected.hide_contact_roster ? (
                  <div className="flex items-center gap-2 text-muted-foreground/60 italic text-xs">
                    <EyeOff className="h-4 w-4" />
                    Contact info hidden by this member
                  </div>
                ) : (
                  <>
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
                  </>
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
    </PageShell>
  );
}
