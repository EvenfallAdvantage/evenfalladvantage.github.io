# Course checkout on OverwatchDB — go-live checklist

Moves paid course checkout from the legacy EADB project (`vaagvairvwmgyzsmymhs`)
to **OverwatchDB (`nneueuvyeohwnspbwfub`)**. Supersedes PR #70.

| Piece | What it does |
|---|---|
| Migration `overwatch-src/supabase/migrations/20261018180000_course_checkout.sql` | Hardens `payment_transactions` (browser can read own rows only, no writes), adds Stripe session/refund columns + status check, blocks self-enrolment in paid courses (trigger), adds service-role-only `record_course_purchase` / `record_course_payment_status` / `record_course_refund`. Rollback: `overwatch-src/supabase/migrations/rollback/20261018180000_course_checkout.rollback.sql` |
| Edge function `course-checkout` | Signed-in user → Stripe Checkout session. Price comes from `courses.price` (the imported prices are kept as-is). Secret: `STRIPE_SECRET_KEY`. |
| Edge function `course-payment-webhook` | Stripe → OverwatchDB. Verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`, then records the payment and creates the paid `course_enrollments` row. |
| Courses page | Sends only `{ courseId }`; "owned" = active enrollment. |

Both functions deploy with **`verify_jwt = false`** (already in `supabase/config.toml`).
`course-checkout` verifies the user's session itself; the webhook is authenticated by the Stripe signature.

---

## Phase 1 — Test mode (do this first)

### 1. Stripe dashboard (Test mode toggle ON)
1. **Developers → API keys**: copy the **Secret key** (`sk_test_…`). Don't paste it anywhere except step 2.
2. **Developers → Webhooks → Add endpoint**
   - Endpoint URL: `https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/course-payment-webhook`
   - Events to send (select exactly these 5):
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `checkout.session.expired`
     - `charge.refunded`
   - Save, then on the endpoint page click **Reveal** under *Signing secret* (`whsec_…`).
3. **Settings → Public details**: check the business name / statement descriptor the buyer will see.

### 2. Set the Edge secrets yourself (OverwatchDB)
Supabase dashboard → project **nneueuvyeohwnspbwfub** → **Edge Functions → Secrets** → add:
- `STRIPE_SECRET_KEY` = the `sk_test_…` key
- `STRIPE_WEBHOOK_SECRET` = the `whsec_…` signing secret

(or `supabase secrets set --project-ref nneueuvyeohwnspbwfub STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=…`).
Nobody else needs to see these values; the functions read them at runtime.

### 3. Apply + deploy (after approving this PR)
1. Apply the migration to OverwatchDB (it was tested in a rolled-back transaction: 31/31 checks, and the rollback script restores the schema exactly).
2. Deploy both functions with JWT verification off:
   ```
   supabase functions deploy course-checkout        --project-ref nneueuvyeohwnspbwfub --no-verify-jwt
   supabase functions deploy course-payment-webhook --project-ref nneueuvyeohwnspbwfub --no-verify-jwt
   ```
3. Merge the PR (Pages deploys the updated Courses page).

Order matters a little: until the functions exist the Buy button shows "Could not reach the payment service"; until `STRIPE_SECRET_KEY` is set it says "Payments are not configured yet" (503) without writing anything.

### 4. Test purchase
1. Sign in as a **staff-level** member of the company that owns the courses; open **Courses**; click Buy on a course you're not enrolled in.
2. On Stripe Checkout use card `4242 4242 4242 4242`, any future expiry, any CVC/ZIP.
3. You return to `/overwatch/courses/?checkout=success…`; within a few seconds the course shows **Purchased**.
4. Verify in Stripe → Webhooks → the endpoint → recent deliveries all **200**.
5. Verify in SQL (OverwatchDB):
   ```sql
   select status, amount, stripe_checkout_session_id, completed_at from payment_transactions order by created_at desc limit 3;
   select enrollment_type, status, amount_paid, payment_ref from course_enrollments where payment_ref like 'cs_test_%';
   ```
6. Also try: cancel on the Stripe page (banner "Payment was cancelled", payment row later → `expired`), card `4000 0000 0000 0002` (declined, no enrollment), and a **full refund** from the Stripe dashboard (enrollment → `cancelled`, payment → `refunded`).
7. Buy again on an already-owned course → refused ("already enrolled").

## Phase 2 — Live mode
1. Stripe: switch to **Live mode**, add the **same endpoint URL and same 5 events** (live mode has its own endpoints and its own signing secret).
2. Replace both Edge secrets with the live values (`sk_live_…` / live `whsec_…`). Consider a **restricted key** with write access to Checkout Sessions only (+ read on Checkout Sessions) instead of the full secret key.
3. Do one small real purchase and refund it.
4. Delete the test-mode endpoint when done (optional).

## Phase 3 — Retire the EADB Stripe functions
No code in this repo calls the EADB functions any more (the only references are in docs and `supabase/config.toml`), but Stripe may still be delivering events to EADB.
1. Stripe (test **and** live mode) → Developers → Webhooks: find the endpoint pointing at
   `https://vaagvairvwmgyzsmymhs.supabase.co/functions/v1/process-course-payment` → **Disable**, watch a few days, then **Delete**.
   (That function's synchronous `constructEvent` throws under Deno, so its deliveries have likely been failing anyway.)
2. Supabase → project **vaagvairvwmgyzsmymhs** → Edge Functions: delete `create-checkout-session` (v4) and `process-course-payment` (v3).
3. EADB → Edge Functions → Secrets: delete its Stripe secrets (e.g. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
4. Roll the Stripe secret key that EADB used if it was ever shared (Stripe → API keys → Roll key) — only after Overwatch uses its own key.
5. Follow-up PR: remove `supabase/functions/create-checkout-session`, `supabase/functions/process-course-payment` and their `config.toml` blocks.
6. Close PR #70 as superseded.

## Rollback
- Stop new purchases: remove `STRIPE_SECRET_KEY` (checkout returns 503, nothing is written) or disable the webhook endpoint in Stripe.
- Functions: `supabase functions delete course-checkout --project-ref nneueuvyeohwnspbwfub` and the same for `course-payment-webhook`.
- Database: run the rollback SQL. It restores the old policies/grants and drops the added columns; any recorded Stripe session ids/refund amounts would be lost, so export `payment_transactions` first if purchases have happened.
- Web: revert the merge commit.

## Notes
- Prices: Chain of Custody $50, Advanced Surveillance $75, Unarmed Guard Core $50, Systema Scout $40, Crowd Surge $300 (imported; unchanged). Checkout uses inline `price_data`, so no Stripe Products/Prices need to be created; `stripe_price_id` stays empty.
- Free courses can still be self-enrolled; paid ones only via the webhook or by a manager+ (comp/assign).
- Webhook retries are safe (idempotent SQL functions); amount, currency and session id are re-checked against the pending row. Mismatches are logged as `NEEDS REVIEW` in the function logs.
- Our Terms/Privacy pages should mention Stripe as the payment processor (likely already covered).
