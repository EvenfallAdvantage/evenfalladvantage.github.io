# Subprocessor List

**Evenfall Advantage LLC — Overwatch Platform**
**Last Updated:** October 21, 2026

---

The following third-party service providers ("subprocessors") process data on behalf of Evenfall Advantage LLC in connection with the Overwatch platform.

| Subprocessor | Service | Data Processed | Location | DPA Executed |
|-------------|---------|---------------|----------|-------------|
| **Supabase, Inc.** | Database, authentication, file storage, serverless functions | All platform data including user PII, operational data, documents | US (AWS us-east-1) | Yes (Apr 2026) |
| **Stripe, Inc.** | Payment processing | Payment card data (tokenized), transaction records, customer billing info (payments not live yet) | US | Yes (Apr 2026) |
| **GitHub, Inc.** | Source code hosting, CI/CD, static site hosting | Source code, deployment artifacts, CI/CD secrets | US (Azure) | Yes (Apr 2026) |
| **Resend, Inc.** | Transactional email delivery | Email addresses, names, email content (welcome emails, notifications) | US | Yes (Apr 2026). Signed copy not yet filed |
| **Cloudflare, Inc.** | DNS, CDN/reverse proxy, WAF/bot protection, web analytics | All web traffic passes through Cloudflare (IP addresses, request headers/URLs, page views) | Global | Not yet: Cloudflare DPA (self-serve terms) to be accepted and filed |
| **OneSignal, Inc.** | Push notifications | Device push tokens, user/account ID, notification content (alerts, SOS, reminders) | US | Not yet: to be executed and filed |
| **Twilio Inc.** | SMS delivery (where configured) | Phone numbers, SMS content (alerts) | US | Not yet: to be executed and filed |
| **Airtable (Formagrid, Inc.)** | Customer-configured data import/sync | Records a customer chooses to sync (for example, staff names, contact details, schedules) | US | Not yet: to be executed and filed |
| **OpenStreetMap / Nominatim** | Address geocoding | Address queries (public data, not stored) | EU (community) | N/A (public API) |
| **Google Fonts** | Web font delivery | IP addresses (standard HTTP request) | Global | N/A (minimal data) |

Signed DPAs are kept in a private compliance repository and are not published.

## Changes

We will notify customers of any material changes to this list. Changes are tracked in this document's git history.

## Contact

For questions about our subprocessors: contact@evenfalladvantage.com
