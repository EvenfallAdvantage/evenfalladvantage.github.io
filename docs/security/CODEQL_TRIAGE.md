# CodeQL triage (2026-10-21)

48 open alerts on `main` @ 1c91fbb. **Fixed in this PR: 33. Deferred: 1 (#99). False positive / accepted with reason: 14.** Dismiss the false positives in GitHub with the reason below after merge (needs repo admin).

| Alerts | Rule | Location | Decision |
|---|---|---|---|
| #66–#76 (11) | js/stack-trace-exposure | 11 Edge Functions (data-export, data-delete, email-*, sms-*, roster-*) | **Fixed.** New `_shared/safe-error.ts`: logs the error with a ref id, returns a generic message + ref. Needs function redeploy to take effect. |
| #99 | js/stack-trace-exposure | create-checkout-session | **Deferred** to held PR #70 (Stripe on hold; avoid conflicts). |
| #42 | incomplete-multi-character-sanitization | careers/page.tsx JSON-LD | **Fixed (real XSS).** `JSON.stringify` inside `<script>` did not escape `</script>` in posting text; now `jsonForScript()` escapes `<`, and descriptions use `stripTags()`. |
| #39, #55 | incomplete-multi-character-sanitization | db-postings.ts, job-feed | **Fixed.** Robust strip + CDATA `]]>` escaping (a description with `]]>` broke the Indeed XML). |
| #51, #96 | incomplete-multi-character-sanitization | modules-tab.tsx, security/index.ts | **Fixed.** `stripTags()` now also removes stray `<`/`>`. |
| #60, #61 | incomplete-multi-character-sanitization | intel-news | **Fixed.** `stripTagsToText()`. |
| #62–#65 | double-escaping / bad-tag-filter / sanitization | smtp-provider.ts stripHtml | **Fixed.** Plain-text body: `&amp;` decoded last, `</script >` variants matched, stray brackets removed. |
| #97 | js/double-escaping | cctv/parsers_more.ts | **Fixed.** `&amp;` decoded last. |
| #100 | incomplete-url-substring-sanitization | map/osm-buildings.ts | **Fixed (real).** `endsWith("openfreemap.org")` accepted `evilopenfreemap.org`; now exact host or `.openfreemap.org`. |
| #16 | xss-through-dom | courses/page.tsx iframe | **Fixed.** Room URL must be `https://`; `javascript:` blocked. |
| #88–#95 (8) | insecure-temporary-file | companion (Windows SDR helper) | **Fixed.** Binaries extracted to a fresh `mkdtemp` dir (0700) instead of a predictable shared temp path (DLL-planting risk). |
| #98 | incomplete-url-substring-sanitization | intake-ingest/lib_test.ts | False positive: test assertion, not a security check. |
| #47, #53, #54 | xss-through-dom | create-wizard, company-profile, briefing-composer `<img src>` | False positive: React sets `src` as an attribute; image `src` cannot execute script. Values are blob:/Storage URLs or `isImageUrl()`-checked. |
| #12 | clear-text-storage | crime-incidents.ts `fw_api_key` | Accepted: the user's own optional third-party key, stored on their device by their choice; never sent to our backend. |
| #102 | clear-text-storage | incidents/quick-draft.ts | Accepted: offline incident draft on the officer's device by design (offline mode); cleared on submit. |
| #22–#27 (6) | cors-permissive / log-injection | google-meet-addon/ backend | Accepted/out of scope: legacy add-on not deployed by this repo's workflows (last change 2026-04-13). Recommend deleting the folder or moving it to its own repo. |
| #79, #101 | http-to-file-access | scripts/*.mjs/js | False positive: offline build scripts that download public datasets on a developer machine. |
