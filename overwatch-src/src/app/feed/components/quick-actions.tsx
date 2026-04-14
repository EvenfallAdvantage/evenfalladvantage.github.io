"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { QUICK_ACTIONS } from "./shared";

export function QuickActions() {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
        Quick Actions
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="group cursor-pointer border-border/40 transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="flex flex-col items-center gap-2 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.bg} transition-transform group-hover:scale-110`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                  {action.title}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
