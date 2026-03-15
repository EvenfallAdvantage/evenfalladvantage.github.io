import { Card, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function AdminSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HQ Config</h1>
          <p className="text-sm text-muted-foreground">Configure organization profile and operational settings</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="cursor-pointer transition-colors hover:border-primary/30">
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold">Company Profile</h3>
              <p className="mt-1 text-xs text-muted-foreground">Name, logo, branding colors, timezone</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-colors hover:border-primary/30">
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold">Roles & Permissions</h3>
              <p className="mt-1 text-xs text-muted-foreground">Manage role access levels</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-colors hover:border-primary/30">
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold">Integrations</h3>
              <p className="mt-1 text-xs text-muted-foreground">WhatsApp, QuickBooks, email settings</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-colors hover:border-primary/30">
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold">Audit Log</h3>
              <p className="mt-1 text-xs text-muted-foreground">Review all actions and changes</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
