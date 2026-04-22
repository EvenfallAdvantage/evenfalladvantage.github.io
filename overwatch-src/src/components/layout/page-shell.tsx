"use client";

import type { ReactNode } from "react";
import { usePageHeader } from "@/stores/page-header-store";
import { useEffect } from "react";

/**
 * Page shell that sets the topbar header.
 *
 * Replaces the manual useEffect + setHeader + clearHeader pattern
 * that every page currently uses. This component handles the lifecycle automatically.
 *
 * Wrap your page content in PageShell with title, subtitle, icon, and actions props.
 * This is a transitional wrapper — pages can migrate incrementally.
 * The underlying store is still used so the topbar reads from it.
 */
interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, subtitle, icon, actions, children }: PageShellProps) {
  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader(title, subtitle ?? "", icon ?? null, actions ?? null);
    return clearHeader;
  }, [title, subtitle, icon, actions, setHeader, clearHeader]);

  return <>{children}</>;
}
