// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/tasks/" }));
vi.mock("next/link", () => ({ default: ({ children, ...p }: { children: React.ReactNode }) => <a {...p}>{children}</a> }));

import { QuickActionFab } from "@/components/layout/quick-action-fab";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";

describe("QuickActionFab", () => {
  afterEach(() => { cleanup(); usePageHeader.getState().clearHeader(); });

  it("shows on pages without their own primary action", () => {
    useAuthStore.setState({ activeCompanyId: "c1" } as never);
    const { container } = render(<QuickActionFab />);
    expect(container.querySelector('[aria-label="Quick actions"]')).not.toBeNull();
  });

  it("hides when the page registers a header action (one orange CTA per screen)", () => {
    useAuthStore.setState({ activeCompanyId: "c1" } as never);
    usePageHeader.getState().setHeader("TASKS", "", null, <button>New Task</button>);
    const { container } = render(<QuickActionFab />);
    expect(container.querySelector('[aria-label="Quick actions"]')).toBeNull();
  });
});
