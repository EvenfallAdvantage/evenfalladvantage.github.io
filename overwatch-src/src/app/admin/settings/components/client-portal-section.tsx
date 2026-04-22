"use client";

import { useState, useCallback, useEffect } from "react";
import { Users, Plus, Trash2, Loader2, Mail, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getClientMembers, addClientMember, removeClientMember, type ClientMember } from "@/lib/supabase/db";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface ClientPortalSectionProps {
  companyId: string;
}

export default function ClientPortalSection({ companyId }: ClientPortalSectionProps) {
  const [clients, setClients] = useState<ClientMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    const data = await getClientMembers(companyId);
    setClients(data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!email.trim()) return;
    setAdding(true);
    try {
      const result = await addClientMember(companyId, email.trim());
      if (result.success) {
        toast.success("Client access granted");
        setEmail("");
        await load();
      } else {
        toast.error(result.error ?? "Failed to add client");
      }
    } catch { toast.error("Failed to add client"); }
    finally { setAdding(false); }
  }

  async function handleRemove(membership: ClientMember) {
    if (!await confirm({
      title: "Remove Client Access",
      description: `Remove ${membership.firstName} ${membership.lastName} (${membership.email}) from the client portal?`,
      confirmLabel: "Remove",
      variant: "destructive",
    })) return;

    setRemoving(membership.id);
    try {
      const ok = await removeClientMember(membership.id);
      if (ok) { toast.success("Client access removed"); await load(); }
      else toast.error("Failed to remove client");
    } catch { toast.error("Failed to remove client"); }
    finally { setRemoving(null); }
  }

  const portalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/overwatch/client`
    : "/overwatch/client";

  return (
    <>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Client Portal
            </h3>
            <p className="text-xs text-muted-foreground">
              Grant clients read-only access to view operations, incidents, invoices, and daily reports.
            </p>
          </div>

          {/* Portal link */}
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3 flex items-center gap-3">
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
            <code className="text-xs font-mono text-muted-foreground flex-1 truncate">{portalUrl}</code>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs shrink-0"
              onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success("Portal URL copied"); }}>
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>

          {/* Add client form */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="client-email" className="text-xs">Client Email</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="client@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} disabled={adding || !email.trim()} className="gap-1.5">
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Client
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            The client must have an Overwatch account. They will see the client portal at the URL above.
          </p>

          {/* Client list */}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : clients.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 py-2 text-center">No clients have portal access yet.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">{clients.length} Client{clients.length !== 1 ? "s" : ""}</p>
              {clients.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/50 px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Mail className="h-2.5 w-2.5" /> {c.email}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{c.status}</Badge>
                  <button
                    onClick={() => handleRemove(c)}
                    disabled={removing === c.id}
                    className="text-muted-foreground/40 hover:text-red-500 transition-colors"
                  >
                    {removing === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog />
    </>
  );
}
