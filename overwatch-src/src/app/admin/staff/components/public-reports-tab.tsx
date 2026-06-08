"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Link as LinkIcon,
  Plus,
  QrCode,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Inbox,
  AlertTriangle,
  ChevronRight,
  Loader2,
  ArrowUpRightFromSquare,
  X,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { timeAgo } from "@/lib/utils";
import {
  getPublicReportLinks,
  createPublicReportLink,
  updatePublicReportLink,
  deletePublicReportLink,
  getPublicReportSubmissions,
  getPublicReportMessages,
  promotePublicReportToIncident,
  setPublicReportSubmissionStatus,
  replyToReporterViaSms,
  getTeams,
} from "@/lib/supabase/db";
import type {
  PublicReportLink,
  PublicReportSubmission,
  PublicReportMessage,
  SubmissionStatus,
} from "@/lib/supabase/db-public-reports";
import type { Team } from "@/lib/supabase/db-teams";

interface PublicReportsTabProps {
  activeCompanyId: string;
  canManage: boolean;
}

export function PublicReportsTab({ activeCompanyId, canManage }: PublicReportsTabProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [links, setLinks] = useState<PublicReportLink[]>([]);
  const [submissions, setSubmissions] = useState<PublicReportSubmission[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | "all">("new");

  const [showCreateLink, setShowCreateLink] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTeamId, setNewTeamId] = useState("");
  const [creating, setCreating] = useState(false);

  const [qrLinkId, setQrLinkId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Per-submission reply state.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, PublicReportMessage[]>>({});
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s, t] = await Promise.all([
        getPublicReportLinks(activeCompanyId),
        getPublicReportSubmissions(activeCompanyId),
        getTeams(activeCompanyId),
      ]);
      setLinks(l);
      setSubmissions(s);
      setTeams(t);
    } catch (e) {
      logger.swallow("public-reports-tab:load", e, "warn");
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reportUrl = (slug: string) => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin + (process.env.NEXT_PUBLIC_BASE_PATH ?? "");
    return `${base}/report?l=${encodeURIComponent(slug)}`;
  };

  const filteredSubmissions =
    filterStatus === "all" ? submissions : submissions.filter((s) => s.status === filterStatus);

  async function handleCreateLink() {
    if (!newLabel.trim()) {
      toast.error("Label is required");
      return;
    }
    setCreating(true);
    try {
      await createPublicReportLink(activeCompanyId, {
        label: newLabel.trim(),
        teamId: newTeamId || null,
      });
      toast.success("Report link created");
      setNewLabel("");
      setNewTeamId("");
      setShowCreateLink(false);
      await load();
    } catch (e) {
      logger.swallow("public-reports-tab:create-link", e, "warn");
      toast.error("Failed to create link");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(link: PublicReportLink) {
    try {
      await updatePublicReportLink(link.id, { isActive: !link.isActive });
      await load();
    } catch (e) {
      logger.swallow("public-reports-tab:toggle-active", e, "warn");
      toast.error("Failed to update");
    }
  }

  async function handleDeleteLink(link: PublicReportLink) {
    const ok = await confirm({
      description: `Delete "${link.label}"? Existing submissions will remain but the link will stop working.`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deletePublicReportLink(link.id);
      toast.success("Link deleted");
      await load();
    } catch (e) {
      logger.swallow("public-reports-tab:delete-link", e, "warn");
      toast.error("Failed to delete");
    }
  }

  async function handleCopy(slug: string) {
    try {
      await navigator.clipboard.writeText(reportUrl(slug));
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function handleShowQr(link: PublicReportLink) {
    setQrLinkId(link.id);
    setQrLoading(true);
    setQrDataUrl(null);
    try {
      const QRCode = (await import("qrcode")).default;
      const data = await QRCode.toDataURL(reportUrl(link.slug), {
        width: 320,
        margin: 2,
        color: { dark: "#1a1a2e", light: "#ffffff" },
      });
      setQrDataUrl(data);
    } catch (e) {
      logger.swallow("public-reports-tab:qr", e, "warn");
      toast.error("Failed to render QR");
    } finally {
      setQrLoading(false);
    }
  }

  async function handlePromote(submission: PublicReportSubmission) {
    const ok = await confirm({
      description: "Promote this submission into the incidents queue?",
      confirmLabel: "Promote",
    });
    if (!ok) return;
    setPromotingId(submission.id);
    try {
      const link = links.find((l) => l.id === submission.linkId);
      const result = await promotePublicReportToIncident(submission, {
        teamId: link?.teamId ?? null,
        type: link?.defaultType ?? undefined,
      });
      if (result?.incidentId) {
        toast.success("Promoted to incident");
        await load();
      } else {
        toast.error("Promotion failed");
      }
    } catch (e) {
      logger.swallow("public-reports-tab:promote", e, "warn");
      toast.error("Promotion failed");
    } finally {
      setPromotingId(null);
    }
  }

  async function loadMessages(submissionId: string) {
    try {
      const m = await getPublicReportMessages(submissionId);
      setMessages((prev) => ({ ...prev, [submissionId]: m }));
    } catch (e) {
      logger.swallow("public-reports-tab:load-messages", e, "warn");
    }
  }

  async function handleToggleExpand(submission: PublicReportSubmission) {
    if (expandedId === submission.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(submission.id);
    setReplyBody("");
    if (!messages[submission.id]) {
      await loadMessages(submission.id);
    }
  }

  async function handleSendReply(submission: PublicReportSubmission) {
    if (!replyBody.trim()) return;
    if (!submission.reporterPhone) {
      toast.error("Reporter did not leave a phone number");
      return;
    }
    setSendingReply(true);
    try {
      const result = await replyToReporterViaSms(submission.id, replyBody.trim());
      if (result.ok) {
        toast.success("Reply sent");
        setReplyBody("");
        await loadMessages(submission.id);
      } else {
        toast.error(result.error ?? "Send failed");
      }
    } catch (e) {
      logger.swallow("public-reports-tab:reply", e, "warn");
      toast.error("Send failed");
    } finally {
      setSendingReply(false);
    }
  }

  async function handleDismiss(submission: PublicReportSubmission) {
    try {
      await setPublicReportSubmissionStatus(submission.id, "dismissed");
      await load();
    } catch (e) {
      logger.swallow("public-reports-tab:dismiss", e, "warn");
      toast.error("Failed to dismiss");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Links ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> Public Report Links
            </CardTitle>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setShowCreateLink(!showCreateLink)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New link
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showCreateLink && canManage && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <Input
                placeholder="Label (e.g. Stadium West Gate)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              {teams.length > 0 && (
                <select
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Default team"
                >
                  <option value="">No default team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowCreateLink(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreateLink} disabled={creating || !newLabel.trim()}>
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create
                </Button>
              </div>
            </div>
          )}

          {links.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4 text-center">
              No public report links yet.
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{link.label}</span>
                      {!link.isActive && (
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{reportUrl(link.slug)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleCopy(link.slug)} title="Copy link">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleShowQr(link)} title="Show QR">
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleToggleActive(link)}
                          title={link.isActive ? "Disable" : "Enable"}
                        >
                          {link.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-500"
                          onClick={() => handleDeleteLink(link)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {qrLinkId && (
            <div className="rounded-md border bg-muted/30 p-4 mt-2 flex flex-col items-center gap-2">
              <div className="flex w-full items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  QR for {links.find((l) => l.id === qrLinkId)?.label}
                </p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setQrLinkId(null); setQrDataUrl(null); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              {qrLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrDataUrl} alt="QR code" className="h-56 w-56" />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Submissions queue ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4" /> Submissions
              <Badge variant="outline" className="ml-2">{submissions.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as SubmissionStatus | "all")}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                aria-label="Filter status"
              >
                <option value="new">New ({submissions.filter((s) => s.status === "new").length})</option>
                <option value="triaging">Triaging</option>
                <option value="promoted">Promoted</option>
                <option value="dismissed">Dismissed</option>
                <option value="all">All</option>
              </select>
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={load}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSubmissions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-6 text-center">No submissions match this filter.</p>
          ) : (
            <div className="space-y-2">
              {filteredSubmissions.map((sub) => {
                const link = links.find((l) => l.id === sub.linkId);
                return (
                  <div key={sub.id} className="rounded-md border bg-card p-3 space-y-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          sub.status === "new"
                            ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                            : sub.status === "promoted"
                              ? "bg-green-500/10 text-green-700 border-green-500/30"
                              : sub.status === "dismissed"
                                ? "bg-muted text-muted-foreground"
                                : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                        }`}
                      >
                        {sub.status}
                      </Badge>
                      {link && (
                        <Badge variant="outline" className="text-[10px]">
                          via {link.label}
                        </Badge>
                      )}
                      {sub.location && (
                        <Badge variant="outline" className="text-[10px]">
                          {sub.location}
                        </Badge>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(sub.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-line break-words">{sub.body}</p>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      {sub.reporterName && <span>By: {sub.reporterName}</span>}
                      {sub.reporterPhone && <span>{sub.reporterPhone}</span>}
                      {sub.reporterEmail && <span>{sub.reporterEmail}</span>}
                      {sub.locationLat != null && sub.locationLng != null && (
                        <span className="font-mono">
                          {sub.locationLat.toFixed(5)}, {sub.locationLng.toFixed(5)}
                        </span>
                      )}
                    </div>

                    {sub.incidentId && (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        Promoted to incident{" "}
                        <a href={`/incidents`} className="underline text-primary">
                          (view)
                        </a>
                      </div>
                    )}

                    {canManage && sub.status !== "promoted" && sub.status !== "dismissed" && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5"
                          onClick={() => handlePromote(sub)}
                          disabled={promotingId === sub.id}
                        >
                          {promotingId === sub.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowUpRightFromSquare className="h-3 w-3" />
                          )}
                          Promote to incident
                        </Button>
                        {sub.reporterPhone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5"
                            onClick={() => handleToggleExpand(sub)}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {expandedId === sub.id ? "Hide thread" : "Reply via SMS"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-muted-foreground"
                          onClick={() => handleDismiss(sub)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}

                    {expandedId === sub.id && sub.reporterPhone && (
                      <div className="rounded-md border bg-muted/20 p-3 space-y-2 mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Conversation with {sub.reporterPhone}
                        </p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {(messages[sub.id] ?? []).length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No messages yet.</p>
                          ) : (
                            (messages[sub.id] ?? []).map((m) => (
                              <div
                                key={m.id}
                                className={`text-xs rounded px-2 py-1.5 ${
                                  m.direction === "outbound" ? "bg-primary/10 ml-6" : "bg-muted mr-6"
                                }`}
                              >
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  {m.direction === "outbound" ? "You" : "Reporter"} ·{" "}
                                  {timeAgo(m.createdAt)} · {m.channel}
                                </div>
                                {m.body}
                              </div>
                            ))
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <textarea
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder="Type a reply (SMS, max 1600 chars)..."
                            rows={2}
                            maxLength={1600}
                            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSendReply(sub)}
                            disabled={sendingReply || !replyBody.trim()}
                          >
                            {sendingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    )}
                    {sub.status === "dismissed" && (
                      <div className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Dismissed by triager
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog />
    </div>
  );
}
