# Quarterly Access Review Checklist

**Evenfall Advantage LLC — Overwatch Platform**
**Review Period:** [Q1/Q2/Q3/Q4 Year]
**Reviewer:** [Name]
**Date:** [Date]

---

## 1. Supabase Dashboard Access

| User | Access Level | Justified? | Action |
|------|-------------|-----------|--------|
| | | Yes / No | Keep / Revoke / Downgrade |

**Verify:**
- [ ] Only authorized personnel have Supabase Dashboard access
- [ ] No shared accounts
- [ ] MFA enabled for all dashboard users

## 2. GitHub Repository Access

| User | Access Level | Justified? | Action |
|------|-------------|-----------|--------|
| | | Yes / No | Keep / Revoke / Downgrade |

**Verify:**
- [ ] Only authorized personnel have repo access
- [ ] No stale collaborator accounts
- [ ] Branch protection active on main
- [ ] 2FA enabled for all org members

## 3. Stripe Dashboard Access

| User | Access Level | Justified? | Action |
|------|-------------|-----------|--------|
| | | Yes / No | Keep / Revoke / Downgrade |

**Verify:**
- [ ] Only authorized personnel have Stripe access
- [ ] 2FA enabled

## 4. Overwatch Admin/Owner Accounts

| Company | User | Role | Justified? | Action |
|---------|------|------|-----------|--------|
| | | | Yes / No | Keep / Downgrade |

**Verify:**
- [ ] All owner-level accounts are justified
- [ ] All admin-level accounts are justified
- [ ] No former employees retain access
- [ ] Terminated users removed within 24 hours

## 5. API Keys and Secrets

- [ ] GitHub Secrets reviewed (no stale keys)
- [ ] Supabase service role key not exposed anywhere
- [ ] Stripe keys rotated if any suspected compromise
- [ ] No API keys committed to source code (verify with `git log --all -p | grep -i "sk_"`)

## 6. Sign-off

| Name | Role | Date |
|------|------|------|
| | | |

---

**Next Review Due:** [Quarter + 1]
