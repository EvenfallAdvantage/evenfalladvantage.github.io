import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/60",
        className
      )}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/50 bg-card p-4 space-y-3", className)}>
      <Bone className="h-4 w-1/3" />
      <Bone className="h-8 w-2/3" />
      <Bone className="h-3 w-1/2" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-7 w-48" />
          <Bone className="h-4 w-64" />
        </div>
        <Bone className="h-9 w-32 rounded-lg" />
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Content area */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Bone className="h-5 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
              <Bone className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-1/2" />
              </div>
              <Bone className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <Bone className="h-5 w-24" />
          <CardSkeleton className="h-48" />
          <CardSkeleton className="h-32" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-7 w-40" />
          <Bone className="h-4 w-56" />
        </div>
        <Bone className="h-9 w-28 rounded-lg" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Bone className="h-9 w-64 rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>

      {/* List items */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
            <Bone className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Bone className="h-4 w-2/3" />
              <Bone className="h-3 w-1/3" />
            </div>
            <Bone className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-32" />
        <Bone className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Channel list */}
        <div className="space-y-2 rounded-xl border border-border/50 bg-card p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2">
              <Bone className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3.5 w-3/4" />
                <Bone className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        {/* Messages */}
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4 min-h-[400px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "" : "flex-row-reverse")}>
              <Bone className="h-8 w-8 rounded-full shrink-0" />
              <div className={cn("space-y-1.5 max-w-[60%]", i % 2 === 0 ? "" : "items-end")}>
                <Bone className="h-3 w-20" />
                <Bone className="h-16 w-48 rounded-xl" />
              </div>
            </div>
          ))}
          <div className="mt-auto pt-4 border-t border-border/50">
            <Bone className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
