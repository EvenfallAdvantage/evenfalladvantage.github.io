/**
 * Minimal RDAP (RFC 9083) helpers for IP-network and ASN lookups.
 *
 * RDAP is the IETF-standard, registry-operated replacement for WHOIS; the
 * five RIRs (ARIN, RIPE NCC, APNIC, LACNIC, AFRINIC) serve it publicly with no
 * key. rdap.org is a free bootstrap redirector to the authoritative RIR.
 * Replaces bgpview.io (shut down Nov 2025), ip-api.com (free tier is
 * non-commercial) and avoids RIPEstat (commercial use needs permission).
 */

export const RDAP_BASE = "https://rdap.org";

export interface RdapNetwork {
  handle: string;
  name: string;
  cidr: string[];
  start: string;
  end: string;
  type: string;
  country: string;
  org: string;
  abuse_email: string;
  registry_url: string;
}

export interface RdapAutnum {
  number: number;
  handle: string;
  name: string;
  country: string;
  org: string;
  abuse_email: string;
  registry_url: string;
}

// deno-lint-ignore no-explicit-any
type Json = any;

function vcardField(entity: Json, field: string): string {
  const props: Json[] = entity?.vcardArray?.[1] ?? [];
  const hit = props.find((p) => Array.isArray(p) && p[0] === field);
  const v = hit?.[3];
  return typeof v === "string" ? v : "";
}

function walkEntities(entities: Json[] | undefined, out: Json[] = []): Json[] {
  for (const e of entities ?? []) {
    out.push(e);
    walkEntities(e?.entities, out);
  }
  return out;
}

function orgAndAbuse(d: Json): { org: string; abuse_email: string } {
  const all = walkEntities(d?.entities);
  const reg = all.find((e) => (e.roles ?? []).includes("registrant")) ?? all[0];
  const abuse = all.find((e) => (e.roles ?? []).includes("abuse"));
  return { org: reg ? vcardField(reg, "fn") : "", abuse_email: abuse ? vcardField(abuse, "email") : "" };
}

function selfLink(d: Json): string {
  const l = (d?.links ?? []).find((x: Json) => x?.rel === "self");
  return typeof l?.href === "string" ? l.href : "";
}

export function parseRdapNetwork(d: Json): RdapNetwork {
  const cidrs: string[] = (d?.cidr0_cidrs ?? []).map((c: Json) =>
    `${c.v4prefix ?? c.v6prefix}/${c.length}`
  );
  return {
    handle: d?.handle ?? "",
    name: d?.name ?? "",
    cidr: cidrs,
    start: d?.startAddress ?? "",
    end: d?.endAddress ?? "",
    type: d?.type ?? "",
    country: d?.country ?? "",
    ...orgAndAbuse(d),
    registry_url: selfLink(d),
  };
}

export function parseRdapAutnum(d: Json): RdapAutnum {
  return {
    number: Number(d?.startAutnum ?? 0),
    handle: d?.handle ?? "",
    name: d?.name ?? "",
    country: d?.country ?? "",
    ...orgAndAbuse(d),
    registry_url: selfLink(d),
  };
}

async function rdapGet(path: string): Promise<Json | null> {
  const res = await fetch(`${RDAP_BASE}${path}`, {
    headers: { Accept: "application/rdap+json" },
    redirect: "follow",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) { await res.body?.cancel(); return null; }
  return await res.json();
}

export async function rdapIp(ip: string): Promise<RdapNetwork | null> {
  const d = await rdapGet(`/ip/${encodeURIComponent(ip)}`);
  return d ? parseRdapNetwork(d) : null;
}

export async function rdapAutnum(asn: number): Promise<RdapAutnum | null> {
  const d = await rdapGet(`/autnum/${asn}`);
  return d ? parseRdapAutnum(d) : null;
}

/** Reverse-DNS name for an IPv4 address (PTR) via Google DNS-over-HTTPS. */
export function ptrName(ipv4: string): string | null {
  const m = ipv4.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  return `${m[4]}.${m[3]}.${m[2]}.${m[1]}.in-addr.arpa`;
}

export async function reverseDns(ipv4: string): Promise<string[]> {
  const name = ptrName(ipv4);
  if (!name) return [];
  try {
    const res = await fetch(`https://dns.google/resolve?name=${name}&type=PTR`, { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) { await res.body?.cancel(); return []; }
    const j = await res.json();
    return (j?.Answer ?? []).filter((a: Json) => a?.type === 12).map((a: Json) => String(a.data).replace(/\.$/, ""));
  } catch {
    return [];
  }
}
