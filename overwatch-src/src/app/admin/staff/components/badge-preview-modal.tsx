"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Download, Loader2, X, QrCode } from "lucide-react";
import { downloadBadgeCard } from "@/components/badge-download";
import { toast } from "sonner";
import type { StaffBadge } from "@/lib/supabase/db-badges";
import QRCode from "qrcode";

interface BadgePreviewModalProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  member: any;
  badge: StaffBadge;
  companyName: string;
  companyLogo: string | null;
  brandColor: string;
  onClose: () => void;
}

export function BadgePreviewModal({
  member,
  badge,
  companyName,
  companyLogo,
  brandColor,
  onClose,
}: BadgePreviewModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const u = member.users ?? member;
  const firstName = u.first_name ?? "";
  const lastName = u.last_name ?? "";
  const avatarUrl = u.avatar_url ?? null;
  const initials = (firstName[0] ?? "") + (lastName[0] ?? "");
  const bc = brandColor || "#d59b3c";

  useEffect(() => {
    QRCode.toDataURL(badge.qr_data, {
      width: 280,
      margin: 1,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [badge.qr_data]);

  async function handleDownload() {
    if (!qrDataUrl) return;
    setDownloading(true);
    try {
      await downloadBadgeCard(member, badge, qrDataUrl, companyName, companyLogo, bc);
      toast.success("Badge downloaded");
    } catch {
      toast.error("Failed to download badge");
    }
    setDownloading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Badge card preview */}
        <div className="p-6">
          <div className="rounded-lg overflow-hidden border border-zinc-800 bg-white">
            {/* Brand band */}
            <div className="py-3 px-4 text-center" style={{ backgroundColor: bc }}>
              <p className="text-white font-bold text-sm">{companyName}</p>
              <p className="text-white/60 text-[9px] tracking-[3px] mt-0.5">SECURITY &middot; ACCESS BADGE</p>
            </div>

            {/* Photo + name */}
            <div className="flex flex-col items-center pt-5 pb-3 px-4">
              <div className="rounded-full p-0.5" style={{ border: `3px solid ${bc}` }}>
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-zinc-100 text-xl font-bold text-zinc-400">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <p className="mt-3 text-lg font-bold text-zinc-900">{firstName} {lastName}</p>
              <p className="text-[10px] tracking-[2px] text-zinc-400 font-semibold">AGENT</p>
            </div>

            {/* Divider */}
            <div className="mx-8 border-t border-zinc-200" />

            {/* QR code */}
            <div className="flex flex-col items-center py-4 px-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Badge QR" className="h-36 w-36" />
              ) : (
                <div className="h-36 w-36 flex items-center justify-center">
                  <QrCode className="h-12 w-12 text-zinc-300 animate-pulse" />
                </div>
              )}
              <p className="mt-2 font-mono text-[11px] text-zinc-400">{badge.badge_number}</p>
              <p className="text-[9px] text-zinc-300 mt-0.5">SCAN TO CLOCK IN / OUT</p>
            </div>

            {/* Footer */}
            <div className="bg-zinc-50 py-2 text-center border-t border-zinc-100" style={{ borderBottom: `3px solid ${bc}` }}>
              <p className="text-[8px] text-zinc-400 tracking-wider">OVERWATCH &middot; {companyName.toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex items-center gap-3">
          <Button
            className="flex-1"
            onClick={handleDownload}
            disabled={downloading || !qrDataUrl}
          >
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download Badge
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <p className="px-6 pb-4 text-[10px] text-muted-foreground text-center">
          Generated {new Date(badge.generated_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
