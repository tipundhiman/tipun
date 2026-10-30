# RhymeOrbit · single production source of truth

**Last reviewed:** 31 October 2026. **Source:** `tipundhiman/tipun` on `master`. **Deployment:** existing Cloudflare Worker **`tipun`**, domain **https://rhymeorbit.in**; static directory `public/`, API `/api/*`, existing R2 bucket **`rhymeorbit-songs`**.

**Old Vercel documentation is historical. Vercel is not the canonical site.** Do not create a second Cloudflare Worker, Vercel deployment, Supabase project or duplicate frontend for changes to RhymeOrbit.

## Find the code in seconds

| User-facing feature | Change here | Server-side authority |
| --- | --- | --- |
| Home/SPA navigation, studio/dashboard, admin | `public/index.html` | `cloudflare/worker.js` |
| Signup, age declaration, session, saved projects | `public/integration.js` | Supabase Auth + `public.ro_account_ages` |
| Pricing and plan comparison | `public/memberships.js` | `public.subscriptions`, `api/index.js` |
| Google Play Billing detection | `public/play-billing.js`, Android TWA files | **Purchases disabled pending verified backend** |
| Google Play catalog-only diagnostic | `cloudflare/play-billing-readiness.js` | Play Developer API service account secret; admin only |
| App links / Android fullscreen verification | `cloudflare/asset-links.js` + `wrangler.jsonc` | `PLAY_APP_SIGNING_SHA256` (Play *app-signing* cert) |
| Songs and quotas | `api/index.js`, `api/r2.js` | Supabase `ro_reserve_song`, `music_usage`, private R2 |
| Riya/lyrics | `public/riya-chat.js`, `cloudflare/creator-lyrics.js` | `/api/ai`, configured Gemini |
| Listen & Chill | `public/listen-player.js`, `public/jamendo-indie.js` | licensed/discovery APIs, source-specific rights |
| Sing/karaoke and voice | `public/sing-your-song.js`, `public/vocal-lab.js` | browser microphone permission |
| My Videos and uploads | `public/video-maker.js`, `public/media.js` | `cloudflare/private-videos.js`, `cloudflare/media-storage.js` |
| Community/UGC | `public/community-feed.js`, `public/social.js` | Supabase RLS + moderation |
| Mobile nav, theme, walkthrough | `public/mobile-app.js`, `public/ro-design.js`, `public/feature-guide.js` | one existing site |
| Android app, Play AAB, signing | `android/`, `.github/workflows/android-aab-signed.yml` | Google Play Console tracks |

## Contract for backend work

- Only verified server data can grant subscriptions, generate song credits, authorize private downloads or access admin functions. Never trust `localStorage`, client plan selectors, `user_metadata` or PaymentRequest success screen.
- **Free 3 / Premium up to 35 / Pro up to 75 songs per month.** Both API and `ro_reserve_song` enforce quota, and manual admin RPC must stay aligned. Paid credits only after verified purchases or explicit manual administrator grants.
- New signup has a date of birth and old accounts declare DOB once. `ro_account_ages` is private, with adult-only social controls. This does not constitute independently verified age assurance or parental consent.
- All new song/media data uses **private Cloudflare R2**. Auth and other application state remain in Supabase.
- `/api/play-billing/status` and purchases remain **fail-closed**. Google catalog diagnostic is read-only, and **does not** authorize charging.
- `/.well-known/assetlinks.json` must contain Play **app-signing** SHA-256, not the uploaded signing keystore SHA-256.
- Secrets stay in Cloudflare encrypted runtime vars or GitHub Actions encrypted signing secrets. No keys in GitHub, HTML or chat.

## Regression and deploy rules

1. `npm test` (Node >=20), inspect `.github/workflows/code-quality.yml` results.
2. Make one focused change. The legacy `public/index.html` is large; avoid untested mass splitting, rewriting wrappers or duplicating logins.
3. Confirm existing Cloudflare Worker **tipun** Production deployment receives the **new SHA and 100% of traffic**, not only `Ready`.
4. Smoke-test actual `rhymeorbit.in` on desktop + mobile + logged-out/teen/adult/admin accounts. Automated CI does not prove media playback or native delegation.
5. Android website-only changes appear inside TWA after web deploy; Java/Gradle changes require a new signed release with increased version code, and Play testing/review.
6. Record residual blockers in `docs/PRODUCTION_AUDIT_20261031.md` and never claim full public or paid launch without explicit device/merchant verification.

The full new-developer guide is in root `README.md`. Historical Vercel instructions are archived context, not deployment authority.
