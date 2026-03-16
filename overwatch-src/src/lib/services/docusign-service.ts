/**
 * DocuSign E-Signature Service
 *
 * Creates and sends envelopes for signing via DocuSign's eSignature API
 * using the company's stored integration config.
 */

import { getDocuSignConfig } from "./integrations";

/**
 * Send a document for e-signature via DocuSign.
 * Returns the envelope ID on success, null on failure.
 */
export async function sendEnvelopeForSigning(
  companyId: string,
  params: {
    signerEmail: string;
    signerName: string;
    documentName: string;
    documentBase64: string;
    emailSubject?: string;
  }
): Promise<string | null> {
  const cfg = await getDocuSignConfig(companyId);
  if (!cfg) {
    console.warn("[DocuSign] No active DocuSign integration for company", companyId);
    return null;
  }

  const baseUrl = cfg.base_url || "https://demo.docusign.net";
  const url = `${baseUrl}/restapi/v2.1/accounts/${cfg.account_id}/envelopes`;

  // Build JWT or use integration key for auth
  // NOTE: Production DocuSign requires OAuth JWT flow.
  // This uses a simplified approach with access token from config.
  const body = {
    emailSubject: params.emailSubject || `Please sign: ${params.documentName}`,
    documents: [{
      documentBase64: params.documentBase64,
      name: params.documentName,
      fileExtension: "pdf",
      documentId: "1",
    }],
    recipients: {
      signers: [{
        email: params.signerEmail,
        name: params.signerName,
        recipientId: "1",
        routingOrder: "1",
        tabs: {
          signHereTabs: [{
            anchorString: "/sig/",
            anchorUnits: "pixels",
            anchorXOffset: "0",
            anchorYOffset: "0",
          }],
        },
      }],
    },
    status: "sent",
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.secret_key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[DocuSign] Envelope creation failed (${res.status}):`, err);
      return null;
    }
    const data = await res.json();
    console.info(`[DocuSign] Envelope sent: ${data.envelopeId}`);
    return data.envelopeId;
  } catch (err) {
    console.error("[DocuSign] Network error:", err);
    return null;
  }
}

/**
 * Send standard onboarding documents (employment agreement, NDA, policy acknowledgment).
 * Convenience wrapper that sends a predefined envelope.
 */
export async function sendOnboardingDocuments(
  companyId: string,
  params: {
    signerEmail: string;
    signerName: string;
    companyName: string;
  }
): Promise<string | null> {
  // Placeholder: in production, use a template stored in DocuSign
  // For now, send a simple text-based agreement
  const agreementText = [
    `EMPLOYMENT AGREEMENT — ${params.companyName}`,
    "",
    `This Employment Agreement ("Agreement") is entered into by ${params.signerName}`,
    `("Employee") and ${params.companyName} ("Employer").`,
    "",
    "By signing below, Employee acknowledges and agrees to:",
    "1. Compliance with all company policies and procedures",
    "2. Confidentiality of proprietary information",
    "3. Adherence to the employee handbook",
    "4. Background check authorization",
    "",
    "",
    "/sig/",
    "",
    `Date: ${new Date().toLocaleDateString()}`,
  ].join("\n");

  const base64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(agreementText)))
    : Buffer.from(agreementText).toString("base64");

  return sendEnvelopeForSigning(companyId, {
    signerEmail: params.signerEmail,
    signerName: params.signerName,
    documentName: `Employment Agreement - ${params.companyName}.pdf`,
    documentBase64: base64,
    emailSubject: `${params.companyName} — Please sign your employment agreement`,
  });
}
