"use client";

import { useState } from "react";
import { ShieldCheck, Plus, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { addCertification, deleteCertification, getUserCertifications } from "@/lib/supabase/db";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import type { LegacyCertificate } from "@/lib/legacy-bridge";

export type Cert = { id: string; cert_type: string; issue_date: string | null; expiry_date: string | null; status: string };

type UnifiedCert = {
  id: string; name: string; source: "manual" | "training" | "course";
  issueDate: string | null; expiryDate: string | null; status: string;
  extra?: string; canDelete: boolean; verificationCode?: string | null; certNumber?: string | null;
};

interface CertificationsSectionProps {
  owCerts: Cert[];
  legacyCertificates: LegacyCertificate[];
  onCertsChange: (certs: Cert[]) => void;
}

export default function CertificationsSection({ owCerts, legacyCertificates, onCertsChange }: CertificationsSectionProps) {
  const now = new Date();
  const [showAddCert, setShowAddCert] = useState(false);
  const [certType, setCertType] = useState("");
  const [certIssue, setCertIssue] = useState("");
  const [certExpiry, setCertExpiry] = useState("");
  const [certState, setCertState] = useState("");
  const [addingCert, setAddingCert] = useState(false);
  const [deletingCert, setDeletingCert] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  async function handleAddCert() {
    if (!certType.trim()) return;
    setAddingCert(true);
    try {
      await addCertification({ 
        certType: certType.trim(), 
        issueDate: certIssue || undefined, 
        expiryDate: certExpiry || undefined,
        stateIssued: certState.trim() || undefined
      });
      setCertType(""); setCertIssue(""); setCertExpiry(""); setCertState(""); setShowAddCert(false);
      onCertsChange(await getUserCertifications() as Cert[]);
    } catch (err) { console.error(err); } finally { setAddingCert(false); }
  }

  async function handleDeleteCert(id: string) {
    if (!await confirm({ description: "Delete this certification?", variant: "destructive" })) return;
    setDeletingCert(id);
    try { await deleteCertification(id); onCertsChange(await getUserCertifications() as Cert[]); }
    catch (err) { console.error(err); } finally { setDeletingCert(null); }
  }

  // Build unified cert list
  const unified: UnifiedCert[] = [];
  for (const c of owCerts) {
    const isTraining = !!(c as Record<string, unknown>).module_id || !!(c as Record<string, unknown>).quiz_id;
    unified.push({
      id: c.id, name: c.cert_type, source: isTraining ? "training" : "manual",
      issueDate: c.issue_date, expiryDate: c.expiry_date, status: c.status, canDelete: !isTraining,
      verificationCode: (c as Record<string, unknown>).verification_code as string | null,
      certNumber: (c as Record<string, unknown>).certificate_number as string | null,
      extra: (c as Record<string, unknown>).state_issued ? `State: ${(c as Record<string, unknown>).state_issued}` : undefined,
    });
  }
  for (const lc of legacyCertificates) {
    unified.push({
      id: `legacy-${lc.id}`, name: lc.certificate_name || lc.certificate_type, source: "course",
      issueDate: lc.issue_date, expiryDate: lc.expiration_date,
      status: lc.status === "revoked" ? "revoked" : "active", canDelete: false,
      verificationCode: lc.verification_code, certNumber: lc.certificate_number,
      extra: lc.state_issued ? `State: ${lc.state_issued}` : undefined,
    });
  }
  unified.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return (b.issueDate ?? "").localeCompare(a.issueDate ?? "");
  });

  const sourceColors = { manual: "bg-slate-500/15 text-slate-500", training: "bg-violet-500/15 text-violet-600", course: "bg-amber-500/15 text-amber-600" };
  const sourceLabels = { manual: "Manual", training: "Training", course: "Course" };

  return (
    <Card className="border-border/40">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div><h3 className="text-sm font-semibold">My Certifications</h3><p className="text-xs text-muted-foreground">Guard cards, licenses, training awards, and course certificates</p></div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddCert(true)}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
        {showAddCert && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Input placeholder="Certification type (e.g. Guard Card, CPR, BSIS) *" value={certType} onChange={(e) => setCertType(e.target.value)} />
            <div className="flex gap-2">
              <div className="flex-1"><label className="text-[10px] text-muted-foreground">Issue Date</label><Input type="date" value={certIssue} onChange={(e) => setCertIssue(e.target.value)} className="h-8 text-sm" /></div>
              <div className="flex-1"><label className="text-[10px] text-muted-foreground">Expiry Date</label><Input type="date" value={certExpiry} onChange={(e) => setCertExpiry(e.target.value)} className="h-8 text-sm" /></div>
            </div>
            {(certType.toLowerCase().includes("state license") || certType.toLowerCase().includes("abc certification")) && (
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">State</label>
                <select value={certState} onChange={(e) => setCertState(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                  <option value="">Select state...</option>
                  <option value="AL">Alabama</option>
                  <option value="AK">Alaska</option>
                  <option value="AZ">Arizona</option>
                  <option value="AR">Arkansas</option>
                  <option value="CA">California</option>
                  <option value="CO">Colorado</option>
                  <option value="CT">Connecticut</option>
                  <option value="DE">Delaware</option>
                  <option value="FL">Florida</option>
                  <option value="GA">Georgia</option>
                  <option value="HI">Hawaii</option>
                  <option value="ID">Idaho</option>
                  <option value="IL">Illinois</option>
                  <option value="IN">Indiana</option>
                  <option value="IA">Iowa</option>
                  <option value="KS">Kansas</option>
                  <option value="KY">Kentucky</option>
                  <option value="LA">Louisiana</option>
                  <option value="ME">Maine</option>
                  <option value="MD">Maryland</option>
                  <option value="MA">Massachusetts</option>
                  <option value="MI">Michigan</option>
                  <option value="MN">Minnesota</option>
                  <option value="MS">Mississippi</option>
                  <option value="MO">Missouri</option>
                  <option value="MT">Montana</option>
                  <option value="NE">Nebraska</option>
                  <option value="NV">Nevada</option>
                  <option value="NH">New Hampshire</option>
                  <option value="NJ">New Jersey</option>
                  <option value="NM">New Mexico</option>
                  <option value="NY">New York</option>
                  <option value="NC">North Carolina</option>
                  <option value="ND">North Dakota</option>
                  <option value="OH">Ohio</option>
                  <option value="OK">Oklahoma</option>
                  <option value="OR">Oregon</option>
                  <option value="PA">Pennsylvania</option>
                  <option value="RI">Rhode Island</option>
                  <option value="SC">South Carolina</option>
                  <option value="SD">South Dakota</option>
                  <option value="TN">Tennessee</option>
                  <option value="TX">Texas</option>
                  <option value="UT">Utah</option>
                  <option value="VT">Vermont</option>
                  <option value="VA">Virginia</option>
                  <option value="WA">Washington</option>
                  <option value="WV">West Virginia</option>
                  <option value="WI">Wisconsin</option>
                  <option value="WY">Wyoming</option>
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddCert} disabled={!certType.trim() || addingCert}>{addingCert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddCert(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {unified.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-4">
            <ShieldCheck className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No certifications yet. Add your guard card, CPR, or other credentials.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {unified.map((c) => {
              const isExpired = c.status === "revoked" || (c.expiryDate && new Date(c.expiryDate) < now);
              const isExpiringSoon = c.expiryDate && !isExpired && (new Date(c.expiryDate).getTime() - now.getTime()) < 90 * 24 * 60 * 60 * 1000;
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                  <ShieldCheck className={`h-4 w-4 shrink-0 ${isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-green-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <Badge className={`text-[8px] px-1.5 py-0 ${sourceColors[c.source]}`}>{sourceLabels[c.source]}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                      {c.issueDate && <span>Issued: {new Date(c.issueDate).toLocaleDateString()}</span>}
                      {c.expiryDate && <span>Expires: {new Date(c.expiryDate).toLocaleDateString()}</span>}
                      {c.certNumber && <span className="font-mono">#{c.certNumber}</span>}
                      {c.extra && <span>{c.extra}</span>}
                    </div>
                  </div>
                  {isExpired ? <Badge className="text-[9px] bg-red-500/15 text-red-600">{c.status === "revoked" ? "Revoked" : "Expired"}</Badge>
                    : isExpiringSoon ? <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Expiring</Badge>
                    : <Badge className="text-[9px] bg-green-500/15 text-green-600">Active</Badge>}
                  {c.canDelete && (
                    <button onClick={() => handleDeleteCert(c.id)} disabled={deletingCert === c.id}
                      className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete">
                      {deletingCert === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <ConfirmDialog />
    </Card>
  );
}
