# RhymeOrbit — migration from Vercel Hobby to Cloudflare Workers (test site)

The existing GitHub repository `tipundhiman/tipun` is deployed to **one existing Cloudflare Worker: `tipun`**. Vercel Git integration was disconnected by the user on October 24, 2026. The current `rhymeorbit.in` DNS and existing Vercel deployment must remain unchanged for rollback until the end-to-end checklist passes.

## Architecture
- Static frontend: `public/` (Cloudflare Workers static assets).
- API handler: `cloudflare/worker.js` forwards `/api/*` to the current `api/index.js` with `api-adapter.js` for Node-style requests and raw Razorpay webhook signatures.
- Existing private R2 bucket: `rhymeorbit-songs`, declared as binding `SONGS_BUCKET`.
- Supabase remains the canonical authentication and application database.
- Live checkout is **disabled**. Sandbox transactions do not grant paid song credits.

## Important: secrets and R2 integration are NOT migrated automatically

Cloudflare Workers -> existing `tipun` -> Settings -> Variables and Secrets. Add secrets in Cloudflare, never in Git, chats, or browser-visible JavaScript:
- `SUPABASE_URL` (text), `SUPABASE_ANON_KEY` (public anon key), `SUPABASE_SERVICE_ROLE_KEY` (secret) for login/data.
- `GEMINI_API_KEY` and `TREBLO_API_KEY` as secrets for lyrics and full songs with vocals.
- `YOUTUBE_API_KEY` if YouTube search is enabled.
- Current `api/r2.js` uses signed R2 S3 requests, so it still needs `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET_NAME`. Binding `SONGS_BUCKET` does not automatically replace those credentials.
- Razorpay TEST values: `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, `RAZORPAY_TEST_WEBHOOK_SECRET`, `RAZORPAY_TEST_PREMIUM_MONTHLY_PLAN_ID`, `RAZORPAY_TEST_PRO_MONTHLY_PLAN_ID`. Never configure live payment checkout.

## Verify before changing production DNS
1. Confirm Cloudflare deployment for `master` succeeds and `https://tipun.dtipun.workers.dev/api/health` responds with JSON `ok:true` (not HTML/404).
2. Add required runtime secrets to `tipun`, then test `/api/config`. Never expose `SUPABASE_SERVICE_ROLE_KEY` or provider secrets.
3. Whitelist the Workers preview domain in Supabase auth redirect URLs and test login/logout/reset with a *test user*.
4. Test normal users/admin separation, monthly credits, lyrics, vocal song creation, backup/recovery, private R2 playback/seek/download/delete and Supabase legacy fallback.
5. If testing Razorpay subscriptions on Workers, create a matching TEST-only webhook (current configured webhook targets `rhymeorbit.in`); verify HMAC and sandbox ledger. No real payment collection.
6. Review rate limits, failure paths, monitoring, Cloudflare free CPU limits and billing alert.
7. **Only after all checks pass**, plan DNS cutover and rollback. Do not delete the old Vercel deployment, old Supabase storage or users.

Cloudflare staging is not production-ready just because `/api/health` works.
