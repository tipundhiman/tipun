# RhymeOrbit — Google Play subscriptions launch checklist (30 October 2026)

RhymeOrbit uses a Trusted Web Activity at `https://rhymeorbit.in` and Android package `in.rhymeorbit.app`.

## Product decision
Creator confirms Premium and Pro benefits can be fulfilled. This is a product claim, not a billing verification. Never bill users without a tested subscription-to-entitlement path. Current preview prices in `public/memberships.js` are ₹599 monthly Premium and ₹1299 monthly Pro; confirm actual prices in Play Console and use Play product price as source of truth.

## Current release and merchant status (31 October 2026)
- Android versionCode **2**, versionName **1.1.0** has successfully been signed with the registered Play upload key and published to **Internal testing** (available to invited internal testers).
- Same version is submitted to **Closed testing – Alpha**, currently in review. This does NOT constitute production/public release.
- Age-based account declaration is now recorded in a protected Supabase table, with DB adult-only protections for social interactions.
- **Real digital subscription checkout is OFF for all users**. Never flip the flag merely because merchant KYC has been scheduled or submitted.
- BillDesk/other web-payment KYC approval does NOT mean Google Play merchant profile and Google Play Billing service access are approved. Treat these as separate systems.

## Latest user-confirmed setup and source code (31 October 2026)
- Google Play Console currently has **two Active monthly subscription products**: `rhymeorbit_premium` (base plan `premium-monthly`) and `rhymeorbit_pro` (base plan `pro-monthly`). Verify final regional INR prices in Play Console; one screenshot showed Premium India ₹600 while the web preview listed ₹599.
- User reports merchant verification approved, and showed enabled **Google Play Android Developer API**, the `rhymeorbit-play-billing` service account as an Active Play Console user with permissions, and Cloudflare production encrypted `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. A source-based admin-only, read-only API check is at `/api/play-billing/readiness`. Its successful **live Google response** is still unverified.
- `cloudflare/asset-links.js` and the Worker route prepare `/.well-known/assetlinks.json`; to finish setup put the **Google Play App Signing SHA-256** in Cloudflare `PLAY_APP_SIGNING_SHA256` (public certificate hash, NOT upload-key SHA-256), then test it over HTTPS with JSON content type/no redirects.
- Supabase subscription table, manual admin API, and server-side quota reservation support Free 3, Premium 35, and Pro 75 songs/month, but **real Play purchase verification and entitlement synchronization remain unimplemented**.
- Android v1.1.0 (versionCode 2) was uploaded to Internal Testing and submitted to Closed Testing Alpha. Website changes to the TWA do not require a new AAB, only native code changes do.
- Checkout **remains disabled**; do not activate it because a service account is present or products show `Active`.

## Safe launch gate — block billing until all are confirmed
1. Google Play Console **merchant/payments profile shows verified/active** (not pending).
2. Two Play subscription products and base plans created/activated; exact product IDs, monthly/annual pricing, and which tier each product unlocks are known. Preview amounts in the UI are NOT checkout source of truth.
3. Secure Cloudflare backend receives a properly authorized Play Developer API identity. Never paste its private key into source code or chat.
4. Server verifies package name, subscription product ID, purchase token status/expiry and ownership, records unique token/idempotency, acknowledges eligible purchases, and grants/revokes Premium/Pro only through protected DB tables.
5. RTDN / periodic reconciliation processes renewal, payment hold, cancellation, expiry, refunds, and revoked purchases.
6. License testers successfully complete purchase, restore purchase, renew/cancel/refund, download/credits entitlement, and age eligibility tests **before** real-money launch.
7. Merchant owner explicitly approves go-live; only then remove the fail-closed gate on the Android checkout endpoint.
8. Website real subscriptions can be enabled separately **after the website PSP's production KYC, webhook signature validation, billing entitlement and tax/compliance steps** are complete. Do not route Play-installed TWA digital subscriptions to Razorpay/BillDesk instead of Play Billing.

## Prepared in code, on master
- Android versionCode 2 / versionName 1.1.0 is already uploaded to Internal testing; the Alpha release is in review.
- TWA Play Billing feature flag enabled; Android Browser Helper billing 1.2.0 dependency (Play Billing Library 8.3.0), Android DelegationService/DigitalGoodsRequestHandler, PaymentActivity and PaymentService declared.
- Digital Goods API capability detection exists at `public/play-billing.js`.
- /api/play-billing/status returns `checkoutEnabled:false`, and all /api/play-billing/* unknown operations fail closed with 503. No money can be charged through this integration.
- CI tests include `tests/play-billing-readiness.test.js`.

## Prerequisites in Google Play Console (developer action)
1. Verify the reported completed payments/merchant profile, including current status for the intended Play app. Avoid sharing merchant or bank details in chat.
2. Open **Monetize with Play → Products → Subscriptions**; confirm existing Premium and Pro subscription products and base plans. Record product IDs, billing periods, offer rules and regional prices. The first eligible base plan may be used by current Digital Goods API bridge; test monthly/annual carefully before offering both.
3. Grant a backend service identity appropriate Play Developer API access (purchase verification and acknowledgement only). Store credentials in Cloudflare encrypted secrets, not in GitHub, HTML, or Android.
4. Set up RTDN through Google Cloud Pub/Sub and subscription events; ensure callback verification and retries.
5. Implement and test real `/api/play-billing/verify`: authenticate RhymeOrbit user, validate token against Android Publisher purchases.subscriptionsv2.get with exact package name and product, enforce token ownership and idempotency in database, acknowledge verified purchases in time, update active entitlements and expiries on renewals/cancellation/hold/refund. Keep server-side ownership and durable event audit.
6. Implement TWA PaymentRequest purchase call and signed receipts submission **only after step 5**. Restore previous subscriptions with listPurchases.
7. Check visible paid credits, music quotas, HQ download gating, entitlement expiry, cancellation, refunds, payment failure and privacy. Creator confirms benefits can be delivered; actual Play-backed payment testing is still required.
8. When native Android/Gradle code changes, increment beyond existing **versionCode 2**, sign with the **original upload key**, and upload a new AAB to a tester track. Website-only TWA changes need only a Cloudflare deployment. Test purchase and refund with Play license testers. Test Digital Asset Links and Chrome TWA billing delegation.
9. Remove server-side checkout-disabled gate only after end-to-end tests and a final explicit go-live action.
10. Keep web checkout outside the Play-installed app subject to its own billing and tax requirements. Do not use a simple web Razorpay redirection inside the Play-installed TWA to evade Play billing requirements.

## Separate compliance work
- **Children**: Under-13 local-only Kids Studio, PIN and safety page exist; online child accounts are not enabled. Actual consent and server-enforced age limits, moderation, reporting and child-data security need formal tests and ongoing operations before declaring under-13 full compliance.
- **Trader status**: Declaration must be made by account owner through Play Console. Whether to mark trader or non-trader depends on business activity and applicable laws; don't fabricate a declaration.
- **Subscriptions**: Clearly state price, renewal frequency, cancellation and eligibility. Confirm actual Google Play Billing merchant fees and local tax/withholding as applicable.

Official references:
- https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing
- https://developer.android.com/google/play/billing/security
- https://github.com/GoogleChrome/android-browser-helper/blob/main/playbilling/docs/play-billing-library-8-migration.md
