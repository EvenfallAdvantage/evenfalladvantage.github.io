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
