# Risk Assessment Template

**Evenfall Advantage LLC — Overwatch Platform**
**Assessment Period:** [Quarter/Year]
**Assessor:** [Name]
**Date:** [Date]

---

## 1. Asset Inventory

| Asset | Classification | Owner | Location |
|-------|---------------|-------|----------|
| Overwatch application | Critical | CTO | GitHub Pages + Supabase |
| Customer PII database | Restricted | CTO | Supabase (OverwatchDB) |
| Legacy training database | Confidential | CTO | Supabase (EADB) |
| Source code repository | Internal | CTO | GitHub |
| Payment processing | Restricted | CTO | Stripe |
| Email service | Internal | CTO | Resend |

## 2. Threat Identification

| # | Threat | Likelihood (1-5) | Impact (1-5) | Risk Score | Mitigation |
|---|--------|-------------------|--------------|------------|------------|
| 1 | Data breach via SQL injection | 1 | 5 | 5 | Supabase RLS + parameterized queries; no raw SQL from client |
| 2 | XSS attack | 1 | 4 | 4 | escapeHTML/escapeAttr on 52 vectors; CSP headers |
| 3 | Unauthorized API access | 1 | 4 | 4 | JWT verification; admin role checks; CORS restrictions |
| 4 | Credential compromise | 2 | 5 | 10 | 12-char min password; HaveIBeenPwned; session timeout; brute force protection |
| 5 | Cross-company data leakage | 1 | 5 | 5 | All queries filter by company_id; RLS policies |
| 6 | Insider threat | 2 | 4 | 8 | RBAC (4-tier); audit logging; quarterly access reviews |
| 7 | Service outage (Supabase) | 2 | 4 | 8 | PITR backups; service worker offline fallback; UptimeRobot monitoring |
| 8 | Supply chain attack (npm) | 2 | 3 | 6 | Dependabot; CodeQL; npm audit in CI |
| 9 | Stripe payment fraud | 2 | 3 | 6 | Webhook signature verification; no unsigned fallback |
| 10 | API key exposure | 1 | 5 | 5 | No keys in source; .gitignore; GitHub Secrets; localStorage for AI keys |

**Risk Score:** Likelihood x Impact (1-25 scale)
**Acceptable Risk Threshold:** 8

## 3. Risk Treatment

| Risk Score | Treatment |
|-----------|-----------|
| 1-4 | Accept — monitor |
| 5-8 | Mitigate — implement additional controls |
| 9-15 | Treat — prioritize remediation |
| 16-25 | Critical — immediate action required |

## 4. Action Items

| # | Action | Owner | Due Date | Status |
|---|--------|-------|----------|--------|
| | | | | |

## 5. Sign-off

| Name | Role | Date |
|------|------|------|
| James Ferguson | CTO | |

---

**Next Assessment Due:** [Quarterly]
