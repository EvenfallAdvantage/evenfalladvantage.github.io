/**
 * Signal Messaging Service (Stub)
 *
 * Signal does not have a public business API for automated messaging.
 * This service provides a configuration structure and community link management
 * for future integration when/if Signal releases a Business API.
 *
 * Current capabilities:
 *   - Store and retrieve Signal group invite link (for manual onboarding)
 *
 * Future capabilities (pending Signal Business API):
 *   - Automated secure messaging for sensitive operations
 *   - Executive protection communication channels
 */

import { getActiveConfig, type ProviderKey } from "./integrations";

interface SignalConfig {
  signal_group_link: string;
}

async function getSignalConfig(companyId: string): Promise<SignalConfig | null> {
  return getActiveConfig<SignalConfig>(companyId, "signal" as ProviderKey);
}

/**
 * Get the Signal group invite link for a company.
 * Returns null if Signal integration is not configured.
 */
export async function getSignalGroupLink(companyId: string): Promise<string | null> {
  const cfg = await getSignalConfig(companyId);
  return cfg?.signal_group_link ?? null;
}

/**
 * Verify Signal configuration is present.
 * Since there's no API to test, we only check that a group link is configured.
 */
export async function verifySignalConnection(companyId: string): Promise<{ connected: boolean; groupLink?: string }> {
  const cfg = await getSignalConfig(companyId);
  if (!cfg?.signal_group_link) return { connected: false };
  return { connected: true, groupLink: cfg.signal_group_link };
}
