"use client";

import { FileText, Calendar, Check, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientShell } from "@/components/layout/client-shell";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { getCompanyInvoices, type Invoice } from "@/lib/supabase/db";
import { PageLoader } from "@/components/page-loader";

export default function ClientInvoicesPage() {
  const { data: invoices = [], isLoading } = useCompanyQuery(
    "client-invoices", (cid) => getCompanyInvoices(cid)
  );

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-500/15 text-blue-600",
    viewed: "bg-violet-500/15 text-violet-600",
    paid: "bg-green-500/15 text-green-600",
    overdue: "bg-red-500/15 text-red-500",
    cancelled: "bg-muted text-muted-foreground",
  };

  const statusIcons: Record<string, typeof Check> = {
    paid: Check,
    overdue: Clock,
  };

  return (
    <ClientShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">Billing and payment history</p>
        </div>

        {isLoading ? <PageLoader /> : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No invoices yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Invoices will appear here once issued by your security provider.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv: Invoice) => {
              const StatusIcon = statusIcons[inv.status];
              return (
                <Card key={inv.id}>
                  <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm font-mono">{inv.invoiceNumber}</p>
                        <Badge className={`text-[9px] ${statusColors[inv.status] ?? ""} capitalize`}>
                          {StatusIcon && <StatusIcon className="h-2.5 w-2.5 mr-0.5" />}
                          {inv.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1">
                        {inv.eventName && <span>{inv.eventName}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </span>
                        {inv.dueDate && (
                          <span className={inv.status === "overdue" ? "text-red-500 font-medium" : ""}>
                            Due: {new Date(inv.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono">${inv.total.toFixed(2)}</p>
                      {inv.taxAmount > 0 && (
                        <p className="text-[10px] text-muted-foreground">Tax: ${inv.taxAmount.toFixed(2)}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ClientShell>
  );
}
