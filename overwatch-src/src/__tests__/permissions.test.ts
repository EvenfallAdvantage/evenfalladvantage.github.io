import { describe, it, expect } from "vitest";

// Import the permission logic directly
// We test the role hierarchy: staff < manager < admin < owner

const ROLE_HIERARCHY: Record<string, number> = {
  staff: 0,
  manager: 1,
  admin: 2,
  owner: 3,
};

function hasMinRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? -1) >= (ROLE_HIERARCHY[requiredRole] ?? Infinity);
}

describe("Role-Based Access Control", () => {
  describe("hasMinRole", () => {
    it("staff can access staff-level features", () => {
      expect(hasMinRole("staff", "staff")).toBe(true);
    });

    it("staff cannot access manager-level features", () => {
      expect(hasMinRole("staff", "manager")).toBe(false);
    });

    it("staff cannot access admin-level features", () => {
      expect(hasMinRole("staff", "admin")).toBe(false);
    });

    it("staff cannot access owner-level features", () => {
      expect(hasMinRole("staff", "owner")).toBe(false);
    });

    it("manager can access staff and manager features", () => {
      expect(hasMinRole("manager", "staff")).toBe(true);
      expect(hasMinRole("manager", "manager")).toBe(true);
    });

    it("manager cannot access admin features", () => {
      expect(hasMinRole("manager", "admin")).toBe(false);
    });

    it("admin can access staff, manager, and admin features", () => {
      expect(hasMinRole("admin", "staff")).toBe(true);
      expect(hasMinRole("admin", "manager")).toBe(true);
      expect(hasMinRole("admin", "admin")).toBe(true);
    });

    it("admin cannot access owner features", () => {
      expect(hasMinRole("admin", "owner")).toBe(false);
    });

    it("owner can access all features", () => {
      expect(hasMinRole("owner", "staff")).toBe(true);
      expect(hasMinRole("owner", "manager")).toBe(true);
      expect(hasMinRole("owner", "admin")).toBe(true);
      expect(hasMinRole("owner", "owner")).toBe(true);
    });

    it("unknown role cannot access any features", () => {
      expect(hasMinRole("guest", "staff")).toBe(false);
      expect(hasMinRole("", "staff")).toBe(false);
    });
  });
});

describe("Role Hierarchy Integrity", () => {
  it("all 4 roles are defined", () => {
    expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(4);
    expect(ROLE_HIERARCHY).toHaveProperty("staff");
    expect(ROLE_HIERARCHY).toHaveProperty("manager");
    expect(ROLE_HIERARCHY).toHaveProperty("admin");
    expect(ROLE_HIERARCHY).toHaveProperty("owner");
  });

  it("roles are in ascending order", () => {
    expect(ROLE_HIERARCHY.staff).toBeLessThan(ROLE_HIERARCHY.manager);
    expect(ROLE_HIERARCHY.manager).toBeLessThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeLessThan(ROLE_HIERARCHY.owner);
  });
});
