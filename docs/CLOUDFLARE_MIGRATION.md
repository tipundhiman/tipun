> **Historical reference (superseded 31 Oct 2026):** Production is the existing Cloudflare Worker `tipun` at `rhymeorbit.in`, NOT Vercel. Use root `README.md`, `docs/RHYMEORBIT_SOURCE_OF_TRUTH.md`, and `docs/PRODUCTION_AUDIT_20261031.md` for the current release and deployment steps. Do not follow old Vercel env/DNS directions.

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
- `SUPABASE_URL` is a public project URL declared in `wrangler.jsonc` for the existing project; `SUPABASE_ANON_KEY` (public anon key) and `SUPABASE_SERVICE_ROLE_KEY` (secret) must remain configured for login/data. Never put the service role key in Git.
- `GEMINI_API_KEY` and `TREBLO_API_KEY` as secrets for lyrics and full songs with vocals.
- `YOUTUBE_API_KEY` if YouTube search is enabled.
- The Worker API now uses the existing native `SONGS_BUCKET` binding for private songs: it does **not** need S3 keys. Vercel remains backward-compatible with existing `api/r2.js` S3 credentials for rollback. Do not make the bucket public.
- Razorpay TEST values: `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, `RAZORPAY_TEST_WEBHOOK_SECRET`, `RAZORPAY_TEST_PREMIUM_MONTHLY_PLAN_ID`, `RAZORPAY_TEST_PRO_MONTHLY_PLAN_ID`. Never configure live payment checkout.

## Verify before changing production DNS
1. Confirm Cloudflare deployment for `master` succeeds and `https://tipun.dtipun.workers.dev/api/health` responds with `ok:true`, `authConfigured:true` and `aiConfigured:true` (not HTML/404). On October 24, 2026 the Worker was healthy but reported `authConfigured:false` because `SUPABASE_URL` was missing; it is now supplied in Wrangler for the next deployment.
2. Add required runtime secrets to `tipun`, then test `/api/config`. Never expose `SUPABASE_SERVICE_ROLE_KEY` or provider secrets.
3. Whitelist the Workers preview domain in Supabase auth redirect URLs and test login/logout/reset with a *test user*.
4. Test normal users/admin separation, monthly credits, lyrics, vocal song creation, backup/recovery, private R2 playback/seek/download/delete and Supabase legacy fallback.
5. If testing Razorpay subscriptions on Workers, create a matching TEST-only webhook (current configured webhook targets `rhymeorbit.in`); verify HMAC and sandbox ledger. No real payment collection.
6. Review rate limits, failure paths, monitoring, Cloudflare free CPU limits and billing alert.
7. **Only after all checks pass**, plan DNS cutover and rollback. Do not delete the old Vercel deployment, old Supabase storage or users.

Cloudflare staging is not production-ready just because `/api/health` works.
