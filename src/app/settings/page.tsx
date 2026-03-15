"use client";

import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function SettingsPage() {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>

        <Card>
          <CardContent className="space-y-6 pt-6">
            {/* Notifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Notifications</Label>
                  <span className="ml-2 text-xs text-muted-foreground">Mute</span>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">On these days</span>
                <div className="flex gap-1">
                  {DAYS.map((d, i) => (
                    <button
                      key={i}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Language */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Language</Label>
              <span className="text-sm text-muted-foreground">English</span>
            </div>

            <div className="h-px bg-border" />

            {/* Profile picture */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Profile picture</Label>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
            </div>

            <div className="h-px bg-border" />

            {/* Company code */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Company code</Label>
              <span className="text-sm font-mono font-semibold">
                {activeCompany?.companyId?.slice(0, 6)?.toUpperCase() ?? "------"}
              </span>
            </div>

            <div className="h-px bg-border" />

            {/* Kiosk PIN */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Kiosk PIN code</Label>
              <span className="text-sm font-mono font-semibold">****</span>
            </div>

            <div className="h-px bg-border" />

            <div className="flex gap-4 text-xs text-muted-foreground">
              <button className="hover:text-foreground">Terms of use</button>
              <button className="hover:text-foreground">Privacy policy</button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
