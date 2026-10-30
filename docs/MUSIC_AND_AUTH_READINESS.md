> **Historical reference (superseded 31 Oct 2026):** Production is the existing Cloudflare Worker `tipun` at `rhymeorbit.in`, NOT Vercel. Use root `README.md`, `docs/RHYMEORBIT_SOURCE_OF_TRUTH.md`, and `docs/PRODUCTION_AUDIT_20261031.md` for the current release and deployment steps. Do not follow old Vercel env/DNS directions.

# RhymeOrbit: music readiness and account recovery

This project stays at \`tipundhiman/tipun\` → \`master\` → existing Vercel project for \`rhymeorbit.in\`.

## Why admin music worked but regular users saw "temporarily unavailable"
Admin music testing can reach the provider without consuming monthly user credits. Public music needs additional infrastructure: music provider credential, public switch, Supabase service role, \`music_usage\`, \`music_generation_reservations\`, \`generated_songs\`, and private \`song-audio\` bucket. The credit indicator "3/3" only measures quota. It is **not** a readiness confirmation.

### To activate
1. Open existing Supabase Dashboard → SQL Editor. Run the one complete script \`supabase/migrations/20261024_public_music_launch.sql\`. This must be executed on the existing project; uploading SQL to GitHub does not execute it.
2. In existing Vercel Project → Settings → Environment Variables, ensure \`TREBLO_API_KEY\`, \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\` exist for Production. If \`PUBLIC_MUSIC_GENERATION_ENABLED\` is explicitly \`false\`, set it to \`true\`. Never share credentials in chat, repo or screenshots.
3. Redeploy the latest \`master\` once after changing environment variables.
4. Sign in using an authorized admin account and open **Admin Dashboard → Music diagnostics**. This checks each prerequisite without showing secrets.
5. Confirm \`https://rhymeorbit.in/api/music/status\` returns \`publicGenerationEnabled:true\`. Do one real vocal-song generation with a regular user account, verify playback, backup, monthly credit deduction, access control and recovery from a different browser.

## Signup without confirmation email, with reset emails preserved
1. Existing Supabase Dashboard → Authentication → Providers → Email.
2. Keep **Email** provider enabled; disable **Confirm Email** if you explicitly want direct signup without confirmation mail. This setting is server-side and cannot be changed from frontend JavaScript.
3. Existing Supabase Dashboard → Authentication → URL Configuration: set Site URL to \`https://rhymeorbit.in\` and add \`https://rhymeorbit.in/reset-password.html\` under Redirect URLs. Include \`https://www.rhymeorbit.in/reset-password.html\` only if you use that domain.
4. Test signup: username/email/password gives immediate login with Confirm Email off. Test Forgot Password separately: an email goes to the registered address containing a recovery link leading to the new password form.
5. Use production SMTP (email delivery, sender verification, limits, reset-link expiry), spam/rate limiting, and abuse protections.

**Security caveat:** Turning off email confirmation means someone may register an email address they do not control. It makes account ownership weaker; weigh convenience against impersonation and abuse. The password reset email still requires control of the actual mailbox. Service security notifications, if enabled, may continue independently of signup confirmation.

## Extra improvements
- The music dashboard contains diagnostics, recent 100-task submission/refund/reservation counts, and an optional manual unit-cost estimate. It is not provider billing.
- A generated task is stored as Pending in cloud storage as soon as the provider accepts it. Reopen AI Studio to resume processing, including on another device. Final audio is archived to the private bucket after it is ready.
- An inline copyright authorization checkbox gates public requests on both frontend and backend. It is not a guarantee of legal clearance.
- Never publish provider API keys, paid provider names in UI, unverified output rights or promises of uptime. The Privacy/Terms pages still explain third-party AI usage appropriately.
