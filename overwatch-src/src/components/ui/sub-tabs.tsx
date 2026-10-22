"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/stores/page-header-store";
import { MobilePageAction } from "@/components/mobile-page-action";

/**
 * Page sub-tab strip (Personnel, Schedule, Clock, Patrols, Training, ...).
 *
 * Layout-stable by construction:
 * - every tab always renders its icon (only the colour changes), so a click never
 *   changes any tab's width;
 * - on phones the page's header action sits at the right of this row (fixed slot)
 *   instead of in a row above it that appears/disappears per tab.
 */
export function SubTabList({ children, className, hostAction = true }: { children: ReactNode; className?: string; hostAction?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const add = usePageHeader((s) => s.addInlineActionHost);
  useEffect(() => {
    if (!hostAction) return;
    add(1);
    return () => add(-1);
  }, [add, hostAction]);
  useEffect(() => {
    // Scroll the strip itself, not scrollIntoView(): in Chrome scrollIntoView moves the
    // sequential-focus starting point, so the first Tab skipped the skip link + nav (WCAG 2.4.3).
    const strip = ref.current;
    const el = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (strip && el) {
      const l = el.offsetLeft, r = l + el.offsetWidth;
      if (l < strip.scrollLeft) strip.scrollLeft = l;
      else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth;
    }
  });
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div ref={ref} role="tablist" className="flex min-w-0 gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full scrollbar-hide">
        {children}
      </div>
      {hostAction && <div className="ml-auto sm:hidden"><MobilePageAction /></div>}
    </div>
  );
}

export function SubTab({ active, onClick, icon: Icon, children, className, disabled, title }: {
  active: boolean; onClick: () => void; icon?: ElementType;
  children: ReactNode; className?: string; disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button" role="tab" aria-selected={active} onClick={onClick} disabled={disabled} title={title}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50",
        className,
      )}
    >
      {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground/70")} />}
      {children}
    </button>
  );
}

/** A sub-tab that navigates to another route (same look; always renders its icon). */
export function SubTabLink({ active, href, icon: Icon, children }: { active: boolean; href: string; icon?: ElementType; children: ReactNode }) {
  const cls = cn(
    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0",
    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50",
  );
  const icon = Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground/70")} />;
  if (active) return <span role="tab" aria-selected="true" className={cls}>{icon}{children}</span>;
  return <Link role="tab" aria-selected="false" href={href} className={cls}>{icon}{children}</Link>;
}
