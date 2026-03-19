"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  MapPin, Shield, AlertTriangle, BarChart3, Search,
  Building2, Loader2, Info, TrendingUp, TrendingDown,
  FileDown, ChevronDown, Navigation, X, ExternalLink, Key, Eye, EyeOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  US_STATES, FACILITY_TYPES, RISK_COLORS, GRANULARITY_COLORS,
  getCrimeRating, getThreatLikelihood, getFacilityImpact,
  calculateRiskScore, geocodeAddress, getMultiTierCrimeData,
  type RiskLevel, type Granularity,
} from "@/lib/geo-risk-data";
import jsPDF from "jspdf";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import {
  fetchMapOverlayData, getNSOPWSearchUrl, hasFamilyWatchdogKey,
  setFamilyWatchdogKey, getFamilyWatchdogKey,
  type CrimeIncident, type SexOffender,
} from "@/lib/crime-incidents";

const GeoRiskMap = dynamic(() => import("@/components/geo-risk-map"), { ssr: false });

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
  granularity: Granularity;
  source: string;
  population?: number;
  dynamic: boolean;
  lat?: number;
  lon?: number;
  analysisDate: string;
};

function RiskGauge({ score }: { score: number }) {
  const angle = (score / 100) * 180;
  const rad = ((180 - angle) * Math.PI) / 180;
  const color =
    score >= 75 ? "#ef4444" : score >= 50 ? "#f59e0b" : score >= 25 ? "#3b82f6" : "#22c55e";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-44 h-[90px]">
        <svg viewBox="0 0 200 105" className="w-full h-full">
          <path d="M 10 95 A 90 90 0 0 1 190 95" fill="none" stroke="currentColor" strokeWidth="8" className="text-border/30" />
          <path d="M 10 95 A 90 90 0 0 1 190 95" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${(score / 100) * 283} 283`} strokeLinecap="round" />
          <line x1="100" y1="95" x2={100 + 65 * Math.cos(rad)}
            y2={95 - 65 * Math.sin(rad)}
            stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="95" r="5" fill={color} />
        </svg>
      </div>
      <p className="text-3xl font-bold font-mono" style={{ color }}>{score}</p>
      <p className="text-[10px] text-muted-foreground -mt-1">Risk Score</p>
    </div>
  );
}

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

export default function GeoRiskPage() {
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [facilityType, setFacilityType] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [history, setHistory] = useState<RiskResult[]>([]);
  const { resolvedTheme } = useTheme();

  // Map overlay state
  const [incidents, setIncidents] = useState<CrimeIncident[]>([]);
  const [offenders, setOffenders] = useState<SexOffender[]>([]);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [fwKeyInput, setFwKeyInput] = useState("");
  const [showFwKey, setShowFwKey] = useState(false);
  const [fwKeyConfigured, setFwKeyConfigured] = useState(false);

  // Check for FW key on mount
  useEffect(() => {
    setFwKeyConfigured(hasFamilyWatchdogKey());
    setFwKeyInput(getFamilyWatchdogKey());
  }, []);

  // Autocomplete state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced Nominatim search
  const searchAddress = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", USA")}&format=json&addressdetails=1&limit=5&countrycodes=us`,
          { headers: { "User-Agent": "EvenfallAdvantage-GeoRisk/1.0" } }
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch { setSuggestions([]); }
      setSearching(false);
    }, 400);
  }, []);

  function selectSuggestion(s: NominatimResult) {
    const addr = s.address;
    const streetParts = [addr.house_number, addr.road].filter(Boolean).join(" ");
    const resolvedCity = addr.city || addr.town || addr.village || addr.hamlet || "";
    const resolvedState = addr.state || "";
    const resolvedCounty = addr.county || "";

    setAddress(streetParts);
    setCity(resolvedCity);
    setState(resolvedState);
    setCounty(resolvedCounty);
    setLat(parseFloat(s.lat));
    setLon(parseFloat(s.lon));
    setQuery(s.display_name.replace(", United States", "").replace(", USA", ""));
    setResolved(`${resolvedCity}${resolvedCounty ? `, ${resolvedCounty}` : ""}, ${resolvedState}`);
    setShowSuggestions(false);
  }

  function clearSearch() {
    setQuery(""); setAddress(""); setCity(""); setState(""); setCounty(""); setLat(null); setLon(null);
    setResolved(null); setSuggestions([]); setShowSuggestions(false);
  }

  async function analyzeRisk() {
    if (!city || !state) return;
    setAnalyzing(true);

    try {
      // Step 1: Use pre-resolved county if available, otherwise geocode
      const resolvedCounty = county || (await geocodeAddress(address, city, state)).county;

      // Step 2: Multi-tier crime data: DB RPC → City → County → State
      const crime = await getMultiTierCrimeData(city, resolvedCounty, state);

      // Step 3: Calculate risk assessment
      const ft = facilityType || "Office Building";
      const crimeRating = getCrimeRating(crime.violent);
      const threatLikelihood = getThreatLikelihood(crime.violent, crimeRating);
      const facilityImpact = getFacilityImpact(ft);
      const riskScore = calculateRiskScore(crime.violent, crime.property, ft);

      const overallRating: RiskLevel =
        riskScore >= 75 ? "Critical" : riskScore >= 55 ? "High" : riskScore >= 35 ? "Moderate" : riskScore >= 15 ? "Low" : "Negligible";

      const assessment: RiskResult = {
        address, city, state, facilityType: ft,
        violentRate: crime.violent, propertyRate: crime.property,
        crimeRating, threatLikelihood, facilityImpact, riskScore, overallRating,
        granularity: crime.granularity, source: crime.source,
        population: crime.population, dynamic: crime.dynamic,
        lat: lat ?? undefined, lon: lon ?? undefined,
        analysisDate: new Date().toISOString(),
      };

      setResult(assessment);
      setHistory((h) => [assessment, ...h.slice(0, 9)]);

      // Fetch map overlay data (non-blocking)
      if (lat != null && lon != null) {
        setOverlayLoading(true);
        fetchMapOverlayData(lat, lon, city, state)
          .then((overlay) => {
            setIncidents(overlay.incidents);
            setOffenders(overlay.offenders);
          })
          .catch(() => { /* silent */ })
          .finally(() => setOverlayLoading(false));
      }
    } catch {
      alert("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
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
      <>
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
                <Badge className={`text-[9px] ${GRANULARITY_COLORS[result.granularity].bg} ${GRANULARITY_COLORS[result.granularity].text} ml-auto`}>{GRANULARITY_COLORS[result.granularity].label}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" /> {result.facilityType}
                <span className="ml-auto">{new Date(result.analysisDate).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Map */}
          {result.lat != null && result.lon != null && (
            <>
              <GeoRiskMap
                lat={result.lat}
                lon={result.lon}
                riskLevel={result.overallRating}
                address={`${result.address ? result.address + ", " : ""}${result.city}, ${result.state}`}
                isDark={resolvedTheme === "dark"}
                incidents={incidents}
                offenders={offenders}
                loading={overlayLoading}
              />

              {/* Overlay Summary Bar */}
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                {incidents.length > 0 && (
                  <Badge variant="outline" className="gap-1 font-normal">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    {incidents.filter((i) => i.type === "violent").length} violent
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block ml-1" />
                    {incidents.filter((i) => i.type === "property").length} property
                    <span className="w-2 h-2 rounded-full bg-gray-500 inline-block ml-1" />
                    {incidents.filter((i) => i.type === "other").length} other
                    <span className="text-muted-foreground ml-1">within 1 mi</span>
                  </Badge>
                )}
                {incidents.length === 0 && !overlayLoading && (
                  <span className="text-muted-foreground">No open-data crime incidents found for this area</span>
                )}
                {offenders.length > 0 && (
                  <Badge variant="outline" className="gap-1 font-normal">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                    {offenders.length} registered offender{offenders.length !== 1 ? "s" : ""}
                  </Badge>
                )}
                {/* NSOPW Fallback Link */}
                <a
                  href={getNSOPWSearchUrl(result.address, result.city, result.state)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> NSOPW Registry
                </a>
              </div>
            </>
          )}

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
                <p>- FBI Uniform Crime Reporting (UCR) — 2022 {result.granularity}-level statistics</p>
                <p>- Source: {result.source}{result.population ? ` (pop. ${result.population.toLocaleString()})` : ""}</p>
                <p>- Data: {result.dynamic ? "Live query from database" : "Static reference dataset (DB unavailable)"}</p>
                <p>- OpenStreetMap Nominatim — Geocoding services</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // ─── Input Form ───
  return (
    <>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <MapPin className="h-5 w-5 sm:h-6 sm:w-6" /> GEO-RISK
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">FBI crime data + facility risk scoring</p>
        </div>

        {/* Address Search */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-4">
            <div ref={wrapperRef} className="relative">
              <label className="text-xs font-semibold mb-1 block">Search Address</label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Start typing an address, city, or ZIP..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); searchAddress(e.target.value); }}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="pl-8 pr-8"
                />
                {query && (
                  <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {searching && <Loader2 className="h-3.5 w-3.5 text-muted-foreground absolute right-8 top-1/2 -translate-y-1/2 animate-spin" />}
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && (
                <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => selectSuggestion(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-start gap-2 border-b border-border/30 last:border-0">
                      <Navigation className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <span className="text-xs leading-relaxed">{s.display_name.replace(", United States", "")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Resolved location badge */}
            {resolved && (
              <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground">Resolved:</span>
                <span className="font-medium">{resolved}</span>
              </div>
            )}

            {/* Manual override row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">City *</label>
                <Input placeholder="Miami" value={city} onChange={(e) => setCity(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">State *</label>
                <div className="relative">
                  <select className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm appearance-none"
                    value={state} onChange={(e) => setState(e.target.value)}>
                    <option value="">Select state</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Facility Type */}
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
              <p>- Crime data sourced from <strong>FBI UCR 2022</strong> (city → county → state fallback)</p>
              <p>- <strong>Map overlay:</strong> real crime incidents plotted from city open data (Socrata)</p>
              <p>- <strong>Sex offender overlay:</strong> via Family Watchdog API (optional, key required)</p>
              <p>- Risk score factors in violent crime, property crime, and facility vulnerability</p>
              <p>- Auto-generates security recommendations based on risk level</p>
              <p>- Export professional PDF reports for client proposals</p>
            </div>
          </CardContent>
        </Card>

        {/* Family Watchdog API Key Config */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" /> Sex Offender Overlay
              {fwKeyConfigured && <Badge variant="outline" className="text-[9px] ml-1 text-green-500 border-green-500/30">Active</Badge>}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              To display registered sex offenders on the map, enter your{" "}
              <a href="https://www.familywatchdog.us/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Family Watchdog API key
              </a>
              . Keys start at $75 for 500 lookups. Without a key, use the free NSOPW Registry link on the results page.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showFwKey ? "text" : "password"}
                  placeholder="Enter API key..."
                  value={fwKeyInput}
                  onChange={(e) => setFwKeyInput(e.target.value)}
                  className="h-8 text-xs pr-8"
                />
                <button
                  onClick={() => setShowFwKey(!showFwKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showFwKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8"
                onClick={() => {
                  setFamilyWatchdogKey(fwKeyInput.trim());
                  setFwKeyConfigured(!!fwKeyInput.trim());
                }}
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
