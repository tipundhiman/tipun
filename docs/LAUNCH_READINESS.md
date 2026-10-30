# RhymeOrbit — current launch readiness

**Updated 31 October 2026.** Canonical: GitHub `tipundhiman/tipun` (`master`) → existing **Cloudflare Worker `tipun`** → **rhymeorbit.in**, private R2 `rhymeorbit-songs`, Supabase Auth/database. Old Vercel references are superseded.

For the audited evidence, developer change map and device checklists:
- Root `README.md`: short technical handoff
- `docs/RHYMEORBIT_SOURCE_OF_TRUTH.md`: exact module ownership
- `docs/PRODUCTION_AUDIT_20261031.md`: what was verified, fixed and what still blocks launch
- `docs/PLAY_BILLING_MERCHANT_SETUP_20261030.md`: Play billing requirements

## Current safe stage
- Homepage and install page no longer claim `Free Public Beta / memberships coming soon`.
- Android TWA `in.rhymeorbit.app` v1.1.0 (versionCode 2) signed and available to Internal Testing; Closed Testing Alpha submission in review at last user check. Public Production availability **not verified**.
- Product IDs `rhymeorbit_premium` and `rhymeorbit_pro` exist in Google Play with active monthly base plans per Console screenshots. These **are not** proof of completed real billing.
- A dedicated Google Play service account has per-app permissions. Cloudflare has `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` encrypted secret; a read-only admin OAuth/product diagnostic exists. Real token verification is not yet active.
- Supabase can represent Free/Premium/Pro with aligned manual admin quota caps of 3/35/75 songs per month. Quota/entitlement rules must still be tested with live purchase events.
- `/.well-known/assetlinks.json` route is prepared. Production still needs **Play App Signing SHA-256** configured as `PLAY_APP_SIGNING_SHA256` and verified externally with status 200, JSON content type and no redirects.
- CI covers source syntax, APIs, R2, payments fail-closed, age rules and key UX helpers; this does not replace full device testing.

## No-go items for collecting real money
1. Verified purchase token ownership, Google Play `subscriptionsv2.get`, acknowledgement, idempotency, renewals, expiry, grace/hold, refund, revoke, restore and server entitlement sync.
2. License-tester purchase/restore/cancel/refund experience and download/credits authorization.
3. Actual Google Play App Links verification on the signed AAB on Android device.
4. Publishing/final regional price, refund terms, legal/merchant/payment requirements, provider song rights/quotas.
5. Google Play Closed Testing required tester counts/duration and production approval if not yet completed.

## User experience and trust to verify
- Guest onboarding; accurate age, DOB and no under-13 cloud accounts; teen social access blocked server side.
- Login, password recovery, songs and vocals, 3-song free cap, generated song playback/seek and downloads, private R2 media.
- Listen & Chill and Sing/Karaoke permissions, lyric timing, video export; no promise that a provider feature is live before testing.
- Media ownership, safety reports/moderation, account deletion with actual Supabase/R2 cleanup, legal/privacy and app store policies.
- SEO sitemap, verified canonical URL, mobile performance, accessibility, and accurate app listing.

## What counts as deployment verification
GitHub Actions passing proves tests; Cloudflare `Ready` proves a build exists; **neither proves live traffic or app store publication**. Compare latest GitHub commit SHA with Cloudflare active version, confirm **100% traffic**, and manually test `https://rhymeorbit.in/` from real network and device. A network-connected GitHub Actions public production smoke test subsequently checked the live domain: homepage, install page, health and billing-disabled endpoints passed; Android assetlinks.json returned HTTP 404 pending Play App Signing SHA-256. See the production smoke workflow log. Full browser/device acceptance testing is still pending.

Do not activate real checkout just by changing UI wording or the `checkoutEnabled:false` flag.
