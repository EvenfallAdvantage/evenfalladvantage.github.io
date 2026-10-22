# Two-factor authentication (TOTP)

- Built on Supabase Auth MFA (`auth.mfa.enroll / challengeAndVerify / unenroll`). Factors are stored by Supabase in `auth.mfa_factors`; Overwatch stores nothing.
- **Profile → Two-factor authentication**: any user can add an authenticator app (QR or setup key), add a backup authenticator, or remove one.
- **Sign-in**: `MfaGate` (inside `AuthGuard`) asks for the code whenever the session is AAL1 but the account has a verified factor (`nextLevel = aal2`). Works for password, magic-link and invite sign-ins.
- **Admin → Security → "Require 2FA for owners and admins"**: stored as `companies.settings.require_mfa_admins`. Owners/admins of that company without a factor must set one up before continuing. The toggle can only be turned on by an admin who already has 2FA.
- Audit events: `auth.mfa.enabled`, `auth.mfa.disabled`, failed codes as `auth.login.failed` (method `totp`).

## Limits / next step
The gate is client-side. For server-side enforcement, add RLS checks on sensitive admin tables such as
`(auth.jwt()->>'aal') = 'aal2' OR NOT public.company_requires_mfa(company_id)` — a separate migration that needs review.
Recovery: an owner who loses their phone and is the only admin needs a Supabase dashboard reset of their factors (document in the IRP).

## Server-side enforcement (draft migration 20261022000000, not applied)

`overwatch-src/supabase/migrations/20261022000000_server_side_mfa_enforcement.sql` makes the database
enforce what `MfaGate` does in the browser. When `companies.settings.require_mfa_admins` is `true`,
an owner/admin of that company whose JWT has `aal` other than `aal2`:

- sees no rows in, and cannot write, `api_keys`, `integrations_config`, `integration_connections`, `audit_logs`, `invoices`;
- cannot insert/update/delete `companies`, `company_memberships`, `timesheets` (reads stay open so the app can show the 2FA prompt);
- gets `42501 Two-factor verification required` from the admin RPCs `set_member_pay_rate`,
  `update_member_admin_profile`, `update_member_role`, `remove_company_member`, `create_roster_member`,
  `add_client_member`, `convert_applicant_to_roster`, `get_company_join_code`.

Staff, other companies and `service_role` are unaffected. Helpers: `mfa_enforced_for_me(uuid)`, `mfa_ok(uuid)`,
`assert_mfa_for_company(uuid)` (SECURITY DEFINER, `search_path=''`, no anon execute).

Tested 2026-10-21 with `supabase/tests/server_side_mfa_rolledback_test.sql` (ZZTEST Field QA only, rolled back)
on a local restore and on OverwatchDB: aal1 owner -> 0 audit rows, company update 0 rows, RPC blocked;
aal2 -> 50 rows, update 1, RPC allowed; flag off -> aal1 allowed. Rollback file restores the exact prior RPC
bodies (verified by hash on the local copy).

Not covered yet: Edge Functions called by admins run as `service_role` (roster-invite, email/sms settings);
they need their own aal check on the caller's JWT.
