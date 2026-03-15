import { Package, QrCode, ArrowDownToLine, ArrowUpFromLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function AssetsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Armory</h1>
          <p className="text-sm text-muted-foreground">Equipment check-in/out and gear inventory</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Check Out", icon: ArrowUpFromLine, desc: "Scan asset → assign to staff" },
            { title: "Check In", icon: ArrowDownToLine, desc: "Scan asset → return to inventory" },
            { title: "Quick Scan", icon: QrCode, desc: "Scan any asset to see status" },
            { title: "Inventory", icon: Search, desc: "Browse all equipment" },
          ].map((item) => (
            <Card key={item.title} className="cursor-pointer transition-colors hover:border-primary/30 hover:bg-primary/5">
              <CardHeader className="pb-2">
                <item.icon className="h-8 w-8 text-primary" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-sm">{item.title}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No gear registered</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Add equipment to start tracking issue/return with QR codes.
          </p>
          <Button variant="outline" size="sm" className="mt-4">Add Gear</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
