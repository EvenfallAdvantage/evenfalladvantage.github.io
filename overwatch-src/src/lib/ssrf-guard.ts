import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard shared by route handlers that take a user-controlled host / IP
 * and turn it into a network request.
 *
 * Defense is two-layered:
 *   1. Canonicalise the input. Reject non-dotted-quad IPv4 forms and any
 *      IPv6 address that falls inside a reserved range.
 *   2. For hostnames, resolve A + AAAA records and reject if *any* answer
 *      lands in a reserved range. Total Time-Of-Check / Time-Of-Use defence
 *      requires IP pinning at the socket layer, but rejecting at lookup time
 *      blocks every non-rebinding attack and forces a rebinder to win a
 *      TTL=0 race against the downstream consumer.
 *
 * Ported from the Osiris OSS project (github.com/simplifaisoul/osiris, MIT).
 * Kept verbatim for ease of upstream re-sync. Style adjusted to match
 * Overwatch conventions (double-quoted strings).
 */

const IPV4_BLOCKS_TEXT: Array<[string, number]> = [
  ["0.0.0.0", 8],          // "this" network
  ["10.0.0.0", 8],         // RFC1918
  ["100.64.0.0", 10],      // CGNAT / Tailscale
  ["127.0.0.0", 8],        // loopback
  ["169.254.0.0", 16],     // link-local (incl. cloud metadata 169.254.169.254)
  ["172.16.0.0", 12],      // RFC1918
  ["192.0.0.0", 24],       // IETF protocol assignments
  ["192.0.2.0", 24],       // TEST-NET-1
  ["192.168.0.0", 16],     // RFC1918
  ["198.18.0.0", 15],      // benchmarking
  ["198.51.100.0", 24],    // TEST-NET-2
  ["203.0.113.0", 24],     // TEST-NET-3
  ["224.0.0.0", 4],        // multicast
  ["240.0.0.0", 4],        // reserved (incl. 255.255.255.255 broadcast)
];

const IPV6_BLOCK_PREFIXES = [
  "::",
  "::1",
  "::ffff:",
  "64:ff9b::",
  "64:ff9b:1:",
  "100::",
  "2001:db8:",
  "fc",
  "fd",
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

/**
 * Returns the canonical dotted-quad form if `s` looks like an IPv4 address in
 * dotted-quad. Rejects non-canonical forms (decimal, hex, octal) so callers
 * decline them rather than try to figure out what the kernel will resolve.
 */
export function parseIPv4(s: string): string | null {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) {
    const parts = s.split(".").map(Number);
    if (parts.some((p) => p < 0 || p > 255)) return null;
    return parts.join(".");
  }
  if (/^\d+$/.test(s)) return null;
  if (/^0x[0-9a-fA-F]+$/.test(s)) return null;
  if (/^(\d+\.){0,3}\d+$/.test(s) && s.includes(".")) {
    return null;
  }
  return null;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  /** Resolved IPs (literal input or DNS answers). Empty if validation failed before resolution. */
  resolved?: string[];
}

/**
 * Validate that `host` (either an IP literal or a hostname) is safe to use as
 * a network target. Returns ok=false when the literal IP is in a blocked
 * range, the IP literal uses a non-canonical form, or any resolved A/AAAA
 * answer lands in a blocked range.
 */
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

  const ipFamily = isIP(bracketed);
  if (ipFamily === 4) {
    const canonical = parseIPv4(bracketed);
    if (!canonical) return { ok: false, reason: "non-canonical IPv4 form rejected" };
    if (ipv4InBlocked(canonical)) return { ok: false, reason: "IPv4 in reserved range" };
    return { ok: true, resolved: [canonical] };
  }
  if (ipFamily === 6) {
    if (ipv6InBlocked(bracketed)) return { ok: false, reason: "IPv6 in reserved range" };
    return { ok: true, resolved: [bracketed] };
  }

  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(trimmed)) {
    return { ok: false, reason: "invalid hostname syntax" };
  }

  let answers: Array<{ address: string; family: number }> = [];
  try {
    answers = await lookup(trimmed, { all: true });
  } catch (err) {
    return { ok: false, reason: `DNS lookup failed: ${(err as Error).message}` };
  }
  if (answers.length === 0) {
    return { ok: false, reason: "hostname has no A/AAAA records" };
  }
  for (const a of answers) {
    if (a.family === 4) {
      if (ipv4InBlocked(a.address)) return { ok: false, reason: `hostname resolves to reserved IPv4 ${a.address}` };
    } else if (a.family === 6) {
      if (ipv6InBlocked(a.address)) return { ok: false, reason: `hostname resolves to reserved IPv6 ${a.address}` };
    }
  }
  return { ok: true, resolved: answers.map((a) => a.address) };
}

/**
 * Wrap a fetch call so that:
 *   - the URL's host is validated before the request (block private targets)
 *   - redirects are followed manually, with each hop re-validated (block a
 *     redirect to a private host from a public-looking original)
 */
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
    try { parsed = new URL(currentUrl); } catch { throw new Error("safeFetch: invalid URL"); }
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
      const nextUrl = new URL(loc, currentUrl).toString();
      currentUrl = nextUrl;
      continue;
    }
    return res;
  }
  throw new Error("safeFetch: too many redirects");
}

// ── SHARED RATE LIMITER ──
// In-memory rate limiting per-isolate for basic proxy abuse prevention.
// On Vercel each isolate has its own map, so true cross-instance rate limits
// require KV/Redis. This is a first line of defence only.
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
