"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getCompanyMembers } from "@/lib/supabase/db";
import { getOrCreateBadge, getCompanyBadges, type StaffBadge } from "@/lib/supabase/db-badges";
import QRCode from "qrcode";
import { downloadBadgeCard } from "./badge-download";

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

  const load = useCallback(async () => {
    try {
      const [memberData, badgeData] = await Promise.all([
        getCompanyMembers(companyId),
        getCompanyBadges(companyId),
      ]);
      setMembers(memberData as Member[]);
      const badgeMap: Record<string, StaffBadge> = {};
      const qrMap: Record<string, string> = {};
      for (const b of badgeData) {
        badgeMap[b.user_id] = b;
        try {
          qrMap[b.user_id] = await QRCode.toDataURL(b.qr_data, {
            width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" }, errorCorrectionLevel: "H",
          });
        } catch {}
      }
      setBadges(badgeMap);
      setQrImages(qrMap);
    } catch {}
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [memberData, badgeData] = await Promise.all([
          getCompanyMembers(companyId),
          getCompanyBadges(companyId),
        ]);
        if (cancelled) return;
        setMembers(memberData as Member[]);
        const badgeMap: Record<string, StaffBadge> = {};
        const qrMap: Record<string, string> = {};
        for (const b of badgeData) {
          badgeMap[b.user_id] = b;
          try {
            qrMap[b.user_id] = await QRCode.toDataURL(b.qr_data, {
              width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" }, errorCorrectionLevel: "H",
            });
          } catch {}
        }
        if (!cancelled) {
          setBadges(badgeMap);
          setQrImages(qrMap);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  async function generateBadge(member: Member) {
    const userId = member.user_id || member.users?.id;
    if (!userId) return;
    setGenerating(userId);
    try {
      const badge = await getOrCreateBadge(companyId, userId);
      setBadges((prev) => ({ ...prev, [userId]: badge }));
      const qrDataUrl = await QRCode.toDataURL(badge.qr_data, {
        width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" }, errorCorrectionLevel: "H",
      });
      setQrImages((prev) => ({ ...prev, [userId]: qrDataUrl }));
    } catch (err) { console.error("Badge generation failed:", err); }
    setGenerating(null);
  }

  async function generateAll() {
    setGenerating("all");
    for (const member of members) { await generateBadge(member); }
    setGenerating(null);
  }

  async function handleDownload(member: Member) {
    const userId = member.user_id || member.users?.id;
    const badge = badges[userId];
    const qr = qrImages[userId];
    if (!badge || !qr) return;
    await downloadBadgeCard(member, badge, qr, companyName, companyLogo, brandColor);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
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
                {badge && <p className="text-[10px] text-muted-foreground/60 font-mono">{badge.badge_number}</p>}
              </div>
              {qr && <img src={qr} alt="QR" className="h-12 w-12 rounded border border-border/30" />}
              <div className="flex gap-1.5 shrink-0">
                {!badge ? (
                  <Button size="sm" variant="outline" onClick={() => generateBadge(member)} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleDownload(member)}>
                    <Download className="h-3 w-3 mr-1" /> Badge
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
