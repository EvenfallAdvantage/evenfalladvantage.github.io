/**
 * Vendor connection model for HQ Config (PR V0). Pure: no Supabase imports.
 * Rows come from integration_connections (column-limited SELECT; secrets
 * never reach the browser).
 */

export type ConnectionStatus = "disconnected" | "pending" | "connected" | "error" | "revoked";
export type ConnectionAuthType = "oauth_code" | "oauth_client_credentials" | "api_key" | "partner_link";

export interface IntegrationConnection {
  id: string;
  company_id: string;
  provider: string;
  status: ConnectionStatus;
  auth_type: ConnectionAuthType;
  access_expires_at: string | null;
  external_account_id: string | null;
  external_account_name: string | null;
  settings: Record<string, unknown>;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_error: string | null;
  last_sync_at: string | null;
  last_webhook_at: string | null;
  refresh_failures: number;
  updated_at: string;
}

/** Columns the browser may select (matches the column GRANT in the migration). */
export const CONNECTION_SELECT =
  "id, company_id, provider, status, auth_type, access_expires_at, external_account_id, external_account_name, settings, last_test_at, last_test_ok, last_error, last_sync_at, last_webhook_at, refresh_failures, updated_at";

/** A vendor that runs on the framework. Vendor PRs add entries to FRAMEWORK_PROVIDERS. */
export interface ConnectionProviderDef {
  provider: string;
  label: string;
  logo: string | null;
  desc: string;
  /** How the owner connects: OAuth redirect or a write-only key form. */
  connect: "oauth" | "key";
  /** Expect at least one webhook every N days once connected (health strip). */
  webhookSilenceDays?: number;
}

/**
 * Vendors live on the framework. Empty in V0: each vendor PR (Fillout, WhatsApp,
 * DocuSign, QuickBooks, Checkr, Gusto, Paychex, ADP) adds itself here and flips its
 * legacy tile from "Not available yet" in integrations-section.tsx.
 */
export const FRAMEWORK_PROVIDERS: ConnectionProviderDef[] = [];

export type BadgeKind = "connected" | "pending" | "attention" | "disconnected";
export const BADGE_LABEL: Record<BadgeKind, string> = {
  connected: "Connected",
  pending: "Pending vendor approval",
  attention: "Needs attention",
  disconnected: "Disconnected",
};

/** Never "Connected" without a passing test (decision in plan §1.4). */
export function connectionBadge(row: Pick<IntegrationConnection, "status" | "last_test_ok"> | null | undefined): BadgeKind {
  if (!row) return "disconnected";
  switch (row.status) {
    case "connected":
      return row.last_test_ok === true ? "connected" : "attention";
    case "pending":
      return "pending";
    case "error":
      return "attention";
    default:
      return "disconnected";
  }
}

export interface HealthIssue {
  provider: string;
  kind: "failing" | "token_refresh" | "webhook_silence" | "untested";
  message: string;
}

const DAY = 86_400_000;

export function connectionHealth(
  rows: IntegrationConnection[],
  defs: ConnectionProviderDef[],
  now: Date = new Date(),
): HealthIssue[] {
  const issues: HealthIssue[] = [];
  for (const r of rows) {
    if (r.status === "disconnected" || r.status === "revoked") continue;
    const label = defs.find((d) => d.provider === r.provider)?.label ?? r.provider;
    if (r.status === "error") {
      issues.push({ provider: r.provider, kind: "failing", message: `${label}: ${r.last_error ?? "connection failing"}` });
      continue;
    }
    if (r.status !== "connected") continue;
    if (r.refresh_failures > 0) {
      issues.push({ provider: r.provider, kind: "token_refresh", message: `${label}: token refresh failed ${r.refresh_failures}×` });
    }
    if (r.last_test_ok !== true) {
      issues.push({ provider: r.provider, kind: "untested", message: `${label}: run a connection test` });
    }
    const days = defs.find((d) => d.provider === r.provider)?.webhookSilenceDays;
    if (days) {
      const last = r.last_webhook_at ? Date.parse(r.last_webhook_at) : NaN;
      if (!Number.isFinite(last) || now.getTime() - last > days * DAY) {
        issues.push({ provider: r.provider, kind: "webhook_silence", message: `${label}: no webhook events in ${days}+ days` });
      }
    }
  }
  return issues;
}

/** "3h ago" style label; "Never" for null. */
export function sinceLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "Never";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Never";
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

/** True when the error means the framework migration isn't applied yet. */
export function isMissingTableError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205";
}
