# RhymeOrbit + Cloudflare R2 (private song storage)

Your existing Cloudflare R2 bucket should be \`rhymeorbit-songs\`, Standard storage, **Public Access: Disabled**. Access tokens must be *Object Read & Write* and scoped to that bucket only.

## Step 1: Add four PRODUCTION environment variables to existing Vercel project

Vercel → existing RhymeOrbit Project → Settings → Environment Variables:

| Variable | Where to get its value |
| --- | --- |
| \`R2_ACCOUNT_ID\` | Cloudflare R2 → Overview → Account Details → Account ID (also in the R2 S3 API endpoint). 32 hexadecimal characters. |
| \`R2_ACCESS_KEY_ID\` | Access Key ID from your R2 token creation screen. |
| \`R2_SECRET_ACCESS_KEY\` | Secret Access Key from that token. **Never share** via chat or GitHub. |
| \`R2_BUCKET_NAME\` | \`rhymeorbit-songs\` |

Set each to **Production**. Don't prepend \`VITE_\`, \`NEXT_PUBLIC_\`, or \`PUBLIC_\`. Never commit secret files or screenshots showing credentials. Keep \`SUPABASE_*\`, \`TREBLO_API_KEY\` and the other existing production environment variables unchanged.

### Next

1. Save environment variables, redeploy the **existing** \`master\` production deployment.
2. As authorized site admin, inspect \`GET /api/storage/status\`. It shows \`storageConfigured:true\` with no secret values. This only proves that valid-looking environment variables exist, not that the key has R2 permissions.
3. Generate **one test song with vocals** from a regular logged-in account. After it finishes, go to R2 Objects. New archive should appear under \`songs/<user-id>/<task-id>.mp3\` or \`.ogg\`. Supabase \`generated_songs.storage_path\` starts \`r2:songs/\`.
4. Confirm playback/seek and retry refreshing the page. Check signed link expiration and song deletion.
5. Old Supabase songs are **not** moved or deleted. They continue to play by their existing signed Supabase links. Supabase remains the accounts, profiles, credits, and community database.

If an R2 key is incomplete or malformed, new audio archival fails safely. If all four keys are entirely absent, archive continues using the existing Supabase audio bucket until configuration is ready. Do not remove Supabase songs.

## Monitoring and cost

Add a Cloudflare R2 Budget Alert (prefer a low USD threshold), and monitor free usage: 10 GB-month Standard storage plus request allotments, not unlimited no-cost storage. Keep the bucket private and avoid public \`r2.dev\` links.

## What this phase does not yet change

Community image/video/audio file uploads currently use the \`creator-media\` Supabase bucket. The separate public media-feed system needs ownership-aware R2 uploads, signed public playback, bucket CORS, moderation and deletion verification before being switched. Do not describe Community media as moved to R2 until that integration is shipped and tested.

Reference: https://developers.cloudflare.com/r2/get-started/s3/
