/**
 * Client Portal Management
 *
 * Handles inviting clients to the portal, managing client memberships,
 * and client-specific data queries.
 */

import { createClient } from "./client";
import { ts } from "./db-helpers";
import { logDbReadError } from "./db-error";

export interface ClientMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
}

/**
 * True if the error is Postgres complaining that "client" isn't a valid
 * enum value for CompanyRole — i.e. the `add_client_role.sql` migration
 * hasn't been run yet. SQLSTATE 22P02 (invalid_text_representation) is
 * what Postgres returns when you try to cast a string to an enum that
 * doesn't include it.
 */
function isClientRoleEnumMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  if (err.code === "22P02" && typeof err.message === "string" && /CompanyRole.*client/i.test(err.message)) {
    return true;
  }
  if (typeof err.message === "string" && /invalid input value for enum "?CompanyRole"?: "?client"?/i.test(err.message)) {
    return true;
  }
  return false;
}

/**
 * Get all client-role members for a company.
 *
 * Returns an empty array (without toasting an error) if the
 * `add_client_role.sql` migration has not yet been run — the UI can
 * detect this case via `isClientRoleSupported()` and surface a friendly
 * "migration required" banner instead of a generic failure toast.
 */
export async function getClientMembers(companyId: string): Promise<ClientMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_memberships")
    .select("id, user_id, status, created_at, users(email, first_name, last_name)")
    .eq("company_id", companyId)
    .eq("role", "client")
    .order("created_at", { ascending: false });

  if (error) {
    if (isClientRoleEnumMissing(error)) {
      // Migration not yet applied — silent, the section component
      // will independently detect and show a banner.
      return [];
    }
    logDbReadError("client-members", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((m: any) => ({
    id: m.id,
    userId: m.user_id,
    email: m.users?.email ?? "",
    firstName: m.users?.first_name ?? "",
    lastName: m.users?.last_name ?? "",
    status: m.status,
    createdAt: m.created_at,
  }));
}

/**
 * Probe whether the 'client' value exists in the CompanyRole enum.
 *
 * Used by the Client Portal UI to detect whether the
 * `add_client_role.sql` migration has been applied. Returns `false`
 * if Postgres rejects 'client' as an enum value, `true` otherwise.
 *
 * Implementation: attempts a count query with `role=eq.client` and a
 * limit of 0. If the enum value is missing, Postgres returns 22P02.
 * If the enum is fine but the company has no clients, we get a clean
 * empty result.
 */
export async function isClientRoleSupported(): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("company_memberships")
    .select("id", { count: "exact", head: true })
    .eq("role", "client")
    .limit(0);
  if (!error) return true;
  return !isClientRoleEnumMissing(error);
}

/**
 * Create a client membership for an existing user (by email lookup).
 * If the user doesn't exist in the system yet, this will fail —
 * the admin should use the auth invite flow instead.
 */
export async function addClientMember(
  companyId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // Look up the user by email
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (!user) {
    return { success: false, error: "No user found with that email. They need to create an account first." };
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("company_memberships")
    .select("id, role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { success: false, error: `This user is already a ${existing.role} in your organization.` };
  }

  // Create the client membership
  const { error } = await supabase
    .from("company_memberships")
    .insert({
      id: crypto.randomUUID(),
      company_id: companyId,
      user_id: user.id,
      role: "client",
      status: "active",
      ...ts(),
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Remove a client membership.
 */
export async function removeClientMember(membershipId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("company_memberships")
    .delete()
    .eq("id", membershipId)
    .eq("role", "client"); // Safety: only delete client memberships
  return !error;
}
