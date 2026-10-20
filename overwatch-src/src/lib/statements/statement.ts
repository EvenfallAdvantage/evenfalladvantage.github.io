/** Witness / party statements: canonical text + fingerprint (mirrors the DB trigger). */
export const PERSON_ROLES = [
  { v: "witness", label: "Witness" },
  { v: "victim", label: "Victim" },
  { v: "reporting_party", label: "Reporting party" },
  { v: "complainant", label: "Complainant" },
  { v: "suspect", label: "Suspect" },
  { v: "employee", label: "Employee" },
  { v: "other", label: "Other" },
] as const;

export const ATTESTATION =
  "I confirm this statement is true and accurate to the best of my knowledge, and I gave it voluntarily.";

export function roleLabel(v: string): string {
  return PERSON_ROLES.find((r) => r.v === v)?.label ?? v;
}

/** Same canonical form as incident_statements_guard() in the migration. */
export function canonicalStatement(s: { full_name: string; person_role: string; statement?: string | null; declined: boolean }): string {
  return [s.full_name, s.person_role, s.statement ?? "", String(s.declined)].join("\n");
}

export async function statementSha256(s: Parameters<typeof canonicalStatement>[0]): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalStatement(s)));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type StatementDraft = {
  person_role: string; full_name: string; phone: string; email: string; address: string;
  statement: string; declined: boolean;
};

export function validateDraft(d: StatementDraft, signature: string | null): string | null {
  if (!d.full_name.trim()) return "Enter the person's name";
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return "Email doesn't look right";
  if (!d.declined && !d.statement.trim()) return "Write the statement, or mark that they declined";
  if (!d.declined && !signature) return "The person needs to sign";
  return null;
}
