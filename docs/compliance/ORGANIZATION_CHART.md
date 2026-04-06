# Organization Chart — Security Responsibilities

**Evenfall Advantage LLC**
**Last Updated:** April 6, 2026

---

## Security Organization Structure

```
┌─────────────────────────────────────────┐
│           CEO / Managing Member         │
│          (Executive Oversight)          │
│                                         │
│  • Final authority on security policy   │
│  • Budget approval for security tools   │
│  • Customer communication for P1 events │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────┴─────────────────────┐
│        CTO / Security Lead              │
│        James Ferguson                   │
│                                         │
│  • Information Security Officer         │
│  • Incident Commander                   │
│  • SOC 2 compliance owner              │
│  • Access control administration        │
│  • Vulnerability management             │
│  • Vendor risk assessment               │
│  • Security architecture decisions      │
│  • Code review + deployment authority   │
└───────────────────┬─────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────┴──────────┐  ┌────────┴─────────┐
│  Development     │  │  Operations      │
│  Team            │  │  Team            │
│                  │  │                  │
│ • Secure coding  │  │ • Field security │
│ • Code reviews   │  │ • Incident       │
│ • Testing        │  │   reporting      │
│ • Dependency     │  │ • Data handling  │
│   updates        │  │   per policy     │
│ • Bug fixes      │  │ • Device         │
│                  │  │   security       │
└──────────────────┘  └──────────────────┘
```

## Role-Based Security Responsibilities

| Role | Platform Access | Security Responsibilities |
|------|----------------|--------------------------|
| **CEO / Managing Member** | Owner (all companies) | Executive oversight, budget approval, regulatory liaison |
| **CTO / Security Lead** | Owner + Supabase/GitHub/Stripe admin | All security operations, incident response, compliance, architecture |
| **Senior Developer** | Admin (assigned companies) + GitHub write | Code review, secure development, vulnerability remediation, deployment |
| **Developer** | Manager/Staff (assigned companies) + GitHub write | Secure coding practices, testing, dependency updates |
| **Operations Manager** | Admin (assigned companies) | Personnel management, timesheet approval, incident oversight |
| **Field Staff** | Staff (assigned companies) | Incident reporting, data handling per policy, device security |

## Key Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Information Security Officer | James Ferguson | contact@evenfalladvantage.com | On file |
| Incident Commander (primary) | James Ferguson | contact@evenfalladvantage.com | On file |
| Incident Commander (backup) | TBD | — | — |

## Segregation of Duties

| Function | Primary | Backup |
|----------|---------|--------|
| Supabase Dashboard access | CTO | CEO |
| GitHub repository admin | CTO | CEO |
| Stripe Dashboard admin | CTO | CEO |
| Edge Function deployment | CTO | Senior Dev |
| DNS / domain management | CTO | CEO |
| Incident response | CTO | Operations Manager |
| Access reviews | CTO | CEO |
| Policy approval | CTO + CEO | — |

## Review

This chart is reviewed quarterly during access reviews and updated when organizational changes occur.
