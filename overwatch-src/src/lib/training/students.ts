import { activeCompanyId, db, fail, type WriteResult } from "./shared";
import type { LegacyStudent } from "./types";

/** Learners of the active company: members plus anyone with training history (imported EADB students). */
export async function getLegacyStudents(): Promise<LegacyStudent[]> {
  const companyId = activeCompanyId();
  if (!companyId) return [];
  const { data, error } = await db().rpc("training_list_learners", { p_company_id: companyId });
  if (error) { console.error("Training: getStudents error:", error); return []; }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.user_id as string, email: (r.email as string) ?? "", first_name: (r.first_name as string) ?? "",
    last_name: (r.last_name as string) ?? "", created_at: String(r.created_at ?? ""),
    last_login: (r.last_login_at as string | null) ?? null, has_login: r.has_login === true,
    member_role: (r.member_role as string | null) ?? null,
  }));
}

/** Issue a certificate (server generates the number, verification code and issued_by). */
export async function issueLegacyCertificate(certData: {
  student_id: string;
  certificate_type: string;
  certificate_name: string;
  state_issued?: string;
  expiration_date?: string;
}): Promise<WriteResult> {
  const companyId = activeCompanyId();
  if (!companyId) return { success: false, error: "missing_company" };
  const { data, error } = await db().rpc("training_issue_certificate", {
    p_company_id: companyId, p_user_id: certData.student_id, p_name: certData.certificate_name,
    p_category: certData.certificate_type || "course_completion", p_state: certData.state_issued || null,
    p_expiry: certData.expiration_date || null,
  });
  if (error) return fail("issueCertificate", error);
  return { success: true, id: data as string };
}
