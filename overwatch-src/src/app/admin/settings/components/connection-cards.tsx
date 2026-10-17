"use client";

import { useState } from "react";
import { Loader2, Plug, RefreshCw, Unplug, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getIntegrationConnections, runIntegrationAction, startIntegrationOAuth } from "@/lib/supabase/db";
import {
  BADGE_LABEL, connectionBadge, sinceLabel,
  type BadgeKind, type ConnectionProviderDef, type IntegrationConnection,
} from "@/lib/integrations/connections";

const BADGE_CLASS: Record<BadgeKind, string> = {
  connected: "bg-green-500/15 text-green-500",
  pending: "bg-sky-500/15 text-sky-500",
  attention: "bg-amber-500/15 text-amber-500",
  disconnected: "",
};

interface Props {
  companyId: string;
  /** owner/admin. Managers see status only. */
  canManage: boolean;
  providers: ConnectionProviderDef[];
  initialConnections: IntegrationConnection[];
  /** Opens the vendor's write-only key form (vendor PRs supply it). */
  onEnterKey?: (provider: string) => void;
}

export default function ConnectionCards({ companyId, canManage, providers, initialConnections, onEnterKey }: Props) {
  const [rows, setRows] = useState<IntegrationConnection[]>(initialConnections);
  const [busy, setBusy] = useState<string | null>(null);

  if (providers.length === 0) return null;

  const reload = async () => setRows(await getIntegrationConnections(companyId));

  async function act(provider: string, action: "test" | "disconnect") {
    if (action === "disconnect" && !window.confirm("Disconnect this integration? Stored credentials are erased.")) return;
    setBusy(`${provider}:${action}`);
    try {
      const r = await runIntegrationAction(companyId, provider, action);
      if (action === "test") {
        if (r.ok) toast.success("Connection test passed");
        else toast.error(r.detail ?? "Connection test failed");
      } else toast.success("Disconnected");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function connect(def: ConnectionProviderDef) {
    if (def.connect === "key") { onEnterKey?.(def.provider); return; }
    setBusy(`${def.provider}:connect`);
    try {
      window.location.assign(await startIntegrationOAuth(companyId, def.provider));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the connection");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3" data-testid="connection-cards">
      {providers.map((def) => {
        const row = rows.find((r) => r.provider === def.provider) ?? null;
        const kind = connectionBadge(row);
        const live = !!row && kind !== "disconnected";
        return (
          <div key={def.provider} data-testid={`connection-${def.provider}`} className="rounded-lg border border-border/40 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {def.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={def.logo} alt="" className="h-5 w-5 object-contain" />
              )}
              <span className="text-sm font-semibold">{def.label}</span>
              <Badge variant={kind === "disconnected" ? "outline" : undefined} className={`text-[9px] ${BADGE_CLASS[kind]}`}>{BADGE_LABEL[kind]}</Badge>
              {row?.external_account_name && <span className="text-[10px] text-muted-foreground">{row.external_account_name}</span>}
            </div>
            <p className="text-[10px] text-muted-foreground">{def.desc}</p>
            {live && (
              <dl className="grid grid-cols-3 gap-2 text-[10px]">
                <div><dt className="text-muted-foreground">Last test</dt><dd>{sinceLabel(row?.last_test_at)}{row?.last_test_ok === false ? " (failed)" : ""}</dd></div>
                <div><dt className="text-muted-foreground">Last sync</dt><dd>{sinceLabel(row?.last_sync_at)}</dd></div>
                <div><dt className="text-muted-foreground">Last webhook</dt><dd>{sinceLabel(row?.last_webhook_at)}</dd></div>
              </dl>
            )}
            {kind === "attention" && row?.last_error && <p role="alert" className="text-[10px] text-amber-500">{row.last_error}</p>}
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                {!live || kind === "attention" ? (
                  <Button size="sm" className="h-11 gap-1.5 text-xs sm:h-7" disabled={!!busy} onClick={() => void connect(def)}>
                    {def.connect === "key" ? <KeyRound className="h-3 w-3" /> : <Plug className="h-3 w-3" />}
                    {def.connect === "key" ? "Enter key" : live ? "Reconnect" : "Connect"}
                  </Button>
                ) : null}
                {live && (
                  <Button size="sm" variant="outline" className="h-11 gap-1.5 text-xs sm:h-7" disabled={!!busy} onClick={() => void act(def.provider, "test")}>
                    {busy === `${def.provider}:test` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}Test connection
                  </Button>
                )}
                {live && (
                  <Button size="sm" variant="outline" className="h-11 gap-1.5 text-xs sm:h-7" disabled={!!busy} onClick={() => void act(def.provider, "disconnect")}>
                    <Unplug className="h-3 w-3" />Disconnect
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Only owners and admins can change integrations.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
