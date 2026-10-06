/**
 * Lead intake configuration for the public estimate forms (forms/*.html).
 *
 * Submissions are POSTed to the Overwatch `intake-ingest` edge function
 * (supabase/functions/intake-ingest), which stores them in
 * `client_intake_tokens` (source = 'api') for the company that owns the key.
 * They then show up in Overwatch alongside other client intake requests.
 *
 * Setup (one-time; see the go-live checklist in the "feat/intake-leads" PR):
 *   1. (Done 2026-10-06) Migration 20261006193834_intake_tokens_rls.sql is
 *      applied to OverwatchDB (closes public read/update of client_intake_tokens).
 *   2. Deploy the `intake-ingest` edge function to OverwatchDB.
 *   3. In Overwatch > Settings > API Sources (Evenfall Advantage company),
 *      create an API key with ONLY the `intake:write` scope (the default) and
 *      fill in "Email new leads to". No field mappings are needed: the
 *      canonical keys below map to themselves.
 *   4. Paste the `ova_live_...` key into `apiKey` below, merge, then purge
 *      Cloudflare for /js/lead-config.js and /js/form-validation.js.
 *
 * The key is visible in page source by design. The function only accepts it
 * from evenfalladvantage.com origins, only for an intake-only key, and it can
 * do nothing except add a lead (rate limited per key and per visitor IP).
 *
 * Until `apiKey` is set, the forms do NOT open an email app. They show an
 * inline notice with "Email this request" / "Copy details" options so the
 * visitor's answers are never silently lost.
 */
window.EVENFALL_LEAD_INTAKE = {
    endpoint: 'https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/intake-ingest',
    apiKey: ''
};
