"use client";

import { AlertTriangle } from "lucide-react";
import type { MemberProfile } from "./types";

interface Props {
  mp: MemberProfile;
}

export function GuardCardWarning({ mp }: Props) {
  const gcExpiry = mp?.guard_card_expiry ? new Date(mp.guard_card_expiry) : null;
  const gcDaysLeft = gcExpiry ? Math.ceil((gcExpiry.getTime() - Date.now()) / 86400000) : null;
  const gcExpired = gcDaysLeft !== null && gcDaysLeft < 0;
  const gcExpiringSoon = gcDaysLeft !== null && gcDaysLeft >= 0 && gcDaysLeft <= 30;

  if (!gcExpired && !gcExpiringSoon) return null;

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${gcExpired ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
      <AlertTriangle className={`h-5 w-5 shrink-0 ${gcExpired ? "text-red-500" : "text-amber-500"}`} />
      <div>
        <p className={`text-sm font-medium ${gcExpired ? "text-red-500" : "text-amber-600"}`}>
          {gcExpired ? "Guard Card Expired" : `Guard Card Expires in ${gcDaysLeft} Days`}
        </p>
        <p className="text-xs text-muted-foreground">
          {gcExpired ? "Your guard card has expired. Contact your admin to update." : "Renew your guard card before it expires."}
        </p>
      </div>
    </div>
  );
}
