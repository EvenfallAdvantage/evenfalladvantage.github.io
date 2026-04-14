"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { updateMemberProfile } from "@/lib/supabase/db";
import type { MemberProfile } from "./types";

interface Props {
  mp: MemberProfile;
  onMpChange: (mp: MemberProfile) => void;
  activeCompanyId: string | null;
}

export function NotificationPreferencesCard({ mp, onMpChange, activeCompanyId }: Props) {
  if (!mp) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" /> Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <label className="flex items-center justify-between">
          <span className="text-xs">Mute all notifications</span>
          <button
            onClick={async () => {
              if (!activeCompanyId || activeCompanyId === "pending") return;
              const next = !mp.notifications_muted;
              try {
                await updateMemberProfile(activeCompanyId, { notificationsMuted: next });
                onMpChange({ ...mp, notifications_muted: next });
              } catch (err) { console.warn("Toggle mute failed:", err); }
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${mp.notifications_muted ? "bg-destructive" : "bg-muted"}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${mp.notifications_muted ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </label>
        <label className="flex items-center justify-between">
          <div>
            <span className="text-xs">Share location while on shift</span>
            <p className="text-[10px] text-muted-foreground">Your GPS position will be visible to your team on the tactical map when you&apos;re clocked in.</p>
          </div>
          <button
            onClick={async () => {
              if (!activeCompanyId || activeCompanyId === "pending") return;
              const next = !(mp.location_sharing ?? true);
              try {
                await updateMemberProfile(activeCompanyId, { locationSharing: next });
                onMpChange({ ...mp, location_sharing: next });
              } catch (err) { console.warn("Toggle location sharing failed:", err); }
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${(mp.location_sharing ?? true) ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${(mp.location_sharing ?? true) ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </label>
        <div>
          <span className="text-xs text-muted-foreground">Notification days</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
              const active = (mp.notification_days ?? []).includes(day);
              return (
                <button
                  key={day}
                  onClick={async () => {
                    if (!activeCompanyId || activeCompanyId === "pending") return;
                    const next = active
                      ? (mp.notification_days ?? []).filter((d: string) => d !== day)
                      : [...(mp.notification_days ?? []), day];
                    try {
                      await updateMemberProfile(activeCompanyId, { notificationDays: next });
                      onMpChange({ ...mp, notification_days: next });
                    } catch (err) { console.warn("Update notification days failed:", err); }
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">You&apos;ll only receive push/email notifications on selected days.</p>
        </div>
      </CardContent>
    </Card>
  );
}
