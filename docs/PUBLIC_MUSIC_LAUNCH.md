# RhymeOrbit public vocal song launch — required one-time checklist

Source: \`tipundhiman/tipun\`, branch \`master\`, existing Vercel project for \`rhymeorbit.in\`.

## What code does
- Logged-in members get a **hard server-enforced 3 songs per UTC calendar month**, not a browser-only counter.
- Generate Lyrics uses the single Song Idea or Lyrics textarea; no duplicate Describe Your Song field and no overwrite confirmation popup. An Undo button is provided.
- Generate Song accepts the same textarea, with optional style and voice selection. Short ideas ask the provider to generate lyrics; longer sectioned drafts pass lyrics through. Provider request asks for music **with vocals**, not instrumental-only.
- The user's song task can be polled, played and archived to their private cloud library. Other users' task IDs are not accessible.
- Provider-confirmed FAILURE can trigger a one-time monthly-credit refund.
- The code avoids showing the names of implementation-specific AI providers in creative UI. The privacy policy still explains third-party processing for transparency.

## Required before inviting public users
1. In your **existing** Supabase SQL Editor, run the single complete SQL file \`supabase/migrations/20261024_public_music_launch.sql\`. It creates quota, reservations, cloud song records, private audio bucket and refund RPC, using idempotent creation where applicable.
2. In your **existing** Vercel project, check secret environment variables \`TREBLO_API_KEY\`, \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\`. Never paste secrets into frontend HTML, this repository, or chat. If you have \`PUBLIC_MUSIC_GENERATION_ENABLED=false\`, set it to \`true\` (or remove it) after confirming credentials, quota SQL and budget. Redeploy the latest master commit once.
3. Open \`https://rhymeorbit.in/api/music/status\`. It must report \`publicGenerationEnabled: true\`. If false, **do not** claim song creation is live: the key, pause switch, or DB/storage tables are not ready.
4. As a normal (not admin) test account, generate **one** vocal song; confirm status polling, in-browser playback and cloud archive. Then confirm credit remaining is 2 and that a fourth submission in the same month returns a quota error. Check an unrelated user cannot poll or archive the first user's task ID.
5. Watch provider spend, moderation, audio license, abuse and concurrent-generation errors before broad release.

## Important limits
- Free plan is 3 submissions/month. Failed provider jobs are refunded after confirmed failure; audio is not guaranteed to be perfect. The provider charges real usage and outputs may be temporary until archived.
- Paid Membership checkout is **not enabled**. Do not charge or promise paid entitlements until billing, refund policy, taxes and commercial hosting terms are resolved.
- Automated tests and a successful Vercel build are **not** proof of real voice-song generation with live provider credentials. That requires a monitored test request in production.
