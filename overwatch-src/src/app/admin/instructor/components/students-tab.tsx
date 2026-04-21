"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Loader2, ChevronDown, ChevronUp, CheckCircle2, Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getLegacyStudents, getLegacyProgress, issueLegacyCertificate,
  type LegacyStudent, type LegacyModuleProgress,
} from "@/lib/legacy-bridge";
import { logger } from "@/lib/logger";

interface StudentsTabProps {
  instructorId: string | null;
}

export function StudentsTab({ instructorId }: StudentsTabProps) {
  const [students, setStudents] = useState<LegacyStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<LegacyModuleProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  // Certificate issuance
  const [showCert, setShowCert] = useState<string | null>(null);
  const [certName, setCertName] = useState("");
  const [certType, setCertType] = useState("course_completion");
  const [certState, setCertState] = useState("");
  const [issuingCert, setIssuingCert] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStudents(await getLegacyStudents()); } catch (e) { logger.swallow("instructor-students:load", e, "warn"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleExpand(studentId: string) {
    if (expandedId === studentId) { setExpandedId(null); return; }
    setExpandedId(studentId);
    setProgressLoading(true);
    try { setProgress(await getLegacyProgress(studentId)); } catch (e) { logger.swallow("instructor-students:load-progress", e, "warn"); }
    finally { setProgressLoading(false); }
  }

  async function handleIssueCert(studentId: string) {
    if (!certName.trim() || !instructorId) return;
    setIssuingCert(true);
    try {
      await issueLegacyCertificate({
        student_id: studentId, issued_by: instructorId,
        certificate_type: certType, certificate_name: certName.trim(),
        state_issued: certState.trim() || undefined,
      });
      setShowCert(null); setCertName(""); setCertState("");
      alert("Certificate issued successfully!");
    } catch { alert("Failed to issue certificate"); }
    finally { setIssuingCert(false); }
  }

  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.first_name.toLowerCase().includes(q) || s.last_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <p className="text-sm text-muted-foreground">{filtered.length} students</p>
      </div>

      <div className="space-y-1.5">
        {filtered.slice(0, 50).map((s) => (
          <Card key={s.id} className="border-border/40">
            <CardContent className="p-0">
              <button onClick={() => toggleExpand(s.id)} className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                  <p className="text-[10px] text-muted-foreground">{s.email}</p>
                </div>
                {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedId === s.id && (
                <div className="border-t border-border/40 p-4 space-y-3">
                  {progressLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (
                    <>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase">Module Progress</h5>
                      {progress.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No progress recorded</p>
                      ) : (
                        <div className="space-y-1.5">
                          {progress.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs">
                              {p.status === "completed" ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-border shrink-0" />}
                              <span className="flex-1 truncate">{p.training_modules?.module_name ?? p.module_id}</span>
                              <span className="font-mono text-muted-foreground">{p.progress_percentage}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="pt-2 border-t border-border/30">
                        {showCert === s.id ? (
                          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                            <Input placeholder="Certificate Name *" value={certName} onChange={(e) => setCertName(e.target.value)} className="h-8 text-sm" />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <select value={certType} onChange={(e) => setCertType(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                                <option value="course_completion">Course Completion</option>
                                <option value="guard_card">Guard Card</option>
                                <option value="firearms">Firearms</option>
                                <option value="cpr_first_aid">CPR/First Aid</option>
                                <option value="other">Other</option>
                              </select>
                              <Input placeholder="State (optional)" value={certState} onChange={(e) => setCertState(e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleIssueCert(s.id)} disabled={issuingCert}>
                                {issuingCert ? <Loader2 className="h-3 w-3 animate-spin" /> : <Award className="h-3 w-3" />} Issue
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCert(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowCert(s.id)} disabled={!instructorId}>
                            <Award className="h-3 w-3" /> Issue Certificate
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length > 50 && <p className="text-xs text-muted-foreground text-center">Showing first 50 of {filtered.length} results. Use search to narrow down.</p>}
        {filtered.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No students found.</div>}
      </div>
    </div>
  );
}
