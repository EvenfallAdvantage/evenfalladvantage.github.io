"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  Car,
  Coffee,
  Compass,
  Layers,
  Smartphone,
  KeyRound,
  History,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore, useActiveCompany } from "@/stores/auth-store";
import {
  RELEASES,
  buildRollUpHighlights,
  filterReleaseHighlightsForRole,
  getUnseenReleases,
  markLatestReleaseSeen,
  readLastSeenReleaseId,
  shouldAutoOpenWhatsNew,
  type ReleaseHighlight,
} from "@/lib/releases";
import { cn } from "@/lib/utils";

const WHATS_NEW_OPEN_EVENT = "overwatch:open-whats-new";
const WHATS_NEW_SEEN_EVENT = "overwatch:whats-new-seen";

export function openWhatsNewModal(initialView: "rollup" | "changelog" = "changelog") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WHATS_NEW_OPEN_EVENT, { detail: { view: initialView } }),
  );
}

function useLastSeenReleaseId(userId: string | null): string | null {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(WHATS_NEW_SEEN_EVENT, onStoreChange);
    window.addEventListener("storage", onStoreChange);
    return () => {
      window.removeEventListener(WHATS_NEW_SEEN_EVENT, onStoreChange);
      window.removeEventListener("storage", onStoreChange);
    };
  }, []);
  const getSnapshot = useCallback(
    () => readLastSeenReleaseId(userId),
    [userId],
  );
  const getServerSnapshot = useCallback(() => null, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function renderHighlightIcon(iconName?: string) {
  switch (iconName) {
    case "Car":
      return <Car className="h-4 w-4 text-amber-500 shrink-0" />;
    case "Coffee":
      return <Coffee className="h-4 w-4 text-sky-500 shrink-0" />;
    case "Compass":
      return <Compass className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "Layers":
      return <Layers className="h-4 w-4 text-purple-500 shrink-0" />;
    case "Smartphone":
      return <Smartphone className="h-4 w-4 text-blue-500 shrink-0" />;
    case "KeyRound":
      return <KeyRound className="h-4 w-4 text-amber-500 shrink-0" />;
    default:
      return <Sparkles className="h-4 w-4 text-primary shrink-0" />;
  }
}

interface WhatsNewTriggerPillProps {
  collapsed?: boolean;
  variant?: "sidebar" | "topbar";
  className?: string;
}

/**
 * Subtle "What's New" trigger pill in the app chrome (sidebar & topbar) with a
 * pulsing indicator dot whenever any release (major or minor) is unseen.
 */
export function WhatsNewTriggerPill({
  collapsed = false,
  variant = "topbar",
  className,
}: WhatsNewTriggerPillProps) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeCompany = useActiveCompany();
  const userRole = activeCompany?.role ?? "staff";
  const lastSeenId = useLastSeenReleaseId(userId);

  const unseenCount = useMemo(() => {
    const unseen = getUnseenReleases(lastSeenId, RELEASES);
    return unseen.filter((r) => filterReleaseHighlightsForRole(r, userRole).length > 0).length;
  }, [lastSeenId, userRole]);

  const handleClick = () => {
    openWhatsNewModal(unseenCount > 0 ? "rollup" : "changelog");
  };

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={handleClick}
        data-testid="whats-new-sidebar-trigger"
        title="What's New in Overwatch"
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-foreground",
          collapsed && "justify-center px-2",
          className,
        )}
      >
        <span className="relative flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-amber-500" />
          {unseenCount > 0 && (
            <span
              data-testid="whats-new-unread-dot"
              className="absolute -top-0.5 -right-0.5 flex h-2 w-2"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          )}
        </span>
        {!collapsed && (
          <>
            <span className="truncate flex-1 text-left">What&apos;s New</span>
            {unseenCount > 0 ? (
              <Badge
                variant="outline"
                className="h-4 px-1.5 text-[9px] border-amber-500/40 bg-amber-500/10 text-amber-500"
              >
                {unseenCount} new
              </Badge>
            ) : (
              <span className="text-[10px] font-mono text-muted-foreground/70">
                {RELEASES[0]?.version}
              </span>
            )}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="whats-new-topbar-trigger"
      title="What's New in Overwatch"
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 hover:bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors",
        unseenCount > 0 && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="hidden sm:inline">What&apos;s New</span>
      {unseenCount > 0 && (
        <span
          data-testid="whats-new-unread-dot"
          className="relative flex h-2 w-2"
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
      )}
    </button>
  );
}

/**
 * Single Roll-Up Modal + Full Changelog Dialog.
 * - Auto-opens at most ONCE when there is >= 1 unseen major release and the user is not on /timeclock or /scan.
 * - Rolls up at most 4 role-relevant highlights across all missed releases (never stacks multiple popups).
 */
export function WhatsNewModal() {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeCompany = useActiveCompany();
  const userRole = activeCompany?.role ?? "staff";

  const [manualOpen, setManualOpen] = useState(false);
  const [view, setView] = useState<"rollup" | "changelog">("rollup");
  const lastSeenId = useLastSeenReleaseId(userId);

  const autoOpen = useMemo(
    () =>
      shouldAutoOpenWhatsNew({
        lastSeenId,
        pathname,
        userRole,
        releases: RELEASES,
      }),
    [lastSeenId, pathname, userRole],
  );

  const open = manualOpen || autoOpen;

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ view?: "rollup" | "changelog" }>;
      const currentSeen = readLastSeenReleaseId(userId);
      const unseen = getUnseenReleases(currentSeen, RELEASES);
      setView(
        custom.detail?.view ?? (unseen.length > 0 ? "rollup" : "changelog"),
      );
      setManualOpen(true);
    };
    window.addEventListener(WHATS_NEW_OPEN_EVENT, handler);
    return () => window.removeEventListener(WHATS_NEW_OPEN_EVENT, handler);
  }, [userId]);

  const markSeenAndClose = useCallback(() => {
    markLatestReleaseSeen(userId, RELEASES);
    setManualOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(WHATS_NEW_SEEN_EVENT));
    }
  }, [userId]);

  const handleTryIt = useCallback(
    (highlight: ReleaseHighlight) => {
      markLatestReleaseSeen(userId, RELEASES);
      setManualOpen(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(WHATS_NEW_SEEN_EVENT));
      }
      if (highlight.tryHref) {
        router.push(highlight.tryHref);
      }
    },
    [userId, router],
  );

  const rollUp = useMemo(() => {
    const effectiveLastSeen =
      getUnseenReleases(lastSeenId, RELEASES).length > 0 ? lastSeenId : null;
    return buildRollUpHighlights({
      lastSeenId: effectiveLastSeen,
      userRole,
      maxHighlights: 4,
      releases: RELEASES,
    });
  }, [lastSeenId, userRole]);

  if (!open) return null;

  return (
    <div
      data-testid="whats-new-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={markSeenAndClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent px-5 py-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30">
                <Sparkles className="h-4 w-4 text-amber-500" />
              </span>
              <h2 className="text-base font-bold tracking-tight">
                What&apos;s New in Overwatch
              </h2>
              <Badge
                variant="outline"
                data-testid="whats-new-badge"
                className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                {rollUp.badgeLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {view === "rollup"
                ? "Top highlights tailored to your role — rolled up so you never get stacked popups."
                : "Complete release history tailored to your role."}
            </p>
          </div>
          <button
            type="button"
            onClick={markSeenAndClose}
            aria-label="Close What's New"
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {view === "rollup" ? (
            <div data-testid="whats-new-rollup-list" className="space-y-2.5">
              {rollUp.highlights.map((h) => (
                <div
                  key={`${h.releaseId}-${h.id}`}
                  data-testid={`whats-new-highlight-${h.id}`}
                  className="rounded-xl border border-border/60 bg-muted/25 p-3.5 transition-colors hover:border-border"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/60">
                      {renderHighlightIcon(h.icon)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold leading-snug">
                          {h.title}
                        </h3>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {h.releaseVersion}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {h.summary}
                      </p>
                      {h.tryHref && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => handleTryIt(h)}
                            data-testid={`whats-new-try-${h.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 transition-colors"
                          >
                            {h.tryLabel ?? "Try it"}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div data-testid="whats-new-changelog-list" className="space-y-4">
              {RELEASES.map((release) => {
                const items = filterReleaseHighlightsForRole(release, userRole);
                if (items.length === 0) return null;
                return (
                  <div
                    key={release.id}
                    className="rounded-xl border border-border/60 bg-muted/15 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/40 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-primary">
                            {release.version}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {release.date}
                          </span>
                          {release.tier === "major" && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 border-amber-500/40 text-amber-500"
                            >
                              Major
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold mt-0.5">
                          {release.title}
                        </h3>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {items.map((h) => (
                        <div key={h.id} className="flex items-start gap-2.5 text-xs">
                          <div className="mt-0.5 shrink-0">
                            {renderHighlightIcon(h.icon)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-foreground">
                              {h.title}:{" "}
                            </span>
                            <span className="text-muted-foreground">
                              {h.summary}
                            </span>
                            {h.tryHref && (
                              <button
                                type="button"
                                onClick={() => handleTryIt(h)}
                                className="ml-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 underline hover:opacity-80"
                              >
                                {h.tryLabel ?? "Try it"} →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="whats-new-toggle-changelog"
            onClick={() => setView((v) => (v === "rollup" ? "changelog" : "rollup"))}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" />
            {view === "rollup" ? "See full changelog" : "Back to highlights"}
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid="whats-new-got-it"
            onClick={markSeenAndClose}
            className="gap-1.5 px-4"
          >
            <Check className="h-3.5 w-3.5" />
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
