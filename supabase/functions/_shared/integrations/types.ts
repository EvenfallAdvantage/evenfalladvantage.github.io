/**
 * Vendor integration framework (PR V0): shared types.
 * Pure module: no Deno/jsr imports, so it type-checks under deno check and
 * can be unit-tested with recorded fixtures.
 */

export type AuthType = "oauth_code" | "oauth_client_credentials" | "api_key" | "partner_link";
export type ConnectionStatus = "disconnected" | "pending" | "connected" | "error" | "revoked";
export type Role = "owner" | "admin" | "manager" | "lead" | "staff" | "instructor";

/** Secrets stored in Vault for one connection (JSON blob). */
export interface TokenSet {
  access_token?: string;
  refresh_token?: string;
  api_key?: string;
  /** ISO time the access token expires. */
  expires_at?: string | null;
  [k: string]: unknown;
}

export interface ConnectionRow {
  id: string;
  company_id: string;
  provider: string;
  status: ConnectionStatus;
  auth_type: AuthType;
  vault_secret_id: string | null;
  access_expires_at: string | null;
  external_account_id: string | null;
  external_account_name?: string | null;
  settings: Record<string, unknown>;
  refresh_failures?: number;
}

/** What an adapter sees: the row plus decrypted secrets (server-side only). */
export interface LiveConnection extends ConnectionRow {
  secrets: TokenSet;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface AdapterCtx {
  fetch: FetchLike;
  env: (name: string) => string | undefined;
  now: () => Date;
  log: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface ExchangeResult extends TokenSet {
  externalAccountId?: string;
  externalAccountName?: string;
  /** e.g. Checkr partner sign-up: connected only after account.credentialed. */
  initialStatus?: ConnectionStatus;
}

export interface WebhookIdentity {
  /** Vendor's unique event id (dedupe key). Derive a hash if the vendor has none. */
  eventId: string;
  type: string | null;
  /** Used to find the connection (realmId, company_uuid, account id ...). */
  externalAccountId?: string | null;
}

export interface ActionDef {
  /** Minimum role. Writes are owner/admin; managers may only run "read" actions. */
  access: "read" | "manage";
  /** true = enqueue in integration_jobs instead of running inline. */
  queued?: boolean;
  run: (conn: LiveConnection, input: Record<string, unknown>, ctx: AdapterCtx) => Promise<unknown>;
}

export interface VendorAdapter {
  provider: string;
  authType: AuthType;
  /** Human label for audit/UI. */
  label: string;
  scopes?: string[];
  /** Platform secrets present (e.g. GUSTO_CLIENT_ID)? Unconfigured adapters refuse to start. */
  isConfigured?(env: AdapterCtx["env"]): boolean;
  authorizeUrl?(p: { state: string; redirectUri: string; codeChallenge?: string; env: AdapterCtx["env"] }): string;
  exchangeCode?(p: { code: string; redirectUri: string; verifier?: string; query: URLSearchParams }, ctx: AdapterCtx): Promise<ExchangeResult>;
  refresh?(tokens: TokenSet, ctx: AdapterCtx): Promise<TokenSet>;
  /** Cheap read call that proves the credentials work. Never throws for "bad creds": returns ok=false. */
  test(conn: LiveConnection, ctx: AdapterCtx): Promise<{ ok: boolean; detail?: string; externalAccountName?: string }>;
  /** Fail-closed: return false unless the signature is present AND valid. */
  verifyWebhook?(p: { rawBody: string; headers: Headers; conn?: LiveConnection | null; env: AdapterCtx["env"] }): Promise<boolean>;
  /** Some vendors (Meta, Gusto) send a GET/verification handshake. Return a Response to answer it. */
  webhookHandshake?(req: Request, env: AdapterCtx["env"]): Response | null;
  identifyWebhook?(payload: unknown, headers: Headers): WebhookIdentity;
  /** Whether verifyWebhook needs the connection's secrets (per-company HMAC key). */
  webhookNeedsConnection?: boolean;
  handleWebhook?(event: { type: string | null; payload: unknown }, conn: LiveConnection | null, ctx: AdapterCtx): Promise<void>;
  actions: Record<string, ActionDef>;
  /** Job kinds the worker can run. */
  jobs?: Record<string, (conn: LiveConnection, payload: Record<string, unknown>, ctx: AdapterCtx) => Promise<unknown>>;
  /** Called on disconnect (revoke at vendor). Best effort. */
  revoke?(conn: LiveConnection, ctx: AdapterCtx): Promise<void>;
}

export class VendorError extends Error {
  constructor(message: string, public status?: number, public retryable = false) {
    super(message);
    this.name = "VendorError";
  }
}
