"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Award, Plus, Trash2, Loader2, Download, Search, CheckCircle2,
  AlertTriangle, Clock, Shield, Hash, Calendar, Upload, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getUserCertifications, addCertification, deleteCertification, verifyCertificate } from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";

type Cert = {
  id: string;
  cert_type: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  certificate_number?: string | null;
  issued_by?: string | null;
  verification_code?: string | null;
  category?: string | null;
  module_id?: string | null;
  quiz_id?: string | null;
  document_url?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VerifyResult = { cert_type: string; issue_date: string | null; expiry_date: string | null; status: string; users: any; certificate_number?: string; issued_by?: string };

function generateCertPDF(cert: Cert, userName: string) {
  return import("jspdf").then(({ jsPDF }) => {
    const pdf = new jsPDF("l", "mm", "a4"); // landscape
    const w = 297, h = 210;

    // Background
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, w, h, "F");

    // Gold border
    pdf.setDrawColor(234, 179, 8);
    pdf.setLineWidth(2);
    pdf.rect(10, 10, w - 20, h - 20, "S");
    pdf.setLineWidth(0.5);
    pdf.rect(14, 14, w - 28, h - 28, "S");

    // Header
    pdf.setTextColor(234, 179, 8);
    pdf.setFontSize(14);
    pdf.text("OVERWATCH SECURITY PLATFORM", w / 2, 35, { align: "center" });

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    pdf.text("CERTIFICATE OF COMPLETION", w / 2, 55, { align: "center" });

    // Divider
    pdf.setDrawColor(234, 179, 8);
    pdf.setLineWidth(1);
    pdf.line(w / 2 - 60, 62, w / 2 + 60, 62);

    // Body
    pdf.setTextColor(203, 213, 225); // slate-300
    pdf.setFontSize(12);
    pdf.text("This certifies that", w / 2, 78, { align: "center" });

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(28);
    pdf.text(userName || "Security Professional", w / 2, 93, { align: "center" });

    pdf.setTextColor(203, 213, 225);
    pdf.setFontSize(12);
    pdf.text("has successfully completed", w / 2, 108, { align: "center" });

    pdf.setTextColor(234, 179, 8);
    pdf.setFontSize(22);
    pdf.text(cert.cert_type, w / 2, 123, { align: "center" });

    // Details row
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.setFontSize(10);
    const details: string[] = [];
    if (cert.issue_date) details.push(`Issued: ${cert.issue_date}`);
    if (cert.certificate_number) details.push(`Certificate #: ${cert.certificate_number}`);
    if (cert.verification_code) details.push(`Verification: ${cert.verification_code}`);
    pdf.text(details.join("   |   "), w / 2, 140, { align: "center" });

    if (cert.issued_by) {
      pdf.setFontSize(10);
      pdf.text(`Issued by: ${cert.issued_by}`, w / 2, 150, { align: "center" });
    }

    if (cert.expiry_date) {
      pdf.setTextColor(251, 146, 60); // orange-400
      pdf.setFontSize(9);
      pdf.text(`Valid through: ${cert.expiry_date}`, w / 2, 160, { align: "center" });
    }

    // Footer
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.setFontSize(8);
    pdf.text("Evenfall Advantage LLC  •  Overwatch Security Platform", w / 2, h - 22, { align: "center" });

    const fileName = `Certificate_${cert.cert_type.replace(/\s+/g, "_")}_${cert.certificate_number || "cert"}.pdf`;
    pdf.save(fileName);
  });
}

export default function CertificationsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const user = useAuthStore((s) => s.user);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Form
  const [certType, setCertType] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [category, setCategory] = useState("general");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Verification
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getUserCertifications();
      setCerts(data as Cert[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function uploadCertFile(file: File): Promise<string | null> {
    try {
      setUploading(true);
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `${authUser.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("certifications").upload(path, file, { upsert: true });
      if (error) { console.error("Cert upload error:", error); return null; }
      const { data: urlData } = supabase.storage.from("certifications").getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err) { console.error("Upload failed:", err); return null; }
    finally { setUploading(false); }
  }

  async function handleAdd() {
    if (!certType.trim()) return;
    setAdding(true);
    try {
      let documentUrl: string | undefined;
      if (certFile) {
        const url = await uploadCertFile(certFile);
        if (url) documentUrl = url;
      }
      await addCertification({
        certType: certType.trim(),
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        issuedBy: issuedBy.trim() || undefined,
        documentUrl,
        category,
        companyId: activeCompanyId && activeCompanyId !== "pending" ? activeCompanyId : undefined,
        certificateNumber: `CERT-${Date.now().toString(36).toUpperCase()}`,
        verificationCode: crypto.randomUUID().split("-").slice(0, 2).join("").toUpperCase(),
      });
      setCertType(""); setIssueDate(new Date().toISOString().split("T")[0]);
      setExpiryDate(""); setIssuedBy(""); setCategory("general"); setCertFile(null);
      setShowAdd(false);
      await load();
    } catch (err) { console.error(err); }
    finally { setAdding(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this certification?")) return;
    setDeleting(id);
    try { await deleteCertification(id); await load(); }
    catch (err) { console.error(err); }
    finally { setDeleting(null); }
  }

  async function handleDownload(cert: Cert) {
    setDownloading(cert.id);
    try {
      const name = user ? `${user.firstName} ${user.lastName}` : "Security Professional";
      await generateCertPDF(cert, name);
    } catch (err) { console.error(err); }
    finally { setDownloading(null); }
  }

  async function handleVerify() {
    if (!verifyCode.trim()) return;
    setVerifying(true); setVerifyResult(null); setVerifyError("");
    try {
      const result = await verifyCertificate(verifyCode.trim());
      if (result) setVerifyResult(result as VerifyResult);
      else setVerifyError("No certificate found with that verification code.");
    } catch { setVerifyError("Verification failed."); }
    finally { setVerifying(false); }
  }

  const now = new Date();
  const fmtDate = (d: string | null) => {
    if (!d) return null;
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch { return d; }
  };
  const active = certs.filter((c) => c.status === "active");
  const expiring = active.filter((c) => {
    if (!c.expiry_date) return false;
    const diff = new Date(c.expiry_date).getTime() - now.getTime();
    return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
  });
  const expired = active.filter((c) => c.expiry_date && new Date(c.expiry_date) < now);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
              <Award className="h-5 w-5 sm:h-6 sm:w-6" /> CERTIFICATIONS
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage credentials, generate certificates, and verify</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Certification
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono">{certs.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono text-green-500">{active.length - expired.length}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono text-amber-500">{expiring.length}</p>
            <p className="text-[10px] text-muted-foreground">Expiring Soon</p>
          </CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold font-mono text-red-500">{expired.length}</p>
            <p className="text-[10px] text-muted-foreground">Expired</p>
          </CardContent></Card>
        </div>

        {/* Add Form */}
        {showAdd && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">New Certification</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Certification Name *" value={certType} onChange={(e) => setCertType(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Issued By" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} className="h-8 text-sm" />
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input type="date" placeholder="Expiry" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="h-8 text-sm" />
                </div>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm">
                  <option value="general">General</option>
                  <option value="training">Training</option>
                  <option value="firearms">Firearms</option>
                  <option value="first_aid">First Aid / CPR</option>
                  <option value="state_license">State License</option>
                  <option value="specialty">Specialty</option>
                </select>
                <label className="flex items-center gap-2 h-8 rounded-md border border-input bg-transparent px-2 text-sm cursor-pointer hover:bg-muted/30 transition-colors col-span-2 sm:col-span-1">
                  <Upload className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-muted-foreground">{certFile ? certFile.name : "Upload document..."}</span>
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={adding || uploading || !certType.trim()}>
                  {adding || uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {uploading ? "Uploading..." : "Add"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certificate Verification */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Shield className="h-4 w-4" /> Verify a Certificate</h3>
            <div className="flex gap-2">
              <Input placeholder="Enter verification code..." value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)} className="h-8 text-sm max-w-xs" />
              <Button size="sm" onClick={handleVerify} disabled={verifying || !verifyCode.trim()}>
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Verify
              </Button>
            </div>
            {verifyResult && (
              <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
                <div className="flex items-center gap-1 text-green-600 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Certificate Verified
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>{verifyResult.cert_type}</strong>
                  {verifyResult.users && ` — ${verifyResult.users.first_name} ${verifyResult.users.last_name}`}
                  {verifyResult.issue_date && ` — Issued ${verifyResult.issue_date}`}
                  {verifyResult.issued_by && ` by ${verifyResult.issued_by}`}
                </p>
              </div>
            )}
            {verifyError && (
              <p className="mt-2 text-xs text-red-500">{verifyError}</p>
            )}
          </CardContent>
        </Card>

        {/* Cert List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : certs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No certifications yet. Add one to get started.</p>
        ) : (
          <div className="space-y-2">
            {certs.map((cert) => {
              const isExpired = cert.expiry_date && new Date(cert.expiry_date) < now;
              const isExpiring = cert.expiry_date && !isExpired && (new Date(cert.expiry_date).getTime() - now.getTime()) < 90 * 24 * 60 * 60 * 1000;
              return (
                <Card key={cert.id} className={`border-border/40 ${isExpired ? "opacity-60" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isExpired ? "bg-red-500/15" : isExpiring ? "bg-amber-500/15" : "bg-green-500/15"}`}>
                        {isExpired ? <AlertTriangle className="h-4 w-4 text-red-500" /> : isExpiring ? <Clock className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{cert.cert_type}</span>
                          {cert.category && cert.category !== "general" && (
                            <Badge className="text-[9px] bg-muted">{cert.category}</Badge>
                          )}
                          {isExpired && <Badge className="text-[9px] bg-red-500/15 text-red-600">Expired</Badge>}
                          {isExpiring && <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Expiring Soon</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
                          {cert.issue_date && <span>Issued: {fmtDate(cert.issue_date)}</span>}
                          {cert.expiry_date && <span>Expires: {fmtDate(cert.expiry_date)}</span>}
                          {cert.issued_by && <span>By: {cert.issued_by}</span>}
                        </div>
                        {(cert.certificate_number || cert.verification_code) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
                            {cert.certificate_number && (
                              <span className="flex items-center gap-0.5"><Hash className="h-2.5 w-2.5" /> {cert.certificate_number}</span>
                            )}
                            {cert.verification_code && (
                              <span className="font-mono text-primary/60">{cert.verification_code}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {cert.document_url && (
                          <a href={cert.document_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                            title="View document">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => handleDownload(cert)} disabled={downloading === cert.id}>
                          {downloading === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => handleDelete(cert.id)} disabled={deleting === cert.id}>
                          {deleting === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
