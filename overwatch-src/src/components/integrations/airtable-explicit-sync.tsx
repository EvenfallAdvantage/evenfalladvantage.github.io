"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { getIntegrationConnections } from "@/lib/supabase/db-integrations";
import { getAirtableFieldMapping, previewAirtableSync, syncAirtablePurpose } from "@/lib/services/airtable-service";
import { readPurposeSelection, rosterConfirmDescription, type MappedPurpose } from "@/lib/integrations/airtable-sync";

interface Props {
  companyId: string;
  purpose: MappedPurpose;
  onSynced: () => void;
}

export function AirtableExplicitSync({ companyId, purpose, onSynced }: Props) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [label, setLabel] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    void getIntegrationConnections(companyId).then(async (rows) => {
      const connection = rows.find((row) => row.provider === "airtable");
      const saved = readPurposeSelection(connection?.settings, purpose);
      if (!saved.baseId || !saved.tableId) {
        if (!cancel) setLabel(null);
        return;
      }
      if (!cancel) setLabel(`${saved.baseName || "Airtable"} / ${saved.tableName || saved.tableId}`);
      try {
        const mapping = await getAirtableFieldMapping(companyId, purpose, saved.baseId, saved.tableId);
        if (!cancel) setReady(Boolean(mapping.confirmedAt));
      } catch {
        if (!cancel) setReady(false);
      }
    }).catch(() => {
      if (!cancel) setLabel(null);
    });
    return () => { cancel = true; };
  }, [companyId, purpose]);

  async function sync() {
    setBusy(true);
    try {
      const look = await previewAirtableSync(companyId, purpose);
      const counts = look.counts ?? {};
      const ok = await confirm({
        title: purpose === "roster" ? "Sync roster from Airtable?" : "Sync operations from Airtable?",
        description: purpose === "roster"
          ? rosterConfirmDescription(counts, { truncated: look.truncated, removalHold: look.removalHold, read: look.read })
          : `Create ${counts.create ?? 0}, update ${counts.update ?? 0}, conflicts ${counts.conflict ?? 0}, skipped ${counts.skipped ?? 0}. This does not delete local records or change owner and admin roles.`,
        confirmLabel: "Sync now",
      });
      if (!ok) return;
      const result = await syncAirtablePurpose(companyId, purpose, purpose === "roster" ? look.planToken : undefined);
      const failed = result.failed ? result.failed.create + result.failed.attach + result.failed.link + result.failed.update + result.failed.remove : result.errors.length;
      toast.success(purpose === "roster"
        ? `Read ${result.read?.rawRead ?? "?"} records. Created ${result.created}, linked ${result.linked ?? 0}, updated ${result.updated}, removed ${result.removed ?? 0}, write failures ${failed}.`
        : `Synced ${result.created} new and ${result.updated} updated`);
      onSynced();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 px-3 py-2" data-testid={`airtable-explicit-${purpose}`}>
      <p className="text-[10px] text-muted-foreground flex-1">
        {label
          ? `${purpose === "roster" ? "Roster" : "Ops Planning"} reads ${label} after you sync. This page loads Overwatch's own records.`
          : `Save the ${purpose === "roster" ? "Employees" : "Events"} table and confirm its field mapping in HQ Config before syncing.`}
      </p>
      {ready ? (
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => void sync()}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sync from Airtable"}
        </Button>
      ) : (
        <Link href="/admin/settings#hq-integrations" className="text-[10px] underline">Open Airtable settings</Link>
      )}
      <ConfirmDialog />
    </div>
  );
}
