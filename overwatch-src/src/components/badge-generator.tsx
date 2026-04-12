"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyMembers } from "@/lib/supabase/db";
import { getOrCreateBadge, getCompanyBadges, type StaffBadge } from "@/lib/supabase/db-badges";
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
      const [memberData, badgeData] = await Promise.all([
        getCompanyMembers(companyId),
        getCompanyBadges(companyId),
      ]);
      setMembers(memberData as Member[]);

      // Hydrate existing badges + generate QR images for them
      const badgeMap: Record<string, StaffBadge> = {};
      const qrMap: Record<string, string> = {};
      for (const b of badgeData) {
        badgeMap[b.user_id] = b;
        try {
          qrMap[b.user_id] = await QRCode.toDataURL(b.qr_data, {
            width: 200, margin: 1,
            color: { dark: "#000000", light: "#ffffff" },
            errorCorrectionLevel: "H",
          });
        } catch {}
      }
      setBadges(badgeMap);
      setQrImages(qrMap);
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
    // CR80 standard ID card portrait: 2.125" × 3.375" at 300 DPI
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

    // ── White background ──
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // ── Top band (brand color) ──
    ctx.fillStyle = bc;
    ctx.fillRect(0, 0, W, 110);

    // Company name in top band
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(companyName, W / 2, 55);

    // "SECURITY" or "ACCESS BADGE" subtitle
    ctx.font = "600 13px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.letterSpacing = "3px";
    ctx.fillText("SECURITY  ·  ACCESS BADGE", W / 2, 82);
    ctx.letterSpacing = "0px";

    // ── Profile photo ──
    const photoSize = 200;
    const photoCX = W / 2;
    const photoCY = 250;

    // White ring behind photo
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(photoCX, photoCY, photoSize / 2 + 8, 0, Math.PI * 2);
    ctx.fill();

    // Light gray placeholder
    ctx.fillStyle = "#e8ecf0";
    ctx.beginPath();
    ctx.arc(photoCX, photoCY, photoSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Initials fallback
    ctx.fillStyle = "#a0aab8";
    ctx.font = "bold 72px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${firstName[0] || ""}${lastName[0] || ""}`, photoCX, photoCY);
    ctx.textBaseline = "alphabetic";

    // ── Name ──
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(`${firstName} ${lastName}`, W / 2, photoCY + photoSize / 2 + 50);

    // ── Role pill ──
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

    // ── Thin divider ──
    const divY = roleY + 52;
    ctx.strokeStyle = "#e0e4ea";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, divY);
    ctx.lineTo(W - 80, divY);
    ctx.stroke();

    // ── QR Code ──
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = () => {
      const qrSize = 180;
      const qrX = (W - qrSize) / 2;
      const qrY = divY + 20;

      // Light border around QR
      ctx.strokeStyle = "#e0e4ea";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 8);
      ctx.stroke();

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Badge number under QR
      ctx.fillStyle = "#9aa5b4";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(badge.badge_number ?? "", W / 2, qrY + qrSize + 28);

      // Scan label
      ctx.fillStyle = "#b0b8c4";
      ctx.font = "10px sans-serif";
      ctx.fillText("SCAN TO CLOCK IN / OUT", W / 2, qrY + qrSize + 48);

      // ── Bottom bar ──
      ctx.fillStyle = "#f5f6f8";
      roundRect(0, H - 48, W, 48, 0);
      ctx.fillStyle = bc;
      ctx.fillRect(0, H - 4, W, 4);
      ctx.fillStyle = "#9aa5b4";
      ctx.font = "9px sans-serif";
      ctx.fillText("OVERWATCH  ·  " + companyName.toUpperCase(), W / 2, H - 20);

      // ── Overlay avatar photo ──
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
          // Accent ring
          ctx.strokeStyle = bc;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(photoCX, photoCY, photoSize / 2 + 4, 0, Math.PI * 2);
          ctx.stroke();
          finalize();
        };
        img.onerror = () => finalize();
        img.src = avatarUrl;
      } else {
        // Draw accent ring even without photo
        ctx.strokeStyle = bc;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(photoCX, photoCY, photoSize / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
        finalize();
      }

      function finalize() {
        // Company logo in top-left of the band
        if (companyLogo) {
          const li = new Image();
          li.crossOrigin = "anonymous";
          li.onload = () => {
            const s = 40;
            // White circle behind logo
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(44, 55, s / 2 + 4, 0, Math.PI * 2);
            ctx.fill();
            // Clip logo to circle
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
