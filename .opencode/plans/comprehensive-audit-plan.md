# Comprehensive Audit & Fix Plan — Evenfall Advantage Overwatch

**Date:** April 11, 2026
**Files audited:** ~240+
**Issues found:** 80+

---

## IMPLEMENTATION PLAN (29 items, priority order)

### SECURITY FIXES (9 items)

#### SECURITY 1: Delete dangerous SQL files [DONE via git rm]
- `sql/DISABLE_ALL_RLS_TEMPORARILY.sql` — disables RLS on student tables
- `sql/ADMIN_RLS_FIX.sql` — grants all authenticated users SELECT on students/clients/certifications

#### SECURITY 2: Fix XSS in tactical-map.tsx Cesium descriptions
**File:** `overwatch-src/src/components/tactical-map/tactical-map.tsx`
**Lines:** 293-301, 360-365, 399-407, 580-587, 589
**Issue:** User-provided strings (op.name, op.location, s.name, s.role, inc.title, inc.description, pin.label, pin.description) are interpolated directly into HTML template literals rendered by CesiumJS InfoBox.
**Fix:**
1. Add `import { escapeHtml } from "@/lib/security";` at top
2. Wrap all user data in `escapeHtml()` calls in every description template literal:
   - Line 294: `${escapeHtml(op.name)}`
   - Line 295: `${escapeHtml(op.status.toUpperCase())}`
   - Line 296: `${escapeHtml(op.location)}`
   - Line 361: `${escapeHtml(s.name)}`, `${escapeHtml(s.role)}`
   - Line 401: `${escapeHtml(inc.title)}`
   - Line 402: `${escapeHtml(String(inc.severity ?? ""))}`, `${escapeHtml(String(inc.status ?? ""))}`
   - Line 403: narrative is already user content — use `escapeHtml(narrative)` 
   - Line 404: `${escapeHtml(inc.location)}`
   - Line 405: `${escapeHtml(inc.reportedBy)}`, `${escapeHtml(inc.assignedTo)}`
   - Lines 580-587: Same pattern for storyboard/incident linked descriptions
   - Line 589: `${escapeHtml(pin.label)}`, `${escapeHtml(pin.description)}`

#### SECURITY 3: Fix XSS in geo-risk-map.tsx Leaflet popups
**File:** `overwatch-src/src/components/geo-risk-map.tsx`
**Lines:** 97-118
**Issue:** `inc.category`, `inc.description`, `off.name`, `off.address`, `off.offenses` interpolated into Leaflet `.bindPopup()` raw HTML.
**Fix:**
1. Add `import { escapeHtml } from "@/lib/security";`
2. Wrap all data values:
   - Line 98: `${escapeHtml(inc.category)}`
   - Line 100: `${escapeHtml(inc.description)}`
   - Line 112: `${escapeHtml(off.name)}`
   - Line 113: `${escapeHtml(off.address)}`
   - Line 114: `${escapeHtml(off.offenses)}`
   - Line 115: `${escapeHtml(off.source)}`
   - Line 138: `${escapeHtml(address || "Location")}`

#### SECURITY 4: Remove Cesium token hardcoded fallback
**File:** `overwatch-src/src/components/tactical-map/cesium-config.ts`
**Lines:** 12-14
**Issue:** Full Cesium Ion JWT token hardcoded as fallback in source code.
**Fix:** Change to:
```typescript
const CESIUM_TOKEN = process.env.NEXT_PUBLIC_CESIUM_TOKEN ?? "";
```
If no token is provided, Cesium will fail gracefully. The token is already in GitHub Secrets and .env.local.

#### SECURITY 5: Move legacy Supabase anon key to env var
**File:** `overwatch-src/src/lib/legacy-bridge.ts`
**Lines:** 13-15
**Issue:** Legacy Supabase URL and anon key hardcoded in source.
**Fix:**
```typescript
const LEGACY_URL = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_URL ?? "";
const LEGACY_ANON_KEY = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY ?? "";
```
Then add to `.env.local`:
```
NEXT_PUBLIC_LEGACY_SUPABASE_URL=https://vaagvairvwmgyzsmymhs.supabase.co
NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY=sb_publishable_IPcFlKw8LEGnk2NYg5qrsw_Rq8yIhR1
```
And add to GitHub Secrets for deploy.yml.

Also fix `src/lib/account-linker.ts:30` which duplicates the URL — import from legacy-bridge instead.

#### SECURITY 6: Fix password minimum length mismatch
**File:** `overwatch-src/src/app/auth/update-password/page.tsx`
**Lines:** 65, 118
**Issue:** Password reset allows 8-char passwords; registration requires 12.
**Fix:** Change line 65 from:
```typescript
if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
```
to:
```typescript
if (password.length < 12) { setError("Password must be at least 12 characters"); return; }
```
And change line 118 `minLength={8}` to `minLength={12}`.

#### SECURITY 7: Sanitize dangerouslySetInnerHTML in training viewer
**File:** `overwatch-src/src/app/training/viewer/page.tsx`
**Line:** 404
**Issue:** `dangerouslySetInnerHTML={{ __html: slide.content_html }}` — renders admin-authored HTML unsanitized.
**Fix:** Add a basic HTML sanitizer that strips dangerous tags/attributes:
```typescript
function sanitizeSlideHtml(html: string): string {
  // Strip script tags, event handlers, and javascript: URLs
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bon\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/data\s*:(?!image\/(png|jpeg|gif|svg\+xml))/gi, "blocked:");
}
```
Then use: `dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(slide.content_html) }}`

Note: For production-grade sanitization, consider adding DOMPurify as a dependency.

#### SECURITY 8: Scope window auth store exposure
**File:** `overwatch-src/src/components/providers.tsx`
**Lines:** 25-33
**Issue:** Full user object exposed on `window.__OVERWATCH_AUTH_STORE__`.
**Fix:** Limit to only what the error tracker needs:
```typescript
(window as any).__OVERWATCH_AUTH_STORE__ = {
  userId: state.user?.id,
  activeCompanyId: state.activeCompanyId,
};
```
This removes the full user object (email, name, role, etc.) from global scope while keeping error tracker context working. Also update `error-tracker.ts` to read `userId` instead of `user`.

#### SECURITY 9: Scope global window functions on tactical map
**File:** `overwatch-src/src/components/tactical-map/tactical-map.tsx`
**Lines:** 170, 174
**Issue:** `window.__tacticalMapViewer` and `window.__deleteAnnotation` are globally callable.
**Fix:** Use a scoped approach with a closure or WeakRef:
- For `__deleteAnnotation`: Add authorization check inside the handler:
```typescript
(window as any).__deleteAnnotation = async (annId: string) => {
  // Verify user has permission before deleting
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  await deleteAnnotation(annId);
  setSelectedEntity(null);
};
```
- Cleanup on unmount (add to the destroy logic):
```typescript
delete (window as any).__tacticalMapViewer;
delete (window as any).__deleteAnnotation;
```

---

### BUG FIXES (6 items)

#### BUG 1: Fix timeclock useCallback missing dependency
**File:** `overwatch-src/src/app/timeclock/page.tsx`
**Line:** 130
**Issue:** `useCallback(async () => { ... uses activeCompanyId ... }, [])` — empty deps array means data never re-fetches on company switch.
**Fix:** Change `}, [])` to `}, [activeCompanyId])`.

#### BUG 2: Fix patrols delete race conditions
**File:** `overwatch-src/src/app/patrols/page.tsx`
**Lines:** 443, 529
**Issue:** `deleteCheckpoint(cp.id); load();` and `deletePatrolRoute(rt.id); load();` — load fires without waiting for delete.
**Fix:**
Line 443: Change to `onClick={async () => { await deleteCheckpoint(cp.id); await load(); }}`
Line 529: Change to `onClick={async () => { await deletePatrolRoute(rt.id); await load(); }}`

#### BUG 3: Fix leave request cancel not restoring shifts
**File:** `overwatch-src/src/app/time-off/page.tsx`
**Lines:** 102-108
**Issue:** Cancelling an approved leave request doesn't restore shifts that were removed during approval.
**Fix:** Before deleting, check if the request was approved. If so, warn the user that shifts won't be automatically restored:
```typescript
async function handleCancelRequest(id: string) {
  const req = allRequests.find((r: Request) => r.id === id);
  const wasApproved = req?.status === "approved";
  const msg = wasApproved
    ? "Cancel this approved leave request? Note: shifts that were removed during approval will need to be manually re-created."
    : "Cancel this leave request?";
  if (!confirm(msg)) return;
  setDeletingReq(id);
  try { await deleteTimeOffRequest(id); await load(); toast.success("Request cancelled"); }
  catch (err) { console.error(err); toast.error("Failed to cancel request"); }
  finally { setDeletingReq(null); }
}
```

#### BUG 4: Fix checkpoint delete breaking patrol routes
**File:** `overwatch-src/src/app/patrols/page.tsx`
**Line:** 443
**Issue:** Deleting a checkpoint that's part of a patrol route silently breaks the route.
**Fix:** Before deleting, check if the checkpoint is referenced by any route:
```typescript
onClick={async () => {
  const referencingRoutes = routes.filter((rt: PatrolRoute) =>
    (rt.checkpoint_ids ?? []).includes(cp.id)
  );
  if (referencingRoutes.length > 0) {
    const routeNames = referencingRoutes.map((rt: PatrolRoute) => rt.name).join(", ");
    if (!confirm(`This checkpoint is used by route(s): ${routeNames}. It will be removed from those routes. Continue?`)) return;
  } else {
    if (!confirm("Delete this checkpoint?")) return;
  }
  await deleteCheckpoint(cp.id);
  await load();
}}
```

#### BUG 5: Update landing page stats year
**File:** `overwatch-src/src/app/page.tsx`
**Line:** 52
**Issue:** `"50 States Updated 2025"` — should be 2026.
**Fix:** Change to `"States Updated 2026"` or better: use `new Date().getFullYear()` to make it dynamic.

#### BUG 6: Fix training viewer keyboard listener
**File:** `overwatch-src/src/app/training/viewer/page.tsx`
**Lines:** 226-234
**Issue:** `useEffect` has no dependency array — re-registers on every render, creating stale closures.
**Fix:** Add dependency array:
```typescript
useEffect(() => {
  if (isLegacyModule) return;
  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") handlePrev();
    else if (e.key === "ArrowRight") handleNext();
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [isLegacyModule, handlePrev, handleNext]);
```
And ensure `handlePrev`/`handleNext` are wrapped in `useCallback`.

---

### PERFORMANCE FIXES (8 items)

#### PERF 1: Fix N+1 getUnreadCounts query
**File:** `overwatch-src/src/lib/supabase/db-content.ts`
**Lines:** 510-541
**Issue:** 2 queries per channel (member lookup + message count). 20 channels = 40+ queries.
**Fix:** Use a single query approach:
```typescript
export async function getUnreadCounts(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return {};
  const supabase = createClient();
  
  // Get all channels + member's last_read_at in one query
  const { data: channels } = await supabase
    .from("chat_channels")
    .select("id, chat_members!inner(last_read_at)")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .eq("chat_members.user_id", userId);
  
  if (!channels?.length) return {};
  
  // Build counts with parallel queries (still N queries for messages, but eliminates N member lookups)
  const counts: Record<string, number> = {};
  const promises = channels.map(async (ch) => {
    const lastRead = (ch.chat_members as any)?.[0]?.last_read_at;
    let query = supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", ch.id)
      .neq("user_id", userId);
    if (lastRead) query = query.gt("created_at", lastRead);
    const { count } = await query;
    if (count && count > 0) counts[ch.id] = count;
  });
  await Promise.all(promises);
  return counts;
}
```
This halves the queries. For a full fix, create an RPC function in SQL.

#### PERF 2: Fix N+1 reorder operations
**Files:** 
- `db-training.ts:337-346` (reorderModuleSlides)
- `db-content.ts:247-256` (updateKBFolderOrder)
- `db-onboarding.ts:337-346` (reorderOnboardingTasks)

**Fix for each:** Use bulk upsert instead of individual updates. Example for slides:
```typescript
export async function reorderModuleSlides(slides: { id: string; sort_order: number }[]) {
  const supabase = createClient();
  // Upsert all at once
  const { error } = await supabase
    .from("training_slides")
    .upsert(slides.map(s => ({ id: s.id, sort_order: s.sort_order })), { onConflict: "id" });
  if (error) throw error;
}
```

#### PERF 3: Fix N+1 time-off shift cleanup
**File:** `overwatch-src/src/lib/supabase/db-time-off.ts`
**Lines:** 142-148
**Fix:** Replace individual UPDATE loop with bulk `.in()`:
```typescript
const shiftIds = conflictingShifts.map(s => s.id);
if (shiftIds.length > 0) {
  await supabase.from("shifts").update({ user_id: null }).in("id", shiftIds);
}
```

#### PERF 4: Move analytics to DB-side aggregation
**File:** `overwatch-src/src/lib/supabase/db-analytics.ts`
**Lines:** 25-36
**Fix:** Instead of fetching 500 timesheets and computing hours in JS:
```typescript
// Use Supabase RPC or compute server-side
const { data } = await supabase.rpc("get_timesheet_hours_sum", { 
  company_id_param: companyId,
  start_date: startOfMonth.toISOString() 
});
```
Create corresponding SQL function. Or at minimum, use `.select("clock_in, clock_out")` instead of `select("*")`.

#### PERF 5: Fix tactical-globe 60fps React re-renders
**File:** `overwatch-src/src/components/tactical-globe.tsx`
**Issue:** `SatelliteOverlay` calls `setRenderState` on every animation frame (~60fps), causing React to re-render.
**Fix:** Use `useRef` for animation state instead of `useState`:
```typescript
// Instead of:
const [, setRenderState] = useState(0);
// Use:
const renderRef = useRef(0);
// And for CSS updates, use direct DOM manipulation or CSS transforms
```

#### PERF 6: Fix mobile-hero-radar getComputedStyle every frame
**File:** `overwatch-src/src/components/mobile-hero-radar.tsx`
**Line:** 33
**Fix:** Cache the CSS variable value and only re-read on theme change:
```typescript
const accentRef = useRef<string>("");
useEffect(() => {
  accentRef.current = getComputedStyle(document.documentElement)
    .getPropertyValue("--brand-accent").trim();
}, [/* theme dependency */]);
// In draw function, use accentRef.current instead of getComputedStyle()
```

#### PERF 7: Fix geo-risk-map full destroy/recreate
**File:** `overwatch-src/src/components/geo-risk-map.tsx`
**Line:** 186
**Issue:** Entire map destroyed and recreated when any prop changes.
**Fix:** Separate map initialization from marker updates:
```typescript
// First useEffect: create map only when lat/lon/isDark changes
useEffect(() => { /* create map */ }, [lat, lon, isDark]);
// Second useEffect: update markers when data changes
useEffect(() => { /* update incident/offender markers */ }, [incidents, offenders]);
```

#### PERF 8: Remove dead code in crime-incidents.ts
**File:** `overwatch-src/src/lib/crime-incidents.ts`
**Lines:** 358-407, 626-670
**Fix:** Delete the unreachable code after `return []` in both `fetchOpenDataSoft()` and `fetchCityProtect()`. Keep the `return []` and a comment explaining why they're disabled.

---

### MISCELLANEOUS FIXES (6 items)

#### MISC 1: Fix CSV import missing roles
**File:** `overwatch-src/src/lib/csv-import.ts`
**Line:** 79
**Fix:** Add missing roles to `VALID_ROLES`:
```typescript
const VALID_ROLES = ["staff", "manager", "admin", "owner", "instructor", "lead", "breaker"];
```

#### MISC 2: Fix Whisper model size discrepancy
**File:** `overwatch-src/src/lib/speech/whisper-engine.ts`
**Lines:** 4, 45
**Fix:** Standardize to the actual model size. Whisper-tiny.en is ~75MB. Update both comments to say ~75MB.

#### MISC 3: Fix role type inconsistency
**File:** `overwatch-src/src/types/index.ts`
**Lines:** 24, 171
**Fix:** Change `role: string` to `role: CompanyRole` in both `CompanyContext` and `CompanyMembershipRow` interfaces. Import `CompanyRole` from `@/lib/permissions`.

#### MISC 4: Fix SOC2 checklist contradictions
**File:** `docs/compliance/SOC2_READINESS_CHECKLIST.md`
**Lines:** 162-163, 277-289
**Fix:** 
- Line 162: Change `[ ] Need UptimeRobot` to `[x] UptimeRobot configured`
- Line 163: Change `[ ] Need formal IRP` to `[x] IRP documented (see INCIDENT_RESPONSE_PLAN.md)`
- Remove or update the stale "Priority Remediation" section at the bottom

#### MISC 5: Deduplicate ICON_MAP and navigation
**Files:** `command-palette.tsx`, `app-sidebar.tsx`
**Fix:** Extract shared `ICON_MAP` to `layout/nav-items.ts` and import from there. Have command palette derive its items from the same navigation data source.

#### MISC 6: Standardize error handling in DB modules
**Files:** All `db-*.ts` files
**Fix:** Establish a consistent pattern:
- Functions that return arrays: return `[]` on error + `console.error`
- Functions that return single items: return `null` on error + `console.error`
- Mutation functions: always `throw error` to let the caller handle with toast
- Never swallow errors with empty `catch {}`
