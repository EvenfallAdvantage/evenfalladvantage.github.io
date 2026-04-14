import jsPDF from "jspdf";
import type { RiskResult } from "./shared";
import {
  hasCrimeometerKey, hasFamilyWatchdogKey,
  type CrimeIncident, type SexOffender, type EnvironmentalRisk,
} from "@/lib/crime-incidents";

type ExportContext = {
  result: RiskResult;
  incidents: CrimeIncident[];
  offenders: SexOffender[];
  envRisk: EnvironmentalRisk;
  companyName: string;
  brandHex: string;
  companyLogo?: string;
};

export async function exportGeoRiskPDF(ctx: ExportContext) {
  const { result, incidents, offenders, envRisk, companyName, brandHex, companyLogo } = ctx;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = w - margin * 2;

  // Parse hex -> RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const hx = hex.replace("#", "");
    return [parseInt(hx.substring(0, 2), 16), parseInt(hx.substring(2, 4), 16), parseInt(hx.substring(4, 6), 16)];
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

  // Helper: section heading with accent bar
  function sectionHead(label: string, yPos: number): number {
    doc.setFillColor(...BRAND);
    doc.rect(margin, yPos, 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(label, margin + 5, yPos + 5);
    return yPos + 10;
  }

  // Helper: page footer
  function pageFooter(pageNum: number, totalPages: number) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, h - 15, w - margin, h - 15);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`CONFIDENTIAL — Prepared by ${companyName}`, margin, h - 10);
    doc.text(`Page ${pageNum} of ${totalPages}`, w - margin, h - 10, { align: "right" });
  }

  // Helper: ensure enough vertical space
  const footerZone = 22;
  function ensureSpace(needed: number) {
    if (y + needed > h - footerZone) {
      doc.addPage();
      y = 15;
    }
  }

  // ══════════════════════ PAGE 1 ══════════════════════

  // Header bar
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 36, "F");
  doc.setFillColor(...BRAND);
  doc.rect(0, 36, w, 1.5, "F");

  // Company logo
  let logoOffset = margin;
  if (companyLogo) {
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        logoImg.src = companyLogo;
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

  // Location + Risk Score side by side
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

  // Threat / Impact / Crime row
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

  // Map capture
  if (result.lat != null && result.lon != null) {
    try {
      const zoom = 14;
      const mapW = 640;
      const mapHPx = 504;
      const tileSize = 256;
      const tileTemplate = "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png";

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
      const mapCtx = mapCanvas.getContext("2d");
      if (mapCtx) {
        mapCtx.fillStyle = "#f1f5f9";
        mapCtx.fillRect(0, 0, mapW, mapHPx);

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
              mapCtx.drawImage(tile, px, py, tileSize, tileSize);
            }
          }
        }

        // Helper: convert lat/lon -> canvas pixel
        const toPixel = (ptLat: number, ptLon: number): [number, number] => {
          const ptLatRad = (ptLat * Math.PI) / 180;
          const ptTileX = ((ptLon + 180) / 360) * n;
          const ptTileY = ((1 - Math.log(Math.tan(ptLatRad) + 1 / Math.cos(ptLatRad)) / Math.PI) / 2) * n;
          return [
            halfW + (ptTileX - tileX) * tileSize,
            halfH + (ptTileY - tileY) * tileSize,
          ];
        };

        // Risk radius circle
        const metersPerPx = (156543.03392 * Math.cos(latRad)) / n;
        const radiusPx = 1609 / metersPerPx;
        const circleColor = ({
          Critical: "#ef4444", High: "#f97316", Moderate: "#eab308",
          Low: "#22c55e", Negligible: "#94a3b8",
        } as Record<string, string>)[result.overallRating] || "#eab308";
        mapCtx.beginPath();
        mapCtx.arc(halfW, halfH, radiusPx, 0, Math.PI * 2);
        mapCtx.strokeStyle = circleColor;
        mapCtx.lineWidth = 2;
        mapCtx.setLineDash([8, 5]);
        mapCtx.stroke();
        mapCtx.setLineDash([]);
        const r2 = parseInt(circleColor.slice(1, 3), 16);
        const g2 = parseInt(circleColor.slice(3, 5), 16);
        const b2 = parseInt(circleColor.slice(5, 7), 16);
        mapCtx.fillStyle = `rgba(${r2},${g2},${b2},0.10)`;
        mapCtx.fill();

        // Helper: draw a dot marker
        const drawDot = (px: number, py: number, color: string, radius: number) => {
          mapCtx.beginPath();
          mapCtx.arc(px, py, radius, 0, Math.PI * 2);
          mapCtx.fillStyle = color;
          mapCtx.fill();
          mapCtx.strokeStyle = "#fff";
          mapCtx.lineWidth = 1.5;
          mapCtx.stroke();
        };

        // Incident markers
        const INCIDENT_CLR: Record<string, string> = { violent: "#ef4444", property: "#f59e0b", other: "#6b7280" };
        incidents.forEach((inc) => {
          const [px, py] = toPixel(inc.lat, inc.lon);
          if (px >= 0 && px <= mapW && py >= 0 && py <= mapHPx) {
            drawDot(px, py, INCIDENT_CLR[inc.type] || "#6b7280", 5);
          }
        });

        // Sex offender markers
        offenders.forEach((off) => {
          const [px, py] = toPixel(off.lat, off.lon);
          if (px >= 0 && px <= mapW && py >= 0 && py <= mapHPx) {
            drawDot(px, py, "#a855f7", 6);
          }
        });

        // Environmental risk POI markers
        envRisk.pois.forEach((poi) => {
          const [px, py] = toPixel(poi.lat, poi.lon);
          if (px >= 0 && px <= mapW && py >= 0 && py <= mapHPx) {
            drawDot(px, py, "#06b6d4", 4);
          }
        });

        // Center target pin
        mapCtx.beginPath();
        mapCtx.arc(halfW, halfH, 7, 0, Math.PI * 2);
        mapCtx.fillStyle = circleColor;
        mapCtx.fill();
        mapCtx.strokeStyle = "#fff";
        mapCtx.lineWidth = 2.5;
        mapCtx.stroke();

        // Legend box
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
        mapCtx.fillStyle = "rgba(255,255,255,0.92)";
        mapCtx.strokeStyle = "rgba(0,0,0,0.15)";
        mapCtx.lineWidth = 1;
        mapCtx.beginPath();
        mapCtx.roundRect(legendX, legendY, legendW, legendH, 4);
        mapCtx.fill();
        mapCtx.stroke();
        mapCtx.font = "bold 10px sans-serif";
        mapCtx.fillStyle = "#1e293b";
        legendItems.forEach(([clr, label], idx) => {
          const lly = legendY + 12 + idx * legendLineH;
          mapCtx.beginPath();
          mapCtx.arc(legendX + 12, lly, 4, 0, Math.PI * 2);
          mapCtx.fillStyle = clr;
          mapCtx.fill();
          mapCtx.strokeStyle = "#fff";
          mapCtx.lineWidth = 1;
          mapCtx.stroke();
          mapCtx.fillStyle = "#1e293b";
          mapCtx.font = "11px sans-serif";
          mapCtx.fillText(label, legendX + 22, lly + 4);
        });

        // Attribution
        mapCtx.font = "10px sans-serif";
        mapCtx.fillStyle = "rgba(0,0,0,0.5)";
        mapCtx.fillText("\u00A9 OpenStreetMap", 5, mapHPx - 5);

        const mapData = mapCanvas.toDataURL("image/png");
        const mapH = Math.min(98, (mapHPx / mapW) * contentW);
        doc.addImage(mapData, "PNG", margin, y, contentW, mapH);
        y += mapH + 4;
      }
    } catch (e) { console.warn("Map PDF capture failed:", e); }
  }

  // OSINT Incident Summary
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
    const srcCounts: Record<string, number> = {};
    incidents.forEach(i => { srcCounts[i.source] = (srcCounts[i.source] || 0) + 1; });
    doc.setTextColor(...GRAY);
    doc.setFontSize(7);
    doc.text(`Sources: ${Object.entries(srcCounts).map(([s, c]) => `${s} (${c})`).join("  |  ")}`, margin + 5, y);
    y += 8;
  }

  // Environmental Risk (CPTED)
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

  // Recommendations
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
    doc.text(`\u2022  ${rec}`, margin + 6, y); y += 7;
  });
  y += 4;

  // Data Sources
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
    doc.text(`\u2022  ${src}`, margin + 5, y); y += 4;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    pageFooter(p, totalPages);
  }

  doc.save(`GeoRisk-${result.city}-${result.state}-${new Date().toISOString().split("T")[0]}.pdf`);
}
