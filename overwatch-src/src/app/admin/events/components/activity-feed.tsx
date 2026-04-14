"use client";

import { useState, useCallback } from "react";
import {
  Flag, Loader2, Activity, ClipboardList, LogIn,
  LogOut as LogOutIcon, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getOperationActivity } from "@/lib/supabase/db";
import type { ActivityItem } from "@/lib/supabase/db-operations";

interface ActivityFeedProps {
  eventId: string;
  visible: boolean;
}

export function ActivityFeed({ eventId, visible }: ActivityFeedProps) {
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadActivity = useCallback(async () => {
    if (loaded) return;
    setLoadingActivity(true);
    try {
      setActivityItems(await getOperationActivity(eventId));
    } catch { setActivityItems([]); }
    finally { setLoadingActivity(false); setLoaded(true); }
  }, [eventId, loaded]);

  // Trigger load when becoming visible for the first time
  if (visible && !loaded && !loadingActivity) {
    loadActivity();
  }

  if (!visible) return null;

  return (
    <div className="px-3 sm:px-4 py-3 space-y-2 border-b border-border/20 bg-primary/[0.02]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3 w-3" /> Operation Activity
        </p>
        <span className="text-[10px] text-muted-foreground">{activityItems.length} event{activityItems.length !== 1 ? "s" : ""}</span>
      </div>
      {loadingActivity ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : activityItems.length === 0 ? (
        <div className="text-center py-6">
          <Activity className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
          <p className="text-xs text-muted-foreground/60">No activity recorded yet</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">Activity will appear here when guards clock in, file reports, or log incidents</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {activityItems.map((item) => {
            const iconMap = {
              clock_in: <LogIn className="h-3 w-3 text-green-500" />,
              clock_out: <LogOutIcon className="h-3 w-3 text-red-500" />,
              report: <ClipboardList className="h-3 w-3 text-blue-500" />,
              incident: <AlertTriangle className="h-3 w-3 text-amber-500" />,
              patrol: <Flag className="h-3 w-3 text-violet-500" />,
            };
            const colorMap = {
              clock_in: "border-green-500/20 bg-green-500/5",
              clock_out: "border-red-500/20 bg-red-500/5",
              report: "border-blue-500/20 bg-blue-500/5",
              incident: "border-amber-500/20 bg-amber-500/5",
              patrol: "border-violet-500/20 bg-violet-500/5",
            };
            return (
              <div key={item.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${colorMap[item.type]}`}>
                <div className="mt-0.5 shrink-0">{iconMap[item.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold truncate">{item.userName}</span>
                    <span className="text-[9px] text-muted-foreground/60">{item.detail}</span>
                  </div>
                  {item.meta?.severity && (
                    <Badge variant="secondary" className="text-[8px] h-4 mt-0.5 capitalize">{item.meta.severity}</Badge>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground/50 shrink-0 font-mono">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
