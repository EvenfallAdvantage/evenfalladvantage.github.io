# Intake Ingest API

**Status:** Phase 1 — Generally Available
**Endpoint:** `POST <SUPABASE_URL>/functions/v1/intake-ingest`
**Auth:** Bearer API key
**Rate limit:** 100 requests / minute per key

The Intake Ingest API lets companies submit client intake leads into Overwatch
from their own websites, third-party form services, no-code automation tools
(Zapier / Make / n8n), or any HTTP client. Submissions appear in the
**Operation Planning → Request from Client** modal alongside hosted-form
submissions.

## When to use which intake method

| Method | Best for | Effort |
|--------|----------|--------|
| **Hosted intake link** (`/overwatch/client-intake?token=XXXX`) | Companies without a website, or who want zero integration work | Generate link → email it |
| **Webhook receiver** (`webhook-fillout` / future Typeform, Tally, etc.) | Companies using a form-builder service | Paste a webhook URL |
| **Intake Ingest API** (this doc) | Companies with a custom site / their own form code | ~10 lines of JS |

## Quick start

### 1. Generate an API key

1. In Overwatch, go to **HQ Config → API Sources**.
2. Type a name (e.g. `"OpServe Marketing Site"`) → click **Generate**.
3. **Copy the plaintext key immediately** — it's only shown once. The format is
   `ova_live_<64 hex chars>`. The DB stores only a SHA-256 hash.

### 2. Map your form fields

In the same panel, add **Field Mappings** that tell Overwatch how to translate
your form's field names into canonical fields.

| Canonical field | Type | Notes |
|-----------------|------|-------|
| `client_name` | string | |
| `client_email` | string | |
| `client_phone` | string | |
| `service` | string | E.g. "Event Security" |
| `location` | string | Site / venue address |
| `start_date` | string | ISO date or freeform |
| `end_date` | string | |
| `subject` | string | Short title |
| `message` | string | Long-form description |
| `notes` | string | Internal context |

Anything that isn't mapped is preserved on the submission inside `extra` — no
data is ever lost, you can re-map historical entries later.

### 3. POST submissions

```js
await fetch("https://<project>.supabase.co/functions/v1/intake-ingest", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ova_live_YOUR_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    service: formData.get("service"),
    message: formData.get("message"),
  }),
});
```

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | yes | `Bearer ova_live_<plaintext-key>` |
| `Content-Type` | yes | Must be `application/json` |

### Body

Any flat JSON object. Up to 64 KiB. Field names are matched
case-insensitively against your configured mappings.

Nested objects, arrays, and non-string values are preserved verbatim in
`extra` (and never mapped to canonical fields).

## Response

### 201 Created

```json
{
  "ok": true,
  "submission_id": "9f8b...",
  "token": "a1b2c3d4e5f6...",
  "canonical_fields_captured": ["client_name", "client_email", "service"],
  "unmapped_field_count": 2
}
```

### Error responses

| Status | Body `error` | Cause |
|--------|--------------|-------|
| `400` | `invalid_json` / `body_must_be_object` / `empty_body` | Malformed payload |
| `401` | `missing_bearer_token` / `invalid_api_key` | Auth failed |
| `401` | `api_key_revoked` / `api_key_expired` | Key no longer valid |
| `403` | `insufficient_scope` | Key lacks `intake:write` |
| `405` | `method_not_allowed` | Only POST is supported |
| `413` | `payload_too_large` | Body exceeded 64 KiB |
| `429` | `rate_limited` | More than 100 req/min on this key |
| `500` | `ingest_failed` | Server-side insert failed (see Overwatch logs) |

## Security model

| Layer | Implementation |
|-------|----------------|
| Transport | HTTPS only (Supabase edge enforces) |
| Authentication | Bearer API key, prefix `ova_live_`. SHA-256 hashed at rest. |
| Authorization | Per-key `scopes` array (only `intake:write` for now) |
| Multi-tenancy | Each key is bound to one company. Submissions land in that company's tenant only. |
| Rate limiting | Sliding window: 100 req / 60s per key. Excess returns 429 and is logged. |
| Audit | Every request logged to `api_request_log` (status, IP, timestamp). Retained 30 days. |
| Revocation | Manager flips `revoked_at`; next request returns `api_key_revoked`. |
| Replay | None needed — submissions are idempotent inserts, no side effects on duplicate. (Optional: include your own `external_id` in the payload and check `extra.external_id` in Overwatch.) |

API keys can be **revoked** (soft, preserves audit trail) or **deleted**
(hard, drops request history).

## OpServe integration recipe

OpServe Safety Group's existing contact form (vanilla JS, posting to its own
Supabase instance) requires **one additional fetch call** to bridge into
Overwatch. Insert this just after the existing `contacts` insert:

```js
// existing OSG code — keeps writing to their own DB
const { data, error } = await window.supabaseClient.from('contacts').insert([contactData]);

// NEW: also forward to Overwatch
try {
  await fetch("https://<project>.supabase.co/functions/v1/intake-ingest", {
    method: "POST",
    headers: {
      "Authorization": "Bearer ova_live_OPSERVE_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      state: formData.get('state'),
      service: formData.get('service'),
      message: fullMessage,
      // Anything else — preserved in `extra`
    }),
  });
} catch (e) {
  // Non-fatal: OSG's primary DB write already succeeded
  console.warn("Overwatch forward failed:", e);
}
```

The recommended OpServe mappings (configure once in HQ Config → API Sources):

| Source field | Canonical field |
|--------------|-----------------|
| `name` | `client_name` |
| `email` | `client_email` |
| `phone` | `client_phone` |
| `service` | `service` |
| `message` | `message` |

`state` will land in `extra.state` (no canonical field for it — kept verbatim).

## SQL migrations required

Before this feature works in any environment, run in the Supabase SQL editor:

1. `sql/add_client_intake_tokens.sql` (if not already applied)
2. `sql/add_intake_api_keys.sql`

Both are idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).

## Edge function deployment

```bash
npx supabase functions deploy intake-ingest --no-verify-jwt
```

The `--no-verify-jwt` flag is required because external sites can't carry
Supabase auth — the function verifies the API key itself in code.

## Future roadmap

- **Phase 2:** Drop-in JS snippet + Zapier / Make / n8n integration apps
- **Phase 3:** Multi-source webhook receivers (Typeform, Tally, Jotform, Formspree)
- **Phase 4:** Unified Inbox view + "Convert to Operation" wizard that pre-fills `CreateWizard` from canonical fields
