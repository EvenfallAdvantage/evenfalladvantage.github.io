"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyMembers } from "@/lib/supabase/db";
import { getOrCreateBadge, type StaffBadge } from "@/lib/supabase/db-badges";
import QRCode from "qrcode";

interface BadgeGeneratorProps {
  companyId: string;
  companyName: string;
  companyLogo: string | null;
  brandColor: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

export function BadgeGenerator({ companyId, companyName, companyLogo, brandColor }: BadgeGeneratorProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [badges, setBadges] = useState<Record<string, StaffBadge>>({});
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await getCompanyMembers(companyId);
      setMembers(data as Member[]);
    } catch {}
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function generateBadge(member: Member) {
    const userId = member.user_id || member.users?.id;
    if (!userId) return;
    setGenerating(userId);

    try {
      const badge = await getOrCreateBadge(companyId, userId);
      setBadges((prev) => ({ ...prev, [userId]: badge }));

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(badge.qr_data, {
        width: 200,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      setQrImages((prev) => ({ ...prev, [userId]: qrDataUrl }));
    } catch (err) {
      console.error("Badge generation failed:", err);
    }
    setGenerating(null);
  }

  async function generateAll() {
    setGenerating("all");
    for (const member of members) {
      await generateBadge(member);
    }
    setGenerating(null);
  }

  function downloadBadge(member: Member) {
    const userId = member.user_id || member.users?.id;
    const badge = badges[userId];
    const qr = qrImages[userId];
    if (!badge || !qr) return;

    const canvas = document.createElement("canvas");
    // Portrait badge: 2.125" × 3.375" at 300 DPI
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

    // Helper: draw rounded rect
    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    }

    // ── Background ──
    ctx.fillStyle = "#0c1524";
    ctx.fillRect(0, 0, W, H);

    // ── Top accent bar ──
    ctx.fillStyle = bc;
    ctx.fillRect(0, 0, W, 12);

    // ── Header: "ACCESS BADGE" label ──
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(0, 12, W, 60, 0);
    ctx.fillStyle = bc;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.letterSpacing = "4px";
    ctx.fillText("ACCESS BADGE", W / 2, 50);
    ctx.letterSpacing = "0px";

    // ── Company name ──
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(companyName, W / 2, 115);

    // ── Horizontal divider ──
    ctx.strokeStyle = bc;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 135);
    ctx.lineTo(W - 60, 135);
    ctx.stroke();

    // ── Profile photo area ──
    const photoSize = 180;
    const photoX = (W - photoSize) / 2;
    const photoY = 160;

    // Photo border ring
    ctx.strokeStyle = bc;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2 + 6, 0, Math.PI * 2);
    ctx.stroke();

    // Photo placeholder circle (dark)
    ctx.fillStyle = "#1a2640";
    ctx.beginPath();
    ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Initials as fallback
    ctx.fillStyle = "#4a5a7a";
    ctx.font = "bold 72px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${firstName[0] || ""}${lastName[0] || ""}`, photoX + photoSize / 2, photoY + photoSize / 2);
    ctx.textBaseline = "alphabetic";

    // ── Staff name ──
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${firstName} ${lastName}`, W / 2, photoY + photoSize + 50);

    // ── Role badge ──
    const roleY = photoY + photoSize + 70;
    ctx.font = "bold 16px sans-serif";
    const roleWidth = ctx.measureText(role).width + 32;
    ctx.fillStyle = bc + "33";
    roundRect((W - roleWidth) / 2, roleY, roleWidth, 28, 14);
    ctx.fillStyle = bc;
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(role, W / 2, roleY + 19);

    // ── Badge number ──
    ctx.fillStyle = "#4a5a7a";
    ctx.font = "13px monospace";
    ctx.fillText(badge.badge_number ?? "", W / 2, roleY + 58);

    // ── QR Code ──
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = () => {
      const qrSize = 200;
      const qrX = (W - qrSize) / 2;
      const qrY = roleY + 80;

      // QR white background
      ctx.fillStyle = "#ffffff";
      const pad = 10;
      roundRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, 8);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Scan text
      ctx.fillStyle = "#4a5a7a";
      ctx.font = "12px sans-serif";
      ctx.fillText("SCAN TO CLOCK IN / OUT", W / 2, qrY + qrSize + 30);

      // ── Bottom bar ──
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      roundRect(0, H - 50, W, 50, 0);
      ctx.fillStyle = bc;
      ctx.fillRect(0, H - 4, W, 4);
      ctx.fillStyle = "#3a4a6a";
      ctx.font = "10px sans-serif";
      ctx.fillText("OVERWATCH PLATFORM  ·  " + companyName.toUpperCase(), W / 2, H - 20);

      // ── Now overlay the actual avatar photo if available ──
      if (avatarUrl) {
        const avatarImg = new Image();
        avatarImg.crossOrigin = "anonymous";
        avatarImg.onload = () => {
          // Clip to circle and draw avatar
          ctx.save();
          ctx.beginPath();
          ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatarImg, photoX, photoY, photoSize, photoSize);
          ctx.restore();

          // Re-draw the border ring on top
          ctx.strokeStyle = bc;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2 + 2, 0, Math.PI * 2);
          ctx.stroke();

          triggerDownload();
        };
        avatarImg.onerror = () => triggerDownload(); // Fallback to initials
        avatarImg.src = avatarUrl;
      } else {
        triggerDownload();
      }

      function triggerDownload() {
        // Overlay company logo if available
        if (companyLogo) {
          const logoImg = new Image();
          logoImg.crossOrigin = "anonymous";
          logoImg.onload = () => {
            const logoSize = 36;
            ctx.drawImage(logoImg, 20, 20, logoSize, logoSize);
            doDownload();
          };
          logoImg.onerror = () => doDownload();
          logoImg.src = companyLogo;
        } else {
          doDownload();
        }
      }

      function doDownload() {
        const link = document.createElement("a");
        link.download = `badge-${firstName}-${lastName}.png`.toLowerCase().replace(/\s+/g, "-");
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    };
    qrImg.src = qr;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Staff Badges</h3>
          <p className="text-xs text-muted-foreground">Generate QR-coded ID badges for clock-in scanning</p>
        </div>
        <Button size="sm" onClick={generateAll} disabled={generating === "all"}>
          {generating === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Generate All
        </Button>
      </div>

      <div className="grid gap-3">
        {members.map((member: Member) => {
          const userId = member.user_id || member.users?.id;
          const firstName = member.users?.first_name ?? "";
          const lastName = member.users?.last_name ?? "";
          const badge = badges[userId];
          const qr = qrImages[userId];
          const isGenerating = generating === userId || generating === "all";

          return (
            <div key={userId} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card/50">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={member.users?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{firstName[0]}{lastName[0]}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{firstName} {lastName}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{member.role}</p>
                {badge && (
                  <p className="text-[10px] text-muted-foreground/60 font-mono">{badge.badge_number}</p>
                )}
              </div>

              {qr && (
                <img src={qr} alt="QR" className="h-12 w-12 rounded border border-border/30" />
              )}

              <div className="flex gap-1.5 shrink-0">
                {!badge ? (
                  <Button size="sm" variant="outline" onClick={() => generateBadge(member)} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => downloadBadge(member)}>
                    <Download className="h-3 w-3 mr-1" /> Badge
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
