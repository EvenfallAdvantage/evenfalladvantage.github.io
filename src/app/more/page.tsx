"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Radar,
  QrCode,
  ClipboardList,
  GraduationCap,
  CalendarOff,
  Users,
  MapPin,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

type MoreItem = { title: string; href: string; icon: LucideIcon };

const FIELD_OPS: MoreItem[] = [
  { title: "Briefing", href: "/updates", icon: Radar },
  { title: "Roster", href: "/directory", icon: Users },
  { title: "Armory", href: "/assets", icon: QrCode },
  { title: "Field Reports", href: "/forms", icon: ClipboardList },
  { title: "Leave", href: "/time-off", icon: CalendarOff },
  { title: "Training", href: "/training", icon: GraduationCap },
];

const COMMAND: MoreItem[] = [
  { title: "Operations", href: "/admin/events", icon: MapPin },
  { title: "Intel", href: "/admin/reports", icon: BarChart3 },
  { title: "Settings", href: "/settings", icon: Settings },
];

function NavGroup({ label, items }: { label: string; items: MoreItem[] }) {
  return (
    <div>
      <h3 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </h3>
      <div className="space-y-0.5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <item.icon className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="flex-1">{item.title}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function MorePage() {
  const router = useRouter();
  const { user, clearSession } = useAuthStore();
  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* User card */}
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:bg-accent"
        >
          <Avatar className="h-12 w-12">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-primary/20 font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold">
              {user?.firstName ?? "Your"} {user?.lastName ?? "Name"}
            </p>
            <p className="text-xs text-muted-foreground">View profile</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <NavGroup label="Field Ops" items={FIELD_OPS} />
        <NavGroup label="Command" items={COMMAND} />

        {/* Settings & Sign out */}
        <div className="space-y-0.5">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Settings className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="flex-1">Settings</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign Out
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
