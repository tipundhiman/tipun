# RhymeOrbit — production audit and engineering handoff
**31 October 2026 | Scope:** GitHub `tipundhiman/tipun` `master`, Cloudflare Worker `tipun` serving `rhymeorbit.in`, Supabase project `ixpeheebqofrqedonnyf`, Android TWA `in.rhymeorbit.app`.

## What has actually been checked

| Area | Evidence inspected | Current conclusion |
| --- | --- | --- |
| GitHub repository | Full tracked file tree, main frontend/worker/API sources, 30+ automated test modules, GitHub Actions runs | Substantial automated regression coverage exists, but not a true device walkthrough |
| Deployment | User's Cloudflare deployment screenshot: recent `master` builds show `Ready` | Source-to-Cloudflare build integration works; independently verify live traffic %/SHA |
| Live site | External website URL attempts from audit tool failed due network/DNS access in this environment | **Not independently verified**; no claim of live browser acceptance testing |
| Play Android | Android manifest, TWA config, signing CI and user's Play Console screenshots | `1.1.0` versionCode 2 Internal Testing available; Closed Testing Alpha review was pending; **not public production** |
| Google Play products | User's screenshots and repository | `rhymeorbit_premium` and `rhymeorbit_pro` exist with one active base plan each; account product setup is not checkout |
| Merchant integration | Cloudflare production encrypted `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret shown by user; `play-billing-readiness.js` | A protected read-only catalog/OAuth diagnostic is implemented, actual live response not yet user-confirmed |
| Supabase | Checked subscription constraint/function, RLS and security advisor | `free/premium/pro` DB support; service-only admin RPC; advisory notes below |
| Payments | `public/play-billing.js`, `cloudflare/worker.js`, Android Billing delegation | **Real checkout OFF; purchase verification, acknowledgement and settlement lifecycle NOT implemented** |
| Age & safety | Signup/old-account DOB gate and `ro_account_ages`, social RLS | Self-declared DOB saved privately; adult-only social controls; not third-party age assurance or child account consent |
| Sound & media | AI Studio, `api/index.js`, R2 storage handlers, client player and smoke tests | Protected media/quota implementation exists; actual playback/generation across devices not yet verified |

## Corrected in this release

1. **Old marketing labels.** Replaced hardcoded homepage `FREE PUBLIC BETA · MEMBERSHIPS COMING SOON` with factual music/lyrics positioning. Replaced outdated `/install` text that incorrectly said Android had no Play testing release.
2. **Android verified app association prepared.** Added `cloudflare/asset-links.js`, worker route and `wrangler.jsonc` routing for `/.well-known/assetlinks.json`. Only serves a valid Digital Asset Links declaration after `PLAY_APP_SIGNING_SHA256` is configured from the **Google Play app-signing certificate**. Unconfigured mode preserves existing asset fallback, never fabricates a fingerprint.
3. **Admin Pro quota consistency.** Aligned admin UI, server input validation and database `admin_set_subscription` with `free=3`, `premium<=35`, `pro<=75` songs/month. The service-only DB function still requires a trusted admin ID; ordinary authenticated and anonymous users do not have EXECUTE access.
4. **Current hosting terminology.** Updated runtime errors to point at Cloudflare logs instead of obsolete Vercel function logs.
5. **Regression tests.** Added release-label and Digital Asset Links tests; updated stale expectations in existing Cloudflare and install tests.
6. **Documentation.** Added project `README.md` handoff and refreshed source-of-truth / launch instructions to identify one existing Cloudflare production target.

## Critical remaining blockers — do not charge customers yet

### P0 — Play subscriptions and entitlements
A pair of active products and Google service credentials are **not** the same as an end-to-end payment system. Implement:
- TWA Digital Goods API product/offer selection and Google Play `PaymentRequest` purchase flow, tied to signed-in user identity;
- trusted API `purchases.subscriptionsv2.get` verification with exact package, product, account and token; unique token ownership/idempotency; acknowledged eligible purchases;
- durable webhook/RTDN or scheduled reconciliation for renewals, grace periods, holds, cancellations, refunds and revocations;
- atomic server-side 35/75 quota granting and removal with auditable billing ledger; restore prior purchases;
- license-tester flows before enabling `checkoutEnabled:true`; paid download authorization and cancellation UX.

**Do not** route digital subscriptions purchased in the Play-installed Android app through a generic external web Razorpay checkout. Web checkout needs a **separate** provider/compliance track.

### P0 — App Links configuration
`/.well-known/assetlinks.json` requires the **Play App Signing SHA-256** from Google Play Console → App integrity/App signing (not the upload certificate used to sign the AAB). Add it as Cloudflare runtime variable `PLAY_APP_SIGNING_SHA256` in existing production `tipun`. Then validate external `200` JSON/no redirects and Android fullscreen verification. Avoid publishing guessed keys.

### P0 — Actual production/device verification
Verify website served source, browser onboarding, signed-in session, media playback and TWA on Android (including a real tester device such as the user's Fold). Live website/network is unreachable from the current audit environment. The Cloudflare `Ready` status does **not** prove 100% traffic on the current version; inspect live rollout. Do not market as public Google Play release until Play confirms production access.

## High priority operational tests

- **Account age / children:** new signup requires birth date, old accounts declare once, under 13 offline-only Kids Studio, teens cannot send/read DMs or use matching/posting; no localStorage-only security assumption. Test all deep links and content access.
- **Security advisor:** three RLS service-only tables intentionally have no authenticated policies; three callable SECURITY DEFINER helper functions should be reviewed if their parameters/behavior change. Supabase Auth leaked-password protection is **disabled** and should be enabled in Dashboard.
- **Privacy/deletion:** deletion form prepares an email only; real support-run deletion (Auth, DB, public media, R2, archives, provider logs) needs a verified playbook and a test case.
- **UGC safety:** moderators, complaint workflow, reporting/blocks across comments/media, risky content escalation, review/appeal, especially under-18 safety.
- **Sound & video:** real paid music-provider quotas, playable complete vocal songs, desktop/mobile audio range and seek, failed-generation credits, offline behavior, Karaoke recording/mic permissions and lyrics synchronization.
- **Rights and commercial terms:** consent/copyright clearance, AI music provider licenses, public streaming catalog licenses, plan/credits expectations, regional/tax/refund terms, privacy, Play Data safety disclosures.
- **AAB signing hygiene:** signing key has previously been shared in conversation; protect GitHub Secrets, restrict CI access and consider a Google Play upload-key rotation after secure handoff.
- **Reliability:** server's IP API rate limiter is in-memory per isolate; use durable Cloudflare limiter / DB quotas for sensitive paid operations and monitor spending.
- **Code maintainability:** large inlined `public/index.html` and rendering wrappers remain; extract incrementally with tests rather than a risky mass rewrite.

## Developers: practical smoke-test checklist

1. `npm test` on Node 20+. Require GitHub CI green. Then run `npm run audit:live` from a network-connected machine to check public origin, actual deployed beta copy, billing-disabled status and Android certificate association.
2. Check same new GitHub commit deployed in **Cloudflare `tipun`**, monitor error rates and 100% live traffic.
3. In clean browsers test `/`, `/install`, `/features`, `/privacy`, `/terms`, `/delete-account.html`, `/child-safety.html` and `/.well-known/assetlinks.json`.
4. Check `/api/health`, `/api/music/status`, `/api/play-billing/status` (must be `checkoutEnabled:false`).
5. As authorized admin, use Memberships → Admin payment diagnostics → **Check Google Play Billing connection**; do not display credentials to user. Expected both product IDs `Connected` if Play API/permissions/secrets are correct.
6. Test real user signup/forgot-password, teen restriction, admin separation, music credit decrement and refund, R2 private playback/seek and HTTP range requests, AI songs/lyrics, and community reporting.
7. After P0 billing work: use Play license test users for purchase/restore, server unlock, renewal, cancellation/hold/refund and entitlement revocation **before opening real checkout**.

**Summary:** UI beta wording and server consistency corrected in source, production auto-build available, actual live UI and real customer payment flows **not fully certified**. Source is suitable for a staged engineering handoff, not an unconditional paid-public-launch signoff.

Relevant official references:
- [Android Digital Asset Links](https://developer.android.com/training/app-links/configure-assetlinks)
- [Trusted Web Activity Play Billing](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing)
- [Supabase Security Advisors](https://supabase.com/docs/guides/database/database-linter)
