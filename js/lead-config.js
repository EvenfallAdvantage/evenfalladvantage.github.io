/**
 * Lead intake configuration for the public estimate forms (forms/*.html).
 *
 * Submissions are POSTed to the Overwatch `intake-ingest` edge function
 * (supabase/functions/intake-ingest), which stores them in
 * `client_intake_tokens` (source = 'api') for the company that owns the key.
 * They then show up in Overwatch alongside other client intake requests.
 *
 * Setup (one-time, done by an Overwatch owner/admin; nothing here is secret
 * beyond a write-only, rate-limited intake key):
 *   1. Deploy the `intake-ingest` edge function to OverwatchDB
 *      (it is in the repo but not currently deployed).
 *   2. In Overwatch > Settings > API Sources, create an API key with the
 *      `intake:write` scope for the Evenfall Advantage company and add field
 *      mappings (client_name, client_email, client_phone, service, location,
 *      message, start_date, notes, subject -> same canonical field).
 *   3. Paste the `ova_live_...` key into `apiKey` below.
 *
 * Until `apiKey` is set, the forms do NOT open an email app. They show an
 * inline notice with "Email this request" / "Copy details" options so the
 * visitor's answers are never silently lost.
 */
window.EVENFALL_LEAD_INTAKE = {
    endpoint: 'https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/intake-ingest',
    apiKey: ''
};
