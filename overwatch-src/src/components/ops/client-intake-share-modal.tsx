"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Send, Copy, ExternalLink, X, Check, QrCode, Trash2, Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createIntakeToken,
  getIntakeTokens,
  revokeIntakeToken,
  type IntakeTokenRow,
} from "@/lib/supabase/db-client-intake";
import { logger } from "@/lib/logger";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface ClientIntakeShareModalProps {
  companyId: string;
  userId: string;
  open: boolean;
  onClose: () => void;
}

function buildShareUrl(token: string): string {
  if (typeof window === "undefined") return `/overwatch/client-intake?token=${token}`;
  return `${window.location.origin}/overwatch/client-intake?token=${token}`;
}

function formatStatus(row: IntakeTokenRow): { label: string; tone: "active" | "submitted" | "expired" | "revoked" } {
  if (row.status === "submitted") return { label: `Submitted${row.client_name ? ` by ${row.client_name}` : ""}`, tone: "submitted" };
  if (row.status === "revoked") return { label: "Revoked", tone: "revoked" };
  if (row.status === "expired") return { label: "Expired", tone: "expired" };
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { label: "Expired", tone: "expired" };
  return { label: "Awaiting response", tone: "active" };
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ClientIntakeShareModal({ companyId, userId, open, onClose }: ClientIntakeShareModalProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [tokens, setTokens] = useState<IntakeTokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expiryDays, setExpiryDays] = useState<string>("14");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const data = await getIntakeTokens(companyId);
      setTokens(data);
    } catch (e) {
      logger.swallow("ClientIntakeShareModal:getIntakeTokens", e, "warn");
      toast.error("Failed to load intake links");
    } finally {
      setLoading(false);
    }
  }, [companyId, open]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleCreate() {
    setCreating(true);
    try {
      const days = Number(expiryDays);
      const expiresAt = days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      const row = await createIntakeToken({ companyId, createdBy: userId, expiresAt });
      setTokens(prev => [row, ...prev]);
      toast.success("Intake link created");
      // Auto-copy on creation for fast workflow
      const url = buildShareUrl(row.token);
      try {
        await navigator.clipboard.writeText(url);
        toast.message("Link copied to clipboard");
      } catch (e) {
        logger.swallow("ClientIntakeShareModal:autoCopy", e, "trace");
      }
    } catch (e) {
      logger.swallow("ClientIntakeShareModal:createIntakeToken", e, "warn");
      toast.error("Failed to create link — has the migration been run?");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(row: IntakeTokenRow) {
    const ok = await confirm({
      title: "Revoke intake link?",
      description: "The client will no longer be able to access or submit this form.",
      variant: "destructive",
      confirmLabel: "Revoke",
    });
    if (!ok) return;
    try {
      await revokeIntakeToken(row.id);
      setTokens(prev => prev.map(t => t.id === row.id ? { ...t, status: "revoked" } : t));
      toast.success("Link revoked");
    } catch (e) {
      logger.swallow("ClientIntakeShareModal:revoke", e, "warn");
      toast.error("Failed to revoke link");
    }
  }

  async function handleCopy(token: string) {
    const url = buildShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch (e) {
      logger.swallow("ClientIntakeShareModal:copy", e, "warn");
      toast.error("Failed to copy");
    }
  }

  async function handleShowQR(token: string) {
    if (qrToken === token) {
      setQrToken(null);
      setQrDataUrl(null);
      return;
    }
    setQrToken(token);
    setQrDataUrl(null);
    try {
      const QRCode = (await import("qrcode")).default;
      const url = buildShareUrl(token);
      const dataUrl = await QRCode.toDataURL(url, {
        width: 260,
        margin: 1,
        color: { dark: "#1a1a2e", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      logger.swallow("ClientIntakeShareModal:qr", e, "warn");
      toast.error("Failed to generate QR code");
      setQrToken(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-intake-share-title"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <span id="client-intake-share-title" className="text-sm font-semibold">Request from Client</span>
          </div>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Generate a secure link to send to a prospective client. They&apos;ll fill out the security intake form,
            and you can then convert their submission into a new operation.
          </p>

          {/* Create row */}
          <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor="intake-expiry-days" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Expires in
              </label>
              <Input
                id="intake-expiry-days"
                type="number"
                min={0}
                max={365}
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="h-7 w-16 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">days (0 = no expiry)</span>
            </div>
            <Button size="sm" className="w-full gap-2" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Generate New Link
            </Button>
          </div>

          {/* Token list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Recent Links
              </p>
              {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>

            {!loading && tokens.length === 0 && (
              <p className="text-xs text-muted-foreground italic px-1 py-2">
                No links yet. Generate one above to share with a client.
              </p>
            )}

            {tokens.map((row) => {
              const status = formatStatus(row);
              const url = buildShareUrl(row.token);
              const isRevoked = row.status === "revoked";
              const isExpired = status.tone === "expired";
              const inactive = isRevoked || isExpired;

              return (
                <div
                  key={row.id}
                  className={`rounded-lg border border-border/30 px-3 py-2 space-y-1.5 ${inactive ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-muted-foreground truncate" title={url}>{url}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] flex items-center gap-0.5 ${
                          status.tone === "submitted" ? "text-green-500" :
                          status.tone === "active" ? "text-primary" :
                          status.tone === "revoked" ? "text-red-400" :
                          "text-muted-foreground/60"
                        }`}>
                          {status.tone === "submitted" && <Check className="h-2.5 w-2.5" />}
                          {status.tone === "revoked" && <AlertCircle className="h-2.5 w-2.5" />}
                          {status.tone === "expired" && <Clock className="h-2.5 w-2.5" />}
                          {status.label}
                        </span>
                        <span className="text-[9px] text-muted-foreground/50">·</span>
                        <span className="text-[9px] text-muted-foreground/50">created {relativeTime(row.created_at)}</span>
                        {row.expires_at && !isExpired && !isRevoked && (
                          <>
                            <span className="text-[9px] text-muted-foreground/50">·</span>
                            <span className="text-[9px] text-muted-foreground/50">expires {relativeTime(row.expires_at)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => handleCopy(row.token)}
                        disabled={inactive}
                        aria-label="Copy link"
                        title="Copy link"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => handleShowQR(row.token)}
                        disabled={inactive}
                        aria-label="Show QR code"
                        title="Show QR code"
                      >
                        <QrCode className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                        disabled={inactive}
                        aria-label="Open in new tab"
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      {!isRevoked && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground/70 hover:text-red-400"
                          onClick={() => handleRevoke(row)}
                          aria-label="Revoke link"
                          title="Revoke link"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {qrToken === row.token && (
                    <div className="flex items-center justify-center pt-2 border-t border-border/20">
                      {qrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrDataUrl} alt="QR code for intake link" className="rounded-md" width={200} height={200} />
                      ) : (
                        <div className="h-[200px] w-[200px] flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-5 py-3 shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Submissions appear here when the client completes the form.
          </p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
      <ConfirmDialog />
    </div>
  );
}
