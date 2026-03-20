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
import { useAuthStore } from "@/stores/auth-store";
import {
  fetchMapOverlayData, getNSOPWSearchUrl, hasFamilyWatchdogKey,
  setFamilyWatchdogKey, getFamilyWatchdogKey,
  hasCrimeometerKey, setCrimeometerKey, getCrimeometerKey,
  type CrimeIncident, type SexOffender, type EnvironmentalRisk,
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
  const activeCompany = useAuthStore((s) => s.getActiveCompany());

  // Map overlay state
  const [incidents, setIncidents] = useState<CrimeIncident[]>([]);
  const [offenders, setOffenders] = useState<SexOffender[]>([]);
  const [envRisk, setEnvRisk] = useState<EnvironmentalRisk>({ pois: [], summary: {}, total: 0 });
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlaySources, setOverlaySources] = useState<string[]>([]);
  const [fwKeyInput, setFwKeyInput] = useState("");
  const [showFwKey, setShowFwKey] = useState(false);
  const [fwKeyConfigured, setFwKeyConfigured] = useState(false);
  const [cmKeyInput, setCmKeyInput] = useState("");
  const [showCmKey, setShowCmKey] = useState(false);
  const [cmKeyConfigured, setCmKeyConfigured] = useState(false);

  // Check for API keys on mount
  useEffect(() => {
    setFwKeyConfigured(hasFamilyWatchdogKey());
    setFwKeyInput(getFamilyWatchdogKey());
    setCmKeyConfigured(hasCrimeometerKey());
    setCmKeyInput(getCrimeometerKey());
  }, []);

  // Autocomplete state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

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
      // Also extract lat/lon as fallback for the map when autocomplete wasn't used
      let resolvedCounty = county;
      let resolvedLat = lat;
      let resolvedLon = lon;
      if (!resolvedCounty || resolvedLat == null || resolvedLon == null) {
        const geo = await geocodeAddress(address, city, state);
        if (!resolvedCounty) resolvedCounty = geo.county;
        if (resolvedLat == null && geo.lat != null) { resolvedLat = geo.lat; setLat(geo.lat); }
        if (resolvedLon == null && geo.lon != null) { resolvedLon = geo.lon; setLon(geo.lon); }
      }

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
        lat: resolvedLat ?? undefined, lon: resolvedLon ?? undefined,
        analysisDate: new Date().toISOString(),
      };

      setResult(assessment);
      setHistory((h) => [assessment, ...h.slice(0, 9)]);

      // Fetch map overlay data (non-blocking)
      if (resolvedLat != null && resolvedLon != null) {
        setOverlayLoading(true);
        fetchMapOverlayData(resolvedLat, resolvedLon, city, state)
          .then((overlay) => {
            setIncidents(overlay.incidents);
            setOffenders(overlay.offenders);
            setOverlaySources(overlay.sources);
            setEnvRisk(overlay.environmentalRisk);
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

  async function exportPDF() {
    if (!result) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = w - margin * 2;

    // ── Dynamic company branding from auth store ──
    const companyName = activeCompany?.companyName || "Evenfall Advantage LLC";
    const brandHex = activeCompany?.brandColor || "#D97706";
    // Parse hex → RGB
    const hexToRgb = (hex: string): [number, number, number] => {
      const h = hex.replace("#", "");
      return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
    };
    const BRAND = hexToRgb(brandHex);

    const NAVY = [20, 30, 48] as const;
    const DARK = [30, 30, 40] as const;
    const GRAY = [120, 125, 135] as const;
    const LIGHT_BG = [245, 247, 250] as const;
    const WHITE = [255, 255, 255] as const;

    const RISK_HEX: Record<string, [number, number, number]> = {
      Critical: [239, 68, 68], High: [249, 115, 22], Moderate: [234, 179, 8],
      Low: [34, 197, 94], Negligible: [148, 163, 184],
    };
    const riskColor = RISK_HEX[result.overallRating] || BRAND;

    // ── Helper: section heading with accent bar ──
    function sectionHead(label: string, yPos: number): number {
      doc.setFillColor(...BRAND);
      doc.rect(margin, yPos, 2, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      doc.text(label, margin + 5, yPos + 5);
      return yPos + 10;
    }

    // ── Helper: page footer ──
    function pageFooter(pageNum: number, totalPages: number) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, h - 15, w - margin, h - 15);
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(`CONFIDENTIAL — Prepared by ${companyName}`, margin, h - 10);
      doc.text(`Page ${pageNum} of ${totalPages}`, w - margin, h - 10, { align: "right" });
    }

    // ── Helper: ensure enough vertical space for a section ──
    // If not enough room, finish current page and start a new one.
    const footerZone = 22; // reserved for footer
    function ensureSpace(needed: number) {
      if (y + needed > h - footerZone) {
        doc.addPage();
        y = 15;
      }
    }

    // ══════════════════════ PAGE 1 ══════════════════════

    // ── Header bar ──
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, w, 36, "F");
    // Accent stripe using company brand color
    doc.setFillColor(...BRAND);
    doc.rect(0, 36, w, 1.5, "F");

    // Load & embed company logo from auth store (dynamic per company)
    let logoOffset = margin; // text starts here if no logo
    const logoUrl = activeCompany?.companyLogo;
    if (logoUrl) {
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => resolve();
          logoImg.src = logoUrl;
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const logoCanvas = document.createElement("canvas");
          logoCanvas.width = logoImg.naturalWidth;
          logoCanvas.height = logoImg.naturalHeight;
          logoCanvas.getContext("2d")?.drawImage(logoImg, 0, 0);
          const logoData = logoCanvas.toDataURL("image/png");
          doc.addImage(logoData, "PNG", margin, 5, 26, 26);
          logoOffset = margin + 30;
        }
      } catch { /* logo load failed, continue without */ }
    }

    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("GEO-RISK ASSESSMENT", logoOffset, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("REPORT", logoOffset, 23);
    doc.setFontSize(8);
    doc.setTextColor(180, 190, 210);
    doc.text(`${companyName}  |  ${new Date(result.analysisDate).toLocaleDateString()}  |  Report ID: GR-${Date.now().toString(36).toUpperCase()}`, logoOffset, 30);

    let y = 44;

    // ── Location + Risk Score side by side ──
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin, y, contentW * 0.58, 38, 2, 2, "F");
    doc.roundedRect(margin + contentW * 0.62, y, contentW * 0.38, 38, 2, 2, "F");

    // Location details (left box)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text("LOCATION", margin + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    let ly = y + 12;
    if (result.address) { doc.text(result.address, margin + 4, ly); ly += 5; }
    doc.text(`${result.city}, ${result.state}`, margin + 4, ly); ly += 5;
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Facility: ${result.facilityType}`, margin + 4, ly); ly += 5;
    doc.text(`Data: ${result.granularity}-level  |  ${result.source}`, margin + 4, ly);

    // Risk score (right box)
    const rBoxX = margin + contentW * 0.62;
    doc.setFillColor(...riskColor);
    doc.roundedRect(rBoxX + 4, y + 4, contentW * 0.38 - 8, 30, 2, 2, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(`${result.riskScore}`, rBoxX + (contentW * 0.38) / 2, y + 20, { align: "center" });
    doc.setFontSize(8);
    doc.text(`${result.overallRating.toUpperCase()} RISK`, rBoxX + (contentW * 0.38) / 2, y + 28, { align: "center" });

    y += 44;

    // ── Threat / Impact / Crime row ──
    const colW = contentW / 4;
    const metrics = [
      ["Threat Likelihood", result.threatLikelihood],
      ["Facility Impact", result.facilityImpact],
      ["Violent Crime", `${result.violentRate}/100k`],
      ["Property Crime", `${result.propertyRate}/100k`],
    ];
    metrics.forEach(([label, val], i) => {
      const cx = margin + i * colW;
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(cx + 1, y, colW - 2, 16, 1, 1, "F");
      doc.setFontSize(6.5);
      doc.setTextColor(...GRAY);
      doc.text(String(label), cx + 3, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.text(String(val), cx + 3, y + 13);
      doc.setFont("helvetica", "normal");
    });
    y += 22;

    // ── Map capture (manual tile compositor — bypasses html2canvas entirely) ──
    if (result.lat != null && result.lon != null) {
      try {
        const zoom = 14;
        const mapW = 640;
        const mapHPx = 504;
        const tileSize = 256;
        // Always use light tiles for PDF — better for print
        const tileTemplate = "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png";

        // Convert lat/lon → fractional tile coordinates
        const n = Math.pow(2, zoom);
        const latRad = (result.lat * Math.PI) / 180;
        const tileX = ((result.lon + 180) / 360) * n;
        const tileY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

        const centerTileX = Math.floor(tileX);
        const centerTileY = Math.floor(tileY);
        const offsetX = (tileX - centerTileX) * tileSize;
        const offsetY = (tileY - centerTileY) * tileSize;

        const halfW = mapW / 2;
        const halfH = mapHPx / 2;
        const tilesNeededX = Math.ceil(halfW / tileSize) + 1;
        const tilesNeededY = Math.ceil(halfH / tileSize) + 1;

        const mapCanvas = document.createElement("canvas");
        mapCanvas.width = mapW;
        mapCanvas.height = mapHPx;
        const ctx = mapCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#f1f5f9";
          ctx.fillRect(0, 0, mapW, mapHPx);

          // Load and draw tiles
          const loadTile = (url: string): Promise<HTMLImageElement | null> =>
            new Promise((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => resolve(img);
              img.onerror = () => resolve(null);
              img.src = url;
            });

          for (let dx = -tilesNeededX; dx <= tilesNeededX; dx++) {
            for (let dy = -tilesNeededY; dy <= tilesNeededY; dy++) {
              const tx = centerTileX + dx;
              const ty = centerTileY + dy;
              if (ty < 0 || ty >= n) continue;
              const url = tileTemplate
                .replace("{z}", String(zoom))
                .replace("{x}", String(((tx % n) + n) % n))
                .replace("{y}", String(ty));
              const tile = await loadTile(url);
              if (tile) {
                const px = halfW + dx * tileSize - offsetX;
                const py = halfH + dy * tileSize - offsetY;
                ctx.drawImage(tile, px, py, tileSize, tileSize);
              }
            }
          }

          // Helper: convert lat/lon → canvas pixel
          const toPixel = (ptLat: number, ptLon: number): [number, number] => {
            const ptLatRad = (ptLat * Math.PI) / 180;
            const ptTileX = ((ptLon + 180) / 360) * n;
            const ptTileY = ((1 - Math.log(Math.tan(ptLatRad) + 1 / Math.cos(ptLatRad)) / Math.PI) / 2) * n;
            return [
              halfW + (ptTileX - tileX) * tileSize,
              halfH + (ptTileY - tileY) * tileSize,
            ];
          };

          // Draw risk radius circle (1 mile ≈ 1609m)
          const metersPerPx = (156543.03392 * Math.cos(latRad)) / n;
          const radiusPx = 1609 / metersPerPx;
          const circleColor = ({
            Critical: "#ef4444", High: "#f97316", Moderate: "#eab308",
            Low: "#22c55e", Negligible: "#94a3b8",
          } as Record<string, string>)[result.overallRating] || "#eab308";
          ctx.beginPath();
          ctx.arc(halfW, halfH, radiusPx, 0, Math.PI * 2);
          ctx.strokeStyle = circleColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
          const r2 = parseInt(circleColor.slice(1, 3), 16);
          const g2 = parseInt(circleColor.slice(3, 5), 16);
          const b2 = parseInt(circleColor.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${r2},${g2},${b2},0.10)`;
          ctx.fill();

          // Helper: draw a dot marker on the canvas
          const drawDot = (px: number, py: number, color: string, radius: number) => {
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          };

          // ── Incident markers ──
          const INCIDENT_CLR: Record<string, string> = { violent: "#ef4444", property: "#f59e0b", other: "#6b7280" };
          incidents.forEach((inc) => {
            const [px, py] = toPixel(inc.lat, inc.lon);
            if (px >= 0 && px <= mapW && py >= 0 && py <= mapHPx) {
              drawDot(px, py, INCIDENT_CLR[inc.type] || "#6b7280", 5);
            }
          });

          // ── Sex offender markers ──
          offenders.forEach((off) => {
            const [px, py] = toPixel(off.lat, off.lon);
            if (px >= 0 && px <= mapW && py >= 0 && py <= mapHPx) {
              drawDot(px, py, "#a855f7", 6);
            }
          });

          // ── Environmental risk POI markers ──
          envRisk.pois.forEach((poi) => {
            const [px, py] = toPixel(poi.lat, poi.lon);
            if (px >= 0 && px <= mapW && py >= 0 && py <= mapHPx) {
              drawDot(px, py, "#06b6d4", 4);
            }
          });

          // Center target pin (on top of everything)
          ctx.beginPath();
          ctx.arc(halfW, halfH, 7, 0, Math.PI * 2);
          ctx.fillStyle = circleColor;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // ── Legend box ──
          const violentN = incidents.filter((i) => i.type === "violent").length;
          const propertyN = incidents.filter((i) => i.type === "property").length;
          const otherN = incidents.filter((i) => i.type === "other").length;
          const legendItems: [string, string][] = [[circleColor, "Target Location"]];
          if (violentN) legendItems.push(["#ef4444", `Violent (${violentN})`]);
          if (propertyN) legendItems.push(["#f59e0b", `Property (${propertyN})`]);
          if (otherN) legendItems.push(["#6b7280", `Other (${otherN})`]);
          if (offenders.length) legendItems.push(["#a855f7", `Offenders (${offenders.length})`]);
          if (envRisk.total) legendItems.push(["#06b6d4", `Risk POIs (${envRisk.total})`]);

          const legendLineH = 16;
          const legendH = legendItems.length * legendLineH + 10;
          const legendW = 140;
          const legendX = mapW - legendW - 8;
          const legendY = 8;
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(legendX, legendY, legendW, legendH, 4);
          ctx.fill();
          ctx.stroke();
          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = "#1e293b";
          legendItems.forEach(([clr, label], idx) => {
            const ly = legendY + 12 + idx * legendLineH;
            ctx.beginPath();
            ctx.arc(legendX + 12, ly, 4, 0, Math.PI * 2);
            ctx.fillStyle = clr;
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = "#1e293b";
            ctx.font = "11px sans-serif";
            ctx.fillText(label, legendX + 22, ly + 4);
          });

          // Attribution
          ctx.font = "10px sans-serif";
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillText("© OpenStreetMap", 5, mapHPx - 5);

          const mapData = mapCanvas.toDataURL("image/png");
          const mapH = Math.min(98, (mapHPx / mapW) * contentW);
          doc.addImage(mapData, "PNG", margin, y, contentW, mapH);
          y += mapH + 4;
        }
      } catch (e) { console.warn("Map PDF capture failed:", e); }
    }

    // ── OSINT Incident Summary ──
    if (incidents.length > 0) {
      ensureSpace(25);
      y = sectionHead("OSINT Crime Incidents", y);
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      const violent = incidents.filter(i => i.type === "violent").length;
      const property = incidents.filter(i => i.type === "property").length;
      const other = incidents.filter(i => i.type === "other").length;
      doc.text(`${incidents.length} incidents within 1 mile  —  ${violent} violent  |  ${property} property  |  ${other} other`, margin + 5, y);
      y += 5;
      // Source breakdown
      const srcCounts: Record<string, number> = {};
      incidents.forEach(i => { srcCounts[i.source] = (srcCounts[i.source] || 0) + 1; });
      doc.setTextColor(...GRAY);
      doc.setFontSize(7);
      doc.text(`Sources: ${Object.entries(srcCounts).map(([s, c]) => `${s} (${c})`).join("  |  ")}`, margin + 5, y);
      y += 8;
    }

    // ── Environmental Risk (CPTED) ──
    if (envRisk.total > 0) {
      ensureSpace(25);
      y = sectionHead("Environmental Risk Indicators (CPTED)", y);
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(`${envRisk.total} crime-correlated POIs within 1 mile:`, margin + 5, y); y += 5;
      doc.setTextColor(...GRAY);
      doc.setFontSize(7);
      const poiList = Object.entries(envRisk.summary).map(([k, v]) => `${v} ${k}`).join("  |  ");
      doc.text(poiList, margin + 5, y); y += 8;
    }

    // ── Recommendations ── (keep entire section together)
    const recs: string[] = [];
    if (result.riskScore >= 55) {
      recs.push("Deploy armed security personnel during peak hours");
      recs.push("Install CCTV with 24/7 monitoring and motion detection");
    }
    if (result.riskScore >= 35) {
      recs.push("Implement access control systems with visitor management");
      recs.push("Conduct regular security patrols with incident logging");
    }
    if (result.facilityImpact === "Major") {
      recs.push("Develop emergency evacuation and lockdown procedures");
      recs.push("Coordinate with local law enforcement for response protocols");
    }
    recs.push("Maintain well-lit perimeters and eliminate blind spots");
    recs.push("Train staff on de-escalation and emergency reporting");
    recs.push("Review and update security plan quarterly");

    const recsHeight = 10 + recs.length * 7 + 4;
    ensureSpace(recsHeight);
    y = sectionHead("Security Recommendations", y);
    doc.setFontSize(8);
    doc.setTextColor(...DARK);

    recs.forEach((rec) => {
      if (y > h - footerZone) { doc.addPage(); y = 15; }
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(margin + 3, y - 3, contentW - 6, 6, 1, 1, "F");
      doc.text(`•  ${rec}`, margin + 6, y); y += 7;
    });
    y += 4;

    // ── Data Sources ──
    const sources = [
      `FBI Uniform Crime Reporting (UCR) 2022 — ${result.granularity}-level statistics`,
      `${result.source}${result.population ? ` (pop. ${result.population.toLocaleString()})` : ""}`,
      "Socrata SODA API — 60+ US city open data portals + dynamic discovery",
      "OpenDataSoft — Global public safety datasets, geofiltered",
      "ArcGIS Open Data Hubs — City FeatureServer crime layers",
      "UK Police API — Street-level crime (England/Wales/NI)",
      "Overpass API (OpenStreetMap) — Environmental risk POIs (CPTED)",
      "OpenStreetMap Nominatim — Geocoding services",
    ];
    if (hasCrimeometerKey()) sources.splice(4, 0, "Crimeometer API — National geocoded crime incidents");
    if (hasFamilyWatchdogKey()) sources.push("Family Watchdog — Registered sex offender data");
    const srcHeight = 10 + sources.length * 4 + 4;
    ensureSpace(srcHeight);
    y = sectionHead("Data Sources & Methodology", y);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    sources.forEach((src) => {
      doc.text(`•  ${src}`, margin + 5, y); y += 4;
    });

    // ── Footer ──
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      pageFooter(p, totalPages);
    }

    doc.save(`GeoRisk-${result.city}-${result.state}-${new Date().toISOString().split("T")[0]}.pdf`);
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
              <div ref={mapContainerRef}>
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
              </div>

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
                {/* Environmental risk POIs (CPTED) */}
                {envRisk.total > 0 && (
                  <Badge variant="outline" className="gap-1 font-normal">
                    <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                    {envRisk.total} risk POI{envRisk.total !== 1 ? "s" : ""}
                    <span className="text-muted-foreground ml-1">
                      ({Object.entries(envRisk.summary).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ")})
                    </span>
                  </Badge>
                )}
                {/* Source badges */}
                {overlaySources.length > 0 && (
                  <span className="text-muted-foreground text-[10px]">
                    via {overlaySources.join(" + ")}
                  </span>
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
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-semibold flex items-center gap-1.5"><Info className="h-3 w-3" /> Data Sources</h3>
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground/70">Risk Assessment</p>
                <p>• FBI Uniform Crime Reporting (UCR) — 2022 {result.granularity}-level statistics</p>
                <p>• {result.source}{result.population ? ` (pop. ${result.population.toLocaleString()})` : ""} — {result.dynamic ? "Live DB query" : "Static reference dataset"}</p>
              </div>
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground/70">OSINT Crime Incidents</p>
                <p>• Socrata SODA API — 60+ US city open data portals + dynamic discovery</p>
                <p>• OpenDataSoft — Global public safety datasets, geofiltered</p>
                <p>• ArcGIS Open Data Hubs — City FeatureServer crime layers</p>
                <p>• UK Police API — Street-level crime (England, Wales, NI)</p>
                {cmKeyConfigured && <p>• Crimeometer API — National geocoded crime incidents</p>}
              </div>
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground/70">Environmental &amp; Other</p>
                <p>• Overpass / OpenStreetMap — CPTED environmental risk POIs</p>
                <p>• OpenStreetMap Nominatim — Geocoding services</p>
                {fwKeyConfigured && <p>• Family Watchdog — Registered sex offender data</p>}
                <p>• NSOPW (DOJ) — National Sex Offender Public Website</p>
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
              <p>- <strong>Map overlay:</strong> crime incidents from 4 OSINT sources (Socrata, ArcGIS, Crimeometer, UK Police)</p>
              <p>- <strong>Environmental risk:</strong> Overpass/OSM queries for CPTED indicators (bars, clubs, pawn shops, etc.)</p>
              <p>- All sources queried in parallel, deduplicated by proximity + date + type</p>
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
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setFamilyWatchdogKey(fwKeyInput.trim()); setFwKeyConfigured(!!fwKeyInput.trim()); }}>
              <div className="relative flex-1">
                <Input
                  type={showFwKey ? "text" : "password"}
                  placeholder="Enter API key..."
                  value={fwKeyInput}
                  onChange={(e) => setFwKeyInput(e.target.value)}
                  className="h-8 text-xs pr-8"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowFwKey(!showFwKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showFwKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-8" type="submit">Save</Button>
            </form>
          </CardContent>
        </Card>

        {/* Crimeometer API Key Config */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" /> Crimeometer (National)
              {cmKeyConfigured && <Badge variant="outline" className="text-[9px] ml-1 text-green-500 border-green-500/30">Active</Badge>}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              For nationwide geocoded crime data (fills gaps where city open data isn&apos;t available), enter your{" "}
              <a href="https://www.crimeometer.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Crimeometer API key
              </a>
              . Free tier: 100 calls/month. Without a key, Socrata + OpenDataSoft + ArcGIS are used (all free).
            </p>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setCrimeometerKey(cmKeyInput.trim()); setCmKeyConfigured(!!cmKeyInput.trim()); }}>
              <div className="relative flex-1">
                <Input
                  type={showCmKey ? "text" : "password"}
                  placeholder="Enter API key..."
                  value={cmKeyInput}
                  onChange={(e) => setCmKeyInput(e.target.value)}
                  className="h-8 text-xs pr-8"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowCmKey(!showCmKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCmKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-8" type="submit">Save</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
