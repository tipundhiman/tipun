# Jamendo independent music — RhymeOrbit

Jamendo is for independent-artist music discovery in the existing **Listen & Chill** screen, not an unrestricted Bollywood or JioSaavn catalog. It does not supply licensed karaoke instrumentals or timestamp-aligned lyrics by default.

## Connect the account safely

1. In the deployment that serves `/api/*` (the canonical Vercel project), add `JAMENDO_CLIENT_ID` as an environment variable for Production, Preview and Development as needed. It is available in Jamendo's developer portal. Redeploy the existing project.
2. **Do not paste your Client Secret into chat or into `public/` JavaScript.** Jamendo's basic search/read API needs only `client_id`. Its `client_secret` is for OAuth workflows, which RhymeOrbit does not need here.
3. Visit `/api/jamendo/status`. After a valid Client ID is configured and the deployment is live, it should return `configured: true` and `publicCatalogEnabled: true`.
4. An authenticated RhymeOrbit admin can call `/api/admin/jamendo/check` to verify that the account works. This checks a sample upstream response without distributing the catalog publicly.
5. The owner has indicated that RhymeOrbit has the necessary provider permissions. The application assumes this confirmation; having API credentials by itself does not establish licensing. Review the provider agreement for in-app streaming, commercial promotion and future memberships. Karaoke, remixes, lyric display and recordings require additional rights, which are **not** enabled by this integration.
6. The original Listen & Chill search automatically shows Jamendo results with artist credit and license links when configured. No downloads, karaoke, file archiving or copying are offered. For incident response, setting `JAMENDO_CATALOG_DISABLED=true` disables public catalog access immediately after redeploy.

Provider docs: https://developer.jamendo.com/v3.0/tracks and https://developer.jamendo.com/v3.0/authentication

The public catalog additionally filters to Creative Commons BY or BY-SA and HTTPS Jamendo stream domains. The track's separate license and all attribution obligations must still be obeyed. Free-to-user access alone does not define the provider's commercial-use rights.
