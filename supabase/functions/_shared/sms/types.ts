/**
 * Shared types for the SMS provider abstraction (Phase 4).
 *
 * Two providers implement SmsProvider:
 *  - TwilioProvider — per-company Twilio account (Account SID + Auth Token in Vault).
 *  - PlatformProvider — Overwatch's TWILIO_* env vars (fallback shared sender).
 *
 * Mirrors the email abstraction layout in `_shared/email/types.ts`.
 */

export type SmsProviderKind = "twilio" | "platform";

export interface SmsMessage {
  to: string; // E.164, e.g. +15555550100
  from: string; // E.164 (or messaging-service SID for Twilio)
  body: string;
  /** Optional reference ID for audit logging. Twilio echoes back our messaging id. */
  idempotencyKey?: string;
}

export interface SendResult {
  /** Provider-assigned id for the send. Twilio returns the Message SID. */
  providerMessageId: string | null;
  /** Numbers accepted by the provider. */
  accepted: string[];
  /** Numbers rejected. Reason is the provider's error text. */
  rejected: Array<{ to: string; reason: string }>;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Either a sender E.164 number OR a messaging-service SID. */
  from: string;
}

export interface PlatformConfig {
  accountSid: string;
  authToken: string;
  platformFromNumber: string;
}

export interface SmsProvider {
  readonly kind: SmsProviderKind;
  send(message: SmsMessage): Promise<SendResult>;
  /**
   * Light connectivity check — Twilio: GET the account record to confirm creds.
   * Platform: same. Never sends a message.
   */
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}
