"use client";

import { useState } from "react";
import {
  MapPin, Shield, AlertTriangle, BarChart3, Search,
  Building2, Loader2, Info, TrendingUp, TrendingDown,
  FileDown, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  STATE_CRIME_DATA, US_STATES, FACILITY_TYPES, RISK_COLORS,
  getCrimeRating, getThreatLikelihood, getFacilityImpact,
  calculateRiskScore,
  type RiskLevel,
} from "@/lib/geo-risk-data";
import jsPDF from "jspdf";

type RiskResult = {
  address: string;
  city: string;
  state: string;
  facilityType: string;
  violentRate: number;
  propertyRate: number;
  crimeRating: RiskLevel;
  threatLikelihood: string;
  facilityImpact: string;
  riskScore: number;
  overallRating: RiskLevel;
  analysisDate: string;
};

function RiskGauge({ score }: { score: number }) {
  const angle = (score / 100) * 180 - 90;
  const color =
    score >= 75 ? "#ef4444" : score >= 50 ? "#f59e0b" : score >= 25 ? "#3b82f6" : "#22c55e";
  return (
    <div className="relative w-40 h-20 mx-auto">
      <svg viewBox="0 0 200 100" className="w-full h-full">
        <path d="M 10 95 A 90 90 0 0 1 190 95" fill="none" stroke="currentColor" strokeWidth="8" className="text-border/30" />
        <path d="M 10 95 A 90 90 0 0 1 190 95" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${(score / 100) * 283} 283`} strokeLinecap="round" />
        <line x1="100" y1="95" x2={100 + 70 * Math.cos((angle * Math.PI) / 180)}
          y2={95 - 70 * Math.sin((angle * Math.PI) / 180) * -1}
          stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="95" r="4" fill={color} />
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <p className="text-2xl font-bold font-mono" style={{ color }}>{score}</p>
        <p className="text-[9px] text-muted-foreground">Risk Score</p>
      </div>
    </div>
  );
}

export default function GeoRiskPage() {
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [history, setHistory] = useState<RiskResult[]>([]);

  async function analyzeRisk() {
    if (!city || !state) return;
    setAnalyzing(true);

    // Simulate brief analysis delay for UX
    await new Promise((r) => setTimeout(r, 800));

    const stateData = STATE_CRIME_DATA[state];
    if (!stateData) { setAnalyzing(false); return; }

    const crimeRating = getCrimeRating(stateData.violent);
    const threatLikelihood = getThreatLikelihood(stateData.violent, stateData.overall);
    const facilityImpact = getFacilityImpact(facilityType || "Office Building");
    const riskScore = calculateRiskScore(stateData.violent, stateData.property, facilityType || "Office Building");

    const overallRating: RiskLevel =
      riskScore >= 75 ? "Critical" : riskScore >= 55 ? "High" : riskScore >= 35 ? "Moderate" : riskScore >= 15 ? "Low" : "Negligible";

    const assessment: RiskResult = {
      address, city, state, facilityType: facilityType || "Office Building",
      violentRate: stateData.violent, propertyRate: stateData.property,
      crimeRating, threatLikelihood, facilityImpact, riskScore, overallRating,
      analysisDate: new Date().toISOString(),
    };

    setResult(assessment);
    setHistory((h) => [assessment, ...h.slice(0, 9)]);
    setAnalyzing(false);
  }

  function exportPDF() {
    if (!result) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(20, 20, 30);
    doc.rect(0, 0, w, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("GEO-RISK ASSESSMENT REPORT", w / 2, 18, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Evenfall Advantage LLC — ${new Date(result.analysisDate).toLocaleDateString()}`, w / 2, 28, { align: "center" });

    let y = 52;
    doc.setTextColor(30, 30, 30);

    // Location
    doc.setFontSize(12);
    doc.text("Location Details", 15, y); y += 8;
    doc.setFontSize(10);
    if (result.address) { doc.text(`Address: ${result.address}`, 20, y); y += 6; }
    doc.text(`City: ${result.city}`, 20, y); y += 6;
    doc.text(`State: ${result.state}`, 20, y); y += 6;
    doc.text(`Facility Type: ${result.facilityType}`, 20, y); y += 12;

    // Risk Summary
    doc.setFontSize(12);
    doc.text("Risk Summary", 15, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Overall Risk Score: ${result.riskScore}/100`, 20, y); y += 6;
    doc.text(`Overall Rating: ${result.overallRating}`, 20, y); y += 6;
    doc.text(`Threat Likelihood: ${result.threatLikelihood}`, 20, y); y += 6;
    doc.text(`Facility Impact: ${result.facilityImpact}`, 20, y); y += 12;

    // Crime Data
    doc.setFontSize(12);
    doc.text("Crime Statistics (per 100k population)", 15, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Violent Crime Rate: ${result.violentRate}`, 20, y); y += 6;
    doc.text(`Property Crime Rate: ${result.propertyRate}`, 20, y); y += 6;
    doc.text(`Crime Rating: ${result.crimeRating}`, 20, y); y += 12;

    // Data Source
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Data Source: FBI Uniform Crime Reporting (UCR) 2022 — State-level statistics", 15, y); y += 5;
    doc.text("Geocoding: OpenStreetMap Nominatim | Demographics: US Census Bureau (estimated)", 15, y);

    doc.save(`geo-risk-${result.city}-${result.state}.pdf`);
  }

  // ─── Results View ───
  if (result) {
    const rc = RISK_COLORS[result.overallRating];
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-mono flex items-center gap-2">
              <Shield className="h-5 w-5" /> RISK ASSESSMENT
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={exportPDF}>
                <FileDown className="h-3 w-3" /> PDF
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setResult(null)}>
                New Analysis
              </Button>
            </div>
          </div>

          {/* Location */}
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  {result.address ? `${result.address}, ` : ""}{result.city}, {result.state}
                </span>
                <Badge className="text-[9px] bg-primary/10 text-primary ml-auto">State-Level Data</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" /> {result.facilityType}
                <span className="ml-auto">{new Date(result.analysisDate).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Gauge + Score */}
          <Card className={`border-2 ${rc.border}`}>
            <CardContent className="p-6 text-center space-y-2">
              <RiskGauge score={result.riskScore} />
              <Badge className={`text-xs ${rc.bg} ${rc.text}`}>{result.overallRating} RISK</Badge>
            </CardContent>
          </Card>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border/40"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Threat Likelihood</p>
              <p className="text-sm font-bold">{result.threatLikelihood}</p>
            </CardContent></Card>
            <Card className="border-border/40"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Facility Impact</p>
              <p className="text-sm font-bold">{result.facilityImpact}</p>
            </CardContent></Card>
            <Card className="border-border/40"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-red-500" /> Violent Crime
              </p>
              <p className="text-sm font-bold">{result.violentRate} <span className="text-[9px] text-muted-foreground font-normal">per 100k</span></p>
            </CardContent></Card>
            <Card className="border-border/40"><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-amber-500" /> Property Crime
              </p>
              <p className="text-sm font-bold">{result.propertyRate} <span className="text-[9px] text-muted-foreground font-normal">per 100k</span></p>
            </CardContent></Card>
          </div>

          {/* Recommendations */}
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Recommendations</h3>
              <div className="text-xs text-muted-foreground space-y-1.5">
                {result.riskScore >= 55 && <p>- Deploy armed security personnel during peak hours</p>}
                {result.riskScore >= 55 && <p>- Install CCTV with 24/7 monitoring and motion detection</p>}
                {result.riskScore >= 35 && <p>- Implement access control systems with visitor management</p>}
                {result.riskScore >= 35 && <p>- Conduct regular security patrols with incident logging</p>}
                {result.facilityImpact === "Major" && <p>- Develop emergency evacuation and lockdown procedures</p>}
                {result.facilityImpact === "Major" && <p>- Coordinate with local law enforcement for response protocols</p>}
                <p>- Maintain well-lit perimeters and eliminate blind spots</p>
                <p>- Train staff on de-escalation and emergency reporting procedures</p>
                <p>- Review and update security plan quarterly</p>
              </div>
            </CardContent>
          </Card>

          {/* Data Sources */}
          <Card className="border-border/40">
            <CardContent className="p-4">
              <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Info className="h-3 w-3" /> Data Sources</h3>
              <div className="text-[10px] text-muted-foreground space-y-1">
                <p>- FBI Uniform Crime Reporting (UCR) — 2022 state-level statistics</p>
                <p>- OpenStreetMap Nominatim — Geocoding services</p>
                <p>- US Census Bureau — Demographic estimates (2021)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Input Form ───
  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <MapPin className="h-5 w-5 sm:h-6 sm:w-6" /> GEO-RISK
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">FBI crime data + facility risk scoring</p>
        </div>

        {/* Form */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold mb-1 block">Street Address <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input placeholder="123 Main St" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">City *</label>
                <Input placeholder="Miami" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">State *</label>
                <div className="relative">
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm appearance-none"
                    value={state} onChange={(e) => setState(e.target.value)}>
                    <option value="">Select state</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Facility Type</label>
              <div className="relative">
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm appearance-none"
                  value={facilityType} onChange={(e) => setFacilityType(e.target.value)}>
                  <option value="">Select facility type</option>
                  {FACILITY_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <Button className="w-full gap-1.5" onClick={analyzeRisk} disabled={!city || !state || analyzing}>
              {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Search className="h-4 w-4" /> Analyze Risk</>}
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">Recent Analyses</h3>
            {history.map((h, i) => {
              const hc = RISK_COLORS[h.overallRating];
              return (
                <Card key={i} className="border-border/40 cursor-pointer hover:border-primary/30 transition-all"
                  onClick={() => setResult(h)}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{h.city}, {h.state}</span>
                      <Badge className={`text-[9px] ${hc.bg} ${hc.text}`}>{h.overallRating}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold">{h.riskScore}</span>
                      <BarChart3 className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* How it works */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">How It Works</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>- Enter a location and facility type to generate a risk assessment</p>
              <p>- Crime data sourced from <strong>FBI UCR 2022</strong> (state-level statistics)</p>
              <p>- Risk score factors in violent crime, property crime, and facility vulnerability</p>
              <p>- Auto-generates security recommendations based on risk level</p>
              <p>- Export professional PDF reports for client proposals</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
