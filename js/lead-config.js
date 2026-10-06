/**
 * Lead intake configuration for the public estimate forms (forms/*.html).
 *
 * Submissions are POSTed to the Overwatch `intake-ingest` edge function
 * (supabase/functions/intake-ingest), which stores them in
 * `client_intake_tokens` (source = 'api') for the company that owns the key.
 * They then show up in Overwatch alongside other client intake requests.
 *
 * Setup (done 2026-10-06, see the go-live checklist in PR #48):
 *   1. Migration 20261006193834_intake_tokens_rls.sql applied to OverwatchDB
 *      (closes public read/update of client_intake_tokens).
 *   2. `intake-ingest` edge function deployed to OverwatchDB.
 *   3. Evenfall Advantage LLC has an API key with ONLY the `intake:write`
 *      scope ("Website estimate forms (public, leads only)", prefix
 *      ova_live_d80) and "Email new leads to" is set. No field mappings are
 *      needed: the canonical keys map to themselves.
 *   4. The forms load this file as lead-config.js?v=<version>. Bump that
 *      query string in forms/*.html whenever this file changes, so Cloudflare
 *      and browsers (max-age 4 h) fetch the new copy without a purge.
 *
 * To rotate: revoke the key in Overwatch > Settings > API Sources, create a
 * new intake-only key, paste it below and bump the ?v= version in the forms.
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
    apiKey: 'ova_live_d80a812592c26f0cb714281b6a7d66fff42d4a082b2941ed90de0583ea40eabd'
};
