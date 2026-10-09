"use client";

import Link from "next/link";
import { Mail, MessageSquare, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = { provider: string; verified_at?: string | null; delivery_method?: string | null; vault_secret_id?: string | null };

function status(row: Row | undefined): { label: string; tone: "ok" | "warn" | "muted" } {
  if (!row) return { label: "Using Overwatch sender", tone: "muted" };
  if (row.verified_at) return { label: `Verified${row.delivery_method ? ` · ${row.delivery_method}` : ""}`, tone: "ok" };
  return { label: "Not verified", tone: "warn" };
}

/**
 * Links to the two Vault-backed delivery pages. The SMS page used to have no
 * link anywhere in the app.
 */
export default function DeliveryChannelsSection({ integrations }: { integrations: Row[] }) {
  const items = [
    { href: "/admin/settings/email", label: "Email sending", desc: "Your own SMTP or Resend for invitations, broadcasts and lead alerts", icon: Mail, row: integrations.find((i) => i.provider === "email") },
    { href: "/admin/settings/sms", label: "SMS sending", desc: "Your own Twilio number for alerts and replies to public reports", icon: MessageSquare, row: integrations.find((i) => i.provider === "sms") },
  ];
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <h3 className="text-sm font-semibold">Email &amp; SMS delivery</h3>
          <p className="text-xs text-muted-foreground">Until you verify your own provider, messages go out from the shared Overwatch sender.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map(({ href, label, desc, icon: Icon, row }) => {
            const s = status(row);
            return (
              <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/30">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{label}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${s.tone === "ok" ? "border-green-500/40 text-green-500" : s.tone === "warn" ? "border-amber-500/40 text-amber-500" : ""}`}
                    >
                      {s.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
