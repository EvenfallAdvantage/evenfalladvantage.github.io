"use client";

import { useState, useCallback, useEffect } from "react";
import { Users, Plus, Trash2, Loader2, Mail, Copy, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HqDisclosure } from "./hq-disclosure";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getClientMembers, addClientMember, removeClientMember, isClientRoleSupported, type ClientMember } from "@/lib/supabase/db";
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
  /** When the 'client' enum value hasn't been added to CompanyRole yet
   * (i.e. add_client_role.sql hasn't been run), we show a setup banner
   * instead of letting the user click Add and hit an opaque error. */
  const [migrationMissing, setMigrationMissing] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    const supported = await isClientRoleSupported();
    if (!supported) {
      setMigrationMissing(true);
      setClients([]);
      setLoading(false);
      return;
    }
    setMigrationMissing(false);
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

  const summary = migrationMissing
    ? "Not available in this workspace yet."
    : clients.length
      ? `${clients.length} client${clients.length === 1 ? "" : "s"} with access. Open to add or remove.`
      : "Grant clients read-only access to operations, incidents, invoices, and daily reports.";

  return (
    <>
      <HqDisclosure
        variant="card"
        icon={<Users className="h-4 w-4" />}
        title="Client portal"
        description={summary}
        forceOpen={email.trim().length > 0 || adding}
        testId="hq-client-portal"
      >
          {/* Migration not yet run — show a friendly banner instead of
              letting Add Client fail with an opaque "invalid input value
              for enum" error. */}
          {migrationMissing && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-semibold">Client Portal isn&apos;t available yet</p>
                  <p className="text-xs text-muted-foreground">
                    This workspace isn&apos;t set up for client accounts. Contact Overwatch support to turn it on.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Portal link */}
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3 flex items-center gap-3">
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
            <code className="text-xs font-mono text-muted-foreground flex-1 truncate">{portalUrl}</code>
            <Button variant="ghost" size="sm" className="h-11 gap-1 text-xs shrink-0 sm:h-7"
              onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success("Portal URL copied"); }}>
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>

          {/* Add client form */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="client-email" className="text-xs">Client Email</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="client@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                disabled={migrationMissing}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} disabled={adding || !email.trim() || migrationMissing} className="h-11 w-full gap-1.5 sm:h-8 sm:w-auto">
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Client
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The client must have an Overwatch account. They will see the client portal at the URL above.
          </p>

          {/* Client list */}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : clients.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 py-2 text-center">No clients have portal access yet.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
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
                  <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                  <button
                    onClick={() => handleRemove(c)}
                    disabled={removing === c.id}
                    aria-label={`Remove ${c.firstName} ${c.lastName}`}
                    className="-m-2 flex h-11 w-11 items-center justify-center rounded text-muted-foreground/60 hover:text-red-500 transition-colors"
                  >
                    {removing === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
      </HqDisclosure>
      <ConfirmDialog />
    </>
  );
}
