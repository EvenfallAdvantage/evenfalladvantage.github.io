// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";

// Simple component that mimics role-based rendering
function AdminPanel({ role }: { role: CompanyRole }) {
  if (!hasMinRole(role, "manager")) return <p>Access denied</p>;
  return (
    <div>
      <h1>Admin Panel</h1>
      <button>Delete</button>
    </div>
  );
}

describe("Role-based UI rendering", () => {
  it("shows admin panel for manager role", () => {
    render(<AdminPanel role="manager" />);
    expect(screen.getByText("Admin Panel")).toBeDefined();
    expect(screen.getByText("Delete")).toBeDefined();
  });

  it("shows admin panel for owner role", () => {
    render(<AdminPanel role="owner" />);
    expect(screen.getByText("Admin Panel")).toBeDefined();
  });

  it("denies access for staff role", () => {
    render(<AdminPanel role="staff" />);
    expect(screen.getByText("Access denied")).toBeDefined();
    expect(screen.queryByText("Admin Panel")).toBeNull();
  });

  it("denies access for breaker role", () => {
    render(<AdminPanel role="breaker" />);
    expect(screen.getByText("Access denied")).toBeDefined();
    expect(screen.queryByText("Delete")).toBeNull();
  });
});
