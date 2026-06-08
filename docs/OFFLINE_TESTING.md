# Offline queue - manual testing checklist

Phase 8 / HALO_PARITY_PLAN.md

This document walks through verifying the offline queue end-to-end in a
real browser. The automated test suite (`offline-queue.test.ts`,
`offline-sync.test.ts`, `offline-with-offline.test.ts`, `use-online.test.tsx`)
exercises the units; this checklist confirms they wire together in
production.

Estimated time: 15 minutes.

## Prerequisites

- A development build running locally (`npm run dev` in `overwatch-src/`)
  OR a deployed build at `https://overwatch.evenfalladvantage.com/overwatch/`.
- A signed-in test user with at least one company membership.
- Chrome or Firefox DevTools open.

## Test 1: Offline incident comment is queued and synced

1. Open `/incidents` and expand any incident card.
2. Open DevTools -> Network tab. Set throttling to "Offline".
3. Type a comment in the "Add update" box and hit send.
4. **Expected:** No error toast; the comment may or may not appear in the
   timeline immediately (Phase 8.4 wrappers return `__pendingSync: true`).
   The bottom-right `SyncIndicator` should now show
   "Offline · 1 pending".
5. Open DevTools -> Application -> IndexedDB -> `overwatch-offline` ->
   `mutations`. There should be exactly one row with `kind:
   "incident.comment"` and `status: "pending"`.
6. Set Network throttling back to "Online".
7. Within a few seconds the `SyncIndicator` should switch to "Syncing..."
   then disappear. The IDB row's `status` should become `"done"`.
8. Refresh the incident expand: the comment should now appear in the
   activity timeline served from the live database.

## Test 2: Offline task status toggle survives a reconnect

1. Open `/tasks` and pick any task.
2. Go offline (DevTools -> Network -> Offline).
3. Click the circle icon to mark the task done.
4. **Expected:** Visible UI may not change yet, but a new IDB row with
   `kind: "task.status"` and `status: "pending"` exists.
5. Go online. The indicator should drain the queue and the task should
   show as done after the next list refresh.

## Test 3: Public report from a fully-offline phone

1. Open `/report?l=<your-test-slug>` while online once so the service
   worker caches the page.
2. Go offline.
3. Fill in the report and submit.
4. **Expected:** Success screen ("Report received") - the wrapper returns
   the optimistic placeholder. IDB row of kind `public_report.submit`
   should be queued.
5. Reconnect. Drain runs. Admin's Public Reports tab should show the
   submission within a few seconds.

## Test 4: Persistent failure surfaces as a sync issue

1. Queue a mutation that will deterministically fail (e.g. with an old
   session). One way: queue while offline, then sign out, then go online.
2. The sync engine will retry; each attempt fails with "Not authenticated".
3. After 5 attempts the row is promoted to `error` status.
4. Open `/admin/security`. The "Sync issues" panel should now be visible
   with the failed row, its kind, last error, and Retry / Dismiss buttons.
5. Sign back in and click Retry. The row should drain successfully and
   the panel should hide again.

## Test 5: Service worker app-shell cache

1. Open `/feed` while online (this also warms the SW precache).
2. Hard-reload once so the SW activates.
3. Go offline.
4. Click `/feed` from a different tab or browser-back to a previously
   visited Overwatch page.
5. **Expected:** Page loads from the SW cache (cached HTML, JS, CSS). UI
   will show empty / cached data but the app shell renders.

## Test 6: Cache invalidation on deploy

1. Note the current sw.js `CACHE_NAME` (DevTools -> Application -> Service
   Workers -> Inspect).
2. Trigger a redeploy. The GitHub Actions workflow injects the new commit
   SHA into `__BUILD_HASH__` so the cache name changes.
3. After redeploy, the new SW takes over on next page load. Old cache is
   deleted in the `activate` handler.
4. **Expected:** No stale chunks (a known previous issue tracked in
   commits `8418ac4b7` and `d9f9b06a4`).

## Known limitations

- We do NOT cache `/api/` or `/auth/` paths. Those still hit the network.
- Offline mutations targeting another user's data may fail at the RBAC
  layer when synced. Those land in the Sync Issues panel.
- Conflict resolution is last-write-wins via `updated_at`. We do not
  detect concurrent edits.
- The service worker only intercepts GET requests. Mutations are queued
  via the wrapper layer, not the SW.

## Where to file bugs

If any step here fails, file an issue with the kind / payload / error
message visible in the Sync Issues panel, plus the browser + version.
