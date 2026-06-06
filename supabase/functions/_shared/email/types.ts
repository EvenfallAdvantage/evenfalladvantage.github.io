/**
 * Shared types for the email provider abstraction.
 *
 * Three providers implement EmailProvider: SmtpProvider (denomailer + Vault),
 * ResendProvider (Resend API + Vault), PlatformProvider (Overwatch's
 * RESEND_API_KEY env var with "{Company} via Overwatch" branding).
 */

export type EmailProviderKind = "smtp" | "resend" | "platform";

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: EmailAddress[];
  from: EmailAddress;
  replyTo?: EmailAddress;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  /** Idempotency key — used by some providers (Resend) to dedupe accidental retries. */
  idempotencyKey?: string;
}

export interface SendResult {
  /** Provider-assigned id for the send. SMTP returns a queue id; Resend returns its message id. */
  providerMessageId: string | null;
  /** Per-recipient status. SMTP may know per-recipient via 250 OK / 5xx; Resend treats the whole call as a single result. */
  accepted: string[];
  rejected: Array<{ to: string; reason: string }>;
}

/**
 * Provider-specific config blobs. Resolved by the factory from the
 * company's integrations_config row + vault.decrypted_secrets.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  /** true = TLS on connect (port 465). false = STARTTLS upgrade (port 587). */
  secure: boolean;
}

export interface ResendConfig {
  apiKey: string;
}

export interface PlatformConfig {
  apiKey: string;
  /** Always overrides from.email with `invite@evenfalladvantage.com` and rebrands name. */
  platformFromEmail: string;
  platformFromName: string;
}

export interface EmailProvider {
  readonly kind: EmailProviderKind;
  send(message: EmailMessage): Promise<SendResult>;
  /**
   * Light connectivity check — for SMTP this opens the socket + does AUTH
   * but does NOT send a message. For Resend it validates the API key shape.
   * For Platform it's a no-op (always succeeds).
   */
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}
