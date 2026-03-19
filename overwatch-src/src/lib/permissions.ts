export type CompanyRole = "owner" | "admin" | "instructor" | "manager" | "lead" | "breaker" | "staff";

const ROLE_HIERARCHY: Record<CompanyRole, number> = {
  owner: 60,
  admin: 50,
  instructor: 45,
  manager: 40,
  lead: 30,
  breaker: 20,
  staff: 10,
};

export function hasMinRole(userRole: CompanyRole, requiredRole: CompanyRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canManageStaff(role: CompanyRole): boolean {
  return hasMinRole(role, "admin");
}

export function canManageEvents(role: CompanyRole): boolean {
  return hasMinRole(role, "manager");
}

export function canClockOthers(role: CompanyRole): boolean {
  return role === "breaker" || role === "lead" || hasMinRole(role, "manager");
}

export function canApproveTimesheets(role: CompanyRole): boolean {
  return hasMinRole(role, "manager");
}

export function canManageAssets(role: CompanyRole): boolean {
  return hasMinRole(role, "manager");
}

export function canScanAssets(role: CompanyRole): boolean {
  return hasMinRole(role, "breaker");
}

export function canCreateContent(role: CompanyRole): boolean {
  return hasMinRole(role, "manager");
}

export function canViewReports(role: CompanyRole): boolean {
  return hasMinRole(role, "manager");
}

export function canManageSettings(role: CompanyRole): boolean {
  return hasMinRole(role, "admin");
}

export function canManageLegacyCourses(role: CompanyRole): boolean {
  return role === "instructor" || hasMinRole(role, "admin");
}

export const ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "Owner",
  admin: "Admin",
  instructor: "Instructor",
  manager: "Manager",
  lead: "Lead",
  breaker: "Breaker",
  staff: "Staff",
};
