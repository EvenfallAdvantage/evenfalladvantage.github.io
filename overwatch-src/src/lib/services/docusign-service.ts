/**
 * DocuSign E-Signature Service
 *
 * Creates and sends envelopes for signing via DocuSign's eSignature REST API v2.1.
 *
 * AUTH MODEL:
 *   DocuSign requires an OAuth 2.0 access token. The admin must:
 *   1. Complete the OAuth consent flow externally (or use JWT Grant)
 *   2. Store the resulting access_token in the integration config
 *   The integration_key field stores the client/integration key.
 *   The secret_key field stores the **access token** (NOT the app secret).
 *   For production, implement token refresh via Supabase Edge Functions.
 *
 * DOCUMENT MODEL:
 *   Preferred: Use a DocuSign Template (pre-uploaded in DocuSign console).
 *   Store the template_id in the integration config.
 *   Fallback: Send a raw HTML document (rendered properly, not plaintext).
 */

import { getDocuSignConfig } from "./integrations";

type DocuSignCfg = {
  integration_key: string;
  secret_key: string; // This is the OAuth ACCESS TOKEN
  account_id: string;
  base_url: string;
  template_id?: string; // Optional: pre-configured template in DocuSign
};

function apiBase(cfg: DocuSignCfg): string {
  const base = cfg.base_url || "https://demo.docusign.net";
  return `${base}/restapi/v2.1/accounts/${cfg.account_id}`;
}

function authHeaders(cfg: DocuSignCfg): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${cfg.secret_key}`,
  };
}

// ─── Template-Based Envelope (preferred) ──────────────────

/**
 * Send an envelope using a pre-configured DocuSign template.
 * The template must exist in the DocuSign account and contain
 * signing tabs, documents, and role definitions.
 */
export async function sendTemplateEnvelope(
  companyId: string,
  params: {
    templateId: string;
    signerEmail: string;
    signerName: string;
    roleName?: string;
    emailSubject?: string;
    templateData?: Record<string, string>;
  }
): Promise<string | null> {
  const cfg = await getDocuSignConfig(companyId) as DocuSignCfg | null;
  if (!cfg) {
    console.warn("[DocuSign] No active DocuSign integration for company", companyId);
    return null;
  }

  const body = {
    templateId: params.templateId,
    templateRoles: [{
      email: params.signerEmail,
      name: params.signerName,
      roleName: params.roleName || "Signer",
      ...(params.templateData ? {
        tabs: {
          textTabs: Object.entries(params.templateData).map(([label, value]) => ({
            tabLabel: label,
            value,
          })),
        },
      } : {}),
    }],
    status: "sent",
    ...(params.emailSubject ? { emailSubject: params.emailSubject } : {}),
  };

  try {
    const res = await fetch(`${apiBase(cfg)}/envelopes`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[DocuSign] Template envelope failed (${res.status}):`, err);
      return null;
    }
    const data = await res.json();
    console.info(`[DocuSign] Template envelope sent: ${data.envelopeId}`);
    return data.envelopeId;
  } catch (err) {
    console.error("[DocuSign] Network error:", err);
    return null;
  }
}

// ─── HTML Document Envelope (fallback) ────────────────────

/**
 * Send an envelope with an inline HTML document.
 * Use this only if no DocuSign template is configured.
 */
export async function sendHtmlEnvelope(
  companyId: string,
  params: {
    signerEmail: string;
    signerName: string;
    documentName: string;
    htmlContent: string;
    emailSubject?: string;
  }
): Promise<string | null> {
  const cfg = await getDocuSignConfig(companyId) as DocuSignCfg | null;
  if (!cfg) return null;

  const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${params.htmlContent}</body></html>`;
  const base64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(htmlDoc)))
    : Buffer.from(htmlDoc).toString("base64");

  const body = {
    emailSubject: params.emailSubject || `Please sign: ${params.documentName}`,
    documents: [{
      documentBase64: base64,
      name: params.documentName,
      fileExtension: "html",
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
            documentId: "1",
            pageNumber: "1",
            xPosition: "100",
            yPosition: "600",
          }],
          dateSignedTabs: [{
            documentId: "1",
            pageNumber: "1",
            xPosition: "300",
            yPosition: "600",
          }],
        },
      }],
    },
    status: "sent",
  };

  try {
    const res = await fetch(`${apiBase(cfg)}/envelopes`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[DocuSign] HTML envelope failed (${res.status}):`, err);
      return null;
    }
    const data = await res.json();
    console.info(`[DocuSign] HTML envelope sent: ${data.envelopeId}`);
    return data.envelopeId;
  } catch (err) {
    console.error("[DocuSign] Network error:", err);
    return null;
  }
}

// ─── Onboarding Convenience Wrapper ───────────────────────

/**
 * Send onboarding documents for a new hire.
 * Uses template if template_id is configured, otherwise falls back to HTML.
 */
export async function sendOnboardingDocuments(
  companyId: string,
  params: {
    signerEmail: string;
    signerName: string;
    companyName: string;
  }
): Promise<string | null> {
  const cfg = await getDocuSignConfig(companyId) as DocuSignCfg | null;
  if (!cfg) return null;

  // Preferred: use a pre-configured template
  if (cfg.template_id) {
    return sendTemplateEnvelope(companyId, {
      templateId: cfg.template_id,
      signerEmail: params.signerEmail,
      signerName: params.signerName,
      roleName: "New Hire",
      emailSubject: `${params.companyName} — Please sign your employment agreement`,
      templateData: {
        EmployeeName: params.signerName,
        CompanyName: params.companyName,
        HireDate: new Date().toLocaleDateString(),
      },
    });
  }

  // Fallback: send an HTML document
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px;">
      <h1 style="font-size:20px;border-bottom:2px solid #1d3451;padding-bottom:12px;">
        Employment Agreement — ${params.companyName}
      </h1>
      <p style="font-size:13px;line-height:1.8;margin-top:20px;">
        This Employment Agreement (&ldquo;Agreement&rdquo;) is entered into by
        <strong>${params.signerName}</strong> (&ldquo;Employee&rdquo;) and
        <strong>${params.companyName}</strong> (&ldquo;Employer&rdquo;),
        effective as of <strong>${new Date().toLocaleDateString()}</strong>.
      </p>
      <p style="font-size:13px;line-height:1.8;">
        By signing below, Employee acknowledges and agrees to the following:
      </p>
      <ol style="font-size:13px;line-height:2;">
        <li>Compliance with all company policies and procedures as outlined in the Employee Handbook.</li>
        <li>Confidentiality of all proprietary and sensitive business information.</li>
        <li>Authorization for background verification as required by company policy.</li>
        <li>Adherence to all applicable federal, state, and local regulations governing the role.</li>
        <li>Understanding that employment is at-will and may be terminated by either party with notice.</li>
      </ol>
      <div style="margin-top:60px;border-top:1px solid #ccc;padding-top:20px;">
        <p style="font-size:12px;color:#666;">Employee Signature:</p>
        <div style="height:60px;"></div>
        <p style="font-size:12px;color:#666;">Date:</p>
      </div>
    </div>
  `;

  return sendHtmlEnvelope(companyId, {
    signerEmail: params.signerEmail,
    signerName: params.signerName,
    documentName: `Employment Agreement - ${params.companyName}`,
    htmlContent: html,
    emailSubject: `${params.companyName} — Please sign your employment agreement`,
  });
}
