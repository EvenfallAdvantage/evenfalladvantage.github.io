# Vendor Risk Assessment

**Evenfall Advantage LLC — Overwatch Platform**
**Effective Date:** April 5, 2026
**Last Reviewed:** April 5, 2026
**Owner:** James Ferguson, CTO

---

## 1. Purpose

This document assesses the security posture of third-party vendors that process, store, or transmit data on behalf of the Overwatch platform.

## 2. Vendor Inventory

| Vendor | Service | Data Processed | Criticality |
|--------|---------|---------------|-------------|
| **Supabase** | Database, Auth, Storage, Edge Functions | All platform data (PII, operational, financial references) | Critical |
| **Stripe** | Payment processing | Payment card data, transaction records | High |
| **GitHub** | Source code hosting, CI/CD | Source code, deployment artifacts, secrets | Critical |
| **Resend** | Transactional email | Email addresses, names, email content | Medium |
| **Cloudflare** | CDN, DNS, analytics | IP addresses, page views (anonymized) | Low |
| **Nominatim (OSM)** | Geocoding / address lookup | Addresses (public data, no PII stored) | Low |
| **Google Fonts** | Web fonts | IP addresses (standard web request) | Low |

## 3. Risk Assessments

### 3.1 Supabase (Critical)

| Criteria | Assessment | Evidence |
|----------|-----------|----------|
| SOC 2 Type II | Yes | [Supabase Security Page](https://supabase.com/security) |
| Data encryption at rest | Yes | PostgreSQL with AES-256; all storage encrypted |
| Data encryption in transit | Yes | TLS 1.2+ enforced on all connections |
| Data residency | US (AWS us-east-1) | Configurable per project |
| Access controls | Yes | RLS, JWT, API keys, Dashboard MFA |
| Backup / PITR | Yes | Point-in-time recovery enabled |
| DPA available | Yes | [Supabase DPA](https://supabase.com/legal/dpa) |
| Incident notification | Yes | Via status page and email |
| Subprocessors | AWS, Fly.io | Listed on Supabase legal page |

**Risk Level:** Low (SOC 2 certified, encryption, DPA available)
**Action Required:** Execute DPA

### 3.2 Stripe (High)

| Criteria | Assessment | Evidence |
|----------|-----------|----------|
| PCI-DSS Level 1 | Yes | [Stripe Security](https://stripe.com/docs/security) |
| SOC 2 Type II | Yes | Available on request |
| Data encryption | Yes | All data encrypted at rest and in transit |
| Tokenization | Yes | Card numbers never touch our servers |
| Webhook signatures | Yes | Implemented and enforced in our code |
| DPA available | Yes | [Stripe DPA](https://stripe.com/legal/dpa) |

**Risk Level:** Very Low (PCI Level 1, SOC 2, industry leader)
**Action Required:** Execute DPA

### 3.3 GitHub (Critical)

| Criteria | Assessment | Evidence |
|----------|-----------|----------|
| SOC 2 Type II | Yes | [GitHub Security](https://github.com/security) |
| Data encryption | Yes | At rest (AES-256) and in transit (TLS) |
| Access controls | Yes | 2FA enforced, branch protection, org-level controls |
| Secrets management | Yes | GitHub Secrets (encrypted, not exposed in logs) |
| Code scanning | Yes | CodeQL, Dependabot (we've enabled both) |
| DPA available | Yes | [GitHub DPA](https://github.com/customer-terms) |

**Risk Level:** Very Low (SOC 2, industry standard)
**Action Required:** Execute DPA; enforce 2FA for all org members

### 3.4 Resend (Medium)

| Criteria | Assessment | Evidence |
|----------|-----------|----------|
| SOC 2 | In progress | [Resend Security](https://resend.com/security) |
| Data encryption | Yes | TLS for all API calls |
| Data retention | Emails retained per Resend policy | Review their retention terms |
| DPA available | Yes | Available on request |

**Risk Level:** Medium (newer service, SOC 2 in progress)
**Action Required:** Execute DPA; review data retention terms; monitor SOC 2 progress

### 3.5 Cloudflare (Low)

| Criteria | Assessment | Evidence |
|----------|-----------|----------|
| SOC 2 Type II | Yes | [Cloudflare Compliance](https://www.cloudflare.com/trust-hub/) |
| Data processed | IP addresses, page analytics (anonymized) | Web Analytics beacon |
| DPA available | Yes | Available on compliance page |

**Risk Level:** Very Low (SOC 2, minimal data processing)
**Action Required:** None critical

### 3.6 Nominatim / OpenStreetMap (Low)

| Criteria | Assessment | Evidence |
|----------|-----------|----------|
| Data processed | Address queries (public data) | No PII stored by the service |
| Encryption in transit | Yes | HTTPS |
| Rate limiting | Community guidelines | Using User-Agent header as required |

**Risk Level:** Very Low (public data, no PII retention)
**Action Required:** None

## 4. DPA Status Tracker

| Vendor | DPA Required | DPA Executed | Date |
|--------|-------------|-------------|------|
| Supabase | Yes | Pending | — |
| Stripe | Yes | Pending | — |
| GitHub | Yes | Pending | — |
| Resend | Yes | Pending | — |
| Cloudflare | No (minimal data) | N/A | — |
| Nominatim | No (public data) | N/A | — |

## 5. Annual Review

- All vendor assessments reviewed annually
- New vendors assessed before onboarding
- Vendor SOC 2 reports requested annually where applicable
- DPA status verified annually

---

**Approved by:** James Ferguson, CTO
**Date:** April 5, 2026
