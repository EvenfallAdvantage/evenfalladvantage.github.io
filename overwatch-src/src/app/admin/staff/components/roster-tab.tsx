"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Users, Search, Loader2, Trash2, ChevronDown,
  Eye, ShieldCheck, AlertOctagon, QrCode,
  UserPlus, X, Upload, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  updateMemberRole, removeMember, getMemberProfileById, getCompanyReadiness,
} from "@/lib/supabase/db";
import { exportCSV, MEMBER_COLUMNS } from "@/lib/csv-export";
import { parseCSV, validateStaffRows, type StaffImportRow } from "@/lib/csv-import";
import { bulkCreateApplicants } from "@/lib/supabase/db-onboarding";
import { getOrCreateBadge, getCompanyBadges, type StaffBadge } from "@/lib/supabase/db-badges";
import { MemberProfileModal } from "./member-profile-modal";
import { ReadinessModal } from "./readiness-modal";
import QRCode from "qrcode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

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
  const [search, setSearch] = useState("");
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Badges
  const [rosterBadges, setRosterBadges] = useState<Record<string, StaffBadge>>({});
  const [rosterQR, setRosterQR] = useState<Record<string, string>>({});
  const [generatingBadge, setGeneratingBadge] = useState<string | null>(null);

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

  // Load badges and readiness
  const loadInternalData = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const bList = await getCompanyBadges(activeCompanyId);
      const bMap: Record<string, StaffBadge> = {};
      for (const b of bList) bMap[b.user_id] = b;
      setRosterBadges(bMap);
    } catch {}
    try {
      setReadiness(await getCompanyReadiness(activeCompanyId));
    } catch {}
  }, [activeCompanyId]);

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
      if (!confirm(`Downgrade this owner to ${newRole}? This cannot be undone from the UI unless another owner restores it.`)) return;
    }
    setChangingRole(membershipId);
    setError(null);
    try { await updateMemberRole(membershipId, newRole); onReload(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to update role"); console.error(err); }
    finally { setChangingRole(null); }
  }

  async function handleRemoveMember(membershipId: string, name: string) {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    setRemovingMember(membershipId);
    setError(null);
    try { await removeMember(membershipId); onReload(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to remove member"); console.error(err); }
    finally { setRemovingMember(null); }
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseCSV(text);
      const { valid, errors } = validateStaffRows(parsed.rows);
      setImportPreview(valid);
      setImportErrors([...parsed.errors, ...errors]);
      setImportResult(null);
      setShowImport(true);
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  async function handleImport() {
    if (!activeCompanyId || activeCompanyId === "pending" || importPreview.length === 0) return;
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
          {members.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={() => exportCSV(members, MEMBER_COLUMNS, `roster-${new Date().toISOString().slice(0,10)}`)}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={() => csvInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSVFile} />
        </div>
      </div>

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
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r, i) => (
                      <tr key={i} className="border-t border-border/30">
                        <td className="px-2 py-1">{r.first_name} {r.last_name}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.email}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.phone ?? "—"}</td>
                        <td className="px-2 py-1"><Badge variant="outline" className="text-[9px]">{r.role ?? "staff"}</Badge></td>
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
            CSV format: <code className="bg-muted/50 px-1 rounded">first_name, last_name, email, phone, role, title, guard_card_number</code>
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
                {/* Row 2: Status + Actions */}
                <div className="flex items-center gap-2 ml-[52px]">
                  <Badge variant={m.status === "active" ? "default" : "outline"} className="text-[10px] capitalize">{m.status}</Badge>
                  <div className="flex items-center gap-1 ml-auto">
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
                      const hasBadge = !!rosterBadges[uid];
                      return (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!uid || !activeCompanyId) return;
                            if (hasBadge) {
                              // Download badge
                              setGeneratingBadge(uid);
                              try {
                                const b = rosterBadges[uid];
                                let qr = rosterQR[uid];
                                if (!qr) {
                                  qr = await QRCode.toDataURL(b.qr_data, { width: 200, margin: 1, errorCorrectionLevel: "H" });
                                  setRosterQR((p) => ({ ...p, [uid]: qr }));
                                }
                                const { downloadBadgeCard } = await import("@/components/badge-download");
                                const company = userCompanies.find((c) => c.companyId === activeCompanyId);
                                await downloadBadgeCard(m, b, qr, companyName, company?.companyLogo ?? null, company?.brandColor ?? "#d59b3c");
                              } catch (err) { console.error("Badge download failed:", err); }
                              setGeneratingBadge(null);
                            } else {
                              // Generate badge
                              setGeneratingBadge(uid);
                              try {
                                const b = await getOrCreateBadge(activeCompanyId, uid);
                                setRosterBadges((p) => ({ ...p, [uid]: b }));
                              } catch (err) { console.error("Badge gen failed:", err); }
                              setGeneratingBadge(null);
                            }
                          }}
                          disabled={generatingBadge === uid}
                          className={`rounded p-1.5 transition-colors ${hasBadge ? "text-primary hover:bg-primary/10" : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10"}`}
                          title={hasBadge ? "Download badge" : "Generate badge"}
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
    </>
  );
}
