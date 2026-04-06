# Threat Model — Overwatch Platform

**Evenfall Advantage LLC**
**Methodology:** STRIDE
**Last Updated:** April 6, 2026
**Owner:** James Ferguson, CTO

---

## 1. System Overview

Overwatch is a multi-tenant SaaS workforce management platform serving security companies. It processes PII, operational data, financial references, and certification records.

### Architecture Components
- **Frontend:** Static Next.js app served via GitHub Pages (CDN)
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Payments:** Stripe (tokenized, PCI Level 1)
- **Email:** Resend (transactional email)
- **Monitoring:** UptimeRobot + built-in error_logs

### Trust Boundaries
1. **Public Internet → GitHub Pages CDN** (static assets, no server processing)
2. **Browser → Supabase API** (JWT-authenticated, RLS-enforced)
3. **Browser → Edge Functions** (JWT + admin role verification)
4. **Edge Functions → Supabase (service role)** (privileged, server-side only)
5. **Browser → Stripe** (tokenized card data, never touches our servers)
6. **Admin Dashboard → Supabase Dashboard** (separate auth, MFA required)

### Data Flows
```
User Browser ──JWT──→ Supabase PostgREST ──RLS──→ PostgreSQL
User Browser ──JWT──→ Edge Functions ──service_role──→ PostgreSQL
User Browser ──────→ Stripe.js (tokenized) ──→ Stripe API
Edge Function ──webhook_secret──→ Stripe webhook verification
Edge Function ──api_key──→ Resend email delivery
```

## 2. STRIDE Analysis

### S — Spoofing (Identity)

| Threat | Target | Likelihood | Impact | Mitigation | Status |
|--------|--------|-----------|--------|------------|--------|
| Stolen JWT token | Supabase API | Medium | High | Short session expiry; session lock on inactivity; leaked password protection | Mitigated |
| Password brute force | Auth endpoint | Medium | High | Brute force protection (lockout); 12-char minimum; HaveIBeenPwned check | Mitigated |
| Session hijacking | Browser | Low | High | HTTPS-only; HttpOnly cookies; SameSite strict | Mitigated |
| Phishing for credentials | Users | Medium | High | Security awareness training; MFA recommended | Partially mitigated |

### T — Tampering (Data Integrity)

| Threat | Target | Likelihood | Impact | Mitigation | Status |
|--------|--------|-----------|--------|------------|--------|
| XSS payload injection | Database fields | Low | High | escapeHTML/escapeAttr on all 52 innerHTML vectors; CSP headers | Mitigated |
| Unsigned webhook abuse | Payment flow | Low | Critical | Stripe webhook signature verification; no unsigned fallback | Mitigated |
| Direct database manipulation | PostgreSQL | Very Low | Critical | RLS on all tables; service role key only in Edge Functions | Mitigated |
| API request tampering | Supabase API | Low | Medium | HTTPS/TLS; JWT verification; parameterized queries | Mitigated |

### R — Repudiation (Audit Trail)

| Threat | Target | Likelihood | Impact | Mitigation | Status |
|--------|--------|-----------|--------|------------|--------|
| User denies performing action | Operations | Medium | Medium | Audit logging (security-audit.ts, 90-day retention) | Mitigated |
| Timesheet manipulation | Payroll | Medium | High | Approval workflow; audit trail; timesheet corrections with reason | Mitigated |
| Admin denies privilege abuse | System | Low | High | All admin actions logged; Edge Function admin verification | Mitigated |

### I — Information Disclosure

| Threat | Target | Likelihood | Impact | Mitigation | Status |
|--------|--------|-----------|--------|------------|--------|
| Cross-company data leakage | Multi-tenant data | Low | Critical | All queries filter by company_id; RLS with is_company_member(); tested | Mitigated |
| API key exposure in source | GitHub repo | Low | Critical | .gitignore; GitHub Secrets; Gemini key removed; no service keys in client | Mitigated |
| Verbose error messages | Browser console | Medium | Low | Error boundary catches render errors; production builds strip dev info | Partially mitigated |
| Unauthorized data export | Customer data | Low | High | RBAC restricts export to admin/owner; CSV exports logged | Mitigated |

### D — Denial of Service

| Threat | Target | Likelihood | Impact | Mitigation | Status |
|--------|--------|-----------|--------|------------|--------|
| API rate limiting exhaustion | Supabase | Low | Medium | Supabase built-in rate limits; join code rate limiting | Partially mitigated |
| Static site DDoS | GitHub Pages | Low | Medium | GitHub/Cloudflare DDoS protection; CDN distribution | Mitigated |
| Edge Function abuse | Supabase Functions | Medium | Medium | JWT required; admin verification; CORS restrictions | Mitigated |

### E — Elevation of Privilege

| Threat | Target | Likelihood | Impact | Mitigation | Status |
|--------|--------|-----------|--------|------------|--------|
| Admin self-promotion | administrators table | Low | Critical | RLS INSERT policy: only existing admins can insert | Mitigated |
| Role escalation via API | company_memberships | Low | Critical | RLS prevents role changes; only owner can modify roles | Mitigated |
| Edge Function bypass | Privileged operations | Low | High | JWT + admin table verification on create-student, delete-student, send-email | Mitigated |
| Feature flag bypass | Hidden features | Low | Low | Server-side feature visibility; trainingProviderOnly enforcement | Mitigated |

## 3. Risk Summary

| STRIDE Category | Threats | Mitigated | Partially | Open |
|----------------|---------|-----------|-----------|------|
| Spoofing | 4 | 3 | 1 | 0 |
| Tampering | 4 | 4 | 0 | 0 |
| Repudiation | 3 | 3 | 0 | 0 |
| Information Disclosure | 4 | 3 | 1 | 0 |
| Denial of Service | 3 | 2 | 1 | 0 |
| Elevation of Privilege | 4 | 4 | 0 | 0 |
| **Total** | **22** | **19** | **3** | **0** |

## 4. Residual Risks (Partially Mitigated)

| Risk | Current State | Recommended Action |
|------|--------------|-------------------|
| Phishing attacks | Training program created; MFA recommended but not enforced | Enforce MFA for admin/owner roles; conduct phishing simulation |
| Verbose error messages | Error boundary + production builds; some stack traces in console | Review browser console output; add source map protection |
| API rate limiting | Supabase defaults + join code rate limit | Implement per-user rate limiting on sensitive endpoints |

## 5. Review

This threat model is reviewed:
- Annually (full review)
- When significant architecture changes occur
- After any P1/P2 security incident

---

**Approved by:** James Ferguson, CTO
**Date:** April 6, 2026
