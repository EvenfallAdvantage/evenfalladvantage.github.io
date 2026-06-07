"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Users, Search, Loader2, Trash2, ChevronDown,
  Eye, ShieldCheck, AlertOctagon, QrCode,
  UserPlus, Plus, X, Upload, Download, Check, MailPlus, Mail, RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  updateMemberRole, removeMember, getMemberProfileById, getCompanyReadiness,
} from "@/lib/supabase/db";
import { createRosterMember } from "@/lib/supabase/db-users";
import { createClient } from "@/lib/supabase/client";
import RosterBulkEmailModal from "@/components/roster/roster-bulk-email-modal";
import { updateMemberPayRate } from "@/lib/supabase/db-pay";
import { exportCSV, MEMBER_COLUMNS } from "@/lib/csv-export";
import { parseCSVRaw, applyMapping, validateStaffRows, type StaffImportRow } from "@/lib/csv-import";
import { bulkCreateApplicants } from "@/lib/supabase/db-onboarding";
import { getOrCreateBadge, getCompanyBadges, type StaffBadge } from "@/lib/supabase/db-badges";
import { CSVColumnMapper } from "./csv-column-mapper";
import { MemberProfileModal } from "./member-profile-modal";
import { ReadinessModal } from "./readiness-modal";
import { BadgePreviewModal } from "./badge-preview-modal";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { logger } from "@/lib/logger";


type Member = Record<string, unknown> & {
  id: string;
  role: string;
  status?: string;
  user_id?: string;
  pay_rate_override?: number | string | null;
  users?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    avatar_url?: string;
    /** Auth account link. NULL = no Supabase Auth user yet (unlinked). */
    supabase_id?: string | null;
  };
};

/** Row from public.roster_invitations, keyed by membership_id. */
type InvitationRow = {
  membership_id: string;
  sent_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  resend_count: number;
};

function getSupabaseFunctionsBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url.replace(/\/+$/, "")}/functions/v1` : null;
}

type ReadinessEntry = { profileMissing: string[]; readingMissing: { id: string; title: string }[] };

interface RosterTabProps {
  activeCompanyId: string;
  canManage: boolean;
  canManageRoles: boolean;
  members: Member[];
  onReload: () => void;
  myRole: string;
  companyName: string;
  userCompanies: { companyId: string; companyLogo?: string | null; brandColor?: string | null }[];
}

export function RosterTab({ activeCompanyId, canManage, canManageRoles, members, onReload, myRole, companyName, userCompanies }: RosterTabProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Badges
  const [rosterBadges, setRosterBadges] = useState<Record<string, StaffBadge>>({});
  const [generatingBadge, setGeneratingBadge] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [badgePreview, setBadgePreview] = useState<{ member: any; badge: StaffBadge } | null>(null);

  // Profile modal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewProfile, setViewProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState<string | null>(null);

  // Readiness
  const [readiness, setReadiness] = useState<Record<string, ReadinessEntry>>({});
  const [viewReadiness, setViewReadiness] = useState<{ member: Member; data: ReadinessEntry } | null>(null);

  // CSV Import
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<StaffImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<{ line: number; message: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Column mapping step
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<string[][]>([]);
  const [csvParseErrors, setCsvParseErrors] = useState<{ line: number; message: string }[]>([]);

  // Pay rate editing
  const [editingPayRate, setEditingPayRate] = useState<string | null>(null);
  const [payRateInput, setPayRateInput] = useState("");

  // Bulk badge generation & download
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // Roster invitations + bulk email
  const [invitations, setInvitations] = useState<Record<string, InvitationRow>>({});
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [bulkInviting, setBulkInviting] = useState(false);
  const [showBulkEmail, setShowBulkEmail] = useState(false);

  // Single-member add form
  const [showAddMember, setShowAddMember] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [addForm, setAddForm] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: "staff" | "manager" | "admin" | "lead" | "breaker";
    sendInvite: boolean;
  }>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "staff",
    sendInvite: true,
  });

  // Load badges and readiness
  const loadInternalData = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      const bList = await getCompanyBadges(activeCompanyId);
      const bMap: Record<string, StaffBadge> = {};
      for (const b of bList) bMap[b.user_id] = b;
      setRosterBadges(bMap);
    } catch (e) { logger.swallow("roster:load-badges", e, "debug"); }
    try {
      setReadiness(await getCompanyReadiness(activeCompanyId));
    } catch (e) { logger.swallow("roster:load-readiness", e, "debug"); }
    // Roster invitations — only admins/managers see this table per RLS.
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("roster_invitations")
        .select(
          "membership_id, sent_at, expires_at, accepted_at, revoked_at, resend_count",
        )
        .eq("company_id", activeCompanyId);
      const map: Record<string, InvitationRow> = {};
      for (const row of (data ?? []) as InvitationRow[]) {
        map[row.membership_id] = row;
      }
      setInvitations(map);
    } catch (e) { logger.swallow("roster:load-invitations", e, "debug"); }
  }, [activeCompanyId]);

  /** Membership rows that need an invitation = no supabase_id linked AND no open accepted invite. */
  const unlinkedMembers = members.filter((m) => {
    if (!m.users?.email) return false;
    if (m.users?.supabase_id) return false;
    return true;
  });

  /** Linked count (members who already have an auth account). */
  const linkedMembers = members.filter((m) => Boolean(m.users?.supabase_id));

  /** Helper: status of the current invitation for a given membership. */
  function invitationStatus(membershipId: string):
    | { kind: "none" }
    | { kind: "pending"; sent_at: string }
    | { kind: "expired"; sent_at: string }
    | { kind: "accepted" }
  {
    const inv = invitations[membershipId];
    if (!inv) return { kind: "none" };
    if (inv.accepted_at) return { kind: "accepted" };
    if (inv.revoked_at) return { kind: "none" };
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return { kind: "expired", sent_at: inv.sent_at };
    }
    return { kind: "pending", sent_at: inv.sent_at };
  }

  async function callRosterInvite(membershipIds: string[]): Promise<void> {
    const base = getSupabaseFunctionsBaseUrl();
    if (!base) {
      toast.error("Invitation endpoint not configured.");
      return;
    }
    const supabase = createClient();
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) {
      toast.error("Please re-authenticate and try again.");
      return;
    }
    const res = await fetch(`${base}/roster-invite`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: activeCompanyId,
        membership_ids: membershipIds,
        resend: false,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      results?: Array<{
        membership_id: string;
        status: string;
        reason?: string;
      }>;
    };
    if (!res.ok) {
      toast.error(json.error ?? `HTTP ${res.status}`);
      return;
    }
    const results = json.results ?? [];
    const sent = results.filter((r) => r.status === "sent").length;
    const resent = results.filter((r) => r.status === "resent").length;
    const errors = results.filter((r) => r.status === "error");
    if (errors.length === 0) {
      toast.success(
        sent + resent === 1
          ? "Invitation sent."
          : `Invitations sent to ${sent + resent} members.`,
      );
    } else {
      toast.message(
        `Sent ${sent + resent} of ${results.length} invitations. ${errors.length} failed.`,
        { description: errors[0]?.reason },
      );
    }
    void loadInternalData();
  }

  async function handleInviteOne(membershipId: string) {
    setInvitingId(membershipId);
    try {
      await callRosterInvite([membershipId]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInvitingId(null);
    }
  }

  async function handleAddMember() {
    if (!addForm.firstName.trim() || !addForm.email.trim()) {
      toast.error("First name and email are required.");
      return;
    }
    // Light client-side email shape check; the RPC re-validates.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    setAddingMember(true);
    try {
      const result = await createRosterMember(activeCompanyId, {
        firstName: addForm.firstName,
        lastName: addForm.lastName,
        email: addForm.email,
        phone: addForm.phone || undefined,
        role: addForm.role,
      });
      if (result.existing_user) {
        toast.success(
          "Added to roster (this email already had an Overwatch account).",
        );
      } else {
        toast.success("Roster member added.");
      }

      // Fire the invitation if requested. We do this AFTER toast so the
      // user sees the add succeeded even if the email send hiccups.
      if (addForm.sendInvite) {
        try {
          await callRosterInvite([result.membership_id]);
        } catch (inviteErr) {
          toast.message(
            "Member added but invitation email failed.",
            { description: inviteErr instanceof Error ? inviteErr.message : undefined },
          );
        }
      }

      // Reset form + close + refresh roster.
      setAddForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "staff",
        sendInvite: true,
      });
      setShowAddMember(false);
      onReload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add roster member",
      );
    } finally {
      setAddingMember(false);
    }
  }

  async function handleInviteAllUnlinked() {
    if (unlinkedMembers.length === 0) {
      toast.message("No unlinked members on the roster.");
      return;
    }
    if (!await confirm({
      title: "Invite all unlinked members",
      description: `Send invitations to ${unlinkedMembers.length} member${unlinkedMembers.length === 1 ? "" : "s"} who don't yet have an account?`,
      confirmLabel: `Invite ${unlinkedMembers.length}`,
    })) return;
    setBulkInviting(true);
    try {
      await callRosterInvite(unlinkedMembers.map((m) => m.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invites");
    } finally {
      setBulkInviting(false);
    }
  }

  useEffect(() => { loadInternalData(); }, [loadInternalData]);

  async function openProfile(membershipId: string) {
    setLoadingProfile(membershipId);
    try {
      const profile = await getMemberProfileById(membershipId);
      setViewProfile(profile);
    } catch (err) { console.error(err); }
    finally { setLoadingProfile(null); }
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    const member = members.find((m: Member) => m.id === membershipId);
    if (member?.role === "owner" && myRole !== "owner") {
      setError("Only an owner can change another owner's role.");
      return;
    }
    if (member?.role === "owner" && newRole !== "owner") {
      if (!await confirm({ description: `Downgrade this owner to ${newRole}? This cannot be undone from the UI unless another owner restores it.` })) return;
    }
    setChangingRole(membershipId);
    setError(null);
    try { await updateMemberRole(membershipId, newRole); onReload(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to update role"); console.error(err); }
    finally { setChangingRole(null); }
  }

  async function handleRemoveMember(membershipId: string, name: string) {
    if (!await confirm({ description: `Remove ${name} from the organization?`, variant: "destructive", confirmLabel: "Remove" })) return;
    setRemovingMember(membershipId);
    setError(null);
    try { await removeMember(membershipId); onReload(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to remove member"); console.error(err); }
    finally { setRemovingMember(null); }
  }

  async function savePayRate(membershipId: string) {
    const rate = payRateInput.trim() === "" ? null : parseFloat(payRateInput);
    if (rate !== null && (isNaN(rate) || rate < 0)) { toast.error("Invalid rate"); return; }
    try {
      await updateMemberPayRate(membershipId, rate);
      toast.success("Pay rate updated");
      setEditingPayRate(null);
      onReload();
    } catch { toast.error("Failed to update rate"); }
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const { headers, rows, errors } = parseCSVRaw(text);
      if (headers.length === 0) {
        setImportErrors(errors.length > 0 ? errors : [{ line: 0, message: "No columns found in CSV" }]);
        setImportPreview([]);
        setImportResult(null);
        setShowImport(true);
        return;
      }
      setCsvHeaders(headers);
      setCsvRawRows(rows);
      setCsvParseErrors(errors);
      setShowColumnMapper(true);
      setShowImport(false);
      setImportResult(null);
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  function handleMappingConfirmed(mapping: Record<string, string | null>) {
    setShowColumnMapper(false);
    const mapped = applyMapping(csvRawRows, csvHeaders, mapping);
    const { valid, errors } = validateStaffRows(mapped);
    setImportPreview(valid);
    setImportErrors([...csvParseErrors, ...errors]);
    setImportResult(null);
    setShowImport(true);
  }

  async function handleImport() {
    if (!activeCompanyId || importPreview.length === 0) return;
    setImporting(true);
    try {
      const result = await bulkCreateApplicants(activeCompanyId, importPreview);
      setImportResult(result);
      if (result.created > 0) {
        onReload();
      }
    } catch (err) {
      setImportResult({ created: 0, errors: [err instanceof Error ? err.message : "Import failed"] });
    } finally {
      setImporting(false);
    }
  }

  const filtered = members.filter((m: Member) => {
    const name = `${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  async function handleGenerateAllBadges() {
    if (!activeCompanyId) return;
    setBulkGenerating(true);
    const membersToGen = filtered.filter((m: Member) => {
      const uid = m.user_id || m.users?.id;
      return uid && !rosterBadges[uid];
    });
    let count = 0;
    for (const m of membersToGen) {
      const uid = m.user_id || m.users?.id;
      if (!uid) continue;
      setBulkProgress(`Generating ${++count}/${membersToGen.length}...`);
      try {
        const b = await getOrCreateBadge(activeCompanyId, uid);
        setRosterBadges((prev) => ({ ...prev, [uid]: b }));
      } catch (err) {
        console.error("Badge gen failed for", uid, err);
      }
    }
    setBulkProgress("");
    setBulkGenerating(false);
    toast.success(`Generated ${count} badges`);
  }

  async function handleDownloadAllBadges() {
    if (!activeCompanyId) return;
    setBulkDownloading(true);
    const { downloadBadgeCard } = await import("@/components/badge-download");
    const company = userCompanies.find((c) => c.companyId === activeCompanyId);

    const membersWithBadges = filtered.filter((m: Member) => {
      const uid = m.user_id || m.users?.id;
      return uid && rosterBadges[uid];
    });

    let count = 0;
    for (const m of membersWithBadges) {
      const uid = m.user_id || m.users?.id;
      if (!uid) continue;
      const badge = rosterBadges[uid];
      setBulkProgress(`Downloading ${++count}/${membersWithBadges.length}...`);
      try {
        const QRCode = (await import("qrcode")).default;
        const qr = await QRCode.toDataURL(badge.qr_data, {
          width: 280,
          margin: 1,
          color: { dark: "#1a1a2e", light: "#ffffff" },
        });
        await downloadBadgeCard(
          m,
          badge,
          qr,
          companyName,
          company?.companyLogo ?? null,
          company?.brandColor ?? "#d59b3c"
        );
        // Small delay to avoid browser blocking multiple downloads
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error("Badge download failed for", uid, err);
      }
    }
    setBulkProgress("");
    setBulkDownloading(false);
    toast.success(`Downloaded ${count} badges`);
  }

  return (
    <>
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-xs text-red-500 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 font-bold hover:text-red-400">&times;</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search personnel..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          {canManageRoles && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 shrink-0"
              onClick={() => setShowAddMember((v) => !v)}
              title={showAddMember ? "Cancel" : "Add a roster member"}
              aria-label={showAddMember ? "Cancel" : "Add a roster member"}
            >
              {showAddMember
                ? <X className="h-3.5 w-3.5" />
                : <Plus className="h-3.5 w-3.5" />}
            </Button>
          )}
          {members.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={() => exportCSV(members, MEMBER_COLUMNS, `roster-${new Date().toISOString().slice(0,10)}`)} title="Download roster as CSV (data backup, payroll handoff, etc.)">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={() => csvInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSVFile} />
          {canManage && unlinkedMembers.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs shrink-0"
              onClick={handleInviteAllUnlinked}
              disabled={bulkInviting}
              title="Send Overwatch sign-in invitations to all roster members without accounts"
            >
              {bulkInviting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <MailPlus className="h-3.5 w-3.5" />}
              Invite Unlinked ({unlinkedMembers.length})
            </Button>
          )}
          {canManage && members.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs shrink-0"
              onClick={() => setShowBulkEmail(true)}
              title="Send a one-off broadcast to the whole roster"
            >
              <Mail className="h-3.5 w-3.5" /> Email Roster
            </Button>
          )}
          {canManage && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0" onClick={handleGenerateAllBadges} disabled={bulkGenerating || bulkDownloading}>
                <QrCode className="h-3.5 w-3.5" />
                {bulkGenerating ? bulkProgress : "Generate All Badges"}
              </Button>
              {Object.keys(rosterBadges).length > 0 && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0" onClick={handleDownloadAllBadges} disabled={bulkDownloading || bulkGenerating}>
                  <Download className="h-3.5 w-3.5" />
                  {bulkDownloading ? bulkProgress : `Download All (${Object.keys(rosterBadges).length})`}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Single-member add form (inline expansion, not a Dialog) */}
      {showAddMember && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAddMember();
          }}
          autoComplete="off"
          className="rounded-xl border border-primary/30 bg-card p-4 space-y-3"
        >
          <p className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add Roster Member
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">First name *</label>
              <Input
                placeholder="Jane"
                value={addForm.firstName}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, firstName: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Last name</label>
              <Input
                placeholder="Doe"
                value={addForm.lastName}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email *</label>
              <Input
                type="email"
                placeholder="jane@example.com"
                value={addForm.email}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Phone (optional)</label>
              <Input
                type="tel"
                placeholder="+1 555 555 5555"
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Role</label>
              <select
                value={addForm.role}
                onChange={(e) =>
                  setAddForm((p) => ({
                    ...p,
                    role: e.target.value as typeof p.role,
                  }))}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="staff">Staff</option>
                <option value="lead">Lead</option>
                <option value="breaker">Breaker</option>
                {/* Only owners can promote to admin/manager via the add UI;
                    we don't gate the SELECT here because the RPC re-checks. */}
                {myRole === "owner" && <option value="manager">Manager</option>}
                {myRole === "owner" && <option value="admin">Admin</option>}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={addForm.sendInvite}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, sendInvite: e.target.checked }))}
              className="h-3.5 w-3.5"
            />
            <span>
              Email an invitation to set their password
              {addForm.sendInvite
                ? ""
                : " (you can send it later from the roster)"}
            </span>
          </label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setShowAddMember(false)}
              disabled={addingMember}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={addingMember}
            >
              {addingMember
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <UserPlus className="h-3 w-3" />}
              Add member{addForm.sendInvite ? " & send invite" : ""}
            </Button>
          </div>
        </form>
      )}

      {/* CSV Column Mapping Step */}
      {showColumnMapper && (
        <CSVColumnMapper
          csvHeaders={csvHeaders}
          csvPreviewRows={csvRawRows.slice(0, 3)}
          onConfirm={handleMappingConfirmed}
          onCancel={() => setShowColumnMapper(false)}
        />
      )}

      {/* CSV Import Preview Modal */}
      {showImport && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Upload className="h-4 w-4" /> CSV Import Preview</p>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowImport(false)}><X className="h-3.5 w-3.5" /></Button>
          </div>
          {importErrors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 p-2 text-xs space-y-0.5">
              <p className="font-semibold text-destructive">Validation errors:</p>
              {importErrors.slice(0, 10).map((e, i) => <p key={i} className="text-destructive/80">Line {e.line}: {e.message}</p>)}
              {importErrors.length > 10 && <p className="text-destructive/60">...and {importErrors.length - 10} more</p>}
            </div>
          )}
          {importPreview.length > 0 && (
            <>
              <div className="max-h-48 overflow-auto rounded border border-border/40">
                 <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Name</th>
                      <th className="px-2 py-1 text-left font-medium">Email</th>
                      <th className="px-2 py-1 text-left font-medium">Phone</th>
                      <th className="px-2 py-1 text-left font-medium">Role</th>
                      <th className="px-2 py-1 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r, i) => (
                      <tr key={i} className="border-t border-border/30">
                        <td className="px-2 py-1">{r.first_name} {r.last_name}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.email}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.phone ?? "—"}</td>
                        <td className="px-2 py-1"><Badge variant="outline" className="text-[9px]">{r.role ?? "staff"}</Badge></td>
                        <td className="px-2 py-1"><Badge variant="outline" className="text-[9px] capitalize">{r.status ?? "new"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{importPreview.length} valid row{importPreview.length !== 1 ? "s" : ""} ready to import as applicants</p>
                <Button size="sm" className="gap-1.5 text-xs h-7" onClick={handleImport} disabled={importing}>
                  {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                  Import {importPreview.length}
                </Button>
              </div>
            </>
          )}
          {importResult && (
            <div className={`rounded-lg p-2 text-xs ${importResult.errors.length > 0 ? "bg-amber-500/10" : "bg-green-500/10"}`}>
              <p className={importResult.errors.length > 0 ? "text-amber-600 font-semibold" : "text-green-600 font-semibold"}>
                {importResult.created} applicant{importResult.created !== 1 ? "s" : ""} created.
              </p>
              {importResult.errors.map((e, i) => <p key={i} className="text-amber-500/80 mt-0.5">{e}</p>)}
              {importResult.created > 0 && <p className="text-muted-foreground mt-1">Switch to the Applicants tab to review and hire.</p>}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            CSV format: <code className="bg-muted/50 px-1 rounded">first_name, last_name, email, phone, role, title, guard_card_number, status, nickname, city, shirt_size, region</code>
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">{members.length === 0 ? "No personnel yet" : "No matches"}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {members.length === 0 ? "Share your company code to recruit team members." : "Try a different search."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m: Member) => {
            const u = m.users;
            return (
              <div key={m.id} className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-2">
                {/* Row 1: Avatar + Name + Role */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={u?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                      {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u?.first_name} {u?.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u?.email}</p>
                  </div>
                  <div className="relative shrink-0">
                    {(() => {
                      const roleOptions = myRole === "owner"
                        ? ["owner", "admin", "instructor", "manager", "lead", "breaker", "staff"]
                        : myRole === "admin"
                          ? ["admin", "instructor", "manager", "lead", "breaker", "staff"]
                          : ["manager", "lead", "breaker", "staff"];
                      const canEdit = canManageRoles && roleOptions.includes(m.role);
                      return canEdit ? (
                        <>
                          <select value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                            disabled={changingRole === m.id}
                            className="h-6 appearance-none rounded border border-border/40 bg-background px-2 pr-5 text-[10px] font-medium capitalize cursor-pointer disabled:opacity-50">
                            {roleOptions.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                        </>
                      ) : (
                        <Badge variant="outline" className="text-[10px] capitalize">{m.role}</Badge>
                      );
                    })()}
                  </div>
                </div>
                {/* Pay Rate */}
                {canManage && (
                  <div className="flex items-center gap-1 ml-[52px]">
                    {editingPayRate === m.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payRateInput}
                          onChange={(e) => setPayRateInput(e.target.value)}
                          className="w-16 h-6 text-xs rounded border border-border bg-background px-1 text-right"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") savePayRate(m.id); if (e.key === "Escape") setEditingPayRate(null); }}
                        />
                        <span className="text-[10px] text-muted-foreground">/hr</span>
                        <button onClick={() => savePayRate(m.id)} className="text-green-500 hover:text-green-400"><Check className="h-3 w-3" /></button>
                        <button onClick={() => setEditingPayRate(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingPayRate(m.id); setPayRateInput(m.pay_rate_override?.toString() ?? ""); }}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        title="Set pay rate"
                      >
                        {m.pay_rate_override != null
                          ? <span className="text-green-500">${Number(m.pay_rate_override).toFixed(2)}/hr</span>
                          : <span className="text-muted-foreground/50">Set rate</span>
                        }
                      </button>
                    )}
                  </div>
                )}
                {/* Row 2: Status + Actions */}
                <div className="flex items-center gap-2 ml-[52px]">
                  <Badge variant={m.status === "active" ? "default" : "outline"} className="text-[10px] capitalize">{m.status}</Badge>
                  {(() => {
                    // Show invite-state badge only when relevant.
                    if (m.users?.supabase_id) return null;
                    const inv = invitationStatus(m.id);
                    if (inv.kind === "pending") {
                      const days = Math.max(
                        0,
                        Math.floor((Date.now() - new Date(inv.sent_at).getTime()) / 86400000),
                      );
                      return (
                        <Badge variant="outline" className="text-[10px] gap-1" title={`Invite sent ${days === 0 ? "today" : `${days}d ago`}`}>
                          <Mail className="h-2.5 w-2.5" /> Invite sent
                        </Badge>
                      );
                    }
                    if (inv.kind === "expired") {
                      return (
                        <Badge variant="outline" className="text-[10px] text-amber-500" title="Invite expired — resend">
                          Invite expired
                        </Badge>
                      );
                    }
                    return (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        No account
                      </Badge>
                    );
                  })()}
                  <div className="flex items-center gap-1 ml-auto">
                    {canManage && !m.users?.supabase_id && m.users?.email && (() => {
                      const inv = invitationStatus(m.id);
                      const isResend = inv.kind === "pending" || inv.kind === "expired";
                      return (
                        <button
                          onClick={() => handleInviteOne(m.id)}
                          disabled={invitingId === m.id || bulkInviting}
                          className="rounded p-1.5 text-muted-foreground/40 hover:text-primary hover:bg-primary/10"
                          title={isResend ? "Resend invitation" : "Send invitation"}
                        >
                          {invitingId === m.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : isResend
                            ? <RotateCw className="h-3.5 w-3.5" />
                            : <MailPlus className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })()}
                    {canManage && (
                      <button onClick={() => openProfile(m.id)} disabled={loadingProfile === m.id}
                        className="rounded p-1.5 text-muted-foreground/40 hover:text-primary hover:bg-primary/10" title="View profile">
                        {loadingProfile === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {canManage && (() => {
                      const r = readiness[m.id];
                      if (!r) return null;
                      const hasRequired = r.readingMissing.length > 0;
                      const hasProfile = r.profileMissing.length > 0;
                      const isGreen = !hasRequired && !hasProfile;
                      return (
                        <button onClick={() => setViewReadiness({ member: m, data: r })}
                          className={`rounded p-1.5 transition-colors ${isGreen ? "text-green-500 hover:bg-green-500/10" : hasRequired ? "text-red-500 hover:bg-red-500/10" : "text-amber-500 hover:bg-amber-500/10"}`}
                          title={isGreen ? "All clear" : hasRequired ? "Missing required tasks" : "Incomplete profile"}>
                          {isGreen ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertOctagon className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })()}
                    {canManage && (() => {
                      const uid = m.user_id || u?.id;
                      if (!uid) return null;
                      const hasBadge = !!rosterBadges[uid];
                      return (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!uid || !activeCompanyId) return;
                            if (hasBadge) {
                              // Open badge preview modal
                              setBadgePreview({ member: m, badge: rosterBadges[uid] });
                            } else {
                              // Generate badge, then open preview
                              setGeneratingBadge(uid);
                              try {
                                const b = await getOrCreateBadge(activeCompanyId, uid);
                                setRosterBadges((p) => ({ ...p, [uid]: b }));
                                setBadgePreview({ member: m, badge: b });
                              } catch (err) { console.error("Badge gen failed:", err); }
                              setGeneratingBadge(null);
                            }
                          }}
                          disabled={generatingBadge === uid}
                          className={`rounded p-1.5 transition-colors ${hasBadge ? "text-primary hover:bg-primary/10" : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10"}`}
                          title={hasBadge ? "View badge" : "Generate badge"}
                        >
                          {generatingBadge === uid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })()}
                    {canManageRoles && m.role !== "owner" && (
                      <button onClick={() => handleRemoveMember(m.id, `${u?.first_name} ${u?.last_name}`)} disabled={removingMember === m.id}
                        className="rounded p-1.5 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Remove member">
                        {removingMember === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Member Profile Modal ── */}
      {viewProfile && (
        <MemberProfileModal profile={viewProfile} onClose={() => setViewProfile(null)} />
      )}

      {/* ── Readiness Modal ── */}
      {viewReadiness && (
        <ReadinessModal data={viewReadiness} onClose={() => setViewReadiness(null)} />
      )}

      {/* ── Badge Preview Modal ── */}
      <ConfirmDialog />
      {badgePreview && (
        <BadgePreviewModal
          member={badgePreview.member}
          badge={badgePreview.badge}
          companyName={companyName}
          companyLogo={userCompanies.find((c) => c.companyId === activeCompanyId)?.companyLogo ?? null}
          brandColor={userCompanies.find((c) => c.companyId === activeCompanyId)?.brandColor ?? "#d59b3c"}
          onClose={() => setBadgePreview(null)}
        />
      )}

      {/* ── Bulk Email Modal ── */}
      <RosterBulkEmailModal
        companyId={activeCompanyId}
        rosterCount={members.length}
        linkedCount={linkedMembers.length}
        open={showBulkEmail}
        onClose={() => setShowBulkEmail(false)}
      />
    </>
  );
}
