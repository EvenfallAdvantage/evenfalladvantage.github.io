import type { StaffBadge } from "@/lib/supabase/db-badges";

/**
 * Download a professional badge card as PNG.
 */
export async function downloadBadgeCard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  member: any,
  badge: StaffBadge,
  qrDataUrl: string,
  companyName: string,
  companyLogo: string | null,
  brandColor: string
): Promise<void> {
  const canvas = document.createElement("canvas");
  const W = 638;
  const H = 1013;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bc = brandColor || "#d59b3c";
  const firstName = member.users?.first_name ?? "";
  const lastName = member.users?.last_name ?? "";
  const avatarUrl = member.users?.avatar_url;

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }

  // ── White background ──
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // ── Top brand band ──
  ctx.fillStyle = bc;
  ctx.fillRect(0, 0, W, 100);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(companyName, W / 2, 48);
  ctx.font = "600 11px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.letterSpacing = "4px";
  ctx.fillText("SECURITY  \u00B7  ACCESS BADGE", W / 2, 75);
  ctx.letterSpacing = "0px";

  // ── Profile photo ──
  const photoSize = 180;
  const photoCX = W / 2;
  const photoCY = 230;

  // Light gray placeholder circle
  ctx.fillStyle = "#edf0f4";
  ctx.beginPath();
  ctx.arc(photoCX, photoCY, photoSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Initials fallback
  ctx.fillStyle = "#a0aab8";
  ctx.font = "bold 64px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`${firstName[0] || ""}${lastName[0] || ""}`, photoCX, photoCY);
  ctx.textBaseline = "alphabetic";

  // ── Name ──
  ctx.fillStyle = "#1a1a2e";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText(`${firstName} ${lastName}`, W / 2, photoCY + photoSize / 2 + 42);

  // ── "AGENT" label ──
  const agentY = photoCY + photoSize / 2 + 64;
  ctx.fillStyle = "#8a94a6";
  ctx.font = "600 14px sans-serif";
  ctx.letterSpacing = "3px";
  ctx.fillText("AGENT", W / 2, agentY);
  ctx.letterSpacing = "0px";

  // ── Thin divider ──
  const divY = agentY + 20;
  ctx.strokeStyle = "#e0e4ea";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, divY);
  ctx.lineTo(W - 60, divY);
  ctx.stroke();

  // ── QR Code (large, fills remaining space) ──
  return new Promise<void>((resolve) => {
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = () => {
      const qrSize = 280;
      const qrX = (W - qrSize) / 2;
      const qrY = divY + 28;

      // Subtle border
      ctx.strokeStyle = "#e8ecf0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 10);
      ctx.stroke();

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Badge number
      ctx.fillStyle = "#9aa5b4";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(badge.badge_number ?? "", W / 2, qrY + qrSize + 30);

      // Scan label
      ctx.fillStyle = "#b0b8c4";
      ctx.font = "11px sans-serif";
      ctx.fillText("SCAN TO CLOCK IN / OUT", W / 2, qrY + qrSize + 52);

      // ── Footer ──
      ctx.fillStyle = "#f5f6f8";
      roundRect(0, H - 44, W, 44, 0);
      ctx.fillStyle = bc;
      ctx.fillRect(0, H - 3, W, 3);
      ctx.fillStyle = "#9aa5b4";
      ctx.font = "9px sans-serif";
      ctx.fillText("OVERWATCH  \u00B7  " + companyName.toUpperCase(), W / 2, H - 18);

      // ── Overlay avatar photo ──
      const finish = () => {
        // Accent ring around photo
        ctx.strokeStyle = bc;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(photoCX, photoCY, photoSize / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
        overlayLogo();
      };

      if (avatarUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(photoCX, photoCY, photoSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, photoCX - photoSize / 2, photoCY - photoSize / 2, photoSize, photoSize);
          ctx.restore();
          finish();
        };
        img.onerror = () => finish();
        img.src = avatarUrl;
      } else {
        finish();
      }

      function overlayLogo() {
        if (companyLogo) {
          const li = new Image();
          li.crossOrigin = "anonymous";
          li.onload = () => {
            // Draw logo directly on the band — no white circle
            const s = 44;
            const lx = 28;
            const ly = 28;
            ctx.drawImage(li, lx, ly, s, s);
            doDownload();
          };
          li.onerror = () => doDownload();
          li.src = companyLogo;
        } else {
          doDownload();
        }
      }

      function doDownload() {
        const link = document.createElement("a");
        link.download = `badge-${firstName}-${lastName}.png`.toLowerCase().replace(/\s+/g, "-");
        link.href = canvas.toDataURL("image/png");
        link.click();
        resolve();
      }
    };
    qrImg.onerror = () => resolve();
    qrImg.src = qrDataUrl;
  });
}
