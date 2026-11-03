"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Small centered empty state used inside dashboard cards. */
export function WidgetEmpty({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-5 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-xs font-medium">{title}</p>
      {hint && <p className="text-[11px] text-muted-foreground max-w-xs">{hint}</p>}
      {action}
    </div>
  );
}

/** Placeholder card while a dashboard widget loads. */
export function WidgetSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <Card className={`border-border/40 ${className}`} aria-busy="true" aria-label="Loading">
      <CardContent className="p-5 sm:p-6 space-y-3">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </CardContent>
    </Card>
  );
}
