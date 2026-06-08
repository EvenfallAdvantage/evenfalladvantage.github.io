/**
 * Per-incident PDF report generator.
 *
 * Generates a single-incident defensible record PDF with:
 *  - Company-branded header (logo, name, brand color)
 *  - Incident metadata (number, type, severity, priority, status, team, location, timing)
 *  - Narrative / description
 *  - Custom fields
 *  - Activity timeline (incident_updates)
 *
 * Uses jsPDF (dynamic import) to keep the main bundle small.
 */

export interface IncidentPdfOptions {
  incident: {
    id: string;
    incident_number?: string | null;
    title: string;
    description?: string | null;
    type?: string | null;
    severity?: string | null;
    priority?: string | null;
    status?: string | null;
    source?: string | null;
    location?: string | null;
    team_id?: string | null;
    created_at?: string | null;
    due_at?: string | null;
    closed_at?: string | null;
    updated_at?: string | null;
    custom_fields?: Record<string, unknown> | null;
    reported_user?: { first_name?: string | null; last_name?: string | null } | null;
    assigned_user?: { first_name?: string | null; last_name?: string | null } | null;
  };
  updates?: Array<{
    id: string;
    content: string;
    type?: string | null;
    created_at?: string | null;
    users?: { first_name?: string | null; last_name?: string | null } | null;
  }>;
  teamName?: string | null;
  companyName: string;
  brandHex: string;
  companyLogo?: string | null;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

function fmtDate(s?: string | null): string {
  if (!s) return "-";
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return s;
  }
}

function fmtFullName(u?: { first_name?: string | null; last_name?: string | null } | null): string {
  if (!u) return "-";
  const parts = [u.first_name, u.last_name].filter(Boolean) as string[];
  return parts.length ? parts.join(" ") : "-";
}

export async function generateIncidentPDF(opts: IncidentPdfOptions): Promise<void> {
  const { incident, updates = [], teamName, companyName, brandHex, companyLogo } = opts;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = w - margin * 2;

  const BRAND = hexToRgb(brandHex || "#1d3451");
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

  function labelValue(label: string, value: string, yPos: number): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(label.toUpperCase(), margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(value || "-", contentW);
    doc.text(lines, margin, yPos + 5);
    return yPos + 5 + lines.length * 5 + 3;
  }

  // ─── Header bar ───
  drawHeaderBar();

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
    } catch {
      /* logo load failed */
    }
  }

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INCIDENT REPORT", logoOffset, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (incident.incident_number) {
    doc.text(incident.incident_number, logoOffset, 23);
  }
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  const headerSummary = `${companyName}  |  Generated ${new Date().toLocaleString()}`;
  doc.text(headerSummary, logoOffset, 30);

  y = 44;

  // ─── Summary box ───
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y, contentW, 28, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  const titleLines = doc.splitTextToSize(incident.title || "(untitled)", contentW - 8);
  doc.text(titleLines, margin + 4, y + 8);

  const chipY = y + 8 + titleLines.length * 5 + 2;
  const chips: Array<{ label: string; bg: [number, number, number] }> = [];
  if (incident.status) chips.push({ label: incident.status, bg: BRAND });
  if (incident.severity) chips.push({ label: `Severity: ${incident.severity}`, bg: GRAY });
  if (incident.priority) chips.push({ label: `Priority: ${incident.priority}`, bg: GRAY });
  if (incident.type) chips.push({ label: incident.type, bg: GRAY });
  let cx = margin + 4;
  doc.setFontSize(8);
  for (const chip of chips) {
    const tw = doc.getTextWidth(chip.label) + 4;
    doc.setFillColor(...chip.bg);
    doc.roundedRect(cx, chipY, tw, 5, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.text(chip.label, cx + 2, chipY + 3.5);
    cx += tw + 2;
  }

  y += 32;

  // ─── Metadata grid ───
  y = sectionHead("METADATA", y);
  const col1X = margin;
  const col2X = margin + contentW / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);

  const metaPairs: Array<[string, string]> = [
    ["Number", incident.incident_number || "-"],
    ["Source", incident.source || "internal"],
    ["Reported By", fmtFullName(incident.reported_user)],
    ["Assigned To", fmtFullName(incident.assigned_user)],
    ["Team", teamName || (incident.team_id ? incident.team_id : "-")],
    ["Location", incident.location || "-"],
    ["Reported At", fmtDate(incident.created_at)],
    ["Due At", fmtDate(incident.due_at)],
    ["Closed At", fmtDate(incident.closed_at)],
    ["Updated At", fmtDate(incident.updated_at)],
  ];

  for (let i = 0; i < metaPairs.length; i += 2) {
    ensureSpace(12);
    const [l1, v1] = metaPairs[i];
    const pair2 = metaPairs[i + 1];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(l1.toUpperCase(), col1X, y);
    if (pair2) doc.text(pair2[0].toUpperCase(), col2X, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(v1, col1X, y + 4);
    if (pair2) doc.text(pair2[1], col2X, y + 4);
    y += 9;
  }
  y += 2;

  // ─── Description ───
  if (incident.description) {
    ensureSpace(20);
    y = sectionHead("NARRATIVE", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(incident.description, contentW);
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 4;
  }

  // ─── Custom fields ───
  if (incident.custom_fields && typeof incident.custom_fields === "object" && Object.keys(incident.custom_fields).length > 0) {
    ensureSpace(16);
    y = sectionHead("CUSTOM FIELDS", y);
    for (const [k, v] of Object.entries(incident.custom_fields)) {
      ensureSpace(8);
      const value = typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "-");
      y = labelValue(k.replace(/_/g, " "), value, y);
    }
    y += 2;
  }

  // ─── Activity timeline ───
  if (updates.length > 0) {
    ensureSpace(16);
    y = sectionHead("ACTIVITY TIMELINE", y);
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    for (const u of updates) {
      ensureSpace(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      const who = fmtFullName(u.users || null);
      const when = fmtDate(u.created_at);
      const tag = u.type && u.type !== "note" ? ` [${u.type}]` : "";
      doc.text(`${who} - ${when}${tag}`, margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(u.content, contentW - 4);
      for (const line of lines) {
        ensureSpace(5);
        doc.text(line, margin + 4, y);
        y += 4;
      }
      y += 2;
    }
  }

  // ─── Footer (every page) ───
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, h - 15, w - margin, h - 15);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(`CONFIDENTIAL - Prepared by ${companyName}`, margin, h - 10);
    doc.text(`Page ${p} of ${totalPages}`, w - margin, h - 10, { align: "right" });
  }

  const safeName = (incident.incident_number || incident.id || "incident").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`incident-${safeName}.pdf`);
}
