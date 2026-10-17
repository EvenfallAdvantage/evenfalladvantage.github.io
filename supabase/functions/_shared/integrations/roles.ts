/** Role rules: owners/admins manage integrations; managers are read-only. */
import type { ActionDef } from "./types.ts";

export const MANAGE_ROLES = new Set(["owner", "admin"]);
export const READ_ROLES = new Set(["owner", "admin", "manager"]);

export const canManage = (role: string | null | undefined) => MANAGE_ROLES.has(role ?? "");
export const canRead = (role: string | null | undefined) => READ_ROLES.has(role ?? "");

/** Built-in actions every adapter gets. */
export const BUILTIN_ACCESS: Record<string, ActionDef["access"]> = { test: "manage", disconnect: "manage" };

export function allowed(access: ActionDef["access"], role: string | null | undefined): boolean {
  return access === "read" ? canRead(role) : canManage(role);
}
