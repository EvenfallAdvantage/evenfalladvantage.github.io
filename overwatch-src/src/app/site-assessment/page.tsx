"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardCheck, Save, RotateCcw, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { geocodeAddress } from "@/lib/geo-risk-data";
import { saveSiteAssessment, getCompanyAssessments, getAssessment, deleteAssessment, type SiteAssessment } from "@/lib/supabase/db-assessments";
import { toast } from "sonner";

import { SECTIONS, STORAGE_KEY, getDefaultData, calculateRisk } from "./components/assessment-types";
import type { NominatimResult, RiskResult } from "./components/assessment-types";
import SavedAssessmentsPanel from "./components/saved-assessments-panel";
import AssessmentForm from "./components/assessment-form";
import RiskResultsDisplay from "./components/risk-results-display";
import { generateAssessmentPDF } from "./components/assessment-pdf";
import { logger } from "@/lib/logger";

export default function SiteAssessmentPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Record<string, string>>(getDefaultData);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["clientInfo"]));
  const [result, setResult] = useState<RiskResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);

  // DB-backed state
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [savedAssessments, setSavedAssessments] = useState<SiteAssessment[]>([]);
  const [saving, setSaving] = useState(false);
  const [_loadingList, setLoadingList] = useState(true);

  // Address autocomplete display state
  const [addrQuery, setAddrQuery] = useState("");
  const [addrResolved, setAddrResolved] = useState<string | null>(null);

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader("SITE ASSESSMENT", "Professional security evaluation and risk scoring", <ClipboardCheck className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader]);

  // Load saved assessments list on mount
  useEffect(() => {
    if (!activeCompanyId) { setLoadingList(false); return; }
    getCompanyAssessments(activeCompanyId)
      .then((list) => setSavedAssessments(list))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, [activeCompanyId]);

  // Load from DB (URL param) or localStorage (draft buffer)
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam) {
      getAssessment(idParam)
        .then((assessment) => {
          if (assessment) {
            const assessmentData = (assessment.data || {}) as Record<string, string>;
            setData({ ...getDefaultData(), ...assessmentData });
            setAssessmentId(assessment.id);
            if (assessment.lat) setLat(assessment.lat);
            if (assessment.lng) setLon(assessment.lng);
            setExpandedSections(new Set(SECTIONS.map((s) => s.id)));
          }
        })
        .catch(() => toast.error("Failed to load assessment"));
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setData((prev) => ({ ...prev, ...parsed }));
          if (parsed.facilityType) {
            setExpandedSections(new Set(SECTIONS.map((s) => s.id)));
          }
        }
      } catch (e) { logger.swallow("site-assessment:load-draft", e, "debug"); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save to localStorage
  const save = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { logger.swallow("site-assessment:save-draft", e, "debug"); }
  }, [data]);
  useEffect(() => { save(); }, [save]);

  function updateField(name: string, value: string) {
    setData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "facilityType" && value) {
        setExpandedSections(new Set(SECTIONS.map((s) => s.id)));
      }
      return next;
    });
    setResult(null);
  }

  function toggleSection(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function resetForm() {
    setData(getDefaultData());
    setResult(null);
    setLat(null); setLon(null);
    setAddrQuery(""); setAddrResolved(null);
    setExpandedSections(new Set(["clientInfo"]));
    localStorage.removeItem(STORAGE_KEY);
  }

  function clearForm() {
    if (!confirm("Clear this assessment? All data will be lost.")) return;
    setAssessmentId(null);
    resetForm();
  }

  // ── Address handlers ──

  function handleAddressSelect(s: NominatimResult) {
    const addr = s.address;
    const streetParts = [addr.house_number, addr.road].filter(Boolean).join(" ");
    const resolvedCity = addr.city || addr.town || addr.village || addr.hamlet || "";
    const resolvedState = addr.state || "";

    setData((prev) => ({ ...prev, address: streetParts, city: resolvedCity, state: resolvedState }));
    setLat(parseFloat(s.lat));
    setLon(parseFloat(s.lon));
    setAddrQuery(s.display_name.replace(", United States", "").replace(", USA", ""));
    setAddrResolved(`${streetParts ? streetParts + ", " : ""}${resolvedCity}, ${resolvedState}`);
    setResult(null);
  }

  function handleAddressClear() {
    setAddrQuery(""); setAddrResolved(null);
    setLat(null); setLon(null);
    setData((prev) => ({ ...prev, address: "", city: "", state: "" }));
    setResult(null);
  }

  // ── Calculate ──

  async function handleCalculate() {
    const r = calculateRisk(data);
    setResult(r);
    if (lat == null && data.city && data.state) {
      try {
        const geo = await geocodeAddress(data.address || "", data.city, data.state);
        if (geo.lat != null && geo.lon != null) { setLat(geo.lat); setLon(geo.lon); }
      } catch { /* geocoding optional */ }
    }
    setTimeout(() => document.getElementById("risk-results")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  // ── DB handlers ──

  const handleSave = async () => {
    if (!activeCompanyId) { toast.error("No active company selected"); return; }
    setSaving(true);
    try {
      const fullAddress = [data.address, data.city, data.state].filter(Boolean).join(", ");
      const currentResult = calculateRisk(data);
      const saved = await saveSiteAssessment(activeCompanyId, {
        id: assessmentId || undefined, client_name: data.clientName || undefined,
        address: fullAddress || undefined, lat: lat ?? undefined, lng: lon ?? undefined,
        data: data, risk_score: currentResult?.score ?? undefined, risk_level: currentResult?.level ?? undefined,
      });
      setAssessmentId(saved.id);
      const list = await getCompanyAssessments(activeCompanyId);
      setSavedAssessments(list);
      toast.success(assessmentId ? "Assessment updated" : "Assessment saved");
      localStorage.removeItem(STORAGE_KEY);
    } catch { toast.error("Failed to save assessment"); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!assessmentId) return;
    if (!confirm("Delete this saved assessment?")) return;
    try {
      await deleteAssessment(assessmentId);
      setAssessmentId(null);
      resetForm();
      if (activeCompanyId) {
        const list = await getCompanyAssessments(activeCompanyId);
        setSavedAssessments(list);
      }
      toast.success("Assessment deleted");
    } catch { toast.error("Failed to delete assessment"); }
  };

  const handleLoadAssessment = (assessment: SiteAssessment) => {
    const hasUnsavedData = Object.entries(data).some(
      ([key, val]) => val && key !== "assessmentDate" && val !== getDefaultData()[key]
    );
    if (hasUnsavedData && !assessmentId) {
      if (!confirm("Load this assessment? Unsaved changes will be lost.")) return;
    }
    setAssessmentId(assessment.id);
    const assessmentData = (assessment.data || {}) as Record<string, string>;
    setData({ ...getDefaultData(), ...assessmentData });
    if (assessment.lat) setLat(assessment.lat);
    if (assessment.lng) setLon(assessment.lng);
    setResult(null);
    setAddrQuery(""); setAddrResolved(null);
    const hasFields = Object.entries(assessmentData).some(([, v]) => v);
    if (hasFields) setExpandedSections(new Set(SECTIONS.map((s) => s.id)));
    toast.success(`Loaded: ${assessment.client_name || "Unnamed assessment"}`);
  };

  const handleNewAssessment = () => { setAssessmentId(null); resetForm(); };

  async function downloadPDF() {
    if (!result) return;
    setGenerating(true);
    try {
      await generateAssessmentPDF({
        data, result, lat, lon,
        companyName: activeCompany?.companyName || "Evenfall Advantage LLC",
        brandHex: activeCompany?.brandColor || "#D97706",
        companyLogo: activeCompany?.companyLogo,
      });
    } catch (err) {
      console.error("PDF error:", err);
      alert("Error generating PDF.");
    } finally { setGenerating(false); }
  }

  const completedFields = Object.values(data).filter(Boolean).length;
  const totalFields = Object.keys(data).length;
  const completionPct = Math.round((completedFields / totalFields) * 100);

  return (
    <>
      <div className="space-y-6">
        <SavedAssessmentsPanel
          assessments={savedAssessments}
          currentId={assessmentId}
          onLoad={handleLoadAssessment}
          onNew={handleNewAssessment}
        />

        {/* Action bar */}
        <div className="flex items-center justify-end gap-2">
          <Badge variant="outline" className="text-[10px] font-mono">{completionPct}% complete</Badge>
          {assessmentId && (
            <Button variant="outline" size="sm" className="gap-1.5 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={clearForm}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || !activeCompanyId}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {assessmentId ? "Update" : "Save"}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${completionPct}%` }} />
        </div>

        <AssessmentForm
          sections={SECTIONS}
          data={data}
          expandedSections={expandedSections}
          onUpdateField={updateField}
          onToggleSection={toggleSection}
          onCalculate={handleCalculate}
          onAddressSelect={handleAddressSelect}
          onAddressClear={handleAddressClear}
          addrResolved={addrResolved}
          addrQuery={addrQuery}
        />

        {result && (
          <RiskResultsDisplay
            result={result}
            data={data}
            lat={lat}
            lon={lon}
            generating={generating}
            onDownloadPDF={downloadPDF}
          />
        )}
      </div>
    </>
  );
}
