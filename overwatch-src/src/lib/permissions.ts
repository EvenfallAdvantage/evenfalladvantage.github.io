export type CompanyRole = "owner" | "admin" | "instructor" | "manager" | "lead" | "breaker" | "staff" | "client";

const ROLE_HIERARCHY: Record<CompanyRole, number> = {
  owner: 60,
  admin: 50,
  instructor: 45,
  manager: 40,
  lead: 30,
  breaker: 20,
  staff: 10,
  client: 5,  // Below staff — can only view client-facing content
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

/** Check if the role is a client (not internal staff) */
export function isClientRole(role: CompanyRole): boolean {
  return role === "client";
}

export const ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "Owner",
  admin: "Admin",
  instructor: "Instructor",
  manager: "Manager",
  lead: "Lead",
  breaker: "Breaker",
  staff: "Staff",
  client: "Client",
};

// ─── Role assignment rule (mirrors the DB: update_member_role / create_roster_member) ───
// Owners, admins and managers may assign roles up to ONE level below their own
// (owner -> admin, admin -> instructor, manager -> lead) and may only change
// members ranked strictly below them. Nobody can change their own role, and
// 'owner' cannot be granted from the app.
const ROLES_BY_RANK: CompanyRole[] = ["owner", "admin", "instructor", "manager", "lead", "breaker", "staff", "client"];

function rankOf(role: string): number {
  return ROLE_HIERARCHY[role as CompanyRole] ?? 0;
}

/** Roles a member with `myRole` may assign (highest first). Empty if they cannot assign roles. */
export function assignableRoles(myRole: string): CompanyRole[] {
  if (myRole !== "owner" && myRole !== "admin" && myRole !== "manager") return [];
  const myRank = rankOf(myRole);
  return ROLES_BY_RANK.filter((r) => rankOf(r) < myRank);
}

/** Whether `myRole` may change the role of a member currently holding `targetRole`. */
export function canChangeRoleOf(myRole: string, targetRole: string): boolean {
  return assignableRoles(myRole).length > 0 && rankOf(targetRole) < rankOf(myRole);
}
