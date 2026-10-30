> **Historical reference (superseded 31 Oct 2026):** Production is the existing Cloudflare Worker `tipun` at `rhymeorbit.in`, NOT Vercel. Use root `README.md`, `docs/RHYMEORBIT_SOURCE_OF_TRUTH.md`, and `docs/PRODUCTION_AUDIT_20261031.md` for the current release and deployment steps. Do not follow old Vercel env/DNS directions.

# RhymeOrbit — pre-payment launch audit (24 October 2026)

**Project source:** `tipundhiman/tipun` → `master` → the existing RhymeOrbit Vercel project. No new project/deployment created. Reviewed repository modules, recent 27-test CI baseline, live connected Supabase schema/permissions, and official gateway/hosting terms. Browser-level production walkthrough was not available; do not describe this as a fully tested live UI.

## Go/no-go: paid payments must remain OFF

1. **CRITICAL — Quota/price mismatch.** UI advertises Premium ₹599/month ≈ 35 songs and Pro ₹1,299/month ≈ 75 songs; `api/index.js` `/api/music/credits` hard caps every user at 3 songs/month, and SQL `ro_reserve_song` caps plan usage at 3. Customers would be charged without purchased entitlements. Resolve separately with atomic billing + metering + provider cost/budget validation before enabling checkout.
2. **CRITICAL — Noncommercial Vercel Hobby.** Verify the current deployment plan and upgrade existing project to a commercial-compatible plan or use a compliant host before taking money. See https://vercel.com/legal/terms and https://vercel.com/docs/limits/fair-use-guidelines.
3. **CRITICAL — Merchant, recurring billing, tax & refund readiness.** Razorpay Subscriptions is preferred for India (UPI AutoPay, cards, etc.). Obtain merchant KYC, merchant TEST API credentials and subscription plan IDs; verify live payment modes. Set up authenticated checkout, HMAC-verified webhooks, replay-safe event ledger, cancel/renew/failure handling, receipts/invoices, taxation, cancellation UX, pro-rata/refund policy and a customer-support contact. Do NOT trust a client-side payment-success screen to grant benefits. Validate server-side entitlements after confirmed gateway events and reconcile them with provider state.
4. **HIGH — Current database subscription plan supports only free/premium in the `admin_set_subscription` helper.** Pro, annual plans and effective/expiration timing need an explicit and tested schema/API before billing goes live.
5. **HIGH — Public generation spend & abuse controls.** API rate limits are an in-memory per-process map; they do not form a shared limit across Vercel serverless instances. Keep atomic DB song quota, add durable per-user/IP rate limiting, provider spend alerts, hard budget ceilings and support for provider failures/retries.
6. **HIGH — Rights and moderation.** Music inputs require a rights checkbox but are not proof of clearance. Add rights-report workflow, queue and appeal flow for uploaded images, video, audio and messages; verify user block and report actions. Keep clear licenses and commercial output terms.
7. **HIGH — Payment policy pages.** Existing Terms say checkout disabled. Before selling, publish billing cycle, recurring charges, cancellation/auto-renew terms, refund/failed-charge process, invoicing, grievance contact and a fair-use/credits policy. Consult qualified India legal/tax counsel.
8. **MEDIUM — Source duplication.** Historical unused Media music-generation code accepted a different payload from AI Studio and had no rights confirmation. Removed this dead path; AI Studio is now the canonical music entry point.
9. **MEDIUM — Database security/performance.** Anon direct access to creator chat helper RPCs was broader than needed. Tightened grants while preserving authenticated use. Added ten missing foreign-key indexes for social and feed performance. Internal `music_generation_reservations` is intentionally RLS-restricted and service-role-only.
10. **MEDIUM — Cloud/library UX.** Generated songs have private storage, signed URLs and a full audio player. Validate expired-link recovery, 50 MB media caps vs 20 MB generated-song backup, and mobile seeking through browser E2E.
11. **MEDIUM — SEO / analytics.** Metadata, policies and sitemap exist; submit domain sitemap to Google Search Console, set privacy-aware conversions, monitor Core Web Vitals, mobile accessibility and 404s. Avoid guaranteed-rank claims.
12. **LOWER PRIORITY — Product roadmap.** Creator profile permalinks, song sharing only with explicit permission, Riya → Studio draft transfer, notifications, follow/match moderation, creator verification, onboarding tour and accessible media-caption tools.

## Gateway recommendation

**Razorpay Subscriptions** is the India-first default; Cashfree is a viable alternative. Choose monthly and yearly recurring plans only after the actual price, billing period and provider generation margin are agreed. Currently displayed annual amounts are marketing previews and not verified subscriptions.

### Safe implementation phases
- **A. Audit and fix:** completed source cleanup and DB security/index migration; billing intentionally OFF.
- **B. Test-mode integration:** merchant verification, plan mapping, server-side subscription creation, Checkout SDK, HMAC webhooks, replay-safe ledger, statuses and cancellation, subscription-aware monthly quota and tests. Test transactions use sandbox keys only.
- **C. Production go-live:** switch existing Vercel account to compliant hosting, legal/tax signoff, LIVE credentials in encrypted environment settings, real low-value end-to-end transaction and refund/cancel test, alerting, and explicit merchant authorization. Never store card/UPI credentials on RhymeOrbit.

## Safe operational rules
- Keep `RAZORPAY_KEY_SECRET`, webhook signing secret and Supabase service-role credentials **server-side only**.
- Never expose webhook secrets, user email addresses or raw payment tokens through UI, logs or repository.
- Payment subscription webhook confirmation—not redirect URL or client callback—changes entitlement in Supabase.
- Duplicate or delayed webhooks must be idempotent and reversible, and failed/expired subscriptions must not keep paid entitlements.
- Honor the user’s requirement of **one repository, one existing deployment, one canonical music codepath**.
