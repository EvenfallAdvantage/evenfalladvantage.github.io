"use client";

import { Shield, MapPin, AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { ClientShell } from "@/components/layout/client-shell";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { getEvents, getIncidents, getCompanyInvoices } from "@/lib/supabase/db";
import { PageLoader } from "@/components/page-loader";

export default function ClientDashboard() {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());

  const { data: events = [], isLoading: evLoading } = useCompanyQuery(
    "client-events", (cid) => getEvents(cid)
  );
  const { data: incidents = [], isLoading: incLoading } = useCompanyQuery(
    "client-incidents", (cid) => getIncidents(cid)
  );
  const { data: invoices = [], isLoading: invLoading } = useCompanyQuery(
    "client-invoices", (cid) => getCompanyInvoices(cid)
  );

  const loading = evLoading || incLoading || invLoading;
  const activeOps = events.filter((e: { status: string }) => e.status === "in_progress" || e.status === "published");
  const openIncidents = incidents.filter((i: { status: string }) => i.status !== "resolved" && i.status !== "closed");
  const unpaidInvoices = invoices.filter((i: { status: string }) => i.status !== "paid" && i.status !== "cancelled");

  const kpis = [
    { label: "Active Operations", value: activeOps.length, icon: MapPin, color: "text-green-500", bg: "bg-green-500/10", href: "/client/operations" },
    { label: "Open Incidents", value: openIncidents.length, icon: AlertTriangle, color: openIncidents.length > 0 ? "text-amber-500" : "text-muted-foreground", bg: openIncidents.length > 0 ? "bg-amber-500/10" : "bg-muted", href: "/client/incidents" },
    { label: "Pending Invoices", value: unpaidInvoices.length, icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10", href: "/client/invoices" },
    { label: "Total Operations", value: events.length, icon: Shield, color: "text-violet-500", bg: "bg-violet-500/10", href: "/client/operations" },
  ];

  return (
    <ClientShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold">Welcome, {activeCompany?.companyName ?? "Client"}</h1>
          <p className="text-sm text-muted-foreground">Your security operations overview</p>
        </div>

        {loading ? <PageLoader /> : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi) => (
                <Link key={kpi.label} href={kpi.href}>
                  <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                          <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                        </div>
                      </div>
                      <p className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{kpi.label}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Recent Operations */}
            {activeOps.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Operations</h2>
                {activeOps.slice(0, 5).map((op: { id: string; name: string; status: string; start_date: string; end_date: string }) => (
                  <Card key={op.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                        <MapPin className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{op.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(op.start_date).toLocaleDateString()} — {new Date(op.end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 capitalize">
                        {op.status.replace("_", " ")}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ClientShell>
  );
}
