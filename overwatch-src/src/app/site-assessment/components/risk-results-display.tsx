"use client";

import { useRef } from "react";
import {
  AlertTriangle, CheckCircle2, AlertCircle, Info, XCircle,
  MapPin, FileDown, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import type { RiskResult } from "./assessment-types";

const GeoRiskMap = dynamic(() => import("@/components/geo-risk-map"), { ssr: false });

interface RiskResultsDisplayProps {
  result: RiskResult;
  data: Record<string, string>;
  lat: number | null;
  lon: number | null;
  generating: boolean;
  onDownloadPDF: () => void;
}

export default function RiskResultsDisplay({ result, data, lat, lon, generating, onDownloadPDF }: RiskResultsDisplayProps) {
  const { resolvedTheme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div id="risk-results" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono">ASSESSMENT RESULTS</h2>
        <Button size="sm" className="gap-1.5" onClick={onDownloadPDF} disabled={generating}>
          {generating ? <Save className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          Download PDF Report
        </Button>
      </div>

      {/* Report for PDF */}
      <div className="bg-white text-black rounded-xl overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {/* Report Header */}
        <div className="bg-gray-900 text-white p-8">
          <h1 className="text-2xl font-bold tracking-tight">SITE SECURITY ASSESSMENT REPORT</h1>
          <p className="text-gray-400 mt-1">{data.clientName || "Facility Assessment"}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm text-gray-300">
            {data.city && <span>{data.city}, {data.state}</span>}
            {data.assessmentDate && <span>Date: {data.assessmentDate}</span>}
            {data.assessorName && <span>Assessor: {data.assessorName}</span>}
          </div>
        </div>

        {/* Risk Score */}
        <div className="p-4 sm:p-8 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="relative h-28 w-28 shrink-0">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={result.color} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 50} strokeDashoffset={2 * Math.PI * 50 * (1 - result.score / 100)} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold" style={{ color: result.color }}>{result.score}</span>
                <span className="text-[10px] text-gray-500">/ 100</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-bold" style={{ color: result.color }}>{result.level} Risk</span>
                {result.level === "Critical" && <AlertCircle className="h-5 w-5 text-red-500" />}
                {result.level === "High" && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                {result.level === "Moderate" && <Info className="h-5 w-5 text-yellow-600" />}
                {result.level === "Low" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>
              <p className="text-sm text-gray-600">
                {result.level === "Critical" ? "Immediate action required. Significant security vulnerabilities exist." :
                 result.level === "High" ? "Prompt attention needed. Multiple security gaps identified." :
                 result.level === "Moderate" ? "Some improvements recommended. Review priority items." :
                 "Security posture is adequate. Maintain current measures."}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                <span>Threat: {data.threatLikelihood || "N/A"}</span>
                <span>Impact: {data.potentialImpact || "N/A"}</span>
                <span>Vulnerability: {data.overallVulnerability || "N/A"}</span>
                <span>Resilience: {data.resilienceLevel || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Location Map */}
        {lat != null && lon != null && (
          <div className="border-b border-gray-200">
            <div ref={mapContainerRef}>
              <GeoRiskMap
                lat={lat}
                lon={lon}
                riskLevel={result.level === "Critical" ? "Critical" : result.level === "High" ? "High" : result.level === "Moderate" ? "Moderate" : "Low"}
                address={`${data.address ? data.address + ", " : ""}${data.city}, ${data.state}`}
                isDark={resolvedTheme === "dark"}
              />
            </div>
            <div className="px-4 py-2 flex items-center gap-2 text-xs text-gray-500 bg-gray-50">
              <MapPin className="h-3 w-3" />
              <span>{data.address ? `${data.address}, ` : ""}{data.city}, {data.state}</span>
              <span className="ml-auto text-[10px]">1-mile analysis radius</span>
            </div>
          </div>
        )}

        {/* Assessment Summary */}
        <div className="p-4 sm:p-8 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Assessment Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div><span className="text-gray-500">Facility Type:</span> <span className="font-medium">{data.facilityType || "N/A"}</span></div>
            <div><span className="text-gray-500">Address:</span> <span className="font-medium">{data.address || "N/A"}, {data.city} {data.state}</span></div>
            <div><span className="text-gray-500">Entry Points:</span> <span className="font-medium">{data.entryPoints || "N/A"} total / {data.controlledEntries || "N/A"} controlled</span></div>
            <div><span className="text-gray-500">Cameras:</span> <span className="font-medium">{data.cameraCount || "N/A"} — {data.cameraCoverage || "N/A"}</span></div>
            <div><span className="text-gray-500">Door Construction:</span> <span className="font-medium">{data.doorType || "N/A"}</span></div>
            <div><span className="text-gray-500">Access Control:</span> <span className="font-medium">{data.accessControlTech || "N/A"}</span></div>
            <div><span className="text-gray-500">Emergency Plans:</span> <span className="font-medium">{data.emergencyPlans || "N/A"}</span></div>
            <div><span className="text-gray-500">Staff Training:</span> <span className="font-medium">{data.staffTraining || "N/A"}</span></div>
          </div>
        </div>

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div className="p-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Recommendations ({result.recommendations.length})</h2>
            {[1, 2, 3].map((priority) => {
              const precs = result.recommendations.filter((r) => r.priority === priority);
              if (precs.length === 0) return null;
              const pLabel = priority === 1 ? "Critical Priority" : priority === 2 ? "High Priority" : "Standard Priority";
              const pColor = priority === 1 ? "text-red-600" : priority === 2 ? "text-orange-600" : "text-blue-600";
              const pBg = priority === 1 ? "bg-red-50 border-red-200" : priority === 2 ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200";
              return (
                <div key={priority} className="mb-6">
                  <h3 className={`text-sm font-bold ${pColor} mb-2 flex items-center gap-1`}>
                    {priority === 1 ? <XCircle className="h-4 w-4" /> : priority === 2 ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                    {pLabel}
                  </h3>
                  <div className="space-y-2">
                    {precs.map((rec, i) => (
                      <div key={i} className={`rounded-lg border p-3 ${pBg}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{rec.issue}</p>
                            <p className="text-sm text-gray-600 mt-0.5">{rec.recommendation}</p>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-2 text-[11px] text-gray-500">
                          <span>Timeline: {rec.timeline}</span>
                          <span>Responsibility: {rec.responsibility}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Notes Sections */}
        {(data.physicalNotes || data.accessNotes || data.surveillanceNotes || data.emergencyNotes || data.trainingNotes) && (
          <div className="p-8 border-t border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Field Observations</h2>
            <div className="space-y-3 text-sm">
              {data.physicalNotes && <div><span className="font-semibold text-gray-700">Physical Security:</span> <span className="text-gray-600">{data.physicalNotes}</span></div>}
              {data.accessNotes && <div><span className="font-semibold text-gray-700">Access Control:</span> <span className="text-gray-600">{data.accessNotes}</span></div>}
              {data.surveillanceNotes && <div><span className="font-semibold text-gray-700">Surveillance:</span> <span className="text-gray-600">{data.surveillanceNotes}</span></div>}
              {data.emergencyNotes && <div><span className="font-semibold text-gray-700">Emergency Management:</span> <span className="text-gray-600">{data.emergencyNotes}</span></div>}
              {data.trainingNotes && <div><span className="font-semibold text-gray-700">Training & Culture:</span> <span className="text-gray-600">{data.trainingNotes}</span></div>}
            </div>
          </div>
        )}

        {/* Report Footer */}
        <div className="bg-gray-50 p-6 text-center text-xs text-gray-400 border-t border-gray-200">
          <p>This assessment was conducted by {data.assessorName || "Security Consultant"}{data.assessorTitle ? `, ${data.assessorTitle}` : ""}.</p>
          <p className="mt-1">Generated by Overwatch Security Platform &mdash; Evenfall Advantage LLC</p>
        </div>
      </div>
    </div>
  );
}
