import { describe, it, expect } from "vitest";
import {
  hasMinRole, canManageStaff, canManageEvents, canClockOthers,
  canApproveTimesheets, canManageSettings, canManageLegacyCourses,
  ROLE_LABELS, type CompanyRole,
} from "@/lib/permissions";

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

    it("intermediate roles are ordered correctly", () => {
      // breaker > staff, breaker < manager
      expect(hasMinRole("breaker", "staff")).toBe(true);
      expect(hasMinRole("breaker", "manager")).toBe(false);
      // lead > breaker, lead < manager
      expect(hasMinRole("lead", "breaker")).toBe(true);
      expect(hasMinRole("lead", "manager")).toBe(false);
      // instructor > manager, instructor < admin
      expect(hasMinRole("instructor", "manager")).toBe(true);
      expect(hasMinRole("instructor", "admin")).toBe(false);
    });
  });

  describe("Permission helper functions", () => {
    it("canManageStaff requires admin+", () => {
      expect(canManageStaff("staff")).toBe(false);
      expect(canManageStaff("manager")).toBe(false);
      expect(canManageStaff("admin")).toBe(true);
      expect(canManageStaff("owner")).toBe(true);
    });

    it("canManageEvents requires manager+", () => {
      expect(canManageEvents("staff")).toBe(false);
      expect(canManageEvents("manager")).toBe(true);
      expect(canManageEvents("admin")).toBe(true);
    });

    it("canClockOthers includes breaker and lead roles", () => {
      expect(canClockOthers("staff")).toBe(false);
      expect(canClockOthers("breaker")).toBe(true);
      expect(canClockOthers("lead")).toBe(true);
      expect(canClockOthers("manager")).toBe(true);
    });

    it("canApproveTimesheets requires manager+", () => {
      expect(canApproveTimesheets("staff")).toBe(false);
      expect(canApproveTimesheets("manager")).toBe(true);
    });

    it("canManageSettings requires admin+", () => {
      expect(canManageSettings("manager")).toBe(false);
      expect(canManageSettings("admin")).toBe(true);
    });

    it("canManageLegacyCourses allows instructor or admin+", () => {
      expect(canManageLegacyCourses("staff")).toBe(false);
      expect(canManageLegacyCourses("manager")).toBe(false);
      expect(canManageLegacyCourses("instructor")).toBe(true);
      expect(canManageLegacyCourses("admin")).toBe(true);
    });
  });
});

describe("Role Hierarchy Integrity", () => {
  it("all 7 roles have labels defined", () => {
    const roles: CompanyRole[] = ["owner", "admin", "instructor", "manager", "lead", "breaker", "staff"];
    for (const role of roles) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(typeof ROLE_LABELS[role]).toBe("string");
    }
  });

  it("roles are in ascending order of privilege", () => {
    expect(hasMinRole("breaker", "staff")).toBe(true);
    expect(hasMinRole("lead", "breaker")).toBe(true);
    expect(hasMinRole("manager", "lead")).toBe(true);
    expect(hasMinRole("instructor", "manager")).toBe(true);
    expect(hasMinRole("admin", "instructor")).toBe(true);
    expect(hasMinRole("owner", "admin")).toBe(true);
  });
});

// Mirrors the server-side rule in update_member_role / create_roster_member
describe("role assignment rule (one level below your own)", () => {
  it("owner can assign everything below owner", async () => {
    const { assignableRoles } = await import("@/lib/permissions");
    expect(assignableRoles("owner")).toEqual(["admin", "instructor", "manager", "lead", "breaker", "staff", "client"]);
  });
  it("admin can assign up to instructor", async () => {
    const { assignableRoles } = await import("@/lib/permissions");
    expect(assignableRoles("admin")[0]).toBe("instructor");
    expect(assignableRoles("admin")).not.toContain("admin");
  });
  it("manager can assign up to lead", async () => {
    const { assignableRoles } = await import("@/lib/permissions");
    expect(assignableRoles("manager")).toEqual(["lead", "breaker", "staff", "client"]);
  });
  it("instructor, lead and below cannot assign roles", async () => {
    const { assignableRoles } = await import("@/lib/permissions");
    for (const r of ["instructor", "lead", "breaker", "staff", "client"]) expect(assignableRoles(r)).toEqual([]);
  });
  it("can only change members ranked below you", async () => {
    const { canChangeRoleOf } = await import("@/lib/permissions");
    expect(canChangeRoleOf("manager", "staff")).toBe(true);
    expect(canChangeRoleOf("manager", "manager")).toBe(false);
    expect(canChangeRoleOf("manager", "instructor")).toBe(false);
    expect(canChangeRoleOf("admin", "instructor")).toBe(true);
    expect(canChangeRoleOf("admin", "admin")).toBe(false);
    expect(canChangeRoleOf("owner", "owner")).toBe(false);
    expect(canChangeRoleOf("lead", "staff")).toBe(false);
  });
});
