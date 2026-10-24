# RhymeOrbit — Razorpay Subscriptions sandbox integration

**Single project:** GitHub \`tipundhiman/tipun\`, branch \`master\`, existing Vercel project. **No LIVE payment collection.** Merchant setup can be completed while Hobby deployment limits are active.

## Current safety state

- Sandbox API and checkout are **admin-only**. Public Free/Premium/Pro membership buttons **cannot charge money**.
- Razorpay LIVE credentials are NOT read or recognized by this implementation; only \`rzp_test_...\` key IDs are accepted.
- Test transactions do not activate \`public.subscriptions\`. All users remain limited to 3 song submissions/month while LIVE entitlements are being designed and verified.
- Billing sandbox objects are in \`public.billing_test_subscriptions\` and \`public.billing_test_webhook_events\`, with RLS enabled and no client access.
- Razorpay plan cost and recurrence period are verified by the server before opening sandbox Checkout.
- Webhook HMAC validates the exact raw request body; \`x-razorpay-event-id\` is stored atomically to deduplicate retries. Earlier-timestamp events do not overwrite newer statuses.
- Subscription created/activated/charged/cancelled/pending/halted events are AUDIT records only. The client payment callback never grants credits.

## Dashboard steps — user action

1. Visit https://dashboard.razorpay.com/ and create/login to a Razorpay Merchant Account. Activate **Test Mode** (not Live).
2. In **Account & Settings → API Keys**, generate your **TEST Key ID** and **TEST Key Secret**.
3. In **Subscriptions → Plans**, create up to 4 test plans; these exact amounts are checked by our server:

| Environment suffix | Plan name | Razorpay period | Amount charged | Amount in paise |
|---|---|---|---:|---:|
| \`PREMIUM_MONTHLY\` | RhymeOrbit Premium Monthly | monthly / interval 1 | ₹599 monthly | 59900 |
| \`PRO_MONTHLY\` | RhymeOrbit Pro Monthly | monthly / interval 1 | ₹1,299 monthly | 129900 |
| \`PREMIUM_ANNUAL\` | RhymeOrbit Premium Yearly | yearly / interval 1 | ₹6,588 yearly | 658800 |
| \`PRO_ANNUAL\` | RhymeOrbit Pro Yearly | yearly / interval 1 | ₹14,388 yearly | 1438800 |

You can start with **one** Premium Monthly test plan. Don't create plans with different charges and then attempt to bypass the server-side price verification. The annual prices are based on the currently displayed ₹549 and ₹1,199 per month, billed annually. These are pricing previews, not approved commercial offers.

4. In **Account & Settings → Webhooks**, still in TEST mode, set URL to:

\`https://rhymeorbit.in/api/billing/test/webhook\`

Pick events \`subscription.authenticated\`, \`subscription.activated\`, \`subscription.charged\`, \`subscription.pending\`, \`subscription.halted\`, \`subscription.cancelled\`, \`subscription.completed\`, \`subscription.paused\`, \`subscription.resumed\`. Set a **separate strong Webhook Secret**, and copy it privately.

5. In existing Vercel project → Settings → Environment Variables, add **Production** variables:

\`\`\`
RAZORPAY_TEST_KEY_ID=rzp_test_...                     # your TEST key id
RAZORPAY_TEST_KEY_SECRET=...                           # your TEST API secret
RAZORPAY_TEST_WEBHOOK_SECRET=...                       # webhook signing secret
RAZORPAY_TEST_PREMIUM_MONTHLY_PLAN_ID=plan_...         # optional until created
RAZORPAY_TEST_PRO_MONTHLY_PLAN_ID=plan_...             # optional
RAZORPAY_TEST_PREMIUM_ANNUAL_PLAN_ID=plan_...          # optional
RAZORPAY_TEST_PRO_ANNUAL_PLAN_ID=plan_...              # optional
\`\`\`

Do NOT commit secrets or paste them in a chat. \`RAZORPAY_TEST_KEY_ID\` is a publishable checkout key only for sandbox; API secret and webhook secret remain server-only. Existing R2/Supabase/AI environment variables remain unchanged.

6. When the Vercel Hobby daily deployment limit resets, redeploy latest \`master\` on the **same existing project**. No new project or domain.
7. Log into RhymeOrbit using the account configured in \`admin_users\`, open **Memberships**. The admin-only test section appears when database and TEST credentials are available; use the \`Test Premium monthly checkout\` control.
8. Inspect Razorpay **Test Mode → Subscriptions/Webhooks** and your admin sandbox records. No public user should see a Test Checkout button. Your free song quota must remain 3.

## Before REAL payments can be enabled

- Commercial-compatible hosting (Vercel Hobby is not a commercial billing plan), proper merchant onboarding/KYC, activation and permitted payment methods.
- Provider cost and price unit economics, with strict monthly budget and per-user rate controls.
- Paid entitlement system: **server-side 35/75-song plan limits** and premium/pro recurring billing status synchronized from signed LIVE webhooks. This is intentionally NOT switched on by the sandbox.
- Idempotent renewal/expiry, successful-charge validation, cancellation, disputes, refunds, failed payments and reconciliation. Annual billing should still reset song credits monthly.
- Publish accurate payment/tax/auto-renew/refund/cancel policies and test full customer flow with a merchant-approved real transaction.

## Reference

Razorpay subscriptions: https://razorpay.com/docs/payments/subscriptions/integration-guide/

Razorpay signed webhooks: https://razorpay.com/docs/webhooks/validate-test/

Razorpay Create Subscription: https://razorpay.com/docs/api/payments/subscriptions/create-subscription/
