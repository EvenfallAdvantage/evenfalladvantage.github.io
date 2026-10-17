/**
 * vendorFetch: timeout, retry on 429/5xx (honours Retry-After), JSON helper.
 * ADP's mTLS client is passed in via `client` (Deno.createHttpClient) by the
 * ADP adapter; the framework only forwards it.
 */
import { VendorError, type FetchLike } from "./types.ts";

export interface VendorFetchOpts extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: FetchLike;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function retryDelayMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const s = Number(retryAfter);
    if (Number.isFinite(s)) return Math.min(30_000, Math.max(0, s * 1000));
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.min(30_000, Math.max(0, at - Date.now()));
  }
  return Math.min(8_000, 250 * 2 ** attempt);
}

export async function vendorFetch(url: string, opts: VendorFetchOpts = {}): Promise<Response> {
  const { timeoutMs = 15_000, retries = 2, sleep = defaultSleep, fetchImpl = fetch, ...init } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: ac.signal });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await res.body?.cancel();
        await sleep(retryDelayMs(attempt, res.headers.get("retry-after")));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) { await sleep(retryDelayMs(attempt, null)); continue; }
    } finally {
      clearTimeout(t);
    }
  }
  throw new VendorError(`vendor request failed: ${lastErr instanceof Error ? lastErr.message : "network"}`, undefined, true);
}

export async function vendorJson<T>(url: string, opts: VendorFetchOpts = {}): Promise<T> {
  const res = await vendorFetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new VendorError(`vendor HTTP ${res.status}`, res.status, res.status === 429 || res.status >= 500);
  return (text ? JSON.parse(text) : {}) as T;
}
