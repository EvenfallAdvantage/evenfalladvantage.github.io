"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Target, ChevronRight, Zap, ShieldCheck, AlertTriangle, TrendingUp, FileText, Plus, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getQuizzes, getKBFolders, getUserCertifications, addCertification, deleteCertification } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cert = any;

function RadialGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-border/30" />
          <circle cx="48" cy="48" r="40" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold font-mono">{value}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

export default function TrainingPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [quizCount, setQuizCount] = useState(0);
  const [folderCount, setFolderCount] = useState(0);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAddCert, setShowAddCert] = useState(false);
  const [certType, setCertType] = useState("");
  const [certIssue, setCertIssue] = useState("");
  const [certExpiry, setCertExpiry] = useState("");
  const [addingCert, setAddingCert] = useState(false);
  const [deletingCert, setDeletingCert] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoaded(true); return; }
    try {
      const [q, f, c] = await Promise.all([
        getQuizzes(activeCompanyId),
        getKBFolders(activeCompanyId),
        getUserCertifications(),
      ]);
      setQuizCount(q.length);
      setFolderCount(f.length);
      setCerts(c);
    } catch {} finally { setLoaded(true); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleAddCert() {
    if (!certType.trim()) return;
    setAddingCert(true);
    try {
      await addCertification({ certType: certType.trim(), issueDate: certIssue || undefined, expiryDate: certExpiry || undefined });
      setCertType(""); setCertIssue(""); setCertExpiry(""); setShowAddCert(false);
      setCerts(await getUserCertifications());
    } catch (err) { console.error(err); }
    finally { setAddingCert(false); }
  }

  async function handleDeleteCert(id: string) {
    if (!confirm("Delete this certification?")) return;
    setDeletingCert(id);
    try { await deleteCertification(id); setCerts(await getUserCertifications()); }
    catch (err) { console.error(err); }
    finally { setDeletingCert(null); }
  }

  const now = new Date();
  const expiringSoon = certs.filter((c: Cert) => {
    if (!c.expiry_date) return false;
    const diff = new Date(c.expiry_date).getTime() - now.getTime();
    return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
  });
  const activeCerts = certs.filter((c: Cert) => c.status === "active");
  const certPercent = activeCerts.length > 0
    ? Math.round((activeCerts.filter((c: Cert) => !c.expiry_date || new Date(c.expiry_date) > now).length / activeCerts.length) * 100)
    : 0;

  const readinessLevel = quizCount > 0 || folderCount > 0 ? "ACTIVE" : "STANDBY";
  const readinessColor = readinessLevel === "ACTIVE" ? "text-green-500" : "text-amber-500";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with readiness indicator */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">READINESS CENTER</h1>
            <p className="text-sm text-muted-foreground">Tactical training, SOPs, and operational drills</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${readinessLevel === "ACTIVE" ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
            <span className={`text-xs font-mono font-bold ${readinessColor}`}>{readinessLevel}</span>
          </div>
        </div>

        {/* Readiness gauges */}
        <Card className="border-border/40 bg-gradient-to-br from-card to-card/80">
          <CardContent className="py-6">
            <div className="flex items-center justify-around">
              <RadialGauge value={loaded ? (folderCount > 0 ? 100 : 0) : 0} label="SOPs Loaded" color="#3b82f6" />
              <RadialGauge value={loaded ? (quizCount > 0 ? Math.min(quizCount * 25, 100) : 0) : 0} label="Drill Readiness" color="#f59e0b" />
              <RadialGauge value={loaded ? certPercent : 0} label="Certs Current" color="#10b981" />
            </div>
          </CardContent>
        </Card>

        {/* Action cards — larger, more tactile */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/knowledge-base">
            <Card className="group relative h-full cursor-pointer overflow-hidden border-border/40 transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-1">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-blue-500/5 transition-transform group-hover:scale-150" />
              <CardContent className="relative flex items-start gap-4 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 transition-transform group-hover:scale-110">
                  <BookOpen className="h-7 w-7 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">Field Manual</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">SOPs, protocols, and reference materials</p>
                  {loaded && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        <FileText className="mr-1 h-3 w-3" />
                        {folderCount} {folderCount === 1 ? "section" : "sections"}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/quizzes">
            <Card className="group relative h-full cursor-pointer overflow-hidden border-border/40 transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-1">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-amber-500/5 transition-transform group-hover:scale-150" />
              <CardContent className="relative flex items-start gap-4 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 transition-transform group-hover:scale-110">
                  <Target className="h-7 w-7 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">Drills</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Training assessments and readiness checks</p>
                  {loaded && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        <Zap className="mr-1 h-3 w-3" />
                        {quizCount} {quizCount === 1 ? "drill" : "drills"} available
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Status cards row */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Certifications</p>
              <p className="text-sm font-semibold font-mono">{activeCerts.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Expiring Soon</p>
              <p className="text-sm font-semibold font-mono">{expiringSoon.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Completion Rate</p>
              <p className="text-sm font-semibold font-mono">{loaded && quizCount > 0 ? `${Math.min(quizCount * 25, 100)}%` : "—"}</p>
            </div>
          </div>
        </div>

        {/* Certifications section */}
        <Card className="border-border/40">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">My Certifications</h3>
                <p className="text-xs text-muted-foreground">Guard cards, licenses, and credentials</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddCert(true)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>

            {showAddCert && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Input placeholder="Certification type (e.g. Guard Card, CPR, BSIS) *" value={certType} onChange={(e) => setCertType(e.target.value)} />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground">Issue Date</label>
                    <Input type="date" value={certIssue} onChange={(e) => setCertIssue(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground">Expiry Date</label>
                    <Input type="date" value={certExpiry} onChange={(e) => setCertExpiry(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddCert} disabled={!certType.trim() || addingCert}>
                    {addingCert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddCert(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {certs.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-4">
                <ShieldCheck className="h-5 w-5 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No certifications added yet. Add your guard card, CPR, or other credentials.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {certs.map((c: Cert) => {
                  const isExpired = c.expiry_date && new Date(c.expiry_date) < now;
                  const isExpiringSoon = c.expiry_date && !isExpired && (new Date(c.expiry_date).getTime() - now.getTime()) < 90 * 24 * 60 * 60 * 1000;
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                      <ShieldCheck className={`h-4 w-4 shrink-0 ${isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-green-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{c.cert_type}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {c.issue_date && <span>Issued: {new Date(c.issue_date).toLocaleDateString()}</span>}
                          {c.expiry_date && <span>Expires: {new Date(c.expiry_date).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      {isExpired ? (
                        <Badge className="text-[9px] bg-red-500/15 text-red-600">Expired</Badge>
                      ) : isExpiringSoon ? (
                        <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Expiring</Badge>
                      ) : (
                        <Badge className="text-[9px] bg-green-500/15 text-green-600">Active</Badge>
                      )}
                      <button onClick={() => handleDeleteCert(c.id)} disabled={deletingCert === c.id}
                        className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete">
                        {deletingCert === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
