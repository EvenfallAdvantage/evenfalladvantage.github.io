"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full-page centered loading spinner. Use as the default loading state
 * for pages and heavy sections instead of duplicating inline spinners.
 */
export function PageLoader({ className, text }: { className?: string; text?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 gap-3", className)} role="status" aria-live="polite">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
      <span className="sr-only">Loading{text ? `: ${text}` : ""}...</span>
      {text && <p className="text-xs text-muted-foreground">{text}</p>}
    </div>
  );
}

/**
 * Inline spinner for buttons, cells, and compact spaces.
 * Supports motion-reduce for accessibility.
 */
export function InlineSpinner({ className, size = "sm" }: { className?: string; size?: "xs" | "sm" | "md" }) {
  const sizeClass = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <Loader2 className={cn("animate-spin text-muted-foreground motion-reduce:animate-none", sizeClass, className)} />
  );
}
