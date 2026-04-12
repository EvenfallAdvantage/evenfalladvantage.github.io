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
    // Standard ID card: 3.375" × 2.125" at 300 DPI
    const W = 1013;
    const H = 638;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#0f1a2e";
    ctx.fillRect(0, 0, W, H);

    // Brand accent stripe
    ctx.fillStyle = brandColor || "#d59b3c";
    ctx.fillRect(0, 0, W, 8);
    ctx.fillRect(0, H - 8, W, 8);

    // Company name
    ctx.fillStyle = brandColor || "#d59b3c";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(companyName, W / 2, 60);

    // Staff name
    const firstName = member.users?.first_name ?? "";
    const lastName = member.users?.last_name ?? "";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(`${firstName} ${lastName}`, W / 2, 130);

    // Role
    ctx.fillStyle = "#8899aa";
    ctx.font = "24px sans-serif";
    ctx.fillText((member.role ?? "staff").toUpperCase(), W / 2, 170);

    // Badge number
    ctx.fillStyle = "#556677";
    ctx.font = "16px monospace";
    ctx.fillText(`Badge: ${badge.badge_number}`, W / 2, 210);

    // QR code
    const qrImg = new Image();
    qrImg.onload = () => {
      const qrSize = 280;
      const qrX = (W - qrSize) / 2;
      const qrY = 240;

      // White background for QR
      ctx.fillStyle = "#ffffff";
      const pad = 12;
      ctx.beginPath();
      ctx.roundRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, 8);
      ctx.fill();

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Scan instruction
      ctx.fillStyle = "#556677";
      ctx.font = "14px sans-serif";
      ctx.fillText("Scan to Clock In / Out", W / 2, qrY + qrSize + 35);

      // Footer
      ctx.fillStyle = "#334455";
      ctx.font = "12px sans-serif";
      ctx.fillText("OVERWATCH PLATFORM", W / 2, H - 25);

      // Download
      const link = document.createElement("a");
      link.download = `badge-${firstName}-${lastName}.png`.toLowerCase().replace(/\s+/g, "-");
      link.href = canvas.toDataURL("image/png");
      link.click();
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
