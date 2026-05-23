/**
 * Intel OSINT — Subnet sweep via Shodan InternetDB + geolocation.
 * Tight rate limit: 2 sweeps / minute per IP.
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/ssrf-guard.ts";

const sweepRateMap = new Map<string, number[]>();
const SWEEP_RATE_WINDOW_MS = 60_000;
const SWEEP_RATE_MAX = 2;

function checkSweepRateLimit(requesterIp: string): boolean {
  const now = Date.now();
  const timestamps = (sweepRateMap.get(requesterIp) ?? []).filter(
    (t) => now - t < SWEEP_RATE_WINDOW_MS,
  );
  if (timestamps.length >= SWEEP_RATE_MAX) {
    sweepRateMap.set(requesterIp, timestamps);
    return false;
  }
  timestamps.push(now);
  sweepRateMap.set(requesterIp, timestamps);
  return true;
}

const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
function parseIPv4Octets(ip: string): [number, number, number, number] | null {
  const match = ip.match(IPV4_REGEX);
  if (!match) return null;
  const octets = [
    parseInt(match[1], 10), parseInt(match[2], 10),
    parseInt(match[3], 10), parseInt(match[4], 10),
  ] as [number, number, number, number];
  if (octets.some((o) => o < 0 || o > 255)) return null;
  return octets;
}

function isPrivateOrReserved(o: [number, number, number, number]): boolean {
  const [a, b] = o;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a >= 224) return true;
  if (a === 0) return true;
  return false;
}

function ipToNumber(o: [number, number, number, number]): number {
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}
function numberToIp(num: number): string {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join(".");
}
function calculateSubnetStart(ipNum: number, cidr: number): number {
  const mask = (0xffffffff << (32 - cidr)) >>> 0;
  return (ipNum & mask) >>> 0;
}

async function batchFetch<T>(
  urls: string[],
  concurrency: number,
  fn: (url: string) => Promise<T | null>,
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(urls.length).fill(null);
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < urls.length) {
      const i = idx++;
      results[i] = await fn(urls[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function classifyDevice(ports: number[], cpes: string[], tags: string[]) {
  const portSet = new Set(ports);
  const cpeLower = cpes.map((c) => c.toLowerCase());
  const tagLower = tags.map((t) => t.toLowerCase());

  if (portSet.has(554) || portSet.has(8554) ||
      cpeLower.some((c) => /camera|dvr|hikvision|dahua|axis|ipcam/.test(c))) {
    return { device_type: "Camera/DVR", device_icon: "Camera", device_color: "#FF3D3D" };
  }
  if (portSet.has(9100) || cpeLower.some((c) => /printer|hp.*laserjet|epson|brother/.test(c))) {
    return { device_type: "Printer", device_icon: "Printer", device_color: "#F48FB1" };
  }
  if (portSet.has(1883) || portSet.has(8883) || tagLower.includes("iot")) {
    return { device_type: "IoT Device", device_icon: "Cpu", device_color: "#39FF14" };
  }
  if (portSet.has(5060) || portSet.has(5061)) {
    return { device_type: "VoIP/SIP", device_icon: "Phone", device_color: "#87CEEB" };
  }
  if (cpeLower.some((c) => /mikrotik|ubiquiti|cisco|juniper|fortinet/.test(c)) ||
      portSet.has(161) || portSet.has(8291)) {
    return { device_type: "Router/Switch", device_icon: "Router", device_color: "#00E5FF" };
  }
  if (portSet.has(3306) || portSet.has(5432) || portSet.has(27017) ||
      portSet.has(6379) || portSet.has(9200) || portSet.has(5984)) {
    return { device_type: "Database", device_icon: "Database", device_color: "#FF6B00" };
  }
  if (portSet.has(25) || portSet.has(587) || portSet.has(993) ||
      portSet.has(995) || portSet.has(110) || portSet.has(143)) {
    return { device_type: "Mail Server", device_icon: "Mail", device_color: "#FF9500" };
  }
  if (portSet.has(53)) return { device_type: "DNS Server", device_icon: "Server", device_color: "#00BCD4" };
  if (portSet.has(21) || portSet.has(990)) return { device_type: "FTP Server", device_icon: "HardDrive", device_color: "#FFD700" };
  if (portSet.has(1194) || portSet.has(1723) || portSet.has(500) || portSet.has(4500) ||
      cpeLower.some((c) => /openvpn|wireguard/.test(c))) {
    return { device_type: "VPN Gateway", device_icon: "ShieldCheck", device_color: "#D4AF37" };
  }
  if (portSet.has(3389)) return { device_type: "Windows Workstation", device_icon: "Monitor", device_color: "#E040FB" };
  if (portSet.has(22) && !portSet.has(80) && !portSet.has(443)) {
    return { device_type: "Linux Server", device_icon: "Terminal", device_color: "#76FF03" };
  }
  if (portSet.has(80) || portSet.has(443) || portSet.has(8080) || portSet.has(8443)) {
    return { device_type: "Web Server", device_icon: "Globe", device_color: "#448AFF" };
  }
  return { device_type: "Unknown Host", device_icon: "CircleDot", device_color: "#666666" };
}

function assessRisk(device: { ports: number[]; vulns: string[] }) {
  const portSet = new Set(device.ports);
  if (device.vulns.length > 5) return "CRITICAL";
  if (device.vulns.length > 0) return "HIGH";
  if (portSet.has(23) || portSet.has(21) || portSet.has(161)) return "MEDIUM";
  if (device.ports.length > 5) return "LOW";
  return "INFO";
}

interface ShodanInternetDBResponse {
  cpes: string[]; hostnames: string[]; ip: string;
  ports: number[]; tags: string[]; vulns: string[];
}
interface IpApiSweepResponse {
  status?: "success" | "fail";
  message?: string;
  lat?: number; lon?: number;
  city?: string; regionName?: string;
  country?: string; countryCode?: string;
  isp?: string; as?: string; org?: string;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const ip = searchParams.get("ip");
  if (!ip) {
    return new Response(JSON.stringify({ error: "Missing ip parameter" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const octets = parseIPv4Octets(ip);
  if (!octets) {
    return new Response(JSON.stringify({ error: "Invalid IPv4 address format" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (isPrivateOrReserved(octets)) {
    return new Response(
      JSON.stringify({ error: "Private and reserved IP ranges are not allowed" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let cidr = 24;
  const cidrParam = searchParams.get("cidr");
  if (cidrParam) {
    cidr = parseInt(cidrParam, 10);
    if (isNaN(cidr) || cidr < 24 || cidr > 32) {
      return new Response(JSON.stringify({ error: "CIDR must be between 24 and 32" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const requesterIp = getClientIp(req);
  if (!checkSweepRateLimit(requesterIp)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Max 2 sweeps per minute." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const geoRes = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,isp,org,as,proxy,hosting`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!geoRes.ok) {
      return new Response(JSON.stringify({ error: "Geolocation service unavailable" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const geoData = (await geoRes.json()) as IpApiSweepResponse;
    if (geoData.status === "fail") {
      return new Response(
        JSON.stringify({ error: `Geolocation failed: ${geoData.message ?? "Unknown error"}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const center = {
      lat: geoData.lat ?? 0, lng: geoData.lon ?? 0,
      city: geoData.city ?? "", region: geoData.regionName ?? "",
      country: geoData.country ?? "", countryCode: geoData.countryCode ?? "",
      isp: geoData.isp ?? "", asn: geoData.as ?? "", org: geoData.org ?? "",
    };

    const ipNum = ipToNumber(octets);
    const subnetStart = calculateSubnetStart(ipNum, cidr);
    const totalHosts = Math.pow(2, 32 - cidr);
    const subnet = numberToIp(subnetStart);

    const urls: string[] = [];
    for (let i = 0; i < totalHosts; i++) {
      const currentIp = numberToIp((subnetStart + i) >>> 0);
      urls.push(`https://internetdb.shodan.io/${currentIp}`);
    }

    const shodanResults = await batchFetch<ShodanInternetDBResponse>(
      urls, 20,
      async (url) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
          if (res.status === 404) return null;
          if (!res.ok) return null;
          return (await res.json()) as ShodanInternetDBResponse;
        } catch {
          return null;
        }
      },
    );

    const devices: Array<{
      ip: string; ports: number[]; hostnames: string[];
      cpes: string[]; vulns: string[]; tags: string[];
      device_type: string; device_icon: string; device_color: string;
      risk_level: string;
    }> = [];
    const deviceBreakdown: Record<string, number> = {};

    for (const result of shodanResults) {
      if (!result) continue;
      const classification = classifyDevice(result.ports, result.cpes, result.tags);
      const risk = assessRisk({ ports: result.ports, vulns: result.vulns });
      devices.push({
        ip: result.ip,
        ports: result.ports,
        hostnames: result.hostnames,
        cpes: result.cpes,
        vulns: result.vulns,
        tags: result.tags,
        ...classification,
        risk_level: risk,
      });
      deviceBreakdown[classification.device_type] =
        (deviceBreakdown[classification.device_type] ?? 0) + 1;
    }

    return new Response(
      JSON.stringify({
        center,
        subnet: `${subnet}/${cidr}`,
        cidr,
        target_ip: ip,
        devices,
        summary: {
          total_hosts: totalHosts,
          total_responsive: devices.length,
          device_breakdown: deviceBreakdown,
        },
        sweep_time_ms: Date.now() - startTime,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (err) {
    console.error("[intel-osint-sweep]", err);
    return new Response(JSON.stringify({ error: "Sweep failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
