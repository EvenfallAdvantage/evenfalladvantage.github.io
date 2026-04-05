"use client";

import { usePageHeader } from "@/stores/page-header-store";

/**
 * Renders the page's action button(s) on mobile only.
 * Place this to the right of the subtab bar for inline mobile actions.
 * On desktop, actions render in the topbar instead.
 */
export function MobilePageAction() {
  const actions = usePageHeader((s) => s.actions);
  if (!actions) return null;
  return (
    <div className="sm:hidden shrink-0 [&_button]:h-8 [&_button]:text-xs">
      {actions}
    </div>
  );
}
