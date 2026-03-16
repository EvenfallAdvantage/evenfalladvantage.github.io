/**
 * Core Integration Service
 *
 * Reads stored integration configs from `integrations_config` table
 * and provides typed access for each provider.
 *
 * SECURITY NOTE: In a static-export deployment (GitHub Pages), these calls
 * run client-side. For production, migrate sensitive API calls to Supabase
 * Edge Functions so API keys never leave the server.
 */

import { getIntegrationsConfig } from "@/lib/supabase/db";

// ─── Types ────────────────────────────────────────────────

export type ProviderKey =
  | "whatsapp" | "signal" | "twilio" | "email" | "onesignal"
  | "fillout" | "airtable" | "checkr" | "docusign" | "gusto";

export interface IntegrationConfig {
  provider: string;
  config: Record<string, string>;
  is_active: boolean;
}

export interface EmailConfig {
  provider: "postmark" | "resend";
  api_key: string;
  from_email: string;
  from_name: string;
}

export interface WhatsAppConfig {
  phone_number_id: string;
  access_token: string;
  community_invite_link?: string;
}

export interface TwilioConfig {
  account_sid: string;
  auth_token: string;
  from_number: string;
  messaging_service_sid?: string;
}

export interface OneSignalConfig {
  app_id: string;
  rest_api_key: string;
}

export interface CheckrConfig {
  api_key: string;
  package_slug: string;
  webhook_url?: string;
}

export interface DocuSignConfig {
  integration_key: string;
  secret_key: string;
  account_id: string;
  base_url: string;
}

export interface GustoConfig {
  client_id: string;
  client_secret: string;
  company_uuid: string;
  sync_frequency: string;
}

// ─── Config Cache ─────────────────────────────────────────

let _cache: { companyId: string; configs: IntegrationConfig[]; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

async function loadConfigs(companyId: string): Promise<IntegrationConfig[]> {
  if (_cache && _cache.companyId === companyId && Date.now() - _cache.ts < CACHE_TTL) {
    return _cache.configs;
  }
  const raw = await getIntegrationsConfig(companyId);
  const configs = (raw ?? []) as IntegrationConfig[];
  _cache = { companyId, configs, ts: Date.now() };
  return configs;
}

export function clearConfigCache() {
  _cache = null;
}

// ─── Typed Config Getters ─────────────────────────────────

async function getActiveConfig<T>(companyId: string, provider: ProviderKey): Promise<T | null> {
  const configs = await loadConfigs(companyId);
  const entry = configs.find(c => c.provider === provider && c.is_active);
  if (!entry) return null;
  return entry.config as unknown as T;
}

export async function getEmailConfig(companyId: string) {
  return getActiveConfig<EmailConfig>(companyId, "email");
}

export async function getWhatsAppConfig(companyId: string) {
  return getActiveConfig<WhatsAppConfig>(companyId, "whatsapp");
}

export async function getTwilioConfig(companyId: string) {
  return getActiveConfig<TwilioConfig>(companyId, "twilio");
}

export async function getOneSignalConfig(companyId: string) {
  return getActiveConfig<OneSignalConfig>(companyId, "onesignal");
}

export async function getCheckrConfig(companyId: string) {
  return getActiveConfig<CheckrConfig>(companyId, "checkr");
}

export async function getDocuSignConfig(companyId: string) {
  return getActiveConfig<DocuSignConfig>(companyId, "docusign");
}

export async function getGustoConfig(companyId: string) {
  return getActiveConfig<GustoConfig>(companyId, "gusto");
}

/** Check whether a provider is active for a company (fast, cached) */
export async function isIntegrationActive(companyId: string, provider: ProviderKey): Promise<boolean> {
  const configs = await loadConfigs(companyId);
  return configs.some(c => c.provider === provider && c.is_active);
}
