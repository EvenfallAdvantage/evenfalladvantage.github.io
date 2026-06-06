"use client";

/**
 * RosterBulkEmailModal — owner/admin/manager-only composer for a one-off
 * broadcast to the company roster. POSTs to the roster-bulk-email Edge
 * Function which fans out via email-send + optional in-app notification.
 *
 * Body editor uses @uiw/react-md-editor (markdown). On send we convert the
 * markdown to HTML with `marked`, sanitize via DOMPurify (existing dep), and
 * pass both the sanitized HTML and the raw plain-text alternative to the
 * Edge Function.
 *
 * Pre-flight banner blocks sending until the company's email provider has
 * been verified via the Email Config page. (Sending an unverified broadcast
 * would fall back to the platform sender — surprising for a "broadcast from
 * us" UX. Invitations use the platform fallback intentionally; broadcasts
 * shouldn't.)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  X,
  Loader2,
  Send,
  AlertTriangle,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

// MDEditor uses window references on import; bypass SSR.
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface RosterBulkEmailModalProps {
  companyId: string;
  /** Visible roster count, used for the recipient preview. */
  rosterCount: number;
  /** Linked roster count (members with a Supabase auth account). */
  linkedCount: number;
  open: boolean;
  onClose: () => void;
}

interface SendResponse {
  recipient_count: number;
  sent: number;
  failed: number;
  errors?: Array<{ to: string; reason: string }>;
}

interface VerificationStatus {
  verified: boolean;
  delivery_method: string | null;
  from_email: string | null;
}

function getSupabaseFunctionsBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url.replace(/\/+$/, "")}/functions/v1` : null;
}

export default function RosterBulkEmailModal({
  companyId,
  rosterCount,
  linkedCount,
  open,
  onClose,
}: RosterBulkEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [bodyMd, setBodyMd] = useState<string | undefined>("");
  const [onlyLinked, setOnlyLinked] = useState(false);
  const [alsoNotifyInApp, setAlsoNotifyInApp] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("integrations_config")
        .select("delivery_method, verified_at, from_email")
        .eq("company_id", companyId)
        .eq("provider", "email")
        .maybeSingle();
      const row = data as
        | {
          delivery_method: string | null;
          verified_at: string | null;
          from_email: string | null;
        }
        | null;
      setStatus({
        verified: Boolean(row?.verified_at),
        delivery_method: row?.delivery_method ?? null,
        from_email: row?.from_email ?? null,
      });
    } catch {
      setStatus({ verified: false, delivery_method: null, from_email: null });
    } finally {
      setStatusLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) {
      void loadStatus();
    }
  }, [open, loadStatus]);

  // Reset form when the modal closes.
  useEffect(() => {
    if (!open) {
      setSubject("");
      setBodyMd("");
      setOnlyLinked(false);
      setAlsoNotifyInApp(true);
    }
  }, [open]);

  const recipientCount = onlyLinked ? linkedCount : rosterCount;

  const sanitizedPreview = useMemo(() => {
    const md = bodyMd ?? "";
    if (!md.trim()) return "";
    try {
      const rawHtml = marked.parse(md, { async: false }) as string;
      return DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          "p", "br", "strong", "em", "u", "a",
          "ul", "ol", "li", "blockquote", "code", "pre",
          "h1", "h2", "h3", "h4", "h5", "h6",
        ],
        ALLOWED_ATTR: ["href", "title", "target", "rel"],
        ALLOWED_URI_REGEXP: /^(https?:|mailto:)/i,
      });
    } catch {
      return "";
    }
  }, [bodyMd]);

  async function handleSend() {
    if (!subject.trim()) {
      toast.error("Subject is required.");
      return;
    }
    if (!(bodyMd ?? "").trim()) {
      toast.error("Message body is empty.");
      return;
    }
    if (!status?.verified) {
      toast.error(
        "Configure and verify your email provider before sending broadcasts.",
      );
      return;
    }
    const base = getSupabaseFunctionsBaseUrl();
    if (!base) {
      toast.error("Bulk email endpoint not configured.");
      return;
    }
    setSending(true);
    try {
      const supabase = createClient();
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        toast.error("Please re-authenticate and try again.");
        return;
      }
      const res = await fetch(`${base}/roster-bulk-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: companyId,
          subject: subject.trim(),
          body_html: sanitizedPreview,
          body_text: (bodyMd ?? "").trim(),
          recipient_filter: { only_linked: onlyLinked },
          also_notify_in_app: alsoNotifyInApp,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as
        & Partial<SendResponse>
        & { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const sent = json.sent ?? 0;
      const failed = json.failed ?? 0;
      const total = json.recipient_count ?? sent + failed;
      if (failed === 0) {
        toast.success(`Sent to ${sent} of ${total} recipients.`);
      } else {
        toast.message(
          `Sent to ${sent} of ${total}. ${failed} failed.`,
          { description: json.errors?.[0]?.reason },
        );
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-bulk-email-title"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <span
              id="roster-bulk-email-title"
              className="text-sm font-semibold"
            >
              Email Roster
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Pre-flight verification banner */}
          {statusLoading ? (
            <div className="rounded-lg border border-border/40 bg-background/40 p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking email provider status...
            </div>
          ) : status?.verified ? (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 flex items-start gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Sending as your own provider</p>
                <p className="text-muted-foreground">
                  Mail will be delivered via <strong>{status.delivery_method}</strong>
                  {status.from_email ? <> from <strong>{status.from_email}</strong></> : null}.
                  Replies route back to you.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Email provider not verified</p>
                <p className="text-muted-foreground">
                  Configure and verify your sending provider in{" "}
                  <Link href="/admin/settings/email" className="text-primary hover:underline">
                    Email Config
                  </Link>
                  {" "}before sending broadcasts.
                </p>
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Heads up about Saturday's event"
              maxLength={200}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {subject.length}/200
            </p>
          </div>

          {/* Body editor */}
          <div className="space-y-1" data-color-mode="light">
            <label className="text-xs font-medium">Message</label>
            <MDEditor
              value={bodyMd}
              onChange={setBodyMd}
              height={240}
              preview="edit"
              textareaProps={{
                placeholder: "Write your message. Markdown formatting supported.",
                maxLength: 50000,
              }}
            />
            <p className="text-[10px] text-muted-foreground">
              Markdown formatting (bold, italic, lists, links) is supported.
              The platform-side wrapper adds your name and the company
              branding automatically.
            </p>
          </div>

          {/* Recipient + options */}
          <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyLinked}
                  onChange={(e) => setOnlyLinked(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                <span>Only members with active accounts</span>
              </label>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoNotifyInApp}
                onChange={(e) => setAlsoNotifyInApp(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <span>
                Also post in-app notification for members with accounts
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-5 py-3 shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Throttled to 5 messages/sec.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onClose}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || !status?.verified || statusLoading}
              className="h-7 gap-1.5 text-xs"
            >
              {sending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Send className="h-3 w-3" />}
              Send to {recipientCount}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
