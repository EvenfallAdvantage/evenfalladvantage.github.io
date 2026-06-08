# Enterprise SSO (Single Sign-On)

Phase 6.1 — Enterprise Single Sign-On with SAML 2.0.

## TL;DR

- Supabase Auth supports SAML 2.0 enterprise SSO **on Pro plan and above** (50 SSO MAU included; `$0.015 / MAU` over).
- For Overwatch to offer SSO to enterprise customers, the **Supabase project's organization must be on the Pro plan or higher.**
- Setup is a **dashboard configuration task**, not application code. We do not check this in.
- This document describes the prerequisites, the per-customer onboarding steps, and the app-side hooks that already work.

## Plan tier requirements

| Plan | Quota | Over-usage |
|------|-------|------------|
| Free | Not included | n/a |
| Pro  | 50 SSO MAU | `$0.015` / SSO MAU |
| Team | 50 SSO MAU | `$0.015` / SSO MAU |
| Enterprise | Custom | Contact Supabase |

(Source: https://supabase.com/pricing — confirmed June 2026.)

The Overwatch production project (`nneueuvyeohwnspbwfub`) must be on Pro or higher before SAML can be enabled in the Supabase dashboard. Verify by going to:

- Supabase Dashboard → Project → Authentication → Providers → "SAML 2.0"

If the SAML 2.0 section says "Available on Pro plans and above", upgrade the org before continuing.

## Supported identity providers

SAML 2.0-compliant providers we have verified docs for:

- Microsoft Entra ID (Azure AD)
- Google Workspace
- Okta
- OneLogin
- JumpCloud
- PingFederate
- Any IdP that supports SAML 2.0 SP-initiated or IdP-initiated flow

## Per-customer onboarding (manual; do once per enterprise client)

This is a **runbook for a deploy engineer**, not an automated flow.

1. **In the customer's IdP** (e.g. Entra ID admin center):
   - Create an Enterprise Application with SAML 2.0.
   - Identifier (Entity ID): `https://nneueuvyeohwnspbwfub.supabase.co/auth/v1/sso/saml/metadata`
   - Reply URL (ACS): `https://nneueuvyeohwnspbwfub.supabase.co/auth/v1/sso/saml/acs`
   - Sign on URL: `https://overwatch.evenfalladvantage.com/login` (or the customer's custom domain)
   - Required SAML attributes:
     - `email` (NameID format: emailAddress)
     - `first_name`
     - `last_name`
   - Download the IdP's metadata XML or copy the SAML SSO URL + signing certificate.

2. **In the Supabase dashboard** (Authentication → SSO):
   - Click "Add provider".
   - Choose the customer's IdP type.
   - Paste the metadata XML, or the SSO URL + signing cert.
   - Set the **Domain** to the customer's email domain (e.g. `acme-security.com`). Users from that domain will be auto-routed to SSO.
   - Save.

3. **In the Overwatch application**:
   - No code changes are required. Supabase Auth handles the entire flow:
     - User clicks "Sign in with SSO" on `/login` (button visible when the email domain matches a configured IdP).
     - Browser is redirected to the IdP.
     - On successful IdP auth, the user lands back on `/auth/callback` with a valid Supabase session.
     - Our existing post-login provisioning (`ensureInternalUser` in `db-helpers.ts`) creates a `users` row from the SAML attributes and the user picks a company on the join screen.

## App-side hooks that already work for SSO

- `/auth/callback` page already redirects authenticated users to `/feed`.
- `ensureInternalUser` creates `public.users` rows for any Supabase Auth user (OAuth, SAML, email/password — all the same).
- `company_memberships` enforces multi-tenancy regardless of auth method.
- Audit log captures `auth.login.success` for any login including SSO.

## What is **NOT** implemented

- We do not have a "Sign in with SSO" button on `/login`. Supabase Auth shows it automatically when the user types an email whose domain matches a configured IdP. If we want an explicit "Use my organization's SSO" button, that's a small UI add — see follow-up issue.
- We do not have an admin UI for customers to self-serve enable SSO. Per-customer setup is a deploy-engineer task.
- We do not auto-sync group memberships from SAML attributes. Companies are still picked in-app.

## Audit & compliance

- Each SSO login emits `auth.login.success` to `audit_logs` with `metadata.provider = "saml"`.
- For SOC2/ISO 27001 evidence, the customer's IdP is the source of truth for who can log in; our `company_memberships` is the source of truth for what they can do.
- HIPAA add-on, SOC2/ISO 27001 reports, and SAML signing-cert rotation are platform-tier concerns owned by Supabase (Team plan or above).

## When to revisit

- Before the first enterprise customer goes live.
- If a customer requires SCIM (user provisioning) — that's a separate Supabase Auth feature not yet enabled.
- If we offer per-tenant custom domains (`<customer>.overwatch.app`), the SAML ACS URL must be updated accordingly.

---

**Status:** documented prerequisite. No code changes in this commit.
