/**
 * Analytics PDF report (Phase 5).
 *
 * Generates a single-page (or auto-paginated) executive summary of a
 * date-range cut of incident + task analytics for a company. White-labeled
 * with company logo, name, and brand color in the header.
 *
 * Uses jsPDF via dynamic import to keep the main bundle small.
 */

import type { IncidentAnalytics, TaskAnalytics, MultiLogReport } from "@/lib/supabase/db-analytics";

export interface AnalyticsPdfOptions {
  range: { from: string; to: string };
  companyName: string;
  brandHex: string;
  companyLogo?: string | null;
  incidents: IncidentAnalytics;
  tasks: TaskAnalytics;
  combined?: MultiLogReport | null;
  teamNameById?: Map<string, string>;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

export async function generateAnalyticsPDF(opts: AnalyticsPdfOptions): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = w - margin * 2;

  const BRAND = hexToRgb(opts.brandHex || "#1d3451");
  const NAVY: [number, number, number] = [20, 30, 48];
  const DARK: [number, number, number] = [30, 30, 40];
  const GRAY: [number, number, number] = [120, 125, 135];
  const LIGHT_BG: [number, number, number] = [245, 247, 250];
  const WHITE: [number, number, number] = [255, 255, 255];

  let y = 0;
  const footerZone = 22;

  function ensureSpace(needed: number) {
    if (y + needed > h - footerZone) {
      doc.addPage();
      drawHeaderBar();
      y = 44;
    }
  }

  function drawHeaderBar() {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, w, 36, "F");
    doc.setFillColor(...BRAND);
    doc.rect(0, 36, w, 1.5, "F");
  }

  function sectionHead(label: string, yPos: number): number {
    doc.setFillColor(...BRAND);
    doc.rect(margin, yPos, 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(label, margin + 5, yPos + 5);
    return yPos + 10;
  }

  function kpiRow(items: Array<{ label: string; value: string }>, yPos: number): number {
    const tileW = contentW / items.length - 2;
    items.forEach((item, i) => {
      const x = margin + i * (tileW + 2);
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(x, yPos, tileW, 22, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(item.label.toUpperCase(), x + 3, yPos + 5);
      doc.setFontSize(14);
      doc.setTextColor(...NAVY);
      doc.text(item.value, x + 3, yPos + 16);
    });
    return yPos + 26;
  }

  function breakdownTable(
    title: string,
    rows: Array<{ label: string; count: number }>,
    yPos: number,
  ): number {
    let yp = sectionHead(title, yPos);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);

    if (rows.length === 0) {
      doc.text("(none)", margin, yp + 4);
      return yp + 8;
    }

    const total = rows.reduce((s, r) => s + r.count, 0) || 1;
    rows.slice(0, 10).forEach((r) => {
      ensureSpace(8);
      const pct = Math.round((r.count / total) * 100);
      doc.text(r.label, margin, yp + 4);
      doc.text(`${r.count}  (${pct}%)`, w - margin, yp + 4, { align: "right" });
      // Bar.
      doc.setFillColor(...LIGHT_BG);
      doc.rect(margin, yp + 5, contentW, 1.5, "F");
      doc.setFillColor(...BRAND);
      doc.rect(margin, yp + 5, contentW * (r.count / total), 1.5, "F");
      yp += 8;
    });
    return yp + 2;
  }

  // ── Header bar ─────────────────────────────────────
  drawHeaderBar();
  let logoOffset = margin;
  if (opts.companyLogo) {
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        logoImg.src = opts.companyLogo!;
      });
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        const c = document.createElement("canvas");
        c.width = logoImg.naturalWidth;
        c.height = logoImg.naturalHeight;
        c.getContext("2d")?.drawImage(logoImg, 0, 0);
        doc.addImage(c.toDataURL("image/png"), "PNG", margin, 5, 26, 26);
        logoOffset = margin + 30;
      }
    } catch {
      /* ignore */
    }
  }

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ANALYTICS REPORT", logoOffset, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${opts.range.from} → ${opts.range.to}`, logoOffset, 23);
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(`${opts.companyName} · Generated ${new Date().toLocaleString()}`, logoOffset, 30);

  y = 44;

  // ── KPI row ────────────────────────────────────────
  y = kpiRow(
    [
      { label: "Incidents", value: String(opts.incidents.totalCount) },
      { label: "Open", value: String(opts.incidents.openCount) },
      { label: "Tasks", value: String(opts.tasks.totalCount) },
      { label: "Completion", value: `${opts.tasks.completionRatePct}%` },
    ],
    y,
  );

  // ── Incident breakdowns ────────────────────────────
  y = sectionHead("INCIDENTS", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(
    `Total ${opts.incidents.totalCount}  ·  Open ${opts.incidents.openCount}  ·  Resolved ${opts.incidents.resolvedCount}`,
    margin,
    y,
  );
  y += 6;

  y = breakdownTable("By severity", opts.incidents.bySeverity.map((r) => ({ label: r.key, count: r.count })), y);
  y = breakdownTable("By status", opts.incidents.byStatus.map((r) => ({ label: r.key, count: r.count })), y);
  y = breakdownTable("By type", opts.incidents.byType.map((r) => ({ label: r.key.replace(/_/g, " "), count: r.count })), y);
  y = breakdownTable(
    "By team",
    opts.incidents.byTeam.map((r) => ({
      label: r.teamId ? opts.teamNameById?.get(r.teamId) ?? r.teamId.slice(0, 8) : "Unassigned",
      count: r.count,
    })),
    y,
  );

  // ── Task breakdowns ────────────────────────────────
  ensureSpace(40);
  y = sectionHead("TASKS", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(
    `Total ${opts.tasks.totalCount}  ·  Open ${opts.tasks.openCount}  ·  Done ${opts.tasks.doneCount}  ·  Overdue ${opts.tasks.overdueCount}`,
    margin,
    y,
  );
  y += 6;

  y = breakdownTable("By status", opts.tasks.byStatus.map((r) => ({ label: r.key.replace(/_/g, " "), count: r.count })), y);
  y = breakdownTable("By priority", opts.tasks.byPriority.map((r) => ({ label: r.key, count: r.count })), y);
  y = breakdownTable(
    "By team",
    opts.tasks.byTeam.map((r) => ({
      label: r.teamId ? opts.teamNameById?.get(r.teamId) ?? r.teamId.slice(0, 8) : "Unassigned",
      count: r.count,
    })),
    y,
  );

  // ── Combined activity ─────────────────────────────
  if (opts.combined) {
    ensureSpace(30);
    y = sectionHead("CROSS-DOMAIN ACTIVITY", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(
      `Incidents ${opts.combined.incidentsCount}  ·  Tasks ${opts.combined.tasksCount}  ·  Patrols ${opts.combined.patrolsCount}  ·  Timesheets ${opts.combined.timesheetsCount}`,
      margin,
      y,
    );
    y += 8;
  }

  // ── Footer (every page) ────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, h - 15, w - margin, h - 15);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(`CONFIDENTIAL — Prepared by ${opts.companyName}`, margin, h - 10);
    doc.text(`Page ${p} of ${totalPages}`, w - margin, h - 10, { align: "right" });
  }

  const safeRange = `${opts.range.from}_${opts.range.to}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`analytics-${safeRange}.pdf`);
}
