# RhymeOrbit · Developer handoff

**Live product:** [rhymeorbit.in](https://rhymeorbit.in/) · **Android package:** `in.rhymeorbit.app` (Trusted Web Activity; currently Play internal/closed testing)  
**One source of truth:** `tipundhiman/tipun`, branch `master` → existing Cloudflare Worker **`tipun`** → `rhymeorbit.in`. **Do not create a second site, repository or paid deployment.**

## Start here (a new developer's first 10 minutes)

1. Open `docs/RHYMEORBIT_SOURCE_OF_TRUTH.md` for the file map and `docs/PRODUCTION_AUDIT_20261031.md` for the verified vs unverified status.
2. Install **Node.js 20+**. This repo uses built-in Node test runner, no project dependency install required for source tests.
3. Run `npm test` at repo root. For a no-login live endpoint check from a network-connected machine use `npm run audit:live`; it checks homepage/install copy, `/api/health`, payment gate and Android asset links. Do not merge on failing CI. Workflow: `.github/workflows/code-quality.yml`.
4. Modify only the necessary file; add/update its test. Push to **master**. Check both GitHub Actions **and** Cloudflare `tipun → Deployments → active version/traffic`; a green GitHub check is *not* proof that live traffic received the change.
5. Validate site as guest, 13–17 user, 18+ user, and authorized admin. Test mobile widths, browser navigation and actual saved media.
6. For Android-native changes, increment versionCode/versionName and create a signed AAB using the existing **upload signing key** workflow. **Website-only changes automatically appear in the TWA after deployment; no AAB is needed.**

## Architecture at a glance

| What to edit | Canonical file / system |
| --- | --- |
| 20 global Creator Lab tools (lyrics/music/release) | public/creator-lab.html, public/creator-lab.js, public/creator-lab-core.js, public/creator-lab.css; docs/CREATOR_LAB_20_TOOLS.md |
| Homepage, SPA routes, shared header, Admin dashboard | `public/index.html` |
| Login/signup/DOB/session | `public/integration.js` + Supabase Auth + `public.ro_account_ages` |
| Shared pricing & usage UI | `public/memberships.js` |
| Google Play detection in Android TWA | `public/play-billing.js`, Android `DelegationService` |
| Android cert association | `cloudflare/asset-links.js` + `PLAY_APP_SIGNING_SHA256` |
| Admin-only Google Play catalog/OAuth check | `cloudflare/play-billing-readiness.js` |
| Cloudflare production API routing | `cloudflare/worker.js`, `cloudflare/api-adapter.js` |
| Song quota, credits, server AI, admin endpoints | `api/index.js` + Supabase RPCs |
| R2 private media (do not publish bucket) | `cloudflare/media-storage.js`, `cloudflare/private-videos.js`, `SONGS_BUCKET` |
| Mobile nav, player and creators | `public/mobile-app.js`, `public/listen-player.js`, `public/creator-workspace.js` |
| React/Next.js? | **Neither** — vanilla JS/HTML, Node-compatible handlers, Cloudflare Worker |
| Android TWA | `android/` (Bubblewrap/Android Gradle), `android/twa-manifest.json` |
| Database schema & rules | Supabase project `ixpeheebqofrqedonnyf`; migrations under `supabase/migrations/` |
| Privacy / terms / deletion | `public/privacy.html`, `public/terms.html`, `public/delete-account.html` |

**Important engineering caveat:** `public/index.html` is still a large, script-heavy file and some feature modules deliberately wrap renderers. Do *not* rewrite it all at once. Extract one tested feature at a time after confirming original behavior. Documentation does not replace end-to-end browser validation.

## Environments and secrets

| Production environment | Configuration |
| --- | --- |
| Cloudflare Worker **tipun** | `wrangler.jsonc`, `public/` assets, `/api/*` routed through Worker |
| Database | Supabase Auth/Postgres (no song media stored in Supabase Storage for new releases) |
| Media | Existing Cloudflare R2 binding `SONGS_BUCKET`, bucket `rhymeorbit-songs` |
| API | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, music provider key |
| Play API read-only diagnostic | Encrypted `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret, Play Console per-app service account permissions |
| Android verified web association | Public **Play App Signing** SHA-256 as Cloudflare variable `PLAY_APP_SIGNING_SHA256`; **do not use upload key SHA-256** |
| Android AAB signing CI | GitHub repository encrypted signing secrets, `.github/workflows/android-aab-signed.yml` |

**Never commit or paste** private JSON credentials, keys, passwords, service-role credentials, signed purchase tokens or signing keystores into source, chat, screenshots or logs. Do not add Vercel secrets to Cloudflare docs; historical Vercel notes are superseded.

## Subscription product catalog

| Tier | Play subscription product | Current monthly base plan | Intended server quota |
| --- | --- | --- | --- |
| Free | none | none | 3 songs/month |
| Premium | `rhymeorbit_premium` | `premium-monthly` | up to 35 songs/month |
| Pro | `rhymeorbit_pro` | `pro-monthly` | up to 75 songs/month |

Products exist in Play Console. Actual Play regional pricing must be **read from Google Play**, not hard-coded UI previews. Checkout remains **OFF** until the server verifies and acknowledges purchases and manages restore, expiry, hold, refund, revocation, idempotent token ownership and entitlements. Never enable checkout by merely changing `checkoutEnabled:false` in `cloudflare/worker.js`.

Admin Dashboard may assign trial/manual entitlements separately; this **is not evidence of a paid purchase**. Enforce song quotas in the database RPC, not just the UI.

## Release smoke checks

- Static: `/`, `/install`, `/features`, `/privacy`, `/terms`, `/delete-account.html`, `/child-safety.html`, `/sitemap.xml`.
- API: `GET /api/health`, `GET /api/music/status`, `GET /api/play-billing/status`. Do not expose credentials or admin records.
- Admin only: `GET /api/play-billing/readiness` with a verified admin bearer token. This reads **products only**; it does **not** verify purchases or activate charges.
- App links: `GET /.well-known/assetlinks.json` must respond `200`, `application/json`, correct package + **Play App Signing** fingerprint, **no redirects**.
- Guest / logged in: DOB gate, logout, password reset, 3-song quota, lyrics/shayari, music generation, R2 playback/seek, download rights, saved content, UGC reporting and blocked teen interactions.
- Payments: license-tester purchase/restore/cancel/refund and visible 35/75 credit entitlement **before** switching checkout on.
- Cloudflare `Deployments`: verify latest commit's version receives **100% live traffic**; `Ready` alone is insufficient.

## Known blockers (do not claim public launch is complete)

1. Play app-signing SHA-256 still needs setting/verification in Cloudflare; source code does not embed the signing certificate.
2. Play Billing **real customer checkout and server purchase token verification** are not implemented end-to-end; paid checkout must remain disabled.
3. Production website/device browser walkthrough cannot be proven by CI. A person must test the actual deployed app.
4. UGC moderation, account deletion/R2 cleanup, privacy/commercial rights and Play production-access testing require operational verification.
5. Avoid claiming the Android app is publicly available in the Play Store while it is only on tester tracks.

See `docs/PRODUCTION_AUDIT_20261031.md` for a prioritised issue list and release gate.
