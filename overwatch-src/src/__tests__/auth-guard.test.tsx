// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mocks ──────────────────────────────────────────────

// Track the last location.href assignment
let lastHref = "";

// Mock useAuthStore with a controllable selector pattern
let mockUser: unknown = null;
let mockIsLoading = true;

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector: (s: { user: unknown; isLoading: boolean }) => unknown) =>
    selector({ user: mockUser, isLoading: mockIsLoading }),
}));

// Mock supabase client so the auth listener effect doesn't explode
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

// ── Component under test ───────────────────────────────

import { AuthGuard } from "@/components/auth-guard";

// ── Tests ──────────────────────────────────────────────

describe("AuthGuard", () => {
  beforeEach(() => {
    mockUser = null;
    mockIsLoading = true;
    lastHref = "";

    // Spy on window.location.href assignment
    Object.defineProperty(window, "location", {
      value: {
        origin: "http://localhost:3000",
        get href() { return lastHref; },
        set href(url: string) { lastHref = url; },
      },
      writable: true,
      configurable: true,
    });
  });

  it("renders children when authenticated", () => {
    mockUser = { id: "u1", email: "test@test.com", companies: [] };
    mockIsLoading = false;

    render(
      <AuthGuard>
        <p>Dashboard</p>
      </AuthGuard>,
    );

    expect(screen.getByText("Dashboard")).toBeDefined();
  });

  it("shows loading spinner when auth is initializing", () => {
    mockUser = null;
    mockIsLoading = true;

    const { container } = render(
      <AuthGuard>
        <p>Dashboard</p>
      </AuthGuard>,
    );

    // Children should NOT be rendered
    expect(screen.queryByText("Dashboard")).toBeNull();

    // The spinner div should be present
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeDefined();
    expect(spinner).not.toBeNull();
  });

  it("redirects to landing when not authenticated and not loading", () => {
    mockUser = null;
    mockIsLoading = false;

    render(
      <AuthGuard>
        <p>Dashboard</p>
      </AuthGuard>,
    );

    // Should have triggered a hard redirect
    expect(lastHref).toBe("http://localhost:3000/overwatch/");
    // Children should NOT be rendered
    expect(screen.queryByText("Dashboard")).toBeNull();
  });

  it("does not render children while loading even if user is null", () => {
    mockUser = null;
    mockIsLoading = true;

    render(
      <AuthGuard>
        <p>Secret Content</p>
      </AuthGuard>,
    );

    expect(screen.queryByText("Secret Content")).toBeNull();
  });
});
