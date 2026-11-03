/** Group expiring/expired certs by person for the dashboard Compliance card. */
export type CertLike = { certId: string; userId: string; userName: string; certType: string; expiryDate: string; daysUntilExpiry: number };

export type Bucket = "expired" | "d30" | "d60" | "d90";

export function certBucket(days: number): Bucket {
  if (days <= 0) return "expired";
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  return "d90";
}

export type PersonCerts<T extends CertLike = CertLike> = {
  userId: string;
  userName: string;
  certs: T[];
  expired: number;
  expiring: number;
  /** Most urgent days-until-expiry across this person's certs. */
  worstDays: number;
};

export function groupCertsByPerson<T extends CertLike>(certs: T[]): PersonCerts<T>[] {
  const map = new Map<string, PersonCerts<T>>();
  for (const c of certs) {
    const p = map.get(c.userId) ?? { userId: c.userId, userName: c.userName, certs: [], expired: 0, expiring: 0, worstDays: Infinity };
    p.certs.push(c);
    if (c.daysUntilExpiry <= 0) p.expired++; else p.expiring++;
    p.worstDays = Math.min(p.worstDays, c.daysUntilExpiry);
    map.set(c.userId, p);
  }
  for (const p of map.values()) p.certs.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  return [...map.values()].sort((a, b) => a.worstDays - b.worstDays || b.certs.length - a.certs.length || a.userName.localeCompare(b.userName));
}

export function bucketCounts(certs: CertLike[]): Record<Bucket, number> {
  const out: Record<Bucket, number> = { expired: 0, d30: 0, d60: 0, d90: 0 };
  for (const c of certs) out[certBucket(c.daysUntilExpiry)]++;
  return out;
}
