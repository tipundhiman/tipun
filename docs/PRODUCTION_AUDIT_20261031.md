# RhymeOrbit — production audit and engineering handoff
**31 October 2026 | Scope:** GitHub `tipundhiman/tipun` `master`, Cloudflare Worker `tipun` serving `rhymeorbit.in`, Supabase project `ixpeheebqofrqedonnyf`, Android TWA `in.rhymeorbit.app`.

## Follow-up audit: 100-credit billing presentation and RLS (31 Oct 2026)

- **100 Orbit Credits = 1 song.** Protected `GET /api/music/credits` now returns exact numerical `creditCostPerSong` and `creditBalance` from the same server-backed `songs_used`, `songs_reserved` and monthly song limit that the quota RPC uses. Free 300, Premium up to 3,500 and Pro up to 7,500 represent **allowance**, not cash, top-ups, refunds or payment receipts.
- Cancelled or expired paid subscriptions fall back to Free 3 per calendar month; usage in that same UTC month is still counted. No paid HQ downloads on expired/inactive plans. Database `ro_reserve_song` was updated alongside API to keep behavior consistent.
- Supabase's **11 auth.uid RLS initplan warnings were fixed** by wrapping `auth.uid()` in `(SELECT auth.uid())` in ownership policies. A fresh advisor run showed no performance WARN findings, only unused-index INFO items. RLS authorization rules were not broadened.
- Reviewed three intentional `SECURITY DEFINER` helper functions: `can_message` checks the caller is participant A, `can_read_conversation` checks caller is participant A or B, and `ro_is_adult` uses the authenticated user's own age record; advisors still warn about their callable status. Keep these under review and never remove caller checks.
- **Supabase leaked-password protection is still disabled**; enable it in Supabase Dashboard Auth security settings. No available connector can safely change this setting in chat.
- Creator Lab microphone Permissions-Policy inheritance fixed for `/creator-lab`; manual browser/microphone validation still required.
- Google Play admin diagnostic now displays whether the **Play App Signing** fingerprint has been configured, without exposing credentials. Real charges remain intentionally disabled until purchase-token verification, acknowledgement, restore and cancellation are tested.
- Verified GitHub Code Quality run [here](https://github.com/tipundhiman/tipun/actions/runs/41143793270); this is source automation, not a licensed Google Play purchase test.

## International and cost-control patch (31 October 2026)

- UI now uses server-backed **100 Orbit Credits = 1 generated song**, Free 300 / Premium 3,500 / Pro 7,500 monthly allowance; no real-money wallet/top-ups.
- Official [Treblo v3 API docs](https://treblo.com/developers/docs) confirm **100 upstream provider credits per generation and 1 song per v3 generation**. [Provider API pricing](https://treblo.com/developers/pricing) quotes Starter $11 for 20,000 upstream credits/month (about 200 songs) and top-up prices. Internal Orbit Credits are **not transferable upstream or cash**. Keep attribution required by provider terms.
- Google Play monthly subscription products are configured, but annual base plans are **not**; removed the fake annual-switch preview. Android TWA Digital Goods API can now **read** actual localized subscription prices without starting a payment. Web shows indicative INR pricing until genuine checkout exists.
- Removed misleading "Select Premium/Pro" CTAs: they now perform a real **availability check** and inform users that no purchase has been made.
- Added Cloudflare **MUSIC_GENERATION_RATE_LIMITER** (6 POST generation requests per minute per Cloudflare client IP). This is **approximate per Cloudflare colo**, layered on server-verified and atomically reserved per-user Supabase monthly quotas, not a perfect global anti-abuse spend cap. If the rate-limit binding throws, the expensive request fails closed with 503.
- Verified the existing `ro_refund_failed_song` function is service-only and idempotent on submitted task + owner. Backend invokes it only after checking the provider's trusted FAILURE status. Paid receipt verification and refund/restore for Google Play are **separate incomplete work**.
- The new Creator Lab microphone header uses an explicit Cloudflare inherited-header removal before enabling opt-in mic access. Full physical-device testing still needs human validation.
- Automated code regressions reached **207 passed, 0 failed** at run [41144523345](https://github.com/tipundhiman/tipun/actions/runs/41144523345). Later source commits require rechecking their own CI status.

## What has actually been checked

| Area | Evidence inspected | Current conclusion |
| --- | --- | --- |
| GitHub repository | Full tracked file tree, main frontend/worker/API sources, 30+ automated test modules, GitHub Actions runs | Substantial automated regression coverage exists, but not a true device walkthrough |
| Deployment | User's Cloudflare deployment screenshot: recent `master` builds show `Ready` | Source-to-Cloudflare build integration works; independently verify live traffic %/SHA |
| Live site | GitHub Actions [production smoke](https://github.com/tipundhiman/tipun/actions/runs/41140333536) ran external HTTP requests against https://rhymeorbit.in | **4/5 pass:** Homepage, install page, /api/health and billing-disabled endpoint. **Fail:** Android /.well-known/assetlinks.json returned 404; no end-to-end browser/device acceptance testing |
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
Verify website served source, browser onboarding, signed-in session, media playback and TWA on Android (including a real tester device such as the user's Fold). Live website/network is unreachable from the current audit environment. The Cloudflare `Ready` status does **not** prove 100% traffic by itself; the GitHub runner subsequently confirmed updated homepage/install/API content from the public domain. Inspect live rollout history for 100% traffic and device behavior. Do not market as public Google Play release until Play confirms production access.

## High priority operational tests

- **Account age / children:** new signup requires birth date, old accounts declare once, under 13 offline-only Kids Studio, teens cannot send/read DMs or use matching/posting; no localStorage-only security assumption. Test all deep links and content access.
- **Security advisor:** three RLS service-only tables intentionally have no authenticated policies; three callable SECURITY DEFINER helper functions should be reviewed if their parameters/behavior change. Supabase Auth leaked-password protection is **disabled** and should be enabled in Dashboard. Performance advisor reported 11 RLS policy initplan warnings and unused-index informational items. An index for `safety_reports.reporter` was added to correct its unindexed foreign key.
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

**Summary:** UI beta wording and server consistency corrected in source, production auto-build available, actual live UI and real customer payment flows **not fully certified**. Source is suitable for a staged engineering handoff, not an unconditional paid-public-launch signoff. The network-connected GitHub runner confirmed **4 of 5 public checks pass**; remaining 404 is Android Digital Asset Links until the verified app-signing SHA-256 is set.

Relevant official references:
- [Android Digital Asset Links](https://developer.android.com/training/app-links/configure-assetlinks)
- [Trusted Web Activity Play Billing](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing)
- [Supabase Security Advisors](https://supabase.com/docs/guides/database/database-linter)
