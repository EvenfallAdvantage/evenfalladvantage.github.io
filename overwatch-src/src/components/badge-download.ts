import type { StaffBadge } from "@/lib/supabase/db-badges";

/**
 * Download a professional badge card as PNG.
 * Extracted so both the badge-generator component and roster inline buttons can use it.
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
  const role = (member.role ?? "staff").toUpperCase();

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Top band
  ctx.fillStyle = bc;
  ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(companyName, W / 2, 55);
  ctx.font = "600 13px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.letterSpacing = "3px";
  ctx.fillText("SECURITY  \u00B7  ACCESS BADGE", W / 2, 82);
  ctx.letterSpacing = "0px";

  // Photo area
  const photoSize = 200;
  const photoCX = W / 2;
  const photoCY = 250;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(photoCX, photoCY, photoSize / 2 + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8ecf0";
  ctx.beginPath();
  ctx.arc(photoCX, photoCY, photoSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a0aab8";
  ctx.font = "bold 72px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`${firstName[0] || ""}${lastName[0] || ""}`, photoCX, photoCY);
  ctx.textBaseline = "alphabetic";

  // Name
  ctx.fillStyle = "#1a1a2e";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(`${firstName} ${lastName}`, W / 2, photoCY + photoSize / 2 + 50);

  // Role pill
  const roleY = photoCY + photoSize / 2 + 72;
  ctx.font = "bold 15px sans-serif";
  const roleW = ctx.measureText(role).width + 36;
  ctx.fillStyle = bc + "20";
  roundRect((W - roleW) / 2, roleY, roleW, 30, 15);
  ctx.strokeStyle = bc;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect((W - roleW) / 2, roleY, roleW, 30, 15);
  ctx.stroke();
  ctx.fillStyle = bc;
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(role, W / 2, roleY + 20);

  // Divider
  const divY = roleY + 52;
  ctx.strokeStyle = "#e0e4ea";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, divY);
  ctx.lineTo(W - 80, divY);
  ctx.stroke();

  return new Promise<void>((resolve) => {
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = () => {
      const qrSize = 180;
      const qrX = (W - qrSize) / 2;
      const qrY = divY + 20;

      ctx.strokeStyle = "#e0e4ea";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 8);
      ctx.stroke();
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = "#9aa5b4";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(badge.badge_number ?? "", W / 2, qrY + qrSize + 28);
      ctx.fillStyle = "#b0b8c4";
      ctx.font = "10px sans-serif";
      ctx.fillText("SCAN TO CLOCK IN / OUT", W / 2, qrY + qrSize + 48);

      // Footer
      ctx.fillStyle = "#f5f6f8";
      roundRect(0, H - 48, W, 48, 0);
      ctx.fillStyle = bc;
      ctx.fillRect(0, H - 4, W, 4);
      ctx.fillStyle = "#9aa5b4";
      ctx.font = "9px sans-serif";
      ctx.fillText("OVERWATCH  \u00B7  " + companyName.toUpperCase(), W / 2, H - 20);

      // Avatar overlay
      const overlayAvatar = () => {
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
            ctx.strokeStyle = bc;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(photoCX, photoCY, photoSize / 2 + 4, 0, Math.PI * 2);
            ctx.stroke();
            overlayLogo();
          };
          img.onerror = () => { drawAccentRing(); overlayLogo(); };
          img.src = avatarUrl;
        } else {
          drawAccentRing();
          overlayLogo();
        }
      };

      const drawAccentRing = () => {
        ctx.strokeStyle = bc;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(photoCX, photoCY, photoSize / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
      };

      const overlayLogo = () => {
        if (companyLogo) {
          const li = new Image();
          li.crossOrigin = "anonymous";
          li.onload = () => {
            const s = 40;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(44, 55, s / 2 + 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.beginPath();
            ctx.arc(44, 55, s / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(li, 44 - s / 2, 55 - s / 2, s, s);
            ctx.restore();
            doDownload();
          };
          li.onerror = () => doDownload();
          li.src = companyLogo;
        } else {
          doDownload();
        }
      };

      const doDownload = () => {
        const link = document.createElement("a");
        link.download = `badge-${firstName}-${lastName}.png`.toLowerCase().replace(/\s+/g, "-");
        link.href = canvas.toDataURL("image/png");
        link.click();
        resolve();
      };

      overlayAvatar();
    };
    qrImg.onerror = () => resolve();
    qrImg.src = qrDataUrl;
  });
}
