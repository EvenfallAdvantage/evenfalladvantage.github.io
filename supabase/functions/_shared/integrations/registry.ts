/**
 * Adapter registry. Each vendor PR (V1–V9) adds one import + one entry here.
 * The mock adapter is only reachable when INTEGRATIONS_ENABLE_MOCK=true.
 */
import { mockAdapter } from "./mock.ts";
import type { VendorAdapter } from "./types.ts";

const ADAPTERS: Record<string, VendorAdapter> = {
  // fillout: filloutAdapter,      (V1)
  // whatsapp: whatsappAdapter,    (V2)
  // docusign: docusignAdapter,    (V3)
  // quickbooks: quickbooksAdapter (V4)
  // checkr: checkrAdapter,        (V5)
  // gusto / paychex / adp         (V7–V9)
};

export function getAdapter(provider: string, env: (n: string) => string | undefined): VendorAdapter | null {
  if (provider === "mock") return env("INTEGRATIONS_ENABLE_MOCK") === "true" ? mockAdapter : null;
  return Object.prototype.hasOwnProperty.call(ADAPTERS, provider) ? ADAPTERS[provider] : null;
}

export const registeredProviders = () => Object.keys(ADAPTERS);
