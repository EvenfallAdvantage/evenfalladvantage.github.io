/**
 * SSRF guard for Supabase Edge Functions (Deno).
 *
 * Ported from Osiris (github.com/simplifaisoul/osiris, MIT) and adapted from
 * the Node.js version in overwatch-src/src/lib/ssrf-guard.ts.
 *
 * Differences from the Node version:
 *   - Uses Deno's `Deno.resolveDns()` instead of node:dns.
 *   - No `net.isIP()` equivalent in Deno stdlib — implements its own
 *     IP-family detection inline.
 */

const IPV4_BLOCKS_TEXT: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const IPV6_BLOCK_PREFIXES = [
  "::",
  "::1",
  "::ffff:",
  "64:ff9b::",
  "64:ff9b:1:",
  "100::",
  "2001:db8:",
  "fc", "fd",
  "fe8", "fe9", "fea", "feb",
  "fec", "fed", "fee", "fef",
  "ff",
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return parts[0] * 0x1000000 + parts[1] * 0x10000 + parts[2] * 0x100 + parts[3];
}

function ipv4InBlocked(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  for (const [net, bits] of IPV4_BLOCKS_TEXT) {
    const netInt = ipv4ToInt(net);
    const blockSize = bits === 0 ? 0x100000000 : Math.pow(2, 32 - bits);
    if (Math.floor(ipInt / blockSize) === Math.floor(netInt / blockSize)) return true;
  }
  return false;
}

function ipv6InBlocked(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (lower === "::" || lower === "::1") return true;
  for (const prefix of IPV6_BLOCK_PREFIXES) {
    if (lower.startsWith(prefix)) return true;
  }
  return false;
}

function isIPv4(s: string): boolean {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return false;
  return s.split(".").every((p) => {
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255;
  });
}
function isIPv6(s: string): boolean {
  // Loose: contains a colon and only hex/colon/dot characters
  return s.includes(":") && /^[0-9a-fA-F:\.]+$/.test(s.replace(/^\[|\]$/g, ""));
}

export function parseIPv4(s: string): string | null {
  if (isIPv4(s)) return s;
  return null;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  resolved?: string[];
}

export async function validateHost(host: string): Promise<ValidationResult> {
  const trimmed = host.trim();
  if (!trimmed) return { ok: false, reason: "empty host" };

  const bracketed = trimmed.replace(/^\[|\]$/g, "");

  const lowerHost = trimmed.toLowerCase();
  const NAME_BLOCKLIST = [
    /^localhost$/i,
    /\.localhost$/i,
    /^host\.docker\.internal$/i,
    /\.local$/i,
    /\.internal$/i,
    /^metadata\.google\.internal$/i,
  ];
  if (NAME_BLOCKLIST.some((re) => re.test(lowerHost))) {
    return { ok: false, reason: "hostname matches reserved name pattern" };
  }

  if (isIPv4(bracketed)) {
    if (ipv4InBlocked(bracketed)) return { ok: false, reason: "IPv4 in reserved range" };
    return { ok: true, resolved: [bracketed] };
  }
  if (isIPv6(bracketed)) {
    if (ipv6InBlocked(bracketed)) return { ok: false, reason: "IPv6 in reserved range" };
    return { ok: true, resolved: [bracketed] };
  }

  if (
    !/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(
      trimmed,
    )
  ) {
    return { ok: false, reason: "invalid hostname syntax" };
  }

  // Resolve A and AAAA records
  const resolved: string[] = [];
  try {
    const a = await Deno.resolveDns(trimmed, "A").catch(() => []);
    const aaaa = await Deno.resolveDns(trimmed, "AAAA").catch(() => []);
    for (const ip of a) {
      if (ipv4InBlocked(ip)) {
        return { ok: false, reason: `hostname resolves to reserved IPv4 ${ip}` };
      }
      resolved.push(ip);
    }
    for (const ip of aaaa) {
      if (ipv6InBlocked(ip)) {
        return { ok: false, reason: `hostname resolves to reserved IPv6 ${ip}` };
      }
      resolved.push(ip);
    }
  } catch (err) {
    return { ok: false, reason: `DNS lookup failed: ${(err as Error).message}` };
  }
  if (resolved.length === 0) {
    return { ok: false, reason: "hostname has no A/AAAA records" };
  }
  return { ok: true, resolved };
}

export async function safeFetch(
  inputUrl: string,
  init: RequestInit & { maxRedirects?: number } = {},
): Promise<Response> {
  const maxRedirects = init.maxRedirects ?? 3;
  const passInit: RequestInit & { maxRedirects?: number } = { ...init };
  delete passInit.maxRedirects;
  let currentUrl = inputUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new Error("safeFetch: invalid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`safeFetch: blocked protocol ${parsed.protocol}`);
    }
    const check = await validateHost(parsed.hostname);
    if (!check.ok) {
      throw new Error(`safeFetch: blocked target — ${check.reason}`);
    }
    const res = await fetch(currentUrl, { ...passInit, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }
    return res;
  }
  throw new Error("safeFetch: too many redirects");
}

// ── Per-isolate rate limiter ──
const rateMap = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(ip: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  for (const [key, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(key);
  }
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
