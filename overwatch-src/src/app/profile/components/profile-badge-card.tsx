"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Loader2 } from "lucide-react";
import { getMyBadge, type StaffBadge } from "@/lib/supabase/db-badges";
import { downloadBadgeCard } from "@/components/badge-download";
import { toast } from "sonner";
import QRCode from "qrcode";

interface ProfileBadgeCardProps {
  activeCompanyId: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  companyName: string;
  companyLogo: string | null;
  brandColor: string;
}

export function ProfileBadgeCard({
  activeCompanyId,
  userId,
  firstName,
  lastName,
  avatarUrl,
  companyName,
  companyLogo,
  brandColor,
}: ProfileBadgeCardProps) {
  const [badge, setBadge] = useState<StaffBadge | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const loadBadge = useCallback(async () => {
    if (!activeCompanyId || !userId) return;
    try {
      const b = await getMyBadge(activeCompanyId, userId);
      setBadge(b);
      if (b) {
        const qrUrl = await QRCode.toDataURL(b.qr_data, {
          width: 280,
          margin: 1,
          color: { dark: "#1a1a2e", light: "#ffffff" },
        });
        setQrPreview(qrUrl);
      }
    } catch {
      // No badge — that's fine
    }
    setLoading(false);
  }, [activeCompanyId, userId]);

  useEffect(() => { void loadBadge(); }, [loadBadge]); // eslint-disable-line -- async data-loading pattern

  if (loading) return null;
  if (!badge) return null;

  async function handleDownload() {
    if (!badge || !qrPreview) return;
    setDownloading(true);
    try {
      const member = {
        users: {
          first_name: firstName,
          last_name: lastName,
          avatar_url: avatarUrl,
        },
      };
      await downloadBadgeCard(member, badge, qrPreview, companyName, companyLogo, brandColor);
      toast.success("Badge downloaded");
    } catch {
      toast.error("Failed to download badge");
    }
    setDownloading(false);
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <QrCode className="h-4 w-4 text-primary" />
          Staff Badge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Badge preview */}
        <div className="flex flex-col items-center gap-2 rounded-lg bg-white p-4">
          {qrPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrPreview}
              alt="Badge QR code"
              className="h-28 w-28"
            />
          )}
          <p className="text-xs font-mono text-zinc-500">{badge.badge_number}</p>
          <p className="text-[10px] text-zinc-400">Scan to clock in / out</p>
        </div>

        {/* Download button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-2 h-3.5 w-3.5" />
          )}
          Download Badge
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          Generated {new Date(badge.generated_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}
