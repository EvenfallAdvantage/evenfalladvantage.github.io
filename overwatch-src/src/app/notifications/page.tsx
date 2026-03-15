"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck, Loader2, Info, AlertTriangle, Megaphone, Calendar, ClipboardList, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/supabase/db";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Notif = any;

const TYPE_ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  info: { icon: Info, color: "text-blue-500" },
  alert: { icon: AlertTriangle, color: "text-amber-500" },
  announcement: { icon: Megaphone, color: "text-violet-500" },
  event: { icon: Calendar, color: "text-green-500" },
  form: { icon: ClipboardList, color: "text-indigo-500" },
  certification: { icon: ShieldCheck, color: "text-emerald-500" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setNotifications(await getNotifications(activeCompanyId)); }
    catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n: Notif) => n.id === id ? { ...n, read: true } : n));
    } catch {}
  }

  async function handleMarkAll() {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(activeCompanyId);
      setNotifications((prev) => prev.map((n: Notif) => ({ ...n, read: true })));
    } catch {}
    finally { setMarkingAll(false); }
  }

  const unreadCount = notifications.filter((n: Notif) => !n.read).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><Bell className="h-6 w-6" /> NOTIFICATIONS</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleMarkAll} disabled={markingAll}>
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Bell className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No notifications</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              You&apos;ll be notified about important updates, events, and assignments here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: Notif) => {
              const typeInfo = TYPE_ICONS[n.type] ?? TYPE_ICONS.info;
              const Icon = typeInfo.icon;
              const inner = (
                <div
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors cursor-pointer ${
                    n.read
                      ? "border-border/30 bg-card/50 opacity-60"
                      : "border-border/50 bg-card hover:bg-accent/30"
                  }`}
                  onClick={() => !n.read && handleMarkRead(n.id)}
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.read ? "bg-muted" : "bg-primary/10"}`}>
                    <Icon className={`h-4 w-4 ${n.read ? "text-muted-foreground" : typeInfo.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${n.read ? "font-normal" : "font-semibold"}`}>{n.title}</p>
                      {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <Badge variant="secondary" className="text-[9px] shrink-0">New</Badge>
                  )}
                </div>
              );
              return n.action_url ? (
                <Link key={n.id} href={n.action_url} onClick={() => !n.read && handleMarkRead(n.id)}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
