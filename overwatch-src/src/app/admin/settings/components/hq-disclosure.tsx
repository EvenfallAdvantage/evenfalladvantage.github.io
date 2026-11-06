"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface HqDisclosureProps {
  title: string;
  description?: string;
  /** Decorative icon. Hidden from assistive tech; the title carries the name. */
  icon?: ReactNode;
  /** Badge or count shown on the trigger, beside the title. */
  meta?: ReactNode;
  /** Initial open state. Ignored after the first render. */
  defaultOpen?: boolean;
  /**
   * Open the panel when this becomes true (saved data arrived, or the user
   * switched into a mode that needs the fields). Stays open until they collapse it.
   */
  openWhen?: boolean;
  /**
   * An in-progress edit. The panel stays open so the save control is not covered,
   * and the trigger does not collapse it.
   */
  forceOpen?: boolean;
  /** card: same surface as the other HQ cards. nested: a row inside a card. */
  variant?: "card" | "nested";
  testId?: string;
  /**
   * Hash target on the always-visible frame. Field ids stay inside the panel;
   * a hash that points at one of them opens this frame instead of a hidden input.
   */
  id?: string;
  /**
   * Controlled open state. Omit it and the disclosure remembers its own.
   * forceOpen still keeps a dirty panel open.
   */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  children: ReactNode;
}

/**
 * Secondary / advanced HQ block. Children stay mounted while collapsed
 * (`hidden`, not `{open && children}`) so a draft survives. The trigger is a
 * real button inside a heading (Enter and Space). Open state is not written
 * to localStorage.
 */
export function HqDisclosure({
  title,
  description,
  icon,
  meta,
  defaultOpen = false,
  openWhen = false,
  forceOpen = false,
  variant = "nested",
  testId,
  id: anchorId,
  open: openProp,
  onOpenChange,
  children,
}: HqDisclosureProps) {
  const uid = useId();
  const panelId = `hq-disclosure-${uid}`;
  const buttonId = `${panelId}-trigger`;
  const frameRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const controlled = openProp !== undefined;
  const [open, setOpen] = useState(defaultOpen || forceOpen || openWhen);
  const [seen, setSeen] = useState({ forceOpen, openWhen });
  if (forceOpen !== seen.forceOpen || openWhen !== seen.openWhen) {
    const shouldOpen = (forceOpen && !seen.forceOpen) || (openWhen && !seen.openWhen);
    setSeen({ forceOpen, openWhen });
    if (shouldOpen) setOpen(true);
  }

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    const sync = () => {
      const raw = window.location.hash.replace(/^#/, "");
      if (!raw) return;
      let hash = raw;
      try { hash = decodeURIComponent(raw); } catch { /* keep the raw hash */ }
      const el = document.getElementById(hash);
      const targetsFrame = !!anchorId && hash === anchorId;
      const targetsInside = !!el && el !== frameRef.current && !!panelRef.current?.contains(el);
      if (!targetsFrame && !targetsInside) return;
      setOpen(true);
      onOpenChangeRef.current?.(true);
      frameRef.current?.scrollIntoView?.({ block: "nearest" });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [anchorId]);

  const expanded = forceOpen || (controlled ? openProp : open);
  const frame = variant === "card"
    ? "rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10"
    : "rounded-lg border border-border/40";
  const Heading = variant === "card" ? "h3" : "h4";

  function setExpanded(next: boolean) {
    if (!controlled) setOpen(next);
    onOpenChangeRef.current?.(next);
  }

  return (
    <div
      ref={frameRef}
      id={anchorId}
      className={`${frame}${anchorId ? " scroll-mt-28" : ""}`}
      data-testid={testId}
      data-hq-disclosure={expanded ? "open" : "closed"}
    >
      <Heading className="text-sm font-semibold">
        <button
          id={buttonId}
          type="button"
          className="flex min-h-11 w-full items-center gap-3 rounded-[inherit] px-4 py-3 text-left transition-colors hover:bg-muted/30 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => { if (!forceOpen) setExpanded(!expanded); }}
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              {icon && <span aria-hidden className="text-foreground">{icon}</span>}
              <span className="text-sm font-semibold text-foreground">{title}</span>
              {meta}
            </span>
            {description && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{description}</span>}
            {forceOpen && (
              <span className="mt-1 block text-xs font-medium text-amber-500">Unsaved changes stay open until you save or clear them.</span>
            )}
          </span>
          <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </Heading>
      <div
        ref={panelRef}
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!expanded}
        aria-hidden={expanded ? undefined : true}
        className={expanded ? "space-y-3 border-t border-border/30 px-4 py-3" : undefined}
      >
        {children}
      </div>
    </div>
  );
}
