"use client";

import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import {
  geocodeAddress, getMultiTierCrimeData,
  getCrimeRating, getThreatLikelihood, getFacilityImpact,
  calculateRiskScore, type RiskLevel,
} from "@/lib/geo-risk-data";
import {
  fetchMapOverlayData,
  type CrimeIncident, type SexOffender, type EnvironmentalRisk,
} from "@/lib/crime-incidents";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";

import type { RiskResult } from "./components/shared";
import { AddressSearch, type AddressData } from "./components/address-search";
import { RiskResults } from "./components/risk-results";
import { AnalysisHistory } from "./components/analysis-history";
import { HowItWorks } from "./components/how-it-works";
import { ApiKeyConfig } from "./components/api-key-config";

export default function GeoRiskPage() {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader("GEO-RISK", "FBI crime data + facility risk scoring", <MapPin className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader]);

  // ── Address form state ──
  const [addressData, setAddressData] = useState<AddressData>({
    address: "", city: "", state: "", county: "",
    lat: null, lon: null, facilityType: "",
  });
  const [analyzing, setAnalyzing] = useState(false);

  // ── Result state ──
  const [result, setResult] = useState<RiskResult | null>(null);
  const [history, setHistory] = useState<RiskResult[]>([]);

  // ── Map overlay state ──
  const [incidents, setIncidents] = useState<CrimeIncident[]>([]);
  const [offenders, setOffenders] = useState<SexOffender[]>([]);
  const [envRisk, setEnvRisk] = useState<EnvironmentalRisk>({ pois: [], summary: {}, total: 0 });
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlaySources, setOverlaySources] = useState<string[]>([]);

  // ── Analysis handler ──
  async function analyzeRisk() {
    const { city, state, county, lat, lon, address, facilityType } = addressData;
    if (!city || !state) return;
    setAnalyzing(true);

    try {
      // Resolve county / coords if missing
      let resolvedCounty = county;
      let resolvedLat = lat;
      let resolvedLon = lon;
      if (!resolvedCounty || resolvedLat == null || resolvedLon == null) {
        const geo = await geocodeAddress(address, city, state);
        if (!resolvedCounty) resolvedCounty = geo.county;
        if (resolvedLat == null && geo.lat != null) resolvedLat = geo.lat;
        if (resolvedLon == null && geo.lon != null) resolvedLon = geo.lon;
        setAddressData((d) => ({
          ...d,
          county: resolvedCounty || d.county,
          lat: resolvedLat ?? d.lat,
          lon: resolvedLon ?? d.lon,
        }));
      }

      // Multi-tier crime data
      const crime = await getMultiTierCrimeData(city, resolvedCounty, state);

      // Risk calculations
      const ft = facilityType || "Office Building";
      const crimeRating = getCrimeRating(crime.violent);
      const threatLikelihood = getThreatLikelihood(crime.violent, crimeRating);
      const facilityImpactVal = getFacilityImpact(ft);
      const riskScore = calculateRiskScore(crime.violent, crime.property, ft);

      const overallRating: RiskLevel =
        riskScore >= 75 ? "Critical" : riskScore >= 55 ? "High" : riskScore >= 35 ? "Moderate" : riskScore >= 15 ? "Low" : "Negligible";

      const assessment: RiskResult = {
        address, city, state, facilityType: ft,
        violentRate: crime.violent, propertyRate: crime.property,
        crimeRating, threatLikelihood, facilityImpact: facilityImpactVal,
        riskScore, overallRating,
        granularity: crime.granularity, source: crime.source,
        population: crime.population, dynamic: crime.dynamic,
        lat: resolvedLat ?? undefined, lon: resolvedLon ?? undefined,
        analysisDate: new Date().toISOString(),
      };

      setResult(assessment);
      setHistory((h) => [assessment, ...h.slice(0, 9)]);

      // Fetch map overlay (non-blocking)
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

  // ── Branding ──
  const companyName = activeCompany?.companyName || "Evenfall Advantage LLC";
  const brandHex = activeCompany?.brandColor || "#D97706";
  const companyLogo = activeCompany?.companyLogo;

  // ── Results view ──
  if (result) {
    return (
      <RiskResults
        result={result}
        incidents={incidents}
        offenders={offenders}
        envRisk={envRisk}
        overlayLoading={overlayLoading}
        overlaySources={overlaySources}
        companyName={companyName}
        brandHex={brandHex}
        companyLogo={companyLogo ?? undefined}
        onNewAnalysis={() => setResult(null)}
      />
    );
  }

  // ── Input form view ──
  return (
    <div className="space-y-6">
      <AddressSearch
        data={addressData}
        onChange={setAddressData}
        onAnalyze={analyzeRisk}
        analyzing={analyzing}
      />

      <AnalysisHistory history={history} onSelect={setResult} />

      <HowItWorks />

      <ApiKeyConfig />
    </div>
  );
}
