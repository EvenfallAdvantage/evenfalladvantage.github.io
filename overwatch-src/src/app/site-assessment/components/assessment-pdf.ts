import type { RiskResult } from "./assessment-types";

interface PdfOptions {
  data: Record<string, string>;
  result: RiskResult;
  lat: number | null;
  lon: number | null;
  companyName: string;
  brandHex: string;
  companyLogo?: string | null;
}

export async function generateAssessmentPDF(opts: PdfOptions): Promise<void> {
  const { data, result, lat, lon, companyName, brandHex, companyLogo } = opts;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = w - margin * 2;

  const hexToRgb = (hex: string): [number, number, number] => {
    const c = hex.replace("#", "");
    return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
  };
  const BRAND = hexToRgb(brandHex);
  const NAVY: [number, number, number] = [20, 30, 48];
  const DARK: [number, number, number] = [30, 30, 40];
  const GRAY: [number, number, number] = [120, 125, 135];
  const LIGHT_BG: [number, number, number] = [245, 247, 250];
  const WHITE: [number, number, number] = [255, 255, 255];

  const RISK_CLR: Record<string, [number, number, number]> = {
    Critical: [239, 68, 68], High: [249, 115, 22], Moderate: [234, 179, 8], Low: [34, 197, 94],
  };
  const riskColor = RISK_CLR[result.level] || BRAND;

  function sectionHead(label: string, yPos: number): number {
    doc.setFillColor(...BRAND);
    doc.rect(margin, yPos, 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(label, margin + 5, yPos + 5);
    return yPos + 10;
  }
  function pageFooter(pageNum: number, totalPages: number) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, h - 15, w - margin, h - 15);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`CONFIDENTIAL — Prepared by ${companyName}`, margin, h - 10);
    doc.text(`Page ${pageNum} of ${totalPages}`, w - margin, h - 10, { align: "right" });
  }
  const footerZone = 22;
  let y = 0;
  function ensureSpace(needed: number) {
    if (y + needed > h - footerZone) { doc.addPage(); y = 15; }
  }

  // ══════════════════════ PAGE 1 ══════════════════════

  // Header bar
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 36, "F");
  doc.setFillColor(...BRAND);
  doc.rect(0, 36, w, 1.5, "F");

  // Logo
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
    } catch { /* logo load failed */ }
  }

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SITE SECURITY ASSESSMENT", logoOffset, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("REPORT", logoOffset, 23);
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(`${companyName}  |  ${data.assessmentDate || new Date().toISOString().split("T")[0]}  |  Report ID: SA-${Date.now().toString(36).toUpperCase()}`, logoOffset, 30);

  y = 44;

  // Facility Info + Risk Score side by side
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y, contentW * 0.58, 38, 2, 2, "F");
  doc.roundedRect(margin + contentW * 0.62, y, contentW * 0.38, 38, 2, 2, "F");

  // Facility details (left box)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("FACILITY", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  let ly = y + 12;
  doc.text(data.clientName || "Facility Assessment", margin + 4, ly); ly += 5;
  if (data.address) { doc.text(data.address, margin + 4, ly); ly += 5; }
  if (data.city) { doc.text(`${data.city}, ${data.state}`, margin + 4, ly); ly += 5; }
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Type: ${data.facilityType || "N/A"}`, margin + 4, ly);

  // Risk score (right box)
  const rBoxX = margin + contentW * 0.62;
  doc.setFillColor(...riskColor);
  doc.roundedRect(rBoxX + 4, y + 4, contentW * 0.38 - 8, 30, 2, 2, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(`${result.score}`, rBoxX + (contentW * 0.38) / 2, y + 20, { align: "center" });
  doc.setFontSize(8);
  doc.text(`${result.level.toUpperCase()} RISK`, rBoxX + (contentW * 0.38) / 2, y + 28, { align: "center" });

  y += 44;

  // Threat / Impact / Vulnerability / Resilience row
  const colW = contentW / 4;
  const metrics: [string, string][] = [
    ["Threat", data.threatLikelihood || "N/A"],
    ["Impact", data.potentialImpact || "N/A"],
    ["Vulnerability", data.overallVulnerability || "N/A"],
    ["Resilience", data.resilienceLevel || "N/A"],
  ];
  metrics.forEach(([label, val], i) => {
    const cx = margin + i * colW;
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(cx + 1, y, colW - 2, 16, 1, 1, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(label, cx + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(val, cx + 3, y + 13);
    doc.setFont("helvetica", "normal");
  });
  y += 22;

  // Map
  if (lat != null && lon != null) {
    try {
      const zoom = 14;
      const mapW = 640;
      const mapHPx = 504;
      const tileSize = 256;
      const tileTemplate = "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png";

      const n = Math.pow(2, zoom);
      const latRad = (lat * Math.PI) / 180;
      const tileX = ((lon + 180) / 360) * n;
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

        // Risk radius circle (1 mile)
        const metersPerPx = (156543.03392 * Math.cos(latRad)) / n;
        const radiusPx = 1609 / metersPerPx;
        const circleHex = result.color;
        ctx.beginPath();
        ctx.arc(halfW, halfH, radiusPx, 0, Math.PI * 2);
        ctx.strokeStyle = circleHex;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        const cr = parseInt(circleHex.slice(1, 3), 16);
        const cg = parseInt(circleHex.slice(3, 5), 16);
        const cb = parseInt(circleHex.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.10)`;
        ctx.fill();

        // Center pin
        ctx.beginPath();
        ctx.arc(halfW, halfH, 7, 0, Math.PI * 2);
        ctx.fillStyle = circleHex;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Legend
        const legendItems: [string, string][] = [
          [circleHex, `${result.level} Risk — ${data.facilityType || "Facility"}`],
          ["#64748b", `${data.city}, ${data.state}`],
        ];
        const legendLineH = 16;
        const legendH = legendItems.length * legendLineH + 10;
        const legendW = 180;
        const legendX = mapW - legendW - 8;
        const legendY = 8;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(legendX, legendY, legendW, legendH, 4);
        ctx.fill();
        ctx.stroke();
        legendItems.forEach(([clr, label], idx) => {
          const ily = legendY + 12 + idx * legendLineH;
          ctx.beginPath();
          ctx.arc(legendX + 12, ily, 4, 0, Math.PI * 2);
          ctx.fillStyle = clr;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#1e293b";
          ctx.font = "11px sans-serif";
          ctx.fillText(label, legendX + 22, ily + 4);
        });

        // Attribution
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillText("© OpenStreetMap", 5, mapHPx - 5);

        const mapData = mapCanvas.toDataURL("image/png");
        const mapH = Math.min(98, (mapHPx / mapW) * contentW);
        ensureSpace(mapH + 4);
        doc.addImage(mapData, "PNG", margin, y, contentW, mapH);
        y += mapH + 4;
      }
    } catch (e) { console.warn("Map PDF capture failed:", e); }
  }

  // Assessment Summary
  y = sectionHead("Assessment Summary", y);
  const summaryItems: [string, string][] = [
    ["Facility Type", data.facilityType || "N/A"],
    ["Address", `${data.address || "N/A"}, ${data.city} ${data.state}`],
    ["Entry Points", `${data.entryPoints || "N/A"} total / ${data.controlledEntries || "N/A"} controlled`],
    ["Cameras", `${data.cameraCount || "N/A"} — ${data.cameraCoverage || "N/A"}`],
    ["Door Construction", data.doorType || "N/A"],
    ["Access Control", data.accessControlTech || "N/A"],
    ["Emergency Plans", data.emergencyPlans || "N/A"],
    ["Staff Training", data.staffTraining || "N/A"],
  ];
  doc.setFontSize(8);
  const halfCol = contentW / 2;
  summaryItems.forEach(([label, val], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xPos = margin + col * halfCol + 3;
    const yPos = y + row * 6;
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(`${label}:`, xPos, yPos);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    const truncVal = val.length > 42 ? val.substring(0, 42) + "..." : val;
    doc.text(truncVal, xPos + 30, yPos);
  });
  y += Math.ceil(summaryItems.length / 2) * 6 + 6;

  // Recommendations
  if (result.recommendations.length > 0) {
    ensureSpace(50);
    y = sectionHead(`Recommendations (${result.recommendations.length})`, y);
    const priorityConfig: Record<number, { label: string; color: [number, number, number]; bg: [number, number, number] }> = {
      1: { label: "Critical Priority", color: [220, 38, 38], bg: [254, 242, 242] },
      2: { label: "High Priority", color: [234, 88, 12], bg: [255, 247, 237] },
      3: { label: "Standard Priority", color: [37, 99, 235], bg: [239, 246, 255] },
    };

    [1, 2, 3].forEach((priority) => {
      const precs = result.recommendations.filter((r) => r.priority === priority);
      if (precs.length === 0) return;
      const cfg = priorityConfig[priority];
      ensureSpace(12 + precs.length * 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...cfg.color);
      doc.text(cfg.label, margin + 3, y + 4);
      y += 8;

      precs.forEach((rec) => {
        ensureSpace(16);
        doc.setFillColor(...cfg.bg);
        doc.roundedRect(margin + 2, y - 3, contentW - 4, 14, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...DARK);
        doc.text(rec.issue, margin + 5, y + 1);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(rec.recommendation, margin + 5, y + 5.5);
        doc.setFontSize(6.5);
        doc.text(`Timeline: ${rec.timeline}   |   Responsibility: ${rec.responsibility}`, margin + 5, y + 9.5);
        y += 16;
      });
      y += 3;
    });
  }

  // Field Observations
  const notes: [string, string][] = [
    ["Physical Security", data.physicalNotes],
    ["Access Control", data.accessNotes],
    ["Surveillance", data.surveillanceNotes],
    ["Emergency Management", data.emergencyNotes],
    ["Training & Culture", data.trainingNotes],
  ].filter(([, v]) => v) as [string, string][];

  if (notes.length > 0) {
    ensureSpace(15);
    y = sectionHead("Field Observations", y);
    doc.setFontSize(8);
    notes.forEach(([label, text]) => {
      ensureSpace(12);
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, margin + 3, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(text, contentW - 10);
      doc.text(lines, margin + 3, y + 4.5);
      y += 4.5 + lines.length * 3.5 + 3;
    });
  }

  // Assessor footer
  ensureSpace(15);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, w - margin, y);
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(`This assessment was conducted by ${data.assessorName || "Security Consultant"}${data.assessorTitle ? `, ${data.assessorTitle}` : ""}.`, margin, y);
  y += 3.5;
  doc.text(`Generated by Overwatch Security Platform — ${companyName}`, margin, y);

  // Page footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    pageFooter(p, totalPages);
  }

  const clientName = data.clientName || "Assessment";
  doc.save(`Security_Assessment_${clientName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}
