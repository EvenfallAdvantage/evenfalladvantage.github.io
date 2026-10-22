# Sub-processor DPA checklist — October 2026

| Vendor | Use | DPA | How it's executed | Action for owner | Done |
|---|---|---|---|---|---|
| OneSignal | Push notifications | https://onesignal.com/dpa | Incorporated into its terms; DPA/SCCs covered under paid plans | If on free plan or a signed copy is needed, email privacy@onesignal.com; save PDF | ☐ |
| Twilio | SMS / OTP | https://www.twilio.com/en-us/legal/data-protection-addendum | Automatic via its terms, no signature | Download and file a copy of the current version | ☐ |
| Airtable | Legacy data / intake | https://www.airtable.com/company/dpa | **Must be signed:** form at https://airtable.com/dpaform (DocuSign) | Submit the form as the account owner; file the countersigned PDF | ☐ |
| Cloudflare | DNS / CDN / Workers | https://www.cloudflare.com/cloudflare-customer-dpa/ (v6.4) | Incorporated into the self-serve agreement; can also be accepted in Dashboard → Configurations → Preferences | Accept in the dashboard and file a copy | ☐ |
| Resend | Transactional email | https://resend.com/legal/dpa | Pre-signed on sign-up | Download from Resend → Settings → Documents (also has the SOC 2 Type II report and pen-test letter) | ☐ |

Also do:
- List all five (plus Supabase, GitHub Pages and Google) as sub-processors in the privacy policy (PR #169, pending lawyer review).
- Record the transfer mechanism (EU SCCs / DPF) for each vendor and review every year.
- Store the signed PDFs in a private drive, not in this public repo.
