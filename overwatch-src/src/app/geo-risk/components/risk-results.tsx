"use client";

import { useRef } from "react";
import {
  MapPin, Shield, AlertTriangle, Info,
  TrendingUp, TrendingDown, FileDown, ExternalLink, Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RISK_COLORS, GRANULARITY_COLORS } from "@/lib/geo-risk-data";
import {
  getNSOPWSearchUrl, hasFamilyWatchdogKey, hasCrimeometerKey,
  type CrimeIncident, type SexOffender, type EnvironmentalRisk,
} from "@/lib/crime-incidents";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import type { RiskResult } from "./shared";
import { RiskGauge } from "./risk-gauge";
import { exportGeoRiskPDF } from "./export-pdf";

const GeoRiskMap = dynamic(() => import("@/components/geo-risk-map"), { ssr: false });

type Props = {
  result: RiskResult;
  incidents: CrimeIncident[];
  offenders: SexOffender[];
  envRisk: EnvironmentalRisk;
  overlayLoading: boolean;
  overlaySources: string[];
  companyName: string;
  brandHex: string;
  companyLogo?: string;
  onNewAnalysis: () => void;
};

export function RiskResults({
  result, incidents, offenders, envRisk,
  overlayLoading, overlaySources,
  companyName, brandHex, companyLogo,
  onNewAnalysis,
}: Props) {
  const { resolvedTheme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const rc = RISK_COLORS[result.overallRating];

  const fwKeyConfigured = hasFamilyWatchdogKey();
  const cmKeyConfigured = hasCrimeometerKey();

  function handleExportPDF() {
    exportGeoRiskPDF({
      result, incidents, offenders, envRisk,
      companyName, brandHex, companyLogo,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono flex items-center gap-2">
          <Shield className="h-5 w-5" /> RISK ASSESSMENT
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleExportPDF}>
            <FileDown className="h-3 w-3" /> PDF
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={onNewAnalysis}>
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
            {envRisk.total > 0 && (
              <Badge variant="outline" className="gap-1 font-normal">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                {envRisk.total} risk POI{envRisk.total !== 1 ? "s" : ""}
                <span className="text-muted-foreground ml-1">
                  ({Object.entries(envRisk.summary).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", ")})
                </span>
              </Badge>
            )}
            {overlaySources.length > 0 && (
              <span className="text-muted-foreground text-[10px]">
                via {overlaySources.join(" + ")}
              </span>
            )}
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
            <p>&bull; FBI Uniform Crime Reporting (UCR) — 2022 {result.granularity}-level statistics</p>
            <p>&bull; {result.source}{result.population ? ` (pop. ${result.population.toLocaleString()})` : ""} — {result.dynamic ? "Live DB query" : "Static reference dataset"}</p>
          </div>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground/70">OSINT Crime Incidents</p>
            <p>&bull; Socrata SODA API — 60+ US city open data portals + dynamic discovery</p>
            <p>&bull; OpenDataSoft — Global public safety datasets, geofiltered</p>
            <p>&bull; ArcGIS Open Data Hubs — City FeatureServer crime layers</p>
            <p>&bull; UK Police API — Street-level crime (England, Wales, NI)</p>
            {cmKeyConfigured && <p>&bull; Crimeometer API — National geocoded crime incidents</p>}
          </div>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground/70">Environmental &amp; Other</p>
            <p>&bull; Overpass / OpenStreetMap — CPTED environmental risk POIs</p>
            <p>&bull; OpenStreetMap Nominatim — Geocoding services</p>
            {fwKeyConfigured && <p>&bull; Family Watchdog — Registered sex offender data</p>}
            <p>&bull; NSOPW (DOJ) — National Sex Offender Public Website</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
