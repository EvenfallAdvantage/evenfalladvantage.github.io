"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plug, Plus, Trash2, Loader2, Copy, Eye, EyeOff, KeyRound,
  AlertTriangle, BookOpen, Beaker, Check, X, ChevronDown, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  createApiKey, listApiKeys, revokeApiKey, deleteApiKey, getApiKeyUsage,
  type ApiKeyRow, type ApiKeyUsage,
} from "@/lib/supabase/db-api-keys";
import {
  listMappings, upsertMapping, deleteMapping, previewMapping,
  CANONICAL_FIELD_META,
  type IntakeFieldMapping, type CanonicalIntakeField,
} from "@/lib/supabase/db-intake-mappings";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { logger } from "@/lib/logger";

interface ApiSourcesSectionProps {
  companyId: string;
  userId: string;
}

const INGEST_PATH = "/functions/v1/intake-ingest";

function getSupabaseFunctionsBaseUrl(): string {
  // Convert the NEXT_PUBLIC_SUPABASE_URL into the functions base URL.
  // process.env.NEXT_PUBLIC_SUPABASE_URL is statically inlined at build time.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!base) return "";
  return base.replace(/\/$/, "") + "/functions/v1/intake-ingest";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ApiSourcesSection({ companyId, userId }: ApiSourcesSectionProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [mappings, setMappings] = useState<IntakeFieldMapping[]>([]);
  const [usageByKey, setUsageByKey] = useState<Record<string, ApiKeyUsage>>({});
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");

  // One-time-visible plaintext key after creation
  const [revealedKey, setRevealedKey] = useState<{ name: string; plaintext: string } | null>(null);
  const [revealedVisible, setRevealedVisible] = useState(false);

  // Field mapping form
  const [newSourceField, setNewSourceField] = useState("");
  const [newCanonicalField, setNewCanonicalField] = useState<CanonicalIntakeField>("client_name");
  const [savingMapping, setSavingMapping] = useState(false);

  // Test payload
  const [testPayload, setTestPayload] = useState<string>(
    JSON.stringify({ name: "Jane Doe", email: "jane@example.com", phone: "(555) 555-5555", service: "Event Security", message: "Need security for a 200-person gala" }, null, 2),
  );
  const [showDocs, setShowDocs] = useState(false);

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, m] = await Promise.all([listApiKeys(companyId), listMappings(companyId)]);
      setKeys(k);
      setMappings(m);
      // Load usage lazily for each active key
      const usageEntries = await Promise.all(
        k.filter(row => !row.revoked_at).map(async row => {
          try {
            const u = await getApiKeyUsage(row.id);
            return [row.id, u] as const;
          } catch (e) {
            logger.swallow("ApiSourcesSection:usage", e, "trace");
            return null;
          }
        }),
      );
      const usageMap: Record<string, ApiKeyUsage> = {};
      for (const entry of usageEntries) {
        if (entry) usageMap[entry[0]] = entry[1];
      }
      setUsageByKey(usageMap);
    } catch (e) {
      logger.swallow("ApiSourcesSection:load", e, "warn");
      toast.error("Failed to load API sources");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  /* ── Key actions ── */
  async function handleCreateKey() {
    const name = newKeyName.trim();
    if (!name) {
      toast.error("Give the key a name first");
      return;
    }
    setCreatingKey(true);
    try {
      const created = await createApiKey({ companyId, createdBy: userId, name });
      setKeys(prev => [created.row, ...prev]);
      setRevealedKey({ name: created.row.name, plaintext: created.plaintext });
      setRevealedVisible(true);
      setNewKeyName("");
      // Auto-copy
      try {
        await navigator.clipboard.writeText(created.plaintext);
        toast.success("Key created and copied to clipboard");
      } catch (e) {
        logger.swallow("ApiSourcesSection:autoCopy", e, "trace");
        toast.success("Key created — copy it now, it won't be shown again");
      }
    } catch (e) {
      logger.swallow("ApiSourcesSection:create", e, "warn");
      toast.error("Failed to create key — has the migration been run?");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevoke(row: ApiKeyRow) {
    const ok = await confirm({
      title: "Revoke API key?",
      description: `"${row.name}" will stop working immediately. Any external sites using this key will get 401 errors. This cannot be undone.`,
      variant: "destructive",
      confirmLabel: "Revoke",
    });
    if (!ok) return;
    try {
      await revokeApiKey(row.id);
      setKeys(prev => prev.map(k => k.id === row.id ? { ...k, revoked_at: new Date().toISOString() } : k));
      toast.success("Key revoked");
    } catch (e) {
      logger.swallow("ApiSourcesSection:revoke", e, "warn");
      toast.error("Failed to revoke key");
    }
  }

  async function handleDelete(row: ApiKeyRow) {
    const ok = await confirm({
      title: "Permanently delete this key?",
      description: `"${row.name}" and its request history will be deleted. Revoke instead if you want to keep an audit trail.`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteApiKey(row.id);
      setKeys(prev => prev.filter(k => k.id !== row.id));
      toast.success("Key deleted");
    } catch (e) {
      logger.swallow("ApiSourcesSection:delete", e, "warn");
      toast.error("Failed to delete key");
    }
  }

  /* ── Mapping actions ── */
  async function handleSaveMapping() {
    const src = newSourceField.trim();
    if (!src) {
      toast.error("Enter a source field name");
      return;
    }
    setSavingMapping(true);
    try {
      const row = await upsertMapping({ companyId, sourceField: src, canonicalField: newCanonicalField });
      setMappings(prev => {
        const others = prev.filter(m => !(m.source_field.toLowerCase() === row.source_field.toLowerCase()));
        return [...others, row].sort((a, b) => a.source_field.localeCompare(b.source_field));
      });
      setNewSourceField("");
      toast.success("Mapping saved");
    } catch (e) {
      logger.swallow("ApiSourcesSection:saveMapping", e, "warn");
      toast.error("Failed to save mapping");
    } finally {
      setSavingMapping(false);
    }
  }

  async function handleDeleteMapping(row: IntakeFieldMapping) {
    try {
      await deleteMapping(row.id);
      setMappings(prev => prev.filter(m => m.id !== row.id));
    } catch (e) {
      logger.swallow("ApiSourcesSection:deleteMapping", e, "warn");
      toast.error("Failed to delete mapping");
    }
  }

  /* ── Test payload preview ── */
  const testResult = useMemo(() => {
    try {
      const parsed = JSON.parse(testPayload);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: "Payload must be a JSON object" as const };
      }
      return previewMapping(parsed as Record<string, unknown>, mappings);
    } catch {
      return { error: "Invalid JSON" as const };
    }
  }, [testPayload, mappings]);

  const ingestUrl = getSupabaseFunctionsBaseUrl();
  const activeKeyCount = keys.filter(k => !k.revoked_at).length;

  /* ── Copy helper ── */
  async function copyTo(text: string, message = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch (e) {
      logger.swallow("ApiSourcesSection:copy", e, "trace");
      toast.error("Copy failed");
    }
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Plug className="h-4 w-4" /> API Sources
              </h3>
              <p className="text-xs text-muted-foreground">
                Let your existing website&apos;s contact / intake form submit leads directly into Overwatch.
                Generate an API key, map your form fields to canonical fields, and POST submissions to the ingest endpoint.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {activeKeyCount} active key{activeKeyCount !== 1 ? "s" : ""}
            </Badge>
          </div>

          {/* One-time key reveal */}
          {revealedKey && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">Copy this key now — you won&apos;t see it again</p>
                  <p className="text-[10px] text-muted-foreground">
                    Key &ldquo;{revealedKey.name}&rdquo;. Only the hash is stored; we cannot recover the plaintext later.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/60 px-2 py-1.5">
                <code className="text-[11px] font-mono flex-1 truncate" style={{ letterSpacing: 0 }}>
                  {revealedVisible ? revealedKey.plaintext : revealedKey.plaintext.slice(0, 12) + "•".repeat(20)}
                </code>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setRevealedVisible(v => !v)} aria-label="Toggle visibility">
                  {revealedVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyTo(revealedKey.plaintext, "Key copied")} aria-label="Copy key">
                  <Copy className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setRevealedKey(null); setRevealedVisible(false); }} aria-label="Dismiss">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Endpoint URL */}
          <div>
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Endpoint</Label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 p-2.5">
              <code className="text-[11px] font-mono text-muted-foreground flex-1 truncate">
                POST {ingestUrl || `<SUPABASE_URL>${INGEST_PATH}`}
              </code>
              {ingestUrl && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs shrink-0" onClick={() => copyTo(ingestUrl, "Endpoint URL copied")}>
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              )}
            </div>
          </div>

          {/* Create key */}
          <div>
            <Label htmlFor="new-api-key-name" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Create API Key
            </Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="new-api-key-name"
                placeholder='e.g. "OpServe Marketing Site"'
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleCreateKey()}
                className="text-xs"
              />
              <Button onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()} className="gap-1.5 shrink-0">
                {creatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                Generate
              </Button>
            </div>
          </div>

          {/* Key list */}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : keys.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 py-2 text-center">No API keys yet. Generate one above to get started.</p>
          ) : (
            <div className="space-y-2">
              {keys.map((row) => {
                const isRevoked = !!row.revoked_at;
                const isExpired = !!row.expires_at && new Date(row.expires_at) < new Date();
                const usage = usageByKey[row.id];
                return (
                  <div
                    key={row.id}
                    className={`rounded-lg border border-border/30 bg-background/50 px-3 py-2 ${isRevoked || isExpired ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{row.name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-muted-foreground">
                          <code className="font-mono">{row.key_prefix}…</code>
                          <span>·</span>
                          <span>created {relativeTime(row.created_at)}</span>
                          <span>·</span>
                          <span>last used {relativeTime(row.last_used_at)}</span>
                          {usage && (
                            <>
                              <span>·</span>
                              <span>{usage.total_requests_24h} reqs / 24h{usage.rate_limited_24h > 0 ? ` (${usage.rate_limited_24h} rate-limited)` : ""}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {isRevoked ? (
                        <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400">revoked</Badge>
                      ) : isExpired ? (
                        <Badge variant="outline" className="text-[9px]">expired</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-green-500/40 text-green-500">active</Badge>
                      )}
                      {!isRevoked && (
                        <button onClick={() => handleRevoke(row)} className="text-muted-foreground/40 hover:text-amber-500 transition-colors" title="Revoke">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(row)} className="text-muted-foreground/40 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Field Mappings */}
          <div className="pt-4 border-t border-border/30 space-y-3">
            <div>
              <h4 className="text-xs font-semibold flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5" /> Field Mappings
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Tell us how to translate your form&apos;s field names into Overwatch&apos;s canonical fields.
                Anything you don&apos;t map is preserved in <code className="font-mono">extra</code> on the submission.
              </p>
            </div>

            {/* Add mapping */}
            <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
              <div>
                <Label htmlFor="mapping-source" className="text-[10px] text-muted-foreground">Your form field</Label>
                <Input
                  id="mapping-source"
                  placeholder='e.g. "name" or "fullName"'
                  value={newSourceField}
                  onChange={(e) => setNewSourceField(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSaveMapping()}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="mapping-canonical" className="text-[10px] text-muted-foreground">Maps to</Label>
                <select
                  id="mapping-canonical"
                  value={newCanonicalField}
                  onChange={(e) => setNewCanonicalField(e.target.value as CanonicalIntakeField)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  {CANONICAL_FIELD_META.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleSaveMapping} disabled={savingMapping || !newSourceField.trim()} className="gap-1.5">
                  {savingMapping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </div>

            {/* Mapping list */}
            {mappings.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 italic text-center py-2">
                No mappings yet. Without mappings, all fields go to the <code className="font-mono">extra</code> bucket.
              </p>
            ) : (
              <div className="space-y-1">
                {mappings.map((m) => {
                  const meta = CANONICAL_FIELD_META.find(f => f.key === m.canonical_field);
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-md border border-border/20 bg-background/40 px-2 py-1.5 text-xs">
                      <code className="font-mono text-muted-foreground flex-1 truncate">{m.source_field}</code>
                      <span className="text-muted-foreground/40">→</span>
                      <span className="text-primary flex-1 truncate">{meta?.label ?? m.canonical_field}</span>
                      <button onClick={() => handleDeleteMapping(m)} className="text-muted-foreground/40 hover:text-red-500 transition-colors" aria-label="Delete mapping">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Test payload */}
          <div className="pt-4 border-t border-border/30 space-y-3">
            <div>
              <h4 className="text-xs font-semibold flex items-center gap-2">
                <Beaker className="h-3.5 w-3.5" /> Test a Payload
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Paste a sample submission and we&apos;ll show how your mappings will transform it.
              </p>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              <div>
                <Label htmlFor="test-payload" className="text-[10px] text-muted-foreground">Sample JSON</Label>
                <textarea
                  id="test-payload"
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  className="mt-1 w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-[11px] font-mono resize-y"
                  spellCheck={false}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Mapped result</Label>
                <div className="mt-1 h-48 overflow-y-auto rounded-md border border-input bg-background/40 px-3 py-2 text-[11px] font-mono">
                  {"error" in testResult ? (
                    <p className="text-red-400">{testResult.error}</p>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify({ canonical: testResult.canonical, extra: testResult.extra }, null, 2)}</pre>
                  )}
                </div>
                {!("error" in testResult) && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    <Check className="inline h-2.5 w-2.5 text-green-500" />{" "}
                    {Object.keys(testResult.canonical).length} canonical · {Object.keys(testResult.extra).length} extra
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Docs / snippet */}
          <div className="pt-4 border-t border-border/30">
            <button
              onClick={() => setShowDocs(v => !v)}
              className="text-xs font-semibold flex items-center gap-2 hover:text-primary transition-colors"
            >
              {showDocs ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <BookOpen className="h-3.5 w-3.5" /> Integration Guide & Code Snippets
            </button>

            {showDocs && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">JavaScript (browser)</p>
                  <pre className="rounded-md bg-muted/40 border border-border/30 p-3 text-[10px] font-mono overflow-x-auto whitespace-pre">{`// In your existing form submit handler:
await fetch("${ingestUrl || "<INGEST_URL>"}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ova_live_YOUR_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    service: formData.get("service"),
    message: formData.get("message"),
    // ...any fields you have. Map them in this UI.
  }),
});`}</pre>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">cURL</p>
                  <pre className="rounded-md bg-muted/40 border border-border/30 p-3 text-[10px] font-mono overflow-x-auto whitespace-pre">{`curl -X POST "${ingestUrl || "<INGEST_URL>"}" \\
  -H "Authorization: Bearer ova_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Jane","email":"jane@example.com","service":"Event Security"}'`}</pre>
                </div>

                <div className="rounded-md bg-muted/30 border border-border/20 p-3 text-[11px] text-muted-foreground space-y-1">
                  <p><strong className="text-foreground">Limits:</strong> 100 requests / minute per key, 64 KiB max payload.</p>
                  <p><strong className="text-foreground">Returns:</strong> <code className="font-mono">201</code> with <code className="font-mono">{`{ ok, submission_id, token, canonical_fields_captured, unmapped_field_count }`}</code> on success. <code className="font-mono">401</code> if the key is invalid or revoked. <code className="font-mono">429</code> if rate-limited.</p>
                  <p><strong className="text-foreground">Security:</strong> Keys are SHA-256 hashed at rest. Plaintext is shown only once at creation. Revoke any time without breaking other keys.</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog />
    </>
  );
}
