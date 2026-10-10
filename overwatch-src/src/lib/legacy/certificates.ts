import { getLegacyClient } from "./client";
import { legacyRead, viaLegacyBridge } from "./bridge";
import type { LegacyCertificate } from "./types";

/** The signed-in user's own certificates (studentId: fallback only). */
export async function getLegacyCertificates(studentId: string): Promise<LegacyCertificate[]> {
  return legacyRead("me.certificates", {}, () => directGetLegacyCertificates(studentId), []);
}

async function directGetLegacyCertificates(studentId: string): Promise<LegacyCertificate[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("certificates")
    .select(`
      *
    `)
    .eq("student_id", studentId)
    .order("issue_date", { ascending: false });

  if (error) {
    console.error("Legacy: getCertificates error:", error);
    return [];
  }
  return data ?? [];
}

/** Issue a certificate to a student */
export async function issueLegacyCertificate(certData: {
  student_id: string;
  issued_by: string;
  certificate_type: string;
  certificate_name: string;
  state_issued?: string;
  expiration_date?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  // Server path sets issued_by to the caller's own instructor record and
  // generates the certificate number / verification code itself.
  const { issued_by: _issuedBy, ...certValues } = certData;
  void _issuedBy;
  const viaBridge = await viaLegacyBridge("certificate.issue", { values: certValues });
  if (viaBridge) return viaBridge;
  const client = getLegacyClient();

  const certNumber = `EA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const verificationCode = `V-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  const { data, error } = await client
    .from("certificates")
    .insert({
      ...certData,
      certificate_number: certNumber,
      verification_code: verificationCode,
      issue_date: new Date().toISOString().split("T")[0],
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Legacy: issueCertificate error:", error);
    return { success: false };
  }
  return { success: true, id: data.id };
}
